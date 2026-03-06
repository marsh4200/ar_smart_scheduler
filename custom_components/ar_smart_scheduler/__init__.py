from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.const import Platform

from .const import DOMAIN, PLATFORMS
from .scheduler import ARScheduler
from .websocket import async_register_ws

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    async_register_ws(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    scheduler = ARScheduler(hass, entry)

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = scheduler

    await scheduler.async_start()

    await hass.config_entries.async_forward_entry_setups(
        entry, [Platform(p) for p in PLATFORMS]
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    scheduler: ARScheduler = hass.data[DOMAIN].pop(entry.entry_id)

    await scheduler.async_stop()

    return await hass.config_entries.async_unload_platforms(
        entry, [Platform(p) for p in PLATFORMS]
    )


# -----------------------------
# MIGRATION HANDLER
# -----------------------------
async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate old entries to new format."""

    _LOGGER.info("Migrating AR Smart Scheduler entry %s", entry.entry_id)

    if entry.version == 1:

        options = dict(entry.options)

        # Add new solar trigger fields safely
        options.setdefault("start_trigger", "time")
        options.setdefault("end_trigger", "time")

        options.setdefault("start_offset", 0)
        options.setdefault("end_offset", 0)

        options.setdefault("second_enabled", False)

        options.setdefault("second_start_trigger", "time")
        options.setdefault("second_end_trigger", "time")

        options.setdefault("second_start_offset", 0)
        options.setdefault("second_end_offset", 0)

        hass.config_entries.async_update_entry(
            entry,
            options=options,
            version=2,
        )

        _LOGGER.info("AR Smart Scheduler entry migrated to version 2")

    return True
