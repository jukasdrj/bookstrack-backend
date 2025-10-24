# Image Processing APIs in Cloudflare Workers

**Research Date:** 2025-10-24
**Worker Runtime:** V8 isolate (browser-compatible APIs)

## Available APIs (Cloudflare Workers Runtime)

### ✅ Supported APIs

| API | Status | Notes |
|-----|--------|-------|
| `Blob` | ✅ Available | Standard Web API for binary data |
| `URL` | ✅ Available | Standard Web API for URL manipulation |
| `createImageBitmap()` | ✅ Available | Decodes image data into ImageBitmap |
| `ImageBitmap` | ✅ Available | Decoded image representation |
| `OffscreenCanvas` | ✅ Available | Canvas API without DOM |

### 📚 Documentation References

- [Cloudflare Workers Runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/)
- [Web Standards Support](https://developers.cloudflare.com/workers/runtime-apis/web-standards/)

## Selected Approach

**Primary:** OffscreenCanvas + ImageBitmap API

### Rationale

1. **Native Support:** Both APIs are part of Workers runtime (V8 isolate)
2. **No Dependencies:** No need for external WASM libraries
3. **High Performance:** Native browser APIs optimized for image processing
4. **Small Code Size:** No additional bundle overhead

### Implementation Pattern

```javascript
// 1. Convert ArrayBuffer to Blob
const blob = new Blob([imageData], { type: 'image/jpeg' });

// 2. Decode image
const imageBitmap = await createImageBitmap(blob);

// 3. Create canvas at target size
const canvas = new OffscreenCanvas(newWidth, newHeight);
const ctx = canvas.getContext('2d');

// 4. Configure high-quality interpolation
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// 5. Draw resized image
ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

// 6. Export as JPEG
const resizedBlob = await canvas.convertToBlob({
  type: 'image/jpeg',
  quality: 0.85
});

const resizedData = await resizedBlob.arrayBuffer();
```

## Performance Expectations

### Estimated Processing Time (Cloudflare Workers)

| Input Size | Target Size | Estimated Time | CPU Usage |
|------------|-------------|----------------|-----------|
| 5MB (1920px) | 1536px | 50-100ms | ~2-5% of 50ms limit |
| 5MB (1920px) | 1024px | 40-80ms | ~2-4% of 50ms limit |
| 5MB (1920px) | 768px | 30-60ms | ~1-3% of 50ms limit |

### CPU Time Limits

- **Free Tier:** 10ms CPU time per request
- **Paid Tier:** 50ms CPU time per request (our plan)

**Critical:** Image resizing should stay under 100ms to leave headroom for other processing (AI inference, R2 operations).

## Quality Considerations

### Interpolation Quality

`imageSmoothingQuality` options:
- `'low'` - Nearest neighbor (fast, pixelated)
- `'medium'` - Bilinear interpolation (balanced)
- `'high'` - Bicubic interpolation (best quality, slightly slower)

**Selected:** `'high'` for OCR quality preservation

### JPEG Quality Settings

| Quality | File Size | OCR Readability | Use Case |
|---------|-----------|-----------------|----------|
| 0.95 | Largest | Excellent | Gemini (large context) |
| 0.90 | Large | Excellent | Gemini (balanced) |
| 0.85 | Medium | Very Good | Llama 3.2 (our default) |
| 0.80 | Smaller | Good | LLaVA 1.5 |
| 0.75 | Smallest | Fair | UForm/Qwen (fast mode) |

## Fallback Strategies

### If OffscreenCanvas Unavailable

**Option 1:** Use ImageData + manual pixel manipulation (slower)

**Option 2:** Use WASM library (e.g., squoosh)
- Pros: Full control, predictable behavior
- Cons: Larger bundle size (~50KB), slower cold start

**Decision:** Not needed - OffscreenCanvas is available in Workers runtime

## Testing Validation

### Manual Testing (Production Worker)

To validate in production environment:

```bash
# Deploy test endpoint
wrangler dev tests/image-api-test.js --port 8788

# Test API availability
curl http://localhost:8788/
```

Expected response:
```json
{
  "OffscreenCanvas": true,
  "ImageBitmap": true,
  "createImageBitmap": true,
  "Blob": true,
  "URL": true
}
```

## Known Limitations

1. **No DOM Access:** `<canvas>` and `<img>` elements not available (expected in Workers)
2. **No File System:** All operations in-memory (expected in Workers)
3. **CPU Time Limits:** Must complete within 50ms (managed via async chunking)
4. **Memory Limits:** 128MB per request (5MB images well within limits)

## Conclusion

✅ **Ready to implement:** OffscreenCanvas + ImageBitmap provides native, high-performance image resizing without external dependencies.

**Next Steps:**
1. Implement `image-resizer.js` utility module
2. Add unit tests with test images
3. Integrate into `cloudflare-provider.js`
4. Validate with real bookshelf images
