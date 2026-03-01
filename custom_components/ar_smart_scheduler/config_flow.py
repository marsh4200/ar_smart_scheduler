from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector

from .const import (
    DOMAIN,
    CONF_NAME,
    CONF_TARGET_ENTITY,
    CONF_WEEKDAYS,
    CONF_START,
    CONF_END,
    CONF_ENABLED,
    CONF_START_SERVICE,
    CONF_END_SERVICE,
    CONF_START_DATA,
    CONF_END_DATA,
    DEFAULT_WEEKDAYS,
    DEFAULT_START,
    DEFAULT_END,
    WEEKDAY_KEYS,
)

CONF_DEVICE_TYPE = "device_type"
DEVICE_TYPES = ["auto", "cover", "onoff", "light"]

# ----- Cover -----
COVER_ACTIONS = ["open", "close", "position"]
COVER_ACTION_TO_SERVICE = {
    "open": "open_cover",
    "close": "close_cover",
    "position": "set_cover_position",
}
DEFAULT_COVER_START_ACTION = "open"
DEFAULT_COVER_END_ACTION = "close"

# ----- On/Off -----
ONOFF_ACTIONS = ["on", "off"]
ONOFF_ACTION_TO_SERVICE = {"on": "turn_on", "off": "turn_off"}

# ----- Light -----
LIGHT_ACTIONS = ["on", "off", "brightness"]


# -------------------------------------------------
# Helpers
# -------------------------------------------------

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

    if any(e.startswith("cover.") for e in ents):
        return "cover"
    if any(e.startswith("light.") for e in ents):
        return "light"
    return "onoff"


def _cover_defaults_from_existing(existing: dict):
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


def _build_action_schema(device_type: str, existing: dict | None = None) -> vol.Schema:
    existing = existing or {}

    if device_type == "cover":
        start_action, start_pos, end_action, end_pos = _cover_defaults_from_existing(existing)
        return vol.Schema(
            {
                vol.Required("cover_start_action", default=start_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=COVER_ACTIONS)
                ),
                vol.Required("cover_start_position", default=start_pos): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=0, max=100, step=5, mode=selector.NumberSelectorMode.SLIDER)
                ),
                vol.Required("cover_end_action", default=end_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=COVER_ACTIONS)
                ),
                vol.Required("cover_end_position", default=end_pos): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=0, max=100, step=5, mode=selector.NumberSelectorMode.SLIDER)
                ),
            }
        )

    if device_type == "light":
        start_action, start_bri, end_action, end_bri = _light_defaults_from_existing(existing)
        return vol.Schema(
            {
                vol.Required("light_start_action", default=start_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=LIGHT_ACTIONS)
                ),
                vol.Required("light_start_brightness", default=start_bri): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=0, max=100, step=5, mode=selector.NumberSelectorMode.SLIDER)
                ),
                vol.Required("light_end_action", default=end_action): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=LIGHT_ACTIONS)
                ),
                vol.Required("light_end_brightness", default=end_bri): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=0, max=100, step=5, mode=selector.NumberSelectorMode.SLIDER)
                ),
            }
        )

    return vol.Schema(
        {
            vol.Required("onoff_start_action", default="on"): selector.SelectSelector(
                selector.SelectSelectorConfig(options=ONOFF_ACTIONS)
            ),
            vol.Required("onoff_end_action", default="off"): selector.SelectSelector(
                selector.SelectSelectorConfig(options=ONOFF_ACTIONS)
            ),
        }
    )


def _resolve_action_options(device_type: str, user_input: dict) -> dict:
    out: dict = {}

    if device_type == "cover":
        start_action = user_input.get("cover_start_action", DEFAULT_COVER_START_ACTION)
        end_action = user_input.get("cover_end_action", DEFAULT_COVER_END_ACTION)
        start_pos = int(user_input.get("cover_start_position", 50))
        end_pos = int(user_input.get("cover_end_position", 0))

        out[CONF_START_SERVICE] = COVER_ACTION_TO_SERVICE[start_action]
        out[CONF_END_SERVICE] = COVER_ACTION_TO_SERVICE[end_action]
        out[CONF_START_DATA] = {"position": start_pos} if start_action == "position" else {}
        out[CONF_END_DATA] = {"position": end_pos} if end_action == "position" else {}
        return out

    if device_type == "light":
        start_action = user_input.get("light_start_action", "brightness")
        end_action = user_input.get("light_end_action", "off")
        start_brightness = int(user_input.get("light_start_brightness", 50))
        end_brightness = int(user_input.get("light_end_brightness", 10))

        if start_action == "brightness":
            out[CONF_START_SERVICE] = "turn_on"
            out[CONF_START_DATA] = {"brightness_pct": start_brightness}
        elif start_action == "on":
            out[CONF_START_SERVICE] = "turn_on"
            out[CONF_START_DATA] = {}
        else:
            out[CONF_START_SERVICE] = "turn_off"
            out[CONF_START_DATA] = {}

        if end_action == "brightness":
            out[CONF_END_SERVICE] = "turn_on"
            out[CONF_END_DATA] = {"brightness_pct": end_brightness}
        elif end_action == "on":
            out[CONF_END_SERVICE] = "turn_on"
            out[CONF_END_DATA] = {}
        else:
            out[CONF_END_SERVICE] = "turn_off"
            out[CONF_END_DATA] = {}

        return out

    start_action = user_input.get("onoff_start_action", "on")
    end_action = user_input.get("onoff_end_action", "off")
    out[CONF_START_SERVICE] = ONOFF_ACTION_TO_SERVICE[start_action]
    out[CONF_END_SERVICE] = ONOFF_ACTION_TO_SERVICE[end_action]
    out[CONF_START_DATA] = {}
    out[CONF_END_DATA] = {}
    return out


class ARSmartSchedulerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 6

    def __init__(self):
        self._name = None
        self._entity_ids = None
        self._device_type = None
        self._base_options = None

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            self._name = user_input[CONF_NAME]
            self._entity_ids = user_input[CONF_TARGET_ENTITY]

            chosen = user_input.get(CONF_DEVICE_TYPE, "auto")
            self._device_type = _detect_type(self._entity_ids) if chosen == "auto" else chosen

            ents = _normalize_entity_ids(self._entity_ids)
            first = ents[0] if ents else "none"

            await self.async_set_unique_id(f"{DOMAIN}:{first}:{self._name}")
            self._abort_if_unique_id_configured()

            self._base_options = {
                CONF_ENABLED: True,
                CONF_START: user_input.get(CONF_START, DEFAULT_START),
                CONF_END: user_input.get(CONF_END, DEFAULT_END),
                CONF_WEEKDAYS: user_input.get(CONF_WEEKDAYS, DEFAULT_WEEKDAYS),
            }
            return await self.async_step_actions()

        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default="Scheduler"): str,
                vol.Required(CONF_TARGET_ENTITY): selector.EntitySelector(
                    selector.EntitySelectorConfig(multiple=True)
                ),
                vol.Required(CONF_DEVICE_TYPE, default="auto"): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=DEVICE_TYPES)
                ),
                vol.Optional(CONF_START, default=DEFAULT_START): selector.TextSelector(),
                vol.Optional(CONF_END, default=DEFAULT_END): selector.TextSelector(),
                vol.Optional(CONF_WEEKDAYS, default=DEFAULT_WEEKDAYS): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=WEEKDAY_KEYS, multiple=True)
                ),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    async def async_step_actions(self, user_input=None):
        if user_input is not None:
            opts = dict(self._base_options or {})
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


class ARSmartSchedulerOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, entry):
        self._entry = entry
        self._device_type = None
        self._base = None

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self._base = dict(user_input)
            targets = self._entry.data.get(CONF_TARGET_ENTITY)
            self._device_type = _detect_type(targets)
            return await self.async_step_actions()

        opts = dict(self._entry.options or {})
        schema = vol.Schema(
            {
                vol.Required(CONF_ENABLED, default=bool(opts.get(CONF_ENABLED, True))): bool,
                vol.Required(CONF_START, default=opts.get(CONF_START, DEFAULT_START)): selector.TextSelector(),
                vol.Required(CONF_END, default=opts.get(CONF_END, DEFAULT_END)): selector.TextSelector(),
                vol.Required(CONF_WEEKDAYS, default=opts.get(CONF_WEEKDAYS, DEFAULT_WEEKDAYS)): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=WEEKDAY_KEYS, multiple=True)
                ),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)

    async def async_step_actions(self, user_input=None):
        opts_existing = dict(self._entry.options or {})

        if user_input is not None:
            out = dict(opts_existing)
            out.update(self._base or {})
            out.update(_resolve_action_options(self._device_type, user_input))
            return self.async_create_entry(title="", data=out)

        return self.async_show_form(
            step_id="actions",
            data_schema=_build_action_schema(self._device_type, opts_existing),
        )