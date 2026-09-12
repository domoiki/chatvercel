export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Import library pg (PostgreSQL classic driver - stabil & kompatibel Vercel)
    const { Pool } = await import('pg');
    
    // Konfigurasi koneksi ke Supabase
    const pool = new Pool({
      connectionString: process.env.SUPABASE_CONNECTION_STRING,
      ssl: { rejectUnauthorized: false }
    });
    
    // Query hitung total stats
    const result = await pool.query('SELECT COUNT(*) as total FROM stats');
    const total = parseInt(result.rows[0]?.total) || 0;
    
    // Tutup koneksi
    await pool.end();
    
    return res.status(200).json({ total });
  } catch (error) {
    console.error('Stats handler failed:', error);
    return res.status(503).json({ total: 0 });
  }
}