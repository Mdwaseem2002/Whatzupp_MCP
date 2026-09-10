// src/lib/sfmcAuth.ts
// Salesforce Marketing Cloud OAuth2 Token Helper
// Caches token in memory with 18-minute TTL to avoid repeated auth calls

interface SfmcTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  rest_instance_url: string;
}

interface CachedToken {
  access_token: string;
  token_type: string;
  expiresAt: number; // Unix timestamp in ms
}

// In-memory token cache
let cachedToken: CachedToken | null = null;

// 18-minute TTL (SFMC tokens expire at 20 minutes; refresh 2 minutes early)
const TOKEN_TTL_MS = 18 * 60 * 1000;

/**
 * Get a valid SFMC access token, using cached value if still valid.
 * POST to {SFMC_AUTH_BASE_URI}/v2/token with client_credentials grant.
 * 
 * @returns Object with access_token and token_type
 * @throws Error if SFMC credentials are missing or auth fails
 */
export async function getSfmcAccessToken(): Promise<{ access_token: string; token_type: string }> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    console.log('[SFMC Auth] Using cached token (expires in', 
      Math.round((cachedToken.expiresAt - Date.now()) / 1000), 'seconds)');
    return {
      access_token: cachedToken.access_token,
      token_type: cachedToken.token_type,
    };
  }

  const authBaseUri = (process.env.SFMC_AUTH_BASE_URI || '').replace(/\/$/, '');
  const clientId = process.env.SFMC_CLIENT_ID;
  const clientSecret = process.env.SFMC_CLIENT_SECRET;

  if (!authBaseUri || !clientId || !clientSecret) {
    throw new Error(
      'Missing SFMC credentials. Ensure SFMC_AUTH_BASE_URI, SFMC_CLIENT_ID, and SFMC_CLIENT_SECRET are set in environment variables.'
    );
  }

  console.log('[SFMC Auth] Requesting new access token...');

  const response = await fetch(`${authBaseUri}/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SFMC Auth] Token request failed:', response.status, errorText);
    throw new Error(`SFMC auth failed with status ${response.status}: ${errorText}`);
  }

  const data: SfmcTokenResponse = await response.json();

  // Cache the token with 18-minute TTL
  cachedToken = {
    access_token: data.access_token,
    token_type: data.token_type,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  // Log only last 4 characters of token for security
  const tokenSuffix = data.access_token.slice(-4);
  console.log(`[SFMC Auth] New token cached (ends with ...${tokenSuffix}), TTL: 18 minutes`);

  return {
    access_token: data.access_token,
    token_type: data.token_type,
  };
}

/**
 * Invalidate the cached SFMC token (useful if a 401 is received).
 */
export function invalidateSfmcToken(): void {
  cachedToken = null;
  console.log('[SFMC Auth] Token cache invalidated');
}
