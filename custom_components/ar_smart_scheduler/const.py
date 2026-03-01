DOMAIN = "ar_smart_scheduler"

# Required by __init__.py
PLATFORMS = ["switch", "time", "sensor"]

# Supported device types
DEVICE_TYPES = ["auto", "cover", "onoff", "light"]

# Core config keys
CONF_TARGET_ENTITY = "target_entity"
CONF_NAME = "name"
CONF_WEEKDAYS = "weekdays"
CONF_START = "start_time"
CONF_END = "end_time"
CONF_ENABLED = "enabled"

# Internal: resolved HA services + data (customers never see these)
CONF_START_SERVICE = "start_service"
CONF_END_SERVICE = "end_service"
CONF_START_DATA = "start_data"
CONF_END_DATA = "end_data"

# Defaults
DEFAULT_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DEFAULT_START = "06:00:00"
DEFAULT_END = "18:00:00"

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

DEFAULT_COVER_START_ACTION = "open"
DEFAULT_COVER_END_ACTION = "close"

# -------------------------------------------------
# ON/OFF SUPPORT
# -------------------------------------------------

ONOFF_ACTIONS = ["on", "off"]

ONOFF_ACTION_TO_SERVICE = {
    "on": "turn_on",
    "off": "turn_off",
}

# -------------------------------------------------
# LIGHT SUPPORT (NEW)
# -------------------------------------------------

LIGHT_ACTIONS = ["on", "off", "brightness"]

LIGHT_ACTION_TO_SERVICE = {
    "on": "turn_on",
    "off": "turn_off",
    "brightness": "turn_on",  # brightness uses turn_on with brightness_pct
}

DEFAULT_LIGHT_START_ACTION = "brightness"
DEFAULT_LIGHT_END_ACTION = "off"

DEFAULT_LIGHT_START_BRIGHTNESS = 50
DEFAULT_LIGHT_END_BRIGHTNESS = 10

# -------------------------------------------------
# Dispatcher signals
# -------------------------------------------------

SIGNAL_UPDATED = "ar_smart_scheduler_updated"
SIGNAL_START_UPDATED = "ar_smart_scheduler_start_updated"
SIGNAL_END_UPDATED = "ar_smart_scheduler_end_updated"