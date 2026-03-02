const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// GET /api/profile — public
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const profileResult = await db.execute('SELECT * FROM profile LIMIT 1');
        const profile = profileResult.rows[0];

        if (!profile) return res.status(404).json({ error: 'Profile not found.' });

        const skillsResult = await db.execute('SELECT * FROM skills ORDER BY sort_order ASC');
        const hobbiesResult = await db.execute('SELECT * FROM hobbies ORDER BY sort_order ASC');

        res.json({
            ...profile,
            skills: skillsResult.rows,
            hobbies: hobbiesResult.rows
        });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/profile — protected
router.put('/', authMiddleware, async (req, res) => {
    try {
        const { name, title, subtitle, bio, badge_text, created_since, skills, hobbies } = req.body;
        const db = getDb();

        await db.execute(
            'UPDATE profile SET name = ?, title = ?, subtitle = ?, bio = ?, badge_text = ?, created_since = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
            [name, title, subtitle, bio, badge_text, created_since]
        );

        // Update skills
        if (skills && Array.isArray(skills)) {
            await db.execute('DELETE FROM skills');
            for (let i = 0; i < skills.length; i++) {
                await db.execute('INSERT INTO skills (name, level, sort_order) VALUES (?, ?, ?)',
                    [skills[i].name, skills[i].level || 'Pro', i + 1]);
            }
        }

        // Update hobbies
        if (hobbies && Array.isArray(hobbies)) {
            await db.execute('DELETE FROM hobbies');
            for (let i = 0; i < hobbies.length; i++) {
                const hobbyName = typeof hobbies[i] === 'string' ? hobbies[i] : hobbies[i].name;
                await db.execute('INSERT INTO hobbies (name, sort_order) VALUES (?, ?)', [hobbyName, i + 1]);
            }
        }

        res.json({ success: true, message: 'Profile updated.' });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/profile/avatar — protected, accept URL
router.post('/avatar', authMiddleware, async (req, res) => {
    try {
        const { avatar_url } = req.body;
        if (!avatar_url) return res.status(400).json({ error: 'Avatar URL required.' });

        const db = getDb();
        await db.execute('UPDATE profile SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [avatar_url]);

        res.json({ success: true, avatar: avatar_url });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
