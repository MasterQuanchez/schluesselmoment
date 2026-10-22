"""Shared utilities for ingestion scripts."""

from __future__ import annotations

import json
import os

from openai import AzureOpenAI


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def build_azure_client() -> AzureOpenAI:
    return AzureOpenAI(
        api_key=required_env("AZURE_OPENAI_API_KEY"),
        azure_endpoint=required_env("AZURE_OPENAI_ENDPOINT"),
        api_version=required_env("OPENAI_API_VERSION"),
    )


def dump_yaml(values: dict[str, object]) -> str:
    lines: list[str] = []
    for key, value in values.items():
        if isinstance(value, bool):
            rendered = "true" if value else "false"
        elif isinstance(value, (int, float)):
            rendered = str(value)
        else:
            rendered = json.dumps(str(value))
        lines.append(f"{key}: {rendered}")
    return "\n".join(lines) + "\n"
