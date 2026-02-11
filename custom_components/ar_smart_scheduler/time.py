from __future__ import annotations

from datetime import time as dt_time

from homeassistant.components.time import TimeEntity
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, CONF_START, CONF_END, SIGNAL_UPDATED


async def async_setup_entry(hass, entry, async_add_entities):
    scheduler = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        SchedulerStartTime(entry, scheduler),
        SchedulerEndTime(entry, scheduler),
    ])


class _BaseTime(TimeEntity):
    should_poll = False
    _attr_has_entity_name = False

    def __init__(self, entry, scheduler):
        self.entry = entry
        self.scheduler = scheduler
        self._unsub = None

    async def async_added_to_hass(self):
        self._unsub = async_dispatcher_connect(
            self.hass, f"{SIGNAL_UPDATED}_{self.entry.entry_id}", self.async_write_ha_state
        )

    async def async_will_remove_from_hass(self):
        if self._unsub:
            self._unsub()
            self._unsub = None


class SchedulerStartTime(_BaseTime):
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, entry, scheduler):
        super().__init__(entry, scheduler)
        self._attr_name = f"{entry.title} Start Time"
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_start"

    @property
    def native_value(self):
        return self.scheduler.state.start

    async def async_set_value(self, value: dt_time):
        await self.scheduler.async_set_option(CONF_START, value.strftime("%H:%M:%S"))


class SchedulerEndTime(_BaseTime):
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, entry, scheduler):
        super().__init__(entry, scheduler)
        self._attr_name = f"{entry.title} End Time"
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_end"

    @property
    def native_value(self):
        return self.scheduler.state.end

    async def async_set_value(self, value: dt_time):
        await self.scheduler.async_set_option(CONF_END, value.strftime("%H:%M:%S"))
