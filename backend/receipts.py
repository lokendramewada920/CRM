"""PDF receipt generation using reportlab."""
import os
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import mm

RECEIPT_DIR = Path(os.environ.get("RECEIPT_DIR", "/app/backend/receipts"))
RECEIPT_DIR.mkdir(parents=True, exist_ok=True)


def generate_receipt_pdf(receipt: dict) -> str:
    """receipt keys: receipt_number, institute_name, institute_addr, student_name,
    student_phone, course_name, amount_paid, discount, total_fee, balance_due,
    date_iso, payment_ref."""
    path = RECEIPT_DIR / f"{receipt['receipt_number']}.pdf"
    doc = SimpleDocTemplate(str(path), pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#0F172A"))
    label = ParagraphStyle("l", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#475569"))
    value = ParagraphStyle("v", parent=styles["Normal"], fontSize=11, textColor=colors.HexColor("#0F172A"))

    story = []
    story.append(Paragraph(receipt["institute_name"], title))
    story.append(Paragraph(receipt["institute_addr"], label))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(f"<b>Payment Receipt</b> &nbsp; #{receipt['receipt_number']}", styles["Heading2"]))
    story.append(Paragraph(f"Date: {receipt['date_iso']}", label))
    story.append(Spacer(1, 6 * mm))

    data = [
        ["Student", receipt["student_name"]],
        ["Phone", receipt["student_phone"]],
        ["Course", receipt["course_name"]],
        ["Total Course Fee", f"Rs. {receipt['total_fee']:.2f}"],
        ["Discount Applied", f"Rs. {receipt['discount']:.2f}"],
        ["Amount Paid (Now)", f"Rs. {receipt['amount_paid']:.2f}"],
        ["Balance Due", f"Rs. {receipt['balance_due']:.2f}"],
        ["Payment Ref", receipt["payment_ref"]],
    ]
    tbl = Table(data, colWidths=[55 * mm, 110 * mm])
    tbl.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#0F172A")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "This is a system-generated receipt. Thank you for choosing us.",
        label,
    ))
    doc.build(story)
    return str(path)
