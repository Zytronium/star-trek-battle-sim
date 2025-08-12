DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'staruser') THEN
    CREATE USER staruser WITH PASSWORD 'Password1';
  END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE star_trek_db TO staruser;