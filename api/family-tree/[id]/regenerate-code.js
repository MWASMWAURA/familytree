const { Pool } = require('pg');
const crypto = require('crypto');

let pool;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.CONNECTION_STRING,
    });
  }
  return pool;
};

// Middleware to get or create user ID
const getUserId = async (req) => {
  try {
    let userId = req.headers['x-user-id'] || req.headers['X-User-ID'];

    if (!userId) {
      userId = crypto.randomUUID();
    }

    // Ensure user exists in DB
    await getPool().query(
      `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [userId]
    );

    return userId;
  } catch (err) {
    console.error('Error ensuring user exists:', err);
    throw new Error('User initialization failed');
  }
};

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Family ID is required' });
  }

  try {
    await initDb();
    const userId = await getUserId(req);

    // Check if current user is admin of this family
    const adminCheck = await getPool().query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can regenerate access codes' });
    }

    // Generate new access code
    const newCode = crypto.randomBytes(4).toString('hex');

    // Get current code for logging
    const currentFamily = await getPool().query(
      'SELECT access_code FROM family_trees WHERE id = $1',
      [id]
    );

    if (currentFamily.rows.length === 0) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const oldCode = currentFamily.rows[0].access_code;

    // Update the family tree with new access code
    const result = await getPool().query(
      'UPDATE family_trees SET access_code = $1 WHERE id = $2 RETURNING *',
      [newCode, id]
    );

    // Log the code regeneration
    await getPool().query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, userId, 'regenerate_code', { oldCode, newCode }]
    );

    return res.status(200).json({ accessCode: newCode });

  } catch (err) {
    console.error('Regenerate Code API Error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}