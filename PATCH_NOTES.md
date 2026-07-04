# AR Smart Scheduler v1.4.0 — Patch Notes

## THE MIGRATION BUG (why schedulers broke after restart)

`config_flow.py` declared `VERSION = 2`, but `async_migrate_entry` in `__init__.py`
migrates entries up to **version 3**. Sequence:

1. New entry created at version 2
2. Next HA restart: migration bumps it to version 3
3. HA now sees entry version 3 > flow version 2 → **"Migration error"**, entry refuses to load

**Fix:** flow `VERSION = 3`. Entries already stuck at v3 will load again immediately
after this update — no manual repair needed. v1/v2 entries still migrate up normally.

## Other bug fixes

- **number/select platforms were broken dead code** — they imported ~20 constants that
  did not exist in `const.py` and called a `scheduler.async_update_options()` that didn't
  exist. They never crashed HA only because they weren't in `PLATFORMS`. All constants
  added, method added, platforms now enabled.
- **Info sensor showed null next/last run for time triggers** — `next_fire` is now
  computed for fixed-time triggers (weekday-aware) and `last_run` is recorded on every
  fire (previously only the solar path recorded it, and it recorded even on skipped
  weekdays — also fixed).
- **Timer churn on sun updates** — `sun.sun` changes state frequently; every update tore
  down and recreated all solar timers. Now reschedules only when the resolved sunrise/
  sunset time actually moved.
- **Wrong `@callback` on async handlers** removed (fragile — relies on HassJob checking
  coroutine-ness before the callback flag).
- **Unload order** — scheduler was popped from `hass.data` *before* platforms unloaded;
  now platforms unload first, and unload failure no longer strands the scheduler.
- **Options flow wiped offsets** when a trigger was set to "time" (offset silently reset
  to 0). Offsets now preserved.
- **`already_configured` / `required` errors had no translations** — the flow returns them
  as form errors but only an `abort` translation existed. Added.
- **manifest.json** — added `dependencies: ["http", "frontend", "websocket_api"]`
  (websocket_api was used without being declared). Version bumped to 1.4.0.
- **websocket `set_options`** — now `@require_admin`, and trigger values are validated
  against `TRIGGER_TYPES` instead of accepting any string.
- Temperature number entities: unit fixed from "C" to "°C".

## New features

- **Bundled Lovelace card** — the integration now serves and auto-registers
  `ar-smart-scheduler-card.js` (no HACS frontend install, no resource config).
  Add to any dashboard:

      type: custom:ar-smart-scheduler-card
      title: Schedules          # optional
      entry_id: <entry id>      # optional, show one scheduler only

  Per scheduler: enable toggle, weekday chips, tap-to-cycle trigger (time/sunrise/sunset),
  inline time pickers, ±5 min offset steppers, second-window toggle, next-run display,
  target entity chips. Dark/light theme aware. New `ar_smart_scheduler/list` websocket
  command backs it.
- **Number + select platforms enabled** — offsets, triggers, and climate/water-heater/lock
  actions are now real entities (usable in automations, voice assistants, dashboards).
- **Water heater (geyser) profile** — set_operation_mode / set_temperature actions,
  30–80°C range.
- **Lock profile** — e.g. unlock at window start, lock at window end.
- **More supported domains** — fan, water_heater, lock, input_boolean added.
- Config flow now stores the raw action choices (not just resolved services), so the
  options flow and the new select/number entities always show the real current values —
  including for entries created before this update (reverse-engineered from services).

## Files in this patch (upload via GitHub web UI, mirrors repo structure)

    custom_components/ar_smart_scheduler/__init__.py
    custom_components/ar_smart_scheduler/config_flow.py
    custom_components/ar_smart_scheduler/const.py
    custom_components/ar_smart_scheduler/manifest.json
    custom_components/ar_smart_scheduler/number.py
    custom_components/ar_smart_scheduler/scheduler.py
    custom_components/ar_smart_scheduler/select.py
    custom_components/ar_smart_scheduler/websocket.py
    custom_components/ar_smart_scheduler/translations/en.json
    custom_components/ar_smart_scheduler/frontend/ar-smart-scheduler-card.js   (NEW)

Unchanged: sensor.py, switch.py, time.py, runtime_actions.py, hacs.json.

## IMPORTANT — delete these stale duplicates from the REPO ROOT

These are old copies that differ from the real files in custom_components/ and are the
source of the "mixed-file install" crashes noted in your own const.py comment. Delete
via GitHub web UI (open file → bin icon → commit):

    __init__.py          config_flow.py      const.py
    entity.py            manifest.json       scheduler.py
    sensor.py            strings.json        switch.py
    time.py              translations/       util.py
    websocket.py

(Everything at root except: README.md, hacs.json, .github/, custom_components/)

## After updating

Restart HA once. Entries stuck on "Migration error" load again. Hard-refresh the browser
(Ctrl+Shift+R) once so the new card JS is picked up.
