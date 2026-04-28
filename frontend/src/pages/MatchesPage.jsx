import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getGroups, getMatches, updateMatchScore } from '../lib/api.js';

function MatchRow({ match, onUpdate }) {
  const [home, setHome] = useState(match.home_score ?? '');
  const [away, setAway] = useState(match.away_score ?? '');

  const flush = (h, a) => {
    const hv = h === '' ? null : parseInt(h);
    const av = a === '' ? null : parseInt(a);
    if (hv !== match.home_score || av !== match.away_score) onUpdate(match.id, hv, av);
  };

  return (
    <div className={`match-card ${home !== '' && away !== '' ? 'played' : ''}`}>
      <div className="played-dot" style={{ background: home !== '' && away !== '' ? 'var(--copa-gold)' : 'var(--copa-border-dim)' }} />
      <div className="match-team left">{match.home_team_name}</div>
      <div className="score-wrap">
        <input className="score-input" type="number" min="0" max="99" value={home} placeholder="–"
          onChange={e => setHome(e.target.value)} onBlur={() => flush(home, away)} />
        <span className="score-sep">×</span>
        <input className="score-input" type="number" min="0" max="99" value={away} placeholder="–"
          onChange={e => setAway(e.target.value)} onBlur={() => flush(home, away)} />
      </div>
      <div className="match-team right">{match.away_team_name}</div>
    </div>
  );
}

export default function MatchesPage() {
  const [activeGroup, setActiveGroup] = useState(null);
  const qc = useQueryClient();

  const { data: groups } = useQuery('groups', getGroups, {
    onSuccess: data => { if (!activeGroup && data?.length) setActiveGroup(data[0].letter); }
  });
  const currentGroup = activeGroup || groups?.[0]?.letter;

  const { data: matches, isLoading } = useQuery(
    ['matches', currentGroup], () => getMatches(currentGroup), { enabled: !!currentGroup, keepPreviousData: true }
  );
  const updateMutation = useMutation(({ id, home, away }) => updateMatchScore(id, home, away), {
    onSuccess: () => { qc.invalidateQueries(['matches', currentGroup]); qc.invalidateQueries('standings'); }
  });

  const played = matches?.filter(m => m.played).length ?? 0;
  const total = matches?.length ?? 0;

  return (
    <div>
      <div className="top-bar">
        <div className="top-bar-title">Grupo {currentGroup} — {played}/{total} jogos</div>
      </div>
      <div className="group-tabs">
        {groups?.map(g => (
          <button key={g.letter} className={`group-tab-btn ${g.letter === currentGroup ? 'active' : ''}`}
            onClick={() => setActiveGroup(g.letter)}>
            Grupo {g.letter}
          </button>
        ))}
      </div>
      {isLoading ? <div className="spinner"><div className="spinner-ring" /></div> : (
        matches?.map(m => (
          <MatchRow key={m.id} match={m}
            onUpdate={(id, h, a) => updateMutation.mutate({ id, home: h, away: a })} />
        ))
      )}
    </div>
  );
}
