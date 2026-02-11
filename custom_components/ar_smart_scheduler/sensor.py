from __future__ import annotations

import datetime as dt
from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, CONF_TARGET_ENTITY, SIGNAL_UPDATED

class ARSchedulerInfo(SensorEntity):
    _attr_has_entity_name = True
    _attr_icon = "mdi:information-outline"

    def __init__(self, entry: ConfigEntry, scheduler) -> None:
        self.entry = entry
        self.scheduler = scheduler
        self._attr_name = "Info"
        self._attr_unique_id = f"{entry.entry_id}_info"
        self._unsub = None

    async def async_added_to_hass(self):
        self._unsub = async_dispatcher_connect(self.hass, f"{SIGNAL_UPDATED}_{self.entry.entry_id}", self._handle_update)

    async def async_will_remove_from_hass(self):
        if self._unsub:
            self._unsub(); self._unsub=None

    def _handle_update(self):
        self.async_write_ha_state()

    @property
    def native_value(self) -> str:
        return "enabled" if self.scheduler.state.enabled else "disabled"

    @property
    def extra_state_attributes(self):
        return {
            "target_entity": self.entry.data.get(CONF_TARGET_ENTITY),
            "start_time": f"{self.scheduler.state.start.hour:02d}:{self.scheduler.state.start.minute:02d}:{self.scheduler.state.start.second:02d}",
            "end_time": f"{self.scheduler.state.end.hour:02d}:{self.scheduler.state.end.minute:02d}:{self.scheduler.state.end.second:02d}",
            "weekdays": sorted(list(self.entry.options.get("weekdays", []))),
        }

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    scheduler = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([ARSchedulerInfo(entry, scheduler)])
