import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM settings');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/:key
router.put('/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  try {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value)]
    );
    res.json({ key, value: String(value) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
