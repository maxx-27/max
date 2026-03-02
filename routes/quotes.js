const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');

// GET /api/daily-quote
router.get('/', async (req, res) => {
    try {
        // Try external API first
        let quote = null;

        try {
            const fetch = require('node-fetch');
            const response = await fetch('https://api.quotable.io/random?tags=technology|wisdom|inspirational', {
                timeout: 3000
            });
            if (response.ok) {
                const data = await response.json();
                quote = { text: data.content, author: data.author };
            }
        } catch (apiErr) {
            // External API failed, use fallback
            console.log('Quote API unavailable, using local fallback');
        }

        // Fallback to local DB
        if (!quote) {
            const db = getDb();
            const today = new Date();
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
            const totalQuotes = db.prepare('SELECT COUNT(*) as c FROM daily_quotes').get().c;

            if (totalQuotes > 0) {
                const offset = dayOfYear % totalQuotes;
                quote = db.prepare('SELECT text, author FROM daily_quotes LIMIT 1 OFFSET ?').get(offset);
            } else {
                quote = { text: 'Every pixel tells a story.', author: 'maxs1el' };
            }
        }

        res.json(quote);
    } catch (err) {
        console.error('Quote error:', err);
        res.json({ text: 'Keep coding, keep creating.', author: 'maxs1el' });
    }
});

module.exports = router;
