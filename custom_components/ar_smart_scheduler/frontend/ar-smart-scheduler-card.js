/*
 * AR Smart Scheduler Card
 * Bundled with the ar_smart_scheduler integration - no separate install needed.
 *
 * Lovelace config:
 *   type: custom:ar-smart-scheduler-card
 *   title: Schedules            (optional)
 *   entry_id: <entry id>        (optional - show a single scheduler only)
 *   style: aurora-glass         (optional - visual theme, see THEME_CLASSES
 *                                 below. Omit for the original plain look.
 *                                 One of: aurora-glass | material-tonal |
 *                                 slate-executive | nova-vibrant)
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
const CARD_VERSION = "1.8.0";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };
const TRIGGERS = ["time", "sunrise", "sunset"];
const TRIGGER_ICONS = {
  time: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  sunrise: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12,18L14,16H10L12,18Z",
  sunset: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12,16L10,18H14L12,16Z",
};

// Per-device-type icon + accent color, used only by the optional visual
// themes (see THEME_CLASSES) to draw a colored icon badge on each schedule's
// header and tint its toggle/day-pills/chips. Keyed by the same resolved
// device_type values as ACTION_SPECS (never "auto"). Falls back to the
// "onoff" entry for any device_type not listed here.
const DEVICE_ICONS = {
  cover: "M2,21H4V11L12,4L20,11V21H22V22H2V21M6,19H18V12.11L12,6.83L6,12.11V19M8,14H16V16H8V14M8,17H13V19H8V17Z",
  light: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  climate: "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 1,0 15,13M12,4A1,1 0 0,1 13,5H12V6.5H13V8H12V9.5H13V11H12V13.5A1.5,1.5 0 1,1 11,13.5V5A1,1 0 0,1 12,4Z",
  water_heater: "M17.66,11.2C17.43,10.9 17.15,10.64 16.89,10.38C16.22,9.78 15.46,9.35 14.82,8.72C13.33,7.26 13,4.85 13.95,3C13,3.23 12.17,3.75 11.46,4.32C8.87,6.4 7.85,10.07 9.07,13.22C9.11,13.32 9.15,13.42 9.15,13.55C9.15,13.77 9,13.97 8.8,14.05C8.57,14.15 8.33,14.09 8.14,13.93C8.08,13.88 8.04,13.83 8,13.76C6.87,12.33 6.69,10.28 7.45,8.64C5.78,10 4.87,12.3 5,14.47C5.06,14.97 5.12,15.47 5.29,15.97C5.43,16.57 5.7,17.17 6,17.7C7.08,19.43 8.95,20.67 10.96,20.92C13.1,21.19 15.39,20.8 17.03,19.32C18.86,17.66 19.5,15 18.56,12.72L18.43,12.46C18.22,12 17.66,11.2 17.66,11.2M14.5,17.5C14.22,17.74 13.76,18 13.4,18.1C12.28,18.5 11.16,17.94 10.5,17.28C11.69,17 12.4,16.12 12.61,15.23C12.78,14.43 12.46,13.77 12.33,13C12.21,12.26 12.23,11.63 12.5,10.94C12.69,11.32 12.89,11.7 13.13,12C13.9,13 15.11,13.44 15.37,14.8C15.41,14.94 15.43,15.08 15.43,15.23C15.46,16.05 15.1,16.95 14.5,17.5H14.5Z",
  lock: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
  onoff: "M17,7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7M17,15A3,3 0 0,1 14,12A3,3 0 0,1 17,9A3,3 0 0,1 20,12A3,3 0 0,1 17,15Z",
};
const DOMAIN_COLORS = {
  cover: "#3b82f6",
  light: "#f5a623",
  climate: "#f97066",
  water_heater: "#fb923c",
  lock: "#b794f4",
  onoff: "#2dd4bf",
};

// Optional per-card visual themes, set via the "style" Lovelace config key
// (see the header comment). Each maps to a CSS class added to <ha-card>;
// the actual rules live in _render()'s <style> block under the matching
// "ha-card.theme-*" selectors. No "style" configured (or an unrecognized
// value) keeps the original plain look untouched, so existing dashboards
// never change unless someone opts in.
const THEME_CLASSES = {
  "aurora-glass": "theme-glass",
  "material-tonal": "theme-material",
  "slate-executive": "theme-slate",
  "nova-vibrant": "theme-vibrant",
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
    // Color is a separate, combinable knob on top of the on/off/brightness
    // action (a schedule can dim AND set a color at the same time, just
    // like calling light.turn_on with both brightness_pct and rgb_color).
    // devicePrefix + extraFields let _buildActionPatch() generically carry
    // these fields through untouched whenever some *other* light field
    // (the action dropdown, the brightness stepper) is edited - otherwise
    // that patch would only include action+brightness and the backend would
    // reset color back to "none" every time brightness was nudged.
    devicePrefix: "light",
    extraFields: ["color_mode", "rgb_color", "color_temp_kelvin", "effect"],
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

// Optional color control layered on top of a light's on/off/brightness
// action - mirrors const.py's LIGHT_COLOR_MODES. "none" keeps the plain
// on/off-with-brightness behavior; the other three each show one matching
// control (see _lightColorHtml).
const LIGHT_COLOR_MODES = ["none", "color", "color_temp", "effect"];
const LIGHT_COLOR_MODE_LABELS = {
  none: "Plain on/off",
  color: "RGB color",
  color_temp: "White (color temp)",
  effect: "Effect",
};
const LIGHT_COLOR_TEMP_MIN_KELVIN = 2000;
const LIGHT_COLOR_TEMP_MAX_KELVIN = 6500;

// 'change'-based fields (commit on blur/selection), matching the existing
// time-input convention, so typing a name never gets wiped mid-keystroke by
// a re-render. The entity picker (.entinput/.entrow) is wired separately in
// _wireEntityPickers() since it needs live 'input' filtering, not 'change'.
const CHANGE_ACTS = new Set([
  "set-time",
  "rename",
  "add-name",
  "action-select",
  "add-devtype",
  "devtype",
  "light-color-mode",
  "light-color-rgb",
  "light-effect",
]);

// If the backend never replies to a websocket call - a bug in the handler
// that swallows an exception without responding, a stuck/dropped connection,
// whatever - hass.callWS()'s promise just never resolves or rejects. Nothing
// in the browser console reports that ("no response" isn't an error), and
// the card (and Lovelace's "Add Card" preview tile, which renders this card
// live) sits on its loading state forever with zero clue why. This caps how
// long any single call is allowed to hang before the card gives up and shows
// an actual, diagnosable error instead of spinning silently.
const WS_TIMEOUT_MS = 15000;

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

    // Visible error banner for background calls (toggle/rename/add-entity/
    // action edits) that fail after the picker has already closed - without
    // this, a rejected websocket call (duplicate name+entities, an entity
    // domain the backend doesn't support, a dropped connection, ...) was
    // only ever logged to the browser console (see the old catch blocks in
    // _set/_setGeneral/_setActions/_deleteScheduler), so from the user's
    // seat the UI just silently did nothing - indistinguishable from the
    // dropdown itself being broken.
    this._toast = "";
    this._toastTimer = null;

    // The entity-picker dropdown is rendered as a "portal" appended directly
    // to document.body (see _ensurePortal), not inside this card's own
    // shadow DOM. A plain `position: fixed` element only anchors to the
    // true viewport when NONE of its ancestors set a transform / filter /
    // perspective / contain / container-type - but modern Lovelace
    // "Sections" dashboards wrap every card in an element that sets
    // `container-type` (for card container queries) and/or CSS containment,
    // which silently turns that ancestor into the fixed element's
    // containing block instead. The dropdown then renders far from the
    // input - sometimes fully off-screen - which looks exactly like "no
    // dropdown appears at all". Appending it to document.body sidesteps any
    // such ancestor entirely, regardless of which dashboard layout hosts
    // this card.
    this._portalHost = null;
    this._portalDropdown = null;
    this._portalFormId = null;
    this._portalInput = null;
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

    // Closes the entity-picker dropdown when the user taps/clicks anywhere
    // outside it (including outside the card entirely) - the dropdown
    // itself doesn't otherwise know to collapse, since opening it is a
    // plain DOM toggle done without a full _render() (see
    // _wireEntityPickers) so typing isn't interrupted mid-keystroke. The
    // dropdown lives in a body-level portal (see _ensurePortal), not inside
    // this card's shadow root, but composedPath() still reports it (and the
    // shadow-root-internal input) correctly since it pierces shadow
    // boundaries for composed events like click.
    this._outsideClickHandler = (ev) => {
      if (!this._portalDropdown || !this._portalDropdown.classList.contains("open")) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      const insidePortal = this._portalHost && path.includes(this._portalHost);
      const insideInput = this._portalInput && path.includes(this._portalInput);
      if (!insidePortal && !insideInput) this._closePortal();
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
    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }
    // The portal lives outside this element's own DOM subtree (appended to
    // document.body - see _ensurePortal), so it isn't cleaned up
    // automatically when the card itself is removed (e.g. a dashboard
    // reload while editing the layout). Remove it explicitly to avoid
    // leaking a detached-from-the-card host element into the page.
    if (this._portalHost && this._portalHost.parentNode) {
      this._portalHost.parentNode.removeChild(this._portalHost);
    }
    this._portalHost = null;
    this._portalDropdown = null;
    this._portalFormId = null;
    this._portalInput = null;
  }

  _isEditingText() {
    const root = this.shadowRoot;
    const el = root && root.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" && el.type !== "checkbox";
  }

  // Races hass.callWS() against a timeout so a backend that never replies
  // (see the WS_TIMEOUT_MS comment above) fails loudly instead of hanging
  // the caller forever.
  _callWS(msg) {
    const call = this._hass.callWS(msg);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for the backend (${msg.type}). Check Settings → System → Logs for an ar_smart_scheduler error, and confirm the integration is set up under Settings → Devices & Services.`
          )
        );
      }, WS_TIMEOUT_MS);
      call.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  async _refresh(silent) {
    if (!this._hass || this._busy) return;
    this._busy = true;
    try {
      const resp = await this._callWS({ type: "ar_smart_scheduler/list" });
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

  // Puts a failed background call in front of the user instead of only the
  // browser console. Before this, a rejected websocket call here (a
  // duplicate name+entities combo, an unsupported entity domain, a dropped
  // connection, ...) was silent from the user's seat: the picker/toggle/
  // stepper they just used simply appeared to do nothing, which is
  // impossible to tell apart from the control itself being broken.
  _notifyError(err) {
    const msg = (err && err.message) || String(err);
    this._toast = msg;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast = "";
      this._render();
    }, 8000);
  }

  async _set(entryId, patch) {
    if (!this._hass) return;
    try {
      await this._callWS(
        Object.assign({ type: "ar_smart_scheduler/set_options", entry_id: entryId }, patch)
      );
    } catch (err) {
      console.error("ar-smart-scheduler-card set_options failed", err);
      this._notifyError(err);
    }
    await this._refresh();
  }

  async _setGeneral(entryId, patch) {
    if (!this._hass) return;
    try {
      await this._callWS(
        Object.assign({ type: "ar_smart_scheduler/set_general", entry_id: entryId }, patch)
      );
    } catch (err) {
      console.error("ar-smart-scheduler-card set_general failed", err);
      this._notifyError(err);
    }
    await this._refresh();
  }

  async _setActions(entryId, patch) {
    if (!this._hass) return;
    try {
      await this._callWS(
        Object.assign({ type: "ar_smart_scheduler/set_actions", entry_id: entryId }, patch)
      );
    } catch (err) {
      console.error("ar-smart-scheduler-card set_actions failed", err);
      this._notifyError(err);
    }
    await this._refresh();
  }

  async _deleteScheduler(entryId) {
    if (!this._hass) return;
    try {
      await this._callWS({ type: "ar_smart_scheduler/delete", entry_id: entryId });
    } catch (err) {
      console.error("ar-smart-scheduler-card delete failed", err);
      this._notifyError(err);
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
      const resp = await this._callWS({
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
    // No inline .entdropdown here anymore - it's a single reusable portal
    // appended to document.body (see _ensurePortal/_openPortal) so it can
    // never be mispositioned or clipped by a dashboard's own card wrapper.
    // `exclude` isn't needed at render time either: the portal's content is
    // (re)built from live state the moment it's opened/typed into (see
    // _openPortal/_updatePortalContent via _excludeFor), so a stale
    // pre-rendered exclude list can never linger after a re-render.
    return `
      <div class="entpicker">
        <input type="text" class="entinput" placeholder="+ add entity… (tap to browse)" data-form="${this._esc(formId)}"
               autocomplete="off" autocapitalize="off" spellcheck="false">
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

  // The dropdown is a position:fixed overlay, appended to document.body via
  // _ensurePortal() rather than sitting in normal document flow inside this
  // card. Earlier revisions kept it in-flow inside the card's own shadow
  // DOM, which had failure modes that all looked identical from the user's
  // seat - "no dropdown appears": an ancestor with overflow/height
  // constraints (e.g. a dashboard grid section) could clip it entirely, the
  // on-screen keyboard could cover it below the fold, and - the one that
  // slipped through even after switching to `position: fixed` - a modern
  // Lovelace "Sections" dashboard wraps every card in an element that sets
  // `container-type`/CSS containment, which becomes the fixed element's
  // containing block instead of the viewport, throwing this exact math off
  // by however far that wrapper is offset. Rendering into a body-level
  // portal removes the card's own DOM (and whatever wraps it) from the
  // equation entirely: nothing between the portal and <body> can intercept
  // fixed positioning that this card doesn't itself control. This function
  // still just computes screen coordinates from the input's real position
  // and opens the dropdown above the input instead of below when there
  // isn't room underneath.
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

  // Re-run positioning for the currently-open dropdown - used on
  // scroll/resize (registered in connectedCallback) and after a short delay
  // following focus, since mobile browsers auto-scroll a focused input into
  // view (to clear the on-screen keyboard) slightly *after* focus fires,
  // which would otherwise leave a just-opened dropdown anchored to the
  // input's pre-scroll position.
  _repositionOpenDropdowns() {
    if (this._portalDropdown && this._portalDropdown.classList.contains("open") && this._portalInput) {
      this._positionDropdown(this._portalInput, this._portalDropdown);
    }
  }

  // Lazily creates the single reusable dropdown "portal": a host element
  // appended directly to document.body (never inside this card's own DOM,
  // wherever a dashboard happens to have placed it), with its own shadow
  // root so the dropdown's styling stays self-contained instead of leaking
  // rules into the rest of the page. See the constructor's _portalHost
  // comment for *why* it needs to live outside the card at all - in short,
  // `position: fixed` only anchors to the real viewport when nothing
  // between it and <body> establishes its own containing block, and a
  // dashboard's card wrapper can't do that to an element it never contains.
  _ensurePortal() {
    if (this._portalDropdown) return this._portalDropdown;

    const host = document.createElement("div");
    host.setAttribute("data-ar-smart-scheduler-portal", "");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .entdropdown { display:none; position: fixed; box-sizing: border-box; border: 1px solid var(--divider-color); border-radius: 10px; overflow-y: auto; background: var(--secondary-background-color); color: var(--primary-text-color); box-shadow: 0 4px 18px rgba(0,0,0,0.35); -webkit-overflow-scrolling: touch; z-index: 2147483000; font-family: var(--paper-font-body1_-_font-family, Roboto, "Noto Sans", sans-serif); font-size: 16px; }
        .entdropdown.open { display:block; }
        .entgroup:not(:last-child) { border-bottom: 1px solid var(--divider-color); }
        .entgroup-header { position: sticky; top: 0; z-index: 1; display:flex; align-items:center; justify-content:space-between; gap:6px; padding: 6px 12px; background: var(--card-background-color); color: var(--secondary-text-color); font-size: 0.72em; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
        .entgroup-count { color: var(--secondary-text-color); font-size: 0.95em; font-weight: 400; text-transform: none; letter-spacing: normal; opacity: 0.7; }
        .entrow { display:flex; align-items:center; width:100%; box-sizing:border-box; padding: 11px 12px; background:transparent; border:none; border-bottom:1px solid var(--divider-color); text-align:left; cursor:pointer; font-family:inherit; -webkit-tap-highlight-color: rgba(0,0,0,0.15); }
        .entgroup .entrow:last-child { border-bottom:none; }
        .entrow:hover, .entrow:active { background: var(--card-background-color); }
        .entname { color: var(--primary-text-color); font-size: 0.95em; }
        .entempty, .entmore { padding: 10px 12px; color: var(--secondary-text-color); font-size: 0.85em; }
      </style>
      <div class="entdropdown"></div>`;

    // Delegated click handler - rows are re-rendered wholesale on every
    // open/type (see _openPortal/_updatePortalContent), so one listener on
    // the container is simpler and cheaper than rewiring each row.
    root.addEventListener("click", (ev) => {
      const row = ev.target && ev.target.closest ? ev.target.closest(".entrow") : null;
      if (!row) return;
      ev.stopPropagation();
      this._pickEntity(row.dataset.form, row.dataset.ent);
      this._closePortal();
    });

    this._portalHost = host;
    this._portalDropdown = root.querySelector(".entdropdown");
    return this._portalDropdown;
  }

  _openPortal(formId, input) {
    const dropdown = this._ensurePortal();
    this._portalFormId = formId;
    this._portalInput = input;
    dropdown.innerHTML = this._entityRows(formId, this._excludeFor(formId), "");
    dropdown.classList.add("open");
    this._positionDropdown(input, dropdown);
    if (typeof window.setTimeout === "function") {
      window.setTimeout(() => this._repositionOpenDropdowns(), 350);
    }
  }

  _updatePortalContent(formId, search) {
    if (!this._portalDropdown || this._portalFormId !== formId) return;
    this._portalDropdown.innerHTML = this._entityRows(formId, this._excludeFor(formId), search);
    this._portalDropdown.classList.add("open");
    if (this._portalInput) this._positionDropdown(this._portalInput, this._portalDropdown);
  }

  _closePortal() {
    if (this._portalDropdown) this._portalDropdown.classList.remove("open");
    this._portalFormId = null;
    this._portalInput = null;
  }

  _excludeFor(formId) {
    if (formId === "new") return this._addSelected;
    const s = this._findScheduler(formId);
    return (s && s.targets) || [];
  }

  _wireEntityPickers() {
    this.shadowRoot.querySelectorAll(".entpicker").forEach((picker) => {
      const input = picker.querySelector(".entinput");
      if (!input) return;
      const formId = input.dataset.form;

      input.addEventListener("focus", (ev) => {
        ev.stopPropagation();
        this._openPortal(formId, input);
      });
      input.addEventListener("click", (ev) => ev.stopPropagation());
      input.addEventListener("input", () => {
        this._updatePortalContent(formId, input.value);
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
      // Color/effect controls are a light-only extra, layered on top of
      // whatever the on/off/brightness action above is doing - they only
      // make sense while the light is actually being turned on.
      const colorHtml = s.device_type === "light" && actionVal !== "off" ? this._lightColorHtml(s, sideKey, a) : "";
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
          ${colorHtml}
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

  _rgbToHex(rgb) {
    const clamp = (n) => Math.max(0, Math.min(255, parseInt(n, 10) || 0));
    return "#" + (rgb || [255, 255, 255]).map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
  }

  _hexToRgb(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m) return [255, 255, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  // Effects are entity-specific (a strip light's "Rainbow"/"Twinkle" list
  // has nothing to do with a downlight's), so instead of a fixed list the
  // dropdown is built from whatever the actual target entities currently
  // report via their `effect_list` attribute. Multiple targets get the
  // union of everything any of them supports.
  _effectListFor(targets) {
    if (!this._hass) return [];
    const set = new Set();
    (targets || []).forEach((id) => {
      const st = this._hass.states[id];
      const list = st && st.attributes && st.attributes.effect_list;
      if (Array.isArray(list)) {
        list.forEach((e) => {
          if (typeof e === "string") set.add(e);
        });
      }
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  // Color mode is a separate knob from the on/off/brightness action above
  // (see ACTION_SPECS.light's devicePrefix/extraFields comment) - "none"
  // keeps the light's current color untouched, the other three each render
  // one matching control. `a` is the schedule's raw actions object
  // (generic "start_x"/"end_x" keys, same as the rest of _actionsSection),
  // not the device-prefixed wire format used when patching the backend.
  _lightColorHtml(s, sideKey, a) {
    const mode = a[`${sideKey}_color_mode`] || "none";
    const rgbRaw = a[`${sideKey}_rgb_color`];
    const rgb = Array.isArray(rgbRaw) && rgbRaw.length === 3 ? rgbRaw : [255, 255, 255];
    const kelvin = a[`${sideKey}_color_temp_kelvin`] || LIGHT_COLOR_TEMP_MIN_KELVIN;
    const effect = a[`${sideKey}_effect`] || "";
    const hex = this._rgbToHex(rgb);
    const effectList = this._effectListFor(s.targets);

    const modeSelect = `
      <select data-act="light-color-mode" data-entry="${s.entry_id}" data-side="${sideKey}">
        ${LIGHT_COLOR_MODES.map((m) => `<option value="${m}" ${m === mode ? "selected" : ""}>${LIGHT_COLOR_MODE_LABELS[m]}</option>`).join("")}
      </select>`;

    let extra = "";
    if (mode === "color") {
      extra = `
        <div class="color-row">
          <input type="color" value="${hex}" data-act="light-color-rgb" data-entry="${s.entry_id}" data-side="${sideKey}">
          <span class="color-hex">${hex}</span>
        </div>`;
    } else if (mode === "color_temp") {
      extra = `
        <div class="offset">
          <button data-act="light-color-temp" data-entry="${s.entry_id}" data-side="${sideKey}" data-delta="-100" data-cur="${kelvin}">−</button>
          <span>${kelvin}K</span>
          <button data-act="light-color-temp" data-entry="${s.entry_id}" data-side="${sideKey}" data-delta="100" data-cur="${kelvin}">+</button>
        </div>`;
    } else if (mode === "effect") {
      extra = effectList.length
        ? `<select data-act="light-effect" data-entry="${s.entry_id}" data-side="${sideKey}">
             <option value="">Choose effect…</option>
             ${effectList.map((e) => `<option value="${this._esc(e)}" ${e === effect ? "selected" : ""}>${this._esc(e)}</option>`).join("")}
           </select>`
        : `<div class="hint">No effects reported yet - turn the light on once, then reopen this card.</div>`;
    }

    return `<div class="color-block">${modeSelect}${extra}</div>`;
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

    // Only used by the optional themes (THEME_CLASSES) - harmless to compute
    // unconditionally since the badge itself is display:none unless a theme
    // class is present on <ha-card>.
    const domainIcon = DEVICE_ICONS[s.device_type] || DEVICE_ICONS.onoff;
    const domainColor = DOMAIN_COLORS[s.device_type] || DOMAIN_COLORS.onoff;

    return `
      <div class="sched ${s.enabled ? "" : "disabled"}" style="--dom:${domainColor}">
        <div class="row head" data-act="expand" data-entry="${s.entry_id}">
          <div class="icon-badge">${this._icon(domainIcon, "badge-ic")}</div>
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
    // Any input the portal dropdown was anchored to is about to be replaced
    // (shadowRoot.innerHTML = ... below), so close it first rather than
    // leaving it open and pointed at a detached element.
    this._closePortal();

    const title = this._config.title || "AR Smart Scheduler";
    const themeClass = THEME_CLASSES[this._config.style] || "";
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
        .toast { display:flex; align-items:center; justify-content:space-between; gap:10px; background: color-mix(in srgb, var(--error-color, #d32f2f) 12%, var(--card-background-color)); color: var(--primary-text-color); border: 1px solid var(--error-color, #d32f2f); border-radius: 10px; padding: 8px 10px; margin: -2px 0 10px; font-size: 0.88em; }
        .toast button { background:transparent; border:none; color: var(--error-color, #d32f2f); font-size: 1.2em; line-height:1; cursor:pointer; padding: 0 2px; flex: none; }
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
        /* The dropdown itself is a body-level portal, not part of this
           stylesheet - see _ensurePortal(). Its rows/groups/etc. get their
           own self-contained <style> there so they render identically no
           matter what dashboard layout hosts this card. */
        .offset { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top: 6px; }
        .color-block { display:flex; flex-direction:column; gap:6px; margin-top: 8px; }
        .color-row { display:flex; align-items:center; gap:8px; }
        input[type="color"] { width: 44px; height: 32px; padding: 2px; flex: none; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--secondary-background-color); cursor:pointer; }
        .color-hex { font-family: monospace; font-size: 0.85em; color: var(--secondary-text-color); text-transform: uppercase; }
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

        /* ==================================================================
           Optional visual themes - activated via the "style" config key
           (see THEME_CLASSES). Hidden/no-op unless one of the
           "ha-card.theme-*" classes below is present, so the default look
           above is completely unaffected for anyone who hasn't opted in.
           Each theme only re-skins existing elements (colors, radii,
           shadows, the icon-badge) - no structure or behavior changes.
           Colors read the per-schedule "--dom" custom property (set inline
           on .sched by _renderScheduler) so each card tints itself by its
           device type. color-mix() drives the tonal blends; every rule that
           uses it also declares a flat fallback color first so a webview
           without color-mix support (older Android/iOS HA Companion App
           builds) still gets a sensible color instead of a blank one. ================================================================== */
        .icon-badge { display:none; width:40px; height:40px; border-radius:12px; align-items:center; justify-content:center; flex:none; }
        .badge-ic { width:22px; height:22px; }

        /* ---- Aurora Glass: dark glassmorphism, glowing per-domain accents ---- */
        ha-card.theme-glass { background: radial-gradient(500px 260px at 10% 0%, rgba(125,211,252,.14), transparent 60%), radial-gradient(420px 220px at 100% 10%, rgba(232,121,249,.10), transparent 55%), var(--card-background-color); }
        ha-card.theme-glass .toolbar button { background: #7dd3fc; background: linear-gradient(135deg,#7dd3fc,#a78bfa); color:#0a0d14; box-shadow: 0 6px 18px rgba(125,211,252,.35); }
        ha-card.theme-glass .sched { background: rgba(127,127,127,.07); border:1px solid rgba(127,127,127,.18); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 10px 26px rgba(0,0,0,.25); border-radius:16px; }
        ha-card.theme-glass .sched:not(.disabled) { box-shadow: 0 10px 26px rgba(0,0,0,.3), 0 0 0 1px color-mix(in srgb, var(--dom) 30%, transparent), 0 0 20px -8px color-mix(in srgb, var(--dom) 55%, transparent); }
        ha-card.theme-glass .icon-badge { display:flex; background: var(--dom); background: linear-gradient(135deg, color-mix(in srgb, var(--dom) 85%, white), color-mix(in srgb, var(--dom) 55%, black)); box-shadow: 0 4px 14px -2px color-mix(in srgb, var(--dom) 65%, transparent); }
        ha-card.theme-glass .badge-ic { fill:#fff; }
        ha-card.theme-glass .day { background: rgba(127,127,127,.1); border-color: rgba(127,127,127,.2); }
        ha-card.theme-glass .day.on { background: var(--dom); background: color-mix(in srgb, var(--dom) 70%, transparent); border-color: transparent; color:#fff; }
        ha-card.theme-glass .win-cell, ha-card.theme-glass .act-cell { background: rgba(127,127,127,.06); border-color: rgba(127,127,127,.16); border-radius:12px; }
        ha-card.theme-glass .trig { color: var(--dom); color: color-mix(in srgb, var(--dom) 80%, white); }
        ha-card.theme-glass .switch input:checked + .slider { background: var(--dom); background: linear-gradient(135deg, var(--dom), color-mix(in srgb, var(--dom) 55%, #a78bfa)); box-shadow: 0 0 12px -2px color-mix(in srgb, var(--dom) 65%, transparent); }
        ha-card.theme-glass .chip { background: rgba(127,127,127,.14); }
        ha-card.theme-glass .addform { background: rgba(127,127,127,.07); border-color: rgba(127,127,127,.18); border-radius:16px; }

        /* ---- Material Tonal: light, rounded, Material-You-style tonal surfaces ---- */
        ha-card.theme-material .sched { background:#fff; border:none; border-radius:22px; box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.08); }
        ha-card.theme-material .name-input, ha-card.theme-material .secondlabel, ha-card.theme-material .confirm-text { color:#1d1b20; }
        ha-card.theme-material .sub, ha-card.theme-material .win-head, ha-card.theme-material .win-label, ha-card.theme-material .manage-label, ha-card.theme-material .next, ha-card.theme-material .hint { color:#79747e; }
        ha-card.theme-material .chev svg { fill:#79747e; }
        ha-card.theme-material .icon-badge { display:flex; background:#f5a623; background: color-mix(in srgb, var(--dom) 16%, white); border-radius:14px; }
        ha-card.theme-material .badge-ic { fill:#79747e; fill: color-mix(in srgb, var(--dom) 75%, black); }
        ha-card.theme-material .toolbar button { background:#6750a4; color:#fff; border-radius:20px; box-shadow: 0 3px 8px rgba(103,80,164,.35); }
        ha-card.theme-material .day { background:#f2edf7; border:none; color:#79747e; }
        ha-card.theme-material .day.on { background:#1d1b20; background: color-mix(in srgb, var(--dom) 85%, black); color:#fff; }
        ha-card.theme-material .win-cell, ha-card.theme-material .act-cell { border:none; border-radius:16px; background:#faf8fc; background: color-mix(in srgb, var(--dom) 8%, white); }
        ha-card.theme-material .trig { color:#6750a4; color: color-mix(in srgb, var(--dom) 70%, black); }
        ha-card.theme-material .switch input:checked + .slider { background: var(--dom); }
        ha-card.theme-material .chip { background:#f2edf7; color:#49454f; }
        ha-card.theme-material .manage { border-top-color:#ece6f0; }
        ha-card.theme-material .addform { background:#fff; border:none; border-radius:22px; box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.08); }

        /* ---- Slate Executive: minimal, compact, colored rail instead of blocks ---- */
        ha-card.theme-slate .sched { background: rgba(127,127,127,.03); border:1px solid var(--divider-color); border-left:3px solid var(--dom); border-radius:10px; box-shadow:none; }
        ha-card.theme-slate .sched.disabled { border-left-color: var(--divider-color); }
        ha-card.theme-slate .icon-badge { display:flex; border-radius:10px; border:1px solid var(--divider-color); background:transparent; }
        ha-card.theme-slate .badge-ic { fill: var(--secondary-text-color); }
        ha-card.theme-slate .toolbar button { background:transparent; color: var(--primary-text-color); border:1px solid var(--divider-color); border-radius:8px; box-shadow:none; }
        ha-card.theme-slate .day { background:transparent; }
        ha-card.theme-slate .day.on { background: var(--primary-text-color); color: var(--card-background-color); border-color: var(--primary-text-color); }
        ha-card.theme-slate .win-cell, ha-card.theme-slate .act-cell { border-radius:8px; box-shadow:none; }
        ha-card.theme-slate .trig { color: var(--primary-text-color); }
        ha-card.theme-slate .switch input:checked + .slider { background: var(--primary-text-color); }
        ha-card.theme-slate .switch input:checked + .slider:before { background: var(--card-background-color); }
        ha-card.theme-slate .chip { background:transparent; border:1px solid var(--divider-color); }
        ha-card.theme-slate .addform { border-radius:10px; box-shadow:none; }

        /* ---- Nova Vibrant: bold gradient banners, glowing circular badges ---- */
        ha-card.theme-vibrant .sched { background: rgba(127,127,127,.05); border:1px solid rgba(127,127,127,.16); border-radius:14px; box-shadow:0 8px 20px rgba(0,0,0,.18); overflow:hidden; }
        ha-card.theme-vibrant .row.head { background: linear-gradient(120deg, color-mix(in srgb, var(--dom) 30%, transparent), transparent 75%); }
        ha-card.theme-vibrant .icon-badge { display:flex; border-radius:50%; background: var(--dom); background: linear-gradient(135deg, var(--dom), color-mix(in srgb, var(--dom) 40%, #845ef7)); box-shadow: 0 0 0 4px color-mix(in srgb, var(--dom) 18%, transparent); }
        ha-card.theme-vibrant .badge-ic { fill:#fff; }
        ha-card.theme-vibrant .toolbar button { background:#ff6b9d; background: linear-gradient(135deg,#ff6b9d,#845ef7); color:#fff; box-shadow: 0 6px 20px -4px rgba(255,107,157,.5); }
        ha-card.theme-vibrant .day.on { background: var(--dom); background: linear-gradient(135deg, var(--dom), #845ef7); color:#fff; border-color:transparent; }
        ha-card.theme-vibrant .win-cell, ha-card.theme-vibrant .act-cell { border-radius:14px; }
        ha-card.theme-vibrant .trig { color: var(--dom); }
        ha-card.theme-vibrant .switch input:checked + .slider { background: var(--dom); background: linear-gradient(135deg, var(--dom), #845ef7); }
        ha-card.theme-vibrant .chip { background: rgba(127,127,127,.16); }
        ha-card.theme-vibrant .addform { border-radius:14px; box-shadow:0 8px 20px rgba(0,0,0,.18); }
      </style>
      <ha-card class="${themeClass}">
        <div class="card-title-row">
          <div class="card-title">${title}</div>
          <div class="card-version">v${CARD_VERSION}</div>
        </div>
        ${
          this._toast
            ? `<div class="toast">
                 <span>${this._esc(this._toast)}</span>
                 <button type="button" data-act="toast-dismiss" title="Dismiss">×</button>
               </div>`
            : ""
        }
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
    // Carries fields that aren't part of the coarse action/value pair above
    // straight through untouched (e.g. a light's color_mode/rgb_color/
    // color_temp_kelvin/effect) - without this, patching just the action or
    // the brightness stepper would send the backend only those two fields,
    // and it would reset everything else this spec owns back to its
    // default (wiping a chosen color back to "none") on every unrelated
    // edit.
    if (spec.extraFields && spec.devicePrefix) {
      spec.extraFields.forEach((field) => {
        ["start", "end"].forEach((side) => {
          const genericKey = `${side}_${field}`;
          const wireKey = `${spec.devicePrefix}_${side}_${field}`;
          patch[wireKey] = overrides[genericKey] !== undefined ? overrides[genericKey] : a[genericKey];
        });
      });
    }
    return patch;
  }

  // Updates one light color field (color_mode / rgb_color /
  // color_temp_kelvin / effect) for one side (start/end) of a schedule,
  // preserving every other action field via _buildActionPatch's
  // extraFields handling above.
  _setLightColorField(s, sideKey, field, value) {
    const spec = ACTION_SPECS.light;
    const overrides = { [`${sideKey}_${field}`]: value };
    const patch = this._buildActionPatch(s, spec, overrides);
    this._setActions(s.entry_id, patch);
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

    if (act === "light-color-mode") {
      const s = this._findScheduler(el.dataset.entry);
      if (!s) return;
      this._setLightColorField(s, el.dataset.side, "color_mode", el.value);
      return;
    }

    if (act === "light-color-rgb") {
      const s = this._findScheduler(el.dataset.entry);
      if (!s) return;
      this._setLightColorField(s, el.dataset.side, "rgb_color", this._hexToRgb(el.value));
      return;
    }

    if (act === "light-effect") {
      const s = this._findScheduler(el.dataset.entry);
      if (!s) return;
      this._setLightColorField(s, el.dataset.side, "effect", el.value);
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

    if (act === "toast-dismiss") {
      this._toast = "";
      if (this._toastTimer) {
        clearTimeout(this._toastTimer);
        this._toastTimer = null;
      }
      this._render();
      return;
    }

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

    if (act === "light-color-temp") {
      const s = this._findScheduler(entryId);
      if (!s) return;
      const cur = parseInt(el.dataset.cur, 10) || LIGHT_COLOR_TEMP_MIN_KELVIN;
      const delta = parseInt(el.dataset.delta, 10) || 0;
      const next = Math.max(LIGHT_COLOR_TEMP_MIN_KELVIN, Math.min(LIGHT_COLOR_TEMP_MAX_KELVIN, cur + delta));
      this._setLightColorField(s, el.dataset.side, "color_temp_kelvin", next);
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
