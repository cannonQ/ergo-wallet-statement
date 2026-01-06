#!/usr/bin/env python3
"""
Script 4: refresh_lp_valuations.py
Purpose: Calculate LP prices for the new month

Queries pool state at block height via SigmaSpace GraphQL,
calculates pool value in ERG and LP price in ERG.
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

LP_TOKEN_PAIRS_FILE = os.path.join(DATA_DIR, "lp_token_pairs.json")
TOKEN_PRICES_FILE = os.path.join(DATA_DIR, "token_prices.json")
PUBLIC_TOKEN_PRICES_FILE = os.path.join(PUBLIC_DATA_DIR, "historical_token_prices_v5.json")
BLOCK_HEIGHTS_FILE = os.path.join(DATA_DIR, "block_heights.json")
PUBLIC_BLOCK_HEIGHTS_FILE = os.path.join(PUBLIC_DATA_DIR, "month_end_block_heights.json")
LP_PRICES_FILE = os.path.join(DATA_DIR, "lp_historical_prices.json")
PUBLIC_LP_PRICES_FILE = os.path.join(PUBLIC_DATA_DIR, "lp_historical_prices_v5.json")
REFRESH_LOG_FILE = os.path.join(DATA_DIR, "refresh_log.json")

GRAPHQL_API = "https://explore.sigmaspace.io/api/graphql"
RATE_LIMIT_DELAY = 0.3  # seconds between API calls
MAX_RETRIES = 3

# Constants
MAX_LP_SUPPLY = 9223372036854774807
ERG_TOKEN_ID = "0" * 64
ERG_DECIMALS = 9
NANOERG_PER_ERG = 1_000_000_000


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


def get_new_month_info() -> dict | None:
    """
    Get the newest month info from block_heights.json.
    Returns: {"date": str, "height": int, "timestamp_ms": int} or None
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
    return {
        "date": latest["date"],
        "height": latest["block_height"],
        "timestamp_ms": latest["timestamp_ms"]
    }


def get_token_price(token_id: str, month_date: str, prices_data: dict) -> float | None:
    """Get token price in ERG for given month."""
    if token_id == ERG_TOKEN_ID:
        return 1.0  # ERG is always 1 ERG

    token_prices = prices_data.get("tokens", {}).get(token_id, {}).get("prices", {})
    month_price = token_prices.get(month_date, {})

    if month_price:
        return month_price.get("price_erg")

    return None


def get_erg_usd(month_date: str, prices_data: dict) -> float:
    """Get ERG/USD rate for given month (for reference only)."""
    # Try to get from any token that has the erg_usd rate
    for token_data in prices_data.get("tokens", {}).values():
        month_price = token_data.get("prices", {}).get(month_date, {})
        if "erg_usd" in month_price and month_price["erg_usd"]:
            return month_price["erg_usd"]
    return 0


def query_pool_at_height(pool_nft_id: str, max_height: int) -> dict | None:
    """
    Query SigmaSpace GraphQL for pool state at a specific block height.
    Returns the pool box data or None.
    """
    # Query for spent boxes (historical state) at or before the max_height
    query = """
    query GetPoolAtHeight($tokenId: String!, $maxHeight: Int!) {
        boxes(tokenId: $tokenId, spent: true, maxHeight: $maxHeight, take: 1) {
            boxId
            value
            creationHeight
            assets {
                tokenId
                amount
            }
        }
    }
    """

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                GRAPHQL_API,
                json={
                    "query": query,
                    "variables": {
                        "tokenId": pool_nft_id,
                        "maxHeight": max_height
                    }
                },
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            resp.raise_for_status()
            data = resp.json()

            if "errors" in data:
                log(f"GraphQL errors: {data['errors']}")
                return None

            boxes = data.get("data", {}).get("boxes", [])
            if boxes:
                return boxes[0]

            # Try unspent boxes if no spent found (current state)
            query_unspent = """
            query GetPoolUnspent($tokenId: String!) {
                boxes(tokenId: $tokenId, spent: false, take: 1) {
                    boxId
                    value
                    creationHeight
                    assets {
                        tokenId
                        amount
                    }
                }
            }
            """
            resp = requests.post(
                GRAPHQL_API,
                json={
                    "query": query_unspent,
                    "variables": {"tokenId": pool_nft_id}
                },
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            resp.raise_for_status()
            data = resp.json()

            boxes = data.get("data", {}).get("boxes", [])
            if boxes:
                # Only use if creation height is before max_height
                if boxes[0].get("creationHeight", 0) <= max_height:
                    return boxes[0]

            return None

        except Exception as e:
            log(f"GraphQL error (attempt {attempt + 1}): {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
            else:
                return None

    return None


def calculate_lp_value(pool: dict, box: dict, month_date: str, prices_data: dict) -> dict:
    """
    Calculate LP token value for a pool.

    For N2T:
        pool_value_erg = (reserve_x / 1e9) + (reserve_y / 10^decimals × token_y_price_erg)

    For T2T:
        pool_value_erg = (reserve_x / 10^dec_x × token_x_price_erg) + (reserve_y / 10^dec_y × token_y_price_erg)

    circulating_lp = 9,223,372,036,854,774,807 - lp_in_pool
    lp_price_erg = pool_value_erg / circulating_lp
    """
    result = {
        "month": month_date,
        "pool_type": pool["pool_type"],
        "lp_token_id": pool["lp_token_id"],
        "pool_name": pool.get("lp_token_name", "Unknown"),
        "lp_price_erg": "REVIEW",
        "pool_value_erg": "REVIEW",
        "reserve_x": "REVIEW",
        "reserve_y": "REVIEW",
        "circulating_lp": "REVIEW",
        "token_x_erg": 1,
        "token_y_erg": "REVIEW",
        "error": "",
        "decimals_x": pool["asset_x"]["decimals"],
        "decimals_y": pool["asset_y"]["decimals"]
    }

    # Extract reserves from box assets
    assets = box.get("assets", [])
    if len(assets) < 2:
        result["error"] = "Insufficient assets in box"
        return result

    # Find LP token in assets to get circulating supply
    lp_in_pool = None
    for asset in assets:
        if asset.get("tokenId") == pool["lp_token_id"]:
            lp_in_pool = int(asset.get("amount", 0))
            break

    if lp_in_pool is None:
        result["error"] = "LP token not found in pool"
        return result

    circulating_lp = MAX_LP_SUPPLY - lp_in_pool
    if circulating_lp <= 0:
        result["error"] = "No circulating LP tokens"
        return result

    result["circulating_lp"] = str(circulating_lp)

    # Get token prices
    token_y_id = pool["asset_y"]["id"]
    token_y_price = get_token_price(token_y_id, month_date, prices_data)

    if pool["pool_type"] == "N2T":
        # For N2T, ERG is reserve X (from box.value)
        reserve_x = int(box.get("value", 0))

        # Token Y is assets[2] (after NFT and LP)
        reserve_y = None
        for asset in assets:
            if asset.get("tokenId") == token_y_id:
                reserve_y = int(asset.get("amount", 0))
                break

        if reserve_y is None:
            result["error"] = "Token Y reserve not found"
            return result

        result["reserve_x"] = str(reserve_x)
        result["reserve_y"] = str(reserve_y)
        result["token_x_erg"] = 1

        if token_y_price is None:
            result["error"] = "No price for token Y"
            result["token_y_erg"] = "REVIEW"
            return result

        result["token_y_erg"] = token_y_price

        # Calculate pool value in ERG
        decimals_x = ERG_DECIMALS
        decimals_y = pool["asset_y"]["decimals"]

        reserve_x_erg = reserve_x / (10 ** decimals_x)
        reserve_y_erg = (reserve_y / (10 ** decimals_y)) * token_y_price

        pool_value_erg = reserve_x_erg + reserve_y_erg

    else:  # T2T
        token_x_id = pool["asset_x"]["id"]
        token_x_price = get_token_price(token_x_id, month_date, prices_data)

        # Find reserves for both tokens
        reserve_x = None
        reserve_y = None
        for asset in assets:
            if asset.get("tokenId") == token_x_id:
                reserve_x = int(asset.get("amount", 0))
            elif asset.get("tokenId") == token_y_id:
                reserve_y = int(asset.get("amount", 0))

        if reserve_x is None:
            result["error"] = "Token X reserve not found"
            return result
        if reserve_y is None:
            result["error"] = "Token Y reserve not found"
            return result

        result["reserve_x"] = str(reserve_x)
        result["reserve_y"] = str(reserve_y)

        if token_x_price is None:
            result["error"] = "No price for token X"
            result["token_x_erg"] = "REVIEW"
            return result
        if token_y_price is None:
            result["error"] = "No price for token Y"
            result["token_y_erg"] = "REVIEW"
            return result

        result["token_x_erg"] = token_x_price
        result["token_y_erg"] = token_y_price

        # Calculate pool value in ERG
        decimals_x = pool["asset_x"]["decimals"]
        decimals_y = pool["asset_y"]["decimals"]

        reserve_x_erg = (reserve_x / (10 ** decimals_x)) * token_x_price
        reserve_y_erg = (reserve_y / (10 ** decimals_y)) * token_y_price

        pool_value_erg = reserve_x_erg + reserve_y_erg

    # Calculate LP price
    lp_price_erg = pool_value_erg / circulating_lp

    # Get ERG/USD for reference (USD values are secondary)
    erg_usd = get_erg_usd(month_date, prices_data)

    result["pool_value_erg"] = pool_value_erg
    result["lp_price_erg"] = lp_price_erg

    # Also include USD values for reference
    if erg_usd > 0:
        result["lp_price_usd"] = str(lp_price_erg * erg_usd)
        result["pool_value_usd"] = str(pool_value_erg * erg_usd)
        result["erg_usd"] = str(erg_usd)
    else:
        result["lp_price_usd"] = str(lp_price_erg)  # Fallback to ERG value
        result["pool_value_usd"] = str(pool_value_erg)
        result["erg_usd"] = "1"

    return result


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
    log("Script 4: refresh_lp_valuations.py")
    log("=" * 60)

    # Get month info
    month_info = get_new_month_info()
    if month_info is None:
        return 1

    month_date = month_info["date"]
    block_height = month_info["height"]
    log(f"Calculating valuations for month: {month_date}")
    log(f"Block height: {block_height}")

    # Load pool pairs
    lp_pairs_data = load_json(LP_TOKEN_PAIRS_FILE)
    if not lp_pairs_data or not lp_pairs_data.get("pools"):
        log("ERROR: No LP pairs data found")
        return 1

    pools = [p for p in lp_pairs_data["pools"] if p.get("status") == "active"]
    log(f"Active pools to process: {len(pools)}")

    # Load token prices
    prices_data = load_json(TOKEN_PRICES_FILE)
    if not prices_data:
        prices_data = load_json(PUBLIC_TOKEN_PRICES_FILE)

    if not prices_data:
        log("ERROR: No token prices data found")
        return 1

    # Load existing LP prices
    lp_prices_data = load_json(LP_PRICES_FILE)
    if not lp_prices_data:
        lp_prices_data = load_json(PUBLIC_LP_PRICES_FILE)

    if not lp_prices_data:
        lp_prices_data = {
            "metadata": {
                "generated": None,
                "total_records": 0,
                "n2t_records": 0,
                "t2t_records": 0,
                "valid_records": 0,
                "review_records": 0,
                "date_range": {"start": None, "end": None},
                "note": "decimals_x and decimals_y included for direct calculation"
            },
            "records": []
        }

    # Check for existing records for this month
    existing_lp_ids = set()
    for record in lp_prices_data.get("records", []):
        if record.get("month") == month_date:
            existing_lp_ids.add(record.get("lp_token_id"))

    # Track statistics
    n2t_valued = 0
    t2t_valued = 0
    review_flagged = 0
    new_records = []

    # Process each pool
    for i, pool in enumerate(pools, 1):
        lp_token_id = pool["lp_token_id"]

        # Skip if already processed for this month
        if lp_token_id in existing_lp_ids:
            log(f"[{i}/{len(pools)}] Skipping {pool.get('lp_token_name', 'Unknown')} - already exists")
            continue

        log(f"[{i}/{len(pools)}] Processing {pool.get('lp_token_name', 'Unknown')}...")

        # Check if pool was created before this month
        creation_height = pool.get("creation_height", 0)
        if creation_height and creation_height > block_height:
            log(f"  Pool not created yet at height {block_height}")
            result = {
                "month": month_date,
                "pool_type": pool["pool_type"],
                "lp_token_id": lp_token_id,
                "pool_name": pool.get("lp_token_name", "Unknown"),
                "lp_price_erg": "REVIEW",
                "lp_price_usd": "REVIEW",
                "pool_value_erg": "REVIEW",
                "pool_value_usd": "REVIEW",
                "reserve_x": "REVIEW",
                "reserve_y": "REVIEW",
                "circulating_lp": "REVIEW",
                "erg_usd": "REVIEW",
                "token_x_erg": 1,
                "token_y_erg": "REVIEW",
                "error": "Pool not created yet",
                "decimals_x": pool["asset_x"]["decimals"],
                "decimals_y": pool["asset_y"]["decimals"]
            }
            new_records.append(result)
            review_flagged += 1
            continue

        # Query pool state at block height
        pool_nft_id = pool["pool_nft_id"]
        box = query_pool_at_height(pool_nft_id, block_height)

        if box is None:
            log(f"  Could not find pool state at height {block_height}")
            result = {
                "month": month_date,
                "pool_type": pool["pool_type"],
                "lp_token_id": lp_token_id,
                "pool_name": pool.get("lp_token_name", "Unknown"),
                "lp_price_erg": "REVIEW",
                "lp_price_usd": "REVIEW",
                "pool_value_erg": "REVIEW",
                "pool_value_usd": "REVIEW",
                "reserve_x": "REVIEW",
                "reserve_y": "REVIEW",
                "circulating_lp": "REVIEW",
                "erg_usd": "REVIEW",
                "token_x_erg": 1,
                "token_y_erg": "REVIEW",
                "error": "Query failed",
                "decimals_x": pool["asset_x"]["decimals"],
                "decimals_y": pool["asset_y"]["decimals"]
            }
            new_records.append(result)
            review_flagged += 1
            time.sleep(RATE_LIMIT_DELAY)
            continue

        # Calculate LP value
        result = calculate_lp_value(pool, box, month_date, prices_data)
        new_records.append(result)

        if result.get("error"):
            review_flagged += 1
            log(f"  Error: {result['error']}")
        else:
            if pool["pool_type"] == "N2T":
                n2t_valued += 1
            else:
                t2t_valued += 1
            log(f"  LP price: {result['lp_price_erg']:.2e} ERG")

        time.sleep(RATE_LIMIT_DELAY)

    # Append new records
    lp_prices_data["records"].extend(new_records)

    # Sort records by month, then by pool type, then by lp_token_id
    lp_prices_data["records"].sort(key=lambda r: (r.get("month", ""), r.get("pool_type", ""), r.get("lp_token_id", "")))

    # Update metadata
    now = datetime.now(timezone.utc).isoformat()
    all_n2t = sum(1 for r in lp_prices_data["records"] if r.get("pool_type") == "N2T")
    all_t2t = sum(1 for r in lp_prices_data["records"] if r.get("pool_type") == "T2T")
    all_valid = sum(1 for r in lp_prices_data["records"] if not r.get("error"))
    all_review = sum(1 for r in lp_prices_data["records"] if r.get("error") or r.get("lp_price_erg") == "REVIEW")

    lp_prices_data["metadata"]["generated"] = now
    lp_prices_data["metadata"]["total_records"] = len(lp_prices_data["records"])
    lp_prices_data["metadata"]["n2t_records"] = all_n2t
    lp_prices_data["metadata"]["t2t_records"] = all_t2t
    lp_prices_data["metadata"]["valid_records"] = all_valid
    lp_prices_data["metadata"]["review_records"] = all_review

    # Update date range
    months = sorted(set(r.get("month", "") for r in lp_prices_data["records"] if r.get("month")))
    if months:
        lp_prices_data["metadata"]["date_range"]["start"] = months[0]
        lp_prices_data["metadata"]["date_range"]["end"] = months[-1]

    # Save to data directory
    save_json(LP_PRICES_FILE, lp_prices_data)

    # Also update public data directory for the web app
    save_json(PUBLIC_LP_PRICES_FILE, lp_prices_data)

    log("=" * 60)
    log(f"Results:")
    log(f"  Month: {month_date}")
    log(f"  N2T valued: {n2t_valued}")
    log(f"  T2T valued: {t2t_valued}")
    log(f"  Review flagged: {review_flagged}")
    log(f"  Total records: {len(lp_prices_data['records'])}")
    log("=" * 60)

    # Update refresh log
    update_refresh_log("lp_valuations", "success", {
        "month": month_date,
        "n2t_valued": n2t_valued,
        "t2t_valued": t2t_valued,
        "review_flagged": review_flagged
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
