interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyClient {
  clientId: string;
  clientSecret: string;
  cachedToken: { token: string; expiresAt: number } | null;
  rateLimitedUntil: number;
}

let clients: SpotifyClient[] | null = null;
let currentClientIndex = 0;

/**
 * Parses all Spotify client credentials from environment variables.
 * Supports:
 *   SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET  (primary)
 *   SPOTIFY_CLIENT_ID_2 / SPOTIFY_CLIENT_SECRET_2
 *   SPOTIFY_CLIENT_ID_3 / SPOTIFY_CLIENT_SECRET_3
 *   ... up to _10
 */
function getClients(): SpotifyClient[] {
  if (clients) return clients;

  clients = [];

  // Primary client
  const primaryId = process.env.SPOTIFY_CLIENT_ID;
  const primarySecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (primaryId && primarySecret) {
    clients.push({
      clientId: primaryId,
      clientSecret: primarySecret,
      cachedToken: null,
      rateLimitedUntil: 0,
    });
  }

  // Additional clients (_2 through _10)
  for (let i = 2; i <= 10; i++) {
    const id = process.env[`SPOTIFY_CLIENT_ID_${i}`];
    const secret = process.env[`SPOTIFY_CLIENT_SECRET_${i}`];
    if (id && secret) {
      clients.push({
        clientId: id,
        clientSecret: secret,
        cachedToken: null,
        rateLimitedUntil: 0,
      });
    }
  }

  if (clients.length === 0) {
    throw new Error('At least one SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  }

  console.log(`Spotify auth: ${clients.length} client(s) configured`);
  return clients;
}

/**
 * Gets the next available (non-rate-limited) client index using round-robin.
 */
function pickClient(): SpotifyClient {
  const allClients = getClients();
  const now = Date.now();

  // Try round-robin starting from currentClientIndex
  for (let attempt = 0; attempt < allClients.length; attempt++) {
    const idx = (currentClientIndex + attempt) % allClients.length;
    const client = allClients[idx];
    if (client.rateLimitedUntil <= now) {
      currentClientIndex = (idx + 1) % allClients.length;
      return client;
    }
  }

  // All rate-limited — pick the one that becomes available soonest
  const soonest = allClients.reduce((a, b) =>
    a.rateLimitedUntil < b.rateLimitedUntil ? a : b
  );
  return soonest;
}

/**
 * Fetches (or returns cached) access token for a specific client.
 */
async function fetchTokenForClient(client: SpotifyClient): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (client.cachedToken && client.cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return client.cachedToken.token;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify token error: ${response.status} ${response.statusText}`);
  }

  const data: SpotifyTokenResponse = await response.json();
  client.cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return client.cachedToken.token;
}

/**
 * Gets a Spotify access token using Client Credentials flow.
 * Automatically rotates between configured clients.
 */
export async function getSpotifyAccessToken(): Promise<string> {
  const allClients = getClients();

  for (let attempt = 0; attempt < allClients.length; attempt++) {
    const client = pickClient();
    try {
      return await fetchTokenForClient(client);
    } catch (error) {
      console.error(`Spotify auth failed for client ${client.clientId.slice(0, 8)}..., trying next`);
      // Mark as rate-limited for 60 seconds so we try another client
      client.rateLimitedUntil = Date.now() + 60_000;
    }
  }

  throw new Error('All Spotify clients failed to obtain an access token');
}

/**
 * Marks the current token's client as rate-limited.
 * Call this when you receive a 429 response from the Spotify API.
 * @param retryAfterSeconds Seconds to wait before retrying (from Retry-After header)
 */
export function markCurrentClientRateLimited(retryAfterSeconds: number = 30): void {
  const allClients = getClients();
  // The last used client is at (currentClientIndex - 1)
  const lastUsedIdx = (currentClientIndex - 1 + allClients.length) % allClients.length;
  allClients[lastUsedIdx].rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
  console.log(`Spotify client ${allClients[lastUsedIdx].clientId.slice(0, 8)}... rate-limited for ${retryAfterSeconds}s`);
}


