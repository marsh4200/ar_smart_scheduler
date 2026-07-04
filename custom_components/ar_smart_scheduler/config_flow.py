from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector

from .const import (
    CLIMATE_ACTIONS,
    CLIMATE_ACTION_TO_SERVICE,
    CONF_CLIMATE_END_ACTION,
    CONF_CLIMATE_END_TEMPERATURE,
    CONF_CLIMATE_START_ACTION,
    CONF_CLIMATE_START_TEMPERATURE,
    CONF_COVER_END_ACTION,
    CONF_COVER_END_POSITION,
    CONF_COVER_START_ACTION,
    CONF_COVER_START_POSITION,
    CONF_DEVICE_TYPE,
    CONF_ENABLED,
    CONF_END,
    CONF_END_DATA,
    CONF_END_OFFSET,
    CONF_END_SERVICE,
    CONF_END_TRIGGER,
    CONF_LIGHT_END_ACTION,
    CONF_LIGHT_END_BRIGHTNESS,
    CONF_LIGHT_START_ACTION,
    CONF_LIGHT_START_BRIGHTNESS,
    CONF_LOCK_END_ACTION,
    CONF_LOCK_START_ACTION,
    CONF_NAME,
    CONF_ONOFF_END_ACTION,
    CONF_ONOFF_START_ACTION,
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
    CONF_WATER_HEATER_END_ACTION,
    CONF_WATER_HEATER_END_TEMPERATURE,
    CONF_WATER_HEATER_START_ACTION,
    CONF_WATER_HEATER_START_TEMPERATURE,
    CONF_WEEKDAYS,
    COVER_ACTIONS,
    COVER_ACTION_TO_SERVICE,
    DEFAULT_CLIMATE_END_ACTION,
    DEFAULT_CLIMATE_END_TEMPERATURE,
    DEFAULT_CLIMATE_START_ACTION,
    DEFAULT_CLIMATE_START_TEMPERATURE,
    DEFAULT_COVER_END_ACTION,
    DEFAULT_COVER_END_POSITION,
    DEFAULT_COVER_START_ACTION,
    DEFAULT_COVER_START_POSITION,
    DEFAULT_END,
    DEFAULT_END_OFFSET,
    DEFAULT_END_TRIGGER,
    DEFAULT_LIGHT_END_ACTION,
    DEFAULT_LIGHT_END_BRIGHTNESS,
    DEFAULT_LIGHT_START_ACTION,
    DEFAULT_LIGHT_START_BRIGHTNESS,
    DEFAULT_LOCK_END_ACTION,
    DEFAULT_LOCK_START_ACTION,
    DEFAULT_ONOFF_END_ACTION,
    DEFAULT_ONOFF_START_ACTION,
    DEFAULT_SECOND_ENABLED,
    DEFAULT_SECOND_END,
    DEFAULT_SECOND_END_OFFSET,
    DEFAULT_SECOND_END_TRIGGER,
    DEFAULT_SECOND_START,
    DEFAULT_SECOND_START_OFFSET,
    DEFAULT_SECOND_START_TRIGGER,
    DEFAULT_START,
    DEFAULT_START_OFFSET,
    DEFAULT_START_TRIGGER,
    DEFAULT_WATER_HEATER_END_ACTION,
    DEFAULT_WATER_HEATER_END_TEMPERATURE,
    DEFAULT_WATER_HEATER_START_ACTION,
    DEFAULT_WATER_HEATER_START_TEMPERATURE,
    DEFAULT_WEEKDAYS,
    DEVICE_TYPES,
    DOMAIN,
    LOCK_ACTIONS,
    LOCK_ACTION_TO_SERVICE,
    ONOFF_ACTIONS,
    ONOFF_ACTION_TO_SERVICE,
    TRIGGER_TYPES,
    WATER_HEATER_ACTIONS,
    WEEKDAY_KEYS,
)

SUPPORTED_ENTITY_DOMAINS = [
    "cover",
    "switch",
    "light",
    "climate",
    "media_player",
    "fan",
    "water_heater",
    "lock",
    "input_boolean",
]


def _normalize_entity_ids(entity_ids) -> list[str]:
    if not entity_ids:
        return []
    if isinstance(entity_ids, str):
        return [entity_ids]

    out: list[str] = []
    if isinstance(entity_ids, list):
        for item in entity_ids:
            if isinstance(item, str):
                out.append(item)
            elif isinstance(item, dict):
                ent = item.get("entity_id") or item.get("entity") or item.get("id")
                if isinstance(ent, str):
                    out.append(ent)
    return out


def _detect_type(entity_ids) -> str:
    ents = _normalize_entity_ids(entity_ids)

    for prefix, device_type in (
        ("climate.", "climate"),
        ("water_heater.", "water_heater"),
        ("lock.", "lock"),
        ("cover.", "cover"),
        ("light.", "light"),
    ):
        if any(e.startswith(prefix) for e in ents):
            return device_type
    return "onoff"


def _has_unsupported_entities(entity_ids: list[str]) -> bool:
    for entity_id in entity_ids:
        domain = entity_id.split(".", 1)[0]
        if domain not in SUPPORTED_ENTITY_DOMAINS:
            return True
    return False


def _cover_defaults_from_existing(existing: dict):
    start_action = existing.get(CONF_COVER_START_ACTION)
    end_action = existing.get(CONF_COVER_END_ACTION)
    start_pos = existing.get(CONF_COVER_START_POSITION)
    end_pos = existing.get(CONF_COVER_END_POSITION)

    if start_action in COVER_ACTIONS and end_action in COVER_ACTIONS:
        return (
            start_action,
            int(start_pos if start_pos is not None else DEFAULT_COVER_START_POSITION),
            end_action,
            int(end_pos if end_pos is not None else DEFAULT_COVER_END_POSITION),
        )

    # Fall back to reverse-engineering from resolved services (pre-1.4 entries)
    ss = str(existing.get(CONF_START_SERVICE, "") or "")
    es = str(existing.get(CONF_END_SERVICE, "") or "")
    sd = existing.get(CONF_START_DATA) or {}
    ed = existing.get(CONF_END_DATA) or {}

    if ss == "open_cover":
        start_action = "open"
        start_pos = 50
    elif ss == "close_cover":
        start_action = "close"
        start_pos = 50
    else:
        start_action = "position"
        start_pos = int(sd.get("position", 50))

    if es == "open_cover":
        end_action = "open"
        end_pos = 0
    elif es == "close_cover":
        end_action = "close"
        end_pos = 0
    else:
        end_action = "position"
        end_pos = int(ed.get("position", 0))

    return start_action, start_pos, end_action, end_pos


def _light_defaults_from_existing(existing: dict):
    start_action = existing.get(CONF_LIGHT_START_ACTION)
    end_action = existing.get(CONF_LIGHT_END_ACTION)

    if start_action in ("on", "off", "brightness") and end_action in ("on", "off", "brightness"):
        return (
            start_action,
            int(existing.get(CONF_LIGHT_START_BRIGHTNESS, DEFAULT_LIGHT_START_BRIGHTNESS)),
            end_action,
            int(existing.get(CONF_LIGHT_END_BRIGHTNESS, DEFAULT_LIGHT_END_BRIGHTNESS)),
        )

    ss = str(existing.get(CONF_START_SERVICE, "") or "")
    es = str(existing.get(CONF_END_SERVICE, "") or "")
    sd = existing.get(CONF_START_DATA) or {}
    ed = existing.get(CONF_END_DATA) or {}

    if ss == "turn_off":
        start_action = "off"
        start_bri = 50
    elif "brightness_pct" in sd:
        start_action = "brightness"
        start_bri = int(sd.get("brightness_pct", 50))
    else:
        start_action = "on"
        start_bri = 50

    if es == "turn_off":
        end_action = "off"
        end_bri = 10
    elif "brightness_pct" in ed:
        end_action = "brightness"
        end_bri = int(ed.get("brightness_pct", 10))
    else:
        end_action = "on"
        end_bri = 10

    return start_action, start_bri, end_action, end_bri


def _climate_defaults_from_existing(existing: dict):
    start_action = existing.get(CONF_CLIMATE_START_ACTION)
    end_action = existing.get(CONF_CLIMATE_END_ACTION)

    if start_action in CLIMATE_ACTIONS and end_action in CLIMATE_ACTIONS:
        return (
            start_action,
            int(existing.get(CONF_CLIMATE_START_TEMPERATURE, DEFAULT_CLIMATE_START_TEMPERATURE)),
            end_action,
            int(existing.get(CONF_CLIMATE_END_TEMPERATURE, DEFAULT_CLIMATE_END_TEMPERATURE)),
        )

    ss = str(existing.get(CONF_START_SERVICE, "") or "")
    es = str(existing.get(CONF_END_SERVICE, "") or "")
    sd = existing.get(CONF_START_DATA) or {}
    ed = existing.get(CONF_END_DATA) or {}

    start_action = str(sd.get("hvac_mode", DEFAULT_CLIMATE_START_ACTION))
    if ss == "set_temperature":
        start_action = "temperature"
    elif ss == "set_hvac_mode":
        start_action = str(sd.get("hvac_mode", DEFAULT_CLIMATE_START_ACTION))
    start_temp = int(sd.get("temperature", DEFAULT_CLIMATE_START_TEMPERATURE))

    end_action = str(ed.get("hvac_mode", DEFAULT_CLIMATE_END_ACTION))
    if es == "set_temperature":
        end_action = "temperature"
    elif es == "set_hvac_mode":
        end_action = str(ed.get("hvac_mode", DEFAULT_CLIMATE_END_ACTION))
    end_temp = int(ed.get("temperature", DEFAULT_CLIMATE_END_TEMPERATURE))

    if start_action not in CLIMATE_ACTIONS:
        start_action = DEFAULT_CLIMATE_START_ACTION
    if end_action not in CLIMATE_ACTIONS:
        end_action = DEFAULT_CLIMATE_END_ACTION

    return start_action, start_temp, end_action, end_temp


def _water_heater_defaults_from_existing(existing: dict):
    start_action = existing.get(CONF_WATER_HEATER_START_ACTION, DEFAULT_WATER_HEATER_START_ACTION)
    end_action = existing.get(CONF_WATER_HEATER_END_ACTION, DEFAULT_WATER_HEATER_END_ACTION)
    if start_action not in WATER_HEATER_ACTIONS:
        start_action = DEFAULT_WATER_HEATER_START_ACTION
    if end_action not in WATER_HEATER_ACTIONS:
        end_action = DEFAULT_WATER_HEATER_END_ACTION
    start_temp = int(existing.get(CONF_WATER_HEATER_START_TEMPERATURE, DEFAULT_WATER_HEATER_START_TEMPERATURE))
    end_temp = int(existing.get(CONF_WATER_HEATER_END_TEMPERATURE, DEFAULT_WATER_HEATER_END_TEMPERATURE))
    return start_action, start_temp, end_action, end_temp


def _lock_defaults_from_existing(existing: dict):
    start_action = existing.get(CONF_LOCK_START_ACTION, DEFAULT_LOCK_START_ACTION)
    end_action = existing.get(CONF_LOCK_END_ACTION, DEFAULT_LOCK_END_ACTION)
    if start_action not in LOCK_ACTIONS:
        start_action = DEFAULT_LOCK_START_ACTION
    if end_action not in LOCK_ACTIONS:
        end_action = DEFAULT_LOCK_END_ACTION
    return start_action, end_action


def _build_action_schema(device_type: str, existing: dict | None = None) -> vol.Schema:
    existing = existing or {}

    if device_type == "cover":
        start_action, start_pos, end_action, end_pos = _cover_defaults_from_existing(existing)
        return vol.Schema(
            {
                vol.Required(CONF_COVER_START_ACTION, default=start_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=COVER_ACTIONS)
                ),
                vol.Required(CONF_COVER_START_POSITION, default=start_pos): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=0, max=100, step=5, mode=selector.NumberSelectorMode.SLIDER)
                ),
                vol.Required(CONF_COVER_END_ACTION, default=end_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=COVER_ACTIONS)
                ),
                vol.Required(CONF_COVER_END_POSITION, default=end_pos): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=0, max=100, step=5, mode=selector.NumberSelectorMode.SLIDER)
                ),
            }
        )

    if device_type == "light":
        start_action, start_bri, end_action, end_bri = _light_defaults_from_existing(existing)
        return vol.Schema(
            {
                vol.Required(CONF_LIGHT_START_ACTION, default=start_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=["on", "off", "brightness"])
                ),
                vol.Required(CONF_LIGHT_START_BRIGHTNESS, default=start_bri): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=0, max=100, step=5, mode=selector.NumberSelectorMode.SLIDER)
                ),
                vol.Required(CONF_LIGHT_END_ACTION, default=end_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=["on", "off", "brightness"])
                ),
                vol.Required(CONF_LIGHT_END_BRIGHTNESS, default=end_bri): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=0, max=100, step=5, mode=selector.NumberSelectorMode.SLIDER)
                ),
            }
        )

    if device_type == "climate":
        start_action, start_temp, end_action, end_temp = _climate_defaults_from_existing(existing)
        return vol.Schema(
            {
                vol.Required(CONF_CLIMATE_START_ACTION, default=start_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=CLIMATE_ACTIONS)
                ),
                vol.Required(CONF_CLIMATE_START_TEMPERATURE, default=start_temp): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=8, max=35, step=1, mode=selector.NumberSelectorMode.BOX)
                ),
                vol.Required(CONF_CLIMATE_END_ACTION, default=end_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=CLIMATE_ACTIONS)
                ),
                vol.Required(CONF_CLIMATE_END_TEMPERATURE, default=end_temp): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=8, max=35, step=1, mode=selector.NumberSelectorMode.BOX)
                ),
            }
        )

    if device_type == "water_heater":
        start_action, start_temp, end_action, end_temp = _water_heater_defaults_from_existing(existing)
        return vol.Schema(
            {
                vol.Required(CONF_WATER_HEATER_START_ACTION, default=start_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=WATER_HEATER_ACTIONS)
                ),
                vol.Required(CONF_WATER_HEATER_START_TEMPERATURE, default=start_temp): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=30, max=80, step=1, mode=selector.NumberSelectorMode.BOX)
                ),
                vol.Required(CONF_WATER_HEATER_END_ACTION, default=end_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=WATER_HEATER_ACTIONS)
                ),
                vol.Required(CONF_WATER_HEATER_END_TEMPERATURE, default=end_temp): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=30, max=80, step=1, mode=selector.NumberSelectorMode.BOX)
                ),
            }
        )

    if device_type == "lock":
        start_action, end_action = _lock_defaults_from_existing(existing)
        return vol.Schema(
            {
                vol.Required(CONF_LOCK_START_ACTION, default=start_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=LOCK_ACTIONS)
                ),
                vol.Required(CONF_LOCK_END_ACTION, default=end_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=LOCK_ACTIONS)
                ),
            }
        )

    return vol.Schema(
        {
            vol.Required(
                CONF_ONOFF_START_ACTION,
                default=existing.get(CONF_ONOFF_START_ACTION, DEFAULT_ONOFF_START_ACTION),
            ): selector.SelectSelector(selector.SelectSelectorConfig(options=ONOFF_ACTIONS)),
            vol.Required(
                CONF_ONOFF_END_ACTION,
                default=existing.get(CONF_ONOFF_END_ACTION, DEFAULT_ONOFF_END_ACTION),
            ): selector.SelectSelector(selector.SelectSelectorConfig(options=ONOFF_ACTIONS)),
        }
    )


def _resolve_action_options(device_type: str, user_input: dict) -> dict:
    """Translate user-friendly action choices into resolved services + data.

    Also stores the raw action option keys so the select/number entities and
    the options flow always reflect the current choice.
    """
    out: dict = {}

    if device_type == "cover":
        start_action = user_input.get(CONF_COVER_START_ACTION, DEFAULT_COVER_START_ACTION)
        end_action = user_input.get(CONF_COVER_END_ACTION, DEFAULT_COVER_END_ACTION)
        start_pos = int(user_input.get(CONF_COVER_START_POSITION, DEFAULT_COVER_START_POSITION))
        end_pos = int(user_input.get(CONF_COVER_END_POSITION, DEFAULT_COVER_END_POSITION))

        out[CONF_COVER_START_ACTION] = start_action
        out[CONF_COVER_END_ACTION] = end_action
        out[CONF_COVER_START_POSITION] = start_pos
        out[CONF_COVER_END_POSITION] = end_pos
        out[CONF_START_SERVICE] = COVER_ACTION_TO_SERVICE[start_action]
        out[CONF_END_SERVICE] = COVER_ACTION_TO_SERVICE[end_action]
        out[CONF_START_DATA] = {"position": start_pos} if start_action == "position" else {}
        out[CONF_END_DATA] = {"position": end_pos} if end_action == "position" else {}
        return out

    if device_type == "light":
        start_action = user_input.get(CONF_LIGHT_START_ACTION, DEFAULT_LIGHT_START_ACTION)
        end_action = user_input.get(CONF_LIGHT_END_ACTION, DEFAULT_LIGHT_END_ACTION)
        start_bri = int(user_input.get(CONF_LIGHT_START_BRIGHTNESS, DEFAULT_LIGHT_START_BRIGHTNESS))
        end_bri = int(user_input.get(CONF_LIGHT_END_BRIGHTNESS, DEFAULT_LIGHT_END_BRIGHTNESS))

        out[CONF_LIGHT_START_ACTION] = start_action
        out[CONF_LIGHT_END_ACTION] = end_action
        out[CONF_LIGHT_START_BRIGHTNESS] = start_bri
        out[CONF_LIGHT_END_BRIGHTNESS] = end_bri
        out[CONF_START_SERVICE] = "turn_on" if start_action in ("on", "brightness") else "turn_off"
        out[CONF_END_SERVICE] = "turn_on" if end_action in ("on", "brightness") else "turn_off"
        out[CONF_START_DATA] = {"brightness_pct": start_bri} if start_action == "brightness" else {}
        out[CONF_END_DATA] = {"brightness_pct": end_bri} if end_action == "brightness" else {}
        return out

    if device_type == "climate":
        start_action = user_input.get(CONF_CLIMATE_START_ACTION, DEFAULT_CLIMATE_START_ACTION)
        end_action = user_input.get(CONF_CLIMATE_END_ACTION, DEFAULT_CLIMATE_END_ACTION)
        start_temp = int(user_input.get(CONF_CLIMATE_START_TEMPERATURE, DEFAULT_CLIMATE_START_TEMPERATURE))
        end_temp = int(user_input.get(CONF_CLIMATE_END_TEMPERATURE, DEFAULT_CLIMATE_END_TEMPERATURE))

        out[CONF_CLIMATE_START_ACTION] = start_action
        out[CONF_CLIMATE_END_ACTION] = end_action
        out[CONF_CLIMATE_START_TEMPERATURE] = start_temp
        out[CONF_CLIMATE_END_TEMPERATURE] = end_temp
        out[CONF_START_SERVICE] = CLIMATE_ACTION_TO_SERVICE[start_action]
        out[CONF_END_SERVICE] = CLIMATE_ACTION_TO_SERVICE[end_action]
        out[CONF_START_DATA] = {"temperature": start_temp} if start_action == "temperature" else {"hvac_mode": start_action}
        out[CONF_END_DATA] = {"temperature": end_temp} if end_action == "temperature" else {"hvac_mode": end_action}
        return out

    if device_type == "water_heater":
        start_action = user_input.get(CONF_WATER_HEATER_START_ACTION, DEFAULT_WATER_HEATER_START_ACTION)
        end_action = user_input.get(CONF_WATER_HEATER_END_ACTION, DEFAULT_WATER_HEATER_END_ACTION)
        start_temp = int(user_input.get(CONF_WATER_HEATER_START_TEMPERATURE, DEFAULT_WATER_HEATER_START_TEMPERATURE))
        end_temp = int(user_input.get(CONF_WATER_HEATER_END_TEMPERATURE, DEFAULT_WATER_HEATER_END_TEMPERATURE))

        out[CONF_WATER_HEATER_START_ACTION] = start_action
        out[CONF_WATER_HEATER_END_ACTION] = end_action
        out[CONF_WATER_HEATER_START_TEMPERATURE] = start_temp
        out[CONF_WATER_HEATER_END_TEMPERATURE] = end_temp
        out[CONF_START_SERVICE] = "set_temperature" if start_action == "temperature" else "set_operation_mode"
        out[CONF_END_SERVICE] = "set_temperature" if end_action == "temperature" else "set_operation_mode"
        out[CONF_START_DATA] = {"temperature": start_temp} if start_action == "temperature" else {"operation_mode": start_action}
        out[CONF_END_DATA] = {"temperature": end_temp} if end_action == "temperature" else {"operation_mode": end_action}
        return out

    if device_type == "lock":
        start_action = user_input.get(CONF_LOCK_START_ACTION, DEFAULT_LOCK_START_ACTION)
        end_action = user_input.get(CONF_LOCK_END_ACTION, DEFAULT_LOCK_END_ACTION)

        out[CONF_LOCK_START_ACTION] = start_action
        out[CONF_LOCK_END_ACTION] = end_action
        out[CONF_START_SERVICE] = LOCK_ACTION_TO_SERVICE[start_action]
        out[CONF_END_SERVICE] = LOCK_ACTION_TO_SERVICE[end_action]
        out[CONF_START_DATA] = {}
        out[CONF_END_DATA] = {}
        return out

    start_action = user_input.get(CONF_ONOFF_START_ACTION, DEFAULT_ONOFF_START_ACTION)
    end_action = user_input.get(CONF_ONOFF_END_ACTION, DEFAULT_ONOFF_END_ACTION)
    out[CONF_ONOFF_START_ACTION] = start_action
    out[CONF_ONOFF_END_ACTION] = end_action
    out[CONF_START_SERVICE] = ONOFF_ACTION_TO_SERVICE[start_action]
    out[CONF_END_SERVICE] = ONOFF_ACTION_TO_SERVICE[end_action]
    out[CONF_START_DATA] = {}
    out[CONF_END_DATA] = {}
    return out


def _time_selector() -> selector.TimeSelector:
    return selector.TimeSelector()


def _number_selector() -> selector.NumberSelector:
    return selector.NumberSelector(
        selector.NumberSelectorConfig(min=-180, max=180, step=1, mode=selector.NumberSelectorMode.BOX)
    )


def _general_schema(data: dict, opts: dict) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_NAME, default=data.get(CONF_NAME, "Scheduler")): str,
            vol.Required(CONF_TARGET_ENTITY, default=_normalize_entity_ids(data.get(CONF_TARGET_ENTITY))): selector.EntitySelector(
                selector.EntitySelectorConfig(multiple=True, domain=SUPPORTED_ENTITY_DOMAINS)
            ),
            vol.Required(CONF_DEVICE_TYPE, default=opts.get(CONF_DEVICE_TYPE, "auto")): selector.SelectSelector(
                selector.SelectSelectorConfig(options=DEVICE_TYPES)
            ),
            vol.Required(CONF_ENABLED, default=bool(opts.get(CONF_ENABLED, True))): bool,
        }
    )


def _schedule_schema(opts: dict) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_START_TRIGGER, default=opts.get(CONF_START_TRIGGER, DEFAULT_START_TRIGGER)): selector.SelectSelector(
                selector.SelectSelectorConfig(options=TRIGGER_TYPES)
            ),
            vol.Required(CONF_END_TRIGGER, default=opts.get(CONF_END_TRIGGER, DEFAULT_END_TRIGGER)): selector.SelectSelector(
                selector.SelectSelectorConfig(options=TRIGGER_TYPES)
            ),
            vol.Required(CONF_WEEKDAYS, default=opts.get(CONF_WEEKDAYS, DEFAULT_WEEKDAYS)): selector.SelectSelector(
                selector.SelectSelectorConfig(options=WEEKDAY_KEYS, multiple=True)
            ),
        }
    )


def _schedule_details_schema(opts: dict) -> vol.Schema:
    schema: dict = {}

    if opts.get(CONF_START_TRIGGER, DEFAULT_START_TRIGGER) == "time":
        schema[vol.Required(CONF_START, default=opts.get(CONF_START, DEFAULT_START))] = _time_selector()
    else:
        schema[vol.Required(CONF_START_OFFSET, default=int(opts.get(CONF_START_OFFSET, DEFAULT_START_OFFSET)))] = _number_selector()

    if opts.get(CONF_END_TRIGGER, DEFAULT_END_TRIGGER) == "time":
        schema[vol.Required(CONF_END, default=opts.get(CONF_END, DEFAULT_END))] = _time_selector()
    else:
        schema[vol.Required(CONF_END_OFFSET, default=int(opts.get(CONF_END_OFFSET, DEFAULT_END_OFFSET)))] = _number_selector()

    return vol.Schema(schema)


def _second_window_schema(opts: dict) -> vol.Schema:
    second_enabled = bool(opts.get(CONF_SECOND_ENABLED, DEFAULT_SECOND_ENABLED))

    return vol.Schema(
        {
            vol.Required(CONF_SECOND_ENABLED, default=second_enabled): bool,
            vol.Optional(
                CONF_SECOND_START_TRIGGER,
                default=opts.get(CONF_SECOND_START_TRIGGER, DEFAULT_SECOND_START_TRIGGER),
            ): selector.SelectSelector(selector.SelectSelectorConfig(options=TRIGGER_TYPES)),
            vol.Optional(
                CONF_SECOND_END_TRIGGER,
                default=opts.get(CONF_SECOND_END_TRIGGER, DEFAULT_SECOND_END_TRIGGER),
            ): selector.SelectSelector(selector.SelectSelectorConfig(options=TRIGGER_TYPES)),
        }
    )


def _second_window_details_schema(opts: dict) -> vol.Schema:
    second_enabled = bool(opts.get(CONF_SECOND_ENABLED, DEFAULT_SECOND_ENABLED))

    schema: dict = {
        vol.Required(CONF_SECOND_ENABLED, default=second_enabled): bool,
    }

    if not second_enabled:
        return vol.Schema(schema)

    second_fields = {
        CONF_SECOND_START: opts.get(CONF_SECOND_START, DEFAULT_SECOND_START),
        CONF_SECOND_START_TRIGGER: opts.get(CONF_SECOND_START_TRIGGER, DEFAULT_SECOND_START_TRIGGER),
        CONF_SECOND_START_OFFSET: int(opts.get(CONF_SECOND_START_OFFSET, DEFAULT_SECOND_START_OFFSET)),
        CONF_SECOND_END: opts.get(CONF_SECOND_END, DEFAULT_SECOND_END),
        CONF_SECOND_END_TRIGGER: opts.get(CONF_SECOND_END_TRIGGER, DEFAULT_SECOND_END_TRIGGER),
        CONF_SECOND_END_OFFSET: int(opts.get(CONF_SECOND_END_OFFSET, DEFAULT_SECOND_END_OFFSET)),
    }

    if second_fields[CONF_SECOND_START_TRIGGER] == "time":
        schema[vol.Required(CONF_SECOND_START, default=second_fields[CONF_SECOND_START])] = _time_selector()
    else:
        schema[vol.Required(CONF_SECOND_START_OFFSET, default=second_fields[CONF_SECOND_START_OFFSET])] = _number_selector()

    if second_fields[CONF_SECOND_END_TRIGGER] == "time":
        schema[vol.Required(CONF_SECOND_END, default=second_fields[CONF_SECOND_END])] = _time_selector()
    else:
        schema[vol.Required(CONF_SECOND_END_OFFSET, default=second_fields[CONF_SECOND_END_OFFSET])] = _number_selector()

    return vol.Schema(schema)


def _normalize_time_input(value) -> str:
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M:%S")
    value_str = str(value or "")
    if len(value_str) == 5:
        return f"{value_str}:00"
    return value_str or "00:00:00"


class _BaseSchedulerFlow:
    def _prepare_general(self, user_input: dict) -> tuple[str, list[str], str, dict]:
        name = str(user_input[CONF_NAME]).strip() or "Scheduler"
        entity_ids = _normalize_entity_ids(user_input[CONF_TARGET_ENTITY])
        requested_type = user_input.get(CONF_DEVICE_TYPE, "auto")
        device_type = _detect_type(entity_ids) if requested_type == "auto" else requested_type

        general_options = {
            CONF_DEVICE_TYPE: requested_type,
            CONF_ENABLED: bool(user_input.get(CONF_ENABLED, True)),
        }
        return name, entity_ids, device_type, general_options

    def _prepare_schedule(self, user_input: dict) -> dict:
        return {
            CONF_WEEKDAYS: user_input.get(CONF_WEEKDAYS, DEFAULT_WEEKDAYS),
            CONF_START_TRIGGER: user_input.get(CONF_START_TRIGGER, DEFAULT_START_TRIGGER),
            CONF_END_TRIGGER: user_input.get(CONF_END_TRIGGER, DEFAULT_END_TRIGGER),
        }

    def _prepare_schedule_details(self, user_input: dict, current: dict | None = None) -> dict:
        current = current or {}
        return {
            CONF_START: _normalize_time_input(user_input.get(CONF_START, current.get(CONF_START, DEFAULT_START))),
            CONF_END: _normalize_time_input(user_input.get(CONF_END, current.get(CONF_END, DEFAULT_END))),
            CONF_START_OFFSET: int(user_input.get(CONF_START_OFFSET, current.get(CONF_START_OFFSET, DEFAULT_START_OFFSET))),
            CONF_END_OFFSET: int(user_input.get(CONF_END_OFFSET, current.get(CONF_END_OFFSET, DEFAULT_END_OFFSET))),
        }

    def _prepare_second_window(self, user_input: dict) -> dict:
        return {
            CONF_SECOND_ENABLED: bool(user_input.get(CONF_SECOND_ENABLED, DEFAULT_SECOND_ENABLED)),
            CONF_SECOND_START_TRIGGER: user_input.get(CONF_SECOND_START_TRIGGER, DEFAULT_SECOND_START_TRIGGER),
            CONF_SECOND_END_TRIGGER: user_input.get(CONF_SECOND_END_TRIGGER, DEFAULT_SECOND_END_TRIGGER),
        }

    def _prepare_second_window_details(self, user_input: dict, current: dict | None = None) -> dict:
        current = current or {}
        return {
            CONF_SECOND_ENABLED: bool(user_input.get(CONF_SECOND_ENABLED, DEFAULT_SECOND_ENABLED)),
            CONF_SECOND_START: _normalize_time_input(user_input.get(CONF_SECOND_START, current.get(CONF_SECOND_START, DEFAULT_SECOND_START))),
            CONF_SECOND_END: _normalize_time_input(user_input.get(CONF_SECOND_END, current.get(CONF_SECOND_END, DEFAULT_SECOND_END))),
            CONF_SECOND_START_OFFSET: int(user_input.get(CONF_SECOND_START_OFFSET, current.get(CONF_SECOND_START_OFFSET, DEFAULT_SECOND_START_OFFSET))),
            CONF_SECOND_END_OFFSET: int(user_input.get(CONF_SECOND_END_OFFSET, current.get(CONF_SECOND_END_OFFSET, DEFAULT_SECOND_END_OFFSET))),
        }

    def _is_duplicate(self, name: str, entity_ids: list[str], current_entry_id: str | None = None) -> bool:
        key = (name.casefold(), tuple(entity_ids))
        for entry in self.hass.config_entries.async_entries(DOMAIN):
            if current_entry_id is not None and entry.entry_id == current_entry_id:
                continue
            other_name = str(entry.data.get(CONF_NAME, entry.title or "")).strip()
            other_entities = _normalize_entity_ids(entry.data.get(CONF_TARGET_ENTITY))
            if (other_name.casefold(), tuple(other_entities)) == key:
                return True
        return False


class ARSmartSchedulerConfigFlow(_BaseSchedulerFlow, config_entries.ConfigFlow, domain=DOMAIN):
    # IMPORTANT: must match the highest version produced by
    # async_migrate_entry in __init__.py. With VERSION=2 and migrations
    # bumping entries to 3, HA refused to load migrated entries
    # ("migration error") because the entry version exceeded the flow
    # version. This was the root cause of schedulers failing after restart.
    VERSION = 3

    def __init__(self) -> None:
        self._name = None
        self._entity_ids = None
        self._device_type = None
        self._options: dict = {}

    async def async_step_user(self, user_input=None):
        errors: dict[str, str] = {}

        if user_input is not None:
            name, entity_ids, device_type, general_options = self._prepare_general(user_input)

            if not entity_ids:
                errors[CONF_TARGET_ENTITY] = "required"
            elif _has_unsupported_entities(entity_ids):
                errors[CONF_TARGET_ENTITY] = "unsupported_domain"
            elif self._is_duplicate(name, entity_ids):
                errors["base"] = "already_configured"
            else:
                self._name = name
                self._entity_ids = entity_ids
                self._device_type = device_type
                self._options.update(general_options)
                return await self.async_step_schedule()

        schema = _general_schema({}, {})
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    async def async_step_schedule(self, user_input=None):
        if user_input is not None:
            self._options.update(self._prepare_schedule(user_input))
            return await self.async_step_schedule_details()

        return self.async_show_form(
            step_id="schedule",
            data_schema=_schedule_schema(self._options),
        )

    async def async_step_schedule_details(self, user_input=None):
        if user_input is not None:
            self._options.update(self._prepare_schedule_details(user_input, self._options))
            return await self.async_step_second_window()

        return self.async_show_form(
            step_id="schedule_details",
            data_schema=_schedule_details_schema(self._options),
        )

    async def async_step_second_window(self, user_input=None):
        if user_input is not None:
            self._options.update(self._prepare_second_window(user_input))
            return await self.async_step_second_window_details()

        return self.async_show_form(
            step_id="second_window",
            data_schema=_second_window_schema(self._options),
        )

    async def async_step_second_window_details(self, user_input=None):
        if user_input is not None:
            self._options.update(self._prepare_second_window_details(user_input, self._options))
            return await self.async_step_actions()

        return self.async_show_form(
            step_id="second_window_details",
            data_schema=_second_window_details_schema(self._options),
        )

    async def async_step_actions(self, user_input=None):
        if user_input is not None:
            opts = dict(self._options)
            opts.update(_resolve_action_options(self._device_type, user_input))

            return self.async_create_entry(
                title=self._name or "Scheduler",
                data={
                    CONF_NAME: self._name,
                    CONF_TARGET_ENTITY: self._entity_ids,
                },
                options=opts,
            )

        return self.async_show_form(
            step_id="actions",
            data_schema=_build_action_schema(self._device_type),
        )

    @staticmethod
    def async_get_options_flow(config_entry):
        return ARSmartSchedulerOptionsFlow(config_entry)


class ARSmartSchedulerOptionsFlow(_BaseSchedulerFlow, config_entries.OptionsFlow):
    def __init__(self, entry):
        self._entry = entry
        self._device_type = None
        self._name = str(entry.data.get(CONF_NAME, entry.title or "Scheduler"))
        self._entity_ids = _normalize_entity_ids(entry.data.get(CONF_TARGET_ENTITY))
        self._entry_id = entry.entry_id
        self._pending_schedule: dict | None = None
        self._pending_second_window: dict | None = None

    def _get_entry(self):
        entry = self.hass.config_entries.async_get_entry(self._entry_id)
        return entry or self._entry

    async def async_step_init(self, user_input=None):
        return self.async_show_menu(
            step_id="init",
            menu_options={
                "general": "General",
                "schedule": "Main schedule",
                "second_window": "Second window",
                "actions": "Actions",
            },
        )

    async def async_step_general(self, user_input=None):
        errors: dict[str, str] = {}
        entry = self._get_entry()
        data = dict(entry.data or {})
        opts = dict(entry.options or {})

        if user_input is not None:
            name, entity_ids, device_type, general_options = self._prepare_general(user_input)

            if not entity_ids:
                errors[CONF_TARGET_ENTITY] = "required"
            elif _has_unsupported_entities(entity_ids):
                errors[CONF_TARGET_ENTITY] = "unsupported_domain"
            elif self._is_duplicate(name, entity_ids, current_entry_id=entry.entry_id):
                errors["base"] = "already_configured"
            else:
                self._name = name
                self._entity_ids = entity_ids
                self._device_type = device_type
                updated_options = dict(opts)
                updated_options.update(general_options)

                self.hass.config_entries.async_update_entry(
                    entry,
                    title=self._name,
                    data={
                        CONF_NAME: self._name,
                        CONF_TARGET_ENTITY: self._entity_ids,
                    },
                    options=updated_options,
                )
                return self.async_create_entry(title="", data=updated_options)

        schema = _general_schema(data, opts)
        return self.async_show_form(step_id="general", data_schema=schema, errors=errors)

    async def async_step_schedule(self, user_input=None):
        entry = self._get_entry()
        opts_existing = dict(entry.options or {})

        if user_input is not None:
            out = dict(opts_existing)
            out.update(self._prepare_schedule(user_input))
            self._pending_schedule = out
            return await self.async_step_schedule_details()

        return self.async_show_form(
            step_id="schedule",
            data_schema=_schedule_schema(opts_existing),
        )

    async def async_step_schedule_details(self, user_input=None):
        entry = self._get_entry()
        opts_existing = dict(self._pending_schedule or entry.options or {})

        if user_input is not None:
            out = dict(opts_existing)
            out.update(self._prepare_schedule_details(user_input, opts_existing))

            self._pending_schedule = None
            self.hass.config_entries.async_update_entry(entry, options=out)
            return self.async_create_entry(title="", data=out)

        return self.async_show_form(
            step_id="schedule_details",
            data_schema=_schedule_details_schema(opts_existing),
        )

    async def async_step_second_window(self, user_input=None):
        entry = self._get_entry()
        opts_existing = dict(entry.options or {})

        if user_input is not None:
            out = dict(opts_existing)
            out.update(self._prepare_second_window(user_input))
            self._pending_second_window = out
            return await self.async_step_second_window_details()

        return self.async_show_form(
            step_id="second_window",
            data_schema=_second_window_schema(opts_existing),
        )

    async def async_step_second_window_details(self, user_input=None):
        entry = self._get_entry()
        opts_existing = dict(self._pending_second_window or entry.options or {})

        if user_input is not None:
            out = dict(opts_existing)
            out.update(self._prepare_second_window_details(user_input, opts_existing))

            self._pending_second_window = None
            self.hass.config_entries.async_update_entry(entry, options=out)
            return self.async_create_entry(title="", data=out)

        return self.async_show_form(
            step_id="second_window_details",
            data_schema=_second_window_details_schema(opts_existing),
        )

    async def async_step_actions(self, user_input=None):
        entry = self._get_entry()
        opts_existing = dict(entry.options or {})
        entity_ids = _normalize_entity_ids((entry.data or {}).get(CONF_TARGET_ENTITY))
        requested_type = opts_existing.get(CONF_DEVICE_TYPE, "auto")
        self._device_type = _detect_type(entity_ids) if requested_type == "auto" else requested_type

        if user_input is not None:
            out = dict(opts_existing)
            out.update(_resolve_action_options(self._device_type, user_input))

            self.hass.config_entries.async_update_entry(entry, options=out)
            return self.async_create_entry(title="", data=out)

        return self.async_show_form(
            step_id="actions",
            data_schema=_build_action_schema(self._device_type, opts_existing),
        )
