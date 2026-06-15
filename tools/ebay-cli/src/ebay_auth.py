from __future__ import annotations

from dataclasses import dataclass
from os import getenv
from pathlib import Path
import re
from typing import Any, Literal

import requests
from dotenv import load_dotenv


APPLICATION_SCOPE = "https://api.ebay.com/oauth/api_scope"
ROOT_ENV_PATH = Path(__file__).resolve().parents[3] / ".env.local"
SANDBOX_KEY_PATTERN = re.compile(r"(^|[-_])SBX(?=$|[-_])", re.IGNORECASE)
PRODUCTION_KEY_PATTERNS = (
    re.compile(r"(^|[-_])PRD(?=$|[-_])", re.IGNORECASE),
    re.compile(r"(^|[-_])PROD(?=$|[-_])", re.IGNORECASE),
)
EbayEnvironment = Literal["production", "sandbox"]
ENVIRONMENT_ENDPOINTS: dict[EbayEnvironment, dict[str, str]] = {
    "production": {
        "token_url": "https://api.ebay.com/identity/v1/oauth2/token",
        "browse_base_url": "https://api.ebay.com/buy/browse/v1",
        "client_id_env_var": "EBAY_CLIENT_ID",
        "client_secret_env_var": "EBAY_CLIENT_SECRET",
    },
    "sandbox": {
        "token_url": "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
        "browse_base_url": "https://api.sandbox.ebay.com/buy/browse/v1",
        "client_id_env_var": "EBAY_SANDBOX_CLIENT_ID",
        "client_secret_env_var": "EBAY_SANDBOX_CLIENT_SECRET",
    },
}


class EbayCliError(Exception):
    """User-facing error for CLI output."""


@dataclass(frozen=True)
class EbayConfig:
    environment: EbayEnvironment
    token_url: str
    browse_base_url: str
    client_id: str
    client_secret: str
    marketplace_id: str


def _parse_environment(raw_value: str) -> EbayEnvironment:
    normalized = raw_value.strip().lower()
    if not normalized:
        return "production"

    if normalized in ("production", "sandbox"):
        return normalized

    raise EbayCliError(
        f'Unsupported EBAY_ENV value "{raw_value}". Use "production" or "sandbox".'
    )


def _format_environment_label(environment: EbayEnvironment) -> str:
    return "Production" if environment == "production" else "Sandbox"


def _detect_credential_environment(value: str) -> EbayEnvironment | None:
    if SANDBOX_KEY_PATTERN.search(value):
        return "sandbox"

    if any(pattern.search(value) for pattern in PRODUCTION_KEY_PATTERNS):
        return "production"

    return None


def _validate_credential_environment(
    environment: EbayEnvironment,
    client_id_env_var: str,
    client_secret_env_var: str,
    client_id: str,
    client_secret: str,
) -> None:
    client_id_environment = _detect_credential_environment(client_id)
    client_secret_environment = _detect_credential_environment(client_secret)

    if (
        client_id_environment
        and client_secret_environment
        and client_id_environment != client_secret_environment
    ):
        raise EbayCliError(
            f"{client_id_env_var} and {client_secret_env_var} appear to come from "
            "different eBay environments. Use App ID and Cert ID from the same "
            "Application Keys environment."
        )

    detected_environment = client_id_environment or client_secret_environment
    if not detected_environment or detected_environment == environment:
        return

    detected_label = _format_environment_label(detected_environment)
    expected_label = _format_environment_label(environment)
    raise EbayCliError(
        f"EBAY_ENV is set to {environment}, but the configured eBay credentials "
        f"look like {detected_label} keys. Use {expected_label} App ID and Cert "
        f"ID with EBAY_ENV={environment}, or switch EBAY_ENV to "
        f"{detected_environment}."
    )


def load_config() -> EbayConfig:
    load_dotenv(ROOT_ENV_PATH)

    environment = _parse_environment(getenv("EBAY_ENV") or "")
    endpoints = ENVIRONMENT_ENDPOINTS[environment]
    client_id_env_var = endpoints["client_id_env_var"]
    client_secret_env_var = endpoints["client_secret_env_var"]
    raw_values = {
        client_id_env_var: (getenv(client_id_env_var) or "").strip(),
        client_secret_env_var: (getenv(client_secret_env_var) or "").strip(),
        "EBAY_MARKETPLACE_ID": (getenv("EBAY_MARKETPLACE_ID") or "").strip(),
    }
    missing = [name for name, value in raw_values.items() if not value]
    if missing:
        joined = ", ".join(missing)
        raise EbayCliError(
            f"Missing required environment variable(s): {joined}. "
            "Copy .env.local.example to .env.local and fill in the missing values."
        )

    _validate_credential_environment(
        environment,
        client_id_env_var,
        client_secret_env_var,
        raw_values[client_id_env_var],
        raw_values[client_secret_env_var],
    )

    return EbayConfig(
        environment=environment,
        token_url=endpoints["token_url"],
        browse_base_url=endpoints["browse_base_url"],
        client_id=raw_values[client_id_env_var],
        client_secret=raw_values[client_secret_env_var],
        marketplace_id=raw_values["EBAY_MARKETPLACE_ID"],
    )


def parse_ebay_error(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        text = response.text.strip()
        return text or f"HTTP {response.status_code}"

    if isinstance(payload, dict):
        errors = payload.get("errors")
        if isinstance(errors, list) and errors:
            messages: list[str] = []
            for error in errors:
                if not isinstance(error, dict):
                    continue
                message = error.get("message")
                long_message = error.get("longMessage")
                error_id = error.get("errorId")
                detail = long_message or message or error_id
                if detail:
                    messages.append(str(detail))
            if messages:
                return " | ".join(messages)

        for key in ("error_description", "message", "error"):
            value = payload.get(key)
            if value:
                return str(value)

    return f"HTTP {response.status_code}"


def get_application_access_token() -> str:
    config = load_config()

    try:
        response = requests.post(
            config.token_url,
            auth=(config.client_id, config.client_secret),
            data={
                "grant_type": "client_credentials",
                "scope": APPLICATION_SCOPE,
            },
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=30,
        )
    except requests.Timeout as exc:
        raise EbayCliError(
            "Timed out while requesting an eBay OAuth token. "
            "Check your network connection and try again."
        ) from exc
    except requests.RequestException as exc:
        raise EbayCliError(f"Failed to request eBay OAuth token: {exc}") from exc

    if not response.ok:
        message = parse_ebay_error(response)
        hint = ""
        if response.status_code in (400, 401):
            expected_environment = _format_environment_label(config.environment).lower()
            hint = (
                f" Make sure your {expected_environment} App ID and Cert ID match "
                f"EBAY_ENV={config.environment}."
            )
        raise EbayCliError(
            f"eBay OAuth token request failed ({response.status_code}): {message}.{hint}"
        )

    try:
        payload: dict[str, Any] = response.json()
    except ValueError as exc:
        raise EbayCliError("eBay OAuth token response was not valid JSON.") from exc

    access_token = payload.get("access_token")
    if not isinstance(access_token, str) or not access_token.strip():
        raise EbayCliError("eBay OAuth token response did not include access_token.")

    return access_token
