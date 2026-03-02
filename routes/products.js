const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// GET /api/products — public, list all products
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const { category, search } = req.query;

        let query = 'SELECT * FROM products WHERE is_active = 1';
        const params = [];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        if (search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';
        const result = await db.execute(query, params);

        const products = result.rows.map(p => ({
            ...p,
            features: p.features ? p.features.split('|') : []
        }));

        res.json(products);
    } catch (err) {
        console.error('Products error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
    try {
        const db = getDb();
        const result = await db.execute('SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category');
        res.json(result.rows.map(r => r.category));
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/products/:id — public, single product
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const result = await db.execute('SELECT * FROM products WHERE id = ? AND is_active = 1', [req.params.id]);
        const product = result.rows[0];
        if (!product) return res.status(404).json({ error: 'Product not found.' });

        product.features = product.features ? product.features.split('|') : [];
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/products — protected, create product
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, description, price, category, stock, badge_text, features, image } = req.body;
        if (!name || !price) return res.status(400).json({ error: 'Name and price required.' });

        const featuresStr = Array.isArray(features) ? features.join('|') : (features || '');
        const db = getDb();

        await db.execute(
            'INSERT INTO products (name, description, price, image, category, stock, badge_text, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, description || '', parseFloat(price), image || '', category || 'General', parseInt(stock) || 0, badge_text || '', featuresStr]
        );

        const last = await db.execute('SELECT * FROM products ORDER BY id DESC LIMIT 1');
        res.status(201).json(last.rows[0]);
    } catch (err) {
        console.error('Product create error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/products/:id — protected, update product
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, description, price, category, stock, badge_text, features, image } = req.body;
        const db = getDb();

        const check = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });

        const featuresStr = Array.isArray(features) ? features.join('|') : (features || '');

        await db.execute(
            'UPDATE products SET name = ?, description = ?, price = ?, image = COALESCE(?, image), category = ?, stock = ?, badge_text = ?, features = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, description, parseFloat(price), image || null, category, parseInt(stock), badge_text || '', featuresStr, req.params.id]
        );

        const updated = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
        res.json(updated.rows[0]);
    } catch (err) {
        console.error('Product update error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/products/:id — protected, soft delete
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = getDb();
        await db.execute('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Product deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── Product Account Management (Auto-Delivery) ───

// POST /api/products/:id/accounts — admin adds account to product
router.post('/:id/accounts', authMiddleware, async (req, res) => {
    try {
        const { email, password, invite_link } = req.body;
        if (!email && !invite_link) return res.status(400).json({ error: 'Email or invite link required.' });

        const db = getDb();
        const product = await db.execute('SELECT id FROM products WHERE id = ?', [req.params.id]);
        if (product.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });

        await db.execute(
            'INSERT INTO product_accounts (product_id, email, password, invite_link) VALUES (?, ?, ?, ?)',
            [req.params.id, email || '', password || '', invite_link || '']
        );

        const last = await db.execute('SELECT * FROM product_accounts ORDER BY id DESC LIMIT 1');
        res.status(201).json(last.rows[0]);
    } catch (err) {
        console.error('Account add error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/products/:id/accounts — admin views accounts for a product
router.get('/:id/accounts', authMiddleware, async (req, res) => {
    try {
        const db = getDb();
        const result = await db.execute(
            'SELECT * FROM product_accounts WHERE product_id = ? ORDER BY is_sold ASC, created_at DESC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/products/accounts/:accountId — admin deletes an account
router.delete('/accounts/:accountId', authMiddleware, async (req, res) => {
    try {
        const db = getDb();
        await db.execute('DELETE FROM product_accounts WHERE id = ? AND is_sold = 0', [req.params.accountId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;

