import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// SQL base para calcular stats de todos os times
const STATS_CTE = `
  WITH match_results AS (
    SELECT m.home_team_id AS team_id,
      CASE WHEN m.home_score > m.away_score THEN 3
           WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS pts,
      CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS wins,
      CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS draws,
      CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS losses,
      m.home_score AS gf, m.away_score AS gc, 1 AS played
    FROM matches m WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
    UNION ALL
    SELECT m.away_team_id,
      CASE WHEN m.away_score > m.home_score THEN 3
           WHEN m.away_score = m.home_score THEN 1 ELSE 0 END,
      CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END,
      CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END,
      CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END,
      m.away_score, m.home_score, 1
    FROM matches m WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
  ),
  team_stats AS (
    SELECT t.id, t.name, t.group_id, t.position AS group_position,
      g.letter AS group_letter,
      COALESCE(SUM(r.played),0)::int AS played,
      COALESCE(SUM(r.wins),0)::int AS wins,
      COALESCE(SUM(r.draws),0)::int AS draws,
      COALESCE(SUM(r.losses),0)::int AS losses,
      COALESCE(SUM(r.gf),0)::int AS gf,
      COALESCE(SUM(r.gc),0)::int AS gc,
      (COALESCE(SUM(r.gf),0) - COALESCE(SUM(r.gc),0))::int AS goal_diff,
      COALESCE(SUM(r.pts),0)::int AS pts
    FROM teams t
    JOIN groups g ON t.group_id = g.id
    LEFT JOIN match_results r ON r.team_id = t.id
    GROUP BY t.id, t.name, t.group_id, t.position, g.letter
  ),
  group_ranked AS (
    SELECT *,
      RANK() OVER (PARTITION BY group_id ORDER BY pts DESC, goal_diff DESC, gf DESC, name ASC)::int AS group_rank
    FROM team_stats
  )
`;

// Calcula classificados no Node com lógica dos dois modos
async function calcClassified(mode, topN) {
  const { rows: teams } = await pool.query(STATS_CTE + `
    SELECT * FROM group_ranked
    ORDER BY group_letter, group_rank
  `);

  if (mode === 'A') {
    // Modo A: Top 3 de cada grupo passam garantidos (mesmo que grupo tenha menos de 4)
    // O restante para completar topN vem do ranking geral dos não classificados
    const guaranteed = teams.filter(t => t.group_rank <= 3);
    const guaranteedIds = new Set(guaranteed.map(t => t.id));
    const rest = teams
      .filter(t => !guaranteedIds.has(t.id))
      .sort((a, b) => b.pts - a.pts || b.goal_diff - a.goal_diff || b.gf - a.gf || a.name.localeCompare(b.name));

    const spots = Math.max(0, topN - guaranteed.length);
    const wildcards = rest.slice(0, spots);
    const classifiedIds = new Set([...guaranteed.map(t => t.id), ...wildcards.map(t => t.id)]);
    return { classifiedIds, wildcardIds: new Set(wildcards.map(t => t.id)) };
  } else {
    // Modo B: Top 3 de cada grupo classificam, MAS as vagas de grupos com < 4 times
    // ficam abertas para o melhor 4º colocado geral
    const guaranteed = teams.filter(t => t.group_rank <= 3);
    const guaranteedIds = new Set(guaranteed.map(t => t.id));

    // 4º colocados de cada grupo (ou times além do 3º)
    const fourths = teams
      .filter(t => t.group_rank === 4)
      .sort((a, b) => b.pts - a.pts || b.goal_diff - a.goal_diff || b.gf - a.gf || a.name.localeCompare(b.name));

    // Vagas restantes para completar topN
    const spots = Math.max(0, topN - guaranteed.length);
    const wildcards = fourths.slice(0, spots);
    const classifiedIds = new Set([...guaranteed.map(t => t.id), ...wildcards.map(t => t.id)]);
    return { classifiedIds, wildcardIds: new Set(wildcards.map(t => t.id)) };
  }
}

// GET /api/standings
router.get('/', async (req, res) => {
  try {
    const { rows: settings } = await pool.query('SELECT key, value FROM settings WHERE key IN ($1,$2,$3)',
      ['qualified_count', 'classification_mode', 'guaranteed_per_group']);
    const cfg = {};
    settings.forEach(s => { cfg[s.key] = s.value; });
    const topN = parseInt(cfg.qualified_count || 16);
    const mode = cfg.classification_mode || 'A';

    const { rows } = await pool.query(STATS_CTE + `
      SELECT * FROM group_ranked
      ORDER BY pts DESC, goal_diff DESC, gf DESC, name ASC
    `);

    const { classifiedIds, wildcardIds } = await calcClassified(mode, topN);

    const result = rows.map(t => ({
      ...t,
      classified: classifiedIds.has(t.id),
      is_wildcard: wildcardIds.has(t.id),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/standings/group/:letter
router.get('/group/:letter', async (req, res) => {
  const { letter } = req.params;
  try {
    const { rows } = await pool.query(`
      WITH match_results AS (
        SELECT m.home_team_id AS team_id,
          CASE WHEN m.home_score > m.away_score THEN 3 WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS pts,
          CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS wins,
          CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS draws,
          CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS losses,
          m.home_score AS gf, m.away_score AS gc, 1 AS played
        FROM matches m JOIN groups g ON m.group_id = g.id
        WHERE g.letter = $1 AND m.home_score IS NOT NULL
        UNION ALL
        SELECT m.away_team_id,
          CASE WHEN m.away_score > m.home_score THEN 3 WHEN m.away_score = m.home_score THEN 1 ELSE 0 END,
          CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END,
          CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END,
          CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END,
          m.away_score, m.home_score, 1
        FROM matches m JOIN groups g ON m.group_id = g.id
        WHERE g.letter = $1 AND m.away_score IS NOT NULL
      )
      SELECT t.id, t.name,
        COALESCE(SUM(r.played),0) AS played, COALESCE(SUM(r.wins),0) AS wins,
        COALESCE(SUM(r.draws),0) AS draws, COALESCE(SUM(r.losses),0) AS losses,
        COALESCE(SUM(r.gf),0) AS gf, COALESCE(SUM(r.gc),0) AS gc,
        COALESCE(SUM(r.gf),0)-COALESCE(SUM(r.gc),0) AS goal_diff,
        COALESCE(SUM(r.pts),0) AS pts
      FROM teams t JOIN groups g ON t.group_id = g.id
      LEFT JOIN match_results r ON r.team_id = t.id
      WHERE g.letter = $1
      GROUP BY t.id, t.name
      ORDER BY pts DESC, goal_diff DESC, gf DESC, t.name ASC
    `, [letter.toUpperCase()]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
