#!/usr/bin/env node

const BattleSimulator = require('../game/battleSimulator');

async function runBattle() {
    const simulator = new BattleSimulator();
    
    try {
        // USS Enterprise-D (0) vs Borg Tactical Cube (0)
        const result = await simulator.simulateFullBattle(0, 0);
        
        console.log('===== BATTLE RESULTS =====');
        console.log(`Winner: ${result.winner}`);
        console.log(`Turns: ${result.turn}`);
        console.log('\nBattle Log:');
        result.battleLog.forEach(log => console.log(log));
        
        console.log('\nFinal Status:');
        console.log(`${result.playerShip.name}:`);
        console.log(`  Shields: ${result.playerShip.shield_strength}`);
        console.log(`  Hull: ${result.playerShip.hull_strength}`);
        console.log(`${result.enemyShip.name}:`);
        console.log(`  Shields: ${result.enemyShip.shield_strength}`);
        console.log(`  Hull: ${result.enemyShip.hull_strength}`);
    } catch (err) {
        console.error('Battle failed:', err);
    }
}

runBattle();