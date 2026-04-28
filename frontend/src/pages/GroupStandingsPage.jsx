import { useQuery } from 'react-query';
import { getStandings } from '../lib/api.js';

const GROUP_COLORS = {
  A: { bg: '#E1F5EE', color: '#0F6E56', badge: '#15803D' },
  B: { bg: '#E6F1FB', color: '#185FA5', badge: '#1F4ED8' },
  C: { bg: '#FAECE7', color: '#993C1D', badge: '#C2410C' },
  D: { bg: '#FBEAF0', color: '#993556', badge: '#BE185D' },
  E: { bg: '#EEEDFE', color: '#534AB7', badge: '#6D28D9' },
  F: { bg: '#FEF9C3', color: '#854D0E', badge: '#B45309' },
  G: { bg: '#F0FDF4', color: '#166534', badge: '#15803D' },
  H: { bg: '#FFF1F2', color: '#9F1239', badge: '#BE123C' },
};

function GroupTable({ letter, teams }) {
  const c = GROUP_COLORS[letter] || GROUP_COLORS.A;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        background: c.badge,
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, letterSpacing: '.08em', color: '#FFFFFF' }}>
          Grupo {letter}
        </span>
        <span style={{
          fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700,
          color: 'rgba(255,255,255,0.7)', letterSpacing: '.1em', textTransform: 'uppercase',
          marginLeft: 'auto',
        }}>
          {teams.length} times
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: c.bg }}>
            {['#','Time','J','V','E','D','SG','Pts'].map(h => (
              <th key={h} style={{
                padding: '7px 8px', textAlign: h === 'Time' || h === '#' ? 'left' : 'center',
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 10,
                letterSpacing: '.08em', textTransform: 'uppercase', color: c.color,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            const sg = parseInt(t.goal_diff);
            return (
              <tr key={t.id} style={{
                background: t.classified ? `${c.bg}88` : '#FFFFFF',
                borderTop: '1px solid rgba(0,0,0,0.05)',
              }}>
                <td style={{ padding: '8px', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: t.classified ? c.badge : '#9CA3AF' }}>
                  {i + 1}
                </td>
                <td style={{ padding: '8px', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{t.name}</span>
                    {t.classified && !t.is_wildcard && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: c.badge }}>✓</span>
                    )}
                    {t.is_wildcard && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#1F4ED8' }}>WC</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#6B7280' }}>{t.played}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#6B7280' }}>{t.wins}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#6B7280' }}>{t.draws}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#6B7280' }}>{t.losses}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600,
                  color: sg > 0 ? '#15803D' : sg < 0 ? '#B91C1C' : '#6B7280' }}>
                  {sg > 0 ? '+' : ''}{sg}
                </td>
                <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 18, color: c.badge }}>
                  {t.pts}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function GroupStandingsPage() {
  const { data: standings, isLoading } = useQuery('standings', getStandings, { refetchInterval: 15000 });

  if (isLoading) return <div className="spinner"><div className="spinner-ring" /></div>;

  const groupMap = {};
  standings?.forEach(t => {
    if (!groupMap[t.group_letter]) groupMap[t.group_letter] = [];
    groupMap[t.group_letter].push(t);
  });
  Object.values(groupMap).forEach(teams =>
    teams.sort((a, b) => b.pts - a.pts || b.goal_diff - a.goal_diff || b.gf - a.gf || a.name.localeCompare(b.name))
  );
  const letters = Object.keys(groupMap).sort();

  return (
    <div>
      <div className="top-bar">
        <div className="top-bar-title">Classificação por Grupos</div>
        <div style={{ fontSize: 12, color: 'var(--copa-gray)' }}>
          ✓ classificado direto &nbsp;·&nbsp; <span style={{ color: '#1F4ED8' }}>WC</span> wildcard
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {letters.map(letter => (
          <GroupTable key={letter} letter={letter} teams={groupMap[letter]} />
        ))}
      </div>
    </div>
  );
}