import { getSpotifyAccessToken, markCurrentClientRateLimited } from './auth';

interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{ url: string; height: number; width: number }>;
  genres: string[];
  followers?: {
    total: number;
  };
  popularity?: number;
  external_urls: {
    spotify: string;
  };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    images: Array<{ url: string; height: number; width: number }>;
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

interface SpotifySearchResponse {
  artists?: {
    items: SpotifyArtist[];
  };
  tracks?: {
    items: SpotifyTrack[];
  };
}

/**
 * Helper: Makes a Spotify API request with automatic rate-limit retry on another client.
 * Tries up to 2 times (original + 1 retry with a new token).
 */
async function spotifyFetch(url: string, maxRetries: number = 1): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const token = await getSpotifyAccessToken();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
      markCurrentClientRateLimited(retryAfter);
      if (attempt < maxRetries) {
        console.log(`Spotify 429 on ${url}, retrying with next client...`);
        continue;
      }
    }

    return response;
  }

  // Should not reach here, but satisfy TS
  throw new Error('spotifyFetch exhausted retries');
}

/**
 * Resolves basic artist metadata from Spotify Web API
 */
export async function resolveArtistMetadata(
  name: string
): Promise<{ spotifyId: string; imageUrl?: string; genres?: string[]; url?: string } | null> {
  try {
    const params = new URLSearchParams({
      q: name,
      type: 'artist',
      limit: '1',
    });
    
    const response = await spotifyFetch(`https://api.spotify.com/v1/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    const data: SpotifySearchResponse = await response.json();
    const artists = data.artists?.items;
    if (!artists || artists.length === 0) {
      return null;
    }

    // Find best match (exact name match preferred)
    const exactMatch = artists.find(a => a.name.toLowerCase() === name.toLowerCase());
    const artist = exactMatch || artists[0];

    return {
      spotifyId: artist.id,
      imageUrl: artist.images[0]?.url,
      genres: artist.genres,
      url: artist.external_urls.spotify,
    };
  } catch (error) {
    console.error(`Error resolving artist metadata for "${name}":`, error);
    return null;
  }
}

/**
 * Resolves enhanced artist metadata including followers, popularity, and multiple images
 * Used for the About section feature
 */
export async function resolveEnhancedArtistMetadata(
  spotifyId: string
): Promise<{
  followers?: number;
  popularity?: number;
  images?: Array<{ url: string; height: number; width: number }>;
  genres?: string[];
  url?: string;
} | null> {
  try {
    const response = await spotifyFetch(`https://api.spotify.com/v1/artists/${spotifyId}`);

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    const artist: SpotifyArtist = await response.json();

    return {
      followers: artist.followers?.total,
      popularity: artist.popularity,
      images: artist.images,
      genres: artist.genres,
      url: artist.external_urls.spotify,
    };
  } catch (error) {
    console.error(`Error fetching enhanced artist metadata for ID "${spotifyId}":`, error);
    return null;
  }
}

/**
 * Resolves track metadata from Spotify Web API
 */
export async function resolveTrackMetadata(
  trackName: string,
  artistName: string
): Promise<{ spotifyId: string; imageUrl?: string; previewUrl?: string; url?: string } | null> {
  try {
    // Search with both track and artist name for better results
    const query = `track:"${trackName}" artist:"${artistName}"`;
    
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: '5',
    });
    
    const response = await spotifyFetch(`https://api.spotify.com/v1/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    const data: SpotifySearchResponse = await response.json();
    const tracks = data.tracks?.items;
    if (!tracks || tracks.length === 0) {
      // Fallback: try with just track name
      return await resolveTrackMetadataFallback(trackName);
    }

    // Find best match (prefer exact artist name match)
    const exactArtistMatch = tracks.find(t =>
      t.artists.some(a => a.name.toLowerCase() === artistName.toLowerCase())
    );
    const track = exactArtistMatch || tracks[0];

    return {
      spotifyId: track.id,
      imageUrl: track.album.images[0]?.url,
      previewUrl: track.preview_url || undefined,
      url: track.external_urls.spotify,
    };
  } catch (error) {
    console.error(`Error resolving track metadata for "${trackName}" by "${artistName}":`, error);
    return null;
  }
}

/**
 * Fallback: search with just track name if artist search fails
 */
async function resolveTrackMetadataFallback(
  trackName: string
): Promise<{ spotifyId: string; imageUrl?: string; previewUrl?: string; url?: string } | null> {
  try {
    const params = new URLSearchParams({
      q: trackName,
      type: 'track',
      limit: '1',
    });
    
    const response = await spotifyFetch(`https://api.spotify.com/v1/search?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const data: SpotifySearchResponse = await response.json();
    const tracks = data.tracks?.items;
    if (!tracks || tracks.length === 0) {
      return null;
    }

    const track = tracks[0];
    return {
      spotifyId: track.id,
      imageUrl: track.album.images[0]?.url,
      previewUrl: track.preview_url || undefined,
      url: track.external_urls.spotify,
    };
  } catch (error) {
    return null;
  }
}

