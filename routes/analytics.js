const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');

// POST /api/analytics/visit — public
router.post('/visit', async (req, res) => {
    try {
        const { path } = req.body;
        const db = await getDb();
        await db.execute(
            'INSERT INTO visits (path, referrer, user_agent, ip) VALUES (?, ?, ?, ?)',
            [path || '/', req.headers.referer || null, req.headers['user-agent'] || null, req.ip || null]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/analytics/stats — protected
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();

        const totalResult = await db.execute('SELECT COUNT(*) as total FROM visits');
        const totalVisits = Number(totalResult.rows[0].total);

        const todayResult = await db.execute("SELECT COUNT(*) as total FROM visits WHERE DATE(created_at) = DATE('now')");
        const todayVisits = Number(todayResult.rows[0].total);

        const weekResult = await db.execute("SELECT COUNT(*) as total FROM visits WHERE created_at >= datetime('now', '-7 days')");
        const weekVisits = Number(weekResult.rows[0].total);

        const productsResult = await db.execute('SELECT COUNT(*) as total FROM products WHERE is_active = 1');
        const totalProducts = Number(productsResult.rows[0].total);

        const ordersResult = await db.execute('SELECT COUNT(*) as total FROM orders');
        const totalOrders = Number(ordersResult.rows[0].total);

        const revenueResult = await db.execute("SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid'");
        const revenue = Number(revenueResult.rows[0].total);

        const trafficResult = await db.execute(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM visits WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at) ORDER BY date ASC
    `);
        const weeklyTraffic = trafficResult.rows;

        const linksResult = await db.execute('SELECT title, clicks FROM social_links ORDER BY clicks DESC LIMIT 5');
        const topLinks = linksResult.rows;

        const recentResult = await db.execute('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
        const recentOrders = recentResult.rows;

        const lastWeekResult = await db.execute(
            "SELECT COUNT(*) as total FROM visits WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')"
        );
        const lastWeekVisits = Number(lastWeekResult.rows[0].total);

        const visitGrowth = lastWeekVisits > 0
            ? (((weekVisits - lastWeekVisits) / lastWeekVisits) * 100).toFixed(1)
            : 100;

        res.json({
            totalVisits, todayVisits, weekVisits,
            totalProducts, totalOrders, revenue,
            weeklyTraffic, topLinks, recentOrders,
            visitGrowth: parseFloat(visitGrowth)
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
