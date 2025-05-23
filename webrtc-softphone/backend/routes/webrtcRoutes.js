const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwtUtils');
const db = require('../config/db');

// Middleware to protect routes
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
    const decoded = verifyToken(token);
    if (!decoded) {
      // verifyToken returns null if token is invalid/expired based on current implementation
      return res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
    }
    req.user = decoded; // Attach user payload (e.g., { userId: 'some-id', username: 'testuser' })
    next();
  } catch (error) {
    // This catch block might be redundant if verifyToken handles its own errors and returns null.
    // However, it's good practice for unexpected errors during token verification.
    console.error('Error verifying token:', error);
    return res.status(403).json({ message: 'Forbidden: Token verification failed' });
  }
};

// GET /api/webrtc/config - Fetches WebRTC configuration for the authenticated user
router.get('/config', protectRoute, async (req, res) => {
  // req.user should be populated by the protectRoute middleware
  // and should contain the user's ID, typically as userId (based on jwtUtils.js)
  const userId = req.user.userId; 

  if (!userId) {
    // This should ideally not happen if protectRoute and generateToken are working correctly
    console.error('User ID not found in token payload after protectRoute');
    return res.status(400).json({ message: 'Bad Request: User identifier missing from token' });
  }

  try {
    const queryResult = await db.query(
      'SELECT * FROM webrtc_configurations WHERE user_id = $1',
      [userId]
    );

    if (queryResult.rows.length === 0) {
      return res.status(404).json({ message: 'WebRTC configuration not found for this user' });
    }

    // Assuming a user has only one WebRTC configuration for simplicity.
    // If multiple are possible, this might need adjustment.
    res.json(queryResult.rows[0]);

  } catch (error) {
    console.error('Error fetching WebRTC configuration:', error);
    res.status(500).json({ message: 'Server error while retrieving WebRTC configuration' });
  }
});

// POST /api/webrtc/config - Creates or updates WebRTC configuration for the authenticated user
router.post('/config', protectRoute, async (req, res) => {
  const userId = req.user.userId;
  const {
    websocket_uri,
    sip_username,
    sip_password,
    udp_server_address,
    display_name,
    realm,
    ha1_password,
    stun_servers,
    turn_servers
  } = req.body;

  // Basic validation for required fields
  if (!websocket_uri || !sip_username || !sip_password) {
    return res.status(400).json({ message: 'websocket_uri, sip_username, and sip_password are required' });
  }

  try {
    // Check if a configuration already exists for this user
    const existingConfig = await db.query(
      'SELECT id FROM webrtc_configurations WHERE user_id = $1',
      [userId]
    );

    let savedConfig;
    if (existingConfig.rows.length > 0) {
      // Update existing configuration
      const configId = existingConfig.rows[0].id;
      const updateResult = await db.query(
        `UPDATE webrtc_configurations 
         SET websocket_uri = $1, sip_username = $2, sip_password = $3, udp_server_address = $4, 
             display_name = $5, realm = $6, ha1_password = $7, stun_servers = $8, turn_servers = $9, 
             updated_at = NOW()
         WHERE id = $10 AND user_id = $11
         RETURNING *`,
        [
          websocket_uri, sip_username, sip_password, udp_server_address,
          display_name, realm, ha1_password, stun_servers, turn_servers,
          configId, userId
        ]
      );
      savedConfig = updateResult.rows[0];
      res.json({ message: 'WebRTC configuration updated successfully', configuration: savedConfig });
    } else {
      // Create new configuration
      const insertResult = await db.query(
        `INSERT INTO webrtc_configurations 
          (user_id, websocket_uri, sip_username, sip_password, udp_server_address, 
           display_name, realm, ha1_password, stun_servers, turn_servers)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId, websocket_uri, sip_username, sip_password, udp_server_address,
          display_name, realm, ha1_password, stun_servers, turn_servers
        ]
      );
      savedConfig = insertResult.rows[0];
      res.status(201).json({ message: 'WebRTC configuration created successfully', configuration: savedConfig });
    }
  } catch (error) {
    console.error('Error saving WebRTC configuration:', error);
    // Could check for specific DB errors, e.g., foreign key violation if user_id is somehow invalid
    res.status(500).json({ message: 'Server error while saving WebRTC configuration' });
  }
});


module.exports = router;
