const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

let db;

function getDb() {
  if (!db) {
    if (process.env.TURSO_DATABASE_URL) {
      db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      db = createClient({
        url: 'file:./maxs1el.db',
      });
    }
  }
  return db;
}

async function initializeDatabase() {
  const client = getDb();

  const tables = [
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'maxs1el',
      title TEXT DEFAULT '',
      subtitle TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT '/uploads/default-avatar.png',
      badge_text TEXT DEFAULT '',
      created_since TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT DEFAULT 'Pro',
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS hobbies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT 'link',
      sort_order INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image TEXT,
      category TEXT DEFAULT 'General',
      stock INTEGER DEFAULT 0,
      badge_text TEXT,
      features TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      payment_url TEXT,
      qr_url TEXT,
      status TEXT DEFAULT 'pending',
      buyer_email TEXT,
      buyer_name TEXT,
      tokopay_ref TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS daily_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      author TEXT DEFAULT 'Unknown'
    )`
  ];

  for (const sql of tables) {
    await client.execute(sql);
  }

  // ═══ SEED DATA ═══
  const adminCheck = await client.execute('SELECT id FROM admins WHERE username = ?', ['admin']);
  if (adminCheck.rows.length === 0) {
    const hashed = bcrypt.hashSync('admin123', 10);
    await client.execute('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hashed]);
    console.log('✅ Default admin created (admin / admin123)');
  }

  const profileCheck = await client.execute('SELECT id FROM profile LIMIT 1');
  if (profileCheck.rows.length === 0) {
    await client.execute(
      'INSERT INTO profile (name, title, subtitle, bio, badge_text, created_since) VALUES (?, ?, ?, ?, ?, ?)',
      ['maxs1el', 'SUPPLIER APP PREM & Content Creator', '8-bit Digital Artist',
        'Digital architect crafting experiences in the neon void.',
        'Level 42 Explorer', 'Content Creator since 2021']
    );
    console.log('✅ Default profile created');
  }

  const skillCheck = await client.execute('SELECT COUNT(*) as c FROM skills');
  if (Number(skillCheck.rows[0].c) === 0) {
    await client.execute('INSERT INTO skills (name, level, sort_order) VALUES (?, ?, ?)', ['UI Design', 'Master', 1]);
    await client.execute('INSERT INTO skills (name, level, sort_order) VALUES (?, ?, ?)', ['Animation', 'Pro', 2]);
    console.log('✅ Default skills created');
  }

  const hobbyCheck = await client.execute('SELECT COUNT(*) as c FROM hobbies');
  if (Number(hobbyCheck.rows[0].c) === 0) {
    await client.execute('INSERT INTO hobbies (name, sort_order) VALUES (?, ?)', ['Pixel Art', 1]);
    await client.execute('INSERT INTO hobbies (name, sort_order) VALUES (?, ?)', ['Gaming', 2]);
    await client.execute('INSERT INTO hobbies (name, sort_order) VALUES (?, ?)', ['Coding', 3]);
    console.log('✅ Default hobbies created');
  }

  const linkCheck = await client.execute('SELECT COUNT(*) as c FROM social_links');
  if (Number(linkCheck.rows[0].c) === 0) {
    await client.execute('INSERT INTO social_links (title, url, icon, sort_order) VALUES (?, ?, ?, ?)', ['Instagram', 'https://instagram.com/maxs1el', 'photo_camera', 1]);
    await client.execute('INSERT INTO social_links (title, url, icon, sort_order) VALUES (?, ?, ?, ?)', ['TikTok', 'https://tiktok.com/@maxs1el', 'videocam', 2]);
    await client.execute('INSERT INTO social_links (title, url, icon, sort_order) VALUES (?, ?, ?, ?)', ['Discord Community', 'https://discord.gg/maxs1el', 'chat', 3]);
    await client.execute('INSERT INTO social_links (title, url, icon, sort_order) VALUES (?, ?, ?, ?)', ['Join the Crew', 'https://t.me/maxs1el', 'group', 4]);
    console.log('✅ Default social links created');
  }

  const productCheck = await client.execute('SELECT COUNT(*) as c FROM products');
  if (Number(productCheck.rows[0].c) === 0) {
    await client.execute(
      'INSERT INTO products (name, description, price, image, category, stock, badge_text, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['Netflix Premium', 'Unlock the ultimate cinematic experience.', 15.99, 'https://images.unsplash.com/photo-1574375927938-d5a98e8d6f74?w=400&h=400&fit=crop', 'Streaming', 124, '4K + HDR', '4K + HDR|4 Screens Simultaneously']
    );
    await client.execute(
      'INSERT INTO products (name, description, price, image, category, stock, badge_text, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['Spotify Family', 'Ad-free music streaming.', 12.50, 'https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=400&h=400&fit=crop', 'Music', 89, 'Ad-free', 'Ad-free|Offline|6 Accounts']
    );
    await client.execute(
      'INSERT INTO products (name, description, price, image, category, stock, badge_text, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['YouTube Premium', 'Background play, ad-free videos.', 9.99, 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=400&fit=crop', 'Video', 200, 'Background Play', 'Background Play|Music Included']
    );
    await client.execute(
      'INSERT INTO products (name, description, price, image, category, stock, badge_text, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['Disney+ Annual', 'Access Marvel, Star Wars, Pixar and more.', 79.90, 'https://images.unsplash.com/photo-1640499900704-b00380602aff?w=400&h=400&fit=crop', 'Streaming', 45, '4K', 'Marvel|Star Wars|Pixar|4K']
    );
    console.log('✅ Default products created');
  }

  const quoteCheck = await client.execute('SELECT COUNT(*) as c FROM daily_quotes');
  if (Number(quoteCheck.rows[0].c) === 0) {
    const quotes = [
      ['Code is like humor. When you have to explain it, it is bad.', 'Cory House'],
      ['First, solve the problem. Then, write the code.', 'John Johnson'],
      ['Experience is the name everyone gives to their mistakes.', 'Oscar Wilde'],
      ['The best error message is the one that never shows up.', 'Thomas Fuchs'],
    ];
    for (const [text, author] of quotes) {
      await client.execute('INSERT INTO daily_quotes (text, author) VALUES (?, ?)', [text, author]);
    }
    console.log('✅ Default quotes created');
  }

  console.log('🎮 Database initialized successfully!');
}

module.exports = { getDb, initializeDatabase };
