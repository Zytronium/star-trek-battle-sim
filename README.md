# Star Trek Battle Simulator API
Name not final

WIP readme

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
DATABASE_URL=          # Database URL if using an external database**
NODE_ENV=              # Set to 'production' if you need to use DATABASE_URL

# *: Add debug code in src/middleware/debugLogs.js, or where ever else
#    needed inside `if (process.env.DEBUG?.toLowerCase() === 'true') {}`
# **: Leave DATABASE_URL blank if you're able to connect by changing DB_HOST.
#     SSL is ignored if DATABASE_URL is set and NODE_ENV is 'production'.
#     This is for compatibility with Render.com. It may still be possible to
#     connect externally by changing DB_HOST, depending on the host.
```
Note: `DATABASE_URL` and `NODE_ENV` are used if you need a specific URL to
connect to the Postgres database. For example, this project is being hosted
with Render.com and has a Postgres database set up on Render. In order to
connect to that database, which runs on the same network Render uses to
host our API, SSL must be ignored and a special URL is required. Render sets
`NODE_ENV` to 'production' automatically, which tells our API to ignore SSL
and use `DATABASE_URL` instead of `DB_USER`, `DB_PASSWORD`, `DB_HOST`,
`DB_PORT`, and `DB_NAME`.

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
This injects the environment variable `DEBUG=true` and runs the serve with `nodemon`.
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

star_trek_db=# \dt

### List of relations
| Schema | Name        | Type  | Owner        |
|--------|-------------|-------|--------------|
| public | spacecrafts | table | tebariousbag |
| public | weapons     | table | tebariousbag |

And their respective columns

star_trek_db=# SELECT * FROM spacecrafts;

| id | name | class | affiliation | registry | status | description | created_at | updated_at |
|----|------|-------|-------------|----------|--------|-------------|------------|------------|

star_trek_db=# SELECT * FROM weapons;

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

### ✅ Tasks checklist:
- [ ] ​0. task name (0/__ pts)
- [ ] ​1. task name (0/__ pts)
- [ ] ​2. task name (0/__ pts)
- [ ] ​3. task name (0/__ pts)
- [ ] ​4. task name (0/__ pts)
- [ ] ​5. task name (0/__ pts)
- [ ] ​6. task name (0/__ pts)
- [ ] ​7. task name (0/__ pts)
- [ ] ​8. task name (0/__ pts)
- [ ] ​9. task name (0/__ pts)
- [ ] ​10. task name (0/__ pts)


- [ ] Readme
- [ ] **Everything Done ✓** (0/__ pts) - __%

>### Progress Goals:  (todo; this is a template)  
><strong style="color: white">Friday: 20% (task x)</strong>  
<em style="color: gray">Saturday/Sunday: 40% (task x)</em>  
<em style="color: gray">Monday: 65% (task x)</em>  
<em style="color: gray">Tuesday: 90-100% (task x)</em>  
<em style="color: gray">Wednesday: 100% (task x)</em>  

----
