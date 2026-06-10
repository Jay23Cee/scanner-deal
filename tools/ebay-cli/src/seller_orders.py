from __future__ import annotations

from textwrap import dedent


def get_orders_placeholder_message() -> str:
    # Seller orders are intentionally left as a placeholder in this v1. Your own
    # sold orders require OAuth user consent and the Sell Fulfillment API. We do
    # not use ItemSold here because ItemSold is about notifications for your own
    # listings selling, not searching market-wide sold comps.
    return dedent(
        """
        Seller orders are not implemented in this v1.

        To add seller orders correctly, this project would need:
        - OAuth authorization code flow with seller user consent
        - Sell Fulfillment API access, typically starting with getOrders
        - User-token handling and refresh-token handling

        Important notes:
        - The Browse API is for active listing search, not market-wide sold comps.
        - Your own sold orders are an account-level seller data use case.
        - ItemSold is a seller-facing notification when your own listing sells.
        - Market-wide sold comp access is not normally available through the public Browse API.
        - Marketplace Insights access is restricted.
        """
    ).strip()
