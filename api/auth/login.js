const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error('Database initialization error:', err);
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
    const { email, password, guestUserId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = getPool();
    const userResult = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // If there's a guest user ID, transfer ownership of their data
    if (guestUserId) {
      try {
        // Transfer family trees ownership
        await pool.query(
          'UPDATE family_trees SET admin_id = $1 WHERE admin_id = $2',
          [user.id, guestUserId]
        );

        // Transfer family admin entries
        await pool.query(
          'UPDATE family_admins SET user_id = $1 WHERE user_id = $2',
          [user.id, guestUserId]
        );

        // Transfer activity logs
        await pool.query(
          'UPDATE activity_logs SET user_id = $1 WHERE user_id = $2',
          [user.id, guestUserId]
        );

        // Delete the guest user record
        await pool.query('DELETE FROM users WHERE id = $1', [guestUserId]);
      } catch (transferError) {
        console.warn('Could not transfer guest data:', transferError);
        // Continue with login even if transfer fails
      }
    }

    return res.status(200).json({
      user: { id: user.id, email: user.email },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};