require('dotenv').config(); // Ensure environment variables are loaded
const { Pool } = require('pg');

// Configuration for the database connection
// DATABASE_URL should be in the format: postgresql://user:password@host:port/database
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set.");
  // Depending on the application's needs, you might want to exit or throw an error.
  // For now, we'll allow the app to continue, but queries will fail.
  // Consider: process.exit(1); 
}

const pool = new Pool({
  connectionString: connectionString,
  // Example SSL configuration for CockroachDB Cloud or other managed services:
  // ssl: {
  //   rejectUnauthorized: process.env.NODE_ENV === 'production', // Enforce SSL in production
  //   // ca: process.env.SSL_CERT, // If using a self-signed certificate or custom CA
  // },
  // CockroachDB specific settings (optional, but can be useful)
  // application_name: 'webrtc_softphone_backend',
  // connection_timeout: 5000, // Milliseconds
  // statement_timeout: 10000,  // Milliseconds
});

// Event listener for successful connection
pool.on('connect', () => {
  console.log('Successfully connected to the database via connection pool.');
});

// Event listener for errors from the connection pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client in connection pool', err);
  // It's critical to handle errors here, or your application might crash or hang.
  // Consider logging the error and potentially exiting if it's a fatal error.
  // process.exit(-1); // Example: exit if the pool encounters a critical error
});

module.exports = {
  // Method to execute queries
  query: (text, params) => pool.query(text, params),
  
  // Export the pool itself if direct access is needed (e.g., for transactions or specific pool methods)
  pool,

  // A helper function to test the connection (optional)
  testConnection: async () => {
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('Database connection test successful:', res.rows[0]);
      return true;
    } catch (err) {
      console.error('Database connection test failed:', err);
      return false;
    }
  }
};
