"""Razorpay payment provider behind a simple interface.

Provider methods:
    create_link(amount, description, notes, reference_id) -> dict
    fetch_link(link_id) -> dict

If credentials are missing, a MockProvider is used so the app still works in
demo mode. Swap by setting RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env.
"""
import os
import time
import uuid
from typing import Protocol, Optional
import razorpay


class PaymentProvider(Protocol):
    name: str

    def create_link(self, amount_paise: int, description: str, notes: dict, reference_id: str, customer: dict) -> dict: ...
    def fetch_link(self, link_id: str) -> dict: ...


class RazorpayProvider:
    name = "razorpay"

    def __init__(self, key_id: str, key_secret: str) -> None:
        self.client = razorpay.Client(auth=(key_id, key_secret))

    def create_link(self, amount_paise: int, description: str, notes: dict, reference_id: str, customer: dict) -> dict:
        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "accept_partial": False,
            "description": description[:255],
            "reference_id": reference_id[:40],
            "customer": customer,
            "notify": {"sms": False, "email": False},
            "reminder_enable": False,
            "notes": notes,
        }
        r = self.client.payment_link.create(payload)
        return {
            "link_id": r["id"],
            "short_url": r["short_url"],
            "status": r["status"],
            "amount": r["amount"],
            "raw": r,
        }

    def fetch_link(self, link_id: str) -> dict:
        r = self.client.payment_link.fetch(link_id)
        return {
            "link_id": r["id"],
            "short_url": r.get("short_url"),
            "status": r["status"],  # created, partially_paid, paid, cancelled, expired
            "amount": r["amount"],
            "amount_paid": r.get("amount_paid", 0),
            "raw": r,
        }


class MockProvider:
    """Used when no Razorpay keys are set. Generates fake links; a link is
    auto-'paid' 25 seconds after creation so the polling flow can be demoed."""

    name = "mock"
    _store: dict = {}

    def create_link(self, amount_paise: int, description: str, notes: dict, reference_id: str, customer: dict) -> dict:
        lid = "plink_mock_" + uuid.uuid4().hex[:12]
        self._store[lid] = {"created_at": time.time(), "amount": amount_paise}
        return {
            "link_id": lid,
            "short_url": f"https://rzp.io/mock/{lid}",
            "status": "created",
            "amount": amount_paise,
            "raw": {"mock": True},
        }

    def fetch_link(self, link_id: str) -> dict:
        rec = self._store.get(link_id)
        if not rec:
            return {"link_id": link_id, "status": "expired", "amount": 0, "amount_paid": 0, "raw": {"mock": True}}
        paid = (time.time() - rec["created_at"]) > 25
        status = "paid" if paid else "created"
        return {
            "link_id": link_id,
            "short_url": f"https://rzp.io/mock/{link_id}",
            "status": status,
            "amount": rec["amount"],
            "amount_paid": rec["amount"] if paid else 0,
            "raw": {"mock": True, "auto_paid_after": 25},
        }


def get_provider() -> PaymentProvider:
    kid = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    ks = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    if kid and ks and not kid.startswith("rzp_test_XXXX"):
        return RazorpayProvider(kid, ks)
    return MockProvider()
