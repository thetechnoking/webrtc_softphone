const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwtUtils'); // Assuming verifyToken populates req.user
const db = require('../config/db');

// Middleware to protect routes (similar to webrtcRoutes.js)
// It should extract the user ID and attach it to req.user or req.userId
const protectRoute = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Token not found in header' });
  }

  try {
    const decoded = verifyToken(token); // verifyToken should return the payload { userId, username, ... }
    if (!decoded || !decoded.userId) { // Check for userId in the decoded payload
      return res.status(403).json({ message: 'Forbidden: Invalid or expired token, or missing user identifier' });
    }
    req.user = decoded; // Attach the whole decoded payload (which includes userId)
    next();
  } catch (error) {
    console.error('Error verifying token in statsRoutes:', error);
    return res.status(403).json({ message: 'Forbidden: Token verification failed' });
  }
};

// POST / (mounted at /api/callstats) - Saves call statistics
router.post('/', protectRoute, async (req, res) => {
  const userId = req.user.userId; // Extracted from token by protectRoute

  const { call_id, start_time, end_time, duration_seconds, stats_blob } = req.body;

  // Basic validation
  if (!call_id || !stats_blob) {
    return res.status(400).json({ message: 'call_id and stats_blob are required' });
  }
  if (start_time && isNaN(new Date(start_time).getTime())) {
    return res.status(400).json({ message: 'Invalid start_time format' });
  }
  if (end_time && isNaN(new Date(end_time).getTime())) {
    return res.status(400).json({ message: 'Invalid end_time format' });
  }
  if (duration_seconds && (isNaN(parseInt(duration_seconds)) || parseInt(duration_seconds) < 0)) {
    return res.status(400).json({ message: 'Invalid duration_seconds format' });
  }


  try {
    const queryText = `
      INSERT INTO call_statistics (user_id, call_id, start_time, end_time, duration_seconds, stats_blob)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, call_id, created_at
    `;
    
    // Use null for optional fields if they are not provided or invalid, rather than relying on DB default for start_time if an invalid one is passed
    const params = [
      userId,
      call_id,
      start_time ? new Date(start_time) : new Date(), // Default to now if not provided, or use validated
      end_time ? new Date(end_time) : null,
      duration_seconds ? parseInt(duration_seconds) : null,
      stats_blob, // Already validated to be present
    ];

    const result = await db.query(queryText, params);
    
    res.status(201).json({ 
      message: 'Call statistics saved successfully', 
      data: result.rows[0] 
    });

  } catch (error) {
    console.error('Error saving call statistics:', error);
    // Check for unique constraint violation for call_id (error code 23505 in PostgreSQL/CockroachDB)
    if (error.code === '23505' && error.constraint === 'call_statistics_call_id_key') {
      return res.status(409).json({ message: `Conflict: Call with call_id '${call_id}' already exists.` });
    }
    res.status(500).json({ message: 'Server error while saving call statistics' });
  }
});

module.exports = router;
