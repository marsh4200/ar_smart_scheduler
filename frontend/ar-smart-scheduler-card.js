/*
 * AR Smart Scheduler Card
 * Bundled with the ar_smart_scheduler integration - no separate install needed.
 *
 * Lovelace config:
 *   type: custom:ar-smart-scheduler-card
 *   title: Schedules            (optional)
 *   entry_id: <entry id>        (optional - show a single scheduler only)
 *
 * Fully configurable from the card itself: add a new schedule, pick which
 * entities it controls, choose time/sunrise/sunset triggers with offsets,
 * weekdays, what happens at start/end (on/off, brightness, position,
 * temperature, lock state, ...), rename it, or remove it. Nothing requires
 * visiting Settings -> Devices & Services.
 */

// Bump this alongside manifest.json's "version" on every release. It's
// rendered as a small marker under the card title so a stale cached copy
// (browser cache, HA Companion App webview cache, a service-worker asset
// cache, etc.) is visible to the eye instead of silently causing "the fix
// didn't work" reports - what's actually running is what's shown here,
// regardless of what version was installed on the backend.
const CARD_VERSION = "1.6.0";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };
const TRIGGERS = ["time", "sunrise", "sunset"];
const TRIGGER_ICONS = {
  time: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  sunrise: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12,18L14,16H10L12,18Z",
  sunset: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12,16L10,18H14L12,16Z",
};

// Mirrors const.py - used only as a fallback until the backend's
// ar_smart_scheduler/list response supplies the live lists (older backends
// won't include them; newer ones always will).
const FALLBACK_DOMAINS = ["cover", "switch", "light", "climate", "media_player", "fan", "water_heater", "lock", "input_boolean"];
const FALLBACK_DEVICE_TYPES = ["auto", "cover", "onoff", "light", "climate", "water_heater", "lock"];
const DEVICE_TYPE_LABELS = {
  auto: "Auto-detect",
  cover: "Cover / blind / gate",
  onoff: "Switch (on/off)",
  light: "Light",
  climate: "Climate",
  water_heater: "Water heater",
  lock: "Lock",
};

// Mirrors const.py's per-device CONF_* keys and defaults - what the card
// sends to ar_smart_scheduler/set_actions, and what "Actions" controls to
// draw for a given (resolved, never "auto") device type.
const ACTION_SPECS = {
  cover: {
    options: ["open", "close", "position"],
    value: { field: "position", min: 0, max: 100, step: 5, unit: "%", showWhen: "position" },
    keys: { start: "cover_start_action", startVal: "cover_start_position", end: "cover_end_action", endVal: "cover_end_position" },
  },
  light: {
    options: ["on", "off", "brightness"],
    value: { field: "brightness", min: 0, max: 100, step: 5, unit: "%", showWhen: "brightness" },
    keys: { start: "light_start_action", startVal: "light_start_brightness", end: "light_end_action", endVal: "light_end_brightness" },
  },
  climate: {
    options: ["heat", "cool", "off", "temperature"],
    value: { field: "temperature", min: 8, max: 35, step: 1, unit: "°C", showWhen: "temperature" },
    keys: { start: "climate_start_action", startVal: "climate_start_temperature", end: "climate_end_action", endVal: "climate_end_temperature" },
  },
  water_heater: {
    options: ["eco", "electric", "gas", "heat_pump", "high_demand", "performance", "off", "temperature"],
    value: { field: "temperature", min: 30, max: 80, step: 1, unit: "°C", showWhen: "temperature" },
    keys: { start: "water_heater_start_action", startVal: "water_heater_start_temperature", end: "water_heater_end_action", endVal: "water_heater_end_temperature" },
  },
  lock: {
    options: ["lock", "unlock"],
    value: null,
    keys: { start: "lock_start_action", end: "lock_end_action" },
  },
  onoff: {
    options: ["on", "off"],
    value: null,
    keys: { start: "onoff_start_action", end: "onoff_end_action" },
  },
};

// 'change'-based fields (commit on blur/selection), matching the existing
// time-input convention, so typing a name never gets wiped mid-keystroke by
// a re-render. The entity picker (.entinput/.entrow) is wired separately in
// _wireEntityPickers() since it needs live 'input' filtering, not 'change'.
const CHANGE_ACTS = new Set(["set-time", "rename", "add-name", "action-select", "add-devtype", "devtype"]);

// Entity search results are grouped by domain (Lights, Climate, Media
// Players, ...) so a home with entities across many domains stays scannable
// instead of one long alphabetical list where most entries never fit on
// screen. Each group is still capped so the dropdown stays a manageable
// size on a phone screen - a longer group is still reachable by typing to
// narrow (narrowing text matches both entity id and friendly name).
const ENTITY_GROUP_CAP_UNFILTERED = 6;
const ENTITY_GROUP_CAP_FILTERED = 20;

// Friendly section labels for the entity picker's domain groups. Anything
// not listed here (a domain added by a future backend release, or a custom
// integration's domain) still gets a group - see _domainLabel() - just with
// a generated label instead of a hand-tuned one.
const DOMAIN_LABELS = {
  light: "Lights",
  switch: "Switches",
  climate: "Climate",
  media_player: "Media players",
  cover: "Covers",
  fan: "Fans",
  water_heater: "Water heaters",
  lock: "Locks",
  input_boolean: "Input booleans",
};

class ARSmartSchedulerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._schedulers = [];
    this._expanded = new Set();
    this._confirmDelete = new Set();
    this._domains = FALLBACK_DOMAINS;
    this._deviceTypes = FALLBACK_DEVICE_TYPES;
    this._config = {};
    this._hass = null;
    this._loaded = false;
    this._busy = false;
    this._pollTimer = null;

    this._addOpen = false;
    this._addBusy = false;
    this._addError = "";
    this._resetAddForm();
  }

  _resetAddForm() {
    this._addName = "";
    this._addSelected = [];
    this._addDeviceType = "auto";
    this._addStartTrigger = "time";
    this._addEndTrigger = "time";
    this._addWeekdays = new Set(DAYS);
  }

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._refresh();
  }

  getCardSize() {
    return Math.max(2, this._schedulers.length * 2 + (this._addOpen ? 4 : 1));
  }

  connectedCallback() {
    if (this._hass && !this._loaded) this._refresh();
    this._pollTimer = setInterval(() => this._refresh(true), 30000);

    // Closes an open entity-picker dropdown when the user taps/clicks
    // anywhere outside it (including outside the card entirely) - the
    // dropdown itself doesn't otherwise know to collapse, since opening it
    // is a plain DOM toggle done without a full _render() (see
    // _wireEntityPickers) so typing isn't interrupted mid-keystroke.
    this._outsideClickHandler = (ev) => {
      const path = ev.composedPath ? ev.composedPath() : [];
      this.shadowRoot.querySelectorAll(".entdropdown.open").forEach((dropdown) => {
        const picker = dropdown.closest(".entpicker");
        if (!picker || !path.includes(picker)) dropdown.classList.remove("open");
      });
    };
    document.addEventListener("click", this._outsideClickHandler, true);

    // The dropdown is a position:fixed overlay anchored to its input's
    // on-screen coordinates (see _positionDropdown) - it has to be
    // re-anchored whenever the page (or any scrollable ancestor - a
    // capture-phase listener sees those too, even though scroll doesn't
    // bubble) scrolls, or the viewport resizes (e.g. the on-screen keyboard
    // opening/closing resizes the visual viewport on most mobile browsers).
    this._repositionHandler = () => this._repositionOpenDropdowns();
    window.addEventListener("scroll", this._repositionHandler, true);
    window.addEventListener("resize", this._repositionHandler);
  }

  disconnectedCallback() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = null;
    if (this._outsideClickHandler) {
      document.removeEventListener("click", this._outsideClickHandler, true);
      this._outsideClickHandler = null;
    }
    if (this._repositionHandler) {
      window.removeEventListener("scroll", this._repositionHandler, true);
      window.removeEventListener("resize", this._repositionHandler);
      this._repositionHandler = null;
    }
  }

  _isEditingText() {
    const root = this.shadowRoot;
    const el = root && root.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" && el.type !== "checkbox";
  }

  async _refresh(silent) {
    if (!this._hass || this._busy) return;
    this._busy = true;
    try {
      const resp = await this._hass.callWS({ type: "ar_smart_scheduler/list" });
      let items = (resp && resp.schedulers) || [];
      if (this._config.entry_id) {
        items = items.filter((s) => s.entry_id === this._config.entry_id);
      }
      items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      this._schedulers = items;
      this._domains = (resp && resp.domains) || FALLBACK_DOMAINS;
      this._deviceTypes = (resp && resp.device_types) || FALLBACK_DEVICE_TYPES;
      this._loaded = true;
      // Don't clobber the user's cursor/focus with a poll-driven re-render
      // while they're mid-edit in a text field.
      if (!(silent && this._isEditingText())) this._render();
    } catch (err) {
      if (!silent) {
        this._schedulers = [];
        this._loaded = true;
        this._render(String(err && err.message ? err.message : err));
      }
    } finally {
      this._busy = false;
    }
  }

  async _set(entryId, patch) {
    if (!this._hass) return;
    try {
      await this._hass.callWS(
        Object.assign({ type: "ar_smart_scheduler/set_options", entry_id: entryId }, patch)
      );
    } catch (err) {
      console.error("ar-smart-scheduler-card set_options failed", err);
    }
    await this._refresh();
  }

  async _setGeneral(entryId, patch) {
    if (!this._hass) return;
    try {
      await this._hass.callWS(
        Object.assign({ type: "ar_smart_scheduler/set_general", entry_id: entryId }, patch)
      );
    } catch (err) {
      console.error("ar-smart-scheduler-card set_general failed", err);
    }
    await this._refresh();
  }

  async _setActions(entryId, patch) {
    if (!this._hass) return;
    try {
      await this._hass.callWS(
        Object.assign({ type: "ar_smart_scheduler/set_actions", entry_id: entryId }, patch)
      );
    } catch (err) {
      console.error("ar-smart-scheduler-card set_actions failed", err);
    }
    await this._refresh();
  }

  async _deleteScheduler(entryId) {
    if (!this._hass) return;
    try {
      await this._hass.callWS({ type: "ar_smart_scheduler/delete", entry_id: entryId });
    } catch (err) {
      console.error("ar-smart-scheduler-card delete failed", err);
    }
    this._expanded.delete(entryId);
    await this._refresh();
  }

  async _submitAdd() {
    const nameEl = this.shadowRoot.querySelector('[data-act="add-name"]');
    const name = ((nameEl ? nameEl.value : this._addName) || "").trim();
    if (!name) {
      this._addError = "Enter a name for the schedule.";
      this._render();
      return;
    }
    if (!this._addSelected.length) {
      this._addError = "Pick at least one entity to control.";
      this._render();
      return;
    }

    this._addBusy = true;
    this._addError = "";
    this._render();

    try {
      const resp = await this._hass.callWS({
        type: "ar_smart_scheduler/create",
        name,
        target_entity: this._addSelected,
        device_type: this._addDeviceType,
        weekdays: DAYS.filter((d) => this._addWeekdays.has(d)),
        start_trigger: this._addStartTrigger,
        end_trigger: this._addEndTrigger,
      });
      this._addOpen = false;
      this._resetAddForm();
      if (resp && resp.entry_id) this._expanded.add(resp.entry_id);
      await this._refresh();
    } catch (err) {
      this._addError = (err && err.message) || String(err);
      this._render();
    } finally {
      this._addBusy = false;
    }
  }

  _fmtTime(t) {
    return String(t || "00:00:00").slice(0, 5);
  }

  _fmtNext(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (sameDay) return `today ${hm}`;
      const tomorrow = new Date(now.getTime() + 86400000);
      if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${hm}`;
      return `${d.toLocaleDateString([], { weekday: "short" })} ${hm}`;
    } catch (e) {
      return "";
    }
  }

  _icon(path, cls) {
    return `<svg class="${cls || ""}" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
  }

  _esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  _entityLabel(entityId) {
    const st = this._hass && this._hass.states[entityId];
    return (st && st.attributes && st.attributes.friendly_name) || entityId;
  }

  // Human label for a domain group header. Known domains get a hand-picked
  // label (DOMAIN_LABELS); anything else falls back to title-casing the
  // domain id (e.g. "input_boolean" -> "Input boolean") so a domain the
  // backend adds later still gets a sensible header instead of a blank one.
  _domainLabel(domain) {
    if (DOMAIN_LABELS[domain]) return DOMAIN_LABELS[domain];
    const words = String(domain).split("_").filter(Boolean);
    if (!words.length) return domain;
    return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
  }

  // Buckets an already-filtered, already-sorted entity id list into
  // per-domain groups (light, climate, media_player, ...), sorted by group
  // label. Entities keep the sort order they arrived in within each group,
  // which _matchingEntities already sorts by friendly name.
  _groupEntities(ids) {
    const groups = new Map();
    (ids || []).forEach((id) => {
      const domain = id.split(".", 1)[0];
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain).push(id);
    });
    return [...groups.entries()]
      .map(([domain, entityIds]) => ({ domain, label: this._domainLabel(domain), ids: entityIds }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Custom, fully-controlled entity picker - deliberately NOT a native
  // <datalist>. <datalist> suggestion dropdowns are unreliable to unusable
  // on mobile (iOS Safari essentially never shows them; Android renders
  // them as unstyled browser chrome that doesn't match the card and can
  // look broken inside a shadow root). This renders and wires its own
  // dropdown so behavior is identical and touch-friendly everywhere.
  _matchingEntities(exclude, search) {
    if (!this._hass) return [];
    const excludeSet = new Set(exclude || []);
    const domains = new Set(this._domains);
    const q = (search || "").trim().toLowerCase();
    const all = Object.keys(this._hass.states).filter(
      (id) => domains.has(id.split(".", 1)[0]) && !excludeSet.has(id)
    );
    const matches = q
      ? all.filter((id) => id.toLowerCase().includes(q) || this._entityLabel(id).toLowerCase().includes(q))
      : all;
    matches.sort((a, b) => this._entityLabel(a).localeCompare(this._entityLabel(b)));
    return matches;
  }

  _entityRows(formId, exclude, search) {
    const matches = this._matchingEntities(exclude, search);
    if (!matches.length) {
      return `<div class="entempty">${search ? "No matching entities" : "No entities available"}</div>`;
    }
    const cap = search ? ENTITY_GROUP_CAP_FILTERED : ENTITY_GROUP_CAP_UNFILTERED;
    const groups = this._groupEntities(matches);
    return groups
      .map((group) => {
        const shown = group.ids.slice(0, cap);
        const rows = shown
          .map(
            (id) => `
        <button type="button" class="entrow" data-form="${this._esc(formId)}" data-ent="${this._esc(id)}">
          <span class="entname">${this._esc(this._entityLabel(id))}</span>
          <span class="entid">${this._esc(id)}</span>
        </button>`
          )
          .join("");
        const remaining = group.ids.length - shown.length;
        const more =
          remaining > 0
            ? `<div class="entmore">+${remaining} more ${this._esc(group.label.toLowerCase())} — keep typing to narrow</div>`
            : "";
        return `
        <div class="entgroup">
          <div class="entgroup-header">${this._esc(group.label)}<span class="entgroup-count">${group.ids.length}</span></div>
          ${rows}
          ${more}
        </div>`;
      })
      .join("");
  }

  _entityPickerHtml(formId, exclude) {
    return `
      <div class="entpicker">
        <input type="text" class="entinput" placeholder="+ add entity… (tap to browse)" data-form="${this._esc(formId)}"
               autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="entdropdown" data-form="${this._esc(formId)}">${this._entityRows(formId, exclude, "")}</div>
      </div>`;
  }

  _pickEntity(formId, ent) {
    if (formId === "new") {
      if (!this._addSelected.includes(ent)) this._addSelected.push(ent);
      this._render();
      return;
    }
    const s = this._findScheduler(formId);
    if (s && !(s.targets || []).includes(ent)) {
      this._setGeneral(formId, { target_entity: [...(s.targets || []), ent] });
    }
  }

  // The dropdown is rendered as a position:fixed overlay (see .entdropdown
  // in _render()'s <style>) instead of sitting in normal document flow.
  // Earlier this was in-flow, which had two mobile-specific failure modes:
  // an ancestor with overflow/height constraints (e.g. a dashboard grid
  // section) could clip it entirely, and the on-screen keyboard could cover
  // it below the fold - both looking exactly like "no dropdown appears".
  // An overlay positioned from the input's real viewport coordinates avoids
  // both: it can't be clipped by a card/grid ancestor, and it's placed
  // above the input instead of below when there isn't room underneath.
  _positionDropdown(input, dropdown) {
    if (typeof input.getBoundingClientRect !== "function") return;
    const r = input.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const margin = 6;
    const minHeight = 100;
    const maxHeight = 240;
    const spaceBelow = vh - r.bottom - margin;
    const spaceAbove = r.top - margin;
    const openUpward = spaceBelow < minHeight && spaceAbove > spaceBelow;

    dropdown.style.left = `${Math.max(0, r.left)}px`;
    dropdown.style.width = `${r.width}px`;
    if (openUpward) {
      dropdown.style.top = "";
      dropdown.style.bottom = `${Math.max(0, vh - r.top + margin)}px`;
      dropdown.style.maxHeight = `${Math.max(minHeight, Math.min(maxHeight, spaceAbove))}px`;
    } else {
      dropdown.style.bottom = "";
      dropdown.style.top = `${r.bottom + margin}px`;
      dropdown.style.maxHeight = `${Math.max(minHeight, Math.min(maxHeight, spaceBelow))}px`;
    }
  }

  // Re-run positioning for every currently-open dropdown - used on
  // scroll/resize (registered in connectedCallback) and after a short delay
  // following focus, since mobile browsers auto-scroll a focused input into
  // view (to clear the on-screen keyboard) slightly *after* focus fires,
  // which would otherwise leave a just-opened dropdown anchored to the
  // input's pre-scroll position.
  _repositionOpenDropdowns() {
    this.shadowRoot.querySelectorAll(".entdropdown.open").forEach((dropdown) => {
      const picker = dropdown.closest(".entpicker");
      const input = picker && picker.querySelector(".entinput");
      if (input) this._positionDropdown(input, dropdown);
    });
  }

  _excludeFor(formId) {
    if (formId === "new") return this._addSelected;
    const s = this._findScheduler(formId);
    return (s && s.targets) || [];
  }

  _wireEntityRows(container) {
    container.querySelectorAll(".entrow").forEach((row) => {
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._pickEntity(row.dataset.form, row.dataset.ent);
      });
    });
  }

  _wireEntityPickers() {
    this.shadowRoot.querySelectorAll(".entpicker").forEach((picker) => {
      const input = picker.querySelector(".entinput");
      const dropdown = picker.querySelector(".entdropdown");
      if (!input || !dropdown) return;
      const formId = input.dataset.form;

      this._wireEntityRows(dropdown);

      input.addEventListener("focus", (ev) => {
        ev.stopPropagation();
        dropdown.classList.add("open");
        this._positionDropdown(input, dropdown);
        if (typeof window.setTimeout === "function") {
          window.setTimeout(() => this._repositionOpenDropdowns(), 350);
        }
      });
      input.addEventListener("click", (ev) => ev.stopPropagation());
      input.addEventListener("input", () => {
        dropdown.innerHTML = this._entityRows(formId, this._excludeFor(formId), input.value);
        dropdown.classList.add("open");
        this._positionDropdown(input, dropdown);
        this._wireEntityRows(dropdown);
      });
    });
  }

  _chipsHtml(entities, formId) {
    return (entities || [])
      .map(
        (e) => `
        <span class="chip removable">
          ${this._esc(this._entityLabel(e))}
          <button type="button" data-act="remove-entity" data-entry="${formId}" data-ent="${this._esc(e)}" title="Remove">×</button>
        </span>`
      )
      .join("");
  }

  _windowRow(s, label, prefix) {
    const isSecond = prefix === "second_";
    const startTrigger = s[`${prefix}start_trigger`];
    const endTrigger = s[`${prefix}end_trigger`];
    const startKey = isSecond ? "start2" : "start";
    const endKey = isSecond ? "end" + (isSecond ? "2" : "") : "end";

    const cell = (side, trigger, sideKey) => {
      const timeVal = this._fmtTime(s[`${prefix}${side}_time`]);
      const offset = s[`${prefix}${side}_offset`];
      const next = this._fmtNext(s.next_fire && s.next_fire[sideKey]);
      const solarMsg = s.solar_messages && s.solar_messages[sideKey];
      return `
        <div class="win-cell">
          <div class="win-head">${side === "start" ? "Start" : "End"}</div>
          <button class="trig" data-act="cycle-trigger" data-entry="${s.entry_id}"
                  data-key="${prefix}${side}_trigger" data-cur="${trigger}" title="Trigger: ${trigger} (tap to change)">
            ${this._icon(TRIGGER_ICONS[trigger] || TRIGGER_ICONS.time, "trig-ic")}
            <span>${trigger}</span>
          </button>
          ${
            trigger === "time"
              ? `<input type="time" value="${timeVal}" data-act="set-time" data-entry="${s.entry_id}" data-key="${prefix}${side}_time">`
              : `<div class="offset">
                   <button data-act="offset" data-entry="${s.entry_id}" data-key="${prefix}${side}_offset" data-delta="-5" data-cur="${offset}">−</button>
                   <span title="Offset from ${trigger} (minutes)">${offset >= 0 ? "+" : ""}${offset}m</span>
                   <button data-act="offset" data-entry="${s.entry_id}" data-key="${prefix}${side}_offset" data-delta="5" data-cur="${offset}">+</button>
                 </div>`
          }
          ${solarMsg ? `<div class="warn">${solarMsg}</div>` : next ? `<div class="next">next: ${next}</div>` : ""}
        </div>`;
    };

    return `
      <div class="window">
        <div class="win-label">${label}</div>
        <div class="win-cells">
          ${cell("start", startTrigger, startKey)}
          ${cell("end", endTrigger, isSecond ? "end2" : "end")}
        </div>
      </div>`;
  }

  _actionsSection(s) {
    const spec = ACTION_SPECS[s.device_type] || ACTION_SPECS.onoff;
    const a = s.actions || {};

    const side = (label, sideKey) => {
      const actionVal = a[`${sideKey}_action`];
      const v = spec.value;
      const showValue = v && actionVal === v.showWhen;
      const valKey = v ? `${sideKey}_${v.field}` : null;
      const cur = valKey ? a[valKey] : null;
      return `
        <div class="act-cell">
          <div class="win-head">${label}</div>
          <select data-act="action-select" data-entry="${s.entry_id}" data-side="${sideKey}">
            ${spec.options.map((o) => `<option value="${o}" ${o === actionVal ? "selected" : ""}>${o}</option>`).join("")}
          </select>
          ${
            showValue
              ? `<div class="offset">
                   <button data-act="action-value" data-entry="${s.entry_id}" data-side="${sideKey}" data-field="${v.field}" data-delta="${-v.step}" data-cur="${cur}">−</button>
                   <span>${cur}${v.unit}</span>
                   <button data-act="action-value" data-entry="${s.entry_id}" data-side="${sideKey}" data-field="${v.field}" data-delta="${v.step}" data-cur="${cur}">+</button>
                 </div>`
              : ""
          }
        </div>`;
    };

    return `
      <div class="manage-row">
        <div class="manage-label">Actions</div>
        <div class="win-cells">
          ${side("Start", "start")}
          ${side("End", "end")}
        </div>
      </div>`;
  }

  _manageSection(s) {
    const deleting = this._confirmDelete.has(s.entry_id);
    return `
      <div class="manage">
        <div class="manage-row">
          <div class="manage-label">Applies to</div>
          <select data-act="devtype" data-entry="${s.entry_id}">
            ${this._deviceTypes
              .map((dt) => `<option value="${dt}" ${dt === s.device_type_setting ? "selected" : ""}>${DEVICE_TYPE_LABELS[dt] || dt}</option>`)
              .join("")}
          </select>
        </div>
        <div class="manage-row">
          <div class="manage-label">Entities</div>
          <div class="chips">${this._chipsHtml(s.targets, s.entry_id)}</div>
          ${this._entityPickerHtml(s.entry_id, s.targets)}
        </div>
        ${this._actionsSection(s)}
        <div class="manage-row manage-danger">
          ${
            deleting
              ? `<span class="confirm-text">Remove this schedule permanently?</span>
                 <button class="danger" data-act="delete-confirm" data-entry="${s.entry_id}">Yes, remove</button>
                 <button data-act="delete-cancel" data-entry="${s.entry_id}">Cancel</button>`
              : `<button class="danger-outline" data-act="delete-start" data-entry="${s.entry_id}">Remove schedule</button>`
          }
        </div>
      </div>`;
  }

  _renderScheduler(s) {
    const open = this._expanded.has(s.entry_id);
    const days = DAYS.map((d) => {
      const on = (s.weekdays || []).includes(d);
      return `<button class="day ${on ? "on" : ""}" data-act="day" data-entry="${s.entry_id}" data-day="${d}" title="${d}">${DAY_LABELS[d]}</button>`;
    }).join("");

    const summaryStart = s.start_trigger === "time" ? this._fmtTime(s.start_time) : s.start_trigger;
    const summaryEnd = s.end_trigger === "time" ? this._fmtTime(s.end_time) : s.end_trigger;

    return `
      <div class="sched ${s.enabled ? "" : "disabled"}">
        <div class="row head" data-act="expand" data-entry="${s.entry_id}">
          <div class="titleblock">
            <input class="name-input" data-act="rename" data-entry="${s.entry_id}" data-stop="1" value="${this._esc(s.name)}" title="Tap to rename">
            <div class="sub">${summaryStart} → ${summaryEnd}${s.second_enabled ? " · 2nd window" : ""} · ${(s.targets || []).length} entit${(s.targets || []).length === 1 ? "y" : "ies"}</div>
          </div>
          <label class="switch" data-stop="1">
            <input type="checkbox" ${s.enabled ? "checked" : ""} data-act="toggle" data-entry="${s.entry_id}">
            <span class="slider"></span>
          </label>
          <div class="chev ${open ? "open" : ""}">${this._icon("M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z")}</div>
        </div>
        ${
          open
            ? `<div class="body">
                <div class="days">${days}</div>
                ${this._windowRow(s, "Main window", "")}
                <div class="secondrow">
                  <label class="switch small" data-stop="1">
                    <input type="checkbox" ${s.second_enabled ? "checked" : ""} data-act="toggle-second" data-entry="${s.entry_id}">
                    <span class="slider"></span>
                  </label>
                  <span class="secondlabel">Second window</span>
                </div>
                ${s.second_enabled ? this._windowRow(s, "Second window", "second_") : ""}
                ${this._manageSection(s)}
              </div>`
            : ""
        }
      </div>`;
  }

  _renderAddForm() {
    return `
      <div class="addform">
        <div class="addform-row">
          <input type="text" class="addname" data-act="add-name" placeholder="Schedule name (e.g. Gaming Room Lights)" value="${this._esc(this._addName)}">
        </div>
        <div class="addform-row">
          <div class="manage-label">Entities to control</div>
          <div class="chips">${this._chipsHtml(this._addSelected, "new")}</div>
          ${this._entityPickerHtml("new", this._addSelected)}
        </div>
        <div class="addform-row two-col">
          <div>
            <div class="manage-label">Applies to</div>
            <select data-act="add-devtype">
              ${this._deviceTypes.map((dt) => `<option value="${dt}" ${dt === this._addDeviceType ? "selected" : ""}>${DEVICE_TYPE_LABELS[dt] || dt}</option>`).join("")}
            </select>
          </div>
          <div>
            <div class="manage-label">Weekdays</div>
            <div class="days">
              ${DAYS.map((d) => `<button class="day ${this._addWeekdays.has(d) ? "on" : ""}" data-act="add-day" data-day="${d}" title="${d}">${DAY_LABELS[d]}</button>`).join("")}
            </div>
          </div>
        </div>
        <div class="addform-row two-col">
          <button class="trig standalone" data-act="add-trigger" data-side="start">
            ${this._icon(TRIGGER_ICONS[this._addStartTrigger] || TRIGGER_ICONS.time, "trig-ic")}
            <span>Start: ${this._addStartTrigger}</span>
          </button>
          <button class="trig standalone" data-act="add-trigger" data-side="end">
            ${this._icon(TRIGGER_ICONS[this._addEndTrigger] || TRIGGER_ICONS.time, "trig-ic")}
            <span>End: ${this._addEndTrigger}</span>
          </button>
        </div>
        <div class="hint">Fine-tune times, offsets, and a second window after creating - just expand the new schedule below.</div>
        ${this._addError ? `<div class="warn">${this._esc(this._addError)}</div>` : ""}
        <div class="addform-actions">
          <button class="primary" data-act="add-submit" ${this._addBusy ? "disabled" : ""}>${this._addBusy ? "Creating…" : "Create schedule"}</button>
          <button data-act="add-cancel">Cancel</button>
        </div>
      </div>`;
  }

  _render(error) {
    const title = this._config.title || "AR Smart Scheduler";
    let body;
    if (error) {
      body = `<div class="empty">Could not load schedulers: ${this._esc(error)}</div>`;
    } else if (!this._loaded) {
      body = `<div class="empty">Loading…</div>`;
    } else if (!this._schedulers.length) {
      body = `<div class="empty">No schedulers yet. Tap "Add schedule" above to create one.</div>`;
    } else {
      body = this._schedulers.map((s) => this._renderScheduler(s)).join("");
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { padding: 12px 16px 16px; }
        .card-title-row { display:flex; align-items:baseline; gap:8px; padding: 4px 0 10px; }
        .card-title { font-size: 1.15em; font-weight: 500; color: var(--primary-text-color); }
        .card-version { font-size: 0.68em; color: var(--secondary-text-color); opacity: 0.45; }
        .toolbar { display:flex; justify-content:flex-end; margin: -6px 0 10px; }
        .toolbar button { display:flex; align-items:center; gap:6px; background: var(--primary-color); color: var(--text-primary-color, #fff); border:none; border-radius: 999px; padding: 7px 14px; font-size:0.88em; font-weight:500; cursor:pointer; }
        .empty { color: var(--secondary-text-color); padding: 12px 4px; text-align:center; }
        .sched { border: 1px solid var(--divider-color); border-radius: 12px; margin-bottom: 10px; overflow: hidden; background: var(--card-background-color); }
        .sched.disabled .titleblock, .sched.disabled .body { opacity: 0.55; }
        .row.head { display:flex; align-items:center; gap: 10px; padding: 10px 12px; cursor:pointer; }
        .titleblock { flex:1; min-width:0; }
        .name-input { font-weight: 500; color: var(--primary-text-color); background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 2px 4px; margin: -2px -4px; font-size: 16px; font-family: inherit; width: 100%; box-sizing: border-box; }
        .name-input:hover, .name-input:focus { border-color: var(--divider-color); background: var(--secondary-background-color); }
        .sub { font-size: 0.85em; color: var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chev svg { width: 22px; height:22px; fill: var(--secondary-text-color); transition: transform .15s ease; flex: none; }
        .chev.open svg { transform: rotate(180deg); }
        .body { padding: 4px 12px 12px; border-top: 1px solid var(--divider-color); }
        .days { display:flex; gap: 6px; padding: 10px 0; flex-wrap: wrap; }
        .day { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--divider-color); background: transparent; color: var(--secondary-text-color); cursor:pointer; font-weight:600; }
        .day.on { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
        .window { margin: 6px 0 10px; }
        .win-label, .manage-label { font-size: 0.8em; text-transform: uppercase; letter-spacing: .05em; color: var(--secondary-text-color); margin-bottom: 6px; }
        .win-cells { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .win-cell, .act-cell { border: 1px solid var(--divider-color); border-radius: 10px; padding: 8px; }
        .win-head { font-size: 0.8em; color: var(--secondary-text-color); margin-bottom: 4px; }
        .trig { display:flex; align-items:center; gap:6px; background:transparent; border:none; color: var(--primary-color); cursor:pointer; padding: 0 0 6px; font-size: 0.9em; }
        .trig.standalone { border: 1px solid var(--divider-color); border-radius: 10px; padding: 8px 10px; width: 100%; box-sizing: border-box; }
        .trig-ic { width: 18px; height: 18px; fill: currentColor; }
        /* font-size >=16px on text inputs stops iOS Safari auto-zooming the
           whole page in on focus - a common source of "everything looks
           messed up" on mobile once you tap a field. */
        input[type="time"], select, .addname, .entinput { width: 100%; box-sizing: border-box; background: var(--secondary-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color); border-radius: 8px; padding: 6px; font-size: 16px; font-family: inherit; }
        select { padding: 7px 6px; }
        .entpicker { position: relative; }
        .entinput { padding: 10px 8px; }
        /* Positioned via JS (_positionDropdown) as a fixed overlay anchored
           to the input's on-screen coordinates, not left in normal document
           flow - a card/grid ancestor's overflow or height can't clip an
           overlay the way it could clip something in-flow, and it can open
           upward instead of being hidden behind the on-screen keyboard. */
        .entdropdown { display:none; position: fixed; box-sizing: border-box; border: 1px solid var(--divider-color); border-radius: 10px; overflow-y: auto; background: var(--secondary-background-color); box-shadow: 0 4px 18px rgba(0,0,0,0.35); -webkit-overflow-scrolling: touch; z-index: 9999; }
        .entdropdown.open { display:block; }
        .entgroup:not(:last-child) { border-bottom: 1px solid var(--divider-color); }
        .entgroup-header { position: sticky; top: 0; z-index: 1; display:flex; align-items:center; justify-content:space-between; gap:6px; padding: 6px 12px; background: var(--card-background-color); color: var(--secondary-text-color); font-size: 0.72em; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
        .entgroup-count { color: var(--secondary-text-color); font-size: 0.95em; font-weight: 400; text-transform: none; letter-spacing: normal; opacity: 0.7; }
        .entrow { display:flex; flex-direction:column; align-items:flex-start; gap:2px; width:100%; box-sizing:border-box; padding: 11px 12px; background:transparent; border:none; border-bottom:1px solid var(--divider-color); text-align:left; cursor:pointer; font-family:inherit; -webkit-tap-highlight-color: rgba(0,0,0,0.15); }
        .entgroup .entrow:last-child { border-bottom:none; }
        .entrow:hover, .entrow:active { background: var(--card-background-color); }
        .entname { color: var(--primary-text-color); font-size: 0.95em; }
        .entid { color: var(--secondary-text-color); font-size: 0.78em; }
        .entempty, .entmore { padding: 10px 12px; color: var(--secondary-text-color); font-size: 0.85em; }
        .offset { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top: 6px; }
        .offset button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--divider-color); background: var(--secondary-background-color); color: var(--primary-text-color); cursor:pointer; font-size: 1.1em; flex: none; }
        .offset span { font-variant-numeric: tabular-nums; }
        .next { font-size: 0.78em; color: var(--secondary-text-color); margin-top: 6px; }
        .warn { font-size: 0.78em; color: var(--error-color, #d32f2f); margin-top: 6px; }
        .secondrow { display:flex; align-items:center; gap: 8px; margin: 4px 0 8px; }
        .secondlabel { color: var(--primary-text-color); font-size: 0.92em; }
        .manage { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--divider-color); }
        .manage-row { margin-bottom: 12px; }
        .manage-danger { display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
        .chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom: 6px; }
        .chip { font-size: 0.75em; background: var(--secondary-background-color); color: var(--secondary-text-color); border-radius: 999px; padding: 3px 8px; display:inline-flex; align-items:center; gap:5px; }
        .chip.removable button { background:transparent; border:none; color: var(--secondary-text-color); cursor:pointer; font-size: 1.05em; line-height:1; padding:0; }
        .chip.removable button:hover { color: var(--error-color, #d32f2f); }
        .danger { background: var(--error-color, #d32f2f); color: #fff; border:none; border-radius: 8px; padding: 7px 12px; cursor:pointer; font-size: 0.88em; }
        .danger-outline { background: transparent; color: var(--error-color, #d32f2f); border: 1px solid var(--error-color, #d32f2f); border-radius: 8px; padding: 7px 12px; cursor:pointer; font-size: 0.88em; }
        .confirm-text { font-size: 0.88em; color: var(--primary-text-color); }
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex: none; }
        .switch.small { width: 38px; height: 21px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position:absolute; inset:0; border-radius: 999px; background: var(--disabled-color, #9e9e9e); transition: .15s; cursor:pointer; }
        .slider:before { content:""; position:absolute; height: 18px; width: 18px; left: 3px; top: 3px; border-radius: 50%; background: #fff; transition: .15s; }
        .switch.small .slider:before { height: 15px; width: 15px; }
        .switch input:checked + .slider { background: var(--primary-color); }
        .switch input:checked + .slider:before { transform: translateX(20px); }
        .switch.small input:checked + .slider:before { transform: translateX(17px); }
        .addform { border: 1px solid var(--divider-color); border-radius: 12px; padding: 12px; margin-bottom: 12px; background: var(--card-background-color); }
        .addform-row { margin-bottom: 10px; }
        .addform-row.two-col { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end; }
        .hint { font-size: 0.78em; color: var(--secondary-text-color); margin-bottom: 6px; }
        .addform-actions { display:flex; gap: 8px; justify-content:flex-end; }
        .addform-actions button { border-radius: 999px; padding: 8px 16px; font-size: 0.9em; cursor:pointer; border: 1px solid var(--divider-color); background: transparent; color: var(--primary-text-color); }
        .addform-actions button.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); border: none; font-weight: 500; }
        .addform-actions button:disabled { opacity: 0.6; cursor: default; }
      </style>
      <ha-card>
        <div class="card-title-row">
          <div class="card-title">${title}</div>
          <div class="card-version">v${CARD_VERSION}</div>
        </div>
        <div class="toolbar">
          ${
            this._addOpen
              ? ""
              : `<button data-act="add-open">${this._icon("M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z")}<span>Add schedule</span></button>`
          }
        </div>
        ${this._addOpen ? this._renderAddForm() : ""}
        ${body}
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("[data-act]").forEach((el) => {
      const act = el.dataset.act;
      if (CHANGE_ACTS.has(act)) {
        el.addEventListener("change", (ev) => this._onChange(ev, el));
        el.addEventListener("click", (ev) => ev.stopPropagation());
      } else {
        el.addEventListener("click", (ev) => this._onClick(ev, el));
      }
    });
    this.shadowRoot.querySelectorAll("[data-stop]").forEach((el) => {
      el.addEventListener("click", (ev) => ev.stopPropagation());
    });
    this._wireEntityPickers();
  }

  _findScheduler(entryId) {
    return this._schedulers.find((s) => s.entry_id === entryId);
  }

  _buildActionPatch(s, spec, overrides) {
    const a = s.actions || {};
    const patch = {};
    patch[spec.keys.start] = overrides.start_action !== undefined ? overrides.start_action : a.start_action;
    patch[spec.keys.end] = overrides.end_action !== undefined ? overrides.end_action : a.end_action;
    if (spec.value) {
      const f = spec.value.field;
      const startKey = `start_${f}`;
      const endKey = `end_${f}`;
      patch[spec.keys.startVal] = overrides[startKey] !== undefined ? overrides[startKey] : a[startKey];
      patch[spec.keys.endVal] = overrides[endKey] !== undefined ? overrides[endKey] : a[endKey];
    }
    return patch;
  }

  _onChange(ev, el) {
    const act = el.dataset.act;

    if (act === "set-time") {
      const value = el.value;
      if (!value) return;
      const patch = {};
      patch[el.dataset.key] = value.length === 5 ? `${value}:00` : value;
      this._set(el.dataset.entry, patch);
      return;
    }

    if (act === "add-name") {
      this._addName = el.value;
      return;
    }

    if (act === "add-devtype") {
      this._addDeviceType = el.value;
      return;
    }

    if (act === "rename") {
      const s = this._findScheduler(el.dataset.entry);
      const name = el.value.trim();
      if (name) this._setGeneral(el.dataset.entry, { name });
      else el.value = (s && s.name) || "";
      return;
    }

    if (act === "action-select") {
      const s = this._findScheduler(el.dataset.entry);
      if (!s) return;
      const spec = ACTION_SPECS[s.device_type] || ACTION_SPECS.onoff;
      const patch = this._buildActionPatch(s, spec, { [`${el.dataset.side}_action`]: el.value });
      this._setActions(s.entry_id, patch);
      return;
    }

    if (act === "devtype") {
      this._setGeneral(el.dataset.entry, { device_type: el.value });
      return;
    }
  }

  _onClick(ev, el) {
    ev.stopPropagation();
    const act = el.dataset.act;
    const entryId = el.dataset.entry;

    if (act === "add-open") {
      this._addOpen = true;
      this._addError = "";
      this._render();
      return;
    }
    if (act === "add-cancel") {
      this._addOpen = false;
      this._addError = "";
      this._resetAddForm();
      this._render();
      return;
    }
    if (act === "add-submit") {
      this._submitAdd();
      return;
    }
    if (act === "add-day") {
      const day = el.dataset.day;
      if (this._addWeekdays.has(day)) this._addWeekdays.delete(day);
      else this._addWeekdays.add(day);
      this._render();
      return;
    }
    if (act === "add-trigger") {
      const side = el.dataset.side;
      const cur = side === "start" ? this._addStartTrigger : this._addEndTrigger;
      const next = TRIGGERS[(TRIGGERS.indexOf(cur) + 1) % TRIGGERS.length];
      if (side === "start") this._addStartTrigger = next;
      else this._addEndTrigger = next;
      this._render();
      return;
    }

    if (act === "expand") {
      if (this._expanded.has(entryId)) this._expanded.delete(entryId);
      else this._expanded.add(entryId);
      this._render();
      return;
    }

    if (act === "remove-entity") {
      const ent = el.dataset.ent;
      if (entryId === "new") {
        this._addSelected = this._addSelected.filter((e) => e !== ent);
        this._render();
        return;
      }
      const s = this._findScheduler(entryId);
      if (!s) return;
      const remaining = (s.targets || []).filter((t) => t !== ent);
      if (!remaining.length) return; // a scheduler needs at least one entity
      this._setGeneral(entryId, { target_entity: remaining });
      return;
    }

    if (act === "action-value") {
      const s = this._findScheduler(entryId);
      if (!s) return;
      const spec = ACTION_SPECS[s.device_type] || ACTION_SPECS.onoff;
      const v = spec.value;
      if (!v) return;
      const cur = parseInt(el.dataset.cur, 10) || 0;
      const delta = parseInt(el.dataset.delta, 10) || 0;
      const next = Math.max(v.min, Math.min(v.max, cur + delta));
      const patch = this._buildActionPatch(s, spec, { [`${el.dataset.side}_${v.field}`]: next });
      this._setActions(entryId, patch);
      return;
    }

    if (act === "delete-start") {
      this._confirmDelete.add(entryId);
      this._render();
      return;
    }
    if (act === "delete-cancel") {
      this._confirmDelete.delete(entryId);
      this._render();
      return;
    }
    if (act === "delete-confirm") {
      this._confirmDelete.delete(entryId);
      this._deleteScheduler(entryId);
      return;
    }

    const s = entryId ? this._findScheduler(entryId) : null;
    if (!s) return;

    if (act === "toggle") {
      this._set(entryId, { enabled: !s.enabled });
    } else if (act === "toggle-second") {
      this._set(entryId, { second_enabled: !s.second_enabled });
    } else if (act === "day") {
      const day = el.dataset.day;
      const days = new Set(s.weekdays || []);
      if (days.has(day)) days.delete(day);
      else days.add(day);
      this._set(entryId, { weekdays: DAYS.filter((d) => days.has(d)) });
    } else if (act === "cycle-trigger") {
      const cur = el.dataset.cur;
      const next = TRIGGERS[(TRIGGERS.indexOf(cur) + 1) % TRIGGERS.length];
      const patch = {};
      patch[el.dataset.key] = next;
      this._set(entryId, patch);
    } else if (act === "offset") {
      const cur = parseInt(el.dataset.cur, 10) || 0;
      const delta = parseInt(el.dataset.delta, 10) || 0;
      const value = Math.max(-180, Math.min(180, cur + delta));
      const patch = {};
      patch[el.dataset.key] = value;
      this._set(entryId, patch);
    }
  }

  static getStubConfig() {
    return { title: "Schedules" };
  }
}

if (!customElements.get("ar-smart-scheduler-card")) {
  customElements.define("ar-smart-scheduler-card", ARSmartSchedulerCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "ar-smart-scheduler-card")) {
  window.customCards.push({
    type: "ar-smart-scheduler-card",
    name: "AR Smart Scheduler Card",
    description: "Add, configure, and remove AR Smart Scheduler schedules entirely from the card: entities, triggers (time/sunrise/sunset), offsets, weekdays, and start/end actions.",
  });
}
