from __future__ import annotations

import voluptuous as vol
from homeassistant.core import HomeAssistant, callback
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry

from .const import (
    DOMAIN,
    CONF_START,
    CONF_END,
    CONF_WEEKDAYS,
    CONF_ENABLED,
    CONF_START_SERVICE,
    CONF_END_SERVICE,
    CONF_START_DATA,
    CONF_END_DATA,
    DEFAULT_WEEKDAYS,
    DEFAULT_START,
    DEFAULT_END,
    DEFAULT_START_SERVICE,
    DEFAULT_END_SERVICE,
    DEFAULT_START_DATA,
    DEFAULT_END_DATA,
    WEEKDAY_KEYS,
)

@callback
def async_register_ws(hass: HomeAssistant) -> None:
    @websocket_api.websocket_command(
        {
            vol.Required("type"): f"{DOMAIN}/set_options",
            vol.Required("entry_id"): str,
            vol.Optional(CONF_START): str,
            vol.Optional(CONF_END): str,
            vol.Optional(CONF_WEEKDAYS): [vol.In(WEEKDAY_KEYS)],
            vol.Optional(CONF_ENABLED): bool,
            # advanced internal (not required for your customer UI)
            vol.Optional(CONF_START_SERVICE): str,
            vol.Optional(CONF_END_SERVICE): str,
            vol.Optional(CONF_START_DATA): dict,
            vol.Optional(CONF_END_DATA): dict,
        }
    )
    @websocket_api.async_response
    async def ws_set_options(hass: HomeAssistant, connection, msg) -> None:
        entry_id = msg["entry_id"]
        entry: ConfigEntry | None = hass.config_entries.async_get_entry(entry_id)
        if entry is None or entry.domain != DOMAIN:
            connection.send_error(msg["id"], "not_found", "Scheduler entry not found")
            return

        opts = dict(entry.options or {})
        if CONF_START in msg:
            opts[CONF_START] = msg[CONF_START] or DEFAULT_START
        if CONF_END in msg:
            opts[CONF_END] = msg[CONF_END] or DEFAULT_END
        if CONF_WEEKDAYS in msg:
            opts[CONF_WEEKDAYS] = msg[CONF_WEEKDAYS] or DEFAULT_WEEKDAYS
        if CONF_ENABLED in msg:
            opts[CONF_ENABLED] = bool(msg[CONF_ENABLED])

        if CONF_START_SERVICE in msg:
            opts[CONF_START_SERVICE] = msg[CONF_START_SERVICE] or DEFAULT_START_SERVICE
        if CONF_END_SERVICE in msg:
            opts[CONF_END_SERVICE] = msg[CONF_END_SERVICE] or DEFAULT_END_SERVICE
        if CONF_START_DATA in msg:
            opts[CONF_START_DATA] = msg[CONF_START_DATA] or dict(DEFAULT_START_DATA)
        if CONF_END_DATA in msg:
            opts[CONF_END_DATA] = msg[CONF_END_DATA] or dict(DEFAULT_END_DATA)

        hass.config_entries.async_update_entry(entry, options=opts)

        scheduler = hass.data.get(DOMAIN, {}).get(entry.entry_id)
        if scheduler is not None:
            await scheduler.async_reload_from_entry()

        connection.send_result(msg["id"], {"ok": True, "options": opts})

    websocket_api.async_register_command(hass, ws_set_options)
