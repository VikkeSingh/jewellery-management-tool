# Jewellery Shop — Inventory & GST Billing

Tracks jewellery stock (by design/article and individual pieces) and
generates GST tax invoices on sale. Runs on Vercel with MongoDB Atlas as
the database, protected by a username/password login.

## Architecture

- `client/` — React (Vite) frontend
- `server/` — Express API (`server/app.js` is the shared app; `server/index.js` runs it locally with `app.listen`)
- `api/index.js` — thin wrapper that exposes `server/app.js` as a Vercel serverless function
- `vercel.json` — tells Vercel to build the client as static output and route `/api/*` to the function
- MongoDB Atlas — all data (articles, stock pieces, customers, invoices, settings)

## One-time setup

### 1. MongoDB Atlas

Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas) (or use an existing one).
Under **Database Access**, create a user with a strong password. Under
**Network Access**, allow access from anywhere (`0.0.0.0/0`) since Vercel's
serverless functions don't have fixed IPs. Get the connection string from
**Connect → Drivers** — it looks like:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

### 2. Local environment file

```
cp .env.example .env
```

Fill in `.env`:
- `MONGODB_URI` — the connection string above
- `APP_USERNAME` — the login username
- `APP_PASSWORD_HASH` — run `npm run hash-password`, type your chosen password when prompted, and paste the printed hash here. The real password is never stored or shown again.
- `JWT_SECRET` — any long random string, e.g. generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- The `SEED_*` values pre-fill the shop's Settings page the first time the app runs against an empty database (shop name, address, GSTIN, starting gold/silver rate, etc.) — you can also just fill these in from the Settings page after logging in, they don't need to be perfect here.

### 3. Install dependencies

```
npm run setup
```

### 4. Run locally

```
npm run dev
```

Frontend: http://localhost:5173 (proxies API calls to the server)
API only: http://localhost:4000

Or, to test the production build locally in one process:

```
npm start
```

then open http://localhost:4000.

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In Vercel, **Add New Project** → import the GitHub repo. Vercel will read `vercel.json` automatically.
3. Before the first deploy, add these **Environment Variables** in the Vercel project settings (Settings → Environment Variables), for both Production and Preview:
   - `MONGODB_URI`
   - `MONGODB_DB_NAME` (optional, defaults to `jewellery_shop`)
   - `APP_USERNAME`
   - `APP_PASSWORD_HASH`
   - `JWT_SECRET`
   - `NODE_ENV` = `production`
   - Optionally the `SEED_*` variables, to pre-fill shop details on first run.
4. Deploy. Vercel will run `npm install` (root + client), build the client, and deploy `api/index.js` as the serverless API.
5. Open the deployed URL, log in with the username/password you set, and go to **Settings** to double-check the shop details, then start adding inventory.

## Using the app

1. **Settings** — shop name, address, GSTIN, state (this decides CGST/SGST vs IGST on invoices), and today's gold/silver rate per gram.
2. **Inventory → New Article** — a jewellery design (name, purity, HSN code, GST rate, making-charge rule).
3. Open the article → **Add Stock** for each physical piece, with its own weight and HUID/hallmark number if any. Quantity updates automatically.
4. **New Sale** — pick a customer, add in-stock pieces, adjust rates/charges if needed, and **Generate GST Invoice**. Print or save as PDF from the browser's print dialog. The sold piece leaves stock automatically.
5. **Invoices** — full history; cancel an invoice to return its piece to stock (kept on record for GST audit).

## Notes on GST

Each item's taxable value = (net weight × gold/silver rate per gram) +
making charge + stone charge, then GST is split into CGST + SGST (same
state as the shop) or IGST (different state), using the GST rate set per
article. Making-charge tax treatment for jewellery has some nuance in
practice — check the exact rate treatment with your CA; the rate is fully
editable per article and per invoice line if needed.

## Security notes

- Login uses a single username/password (set via environment variables), issuing a signed, httpOnly session cookie — there's no separate user database to manage for a single-counter shop.
- Never commit `.env` — it's git-ignored. Secrets live only in Vercel's environment variables and your local `.env`.
- To change the password later, regenerate a hash with `npm run hash-password` and update `APP_PASSWORD_HASH` in Vercel.
