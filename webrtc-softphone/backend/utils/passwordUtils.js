const bcrypt = require('bcryptjs');

const saltRounds = 10; // Standard practice for bcrypt salt rounds

/**
 * Hashes a plain text password.
 * @param {string} password - The plain text password to hash.
 * @returns {Promise<string>} A promise that resolves to the hashed password.
 * @throws {Error} If hashing fails.
 */
const hashPassword = async (password) => {
  if (!password) {
    throw new Error('Password cannot be null or empty.');
  }
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Password hashing failed.'); // Or rethrow the original error
  }
};

/**
 * Compares a plain text password with a stored hash.
 * @param {string} password - The plain text password to compare.
 * @param {string} hash - The stored hashed password.
 * @returns {Promise<boolean>} A promise that resolves to true if the passwords match, false otherwise.
 * @throws {Error} If comparison fails.
 */
const comparePassword = async (password, hash) => {
  if (!password || !hash) {
    throw new Error('Password and hash must be provided for comparison.');
  }
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('Error comparing password:', error);
    throw new Error('Password comparison failed.'); // Or rethrow the original error
  }
};

module.exports = {
  hashPassword,
  comparePassword,
};
