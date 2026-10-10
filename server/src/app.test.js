import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from './app.js';
import { openDb } from './db.js';

let server;
let base;

before(async () => {
  const app = createApp(openDb(':memory:'), { adminPhones: '9000000001' });
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function login(phone, role, name) {
  const { data } = await api('/api/auth/request-otp', { method: 'POST', body: { phone } });
  const r = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone, otp: data.devOtp, role, name },
  });
  return r.data;
}

test('farmer lists a plot, buyer finds it and enquires, contact stays private', async () => {
  const farmer = await login('9000000010', 'farmer', 'Ramu');
  const buyer = await login('9000000020', 'buyer', 'Sita Traders');
  const admin = await login('9000000001', 'buyer', 'Admin');
  assert.equal(admin.user.role, 'admin');

  const plot = {
    title: 'North paddy field',
    state: 'Telangana',
    district: 'Nizamabad',
    areaAcres: 4.5,
    crops: ['Rice', 'rice', 'Maize'],
    expectedHarvest: '2026-12-15',
    boundary: [[18.67, 78.09], [18.671, 78.09], [18.671, 78.091]],
  };

  assert.equal((await api('/api/plots', { method: 'POST', body: plot })).status, 401);
  assert.equal((await api('/api/plots', { method: 'POST', body: plot, token: buyer.token })).status, 403);
  assert.equal(
    (await api('/api/plots', { method: 'POST', body: { ...plot, boundary: [[1, 1]] }, token: farmer.token })).status,
    400
  );

  const created = await api('/api/plots', { method: 'POST', body: plot, token: farmer.token });
  assert.equal(created.status, 201);

  const list = await api('/api/plots?crop=rice&district=nizamabad');
  assert.equal(list.data.length, 1);
  assert.deepEqual(list.data[0].crops, ['rice', 'maize']);
  assert.equal(JSON.stringify(list.data).includes('9000000010'), false);
  assert.equal((await api('/api/plots?crop=wheat')).data.length, 0);

  const id = created.data.id;
  assert.equal((await api(`/api/plots/${id}/verify`, { method: 'PATCH', token: farmer.token })).status, 403);
  assert.equal((await api(`/api/plots/${id}/verify`, { method: 'PATCH', token: admin.token })).status, 200);
  assert.equal((await api(`/api/plots/${id}`)).data.verified, true);

  await api(`/api/plots/${id}/enquiries`, { method: 'POST', body: { message: 'Need 50 quintal' }, token: buyer.token });
  const inbox = await api('/api/my/enquiries', { token: farmer.token });
  assert.equal(inbox.data[0].buyerPhone, '9000000020');
});

test('rejects bad phone numbers and wrong OTPs', async () => {
  assert.equal((await api('/api/auth/request-otp', { method: 'POST', body: { phone: '123' } })).status, 400);
  await api('/api/auth/request-otp', { method: 'POST', body: { phone: '9000000030' } });
  const bad = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone: '9000000030', otp: '000000', role: 'farmer' },
  });
  assert.equal(bad.status, 400);
});
