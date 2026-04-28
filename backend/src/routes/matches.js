import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// GET /api/matches?group=A — matches for a group
router.get('/', async (req, res) => {
  try {
    const { group } = req.query;
    let query = `
      SELECT m.*, 
        ht.name AS home_team_name, at.name AS away_team_name,
        g.letter AS group_letter
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      JOIN groups g ON m.group_id = g.id
    `;
    const params = [];
    if (group) {
      query += ' WHERE g.letter = $1';
      params.push(group.toUpperCase());
    }
    query += ' ORDER BY g.letter, m.id';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/matches/:id — update score
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { home_score, away_score } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE matches SET home_score = $1, away_score = $2
       WHERE id = $3
       RETURNING *`,
      [
        home_score === '' || home_score === null ? null : parseInt(home_score),
        away_score === '' || away_score === null ? null : parseInt(away_score),
        id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Match not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
