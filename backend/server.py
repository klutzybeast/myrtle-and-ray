"""Myrtle and Ray FastAPI server."""
from __future__ import annotations
import os
import logging
from pathlib import Path

from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient

from auth import make_router as make_auth_router
from public_router import make_public_router
from admin_router import make_admin_router
from seed import seed_database


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

# Static uploads
upload_dir = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=upload_dir), name="uploads")

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
        logger.info("Startup: seed complete")
    except Exception as exc:
        logger.exception("Startup error: %s", exc)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
