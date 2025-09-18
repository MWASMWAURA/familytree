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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Family ID is required' });
  }

  try {
    const userId = await getUserId(req);

    switch (req.method) {
      case 'GET':
        // Get specific family tree
        const familyResult = await pool.query(
          'SELECT * FROM family_trees WHERE id = $1',
          [id]
        );

        if (familyResult.rows.length === 0) {
          return res.status(404).json({ error: 'Family not found' });
        }

        const family = familyResult.rows[0];

        // Check if user has access
        const accessCheck = await pool.query(`
          SELECT fa.user_id as admin_user_id
          FROM family_admins fa
          WHERE fa.family_id = $1 AND fa.user_id = $2
        `, [id, userId]);

        const hasAccess = accessCheck.rows.length > 0 || family.admin_id === userId;

        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied' });
        }

        return res.status(200).json(family);

      case 'PUT':
        const { data } = req.body;

        if (!data) {
          return res.status(400).json({ error: 'Missing required field: data' });
        }

        // Check if user has admin access
        const adminCheck = await pool.query(`
          SELECT fa.user_id as admin_user_id
          FROM family_admins fa
          WHERE fa.family_id = $1 AND fa.user_id = $2
        `, [id, userId]);

        const hasAdminAccess = adminCheck.rows.length > 0 || family.admin_id === userId;

        if (!hasAdminAccess) {
          return res.status(403).json({ error: 'Access denied - not an admin' });
        }

        // Get current data for logging
        const currentDataResult = await pool.query(
          'SELECT data FROM family_trees WHERE id = $1',
          [id]
        );

        if (currentDataResult.rows.length === 0) {
          return res.status(404).json({ error: 'Family not found' });
        }

        const oldData = currentDataResult.rows[0].data;

        // Update the family tree
        const updateResult = await pool.query(
          'UPDATE family_trees SET data = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [data, id]
        );

        // Log the update
        await pool.query(
          `INSERT INTO activity_logs (family_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
          [id, userId, 'update', { oldData, newData: data }]
        );

        return res.status(200).json(updateResult.rows[0]);

      case 'DELETE':
        // Check admin access
        const deleteAdminCheck = await pool.query(`
          SELECT fa.user_id as admin_user_id
          FROM family_admins fa
          WHERE fa.family_id = $1 AND fa.user_id = $2
        `, [id, userId]);

        const canDelete = deleteAdminCheck.rows.length > 0 || family.admin_id === userId;

        if (!canDelete) {
          return res.status(403).json({ error: 'Access denied - not an admin' });
        }

        // Delete the family tree (this will cascade delete related records)
        await pool.query('DELETE FROM family_trees WHERE id = $1', [id]);

        return res.status(200).json({ message: 'Family tree deleted successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}