import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getGroups, updateGroupTeams, addGroup, deleteGroup, addTeamToGroup, removeTeamFromGroup } from '../lib/api.js';

function GroupCard({ group, onSave, onDelete, onAddTeam, onRemoveTeam }) {
  const [names, setNames] = useState(group.teams.map(t => t.name));
  const [dirty, setDirty] = useState(false);

  // Sync se o grupo mudar externamente (time adicionado/removido)
  const teamCount = group.teams.length;
  const [prevCount, setPrevCount] = useState(teamCount);
  if (teamCount !== prevCount) {
    setNames(group.teams.map(t => t.name));
    setPrevCount(teamCount);
    setDirty(false);
  }

  const handleChange = (i, val) => {
    const next = [...names]; next[i] = val; setNames(next); setDirty(true);
  };
  const handleSave = () => {
    onSave(group.letter, group.teams.map((t, i) => ({ position: t.position, name: names[i] })));
    setDirty(false);
  };

  return (
    <div className="card">
      <div className="group-header">
        <span className="group-letter-badge">Grupo {group.letter}</span>
        <div className="gap-8">
          {dirty && <button className="btn btn-gold btn-sm" onClick={handleSave}>Salvar</button>}
          <button className="btn btn-red btn-sm" title="Remover grupo"
            onClick={() => { if (confirm(`Remover Grupo ${group.letter} e todos os seus jogos?`)) onDelete(group.letter); }}>
            ✕ Grupo
          </button>
        </div>
      </div>

      {group.teams.map((t, i) => (
        <div className="team-row" key={t.id}>
          <div className="team-num">{i + 1}</div>
          <input
            className="team-input"
            value={names[i] ?? ''}
            onChange={e => handleChange(i, e.target.value)}
            onBlur={dirty ? handleSave : undefined}
            placeholder={`Time ${i + 1}`}
          />
          {group.teams.length > 2 && (
            <button
              className="btn btn-red btn-sm"
              style={{ padding: '3px 8px', fontSize: 13, flexShrink: 0 }}
              title="Remover time"
              onClick={() => { if (confirm(`Remover "${t.name}"? Os jogos desse time serão apagados.`)) onRemoveTeam(group.letter, t.id); }}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button
        className="btn btn-outline-gold btn-sm"
        style={{ width: '100%', marginTop: 10 }}
        onClick={() => onAddTeam(group.letter)}
      >
        + Adicionar time
      </button>
    </div>
  );
}

export default function GroupsPage() {
  const qc = useQueryClient();
  const { data: groups, isLoading, error } = useQuery('groups', getGroups);

  const invalidate = () => { qc.invalidateQueries('groups'); qc.invalidateQueries('matches'); qc.invalidateQueries('standings'); };

  const saveMutation    = useMutation(({ letter, teams }) => updateGroupTeams(letter, teams), { onSuccess: invalidate });
  const addGroupMut     = useMutation(addGroup,                                                { onSuccess: invalidate });
  const deleteGroupMut  = useMutation(deleteGroup,                                             { onSuccess: invalidate });
  const addTeamMut      = useMutation(({ letter }) => addTeamToGroup(letter),                  { onSuccess: invalidate });
  const removeTeamMut   = useMutation(({ letter, id }) => removeTeamFromGroup(letter, id),     { onSuccess: invalidate });

  if (isLoading) return <div className="spinner"><div className="spinner-ring" /></div>;
  if (error) return <div className="error-box">Erro ao carregar grupos.</div>;

  const totalTeams = groups?.reduce((s, g) => s + g.teams.length, 0) || 0;

  return (
    <div>
      <div className="top-bar">
        <div className="top-bar-title">
          {groups?.length} grupos · {totalTeams} times
        </div>
        <div className="gap-8">
          <button className="btn btn-outline-gold" onClick={() => addGroupMut.mutate()} disabled={addGroupMut.isLoading}>
            + Grupo
          </button>
          <button className="btn btn-red" onClick={() => {
            if (confirm('Resetar todos os placares? Grupos e times são mantidos.')) {
              qc.invalidateQueries();
            }
          }}>
            Resetar Placares
          </button>
        </div>
      </div>

      <div className="groups-grid">
        {groups?.map(g => (
          <GroupCard
            key={g.id}
            group={g}
            onSave={(letter, teams) => saveMutation.mutate({ letter, teams })}
            onDelete={letter => deleteGroupMut.mutate(letter)}
            onAddTeam={letter => addTeamMut.mutate({ letter })}
            onRemoveTeam={(letter, id) => removeTeamMut.mutate({ letter, id })}
          />
        ))}
      </div>
    </div>
  );
}
