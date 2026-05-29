from __future__ import annotations

import voluptuous as vol
from homeassistant.core import HomeAssistant, callback
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry

from .const import (
    CONF_END,
    CONF_ENABLED,
    CONF_END_DATA,
    CONF_END_OFFSET,
    CONF_END_SERVICE,
    CONF_END_TRIGGER,
    CONF_SECOND_ENABLED,
    CONF_SECOND_END,
    CONF_SECOND_END_OFFSET,
    CONF_SECOND_END_TRIGGER,
    CONF_SECOND_START,
    CONF_SECOND_START_OFFSET,
    CONF_SECOND_START_TRIGGER,
    CONF_START,
    CONF_START_DATA,
    CONF_START_OFFSET,
    CONF_START_SERVICE,
    CONF_START_TRIGGER,
    CONF_WEEKDAYS,
    DEFAULT_START,
    DEFAULT_END,
    DEFAULT_SECOND_END,
    DEFAULT_SECOND_START,
    DEFAULT_WEEKDAYS,
    DOMAIN,
    DEFAULT_END_SERVICE,
    DEFAULT_END_DATA,
    DEFAULT_START_SERVICE,
    DEFAULT_START_DATA,
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
            vol.Optional(CONF_START_TRIGGER): str,
            vol.Optional(CONF_END_TRIGGER): str,
            vol.Optional(CONF_START_OFFSET): int,
            vol.Optional(CONF_END_OFFSET): int,
            vol.Optional(CONF_WEEKDAYS): [vol.In(WEEKDAY_KEYS)],
            vol.Optional(CONF_ENABLED): bool,
            vol.Optional(CONF_SECOND_ENABLED): bool,
            vol.Optional(CONF_SECOND_START): str,
            vol.Optional(CONF_SECOND_END): str,
            vol.Optional(CONF_SECOND_START_TRIGGER): str,
            vol.Optional(CONF_SECOND_END_TRIGGER): str,
            vol.Optional(CONF_SECOND_START_OFFSET): int,
            vol.Optional(CONF_SECOND_END_OFFSET): int,
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
        if CONF_START_TRIGGER in msg:
            opts[CONF_START_TRIGGER] = msg[CONF_START_TRIGGER]
        if CONF_END_TRIGGER in msg:
            opts[CONF_END_TRIGGER] = msg[CONF_END_TRIGGER]
        if CONF_START_OFFSET in msg:
            opts[CONF_START_OFFSET] = int(msg[CONF_START_OFFSET])
        if CONF_END_OFFSET in msg:
            opts[CONF_END_OFFSET] = int(msg[CONF_END_OFFSET])
        if CONF_WEEKDAYS in msg:
            opts[CONF_WEEKDAYS] = msg[CONF_WEEKDAYS] or DEFAULT_WEEKDAYS
        if CONF_ENABLED in msg:
            opts[CONF_ENABLED] = bool(msg[CONF_ENABLED])
        if CONF_SECOND_ENABLED in msg:
            opts[CONF_SECOND_ENABLED] = bool(msg[CONF_SECOND_ENABLED])
        if CONF_SECOND_START in msg:
            opts[CONF_SECOND_START] = msg[CONF_SECOND_START] or DEFAULT_SECOND_START
        if CONF_SECOND_END in msg:
            opts[CONF_SECOND_END] = msg[CONF_SECOND_END] or DEFAULT_SECOND_END
        if CONF_SECOND_START_TRIGGER in msg:
            opts[CONF_SECOND_START_TRIGGER] = msg[CONF_SECOND_START_TRIGGER]
        if CONF_SECOND_END_TRIGGER in msg:
            opts[CONF_SECOND_END_TRIGGER] = msg[CONF_SECOND_END_TRIGGER]
        if CONF_SECOND_START_OFFSET in msg:
            opts[CONF_SECOND_START_OFFSET] = int(msg[CONF_SECOND_START_OFFSET])
        if CONF_SECOND_END_OFFSET in msg:
            opts[CONF_SECOND_END_OFFSET] = int(msg[CONF_SECOND_END_OFFSET])

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
