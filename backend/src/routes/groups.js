import { Router } from 'express';
import { pool, generateGroupMatches } from '../db/index.js';

const router = Router();

// GET /api/groups
router.get('/', async (req, res) => {
  try {
    const { rows: groups } = await pool.query('SELECT * FROM groups ORDER BY sort_order');
    const result = await Promise.all(groups.map(async (g) => {
      const { rows: teams } = await pool.query(
        'SELECT * FROM teams WHERE group_id = $1 ORDER BY position', [g.id]
      );
      return { ...g, teams };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/groups/:letter/teams — update team names
router.put('/:letter/teams', async (req, res) => {
  const { letter } = req.params;
  const { teams } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [group] } = await client.query('SELECT * FROM groups WHERE letter = $1', [letter.toUpperCase()]);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    for (const team of teams) {
      await client.query(
        'UPDATE teams SET name = $1 WHERE group_id = $2 AND position = $3',
        [team.name, group.id, team.position]
      );
    }
    await client.query('COMMIT');
    const { rows: updatedTeams } = await pool.query(
      'SELECT * FROM teams WHERE group_id = $1 ORDER BY position', [group.id]
    );
    res.json({ ...group, teams: updatedTeams });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/groups/:letter/teams — add a team to a group
router.post('/:letter/teams', async (req, res) => {
  const { letter } = req.params;
  const { name } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [group] } = await client.query('SELECT * FROM groups WHERE letter = $1', [letter.toUpperCase()]);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const { rows: existing } = await client.query(
      'SELECT MAX(position) AS maxpos FROM teams WHERE group_id = $1', [group.id]
    );
    const nextPos = (existing[0].maxpos || 0) + 1;
    const teamName = name || `Time ${nextPos}${letter.toUpperCase()}`;

    const { rows: [team] } = await client.query(
      'INSERT INTO teams (name, group_id, position) VALUES ($1, $2, $3) RETURNING *',
      [teamName, group.id, nextPos]
    );

    // Gera os novos jogos do time recém-adicionado contra os outros do grupo
    const { rows: allTeams } = await client.query(
      'SELECT * FROM teams WHERE group_id = $1 AND id != $2 ORDER BY position', [group.id, team.id]
    );
    for (const other of allTeams) {
      await client.query(
        'INSERT INTO matches (group_id, home_team_id, away_team_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [group.id, team.id, other.id]
      );
    }

    await client.query('COMMIT');
    res.json(team);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/groups/:letter/teams/:teamId — remove a team from a group (apaga jogos)
router.delete('/:letter/teams/:teamId', async (req, res) => {
  const { teamId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ON DELETE CASCADE nos matches já cuida dos jogos
    await client.query('DELETE FROM teams WHERE id = $1', [teamId]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/groups — add a new group
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT letter FROM groups ORDER BY sort_order');
    const usedLetters = existing.map(g => g.letter);
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const nextLetter = allLetters.find(l => !usedLetters.includes(l));
    if (!nextLetter) return res.status(400).json({ error: 'Max groups reached' });

    const { rows: [group] } = await client.query(
      'INSERT INTO groups (letter, sort_order) VALUES ($1, $2) RETURNING *',
      [nextLetter, existing.length]
    );
    for (let pos = 1; pos <= 4; pos++) {
      await client.query(
        'INSERT INTO teams (name, group_id, position) VALUES ($1, $2, $3)',
        [`Time ${pos}${nextLetter}`, group.id, pos]
      );
    }
    await generateGroupMatches(client);
    await client.query('COMMIT');

    const { rows: teams } = await pool.query(
      'SELECT * FROM teams WHERE group_id = $1 ORDER BY position', [group.id]
    );
    res.json({ ...group, teams });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/groups/:letter
router.delete('/:letter', async (req, res) => {
  const { letter } = req.params;
  try {
    const { rows: [group] } = await pool.query('SELECT * FROM groups WHERE letter = $1', [letter.toUpperCase()]);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    await pool.query('DELETE FROM groups WHERE id = $1', [group.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/reset
router.post('/reset', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE matches SET home_score = NULL, away_score = NULL');
    await client.query('DELETE FROM knockout_matches');
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
