from __future__ import annotations

import voluptuous as vol
from homeassistant.core import HomeAssistant, callback
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.data_entry_flow import FlowResultType

from .config_flow import (
    _detect_type,
    _has_unsupported_entities,
    _is_duplicate_entry,
    _normalize_entity_ids,
    _resolve_action_options,
)
from .const import (
    CONF_DEVICE_TYPE,
    CONF_END,
    CONF_ENABLED,
    CONF_END_DATA,
    CONF_END_OFFSET,
    CONF_END_SERVICE,
    CONF_END_TRIGGER,
    CONF_NAME,
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
    CONF_TARGET_ENTITY,
    CONF_WEEKDAYS,
    DEFAULT_START,
    DEFAULT_END,
    DEFAULT_SECOND_END,
    DEFAULT_SECOND_START,
    DEFAULT_WEEKDAYS,
    DEVICE_TYPES,
    DOMAIN,
    DEFAULT_END_SERVICE,
    DEFAULT_END_DATA,
    DEFAULT_START_SERVICE,
    DEFAULT_START_DATA,
    SUPPORTED_ENTITY_DOMAINS,
    TRIGGER_TYPES,
    WEEKDAY_KEYS,
)

# Error reasons shared with translations/en.json (config.error / config.abort)
# so the card can show the same wording the Settings wizard would.
_ERROR_MESSAGES = {
    "required": "Select at least one entity to control.",
    "unsupported_domain": "Only controllable entities are allowed: covers, switches, lights, climate devices, media players, fans, water heaters, locks, and input booleans.",
    "already_configured": "A scheduler with the same name and entities already exists.",
    "not_found": "Scheduler entry not found",
}


def _get_entry(hass: HomeAssistant, entry_id: str) -> ConfigEntry | None:
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None or entry.domain != DOMAIN:
        return None
    return entry


async def _reload_scheduler(hass: HomeAssistant, entry: ConfigEntry) -> None:
    scheduler = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if scheduler is not None:
        await scheduler.async_reload_from_entry()


@callback
def async_register_ws(hass: HomeAssistant) -> None:
    @websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list"})
    @callback
    def ws_list(hass: HomeAssistant, connection, msg) -> None:
        """Return live snapshots of every scheduler (used by the Lovelace card)."""
        schedulers = hass.data.get(DOMAIN, {})
        items = []
        for value in schedulers.values():
            build = getattr(value, "build_state_snapshot", None)
            if callable(build):
                items.append(build())
        connection.send_result(
            msg["id"],
            {
                "schedulers": items,
                # Lets the card build its "add schedule" entity picker and
                # device-type dropdown from the same source of truth the
                # backend validates against, instead of a hardcoded copy.
                "domains": SUPPORTED_ENTITY_DOMAINS,
                "device_types": DEVICE_TYPES,
            },
        )

    @websocket_api.require_admin
    @websocket_api.websocket_command(
        {
            vol.Required("type"): f"{DOMAIN}/set_options",
            vol.Required("entry_id"): str,
            vol.Optional(CONF_START): str,
            vol.Optional(CONF_END): str,
            vol.Optional(CONF_START_TRIGGER): vol.In(TRIGGER_TYPES),
            vol.Optional(CONF_END_TRIGGER): vol.In(TRIGGER_TYPES),
            vol.Optional(CONF_START_OFFSET): int,
            vol.Optional(CONF_END_OFFSET): int,
            vol.Optional(CONF_WEEKDAYS): [vol.In(WEEKDAY_KEYS)],
            vol.Optional(CONF_ENABLED): bool,
            vol.Optional(CONF_SECOND_ENABLED): bool,
            vol.Optional(CONF_SECOND_START): str,
            vol.Optional(CONF_SECOND_END): str,
            vol.Optional(CONF_SECOND_START_TRIGGER): vol.In(TRIGGER_TYPES),
            vol.Optional(CONF_SECOND_END_TRIGGER): vol.In(TRIGGER_TYPES),
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
        entry = _get_entry(hass, msg["entry_id"])
        if entry is None:
            connection.send_error(msg["id"], "not_found", _ERROR_MESSAGES["not_found"])
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
        await _reload_scheduler(hass, entry)

        connection.send_result(msg["id"], {"ok": True, "options": opts})

    @websocket_api.require_admin
    @websocket_api.websocket_command(
        vol.Schema(
            {
                vol.Required("type"): f"{DOMAIN}/create",
                vol.Required(CONF_NAME): str,
                vol.Required(CONF_TARGET_ENTITY): [str],
                vol.Optional(CONF_DEVICE_TYPE): vol.In(DEVICE_TYPES),
                vol.Optional(CONF_WEEKDAYS): [vol.In(WEEKDAY_KEYS)],
                vol.Optional(CONF_START_TRIGGER): vol.In(TRIGGER_TYPES),
                vol.Optional(CONF_END_TRIGGER): vol.In(TRIGGER_TYPES),
                vol.Optional(CONF_START): str,
                vol.Optional(CONF_END): str,
                vol.Optional(CONF_START_OFFSET): int,
                vol.Optional(CONF_END_OFFSET): int,
            },
            extra=vol.ALLOW_EXTRA,
        )
    )
    @websocket_api.async_response
    async def ws_create(hass: HomeAssistant, connection, msg) -> None:
        """Create a new scheduler straight from the card's "Add schedule" panel.

        This is what lets a client add a whole new automation (e.g. "turn the
        gate lights on at sunset") without ever visiting Settings -> Devices
        & Services -> Add Integration. Validation and defaulting are the
        exact same code the config flow wizard uses (see config_flow.py's
        async_step_card), so a card-created scheduler behaves identically to
        a wizard-created one.
        """
        payload = {k: v for k, v in msg.items() if k not in ("type", "id")}

        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": "card"}, data=payload
        )

        if result.get("type") == FlowResultType.ABORT:
            reason = result.get("reason", "unknown")
            connection.send_error(msg["id"], reason, _ERROR_MESSAGES.get(reason, reason))
            return

        entry: ConfigEntry = result["result"]
        connection.send_result(msg["id"], {"ok": True, "entry_id": entry.entry_id})

    @websocket_api.require_admin
    @websocket_api.websocket_command(
        {
            vol.Required("type"): f"{DOMAIN}/delete",
            vol.Required("entry_id"): str,
        }
    )
    @websocket_api.async_response
    async def ws_delete(hass: HomeAssistant, connection, msg) -> None:
        """Remove a scheduler the client no longer wants, from the card."""
        entry = _get_entry(hass, msg["entry_id"])
        if entry is None:
            connection.send_error(msg["id"], "not_found", _ERROR_MESSAGES["not_found"])
            return

        await hass.config_entries.async_remove(entry.entry_id)
        connection.send_result(msg["id"], {"ok": True})

    @websocket_api.require_admin
    @websocket_api.websocket_command(
        {
            vol.Required("type"): f"{DOMAIN}/set_general",
            vol.Required("entry_id"): str,
            vol.Optional(CONF_NAME): str,
            vol.Optional(CONF_TARGET_ENTITY): [str],
            vol.Optional(CONF_DEVICE_TYPE): vol.In(DEVICE_TYPES),
        }
    )
    @websocket_api.async_response
    async def ws_set_general(hass: HomeAssistant, connection, msg) -> None:
        """Rename a scheduler, change its target entities, or its device/action profile."""
        entry = _get_entry(hass, msg["entry_id"])
        if entry is None:
            connection.send_error(msg["id"], "not_found", _ERROR_MESSAGES["not_found"])
            return

        name = str(msg.get(CONF_NAME, entry.data.get(CONF_NAME, entry.title or "Scheduler"))).strip() or "Scheduler"
        entity_ids = _normalize_entity_ids(
            msg.get(CONF_TARGET_ENTITY, entry.data.get(CONF_TARGET_ENTITY))
        )
        device_type_setting = msg.get(CONF_DEVICE_TYPE, entry.options.get(CONF_DEVICE_TYPE, "auto"))

        if not entity_ids:
            connection.send_error(msg["id"], "required", _ERROR_MESSAGES["required"])
            return
        if _has_unsupported_entities(entity_ids):
            connection.send_error(msg["id"], "unsupported_domain", _ERROR_MESSAGES["unsupported_domain"])
            return
        if _is_duplicate_entry(hass, name, entity_ids, current_entry_id=entry.entry_id):
            connection.send_error(msg["id"], "already_configured", _ERROR_MESSAGES["already_configured"])
            return

        opts = dict(entry.options or {})
        opts[CONF_DEVICE_TYPE] = device_type_setting

        hass.config_entries.async_update_entry(
            entry,
            title=name,
            data={CONF_NAME: name, CONF_TARGET_ENTITY: entity_ids},
            options=opts,
        )
        await _reload_scheduler(hass, entry)

        connection.send_result(msg["id"], {"ok": True, "name": name, "target_entity": entity_ids})

    @websocket_api.require_admin
    @websocket_api.websocket_command(
        vol.Schema(
            {
                vol.Required("type"): f"{DOMAIN}/set_actions",
                vol.Required("entry_id"): str,
                vol.Optional(CONF_DEVICE_TYPE): vol.In(DEVICE_TYPES),
            },
            extra=vol.ALLOW_EXTRA,
        )
    )
    @websocket_api.async_response
    async def ws_set_actions(hass: HomeAssistant, connection, msg) -> None:
        """Update the "what happens at start/end" action profile for a scheduler.

        Lets the card expose the same brightness/position/temperature/action
        controls the number/select entities and options-flow "Actions" step
        provide, inline in the card itself.
        """
        entry = _get_entry(hass, msg["entry_id"])
        if entry is None:
            connection.send_error(msg["id"], "not_found", _ERROR_MESSAGES["not_found"])
            return

        opts = dict(entry.options or {})
        device_type_setting = msg.get(CONF_DEVICE_TYPE, opts.get(CONF_DEVICE_TYPE, "auto"))
        opts[CONF_DEVICE_TYPE] = device_type_setting

        entity_ids = _normalize_entity_ids(entry.data.get(CONF_TARGET_ENTITY))
        resolved_type = _detect_type(entity_ids) if device_type_setting == "auto" else device_type_setting

        action_fields = {
            k: v for k, v in msg.items() if k not in ("type", "id", "entry_id", CONF_DEVICE_TYPE)
        }
        opts.update(_resolve_action_options(resolved_type, action_fields))

        hass.config_entries.async_update_entry(entry, options=opts)
        await _reload_scheduler(hass, entry)

        connection.send_result(msg["id"], {"ok": True, "options": opts})

    websocket_api.async_register_command(hass, ws_list)
    websocket_api.async_register_command(hass, ws_set_options)
    websocket_api.async_register_command(hass, ws_create)
    websocket_api.async_register_command(hass, ws_delete)
    websocket_api.async_register_command(hass, ws_set_general)
    websocket_api.async_register_command(hass, ws_set_actions)
