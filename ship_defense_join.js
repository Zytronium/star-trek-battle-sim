const fs = require('fs');
const csv = require('csv-parser');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Load ships data to map ship_id to defenses
const ships = [];
fs.createReadStream('ships_2.csv')
  .pipe(csv())
  .on('data', (row) => {
    ships.push({
      ship_id: row.ship_id,
      defenses: row.defenses ? row.defenses.split(',').map(d => d.trim()) : []
    });
  })
  .on('end', () => {
    // Load defenses data to map names to IDs
    const defensesData = parse(fs.readFileSync('defenses.csv'), {
      columns: true,
      skip_empty_lines: true
    });
    
    const defenseNameToId = {};
    defensesData.forEach(defense => {
      defenseNameToId[defense.name.toLowerCase()] = defense.defense_id;
    });

    // Generate ship_defenses records
    const shipDefenses = [];
    ships.forEach(ship => {
      ship.defenses.forEach(defenseName => {
        const defenseKey = defenseName.toLowerCase();
        if (defenseNameToId[defenseKey]) {
          shipDefenses.push({
            ship_id: ship.ship_id,
            defense_id: defenseNameToId[defenseKey]
          });
        } else {
          console.warn(`Unknown defense "${defenseName}" for ship ${ship.ship_id}`);
        }
      });
    });

    // Write to CSV
    const output = stringify(shipDefenses, {
      header: true,
      columns: ['ship_id', 'defense_id']
    });
    
    fs.writeFileSync('ship_defenses.csv', output);
    console.log(`Generated ship_defenses.csv with ${shipDefenses.length} records`);
  });