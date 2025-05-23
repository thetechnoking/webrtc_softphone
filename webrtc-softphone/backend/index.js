require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const webrtcRoutes = require('./routes/webrtcRoutes'); // Import WebRTC routes
const statsRoutes = require('./routes/statsRoutes'); // Import Call Statistics routes
const { pool } = require('./config/db'); // Assuming pool is exported for potential direct use or events

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webrtc', webrtcRoutes); // Mount WebRTC routes
app.use('/api/callstats', statsRoutes); // Mount Call Statistics routes

// Simple root endpoint
app.get('/', (req, res) => {
  res.send('WebRTC Softphone Backend is running!');
});

// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Function to check database connection and start server
async function startServer() {
  try {
    // Test DB connection by getting the current time from the database
    const dbTest = await pool.query('SELECT NOW()');
    console.log('Database connected successfully:', dbTest.rows[0]);
    
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to the database. Server not started.', err);
    process.exit(1); // Exit if DB connection fails
  }
}

// Start the server
startServer();
