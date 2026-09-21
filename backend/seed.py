"""Idempotent seed: 1 admin, 2 counsellors, 1 reception + 3 courses + default template + settings + roles."""
import asyncio
from db import users, courses, templates, roles, settings_coll, leads, lead_updates, ensure_indexes
from auth import hash_password
from utils import new_id, now_iso, now_utc, compute_offer_expiry, ist_date_str
from permissions import DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS


DEFAULT_TEMPLATE = (
    "Hello {student_name}, thank you for visiting Arts of Finance today! "
    "Register TODAY with just Rs.{registration_amount} and get {discount_percent}% OFF "
    "on {course_name} (Fee Rs.{course_fee} -> Rs.{discounted_fee}). "
    "Offer valid till {offer_valid_till}. Pay here: {payment_link}"
)


async def seed() -> None:
    await ensure_indexes()

    # Roles
    for rname, perms in DEFAULT_ROLE_PERMISSIONS.items():
        await roles.update_one(
            {"name": rname},
            {"$setOnInsert": {"id": new_id(), "name": rname, "permissions": perms, "created_at": now_iso()}},
            upsert=True,
        )
    # Ensure existing role docs pick up newly added permissions (safe migration)
    await roles.update_one({"name": "admin"}, {"$set": {"permissions": ALL_PERMISSIONS}})
    await roles.update_one({"name": "counsellor"}, {"$addToSet": {"permissions": {"$each": ["followup.add_own", "lead.create"]}}})

    # Settings singleton
    await settings_coll.update_one(
        {"id": "singleton"},
        {"$setOnInsert": {
            "id": "singleton",
            "registration_amount": 1000.0,
            "discount_percent": 10.0,
            "offer_hours": None,
            "reception_can_send_whatsapp": False,
            "counsellors_view_all": False,
            "updated_at": now_iso(),
        }},
        upsert=True,
    )

    # Users
    demo_users = [
        {"name": "Admin", "email": "admin@artsoffinance.in", "password": "Admin@12345", "role": "admin", "phone": "9999900001"},
        {"name": "Priya (Counsellor)", "email": "priya@artsoffinance.in", "password": "Counsellor@123", "role": "counsellor", "phone": "9999900002"},
        {"name": "Rahul (Counsellor)", "email": "rahul@artsoffinance.in", "password": "Counsellor@123", "role": "counsellor", "phone": "9999900003"},
        {"name": "Reception", "email": "reception@artsoffinance.in", "password": "Reception@123", "role": "reception", "phone": "9999900004"},
    ]
    for u in demo_users:
        existing = await users.find_one({"email": u["email"]})
        if existing:
            continue
        doc = {
            "id": new_id(),
            "name": u["name"],
            "email": u["email"],
            "password_hash": hash_password(u["password"]),
            "role": u["role"],
            "phone": u["phone"],
            "active": True,
            "permission_overrides": [],
            "permission_revokes": [],
            "created_at": now_iso(),
        }
        await users.insert_one(doc)

    # Courses
    demo_courses = [
        {"name": "Chartered Financial Analyst (CFA) Level 1", "total_fee": 45000, "duration": "6 months"},
        {"name": "Financial Modeling & Valuation", "total_fee": 25000, "duration": "3 months"},
        {"name": "Investment Banking Certification", "total_fee": 35000, "duration": "4 months"},
    ]
    for c in demo_courses:
        await courses.update_one(
            {"name": c["name"]},
            {"$setOnInsert": {"id": new_id(), **c, "active": True, "created_at": now_iso()}},
            upsert=True,
        )

    # Default template
    exists = await templates.find_one({"is_default": True})
    if not exists:
        await templates.insert_one({
            "id": new_id(),
            "name": "Default visit follow-up",
            "body": DEFAULT_TEMPLATE,
            "is_default": True,
            "created_at": now_iso(),
        })

    print("Seed complete.")
    await _seed_demo_followups()


async def _seed_demo_followups() -> None:
    """Idempotent demo leads with follow-up updates so Today/Overdue/Upcoming sections can be tested."""
    if await leads.find_one({"demo": True}):
        return
    priya = await users.find_one({"email": "priya@artsoffinance.in"})
    course = await courses.find_one({})
    if not priya or not course:
        return
    samples = [
        ("Aarav Sharma", "9810000001", "today", "Contacted", "Interested in weekend batch, asked for full fee details"),
        ("Isha Verma", "9810000002", "overdue", "Interested", "Wanted to discuss with parents, promised a callback"),
        ("Rohan Mehta", "9810000003", "overdue", "Contacted", "Asked about EMI / instalment options"),
        ("Sneha Nair", "9810000004", "tomorrow", "Interested", "Will visit again with documents"),
        ("Kabir Singh", "9810000005", "upcoming", "New", "First enquiry, brochure shared on WhatsApp"),
        ("Ananya Rao", "9810000006", "none", "New", "Walk-in enquiry, no callback scheduled yet"),
    ]
    day_map = {"today": ist_date_str(0), "overdue": ist_date_str(-2), "tomorrow": ist_date_str(1), "upcoming": ist_date_str(4), "none": None}
    for name, phone, when, status, discussed in samples:
        visit_dt = now_utc()
        lid = new_id()
        nfd = day_map[when]
        await leads.insert_one({
            "id": lid, "name": name, "phone": phone, "email": None, "city": "Mumbai",
            "qualification": "B.Com", "course_id": course["id"], "source": "Walk-in",
            "batch_preference": "Weekend", "assigned_counsellor_id": priya["id"],
            "status": status, "visit_date": visit_dt.isoformat(),
            "offer_expires_at": compute_offer_expiry(visit_dt, None).isoformat(),
            "consent": True, "remarks": "", "created_by": priya["id"],
            "created_at": now_iso(), "updated_at": now_iso(), "deleted_at": None,
            "next_followup_date": nfd, "next_followup_time": None, "demo": True,
        })
        await lead_updates.insert_one({
            "id": new_id(), "lead_id": lid, "type": "followup",
            "author_id": priya["id"], "author_name": priya["name"],
            "discussed": discussed, "status": status,
            "next_followup_date": nfd, "next_followup_time": None, "lost_reason": None,
            "created_at": now_iso(),
        })
    print("Demo follow-up data seeded.")


if __name__ == "__main__":
    asyncio.run(seed())
