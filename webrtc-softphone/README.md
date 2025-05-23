# WebRTC Softphone in ReactJS and NodeJS

## 1. Project Overview

This project is a web-based softphone application built using ReactJS for the frontend and NodeJS (Express.js) for the backend. It utilizes WebRTC for real-time communication and SIP for signaling. The backend uses CockroachDB for storing user credentials and WebRTC configurations.

## 2. Features

- User authentication (JWT-based).
- Dynamic fetching of WebRTC/SIP configuration from backend post-login.
- SIP registration.
- Outgoing and incoming calls.
- Call controls: Mute, Hold.
- Ringtone for incoming calls with Auto-Answer support based on SIP headers.
- Floating, draggable dialer interface.
- Tabbed interface within the dialer:
    - Dialpad
    - Audio Settings (Device listing, Mic test with VU meter, Speaker test)
    - Call Script (Placeholder)
    - Call Logs (Placeholder)
    - Customer Detail & History (Placeholder)
    - Disposition Form (Placeholder)
- Enhanced SIP and call status display.
- Collection and submission of WebRTC call statistics to the backend.

## 3. Project Structure

webrtc-softphone/
├── backend/         # NodeJS (Express.js) application
│   ├── config/      # Database configuration (db.js)
│   ├── db/          # Database schema (db_schema.sql)
│   ├── routes/      # API routes (authRoutes.js, webrtcRoutes.js, statsRoutes.js)
│   ├── utils/       # Utility functions (jwtUtils.js, passwordUtils.js)
│   ├── .env         # Environment variables
│   ├── index.js     # Main server file
│   └── package.json
├── frontend/        # ReactJS (Vite) application
│   ├── public/      # Static assets (e.g., sounds/)
│   ├── src/
│   │   ├── components/ # React components (Dialer, LoginForm, AudioSettings, tabs/)
│   │   ├── store/      # Zustand stores (authStore.js, sipStore.js)
│   │   ├── App.jsx     # Main React app component
│   │   ├── main.jsx    # React entry point
│   │   └── ...         # Other React files
│   ├── .env         # Environment variables for Vite
│   └── package.json
└── README.md        # This file

## 4. Backend Setup

### Dependencies
Key dependencies include:
- `express`: Web framework
- `jsonwebtoken`: JWT authentication
- `bcryptjs`: Password hashing
- `pg`: PostgreSQL client for CockroachDB
- `dotenv`: Environment variable management
- `cors`: CORS middleware
(See `backend/package.json` for the full list)

### Database Setup
- Uses CockroachDB.
- The database schema is defined in `backend/db/db_schema.sql`. This script includes `CREATE DATABASE IF NOT EXISTS softphone_db;` and `USE softphone_db;` followed by table creations for `users`, `webrtc_configurations`, and `call_statistics`.
- Ensure your CockroachDB instance is running and accessible. Connection details are specified in `backend/.env`.

### Environment Variables (`backend/.env`)
Create a `.env` file in the `backend/` directory with the following structure:
```
PORT=3001
DATABASE_URL="postgresql://user:password@host:port/softphone_db?sslmode=disable" # Adjust for your CockroachDB setup
JWT_SECRET="your_very_secure_jwt_secret_key"
```

### Running the Backend (Conceptual)
1. Navigate to the `backend` directory.
2. **IMPORTANT:** Install dependencies: `npm install` (see Known Issues).
3. Start the server: `npm start` (or `npm run dev` if nodemon is configured).
The server will typically run on `http://localhost:3001`.

### API Endpoints
- **Authentication (`/api/auth`):**
    - `POST /register`: User registration.
    - `POST /login`: User login.
- **WebRTC Configuration (`/api/webrtc`):**
    - `GET /config`: Fetches WebRTC/SIP settings for the logged-in user (JWT protected).
- **Call Statistics (`/api/callstats`):**
    - `POST /`: Submits WebRTC call statistics after a call (JWT protected).

## 5. Frontend Setup

### Dependencies
Key dependencies include:
- `react`: UI library
- `vite`: Build tool
- `jssip`: SIP library for WebRTC
- `zustand`: State management
- `react-draggable`: For draggable components
- `axios`: HTTP client
- `react-router-dom`: For routing (if expanded in future)
(See `frontend/package.json` for the full list)

### Environment Variables (`frontend/.env`)
Create a `.env` file in the `frontend/` directory (Vite automatically loads this):
```
VITE_API_BASE_URL=http://localhost:3001/api
```

### Running the Frontend (Conceptual)
1. Navigate to the `frontend` directory.
2. **IMPORTANT:** Install dependencies: `npm install` (see Known Issues).
3. Start the development server: `npm run dev`.
The application will typically be accessible at `http://localhost:5173` (Vite's default).

## 6. Core Frontend Stores (Zustand)

- **`src/store/authStore.js`:** Manages authentication state (token, user details), login/logout logic, and fetching of WebRTC configuration from the backend.
- **`src/store/sipStore.js`:** Manages all SIP communication (JsSIP User Agent), registration status, call states (making, receiving, holding, muting calls), ringtone logic, and WebRTC call statistics collection/submission.

## 7. Known Issues & Limitations

- **Dependency Installation:** During the automated generation process, `npm install` commands failed for both frontend and backend due to limitations in the execution environment (`ENOENT: no such file or directory, uv_cwd` or similar errors). **You will need to manually run `npm install` in both the `frontend` and `backend` directories after obtaining the code.**
- **Audio Files:** The ringtone (`frontend/public/sounds/ringtone.mp3`) and speaker test sound (`frontend/public/sounds/test-sound.mp3`) are placeholder text files. You will need to replace them with actual audio files for the sound features to work correctly.
- **Live Testing:** The application has not been live-tested in a full end-to-end environment due to the dependency installation issues. Testing has been conceptual, based on code review and logic flow analysis.
```
