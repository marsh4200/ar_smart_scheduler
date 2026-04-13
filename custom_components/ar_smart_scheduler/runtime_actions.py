from __future__ import annotations

from .const import (
    CONF_CLIMATE_END_ACTION,
    CONF_CLIMATE_END_TEMPERATURE,
    CONF_CLIMATE_START_ACTION,
    CONF_CLIMATE_START_TEMPERATURE,
    CONF_COVER_END_ACTION,
    CONF_COVER_END_POSITION,
    CONF_COVER_START_ACTION,
    CONF_COVER_START_POSITION,
    CONF_DEVICE_TYPE,
    CONF_END_DATA,
    CONF_END_SERVICE,
    CONF_LIGHT_END_ACTION,
    CONF_LIGHT_END_BRIGHTNESS,
    CONF_LIGHT_START_ACTION,
    CONF_LIGHT_START_BRIGHTNESS,
    CONF_LOCK_END_ACTION,
    CONF_LOCK_START_ACTION,
    CONF_START_DATA,
    CONF_START_SERVICE,
    CONF_TARGET_ENTITY,
    CONF_WATER_HEATER_END_ACTION,
    CONF_WATER_HEATER_END_TEMPERATURE,
    CONF_WATER_HEATER_START_ACTION,
    CONF_WATER_HEATER_START_TEMPERATURE,
    COVER_ACTION_TO_SERVICE,
    DEFAULT_CLIMATE_END_ACTION,
    DEFAULT_CLIMATE_END_TEMPERATURE,
    DEFAULT_CLIMATE_START_ACTION,
    DEFAULT_CLIMATE_START_TEMPERATURE,
    DEFAULT_COVER_END_ACTION,
    DEFAULT_COVER_START_ACTION,
    DEFAULT_DEVICE_TYPE,
    DEFAULT_LIGHT_END_BRIGHTNESS,
    DEFAULT_LIGHT_START_BRIGHTNESS,
    DEFAULT_WATER_HEATER_END_ACTION,
    DEFAULT_WATER_HEATER_END_TEMPERATURE,
    DEFAULT_WATER_HEATER_START_ACTION,
    DEFAULT_WATER_HEATER_START_TEMPERATURE,
    LOCK_ACTION_TO_SERVICE,
    ONOFF_ACTION_TO_SERVICE,
)


def normalize_entity_ids(entity_ids) -> list[str]:
    if not entity_ids:
        return []
    if isinstance(entity_ids, str):
        return [entity_ids]
    return [item for item in entity_ids if isinstance(item, str)]


def detect_device_type(options: dict, data: dict) -> str:
    requested = options.get(CONF_DEVICE_TYPE, DEFAULT_DEVICE_TYPE)
    if requested != "auto":
        return requested
    entities = normalize_entity_ids(data.get(CONF_TARGET_ENTITY))
    for domain, device_type in (
        ("climate.", "climate"),
        ("water_heater.", "water_heater"),
        ("lock.", "lock"),
        ("cover.", "cover"),
        ("light.", "light"),
    ):
        if any(entity.startswith(domain) for entity in entities):
            return device_type
    return "onoff"


def build_runtime_action_updates(options: dict, data: dict) -> dict:
    device_type = detect_device_type(options, data)
    if device_type == "cover":
        start_action = options.get(CONF_COVER_START_ACTION, DEFAULT_COVER_START_ACTION)
        end_action = options.get(CONF_COVER_END_ACTION, DEFAULT_COVER_END_ACTION)
        start_position = int(options.get(CONF_COVER_START_POSITION, 50))
        end_position = int(options.get(CONF_COVER_END_POSITION, 0))
        return {
            CONF_START_SERVICE: COVER_ACTION_TO_SERVICE[start_action],
            CONF_END_SERVICE: COVER_ACTION_TO_SERVICE[end_action],
            CONF_START_DATA: {"position": start_position} if start_action == "position" else {},
            CONF_END_DATA: {"position": end_position} if end_action == "position" else {},
        }
    if device_type == "light":
        start_action = options.get(CONF_LIGHT_START_ACTION, "brightness")
        end_action = options.get(CONF_LIGHT_END_ACTION, "off")
        start_brightness = int(options.get(CONF_LIGHT_START_BRIGHTNESS, DEFAULT_LIGHT_START_BRIGHTNESS))
        end_brightness = int(options.get(CONF_LIGHT_END_BRIGHTNESS, DEFAULT_LIGHT_END_BRIGHTNESS))
        return {
            CONF_START_SERVICE: "turn_on" if start_action in ("on", "brightness") else "turn_off",
            CONF_END_SERVICE: "turn_on" if end_action in ("on", "brightness") else "turn_off",
            CONF_START_DATA: {"brightness_pct": start_brightness} if start_action == "brightness" else {},
            CONF_END_DATA: {"brightness_pct": end_brightness} if end_action == "brightness" else {},
        }
    if device_type == "climate":
        start_action = options.get(CONF_CLIMATE_START_ACTION, DEFAULT_CLIMATE_START_ACTION)
        end_action = options.get(CONF_CLIMATE_END_ACTION, DEFAULT_CLIMATE_END_ACTION)
        start_temperature = int(options.get(CONF_CLIMATE_START_TEMPERATURE, DEFAULT_CLIMATE_START_TEMPERATURE))
        end_temperature = int(options.get(CONF_CLIMATE_END_TEMPERATURE, DEFAULT_CLIMATE_END_TEMPERATURE))
        return {
            CONF_START_SERVICE: "set_temperature" if start_action == "temperature" else "set_hvac_mode",
            CONF_END_SERVICE: "set_temperature" if end_action == "temperature" else "set_hvac_mode",
            CONF_START_DATA: {"temperature": start_temperature} if start_action == "temperature" else {"hvac_mode": start_action},
            CONF_END_DATA: {"temperature": end_temperature} if end_action == "temperature" else {"hvac_mode": end_action},
        }
    if device_type == "water_heater":
        start_action = options.get(CONF_WATER_HEATER_START_ACTION, DEFAULT_WATER_HEATER_START_ACTION)
        end_action = options.get(CONF_WATER_HEATER_END_ACTION, DEFAULT_WATER_HEATER_END_ACTION)
        start_temperature = int(options.get(CONF_WATER_HEATER_START_TEMPERATURE, DEFAULT_WATER_HEATER_START_TEMPERATURE))
        end_temperature = int(options.get(CONF_WATER_HEATER_END_TEMPERATURE, DEFAULT_WATER_HEATER_END_TEMPERATURE))
        return {
            CONF_START_SERVICE: "set_temperature" if start_action == "temperature" else "set_operation_mode",
            CONF_END_SERVICE: "set_temperature" if end_action == "temperature" else "set_operation_mode",
            CONF_START_DATA: {"temperature": start_temperature} if start_action == "temperature" else {"operation_mode": start_action},
            CONF_END_DATA: {"temperature": end_temperature} if end_action == "temperature" else {"operation_mode": end_action},
        }
    if device_type == "lock":
        start_action = options.get(CONF_LOCK_START_ACTION, "unlock")
        end_action = options.get(CONF_LOCK_END_ACTION, "lock")
        return {
            CONF_START_SERVICE: LOCK_ACTION_TO_SERVICE[start_action],
            CONF_END_SERVICE: LOCK_ACTION_TO_SERVICE[end_action],
            CONF_START_DATA: {},
            CONF_END_DATA: {},
        }
    return {
        CONF_START_SERVICE: ONOFF_ACTION_TO_SERVICE["on"],
        CONF_END_SERVICE: ONOFF_ACTION_TO_SERVICE["off"],
        CONF_START_DATA: {},
        CONF_END_DATA: {},
    }
