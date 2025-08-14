#!/usr/bin/env node

const express = require('express');
const router = express.Router();
const BattleSimulator = require('../game/battleSimulator');

// Start a new battle
router.post('/start', async (req, res) => {
    try {
        const { playerShipId = 0, enemyShipId = 0 } = req.body;
        const simulator = new BattleSimulator();
        const battleState = await simulator.initBattle(playerShipId, enemyShipId);
        req.session.battle = simulator;
        res.json(battleState);
    } catch (err) {
        res.status(500).json({ error: 'Battle initialization failed', details: err.message });
    }
});

// Execute a battle turn
router.post('/turn', async (req, res) => {
    try {
        if (!req.session.battle) {
            return res.status(400).json({ error: 'No active battle' });
        }
        
        const turnResult = await req.session.battle.simulateTurn();
        res.json(turnResult);
    } catch (err) {
        res.status(500).json({ error: 'Battle turn failed', details: err.message });
    }
});

// Simulate full battle (AI vs AI)
router.post('/simulate', async (req, res) => {
    try {
        const { playerShipId = 0, enemyShipId = 0 } = req.body;
        const simulator = new BattleSimulator();
        const result = await simulator.simulateFullBattle(playerShipId, enemyShipId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Battle simulation failed', details: err.message });
    }
});

module.exports = router;