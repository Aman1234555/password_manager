import request from 'supertest';
import { expect } from 'chai';

process.env.PORT = '0';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.JWT_SECRET = 'test_jwt_secret_change_me';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3306';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'admin@123';
process.env.DB_NAME = 'secure_password_manager_test';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'AdminPass_OnlyForTest123!';
process.env.NODE_ENV = 'test';

const { createApp, ensureAdminUser } = await import('../src/app.js');
const { getPool, initDb } = await import('../src/db.js');

const app = createApp();

export async function initTestApp() {
  await initDb();
  await ensureAdminUser();
  return app;
}

export function getApp() {
  return app;
}

export function createAgent() {
  return request.agent(app);
}

export async function getCsrf(agent) {
  const r = await agent.get('/api/auth/csrf').set('Origin', process.env.CLIENT_ORIGIN);
  expect(r.status).to.equal(200);
  expect(r.body.csrfToken).to.be.ok;
  return r.body.csrfToken;
}

export async function cleanupDb() {
  const pool = getPool();
  await pool.execute('DELETE FROM audit_logs');
  await pool.execute('DELETE FROM vault_items');
  await pool.execute('DELETE FROM users');
}

export async function registerUser(agent, overrides = {}) {
  const csrf = await getCsrf(agent);
  return agent.post('/api/auth/register').set('Origin', process.env.CLIENT_ORIGIN).set('X-CSRF-Token', csrf).send({
    firstName: 'Test',
    lastName: 'User',
    email: `testuser_${Date.now()}@test.local`,
    password: 'TestPass_OnlyForTest123!',
    ...overrides
  });
}

export async function loginUser(agent, email, password) {
  const csrf = await getCsrf(agent);
  return agent.post('/api/auth/login').set('Origin', process.env.CLIENT_ORIGIN).set('X-CSRF-Token', csrf).send({
    email,
    password
  });
}
