const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// Multer config for avatar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/profile — public
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const profile = db.prepare('SELECT * FROM profile LIMIT 1').get();
        const skills = db.prepare('SELECT * FROM skills ORDER BY sort_order ASC').all();
        const hobbies = db.prepare('SELECT * FROM hobbies ORDER BY sort_order ASC').all();

        res.json({
            ...profile,
            skills,
            hobbies
        });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/profile — protected
router.put('/', authMiddleware, (req, res) => {
    try {
        const { name, title, subtitle, bio, badge_text, created_since, skills, hobbies } = req.body;
        const db = getDb();

        db.prepare(`
      UPDATE profile SET 
        name = COALESCE(?, name),
        title = COALESCE(?, title),
        subtitle = COALESCE(?, subtitle),
        bio = COALESCE(?, bio),
        badge_text = COALESCE(?, badge_text),
        created_since = COALESCE(?, created_since),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(name, title, subtitle, bio, badge_text, created_since);

        // Update skills if provided
        if (skills && Array.isArray(skills)) {
            db.prepare('DELETE FROM skills').run();
            const insertSkill = db.prepare('INSERT INTO skills (name, level, sort_order) VALUES (?, ?, ?)');
            skills.forEach((skill, idx) => {
                insertSkill.run(skill.name, skill.level || 'Pro', idx + 1);
            });
        }

        // Update hobbies if provided
        if (hobbies && Array.isArray(hobbies)) {
            db.prepare('DELETE FROM hobbies').run();
            const insertHobby = db.prepare('INSERT INTO hobbies (name, sort_order) VALUES (?, ?)');
            hobbies.forEach((hobby, idx) => {
                insertHobby.run(typeof hobby === 'string' ? hobby : hobby.name, idx + 1);
            });
        }

        const updated = db.prepare('SELECT * FROM profile LIMIT 1').get();
        const updatedSkills = db.prepare('SELECT * FROM skills ORDER BY sort_order ASC').all();
        const updatedHobbies = db.prepare('SELECT * FROM hobbies ORDER BY sort_order ASC').all();

        res.json({ success: true, profile: { ...updated, skills: updatedSkills, hobbies: updatedHobbies } });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/admin/profile/avatar — protected
router.post('/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const avatarPath = `/uploads/avatars/${req.file.filename}`;
        const db = getDb();
        db.prepare('UPDATE profile SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(avatarPath);

        res.json({ success: true, avatar: avatarPath });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
