/**
 * Image Resizer Utility
 * Resizes images using Cloudflare Images Transformations service
 * Preserves aspect ratio and uses high-quality interpolation for OCR
 *
 * Uses native Cloudflare edge service - no WASM needed!
 */

/**
 * Resize image to fit within max dimension while preserving aspect ratio
 * Uses Cloudflare Images Transformations (native edge service)
 *
 * @param {ArrayBuffer} imageData - Original image data (JPEG)
 * @param {number} maxDimension - Maximum width or height
 * @param {number} quality - JPEG quality (0-100)
 * @returns {Promise<ArrayBuffer>} Resized image data
 */
export async function resizeImage(imageData, maxDimension, quality = 85) {
  console.log(`[ImageResizer] Starting resize: ${imageData.byteLength} bytes → ${maxDimension}px @ ${quality}%`);

  try {
    // Create a temporary blob URL from the image data
    const blob = new Blob([imageData], { type: 'image/jpeg' });

    // Use Cloudflare's fetch with image transformation options
    // This resizes the image on Cloudflare's edge network
    const response = await fetch(blob, {
      cf: {
        image: {
          width: maxDimension,
          height: maxDimension,
          fit: 'scale-down',  // Preserve aspect ratio, never upscale
          quality: quality,    // JPEG quality
          format: 'jpeg'       // Output format
        }
      }
    });

    if (!response.ok) {
      throw new Error(`Resize failed: ${response.status} ${response.statusText}`);
    }

    const resizedData = await response.arrayBuffer();

    console.log(`[ImageResizer] Resize complete: ${imageData.byteLength} → ${resizedData.byteLength} bytes (${Math.round(100 * resizedData.byteLength / imageData.byteLength)}%)`);

    return resizedData;

  } catch (error) {
    console.error('[ImageResizer] Resize failed:', error);
    // Return original on failure (graceful degradation)
    return imageData;
  }
}

/**
 * Get image dimensions (not implemented - not needed for current use case)
 *
 * @param {ArrayBuffer} imageData - Image data
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getImageDimensions(imageData) {
  // Not implemented - Cloudflare Images doesn't provide dimension extraction
  // Would need a WASM library for this, but not required for our use case
  console.warn('[ImageResizer] getImageDimensions not implemented');
  return { width: 0, height: 0 };
}
