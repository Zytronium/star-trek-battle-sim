# Star Trek Battle Engine

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

### Adding Data from the csv files
To import the CSV data:
```bash
npm run import-csv
```
You should see something like this

```bash
Importing spacecrafts...

CONNECTED TO DB
----------------------------
imported 10 spacecrafts
total 10 spacecrafts
Importing weapons...
imported 28 weapons
total 28 weapons
```

Now if you acces the database
```bash
psql star_trek_db
```
And select all from spacecrafts table
```sql
star_trek_db=# SELECT * FROM spacecrafts;
```
You should see all the spacecrafts. You can do the same for weapons.

### To Reset the Database (in case something messes up)
Run this script that is in package.json
```bash
npm run reset-db
```
and it will prompt you to populate again with
```bash
npm run import-csv
```
Now you should have a freshly restored database.

## NEW DB

Delete old DB tables

Add new Tables

```bash
npm run create-db-new
```

To populate the tables with csv data

```bash
npm run etl
```

To reset DB and start with fresh empty tables.
This runs create_db_new after resetting

```bash
npm run reset-db
```

You can also update the database by resetting it
and rerunning the ETL script with this script:
```bash
npm run update-db
```

---

## Authors

Daniel Stelljes | [GitHub](https://github.com/Zytronium)  
John Wilson     | [GitHub](https://github.com/Paintballskaguy)  
Tristian Davis  | [GitHub](https://github.com/TebariousBag)

----

## Data Sources:

- [STAPI](https://stapi.co/)
- [Memory Alpha](https://memory-alpha.fandom.com/wiki/Portal:Main)
- [Memory Beta](https://memory-beta.fandom.com/wiki/Main_Page)
- [Star Trek Online Wiki](https://stowiki.net/)
- [Federation Space Wiki](https://wiki.fed-space.com/)
- [Ex Astris Scientia](https://www.ex-astris-scientia.org/)
- [Daystrom Institute Technical Library](https://www.ditl.org/)
- [Our imagination](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

\* All data that can not be found from other sources is made up. Some data is
altered either to correct for inconsistencies or balancing issues. For example,
Voyager's extreme luck with the Borg, being able to fight off multiple Borg
cubes on their own, is not being accounted for in this simulation.

----
