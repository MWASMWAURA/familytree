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

    // Premium subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS premium_subscriptions (
        id SERIAL PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        payment_method TEXT NOT NULL,
        payment_reference TEXT,
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'KES',
        is_premium BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
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
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_family_id ON premium_subscriptions(family_id);`);
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initDb();
    const userId = await getUserId(req);

    const { familyId, paymentMethod } = req.body;

    if (!familyId) {
      return res.status(400).json({ error: 'Family ID is required' });
    }

    // Check if user has admin access to this family
    const adminCheck = await getPool().query(`
      SELECT fa.user_id as admin_user_id
      FROM family_admins fa
      WHERE fa.family_id = $1 AND fa.user_id = $2
    `, [familyId, userId]);

    const familyResult = await getPool().query(
      'SELECT admin_id FROM family_trees WHERE id = $1',
      [familyId]
    );

    if (familyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const hasAdminAccess = adminCheck.rows.length > 0 || familyResult.rows[0].admin_id === userId;

    if (!hasAdminAccess) {
      return res.status(403).json({ error: 'Access denied - not an admin' });
    }

    // Generate payment reference
    const paymentReference = `FT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // For demo purposes, we'll simulate successful payment
    // In production, this would integrate with actual payment processor
    const amount = 20.00; // KSH 20
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Insert or update premium subscription
    await getPool().query(`
      INSERT INTO premium_subscriptions (family_id, user_id, payment_method, payment_reference, amount, is_premium, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (family_id, user_id)
      DO UPDATE SET
        payment_method = EXCLUDED.payment_method,
        payment_reference = EXCLUDED.payment_reference,
        amount = EXCLUDED.amount,
        is_premium = EXCLUDED.is_premium,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `, [familyId, userId, paymentMethod || 'mpesa', paymentReference, amount, true, expiresAt]);

    // Log the premium activation
    await getPool().query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [familyId, userId, 'activate_premium', { paymentReference, amount, expiresAt }]
    );

    console.log(`Premium activated for family ${familyId} by user ${userId}: ${paymentReference}`);

    return res.status(200).json({
      success: true,
      paymentReference,
      amount,
      expiresAt: expiresAt.toISOString()
    });

  } catch (err) {
    console.error('Premium activation API Error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}