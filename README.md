# Star Trek Battle Simulator API
Name not final

WIP readme

## Running the Server:

```bash
npm run start-server
```
This runs the server normally with node.

Run the server in debug mode:
```bash
npm run debug-server
```
This injects the environment variable `DEBUG=true` and runs the serve with `nodemon`.
Nodemon must be installed for this to work.

----

## Environment Variables
Below are all the environment variables you can use and their defaults.
```dotenv
PORT=5005
DEBUG=false
```

----
## Running the Database:
## Environment Variables
Below are all the environment variables you can use and their defaults.
```dotenv
DB_USER=your_username
DB_PASSWORD=   # leave blank if no password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=star_trek_db
```

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
              List of relations
 Schema |    Name     | Type  |    Owner     
--------+-------------+-------+--------------
 public | spacecrafts | table | tebariousbag
 public | weapons     | table | tebariousbag
(2 rows)


----
## Authors

Daniel Stelljes | [GitHub](https://github.com/Zytronium)  
John Wilson     | [GitHub](https://github.com/Paintballskaguy)  
Tristian Davis   | [GitHub](https://github.com/TebariousBag)

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
><strong>Friday: 20% (task x)</strong>  
<em style="color: gray">Saturday/Sunday: 40% (task x)</em>  
<em style="color: gray">Monday: 65% (task x)</em>  
<em style="color: gray">Tuesday: 90-100% (task x)</em>  
<em style="color: gray">Wednesday: 100% (task x)</em>  
> 
---
