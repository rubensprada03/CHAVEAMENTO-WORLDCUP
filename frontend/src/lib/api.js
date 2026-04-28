import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL: BASE });

export const getGroups = () => api.get('/groups').then(r => r.data);
export const updateGroupTeams = (letter, teams) => api.put(`/groups/${letter}/teams`, { teams }).then(r => r.data);
export const addGroup = () => api.post('/groups').then(r => r.data);
export const deleteGroup = (letter) => api.delete(`/groups/${letter}`).then(r => r.data);
export const resetScores = () => api.post('/groups/reset').then(r => r.data);
export const addTeamToGroup = (letter, name) => api.post(`/groups/${letter}/teams`, { name }).then(r => r.data);
export const removeTeamFromGroup = (letter, teamId) => api.delete(`/groups/${letter}/teams/${teamId}`).then(r => r.data);

export const getMatches = (group) => api.get('/matches', { params: { group } }).then(r => r.data);
export const updateMatchScore = (id, home_score, away_score) =>
  api.patch(`/matches/${id}`, { home_score, away_score }).then(r => r.data);

export const getStandings = () => api.get('/standings').then(r => r.data);

export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSetting = (key, value) => api.put(`/settings/${key}`, { value }).then(r => r.data);

export const getKnockout = () => api.get('/knockout').then(r => r.data);
export const generateKnockout = () => api.post('/knockout/generate').then(r => r.data);
export const updateKnockoutMatch = (id, data) => api.patch(`/knockout/${id}`, data).then(r => r.data);

export default api;