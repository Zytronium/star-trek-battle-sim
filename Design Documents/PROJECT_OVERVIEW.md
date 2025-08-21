# Star Trek Battle Simulator - Complete Project Overview

## Project Summary

The **Star Trek Battle Simulator** is a comprehensive web-based tactical space combat game that brings the Star Trek universe to life through strategic battles and immersive gameplay. This project demonstrates advanced web development skills, database design, API development, and game engine development.

## What We're Building

### Core Concept
A turn-based tactical combat simulator where players command authentic Star Trek starships in strategic space battles against AI opponents or other players. The game features:

- **Authentic Star Trek Universe**: Real ships, weapons, and technology from the canon
- **Strategic Combat**: Turn-based battles requiring tactical thinking
- **Rich Data**: Comprehensive database of ships, weapons, and defense systems
- **Immersive UI**: Space-themed interface with animations and effects
- **Scalable Architecture**: Modern web technologies for performance and maintainability

### Theme Alignment
This project fits the **T.V. Shows & Movies** theme becuase Star Trek is a T.V. Show (and has several movies) and we're using data that's as close to canon as possible.

## Technology Stack

### Frontend
- **HTML5**: Semantic markup and modern web standards
- **CSS3**: Advanced styling, animations, and responsive design
- **Vanilla JavaScript**: Pure JS for game logic and interactivity

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web application framework that powers the server 
- **PostgreSQL**: Relational SQL database for data persistence that holds all the data on ships, weapons, defenses, etc.
- **Socket.io**: Real-time communication (planned for multiplayer as well)

### Development Tools
- **Git**: Version control and collaboration
- **npm**: Package management and scripts
- **ESLint**: Code quality and consistency
- **Nodemon**: Development server with auto-reload
- **Custom-made Debug Mode**: Enabled with an environment variable, it enables custom debugging features

### Database
- **PostgreSQL**: Primary database system
- **pg**: Node.js PostgreSQL client
- **CSV Import/Export**: ETL processes for data management

## Architecture Overview

### System Components
```
┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI    │    │   Backend API   │    │   Database      │
│                  │    │                 │    │                 │
│ • Landing Page   │◄──►│ • Express Server│◄──►│ • PostgreSQL    │
│ • Battle Interface│   │ • Game Engine   │    │ • Ships Table   │
│ • Ship Selection │    │ • Battle Logic  │    │ • Weapons Table │
│ • Responsive CSS │    │ • Data Endpoints│    │ • Defenses Table│
└──────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow
1. **User Interface**: Players interact with the web interface
2. **API Requests**: Frontend sends requests to backend endpoints
3. **Game Engine**: Backend processes game logic and calculations
4. **Database**: Persistent storage of game data and statistics
5. **Response**: Results sent back to frontend for display

## Database Design

### Core Tables
- **ships**: Starfleet and enemy vessel specifications
- **weapons**: Various weapon systems and their properties
- **defenses**: Shield and armor systems
- **special_effects**: Special abilities and modifiers (mostly not yet implemented)
- **ship_weapons**: Many-to-many relationship between ships and weapons
- **ship_defenses**: Many-to-many relationship between ships and defenses
- **boss_ships**: Special enemy vessels with enhanced capabilities (not yet implemented, but data is there)

### Key Relationships
- Ships can have multiple weapons and defenses
- Weapons and defenses can have special effects
- Boss ships inherit from base ship types
- All relationships maintain referential integrity

## 🎮 Game Mechanics

### Combat System
- **Turn-based**: Strategic gameplay with alternating turns
- **Weapon Types**: Phasers, disruptors, torpedoes, etc.
- **Shield Mechanics**: Energy-based defense systems that deflect 95% of damage until they are low on HP
- **Damage Modifiers**: Different weapons are stronger or weaker against shields or hull
- **Limited Usage**: Some weapons have limited supply, or may even only be used once
- **Special Effects**: Three weapons have special effects such as partial shield bypass or energy disruption (only one is implemented)

## 📱 User Interface Design

### Design Philosophy
- **Futuristic Aesthetic**: Space-themed with glowing effects
- **Immersive Experience**: Full-screen backgrounds and animations
- **Intuitive Navigation**: Clear information hierarchy
- ~~**Responsive Design**: Works across all device sizes~~ (Not yet ;)

### Key Pages
1. **Landing Page**: Title screen with a battle button
2. **Ship Selection**: Visual ship picker with details
3. **Battle Interface**: Turn-based combat with display panels
4. **Spectate Mode**: A sharable link allows users to spectate a live game with zero latency without controlling it
5. ~~**Results Screen**: Battle outcomes and statistics~~ (Not yet ;)

### Visual Elements
- **Color Palette**: Deep space blues with Starfleet accents
- **Typography**: Clean, readable fonts with proper hierarchy
- **Animations**: Smooth transitions and hover effects
- **Icons**: Sci-fi themed visual elements

## 🔧 Development Timeline

### Phase 1: Core Infrastructure ✅
- [x] Database schema design and implementation
- [x] Basic Express server setup
- [x] CSV data import and ETL processes
- [x] Basic API endpoints

### Phase 2: Game Engine ✅
- [x] Battle simulation logic
- [x] Turn-based combat system
- [x] Weapon and defense calculations
- [x] Somewhat advanced AI opponent

### Phase 3: User Interface ✅
- [x] Main menu and ship selection
- [x] Battle interface design
- [x] Responsive CSS styling
- [x] Space-themed visual effects

### Phase 4: Enhanced Features 🚧
- [ ] AI vs AI battles
- [ ] Multiplayer support via WebSockets
- [ ] Advanced AI strategies + easy, medium, & hard selection
- [ ] Fleet battles
- [ ] Fleet vs Boss battles

### Core Endpoints
- **Health Check**: `/health` - System status
- **Ships**: `/api/ships` - Available vessels
- **Weapons**: `/api/weapons` - Weapon systems
- **Defenses**: `/api/defenses` - Defense systems

### Response Format
All API responses follow consistent JSON format with status, data, and error handling.

## 🎯 Success Metrics

### Technical Goals
- **Performance**: Battle calculations complete in <10ms (already complete -- usually takes 1-3ms)
- **Scalability**: Support many concurrent users
- **Reliability**: 99.9% uptime for production deployment with low latency database in production

### User Experience Goals
- **Engagement**: Average session length >5 minutes
- **Retention**: 70% of users return within 7 days
- **Satisfaction**: User rating >4.5/5 stars

###### Okay I give up on trying to make this look less like AI at this point.

## 🚨 Risk Assessment

### Technical Risks
- **Database Performance**: Complex queries may slow down with large datasets
- **Real-time Features**: WebSocket implementation complexity
- **Browser Compatibility**: Advanced CSS features may not work in older browsers

### Mitigation Strategies
- **Database Optimization**: Indexing and query optimization
- **Progressive Enhancement**: Core functionality works without advanced features
- **Cross-browser Testing**: Regular testing across major browsers

## 🔮 Future Ideas
- Player vs Player battles
- AI vs AI battles
- Fleet battles
- Boss battles
- Simulate replay of a battle
- Play Again button that restarts the battle with same settings
- Sound effects
- Add player tokens for more secure connection in PvP battles
- Add more ships (?)
- Improved AI with option to pick between easy, medium, and hard AI
- Visual ship selection grid
- Boss vs Boss battles
- Play as a boss

###### Yes, *some* of this WILL be worked on in the future.

## 📁 Project Structure

```
star-trek-battle-sim/
├── src/                    # Source code
│   ├── app.js             # Main server file
│   ├── config/            # Configuration files
│   ├── controllers/       # Business logic
│   ├── game/              # Game engine
│   ├── middleware/        # Express middleware
│   ├── public/            # Static assets
│   ├── routes/            # API routes
│   ├── scripts/           # Database & helper scripts
│   └── sql/               # SQL files
├── csv_files/             # Data import files
├── etl/                   # ETL processes
├── unit_tests/            # Test files
├── package.json           # Dependencies
└── README.md              # Project documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

### Installation
```bash
# Clone the repository
git clone https://github.com/Zytronium/star-trek-battle-sim.git
cd star-trek-battle-sim

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Create database
createdb star_trek_db

# Run database setup
npm run create-db-new

# Import data
npm run etl

# Start the server
npm run start-server
# or npm run debug-server
```

### Development Commands
```bash
npm run start-server      # Start production server
npm run debug-server      # Start development server with nodemon
npm run create-db-new     # Create database tables
npm run etl               # Import CSV data
npm run reset-db          # Reset database
npm run update-db         # Reset database and re-import CSV data
```

## 👥 Team & Contributors

- **Daniel Stelljes** | [GitHub](https://github.com/Zytronium)
- **John Wilson**     | [GitHub](https://github.com/Paintballskaguy)
- **Tristian Davis**  | [GitHub](https://github.com/TebariousBag)

## 📖 Documentation Index

1. **[PROJECT_DESIGN.md](PROJECT_DESIGN.md)** - Detailed project design and architecture
2. **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API reference
3. **[DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md)** - Database schema and relationships
4. **[WIREFRAMES.md](WIREFRAMES.md)** - UI/UX wireframes and design specifications
5. **[README.md](README.md)** - Quick start and basic usage

## 🌟 Key Features

### Implemented ✅
- Complete database schema with relationships
- Battle simulation engine
- Ship and weapon management
- Responsive web interface
- CSV data import/export
- Basic AI opponents

### Planned 🚧
- Multiplayer support
- Advanced AI strategies
- Campaign mode
- Ship customization
- Achievement system

## 🔗 Live Demo

**Visit the live application**: https://startrekbattlesim.zytronium.dev/

## 📝 License

This project is developed for educational and demonstration purposes. Star Trek is a trademark of CBS Studios Inc.

---

*This project represents a comprehensive implementation of a modern web-based game with real-time features, complex data relationships, and immersive user experience. It serves as an excellent example of full-stack web development using modern technologies.*
