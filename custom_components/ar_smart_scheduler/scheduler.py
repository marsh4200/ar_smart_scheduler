from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass
from typing import Any, Optional, Set

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
)
from homeassistant.util import dt as dt_util

from .const import (
    CONF_ENABLED,
    CONF_END,
    CONF_END_DATA,
    CONF_END_OFFSET,
    CONF_END_SERVICE,
    CONF_END_TRIGGER,
    CONF_SECOND_ENABLED,
    CONF_SECOND_END,
    CONF_SECOND_END_OFFSET,
    CONF_SECOND_END_TRIGGER,
    CONF_SECOND_START,
    CONF_SECOND_START_OFFSET,
    CONF_SECOND_START_TRIGGER,
    CONF_START,
    CONF_START_DATA,
    CONF_START_OFFSET,
    CONF_START_SERVICE,
    CONF_START_TRIGGER,
    CONF_TARGET_ENTITY,
    CONF_WEEKDAYS,
    DEFAULT_END,
    DEFAULT_END_DATA,
    DEFAULT_END_OFFSET,
    DEFAULT_END_SERVICE,
    DEFAULT_END_TRIGGER,
    DEFAULT_SECOND_ENABLED,
    DEFAULT_SECOND_END,
    DEFAULT_SECOND_END_OFFSET,
    DEFAULT_SECOND_END_TRIGGER,
    DEFAULT_SECOND_START,
    DEFAULT_SECOND_START_OFFSET,
    DEFAULT_SECOND_START_TRIGGER,
    DEFAULT_START,
    DEFAULT_START_DATA,
    DEFAULT_START_OFFSET,
    DEFAULT_START_SERVICE,
    DEFAULT_START_TRIGGER,
    DEFAULT_WEEKDAYS,
    SIGNAL_END2_UPDATED,
    SIGNAL_END_UPDATED,
    SIGNAL_START2_UPDATED,
    SIGNAL_START_UPDATED,
    SIGNAL_UPDATED,
    SUN_ENTITY_ID,
    TRIGGER_SUNRISE,
    TRIGGER_SUNSET,
    TRIGGER_TIME,
    TRIGGER_TYPES,
    WEEKDAY_KEYS,
    WEEKDAY_MAP,
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


def _normalize_targets(targets) -> list[str]:
    if not targets:
        return []
    if isinstance(targets, str):
        return [targets]
    return [target for target in targets if isinstance(target, str)]


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
        self.logger = logging.getLogger(__name__).getChild(entry.entry_id)

        self._unsub_start: Optional[callable] = None
        self._unsub_end: Optional[callable] = None
        self._unsub_start2: Optional[callable] = None
        self._unsub_end2: Optional[callable] = None
        self._unsub_sun_state: Optional[callable] = None

        self._next_fire: dict[str, Optional[dt.datetime]] = {
            "start": None,
            "end": None,
            "start2": None,
            "end2": None,
        }
        self._last_run: dict[str, Optional[dt.datetime]] = {
            "start": None,
            "end": None,
            "start2": None,
            "end2": None,
        }
        self._solar_messages: dict[str, Optional[str]] = {
            "start": None,
            "end": None,
            "start2": None,
            "end2": None,
        }
        # Raw solar event time (before offset) each pending fire was derived
        # from. Needed so sun.sun updates can tell a *moved* event apart from
        # the attribute simply rolling over to tomorrow's event while a
        # positive-offset fire for today's event is still pending.
        self._solar_base: dict[str, Optional[dt.datetime]] = {
            "start": None,
            "end": None,
            "start2": None,
            "end2": None,
        }

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

    @property
    def targets(self) -> list[str]:
        return _normalize_targets(self.entry.data.get(CONF_TARGET_ENTITY))

    @property
    def sun_available(self) -> bool:
        return self.hass.states.get(SUN_ENTITY_ID) is not None

    def build_state_snapshot(self) -> dict[str, Any]:
        return {
            "entry_id": self.entry.entry_id,
            "name": self.entry.data.get("name", self.entry.title),
            "enabled": self.state.enabled,
            "targets": list(self.targets),
            "weekdays": [WEEKDAY_KEYS[index] for index in sorted(self.state.weekdays)],
            "start_time": self.state.start.strftime("%H:%M:%S"),
            "end_time": self.state.end.strftime("%H:%M:%S"),
            "start_trigger": self.state.start_trigger,
            "end_trigger": self.state.end_trigger,
            "start_offset": self.state.start_offset,
            "end_offset": self.state.end_offset,
            "second_enabled": self.state.second_enabled,
            "second_start_time": self.state.second_start.strftime("%H:%M:%S"),
            "second_end_time": self.state.second_end.strftime("%H:%M:%S"),
            "second_start_trigger": self.state.second_start_trigger,
            "second_end_trigger": self.state.second_end_trigger,
            "second_start_offset": self.state.second_start_offset,
            "second_end_offset": self.state.second_end_offset,
            "start_service": self.state.start_service,
            "end_service": self.state.end_service,
            "start_data": dict(self.state.start_data),
            "end_data": dict(self.state.end_data),
            "sun_entity_id": SUN_ENTITY_ID,
            "sun_available": self.sun_available,
            "next_fire": {key: self._format_datetime(value) for key, value in self._next_fire.items()},
            "last_run": {key: self._format_datetime(value) for key, value in self._last_run.items()},
            "solar_messages": dict(self._solar_messages),
        }

    def _load(self) -> None:
        opts = dict(self.entry.options or {})

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

    async def async_reload_from_entry(self) -> None:
        self._load()
        self._setup_tracks()
        self._dispatch_updates()

    def _remove_tracks(self) -> None:
        for attr in ("_unsub_start", "_unsub_end", "_unsub_start2", "_unsub_end2", "_unsub_sun_state"):
            unsub = getattr(self, attr)
            if unsub:
                unsub()
                setattr(self, attr, None)

        for key in self._next_fire:
            self._next_fire[key] = None
            self._solar_messages[key] = None
            self._solar_base[key] = None

    def _track_definitions(self) -> list[tuple[str, str, dt.time, int]]:
        """(which, trigger, time, offset) for every active track."""
        tracks = [
            ("start", self.state.start_trigger, self.state.start, self.state.start_offset),
            ("end", self.state.end_trigger, self.state.end, self.state.end_offset),
        ]
        if self.state.second_enabled:
            tracks.extend(
                [
                    ("start2", self.state.second_start_trigger, self.state.second_start, self.state.second_start_offset),
                    ("end2", self.state.second_end_trigger, self.state.second_end, self.state.second_end_offset),
                ]
            )
        return tracks

    def _handler_for(self, which: str):
        return {
            "start": self._handle_start,
            "end": self._handle_end,
            "start2": self._handle_start2,
            "end2": self._handle_end2,
        }[which]

    def _setup_tracks(self) -> None:
        self._remove_tracks()

        if not self.state.enabled:
            return

        if self._uses_solar_triggers():
            self._unsub_sun_state = async_track_state_change_event(
                self.hass,
                SUN_ENTITY_ID,
                self._handle_sun_state_change,
            )

        for which, trigger, when, offset in self._track_definitions():
            self._setup_single_track(which, trigger, when, offset, self._handler_for(which))

    def _setup_single_track(self, which, trigger, when, offset_minutes, handler):
        unsub_attr = f"_unsub_{which}"
        if trigger in (TRIGGER_SUNRISE, TRIGGER_SUNSET):
            self._schedule_next_solar_track(which, trigger, offset_minutes, handler)
            return

        self._next_fire[which] = self._compute_next_time_fire(when)
        self._solar_messages[which] = None
        self._solar_base[which] = None
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

    def _compute_next_time_fire(self, when: dt.time) -> Optional[dt.datetime]:
        """Next local occurrence of a fixed time, honouring the weekday mask."""
        if not self.state.weekdays:
            return None

        now = dt_util.now()
        for day_delta in range(8):
            candidate_date = (now + dt.timedelta(days=day_delta)).date()
            candidate = dt.datetime.combine(candidate_date, when, tzinfo=now.tzinfo)
            if candidate <= now:
                continue
            if candidate.weekday() in self.state.weekdays:
                return dt_util.as_utc(candidate)
        return None

    def _dispatch_updates(self) -> None:
        for signal in (
            SIGNAL_UPDATED,
            SIGNAL_START_UPDATED,
            SIGNAL_END_UPDATED,
            SIGNAL_START2_UPDATED,
            SIGNAL_END2_UPDATED,
        ):
            async_dispatcher_send(self.hass, f"{signal}_{self.entry.entry_id}")

    def _uses_solar_triggers(self) -> bool:
        return any(
            trigger in (TRIGGER_SUNRISE, TRIGGER_SUNSET)
            for _, trigger, _, _ in self._track_definitions()
        )

    def _format_datetime(self, value: Optional[dt.datetime]) -> Optional[str]:
        if value is None:
            return None
        return dt_util.as_local(value).isoformat()

    def _resolve_next_solar_event(
        self, trigger: str, offset_minutes: int
    ) -> tuple[Optional[dt.datetime], Optional[dt.datetime], Optional[str]]:
        """Return (scheduled_fire, base_event, message) for a solar trigger."""
        sun_state = self.hass.states.get(SUN_ENTITY_ID)
        if sun_state is None:
            return None, None, f"{SUN_ENTITY_ID} is unavailable"

        attr = "next_rising" if trigger == TRIGGER_SUNRISE else "next_setting"
        raw = sun_state.attributes.get(attr)
        if raw is None:
            return None, None, f"{SUN_ENTITY_ID} has no {attr} attribute"

        event_time = raw if isinstance(raw, dt.datetime) else dt_util.parse_datetime(str(raw))
        if event_time is None:
            return None, None, f"Could not parse {attr} from {SUN_ENTITY_ID}"

        event_time = dt_util.as_utc(event_time)
        scheduled = event_time + dt.timedelta(minutes=offset_minutes)
        if scheduled <= dt_util.utcnow():
            # Negative offset (or exact-instant race) puts the fire in the
            # past even though the event itself is the next one. Approximate
            # tomorrow's event; the sun.sun state listener corrects this to
            # the exact time once the attribute rolls over.
            scheduled += dt.timedelta(days=1)
            event_time += dt.timedelta(days=1)

        return scheduled, event_time, None

    def _schedule_next_solar_track(self, which, trigger, offset_minutes, handler) -> None:
        unsub_attr = f"_unsub_{which}"
        existing = getattr(self, unsub_attr)
        if existing:
            existing()
            setattr(self, unsub_attr, None)

        scheduled, base_event, message = self._resolve_next_solar_event(trigger, offset_minutes)
        self._next_fire[which] = scheduled
        self._solar_base[which] = base_event
        self._solar_messages[which] = message

        if scheduled is None:
            self.logger.warning("Unable to schedule %s trigger for %s: %s", trigger, which, message)
            return

        async def _run(now: dt.datetime) -> None:
            await handler(now)
            self._schedule_next_solar_track(which, trigger, offset_minutes, handler)
            self._dispatch_updates()

        setattr(
            self,
            unsub_attr,
            async_track_point_in_utc_time(self.hass, _run, scheduled),
        )

    @callback
    def _handle_sun_state_change(self, event) -> None:
        if not self.state.enabled:
            return

        changed = False
        now_utc = dt_util.utcnow()
        for which, trigger, _, offset_minutes in self._track_definitions():
            if trigger not in (TRIGGER_SUNRISE, TRIGGER_SUNSET):
                continue

            pending = self._next_fire.get(which)
            base = self._solar_base.get(which)

            # NEVER cancel a timer that is due right now / overdue — it is in
            # the middle of firing and will reschedule itself. sun.sun rolls
            # its next_rising/next_setting attribute over at the exact moment
            # of the event, so this handler races the trigger timer; losing
            # that race used to cancel the fire entirely.
            if pending is not None and pending <= now_utc:
                continue

            # A pending fire whose base event has already passed is the tail
            # of a positive offset (e.g. sunset +15 min, sunset was 5 min
            # ago). sun.sun now reports TOMORROW's event — that is not a
            # moved event, so leave today's pending fire alone. It will
            # reschedule from fresh data after it fires.
            if pending is not None and base is not None and base <= now_utc:
                continue

            # Only reschedule when the resolved solar time actually moved.
            # sun.sun updates its state frequently; tearing down and
            # recreating timers on every update is wasteful.
            scheduled, _base_event, message = self._resolve_next_solar_event(trigger, offset_minutes)
            if scheduled == pending and message == self._solar_messages.get(which):
                continue

            self._schedule_next_solar_track(which, trigger, offset_minutes, self._handler_for(which))
            changed = True

        if changed:
            self._dispatch_updates()

    def _today_allowed(self) -> bool:
        if not self.state.weekdays:
            return False
        now = dt_util.now()
        return now.weekday() in self.state.weekdays

    async def _call_targets(self, service: str, data: dict[str, Any]) -> None:
        targets = self.targets
        if not targets:
            return

        if "." in service:
            domain, service = service.split(".", 1)
        else:
            domain = None

        by_domain: dict[str, list[str]] = {}
        for ent in targets:
            ent_domain = ent.split(".", 1)[0]
            by_domain.setdefault(ent_domain, []).append(ent)

        for ent_domain, entity_ids in by_domain.items():
            payload = dict(data or {})
            payload["entity_id"] = entity_ids
            await self.hass.services.async_call(
                domain or ent_domain,
                service,
                payload,
                blocking=False,
            )

    async def _async_fire(self, which: str) -> None:
        if not self.state.enabled:
            return
        if which in ("start2", "end2") and not self.state.second_enabled:
            return

        if self._today_allowed():
            if which in ("start", "start2"):
                await self._call_targets(self.state.start_service, self.state.start_data)
            else:
                await self._call_targets(self.state.end_service, self.state.end_data)
            self._last_run[which] = dt_util.utcnow()

        # Keep the "next run" info fresh for fixed-time triggers.
        # Solar triggers recompute in _schedule_next_solar_track.
        for track_which, trigger, when, _ in self._track_definitions():
            if track_which == which and trigger == TRIGGER_TIME:
                self._next_fire[which] = self._compute_next_time_fire(when)

        self._dispatch_updates()

    async def _handle_start(self, now: dt.datetime) -> None:
        await self._async_fire("start")

    async def _handle_end(self, now: dt.datetime) -> None:
        await self._async_fire("end")

    async def _handle_start2(self, now: dt.datetime) -> None:
        await self._async_fire("start2")

    async def _handle_end2(self, now: dt.datetime) -> None:
        await self._async_fire("end2")

    async def async_set_option(self, key: str, value: Any) -> None:
        options = dict(self.entry.options or {})
        options[key] = value
        self.hass.config_entries.async_update_entry(self.entry, options=options)
        await self.async_reload_from_entry()

    async def async_update_options(self, options: dict[str, Any]) -> None:
        """Replace the config entry options wholesale and reload."""
        self.hass.config_entries.async_update_entry(self.entry, options=dict(options))
        await self.async_reload_from_entry()
