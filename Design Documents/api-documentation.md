# Star Trek Battle Engine's API Documentation

## 📋 Quick Reference

| Endpoint             | Method | Description                         |
|----------------------|--------|-------------------------------------|
| `/api/status`        | GET    | API status info                     |
| `/api/health`        | GET    | Database & API health check         |
| `/api/database`      | GET    | Return most database tables         |
| `/api/ships`         | GET    | All ships (basic info only)         |
| `/api/ships/full`    | GET    | All ships with weapons & defenses   |
| `/api/ship/:id`      | GET    | Single ship (basic info)            |
| `/api/ship/:id/full` | GET    | Single ship with weapons & defenses |
| `/api/shipImg/:id`   | GET    | Ship image source                   |
| `/api/boss-ships`    | GET    | All boss ships                      |
| `/api/boss-ship/:id` | GET    | Single boss ship                    |
| `/api/weapon/:id`    | GET    | Single weapon                       |
| `/game/spectate?id=` | GET    | Serve spectate view                 |

---

**Base URL:**

```
/api
```

---

## 📡 Status & Health

### `GET /api/status`

Returns API status.

**Response 200**

```json
{
  "status": "operational",
  "timestamp": "2025-08-20T05:00:00.000Z",
  "version": "1.0.0"
}
```

---

### `GET /api/health`

Performs a simple DB check.

**Response 200**

```json
{
  "status": "healthy",
  "debugMode": false,
  "timestamp": "2025-08-20T05:00:00.000Z"
}
```

**Response 500**

```json
{
  "status": "unhealthy",
  "error": "Database check failed",
  "debugMode": false,
  "timestamp": "2025-08-20T05:00:00.000Z"
}
```

---

## 🗄 Database

### `GET /api/database`

Returns **most** of the database tables:

* `ships`
* `weapons`
* `defenses`
* `ship_weapons`
* `ship_defenses`

(Boss ships table not included here.)

**Response 200**

```json
{
  "ships": [ ... ],
  "weapons": [ ... ],
  "defenses": [ ... ],
  "ship_weapons": [ ... ],
  "ship_defenses": [ ... ]
}
```

---

## 🚀 Ships

### `GET /api/ships`

Returns basic ship info only.
(No weapons or defenses.)

---

### `GET /api/ships/full`

Returns all ships **with merged weapons and defenses**.

Each ship object includes:

```json
{
  "ship_id": 0,
  "name": "USS Enterprise-D",
  "weapons": [ ... ],
  "defenses": [ ... ],
  ...
}
```

---

### `GET /api/ship/:id`

Returns **basic info** for a single ship.

* **400** if `id` is missing or invalid
* **404** if ship not found

---

### `GET /api/ship/:id/full`

Returns **full info** for a single ship (merged with weapons & defenses).

* **400** if `id` is missing or invalid
* **404** if ship not found

---

### `GET /api/shipImg/:id`

Returns a ship’s image source path.

**Response 200**

```json
{
  "status": "success",
  "src": "/images/ships/enterprise-d.png"
}
```

* **400** if `id` is missing/invalid
* **404** if ship not found

---

## 👾 Boss Ships

### `GET /api/boss-ships`

Returns all boss ships.

---

### `GET /api/boss-ship/:id`

Returns a single boss ship.

* **400** if `id` is missing or invalid
* **404** if not found

---

## 🔫 Weapons

### `GET /api/weapon/:id`

Returns weapon details by ID.

* **400** if `id` is missing or invalid
* **404** if not found

---

## 🎮 Game Routes (Non-API)

These are served outside `/api` (see `gameRoutes.js`).

### `GET /game/spectate`

Returns a **modified version of `game.html`**:

* Page title changed to **“Star Trek Battle - Spectating Live Match”**
* Bottom weapon bar removed
* Optionally, JS file can be swapped to `game-spectate.js`

Static files in `/public` are also served at root.

---

# ❌ Error Handling

Most endpoints return JSON errors:

```json
{ "error": "Database query failed" }
```

Validation errors:

```json
"Param 'id' is invalid"
```

Not found errors:

```json
{ "error": "Ship not found" }
```
