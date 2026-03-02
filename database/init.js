const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'maxs1el.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();

  // ─── Admins Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Profile Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'maxs1el',
      title TEXT DEFAULT 'SUPPLIER APP PREM & Content Creator',
      subtitle TEXT DEFAULT '8-bit Digital Artist',
      bio TEXT DEFAULT 'Digital architect crafting experiences in the neon void.',
      avatar TEXT DEFAULT '/uploads/default-avatar.png',
      badge_text TEXT DEFAULT 'Level 42 Explorer',
      created_since TEXT DEFAULT 'Content Creator since 2021',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Profile Skills ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT DEFAULT 'Pro',
      sort_order INTEGER DEFAULT 0
    )
  `);

  // ─── Profile Hobbies ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS hobbies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // ─── Social Links Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT 'link',
      sort_order INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Products Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
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
    )
  `);

  // ─── Orders Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // ─── Visits Table ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Daily Quotes Table (fallback) ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      author TEXT DEFAULT 'Unknown'
    )
  `);

  // ═══════════════════════════════
  //  SEED DATA
  // ═══════════════════════════════

  // Seed admin user
  const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
  if (!adminExists) {
    const hashed = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hashed);
    console.log('✅ Default admin created (admin / admin123)');
  }

  // Seed profile
  const profileExists = db.prepare('SELECT id FROM profile LIMIT 1').get();
  if (!profileExists) {
    db.prepare(`
      INSERT INTO profile (name, title, subtitle, bio, badge_text, created_since) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'maxs1el',
      'SUPPLIER APP PREM & Content Creator',
      '8-bit Digital Artist',
      'Digital architect crafting experiences in the neon void. I believe every pixel has a soul and every line of code tells a story.',
      'Level 42 Explorer',
      'Content Creator since 2021'
    );
    console.log('✅ Default profile created');
  }

  // Seed skills
  const skillCount = db.prepare('SELECT COUNT(*) as c FROM skills').get();
  if (skillCount.c === 0) {
    const insertSkill = db.prepare('INSERT INTO skills (name, level, sort_order) VALUES (?, ?, ?)');
    insertSkill.run('UI Design', 'Master', 1);
    insertSkill.run('Animation', 'Pro', 2);
    console.log('✅ Default skills created');
  }

  // Seed hobbies
  const hobbyCount = db.prepare('SELECT COUNT(*) as c FROM hobbies').get();
  if (hobbyCount.c === 0) {
    const insertHobby = db.prepare('INSERT INTO hobbies (name, sort_order) VALUES (?, ?)');
    insertHobby.run('Pixel Art', 1);
    insertHobby.run('Gaming', 2);
    insertHobby.run('Coding', 3);
    console.log('✅ Default hobbies created');
  }

  // Seed social links
  const linkCount = db.prepare('SELECT COUNT(*) as c FROM social_links').get();
  if (linkCount.c === 0) {
    const insertLink = db.prepare('INSERT INTO social_links (title, url, icon, sort_order) VALUES (?, ?, ?, ?)');
    insertLink.run('Instagram', 'https://instagram.com/maxs1el', 'photo_camera', 1);
    insertLink.run('TikTok', 'https://tiktok.com/@maxs1el', 'videocam', 2);
    insertLink.run('Discord Community', 'https://discord.gg/maxs1el', 'chat', 3);
    insertLink.run('Join the Crew', 'https://t.me/maxs1el', 'group', 4);
    console.log('✅ Default social links created');
  }

  // Seed products
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get();
  if (productCount.c === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (name, description, price, image, category, stock, badge_text, features) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertProduct.run('Netflix Premium', 'Unlock the ultimate cinematic experience. High-quality 4K streaming on 4 screens simultaneously. Includes all regions, offline downloads, and no advertisements. Guaranteed premium account with 30-day warranty.', 15.99, '/uploads/products/netflix.png', 'Streaming', 124, '4K + HDR', '4K + HDR|4 Screens Simultaneously');
    insertProduct.run('Spotify Family', 'Ad-free music streaming with offline download capability. Share with up to 6 family members. Enjoy millions of songs and podcasts without interruption.', 12.50, '/uploads/products/spotify.png', 'Music', 89, 'Ad-free', 'Ad-free|Offline|6 Accounts');
    insertProduct.run('YouTube Premium', 'Background play, ad-free videos, and YouTube Music included. Download videos for offline viewing. Enjoy YouTube Originals.', 9.99, '/uploads/products/youtube.png', 'Video', 200, 'Background Play', 'Background Play|Music Included');
    insertProduct.run('Disney+ Annual', 'Access Marvel, Star Wars, Pixar, National Geographic and more in 4K. Annual subscription with massive savings.', 79.90, '/uploads/products/disney.png', 'Streaming', 45, '4K', 'Marvel|Star Wars|Pixar|4K');
    console.log('✅ Default products created');
  }

  // Seed fallback quotes
  const quoteCount = db.prepare('SELECT COUNT(*) as c FROM daily_quotes').get();
  if (quoteCount.c === 0) {
    const insertQuote = db.prepare('INSERT INTO daily_quotes (text, author) VALUES (?, ?)');
    insertQuote.run('Code is like humor. When you have to explain it, it\'s bad.', 'Cory House');
    insertQuote.run('First, solve the problem. Then, write the code.', 'John Johnson');
    insertQuote.run('Experience is the name everyone gives to their mistakes.', 'Oscar Wilde');
    insertQuote.run('The only way to learn a new programming language is by writing programs in it.', 'Dennis Ritchie');
    insertQuote.run('Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday\'s code.', 'Dan Salomon');
    insertQuote.run('Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', 'Martin Fowler');
    insertQuote.run('Programming isn\'t about what you know; it\'s about what you can figure out.', 'Chris Pine');
    insertQuote.run('The best error message is the one that never shows up.', 'Thomas Fuchs');
    console.log('✅ Default quotes created');
  }

  console.log('🎮 Database initialized successfully!');
  return db;
}

module.exports = { getDb, initializeDatabase };
