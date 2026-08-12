# AR Smart Scheduler v1.5.0 — Patch Notes

## Repo merge: `ar-scheduler-card` is now part of this integration

The standalone `ar-scheduler-card` repo (the older `sensor.*_info`-attribute
based card, `type: custom:ar-scheduler-card`) is superseded by the card this
integration already bundles at
`custom_components/ar_smart_scheduler/frontend/ar-smart-scheduler-card.js`
(`type: custom:ar-smart-scheduler-card`). There is no reason to install both.

**What to do with the old `ar-scheduler-card` repo:** archive it on GitHub
(Settings → General → Archive this repository) and, if it's installed via
HACS on any existing site, remove it there too — the bundled card fully
replaces it and needs no separate install. If any dashboard still uses
`type: custom:ar-scheduler-card`, swap it for `type: custom:ar-smart-scheduler-card`
(config keys differ slightly — see the README's Lovelace example).

## New: the card is now fully self-service — no wizard required

Previously, adding a new schedule required Settings → Devices & Services →
Add Integration → the multi-step config flow wizard, and only an admin
account could do it. The card can now do the whole job itself:

- **Add schedule** — a client can tap "+ Add schedule" on the card, name it,
  search-select the entities it should control, pick a device/action
  profile, set the initial trigger types and weekdays, and create it in one
  step. Behind the scenes this reuses the exact same validation and
  defaulting code the wizard uses (`config_flow.py`'s new `async_step_card`),
  just triggered over a websocket command (`ar_smart_scheduler/create`)
  instead of a form.
- **Rename** a schedule inline (tap the name).
- **Retarget entities** — add or remove which entities a schedule controls,
  and change its device/action profile ("Applies to"), from a new "Entities"
  section in the expanded card (`ar_smart_scheduler/set_general`).
- **Edit actions** — what happens at start/end (on/off, brightness, cover
  position, climate mode + temperature, water heater mode + temperature,
  lock state) is now editable directly on the card, matching whatever the
  number/select entities and options-flow "Actions" step already exposed,
  via the new `ar_smart_scheduler/set_actions` websocket command.
- **Remove schedule** — tap-to-confirm delete, right on the card
  (`ar_smart_scheduler/delete`).

All of the above are `@require_admin` websocket commands, same as the
existing `set_options` command — a client's dashboard-only account can still
view everything, and configuring is limited to accounts with admin rights,
exactly like the Settings wizard already was. Nothing here loosens who can
change what; it just moves *where* they do it.

### Backend refactor behind this

- `config_flow.py`'s per-step helper methods (`_prepare_general`,
  `_prepare_schedule`, `_prepare_schedule_details`, `_prepare_second_window`,
  `_prepare_second_window_details`, and the duplicate-name/entities check)
  were pure functions already — they're now module-level functions the
  class methods delegate to, so `websocket.py` can reuse the identical
  validation/defaulting logic instead of re-implementing it. Behavior is
  unchanged for the existing Settings wizard.
- `runtime_actions.py` gained `has_unsupported_entities()` and
  `action_snapshot()` (the raw, unresolved per-device action config — start
  action/position/brightness/temperature, end action/position/brightness/
  temperature — as opposed to `build_runtime_action_updates()`, which
  resolves to the actual HA service + data HA will call).
- `scheduler.py`'s `build_state_snapshot()` (what backs
  `ar_smart_scheduler/list`, and therefore the card) now also includes
  `device_type`, `device_type_setting`, and `actions`, so the card can render
  the right action controls without a second round trip.
- `SUPPORTED_ENTITY_DOMAINS` moved from `config_flow.py` to `const.py` so
  both the config flow and the websocket API validate against the same list
  — and `ar_smart_scheduler/list` now also returns `domains` and
  `device_types` so the card's own entity picker and "Applies to" dropdown
  never drift out of sync with what the backend actually accepts.

---

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
