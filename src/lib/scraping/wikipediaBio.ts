/**
 * Wikipedia API integration for fetching artist biographies
 * Uses the Wikipedia REST API (no API key required)
 */

interface WikipediaSummary {
  title: string;
  extract: string;
  extract_html?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  originalimage?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop: {
      page: string;
    };
  };
}

export async function fetchArtistBiography(artistName: string): Promise<{
  biography: string | null;
  imageUrl?: string;
  wikipediaUrl?: string;
  additionalImages?: string[];
} | null> {
  try {
    // Clean artist name for Wikipedia search
    const cleanName = artistName
      .trim()
      .replace(/\s+/g, '_'); // Wikipedia uses underscores in URLs
    
    // Try English Wikipedia first
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ChartMewwme/1.0 (Spotify Stats Dashboard)',
      },
    });
    
    if (!response.ok) {
      // Try without formatting if not found
      if (response.status === 404) {
        return await tryAlternativeSearch(artistName);
      }
      console.error(`Wikipedia API error for "${artistName}": ${response.status}`);
      return null;
    }
    
    const data: WikipediaSummary = await response.json();
    
    // Extract relevant information
    const biography = data.extract || null;
    const imageUrl = data.originalimage?.source || data.thumbnail?.source;
    const wikipediaUrl = data.content_urls?.desktop?.page;
    
    // Fetch additional images from the page
    const additionalImages = await fetchWikipediaImages(cleanName);
    
    // Only return if we have a biography
    if (!biography) {
      return null;
    }
    
    return {
      biography,
      imageUrl,
      wikipediaUrl,
      additionalImages,
    };
  } catch (error) {
    console.error(`Error fetching Wikipedia bio for "${artistName}":`, error);
    return null;
  }
}

/**
 * Fetch additional images from Wikipedia page
 */
async function fetchWikipediaImages(pageTitle: string): Promise<string[]> {
  try {
    // Use MediaWiki API to get images from the page
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=images&imlimit=10&format=json&origin=*`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'ChartMewwme/1.0 (Spotify Stats Dashboard)',
      },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) {
      return [];
    }
    
    const page = Object.values(pages)[0] as any;
    const imageNames = page.images?.map((img: any) => img.title) || [];
    
    // Filter for actual photos (exclude icons, flags, logos)
    const photoNames = imageNames.filter((name: string) =>
      (name.includes('.jpg') || name.includes('.jpeg') || name.includes('.png')) &&
      !name.includes('Flag') &&
      !name.includes('Icon') &&
      !name.includes('Logo') &&
      !name.includes('Commons') &&
      !name.includes('Wikidata')
    ).slice(0, 5); // Limit to 5 additional images
    
    // Fetch actual image URLs
    const imageUrls: string[] = [];
    for (const imageName of photoNames) {
      const imageUrl = await fetchImageUrl(imageName);
      if (imageUrl) {
        imageUrls.push(imageUrl);
      }
    }
    
    return imageUrls;
  } catch (error) {
    console.error('Error fetching Wikipedia images:', error);
    return [];
  }
}

/**
 * Get the actual URL for a Wikipedia image
 */
async function fetchImageUrl(imageTitle: string): Promise<string | null> {
  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(imageTitle)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'ChartMewwme/1.0 (Spotify Stats Dashboard)',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) {
      return null;
    }
    
    const page = Object.values(pages)[0] as any;
    const imageUrl = page.imageinfo?.[0]?.url;
    
    return imageUrl || null;
  } catch (error) {
    return null;
  }
}

/**
 * Try alternative search if direct lookup fails
 * Uses Wikipedia search API to find the correct page
 */
async function tryAlternativeSearch(artistName: string): Promise<{
  biography: string | null;
  imageUrl?: string;
  wikipediaUrl?: string;
  additionalImages?: string[];
} | null> {
  try {
    // Use Wikipedia search API
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(artistName)}&format=json&origin=*`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'ChartMewwme/1.0 (Spotify Stats Dashboard)',
      },
    });
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    const results = searchData.query?.search;
    
    if (!results || results.length === 0) {
      return null;
    }
    
    // Get the first result (most relevant)
    const firstResult = results[0];
    const pageTitle = firstResult.title;
    
    // Now fetch summary for this page
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    
    const summaryResponse = await fetch(summaryUrl, {
      headers: {
        'User-Agent': 'ChartMewwme/1.0 (Spotify Stats Dashboard)',
      },
    });
    
    if (!summaryResponse.ok) {
      return null;
    }
    
    const data: WikipediaSummary = await summaryResponse.json();
    
    const biography = data.extract || null;
    const imageUrl = data.originalimage?.source || data.thumbnail?.source;
    const wikipediaUrl = data.content_urls?.desktop?.page;
    
    // Fetch additional images
    const additionalImages = await fetchWikipediaImages(pageTitle);
    
    if (!biography) {
      return null;
    }
    
    return {
      biography,
      imageUrl,
      wikipediaUrl,
      additionalImages,
    };
  } catch (error) {
    console.error(`Error in Wikipedia alternative search for "${artistName}":`, error);
    return null;
  }
}