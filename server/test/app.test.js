import { expect } from 'chai';
import request from 'supertest';
import { printResponse, printTestCaseHeader, printTestStep } from './testLogger.js';
import { trackTestResult } from './testSummary.js';

// Set env BEFORE importing anything that uses them.
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

// Now import the app and db.
const { createApp, ensureAdminUser } = await import('../src/app.js');
const { getPool, initDb } = await import('../src/db.js');

describe('RBAC + CSRF + vault flow works', () => {
  let app;
  let userAgent;
  let adminAgent;

  printTestCaseHeader('RBAC + CSRF + vault flow');

  async function getCsrf(agent) {
    const r = await agent.get('/api/auth/csrf');
    expect(r.status).to.equal(200);
    expect(r.body.csrfToken).to.be.ok;
    return r.body.csrfToken;
  }

  before(async () => {
    await initDb();
    await ensureAdminUser();
    app = createApp();
  });

  after(async () => {
    const pool = getPool();
    await pool.execute('DELETE FROM audit_logs');
    await pool.execute('DELETE FROM vault_items');
    await pool.execute('DELETE FROM users');
  });

  it('should handle full RBAC and vault flow', async () => {
    userAgent = request.agent(app);
    adminAgent = request.agent(app);

    // Register user
    printTestStep('Register user');
    const csrf1 = await getCsrf(userAgent);
    let r = await userAgent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrf1)
      .send({
        firstName: 'User',
        lastName: 'One',
        email: 'user1@test.local',
        password: 'UserPass_OnlyForTest123!'
      });
    printResponse('Register response', r);
    expect(r.status).to.equal(201);

    // Login user
    printTestStep('Login user');
    const csrf2 = await getCsrf(userAgent);
    r = await userAgent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf2)
      .send({ email: 'user1@test.local', password: 'UserPass_OnlyForTest123!' });
    printResponse('User login response', r);
    expect(r.status).to.equal(200);

    // User cannot access admin endpoints
    printTestStep('Verify user cannot access admin endpoints');
    r = await userAgent.get('/api/admin/users');
    printResponse('Unauthorized admin access response', r);
    expect(r.status).to.equal(403);

    // Create vault item
    printTestStep('Create vault item');
    const csrf3 = await getCsrf(userAgent);
    r = await userAgent
      .post('/api/vault')
      .set('X-CSRF-Token', csrf3)
      .send({
        name: 'gmail',
        payload: { alg: 'AES-256-GCM', iv: 'iv_b64', ciphertext: 'cipher_b64' }
      });
    printResponse('Create vault item response', r);
    expect(r.status).to.equal(201);
    expect(r.body.id).to.be.ok;

    // List vault
    printTestStep('List vault items');
    r = await userAgent.get('/api/vault');
    printResponse('Vault list response', r);
    expect(r.status).to.equal(200);
    expect(r.body.items).to.have.lengthOf(1);

    // Login admin
    printTestStep('Login admin');
    const csrfA = await getCsrf(adminAgent);
    r = await adminAgent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfA)
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    printResponse('Admin login response', r);
    expect(r.status).to.equal(200);

    // Admin can list users
    printTestStep('Admin list users');
    r = await adminAgent.get('/api/admin/users');
    printResponse('Admin users endpoint response', r);
    expect(r.status).to.equal(200);
    expect(r.body.users).to.be.an('array');
    const userRow = r.body.users.find((u) => u.email === 'user1@test.local');
    expect(userRow).to.be.ok;

    // Admin can fetch user profile
    printTestStep('Admin fetch user profile');
    r = await adminAgent.get(`/api/admin/users/${userRow.id}`);
    printResponse('Admin user profile response', r);
    expect(r.status).to.equal(200);
    expect(r.body.user.email).to.equal('user1@test.local');
    expect(r.body.audit).to.be.an('array');

    // Admin suspicious events endpoint works
    printTestStep('Admin suspicious events');
    r = await adminAgent.get('/api/admin/suspicious');
    printResponse('Admin suspicious events response', r);
    expect(r.status).to.equal(200);
    expect(r.body.events).to.be.an('array');
  });

  afterEach(function () {
    trackTestResult(this.currentTest, 'Functional');
  });
});
