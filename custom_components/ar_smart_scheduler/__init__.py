from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.const import Platform

from .const import (
    DOMAIN,
    FRONTEND_CARD_FILENAME,
    FRONTEND_URL_BASE,
    PLATFORMS,
)
from .scheduler import ARScheduler
from .websocket import async_register_ws

_LOGGER = logging.getLogger(__name__)

_FRONTEND_FLAG = f"{DOMAIN}_frontend_registered"


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled Lovelace card so no separate HACS frontend install is needed."""
    if hass.data.get(_FRONTEND_FLAG):
        return
    hass.data[_FRONTEND_FLAG] = True

    frontend_dir = Path(__file__).parent / "frontend"

    try:
        # HA 2024.7+
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(FRONTEND_URL_BASE, str(frontend_dir), cache_headers=False)]
        )
    except ImportError:
        hass.http.register_static_path(FRONTEND_URL_BASE, str(frontend_dir), cache_headers=False)

    add_extra_js_url(hass, f"{FRONTEND_URL_BASE}/{FRONTEND_CARD_FILENAME}")


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    async_register_ws(hass)
    await _async_register_frontend(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    scheduler = ARScheduler(hass, entry)

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = scheduler
    entry.async_on_unload(entry.add_update_listener(_async_update_entry))

    await scheduler.async_start()

    await hass.config_entries.async_forward_entry_setups(
        entry, [Platform(p) for p in PLATFORMS]
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(
        entry, [Platform(p) for p in PLATFORMS]
    )

    if unload_ok:
        scheduler: ARScheduler | None = hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
        if scheduler is not None:
            await scheduler.async_stop()

    return unload_ok


async def _async_update_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload scheduler state when config entry data or options change."""
    scheduler: ARScheduler | None = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if scheduler is not None:
        await scheduler.async_reload_from_entry()


# -----------------------------
# MIGRATION HANDLER
# -----------------------------
async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate old entries to new format.

    NOTE: config_flow.py MUST declare VERSION equal to the highest version
    produced here (currently 3). If the flow VERSION is lower than an entry's
    version, Home Assistant refuses to load the entry with a migration error.
    """

    _LOGGER.info(
        "Migrating AR Smart Scheduler entry %s from version %s", entry.entry_id, entry.version
    )

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

    if entry.version == 2:
        options = dict(entry.options)
        options.setdefault("device_type", "auto")

        hass.config_entries.async_update_entry(
            entry,
            options=options,
            version=3,
        )

        _LOGGER.info("AR Smart Scheduler entry migrated to version 3")

    return True
