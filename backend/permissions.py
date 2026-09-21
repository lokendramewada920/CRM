"""Permission catalog + default role matrix."""

ALL_PERMISSIONS = [
    # leads
    "lead.create", "lead.view_own", "lead.view_all", "lead.edit", "lead.delete", "lead.restore",
    # notes / followups
    "notes.add", "followup.manage", "followup.add_own", "followup.view_all",
    # assignment
    "lead.assign",
    # messaging
    "message.send", "template.manage",
    # payments
    "payment.create", "payment.view",
    # admin
    "course.manage", "user.manage", "role.manage", "settings.manage",
    "reports.view", "audit.view", "backup.manage",
]

DEFAULT_ROLE_PERMISSIONS = {
    "admin": ALL_PERMISSIONS,
    "counsellor": [
        "lead.view_own", "lead.edit",
        "notes.add", "followup.manage", "followup.add_own",
        "message.send", "payment.create", "payment.view",
    ],
    "reception": ["lead.create"],
}
