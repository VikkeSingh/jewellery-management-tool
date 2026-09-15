import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { ensureDb } from './db/seed.js';
import { requireAuth } from './auth/auth.js';

import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import articlesRouter from './routes/articles.js';
import piecesRouter from './routes/pieces.js';
import customersRouter from './routes/customers.js';
import invoicesRouter from './routes/invoices.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Make sure the settings doc / indexes exist before handling any request.
app.use(async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error('Database setup failed:', err);
    res.status(500).json({ error: 'Database is not reachable. Check MONGODB_URI.' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/articles', requireAuth, articlesRouter);
app.use('/api/pieces', requireAuth, piecesRouter);
app.use('/api/customers', requireAuth, customersRouter);
app.use('/api/invoices', requireAuth, invoicesRouter);

export default app;
