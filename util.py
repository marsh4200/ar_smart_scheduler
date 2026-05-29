"""Pure helper functions for AR Smart Scheduler.

This module intentionally has **no** Home Assistant imports so the core parsing
and normalisation logic can be unit-tested in isolation.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from .const import TRIGGER_TYPES, WEEKDAY_KEYS, WEEKDAY_MAP


def parse_time_string(value: str | None, fallback: str) -> dt.time:
    """Parse an ``HH:MM[:SS]`` string into a ``datetime.time``.

    Falls back to ``fallback`` (which must be a valid ``HH:MM:SS`` string)
    if ``value`` cannot be parsed.
    """
    try:
        parts = str(value or fallback).split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        second = int(parts[2]) if len(parts) > 2 else 0
        return dt.time(hour=hour, minute=minute, second=second)
    except (ValueError, IndexError, TypeError):
        parts = fallback.split(":")
        return dt.time(int(parts[0]), int(parts[1]), int(parts[2]))


def parse_trigger(value: str | None, fallback: str) -> str:
    """Return ``value`` if it is a known trigger type, otherwise ``fallback``."""
    trigger = str(value or fallback)
    return trigger if trigger in TRIGGER_TYPES else fallback


def parse_offset(value: Any, fallback: int = 0) -> int:
    """Coerce ``value`` to an int offset, falling back on failure."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return fallback


def normalize_targets(targets: Any) -> list[str]:
    """Normalise a target-entity value into a clean list of entity id strings."""
    if not targets:
        return []
    if isinstance(targets, str):
        return [targets]
    return [target for target in targets if isinstance(target, str)]


def weekday_keys_to_indices(keys: Any) -> set[int]:
    """Convert weekday keys (``mon``..``sun``) into a set of Python weekday indices."""
    if not keys:
        return set()
    return {WEEKDAY_MAP[key] for key in keys if key in WEEKDAY_MAP}


def weekday_indices_to_keys(indices: set[int]) -> list[str]:
    """Convert a set of Python weekday indices back into ordered weekday keys."""
    return [WEEKDAY_KEYS[index] for index in sorted(indices)]
