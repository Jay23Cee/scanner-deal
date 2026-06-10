from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests

from src.ebay_auth import (
    EbayCliError,
    get_application_access_token,
    load_config,
    parse_ebay_error,
)


@dataclass(frozen=True)
class BrowseItem:
    title: str
    price: str
    condition: str
    item_url: str
    seller_username: str
    item_id: str


def _format_price(summary: dict[str, Any]) -> str:
    price = summary.get("price")
    if not isinstance(price, dict):
        return "Unavailable"

    value = price.get("value")
    currency = price.get("currency")
    if value and currency:
        return f"{value} {currency}"
    if value:
        return str(value)
    return "Unavailable"


def _normalize_item(summary: dict[str, Any]) -> BrowseItem:
    seller = summary.get("seller")
    seller_username = "Unavailable"
    if isinstance(seller, dict):
        username = seller.get("username")
        if username:
            seller_username = str(username)

    return BrowseItem(
        title=str(summary.get("title") or "Untitled listing"),
        price=_format_price(summary),
        condition=str(summary.get("condition") or "Unknown"),
        item_url=str(summary.get("itemWebUrl") or "Unavailable"),
        seller_username=seller_username,
        item_id=str(summary.get("itemId") or "Unavailable"),
    )


def search_active_listings(keyword: str, limit: int = 10) -> list[BrowseItem]:
    query = keyword.strip()
    if not query:
        raise EbayCliError("Search keyword cannot be empty.")

    # Sold-item search is intentionally not implemented here. The public Browse API
    # supports active listing discovery, but it does not provide public market-wide
    # sold comps. We also intentionally avoid deprecated Finding API calls and scraping.
    config = load_config()
    token = get_application_access_token()

    try:
        response = requests.get(
            f"{config.browse_base_url}/item_summary/search",
            params={"q": query, "limit": str(limit)},
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
                "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id,
            },
            timeout=30,
        )
    except requests.Timeout as exc:
        raise EbayCliError(
            "Timed out while calling eBay Browse search. "
            "Check your network connection and try again."
        ) from exc
    except requests.RequestException as exc:
        raise EbayCliError(f"Failed to call eBay Browse search: {exc}") from exc

    if not response.ok:
        message = parse_ebay_error(response)
        hint = ""
        if response.status_code == 400:
            hint = (
                " Check the keyword and EBAY_MARKETPLACE_ID values being sent to the "
                "Browse API."
            )
        elif response.status_code == 401:
            hint = (
                " The OAuth token was rejected. Confirm your configured credentials "
                f"match EBAY_ENV={config.environment} and the token request succeeded."
            )
        elif response.status_code == 429:
            hint = " eBay rate limited the request. Wait and try again."
        raise EbayCliError(
            f"eBay Browse search failed ({response.status_code}): {message}.{hint}"
        )

    try:
        payload: dict[str, Any] = response.json()
    except ValueError as exc:
        raise EbayCliError("eBay Browse search response was not valid JSON.") from exc

    item_summaries = payload.get("itemSummaries", [])
    if not isinstance(item_summaries, list):
        raise EbayCliError(
            "eBay Browse search response did not contain itemSummaries in the expected format."
        )

    return [
        _normalize_item(summary)
        for summary in item_summaries
        if isinstance(summary, dict)
    ]
