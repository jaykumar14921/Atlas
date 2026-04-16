// NOTE: This is an in-memory cache.
// It resets on every cold start (Vercel serverless functions are stateless).
// For persistent caching, replace with a database like Upstash Redis (free tier available).

const cache = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt = '', imageAnalysis = '' } = req.body || {};
  const key = `${prompt}:${imageAnalysis}`;
  const entry = cache.get(key);

  if (entry) {
    return res.json({
      cached: true,
      timestamp: entry.timestamp,
      code: entry.code,
      files: entry.files,
    });
  }

  return res.json({ cached: false });
}
