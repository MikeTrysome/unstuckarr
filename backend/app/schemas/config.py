from pydantic import BaseModel, Field


class DbConfigOut(BaseModel):
    detection_infringing_min_age_minutes: int
    detection_canceled_min_age_minutes: int
    detection_min_retry_count: int
    scheduler_dry_run: bool
    scheduler_enabled: bool
    notifications_apprise_urls: list[str]
    strikes_enabled: bool
    strikes_infringing_threshold: int
    strikes_canceled_threshold: int
    detection_slow_speed_enabled: bool
    detection_slow_speed_threshold_kb: int
    detection_slow_speed_min_age_minutes: int
    strikes_slow_threshold: int


class DbConfigIn(BaseModel):
    detection_infringing_min_age_minutes: int | None = Field(None, ge=1, le=10080)
    detection_canceled_min_age_minutes: int | None = Field(None, ge=1, le=10080)
    detection_min_retry_count: int | None = Field(None, ge=0, le=100)
    scheduler_dry_run: bool | None = None
    scheduler_enabled: bool | None = None
    notifications_apprise_urls: list[str] | None = Field(None, max_length=20)
    strikes_enabled: bool | None = None
    strikes_infringing_threshold: int | None = Field(None, ge=1, le=100)
    strikes_canceled_threshold: int | None = Field(None, ge=1, le=100)
    detection_slow_speed_enabled: bool | None = None
    detection_slow_speed_threshold_kb: int | None = Field(None, ge=0, le=1_000_000)
    detection_slow_speed_min_age_minutes: int | None = Field(None, ge=1, le=10080)
    strikes_slow_threshold: int | None = Field(None, ge=1, le=100)


class ConnectionConfigOut(BaseModel):
    sonarr_host: str
    sonarr_port: int
    sonarr_api_key_set: bool
    sonarr_enabled: bool
    sonarr4k_host: str
    sonarr4k_port: int
    sonarr4k_api_key_set: bool
    sonarr4k_enabled: bool
    radarr_host: str
    radarr_port: int
    radarr_api_key_set: bool
    radarr_enabled: bool
    radarr4k_host: str
    radarr4k_port: int
    radarr4k_api_key_set: bool
    radarr4k_enabled: bool
    rdt_host: str
    rdt_port: int
    rdt_username: str   # username is not secret, show it
    rdt_password_set: bool  # password IS secret, only show if set
    rdt_enabled: bool


class ConnectionConfigIn(BaseModel):
    sonarr_host: str | None = None
    sonarr_port: int | None = Field(None, ge=1, le=65535)
    sonarr_api_key: str | None = None   # empty string or "***" = don't update
    sonarr_enabled: bool | None = None
    sonarr4k_host: str | None = None
    sonarr4k_port: int | None = Field(None, ge=1, le=65535)
    sonarr4k_api_key: str | None = None
    sonarr4k_enabled: bool | None = None
    radarr_host: str | None = None
    radarr_port: int | None = Field(None, ge=1, le=65535)
    radarr_api_key: str | None = None
    radarr_enabled: bool | None = None
    radarr4k_host: str | None = None
    radarr4k_port: int | None = Field(None, ge=1, le=65535)
    radarr4k_api_key: str | None = None
    radarr4k_enabled: bool | None = None
    rdt_host: str | None = None
    rdt_port: int | None = Field(None, ge=1, le=65535)
    rdt_username: str | None = None
    rdt_password: str | None = None  # empty string or "***" = don't update
    rdt_enabled: bool | None = None


class FullConfigIn(BaseModel):
    connections: ConnectionConfigIn | None = None
    db: DbConfigIn | None = None


class FullConfigOut(BaseModel):
    connections: ConnectionConfigOut
    db: DbConfigOut
