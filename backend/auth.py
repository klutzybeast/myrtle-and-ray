"""Auth utilities + router."""
from __future__ import annotations
import os
import secrets
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr

from email_service import queue_email

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def _set_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotBody(BaseModel):
    email: EmailStr


class ResetBody(BaseModel):
    token: str
    new_password: str


class ChangeBody(BaseModel):
    current_password: str
    new_password: str


def make_router(db):
    router = APIRouter(prefix="/auth", tags=["auth"])

    async def get_current_user(request: Request) -> dict:
        token = request.cookies.get("access_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Invalid token type")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    async def require_admin(request: Request) -> dict:
        user = await get_current_user(request)
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        return user

    @router.post("/login")
    async def login(body: LoginBody, response: Response):
        email = body.email.lower().strip()
        user = await db.users.find_one({"email": email})
        if not user or not verify_password(body.password, user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        access = create_access_token(user["id"], user["email"])
        refresh = create_refresh_token(user["id"])
        _set_cookies(response, access, refresh)
        settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
        if settings.get("admin_login_alert_enabled"):
            await queue_email(
                db,
                to=settings.get("admin_login_alert_email", "community@rollingriver.com"),
                subject="Admin login on Myrtle and Ray site",
                html=f"<p>An admin login occurred for {user['email']} at {datetime.now(timezone.utc).isoformat()} UTC.</p>",
                purpose="admin_login_alert",
            )
        return {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "admin"),
            "access_token": access,
            "force_password_change": user.get("force_password_change", False),
        }

    @router.post("/logout")
    async def logout(response: Response):
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/")
        return {"ok": True}

    @router.get("/me")
    async def me(user: dict = Depends(get_current_user)):
        return user

    @router.post("/refresh")
    async def refresh_token(request: Request, response: Response):
        token = request.cookies.get("refresh_token")
        if not token:
            raise HTTPException(status_code=401, detail="No refresh token")
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Invalid token type")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(user["id"], user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
        return {"ok": True}

    @router.post("/forgot-password")
    async def forgot_password(body: ForgotBody):
        email = body.email.lower().strip()
        user = await db.users.find_one({"email": email})
        if user:
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + timedelta(hours=1)
            await db.password_reset_tokens.insert_one({
                "token": token,
                "user_id": user["id"],
                "expires_at": expires,
                "used": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
            dest = settings.get("password_reset_email", email)
            link = f"/admin/reset-password?token={token}"
            await queue_email(
                db,
                to=dest,
                subject="Reset your Myrtle and Ray admin password",
                html=f"<p>Click here to reset your password: <a href='{link}'>{link}</a></p><p>This link expires in 1 hour.</p>",
                purpose="password_reset",
            )
        return {"ok": True}

    @router.post("/reset-password")
    async def reset_password(body: ResetBody):
        record = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
        if not record:
            raise HTTPException(status_code=400, detail="Invalid or used token")
        expires = record["expires_at"]
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires)
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Token expired")
        await db.users.update_one(
            {"id": record["user_id"]},
            {"$set": {"password_hash": hash_password(body.new_password), "force_password_change": False}},
        )
        await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
        return {"ok": True}

    @router.post("/change-password")
    async def change_password(body: ChangeBody, user: dict = Depends(get_current_user)):
        record = await db.users.find_one({"id": user["id"]})
        if not record or not verify_password(body.current_password, record.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"password_hash": hash_password(body.new_password), "force_password_change": False}},
        )
        return {"ok": True}

    return router, get_current_user, require_admin
