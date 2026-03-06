from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Optional, Set, Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_sunrise,
    async_track_sunset,
    async_track_time_change,
)
from homeassistant.util import dt as dt_util

from .const import (
    CONF_TARGET_ENTITY,
    CONF_WEEKDAYS,
    CONF_START,
    CONF_END,
    CONF_ENABLED,
    CONF_START_TRIGGER,
    CONF_END_TRIGGER,
    CONF_START_OFFSET,
    CONF_END_OFFSET,
    CONF_SECOND_ENABLED,
    CONF_SECOND_START,
    CONF_SECOND_END,
    CONF_SECOND_START_TRIGGER,
    CONF_SECOND_END_TRIGGER,
    CONF_SECOND_START_OFFSET,
    CONF_SECOND_END_OFFSET,
    CONF_START_SERVICE,
    CONF_END_SERVICE,
    CONF_START_DATA,
    CONF_END_DATA,
    DEFAULT_WEEKDAYS,
    DEFAULT_START,
    DEFAULT_END,
    DEFAULT_START_TRIGGER,
    DEFAULT_END_TRIGGER,
    DEFAULT_START_OFFSET,
    DEFAULT_END_OFFSET,
    DEFAULT_SECOND_ENABLED,
    DEFAULT_SECOND_START,
    DEFAULT_SECOND_END,
    DEFAULT_SECOND_START_TRIGGER,
    DEFAULT_SECOND_END_TRIGGER,
    DEFAULT_SECOND_START_OFFSET,
    DEFAULT_SECOND_END_OFFSET,
    DEFAULT_START_SERVICE,
    DEFAULT_END_SERVICE,
    DEFAULT_START_DATA,
    DEFAULT_END_DATA,
    TRIGGER_TIME,
    TRIGGER_SUNRISE,
    TRIGGER_SUNSET,
    TRIGGER_TYPES,
    WEEKDAY_MAP,
    SIGNAL_UPDATED,
    SIGNAL_START_UPDATED,
    SIGNAL_END_UPDATED,
    SIGNAL_START2_UPDATED,
    SIGNAL_END2_UPDATED,
)


def _parse_time(value: str | None, fallback: str) -> dt.time:
    try:
        parts = str(value or fallback).split(":")
        hh = int(parts[0])
        mm = int(parts[1]) if len(parts) > 1 else 0
        ss = int(parts[2]) if len(parts) > 2 else 0
        return dt.time(hour=hh, minute=mm, second=ss)
    except Exception:
        parts = fallback.split(":")
        return dt.time(int(parts[0]), int(parts[1]), int(parts[2]))


def _parse_trigger(value: str | None, fallback: str) -> str:
    trigger = str(value or fallback)
    return trigger if trigger in TRIGGER_TYPES else fallback


def _parse_offset(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return fallback


@dataclass
class State:
    enabled: bool
    start: dt.time
    end: dt.time
    start_trigger: str
    end_trigger: str
    start_offset: int
    end_offset: int
    second_enabled: bool
    second_start: dt.time
    second_end: dt.time
    second_start_trigger: str
    second_end_trigger: str
    second_start_offset: int
    second_end_offset: int
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
        self._unsub_start2: Optional[callable] = None
        self._unsub_end2: Optional[callable] = None

        self.state = State(
            enabled=True,
            start=dt.time(6, 0, 0),
            end=dt.time(18, 0, 0),
            start_trigger=DEFAULT_START_TRIGGER,
            end_trigger=DEFAULT_END_TRIGGER,
            start_offset=DEFAULT_START_OFFSET,
            end_offset=DEFAULT_END_OFFSET,
            second_enabled=DEFAULT_SECOND_ENABLED,
            second_start=_parse_time(DEFAULT_SECOND_START, DEFAULT_SECOND_START),
            second_end=_parse_time(DEFAULT_SECOND_END, DEFAULT_SECOND_END),
            second_start_trigger=DEFAULT_SECOND_START_TRIGGER,
            second_end_trigger=DEFAULT_SECOND_END_TRIGGER,
            second_start_offset=DEFAULT_SECOND_START_OFFSET,
            second_end_offset=DEFAULT_SECOND_END_OFFSET,
            weekdays=set(range(7)),
            start_service=DEFAULT_START_SERVICE,
            end_service=DEFAULT_END_SERVICE,
            start_data=dict(DEFAULT_START_DATA),
            end_data=dict(DEFAULT_END_DATA),
        )

        self._load()

    def _load(self) -> None:
        opts = dict(self.entry.options or {})

        # ---- MIGRATION SAFETY ----
        opts.setdefault(CONF_START_TRIGGER, DEFAULT_START_TRIGGER)
        opts.setdefault(CONF_END_TRIGGER, DEFAULT_END_TRIGGER)
        opts.setdefault(CONF_START_OFFSET, DEFAULT_START_OFFSET)
        opts.setdefault(CONF_END_OFFSET, DEFAULT_END_OFFSET)

        opts.setdefault(CONF_SECOND_ENABLED, DEFAULT_SECOND_ENABLED)
        opts.setdefault(CONF_SECOND_START, DEFAULT_SECOND_START)
        opts.setdefault(CONF_SECOND_END, DEFAULT_SECOND_END)

        opts.setdefault(CONF_SECOND_START_TRIGGER, DEFAULT_SECOND_START_TRIGGER)
        opts.setdefault(CONF_SECOND_END_TRIGGER, DEFAULT_SECOND_END_TRIGGER)
        opts.setdefault(CONF_SECOND_START_OFFSET, DEFAULT_SECOND_START_OFFSET)
        opts.setdefault(CONF_SECOND_END_OFFSET, DEFAULT_SECOND_END_OFFSET)

        self.state.enabled = bool(opts.get(CONF_ENABLED, True))

        self.state.start = _parse_time(opts.get(CONF_START), DEFAULT_START)
        self.state.end = _parse_time(opts.get(CONF_END), DEFAULT_END)

        self.state.start_trigger = _parse_trigger(opts.get(CONF_START_TRIGGER), DEFAULT_START_TRIGGER)
        self.state.end_trigger = _parse_trigger(opts.get(CONF_END_TRIGGER), DEFAULT_END_TRIGGER)

        self.state.start_offset = _parse_offset(opts.get(CONF_START_OFFSET), DEFAULT_START_OFFSET)
        self.state.end_offset = _parse_offset(opts.get(CONF_END_OFFSET), DEFAULT_END_OFFSET)

        self.state.second_enabled = bool(opts.get(CONF_SECOND_ENABLED, DEFAULT_SECOND_ENABLED))

        self.state.second_start = _parse_time(opts.get(CONF_SECOND_START), DEFAULT_SECOND_START)
        self.state.second_end = _parse_time(opts.get(CONF_SECOND_END), DEFAULT_SECOND_END)

        self.state.second_start_trigger = _parse_trigger(
            opts.get(CONF_SECOND_START_TRIGGER), DEFAULT_SECOND_START_TRIGGER
        )
        self.state.second_end_trigger = _parse_trigger(
            opts.get(CONF_SECOND_END_TRIGGER), DEFAULT_SECOND_END_TRIGGER
        )

        self.state.second_start_offset = _parse_offset(
            opts.get(CONF_SECOND_START_OFFSET), DEFAULT_SECOND_START_OFFSET
        )
        self.state.second_end_offset = _parse_offset(
            opts.get(CONF_SECOND_END_OFFSET), DEFAULT_SECOND_END_OFFSET
        )

        wk = opts.get(CONF_WEEKDAYS) or DEFAULT_WEEKDAYS
        self.state.weekdays = {WEEKDAY_MAP[w] for w in wk if w in WEEKDAY_MAP}

        self.state.start_service = str(opts.get(CONF_START_SERVICE, DEFAULT_START_SERVICE))
        self.state.end_service = str(opts.get(CONF_END_SERVICE, DEFAULT_END_SERVICE))

        sd = opts.get(CONF_START_DATA, DEFAULT_START_DATA)
        ed = opts.get(CONF_END_DATA, DEFAULT_END_DATA)

        self.state.start_data = dict(sd) if isinstance(sd, dict) else {}
        self.state.end_data = dict(ed) if isinstance(ed, dict) else {}

    async def async_start(self) -> None:
        self._setup_tracks()

    async def async_stop(self) -> None:
        self._remove_tracks()

    def _remove_tracks(self) -> None:
        for attr in ("_unsub_start", "_unsub_end", "_unsub_start2", "_unsub_end2"):
            unsub = getattr(self, attr)
            if unsub:
                unsub()
                setattr(self, attr, None)

    def _setup_tracks(self) -> None:
        self._remove_tracks()

        if not self.state.enabled:
            return

        self._setup_single_track(
            "start",
            self.state.start_trigger,
            self.state.start,
            self.state.start_offset,
            self._handle_start,
        )

        self._setup_single_track(
            "end",
            self.state.end_trigger,
            self.state.end,
            self.state.end_offset,
            self._handle_end,
        )

        if self.state.second_enabled:

            self._setup_single_track(
                "start2",
                self.state.second_start_trigger,
                self.state.second_start,
                self.state.second_start_offset,
                self._handle_start2,
            )

            self._setup_single_track(
                "end2",
                self.state.second_end_trigger,
                self.state.second_end,
                self.state.second_end_offset,
                self._handle_end2,
            )

    def _setup_single_track(self, which, trigger, when, offset_minutes, handler):

        unsub_attr = f"_unsub_{which}"

        if trigger == TRIGGER_SUNRISE:

            setattr(
                self,
                unsub_attr,
                async_track_sunrise(
                    self.hass,
                    handler,
                    offset=dt.timedelta(minutes=offset_minutes),
                ),
            )
            return

        if trigger == TRIGGER_SUNSET:

            setattr(
                self,
                unsub_attr,
                async_track_sunset(
                    self.hass,
                    handler,
                    offset=dt.timedelta(minutes=offset_minutes),
                ),
            )
            return

        setattr(
            self,
            unsub_attr,
            async_track_time_change(
                self.hass,
                handler,
                hour=when.hour,
                minute=when.minute,
                second=when.second,
            ),
        )

    def _today_allowed(self) -> bool:
        if not self.state.weekdays:
            return False
        now = dt_util.now()
        return now.weekday() in self.state.weekdays

    async def _call_targets(self, service: str, data: dict[str, Any]) -> None:

        targets = self.entry.data.get(CONF_TARGET_ENTITY)

        if isinstance(targets, str):
            targets = [targets]

        if not targets:
            return

        if "." in service:
            domain, service = service.split(".", 1)

        by_domain: dict[str, list[str]] = {}

        for ent in targets:
            domain = ent.split(".", 1)[0]
            by_domain.setdefault(domain, []).append(ent)

        for domain, entity_ids in by_domain.items():

            payload = dict(data or {})
            payload["entity_id"] = entity_ids

            await self.hass.services.async_call(
                domain,
                service,
                payload,
                blocking=False,
            )

    @callback
    async def _handle_start(self, now: dt.datetime):

        if not self.state.enabled or not self._today_allowed():
            return

        await self._call_targets(self.state.start_service, self.state.start_data)

    @callback
    async def _handle_end(self, now: dt.datetime):

        if not self.state.enabled or not self._today_allowed():
            return

        await self._call_targets(self.state.end_service, self.state.end_data)

    @callback
    async def _handle_start2(self, now: dt.datetime):

        if not self.state.enabled or not self._today_allowed() or not self.state.second_enabled:
            return

        await self._call_targets(self.state.start_service, self.state.start_data)

    @callback
    async def _handle_end2(self, now: dt.datetime):

        if not self.state.enabled or not self._today_allowed() or not self.state.second_enabled:
            return

        await self._call_targets(self.state.end_service, self.state.end_data)