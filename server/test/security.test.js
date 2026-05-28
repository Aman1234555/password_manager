import { expect } from 'chai';
import request from 'supertest';
import { cleanupDb, createAgent, getApp, initTestApp, loginUser, registerUser } from './helpers.js';
import { printResponse, printTestCaseHeader, printTestStep } from './testLogger.js';
import { trackTestResult } from './testSummary.js';

const app = await initTestApp();

describe('Backend security tests', () => {
  printTestCaseHeader('Backend security tests');
  before(async () => {
    await cleanupDb();
    printTestStep('Starting backend security tests');
  });

  after(async () => {
    await cleanupDb();
    printTestStep('Completed backend security tests cleanup');
  });

  it('should expose health endpoint with security headers', async () => {
    printTestStep('Health endpoint security headers');
    const r = await request(app).get('/api/health').set('Origin', process.env.CLIENT_ORIGIN);
    printResponse('Health endpoint response', r);

    expect(r.status).to.equal(200);
    expect(r.body.ok).to.equal(true);
    expect(r.headers['x-frame-options']).to.exist;
    expect(r.headers['x-content-type-options']).to.equal('nosniff');
    expect(r.headers['x-dns-prefetch-control']).to.exist;
    expect(r.headers['access-control-allow-origin']).to.equal(process.env.CLIENT_ORIGIN);
  });

  it('should reject register without CSRF token', async () => {
    printTestStep('Reject register without CSRF token');
    const r = await request(app)
      .post('/api/auth/register')
      .set('Origin', process.env.CLIENT_ORIGIN)
      .send({
        firstName: 'Bad',
        lastName: 'User',
        email: 'baduser@test.local',
        password: 'TestPass_OnlyForTest123!'
      });

    printResponse('Register without CSRF response', r);
    expect(r.status).to.equal(403);
    expect(r.body.error).to.equal('Bad CSRF token');
  });

  it('should require authentication for vault routes', async () => {
    printTestStep('Require authentication for vault routes');
    const r = await request(app).get('/api/vault').set('Origin', process.env.CLIENT_ORIGIN);
    printResponse('Unauthenticated vault access response', r);

    expect(r.status).to.equal(401);
    expect(r.body.error).to.equal('Not authenticated');
  });

  it('should refuse invalid JWT access token', async () => {
    printTestStep('Refuse invalid JWT access token');
    const r = await request(app)
      .get('/api/vault')
      .set('Origin', process.env.CLIENT_ORIGIN)
      .set('Cookie', ['access_token=invalid.jwt.token']);

    printResponse('Invalid JWT access response', r);
    expect(r.status).to.equal(401);
    expect(r.body.error).to.equal('Invalid session');
  });

  it('should enforce admin role for admin endpoints', async () => {
    printTestStep('Enforce admin role for admin endpoints');
    const agent = createAgent();
    const registerResult = await registerUser(agent, { email: 'normaluser@test.local' });
    printResponse('Normal user register response', registerResult);
    expect(registerResult.status).to.equal(201);

    const loginResult = await loginUser(agent, 'normaluser@test.local', 'TestPass_OnlyForTest123!');
    printResponse('Normal user login response', loginResult);
    expect(loginResult.status).to.equal(200);

    const r = await agent.get('/api/admin/users');
    printResponse('Forbidden admin endpoint access response', r);
    expect(r.status).to.equal(403);
    expect(r.body.error).to.equal('Forbidden');
  });

  it('should set secure cookie flags on login', async () => {
    printTestStep('Verify secure cookie flags on login');
    const agent = createAgent();
    const registerResult = await registerUser(agent, { email: 'cookietest@test.local' });
    printResponse('Cookie test register response', registerResult);
    expect(registerResult.status).to.equal(201);

    const loginResult = await loginUser(agent, 'cookietest@test.local', 'TestPass_OnlyForTest123!');
    printResponse('Cookie test login response', loginResult);
    expect(loginResult.status).to.equal(200);
    expect(loginResult.headers['set-cookie']).to.be.an('array');
    expect(loginResult.headers['set-cookie'][0]).to.include('HttpOnly');
  });

  it('should enforce login rate limiting after repeated failures', async () => {
    printTestStep('Enforce login rate limiting');
    const agent = createAgent();
    const email = `rateuser_${Date.now()}@test.local`;

    // Ensure CSRF cookie is loaded for the agent.
    await agent.get('/api/auth/csrf').set('Origin', process.env.CLIENT_ORIGIN);

    let lastResponse;
    for (let i = 1; i <= 11; i += 1) {
      const csrf = await agent.get('/api/auth/csrf').set('Origin', process.env.CLIENT_ORIGIN);
      lastResponse = await agent
        .post('/api/auth/login')
        .set('Origin', process.env.CLIENT_ORIGIN)
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email, password: 'wrong-password' });
    }

    printResponse('Rate limit final response', lastResponse);
    expect(lastResponse.status).to.equal(429);
    expect(lastResponse.body.error).to.include('Too many');
  });

  it('should allow preflight CORS for auth requests', async () => {
    printTestStep('Allow preflight CORS for auth requests');
    const r = await request(app)
      .options('/api/auth/login')
      .set('Origin', process.env.CLIENT_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,X-CSRF-Token');

    printResponse('CORS preflight response', r);

    expect([204, 200]).to.include(r.status);
    expect(r.headers['access-control-allow-origin']).to.equal(process.env.CLIENT_ORIGIN);
  });

  afterEach(function () {
    trackTestResult(this.currentTest, 'Security');
  });
});
