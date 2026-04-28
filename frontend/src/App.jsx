import { useState } from 'react';
import GroupsPage from './pages/GroupsPage.jsx';
import MatchesPage from './pages/MatchesPage.jsx';
import StandingsPage from './pages/StandingsPage.jsx';
import KnockoutPage from './pages/KnockoutPage.jsx';

const TABS = [
  { id: 'grupos', label: 'Grupos' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'classificacao', label: 'Classificação' },
  { id: 'matamata', label: 'Mata-mata' },
];

export default function App() {
  const [tab, setTab] = useState('grupos');
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <div className="header-logo">
          FIFA<span className="accent">CHAMP</span>
          <span className="header-badge">2026</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--copa-gray)', fontFamily: 'Barlow Condensed', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Campeonato dos Amigos
        </div>
      </header>
      <nav className="nav-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`nav-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="page">
        {tab === 'grupos' && <GroupsPage />}
        {tab === 'jogos' && <MatchesPage />}
        {tab === 'classificacao' && <StandingsPage />}
        {tab === 'matamata' && <KnockoutPage />}
      </main>
    </div>
  );
}
