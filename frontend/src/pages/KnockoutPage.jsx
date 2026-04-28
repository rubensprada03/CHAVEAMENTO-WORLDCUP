import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getKnockout, generateKnockout, updateKnockoutMatch, getGroups } from '../lib/api.js';

const ROUNDS = [
  { key: 'oitavas',  label: 'Oitavas de Final',  shortLabel: 'Oitavas'  },
  { key: 'quartas',  label: 'Quartas de Final',   shortLabel: 'Quartas'  },
  { key: 'semi',     label: 'Semifinal',          shortLabel: 'Semi'     },
  { key: 'final',    label: 'Final',              shortLabel: 'Final'    },
];

// Quantos jogos esperados por fase dado N de oitavas
function expectedMatches(round, oitavasCount) {
  if (round === 'oitavas') return oitavasCount;
  if (round === 'quartas') return Math.ceil(oitavasCount / 2);
  if (round === 'semi')    return Math.ceil(oitavasCount / 4);
  if (round === 'final')   return 1;
  return 0;
}

// ── Modal de edição ──────────────────────────────────────────────────────────
function EditModal({ match, allTeams, onSave, onClose }) {
  const [hs, setHs] = useState(match.home_score ?? '');
  const [as_, setAs] = useState(match.away_score ?? '');
  const [ht, setHt] = useState(match.home_team_id ?? '');
  const [at, setAt] = useState(match.away_team_id ?? '');
  const [winner, setWinner] = useState(match.winner_id ?? '');

  const homeName = allTeams.find(t => String(t.id) === String(ht))?.name || 'Casa';
  const awayName = allTeams.find(t => String(t.id) === String(at))?.name || 'Visitante';
  const bothScored = hs !== '' && as_ !== '';

  const handleSave = () => {
    onSave({
      home_score:   hs  === '' ? null : parseInt(hs),
      away_score:   as_ === '' ? null : parseInt(as_),
      home_team_id: ht  || null,
      away_team_id: at  || null,
      winner_id:    winner || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-title">Editar Jogo</div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          {[['Casa', ht, setHt], ['Visitante', at, setAt]].map(([label, val, set]) => (
            <div className="modal-row" key={label}>
              <span className="modal-label">{label}</span>
              <select className="modal-select" value={val} onChange={e => set(e.target.value)}>
                <option value="">— selecionar —</option>
                {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--copa-border-dim)', paddingTop: 14, marginBottom: 14 }}>
          <div className="modal-row">
            <span className="modal-label">Placar</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="modal-score-input" type="number" min="0" max="99" placeholder="–"
                value={hs} onChange={e => setHs(e.target.value)} />
              <span style={{ color: 'var(--copa-gray)', fontFamily: 'Bebas Neue', fontSize: 22 }}>×</span>
              <input className="modal-score-input" type="number" min="0" max="99" placeholder="–"
                value={as_} onChange={e => setAs(e.target.value)} />
            </div>
          </div>
        </div>

        {bothScored && (
          <div className="modal-row" style={{ marginBottom: 14 }}>
            <span className="modal-label">Vencedor</span>
            <select className="modal-select" value={winner} onChange={e => setWinner(e.target.value)}>
              <option value="">— empate / pênaltis —</option>
              {ht && <option value={ht}>{homeName}</option>}
              {at && <option value={at}>{awayName}</option>}
            </select>
          </div>
        )}

        <div style={{ background: 'rgba(201,168,76,.06)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--copa-gray)', marginBottom: 14 }}>
          Em caso de empate no placar, selecione o vencedor manualmente (pênaltis, prorrogação etc).
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ── Card de jogo no bracket ──────────────────────────────────────────────────
function MatchCard({ match, onEdit, isEmpty }) {
  if (isEmpty) {
    return (
      <div className="bracket-match" style={{ opacity: 0.35 }}>
        <div className="bracket-team"><span className="bracket-team-name empty">A definir</span></div>
        <div className="bracket-team"><span className="bracket-team-name empty">A definir</span></div>
      </div>
    );
  }

  const homeWon = match.winner_id && String(match.winner_id) === String(match.home_team_id);
  const awayWon = match.winner_id && String(match.winner_id) === String(match.away_team_id);

  return (
    <div
      className={`bracket-match ${match.winner_id ? 'has-winner' : ''}`}
      onClick={() => onEdit(match)}
      style={{ cursor: 'pointer' }}
      title="Clique para editar"
    >
      <div className={`bracket-team ${homeWon ? 'winner' : ''}`}>
        <span className={`bracket-team-name ${!match.home_team_name ? 'empty' : ''}`}>
          {match.home_team_name || 'A definir'}
          {match.home_group_letter && !match.home_score && !match.away_score
            ? <span style={{ fontSize: 10, color: 'var(--copa-gray)', marginLeft: 4 }}>({match.home_group_letter})</span>
            : null}
        </span>
        <span className="bracket-score">{match.home_score ?? ''}</span>
      </div>
      <div className={`bracket-team ${awayWon ? 'winner' : ''}`}>
        <span className={`bracket-team-name ${!match.away_team_name ? 'empty' : ''}`}>
          {match.away_team_name || 'A definir'}
          {match.away_group_letter && !match.home_score && !match.away_score
            ? <span style={{ fontSize: 10, color: 'var(--copa-gray)', marginLeft: 4 }}>({match.away_group_letter})</span>
            : null}
        </span>
        <span className="bracket-score">{match.away_score ?? ''}</span>
      </div>
    </div>
  );
}

// ── Bracket visual com conectores SVG ────────────────────────────────────────
function Bracket({ matchesByRound, oitavasCount, onEdit }) {
  const CARD_H    = 78;  // altura do card (2 times + border)
  const CARD_W    = 200;
  const COL_GAP   = 48;  // espaço entre colunas
  const ROW_GAP   = 12;  // gap entre cards da mesma fase
  const HEADER_H  = 44;

  // Calcula alturas por coluna
  function columnHeight(round) {
    const n = expectedMatches(round, oitavasCount);
    return n * CARD_H + Math.max(0, n - 1) * ROW_GAP;
  }

  const oitavasH = columnHeight('oitavas');
  const totalH   = oitavasH + HEADER_H + 24;

  // Posição vertical do topo de cada card em sua coluna
  function cardTop(round, index) {
    const n = expectedMatches(round, oitavasCount);
    const colH = columnHeight(round);
    const slotH = colH / n;
    return HEADER_H + index * slotH + slotH / 2 - CARD_H / 2;
  }

  function cardCenter(round, index) {
    return cardTop(round, index) + CARD_H / 2;
  }

  const rounds = ROUNDS.filter(r => expectedMatches(r.key, oitavasCount) > 0);

  // Gera os paths dos conectores entre fases adjacentes
  function renderConnectors(fromRound, toRound, fromColX, toColX) {
    const fromCount = expectedMatches(fromRound, oitavasCount);
    const toCount   = expectedMatches(toRound, oitavasCount);
    const paths = [];

    for (let i = 0; i < toCount; i++) {
      const top    = cardCenter(fromRound, i * 2);
      const bottom = cardCenter(fromRound, i * 2 + 1);
      const dest   = cardCenter(toRound, i);
      const midX   = fromColX + CARD_W + COL_GAP / 2;

      paths.push(
        <g key={`conn-${fromRound}-${i}`}>
          {/* linha saindo do card superior */}
          <path
            d={`M ${fromColX + CARD_W} ${top} H ${midX} V ${dest} H ${toColX}`}
            fill="none" stroke="rgba(201,168,76,0.3)" strokeWidth="1.5"
          />
          {/* linha saindo do card inferior */}
          <path
            d={`M ${fromColX + CARD_W} ${bottom} H ${midX}`}
            fill="none" stroke="rgba(201,168,76,0.3)" strokeWidth="1.5"
          />
        </g>
      );
    }
    return paths;
  }

  const totalWidth = rounds.length * CARD_W + (rounds.length - 1) * COL_GAP;

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ position: 'relative', width: totalWidth, height: totalH, minWidth: totalWidth }}>

        {/* SVG dos conectores — fica atrás dos cards */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={totalWidth} height={totalH}
        >
          {rounds.map((round, ri) => {
            if (ri === rounds.length - 1) return null;
            const nextRound = rounds[ri + 1];
            const fromX = ri * (CARD_W + COL_GAP);
            const toX   = (ri + 1) * (CARD_W + COL_GAP);
            return renderConnectors(round.key, nextRound.key, fromX, toX);
          })}
        </svg>

        {/* Colunas + cards */}
        {rounds.map((round, ri) => {
          const colX  = ri * (CARD_W + COL_GAP);
          const nSlots = expectedMatches(round.key, oitavasCount);
          const matches = matchesByRound[round.key] || [];

          return (
            <div
              key={round.key}
              style={{ position: 'absolute', left: colX, top: 0, width: CARD_W }}
            >
              {/* Header da fase */}
              <div style={{
                height: HEADER_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Bebas Neue', fontSize: 15, letterSpacing: '.1em',
                color: 'var(--copa-gold)', borderBottom: '1px solid var(--copa-border-dim)',
                marginBottom: 0,
              }}>
                {round.shortLabel}
              </div>

              {/* Cards */}
              {Array.from({ length: nSlots }).map((_, idx) => {
                const match = matches.find(m => m.match_index === idx);
                const top = cardTop(round.key, idx);
                return (
                  <div
                    key={idx}
                    style={{ position: 'absolute', top, left: 0, width: CARD_W }}
                  >
                    <MatchCard
                      match={match || {}}
                      onEdit={onEdit}
                      isEmpty={!match}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function KnockoutPage() {
  const qc = useQueryClient();
  const [editingMatch, setEditingMatch] = useState(null);

  const { data: knockout, isLoading } = useQuery('knockout', getKnockout, { refetchInterval: 10000 });
  const { data: groups } = useQuery('groups', getGroups);

  const allTeams = groups?.flatMap(g => g.teams) || [];

  const generateMutation = useMutation(generateKnockout, {
    onSuccess: () => qc.invalidateQueries('knockout'),
  });

  const updateMutation = useMutation(
    (data) => updateKnockoutMatch(editingMatch.id, data),
    {
      onSuccess: () => {
        qc.invalidateQueries('knockout');
        setEditingMatch(null);
      },
    }
  );

  const matchesByRound = {};
  ROUNDS.forEach(r => { matchesByRound[r.key] = []; });
  knockout?.forEach(m => {
    if (matchesByRound[m.round]) matchesByRound[m.round].push(m);
  });

  const oitavasCount = matchesByRound['oitavas'].length || 8;
  const hasOitavas   = matchesByRound['oitavas'].length > 0;

  if (isLoading) return <div className="spinner"><div className="spinner-ring" /></div>;

  return (
    <div>
      <div className="top-bar">
        <div>
          <div className="top-bar-title">Mata-mata</div>
          {hasOitavas && (
            <div style={{ fontSize: 12, color: 'var(--copa-gray)', marginTop: 2 }}>
              Chaveamento Copa do Mundo — 1ºA × 2ºB, 1ºC × 2ºD... Clique em qualquer jogo para editar.
            </div>
          )}
        </div>
        <div className="gap-8">
          <button
            className="btn btn-gold"
            onClick={() => {
              if (!hasOitavas || confirm('Regerar o chaveamento? Isso apaga todos os resultados do mata-mata.')) {
                generateMutation.mutate();
              }
            }}
            disabled={generateMutation.isLoading}
          >
            {generateMutation.isLoading ? 'Gerando...' : '⚡ Gerar Chaveamento'}
          </button>
        </div>
      </div>

      {!hasOitavas ? (
        <div style={{
          background: 'var(--copa-card)', border: '1px solid var(--copa-border)',
          borderRadius: 12, padding: '3rem 2rem', textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--copa-gold)', marginBottom: 12 }}>
            Chaveamento não gerado
          </div>
          <div style={{ fontSize: 14, color: 'var(--copa-gray)', maxWidth: 420, margin: '0 auto 20px' }}>
            Clique em "Gerar Chaveamento" para montar as oitavas automaticamente no estilo Copa do Mundo
            — 1º de cada grupo cruza com o 2º do grupo par (A×B, C×D, E×F, G×H).
          </div>
          <button className="btn btn-gold" onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isLoading}>
            ⚡ Gerar Chaveamento
          </button>
        </div>
      ) : (
        <div className="card card-gold" style={{ padding: '0.75rem 1rem 1.5rem' }}>
          <Bracket
            matchesByRound={matchesByRound}
            oitavasCount={oitavasCount}
            onEdit={setEditingMatch}
          />
        </div>
      )}

      {editingMatch && editingMatch.id && (
        <EditModal
          match={editingMatch}
          allTeams={allTeams}
          onSave={data => updateMutation.mutate(data)}
          onClose={() => setEditingMatch(null)}
        />
      )}
    </div>
  );
}
