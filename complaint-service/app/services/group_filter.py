"""
Group filter — controls which WhatsApp groups are allowed to submit complaints.

Allowed groups are configured via the ALLOWED_GROUPS environment variable as a
comma-separated list of group IDs or group names.

Examples:
    ALLOWED_GROUPS=120363000000000001,120363000000000002
    ALLOWED_GROUPS=*                 ← allow every group (default)
    ALLOWED_GROUPS=                  ← empty → allow every group
"""
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_RAW = os.getenv("ALLOWED_GROUPS", "*").strip()

# Parse once at import time
if _RAW in ("*", ""):
    _ALLOWED: set[str] = set()          # empty set = wildcard (all allowed)
    _WILDCARD = True
else:
    _ALLOWED = {g.strip() for g in _RAW.split(",") if g.strip()}
    _WILDCARD = False

logger.info(
    "Group filter: %s",
    "all groups allowed" if _WILDCARD else f"{len(_ALLOWED)} group(s) allowed",
)


def is_group_allowed(group_id: Optional[str], group_name: Optional[str] = None) -> bool:
    """
    Returns True when the message should be processed, False when it should be ignored.

    Matching is done against:
      1. group_id  (exact match)
      2. group_name (exact match, case-insensitive)
    """
    if _WILDCARD:
        return True

    if group_id and group_id.strip() in _ALLOWED:
        return True

    if group_name and group_name.strip().lower() in {g.lower() for g in _ALLOWED}:
        return True

    logger.info(
        "Group filter: rejecting group_id=%r group_name=%r (not in allowed list)",
        group_id,
        group_name,
    )
    return False


def allowed_groups_list() -> list[str]:
    """Return the configured allowed groups (empty list means wildcard/all)."""
    return sorted(_ALLOWED)
