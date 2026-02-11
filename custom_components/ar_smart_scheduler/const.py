DOMAIN = "ar_smart_scheduler"
PLATFORMS = ["switch","time","sensor"]

CONF_TARGET_ENTITY = "target_entity"
CONF_NAME = "name"
CONF_WEEKDAYS = "weekdays"
CONF_START = "start_time"
CONF_END = "end_time"
CONF_ENABLED = "enabled"

DEFAULT_WEEKDAYS = ["mon","tue","wed","thu","fri","sat","sun"]
DEFAULT_START = "06:00:00"
DEFAULT_END = "18:00:00"

WEEKDAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"]
WEEKDAY_MAP = {"mon":0,"tue":1,"wed":2,"thu":3,"fri":4,"sat":5,"sun":6}

SIGNAL_UPDATED = "ar_smart_scheduler_updated"
