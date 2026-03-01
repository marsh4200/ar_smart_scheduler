from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.const import Platform

from .const import DOMAIN, PLATFORMS
from .scheduler import ARScheduler
from .websocket import async_register_ws


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
