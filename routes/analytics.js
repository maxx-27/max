const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// POST /api/track/visit — public, track page visit
router.post('/visit', (req, res) => {
    try {
        const { path } = req.body;
        const db = getDb();
        db.prepare('INSERT INTO visits (path, referrer, user_agent, ip) VALUES (?, ?, ?, ?)').run(
            path || '/',
            req.headers.referer || null,
            req.headers['user-agent'] || null,
            req.ip
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/stats — protected, dashboard stats
router.get('/stats', authMiddleware, (req, res) => {
    try {
        const db = getDb();

        // Total visitors (all time)
        const totalVisits = db.prepare('SELECT COUNT(*) as total FROM visits').get().total;

        // Visitors today
        const todayVisits = db.prepare(
            "SELECT COUNT(*) as total FROM visits WHERE DATE(created_at) = DATE('now')"
        ).get().total;

        // Visitors this week
        const weekVisits = db.prepare(
            "SELECT COUNT(*) as total FROM visits WHERE created_at >= datetime('now', '-7 days')"
        ).get().total;

        // Total products
        const totalProducts = db.prepare('SELECT COUNT(*) as total FROM products WHERE is_active = 1').get().total;

        // Total orders
        const totalOrders = db.prepare('SELECT COUNT(*) as total FROM orders').get().total;

        // Revenue (paid orders)
        const revenue = db.prepare(
            "SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid'"
        ).get().total;

        // Weekly traffic data (last 7 days)
        const weeklyTraffic = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM visits 
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all();

        // Top clicked links
        const topLinks = db.prepare(
            'SELECT title, clicks FROM social_links ORDER BY clicks DESC LIMIT 5'
        ).all();

        // Recent orders
        const recentOrders = db.prepare(
            'SELECT * FROM orders ORDER BY created_at DESC LIMIT 5'
        ).all();

        // Growth percentage (compare this week to last week)
        const lastWeekVisits = db.prepare(
            "SELECT COUNT(*) as total FROM visits WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')"
        ).get().total;

        const visitGrowth = lastWeekVisits > 0
            ? (((weekVisits - lastWeekVisits) / lastWeekVisits) * 100).toFixed(1)
            : 100;

        res.json({
            totalVisits,
            todayVisits,
            weekVisits,
            totalProducts,
            totalOrders,
            revenue,
            weeklyTraffic,
            topLinks,
            recentOrders,
            visitGrowth: parseFloat(visitGrowth)
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
