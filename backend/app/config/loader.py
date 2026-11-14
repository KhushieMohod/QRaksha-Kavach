"""Configuration loader for YAML files under app/config/."""

from functools import lru_cache
from pathlib import Path
from typing import Any
import yaml

CONFIG_DIR = Path(__file__).resolve().parent


def _load_yaml(filename: str) -> dict[str, Any]:
    """Safely load a YAML configuration file from CONFIG_DIR."""
    filepath = CONFIG_DIR / filename
    if not filepath.exists():
        return {}
    with open(filepath, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


@lru_cache(maxsize=1)
def load_thresholds() -> dict[str, Any]:
    """Load thresholds from thresholds.yaml."""
    return _load_yaml("thresholds.yaml")


@lru_cache(maxsize=1)
def load_rules() -> dict[str, Any]:
    """Load detection rules and vocabulary from rules.yaml."""
    return _load_yaml("rules.yaml")


@lru_cache(maxsize=1)
def load_explanations() -> dict[str, Any]:
    """Load safety explanations from explanations.yaml."""
    return _load_yaml("explanations.yaml")


def clear_config_cache() -> None:
    """Clear cached configurations (useful in tests)."""
    load_thresholds.cache_clear()
    load_rules.cache_clear()
    load_explanations.cache_clear()

