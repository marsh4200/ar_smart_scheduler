from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_NAME, DOMAIN, SIGNAL_UPDATED, TRIGGER_SUNRISE, TRIGGER_SUNSET


class ARSchedulerInfo(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
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

    @callback
    def _handle_update(self):
        self.async_write_ha_state()

    @property
    def native_value(self) -> str:
        return "enabled" if self.scheduler.state.enabled else "disabled"

    @property
    def extra_state_attributes(self):
        snapshot = self.scheduler.build_state_snapshot()
        start_status = self._status_for_trigger(snapshot["start_trigger"], snapshot["solar_messages"]["start"])
        end_status = self._status_for_trigger(snapshot["end_trigger"], snapshot["solar_messages"]["end"])
        second_start_status = self._status_for_trigger(
            snapshot["second_start_trigger"],
            snapshot["solar_messages"]["start2"],
            enabled=snapshot["second_enabled"],
        )
        second_end_status = self._status_for_trigger(
            snapshot["second_end_trigger"],
            snapshot["solar_messages"]["end2"],
            enabled=snapshot["second_enabled"],
        )
        return {
            "schedule_name": self.entry.data.get(CONF_NAME, self.entry.title),
            "target_entities": self.scheduler.targets,
            "target_count": len(self.scheduler.targets),
            "start_time": snapshot["start_time"],
            "end_time": snapshot["end_time"],
            "start_trigger": snapshot["start_trigger"],
            "end_trigger": snapshot["end_trigger"],
            "start_offset_minutes": snapshot["start_offset"],
            "end_offset_minutes": snapshot["end_offset"],
            "second_enabled": snapshot["second_enabled"],
            "second_start_time": snapshot["second_start_time"],
            "second_end_time": snapshot["second_end_time"],
            "second_start_trigger": snapshot["second_start_trigger"],
            "second_end_trigger": snapshot["second_end_trigger"],
            "second_start_offset_minutes": snapshot["second_start_offset"],
            "second_end_offset_minutes": snapshot["second_end_offset"],
            "weekdays": snapshot["weekdays"],
            "start_service": snapshot["start_service"],
            "end_service": snapshot["end_service"],
            "start_data": snapshot["start_data"],
            "end_data": snapshot["end_data"],
            "sun_entity_id": snapshot["sun_entity_id"],
            "sun_available": snapshot["sun_available"],
            "next_start_run": snapshot["next_fire"]["start"],
            "next_end_run": snapshot["next_fire"]["end"],
            "next_second_start_run": snapshot["next_fire"]["start2"],
            "next_second_end_run": snapshot["next_fire"]["end2"],
            "last_start_run": snapshot["last_run"]["start"],
            "last_end_run": snapshot["last_run"]["end"],
            "last_second_start_run": snapshot["last_run"]["start2"],
            "last_second_end_run": snapshot["last_run"]["end2"],
            "start_solar_status": start_status,
            "end_solar_status": end_status,
            "second_start_solar_status": second_start_status,
            "second_end_solar_status": second_end_status,
        }

    def _status_for_trigger(self, trigger: str, solar_message: str | None, *, enabled: bool = True) -> str:
        if not enabled:
            return "disabled"
        if trigger not in (TRIGGER_SUNRISE, TRIGGER_SUNSET):
            return "time_trigger"
        return solar_message or "scheduled"


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    scheduler = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([ARSchedulerInfo(entry, scheduler)])
