const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'maxs1el_secret_key_2024';

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required.' });
        }

        const db = getDb();
        const result = await db.execute('SELECT * FROM admins WHERE username = ?', [username]);
        const admin = result.rows[0];

        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isValid = bcrypt.compareSync(password, admin.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, token, admin: { id: admin.id, username: admin.username } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/auth/me — protected
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const db = getDb();
        const result = await db.execute('SELECT id, username, created_at FROM admins WHERE id = ?', [req.admin.id]);
        const admin = result.rows[0];
        if (!admin) return res.status(404).json({ error: 'Admin not found.' });
        res.json(admin);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/auth/password — protected
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Both passwords required.' });
        }

        const db = getDb();
        const result = await db.execute('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
        const admin = result.rows[0];

        if (!bcrypt.compareSync(currentPassword, admin.password)) {
            return res.status(401).json({ error: 'Current password is wrong.' });
        }

        const hashed = bcrypt.hashSync(newPassword, 10);
        await db.execute('UPDATE admins SET password = ? WHERE id = ?', [hashed, req.admin.id]);

        res.json({ success: true, message: 'Password updated.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
