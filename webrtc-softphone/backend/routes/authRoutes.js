const express = require('express');
const router = express.Router();
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const { generateToken } = require('../utils/jwtUtils');
const db = require('../config/db'); // Imports the query function and potentially the pool

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Insert new user into the database
    // Assuming your users table has columns: id (auto-generated), username, password_hash
    const newUserResult = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, hashedPassword]
    );
    const newUser = newUserResult.rows[0];

    // Generate JWT token
    const token = generateToken({ userId: newUser.id, username: newUser.username });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        created_at: newUser.created_at
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Check for specific database errors if needed, e.g., unique constraint violation (though covered by above check)
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Retrieve user from the database
    const userResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials - user not found' });
    }
    const user = userResult.rows[0];

    // Compare the provided password with the stored hashed password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials - password mismatch' });
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, username: user.username });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

module.exports = router;
