import mysql from 'mysql2/promise';

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'secure_password_manager';

let pool = null;

export function getPool() {
  if (!pool) throw new Error('DB pool not initialized. Call initDb() first.');
  return pool;
}

export async function initDb() {
  // Ensure DB exists (connect without database for this step).
  const root = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD
  });
  await root.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await root.end();

  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      connectionLimit: 10,
      namedPlaceholders: true
    });
  }

  // Ensure tables exist.
  await getPool().execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      first_name VARCHAR(80) NOT NULL DEFAULT '',
      last_name VARCHAR(80) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      kdf_salt VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  // Backwards-compatible schema upgrade if table existed before names were added.
  // Note: some MySQL versions don't support "IF NOT EXISTS" for ADD COLUMN; ignore errors.
  await getPool().execute(`ALTER TABLE users ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT ''`).catch(() => {});
  await getPool().execute(`ALTER TABLE users ADD COLUMN last_name VARCHAR(80) NOT NULL DEFAULT ''`).catch(() => {});

  await getPool().execute(`
    CREATE TABLE IF NOT EXISTS vault_items (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(200) NOT NULL,
      alg VARCHAR(32) NOT NULL,
      iv TEXT NOT NULL,
      ciphertext MEDIUMTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_vault_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_vault_user (user_id)
    ) ENGINE=InnoDB;
  `);

  await getPool().execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(64) NULL,
      event_type VARCHAR(64) NOT NULL,
      is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
      ip VARCHAR(64) NULL,
      user_agent TEXT NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_susp (is_suspicious, created_at),
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  await getPool().execute(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_otp_user (user_id),
      INDEX idx_otp_expires (expires_at),
      CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
}

export async function getUserByEmail(email) {
  const [rows] = await getPool().execute(
    `SELECT id, first_name AS firstName, last_name AS lastName, email, password_hash AS passwordHash, role, kdf_salt AS kdfSalt FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function getUserById(id) {
  const [rows] = await getPool().execute(
    `SELECT id, first_name AS firstName, last_name AS lastName, email, password_hash AS passwordHash, role, kdf_salt AS kdfSalt, created_at AS createdAt FROM users WHERE id=? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function createUser({ id, firstName, lastName, email, passwordHash, role, kdfSalt }) {
  await getPool().execute(
    `INSERT INTO users (id, first_name, last_name, email, password_hash, role, kdf_salt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, firstName || '', lastName || '', email, passwordHash, role, kdfSalt]
  );
}

export async function listUsers() {
  const [rows] = await getPool().execute(
    `SELECT id, first_name AS firstName, last_name AS lastName, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC`
  );
  return rows;
}

export async function logAuditEvent({ userId = null, eventType, isSuspicious = false, ip = null, userAgent = null, meta = null }) {
  await getPool().execute(
    `INSERT INTO audit_logs (user_id, event_type, is_suspicious, ip, user_agent, meta_json) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, eventType, Boolean(isSuspicious), ip, userAgent, meta ? JSON.stringify(meta) : null]
  );
}

export async function listAuditForUser(userId, limit = 50) {
  try {
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 50));
    const [rows] = await getPool().execute(
      `SELECT id, event_type AS eventType, is_suspicious AS isSuspicious, ip, user_agent AS userAgent, meta_json AS meta, created_at AS createdAt
       FROM audit_logs
       WHERE user_id=?
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      isSuspicious: Boolean(r.isSuspicious),
      ip: r.ip,
      userAgent: r.userAgent,
      meta: r.meta,
      createdAt: new Date(r.createdAt).toISOString()
    }));
  } catch (error) {
    console.error('DB Error in listAuditForUser:', error);
    throw error;
  }
}

export async function listSuspiciousAudit(limit = 50) {
  try {
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 50));
    const [rows] = await getPool().execute(
      `SELECT id, user_id AS userId, event_type AS eventType, ip, created_at AS createdAt
       FROM audit_logs
       WHERE is_suspicious=1
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      eventType: r.eventType,
      ip: r.ip,
      createdAt: new Date(r.createdAt).toISOString()
    }));
  } catch (error) {
    console.error('DB Error in listSuspiciousAudit:', error);
    throw error;
  }
}

export async function createOtpCode({ id, userId, codeHash, expiresAt }) {
  await getPool().execute(
    `INSERT INTO otp_codes (id, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)`,
    [id, userId, codeHash, expiresAt]
  );
}

export async function getLatestValidOtpByUserId(userId) {
  const [rows] = await getPool().execute(
    `SELECT id, code_hash AS codeHash, expires_at AS expiresAt, used FROM otp_codes
     WHERE user_id=? AND used=FALSE AND expires_at >= NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function markOtpCodeUsed(id) {
  await getPool().execute(`UPDATE otp_codes SET used=TRUE WHERE id=?`, [id]);
}

export async function listVaultItemsByUser(userId) {
  const [rows] = await getPool().execute(
    `SELECT id, name, alg, iv, ciphertext, updated_at AS updatedAt FROM vault_items WHERE user_id=? ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    payload: { alg: r.alg, iv: r.iv, ciphertext: r.ciphertext },
    updatedAt: new Date(r.updatedAt).toISOString()
  }));
}

export async function createVaultItem({ id, userId, name, payload }) {
  await getPool().execute(
    `INSERT INTO vault_items (id, user_id, name, alg, iv, ciphertext) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, name, payload.alg, payload.iv, payload.ciphertext]
  );
}

export async function updateVaultItem({ id, userId, name, payload }) {
  const [r] = await getPool().execute(
    `UPDATE vault_items SET name=?, alg=?, iv=?, ciphertext=? WHERE id=? AND user_id=?`,
    [name, payload.alg, payload.iv, payload.ciphertext, id, userId]
  );
  return r.affectedRows || 0;
}

export async function deleteVaultItem({ id, userId }) {
  const [r] = await getPool().execute(`DELETE FROM vault_items WHERE id=? AND user_id=?`, [id, userId]);
  return r.affectedRows || 0;
}

