# Star Trek Battle Simulator - API Documentation

## Base URL
```
http://localhost:5005/api
```

## Response Format
```json
{
  "status": "success|error",
  "data": {...},
  "message": "Optional message"
}
```

---

## Core Endpoints

### Health Check
**GET** `/health`
```json
{
  "status": "healthy",
  "debugMode": false,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Ships
**GET** `/ships`
```json
[
  {
    "id": 1,
    "name": "USS Enterprise-D",
    "class": "Galaxy",
    "affiliation": "Federation",
    "registry": "NCC-1701-D",
    "status": "Active"
  }
]
```

### Weapons
**GET** `/weapons`
```json
[
  {
    "id": 1,
    "weapon_type": "Phaser",
    "weapon_name": "Type X Phaser Array",
    "affiliation": "Federation",
    "era": "TNG"
  }
]
```

### Defenses
**GET** `/defenses`
```json
[
  {
    "id": 1,
    "name": "Deflector Shields",
    "type": "Shield",
    "affiliation": "Federation"
  }
]
```

### Database Info
**GET** `/database`
Returns all tables: ships, weapons, defenses, ship_weapons, ship_defenses

---

## Battle Simulation

### Simulate Battle
**POST** `/simulate-battle`

**Request:**
```json
{
  "ship1": {
    "id": 1,
    "weapons": [1, 2, 3],
    "defenses": [1, 2]
  },
  "ship2": {
    "id": 2,
    "weapons": [4, 5, 6],
    "defenses": [3, 4]
  }
}
```

**Response:**
```json
{
  "status": "success",
  "winner": "ship1",
  "rounds": [...],
  "final_stats": {
    "ship1_health_remaining": 650,
    "ship2_health_remaining": 0,
    "total_rounds": 15
  }
}
```

---

## Game Engine

### Engine Status
**GET** `/engine/status`
```json
{
  "status": "operational",
  "version": "1.0.0",
  "features": ["turn_based_combat", "weapon_systems", "defense_systems"]
}
```

---

## Status Codes
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Server Error

## CORS
All origins allowed. No authentication required.

---

*For additional support, refer to the project documentation.*
