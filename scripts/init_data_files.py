#!/usr/bin/env python3
"""
Initialization script: init_data_files.py
Purpose: Initialize data/ directory from existing public/data/ files

This is a one-time setup script that copies and transforms existing data
files from public/data/ to data/ for use by the refresh scripts.

Run this once before running the monthly refresh workflow.
"""

import json
import os
import shutil
from datetime import datetime, timezone

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
PUBLIC_DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data")
EXPORTS_DIR = os.path.join(PROJECT_ROOT, "exports")


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


def init_block_heights():
    """Copy block heights from public/data to data/."""
    src = os.path.join(PUBLIC_DATA_DIR, "month_end_block_heights.json")
    dst = os.path.join(DATA_DIR, "block_heights.json")

    if os.path.exists(src):
        data = load_json(src)
        save_json(dst, data)
        log(f"  Copied {len(data.get('months', []))} months")
    else:
        log(f"  WARNING: Source file not found: {src}")


def init_token_prices():
    """Copy token prices from public/data to data/."""
    src = os.path.join(PUBLIC_DATA_DIR, "historical_token_prices_v5.json")
    dst = os.path.join(DATA_DIR, "token_prices.json")

    if os.path.exists(src):
        data = load_json(src)
        save_json(dst, data)
        log(f"  Copied {len(data.get('tokens', {}))} token price records")
    else:
        log(f"  WARNING: Source file not found: {src}")


def init_lp_prices():
    """Copy LP prices from public/data to data/."""
    src = os.path.join(PUBLIC_DATA_DIR, "lp_historical_prices_v5.json")
    dst = os.path.join(DATA_DIR, "lp_historical_prices.json")

    if os.path.exists(src):
        data = load_json(src)
        save_json(dst, data)
        log(f"  Copied {len(data.get('records', []))} LP price records")
    else:
        log(f"  WARNING: Source file not found: {src}")


def init_lp_pairs_and_tokens():
    """
    Create lp_token_pairs.json and tokens.json from existing lp-pairs.json
    and historical_token_prices_v5.json.
    """
    # Load existing data sources
    lp_pairs_src = os.path.join(PUBLIC_DATA_DIR, "lp-pairs.json")
    token_prices_src = os.path.join(PUBLIC_DATA_DIR, "historical_token_prices_v5.json")
    lp_prices_src = os.path.join(PUBLIC_DATA_DIR, "lp_historical_prices_v5.json")

    lp_pairs = load_json(lp_pairs_src)
    token_prices = load_json(token_prices_src)
    lp_prices = load_json(lp_prices_src)

    # Create tokens.json from token_prices
    tokens_data = {
        "metadata": {
            "last_refresh": datetime.now(timezone.utc).isoformat() + "Z",
            "total_tokens": 0
        },
        "tokens": {}
    }

    for token_id, token_info in token_prices.get("tokens", {}).items():
        tokens_data["tokens"][token_id] = {
            "name": token_info.get("ticker", "Unknown"),
            "ticker": token_info.get("ticker", "Unknown"),
            "decimals": token_info.get("decimals", 0),
            "creation_height": None,
            "first_seen": token_prices.get("months", ["unknown"])[0] if token_prices.get("months") else "unknown",
            "source": "spectrum_dex"
        }

    tokens_data["metadata"]["total_tokens"] = len(tokens_data["tokens"])
    save_json(os.path.join(DATA_DIR, "tokens.json"), tokens_data)
    log(f"  Created tokens.json with {len(tokens_data['tokens'])} tokens")

    # Create lp_token_pairs.json from lp-pairs.json and lp_historical_prices_v5.json
    lp_pairs_data = {
        "metadata": {
            "last_refresh": datetime.now(timezone.utc).isoformat() + "Z",
            "total_pools": 0,
            "active_pools": 0,
            "inactive_pools": 0
        },
        "pools": []
    }

    # Extract unique LP tokens from lp_prices records
    lp_info_map = {}
    for record in lp_prices.get("records", []):
        lp_id = record.get("lp_token_id")
        if lp_id and lp_id not in lp_info_map:
            lp_info_map[lp_id] = {
                "pool_type": record.get("pool_type", "N2T"),
                "pool_name": record.get("pool_name", "Unknown"),
                "decimals_x": record.get("decimals_x", 9),
                "decimals_y": record.get("decimals_y", 0)
            }

    # Build pool entries
    for lp_token_id, pool_name in lp_pairs.items():
        info = lp_info_map.get(lp_token_id, {})

        # Parse pool name to get asset names
        parts = pool_name.replace(" LP", "").split("/")
        asset_x_name = parts[0] if len(parts) > 0 else "Unknown"
        asset_y_name = parts[1] if len(parts) > 1 else "Unknown"

        pool_entry = {
            "pool_nft_id": None,  # Will be populated on next refresh
            "pool_type": info.get("pool_type", "N2T"),
            "lp_token_id": lp_token_id,
            "lp_token_name": pool_name,
            "creation_height": None,
            "status": "active",
            "status_changed": None,
            "asset_x": {
                "id": "0" * 64 if asset_x_name == "ERG" else None,
                "name": asset_x_name,
                "decimals": info.get("decimals_x", 9 if asset_x_name == "ERG" else 0)
            },
            "asset_y": {
                "id": None,
                "name": asset_y_name,
                "decimals": info.get("decimals_y", 0)
            }
        }
        lp_pairs_data["pools"].append(pool_entry)

    lp_pairs_data["metadata"]["total_pools"] = len(lp_pairs_data["pools"])
    lp_pairs_data["metadata"]["active_pools"] = len(lp_pairs_data["pools"])
    save_json(os.path.join(DATA_DIR, "lp_token_pairs.json"), lp_pairs_data)
    log(f"  Created lp_token_pairs.json with {len(lp_pairs_data['pools'])} pools")


def init_exports():
    """Copy existing lp-pairs.json to exports directory."""
    os.makedirs(EXPORTS_DIR, exist_ok=True)

    src = os.path.join(PUBLIC_DATA_DIR, "lp-pairs.json")
    dst = os.path.join(EXPORTS_DIR, "lp-pairs.json")

    if os.path.exists(src):
        shutil.copy2(src, dst)
        log(f"  Copied lp-pairs.json to exports/")
    else:
        log(f"  WARNING: Source file not found: {src}")


def main():
    log("=" * 60)
    log("Initializing data files from public/data/")
    log("=" * 60)

    # Ensure directories exist
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(EXPORTS_DIR, exist_ok=True)

    log("Initializing block_heights.json...")
    init_block_heights()

    log("Initializing token_prices.json...")
    init_token_prices()

    log("Initializing lp_historical_prices.json...")
    init_lp_prices()

    log("Creating lp_token_pairs.json and tokens.json...")
    init_lp_pairs_and_tokens()

    log("Setting up exports/...")
    init_exports()

    log("=" * 60)
    log("Initialization complete!")
    log("")
    log("Data files created in data/:")
    for f in os.listdir(DATA_DIR):
        log(f"  - {f}")
    log("")
    log("You can now run the monthly refresh workflow.")
    log("=" * 60)

    return 0


if __name__ == "__main__":
    import sys
    try:
        sys.exit(main())
    except Exception as e:
        log(f"FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
