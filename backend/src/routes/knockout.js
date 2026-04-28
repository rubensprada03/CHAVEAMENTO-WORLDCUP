import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// Chaveamento clássico Copa do Mundo por grupos:
// Com N grupos, os pares de oitavas são:
//   match 0: 1ºA vs 2ºB
//   match 1: 1ºC vs 2ºD
//   match 2: 1ºE vs 2ºF
//   match 3: 1ºG vs 2ºH
//   match 4: 1ºB vs 2ºA
//   match 5: 1ºD vs 2ºC
//   match 6: 1ºF vs 2ºE
//   match 7: 1ºH vs 2ºG
// Vencedores: match0 vs match1, match2 vs match3, etc.
// Isso garante que A e B não se encontram antes da semi/final.

function buildClassicBracket(groupStandings) {
  // groupStandings: { letter -> [sorted teams...] }
  const letters = Object.keys(groupStandings).sort();
  const n = letters.length;

  // Pair groups: A+B, C+D, E+F, G+H
  const pairs = [];
  for (let i = 0; i < n; i += 2) {
    const gA = letters[i];
    const gB = letters[i + 1];
    if (!gB) {
      // odd group — 1st plays a bye (null)
      pairs.push({ g1: gA, g2: null });
    } else {
      pairs.push({ g1: gA, g2: gB });
    }
  }

  // Build oitavas slots in Copa order:
  // Top half: 1ºA vs 2ºB, 1ºC vs 2ºD, ...
  // Bottom half (mirror): 1ºB vs 2ºA, 1ºD vs 2ºC, ...
  const matches = [];

  // Top half
  for (const { g1, g2 } of pairs) {
    const first  = groupStandings[g1]?.[0] ?? null; // 1º do grupo par
    const second = groupStandings[g2]?.[1] ?? null; // 2º do grupo ímpar
    matches.push({ home: first, away: second });
  }

  // Bottom half (mirror — garante que os campeões dos mesmos pares ficam lados opostos)
  for (const { g1, g2 } of pairs) {
    const first  = groupStandings[g2]?.[0] ?? null;
    const second = groupStandings[g1]?.[1] ?? null;
    matches.push({ home: first, away: second });
  }

  return matches;
}

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

// POST /api/knockout/generate — monta oitavas no estilo clássico Copa do Mundo
router.post('/generate', async (req, res) => {
  const client = await pool.connect();
  try {
    // Buscar classificação por grupo
    const { rows: groups } = await client.query('SELECT * FROM groups ORDER BY sort_order');

    const groupStandings = {};
    for (const group of groups) {
      const { rows } = await client.query(`
        WITH match_results AS (
          SELECT m.home_team_id AS team_id,
            CASE WHEN m.home_score > m.away_score THEN 3
                 WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS pts,
            m.home_score AS gf, m.away_score AS gc
          FROM matches m
          JOIN teams t ON t.id = m.home_team_id
          WHERE t.group_id = $1 AND m.home_score IS NOT NULL
          UNION ALL
          SELECT m.away_team_id,
            CASE WHEN m.away_score > m.home_score THEN 3
                 WHEN m.away_score = m.home_score THEN 1 ELSE 0 END,
            m.away_score, m.home_score
          FROM matches m
          JOIN teams t ON t.id = m.away_team_id
          WHERE t.group_id = $1 AND m.away_score IS NOT NULL
        )
        SELECT t.id, t.name,
          COALESCE(SUM(r.pts),0) AS pts,
          COALESCE(SUM(r.gf),0)-COALESCE(SUM(r.gc),0) AS goal_diff,
          COALESCE(SUM(r.gf),0) AS gf
        FROM teams t
        LEFT JOIN match_results r ON r.team_id = t.id
        WHERE t.group_id = $1
        GROUP BY t.id, t.name
        ORDER BY pts DESC, goal_diff DESC, gf DESC, t.name ASC
      `, [group.id]);
      groupStandings[group.letter] = rows;
    }

    const bracketMatches = buildClassicBracket(groupStandings);

    await client.query('BEGIN');
    // Limpa tudo — chaveamento novo do zero
    await client.query('DELETE FROM knockout_matches');

    for (let i = 0; i < bracketMatches.length; i++) {
      const { home, away } = bracketMatches[i];
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

// PATCH /api/knockout/:id — atualiza placar/times/vencedor e propaga para próxima fase
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { home_score, away_score, home_team_id, away_team_id, winner_id } = req.body;
  const client = await pool.connect();
  try {
    const { rows: [cur] } = await client.query('SELECT * FROM knockout_matches WHERE id = $1', [id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });

    const hs = home_score !== undefined ? (home_score === '' || home_score === null ? null : parseInt(home_score)) : cur.home_score;
    const as_ = away_score !== undefined ? (away_score === '' || away_score === null ? null : parseInt(away_score)) : cur.away_score;
    const ht = home_team_id !== undefined ? (home_team_id || null) : cur.home_team_id;
    const at_ = away_team_id !== undefined ? (away_team_id || null) : cur.away_team_id;

    let winner = winner_id !== undefined ? (winner_id || null) : cur.winner_id;
    // Auto-winner se placar claro, mas winner_id não foi explicitamente passado
    if (hs !== null && as_ !== null && winner_id === undefined) {
      if (hs > as_) winner = ht;
      else if (as_ > hs) winner = at_;
      else winner = cur.winner_id; // empate: mantém o que estava (pênaltis etc)
    }

    await client.query('BEGIN');
    const { rows: [updated] } = await client.query(
      `UPDATE knockout_matches
       SET home_score=$1, away_score=$2, home_team_id=$3, away_team_id=$4, winner_id=$5
       WHERE id=$6 RETURNING *`,
      [hs, as_, ht, at_, winner, id]
    );

    // Propagar vencedor para a próxima fase
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
