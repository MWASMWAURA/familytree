const { Pool } = require('pg');
const crypto = require('crypto');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.CONNECTION_STRING,
});

// Token functions
const generateToken = () => crypto.randomBytes(32).toString('hex');
const validateAccessToken = (token) => {
  // Implement token validation logic
  return true;
};

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

// Initialize database
const initDb = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Family trees table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS family_trees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        data JSONB NOT NULL,
        admin_id UUID NOT NULL REFERENCES users(id),
        access_code TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Family admins table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS family_admins (
        id SERIAL PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        added_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(family_id, user_id)
      );
    `);

    // Activity logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        action TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_trees_name ON family_trees(name);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_admins_family_id ON family_admins(family_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_family_id ON activity_logs(family_id);`);
  } catch (err) {
    console.error('Database initialization error:', err);
  }
};

// Initialize DB on module load
initDb();

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const userId = await getUserId(req);

    switch (req.method) {
      case 'GET':
        // Get all family trees for user
        const result = await pool.query(`
          SELECT DISTINCT ft.*
          FROM family_trees ft
          LEFT JOIN family_admins fa ON ft.id = fa.family_id
          WHERE fa.user_id = $1 OR ft.admin_id = $1
          ORDER BY ft.created_at DESC
        `, [userId]);

        return res.status(200).json(result.rows);

      case 'POST':
        const { name, data, accessCode } = req.body;

        if (!name || !data) {
          return res.status(400).json({ error: 'Missing required fields: name, data' });
        }

        // Check if family name exists
        const existingFamily = await pool.query(
          'SELECT * FROM family_trees WHERE LOWER(name) = LOWER($1)',
          [name]
        );

        if (existingFamily.rows.length > 0) {
          return res.status(409).json({ error: 'Family name already exists' });
        }

        // Create access code
        const code = accessCode || crypto.randomBytes(4).toString('hex');

        // Insert new family tree
        const insertResult = await pool.query(
          `INSERT INTO family_trees (name, data, admin_id, access_code) VALUES ($1, $2, $3, $4) RETURNING *`,
          [name, data, userId, code]
        );

        // Add admin entry
        await pool.query(
          `INSERT INTO family_admins (family_id, user_id, added_by) VALUES ($1, $2, $3)`,
          [insertResult.rows[0].id, userId, userId]
        );

        return res.status(201).json({ family: insertResult.rows[0], accessCode: code });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}