require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database/init');
const analyticsMiddleware = require('./middleware/analytics');

// Initialize database & seed data
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Analytics tracking
app.use(analyticsMiddleware);

// ─── API Routes ───
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/products', require('./routes/products'));
app.use('/api/links', require('./routes/links'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/daily-quote', require('./routes/quotes'));
app.use('/api/analytics', require('./routes/analytics'));

// ─── Page Routes ───
const servePage = (filePath) => (req, res) => {
    res.sendFile(path.join(__dirname, 'public', filePath));
};

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
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start Server ───
app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║   🎮 maxs1el Server Running!        ║
  ║   📡 http://localhost:${PORT}           ║
  ║   🔧 Environment: ${process.env.NODE_ENV || 'development'}     ║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;
