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

    // Temporary tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS temporary_tokens (
        id SERIAL PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        created_by UUID NOT NULL REFERENCES users(id),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_trees_name ON family_trees(name);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_admins_family_id ON family_admins(family_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_family_id ON activity_logs(family_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_temporary_tokens_token ON temporary_tokens(token);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_temporary_tokens_expires_at ON temporary_tokens(expires_at);`);
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

    // Check if user has admin access
    const adminCheck = await getPool().query(`
      SELECT fa.user_id as admin_user_id
      FROM family_admins fa
      WHERE fa.family_id = $1 AND fa.user_id = $2
    `, [id, userId]);

    const hasAdminAccess = adminCheck.rows.length > 0 || (await getPool().query(
      'SELECT admin_id FROM family_trees WHERE id = $1',
      [id]
    )).rows[0]?.admin_id === userId;

    if (!hasAdminAccess) {
      return res.status(403).json({ error: 'Access denied - not an admin' });
    }

    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Insert the token
    await getPool().query(
      `INSERT INTO temporary_tokens (family_id, token, created_by, expires_at) VALUES ($1, $2, $3, $4)`,
      [id, token, userId, expiresAt]
    );

    // Log the token generation
    await getPool().query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, userId, 'generate_token', { token: token.substring(0, 8) + '...', expiresAt }]
    );

    console.log(`Token generated for family ${id} by user ${userId}: ${token.substring(0, 8)}...`);

    return res.status(200).json({
      token,
      expiresAt: expiresAt.toISOString()
    });

  } catch (err) {
    console.error('Generate token API Error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}