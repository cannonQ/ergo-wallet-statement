# ERGO DEX LP Token Mapping System v5
## Data Flow Documentation

---

## Overview

This system maps all ERGO DEX liquidity pools on Ergo, tracks historical token prices, and calculates LP token valuations. Version 5 uses position-based asset extraction and the Ergo Explorer API for reliable pool data.

---

## Quick Start

```bash
# 1. Refresh pool data from Ergo Explorer API
python process_dex_pools_v5.py

# 2. Analyze price gaps and fetch missing prices
python price_gap_analysis_v5.py

# 3. Run LP valuations
python lp_valuation_n2t_v5.py
python lp_valuation_t2t_v5.py

# 4. Combine results
python combine_lp_prices_v5.py
```

---

## File Inventory

### Input Data Files
| File | Source | Contents |
|------|--------|----------|
| `DEX_boxes_unspent_byErgoTree_N2T.json` | Ergo Explorer API | Current N2T pool boxes |
| `DEX_boxes_unspent_byErgoTree_T2T.json` | Ergo Explorer API | Current T2T pool boxes |
| `pool_blacklist.json` | Manual curation | Pool NFT IDs to exclude |
| `month_end_block_heights_FINAL.json` | Calculated | 48 month-end block heights |

### Python Scripts
| File | Purpose |
|------|---------|
| `process_dex_pools_v5.py` | Maps pools using position-based extraction |
| `price_gap_analysis_v5.py` | Finds missing prices, fetches from Crux API |
| `lp_valuation_n2t_v5.py` | Calculates N2T LP token prices |
| `lp_valuation_t2t_v5.py` | Calculates T2T LP token prices |
| `combine_lp_prices_v5.py` | Merges N2T + T2T into single file |
| `extract_price_lookup.py` | Creates flat token price lookup |

### Output Files
| File | Contents |
|------|----------|
| `lp_token_pairs_v5.json` | Pool mapping (453 pools after blacklist) |
| `lp_token_pairs_v5.csv` | Same data, Excel-ready |
| `historical_token_prices_v5.json` | Token prices by month |
| `lp_historical_prices_v5.json` | LP valuations (12,668 records) |
| `lp_historical_prices_v5.csv` | Same data, Excel-ready |

---

## Data Sources

### Ergo Explorer API (Pool Data)
```
https://api.ergoplatform.com/api/v1/boxes/unspent/byErgoTree/{ergoTree}?limit=500
```

**ErgoTree Templates:**
- N2T: `1999030f0400040204020404040405feffffffffffffffff01...` (truncated)
- T2T: `19a9030f040004020402040404040406040605fefffffff...` (truncated)

### SigmaSpace GraphQL (Creation Heights)
```
https://explore.sigmaspace.io/api/graphql
```
Used to query token mint transactions for accurate pool creation heights.

### Crux Finance API (Token Prices)
```
https://api.cruxfinance.io/spectrum/price?token_id={id}&time_point={ms}
```

---

## Pool Box Structure

### N2T Pools (ERG/Token)
```
box.value = ERG reserve (nanoERG)
assets[0] = Pool NFT (amount = 1)
assets[1] = LP Token (amount ~9.22e18)
assets[2] = Token Y reserve
```

### T2T Pools (Token/Token)
```
box.value = minimal ERG (for fees)
assets[0] = Pool NFT (amount = 1)
assets[1] = LP Token (amount ~9.22e18)
assets[2] = Token X reserve
assets[3] = Token Y reserve
```

---

## LP Valuation Formula

```
Pool Value (USD) = Reserve_X_Value + Reserve_Y_Value

Where:
  Reserve_X_Value = (reserve_x / 10^decimals) × price_erg × erg_usd
  Reserve_Y_Value = (reserve_y / 10^decimals) × price_erg × erg_usd

Circulating LP = 9,223,372,036,854,774,807 - LP_in_pool

LP Price (USD) = Pool Value / Circulating LP
```

---

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Max LP Supply | 9,223,372,036,854,774,807 | 2^63 - 1 |
| ERG Token ID | `0000...0000` (64 zeros) | Placeholder for native ERG |
| ERG Decimals | 9 | nanoERG to ERG |

---

## Current Status (v5)

| Metric | Value |
|--------|-------|
| Total Pools | 453 (after blacklist) |
| N2T Pools | 256 |
| T2T Pools | 197 |
| Blacklisted | 119 |
| Date Range | Jan 2022 - Dec 2025 |
| Total LP Records | 12,668 |
| Valid Records | 12,164 (96%) |

---

## Blacklist

Pools are blacklisted for:
- Corrupted data (wrong token assignments)
- Test/wrapped tokens (WT_ERG, tSigUSD)
- Duplicate pools
- Dead/rugged pools with no value

Edit `pool_blacklist.json` to add/remove pools.

---

## Monthly Refresh Process

### Execution Order (dependencies)
```
1. block_heights     → Need month-end height
2. lp_token_pairs    → Need pool list (depends on #1)
3. token_prices      → Need prices for tokens (depends on #2)
4. lp_valuations     → Calculate LP prices (depends on #1, #2, #3)
5. derived_files     → Generate lookups (depends on #2)
```

### Refresh DEX Data
```bash
# N2T pools
curl "https://api.ergoplatform.com/api/v1/boxes/unspent/byErgoTree/1999030f0400040204020404040405feffffffffffffffff0105feffffffffffffffff01050004d00f040004000406050005000580dac409d819d601b2a5730000d602e4c6a70404d603db63087201d604db6308a7d605b27203730100d606b27204730200d607b27203730300d608b27204730400d6099973058c720602d60a999973068c7205027209d60bc17201d60cc1a7d60d99720b720cd60e91720d7307d60f8c720802d6107e720f06d6117e720d06d612998c720702720fd6137e720c06d6147308d6157e721206d6167e720a06d6177e720906d6189c72117217d6199c72157217d1ededededededed93c27201c2a793e4c672010404720293b27203730900b27204730a00938c7205018c720601938c7207018c72080193b17203730b9593720a730c95720e929c9c721072117e7202069c7ef07212069a9c72137e7214067e9c720d7e72020506929c9c721372157e7202069c7ef0720d069a9c72107e7214067e9c72127e7202050695ed720e917212730d907216a19d721872139d72197210ed9272189c721672139272199c7216721091720b730e?limit=500" -o DEX_boxes_unspent_byErgoTree_N2T.json

# T2T pools
curl "https://api.ergoplatform.com/api/v1/boxes/unspent/byErgoTree/19a9030f040004020402040404040406040605feffffffffffffffff0105feffffffffffffffff01050004d00f0400040005000500d81ad601b2a5730000d602e4c6a70404d603db63087201d604db6308a7d605b27203730100d606b27204730200d607b27203730300d608b27204730400d609b27203730500d60ab27204730600d60b9973078c720602d60c999973088c720502720bd60d8c720802d60e998c720702720dd60f91720e7309d6108c720a02d6117e721006d6127e720e06d613998c7209027210d6147e720d06d615730ad6167e721306d6177e720c06d6187e720b06d6199c72127218d61a9c72167218d1edededededed93c27201c2a793e4c672010404720292c17201c1a793b27203730b00b27204730c00938c7205018c720601ed938c7207018c720801938c7209018c720a019593720c730d95720f929c9c721172127e7202069c7ef07213069a9c72147e7215067e9c720e7e72020506929c9c721472167e7202069c7ef0720e069a9c72117e7215067e9c72137e7202050695ed720f917213730e907217a19d721972149d721a7211ed9272199c7217721492721a9c72177211?limit=500" -o DEX_boxes_unspent_byErgoTree_T2T.json
```

---

## Usage Examples

### Find LP Token Price
```python
import json

with open('lp_historical_prices_v5.json') as f:
    data = json.load(f)

# Find by LP token ID
lp_id = "your_lp_token_id"
prices = [r for r in data['records'] if r['lp_token_id'] == lp_id]
for p in prices[-3:]:  # Last 3 months
    print(f"{p['month']}: ${p['lp_price_usd']}")
```

### Get Token Price
```python
import json

with open('historical_token_prices_v5.json') as f:
    data = json.load(f)

token_id = "your_token_id"
prices = data['tokens'].get(token_id, {}).get('prices', {})
for month, info in sorted(prices.items())[-3:]:
    print(f"{month}: {info['price_erg']} ERG")
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v5 | 2026-01-05 | Position-based extraction, blacklist system, Ergo Explorer API |
| v4 | 2026-01-05 | NEW API integration (superseded) |
| v3 | 2026-01-04 | GraphQL-based pool mapping |

---

## Troubleshooting

**"Pool not created yet" errors**
- Pool creation_height is after the month-end being queried
- Expected behavior, not an error

**"No token prices" errors**
- Token not tracked by Crux API (test tokens, dead tokens)
- Check `price_gaps_to_fetch.json` for details

**Missing pools**
- Check if blacklisted in `pool_blacklist.json`
- May need to refresh DEX JSON files

---

## Future Automation (Phase 5)

Planned GitHub Actions workflow:
1. `refresh_block_heights.py` - Auto-run 5min after month end
2. `refresh_lp_token_pairs.py` - Detect new/inactive pools
3. `refresh_token_prices.py` - Fetch new month prices
4. `refresh_lp_valuations.py` - Calculate new LP prices
5. `refresh_derived_files.py` - Update lookups

Manual trigger recommended initially, move to scheduled after stabilization.

## Dependencies:
#1 block_heights
    ↓
#2 lp_token_pairs (needs #1)
    ↓
#3 token_prices (needs #2 for new tokens)
    ↓
#4 lp_valuations (needs #1, #2, #3)
    ↓
#5 derived_files (needs #2)

Agreed. Five separate scripts, each self-contained and resumable. Here's the structure:

## Script 1: refresh_block_heights.py

Input: block_heights.json
Action: Query for new month-end block (runs ~5min after month end)
Output: Appends to block_heights.json
Log output: { "month": "2025-01-31", "height": 1689940, "found_at": "2025-02-01T00:05:32" }


## Script 2: refresh_lp_token_pairs.py

Input: block_heights.json, lp_token_pairs.json, pool_blacklist.json
Action:

Pull fresh DEX JSONs from Explorer API
Find new pools (creation_height > last run)
Mark dissolved pools as inactive
Extract new tokens → append to tokens.json


Output:

Updates lp_token_pairs.json (append new, flag inactive)
Updates tokens.json (new token registry)


Log output: { "new_pools": 3, "inactive_pools": 1, "new_tokens": 2 }

New file - tokens.json:
{
  "token_id": {
    "name": "SigUSD",
    "ticker": "SigUSD",
    "decimals": 2,
    "creation_height": 506880,
    "creation_box": "abc123...",
    "total_supply": 1000000000,
    "logo_url": null,
    "description": "Algorithmic stablecoin",
    "first_seen": "2022-01-31",
    "source": "spectrum_dex"
  }
}

## Script 3: refresh_token_prices.py

Input: tokens.json, token_prices.json, block_heights.json
Action: Query Crux for new month prices (existing + new tokens)
Output: Appends to token_prices.json
Log output: { "tokens_queried": 215, "prices_added": 215, "errors": 3 }


## Script 4: refresh_lp_valuations.py

Input: lp_token_pairs.json, token_prices.json, block_heights.json
Action: Calculate LP prices for new month (N2T + T2T combined)
Output: Appends to lp_historical_prices.json
Log output: { "n2t_valued": 256, "t2t_valued": 197, "review_flagged": 27 }


## Script 5: refresh_derived_files.py

Input: lp_token_pairs.json, tokens.json
Action: Generate simplified lookups for web dashboard
Output:

lp-pairs.json (LP token ID → readable name)
token-lookup.json (if needed)


Log output: { "lp_pairs_generated": 453 }


## Script 6: refresh_log.py (or just append within each script)

Reads outputs from scripts 1-5
Appends summary to refresh_log.json