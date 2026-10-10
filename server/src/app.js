import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';

const INDIAN_PHONE = /^[6-9]\d{9}$/;

export function createApp(db, opts = {}) {
  const secret = opts.jwtSecret || process.env.JWT_SECRET || 'dev-only-secret-change-me';
  const isProd = (opts.env || process.env.NODE_ENV) === 'production';
  const adminPhones = (opts.adminPhones ?? process.env.ADMIN_PHONES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (isProd && secret === 'dev-only-secret-change-me') {
    throw new Error('JWT_SECRET must be set in production');
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // ---------- helpers ----------
  const auth = (roles) => (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Login required' });
    try {
      const user = jwt.verify(token, secret);
      if (roles && !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Not allowed for your role' });
      }
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  const publicPlot = (row, ownerName) => ({
    id: row.id,
    title: row.title,
    state: row.state,
    district: row.district,
    village: row.village,
    surveyNumber: row.survey_number,
    areaAcres: row.area_acres,
    soilType: row.soil_type,
    waterSource: row.water_source,
    crops: JSON.parse(row.crops),
    expectedHarvest: row.expected_harvest,
    expectedQuantityQtl: row.expected_quantity_qtl,
    boundary: JSON.parse(row.boundary),
    center: [row.lat, row.lng],
    verified: !!row.verified,
    ownerName: ownerName ?? null,
    createdAt: row.created_at,
  });

  const validBoundary = (b) =>
    Array.isArray(b) &&
    b.length >= 3 &&
    b.length <= 500 &&
    b.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        Math.abs(p[0]) <= 90 &&
        Math.abs(p[1]) <= 180
    );

  const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  // ---------- auth ----------
  app.post('/api/auth/request-otp', (req, res) => {
    const phone = str(req.body.phone, 15);
    if (!INDIAN_PHONE.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number' });
    }
    const code = String(crypto.randomInt(100000, 1000000));
    db.prepare(
      `INSERT INTO otps (phone, code, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`
    ).run(phone, code, Date.now() + 5 * 60 * 1000);
    // TODO: send via an SMS provider (MSG91 / Twilio). Dev mode returns the code.
    res.json({ ok: true, ...(isProd ? {} : { devOtp: code }) });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const phone = str(req.body.phone, 15);
    const code = str(req.body.otp, 6);
    const otp = db.prepare('SELECT * FROM otps WHERE phone = ?').get(phone);
    if (!otp || otp.code !== code || otp.expires_at < Date.now()) {
      return res.status(400).json({ error: 'Incorrect or expired OTP' });
    }
    db.prepare('DELETE FROM otps WHERE phone = ?').run(phone);

    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
      const requested = req.body.role;
      if (!['farmer', 'buyer'].includes(requested)) {
        return res.status(400).json({ error: 'Choose a role: farmer or buyer' });
      }
      const role = adminPhones.includes(phone) ? 'admin' : requested;
      const info = db
        .prepare('INSERT INTO users (phone, name, role) VALUES (?, ?, ?)')
        .run(phone, str(req.body.name, 80) || null, role);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    }
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, secret, {
      expiresIn: '7d',
    });
    res.json({ token, user: { id: user.id, role: user.role, name: user.name } });
  });

  // ---------- plots ----------
  app.get('/api/plots', (req, res) => {
    const where = [];
    const params = [];
    const crop = str(req.query.crop, 50).toLowerCase();
    if (crop) {
      where.push('p.crops LIKE ?');
      params.push(`%"${crop.replace(/[%_"\\]/g, '')}"%`);
    }
    if (req.query.state) {
      where.push('p.state = ? COLLATE NOCASE');
      params.push(str(req.query.state));
    }
    if (req.query.district) {
      where.push('p.district = ? COLLATE NOCASE');
      params.push(str(req.query.district));
    }
    if (req.query.harvestBefore) {
      where.push('p.expected_harvest <= ?');
      params.push(str(req.query.harvestBefore, 10));
    }
    if (req.query.verified === 'true') where.push('p.verified = 1');

    const rows = db
      .prepare(
        `SELECT p.*, u.name AS owner_name FROM plots p JOIN users u ON u.id = p.owner_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY p.verified DESC, p.created_at DESC LIMIT 200`
      )
      .all(...params);
    res.json(rows.map((r) => publicPlot(r, r.owner_name)));
  });

  app.get('/api/plots/:id', (req, res) => {
    const row = db
      .prepare(
        'SELECT p.*, u.name AS owner_name FROM plots p JOIN users u ON u.id = p.owner_id WHERE p.id = ?'
      )
      .get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Plot not found' });
    res.json(publicPlot(row, row.owner_name));
  });

  app.post('/api/plots', auth(['farmer']), (req, res) => {
    const b = req.body;
    const title = str(b.title, 120);
    const state = str(b.state, 60);
    const district = str(b.district, 60);
    const area = Number(b.areaAcres);
    const crops = Array.isArray(b.crops)
      ? [...new Set(b.crops.map((c) => str(c, 40).toLowerCase()).filter(Boolean))].slice(0, 10)
      : [];
    if (!title || !state || !district) {
      return res.status(400).json({ error: 'Title, state and district are required' });
    }
    if (!(area > 0 && area < 100000)) {
      return res.status(400).json({ error: 'Area (acres) must be a positive number' });
    }
    if (!crops.length) return res.status(400).json({ error: 'Add at least one crop' });
    if (!validBoundary(b.boundary)) {
      return res.status(400).json({ error: 'Draw the plot boundary (at least 3 points)' });
    }
    const harvest = str(b.expectedHarvest, 10) || null;
    if (harvest && !/^\d{4}-\d{2}-\d{2}$/.test(harvest)) {
      return res.status(400).json({ error: 'Harvest date must be YYYY-MM-DD' });
    }
    const qty = b.expectedQuantityQtl === '' || b.expectedQuantityQtl == null ? null : Number(b.expectedQuantityQtl);
    if (qty !== null && !(qty >= 0)) {
      return res.status(400).json({ error: 'Expected quantity must be a number' });
    }

    const lat = b.boundary.reduce((s, p) => s + p[0], 0) / b.boundary.length;
    const lng = b.boundary.reduce((s, p) => s + p[1], 0) / b.boundary.length;
    const info = db
      .prepare(
        `INSERT INTO plots (owner_id, title, state, district, village, survey_number, area_acres,
          soil_type, water_source, crops, expected_harvest, expected_quantity_qtl, boundary, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user.id, title, state, district,
        str(b.village, 80) || null, str(b.surveyNumber, 60) || null, area,
        str(b.soilType, 40) || null, str(b.waterSource, 40) || null,
        JSON.stringify(crops), harvest, qty, JSON.stringify(b.boundary), lat, lng
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  app.get('/api/my/plots', auth(['farmer']), (req, res) => {
    const rows = db
      .prepare('SELECT * FROM plots WHERE owner_id = ? ORDER BY created_at DESC')
      .all(req.user.id);
    res.json(rows.map((r) => publicPlot(r, req.user.name)));
  });

  app.patch('/api/plots/:id/verify', auth(['admin']), (req, res) => {
    const verified = req.body.verified === false ? 0 : 1;
    const info = db.prepare('UPDATE plots SET verified = ? WHERE id = ?').run(verified, Number(req.params.id));
    if (!info.changes) return res.status(404).json({ error: 'Plot not found' });
    res.json({ ok: true, verified: !!verified });
  });

  // ---------- enquiries (owner contact stays private until a buyer enquires) ----------
  app.post('/api/plots/:id/enquiries', auth(['buyer']), (req, res) => {
    const message = str(req.body.message, 1000);
    if (!message) return res.status(400).json({ error: 'Write a message to the farmer' });
    const plot = db.prepare('SELECT id FROM plots WHERE id = ?').get(Number(req.params.id));
    if (!plot) return res.status(404).json({ error: 'Plot not found' });
    db.prepare('INSERT INTO enquiries (plot_id, buyer_id, message) VALUES (?, ?, ?)').run(
      plot.id, req.user.id, message
    );
    res.status(201).json({ ok: true });
  });

  app.get('/api/my/enquiries', auth(['farmer']), (req, res) => {
    const rows = db
      .prepare(
        `SELECT e.id, e.message, e.created_at, p.id AS plot_id, p.title,
                u.name AS buyer_name, u.phone AS buyer_phone
         FROM enquiries e
         JOIN plots p ON p.id = e.plot_id
         JOIN users u ON u.id = e.buyer_id
         WHERE p.owner_id = ? ORDER BY e.created_at DESC`
      )
      .all(req.user.id);
    res.json(
      rows.map((r) => ({
        id: r.id,
        message: r.message,
        createdAt: r.created_at,
        plotId: r.plot_id,
        plotTitle: r.title,
        buyerName: r.buyer_name,
        buyerPhone: r.buyer_phone,
      }))
    );
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}
