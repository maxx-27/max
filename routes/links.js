const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// GET /api/links — public
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const links = db.prepare('SELECT * FROM social_links ORDER BY sort_order ASC').all();
        res.json(links);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/track/click/:id — public, track link click
router.post('/click/:id', (req, res) => {
    try {
        const db = getDb();
        db.prepare('UPDATE social_links SET clicks = clicks + 1 WHERE id = ?').run(req.params.id);
        const link = db.prepare('SELECT url FROM social_links WHERE id = ?').get(req.params.id);
        res.json({ success: true, url: link ? link.url : null });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/admin/links — protected
router.post('/', authMiddleware, (req, res) => {
    try {
        const { title, url, icon } = req.body;
        if (!title || !url) {
            return res.status(400).json({ error: 'Title and URL are required.' });
        }

        const db = getDb();
        const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM social_links').get();
        const sortOrder = (maxOrder.max || 0) + 1;

        const result = db.prepare(
            'INSERT INTO social_links (title, url, icon, sort_order) VALUES (?, ?, ?, ?)'
        ).run(title, url, icon || 'link', sortOrder);

        const link = db.prepare('SELECT * FROM social_links WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ success: true, link });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/links/:id — protected
router.put('/:id', authMiddleware, (req, res) => {
    try {
        const { title, url, icon, sort_order } = req.body;
        const db = getDb();

        const existing = db.prepare('SELECT * FROM social_links WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Link not found.' });

        db.prepare(`
      UPDATE social_links SET
        title = COALESCE(?, title),
        url = COALESCE(?, url),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(title || null, url || null, icon || null, sort_order !== undefined ? sort_order : null, req.params.id);

        const link = db.prepare('SELECT * FROM social_links WHERE id = ?').get(req.params.id);
        res.json({ success: true, link });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/admin/links/:id — protected
router.delete('/:id', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT * FROM social_links WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Link not found.' });

        db.prepare('DELETE FROM social_links WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Link deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/links/reorder — protected
router.put('/reorder/batch', authMiddleware, (req, res) => {
    try {
        const { order } = req.body; // [{id, sort_order}]
        if (!order || !Array.isArray(order)) {
            return res.status(400).json({ error: 'Order array is required.' });
        }

        const db = getDb();
        const updateStmt = db.prepare('UPDATE social_links SET sort_order = ? WHERE id = ?');

        const transaction = db.transaction(() => {
            order.forEach(item => {
                updateStmt.run(item.sort_order, item.id);
            });
        });
        transaction();

        res.json({ success: true, message: 'Links reordered.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
