"""Use user-maintained Indonesian names without guessing domain terminology."""
from __future__ import annotations


def work_item_name_id(item):
    """Return an explicitly supplied Indonesian name, or an empty string."""
    return str(item.get('name_id') or '').strip()


def work_item_bilingual_name(item):
    """Display explicit names on separate lines; otherwise keep the source name."""
    name = str(item.get('name') or '').strip()
    translated = work_item_name_id(item)
    if name and translated and translated != name:
        return name + '\n' + translated
    return name or translated
