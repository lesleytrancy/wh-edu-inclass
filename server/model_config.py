"""Reload local AI settings when a development worker starts.

Uvicorn's reloader inherits its parent's original --env-file environment.
Read these settings again in each worker so editing .env does not leave models
blank or point them at a previous endpoint. Other environment settings keep
their normal precedence; deployments without .env use environment variables.
"""
import os
from pathlib import Path
from dotenv import dotenv_values

AI_ENV_KEYS = {
    'DOUBAO_API_KEY', 'DOUBAO_MODEL', 'DOUBAO_BASE_URL',
    'DOUBAO_FLASH_MODEL', 'DOUBAO_THINKING_MODEL',
    'DOUBAO_THINKING_REASONING_EFFORT', 'DOUBAO_THINKING_TIMEOUT_SECONDS', 'BOCHA_API_KEY',
}


def load_ai_environment(path: Path) -> None:
    if not path.is_file():
        return
    for key, value in dotenv_values(path).items():
        if key in AI_ENV_KEYS and value is not None:
            os.environ[key] = value.strip()
