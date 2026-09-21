"""Arts of Finance - Lead & Admission Management System (FastAPI)."""
import os
import io
import csv
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from db import (
    users, roles, leads, courses, notes, followups, lead_updates,
    message_logs, templates, payments, receipts as receipts_coll,
    audit_logs, settings_coll, ensure_indexes,
)
from auth import (
    hash_password, verify_password, create_token,
    get_current_user, get_effective_permissions,
    require_permission, require_role,
)
from models import (
    LoginIn, TokenOut, UserCreateIn, UserUpdateIn, CourseIn,
    LeadCreateIn, LeadUpdateIn, NoteIn, FollowUpIn, FollowUpCompleteIn,
    FollowUpUpdateIn, AssignLeadIn, BulkAssignIn,
    TemplateIn, MessageLogIn, CreatePaymentLinkIn, SettingsIn, RoleUpdateIn,
)
from permissions import ALL_PERMISSIONS
from utils import new_id, now_iso, now_utc, ist_date_str, get_settings, compute_offer_expiry, audit, render_template
from payments_provider import get_provider
from scheduler import start_scheduler, poll_pending_payments, daily_backup

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("aof")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Arts of Finance LMS")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@app.on_event("startup")
async def _startup() -> None:
    await ensure_indexes()
    # Seed once
    from seed import seed
    await seed()
    start_scheduler()


@api.get("/health")
async def health() -> dict:
    return {"ok": True, "time": now_iso()}


# =====================================================================
# AUTH
# =====================================================================
@api.post("/auth/login", response_model=TokenOut)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginIn):
    u = await users.find_one({"email": body.email.lower(), "active": True})
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(u["id"], u["role"], u["email"])
    perms = await get_effective_permissions(u)
    await audit(u["id"], u["role"], "auth.login", "user", u["id"], None)
    return {"token": token, "user": {
        "id": u["id"], "name": u["name"], "email": u["email"],
        "role": u["role"], "permissions": sorted(perms),
    }}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    perms = await get_effective_permissions(user)
    return {**user, "permissions": sorted(perms)}


# =====================================================================
# USERS (Admin)
# =====================================================================
@api.get("/users")
async def list_users(_: dict = Depends(require_permission("user.manage"))):
    docs = await users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return docs


@api.post("/users")
async def create_user(body: UserCreateIn, actor: dict = Depends(require_permission("user.manage"))):
    if body.role not in {"admin", "counsellor", "reception"}:
        raise HTTPException(400, "Invalid role")
    if await users.find_one({"email": body.email.lower()}):
        raise HTTPException(409, "Email already used")
    doc = {
        "id": new_id(),
        "name": body.name,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "phone": body.phone,
        "active": True,
        "permission_overrides": [],
        "permission_revokes": [],
        "created_at": now_iso(),
    }
    to_insert = dict(doc)
    await users.insert_one(to_insert)
    await audit(actor["id"], actor["role"], "user.create", "user", doc["id"], {"email": doc["email"]})
    doc.pop("password_hash", None)
    return doc


@api.patch("/users/{uid}")
async def update_user(uid: str, body: UserUpdateIn, actor: dict = Depends(require_permission("user.manage"))):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "No changes")
    updates["updated_at"] = now_iso()
    r = await users.update_one({"id": uid}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "User not found")
    await audit(actor["id"], actor["role"], "user.update", "user", uid, updates)
    return {"ok": True}


@api.get("/counsellors")
async def list_counsellors(_: dict = Depends(get_current_user)):
    docs = await users.find({"role": "counsellor", "active": True}, {"_id": 0, "password_hash": 0}).to_list(200)
    return docs


# =====================================================================
# ROLES / PERMISSIONS
# =====================================================================
@api.get("/permissions/catalog")
async def perm_catalog(_: dict = Depends(get_current_user)):
    return {"permissions": ALL_PERMISSIONS}


@api.get("/roles")
async def list_roles(_: dict = Depends(require_permission("role.manage"))):
    return await roles.find({}, {"_id": 0}).to_list(50)


@api.put("/roles/{name}")
async def update_role(name: str, body: RoleUpdateIn, actor: dict = Depends(require_permission("role.manage"))):
    bad = [p for p in body.permissions if p not in ALL_PERMISSIONS]
    if bad:
        raise HTTPException(400, f"Unknown perms: {bad}")
    r = await roles.update_one({"name": name}, {"$set": {"permissions": body.permissions, "updated_at": now_iso()}})
    if r.matched_count == 0:
        raise HTTPException(404, "Role not found")
    await audit(actor["id"], actor["role"], "role.update", "role", name, {"permissions": body.permissions})
    return {"ok": True}


# =====================================================================
# COURSES
# =====================================================================
@api.get("/courses")
async def list_courses(active_only: bool = False, _: dict = Depends(get_current_user)):
    q = {"active": True} if active_only else {}
    return await courses.find(q, {"_id": 0}).to_list(500)


@api.post("/courses")
async def create_course(body: CourseIn, actor: dict = Depends(require_permission("course.manage"))):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    to_insert = dict(doc)
    await courses.insert_one(to_insert)
    await audit(actor["id"], actor["role"], "course.create", "course", doc["id"], None)
    return doc


@api.patch("/courses/{cid}")
async def update_course(cid: str, body: CourseIn, actor: dict = Depends(require_permission("course.manage"))):
    r = await courses.update_one({"id": cid}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    if r.matched_count == 0:
        raise HTTPException(404, "Course not found")
    await audit(actor["id"], actor["role"], "course.update", "course", cid, None)
    return {"ok": True}


# =====================================================================
# LEADS
# =====================================================================
async def _round_robin_counsellor() -> Optional[str]:
    active = await users.find({"role": "counsellor", "active": True}, {"_id": 0}).to_list(200)
    if not active:
        return None
    # least-recently assigned first
    counts = {}
    for c in active:
        cnt = await leads.count_documents({"assigned_counsellor_id": c["id"], "deleted_at": None})
        counts[c["id"]] = cnt
    return min(counts, key=counts.get)


@api.get("/leads/duplicate")
async def check_duplicate(phone: str, _: dict = Depends(get_current_user)):
    doc = await leads.find_one({"phone": phone, "deleted_at": None}, {"_id": 0})
    return {"exists": bool(doc), "lead": doc}


@api.post("/leads")
async def create_lead(body: LeadCreateIn, actor: dict = Depends(require_permission("lead.create"))):
    if not body.consent:
        raise HTTPException(400, "Consent is required")
    course = await courses.find_one({"id": body.course_id})
    if not course:
        raise HTTPException(400, "Course not found")
    counsellor_id = body.assigned_counsellor_id
    if not counsellor_id:
        counsellor_id = actor["id"] if actor["role"] == "counsellor" else await _round_robin_counsellor()

    settings = await get_settings()
    visit_dt = now_utc()
    offer_expires = compute_offer_expiry(visit_dt, settings.get("offer_hours"))

    doc = {
        "id": new_id(),
        "name": body.name.strip(),
        "phone": body.phone.strip(),
        "email": (body.email or "").lower() or None,
        "city": body.city,
        "qualification": body.qualification,
        "course_id": body.course_id,
        "source": body.source,
        "batch_preference": body.batch_preference,
        "assigned_counsellor_id": counsellor_id,
        "join_timeline": body.join_timeline,
        "entry_mode": body.entry_mode or "visit_form",
        "status": "New",
        "visit_date": visit_dt.isoformat(),
        "offer_expires_at": offer_expires.isoformat(),
        "consent": True,
        "remarks": body.remarks,
        "created_by": actor["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "deleted_at": None,
    }
    to_insert = dict(doc)
    await leads.insert_one(to_insert)
    await audit(actor["id"], actor["role"], "lead.create", "lead", doc["id"], {"course": course["name"]})
    return doc


async def _apply_lead_visibility(user: dict, query: dict) -> dict:
    perms = await get_effective_permissions(user)
    settings = await get_settings()
    if "lead.view_all" in perms:
        return query
    if user["role"] == "counsellor" and not settings.get("counsellors_view_all"):
        query["assigned_counsellor_id"] = user["id"]
    return query


@api.get("/leads")
async def list_leads(
    q: Optional[str] = None, status: Optional[str] = None,
    course_id: Optional[str] = None, counsellor_id: Optional[str] = None,
    include_deleted: bool = False, mine_today: bool = False,
    user: dict = Depends(get_current_user),
):
    perms = await get_effective_permissions(user)
    if "lead.view_all" not in perms and "lead.view_own" not in perms:
        raise HTTPException(403, "No permission to view leads")
    query: dict = {}
    if not include_deleted:
        query["deleted_at"] = None
    if status:
        query["status"] = status
    if course_id:
        query["course_id"] = course_id
    if counsellor_id:
        query["assigned_counsellor_id"] = counsellor_id
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    query = await _apply_lead_visibility(user, query)
    if mine_today:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        query["visit_date"] = {"$regex": f"^{today}"}
    docs = await leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api.get("/dashboard/followups")
async def dashboard_followups(counsellor_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    perms = await get_effective_permissions(user)
    if "lead.view_all" not in perms and "lead.view_own" not in perms:
        raise HTTPException(403, "No permission to view leads")
    query: dict = {"deleted_at": None}
    if "lead.view_all" in perms:
        if counsellor_id:
            query["assigned_counsellor_id"] = counsellor_id
    else:
        settings = await get_settings()
        if user["role"] == "counsellor" and not settings.get("counsellors_view_all"):
            query["assigned_counsellor_id"] = user["id"]
        elif counsellor_id:
            query["assigned_counsellor_id"] = counsellor_id

    docs = await leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    ids = [d["id"] for d in docs]
    last_map: dict = {}
    if ids:
        ups = await lead_updates.find({"lead_id": {"$in": ids}}, {"_id": 0}).sort("created_at", -1).to_list(5000)
        for u in ups:
            last_map.setdefault(u["lead_id"], u.get("discussed"))
    cmap: dict = {}
    for c in await users.find({"role": "counsellor"}, {"_id": 0, "password_hash": 0}).to_list(200):
        cmap[c["id"]] = c["name"]

    for d in docs:
        d["last_discussion"] = last_map.get(d["id"])
        d["assigned_counsellor_name"] = cmap.get(d.get("assigned_counsellor_id"))

    today = ist_date_str(0)
    tomorrow = ist_date_str(1)
    week_ahead = ist_date_str(7)

    def is_open(d: dict) -> bool:
        return d["status"] not in ("Registered", "Lost")

    today_list = [d for d in docs if d.get("next_followup_date") == today]
    tomorrow_list = [d for d in docs if d.get("next_followup_date") == tomorrow]
    overdue_list = sorted(
        [d for d in docs if d.get("next_followup_date") and d["next_followup_date"] < today and is_open(d)],
        key=lambda d: d["next_followup_date"],
    )
    upcoming_list = sorted(
        [d for d in docs if d.get("next_followup_date") and today < d["next_followup_date"] <= week_ahead],
        key=lambda d: d["next_followup_date"],
    )
    no_date_list = [d for d in docs if not d.get("next_followup_date") and is_open(d)]
    form_leads = [d for d in docs if d.get("entry_mode", "visit_form") != "manual"]

    return {
        "today": today_list,
        "tomorrow": tomorrow_list,
        "overdue": overdue_list,
        "upcoming": upcoming_list,
        "no_date": no_date_list,
        "all_leads": docs,
        "form_leads": form_leads,
        "visited": docs,
        "counts": {
            "today": len(today_list), "tomorrow": len(tomorrow_list),
            "overdue": len(overdue_list), "upcoming": len(upcoming_list),
            "no_date": len(no_date_list), "all_leads": len(docs), "form_leads": len(form_leads),
        },
    }


@api.get("/leads/{lid}")
async def get_lead(lid: str, user: dict = Depends(get_current_user)):
    doc = await leads.find_one({"id": lid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Lead not found")
    perms = await get_effective_permissions(user)
    if "lead.view_all" not in perms:
        settings = await get_settings()
        if user["role"] == "counsellor" and not settings.get("counsellors_view_all"):
            if doc["assigned_counsellor_id"] != user["id"]:
                raise HTTPException(403, "Not your lead")
    # attach related
    doc["notes"] = await notes.find({"lead_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    doc["updates"] = await lead_updates.find({"lead_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    doc["followups"] = await followups.find({"lead_id": lid}, {"_id": 0}).sort("due_at", 1).to_list(500)
    doc["messages"] = await message_logs.find({"lead_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    doc["payments"] = await payments.find({"lead_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    doc["receipts"] = await receipts_coll.find({"lead_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return doc


@api.patch("/leads/{lid}")
async def update_lead(lid: str, body: LeadUpdateIn, user: dict = Depends(require_permission("lead.edit"))):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "No changes")
    updates["updated_at"] = now_iso()
    r = await leads.update_one({"id": lid, "deleted_at": None}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    await audit(user["id"], user["role"], "lead.update", "lead", lid, updates)
    return {"ok": True}


@api.delete("/leads/{lid}")
async def delete_lead(lid: str, actor: dict = Depends(require_permission("lead.delete"))):
    await leads.update_one({"id": lid}, {"$set": {"deleted_at": now_iso()}})
    await audit(actor["id"], actor["role"], "lead.delete", "lead", lid, None)
    return {"ok": True}


@api.post("/leads/{lid}/restore")
async def restore_lead(lid: str, actor: dict = Depends(require_permission("lead.restore"))):
    await leads.update_one({"id": lid}, {"$set": {"deleted_at": None}})
    await audit(actor["id"], actor["role"], "lead.restore", "lead", lid, None)
    return {"ok": True}


# ---- Notes ----
@api.post("/leads/{lid}/notes")
async def add_note(lid: str, body: NoteIn, user: dict = Depends(require_permission("notes.add"))):
    doc = {"id": new_id(), "lead_id": lid, "author_id": user["id"], "author_name": user["name"],
           "text": body.text, "created_at": now_iso()}
    to_insert = dict(doc)
    await notes.insert_one(to_insert)
    await audit(user["id"], user["role"], "note.add", "lead", lid, None)
    return doc


# ---- Follow-ups ----
@api.post("/leads/{lid}/followups")
async def add_followup(lid: str, body: FollowUpIn, user: dict = Depends(require_permission("followup.manage"))):
    doc = {"id": new_id(), "lead_id": lid, "user_id": user["id"], "due_at": body.due_at.isoformat(),
           "note": body.note, "completed": False, "created_at": now_iso()}
    to_insert = dict(doc)
    await followups.insert_one(to_insert)
    return doc


@api.patch("/followups/{fid}")
async def complete_followup(fid: str, body: FollowUpCompleteIn, user: dict = Depends(require_permission("followup.manage"))):
    await followups.update_one({"id": fid}, {"$set": {"completed": body.completed, "completed_at": now_iso() if body.completed else None}})
    return {"ok": True}


@api.get("/followups/mine")
async def my_followups(user: dict = Depends(get_current_user)):
    docs = await followups.find({"user_id": user["id"], "completed": False}, {"_id": 0}).sort("due_at", 1).to_list(500)
    return docs


# ---- Follow-up Updates (discussion timeline) ----
FU_STATUSES = {"New", "Contacted", "Visited", "Interested", "Possible Joining", "Future Joining", "Registered", "Lost"}


@api.post("/leads/{lid}/updates")
async def add_lead_update(lid: str, body: FollowUpUpdateIn, user: dict = Depends(get_current_user)):
    perms = await get_effective_permissions(user)
    if "followup.add_own" not in perms and "followup.view_all" not in perms:
        raise HTTPException(403, "Missing permission to add follow-up updates")
    lead = await leads.find_one({"id": lid, "deleted_at": None}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if "followup.view_all" not in perms and lead.get("assigned_counsellor_id") != user["id"]:
        raise HTTPException(403, "This lead is not assigned to you")
    if not (body.discussed or "").strip():
        raise HTTPException(400, "Please describe what was discussed")
    if body.status not in FU_STATUSES:
        raise HTTPException(400, "Invalid status")
    closing = body.status in ("Registered", "Lost")
    if not closing and not body.next_followup_date:
        raise HTTPException(400, "Next follow-up date is required")
    if body.status == "Lost" and not (body.lost_reason or "").strip():
        raise HTTPException(400, "Please provide a short reason for marking this lead as Lost")

    nfd = None if closing else body.next_followup_date
    nft = None if closing else body.next_followup_time
    doc = {
        "id": new_id(), "lead_id": lid, "type": "followup",
        "author_id": user["id"], "author_name": user["name"],
        "discussed": body.discussed.strip(), "status": body.status,
        "next_followup_date": nfd, "next_followup_time": nft,
        "lost_reason": (body.lost_reason or "").strip() or None,
        "created_at": now_iso(),
    }
    await lead_updates.insert_one(dict(doc))
    await leads.update_one({"id": lid}, {"$set": {
        "status": body.status, "next_followup_date": nfd,
        "next_followup_time": nft, "updated_at": now_iso(),
    }})
    await audit(user["id"], user["role"], "followup.add", "lead", lid, {"status": body.status})
    return doc


@api.delete("/updates/{uid}")
async def delete_lead_update(uid: str, actor: dict = Depends(require_role("admin"))):
    r = await lead_updates.delete_one({"id": uid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Update not found")
    await audit(actor["id"], actor["role"], "followup.delete", "update", uid, None)
    return {"ok": True}


# =====================================================================
# TEMPLATES + WHATSAPP
# =====================================================================
@api.get("/templates")
async def list_templates(_: dict = Depends(get_current_user)):
    return await templates.find({}, {"_id": 0}).to_list(200)


@api.post("/templates")
async def create_template(body: TemplateIn, actor: dict = Depends(require_permission("template.manage"))):
    if body.is_default:
        await templates.update_many({}, {"$set": {"is_default": False}})
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    to_insert = dict(doc)
    await templates.insert_one(to_insert)
    await audit(actor["id"], actor["role"], "template.create", "template", doc["id"], None)
    return doc


@api.patch("/templates/{tid}")
async def update_template(tid: str, body: TemplateIn, actor: dict = Depends(require_permission("template.manage"))):
    if body.is_default:
        await templates.update_many({}, {"$set": {"is_default": False}})
    await templates.update_one({"id": tid}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    await audit(actor["id"], actor["role"], "template.update", "template", tid, None)
    return {"ok": True}


@api.delete("/templates/{tid}")
async def delete_template(tid: str, actor: dict = Depends(require_permission("template.manage"))):
    await templates.delete_one({"id": tid})
    await audit(actor["id"], actor["role"], "template.delete", "template", tid, None)
    return {"ok": True}


async def _build_message_vars(lead: dict) -> dict:
    settings = await get_settings()
    course = await courses.find_one({"id": lead["course_id"]}, {"_id": 0}) or {}
    counsellor = await users.find_one({"id": lead.get("assigned_counsellor_id")}, {"_id": 0, "password_hash": 0}) or {}
    pay = await payments.find_one({"lead_id": lead["id"]}, {"_id": 0}, sort=[("created_at", -1)]) or {}
    fee = float(course.get("total_fee", 0))
    dp = float(settings["discount_percent"])
    discounted = round(fee * (1 - dp / 100.0), 2)
    return {
        "student_name": lead["name"],
        "course_name": course.get("name", ""),
        "course_fee": f"{fee:.0f}",
        "discounted_fee": f"{discounted:.0f}",
        "discount_percent": f"{dp:.0f}",
        "registration_amount": f"{settings['registration_amount']:.0f}",
        "offer_valid_till": lead["offer_expires_at"][:16].replace("T", " "),
        "counsellor_name": counsellor.get("name", ""),
        "payment_link": pay.get("short_url", ""),
    }


@api.get("/leads/{lid}/preview-message")
async def preview_message(lid: str, template_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    lead = await leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    tpl = await templates.find_one({"id": template_id} if template_id else {"is_default": True}, {"_id": 0})
    if not tpl:
        tpl = await templates.find_one({}, {"_id": 0})
    if not tpl:
        raise HTTPException(400, "No templates configured")
    vars_ = await _build_message_vars(lead)
    body = render_template(tpl["body"], vars_)
    phone = lead["phone"].replace("+", "").replace(" ", "")
    if not phone.startswith("91"):
        phone = "91" + phone[-10:]
    wa_link = f"https://wa.me/{phone}?text={quote(body)}"
    return {"template_id": tpl["id"], "template_name": tpl["name"], "body": body, "whatsapp_link": wa_link, "vars": vars_}


@api.post("/message-log")
async def log_message(body: MessageLogIn, user: dict = Depends(get_current_user)):
    # Reception is allowed only when admin has toggled it on. Everyone else needs message.send perm.
    if user["role"] == "reception":
        s = await get_settings()
        if not s.get("reception_can_send_whatsapp"):
            raise HTTPException(403, "Reception is not allowed to send WhatsApp (admin has disabled)")
    else:
        perms = await get_effective_permissions(user)
        if "message.send" not in perms:
            raise HTTPException(403, "Missing permission: message.send")
    doc = {"id": new_id(), "lead_id": body.lead_id, "template_id": body.template_id,
           "rendered_body": body.rendered_body, "channel": body.channel,
           "sender_id": user["id"], "sender_name": user["name"], "created_at": now_iso()}
    to_insert = dict(doc)
    await message_logs.insert_one(to_insert)
    await audit(user["id"], user["role"], "message.send", "lead", body.lead_id, {"channel": body.channel})
    return doc


# =====================================================================
# PAYMENTS
# =====================================================================
@api.post("/payments/create-link")
async def create_payment_link(body: CreatePaymentLinkIn, user: dict = Depends(require_permission("payment.create"))):
    lead = await leads.find_one({"id": body.lead_id, "deleted_at": None}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    course = await courses.find_one({"id": lead["course_id"]}, {"_id": 0}) or {}
    settings = await get_settings()
    reg_amount = float(settings["registration_amount"])
    fee = float(course.get("total_fee", 0))
    dp = float(settings["discount_percent"])
    discount_amount = round(fee * dp / 100.0, 2)

    provider = get_provider()
    info = provider.create_link(
        amount_paise=int(reg_amount * 100),
        description=f"Registration - {course.get('name','Course')}"[:255],
        notes={"lead_id": lead["id"], "course_id": lead["course_id"]},
        reference_id=lead["id"][:40],
        customer={"name": lead["name"], "contact": lead["phone"], "email": lead.get("email") or ""},
    )
    doc = {
        "id": new_id(),
        "lead_id": lead["id"],
        "provider": provider.name,
        "razorpay_link_id": info["link_id"],
        "short_url": info["short_url"],
        "amount": reg_amount,
        "amount_paid": 0.0,
        "discount_amount": discount_amount,
        "status": info["status"],
        "created_by": user["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    to_insert = dict(doc)
    await payments.insert_one(to_insert)
    await audit(user["id"], user["role"], "payment.create", "lead", lead["id"], {"link_id": info["link_id"]})
    return doc


@api.post("/payments/{pid}/check")
async def check_payment(pid: str, user: dict = Depends(require_permission("payment.view"))):
    p = await payments.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Payment not found")
    provider = get_provider()
    info = provider.fetch_link(p["razorpay_link_id"])
    from scheduler import _apply_payment_update
    if info["status"] != p["status"]:
        await _apply_payment_update(p, info)
    updated = await payments.find_one({"id": pid}, {"_id": 0})
    return updated


@api.get("/payments")
async def list_payments(_: dict = Depends(require_permission("payment.view"))):
    return await payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.get("/receipts/{rid}/pdf")
async def download_receipt(rid: str, user: dict = Depends(require_permission("payment.view"))):
    rec = await receipts_coll.find_one({"id": rid}, {"_id": 0})
    if not rec or not rec.get("pdf_path"):
        raise HTTPException(404, "Receipt not found")
    return FileResponse(rec["pdf_path"], media_type="application/pdf", filename=f"{rec['receipt_number']}.pdf")


@api.get("/receipts")
async def list_receipts(_: dict = Depends(require_permission("payment.view"))):
    return await receipts_coll.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


# =====================================================================
# SETTINGS
# =====================================================================
@api.get("/settings")
async def read_settings(_: dict = Depends(get_current_user)):
    s = await get_settings()
    return s


@api.patch("/settings")
async def update_settings(body: SettingsIn, actor: dict = Depends(require_permission("settings.manage"))):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = now_iso()
    await settings_coll.update_one({"id": "singleton"}, {"$set": updates}, upsert=True)
    await audit(actor["id"], actor["role"], "settings.update", "settings", "singleton", updates)
    return await get_settings()


# =====================================================================
# REPORTS
# =====================================================================
@api.get("/reports/dashboard")
async def report_dashboard(_: dict = Depends(require_permission("reports.view"))):
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    week_start = (now - __import__("datetime").timedelta(days=7)).isoformat()
    month_start = (now - __import__("datetime").timedelta(days=30)).isoformat()

    visits_today = await leads.count_documents({"visit_date": {"$regex": f"^{today}"}, "deleted_at": None})
    visits_week = await leads.count_documents({"visit_date": {"$gte": week_start}, "deleted_at": None})
    visits_month = await leads.count_documents({"visit_date": {"$gte": month_start}, "deleted_at": None})
    total = await leads.count_documents({"deleted_at": None})
    registered = await leads.count_documents({"status": "Registered", "deleted_at": None})
    conv = round((registered / total) * 100.0, 2) if total else 0.0
    paid_agg = await payments.aggregate([{"$match": {"status": "paid"}}, {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}]).to_list(1)
    revenue = paid_agg[0]["sum"] if paid_agg else 0.0

    # per-counsellor
    counsellors = await users.find({"role": "counsellor"}, {"_id": 0, "password_hash": 0}).to_list(200)
    per_c = []
    for c in counsellors:
        c_leads = await leads.count_documents({"assigned_counsellor_id": c["id"], "deleted_at": None})
        c_reg = await leads.count_documents({"assigned_counsellor_id": c["id"], "status": "Registered", "deleted_at": None})
        per_c.append({"id": c["id"], "name": c["name"], "leads": c_leads, "registered": c_reg,
                      "conversion": round((c_reg / c_leads) * 100.0, 2) if c_leads else 0.0})
    return {
        "visits_today": visits_today, "visits_week": visits_week, "visits_month": visits_month,
        "total_leads": total, "registered": registered, "conversion_pct": conv, "revenue": revenue,
        "counsellors": per_c,
    }


@api.get("/leads/export/csv")
async def export_leads(_: dict = Depends(require_permission("reports.view"))):
    docs = await leads.find({"deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    out = io.StringIO()
    if not docs:
        docs = [{}]
    fields = ["id", "name", "phone", "email", "city", "qualification", "course_id",
              "source", "batch_preference", "assigned_counsellor_id", "status",
              "visit_date", "offer_expires_at", "created_at"]
    w = csv.DictWriter(out, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for d in docs:
        w.writerow(d)
    out.seek(0)
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=leads.csv"})


# =====================================================================
# AUDIT + BACKUP + TRASH
# =====================================================================
@api.get("/audit")
async def read_audit(limit: int = Query(200, le=1000), _: dict = Depends(require_permission("audit.view"))):
    return await audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)


@api.post("/backup/now")
async def backup_now(actor: dict = Depends(require_permission("backup.manage"))):
    path = await daily_backup()
    await audit(actor["id"], actor["role"], "backup.manual", "system", "-", {"path": path})
    return {"ok": True, "path": path}


@api.get("/trash/leads")
async def trash_leads(_: dict = Depends(require_permission("lead.restore"))):
    return await leads.find({"deleted_at": {"$ne": None}}, {"_id": 0}).sort("deleted_at", -1).to_list(500)


@api.post("/payments/poll-now")
async def payments_poll_now(_: dict = Depends(require_permission("payment.view"))):
    updated = await poll_pending_payments()
    return {"ok": True, "updated": updated}


app.include_router(api)
