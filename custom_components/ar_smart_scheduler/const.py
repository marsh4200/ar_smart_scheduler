DOMAIN = "ar_smart_scheduler"
SUN_ENTITY_ID = "sun.sun"

# Required by __init__.py
PLATFORMS = ["switch", "time", "sensor", "number", "select"]

# Frontend card (served by the integration itself)
FRONTEND_URL_BASE = "/ar_smart_scheduler_files"
FRONTEND_CARD_FILENAME = "ar-smart-scheduler-card.js"

# Supported device types (action profiles)
DEVICE_TYPES = ["auto", "cover", "onoff", "light", "climate", "water_heater", "lock"]
DEFAULT_DEVICE_TYPE = "auto"
CONF_DEVICE_TYPE = "device_type"

# Trigger types (schedule profiles)
TRIGGER_TYPES = ["time", "sunrise", "sunset"]
TRIGGER_TIME = "time"
TRIGGER_SUNRISE = "sunrise"
TRIGGER_SUNSET = "sunset"

# Core config keys
CONF_TARGET_ENTITY = "target_entity"
CONF_NAME = "name"
CONF_WEEKDAYS = "weekdays"
CONF_START = "start_time"
CONF_END = "end_time"
CONF_ENABLED = "enabled"
CONF_START_TRIGGER = "start_trigger"
CONF_END_TRIGGER = "end_trigger"
CONF_START_OFFSET = "start_offset"
CONF_END_OFFSET = "end_offset"

# Optional 2nd daily window
CONF_SECOND_ENABLED = "second_enabled"
CONF_SECOND_START = "second_start_time"
CONF_SECOND_END = "second_end_time"
CONF_SECOND_START_TRIGGER = "second_start_trigger"
CONF_SECOND_END_TRIGGER = "second_end_trigger"
CONF_SECOND_START_OFFSET = "second_start_offset"
CONF_SECOND_END_OFFSET = "second_end_offset"

# Internal: resolved HA services + data (customers never see these)
CONF_START_SERVICE = "start_service"
CONF_END_SERVICE = "end_service"
CONF_START_DATA = "start_data"
CONF_END_DATA = "end_data"

# Defaults
DEFAULT_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DEFAULT_START = "06:00:00"
DEFAULT_END = "18:00:00"
DEFAULT_START_TRIGGER = TRIGGER_TIME
DEFAULT_END_TRIGGER = TRIGGER_TIME
DEFAULT_START_OFFSET = 0
DEFAULT_END_OFFSET = 0

# Defaults for 2nd window
DEFAULT_SECOND_ENABLED = False
DEFAULT_SECOND_START = "16:00:00"
DEFAULT_SECOND_END = "20:00:00"
DEFAULT_SECOND_START_TRIGGER = TRIGGER_TIME
DEFAULT_SECOND_END_TRIGGER = TRIGGER_TIME
DEFAULT_SECOND_START_OFFSET = 0
DEFAULT_SECOND_END_OFFSET = 0

DEFAULT_START_SERVICE = "turn_on"
DEFAULT_END_SERVICE = "turn_off"
DEFAULT_START_DATA = {}
DEFAULT_END_DATA = {}

# Weekday helpers
WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
WEEKDAY_MAP = {
    "mon": 0,
    "tue": 1,
    "wed": 2,
    "thu": 3,
    "fri": 4,
    "sat": 5,
    "sun": 6,
}

# -------------------------------------------------
# COVER SUPPORT
# -------------------------------------------------

COVER_ACTIONS = ["open", "close", "position"]

COVER_ACTION_TO_SERVICE = {
    "open": "open_cover",
    "close": "close_cover",
    "position": "set_cover_position",
}

CONF_COVER_START_ACTION = "cover_start_action"
CONF_COVER_START_POSITION = "cover_start_position"
CONF_COVER_END_ACTION = "cover_end_action"
CONF_COVER_END_POSITION = "cover_end_position"

DEFAULT_COVER_START_ACTION = "open"
DEFAULT_COVER_END_ACTION = "close"
DEFAULT_COVER_START_POSITION = 50
DEFAULT_COVER_END_POSITION = 0

# -------------------------------------------------
# ON/OFF SUPPORT
# -------------------------------------------------

ONOFF_ACTIONS = ["on", "off"]

ONOFF_ACTION_TO_SERVICE = {
    "on": "turn_on",
    "off": "turn_off",
}

CONF_ONOFF_START_ACTION = "onoff_start_action"
CONF_ONOFF_END_ACTION = "onoff_end_action"

DEFAULT_ONOFF_START_ACTION = "on"
DEFAULT_ONOFF_END_ACTION = "off"

# -------------------------------------------------
# LIGHT SUPPORT
# -------------------------------------------------

LIGHT_ACTIONS = ["on", "off", "brightness"]

LIGHT_ACTION_TO_SERVICE = {
    "on": "turn_on",
    "off": "turn_off",
    "brightness": "turn_on",  # brightness uses turn_on with brightness_pct
}

CONF_LIGHT_START_ACTION = "light_start_action"
CONF_LIGHT_START_BRIGHTNESS = "light_start_brightness"
CONF_LIGHT_END_ACTION = "light_end_action"
CONF_LIGHT_END_BRIGHTNESS = "light_end_brightness"

DEFAULT_LIGHT_START_ACTION = "brightness"
DEFAULT_LIGHT_END_ACTION = "off"

DEFAULT_LIGHT_START_BRIGHTNESS = 50
DEFAULT_LIGHT_END_BRIGHTNESS = 10

# -------------------------------------------------
# CLIMATE SUPPORT
# -------------------------------------------------

CLIMATE_ACTIONS = ["heat", "cool", "off", "temperature"]

CLIMATE_ACTION_TO_SERVICE = {
    "heat": "set_hvac_mode",
    "cool": "set_hvac_mode",
    "off": "set_hvac_mode",
    "temperature": "set_temperature",
}

CONF_CLIMATE_START_ACTION = "climate_start_action"
CONF_CLIMATE_START_TEMPERATURE = "climate_start_temperature"
CONF_CLIMATE_END_ACTION = "climate_end_action"
CONF_CLIMATE_END_TEMPERATURE = "climate_end_temperature"

DEFAULT_CLIMATE_START_ACTION = "heat"
DEFAULT_CLIMATE_END_ACTION = "off"
DEFAULT_CLIMATE_START_TEMPERATURE = 21
DEFAULT_CLIMATE_END_TEMPERATURE = 18

# -------------------------------------------------
# WATER HEATER (GEYSER) SUPPORT
# -------------------------------------------------

WATER_HEATER_ACTIONS = [
    "eco",
    "electric",
    "gas",
    "heat_pump",
    "high_demand",
    "performance",
    "off",
    "temperature",
]

CONF_WATER_HEATER_START_ACTION = "water_heater_start_action"
CONF_WATER_HEATER_START_TEMPERATURE = "water_heater_start_temperature"
CONF_WATER_HEATER_END_ACTION = "water_heater_end_action"
CONF_WATER_HEATER_END_TEMPERATURE = "water_heater_end_temperature"

DEFAULT_WATER_HEATER_START_ACTION = "eco"
DEFAULT_WATER_HEATER_END_ACTION = "off"
DEFAULT_WATER_HEATER_START_TEMPERATURE = 60
DEFAULT_WATER_HEATER_END_TEMPERATURE = 40

# -------------------------------------------------
# LOCK SUPPORT
# -------------------------------------------------

LOCK_ACTIONS = ["lock", "unlock"]

LOCK_ACTION_TO_SERVICE = {
    "lock": "lock",
    "unlock": "unlock",
}

CONF_LOCK_START_ACTION = "lock_start_action"
CONF_LOCK_END_ACTION = "lock_end_action"

DEFAULT_LOCK_START_ACTION = "unlock"
DEFAULT_LOCK_END_ACTION = "lock"

# -------------------------------------------------
# Dispatcher signals
# -------------------------------------------------

SIGNAL_UPDATED = "ar_smart_scheduler_updated"
SIGNAL_START_UPDATED = "ar_smart_scheduler_start_updated"
SIGNAL_END_UPDATED = "ar_smart_scheduler_end_updated"
SIGNAL_START2_UPDATED = "ar_smart_scheduler_start2_updated"
SIGNAL_END2_UPDATED = "ar_smart_scheduler_end2_updated"
