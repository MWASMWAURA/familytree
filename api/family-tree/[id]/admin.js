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
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Family ID is required' });
  }

  try {
    await initDb();
    const userId = await getUserId(req);

    switch (req.method) {
      case 'GET':
        // Check if current user is admin of this family
        const adminCheck = await getPool().query(`
          SELECT * FROM family_admins
          WHERE family_id = $1 AND user_id = $2
        `, [id, userId]);

        if (adminCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Get all admins for this family
        const result = await getPool().query(`
          SELECT fa.*, u.created_at as user_created_at
          FROM family_admins fa
          JOIN users u ON fa.user_id = u.id
          WHERE fa.family_id = $1
          ORDER BY fa.created_at ASC
        `, [id]);

        return res.status(200).json(result.rows);

      case 'POST':
        const { newAdminId } = req.body;

        if (!newAdminId) {
          return res.status(400).json({ error: 'Missing required field: newAdminId' });
        }

        // Check if current user is admin of this family
        const adminCheckPost = await getPool().query(`
          SELECT * FROM family_admins
          WHERE family_id = $1 AND user_id = $2
        `, [id, userId]);

        if (adminCheckPost.rows.length === 0) {
          return res.status(403).json({ error: 'Only admins can add other admins' });
        }

        // Add new admin
        await getPool().query(
          `INSERT INTO family_admins (family_id, user_id, added_by) VALUES ($1, $2, $3)`,
          [id, newAdminId, userId]
        );

        // Log the admin addition
        await getPool().query(
          `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
          [id, userId, 'add_admin', { newAdminId }]
        );

        return res.status(200).json({ message: 'Admin added successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'User is already an admin of this family' });
    }

    console.error('Admin API Error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}