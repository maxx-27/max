const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// GET /api/links — public
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.execute('SELECT * FROM social_links ORDER BY sort_order ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/links/click/:id — public, track click
router.post('/click/:id', async (req, res) => {
    try {
        const db = await getDb();
        await db.execute('UPDATE social_links SET clicks = clicks + 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/links — protected, create link
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, url, icon } = req.body;
        if (!title || !url) return res.status(400).json({ error: 'Title and URL required.' });

        const db = await getDb();
        const maxOrder = await db.execute('SELECT MAX(sort_order) as m FROM social_links');
        const nextOrder = (Number(maxOrder.rows[0]?.m) || 0) + 1;

        await db.execute(
            'INSERT INTO social_links (title, url, icon, sort_order) VALUES (?, ?, ?, ?)',
            [title, url, icon || 'link', nextOrder]
        );

        const last = await db.execute('SELECT * FROM social_links ORDER BY id DESC LIMIT 1');
        res.status(201).json(last.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/links/:id — protected, update link
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { title, url, icon } = req.body;
        const db = await getDb();

        await db.execute(
            'UPDATE social_links SET title = ?, url = ?, icon = ? WHERE id = ?',
            [title, url, icon || 'link', req.params.id]
        );

        const updated = await db.execute('SELECT * FROM social_links WHERE id = ?', [req.params.id]);
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/links/:id — protected
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        await db.execute('DELETE FROM social_links WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/links/reorder — protected, batch reorder
router.put('/reorder/batch', authMiddleware, async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ error: 'Order array required.' });

        const db = await getDb();
        for (let i = 0; i < order.length; i++) {
            await db.execute('UPDATE social_links SET sort_order = ? WHERE id = ?', [i + 1, order[i]]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
