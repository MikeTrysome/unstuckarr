from __future__ import annotations

import httpx

from app.config import ArrInstanceSettings


class ArrService:
    def __init__(self, instance: ArrInstanceSettings):
        self._instance = instance
        self._headers = {"X-Api-Key": instance.api_key}
        self._client = httpx.Client(timeout=15.0)

    def fetch_queue(self) -> list[dict]:
        """Fetch complete queue (all pages)."""
        all_records: list[dict] = []
        page = 1

        while True:
            try:
                resp = self._client.get(
                    f"{self._instance.base_url}/api/v3/queue",
                    headers=self._headers,
                    params={
                        "includeUnknownSeriesItems": "True",
                        "page": page,
                        "pageSize": 100,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as exc:
                raise RuntimeError(f"Queue fetch failed for {self._instance.name}: HTTP {exc.response.status_code}") from exc
            except Exception as exc:
                raise RuntimeError(f"Queue fetch failed for {self._instance.name}: {exc.__class__.__name__}") from exc

            records: list[dict] = data.get("records", [])
            all_records.extend(records)

            if len(all_records) >= data.get("totalRecords", 0):
                break
            page += 1

        return all_records

    def delete_queue_item(self, item_id: int) -> bool:
        """
        Delete queue item with blocklist.
        Returns True on success, True on 404 (season pack cleanup, normal).
        """
        try:
            resp = self._client.delete(
                f"{self._instance.base_url}/api/v3/queue/{item_id}",
                headers=self._headers,
                params={
                    "removeFromClient": "true",
                    "blocklist": "true",
                    "skipRequeue": "false",
                },
            )
            if resp.status_code == 404:
                return True  # Season pack: Sonarr already cleaned up
            resp.raise_for_status()
            return True
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Delete failed for {self._instance.name} item {item_id}: HTTP {exc.response.status_code}") from exc

    def health_check(self) -> bool:
        try:
            resp = self._client.get(
                f"{self._instance.base_url}/api/v3/system/status",
                headers=self._headers,
            )
            return resp.status_code == 200
        except Exception:
            return False
