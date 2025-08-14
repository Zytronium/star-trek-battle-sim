#!/usr/bin/env node
class BattleSimulator {
  constructor() {
    this.logs = [];
  }

  simulateBattle(playerShip, enemyShip) {
    this.logs = [];
    const player = { 
      ...playerShip,
      shields: playerShip.shield_strength,
      hull: playerShip.hull_strength,
      attack_power: playerShip.attack_power || 10,
      evasion_chance: playerShip.evasion || 0.1,
      critical_chance: playerShip.critical || 0.05
    };
    const enemy = { 
      ...enemyShip,
      shields: enemyShip.shield_strength,
      hull: enemyShip.hull_strength,
      attack_power: enemyShip.attack_power || 10,
      evasion_chance: enemyShip.evasion || 0.1,
      critical_chance: enemyShip.critical || 0.05
    };

    this.logs.push(`===== BATTLE STARTED =====`);
    this.logs.push(`${player.name} vs ${enemy.name}`);
    
    let round = 1;
    while (player.hull > 0 && enemy.hull > 0) {
      this.logs.push(`\n===== ROUND ${round} =====`);
      
      // Player attack
      const playerAttack = this.calculateAttack(player, enemy);
      if (playerAttack.evaded) {
        this.logs.push(`${enemy.name} evaded ${player.name}'s attack!`);
      } else {
        this.logs.push(`${player.name} hits ${enemy.name} for ${playerAttack.damage} damage!`);
        if (playerAttack.isCritical) {
          this.logs.push(`CRITICAL HIT!`);
        }
        this.logs.push(`${enemy.name} shields: ${enemy.shields.toFixed(0)} | hull: ${enemy.hull.toFixed(0)}`);
      }
      
      // Enemy attack
      if (enemy.hull > 0) {
        const enemyAttack = this.calculateAttack(enemy, player);
        if (enemyAttack.evaded) {
          this.logs.push(`${player.name} evaded ${enemy.name}'s attack!`);
        } else {
          this.logs.push(`${enemy.name} hits ${player.name} for ${enemyAttack.damage} damage!`);
          if (enemyAttack.isCritical) {
            this.logs.push(`CRITICAL HIT!`);
          }
          this.logs.push(`${player.name} shields: ${player.shields.toFixed(0)} | hull: ${player.hull.toFixed(0)}`);
        }
      }
      
      round++;
    }
    
    // Determine winner
    let outcome;
    if (player.hull <= 0 && enemy.hull <= 0) {
      outcome = 'draw';
      this.logs.push('\nBATTLE ENDS IN A DRAW! Both ships destroyed!');
    } else if (player.hull <= 0) {
      outcome = 'defeat';
      this.logs.push(`\n${enemy.name} DESTROYED ${player.name}! MISSION FAILED!`);
    } else {
      outcome = 'victory';
      this.logs.push(`\n${player.name} DESTROYED ${enemy.name}! VICTORY!`);
    }
    
    return {
      outcome,
      logs: this.logs
    };
  }

    // Update the calculateAttack method:
    calculateAttack(attacker, defender) {
    // Check for evasion
    if (Math.random() < (defender.evasion_chance || 0.1)) {
        return { evaded: true };
    }
    
    // Calculate base damage - use attack_power from ship data
    let damage = attacker.attack_power * (0.8 + Math.random() * 0.4);
    
    // Check for critical hit
    const isCritical = Math.random() < (attacker.critical_chance || 0.05);
    if (isCritical) {
        damage *= 2.5;
    }
    
    // Apply damage - use shield_strength and hull_strength
    const shieldDamage = Math.min(damage, defender.shields);
    const hullDamage = Math.max(0, damage - defender.shields);
    
    defender.shields -= shieldDamage;
    defender.hull -= hullDamage;
    
    return {
        damage: Math.round(damage),
        isCritical,
        shieldDamage: Math.round(shieldDamage),
        hullDamage: Math.round(hullDamage),
        evaded: false
    };
  }
}

module.exports = BattleSimulator;

