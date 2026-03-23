import 'server-only';

interface MusicBrainzArtist {
  id: string;
  name: string;
  score?: number | string; // 0-100 relevance score
  'life-span'?: {
    begin?: string;
    end?: string;
  };
  area?: {
    name: string;
    'iso-3166-1-codes'?: string[];
  };
  'begin-area'?: {
    name: string;
  };
  country?: string; // ISO code
  relations?: Array<{
    type: string;
    url: {
      resource: string;
    };
  }>;
}

interface MusicBrainzSearchResult {
  created: string;
  count: number;
  offset: number;
  artists: MusicBrainzArtist[];
}

export interface ArtistMusicBrainzData {
  birthDate?: string;
  countryCode?: string;
  originCountry?: string;
  homepage?: string;
  instagram?: string;
}

/**
 * Fetches artist metadata (birth date, country, links) from MusicBrainz
 */
export async function fetchMusicBrainzData(artistName: string): Promise<ArtistMusicBrainzData | null> {
  try {
    // Step 1: Search for the artist
    const query = `artist:${encodeURIComponent(artistName)}`;
    const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=${query}&fmt=json`;
    
    console.log(`Searching MusicBrainz for: ${artistName}`);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'ChartMewwme/1.0.0 ( support@meww.me )',
        'Accept': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      if (searchResponse.status === 503) {
        console.log('MusicBrainz rate limited during search, backing off...');
        return null; 
      }
      console.error(`MusicBrainz Search API error: ${searchResponse.status} ${searchResponse.statusText}`);
      return null;
    }

    const searchData: MusicBrainzSearchResult = await searchResponse.json();
    
    if (!searchData.artists || searchData.artists.length === 0) {
      return null;
    }

    // Sort by score (descending)
    const sortedArtists = searchData.artists.sort((a, b) => {
      const scoreA = typeof a.score === 'string' ? parseInt(a.score, 10) : (a.score || 0);
      const scoreB = typeof b.score === 'string' ? parseInt(b.score, 10) : (b.score || 0);
      return scoreB - scoreA;
    });

    // Find the best match
    let bestMatch = sortedArtists.find(a => a.name.toLowerCase() === artistName.toLowerCase());
    
    if (!bestMatch) {
      const firstResult = sortedArtists[0];
      const firstScore = typeof firstResult.score === 'string' ? parseInt(firstResult.score, 10) : (firstResult.score || 0);
      
      if (firstScore >= 80) {
        bestMatch = firstResult;
      } else if (firstScore >= 50) {
        bestMatch = firstResult;
      }
    }
    
    if (!bestMatch) return null;
    
    console.log(`Selected MusicBrainz match: ${bestMatch.name} (Score: ${bestMatch.score}, ID: ${bestMatch.id})`);

    // Step 2: Fetch detailed info (including URL relations) using the MBID
    // We need to wait a bit to be nice to the API if we are making sequential calls, 
    // although for a single request flow it might be okay. 
    // MusicBrainz rate limit is 1 req/sec.
    await new Promise(resolve => setTimeout(resolve, 1100));

    const lookupUrl = `https://musicbrainz.org/ws/2/artist/${bestMatch.id}?inc=url-rels&fmt=json`;
    console.log(`Fetching MusicBrainz details for ID: ${bestMatch.id}`);

    const lookupResponse = await fetch(lookupUrl, {
      headers: {
        'User-Agent': 'ChartMewwme/1.0.0 ( support@meww.me )',
        'Accept': 'application/json',
      },
    });

    if (!lookupResponse.ok) {
       console.error(`MusicBrainz Lookup API error: ${lookupResponse.status} ${lookupResponse.statusText}`);
       return null;
    }

    const artistDetails: MusicBrainzArtist = await lookupResponse.json();
    const result: ArtistMusicBrainzData = {};

    // Get birth date
    if (artistDetails['life-span']?.begin) {
      result.birthDate = artistDetails['life-span'].begin;
    }

    // Get Country Code
    if (artistDetails.country) {
      result.countryCode = artistDetails.country;
    } else if (artistDetails.area?.['iso-3166-1-codes'] && artistDetails.area['iso-3166-1-codes'].length > 0) {
      result.countryCode = artistDetails.area['iso-3166-1-codes'][0];
    }

    // Get Origin Country Name
    if (artistDetails.area?.name) {
      result.originCountry = artistDetails.area.name;
    } else if (artistDetails['begin-area']?.name) {
      result.originCountry = artistDetails['begin-area'].name;
    }

    // Get External Links
    if (artistDetails.relations) {
        // Official Homepage
        const homepageRel = artistDetails.relations.find(rel => rel.type === 'official homepage');
        if (homepageRel?.url?.resource) {
            result.homepage = homepageRel.url.resource;
        }

        // Instagram
        // Type is usually "social network" or "instagram" (older data might vary, but usually 'social network' for instagram)
        // We check if url contains 'instagram.com'
        const instagramRel = artistDetails.relations.find(rel => 
            (rel.type === 'social network' || rel.type === 'instagram') && 
            rel.url?.resource?.includes('instagram.com')
        );
        if (instagramRel?.url?.resource) {
            result.instagram = instagramRel.url.resource;
        }
    }

    console.log(`MusicBrainz details found for ${artistName}:`, result);
    return result;

  } catch (error) {
    console.error(`Error fetching MusicBrainz data for ${artistName}:`, error);
    return null;
  }
}
