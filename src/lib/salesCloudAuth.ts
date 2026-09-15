// src/lib/salesCloudAuth.ts
// Caches Salesforce REST API token in memory with auto-refresh & CLI fallback

let execSyncFn: ((cmd: string, opts: any) => string) | null = null;
try {
  // Only load child_process in Node.js environments (not Vercel Edge)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  execSyncFn = require('child_process').execSync;
} catch {
  // Vercel Edge or browser — execSync not available
}

interface CachedSfToken {
  access_token: string;
  instance_url: string;
  expiresAt: number;
}

let cachedToken: CachedSfToken | null = null;
const TOKEN_TTL_MS = 90 * 60 * 1000; // 90 minutes

export async function getSalesCloudAccessToken(forceRefresh = false): Promise<{ access_token: string; instance_url: string }> {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt) {
    return {
      access_token: cachedToken.access_token,
      instance_url: cachedToken.instance_url,
    };
  }

  const loginUrl = (process.env.SALESCLOUD_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '');
  const clientId = process.env.SALESCLOUD_CLIENT_ID;
  const clientSecret = process.env.SALESCLOUD_CLIENT_SECRET;
  const refreshToken = process.env.SALESCLOUD_REFRESH_TOKEN;
  const instanceUrlOverride = process.env.SALESCLOUD_INSTANCE_URL || 'https://pentacloudconsultancy-dev-ed.develop.my.salesforce.com';
  const directToken = process.env.SALESCLOUD_ACCESS_TOKEN;

  // 1. Use direct access token from env if available (most common in Vercel deployment)
  if (!forceRefresh && directToken) {
    console.log('[SalesCloud Auth] Using SALESCLOUD_ACCESS_TOKEN from env.');
    cachedToken = {
      access_token: directToken,
      instance_url: instanceUrlOverride,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    };
    return {
      access_token: directToken,
      instance_url: instanceUrlOverride,
    };
  }

  // 2. Try Salesforce OAuth Token flow (refresh_token or client_credentials)
  if (clientId && (refreshToken || clientSecret)) {
    try {
      const params = new URLSearchParams();
      if (refreshToken) {
        params.append('grant_type', 'refresh_token');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret || '');
        params.append('refresh_token', refreshToken);
      } else {
        params.append('grant_type', 'client_credentials');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret || '');
      }

      const tokenUrl = `${loginUrl}/services/oauth2/token`;
      console.log(`[SalesCloud Auth] Attempting OAuth token refresh via ${tokenUrl}`);
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (res.ok) {
        const data = await res.json();
        const instance_url = instanceUrlOverride || data.instance_url;

        cachedToken = {
          access_token: data.access_token,
          instance_url,
          expiresAt: Date.now() + TOKEN_TTL_MS,
        };

        console.log('[SalesCloud Auth] OAuth token refresh successful.');
        return {
          access_token: cachedToken.access_token,
          instance_url: cachedToken.instance_url,
        };
      } else {
        const errText = await res.text().catch(() => '');
        console.error(`[SalesCloud Auth] OAuth token refresh failed (${res.status}): ${errText}`);
      }
    } catch (err) {
      console.error('[SalesCloud Auth] Error fetching OAuth token:', err);
    }
  }

  // 3. Try Salesforce CLI auto-auth (local dev only — won't work on Vercel)
  if (execSyncFn) {
    try {
      const cliOutput = execSyncFn('sf org auth show-access-token --target-org myorg --json', {
        encoding: 'utf-8',
        timeout: 8000,
        windowsHide: true,
      });
      const parsed = JSON.parse(cliOutput);
      if (parsed?.result?.accessToken) {
        const freshToken = parsed.result.accessToken;
        cachedToken = {
          access_token: freshToken,
          instance_url: instanceUrlOverride,
          expiresAt: Date.now() + 60 * 60 * 1000, // cache 60 min
        };
        console.log('[SalesCloud Auth] Successfully auto-refreshed access token via SF CLI.');
        return { access_token: freshToken, instance_url: instanceUrlOverride };
      }
    } catch (cliErr) {
      // CLI auto-auth fallback failed — expected on Vercel, not an error
      console.log('[SalesCloud Auth] SF CLI not available (expected on Vercel).');
    }
  }

  // 4. Use direct token if forceRefresh was requested but OAuth/CLI both failed
  if (forceRefresh && directToken) {
    console.warn('[SalesCloud Auth] forceRefresh requested but OAuth/CLI failed. Reusing SALESCLOUD_ACCESS_TOKEN.');
    cachedToken = {
      access_token: directToken,
      instance_url: instanceUrlOverride,
      expiresAt: Date.now() + 30 * 60 * 1000, // shorter TTL since token may be stale
    };
    return {
      access_token: directToken,
      instance_url: instanceUrlOverride,
    };
  }

  // 5. Fallback for mock/dev
  console.warn('[SalesCloud Auth] Using fallback mock access token.');
  return {
    access_token: directToken || 'mock-salescloud-access-token-12345',
    instance_url: instanceUrlOverride,
  };
}

export function invalidateSalesCloudToken(): void {
  cachedToken = null;
  console.log('[SalesCloud Auth] Cached token invalidated');
}
