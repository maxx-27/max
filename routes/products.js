const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// Multer config for product images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'public', 'uploads', 'products');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `product-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/products — public, list with optional category filter
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const { category, search, limit } = req.query;

        let query = 'SELECT * FROM products WHERE is_active = 1';
        const params = [];

        if (category && category !== 'All') {
            query += ' AND category = ?';
            params.push(category);
        }

        if (search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';

        if (limit) {
            query += ' LIMIT ?';
            params.push(parseInt(limit));
        }

        const products = db.prepare(query).all(...params);

        // Parse features string to array
        const result = products.map(p => ({
            ...p,
            features: p.features ? p.features.split('|') : []
        }));

        res.json(result);
    } catch (err) {
        console.error('Products fetch error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/products/categories — public
router.get('/categories', (req, res) => {
    try {
        const db = getDb();
        const cats = db.prepare('SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category').all();
        res.json(cats.map(c => c.category));
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/products/:id — public, single product
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(req.params.id);

        if (!product) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        product.features = product.features ? product.features.split('|') : [];
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/admin/products — protected, create product
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
    try {
        const { name, description, price, category, stock, badge_text, features } = req.body;

        if (!name || !price) {
            return res.status(400).json({ error: 'Product name and price are required.' });
        }

        const imagePath = req.file ? `/uploads/products/${req.file.filename}` : null;
        const db = getDb();

        const result = db.prepare(`
      INSERT INTO products (name, description, price, image, category, stock, badge_text, features)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            name,
            description || '',
            parseFloat(price),
            imagePath,
            category || 'General',
            parseInt(stock) || 0,
            badge_text || null,
            features || null
        );

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        product.features = product.features ? product.features.split('|') : [];

        res.status(201).json({ success: true, product });
    } catch (err) {
        console.error('Product create error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/products/:id — protected, update product
router.put('/:id', authMiddleware, upload.single('image'), (req, res) => {
    try {
        const { name, description, price, category, stock, badge_text, features, is_active } = req.body;
        const db = getDb();

        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        const imagePath = req.file ? `/uploads/products/${req.file.filename}` : existing.image;

        db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        image = COALESCE(?, image),
        category = COALESCE(?, category),
        stock = COALESCE(?, stock),
        badge_text = COALESCE(?, badge_text),
        features = COALESCE(?, features),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
            name || null,
            description || null,
            price ? parseFloat(price) : null,
            imagePath,
            category || null,
            stock !== undefined ? parseInt(stock) : null,
            badge_text || null,
            features || null,
            is_active !== undefined ? parseInt(is_active) : null,
            req.params.id
        );

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        product.features = product.features ? product.features.split('|') : [];

        res.json({ success: true, product });
    } catch (err) {
        console.error('Product update error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/admin/products/:id — protected
router.delete('/:id', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        // Soft delete
        db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Product deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
