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

### 🚀 AR Scheduler Card (Recommended)

Repo:
https://github.com/marsh4200/ar-scheduler-card

```yaml
type: custom:ar-scheduler-card
entity: switch.gaming_lights_schedule_enabled
name: 🎮 Gaming Room Lights
```

---

## 🧠 Notes

- 📅 Respects weekdays  
- ⚡ Instant updates  
- 👤 No admin access needed  
- 🎛️ Clean UI for clients  

---

## 🔥 In short

**AR Smart Scheduler makes scheduling simple, powerful, and client-friendly.**
