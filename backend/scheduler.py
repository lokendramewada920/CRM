"""APScheduler: poll pending Razorpay payment links, daily SQLite/Mongo backup."""
import os
import asyncio
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from db import payments, leads, courses, receipts as receipts_coll
from payments_provider import get_provider
from receipts import generate_receipt_pdf
from utils import now_iso, new_id, audit, get_settings

log = logging.getLogger("scheduler")
scheduler = AsyncIOScheduler(timezone="UTC")

BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", "/app/backend/backups"))
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


async def poll_pending_payments() -> int:
    """Iterate over pending payments, fetch status, mark paid if so."""
    settings = await get_settings()
    provider = get_provider(settings.get("razorpay_key_id"), settings.get("razorpay_key_secret"))
    updated = 0
    async for p in payments.find({"status": {"$in": ["created", "partially_paid"]}}):
        try:
            info = provider.fetch_link(p["razorpay_link_id"])
        except Exception as e:  # noqa: BLE001
            log.warning("fetch_link failed: %s", e)
            continue
        if info["status"] == p["status"]:
            continue
        await _apply_payment_update(p, info)
        updated += 1
    return updated


async def _apply_payment_update(payment: dict, info: dict) -> None:
    new_status = info["status"]
    upd = {
        "status": new_status,
        "amount_paid": info.get("amount_paid", 0) / 100.0,
        "updated_at": now_iso(),
    }
    await payments.update_one({"id": payment["id"]}, {"$set": upd})

    if new_status == "paid":
        lead = await leads.find_one({"id": payment["lead_id"]}, {"_id": 0})
        if not lead:
            return
        course = await courses.find_one({"id": lead.get("course_id")}, {"_id": 0}) or {}
        total_fee = float(course.get("total_fee", 0))
        discount = float(payment.get("discount_amount", 0))
        amount_paid = float(payment.get("amount", 0))
        balance = max(total_fee - discount - amount_paid, 0)

        # Generate receipt
        rec_num = "AOF-" + datetime.now(timezone.utc).strftime("%Y%m%d") + "-" + new_id()[:6].upper()
        rec_doc = {
            "id": new_id(),
            "receipt_number": rec_num,
            "lead_id": lead["id"],
            "payment_id": payment["id"],
            "institute_name": os.environ.get("INSTITUTE_NAME", "Arts of Finance"),
            "institute_addr": os.environ.get("INSTITUTE_ADDR", ""),
            "student_name": lead.get("name", ""),
            "student_phone": lead.get("phone", ""),
            "course_name": course.get("name", ""),
            "total_fee": total_fee,
            "discount": discount,
            "amount_paid": amount_paid,
            "balance_due": balance,
            "date_iso": now_iso(),
            "payment_ref": payment["razorpay_link_id"],
            "created_at": now_iso(),
        }
        try:
            pdf_path = generate_receipt_pdf(rec_doc)
            rec_doc["pdf_path"] = pdf_path
        except Exception as e:  # noqa: BLE001
            log.error("receipt pdf failed: %s", e)
        await receipts_coll.insert_one(dict(rec_doc))
        rec_doc.pop("_id", None)
        # Update lead status
        await leads.update_one({"id": lead["id"]}, {"$set": {"status": "Registered", "updated_at": now_iso()}})
        await audit("system", "system", "payment.paid", "payment", payment["id"], {"lead_id": lead["id"]})


async def daily_backup() -> str:
    """Dump the Mongo DB to a JSON snapshot; keep last 30."""
    from db import db as mongo_db
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    outdir = BACKUP_DIR / f"backup_{ts}"
    outdir.mkdir(parents=True, exist_ok=True)
    import json
    for coll_name in await mongo_db.list_collection_names():
        docs = await mongo_db[coll_name].find({}, {"_id": 0}).to_list(100000)
        (outdir / f"{coll_name}.json").write_text(json.dumps(docs, default=str, indent=2))
    # keep last 30
    all_backups = sorted([p for p in BACKUP_DIR.iterdir() if p.is_dir()])
    for old in all_backups[:-30]:
        shutil.rmtree(old, ignore_errors=True)
    return str(outdir)


def start_scheduler() -> None:
    if scheduler.running:
        return
    interval = int(os.environ.get("POLL_INTERVAL_SECONDS", "45"))
    scheduler.add_job(poll_pending_payments, "interval", seconds=interval, id="poll_payments", replace_existing=True)
    scheduler.add_job(daily_backup, "cron", hour=2, minute=0, id="daily_backup", replace_existing=True)
    scheduler.start()
    log.info("Scheduler started: poll every %ss + daily backup at 02:00 UTC", interval)
