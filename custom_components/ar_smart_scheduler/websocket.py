from __future__ import annotations

import voluptuous as vol
from homeassistant.core import HomeAssistant, callback
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import DOMAIN, CONF_START_TIME, CONF_END_TIME, CONF_WEEKDAYS, CONF_ENABLED, DEFAULT_WEEKDAYS, DEFAULT_START_TIME, DEFAULT_END_TIME, WEEKDAY_KEYS, SIGNAL_ENTRY_UPDATED

@callback
def async_register_ws(hass: HomeAssistant) -> None:
    @websocket_api.websocket_command(
        {
            vol.Required("type"): f"{DOMAIN}/set_options",
            vol.Required("entry_id"): str,
            vol.Optional(CONF_START_TIME): str,
            vol.Optional(CONF_END_TIME): str,
            vol.Optional(CONF_WEEKDAYS): [vol.In(WEEKDAY_KEYS)],
            vol.Optional(CONF_ENABLED): bool,
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
        if CONF_START_TIME in msg:
            opts[CONF_START_TIME] = msg[CONF_START_TIME] or DEFAULT_START_TIME
        if CONF_END_TIME in msg:
            opts[CONF_END_TIME] = msg[CONF_END_TIME] or DEFAULT_END_TIME
        if CONF_WEEKDAYS in msg:
            opts[CONF_WEEKDAYS] = msg[CONF_WEEKDAYS] or DEFAULT_WEEKDAYS
        if CONF_ENABLED in msg:
            opts[CONF_ENABLED] = bool(msg[CONF_ENABLED])

        hass.config_entries.async_update_entry(entry, options=opts)

        scheduler = hass.data.get(DOMAIN, {}).get(entry.entry_id)
        if scheduler is not None:
            await scheduler.async_reload_from_entry()
        async_dispatcher_send(hass, SIGNAL_ENTRY_UPDATED, entry.entry_id)

        connection.send_result(msg["id"], {"ok": True, "options": opts})

    websocket_api.async_register_command(hass, ws_set_options)
