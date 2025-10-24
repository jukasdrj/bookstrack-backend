/**
 * Model-specific configuration for image processing
 * Based on context window limits and OCR quality requirements
 */

/**
 * Model-specific configuration for image processing
 * Based on context window limits and OCR quality requirements
 */
export const MODEL_CONFIGS = {
  // Cloudflare Workers AI Models
  '@cf/meta/llama-3.2-11b-vision-instruct': {
    maxImageSize: 1536,      // 128K tokens → ~1.5MB max
    quality: 85,             // JPEG quality (0-100)
    contextWindow: 128000,
    avgProcessingTime: 12000, // 12 seconds
    provider: 'cloudflare'
  },
  '@cf/llava-hf/llava-1.5-7b-hf': {
    maxImageSize: 1024,      // 4K tokens → ~1MB max
    quality: 80,             // JPEG quality (0-100)
    contextWindow: 4096,
    avgProcessingTime: 8000,
    provider: 'cloudflare'
  },
  '@cf/unum/uform-gen2-qwen-500m': {
    maxImageSize: 768,       // 8K tokens → ~750KB max
    quality: 75,             // JPEG quality (0-100)
    contextWindow: 8192,
    avgProcessingTime: 5000,
    provider: 'cloudflare'
  },

  // Gemini Models (for reference, no resizing needed)
  'gemini-2.0-flash-exp': {
    maxImageSize: 3072,      // 2M tokens → ~10MB max
    quality: 90,             // JPEG quality (0-100)
    contextWindow: 2000000,
    avgProcessingTime: 35000,
    provider: 'gemini'
  }
};

/**
 * Get configuration for a model
 * @param {string} modelIdentifier - Model ID or provider parameter
 * @returns {Object} Model configuration
 */
export function getModelConfig(modelIdentifier) {
  // Direct lookup
  if (MODEL_CONFIGS[modelIdentifier]) {
    return MODEL_CONFIGS[modelIdentifier];
  }

  // Fallback: conservative defaults for unknown models
  return {
    maxImageSize: 1024,
    quality: 0.80,
    contextWindow: 4096,
    avgProcessingTime: 10000,
    provider: 'unknown'
  };
}

/**
 * Estimate token count from image size
 * Formula: (imageSizeKB / 3) * 1000
 *
 * @param {number} imageSizeBytes - Image size in bytes
 * @returns {number} Estimated token count
 */
export function estimateTokens(imageSizeBytes) {
  const sizeKB = imageSizeBytes / 1024;
  return Math.floor((sizeKB / 3) * 1000);
}

/**
 * Check if image needs resizing for model
 * @param {number} imageSizeBytes - Current image size
 * @param {string} modelIdentifier - Model to use
 * @returns {{needsResize: boolean, targetSize: number, quality: number, estimatedTokens: number, tokenLimit: number}}
 */
export function shouldResize(imageSizeBytes, modelIdentifier) {
  const config = getModelConfig(modelIdentifier);
  const estimatedTokens = estimateTokens(imageSizeBytes);

  // Add 20% safety margin
  const tokenLimit = config.contextWindow * 0.8;
  const needsResize = estimatedTokens > tokenLimit;

  return {
    needsResize,
    targetSize: config.maxImageSize,
    quality: config.quality,
    estimatedTokens,
    tokenLimit
  };
}
