/**
 * Secrets Utility
 * 
 * Centralized utility for retrieving secrets from Cloudflare Secrets Store or direct environment variables.
 * 
 * This module handles the complexity of accessing secrets that may be provided as:
 * 1. Cloudflare Secrets Store binding (object with async .get() method)
 * 2. Direct environment variable (string value)
 * 
 * By centralizing secret access, we ensure consistent behavior across all API integrations
 * and make it easier to mock secrets in tests.
 */

/**
 * Get a secret value from Cloudflare Secrets Store or direct env var
 * 
 * Supports both:
 * - Secrets Store (binding with async .get() method)
 * - Direct environment variables (string value)
 * 
 * @param secretBinding - Either a Secrets Store binding or string value
 * @returns Promise<string | null> - The secret value or null if not found
 */
export async function getSecret(secretBinding: any): Promise<string | null> {
  // Check for null/undefined explicitly (not just falsy, to allow empty strings)
  if (secretBinding === null || secretBinding === undefined) return null

  // String literal (direct env var)
  if (typeof secretBinding === 'string') return secretBinding

  // Secrets Store binding (has async .get() method)
  if (typeof secretBinding?.get === 'function') {
    return await secretBinding.get()
  }

  return null
}

/**
 * Validate that a required secret is available
 * Throws error if secret is missing
 * 
 * @param secretBinding - Either a Secrets Store binding or string value
 * @param secretName - Name of the secret (used in error message)
 * @returns Promise<string> - The secret value
 * @throws Error if secret is not configured or empty
 */
export async function requireSecret(
  secretBinding: any,
  secretName: string
): Promise<string> {
  const value = await getSecret(secretBinding)
  if (!value) {
    throw new Error(`Required secret not configured: ${secretName}`)
  }
  return value
}
