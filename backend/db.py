"""MongoDB connection & shared helpers."""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]

# Collections
users = db.users
roles = db.roles
leads = db.leads
courses = db.courses
notes = db.notes
followups = db.followups
lead_updates = db.lead_updates
message_logs = db.message_logs
templates = db.templates
payments = db.payments
receipts = db.receipts
audit_logs = db.audit_logs
settings_coll = db.settings


async def ensure_indexes() -> None:
    await users.create_index("email", unique=True)
    await leads.create_index("phone")
    await leads.create_index("assigned_counsellor_id")
    await leads.create_index("status")
    await leads.create_index("deleted_at")
    await leads.create_index("next_followup_date")
    await lead_updates.create_index("lead_id")
    await payments.create_index("razorpay_link_id", unique=True, sparse=True)
    await payments.create_index("status")
    await audit_logs.create_index([("created_at", -1)])
