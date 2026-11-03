"""Versioned, inspectable exam rating rules; no dependency on user databases."""
from __future__ import annotations

import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

_RULES = json.loads((Path(__file__).resolve().parent / 'reference/rating_rules.json').read_text(encoding='utf-8'))
DIMENSIONS = tuple(d['key'] for d in _RULES['dimensions'])
EXAM_QUESTION_COUNT = _RULES['question_count']
THEORY_PASS_PERCENT = _RULES['theory_pass_percent']
PRACTICAL_MIN = _RULES['practical_scale']['min']
PRACTICAL_MAX = _RULES['practical_scale']['max']

def category_profile(category):
    """Return explicitly configured staff weights; legacy staff remain unset."""
    if category is None or category == '':
        return None
    if not isinstance(category, str):
        raise ValueError('assessment category must be leader or operator')
    for profile in _RULES['categories']:
        if profile['key'] == category:
            return dict(profile)
    raise ValueError('assessment category must be leader or operator')

def combined_percent(theory_percent, practical_score, assessment_category):
    profile = category_profile(assessment_category)
    if profile is None:
        return None
    if theory_percent is None or practical_score is None:
        return None
    if isinstance(theory_percent, bool) or not isinstance(theory_percent, (int, float)) or not 0 <= theory_percent <= 100:
        raise ValueError('theory percentage must be between zero and one hundred')
    if type(practical_score) is not int or not PRACTICAL_MIN <= practical_score <= PRACTICAL_MAX:
        raise ValueError('practical score must be an integer between one and five')
    result = (Decimal(str(theory_percent)) * Decimal(str(profile['theory_weight']))
              + Decimal(practical_score * _RULES['practical_scale']['percent_multiplier']) * Decimal(str(profile['practical_weight'])))
    return float(result.quantize(Decimal(1).scaleb(-_RULES['final_percent_decimals']), rounding=ROUND_HALF_UP))

def rating_rules():
    """Return a separate copy so response consumers cannot mutate the rules."""
    return json.loads(json.dumps(_RULES, ensure_ascii=False))

def level_for_percent(percent):
    if percent is None:
        return None
    if not 0 <= percent <= 100:
        raise ValueError('exam percent must be between zero and one hundred')
    for band in _RULES['levels']:
        if percent >= band['min_percent'] and (percent < band['max_percent'] or band['level'] == 4):
            return band['level']
    raise ValueError('uncovered exam percent')
