# AR Smart Scheduler

## 🙌 Credits  
**Developed by A R Smart Home Automation**

[![GitHub release](https://img.shields.io/github/v/release/marsh4200/ar_smart_scheduler.svg)](https://github.com/marsh4200/ar_smart_scheduler/releases)  
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/marsh4200/ar_smart_scheduler)  
[![Add to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](
https://my.home-assistant.io/redirect/hacs_repository/?owner=marsh4200&repository=ar_smart_scheduler&category=integration
)

---

## 🚀 Overview

A Home Assistant custom integration that lets you schedule any entity with:

- ⏰ Start & End times (time-based scheduling)  
- 🌅 Sunrise & Sunset triggers with adjustable offsets  
- 🔁 Dual daily schedules (run twice per day — morning & evening)  
- 📅 Selectable weekdays  
- 🔘 Enable / Disable toggle  

Perfect for lights, pumps, gates, garage doors, irrigation, and more.

⚡ Simple for clients. Powerful for installers.

> **📌 Merged repo:** the Lovelace card that used to live in the separate
> [`ar-scheduler-card`](https://github.com/marsh4200/ar-scheduler-card) repo
> is now built into this integration (see `custom_components/ar_smart_scheduler/frontend/`)
> and is fully configurable on its own — no more Settings → Devices &
> Services required to add, edit, or remove a schedule. See
> [PATCH_NOTES.md](PATCH_NOTES.md) for details and what to do with the old
> card repo.

---

## ✨ Features

- ⏰ Start & End time control  
- 🌅 Sunrise & Sunset with offsets (± minutes)  
- 🔁 Dual schedule windows  
- 📅 Weekday selection  
- 🔘 Enable / Disable per schedule  

- 🧠 Intelligent trigger system (time OR solar)  
- ⏱️ Offset control (before/after sun events)  
- 🔁 Auto re-scheduling with sun updates  

- 🧩 Works with any domain  
- 🎛️ Device-aware actions  
- ⚙️ Auto device detection  

- 📊 Live status:
  - Next run  
  - Last run  
  - Active window  

- 🖥️ Lovelace friendly  
- 🛠️ Installer focused  
- ⚡ Real-time updates  

---

## 📦 Installation (HACS)

1. Open HACS  
2. Go to Integrations  
3. Add Custom Repository  
4. Paste:
   https://github.com/marsh4200/ar_smart_scheduler  
5. Category: Integration  
6. Install & Restart  

---

## 🧰 Manual Installation

Copy:
custom_components/ar_smart_scheduler

To:
config/custom_components/ar_smart_scheduler

Restart Home Assistant.

---

## 🖥️ Lovelace Example

### 🔹 Default Entities Card

```yaml
type: entities
title: 🎮 Gaming Room Lights
entities:
  - entity: switch.gaming_lights_schedule_enabled
    name: Enable Schedule
  - entity: time.gaming_lights_start_time
    name: Start Time
  - entity: time.gaming_lights_end_time
    name: End Time
  - type: section
    label: Days
  - entity: switch.gaming_lights_mon
  - entity: switch.gaming_lights_tue
  - entity: switch.gaming_lights_wed
  - entity: switch.gaming_lights_thu
  - entity: switch.gaming_lights_fri
  - entity: switch.gaming_lights_sat
  - entity: switch.gaming_lights_sun
state_color: true
```

---

### 🚀 AR Smart Scheduler Card (Recommended — bundled, no install step)

This card ships inside the integration and registers itself automatically —
no HACS frontend entry, no `resources:` config. Just add it to a dashboard:

```yaml
type: custom:ar-smart-scheduler-card
title: Schedules            # optional
entry_id: <entry id>        # optional — show a single scheduler only
```

Everything is configurable straight from the card, so a client can set up
their own automations ("turn the pool pump off at sunset") without ever
opening Settings → Devices & Services:

- ➕ **Add schedule** — name it, pick the entities it controls (search box,
  any supported domain), choose start/end triggers, and create it on the
  spot.
- 🌅 **Tap-to-cycle triggers** — flip Start/End between time / sunrise /
  sunset, with ±5 min offset steppers for solar triggers.
- 📅 **Weekday chips**, 🔘 **enable toggle**, and an optional **second daily
  window**.
- ✏️ **Rename** a schedule inline, and add/remove target entities from a
  chip list.
- 🎛️ **Actions** — what happens at start/end (on/off, brightness, cover
  position, climate mode/temperature, water heater mode/temperature, lock
  state), matched to whatever the "Applies to" device profile is.
- 🗑️ **Remove** a schedule entirely, with a tap-to-confirm.

---

## 🧠 Notes

- 📅 Respects weekdays  
- ⚡ Instant updates  
- 👤 No admin access needed — any logged-in HA user can view *and* edit from the card. Give each client their own regular (non-admin) account rather than sharing your installer login; see [PATCH_NOTES.md](PATCH_NOTES.md) v1.5.2 for the access-control tradeoff.  
- 🎛️ Clean, fully self-service UI for clients  

---

## 🔥 In short

**AR Smart Scheduler makes scheduling simple, powerful, and client-friendly.**
