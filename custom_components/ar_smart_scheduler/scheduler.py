from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Optional, Set

from homeassistant.core import HomeAssistant, callback
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import (
    CONF_TARGET_ENTITY, CONF_WEEKDAYS, CONF_START, CONF_END, CONF_ENABLED,
    DEFAULT_WEEKDAYS, DEFAULT_START, DEFAULT_END, WEEKDAY_MAP, SIGNAL_UPDATED
)

def _parse_time(value: str, fallback: str) -> dt.time:
    try:
        parts = str(value or fallback).split(":")
        hh = int(parts[0])
        mm = int(parts[1]) if len(parts) > 1 else 0
        ss = int(parts[2]) if len(parts) > 2 else 0
        return dt.time(hour=hh, minute=mm, second=ss)
    except Exception:
        parts = fallback.split(":")
        return dt.time(int(parts[0]), int(parts[1]), int(parts[2]))

@dataclass
class State:
    enabled: bool
    start: dt.time
    end: dt.time
    weekdays: Set[int]

class ARScheduler:
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self._unsub_start: Optional[callable] = None
        self._unsub_end: Optional[callable] = None
        self.state = State(True, dt.time(6, 0, 0), dt.time(18, 0, 0), set(range(7)))
        self._load()

    def _load(self) -> None:
        opts = self.entry.options or {}
        self.state.enabled = bool(opts.get(CONF_ENABLED, True))
        self.state.start = _parse_time(opts.get(CONF_START), DEFAULT_START)
        self.state.end = _parse_time(opts.get(CONF_END), DEFAULT_END)
        wk = opts.get(CONF_WEEKDAYS, DEFAULT_WEEKDAYS)
        self.state.weekdays = {WEEKDAY_MAP[w] for w in wk if w in WEEKDAY_MAP}

    async def async_start(self) -> None:
        self._setup_tracks()

    async def async_stop(self) -> None:
        self._remove_tracks()

    async def async_reload_from_entry(self) -> None:
        # Used when options flow or config entry reloads
        self._load()
        self._setup_tracks()
        async_dispatcher_send(self.hass, f"{SIGNAL_UPDATED}_{self.entry.entry_id}")

    async def async_set_option(self, key: str, value):
        opts = dict(self.entry.options or {})
        opts[key] = value
        self.hass.config_entries.async_update_entry(self.entry, options=opts)

        # 🔧 FIX: do not nuke and reload everything (this caused the time copying bug)
        self._load()
        self._setup_tracks()

        # Update entities cleanly
        async_dispatcher_send(self.hass, f"{SIGNAL_UPDATED}_{self.entry.entry_id}")

    def _remove_tracks(self) -> None:
        if self._unsub_start:
            self._unsub_start()
            self._unsub_start = None
        if self._unsub_end:
            self._unsub_end()
            self._unsub_end = None

    def _setup_tracks(self) -> None:
        self._remove_tracks()
        st, et = self.state.start, self.state.end
        self._unsub_start = async_track_time_change(
            self.hass, self._handle_start, hour=st.hour, minute=st.minute, second=st.second
        )
        self._unsub_end = async_track_time_change(
            self.hass, self._handle_end, hour=et.hour, minute=et.minute, second=et.second
        )

    def _today_allowed(self) -> bool:
        now = dt_util.now()
        return now.weekday() in (self.state.weekdays or set(range(7)))

    async def _call_target(self, service: str) -> None:
        targets = self.entry.data.get(CONF_TARGET_ENTITY)

        # Backwards compatibility
        if isinstance(targets, str):
            targets = [targets]

        if not targets:
            return

        by_domain = {}
        for ent in targets:
            domain = ent.split(".", 1)[0]
            by_domain.setdefault(domain, []).append(ent)

        for domain, entity_ids in by_domain.items():
            await self.hass.services.async_call(
                domain,
                service,
                {"entity_id": entity_ids},
                blocking=False,
            )

    @callback
    async def _handle_start(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed():
            return
        await self._call_target("turn_on")

    @callback
    async def _handle_end(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed():
            return
        await self._call_target("turn_off")