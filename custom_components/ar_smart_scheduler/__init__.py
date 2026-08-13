from __future__ import annotations

import json
import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, Platform

from .const import (
    DOMAIN,
    FRONTEND_CARD_FILENAME,
    FRONTEND_URL_BASE,
    PLATFORMS,
)
from .scheduler import ARScheduler
from .websocket import async_register_ws

_LOGGER = logging.getLogger(__name__)

_FRONTEND_FLAG = f"{DOMAIN}_frontend_registered"


def _card_version() -> str:
    """Read the integration version out of manifest.json.

    Used purely to cache-bust the bundled card's URL (see below) - never
    fatal if it can't be read, since a missing/odd version just means the
    URL doesn't change between releases, not that the card fails to load.
    """
    try:
        manifest_path = Path(__file__).parent / "manifest.json"
        with manifest_path.open(encoding="utf-8") as manifest_file:
            return str(json.load(manifest_file).get("version") or "0")
    except Exception:  # noqa: BLE001 - best-effort only
        _LOGGER.debug("Could not read manifest.json for card cache-busting", exc_info=True)
        return "0"


async def _async_register_lovelace_resource(hass: HomeAssistant, url: str) -> bool:
    """Register (or update) the card as a real Lovelace resource.

    This closes a gap the cache_headers fix below doesn't: verified against
    home-assistant-frontend's own index.html template, every
    add_extra_js_url() URL is kicked off with a bare `import(...)` inside an
    inline <script> - in the very same script, in the very same breath, as
    the `import(...)` calls that load Home Assistant's own core/app
    bundles. Nothing awaits it and nothing sequences it after HA's frontend;
    it's a flat-out race between "AR Smart Scheduler card finishes
    downloading and executing" and "Lovelace finishes starting up and tries
    to build <ar-smart-scheduler-card>". Whichever wins depends on network
    speed, CPU load and cache state *that particular page load* - which is
    exactly why it's intermittent, why refreshing doesn't reliably fix it
    (same race, re-rolled), and why it can resurface after a full HA restart
    once caches go cold again. cache_headers=True (see below) shortens the
    card's side of that race but can't eliminate it.

    A real Lovelace resource (Settings -> Dashboards -> Resources) isn't
    subject to that race: Lovelace's own dashboard startup code awaits its
    configured resources before it ever tries to build a card that depends
    on one. Auto-registering one here gives the card that guarantee instead
    of relying on add_extra_js_url and hoping the download wins.

    Only possible for storage-mode dashboards (the default - and the only
    mode with an API to add resources through). YAML-mode dashboards keep
    their resources in configuration.yaml, which isn't ours to edit, so this
    returns False there and the caller falls back to add_extra_js_url -
    weaker, but better than nothing for that setup.
    """
    lovelace_data = hass.data.get("lovelace")
    if not lovelace_data:
        return False

    resources = lovelace_data.get("resources")
    if resources is None or not hasattr(resources, "async_create_item"):
        # ResourceYAMLCollection (YAML-mode dashboards) has no create/update
        # API - nothing we can do here short of editing the user's YAML.
        return False

    try:
        if not resources.loaded:
            await resources.async_load()
            resources.loaded = True

        # Match on the URL without its "?v=" cache-buster so a version bump
        # updates the existing resource entry instead of piling up a new one
        # every release.
        base_url = url.split("?", 1)[0]
        existing = next(
            (
                item
                for item in resources.async_items()
                if str(item.get("url", "")).split("?", 1)[0] == base_url
            ),
            None,
        )

        if existing is not None:
            if existing.get("url") != url:
                await resources.async_update_item(existing["id"], {"url": url})
        else:
            await resources.async_create_item({"res_type": "module", "url": url})
    except Exception:  # noqa: BLE001 - never block startup over this
        _LOGGER.exception(
            "Could not auto-register the AR Smart Scheduler card as a Lovelace "
            "resource; falling back to add_extra_js_url"
        )
        return False

    return True


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled Lovelace card so no separate HACS frontend install is needed."""
    if hass.data.get(_FRONTEND_FLAG):
        return
    hass.data[_FRONTEND_FLAG] = True

    frontend_dir = Path(__file__).parent / "frontend"

    # cache_headers=True: browsers may cache this file aggressively. That's
    # safe (and wanted) now that the URL below is version-tagged - a new
    # release gets a new URL, so a cached copy of an old version is never
    # served for a new one. It used to be False, which sounds safer but
    # actually caused a different, worse problem: every single page
    # load/refresh had to fetch this file over the network fresh (nothing
    # was ever allowed to be cached), racing against Lovelace parsing the
    # dashboard and trying to instantiate <ar-smart-scheduler-card>. Win the
    # race (fast network, warm server) and the card renders; lose it (slow
    # network, cold connection, HA busy at startup) and Lovelace gives up
    # waiting for the custom element to be defined and shows "Configuration
    # error" instead - intermittently, since it depends on load timing, not
    # on anything actually being broken. Refreshing again just re-rolls that
    # same race. Letting the browser cache the (correctly versioned) file
    # removes the network fetch from that race almost entirely after the
    # first load.
    try:
        # HA 2024.7+
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(FRONTEND_URL_BASE, str(frontend_dir), cache_headers=True)]
        )
    except ImportError:
        hass.http.register_static_path(FRONTEND_URL_BASE, str(frontend_dir), cache_headers=True)

    # The "?v=<version>" query string is a cache-buster: browsers (and the
    # HA Companion App's webview in particular) key their cache on the full
    # URL, so an unchanging URL can keep serving a stale cached copy of the
    # card indefinitely even after the file on disk has been updated and HA
    # restarted - exactly the "card still shows the old version number"
    # reports this integration has hit release after release. Bumping
    # manifest.json's version (already done for every release) now changes
    # this URL automatically, forcing browsers to fetch the new file instead
    # of relying on everyone remembering to hard-refresh.
    card_url = f"{FRONTEND_URL_BASE}/{FRONTEND_CARD_FILENAME}?v={_card_version()}"

    async def _async_register_resource(_event: Event | None = None) -> None:
        # Prefer a real Lovelace resource (see
        # _async_register_lovelace_resource's docstring for why); only fall
        # back to the racy add_extra_js_url if that's not possible (e.g.
        # YAML-mode dashboards). Deferred to EVENT_HOMEASSISTANT_STARTED
        # because "lovelace" isn't a declared dependency of this integration
        # (making it one would break setups that don't use Lovelace at all)
        # so hass.data["lovelace"] isn't guaranteed to exist yet while our
        # own async_setup is still running - by the time HA has fully
        # started, every component loading this boot already has.
        if not await _async_register_lovelace_resource(hass, card_url):
            add_extra_js_url(hass, card_url)

    if hass.is_running:
        await _async_register_resource()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _async_register_resource)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    async_register_ws(hass)
    await _async_register_frontend(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    scheduler = ARScheduler(hass, entry)

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = scheduler
    entry.async_on_unload(entry.add_update_listener(_async_update_entry))

    await scheduler.async_start()

    await hass.config_entries.async_forward_entry_setups(
        entry, [Platform(p) for p in PLATFORMS]
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(
        entry, [Platform(p) for p in PLATFORMS]
    )

    if unload_ok:
        scheduler: ARScheduler | None = hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
        if scheduler is not None:
            await scheduler.async_stop()

    return unload_ok


async def _async_update_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload scheduler state when config entry data or options change."""
    scheduler: ARScheduler | None = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if scheduler is not None:
        await scheduler.async_reload_from_entry()


# -----------------------------
# MIGRATION HANDLER
# -----------------------------
async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate old entries to new format.

    NOTE: config_flow.py MUST declare VERSION equal to the highest version
    produced here (currently 3). If the flow VERSION is lower than an entry's
    version, Home Assistant refuses to load the entry with a migration error.
    """

    _LOGGER.info(
        "Migrating AR Smart Scheduler entry %s from version %s", entry.entry_id, entry.version
    )

    if entry.version == 1:

        options = dict(entry.options)

        # Add new solar trigger fields safely
        options.setdefault("start_trigger", "time")
        options.setdefault("end_trigger", "time")

        options.setdefault("start_offset", 0)
        options.setdefault("end_offset", 0)

        options.setdefault("second_enabled", False)

        options.setdefault("second_start_trigger", "time")
        options.setdefault("second_end_trigger", "time")

        options.setdefault("second_start_offset", 0)
        options.setdefault("second_end_offset", 0)

        hass.config_entries.async_update_entry(
            entry,
            options=options,
            version=2,
        )

        _LOGGER.info("AR Smart Scheduler entry migrated to version 2")

    if entry.version == 2:
        options = dict(entry.options)
        options.setdefault("device_type", "auto")

        hass.config_entries.async_update_entry(
            entry,
            options=options,
            version=3,
        )

        _LOGGER.info("AR Smart Scheduler entry migrated to version 3")

    return True
