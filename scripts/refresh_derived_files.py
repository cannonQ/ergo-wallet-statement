#!/usr/bin/env python3
"""
Script 5: refresh_derived_files.py
Purpose: Generate simplified lookup files for web dashboard

Creates lp-pairs.json and token-lookup.json from the source data files.
"""

import json
import os
import sys
from datetime import datetime, timezone

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
EXPORTS_DIR = os.path.join(PROJECT_ROOT, "exports")
PUBLIC_DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data")

LP_TOKEN_PAIRS_FILE = os.path.join(DATA_DIR, "lp_token_pairs.json")
TOKENS_FILE = os.path.join(DATA_DIR, "tokens.json")
BLOCK_HEIGHTS_FILE = os.path.join(DATA_DIR, "block_heights.json")
PUBLIC_BLOCK_HEIGHTS_FILE = os.path.join(PUBLIC_DATA_DIR, "month_end_block_heights.json")
REFRESH_LOG_FILE = os.path.join(DATA_DIR, "refresh_log.json")

# Export files
LP_PAIRS_EXPORT = os.path.join(EXPORTS_DIR, "lp-pairs.json")
TOKEN_LOOKUP_EXPORT = os.path.join(EXPORTS_DIR, "token-lookup.json")

# Also update public data for web app
PUBLIC_LP_PAIRS = os.path.join(PUBLIC_DATA_DIR, "lp-pairs.json")


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


def generate_lp_pairs(lp_pairs_data: dict) -> dict:
    """
    Generate lp-pairs.json: LP token ID → readable name

    Format:
    {
        "lp_token_id": "TokenX/TokenY LP"
    }
    """
    result = {}

    pools = lp_pairs_data.get("pools", [])
    for pool in pools:
        lp_token_id = pool.get("lp_token_id")
        if not lp_token_id:
            continue

        # Create readable name from asset names
        asset_x_name = pool.get("asset_x", {}).get("name", "?")
        asset_y_name = pool.get("asset_y", {}).get("name", "?")

        # Use the pool's LP token name if available, otherwise construct it
        lp_name = pool.get("lp_token_name", "")
        if not lp_name or lp_name == "Unknown":
            lp_name = f"{asset_x_name}/{asset_y_name}"

        result[lp_token_id] = lp_name

    return result


def generate_token_lookup(tokens_data: dict) -> dict:
    """
    Generate token-lookup.json: token ID → {name, ticker, decimals}

    Format:
    {
        "token_id": {
            "name": "Token Name",
            "ticker": "TKN",
            "decimals": 6
        }
    }
    """
    result = {}

    tokens = tokens_data.get("tokens", {})
    for token_id, token_info in tokens.items():
        result[token_id] = {
            "name": token_info.get("name", "Unknown"),
            "ticker": token_info.get("ticker", token_info.get("name", "Unknown")),
            "decimals": token_info.get("decimals", 0)
        }

    return result


def update_refresh_log(step_name: str, status: str, details: dict):
    """Append step result to refresh_log.json."""
    log_data = load_json(REFRESH_LOG_FILE)
    if "runs" not in log_data:
        log_data["runs"] = []

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Get the current month from block_heights
    block_data = load_json(BLOCK_HEIGHTS_FILE)
    if not block_data:
        block_data = load_json(PUBLIC_BLOCK_HEIGHTS_FILE)

    months = block_data.get("months", [])
    month = months[-1]["date"] if months else "unknown"

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
        **details
    }

    save_json(REFRESH_LOG_FILE, log_data)


def main():
    log("=" * 60)
    log("Script 5: refresh_derived_files.py")
    log("=" * 60)

    # Load source data
    lp_pairs_data = load_json(LP_TOKEN_PAIRS_FILE)
    tokens_data = load_json(TOKENS_FILE)

    if not lp_pairs_data:
        log("WARNING: No LP pairs data found, will create empty exports")
        lp_pairs_data = {"pools": []}

    if not tokens_data:
        log("WARNING: No tokens data found, will create empty exports")
        tokens_data = {"tokens": {}}

    # Generate lp-pairs.json
    log("Generating lp-pairs.json...")
    lp_pairs_lookup = generate_lp_pairs(lp_pairs_data)
    log(f"  Generated {len(lp_pairs_lookup)} LP pair entries")

    # Generate token-lookup.json
    log("Generating token-lookup.json...")
    token_lookup = generate_token_lookup(tokens_data)
    log(f"  Generated {len(token_lookup)} token entries")

    # Save to exports directory
    save_json(LP_PAIRS_EXPORT, lp_pairs_lookup)
    save_json(TOKEN_LOOKUP_EXPORT, token_lookup)

    # Also update public data directory for the web app
    save_json(PUBLIC_LP_PAIRS, lp_pairs_lookup)

    log("=" * 60)
    log(f"Results:")
    log(f"  LP pairs generated: {len(lp_pairs_lookup)}")
    log(f"  Tokens generated: {len(token_lookup)}")
    log("=" * 60)

    # Update refresh log
    update_refresh_log("derived_files", "success", {
        "lp_pairs_generated": len(lp_pairs_lookup),
        "tokens_generated": len(token_lookup)
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
