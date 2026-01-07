#!/usr/bin/env python3
"""
Script 3: refresh_token_prices.py
Purpose: Fetch token prices for the new month

Queries Crux Finance API for token prices at month-end timestamp.
All valuations are in ERG (ERG is the base unit).
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
import requests

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
PUBLIC_DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data")

TOKENS_FILE = os.path.join(DATA_DIR, "tokens.json")
TOKEN_PRICES_FILE = os.path.join(DATA_DIR, "token_prices.json")
PUBLIC_TOKEN_PRICES_FILE = os.path.join(PUBLIC_DATA_DIR, "historical_token_prices_v5.json")
BLOCK_HEIGHTS_FILE = os.path.join(DATA_DIR, "block_heights.json")
PUBLIC_BLOCK_HEIGHTS_FILE = os.path.join(PUBLIC_DATA_DIR, "month_end_block_heights.json")
REFRESH_LOG_FILE = os.path.join(DATA_DIR, "refresh_log.json")

CRUX_API = "https://api.cruxfinance.io/spectrum/price"
RATE_LIMIT_DELAY = 0.3  # seconds between API calls
MAX_RETRIES = 3

# Known ERG token ID placeholder
ERG_TOKEN_ID = "0" * 64


def log(msg: str):
    """Print timestamped log message."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{timestamp}] {msg}")


def load_json(filepath: str) -> dict:
    """Load JSON file, return empty dict if not found."""
    if not os.path.exists(filepath):
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filepath: str, data: dict):
    """Save dict to JSON file with proper formatting."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    log(f"Saved: {filepath}")


def get_new_month() -> tuple[str, int] | None:
    """
    Get the newest month from block_heights.json.
    Returns: (date_str, timestamp_ms) or None
    """
    # Try data dir first, then public dir
    block_data = load_json(BLOCK_HEIGHTS_FILE)
    if not block_data:
        block_data = load_json(PUBLIC_BLOCK_HEIGHTS_FILE)

    if not block_data:
        log("ERROR: No block heights data found")
        return None

    months = block_data.get("months", [])
    if not months:
        log("ERROR: No months in block heights data")
        return None

    latest = months[-1]
    return latest["date"], latest["timestamp_ms"]


def fetch_token_price(token_id: str, timestamp_ms: int) -> dict | None:
    """
    Fetch token price from Crux Finance API.
    Returns: {"price_erg": float, "erg_usd": float} or None
    """
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(
                CRUX_API,
                params={"token_id": token_id, "time_point": timestamp_ms},
                timeout=30
            )

            if resp.status_code == 404:
                return None  # Token not found in API

            resp.raise_for_status()
            data = resp.json()

            # Crux API returns price in ERG and ERG/USD rate
            price_erg = data.get("price", 0)
            erg_usd = data.get("erg_usd", 0)

            # Calculate USD price for reference (but ERG is the base)
            price_usd = price_erg * erg_usd if price_erg and erg_usd else 0

            return {
                "price_erg": price_erg,
                "price_usd": price_usd,
                "erg_usd": erg_usd
            }

        except requests.exceptions.HTTPError as e:
            if resp.status_code == 429:  # Rate limited
                wait_time = 2 ** (attempt + 1)
                log(f"Rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                log(f"HTTP error fetching price for {token_id[:16]}...: {e}")
                return None
        except Exception as e:
            log(f"Error fetching price for {token_id[:16]}... (attempt {attempt + 1}): {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
            else:
                return None

    return None


def update_refresh_log(step_name: str, status: str, details: dict):
    """Append step result to refresh_log.json."""
    log_data = load_json(REFRESH_LOG_FILE)
    if "runs" not in log_data:
        log_data["runs"] = []

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    month = details.get("month", "unknown")

    # Find or create the run entry for this month
    run_entry = None
    for run in log_data["runs"]:
        if run.get("month") == month:
            run_entry = run
            break

    if run_entry is None:
        run_entry = {"month": month, "steps": {}}
        log_data["runs"].append(run_entry)

    # Update the step
    run_entry["steps"][step_name] = {
        "ran_at": now,
        "status": status,
        **{k: v for k, v in details.items() if k != "month"}
    }

    save_json(REFRESH_LOG_FILE, log_data)


def main():
    log("=" * 60)
    log("Script 3: refresh_token_prices.py")
    log("=" * 60)

    # Get the new month
    month_info = get_new_month()
    if month_info is None:
        return 1

    month_date, timestamp_ms = month_info
    log(f"Fetching prices for month: {month_date}")
    log(f"Timestamp: {timestamp_ms} ({datetime.fromtimestamp(timestamp_ms/1000, timezone.utc).isoformat()})")

    # Load tokens registry
    tokens_data = load_json(TOKENS_FILE)
    if not tokens_data or not tokens_data.get("tokens"):
        log("ERROR: No tokens data found")
        return 1

    tokens = tokens_data["tokens"]
    log(f"Tokens to query: {len(tokens)}")

    # Load existing token prices
    prices_data = load_json(TOKEN_PRICES_FILE)

    # Also check public dir for existing data to merge
    if not prices_data:
        prices_data = load_json(PUBLIC_TOKEN_PRICES_FILE)

    # Initialize structure if empty
    if not prices_data:
        prices_data = {
            "metadata": {
                "updated": None,
                "total_tokens": 0,
                "source": "Crux Finance API"
            },
            "months": [],
            "tokens": {}
        }

    # Check if month already has prices
    if month_date in prices_data.get("months", []):
        log(f"Month {month_date} already has prices")
        # Could skip, but we'll continue to fill in any missing tokens

    # Track statistics
    tokens_queried = 0
    prices_added = 0
    errors = 0

    # Fetch prices for each token
    for token_id, token_info in tokens.items():
        if token_id == ERG_TOKEN_ID:
            continue  # Skip ERG itself

        tokens_queried += 1
        log(f"[{tokens_queried}/{len(tokens)}] Fetching price for {token_info.get('name', 'Unknown')}...")

        price = fetch_token_price(token_id, timestamp_ms)

        if price is None:
            errors += 1
            continue

        # Initialize token entry if needed
        if token_id not in prices_data["tokens"]:
            prices_data["tokens"][token_id] = {
                "token_id": token_id,
                "ticker": token_info.get("ticker", token_info.get("name", "Unknown")),
                "decimals": token_info.get("decimals", 0),
                "prices": {}
            }

        # Add price for this month
        prices_data["tokens"][token_id]["prices"][month_date] = price
        prices_added += 1

        time.sleep(RATE_LIMIT_DELAY)

    # Update months list
    if month_date not in prices_data.get("months", []):
        if "months" not in prices_data:
            prices_data["months"] = []
        prices_data["months"].append(month_date)
        prices_data["months"].sort()

    # Update metadata
    now = datetime.now(timezone.utc).isoformat()
    prices_data["metadata"]["updated"] = now
    prices_data["metadata"]["total_tokens"] = len(prices_data["tokens"])

    # Save to data directory
    save_json(TOKEN_PRICES_FILE, prices_data)

    # Also update public data directory for the web app
    save_json(PUBLIC_TOKEN_PRICES_FILE, prices_data)

    log("=" * 60)
    log(f"Results:")
    log(f"  Month: {month_date}")
    log(f"  Tokens queried: {tokens_queried}")
    log(f"  Prices added: {prices_added}")
    log(f"  Errors: {errors}")
    log("=" * 60)

    # Update refresh log
    update_refresh_log("token_prices", "success", {
        "month": month_date,
        "tokens_queried": tokens_queried,
        "prices_added": prices_added,
        "errors": errors
    })

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("Interrupted by user")
        sys.exit(130)
    except Exception as e:
        log(f"FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
