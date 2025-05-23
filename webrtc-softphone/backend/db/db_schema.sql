CREATE DATABASE IF NOT EXISTS softphone_db;
USE softphone_db;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username STRING UNIQUE NOT NULL,
    password_hash STRING NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE webrtc_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    websocket_uri STRING NOT NULL,
    sip_username STRING NOT NULL,
    sip_password STRING NOT NULL,
    udp_server_address STRING,
    display_name STRING,
    realm STRING,
    ha1_password STRING,
    stun_servers STRING,
    turn_servers STRING,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE call_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- SET NULL if user is deleted
    call_id STRING UNIQUE NOT NULL, -- Unique identifier for the call
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    stats_blob JSONB, -- For CockroachDB, JSONB is appropriate for JSON data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
