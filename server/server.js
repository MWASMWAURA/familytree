const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

const corsOptions = {
  origin: ['http://localhost:5173','http://localhost:5178','http://localhost:5174','http://localhost:5176','http://localhost:3000', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID', 'x-user-id'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

const crypto = require('crypto');
const { generateToken, validateAccessToken } = require('./token-feature');

// Use environment variable or paste your Neon connection string here
const CONNECTION_STRING = "postgresql://neondb_owner:npg_bv1YBzlLVnp6@ep-rapid-brook-adbgxz6b-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

process.env.CONNECTION_STRING = CONNECTION_STRING;

const pool = new Pool({
  connectionString: CONNECTION_STRING,
});

const PORT = process.env.PORT || 3001;
// Middleware to get or create user ID from request and ensure it exists in DB
const getUserId = async (req, res, next) => {
  try {
    let userId = req.headers['x-user-id'] || req.headers['X-User-ID'];

    if (!userId) {
      // Generate a new user ID if not provided

      userId = crypto.randomUUID();
      res.setHeader('X-User-ID', userId);
    }
    // Ensure user exists in DB
    await pool.query(
      `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [userId]
    );

    req.userId = userId;
    next();
  } catch (err) {
    console.error('Error ensuring user exists:', err);
    res.status(500).json({ error: 'User initialization failed' });
  }
};

// Create the database tables if they don't exist
const initDb = async () => {
  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Family trees table with admin support
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

  // Family admins table (for multiple admins per family)
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

  // Create indexes for better performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_trees_name ON family_trees(name);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_admins_family_id ON family_admins(family_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_family_id ON activity_logs(family_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);`);
};

initDb().then(() => {
  console.log('Database initialized.');
});

app.post('/api/family-tree', getUserId, async (req, res) => {
  const { name, data, accessCode } = req.body;
  const userId = req.userId;

  if (!name || !data) {
    return res.status(400).json({ error: 'Missing required fields: name, data' });
  }

  try {
    // Check if family name already exists
    const existingFamily = await pool.query(
      'SELECT * FROM family_trees WHERE LOWER(name) = LOWER($1)',
      [name]
    );

    if (existingFamily.rows.length > 0) {
      return res.status(409).json({ error: 'Family name already exists' });
    }

    // Create a unique access code if not provided
    const code = accessCode || crypto.randomBytes(4).toString('hex');

    // Insert new family tree with admin and access code
    const result = await pool.query(
      `INSERT INTO family_trees (name, data, admin_id, access_code) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, data, userId, code]
    );

    // Add admin entry
    await pool.query(
      `INSERT INTO family_admins (family_id, user_id, added_by) VALUES ($1, $2, $3)`,
      [result.rows[0].id, userId, userId]
    );

    res.status(201).json({ family: result.rows[0], accessCode: code });
  } catch (err) {
    console.error('Failed to save family tree:', err);
    res.status(500).json({ error: 'Failed to save family tree', details: err.stack || err.message });
  }
});

// Endpoint to get all family trees (for admins only)
app.get('/api/family-tree', getUserId, async (req, res) => {
  const userId = req.userId;

  try {
    // Get families where user is an admin (either in family_admins or as creator)
    const result = await pool.query(`
      SELECT DISTINCT ft.*
      FROM family_trees ft
      LEFT JOIN family_admins fa ON ft.id = fa.family_id
      WHERE fa.user_id = $1 OR ft.admin_id = $1
      ORDER BY ft.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch family trees' });
  }
});

// Endpoint to access family tree with access code
app.post('/api/family-tree/access', getUserId, async (req, res) => {
  const { familyName, accessCode } = req.body;
  const userId = req.userId;

  if (!familyName || !accessCode) {
    return res.status(400).json({ error: 'Missing required fields: familyName, accessCode' });
  }

  try {
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

    res.json({ family, isAdmin: family.admin_id === userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to access family tree' });
  }
});

// Endpoint to update family tree (with activity logging)
app.put('/api/family-tree/:id', getUserId, async (req, res) => {
  const { id } = req.params;
  const { data } = req.body;
  const userId = req.userId;

  if (!data) {
    return res.status(400).json({ error: 'Missing required field: data' });
  }

  try {
    // Check if user has access to this family (is admin or creator)
    const accessCheck = await pool.query(`
      SELECT ft.*, fa.user_id as admin_user_id
      FROM family_trees ft
      LEFT JOIN family_admins fa ON ft.id = fa.family_id AND fa.user_id = $1
      WHERE ft.id = $2
    `, [userId, id]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Family not found' });
    }

    const family = accessCheck.rows[0];
    const isAdmin = family.admin_user_id !== null || family.admin_id === userId;

    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied - not an admin' });
    }

    // Get current data before update for logging
    const currentDataResult = await pool.query(
      'SELECT data FROM family_trees WHERE id = $1',
      [id]
    );
    const oldData = currentDataResult.rows[0].data;

    // Update the family tree
    const result = await pool.query(
      'UPDATE family_trees SET data = $1 WHERE id = $2 RETURNING *',
      [data, id]
    );

    // Log the update activity with old and new data
    await pool.query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, userId, 'update', { oldData, newData: data }]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating family tree:', err);
    res.status(500).json({ error: 'Failed to update family tree', details: err.message });
  }
});

// Endpoint to add admin to family
app.post('/api/family-tree/:id/admin', getUserId, async (req, res) => {
  const { id } = req.params;
  const { newAdminId } = req.body;
  const userId = req.userId;

  if (!newAdminId) {
    return res.status(400).json({ error: 'Missing required field: newAdminId' });
  }

  try {
    // Check if current user is admin of this family
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can add other admins' });
    }

    // Add new admin
    await pool.query(
      `INSERT INTO family_admins (family_id, user_id, added_by) VALUES ($1, $2, $3)`,
      [id, newAdminId, userId]
    );

    // Log the admin addition
    await pool.query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, userId, 'add_admin', { newAdminId }]
    );

    res.json({ message: 'Admin added successfully' });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      res.status(409).json({ error: 'User is already an admin of this family' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Failed to add admin' });
    }
  }
});

// Endpoint to get family admins
app.get('/api/family-tree/:id/admins', getUserId, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    // Check if current user is admin of this family
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all admins for this family
    const result = await pool.query(`
      SELECT fa.*, u.created_at as user_created_at
      FROM family_admins fa
      JOIN users u ON fa.user_id = u.id
      WHERE fa.family_id = $1
      ORDER BY fa.created_at ASC
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Endpoint to get activity logs for a family
app.get('/api/family-tree/:id/logs', getUserId, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Check if current user is admin of this family
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get activity logs for this family
    const result = await pool.query(`
      SELECT al.*, u.created_at as user_created_at
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.family_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Endpoint to generate new access code for family
app.post('/api/family-tree/:id/regenerate-code', getUserId, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    // Check if current user is admin of this family
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can regenerate access codes' });
    }

    // Generate new access code
    const newCode = crypto.randomBytes(4).toString('hex');

    // Update the family tree with new access code
    const result = await pool.query(
      'UPDATE family_trees SET access_code = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newCode, id]
    );

    // Log the code regeneration
    await pool.query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, userId, 'regenerate_code', { oldCode: result.rows[0].access_code, newCode }]
    );

    res.json({ accessCode: newCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to regenerate access code' });
  }
});
// Endpoint to undo an action based on log entry
app.post('/api/family-tree/:id/undo/:logId', getUserId, async (req, res) => {
  const { id, logId } = req.params;
  const userId = req.userId;

  try {
    // Check if current user is admin of this family
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can regenerate access codes: Access denied to view logs' });
    }

    // Get the log entry
    const logResult = await pool.query(`
      SELECT * FROM activity_logs WHERE id = $1 AND family_id = $2
    `, [logId, id]);
      if (logResult.rows.length === 0) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    // For now, just return success - implement specific undo logic based on action type
    res.json({ message: 'Undo functionality not yet implemented' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to undo action' });
  }
});



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
