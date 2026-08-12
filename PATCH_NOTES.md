# AR Smart Scheduler v1.5.4 — Patch Notes

## Fix: entity picker dropdown still not showing on some phones (round 2)

v1.5.3 replaced the native `<datalist>` with a custom dropdown, which fixed
it for most cases - but it was still built as a normal in-page element
(opens in document flow, directly under the "+ add entity" field). That has
two remaining failure modes on mobile that match "no dropdown appears,
tapping does something funny":

- **The on-screen keyboard covers it.** The keyboard eats roughly the
  bottom 40-50% of the screen. If the field you tapped is anywhere in the
  lower half of the page, the dropdown - rendered directly below that field
  - opens up right behind the keyboard. It's technically there, just never
  visible.
- **A dashboard layout can clip it.** Some card layouts (grid/section-based
  dashboards in particular) constrain a card's height or overflow. Content
  that grows past that boundary - like a dropdown popping open below a
  field near the bottom of a card - can get cut off entirely instead of
  pushing the card taller.

**Fix:** the dropdown is now a floating overlay, positioned in JavaScript
from the tapped field's actual on-screen coordinates, instead of sitting in
the normal page layout. Concretely:

- It always renders **above the on-screen keyboard**, because it's
  positioned relative to the visible viewport, not the full page.
- If there isn't room to open it below the field (too close to the bottom
  of the screen/keyboard), it **opens upward** above the field instead.
- It can no longer be **clipped by a card or dashboard container**, since
  it's no longer inside that container's normal flow.
- It re-positions itself automatically if the page scrolls or the visible
  viewport resizes (which is exactly what happens when the keyboard
  animates open/closed).

Verified with a real (non-simulated) mobile-viewport browser test - not
just the logic-level test used before - covering: a field near the bottom
of a long scrolled page, and the viewport shrinking to simulate the
keyboard opening. In both cases the dropdown stayed fully visible and
correctly positioned.

## New: on-screen version marker

The card now shows a small `v1.5.4`-style marker next to its title. This
release has now shipped the same-looking fix twice ("no dropdown" was
reported again after v1.5.3's rewrite) - part of ruling out what's actually
happening if it's ever reported a third time is confirming the *browser* is
actually running the new file at all, versus an old cached copy (browser
cache, or - especially relevant for the Companion App - its own webview
cache). If a "no dropdown" report comes with a screenshot showing an old
version number here, that's a caching problem, not a code problem, and
points straight at "fully close and reopen the Companion App" or clearing
its cache rather than another code change.

No backend changes in this release - frontend (`ar-smart-scheduler-card.js`)
only.

---

# AR Smart Scheduler v1.5.3 — Patch Notes

## Fix: entity picker didn't work on mobile

The "+ add entity…" field used a native `<input list="...">` / `<datalist>`
for suggestions. That's unreliable on mobile: iOS Safari essentially never
shows `<datalist>` suggestions at all (tapping the field just does nothing
visible), and Android renders them as unstyled browser-native chrome that
doesn't match the card and can look broken inside a shadow root — which
matches exactly what was reported ("no drop down... all messed up").

Replaced it with a fully custom, self-built dropdown (search input +
touch-sized rows, same on every platform):

- Tapping the field opens a dropdown of matching entities immediately
  (capped to a short list until you start typing).
- Typing filters it live.
- Tapping a row adds that entity — same as before.
- Tapping anywhere outside the field/dropdown closes it.

Also bumped all text inputs (entity search, schedule name, rename field) to
`font-size: 16px` — anything smaller makes iOS Safari auto-zoom the whole
page in when you tap the field, which is a common second cause of "mobile
looks messed up" once the first issue is fixed.

No backend changes in this release — frontend (`ar-smart-scheduler-card.js`)
only.

---

# AR Smart Scheduler v1.5.2 — Patch Notes

## Clients no longer need an admin account to use the card

`ar_smart_scheduler/set_options`, `create`, `delete`, `set_general`, and
`set_actions` are no longer `@require_admin`. Previously a client using a
restricted (non-admin) HA account could view schedules on the card but
every edit — even the enable toggle — silently failed, because the
websocket API rejected the call before it reached the handler.

This was already the stated intent (the README has always said "No admin
access needed"), so this just makes the code match it.

**Tradeoff, so you can decide if it's right for each install:** any HA user
account that can authenticate a websocket connection and load the dashboard
can now fully create, edit, and delete schedules — and, by extension,
control whatever entity a schedule targets (including locks and gates, if
you've set one up for those). This is no looser than what the card already
let a non-admin *view*; it just means viewing and editing now require the
same thing: a logged-in HA user, not an admin one.

**Recommended setup:** give each client their own regular (non-admin) HA
user for their dashboard, rather than sharing your installer/admin login.
That was already good practice before this change, but it matters more now
since that account can reconfigure automations, not just watch them.

If a particular install has a device you don't want a client account to be
able to touch even via schedule reconfiguration (e.g. a gate lock), keep
that device out of the entities `ar_smart_scheduler` is allowed to target
for that client's account, or don't expose the card to that account at all.

---

# AR Smart Scheduler v1.5.1 — Patch Notes

## Fix: setup crash — `'Schema' object has no attribute 'validators'`

v1.5.0 crashed on startup with:

```
Error during setup of component ar_smart_scheduler: 'Schema' object has no attribute 'validators'
File ".../websocket_api/decorators.py", line 142, in websocket_command
    command = schema.validators[0].schema["type"]
```

`websocket_api.websocket_command()` only accepts a plain `dict`, or a
`vol.All(...)` whose first item is the `vol.Schema` — it reaches into
`schema.validators[0]` to read the command's `"type"` and to `.extend()` the
base `{id: ...}` message schema. The new `ar_smart_scheduler/create` and
`ar_smart_scheduler/set_actions` commands needed `extra=vol.ALLOW_EXTRA`
(their field set varies per device type), so they were registered with a
bare `vol.Schema({...}, extra=vol.ALLOW_EXTRA)` — which has no `.validators`
attribute and crashed integration setup entirely (every entity from this
integration went unavailable). Fixed by wrapping both in `vol.All(...)`,
verified against Home Assistant's actual `websocket_command()` source and
voluptuous's `Schema.extend()` (which inherits `extra` from the schema being
extended, so `ALLOW_EXTRA` survives). No config or data changes — just
update and restart.

---

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
