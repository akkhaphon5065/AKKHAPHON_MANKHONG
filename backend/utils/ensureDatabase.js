const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function ensureAdminUser() {
  const email = (process.env.ADMIN_EMAIL || 'admin@ocrthaiplus.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Administrator';

  const [rows] = await pool.query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [email]);

  if (rows.length === 0) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users
        (display_name, email, password_hash, role, status, privacy_status, online, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', 'Active', 'accepted', 0, NOW(), NOW())`,
      [name, email, hash]
    );
    console.log(`✅ Admin user created: ${email}`);
  }
}

async function ensureIndexes() {
  // Safe, best-effort indexes. Existing indexes are left untouched if MariaDB reports duplicates.
  const statements = [
    'CREATE INDEX idx_users_email ON users(email)',
    'CREATE INDEX idx_users_role_status ON users(role, status)',
    'CREATE INDEX idx_files_user_id ON files(user_id)',
    'CREATE INDEX idx_ocr_file_id ON ocr_results(file_id)',
    'CREATE INDEX idx_translations_user_id ON translations(user_id)',
    'CREATE INDEX idx_history_user_id_created_at ON usage_history(user_id, created_at)',
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (error) {
      if (!String(error.message).toLowerCase().includes('duplicate')) {
        console.warn('⚠️ Index warning:', error.message);
      }
    }
  }
}

async function ensureDatabase() {
  await ensureIndexes();
  await ensureAdminUser();
}

module.exports = { ensureDatabase };
