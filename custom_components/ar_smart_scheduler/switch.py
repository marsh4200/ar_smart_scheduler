from __future__ import annotations

from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, CONF_ENABLED, CONF_WEEKDAYS, SIGNAL_UPDATED, WEEKDAY_MAP


async def async_setup_entry(hass, entry, async_add_entities):
    scheduler = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        SchedulerEnabledSwitch(entry, scheduler),
        WeekdaySwitch(entry, scheduler, "mon"),
        WeekdaySwitch(entry, scheduler, "tue"),
        WeekdaySwitch(entry, scheduler, "wed"),
        WeekdaySwitch(entry, scheduler, "thu"),
        WeekdaySwitch(entry, scheduler, "fri"),
        WeekdaySwitch(entry, scheduler, "sat"),
        WeekdaySwitch(entry, scheduler, "sun"),
    ])


class _BaseSwitch(SwitchEntity):
    should_poll = False
    _attr_has_entity_name = False

    def __init__(self, entry, scheduler):
        self.entry = entry
        self.scheduler = scheduler
        self._unsub = None

    async def async_added_to_hass(self):
        self._unsub = async_dispatcher_connect(
            self.hass,
            f"{SIGNAL_UPDATED}_{self.entry.entry_id}",
            self.async_write_ha_state,
        )

    async def async_will_remove_from_hass(self):
        if self._unsub:
            self._unsub()
            self._unsub = None


class SchedulerEnabledSwitch(_BaseSwitch):
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, entry, scheduler):
        super().__init__(entry, scheduler)
        self._attr_name = f"{entry.title} Schedule Enabled"
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_enabled"

    @property
    def is_on(self):
        return bool(self.scheduler.state.enabled)

    async def async_turn_on(self, **kwargs):
        await self.scheduler.async_set_option(CONF_ENABLED, True)

    async def async_turn_off(self, **kwargs):
        await self.scheduler.async_set_option(CONF_ENABLED, False)


class WeekdaySwitch(_BaseSwitch):
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, entry, scheduler, day: str):
        super().__init__(entry, scheduler)
        self.day = day
        self.day_num = WEEKDAY_MAP[day]
        self._attr_name = f"{entry.title} {day.upper()}"
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_{day}"

    @property
    def is_on(self):
        return self.day_num in self.scheduler.state.weekdays

    async def async_turn_on(self, **kwargs):
        days = set(self.scheduler.state.weekdays)
        days.add(self.day_num)
        await self.scheduler.async_set_option(
            CONF_WEEKDAYS,
            [k for k, v in WEEKDAY_MAP.items() if v in days],
        )

    async def async_turn_off(self, **kwargs):
        days = set(self.scheduler.state.weekdays)
        days.discard(self.day_num)
        await self.scheduler.async_set_option(
            CONF_WEEKDAYS,
            [k for k, v in WEEKDAY_MAP.items() if v in days],
        )
