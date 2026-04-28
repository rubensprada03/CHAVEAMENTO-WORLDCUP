import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// GET /api/knockout
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT km.*,
        ht.name AS home_team_name,
        at.name AS away_team_name,
        wt.name AS winner_name,
        hg.letter AS home_group_letter,
        ag.letter AS away_group_letter
      FROM knockout_matches km
      LEFT JOIN teams ht ON km.home_team_id = ht.id
      LEFT JOIN teams at ON km.away_team_id = at.id
      LEFT JOIN teams wt ON km.winner_id = wt.id
      LEFT JOIN groups hg ON ht.group_id = hg.id
      LEFT JOIN groups ag ON at.group_id = ag.id
      ORDER BY km.round, km.match_index
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/knockout/generate
router.post('/generate', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: settings } = await client.query(
      "SELECT key, value FROM settings WHERE key IN ('qualified_count','classification_mode')"
    );
    const cfg = {};
    settings.forEach(s => { cfg[s.key] = s.value; });
    const topN = parseInt(cfg.qualified_count || 16);
    const mode = cfg.classification_mode || 'A';

    const { rows: allTeams } = await client.query(`
      WITH match_results AS (
        SELECT m.home_team_id AS team_id,
          CASE WHEN m.home_score > m.away_score THEN 3
               WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS pts,
          m.home_score AS gf, m.away_score AS gc
        FROM matches m WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        UNION ALL
        SELECT m.away_team_id,
          CASE WHEN m.away_score > m.home_score THEN 3
               WHEN m.away_score = m.home_score THEN 1 ELSE 0 END,
          m.away_score, m.home_score
        FROM matches m WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
      )
      SELECT t.id, t.name, t.group_id, g.letter AS group_letter,
        COALESCE(SUM(r.pts),0) AS pts,
        COALESCE(SUM(r.gf),0) - COALESCE(SUM(r.gc),0) AS goal_diff,
        COALESCE(SUM(r.gf),0) AS gf,
        RANK() OVER (PARTITION BY t.group_id ORDER BY COALESCE(SUM(r.pts),0) DESC,
          COALESCE(SUM(r.gf),0)-COALESCE(SUM(r.gc),0) DESC,
          COALESCE(SUM(r.gf),0) DESC, t.name ASC) AS group_rank
      FROM teams t
      JOIN groups g ON t.group_id = g.id
      LEFT JOIN match_results r ON r.team_id = t.id
      GROUP BY t.id, t.name, t.group_id, g.letter
      ORDER BY pts DESC, goal_diff DESC, gf DESC, t.name ASC
    `);

    let classified = [];
    if (mode === 'A') {
      const guaranteed = allTeams.filter(t => parseInt(t.group_rank) <= 3);
      const guaranteedIds = new Set(guaranteed.map(t => t.id));
      const rest = allTeams.filter(t => !guaranteedIds.has(t.id));
      const spots = Math.max(0, topN - guaranteed.length);
      classified = [...guaranteed, ...rest.slice(0, spots)];
    } else {
      const guaranteed = allTeams.filter(t => parseInt(t.group_rank) <= 3);
      const guaranteedIds = new Set(guaranteed.map(t => t.id));
      const fourths = allTeams.filter(t => parseInt(t.group_rank) === 4);
      const spots = Math.max(0, topN - guaranteed.length);
      classified = [...guaranteed, ...fourths.slice(0, spots)];
    }

    classified.sort((a, b) =>
      b.pts - a.pts || b.goal_diff - a.goal_diff || b.gf - a.gf || a.name.localeCompare(b.name)
    );

    const half = Math.floor(classified.length / 2);
    const top = classified.slice(0, half);
    const bottom = classified.slice(half).reverse();

    const matches = [];
    for (let i = 0; i < half; i++) {
      let home = top[i];
      let away = bottom[i];
      if (home && away && home.group_id === away.group_id && i + 1 < half) {
        const altAway = bottom[i + 1];
        if (altAway && altAway.group_id !== home.group_id) {
          bottom[i + 1] = away;
          away = altAway;
          bottom[i] = away;
        }
      }
      matches.push({ home, away });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM knockout_matches');

    for (let i = 0; i < matches.length; i++) {
      const { home, away } = matches[i];
      await client.query(
        `INSERT INTO knockout_matches (round, match_index, home_team_id, away_team_id)
         VALUES ('oitavas', $1, $2, $3)`,
        [i, home?.id ?? null, away?.id ?? null]
      );
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT km.*, ht.name AS home_team_name, at.name AS away_team_name,
        hg.letter AS home_group_letter, ag.letter AS away_group_letter
      FROM knockout_matches km
      LEFT JOIN teams ht ON km.home_team_id = ht.id
      LEFT JOIN teams at ON km.away_team_id = at.id
      LEFT JOIN groups hg ON ht.group_id = hg.id
      LEFT JOIN groups ag ON at.group_id = ag.id
      ORDER BY km.round, km.match_index
    `);
    res.json(rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/knockout/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { home_score, away_score, home_team_id, away_team_id, winner_id } = req.body;
  const client = await pool.connect();
  try {
    const { rows: [cur] } = await client.query('SELECT * FROM knockout_matches WHERE id = $1', [id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });

    const hs  = home_score  !== undefined ? (home_score  === '' || home_score  === null ? null : parseInt(home_score))  : cur.home_score;
    const as_ = away_score  !== undefined ? (away_score  === '' || away_score  === null ? null : parseInt(away_score))  : cur.away_score;
    const ht  = home_team_id !== undefined ? (home_team_id || null) : cur.home_team_id;
    const at_ = away_team_id !== undefined ? (away_team_id || null) : cur.away_team_id;

    let winner = winner_id !== undefined ? (winner_id || null) : cur.winner_id;
    if (hs !== null && as_ !== null && winner_id === undefined) {
      if (hs > as_) winner = ht;
      else if (as_ > hs) winner = at_;
      else winner = cur.winner_id;
    }

    await client.query('BEGIN');
    const { rows: [updated] } = await client.query(
      `UPDATE knockout_matches
       SET home_score=$1, away_score=$2, home_team_id=$3, away_team_id=$4, winner_id=$5
       WHERE id=$6 RETURNING *`,
      [hs, as_, ht, at_, winner, id]
    );

    if (winner) {
      const nextRound = { oitavas: 'quartas', quartas: 'semi', semi: 'final' }[updated.round];
      if (nextRound) {
        const nextIndex = Math.floor(updated.match_index / 2);
        const isHome = updated.match_index % 2 === 0;
        await client.query(
          `INSERT INTO knockout_matches (round, match_index) VALUES ($1, $2)
           ON CONFLICT (round, match_index) DO NOTHING`,
          [nextRound, nextIndex]
        );
        const field = isHome ? 'home_team_id' : 'away_team_id';
        await client.query(
          `UPDATE knockout_matches SET ${field}=$1 WHERE round=$2 AND match_index=$3`,
          [winner, nextRound, nextIndex]
        );
      }
    }

    await client.query('COMMIT');
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;