from __future__ import annotations

from homeassistant.components.number import NumberEntity
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import EntityCategory

from .const import (
    CONF_CLIMATE_END_TEMPERATURE,
    CONF_CLIMATE_START_TEMPERATURE,
    CONF_END_OFFSET,
    CONF_SECOND_END_OFFSET,
    CONF_SECOND_START_OFFSET,
    CONF_START_OFFSET,
    CONF_WATER_HEATER_END_TEMPERATURE,
    CONF_WATER_HEATER_START_TEMPERATURE,
    DOMAIN,
    SIGNAL_END2_UPDATED,
    SIGNAL_END_UPDATED,
    SIGNAL_START2_UPDATED,
    SIGNAL_START_UPDATED,
)
from .runtime_actions import build_runtime_action_updates, detect_device_type


async def async_setup_entry(hass, entry, async_add_entities):
    scheduler = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            SchedulerOffsetNumber(entry, scheduler, "Start Offset", f"{DOMAIN}_{entry.entry_id}_start_offset", CONF_START_OFFSET, SIGNAL_START_UPDATED),
            SchedulerOffsetNumber(entry, scheduler, "End Offset", f"{DOMAIN}_{entry.entry_id}_end_offset", CONF_END_OFFSET, SIGNAL_END_UPDATED),
            SchedulerOffsetNumber(entry, scheduler, "Second Start Offset", f"{DOMAIN}_{entry.entry_id}_second_start_offset", CONF_SECOND_START_OFFSET, SIGNAL_START2_UPDATED, second=True),
            SchedulerOffsetNumber(entry, scheduler, "Second End Offset", f"{DOMAIN}_{entry.entry_id}_second_end_offset", CONF_SECOND_END_OFFSET, SIGNAL_END2_UPDATED, second=True),
            SchedulerActionNumber(entry, scheduler, "Start HVAC Temperature", f"{DOMAIN}_{entry.entry_id}_climate_start_temperature", CONF_CLIMATE_START_TEMPERATURE, 8, 35, SIGNAL_START_UPDATED, ("climate",)),
            SchedulerActionNumber(entry, scheduler, "End HVAC Temperature", f"{DOMAIN}_{entry.entry_id}_climate_end_temperature", CONF_CLIMATE_END_TEMPERATURE, 8, 35, SIGNAL_END_UPDATED, ("climate",)),
            SchedulerActionNumber(entry, scheduler, "Start Water Heater Temperature", f"{DOMAIN}_{entry.entry_id}_water_heater_start_temperature", CONF_WATER_HEATER_START_TEMPERATURE, 30, 80, SIGNAL_START_UPDATED, ("water_heater",)),
            SchedulerActionNumber(entry, scheduler, "End Water Heater Temperature", f"{DOMAIN}_{entry.entry_id}_water_heater_end_temperature", CONF_WATER_HEATER_END_TEMPERATURE, 30, 80, SIGNAL_END_UPDATED, ("water_heater",)),
        ]
    )


class SchedulerOffsetNumber(NumberEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_entity_category = EntityCategory.CONFIG
    _attr_native_min_value = -180
    _attr_native_max_value = 180
    _attr_native_step = 1
    _attr_native_unit_of_measurement = "min"

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
        if self._second and not self.scheduler.state.second_enabled:
            return False
        trigger = (
            self.scheduler.state.second_start_trigger if self._option_key == CONF_SECOND_START_OFFSET else
            self.scheduler.state.second_end_trigger if self._option_key == CONF_SECOND_END_OFFSET else
            self.scheduler.state.start_trigger if self._option_key == CONF_START_OFFSET else
            self.scheduler.state.end_trigger
        )
        return trigger != "time"

    @property
    def native_value(self):
        return float(self.entry.options.get(self._option_key, 0))

    async def async_set_native_value(self, value: float):
        await self.scheduler.async_set_option(self._option_key, int(value))


class SchedulerActionNumber(NumberEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_entity_category = EntityCategory.CONFIG
    _attr_native_step = 1
    _attr_native_unit_of_measurement = "°C"

    def __init__(self, entry, scheduler, name, unique_id, option_key, min_value, max_value, signal, device_types):
        self.entry = entry
        self.scheduler = scheduler
        self._attr_name = name
        self._attr_unique_id = unique_id
        self._option_key = option_key
        self._attr_native_min_value = min_value
        self._attr_native_max_value = max_value
        self._signal = signal
        self._device_types = device_types
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
    def native_value(self):
        return float(self.entry.options.get(self._option_key, self._attr_native_min_value))

    async def async_set_native_value(self, value: float):
        updates = dict(self.entry.options or {})
        updates[self._option_key] = int(value)
        updates.update(build_runtime_action_updates(updates, self.entry.data))
        await self.scheduler.async_update_options(updates)
