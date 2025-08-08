# Star Trek Battle Simulator API
Name not final

WIP readme

**Visit online here: https://startrekbattlesim.zytronium.dev/**

----

## Environment Variables

Below are all the environment variables you can use and their defaults.

```dotenv
PORT=5005              # Port the server runs on
DEBUG=false            # Runs in debug mode if true*
DB_USER=your_username  # Database username
DB_PASSWORD=           # Database password; leave blank if no password
DB_HOST=localhost      # Database host IP
DB_PORT=5432           # Database port
DB_NAME=star_trek_db   # Database name
DB_SSL=true            # Database connection ignores SSL if false

# *: Add debug code in src/middleware/debugLogs.js, or where ever else
#    needed inside `if (process.env.DEBUG?.toLowerCase() === 'true') {}`
```

----

## Running the Server:

**Run the server** (src/app.js)**:**
```bash
npm run start-server
```
This runs the server normally with node.

**Run the server in debug mode:**
```bash
npm run debug-server
```
This injects the environment variable `DEBUG=true` and runs the server with `nodemon`.
Nodemon must be installed for this to work.

----

## Running the Database:

Create the db
```bash
createdb star_trek_db
```
If that doesn't work try this
```bash
psql postgres -c "CREATE DATABASE star_trek_db;"
```

Then this script is in package, it creates the empty tables
```bash
npm run create-db
```

After db is created you can access it
```bash
psql star_trek_db
```

And it should have our two empty tables

`star_trek_db=# \dt`

### List of relations
| Schema | Name        | Type  | Owner        |
|--------|-------------|-------|--------------|
| public | spacecrafts | table | tebariousbag |
| public | weapons     | table | tebariousbag |

And their respective columns

`star_trek_db=# SELECT * FROM spacecrafts;`

| id | name | class | affiliation | registry | status | description | created_at | updated_at |
|----|------|-------|-------------|----------|--------|-------------|------------|------------|

`star_trek_db=# SELECT * FROM weapons;`

| id | spacecraft_id | weapon_type | weapon_name | description | affiliation | era | created_at | updated_at |
|----|---------------|-------------|-------------|-------------|-------------|-----|------------|------------|

----

## Authors

Daniel Stelljes | [GitHub](https://github.com/Zytronium)  
John Wilson     | [GitHub](https://github.com/Paintballskaguy)  
Tristian Davis  | [GitHub](https://github.com/TebariousBag)

----

## Data Sources:

- [STAPI](https://stapi.co/)
- [Our imagination](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

----
