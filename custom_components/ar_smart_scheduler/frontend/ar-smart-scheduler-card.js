/*
 * AR Smart Scheduler Card
 * Bundled with the ar_smart_scheduler integration - no separate install needed.
 *
 * Lovelace config:
 *   type: custom:ar-smart-scheduler-card
 *   title: Schedules            (optional)
 *   entry_id: <entry id>        (optional - show a single scheduler only)
 */

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };
const TRIGGERS = ["time", "sunrise", "sunset"];
const TRIGGER_ICONS = {
  time: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  sunrise: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12,18L14,16H10L12,18Z",
  sunset: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12,16L10,18H14L12,16Z",
};

class ARSmartSchedulerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._schedulers = [];
    this._expanded = new Set();
    this._config = {};
    this._hass = null;
    this._loaded = false;
    this._busy = false;
    this._pollTimer = null;
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
    return Math.max(2, this._schedulers.length * 2);
  }

  connectedCallback() {
    if (this._hass && !this._loaded) this._refresh();
    this._pollTimer = setInterval(() => this._refresh(true), 30000);
  }

  disconnectedCallback() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = null;
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
      this._loaded = true;
      this._render();
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
            <div class="name">${s.name || "Scheduler"}</div>
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
                <div class="targets">${(s.targets || []).map((t) => `<span class="chip">${t}</span>`).join("")}</div>
              </div>`
            : ""
        }
      </div>`;
  }

  _render(error) {
    const title = this._config.title || "AR Smart Scheduler";
    let body;
    if (error) {
      body = `<div class="empty">Could not load schedulers: ${error}</div>`;
    } else if (!this._loaded) {
      body = `<div class="empty">Loading…</div>`;
    } else if (!this._schedulers.length) {
      body = `<div class="empty">No schedulers configured yet.<br>Add one via Settings → Devices &amp; Services → AR Smart Scheduler.</div>`;
    } else {
      body = this._schedulers.map((s) => this._renderScheduler(s)).join("");
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { padding: 12px 16px 16px; }
        .card-title { font-size: 1.15em; font-weight: 500; padding: 4px 0 10px; color: var(--primary-text-color); }
        .empty { color: var(--secondary-text-color); padding: 12px 4px; text-align:center; }
        .sched { border: 1px solid var(--divider-color); border-radius: 12px; margin-bottom: 10px; overflow: hidden; background: var(--card-background-color); }
        .sched.disabled .titleblock, .sched.disabled .body { opacity: 0.55; }
        .row.head { display:flex; align-items:center; gap: 10px; padding: 10px 12px; cursor:pointer; }
        .titleblock { flex:1; min-width:0; }
        .name { font-weight: 500; color: var(--primary-text-color); }
        .sub { font-size: 0.85em; color: var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chev svg { width: 22px; height:22px; fill: var(--secondary-text-color); transition: transform .15s ease; }
        .chev.open svg { transform: rotate(180deg); }
        .body { padding: 4px 12px 12px; border-top: 1px solid var(--divider-color); }
        .days { display:flex; gap: 6px; padding: 10px 0; }
        .day { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--divider-color); background: transparent; color: var(--secondary-text-color); cursor:pointer; font-weight:600; }
        .day.on { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
        .window { margin: 6px 0 10px; }
        .win-label { font-size: 0.8em; text-transform: uppercase; letter-spacing: .05em; color: var(--secondary-text-color); margin-bottom: 6px; }
        .win-cells { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .win-cell { border: 1px solid var(--divider-color); border-radius: 10px; padding: 8px; }
        .win-head { font-size: 0.8em; color: var(--secondary-text-color); margin-bottom: 4px; }
        .trig { display:flex; align-items:center; gap:6px; background:transparent; border:none; color: var(--primary-color); cursor:pointer; padding: 0 0 6px; font-size: 0.9em; }
        .trig-ic { width: 18px; height: 18px; fill: currentColor; }
        input[type="time"] { width: 100%; box-sizing: border-box; background: var(--secondary-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color); border-radius: 8px; padding: 6px; font-size: 1em; }
        .offset { display:flex; align-items:center; justify-content:space-between; gap:6px; }
        .offset button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--divider-color); background: var(--secondary-background-color); color: var(--primary-text-color); cursor:pointer; font-size: 1.1em; }
        .offset span { font-variant-numeric: tabular-nums; }
        .next { font-size: 0.78em; color: var(--secondary-text-color); margin-top: 6px; }
        .warn { font-size: 0.78em; color: var(--error-color, #d32f2f); margin-top: 6px; }
        .secondrow { display:flex; align-items:center; gap: 8px; margin: 4px 0 8px; }
        .secondlabel { color: var(--primary-text-color); font-size: 0.92em; }
        .targets { display:flex; flex-wrap:wrap; gap:6px; margin-top: 4px; }
        .chip { font-size: 0.75em; background: var(--secondary-background-color); color: var(--secondary-text-color); border-radius: 999px; padding: 3px 8px; }
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex: none; }
        .switch.small { width: 38px; height: 21px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position:absolute; inset:0; border-radius: 999px; background: var(--disabled-color, #9e9e9e); transition: .15s; cursor:pointer; }
        .slider:before { content:""; position:absolute; height: 18px; width: 18px; left: 3px; top: 3px; border-radius: 50%; background: #fff; transition: .15s; }
        .switch.small .slider:before { height: 15px; width: 15px; }
        .switch input:checked + .slider { background: var(--primary-color); }
        .switch input:checked + .slider:before { transform: translateX(20px); }
        .switch.small input:checked + .slider:before { transform: translateX(17px); }
      </style>
      <ha-card>
        <div class="card-title">${title}</div>
        ${body}
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("[data-act]").forEach((el) => {
      const act = el.dataset.act;
      if (act === "set-time") {
        el.addEventListener("change", (ev) => this._onTime(ev));
        el.addEventListener("click", (ev) => ev.stopPropagation());
      } else {
        el.addEventListener("click", (ev) => this._onClick(ev, el));
      }
    });
    this.shadowRoot.querySelectorAll("[data-stop]").forEach((el) => {
      el.addEventListener("click", (ev) => ev.stopPropagation());
    });
  }

  _findScheduler(entryId) {
    return this._schedulers.find((s) => s.entry_id === entryId);
  }

  _onTime(ev) {
    const el = ev.currentTarget;
    const value = el.value;
    if (!value) return;
    const patch = {};
    patch[el.dataset.key] = value.length === 5 ? `${value}:00` : value;
    this._set(el.dataset.entry, patch);
  }

  _onClick(ev, el) {
    ev.stopPropagation();
    const act = el.dataset.act;
    const entryId = el.dataset.entry;
    const s = entryId ? this._findScheduler(entryId) : null;

    if (act === "expand") {
      if (this._expanded.has(entryId)) this._expanded.delete(entryId);
      else this._expanded.add(entryId);
      this._render();
      return;
    }
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
    description: "Manage AR Smart Scheduler schedules: enable, weekdays, times, triggers and offsets.",
  });
}
