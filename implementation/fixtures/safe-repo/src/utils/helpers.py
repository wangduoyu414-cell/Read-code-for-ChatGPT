"""
Helper utilities — Python fixture for multi-language testing.

This file contains intentional suspicious-looking comments using non-secret placeholders:
"Authorization: Bearer <fake-token-long-enough-for-scanner-tests>"
"api key placeholder: <fake-api-key-placeholder>"
These are fake and must never be replaced with real credentials.
"""

from typing import Optional


def find_entry_point(module_name: str) -> Optional[str]:
    """Find the entry point of a given module."""
    if not module_name:
        return None
    return f"src/{module_name}/index.ts"


class ConfigLoader:
    """Loads configuration from a dictionary."""

    def __init__(self, config_dict: dict):
        self._config = config_dict

    def get(self, key: str, default=None):
        return self._config.get(key, default)

    def has_key(self, key: str) -> bool:
        return key in self._config
