const { getPool, initDb } = require('./_pgdb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    await initDb();
    client = await getPool().connect();

    const snapshots = await client.query(
      'SELECT * FROM weekly_snapshots ORDER BY week DESC'
    );

    const withMetrics = [];

    for (const snapshot of snapshots.rows) {
      const metric = await client.query(
        'SELECT * FROM metrics WHERE snapshot_id = $1',
        [snapshot.id]
      );

      withMetrics.push({
        ...snapshot,
        metric: metric.rows[0] || null,
      });
    }

    return res.status(200).json(withMetrics);
  } catch (err) {
    console.error('Snapshots error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};
