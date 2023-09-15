import os
import structlog

from posthog.settings import DEBUG, TEST
from posthog.settings.utils import get_from_env, get_list
from posthog.utils import str_to_bool

logger = structlog.get_logger(__name__)

INGESTION_LAG_METRIC_TEAM_IDS = get_list(os.getenv("INGESTION_LAG_METRIC_TEAM_IDS", ""))

# KEEP IN SYNC WITH plugin-server/src/config/config.ts
BUFFER_CONVERSION_SECONDS = get_from_env("BUFFER_CONVERSION_SECONDS", default=60, type_cast=int)


# A list of <team_id:distinct_id> pairs (in the format 2:myLovelyId) that we should use
# random partitioning for when producing events to the Kafka topic consumed by the plugin server.
# This is a measure to handle hot partitions in ad-hoc cases.
EVENT_PARTITION_KEYS_TO_OVERRIDE = get_list(os.getenv("EVENT_PARTITION_KEYS_TO_OVERRIDE", ""))

# Keep in sync with plugin-server
EVENTS_DEAD_LETTER_QUEUE_STATSD_METRIC = "events_added_to_dead_letter_queue"

QUOTA_LIMITING_ENABLED = get_from_env("QUOTA_LIMITING_ENABLED", False, type_cast=str_to_bool)

PARTITION_KEY_AUTOMATIC_OVERRIDE_ENABLED = get_from_env(
    "PARTITION_KEY_AUTOMATIC_OVERRIDE_ENABLED", type_cast=bool, default=False
)
PARTITION_KEY_BUCKET_CAPACITY = get_from_env("PARTITION_KEY_BUCKET_CAPACITY", type_cast=int, default=1000)
PARTITION_KEY_BUCKET_REPLENTISH_RATE = get_from_env(
    "PARTITION_KEY_BUCKET_REPLENTISH_RATE", type_cast=float, default=1.0
)

REPLAY_EVENT_MAX_SIZE = get_from_env("REPLAY_EVENT_MAX_SIZE", type_cast=int, default=1024 * 512)  # 512kb

# Ingestion of session recordings to ClickHouse is deprecated and will be removed.
# This setting defaults to true so that deployments can opt in to storing recordings in blob storage.
# At some point this deprecated feature will be removed and _only_ blob storage will be supported.
SESSION_RECORDING_ALLOW_V1_INGESTION = get_from_env(
    "SESSION_RECORDING_ALLOW_V1_INGESTION", type_cast=bool, default=True
)
if DEBUG or TEST:
    SESSION_RECORDING_ALLOW_V1_INGESTION = False

if SESSION_RECORDING_ALLOW_V1_INGESTION and not DEBUG and not TEST:
    logger.warn(
        """
        SESSION_RECORDING_ALLOW_V1_INGESTION is set to True!
        Session recordings v1 ingestion is deprecated and will be removed.
        You must setup blob storage.
        Future versions of PostHog will not support storing recordings in ClickHouse.
        """,
    )


REPLAY_RETENTION_DAYS_MIN = 30
REPLAY_RETENTION_DAYS_MAX = 90
