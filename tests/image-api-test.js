// Test script to check available image processing APIs in Cloudflare Workers
export default {
  async fetch(request, env) {
    const checks = {
      OffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      ImageBitmap: typeof ImageBitmap !== 'undefined',
      createImageBitmap: typeof createImageBitmap !== 'undefined',
      Blob: typeof Blob !== 'undefined',
      URL: typeof URL !== 'undefined'
    };

    return new Response(JSON.stringify(checks, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
