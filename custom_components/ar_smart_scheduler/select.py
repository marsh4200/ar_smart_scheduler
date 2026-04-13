from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import EntityCategory

from .const import (
    CLIMATE_ACTIONS,
    CONF_CLIMATE_END_ACTION,
    CONF_CLIMATE_START_ACTION,
    CONF_END_TRIGGER,
    CONF_LOCK_END_ACTION,
    CONF_LOCK_START_ACTION,
    CONF_SECOND_END_TRIGGER,
    CONF_SECOND_START_TRIGGER,
    CONF_START_TRIGGER,
    CONF_WATER_HEATER_END_ACTION,
    CONF_WATER_HEATER_START_ACTION,
    DOMAIN,
    SIGNAL_END2_UPDATED,
    SIGNAL_END_UPDATED,
    SIGNAL_START2_UPDATED,
    SIGNAL_START_UPDATED,
    TRIGGER_TYPES,
    WATER_HEATER_ACTIONS,
)
from .runtime_actions import build_runtime_action_updates, detect_device_type


async def async_setup_entry(hass, entry, async_add_entities):
    scheduler = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            SchedulerTriggerSelect(entry, scheduler, "Start Trigger", f"{DOMAIN}_{entry.entry_id}_start_trigger", CONF_START_TRIGGER, SIGNAL_START_UPDATED),
            SchedulerTriggerSelect(entry, scheduler, "End Trigger", f"{DOMAIN}_{entry.entry_id}_end_trigger", CONF_END_TRIGGER, SIGNAL_END_UPDATED),
            SchedulerTriggerSelect(entry, scheduler, "Second Start Trigger", f"{DOMAIN}_{entry.entry_id}_second_start_trigger", CONF_SECOND_START_TRIGGER, SIGNAL_START2_UPDATED, second=True),
            SchedulerTriggerSelect(entry, scheduler, "Second End Trigger", f"{DOMAIN}_{entry.entry_id}_second_end_trigger", CONF_SECOND_END_TRIGGER, SIGNAL_END2_UPDATED, second=True),
            SchedulerActionSelect(entry, scheduler, "Start HVAC Action", f"{DOMAIN}_{entry.entry_id}_climate_start_action", CONF_CLIMATE_START_ACTION, CLIMATE_ACTIONS, ("climate",), SIGNAL_START_UPDATED),
            SchedulerActionSelect(entry, scheduler, "End HVAC Action", f"{DOMAIN}_{entry.entry_id}_climate_end_action", CONF_CLIMATE_END_ACTION, CLIMATE_ACTIONS, ("climate",), SIGNAL_END_UPDATED),
            SchedulerActionSelect(entry, scheduler, "Start Water Heater Action", f"{DOMAIN}_{entry.entry_id}_water_heater_start_action", CONF_WATER_HEATER_START_ACTION, WATER_HEATER_ACTIONS, ("water_heater",), SIGNAL_START_UPDATED),
            SchedulerActionSelect(entry, scheduler, "End Water Heater Action", f"{DOMAIN}_{entry.entry_id}_water_heater_end_action", CONF_WATER_HEATER_END_ACTION, WATER_HEATER_ACTIONS, ("water_heater",), SIGNAL_END_UPDATED),
        ]
    )


class SchedulerTriggerSelect(SelectEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_entity_category = EntityCategory.CONFIG
    _attr_options = TRIGGER_TYPES

    def __init__(self, entry, scheduler, name, unique_id, option_key, signal, second: bool = False):
        self.entry = entry
        self.scheduler = scheduler
        self._attr_name = name
        self._attr_unique_id = unique_id
        self._option_key = option_key
        self._signal = signal
        self._second = second
        self._unsub = None

    async def async_added_to_hass(self):
        self._unsub = async_dispatcher_connect(self.hass, f"{self._signal}_{self.entry.entry_id}", self.async_write_ha_state)

    async def async_will_remove_from_hass(self):
        if self._unsub:
            self._unsub()
            self._unsub = None

    @property
    def available(self):
        return not self._second or self.scheduler.state.second_enabled

    @property
    def current_option(self):
        return str(self.entry.options.get(self._option_key, "time"))

    async def async_select_option(self, option: str):
        if option not in TRIGGER_TYPES:
            return
        await self.scheduler.async_set_option(self._option_key, option)


class SchedulerActionSelect(SelectEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, entry, scheduler, name, unique_id, option_key, options, device_types, signal):
        self.entry = entry
        self.scheduler = scheduler
        self._attr_name = name
        self._attr_unique_id = unique_id
        self._attr_options = list(options)
        self._option_key = option_key
        self._device_types = device_types
        self._signal = signal
        self._unsub = None

    async def async_added_to_hass(self):
        self._unsub = async_dispatcher_connect(self.hass, f"{self._signal}_{self.entry.entry_id}", self.async_write_ha_state)

    async def async_will_remove_from_hass(self):
        if self._unsub:
            self._unsub()
            self._unsub = None

    @property
    def available(self):
        return detect_device_type(self.entry.options, self.entry.data) in self._device_types

    @property
    def current_option(self):
        return str(self.entry.options.get(self._option_key, self._attr_options[0]))

    async def async_select_option(self, option: str):
        if option not in self._attr_options:
            return
        updates = dict(self.entry.options or {})
        updates[self._option_key] = option
        updates.update(build_runtime_action_updates(updates, self.entry.data))
        await self.scheduler.async_update_options(updates)
