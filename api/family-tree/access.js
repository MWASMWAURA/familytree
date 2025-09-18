const { Pool } = require('pg');
const crypto = require('crypto');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.CONNECTION_STRING,
});

// Middleware to get or create user ID
const getUserId = async (req) => {
  try {
    let userId = req.headers['x-user-id'] || req.headers['X-User-ID'];

    if (!userId) {
      userId = crypto.randomUUID();
    }

    // Ensure user exists in DB
    await pool.query(
      `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [userId]
    );

    return userId;
  } catch (err) {
    console.error('Error ensuring user exists:', err);
    throw new Error('User initialization failed');
  }
};

export default async function handler(req, res) {
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

  try {
    const userId = await getUserId(req);
    const { familyName, accessCode } = req.body;

    if (!familyName || !accessCode) {
      return res.status(400).json({ error: 'Missing required fields: familyName, accessCode' });
    }

    // Find family by name and access code
    const result = await pool.query(
      'SELECT * FROM family_trees WHERE LOWER(name) = LOWER($1) AND access_code = $2',
      [familyName, accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid family name or access code' });
    }

    const family = result.rows[0];

    // Log the access
    await pool.query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [family.id, userId, 'access', { familyName, accessCode }]
    );

    // Check if user is admin
    const adminCheck = await pool.query(`
      SELECT fa.user_id as admin_user_id
      FROM family_admins fa
      WHERE fa.family_id = $1 AND fa.user_id = $2
    `, [family.id, userId]);

    const isAdmin = adminCheck.rows.length > 0 || family.admin_id === userId;

    return res.status(200).json({
      family,
      isAdmin
    });

  } catch (err) {
    console.error('Access API Error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}