from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from src.browse_search import search_active_listings
from src.ebay_auth import EbayCliError
from src.seller_orders import get_orders_placeholder_message


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Simple eBay CLI for active Browse API searches."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    search_parser = subparsers.add_parser(
        "search",
        help="Search active eBay listings by keyword.",
        description="Search active eBay listings with the public Browse API.",
    )
    search_parser.add_argument("keyword", help="Keyword to search for.")

    subparsers.add_parser(
        "orders",
        help="Explain the seller orders API pattern.",
        description="Show why seller orders are a placeholder in this v1.",
    )

    return parser


def _print_search_results(keyword: str) -> None:
    results = search_active_listings(keyword)

    if not results:
        print(f'No active listings found for "{keyword}".')
        return

    for index, item in enumerate(results, start=1):
        print(f"{index}.")
        print(f"Title: {item.title}")
        print(f"Price: {item.price}")
        print(f"Condition: {item.condition}")
        print(f"Item URL: {item.item_url}")
        print(f"Seller: {item.seller_username}")
        print(f"Item ID: {item.item_id}")
        if index != len(results):
            print()


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "search":
            _print_search_results(args.keyword)
            return 0

        if args.command == "orders":
            print(get_orders_placeholder_message())
            return 0

        parser.print_help()
        return 1
    except EbayCliError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Operation cancelled.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
