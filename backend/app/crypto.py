"""
Symmetric encryption for secrets stored in the SQLite database.

Key: 256-bit Fernet key, generated on first start and stored at {DATA_DIR}/.secret_key
     (owner read-only, mode 0o400).

This protects against database-only exposure (e.g. a copied DB file without the key file).
Anyone with full access to the /data volume can still read it — which is expected for a
home-server single-user deployment where the user owns the data volume.

Encrypted values are stored with an "enc:" prefix so:
  - Plaintext defaults (empty strings) pass through without decrypt errors.
  - Future migration or debug inspection can identify encrypted entries.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_PREFIX = "enc:"
_fernet: object | None = None  # cryptography.fernet.Fernet instance, lazily initialised


def _key_path() -> str:
    from app.config import get_settings

    data_dir = get_settings().data_dir
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, ".secret_key")


def _get_fernet():
    """Return the singleton Fernet instance, creating/loading the key file on first call."""
    global _fernet
    if _fernet is not None:
        return _fernet

    from cryptography.fernet import Fernet

    path = _key_path()
    if os.path.exists(path):
        with open(path, "rb") as f:
            key = f.read().strip()
        logger.debug("Loaded encryption key from %s", path)
    else:
        key = Fernet.generate_key()
        # Write with owner-read-only permissions
        old_umask = os.umask(0o177)
        try:
            with open(path, "wb") as f:
                f.write(key)
        finally:
            os.umask(old_umask)
        logger.info("Generated new encryption key at %s", path)

    _fernet = Fernet(key)
    return _fernet


def encrypt(value: str) -> str:
    """
    Encrypt a plaintext string.
    Returns the ciphertext prefixed with "enc:".
    Empty strings are returned as-is (nothing to encrypt).
    """
    if not value:
        return value
    fernet = _get_fernet()
    return _PREFIX + fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """
    Decrypt a prefixed ciphertext string.
    If the value doesn't start with "enc:", it's returned as-is (plaintext / empty default).
    On decryption failure (corrupted data), returns "" and logs a warning.
    """
    if not value or not value.startswith(_PREFIX):
        return value  # plaintext or empty default
    fernet = _get_fernet()
    try:
        return fernet.decrypt(value[len(_PREFIX):].encode()).decode()
    except Exception as exc:
        logger.warning("Failed to decrypt config value (corrupted or wrong key): %s", exc)
        return ""
