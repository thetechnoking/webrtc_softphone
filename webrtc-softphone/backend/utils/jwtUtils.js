require('dotenv').config(); // Ensures JWT_SECRET is loaded from .env
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  // In a real application, you should not proceed without a JWT_SECRET.
  // Consider process.exit(1) here, or ensure your deployment process guarantees its presence.
}

/**
 * Generates a JSON Web Token.
 * @param {object} payload - The payload to store in the token (e.g., { userId: user.id, username: user.username }).
 * @param {string|object} [options] - Options for jwt.sign (e.g., { expiresIn: '1h' }).
 * @returns {string} The generated JWT.
 * @throws {Error} If JWT_SECRET is not available or signing fails.
 */
const generateToken = (payload, options = { expiresIn: '24h' }) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Cannot generate token.');
  }
  if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
    throw new Error('Payload must be a non-empty object.');
  }
  try {
    return jwt.sign(payload, JWT_SECRET, options);
  } catch (error) {
    console.error('Error generating JWT:', error);
    throw new Error('Token generation failed.');
  }
};

/**
 * Verifies a JSON Web Token.
 * @param {string} token - The JWT to verify.
 * @returns {object|null} The decoded payload if the token is valid, null otherwise.
 */
const verifyToken = (token) => {
  if (!JWT_SECRET) {
    // This check is more for completeness, as generateToken would likely fail first if JWT_SECRET is missing.
    console.error('JWT_SECRET is not configured. Cannot verify token.');
    return null;
  }
  if (!token) {
    return null; // Or throw an error, depending on desired handling
  }
  try {
    // Returns the decoded payload if the signature is valid and token is not expired
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    // Handles errors like 'JsonWebTokenError' (e.g., malformed token, invalid signature)
    // or 'TokenExpiredError'
    console.error('Invalid or expired token:', error.message);
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
