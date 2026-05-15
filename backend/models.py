"""Pydantic models for Myrtle and Ray site."""
from datetime import datetime, timezone
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, EmailStr, ConfigDict
import uuid


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Character(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    name: str
    slug: str
    species: str = ""
    role: str = ""
    bio: str = ""
    image_url: str = ""
    wave_value: str = ""  # W / A / V / E
    fun_fact: str = ""
    linked_product_slug: str = ""
    audio_url: str = ""
    is_core: bool = False
    order: int = 0
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    role: Optional[str] = None
    bio: Optional[str] = None
    image_url: Optional[str] = None
    wave_value: Optional[str] = None
    fun_fact: Optional[str] = None
    linked_product_slug: Optional[str] = None
    audio_url: Optional[str] = None
    order: Optional[int] = None


class ProductVariant(BaseModel):
    label: str = ""
    sku: str = ""
    printify_url: str = ""
    price: Optional[float] = None


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    name: str
    slug: str
    category: str = "Stuffies"
    character_slug: str = ""
    short_description: str = ""
    long_description: str = ""
    price: float = 0.0
    compare_at_price: Optional[float] = None
    images: List[str] = Field(default_factory=list)
    primary_image: str = ""
    printify_url: str = ""
    variants: List[ProductVariant] = Field(default_factory=list)
    inventory_status: Literal["In Stock", "Low Stock", "Sold Out", "Coming Soon"] = "In Stock"
    featured: bool = False
    tags: List[str] = Field(default_factory=list)
    seo_title: str = ""
    meta_description: str = ""
    og_image: str = ""
    published: bool = True
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class ProductCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    category: str = "Stuffies"
    character_slug: str = ""
    short_description: str = ""
    long_description: str = ""
    price: float = 0.0
    compare_at_price: Optional[float] = None
    images: List[str] = Field(default_factory=list)
    primary_image: str = ""
    printify_url: str = ""
    variants: List[ProductVariant] = Field(default_factory=list)
    inventory_status: str = "In Stock"
    featured: bool = False
    tags: List[str] = Field(default_factory=list)
    seo_title: str = ""
    meta_description: str = ""
    og_image: str = ""
    published: bool = True


class DownloadCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    name: str
    slug: str
    icon: str = "FileText"
    description: str = ""
    color: str = "#40E0D0"
    order: int = 0
    visible: bool = True
    created_at: str = Field(default_factory=_now)


class DownloadFile(BaseModel):
    label: str = ""
    url: str
    filename: str = ""
    size_kb: int = 0
    page_count: int = 0
    mime: str = ""


class DownloadItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    title: str
    slug: str
    category_slugs: List[str] = Field(default_factory=list)
    character_slug: str = ""
    cover_image: str = ""
    short_description: str = ""
    long_description: str = ""
    age_range: str = "Ages 3 to 8"
    audiences: List[str] = Field(default_factory=list)  # Parents/Teachers/Camp Directors/Kids
    wave_values: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    files: List[DownloadFile] = Field(default_factory=list)
    email_gate_override: Optional[bool] = None  # None=use global setting
    featured: bool = False
    is_new: bool = True
    new_until: Optional[str] = None
    order: int = 0
    published: bool = True
    seo_title: str = ""
    meta_description: str = ""
    total_downloads: int = 0
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class WaveCard(BaseModel):
    letter: str
    title: str
    description: str
    color: str = "#40E0D0"


class Page(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    key: str  # homepage_hero, about, for_camps, etc.
    title: str = ""
    content: dict = Field(default_factory=dict)
    updated_at: str = Field(default_factory=_now)


class SiteSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    site_name: str = "Myrtle and Ray"
    tagline: str = "Catch the W.A.V.E. of Excitement"
    logo_url: str = ""
    favicon_url: str = ""
    # Email routing
    primary_contact_email: str = "community@rollingriver.com"
    contact_form_email: str = "community@rollingriver.com"
    wholesale_email: str = "community@rollingriver.com"
    press_email: str = "community@rollingriver.com"
    mailing_list_reply_to: str = "community@rollingriver.com"
    download_capture_email: str = "community@rollingriver.com"
    password_reset_email: str = "community@rollingriver.com"
    admin_login_alert_email: str = "community@rollingriver.com"
    admin_login_alert_enabled: bool = True
    outgoing_from_email: str = "hello@myrtleandray.com"
    # Store URLs
    amazon_book_url: str = "https://www.amazon.com/"
    printify_popup_url: str = "https://myrtleandray.printify.me/"
    # Socials
    facebook_url: str = ""
    instagram_url: str = ""
    tiktok_url: str = ""
    youtube_url: str = ""
    pinterest_url: str = ""
    twitter_url: str = ""
    threads_url: str = ""
    linkedin_url: str = ""
    custom_socials: List[dict] = Field(default_factory=list)
    # Footer / Misc
    footer_text: str = "© 2026 KingApe Media. All rights reserved."
    google_analytics_id: str = ""
    meta_pixel_id: str = ""
    # Downloads gating
    email_gate_enabled: bool = True
    max_upload_mb: int = 25
    updated_at: str = Field(default_factory=_now)


class ContactSubmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    type: Literal["contact", "wholesale", "mailing_list", "download_capture"] = "contact"
    name: str = ""
    email: str = ""
    phone: str = ""
    subject: str = ""
    message: str = ""
    # Wholesale extras
    camp_name: str = ""
    quantity: str = ""
    order_date: str = ""
    # Download capture extras
    audience: str = ""
    download_slug: str = ""
    download_title: str = ""
    subscribe_to_list: bool = True
    read: bool = False
    created_at: str = Field(default_factory=_now)


class MailingListSubscriber(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    email: str
    name: str = ""
    source: str = "signup"  # signup/footer/popup/download_capture
    audience: str = ""
    tags: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=_now)


class EmailOutboxItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    to: str
    from_email: str = ""
    reply_to: str = ""
    subject: str
    html: str = ""
    text: str = ""
    status: Literal["pending", "sent", "failed"] = "pending"
    purpose: str = ""
    error: str = ""
    created_at: str = Field(default_factory=_now)
    sent_at: str = ""


class MediaItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    url: str
    filename: str
    mime: str = ""
    size_kb: int = 0
    width: int = 0
    height: int = 0
    page_count: int = 0
    tags: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=_now)


class ActivityContent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    key: str  # rhyme_time, quiz, word_search, etc.
    title: str = ""
    data: dict = Field(default_factory=dict)
    updated_at: str = Field(default_factory=_now)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
