"""Pydantic models for request/response DTOs."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: dict


# ---------- Users ----------
class UserCreateIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str  # admin | counsellor | reception
    phone: Optional[str] = None


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    phone: Optional[str] = None
    permission_overrides: Optional[List[str]] = None
    permission_revokes: Optional[List[str]] = None


# ---------- Courses ----------
class CourseIn(BaseModel):
    name: str
    total_fee: float
    duration: str
    active: bool = True


# ---------- Leads ----------
class LeadCreateIn(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    qualification: Optional[str] = None
    course_id: str
    source: Optional[str] = None
    batch_preference: Optional[str] = None
    assigned_counsellor_id: Optional[str] = None  # None = auto round-robin
    remarks: Optional[str] = None
    consent: bool


class LeadUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    qualification: Optional[str] = None
    course_id: Optional[str] = None
    source: Optional[str] = None
    batch_preference: Optional[str] = None
    assigned_counsellor_id: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class NoteIn(BaseModel):
    text: str


class FollowUpIn(BaseModel):
    due_at: datetime
    note: Optional[str] = None


class FollowUpCompleteIn(BaseModel):
    completed: bool = True


# ---------- Templates ----------
class TemplateIn(BaseModel):
    name: str
    body: str
    is_default: bool = False


# ---------- Messages ----------
class MessageLogIn(BaseModel):
    lead_id: str
    template_id: Optional[str] = None
    rendered_body: str
    channel: str = "whatsapp"


# ---------- Payments ----------
class CreatePaymentLinkIn(BaseModel):
    lead_id: str


# ---------- Settings ----------
class SettingsIn(BaseModel):
    registration_amount: Optional[float] = None
    discount_percent: Optional[float] = None
    offer_hours: Optional[int] = None  # if None, expires at 23:59 same day
    reception_can_send_whatsapp: Optional[bool] = None
    counsellors_view_all: Optional[bool] = None


# ---------- Roles ----------
class RoleUpdateIn(BaseModel):
    permissions: List[str]
