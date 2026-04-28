import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getStandings, getSettings, updateSetting } from '../lib/api.js';

const MODE_LABELS = {
  A: 'Modo A — Até 3 por grupo garantidos + wildcards pelo ranking geral',
  B: 'Modo B — Até 3 por grupo garantidos, só 4ºs disputam as vagas restantes',
};

const MODE_DESCRIPTIONS = {
  A: 'Passam no máximo 3 por grupo (grupos menores passam todos, mas nunca mais de 3). As vagas restantes para completar o total vão para os melhores times não classificados no ranking geral — pode ser qualquer posição.',
  B: 'Passam no máximo 3 por grupo. As vagas restantes são disputadas apenas entre os 4º colocados — o melhor 4º pelo ranking geral entra. Grupos com menos de 4 times não geram candidatos para essas vagas.',
};

export default function StandingsPage() {
  const qc = useQueryClient();
  const { data: standings, isLoading } = useQuery('standings', getStandings, { refetchInterval: 15000 });
  const { data: settings } = useQuery('settings', getSettings);

  const settingMut = useMutation(({ key, value }) => updateSetting(key, value), {
    onSuccess: () => { qc.invalidateQueries('settings'); qc.invalidateQueries('standings'); },
  });

  const qualified = parseInt(settings?.qualified_count || 16);
  const mode = settings?.classification_mode || 'A';

  if (isLoading) return <div className="spinner"><div className="spinner-ring" /></div>;

  const totalPlayed = Math.floor(standings?.reduce((s, x) => s + parseInt(x.played), 0) / 2 || 0);
  const totalGoals  = Math.floor(standings?.reduce((s, x) => s + parseInt(x.gf), 0) / 2 || 0);

  return (
    <div>
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Times</div>
          <div className="stat-value">{standings?.length ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Jogos realizados</div>
          <div className="stat-value">{totalPlayed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Gols marcados</div>
          <div className="stat-value">{totalGoals}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Classificados (total)</div>
          <div className="stat-value">
            <input
              type="number" min="1" max={standings?.length || 32}
              value={qualified}
              style={{ width: 56, fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--copa-gold)', background: 'transparent', border: 'none' }}
              onChange={e => settingMut.mutate({ key: 'qualified_count', value: e.target.value })}
            />
            <span style={{ fontSize: 13, color: 'var(--copa-gray)', marginLeft: 2 }}>/ {standings?.length}</span>
          </div>
        </div>
      </div>

      {/* Modo de classificação */}
      <div style={{
        background: 'var(--copa-card)', border: '1px solid var(--copa-border)',
        borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--copa-gray)', marginBottom: 6 }}>
              Modo de Classificação
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['A', 'B'].map(m => (
                <button
                  key={m}
                  className={`btn ${mode === m ? 'btn-gold' : 'btn-outline-gold'}`}
                  onClick={() => settingMut.mutate({ key: 'classification_mode', value: m })}
                >
                  Modo {m}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 2, minWidth: 240, fontSize: 12, color: 'var(--copa-gray)', lineHeight: 1.5, paddingTop: 2 }}>
            <strong style={{ color: 'var(--copa-gold)', fontFamily: 'Barlow Condensed', fontSize: 13 }}>{MODE_LABELS[mode]}</strong>
            <br />{MODE_DESCRIPTIONS[mode]}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        <table className="ranking-table">
          <thead>
            <tr>
              <th>#</th><th>Time</th><th>Gr</th><th>Pos</th>
              <th>J</th><th>V</th><th>E</th><th>D</th>
              <th>GF</th><th>GC</th><th>SG</th><th>Pts</th><th></th>
            </tr>
          </thead>
          <tbody>
            {standings?.map((s, i) => {
              const sg = parseInt(s.goal_diff);
              return (
                <tr key={s.id} className={s.classified ? 'classified' : ''}>
                  <td><span className={`rank-num ${s.classified ? 'top' : ''}`}>{i + 1}</span></td>
                  <td className="rank-name">{s.name}</td>
                  <td><span className="rank-group">{s.group_letter}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--copa-gray)' }}>{s.group_rank}º</td>
                  <td>{s.played}</td><td>{s.wins}</td><td>{s.draws}</td><td>{s.losses}</td>
                  <td>{s.gf}</td><td>{s.gc}</td>
                  <td className={sg > 0 ? 'sg-pos' : sg < 0 ? 'sg-neg' : ''}>{sg > 0 ? '+' : ''}{sg}</td>
                  <td className="rank-pts">{s.pts}</td>
                  <td>
                    {s.classified && !s.is_wildcard && (
                      <span className="classified-tag">✓ top 3</span>
                    )}
                    {s.is_wildcard && (
                      <span className="classified-tag" style={{ color: 'var(--copa-blue)' }}>✓ wildcard</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
