"""Shared device metadata for AR Smart Scheduler entities."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.device_registry import DeviceInfo

from .const import CONF_NAME, DOMAIN


def scheduler_device_info(entry: ConfigEntry) -> DeviceInfo:
    """Return shared device info so every entity of a schedule groups together."""
    name = entry.data.get(CONF_NAME) or entry.title or "Schedule"
    return DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=f"AR Smart Scheduler: {name}",
        manufacturer="A R Smart Home Automation",
        model="Smart Scheduler",
    )
