#!/usr/bin/env python3
"""
Script 1: refresh_block_heights.py
Purpose: Find and append the new month-end block height

Runs ~5 minutes after month end to capture the block closest to midnight UTC.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from calendar import monthrange
import requests

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
PUBLIC_DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data")

BLOCK_HEIGHTS_FILE = os.path.join(DATA_DIR, "block_heights.json")
PUBLIC_BLOCK_HEIGHTS_FILE = os.path.join(PUBLIC_DATA_DIR, "month_end_block_heights.json")
REFRESH_LOG_FILE = os.path.join(DATA_DIR, "refresh_log.json")

ERGO_API = "https://api.ergoplatform.com/api/v1"
RATE_LIMIT_DELAY = 0.5  # seconds between API calls


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


def get_last_month_end() -> tuple[int, int, str, int]:
    """
    Determine which month just ended (always the previous month).
    Returns: (year, month, date_str, timestamp_ms)
    """
    now = datetime.now(timezone.utc)

    # Always target the previous month (the most recent completed month)
    if now.month == 1:
        year = now.year - 1
        month = 12
    else:
        year = now.year
        month = now.month - 1

    # Get last day of the month
    _, last_day = monthrange(year, month)
    date_str = f"{year}-{month:02d}-{last_day:02d}"

    # Timestamp for 23:59:59 UTC on the last day
    month_end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
    timestamp_ms = int(month_end.timestamp() * 1000)

    return year, month, date_str, timestamp_ms


def find_block_at_timestamp(target_ms: int, max_retries: int = 3) -> dict | None:
    """
    Find the block closest to (but not exceeding) the target timestamp.
    Uses binary search approach with the Ergo Explorer API.
    """
    log(f"Searching for block at timestamp {target_ms} ({datetime.fromtimestamp(target_ms/1000, timezone.utc).isoformat()})")

    # First, get the latest block to establish upper bound
    for attempt in range(max_retries):
        try:
            resp = requests.get(
                f"{ERGO_API}/blocks",
                params={"sortBy": "height", "sortDirection": "desc", "limit": 1},
                timeout=30
            )
            resp.raise_for_status()
            latest = resp.json()["items"][0]
            upper_height = latest["height"]
            log(f"Latest block height: {upper_height}")
            break
        except Exception as e:
            log(f"Error getting latest block (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                return None

    time.sleep(RATE_LIMIT_DELAY)

    # Binary search for the block
    lower_height = 1
    best_block = None

    while lower_height <= upper_height:
        mid_height = (lower_height + upper_height) // 2

        for attempt in range(max_retries):
            try:
                resp = requests.get(
                    f"{ERGO_API}/blocks",
                    params={"sortBy": "height", "sortDirection": "asc", "offset": mid_height - 1, "limit": 1},
                    timeout=30
                )
                resp.raise_for_status()
                items = resp.json().get("items", [])
                if not items:
                    # Try direct block query
                    resp = requests.get(f"{ERGO_API}/blocks/at/{mid_height}", timeout=30)
                    resp.raise_for_status()
                    block_ids = resp.json()
                    if block_ids:
                        resp = requests.get(f"{ERGO_API}/blocks/{block_ids[0]}", timeout=30)
                        resp.raise_for_status()
                        block = resp.json()["block"]["header"]
                    else:
                        break
                else:
                    block = items[0]
                break
            except Exception as e:
                log(f"Error at height {mid_height} (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    block = None

        if block is None:
            break

        block_ts = block.get("timestamp", 0)
        block_height = block.get("height", mid_height)

        if block_ts <= target_ms:
            best_block = {
                "height": block_height,
                "timestamp_ms": block_ts,
                "timestamp_utc": datetime.fromtimestamp(block_ts / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            }
            lower_height = block_height + 1
        else:
            upper_height = block_height - 1

        time.sleep(RATE_LIMIT_DELAY)

    if best_block:
        log(f"Found block {best_block['height']} at {best_block['timestamp_utc']}")

    return best_block


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
    log("Script 1: refresh_block_heights.py")
    log("=" * 60)

    # Determine target month
    year, month, date_str, target_ms = get_last_month_end()
    log(f"Target month-end: {date_str}")

    # Load existing block heights
    block_data = load_json(BLOCK_HEIGHTS_FILE)

    # Also check public data dir for existing data
    if not block_data and os.path.exists(PUBLIC_BLOCK_HEIGHTS_FILE):
        log(f"Loading from public data: {PUBLIC_BLOCK_HEIGHTS_FILE}")
        block_data = load_json(PUBLIC_BLOCK_HEIGHTS_FILE)

    # Initialize structure if empty
    if not block_data:
        block_data = {
            "metadata": {
                "description": "Month-end block heights for Ergo blockchain",
                "generated": datetime.now(timezone.utc).isoformat() + "Z",
                "total_months": 0,
                "date_range": {"start": None, "end": None}
            },
            "months": [],
            "lookup": {}
        }

    # Check if month already exists
    if date_str in block_data.get("lookup", {}):
        log(f"Month {date_str} already exists with height {block_data['lookup'][date_str]}")
        log("Skipping - no update needed")
        update_refresh_log("block_heights", "skipped", {
            "month": date_str,
            "height": block_data["lookup"][date_str],
            "reason": "already_exists"
        })
        return 0

    # Find the block at month end
    block = find_block_at_timestamp(target_ms)

    if block is None:
        log("ERROR: Could not find block at target timestamp")
        update_refresh_log("block_heights", "error", {
            "month": date_str,
            "error": "block_not_found"
        })
        return 1

    # Add new month entry
    new_entry = {
        "year": year,
        "month": month,
        "date": date_str,
        "block_height": block["height"],
        "timestamp_ms": block["timestamp_ms"],
        "timestamp_utc": block["timestamp_utc"]
    }

    block_data["months"].append(new_entry)
    block_data["lookup"][date_str] = block["height"]

    # Sort months by date
    block_data["months"].sort(key=lambda x: x["date"])

    # Update metadata
    block_data["metadata"]["total_months"] = len(block_data["months"])
    block_data["metadata"]["generated"] = datetime.now(timezone.utc).isoformat() + "Z"
    if block_data["months"]:
        block_data["metadata"]["date_range"]["start"] = block_data["months"][0]["date"]
        block_data["metadata"]["date_range"]["end"] = block_data["months"][-1]["date"]

    # Save to data directory
    save_json(BLOCK_HEIGHTS_FILE, block_data)

    # Also update public data directory for the web app
    save_json(PUBLIC_BLOCK_HEIGHTS_FILE, block_data)

    log(f"SUCCESS: Added block height {block['height']} for {date_str}")

    # Update refresh log
    update_refresh_log("block_heights", "success", {
        "month": date_str,
        "height": block["height"],
        "timestamp_ms": block["timestamp_ms"]
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
