// src/lib/salesCloudAuth.ts
// Caches Salesforce REST API token in memory with auto-refresh & CLI fallback

import { execSync } from 'child_process';

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

  // 1. Try Salesforce CLI auto-auth if forceRefresh or missing credentials in local dev
  if (forceRefresh || !clientId) {
    try {
      const cliOutput = execSync('sf org auth show-access-token --target-org myorg --json', {
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
      // CLI auto-auth fallback failed, continue to standard methods
    }
  }

  // 2. Use direct token from .env.local if not force refreshing
  if (!forceRefresh && directToken) {
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

  // 3. Try Salesforce OAuth Token flow
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

        return {
          access_token: cachedToken.access_token,
          instance_url: cachedToken.instance_url,
        };
      }
    } catch (err) {
      console.error('[SalesCloud Auth] Error fetching OAuth token:', err);
    }
  }

  // 4. Fallback for mock/dev
  console.warn('[SalesCloud Auth] Using fallback access token.');
  return {
    access_token: directToken || 'mock-salescloud-access-token-12345',
    instance_url: instanceUrlOverride,
  };
}

export function invalidateSalesCloudToken(): void {
  cachedToken = null;
  console.log('[SalesCloud Auth] Cached token invalidated');
}
