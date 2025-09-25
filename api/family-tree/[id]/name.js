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

// Initialize database
const initDb = async () => {
  try {
    const pool = getPool();
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        password_hash TEXT,
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
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Family ID is required' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initDb();
    const userId = await getUserId(req);

    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if current user is admin of this family
    const adminCheck = await getPool().query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can change family name' });
    }

    // Check if new name already exists
    const existingFamily = await getPool().query(
      'SELECT * FROM family_trees WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), id]
    );

    if (existingFamily.rows.length > 0) {
      return res.status(409).json({ error: 'Family name already exists' });
    }

    // Get current name for logging
    const currentFamily = await getPool().query('SELECT name FROM family_trees WHERE id = $1', [id]);
    const oldName = currentFamily.rows[0].name;

    // Update the family name
    const result = await getPool().query(
      'UPDATE family_trees SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );

    // Log the name change
    await getPool().query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, userId, 'change_name', JSON.stringify({ oldName, newName: name.trim() })]
    );

    res.json({ family: result.rows[0] });
  } catch (err) {
    console.error('Error updating family name:', err);
    res.status(500).json({ error: 'Database error occurred while updating family name' });
  }
};