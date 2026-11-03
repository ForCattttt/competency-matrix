"""Compatibility entry point for the generated, template-free workbook export.

Workbooks are created from the supplied matrix data by ``workshop_xlsx``.
No external workbook, embedded company artwork, or source template is required.
"""
from __future__ import annotations

from workshop_xlsx import build_workshop_xlsx


def build_selected_template_xlsx(workshop, entries, stamp):
    """Return a generated workbook while preserving the existing call signature."""
    return build_workshop_xlsx(workshop, entries, stamp)
