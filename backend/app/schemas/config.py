from pydantic import BaseModel, Field


class DbConfigOut(BaseModel):
    detection_infringing_min_age_minutes: int
    detection_canceled_min_age_minutes: int
    detection_min_retry_count: int
    scheduler_dry_run: bool
    scheduler_enabled: bool
    notifications_apprise_urls: list[str]


class DbConfigIn(BaseModel):
    detection_infringing_min_age_minutes: int | None = Field(None, ge=1, le=10080)
    detection_canceled_min_age_minutes: int | None = Field(None, ge=1, le=10080)
    detection_min_retry_count: int | None = Field(None, ge=0, le=100)
    scheduler_dry_run: bool | None = None
    scheduler_enabled: bool | None = None
    notifications_apprise_urls: list[str] | None = Field(None, max_length=20)


class EnvConfigOut(BaseModel):
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
    rdt_username_set: bool
    rdt_password_set: bool
    rdt_enabled: bool
    interval_minutes: int


class FullConfigOut(BaseModel):
    env: EnvConfigOut
    db: DbConfigOut
