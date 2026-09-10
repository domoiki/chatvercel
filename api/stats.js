export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Import library postgres v3 - menggunakan default export
    const postgres = await import('postgres');
    // Gunakan sebagai fungsi langsung: postgres(queryString)
    // atau const { sql } = postgres; jika butuh template tag
    const result = await postgres('SELECT COUNT(*) as total FROM stats');
    
    const total = parseInt(result.rows[0]?.total) || 0;
    
    return res.status(200).json({ total });
  } catch (error) {
    console.error('Stats handler failed:', error);
    return res.status(503).json({ total: 0 });
  }
}