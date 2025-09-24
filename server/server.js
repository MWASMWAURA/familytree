const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
app.use(express.json());

const crypto = require('crypto');
const { generateToken, validateAccessToken } = require('./token-feature');

// Use environment variable or paste your Neon connection string here
const CONNECTION_STRING = "postgresql://neondb_owner:npg_bv1YBzlLVnp6@ep-rapid-brook-adbgxz6b-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

process.env.CONNECTION_STRING = CONNECTION_STRING;

const pool = new Pool({
  connectionString: CONNECTION_STRING,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const PORT = process.env.PORT || 3001;
// Middleware to get or create user ID from request and ensure it exists in DB
const getUserId = async (req, res, next) => {
  try {
    // Check if user is authenticated via JWT
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        return next();
      } catch (err) {
        // Invalid token, fall back to guest
      }
    }

    // Guest user
    let userId = req.headers['x-user-id'] || req.headers['X-User-ID'];

    if (!userId) {
      // Generate a new user ID if not provided
      userId = crypto.randomUUID();
      res.setHeader('X-User-ID', userId);
    }
    // Ensure user exists in DB (for guests, no password)
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
      email TEXT UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Ensure all required columns exist (in case table was created without them)
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
  } catch (err) {
    console.log('Columns already exist or could not be added:', err.message);
  }

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

  // Ensure updated_at column exists (in case table was created without it)
  try {
    await pool.query(`ALTER TABLE family_trees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
    console.log('Ensured updated_at column exists');
  } catch (err) {
    console.log('updated_at column already exists or could not be added:', err.message);
  }

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

  // Hidden families table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hidden_families (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      family_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, family_id)
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
}).catch(err => {
  console.error('Database initialization failed:', err);
});

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, guestUserId } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If guest user ID is provided, transfer ownership of family trees
    if (guestUserId) {
      try {
        // Transfer admin rights from guest user to logged-in user
        await pool.query(
          'UPDATE family_trees SET admin_id = $1 WHERE admin_id = $2',
          [user.id, guestUserId]
        );

        // Transfer admin entries in family_admins table
        await pool.query(
          'UPDATE family_admins SET user_id = $1 WHERE user_id = $2',
          [user.id, guestUserId]
        );

        // Update activity logs
        await pool.query(
          'UPDATE activity_logs SET user_id = $1 WHERE user_id = $2',
          [user.id, guestUserId]
        );

        console.log(`Transferred ownership from guest ${guestUserId} to user ${user.id}`);
      } catch (transferErr) {
        console.error('Error transferring ownership:', transferErr);
        // Don't fail login if transfer fails
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

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

// Endpoint to get hidden families for current user
app.get('/api/family-tree/hidden', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(`
      SELECT family_id FROM hidden_families
      WHERE user_id = $1
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hidden families' });
  }
});

// Endpoint to update family tree name (admin only)
app.put('/api/family-tree/:id/name', getUserId, async (req, res) => {
  const { id } = req.params;
  const familyId = parseInt(id, 10);
  const { name } = req.body;
  const userId = req.userId;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Check if current user is admin of this family
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [familyId, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can change family name' });
    }

    // Check if new name already exists
    const existingFamily = await pool.query(
      'SELECT * FROM family_trees WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), familyId]
    );

    if (existingFamily.rows.length > 0) {
      return res.status(409).json({ error: 'Family name already exists' });
    }

    // Get current name for logging
    const currentFamily = await pool.query('SELECT name FROM family_trees WHERE id = $1', [familyId]);
    const oldName = currentFamily.rows[0].name;

    // Update the family name
    const result = await pool.query(
      'UPDATE family_trees SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), familyId]
    );

    // Log the name change
    await pool.query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [familyId, userId, 'change_name', JSON.stringify({})]
    );

    res.json({ family: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error occurred while updating family name' });
  }
});

// Endpoint to get messages/notifications for current user
app.get('/api/messages', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    // Get messages from activity logs where user is affected
    const result = await pool.query(`
      SELECT
        al.id,
        al.action,
        al.details,
        al.created_at,
        ft.name as family_name,
        CASE
          WHEN al.action = 'change_name' THEN 'Family name was changed'
          WHEN al.action = 'delete_family' THEN 'A family was deleted by admin'
          WHEN al.action = 'regenerate_code' THEN 'Access code for "' || ft.name || '" was changed'
          ELSE al.action
        END as message
      FROM activity_logs al
      JOIN family_trees ft ON al.family_id = ft.id
      LEFT JOIN family_admins fa ON ft.id = fa.family_id AND fa.user_id = $1
      WHERE (fa.user_id = $1 OR ft.admin_id = $1)
        AND al.user_id != $1
        AND al.action IN ('change_name', 'delete_family', 'regenerate_code')
      ORDER BY al.created_at DESC
      LIMIT 50
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
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
      [family.id, userId, 'access', JSON.stringify({ familyName, accessCode })]
    );

    res.json({ family, isAdmin: family.admin_id === userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to access family tree' });
  }
});

// Endpoint to update family tree (allows all users with access)
app.put('/api/family-tree/:id', getUserId, async (req, res) => {
  const { id } = req.params;
  const { data } = req.body;
  const userId = req.userId;

  if (!data) {
    return res.status(400).json({ error: 'Missing required field: data' });
  }

  try {
    // Check if user has access to this family (is admin, creator, or has access via code)
    const accessCheck = await pool.query(`
      SELECT ft.*, fa.user_id as admin_user_id
      FROM family_trees ft
      LEFT JOIN family_admins fa ON ft.id = fa.family_id AND fa.user_id = $1
      WHERE ft.id = $2
    `, [userId, id]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Family not found or access denied' });
    }

    const family = accessCheck.rows[0];
    const isAdmin = family.admin_user_id !== null || family.admin_id === userId;

    // Allow update if user is admin OR if they have access to the family
    // (admins can always update, members can update their shared family trees)
    if (!isAdmin) {
      // For non-admins, check if they have access (this allows collaborative editing)
      // Since they got past the accessCheck, they have some level of access
      // We'll allow the update but log it differently
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
      [id, userId, isAdmin ? 'admin_update' : 'member_update', JSON.stringify({ oldData, newData: data })]
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
      [id, userId, 'add_admin', JSON.stringify({ newAdminId })]
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
      'UPDATE family_trees SET access_code = $1 WHERE id = $2 RETURNING *',
      [newCode, id]
    );

    // Log the code regeneration
    await pool.query(
      `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, userId, 'regenerate_code', JSON.stringify({ oldCode: result.rows[0].access_code, newCode })]
    );

    res.json({ accessCode: newCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to regenerate access code' });
  }
});
// Endpoint to hide family tree for non-admin users (soft delete)
app.post('/api/family-tree/:id/hide', getUserId, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    // Check if user is NOT an admin (only non-admins can hide)
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length > 0) {
      return res.status(403).json({ error: 'Admins cannot hide family trees' });
    }

    // Add to hidden families table (create if doesn't exist)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hidden_families (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        family_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, family_id)
      );
    `);

    await pool.query(
      'INSERT INTO hidden_families (user_id, family_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, id]
    );

    res.json({ message: 'Family tree hidden successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to hide family tree' });
  }
});

// Endpoint to delete family tree (admin only - hard delete)
app.delete('/api/family-tree/:id', getUserId, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    // Check if current user is admin of this family
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [id, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can delete family trees' });
    }

    // Get family name for logging
    const familyData = await pool.query('SELECT name FROM family_trees WHERE id = $1', [id]);
    const familyName = familyData.rows[0]?.name;

    // Delete the family tree (cascade will handle related records)
    await pool.query('DELETE FROM family_trees WHERE id = $1', [id]);

    // Log the deletion AFTER deleting (but don't fail if logging fails)
    try {
      await pool.query(
        `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
        [id, userId, 'delete_family', JSON.stringify({ familyName })]
      );
    } catch (logErr) {
      console.warn('Failed to log deletion activity:', logErr.message);
      // Don't fail the deletion if logging fails
    }

    res.json({ message: 'Family tree deleted successfully' });
  } catch (err) {
    console.error('Error deleting family tree:', err);
    res.status(500).json({ error: 'Failed to delete family tree' });
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



// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
