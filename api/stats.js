export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Import library postgres (v3+)
    const postgres = await import('postgres');
    const connectionString = process.env.NEON_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('NEON_CONNECTION_STRING environment variable is not set');
    }
    
    // Gunakan koneksi langsung dengan string query
    const result = await postgres('SELECT COUNT(*) as total FROM stats');
    
    const total = parseInt(result.rows[0]?.total) || 0;
    
    return res.status(200).json({ total });
  } catch (error) {
    console.error('Stats handler failed:', error);
    return res.status(503).json({ total: 0 });
  }
}