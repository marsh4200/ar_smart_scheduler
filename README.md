# AR Smart Scheduler
## 🙌 Credits  
**Developed by A R Smart Home Automation**

[![GitHub release](https://img.shields.io/github/v/release/marsh4200/ar_smart_scheduler.svg)](https://github.com/marsh4200/ar_smart_scheduler/releases)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/marsh4200/ar_smart_scheduler)


[![Add to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](
  https://my.home-assistant.io/redirect/hacs_repository/?owner=marsh4200&repository=ar_smart_scheduler&category=integration
)



[![HACS](https://img.shields.io/badge/HACS-Custom-blue.svg)](https://hacs.xyz)

A powerful Home Assistant custom integration that lets you schedule any entity with:

- ⏰ Start & End times (time-based scheduling)
- 🌅 Sunrise & Sunset triggers with adjustable offsets
- 🔁 Dual daily schedules (run twice per day — e.g. morning & evening)
- 📅 Selectable weekdays  
- 🔘 Enable / Disable toggle  

Built for real-world automation:

- 🧠 Intelligent trigger system (time OR solar-based)
- ⏱️ Offset control (run before/after sunrise or sunset)
- 🧩 Works with any domain (lights, switches, covers, climate, media players, etc.)
- 🎛️ Device-aware actions (brightness, temperature, position control)
- ⚙️ Auto-detects device type for easy setup

Perfect for lights, pumps, gates, garage doors, irrigation, and more — built with installers in mind so customers can safely adjust schedules from the dashboard without needing admin access.

⚡ Simple for clients.
---

## ✨ Features

- ⏰ Start & End time control (time-based scheduling)
- 🌅 Sunrise & Sunset triggers with adjustable offsets (± minutes)
- 🔁 Dual schedule windows (run twice per day — morning & evening)
- 📅 Selectable weekdays (Mon–Sun switches)
- 🔘 Enable / Disable schedule per automation

- ⏱️ Smart offsets for solar events (before/after sunrise/sunset)
- 🧠 Intelligent trigger system (time OR solar-based scheduling)
- 🔁 Automatic re-scheduling when sun times update

- 🧩 Works with any domain (light, switch, cover, climate, media_player, etc.)
- 🎛️ Device-aware actions (brightness, temperature, position, etc.)
- ⚙️ Auto device type detection (no manual setup needed)

- 📊 Live status feedback:
  - Next run time
  - Last run time
  - Active schedule window


- 🖥️ Fully Lovelace-friendly controls
- 🛠️ Built for installers & client handover (simple but powerful UI)
- ⚡ Real-time updates (no reloads required)

---

## 📦 Installation (HACS – Custom Repository)

> This integration is installed via HACS as a custom repository.

1. Open **HACS**
2. Go to **Integrations**
3. Click the **three dots (⋮)** → **Custom repositories**
4. Add:
https://github.com/marsh4200/ar_smart_scheduler

Category: **Integration**
5. Search for **AR Smart Scheduler** and install it
6. Restart Home Assistant

---

## 🧰 Manual Installation

1. Copy the folder:
custom_components/ar_smart_scheduler

into:
/config/custom_components/ar_smart_scheduler

2. Restart Home Assistant
3. Go to **Settings → Devices & Services → Add Integration**
4. Search for **AR Smart Scheduler**

---

## ⚙️ Configuration

Once installed:

1. Add the integration from **Settings → Devices & Services**
2. Select the **entity to control** (light, switch, cover, etc.)
3. Give your schedule a name (e.g. *Gaming Lights*)
4. Set default start/end times and weekdays

---

## 🖥️ Lovelace Example

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
🧠 Notes
Schedules respect selected weekdays

Changes take effect immediately

No Home Assistant admin access required for end users

---


