"""Myrtle and Ray FastAPI server."""
from __future__ import annotations
import os
import re
import logging
import mimetypes
from pathlib import Path

from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import Response, FileResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from auth import make_router as make_auth_router
from public_router import make_public_router
from admin_router import make_admin_router
from seed import seed_database
from email_service import queue_email
from square_router import make_public_square_router, make_admin_orders_router
from shipstation_router import make_shipstation_router
from discount_router import make_public_discount_router, make_admin_discount_router
from penpals_router import make_penpals_router
from coloring_router import make_coloring_router
from seastar_studio_router import make_seastar_studio_router
from story_quest_router import make_story_quest_router
from sing_along_router import make_sing_along_router
from voice_router import make_voice_router
from readaloud_router import make_readaloud_router
from printify_router import make_printify_router
from etsy_router import make_etsy_router
import storage as _storage


mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Myrtle and Ray API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"ok": True, "service": "myrtle-and-ray"}


auth_router, get_current_user, require_admin = make_auth_router(db)
api_router.include_router(auth_router)
api_router.include_router(make_public_router(db))
api_router.include_router(make_public_square_router(db, queue_email))
api_router.include_router(make_shipstation_router())
api_router.include_router(make_public_discount_router(db))
api_router.include_router(make_penpals_router(db, require_admin))
api_router.include_router(make_coloring_router(db, require_admin))
api_router.include_router(make_seastar_studio_router(db, require_admin))
api_router.include_router(make_story_quest_router(db, require_admin))
api_router.include_router(make_sing_along_router(db, require_admin))
api_router.include_router(make_voice_router(db))
api_router.include_router(make_readaloud_router(db, require_admin))
api_router.include_router(make_printify_router(db, require_admin))
api_router.include_router(make_etsy_router(db, require_admin))
admin_router_obj = make_admin_router(db, require_admin)
# Mount admin orders under the existing /admin prefix
admin_router_obj.include_router(make_admin_orders_router(db))
admin_router_obj.include_router(make_admin_discount_router(db, require_admin))
api_router.include_router(admin_router_obj)

app.include_router(api_router)

# Uploads: try local disk first (fast path, dev env, legacy files), then
# fall back to Emergent Object Storage so files survive redeploys.
upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
os.makedirs(upload_dir, exist_ok=True)


_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _serve_local_with_range(local_path: str, content_type: str, range_header: str | None):
    """Serve a file from local disk, honoring HTTP Range requests so
    <audio>/<video> can stream + seek correctly."""
    file_size = os.path.getsize(local_path)
    common_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
    }

    if not range_header:
        return FileResponse(
            local_path,
            media_type=content_type,
            headers=common_headers,
        )

    m = _RANGE_RE.match(range_header)
    if not m:
        # Malformed Range -> serve full file (per RFC 7233)
        return FileResponse(local_path, media_type=content_type, headers=common_headers)

    start_s, end_s = m.group(1), m.group(2)
    start = int(start_s) if start_s else 0
    end = int(end_s) if end_s else file_size - 1
    if start > end or start >= file_size:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})
    end = min(end, file_size - 1)
    length = end - start + 1

    def iter_chunk():
        with open(local_path, "rb") as fh:
            fh.seek(start)
            remaining = length
            chunk_size = 64 * 1024
            while remaining > 0:
                read_size = min(chunk_size, remaining)
                data = fh.read(read_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        **common_headers,
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Content-Length": str(length),
    }
    return StreamingResponse(iter_chunk(), status_code=206, media_type=content_type, headers=headers)


@app.get("/api/uploads/{filename:path}")
@app.head("/api/uploads/{filename:path}")
async def serve_upload(filename: str, request: Request):
    # Block path traversal.
    if ".." in filename or filename.startswith("/"):
        raise HTTPException(status_code=400, detail="Bad path")
    local_path = os.path.join(upload_dir, filename)
    range_header = request.headers.get("range")

    if os.path.exists(local_path) and os.path.isfile(local_path):
        mime, _ = mimetypes.guess_type(local_path)
        return _serve_local_with_range(local_path, mime or "application/octet-stream", range_header)

    # Fall back to persistent storage. Lazy backfill to local disk so
    # subsequent requests use the Range-aware FileResponse path —
    # essential for <audio>/<video> seeking and progressive playback.
    fetched = _storage.get_object(filename)
    if fetched is None:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = fetched
    try:
        # Atomic write: temp file + rename so half-written bytes are never visible.
        tmp_path = f"{local_path}.{os.getpid()}.part"
        os.makedirs(os.path.dirname(local_path) or upload_dir, exist_ok=True)
        with open(tmp_path, "wb") as fh:
            fh.write(data)
        os.replace(tmp_path, local_path)
        return _serve_local_with_range(local_path, content_type or "application/octet-stream", range_header)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Backfill write failed for %s: %s — serving in-memory", filename, exc)
        headers = {"Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "none"}
        return Response(content=data, media_type=content_type or "application/octet-stream", headers=headers)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("server")


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.characters.create_index("slug", unique=True)
        await db.products.create_index("slug", unique=True)
        await db.downloads.create_index("slug", unique=True)
        await db.download_categories.create_index("slug", unique=True)
        await db.pages.create_index("key", unique=True)
        await db.activity_content.create_index("key", unique=True)
        await db.mailing_list.create_index("email", unique=True)
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=3600)
        await seed_database(db)
        if _storage.is_enabled():
            _storage._init_storage()  # warm the session key, ignore failure (lazy retry on first use)
            logger.info("Startup: storage enabled")
        else:
            logger.warning("Startup: EMERGENT_LLM_KEY not set — uploads will only persist on local disk")
        logger.info("Startup: seed complete")
    except Exception as exc:
        logger.exception("Startup error: %s", exc)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
