import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-thirty-two-characters';
const { app } = await import('../src/app.js');

async function withServer(run) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('health endpoint reports API readiness', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('protected API routes reject requests without a JWT', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, 'Sign in to continue.');
  });
});

test('login validates malformed input before querying MongoDB', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '' })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, 'Invalid request.');
  });
});

test('signup rejects short passwords and attempts to choose a privileged role', async () => {
  await withServer(async (baseUrl) => {
    const shortPassword = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Staff', email: 'staff@example.com', password: 'short' })
    });
    assert.equal(shortPassword.status, 400);
    assert.equal((await shortPassword.json()).message, 'Invalid request.');

    const elevatedRole = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Staff',
        email: 'staff@example.com',
        password: 'long-enough-password',
        role: 'ADMIN'
      })
    });
    assert.equal(elevatedRole.status, 400);
    assert.equal((await elevatedRole.json()).message, 'Invalid request.');
  });
});
