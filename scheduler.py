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
)
from .util import (
    normalize_targets,
    parse_offset,
    parse_time_string,
    parse_trigger,
    weekday_indices_to_keys,
    weekday_keys_to_indices,
)


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

        self.state = State(
            enabled=True,
            start=dt.time(6, 0, 0),
            end=dt.time(18, 0, 0),
            start_trigger=DEFAULT_START_TRIGGER,
            end_trigger=DEFAULT_END_TRIGGER,
            start_offset=DEFAULT_START_OFFSET,
            end_offset=DEFAULT_END_OFFSET,
            second_enabled=DEFAULT_SECOND_ENABLED,
            second_start=parse_time_string(DEFAULT_SECOND_START, DEFAULT_SECOND_START),
            second_end=parse_time_string(DEFAULT_SECOND_END, DEFAULT_SECOND_END),
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
        return normalize_targets(self.entry.data.get(CONF_TARGET_ENTITY))

    @property
    def sun_available(self) -> bool:
        return self.hass.states.get(SUN_ENTITY_ID) is not None

    def build_state_snapshot(self) -> dict[str, Any]:
        return {
            "entry_id": self.entry.entry_id,
            "name": self.entry.data.get("name", self.entry.title),
            "enabled": self.state.enabled,
            "targets": list(self.targets),
            "weekdays": weekday_indices_to_keys(self.state.weekdays),
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
        self.state.start = parse_time_string(opts.get(CONF_START), DEFAULT_START)
        self.state.end = parse_time_string(opts.get(CONF_END), DEFAULT_END)
        self.state.start_trigger = parse_trigger(opts.get(CONF_START_TRIGGER), DEFAULT_START_TRIGGER)
        self.state.end_trigger = parse_trigger(opts.get(CONF_END_TRIGGER), DEFAULT_END_TRIGGER)
        self.state.start_offset = parse_offset(opts.get(CONF_START_OFFSET), DEFAULT_START_OFFSET)
        self.state.end_offset = parse_offset(opts.get(CONF_END_OFFSET), DEFAULT_END_OFFSET)
        self.state.second_enabled = bool(opts.get(CONF_SECOND_ENABLED, DEFAULT_SECOND_ENABLED))
        self.state.second_start = parse_time_string(opts.get(CONF_SECOND_START), DEFAULT_SECOND_START)
        self.state.second_end = parse_time_string(opts.get(CONF_SECOND_END), DEFAULT_SECOND_END)
        self.state.second_start_trigger = parse_trigger(
            opts.get(CONF_SECOND_START_TRIGGER), DEFAULT_SECOND_START_TRIGGER
        )
        self.state.second_end_trigger = parse_trigger(
            opts.get(CONF_SECOND_END_TRIGGER), DEFAULT_SECOND_END_TRIGGER
        )
        self.state.second_start_offset = parse_offset(
            opts.get(CONF_SECOND_START_OFFSET), DEFAULT_SECOND_START_OFFSET
        )
        self.state.second_end_offset = parse_offset(
            opts.get(CONF_SECOND_END_OFFSET), DEFAULT_SECOND_END_OFFSET
        )

        wk = opts.get(CONF_WEEKDAYS) or DEFAULT_WEEKDAYS
        self.state.weekdays = weekday_keys_to_indices(wk)
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
        if trigger in (TRIGGER_SUNRISE, TRIGGER_SUNSET):
            self._schedule_next_solar_track(which, trigger, offset_minutes, handler)
            return

        self._next_fire[which] = None
        self._solar_messages[which] = None
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
        triggers = [self.state.start_trigger, self.state.end_trigger]
        if self.state.second_enabled:
            triggers.extend([self.state.second_start_trigger, self.state.second_end_trigger])
        return any(trigger in (TRIGGER_SUNRISE, TRIGGER_SUNSET) for trigger in triggers)

    def _format_datetime(self, value: Optional[dt.datetime]) -> Optional[str]:
        if value is None:
            return None
        return dt_util.as_local(value).isoformat()

    def _resolve_next_solar_event(self, trigger: str, offset_minutes: int) -> tuple[Optional[dt.datetime], Optional[str]]:
        sun_state = self.hass.states.get(SUN_ENTITY_ID)
        if sun_state is None:
            return None, f"{SUN_ENTITY_ID} is unavailable"

        attr = "next_rising" if trigger == TRIGGER_SUNRISE else "next_setting"
        raw = sun_state.attributes.get(attr)
        if raw is None:
            return None, f"{SUN_ENTITY_ID} has no {attr} attribute"

        event_time = raw if isinstance(raw, dt.datetime) else dt_util.parse_datetime(str(raw))
        if event_time is None:
            return None, f"Could not parse {attr} from {SUN_ENTITY_ID}"

        event_time = dt_util.as_utc(event_time)
        scheduled = event_time + dt.timedelta(minutes=offset_minutes)
        if scheduled <= dt_util.utcnow():
            scheduled += dt.timedelta(days=1)

        return scheduled, None

    def _schedule_next_solar_track(self, which, trigger, offset_minutes, handler) -> None:
        unsub_attr = f"_unsub_{which}"
        existing = getattr(self, unsub_attr)
        if existing:
            existing()
            setattr(self, unsub_attr, None)

        scheduled, message = self._resolve_next_solar_event(trigger, offset_minutes)
        self._next_fire[which] = scheduled
        self._solar_messages[which] = message

        if scheduled is None:
            self.logger.warning("Unable to schedule %s trigger for %s: %s", trigger, which, message)
            return

        async def _run(now: dt.datetime) -> None:
            self._last_run[which] = now
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

        # sun.sun updates very frequently (azimuth/elevation change constantly).
        # Only react when the rise/set times we actually schedule against move.
        new_state = event.data.get("new_state")
        old_state = event.data.get("old_state")
        if new_state is not None and old_state is not None:
            if all(
                new_state.attributes.get(key) == old_state.attributes.get(key)
                for key in ("next_rising", "next_setting")
            ):
                return

        solar_tracks = [
            ("start", self.state.start_trigger, self.state.start_offset, self._handle_start),
            ("end", self.state.end_trigger, self.state.end_offset, self._handle_end),
        ]
        if self.state.second_enabled:
            solar_tracks.extend(
                [
                    ("start2", self.state.second_start_trigger, self.state.second_start_offset, self._handle_start2),
                    ("end2", self.state.second_end_trigger, self.state.second_end_offset, self._handle_end2),
                ]
            )

        changed = False
        for which, trigger, offset_minutes, handler in solar_tracks:
            if trigger not in (TRIGGER_SUNRISE, TRIGGER_SUNSET):
                continue
            previous = self._next_fire.get(which)
            previous_message = self._solar_messages.get(which)
            self._schedule_next_solar_track(which, trigger, offset_minutes, handler)
            if self._next_fire.get(which) != previous or self._solar_messages.get(which) != previous_message:
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

    async def _handle_start(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed():
            return
        await self._call_targets(self.state.start_service, self.state.start_data)

    async def _handle_end(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed():
            return
        await self._call_targets(self.state.end_service, self.state.end_data)

    async def _handle_start2(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed() or not self.state.second_enabled:
            return
        await self._call_targets(self.state.start_service, self.state.start_data)

    async def _handle_end2(self, now: dt.datetime) -> None:
        if not self.state.enabled or not self._today_allowed() or not self.state.second_enabled:
            return
        await self._call_targets(self.state.end_service, self.state.end_data)

    async def async_set_option(self, key: str, value: Any) -> None:
        options = dict(self.entry.options or {})
        options[key] = value
        self.hass.config_entries.async_update_entry(self.entry, options=options)
        await self.async_reload_from_entry()
