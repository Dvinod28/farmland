# Farmland Registry

A web-based digital land registry for India. Farmers list their plots (boundary drawn on a map, crops, expected harvest); food-crop buyers search and send enquiries.

## Run locally

Requires Node 22+ (uses the built-in `node:sqlite`).

```bash
# terminal 1 - API on :4000
cd server && npm install && npm start

# terminal 2 - web app on :5173
cd client && npm install && npm run dev
```

Run API tests: `cd server && npm test`

## Configuration (server env vars)

| Var | Purpose |
| --- | --- |
| `JWT_SECRET` | Required in production |
| `ADMIN_PHONES` | Comma-separated phone numbers that sign up as admins (can verify plots) |
| `DB_PATH` | SQLite file path (default `data.db`) |
| `PORT` | API port (default 4000) |

In development the OTP is returned in the API response and shown on screen. Wire a real SMS provider (MSG91 / Twilio) in `server/src/app.js` (`request-otp`) before production.

## Roadmap
- Document upload (7/12, Khasra/Khatauni) and admin verification queue
- Integration with state land-record portals (Bhulekh, Bhoomi, ...)
- Move to PostgreSQL + PostGIS for spatial queries
- Regional language support, mobile-friendly PWA
