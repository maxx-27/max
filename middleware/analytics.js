const { getDb } = require('../database/init');

// Analytics tracking middleware
function analyticsMiddleware(req, res, next) {
    // Only track page views, not API calls or static files
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.includes('.')) {
        return next();
    }

    // Track async, don't block response
    (async () => {
        try {
            const db = await getDb();
            await db.execute(
                'INSERT INTO visits (path, referrer, user_agent, ip) VALUES (?, ?, ?, ?)',
                [req.path, req.headers.referer || null, req.headers['user-agent'] || null, req.ip || null]
            );
        } catch (err) {
            console.error('Analytics tracking error:', err);
        }
    })();

    next();
}

module.exports = analyticsMiddleware;
