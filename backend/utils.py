"""Small helpers: IDs, timestamps, audit log writer, template rendering."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from db import audit_logs, settings_coll


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def strip_id(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


async def get_settings() -> dict:
    doc = await settings_coll.find_one({"id": "singleton"}, {"_id": 0})
    if not doc:
        doc = {
            "id": "singleton",
            "registration_amount": 1000.0,
            "discount_percent": 10.0,
            "offer_hours": None,  # None => 23:59 same day
            "reception_can_send_whatsapp": False,
            "counsellors_view_all": False,
            "updated_at": now_iso(),
        }
        await settings_coll.insert_one(dict(doc))
    return doc


def compute_offer_expiry(visit_dt: datetime, offer_hours: Optional[int]) -> datetime:
    if offer_hours:
        return visit_dt + timedelta(hours=offer_hours)
    # end of day (23:59:59.999) in IST-agnostic UTC based on visit_dt local day
    end = visit_dt.replace(hour=23, minute=59, second=59, microsecond=0)
    return end


async def audit(actor_id: str, actor_role: str, action: str, entity: str, entity_id: str, meta: Optional[dict] = None) -> None:
    doc = {
        "id": new_id(),
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "meta": meta or {},
        "created_at": now_iso(),
    }
    await audit_logs.insert_one(dict(doc))


def render_template(body: str, vars: dict) -> str:
    out = body
    for k, v in vars.items():
        out = out.replace("{" + k + "}", "" if v is None else str(v))
    return out
