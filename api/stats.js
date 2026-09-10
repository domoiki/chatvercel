export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { Client } = await import('postgres');
    const connectionString = process.env.NEON_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('NEON_CONNECTION_STRING environment variable is not set');
    }
    const db = new Client(connectionString);
    await db.connect();
    
    const result = await db.query('SELECT COUNT(*) as total FROM stats');
    const total = parseInt(result.rows[0]?.total) || 0;
    await db.end();
    
    return res.status(200).json({ total });
  } catch (error) {
    console.error('Stats handler failed:', error);
    return res.status(503).json({ total: 0 });
  }
}
