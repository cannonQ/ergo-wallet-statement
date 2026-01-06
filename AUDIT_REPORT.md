# Ergo Wallet Statement Viewer - Optimization & Security Audit Report

**Date:** January 2026
**Auditor:** Claude Code
**Version Audited:** Current main branch

---

## Executive Summary

This audit covers performance optimization and security review of the Ergo Wallet Statement Viewer application. The application is generally well-architected with good separation of concerns. Several optimizations have been implemented, and security posture is solid with no critical vulnerabilities found.

---

## Part 1: Performance Audit

### 1.1 Bundle Analysis

| Asset | Size | Gzip |
|-------|------|------|
| JavaScript | 438 KB | 140 KB |
| CSS | 22 KB | 5 KB |
| Total | 460 KB | 145 KB |

**Assessment:** Bundle size is reasonable for the feature set. Chart.js accounts for a significant portion.

### 1.2 Large JSON Files

| File | Size | Purpose |
|------|------|---------|
| lp_historical_prices_v5.json | 6.9 MB | LP token valuations by month |
| historical_token_prices_v5.json | 1000 KB | Historical token prices |
| token_prices_lookup_v5.json | 970 KB | Token prices in ERG by month |
| cyberverse_ids.json | 1021 KB | NFT collection IDs |

**Issues Found:**
- Large files loaded on-demand but not cached persistently
- On repeat visits, users re-download these large files

**Implemented Fix:**
- Added IndexedDB caching service (`src/services/indexedDbCache.ts`)
- Modified `historicalPrices.ts` to cache LP and token price data
- **Key Insight:** Historical data is IMMUTABLE - past months never change, only new months are appended
- Cache TTL set to 1 year (effectively permanent)
- Version-based invalidation (v5 in key) - cache auto-invalidates when data version changes
- Stores `lastMonth` metadata for potential future smart refresh

**Impact:** ~8MB saved on ALL repeat visits (cache essentially permanent), near-instant loading

### 1.3 API Call Patterns

**Current Implementation:**
- `ergoApi.ts:392` - Sequential balance + token fetch
- `ergoApi.ts:346` - Fetches 500 transactions for month filtering (client-side)
- LP pair info fetched in loop (`Holdings.tsx:64-73`)

**Issues Found:**
1. Transaction fetching uses large batch (500) then filters client-side
2. LP pair info fetched serially in useEffect loop
3. Historical prices for chart calculated sequentially per month

**Recommendations:**
- Consider API pagination for transactions (if API supports)
- Batch LP pair info requests (medium effort)
- Use `Promise.all` for parallel month processing (already done in some places)

### 1.4 React Performance

**Issues Found:**
1. Holdings array created on every render (expensive computation)
2. Chart data recalculated on unrelated state changes
3. Category values computed via multiple `.filter().reduce()` calls

**Implemented Fixes:**
1. Added `useMemo` for holdings computation with proper dependencies
2. Memoized chart data computation
3. Memoized category value calculation with single-pass loop
4. Added category cache for `categorizeToken()` function

**Impact:** Reduced unnecessary recalculations, smoother UI during state updates

### 1.5 Caching Strategy

**Current State:**
| Cache Type | Location | TTL |
|------------|----------|-----|
| LP pair names | In-memory | 10 min |
| Current height | In-memory | 1 min |
| Month transactions | In-memory | 2 min |
| Spectrum pool | In-memory | 5 min |
| Token blacklist | In-memory | 1 hour |

**Implemented Fix:**
- Added IndexedDB caching for large JSON files (1-year TTL, version-based invalidation)

**Future Recommendations:**
- Add service worker for offline support
- Cache wallet data in sessionStorage for browser refresh
- Consider URL-based state for shareable links

### 1.6 Performance Recommendations Priority Matrix

| Optimization | Impact | Effort | Status |
|-------------|--------|--------|--------|
| IndexedDB for JSON files | High | Low | ✅ Implemented |
| Memoize holdings/chart | High | Low | ✅ Implemented |
| Category value optimization | Medium | Low | ✅ Implemented |
| Service worker | Medium | Medium | Recommended |
| Split LP prices by year | High | High | Recommended |
| Parallel LP info fetch | Low | Medium | Optional |

---

## Part 2: Security Audit

### 2.1 npm Audit Results

**Before fix:** 12 vulnerabilities (4 high, 6 moderate, 2 low)

| Package | Severity | Issue | Status |
|---------|----------|-------|--------|
| cross-spawn | High | ReDoS | ✅ Fixed |
| glob | High | Command injection | ✅ Fixed |
| @babel/helpers | Moderate | ReDoS | ✅ Fixed |
| nanoid | Moderate | Predictable values | ✅ Fixed |
| path-to-regexp | High | Backtracking | Dev dep only |
| esbuild | Moderate | Local file access | Dev dep only |
| undici | Moderate | Various | Dev dep only |

**After `npm audit fix`:** 8 remaining vulnerabilities (all in dev dependencies)

**Assessment:** Remaining vulnerabilities are in `@vercel/node` and `vite` dev dependencies. These do not affect the production client-side bundle. Safe to deploy.

### 2.2 Input Validation

**Wallet Address Validation:**
```typescript
// ergoApi.ts:1076
isValidAddress(address: string): boolean {
  return /^9[a-zA-Z0-9]{50}$/.test(address);
}

// AddressInput.tsx:27
const isValidFormat = /^9[a-zA-Z0-9]{50}$/.test(address.trim());
```

**Assessment:** ✅ Good - Strict regex validation for Ergo addresses

### 2.3 XSS Prevention

**Findings:**
- No use of `dangerouslySetInnerHTML` anywhere in codebase
- React's default escaping handles all rendered content
- Token names and descriptions displayed safely via JSX text nodes
- NFT artwork URLs from IPFS passed to `<img src>` (safe)

**Assessment:** ✅ No XSS vulnerabilities found

### 2.4 External API Security

| API | URL | Protocol | Notes |
|-----|-----|----------|-------|
| Ergo Explorer | api.ergoplatform.com | HTTPS | ✅ Official API |
| Crux Finance | api.cruxfinance.io | HTTPS | ✅ Token prices |
| Spectrum | api.spectrum.fi | HTTPS | ✅ LP data |
| GitHub | raw.githubusercontent.com | HTTPS | ✅ Blacklist |
| IPFS | ipfs.io | HTTPS | ✅ NFT images |

**Assessment:** All external APIs use HTTPS. No mixed content issues.

### 2.5 Data Handling

**Sensitive Data Check:**
- No private keys or seeds stored/handled
- Wallet addresses are public blockchain data
- No authentication tokens or secrets
- No localStorage of sensitive data

**Assessment:** ✅ No sensitive data exposure risks

### 2.6 Content Security Policy

**Current State:** No CSP headers in index.html

**Recommendation:** For GitHub Pages, consider adding CSP via `<meta>` tag:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  connect-src 'self' https://api.ergoplatform.com https://api.cruxfinance.io https://api.spectrum.fi https://raw.githubusercontent.com https://ipfs.io;
  font-src 'self';
">
```

**Note:** This is optional for a read-only viewer with no auth.

### 2.7 URL Parameter Handling

**Findings:**
- URLSearchParams used only for API query building (`ergoApi.ts:298, 454`)
- No URL parameters processed for application state
- No risk of URL-based injection

**Assessment:** ✅ Safe

### 2.8 CORS Considerations

**Findings:**
- All external APIs properly handle CORS
- No proxy server needed
- Historical price API route exists but uses same-origin fetch

**Assessment:** ✅ No CORS issues

---

## Part 3: Implemented Changes

### Files Created
1. `src/services/indexedDbCache.ts` - IndexedDB caching service

### Files Modified
1. `src/services/historicalPrices.ts` - Added IndexedDB caching for large JSON files
2. `src/App.tsx` - Added memoization for expensive computations:
   - `categorizeToken()` with cache
   - `holdings` array with `useMemo`
   - `chartData` with `useMemo`
   - Category values with single-pass computation

### npm Dependencies
- Ran `npm audit fix` to resolve safe vulnerabilities

---

## Part 4: Future Recommendations

### High Priority
1. **Split LP prices by year** - Split `lp_historical_prices_v5.json` into yearly files to reduce initial load
2. **Service worker** - Add offline support and intelligent caching
3. **URL state management** - Allow sharing wallet views via URL parameters

### Medium Priority
4. **Batch LP pair info** - Modify `getLpPairInfo` to accept array of IDs
5. **Virtual scrolling** - For wallets with 100+ tokens
6. **Web Workers** - Move heavy price calculations off main thread

### Low Priority
7. **Code splitting** - Lazy load NFT gallery and chart components
8. **Image lazy loading** - For NFT gallery images
9. **Prefetch historical data** - Background load common months

---

## Conclusion

The Ergo Wallet Statement Viewer is a well-implemented application with:
- ✅ Good architecture and separation of concerns
- ✅ Proper input validation
- ✅ No XSS vulnerabilities
- ✅ Secure API communication
- ✅ No sensitive data exposure

The implemented optimizations will significantly improve:
- Repeat visit performance (IndexedDB caching)
- UI responsiveness (memoization)
- Reduced unnecessary recalculations

Remaining npm vulnerabilities are in dev dependencies only and do not affect production builds.
