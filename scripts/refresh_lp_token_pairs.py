#!/usr/bin/env python3
"""
Script 2: refresh_lp_token_pairs.py
Purpose: Detect new pools, mark inactive pools, extract new tokens

Pulls fresh DEX data from Ergo Explorer API, compares against existing pool list,
and updates lp_token_pairs.json and tokens.json accordingly.
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

LP_TOKEN_PAIRS_FILE = os.path.join(DATA_DIR, "lp_token_pairs.json")
TOKENS_FILE = os.path.join(DATA_DIR, "tokens.json")
POOL_BLACKLIST_FILE = os.path.join(DATA_DIR, "pool_blacklist.json")
BLOCK_HEIGHTS_FILE = os.path.join(DATA_DIR, "block_heights.json")
REFRESH_LOG_FILE = os.path.join(DATA_DIR, "refresh_log.json")

ERGO_API = "https://api.ergoplatform.com/api/v1"
GRAPHQL_API = "https://explore.sigmaspace.io/api/graphql"
RATE_LIMIT_DELAY = 0.5  # seconds between API calls

# ErgoTree templates for Spectrum DEX pools
N2T_ERGOTREE = "1999030f0400040204020404040405feffffffffffffffff0105feffffffffffffffff01050004d00f040004000406050005000580dac409d819d601b2a5730000d602e4c6a70404d603db63087201d604db6308a7d605b27203730100d606b27204730200d607b27203730300d608b27204730400d6099973058c720602d60a999973068c7205027209d60bc17201d60cc1a7d60d99720b720cd60e91720d7307d60f8c720802d6107e720f06d6117e720d06d612998c720702720fd6137e720c06d6147308d6157e721206d6167e720a06d6177e720906d6189c72117217d6199c72157217d1ededededededed93c27201c2a793e4c672010404720293b27203730900b27204730a00938c7205018c720601938c7207018c72080193b17203730b9593720a730c95720e929c9c721072117e7202069c7ef07212069a9c72137e7214067e9c720d7e72020506929c9c721372157e7202069c7ef0720d069a9c72107e7214067e9c72127e7202050695ed720e917212730d907216a19d721872139d72197210ed9272189c721672139272199c7216721091720b730e"

T2T_ERGOTREE = "19a9030f040004020402040404040406040605feffffffffffffffff0105feffffffffffffffff01050004d00f0400040005000500d81ad601b2a5730000d602e4c6a70404d603db63087201d604db6308a7d605b27203730100d606b27204730200d607b27203730300d608b27204730400d609b27203730500d60ab27204730600d60b9973078c720602d60c999973088c720502720bd60d8c720802d60e998c720702720dd60f91720e7309d6108c720a02d6117e721006d6127e720e06d613998c7209027210d6147e720d06d615730ad6167e721306d6177e720c06d6187e720b06d6199c72127218d61a9c72167218d1edededededed93c27201c2a793e4c672010404720292c17201c1a793b27203730b00b27204730c00938c7205018c720601ed938c7207018c720801938c7209018c720a019593720c730d95720f929c9c721172127e7202069c7ef07213069a9c72147e7215067e9c720e7e72020506929c9c721472167e7202069c7ef0720e069a9c72117e7215067e9c72137e7202050695ed720f917213730e907217a19d721972149d721a7211ed9272199c7217721492721a9c72177211"

# Known ERG token ID placeholder
ERG_TOKEN_ID = "0" * 64
MAX_LP_SUPPLY = 9223372036854774807


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


def fetch_pools_by_ergotree(ergotree: str, pool_type: str) -> list:
    """Fetch all unspent pool boxes for a given ErgoTree."""
    url = f"{ERGO_API}/boxes/unspent/byErgoTree/{ergotree}"
    all_boxes = []
    offset = 0
    limit = 500

    while True:
        try:
            log(f"Fetching {pool_type} pools (offset={offset})...")
            resp = requests.get(url, params={"limit": limit, "offset": offset}, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("items", [])
            all_boxes.extend(items)

            if len(items) < limit:
                break
            offset += limit
            time.sleep(RATE_LIMIT_DELAY)
        except Exception as e:
            log(f"Error fetching {pool_type} pools: {e}")
            break

    log(f"Fetched {len(all_boxes)} {pool_type} pool boxes")
    return all_boxes


def get_token_info(token_id: str) -> dict | None:
    """Fetch token metadata from Ergo Explorer API."""
    if token_id == ERG_TOKEN_ID:
        return {"name": "ERG", "decimals": 9}

    try:
        resp = requests.get(f"{ERGO_API}/tokens/{token_id}", timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "name": data.get("name", "Unknown"),
                "decimals": data.get("decimals", 0)
            }
    except Exception as e:
        log(f"Error fetching token info for {token_id[:16]}...: {e}")

    return None


def get_creation_height(token_id: str) -> int | None:
    """Query SigmaSpace GraphQL for token mint creation height."""
    query = """
    query GetTokenMint($tokenId: String!) {
        boxes(tokenId: $tokenId, take: 1) {
            creationHeight
        }
    }
    """

    try:
        resp = requests.post(
            GRAPHQL_API,
            json={"query": query, "variables": {"tokenId": token_id}},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            boxes = data.get("data", {}).get("boxes", [])
            if boxes:
                return boxes[0].get("creationHeight")
    except Exception as e:
        log(f"Error fetching creation height for {token_id[:16]}...: {e}")

    return None


def extract_pool_info(box: dict, pool_type: str) -> dict | None:
    """
    Extract pool information from a pool box using position-based extraction.

    N2T Box Structure:
        box.value = ERG reserve (nanoERG)
        assets[0] = Pool NFT (amount = 1)
        assets[1] = LP Token (amount ~9.22e18)
        assets[2] = Token Y reserve

    T2T Box Structure:
        assets[0] = Pool NFT (amount = 1)
        assets[1] = LP Token (amount ~9.22e18)
        assets[2] = Token X reserve
        assets[3] = Token Y reserve
    """
    assets = box.get("assets", [])

    if len(assets) < 3:
        return None

    pool_nft_id = assets[0].get("tokenId")
    lp_token_id = assets[1].get("tokenId")

    if pool_type == "N2T":
        if len(assets) < 3:
            return None

        # ERG is asset X
        asset_x = {"id": ERG_TOKEN_ID, "name": "ERG", "decimals": 9}

        # Token Y from assets[2]
        token_y_id = assets[2].get("tokenId")
        token_y_info = get_token_info(token_y_id)
        if token_y_info is None:
            token_y_info = {"name": "Unknown", "decimals": 0}

        asset_y = {
            "id": token_y_id,
            "name": token_y_info["name"],
            "decimals": token_y_info["decimals"]
        }

    else:  # T2T
        if len(assets) < 4:
            return None

        # Token X from assets[2]
        token_x_id = assets[2].get("tokenId")
        token_x_info = get_token_info(token_x_id)
        if token_x_info is None:
            token_x_info = {"name": "Unknown", "decimals": 0}

        asset_x = {
            "id": token_x_id,
            "name": token_x_info["name"],
            "decimals": token_x_info["decimals"]
        }

        # Token Y from assets[3]
        token_y_id = assets[3].get("tokenId")
        token_y_info = get_token_info(token_y_id)
        if token_y_info is None:
            token_y_info = {"name": "Unknown", "decimals": 0}

        asset_y = {
            "id": token_y_id,
            "name": token_y_info["name"],
            "decimals": token_y_info["decimals"]
        }

    # Get LP token name
    lp_info = get_token_info(lp_token_id)
    lp_name = lp_info["name"] if lp_info else f"{asset_x['name']}/{asset_y['name']}"

    return {
        "pool_nft_id": pool_nft_id,
        "pool_type": pool_type,
        "lp_token_id": lp_token_id,
        "lp_token_name": lp_name,
        "creation_height": box.get("creationHeight"),
        "status": "active",
        "status_changed": None,
        "asset_x": asset_x,
        "asset_y": asset_y
    }


def update_refresh_log(step_name: str, status: str, details: dict):
    """Append step result to refresh_log.json."""
    log_data = load_json(REFRESH_LOG_FILE)
    if "runs" not in log_data:
        log_data["runs"] = []

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Get the current month from block_heights
    block_data = load_json(BLOCK_HEIGHTS_FILE)
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
    log("Script 2: refresh_lp_token_pairs.py")
    log("=" * 60)

    # Load existing data
    lp_pairs_data = load_json(LP_TOKEN_PAIRS_FILE)
    tokens_data = load_json(TOKENS_FILE)
    blacklist_data = load_json(POOL_BLACKLIST_FILE)

    # Initialize structures if empty
    if not lp_pairs_data:
        lp_pairs_data = {
            "metadata": {
                "last_refresh": None,
                "total_pools": 0,
                "active_pools": 0,
                "inactive_pools": 0
            },
            "pools": []
        }

    if not tokens_data:
        tokens_data = {
            "metadata": {
                "last_refresh": None,
                "total_tokens": 0
            },
            "tokens": {}
        }

    if not blacklist_data:
        blacklist_data = {"pool_nft_ids": [], "reasons": {}}

    # Get blacklisted pool NFT IDs
    blacklisted = set(blacklist_data.get("pool_nft_ids", []))
    log(f"Blacklist contains {len(blacklisted)} pools")

    # Build lookup of existing pools by pool_nft_id
    existing_pools = {p["pool_nft_id"]: p for p in lp_pairs_data.get("pools", [])}
    log(f"Existing pools: {len(existing_pools)}")

    # Fetch current pool boxes from Explorer API
    n2t_boxes = fetch_pools_by_ergotree(N2T_ERGOTREE, "N2T")
    time.sleep(RATE_LIMIT_DELAY)
    t2t_boxes = fetch_pools_by_ergotree(T2T_ERGOTREE, "T2T")

    # Track statistics
    new_pools_count = 0
    inactive_pools_count = 0
    new_tokens_count = 0
    current_pool_nfts = set()

    # Process N2T pools
    log("Processing N2T pools...")
    for box in n2t_boxes:
        time.sleep(RATE_LIMIT_DELAY * 0.5)  # Lighter rate limiting for batch processing

        pool_info = extract_pool_info(box, "N2T")
        if pool_info is None:
            continue

        pool_nft = pool_info["pool_nft_id"]
        current_pool_nfts.add(pool_nft)

        # Skip blacklisted pools
        if pool_nft in blacklisted:
            continue

        # Check if this is a new pool
        if pool_nft not in existing_pools:
            log(f"New N2T pool: {pool_info['lp_token_name']} ({pool_nft[:16]}...)")
            lp_pairs_data["pools"].append(pool_info)
            new_pools_count += 1

            # Extract tokens
            for asset in [pool_info["asset_x"], pool_info["asset_y"]]:
                token_id = asset["id"]
                if token_id != ERG_TOKEN_ID and token_id not in tokens_data["tokens"]:
                    tokens_data["tokens"][token_id] = {
                        "name": asset["name"],
                        "ticker": asset["name"],
                        "decimals": asset["decimals"],
                        "creation_height": get_creation_height(token_id),
                        "first_seen": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        "source": "spectrum_dex"
                    }
                    new_tokens_count += 1
                    log(f"New token: {asset['name']} ({token_id[:16]}...)")
                    time.sleep(RATE_LIMIT_DELAY)

    # Process T2T pools
    log("Processing T2T pools...")
    for box in t2t_boxes:
        time.sleep(RATE_LIMIT_DELAY * 0.5)

        pool_info = extract_pool_info(box, "T2T")
        if pool_info is None:
            continue

        pool_nft = pool_info["pool_nft_id"]
        current_pool_nfts.add(pool_nft)

        # Skip blacklisted pools
        if pool_nft in blacklisted:
            continue

        # Check if this is a new pool
        if pool_nft not in existing_pools:
            log(f"New T2T pool: {pool_info['lp_token_name']} ({pool_nft[:16]}...)")
            lp_pairs_data["pools"].append(pool_info)
            new_pools_count += 1

            # Extract tokens
            for asset in [pool_info["asset_x"], pool_info["asset_y"]]:
                token_id = asset["id"]
                if token_id != ERG_TOKEN_ID and token_id not in tokens_data["tokens"]:
                    tokens_data["tokens"][token_id] = {
                        "name": asset["name"],
                        "ticker": asset["name"],
                        "decimals": asset["decimals"],
                        "creation_height": get_creation_height(token_id),
                        "first_seen": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        "source": "spectrum_dex"
                    }
                    new_tokens_count += 1
                    log(f"New token: {asset['name']} ({token_id[:16]}...)")
                    time.sleep(RATE_LIMIT_DELAY)

    # Mark pools as inactive if they no longer appear in current boxes
    for pool in lp_pairs_data["pools"]:
        if pool["pool_nft_id"] not in current_pool_nfts and pool.get("status") == "active":
            pool["status"] = "inactive"
            pool["status_changed"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            inactive_pools_count += 1
            log(f"Marked inactive: {pool['lp_token_name']}")

    # Update metadata
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    active_count = sum(1 for p in lp_pairs_data["pools"] if p.get("status") == "active")
    inactive_count = len(lp_pairs_data["pools"]) - active_count

    lp_pairs_data["metadata"]["last_refresh"] = now
    lp_pairs_data["metadata"]["total_pools"] = len(lp_pairs_data["pools"])
    lp_pairs_data["metadata"]["active_pools"] = active_count
    lp_pairs_data["metadata"]["inactive_pools"] = inactive_count

    tokens_data["metadata"]["last_refresh"] = now
    tokens_data["metadata"]["total_tokens"] = len(tokens_data["tokens"])

    # Save updated files
    save_json(LP_TOKEN_PAIRS_FILE, lp_pairs_data)
    save_json(TOKENS_FILE, tokens_data)

    log("=" * 60)
    log(f"Results:")
    log(f"  New pools: {new_pools_count}")
    log(f"  Inactive pools: {inactive_pools_count}")
    log(f"  New tokens: {new_tokens_count}")
    log(f"  Total pools: {len(lp_pairs_data['pools'])} ({active_count} active)")
    log(f"  Total tokens: {len(tokens_data['tokens'])}")
    log("=" * 60)

    # Update refresh log
    update_refresh_log("lp_token_pairs", "success", {
        "new_pools": new_pools_count,
        "inactive_pools": inactive_pools_count,
        "new_tokens": new_tokens_count
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
