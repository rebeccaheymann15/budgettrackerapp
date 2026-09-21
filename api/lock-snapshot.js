const { getPool, initDb } = require('./_pgdb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Snapshot ID required' });
  }

  let client;
  try {
    console.log('Starting lock-snapshot for id:', id);
    await initDb();
    console.log('Database initialized');

    client = await getPool().connect();
    console.log('Client connected');

    // Get the snapshot to find its week
    console.log('Querying snapshot with id:', id);
    const snapshot = await client.query('SELECT week FROM weekly_snapshots WHERE id = $1', [parseInt(id)]);
    console.log('Snapshot query result:', snapshot.rows.length);

    if (snapshot.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    const week = snapshot.rows[0].week;
    console.log('Found week:', week);

    // Unmark any previous final version for this week
    console.log('Unmarking previous final for week:', week);
    await client.query('UPDATE weekly_snapshots SET is_final = false WHERE week = $1', [week]);

    // Mark this snapshot as final
    console.log('Marking snapshot as final:', id);
    await client.query('UPDATE weekly_snapshots SET is_final = true WHERE id = $1', [parseInt(id)]);

    console.log('Successfully locked snapshot');
    client.release();
    return res.status(200).json({ success: true, message: 'Snapshot locked as final' });
  } catch (err) {
    console.error('Lock snapshot error:', err);
    if (client) {
      try {
        client.release();
      } catch (releaseErr) {
        console.error('Error releasing client:', releaseErr);
      }
    }
    return res.status(500).json({ error: err.message });
  }
};
