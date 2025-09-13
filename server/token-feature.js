const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_bv1YBzlLVnp6@ep-rapid-brook-adbgxz6b-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

// Token expiration time in milliseconds (1 day)
const TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// New table for temporary access tokens
const initTokenTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS access_tokens (
      id SERIAL PRIMARY KEY,
      family_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
};

initTokenTable().then(() => {
  console.log('Access tokens table initialized.');
});

// Endpoint to generate a temporary access token for a family (expires after 1 day)
const generateToken = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.userId;

  try {
    // Check if current user is admin of this family
    const adminCheck = await pool.query(`
      SELECT * FROM family_admins
      WHERE family_id = $1 AND user_id = $2
    `, [familyId, userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can generate access tokens' });
    }

    // Generate a new token
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

    // Insert token into DB
    await pool.query(
      `INSERT INTO access_tokens (family_id, token, expires_at) VALUES ($1, $2, $3)`,
      [familyId, token, expiresAt]
    );

    res.json({ token, expiresAt });
  } catch (err) {
    console.error('Failed to generate access token:', err);
    res.status(500).json({ error: 'Failed to generate access token' });
  }
};

// Middleware to validate temporary access token
const validateAccessToken = async (req, res, next) => {
  const { familyId, token } = req.query;

  if (!familyId || !token) {
    return res.status(400).json({ error: 'Missing familyId or token' });
  }

  try {
    const result = await pool.query(`
      SELECT * FROM access_tokens
      WHERE family_id = $1 AND token = $2 AND expires_at > NOW()
    `, [familyId, token]);

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    next();
  } catch (err) {
    console.error('Error validating access token:', err);
    res.status(500).json({ error: 'Failed to validate access token' });
  }
};

module.exports = {
  generateToken,
  validateAccessToken,
};
