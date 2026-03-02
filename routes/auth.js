const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const db = getDb();
        const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const validPassword = bcrypt.compareSync(password, admin.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            admin: { id: admin.id, username: admin.username }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const admin = db.prepare('SELECT id, username, created_at FROM admins WHERE id = ?').get(req.admin.id);
        if (!admin) return res.status(404).json({ error: 'Admin not found.' });
        res.json({ admin });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/auth/password
router.put('/password', authMiddleware, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Both current and new password required.' });
        }

        const db = getDb();
        const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);

        if (!bcrypt.compareSync(currentPassword, admin.password)) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashed = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashed, req.admin.id);

        res.json({ success: true, message: 'Password updated.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
