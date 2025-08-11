-- Create database
CREATE DATABASE star_trek_db;

-- Create user (replace 'your_username' and 'your_password')
CREATE USER STARUSER WITH PASSWORD 'your_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE star_trek_db TO STARUSER;

-- Exit psql
\q