from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Optional, Set, Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import (
    CONF_TARGET_ENTITY,
    CONF_WEEKDAYS,
    CONF_START,
    CONF_END,
    CONF_ENABLED,
    CONF_SECOND_ENABLED,
    CONF_SECOND_START,
    CONF_SECOND_END,
    CONF_START_SERVICE,
    CONF_END_SERVICE,
    CONF_START_DATA,
    CONF_END_DATA,
    DEFAULT_WEEKDAYS,
    DEFAULT_START,
    DEFAULT_END,
    DEFAULT_SECOND_ENABLED,
    DEFAULT_SECOND_START,
    DEFAULT_SECOND_END,
    DEFAULT_START_SERVICE,
    DEFAULT_END_SERVICE,
    DEFAULT_START_DATA,
    DEFAULT_END_DATA,
    WEEKDAY_MAP,
    SIGNAL_UPDATED,
    SIGNAL_START_UPDATED,
    SIGNAL_END_UPDATED,
    SIGNAL_START2_UPDATED,
    SIGNAL_END2_UPDATED,
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

    # NEW: 2nd daily window
    second_enabled: bool
    second_start: dt.time
    second_end: dt.time

    weekdays: Set[int]
    start_service: str
    end_service: str
    start_data: dict[str, Any]
    end_data: dict[str, Any]


class ARScheduler:
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry

        self._unsub_start: Optional[callable] = None
        self._unsub_end: Optional[callable] = None

        # NEW: second window unsubscribers
        self._unsub_start2: Optional[callable] = None
        self._unsub_end2: Optional[callable] = None

        self.state = State(
            enabled=True,
            start=dt.time(6, 0, 0),
            end=dt.time(18, 0, 0),

            second_enabled=DEFAULT_SECOND_ENABLED,
            second_start=_parse_time(DEFAULT_SECOND_START, DEFAULT_SECOND_START),
            second_end=_parse_time(DEFAULT_SECOND_END, DEFAULT_SECOND_END),

            weekdays=set(range(7)),
            start_service=DEFAULT_START_SERVICE,
            end_service=DEFAULT_END_SERVICE,
            start_data=dict(DEFAULT_START_DATA),
            end_data=dict(DEFAULT_END_DATA),
        )
        self._load()

    def _load(self) -> None:
        opts = self.entry.options or {}

        self.state.enabled = bool(opts.get(CONF_ENABLED, True))
        self.state.start = _parse_time(opts.get(CONF_START), DEFAULT_START)
        self.state.end = _parse_time(opts.get(CONF_END), DEFAULT_END)

        # NEW: load second window
        self.state.second_enabled = bool(opts.get(CONF_SECOND_ENABLED, DEFAULT_SECOND_ENABLED))
        self.state.second_start = _parse_time(opts.get(CONF_SECOND_START), DEFAULT_SECOND_START)
        self.state.second_end = _parse_time(opts.get(CONF_SECOND_END), DEFAULT_SECOND_END)

        wk = opts.get(CONF_WEEKDAYS, DEFAULT_WEEKDAYS)
        self.state.weekdays = {WEEKDAY_MAP[w] for w in wk if w in WEEKDAY_MAP}
        # NOTE: do NOT fall back to all days when empty

        self.state.start_service = str(opts.get(CONF_START_SERVICE, DEFAULT_START_SERVICE) or DEFAULT_START_SERVICE)
        self.state.end_service = str(opts.get(CONF_END_SERVICE, DEFAULT_END_SERVICE) or DEFAULT_END_SERVICE)

        sd = opts.get(CONF_START_DATA, DEFAULT_START_DATA)
        ed = opts.get(CONF_END_DATA, DEFAULT_END_DATA)
        self.state.start_data = dict(sd) if isinstance(sd, dict) else {}
        self.state.end_data = dict(ed) if isinstance(ed, dict) else {}

    async def async_start(self) -> None:
        self._setup_tracks()

    async def async_stop(self) -> None:
        self._remove_tracks()

    async def async_reload_from_entry(self) -> None:
        self._load()
        self._setup_tracks()
        async_dispatcher_send(self.hass, f"{SIGNAL_UPDATED}_{self.entry.entry_id}")
        async_dispatcher_send(self.hass, f"{SIGNAL_START_UPDATED}_{self.entry.entry_id}")
        async_dispatcher_send(self.hass, f"{SIGNAL_END_UPDATED}_{self.entry.entry_id}")
        # NEW signals
        async_dispatcher_send(self.hass, f"{SIGNAL_START2_UPDATED}_{self.entry.entry_id}")
        async_dispatcher_send(self.hass, f"{SIGNAL_END2_UPDATED}_{self.entry.entry_id}")

    async def async_set_option(self, key: str, value):
        opts = dict(self.entry.options or {})
        opts[key] = value
        self.hass.config_entries.async_update_entry(self.entry, options=opts)

        self._load()
        self._setup_tracks()

        async_dispatcher_send(self.hass, f"{SIGNAL_UPDATED}_{self.entry.entry_id}")

        if key == CONF_START:
            async_dispatcher_send(self.hass, f"{SIGNAL_START_UPDATED}_{self.entry.entry_id}")
        elif key == CONF_END:
            async_dispatcher_send(self.hass, f"{SIGNAL_END_UPDATED}_{self.entry.entry_id}")
        elif key in (CONF_SECOND_ENABLED, CONF_SECOND_START):
            async_dispatcher_send(self.hass, f"{SIGNAL_START2_UPDATED}_{self.entry.entry_id}")
        elif key == CONF_SECOND_END:
            async_dispatcher_send(self.hass, f"{SIGNAL_END2_UPDATED}_{self.entry.entry_id}")

    def _remove_tracks(self) -> None:
        if self._unsub_start:
            self._unsub_start()
            self._unsub_start = None
        if self._unsub_end:
            self._unsub_end()
            self._unsub_end = None

        # NEW: remove second window tracks
        if self._unsub_start2:
            self._unsub_start2()
            self._unsub_start2 = None
        if self._unsub_end2:
            self._unsub_end2()
            self._unsub_end2 = None

    def _setup_tracks(self) -> None:
        self._remove_tracks()

        st, et = self.state.start, self.state.end
        self._unsub_start = async_track_time_change(
            self.hass, self._handle_start, hour=st.hour, minute=st.minute, second=st.second
        )
        self._unsub_end = async_track_time_change(
            self.hass, self._handle_end, hour=et.hour, minute=et.minute, second=et.second
        )

        # NEW: second window tracks (only if enabled)
        if self.state.second_enabled:
            st2, et2 = self.state.second_start, self.state.second_end
            self._unsub_start2 = async_track_time_change(
                self.hass, self._handle_start2, hour=st2.hour, minute=st2.minute, second=st2.second
            )
            self._unsub_end2 = async_track_time_change(
                self.hass, self._handle_end2, hour=et2.hour, minute=et2.minute, second=et2.second
            )

    def _today_allowed(self) -> bool:
        # ✅ FIX: if no weekdays selected, scheduler must not run
        if not self.state.weekdays:
            return False

        now = dt_util.now()
        return now.weekday() in self.state.weekdays

    async def _call_targets(self, service: str, data: dict[str, Any]) -> None:
        targets = self.entry.data.get(CONF_TARGET_ENTITY)

        # Backwards compatibility
        if isinstance(targets, str):
            targets = [targets]

        if not targets:
            return

        by_domain: dict[str, list[str]] = {}
        for ent in targets:
            domain = ent.split(".", 1)[0]
            by_domain.setdefault(domain, []).append(ent)

        for domain, entity_ids in by_domain.items():
            payload = dict(data or {})
            payload["entity_id"] = entity_ids
            await self.hass.services.async_call(domain, service, payload, blocking=False)

    @callback
    async def _handle_start(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed():
            return
        await self._call_targets(self.state.start_service, self.state.start_data)

    @callback
    async def _handle_end(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed():
            return
        await self._call_targets(self.state.end_service, self.state.end_data)

    # NEW: second window handlers
    @callback
    async def _handle_start2(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed() or not self.state.second_enabled:
            return
        await self._call_targets(self.state.start_service, self.state.start_data)

    @callback
    async def _handle_end2(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed() or not self.state.second_enabled:
            return
        await self._call_targets(self.state.end_service, self.state.end_data)