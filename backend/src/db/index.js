import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        letter VARCHAR(2) UNIQUE NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(group_id, position)
      );

      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        home_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        away_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        home_score INTEGER,
        away_score INTEGER,
        played BOOLEAN GENERATED ALWAYS AS (home_score IS NOT NULL AND away_score IS NOT NULL) STORED,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(home_team_id, away_team_id)
      );

      CREATE TABLE IF NOT EXISTS knockout_matches (
        id SERIAL PRIMARY KEY,
        round VARCHAR(20) NOT NULL,
        match_index INTEGER NOT NULL,
        home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        home_score INTEGER,
        away_score INTEGER,
        winner_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(round, match_index)
      );
    `);

    // Seed settings if empty
    await client.query(`
      INSERT INTO settings (key, value) VALUES ('qualified_count', '16')
      ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('teams_per_group', '4')
      ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('classification_mode', 'A')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Seed default groups A-E if empty
    const { rows } = await client.query('SELECT COUNT(*) FROM groups');
    if (parseInt(rows[0].count) === 0) {
      const letters = ['A', 'B', 'C', 'D', 'E'];
      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i];
        const { rows: [group] } = await client.query(
          'INSERT INTO groups (letter, sort_order) VALUES ($1, $2) RETURNING id',
          [letter, i]
        );
        for (let pos = 1; pos <= 4; pos++) {
          await client.query(
            'INSERT INTO teams (name, group_id, position) VALUES ($1, $2, $3)',
            [`Time ${pos}${letter}`, group.id, pos]
          );
        }
      }
      await generateGroupMatches(client);
    }

    console.log('Database initialized');
  } finally {
    client.release();
  }
}

export async function generateGroupMatches(client) {
  const { rows: groups } = await client.query('SELECT * FROM groups ORDER BY sort_order');
  for (const group of groups) {
    const { rows: teams } = await client.query(
      'SELECT * FROM teams WHERE group_id = $1 ORDER BY position',
      [group.id]
    );
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        await client.query(
          'INSERT INTO matches (group_id, home_team_id, away_team_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [group.id, teams[i].id, teams[j].id]
        );
      }
    }
  }
}
