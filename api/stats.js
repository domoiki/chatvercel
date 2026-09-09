export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { kv } = await import('@vercel/kv');
    const total = (await kv.get('total_usage')) || 0;
    return res.status(200).json({ total });
  } catch (error) {
    console.error('Stats handler failed:', error);
    return res.status(503).json({ total: 0 });
  }
}
