import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/index.js';
import groupsRouter from './routes/groups.js';
import matchesRouter from './routes/matches.js';
import standingsRouter from './routes/standings.js';
import settingsRouter from './routes/settings.js';
import knockoutRouter from './routes/knockout.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/groups', groupsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/standings', standingsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/knockout', knockoutRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

initDb()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
