from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

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
        self._unsub = async_dispatcher_connect(
            self.hass,
            f"{SIGNAL_UPDATED}_{self.entry.entry_id}",
            self._handle_update,
        )

    async def async_will_remove_from_hass(self):
        if self._unsub:
            self._unsub()
            self._unsub = None

    def _handle_update(self):
        self.async_write_ha_state()

    @property
    def native_value(self) -> str:
        return "enabled" if self.scheduler.state.enabled else "disabled"

    @property
    def extra_state_attributes(self):
        return {
            "target_entities": self.entry.data.get(CONF_TARGET_ENTITY),
            "start_time": self.scheduler.state.start.strftime("%H:%M:%S"),
            "end_time": self.scheduler.state.end.strftime("%H:%M:%S"),
            "start_trigger": self.scheduler.state.start_trigger,
            "end_trigger": self.scheduler.state.end_trigger,
            "start_offset_minutes": self.scheduler.state.start_offset,
            "end_offset_minutes": self.scheduler.state.end_offset,
            "second_enabled": self.scheduler.state.second_enabled,
            "second_start_time": self.scheduler.state.second_start.strftime("%H:%M:%S"),
            "second_end_time": self.scheduler.state.second_end.strftime("%H:%M:%S"),
            "second_start_trigger": self.scheduler.state.second_start_trigger,
            "second_end_trigger": self.scheduler.state.second_end_trigger,
            "second_start_offset_minutes": self.scheduler.state.second_start_offset,
            "second_end_offset_minutes": self.scheduler.state.second_end_offset,
            "weekdays": sorted(list(self.entry.options.get("weekdays", []))),
            "start_service": self.scheduler.state.start_service,
            "end_service": self.scheduler.state.end_service,
            "start_data": self.scheduler.state.start_data,
            "end_data": self.scheduler.state.end_data,
        }


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    scheduler = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([ARSchedulerInfo(entry, scheduler)])
