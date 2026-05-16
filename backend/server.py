"""Myrtle and Ray FastAPI server."""
from __future__ import annotations
import os
import logging
import mimetypes
from pathlib import Path

from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import Response, FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from auth import make_router as make_auth_router
from public_router import make_public_router
from admin_router import make_admin_router
from seed import seed_database
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
api_router.include_router(make_admin_router(db, require_admin))

app.include_router(api_router)

# Uploads: try local disk first (fast path, dev env, legacy files), then
# fall back to Emergent Object Storage so files survive redeploys.
upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
os.makedirs(upload_dir, exist_ok=True)


@app.get("/api/uploads/{filename:path}")
@app.head("/api/uploads/{filename:path}")
async def serve_upload(filename: str):
    # Block path traversal.
    if ".." in filename or filename.startswith("/"):
        raise HTTPException(status_code=400, detail="Bad path")
    local_path = os.path.join(upload_dir, filename)
    if os.path.exists(local_path) and os.path.isfile(local_path):
        mime, _ = mimetypes.guess_type(local_path)
        return FileResponse(local_path, media_type=mime or "application/octet-stream")
    # Fall back to persistent storage.
    fetched = _storage.get_object(filename)
    if fetched is None:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = fetched
    # Cache aggressively — UUID-based filenames are content-addressed.
    headers = {"Cache-Control": "public, max-age=31536000, immutable"}
    return Response(content=data, media_type=content_type, headers=headers)


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
