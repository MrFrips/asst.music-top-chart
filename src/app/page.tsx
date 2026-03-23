'use client';

import { useState, useCallback } from 'react';

interface ApiEndpoint {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  params?: { key: string; default?: string; placeholder?: string }[];
  body?: { key: string; placeholder?: string }[];
  requiresAuth?: boolean;
  exampleResponse: object | string;
}

const ENDPOINTS: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/stats/artists',
    description: 'Get top artists by rank or daily change',
    params: [
      { key: 'sortBy', default: 'rank', placeholder: 'rank | dailyChange' },
      { key: 'country', default: 'global', placeholder: 'global, id, us, gb...' },
      { key: 'limit', default: '25', placeholder: '25' },
    ],
    exampleResponse: {
      artists: [
        {
          artistId: '1Xyo4u8uXC1ZmMpatF05PJ',
          name: 'The Weeknd',
          rank: 1,
          previousRank: 1,
          rankDelta: 0,
          monthlyListeners: 115000000,
          listenersDelta: 250000,
          imageUrl: 'https://i.scdn.co/image/...',
          genres: ['canadian pop', 'pop'],
          spotifyUrl: 'https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ',
          lastUpdated: '2026-03-23T00:00:00.000Z',
          followers: 45000000,
          popularity: 96,
          isNew: false,
        },
        { '...': 'more artists' },
      ],
    },
  },
  {
    method: 'GET',
    path: '/api/stats/tracks',
    description: 'Get top tracks by daily streams',
    params: [
      { key: 'country', default: 'global', placeholder: 'global, id, us, gb...' },
      { key: 'limit', default: '25', placeholder: '25' },
    ],
    exampleResponse: {
      tracks: [
        {
          trackId: '7MXVkk9YMctZqd1Srtv4MB',
          name: 'Starboy',
          mainArtistName: 'The Weeknd',
          rank: 1,
          previousRank: 2,
          rankDelta: -1,
          dailyStreams: 8500000,
          totalStreams: 3200000000,
          imageUrl: 'https://i.scdn.co/image/...',
          spotifyUrl: 'https://open.spotify.com/track/7MXVkk9YMctZqd1Srtv4MB',
          lastUpdated: '2026-03-23T00:00:00.000Z',
        },
        { '...': 'more tracks' },
      ],
    },
  },
  {
    method: 'GET',
    path: '/api/stats/countries',
    description: 'Get list of supported countries',
    exampleResponse: {
      countries: [
        { code: 'global', name: 'Global', flag: '🌍' },
        { code: 'us', name: 'United States', flag: '🇺🇸' },
        { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
        { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
        { '...': 'more countries' },
      ],
    },
  },
  {
    method: 'GET',
    path: '/api/stats/last-updated',
    description: 'Get last data refresh timestamp',
    exampleResponse: {
      lastUpdated: '2026-03-23T06:00:00.000Z',
    },
  },
  {
    method: 'GET',
    path: '/api/stats/artist/{artistId}',
    description: 'Get detailed artist info by Spotify ID',
    params: [
      { key: 'artistId', placeholder: 'e.g. 1Xyo4u8uXC1ZmMpatF05PJ' },
    ],
    exampleResponse: {
      artist: {
        artistId: '1Xyo4u8uXC1ZmMpatF05PJ',
        name: 'The Weeknd',
        rank: 1,
        monthlyListeners: 115000000,
        followers: 45000000,
        popularity: 96,
        biography: 'Abel Makkonen Tesfaye, known professionally as the Weeknd...',
        originCountry: 'Canada',
        countryCode: 'CA',
        genres: ['canadian pop', 'pop'],
        images: '[{"url":"https://...","height":640,"width":640}]',
        topTracks: '[{"name":"Blinding Lights","playcount":"3800000000",...}]',
        topAlbums: '[{"name":"After Hours","playcount":"12000000",...}]',
        similarArtists: '[{"name":"Drake",...}]',
        socialLinks: '{"homepage":"https://...","instagram":"https://..."}',
      },
    },
  },
  {
    method: 'GET',
    path: '/api/stats/artist/{artistId}/history',
    description: 'Get artist historical data',
    params: [
      { key: 'artistId', placeholder: 'e.g. 1Xyo4u8uXC1ZmMpatF05PJ' },
      { key: 'country', default: 'global', placeholder: 'global, id, us...' },
      { key: 'days', default: '30', placeholder: '30' },
    ],
    exampleResponse: {
      artistName: 'The Weeknd',
      country: 'global',
      dataPoints: 30,
      history: [
        { date: '2026-03-23', monthlyListeners: 115000000, rank: 1, listenersDelta: 250000 },
        { date: '2026-03-22', monthlyListeners: 114750000, rank: 1, listenersDelta: 180000 },
        { '...': 'more data points' },
      ],
    },
  },
  {
    method: 'GET',
    path: '/api/stats/tracks/history',
    description: 'Get track historical data',
    params: [
      { key: 'track', placeholder: 'e.g. Starboy' },
      { key: 'artist', placeholder: 'e.g. The Weeknd' },
      { key: 'country', default: 'global', placeholder: 'global, id, us...' },
      { key: 'days', default: '30', placeholder: '30' },
    ],
    exampleResponse: {
      trackName: 'Starboy',
      artistName: 'The Weeknd',
      country: 'global',
      dataPoints: 30,
      history: [
        { date: '2026-03-23', dailyStreams: 8500000, totalStreams: 3200000000, rank: 1 },
        { date: '2026-03-22', dailyStreams: 8200000, totalStreams: 3191500000, rank: 2 },
        { '...': 'more data points' },
      ],
    },
  },
  {
    method: 'GET',
    path: '/api/cron/refresh',
    description: 'Trigger data refresh (requires secret)',
    params: [
      { key: 'secret', placeholder: 'Your ADMIN_SECRET' },
    ],
    requiresAuth: true,
    exampleResponse: {
      message: 'Refresh started',
      timestamp: '2026-03-23T06:00:00.000Z',
    },
  },
  {
    method: 'POST',
    path: '/api/cron/refresh',
    description: 'Trigger data refresh via POST',
    body: [
      { key: 'secret', placeholder: 'Your ADMIN_SECRET' },
    ],
    requiresAuth: true,
    exampleResponse: {
      message: 'Refresh completed',
      timestamp: '2026-03-23T06:00:00.000Z',
    },
  },
];

type Tab = 'params' | 'example';

export default function Home() {
  const [selected, setSelected] = useState<ApiEndpoint>(ENDPOINTS[0]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyValues, setBodyValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string>('');
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('example');

  const selectEndpoint = useCallback((ep: ApiEndpoint) => {
    setSelected(ep);
    setParamValues({});
    setBodyValues({});
    setResponse('');
    setStatus(null);
    setDuration(null);
    setActiveTab('example');
  }, []);

  const sendRequest = useCallback(async () => {
    setLoading(true);
    setResponse('');
    setStatus(null);
    setDuration(null);
    setActiveTab('params');

    // Auth-protected endpoints: show example response only (no real API call)
    if (selected.requiresAuth) {
      await new Promise((r) => setTimeout(r, 300)); // simulate delay
      setStatus(200);
      setDuration(0);
      setResponse(
        '// ⚠️ This endpoint requires authentication.\n// Showing example response only (no real request was made).\n\n' +
        JSON.stringify(selected.exampleResponse, null, 2)
      );
      setLoading(false);
      return;
    }

    try {
      let url = selected.path;
      const queryParams: Record<string, string> = {};

      if (selected.params) {
        for (const p of selected.params) {
          const val = paramValues[p.key] || p.default || '';
          if (url.includes(`{${p.key}}`)) {
            url = url.replace(`{${p.key}}`, encodeURIComponent(val));
          } else if (val) {
            queryParams[p.key] = val;
          }
        }
      }

      const qs = new URLSearchParams(queryParams).toString();
      if (qs) url += '?' + qs;

      const options: RequestInit = { method: selected.method };

      if (selected.method === 'POST' && selected.body) {
        const bodyObj: Record<string, string> = {};
        for (const b of selected.body) {
          const val = bodyValues[b.key] || '';
          if (val) bodyObj[b.key] = val;
        }
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(bodyObj);
      }

      const start = performance.now();
      const res = await fetch(url, options);
      const elapsed = performance.now() - start;

      setStatus(res.status);
      setDuration(Math.round(elapsed));

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponse(JSON.stringify(json, null, 2));
      } catch {
        setResponse(text);
      }
    } catch (err: any) {
      setResponse(`Error: ${err.message}`);
      setStatus(0);
    } finally {
      setLoading(false);
    }
  }, [selected, paramValues, bodyValues]);

  const hasParams = (selected.params && selected.params.length > 0) || (selected.body && selected.body.length > 0);

  return (
      <div className="app">
        <div className="sidebar">
          <div className="sidebar-header">
            <h1>Meww.me <span>API</span> Explorer</h1>
            <p>Spotify Stats API • Scraper from Kworb</p>
          </div>
          <div className="ep-list">
            {ENDPOINTS.map((ep, i) => (
              <div
                key={i}
                className={`ep-item ${selected === ep ? 'active' : ''}`}
                onClick={() => selectEndpoint(ep)}
              >
                <div className="ep-top">
                  <span className={`method-badge method-${ep.method}`}>{ep.method}</span>
                  <span className="ep-path">{ep.path}</span>
                </div>
                <div className="ep-desc">
                  {ep.description}
                  {ep.requiresAuth && <span className="auth-badge">AUTH</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="main">
          <div className="request-bar">
            <span className={`method-label method-${selected.method}`}>{selected.method}</span>
            <div className="url-display">{selected.path}</div>
            <button className="send-btn" onClick={sendRequest} disabled={loading}>
              {loading ? <span className="loading-spinner" /> : 'Send'}
            </button>
          </div>

          {/* Tabs */}
          <div className="tabs-bar">
            {hasParams && (
              <button
                className={`tab-btn ${activeTab === 'params' ? 'active' : ''}`}
                onClick={() => setActiveTab('params')}
              >
                Parameters
              </button>
            )}
            <button
              className={`tab-btn ${activeTab === 'example' ? 'active' : ''}`}
              onClick={() => setActiveTab('example')}
            >
              Example Response
            </button>
          </div>

          {/* Params tab */}
          {activeTab === 'params' && hasParams && (
            <div className="params-section">
              {selected.params && selected.params.length > 0 && (
                <>
                  <h3>Query / Path Parameters</h3>
                  {selected.params.map((p) => (
                    <div key={p.key} className="param-row">
                      <span className="param-key">{p.key}</span>
                      <input
                        className="param-input"
                        placeholder={p.placeholder || p.key}
                        value={paramValues[p.key] ?? p.default ?? ''}
                        onChange={(e) =>
                          setParamValues((prev) => ({ ...prev, [p.key]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </>
              )}
              {selected.body && selected.body.length > 0 && (
                <>
                  <h3 style={{ marginTop: 16 }}>Request Body (JSON)</h3>
                  {selected.body.map((b) => (
                    <div key={b.key} className="param-row">
                      <span className="param-key">{b.key}</span>
                      <input
                        className="param-input"
                        placeholder={b.placeholder || b.key}
                        value={bodyValues[b.key] ?? ''}
                        onChange={(e) =>
                          setBodyValues((prev) => ({ ...prev, [b.key]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Example tab */}
          {activeTab === 'example' && (
            <div className="example-section">
              <h3>
                Example Response <span className="example-label">sample data</span>
              </h3>
              <pre>{JSON.stringify(selected.exampleResponse, null, 2)}</pre>
            </div>
          )}

          {/* Response */}
          <div className="response-section">
            <div className="response-header">
              <h3>Response</h3>
              {status !== null && (
                <>
                  <span
                    className={`status-badge ${
                      status >= 200 && status < 300 ? 'status-2xx'
                        : status >= 400 && status < 500 ? 'status-4xx'
                        : status >= 500 ? 'status-5xx'
                        : 'status-0'
                    }`}
                  >
                    {status === 0 ? 'ERROR' : status}
                  </span>
                  {duration !== null && <span className="duration">{duration}ms</span>}
                </>
              )}
            </div>
            {response ? (
              <div className="response-body">
                <pre>{response}</pre>
              </div>
            ) : (
              <div className="response-empty">
                <span>📡</span>
                Click <b>Send</b> to make a request
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
