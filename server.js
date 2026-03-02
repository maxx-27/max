require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database/init');
const analyticsMiddleware = require('./middleware/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Initialize DB (async) ───
let dbReady = false;
const dbInit = initializeDatabase().then(() => {
    dbReady = true;
    console.log('✅ DB ready');
}).catch(err => {
    console.error('❌ DB init failed:', err);
});

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Wait for DB before handling requests
app.use(async (req, res, next) => {
    if (!dbReady) await dbInit;
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Analytics tracking
app.use(analyticsMiddleware);

// ─── Debug endpoint (TEMPORARY) ───
app.get('/api/debug', async (req, res) => {
    const info = {
        env_TURSO_URL: process.env.TURSO_DATABASE_URL ? 'SET (' + process.env.TURSO_DATABASE_URL.substring(0, 30) + '...)' : 'NOT SET',
        env_TURSO_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'SET (length: ' + process.env.TURSO_AUTH_TOKEN.length + ')' : 'NOT SET',
        env_JWT: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
        env_VERCEL: process.env.VERCEL || 'NOT SET',
        node_version: process.version,
        dbReady: dbReady,
    };
    try {
        const { getDb } = require('./database/init');
        const db = getDb();
        const result = await db.execute('SELECT COUNT(*) as c FROM admins');
        info.db_test = 'OK - admins count: ' + result.rows[0].c;
    } catch (err) {
        info.db_test = 'FAIL: ' + err.message;
        info.db_error_stack = err.stack;
    }
    res.json(info);
});

// ─── API Routes ───
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/products', require('./routes/products'));
app.use('/api/links', require('./routes/links'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/daily-quote', require('./routes/quotes'));
app.use('/api/analytics', require('./routes/analytics'));

// ─── Page Routes (inline HTML read for Vercel compatibility) ───
const fs = require('fs');

function servePage(filePath) {
    return (req, res) => {
        const fullPath = path.join(__dirname, 'public', filePath);
        try {
            const html = fs.readFileSync(fullPath, 'utf8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(html);
        } catch (err) {
            console.error('Page not found:', fullPath, err.message);
            res.status(404).send('Page not found');
        }
    };
}

app.get('/', servePage('index.html'));
app.get('/store', servePage('store.html'));
app.get('/daily', servePage('daily.html'));
app.get('/profile', servePage('profile.html'));
app.get('/admin/login', servePage('admin/login.html'));
app.get('/admin/dashboard', servePage('admin/dashboard.html'));
app.get('/admin/store', servePage('admin/store.html'));
app.get('/admin/profile', servePage('admin/profile.html'));

// ─── 404 Handler ───
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found.' });
    }
    servePage('index.html')(req, res);
});

// ─── Error Handler (Express v5 needs 4 args) ───
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack || err);
    res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start Server (only in non-Vercel environment) ───
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`
  ╔══════════════════════════════════════╗
  ║   🎮 maxs1el Server Running!        ║
  ║   📡 http://localhost:${PORT}           ║
  ║   🔧 Environment: ${process.env.NODE_ENV || 'development'}     ║
  ╚══════════════════════════════════════╝
    `);
    });
}

module.exports = app;
