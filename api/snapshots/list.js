const { getPool, initDb } = require('../_pgdb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { week } = req.query;

  if (!week) {
    return res.status(400).json({ error: 'Week parameter required' });
  }

  let client;
  try {
    await initDb();
    client = await getPool().connect();

    const snapshots = await client.query(
      `SELECT id, week, is_final, uploaded_at, created_at FROM weekly_snapshots
       WHERE week = $1
       ORDER BY uploaded_at DESC`,
      [week]
    );

    return res.status(200).json(snapshots.rows);
  } catch (err) {
    console.error('List snapshots error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};
