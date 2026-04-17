from __future__ import annotations

import os
from functools import lru_cache
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class ArrInstanceSettings(BaseModel):
    name: str
    host: str
    port: int
    api_key: str
    enabled: bool
    type: str  # "sonarr" | "radarr"

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ARRSM_", case_sensitive=False)

    # Sonarr
    sonarr_host: str = "192.168.1.135"
    sonarr_port: int = 8989
    sonarr_api_key: str = ""
    sonarr_enabled: bool = True

    # Sonarr 4K
    sonarr4k_host: str = "192.168.1.135"
    sonarr4k_port: int = 8990
    sonarr4k_api_key: str = ""
    sonarr4k_enabled: bool = True

    # Radarr
    radarr_host: str = "192.168.1.135"
    radarr_port: int = 7878
    radarr_api_key: str = ""
    radarr_enabled: bool = True

    # Radarr 4K
    radarr4k_host: str = "192.168.1.135"
    radarr4k_port: int = 7879
    radarr4k_api_key: str = ""
    radarr4k_enabled: bool = True

    # RDT-client
    rdt_host: str = "192.168.1.135"
    rdt_port: int = 6500
    rdt_username: str = ""
    rdt_password: str = ""
    rdt_enabled: bool = True

    # App
    data_dir: str = "/data"
    interval_minutes: int = 10

    # Auth — plain-text only at startup to seed the bcrypt hash; not stored after that
    password: str = ""

    def get_arr_instances(self) -> list[ArrInstanceSettings]:
        return [
            ArrInstanceSettings(
                name="Sonarr", host=self.sonarr_host, port=self.sonarr_port,
                api_key=self.sonarr_api_key, enabled=self.sonarr_enabled, type="sonarr",
            ),
            ArrInstanceSettings(
                name="Sonarr-4K", host=self.sonarr4k_host, port=self.sonarr4k_port,
                api_key=self.sonarr4k_api_key, enabled=self.sonarr4k_enabled, type="sonarr",
            ),
            ArrInstanceSettings(
                name="Radarr", host=self.radarr_host, port=self.radarr_port,
                api_key=self.radarr_api_key, enabled=self.radarr_enabled, type="radarr",
            ),
            ArrInstanceSettings(
                name="Radarr-4K", host=self.radarr4k_host, port=self.radarr4k_port,
                api_key=self.radarr4k_api_key, enabled=self.radarr4k_enabled, type="radarr",
            ),
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_db_path() -> str:
    data_dir = get_settings().data_dir
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "unstuckarr.db")
