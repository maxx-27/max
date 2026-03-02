const { getDb } = require('../database/init');

function analyticsMiddleware(req, res, next) {
    // Only track HTML page requests
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
        try {
            const db = getDb();
            db.prepare(`
        INSERT INTO visits (path, referrer, user_agent, ip) VALUES (?, ?, ?, ?)
      `).run(
                req.path,
                req.headers.referer || null,
                req.headers['user-agent'] || null,
                req.ip
            );
        } catch (err) {
            // Don't let analytics errors break the app
            console.error('Analytics tracking error:', err.message);
        }
    }
    next();
}

module.exports = analyticsMiddleware;
