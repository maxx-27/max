const { getDb } = require('../database/init');

function analyticsMiddleware(req, res, next) {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.includes('.')) {
        return next();
    }

    const db = getDb();
    db.execute(
        'INSERT INTO visits (path, referrer, user_agent, ip) VALUES (?, ?, ?, ?)',
        [req.path, req.headers.referer || null, req.headers['user-agent'] || null, req.ip || null]
    ).catch(err => console.error('Analytics tracking error:', err));

    next();
}

module.exports = analyticsMiddleware;
