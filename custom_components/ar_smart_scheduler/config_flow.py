from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector

from .const import (
    DOMAIN, CONF_NAME, CONF_TARGET_ENTITY, CONF_WEEKDAYS, CONF_START, CONF_END,
    DEFAULT_WEEKDAYS, DEFAULT_START, DEFAULT_END, WEEKDAY_KEYS
)

class ARSmartSchedulerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            await self.async_set_unique_id(f"{DOMAIN}:{user_input[CONF_TARGET_ENTITY]}")
            self._abort_if_unique_id_configured()
            data = {
                CONF_NAME: user_input[CONF_NAME],
                CONF_TARGET_ENTITY: user_input[CONF_TARGET_ENTITY],
            }
            options = {
                CONF_START: user_input.get(CONF_START, DEFAULT_START),
                CONF_END: user_input.get(CONF_END, DEFAULT_END),
                CONF_WEEKDAYS: user_input.get(CONF_WEEKDAYS, DEFAULT_WEEKDAYS),
                "enabled": True,
            }
            return self.async_create_entry(title=user_input[CONF_NAME], data=data, options=options)

        schema = vol.Schema({
            vol.Required(CONF_NAME, default="Scheduler"): str,

            # ✅ ONLY CHANGE: allow selecting MULTIPLE entities
            vol.Required(CONF_TARGET_ENTITY): selector.EntitySelector(
                selector.EntitySelectorConfig(multiple=True)
            ),

            vol.Optional(CONF_START, default=DEFAULT_START): selector.TextSelector(),
            vol.Optional(CONF_END, default=DEFAULT_END): selector.TextSelector(),
            vol.Optional(CONF_WEEKDAYS, default=DEFAULT_WEEKDAYS): selector.SelectSelector(
                selector.SelectSelectorConfig(options=WEEKDAY_KEYS, multiple=True)
            ),
        })
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    def async_get_options_flow(config_entry):
        return ARSmartSchedulerOptionsFlow(config_entry)

class ARSmartSchedulerOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        opts = dict(self.config_entry.options or {})
        schema = vol.Schema({
            vol.Required("enabled", default=bool(opts.get("enabled", True))): bool,
            vol.Required(CONF_START, default=opts.get(CONF_START, DEFAULT_START)): selector.TextSelector(),
            vol.Required(CONF_END, default=opts.get(CONF_END, DEFAULT_END)): selector.TextSelector(),
            vol.Required(CONF_WEEKDAYS, default=opts.get(CONF_WEEKDAYS, DEFAULT_WEEKDAYS)): selector.SelectSelector(
                selector.SelectSelectorConfig(options=WEEKDAY_KEYS, multiple=True)
            ),
        })
        return self.async_show_form(step_id="init", data_schema=schema)
