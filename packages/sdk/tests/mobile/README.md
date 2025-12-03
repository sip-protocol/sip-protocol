# Mobile WASM Testing Guide

This directory contains tools and documentation for testing SIP Protocol's BrowserNoirProvider on mobile devices.

## Quick Start

1. **Start the test server** (from SDK root):
   ```bash
   node tests/mobile/serve-mobile-test.js
   ```

2. **Open on mobile device**:
   - Connect your phone/tablet to the same network
   - Open the URL shown in terminal (e.g., `http://192.168.1.x:3142`)

3. **Run tests**:
   - Check compatibility score
   - Click "Initialize Provider"
   - Click "Generate Test Proof"

## Mobile Browser Support Matrix

| Browser | Platform | SharedArrayBuffer | WASM | Workers | SIMD | Status |
|---------|----------|-------------------|------|---------|------|--------|
| Safari | iOS 15.2+ | ✅ | ✅ | ✅ | ✅ | **Full Support** |
| Safari | iOS < 15.2 | ❌ | ✅ | ✅ | ❌ | Limited |
| Chrome | Android 91+ | ✅* | ✅ | ✅ | ✅ | **Full Support** |
| Chrome | iOS | ❌ | ✅ | ✅ | ❌ | Limited (WebKit) |
| Firefox | Android | ✅* | ✅ | ✅ | ✅ | **Full Support** |
| Firefox | iOS | ❌ | ✅ | ✅ | ❌ | Limited (WebKit) |
| Samsung | Android | ✅* | ✅ | ✅ | ✅ | **Full Support** |

\* Requires COOP/COEP headers

## Server Requirements

For full WASM support with SharedArrayBuffer, your server **MUST** send these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers, SharedArrayBuffer is disabled in modern browsers for security reasons.

### Testing Headers

The included test server (`serve-mobile-test.js`) automatically sets these headers. For production:

**Nginx:**
```nginx
add_header Cross-Origin-Opener-Policy same-origin;
add_header Cross-Origin-Embedder-Policy require-corp;
```

**Apache:**
```apache
Header set Cross-Origin-Opener-Policy "same-origin"
Header set Cross-Origin-Embedder-Policy "require-corp"
```

**Express.js:**
```javascript
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
})
```

**Next.js (next.config.js):**
```javascript
module.exports = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      ],
    }]
  },
}
```

## Mobile Performance Characteristics

### iOS Safari
- **Memory**: Limited to ~1GB usable heap
- **WASM Speed**: Excellent (native compilation)
- **Workers**: Full support with SharedArrayBuffer (iOS 15.2+)
- **Timeout**: Recommend 120s for proof generation
- **Tips**:
  - Avoid backgrounding app during proof generation
  - Memory pressure can cause tab refresh

### Chrome Android
- **Memory**: Device dependent (check `navigator.deviceMemory`)
- **WASM Speed**: Excellent with SIMD
- **Workers**: Full support with COOP/COEP headers
- **Timeout**: 90-120s depending on device
- **Tips**:
  - Enable "Desktop site" mode for debugging
  - Use Chrome DevTools remote debugging

### Firefox Mobile
- **Memory**: Similar to Chrome
- **WASM Speed**: Good (slightly slower than Chrome)
- **Workers**: Full support
- **Timeout**: 120s recommended
- **Tips**:
  - `about:debugging` for remote debugging

## Compatibility Detection

Use the SDK's built-in detection utilities:

```typescript
import {
  BrowserNoirProvider,
  getMobileDeviceInfo,
  checkMobileWASMCompatibility
} from '@sip-protocol/sdk/browser'

// Check device info
const device = getMobileDeviceInfo()
console.log('Platform:', device.platform)  // 'ios' | 'android' | 'desktop'
console.log('Browser:', device.browser)     // 'safari' | 'chrome' | 'firefox'

// Check WASM compatibility
const compat = checkMobileWASMCompatibility()
console.log('Score:', compat.score)        // 0-100
console.log('Issues:', compat.issues)
console.log('Recommendations:', compat.recommendations)

// Get recommended config
const config = BrowserNoirProvider.getRecommendedConfig()
const provider = new BrowserNoirProvider(config)
```

## Troubleshooting

### "SharedArrayBuffer is not defined"
- **Cause**: Missing COOP/COEP headers
- **Fix**: Configure server to send required headers

### Proof generation times out
- **Cause**: Device too slow or memory constrained
- **Fix**: Increase timeout, reduce concurrent operations

### Page crashes during proof generation
- **Cause**: Memory exhaustion
- **Fix**: Use workers to isolate memory, avoid background tabs

### "WASM compilation failed"
- **Cause**: Browser doesn't support required WASM features
- **Fix**: Update browser, check compatibility score

### Slow performance on iOS Chrome/Firefox
- **Cause**: These browsers use WebKit engine (no SharedArrayBuffer)
- **Fix**: Recommend Safari for best iOS performance

## Testing Checklist

- [ ] **iOS Safari** (primary target)
  - [ ] Compatibility score ≥90
  - [ ] Provider initializes successfully
  - [ ] Funding proof generates
  - [ ] Validity proof generates
  - [ ] Fulfillment proof generates
  - [ ] Memory usage reasonable (<500MB peak)
  - [ ] No crashes on repeated proof generation

- [ ] **Chrome Android** (primary target)
  - [ ] Compatibility score ≥90
  - [ ] Provider initializes successfully
  - [ ] All proof types generate
  - [ ] Workers function correctly
  - [ ] Performance acceptable (<30s per proof)

- [ ] **Firefox Mobile** (secondary)
  - [ ] Basic functionality works
  - [ ] No critical errors

- [ ] **Edge Cases**
  - [ ] Low memory devices (<2GB) handle gracefully
  - [ ] Network interruption handled
  - [ ] App backgrounding doesn't corrupt state
  - [ ] Orientation changes handled

## Performance Benchmarks

Expected proof generation times (mock provider, for baseline):

| Device Class | Init | Funding | Validity | Fulfillment |
|-------------|------|---------|----------|-------------|
| High-end (iPhone 14+, Pixel 7+) | <1s | <100ms | <100ms | <100ms |
| Mid-range | 1-2s | 100-200ms | 100-200ms | 100-200ms |
| Low-end | 2-5s | 200-500ms | 200-500ms | 200-500ms |

*Note: Real Noir proofs will be significantly slower (30-120s)*

## Files in This Directory

- `mobile-test-harness.html` - Interactive test page
- `serve-mobile-test.js` - Test server with COOP/COEP headers
- `README.md` - This documentation
