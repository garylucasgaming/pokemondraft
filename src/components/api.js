// API helper functions for league and saved team management

const API_BASE = process.env.REACT_APP_SOCKET_URL || 
  (process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : 'http://localhost:8080');

// ========== Saved Teams API ==========

export const createSavedTeam = async (teamData) => {
  const response = await fetch(`${API_BASE}/api/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teamData)
  });
  if (!response.ok) throw new Error('Failed to create team');
  return response.json();
};

export const getUserTeams = async (userId) => {
  const response = await fetch(`${API_BASE}/api/teams?userId=${userId}`);
  if (!response.ok) throw new Error('Failed to fetch teams');
  return response.json();
};

export const getTeamById = async (teamId) => {
  const response = await fetch(`${API_BASE}/api/teams/${teamId}`);
  if (!response.ok) throw new Error('Failed to fetch team');
  return response.json();
};

export const getSharedTeam = async (shareCode) => {
  const response = await fetch(`${API_BASE}/api/teams/share/${shareCode}`);
  if (!response.ok) throw new Error('Failed to fetch shared team');
  return response.json();
};

export const updateSavedTeam = async (teamId, updates) => {
  const response = await fetch(`${API_BASE}/api/teams/${teamId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error('Failed to update team');
  return response.json();
};

export const deleteSavedTeam = async (teamId, userId) => {
  const response = await fetch(`${API_BASE}/api/teams/${teamId}?userId=${userId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete team');
  return response.json();
};

export const exportTeamToShowdown = async (teamId) => {
  const response = await fetch(`${API_BASE}/api/teams/${teamId}/export`);
  if (!response.ok) throw new Error('Failed to export team');
  return response.json();
};

export const browsePublicTeams = async (format = null, limit = 20) => {
  const params = new URLSearchParams();
  if (format) params.append('format', format);
  params.append('limit', limit);
  
  const response = await fetch(`${API_BASE}/api/teams/public/browse?${params}`);
  if (!response.ok) throw new Error('Failed to browse teams');
  return response.json();
};

// ========== League API ==========

export const createLeague = async (leagueData) => {
  const response = await fetch(`${API_BASE}/api/leagues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leagueData)
  });
  if (!response.ok) throw new Error('Failed to create league');
  return response.json();
};

export const getLeagueByCode = async (code) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}`);
  if (!response.ok) throw new Error('Failed to fetch league');
  return response.json();
};

export const browseLeagues = async (limit = 50) => {
  const response = await fetch(`${API_BASE}/api/leagues?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to browse leagues');
  return response.json();
};

export const updateLeague = async (code, updates) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error('Failed to update league');
  return response.json();
};

export const updateLeagueSchedule = async (code, commissioner, schedule) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commissioner, schedule })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update schedule');
  }
  return response.json();
};

export const joinLeague = async (code, playerData) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playerData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join league');
  }
  return response.json();
};

export const getLeaguePlayers = async (code) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/players`);
  if (!response.ok) throw new Error('Failed to fetch players');
  return response.json();
};

export const createMatch = async (code, matchData) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(matchData)
  });
  if (!response.ok) throw new Error('Failed to create match');
  return response.json();
};

export const reportMatchResult = async (matchId, result) => {
  const response = await fetch(`${API_BASE}/api/matches/${matchId}/result`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  });
  if (!response.ok) throw new Error('Failed to report result');
  return response.json();
};

export const getLeagueMatches = async (code) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/matches`);
  if (!response.ok) throw new Error('Failed to fetch matches');
  return response.json();
};

export const createTournament = async (code, tournamentData) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/tournaments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tournamentData)
  });
  if (!response.ok) throw new Error('Failed to create tournament');
  return response.json();
};

export const getLeagueTournaments = async (code) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/tournaments`);
  if (!response.ok) throw new Error('Failed to fetch tournaments');
  return response.json();
};

export const acceptPlayerRequest = async (code, username, commissionerName) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/players/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, commissionerName })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept player');
  }
  return response.json();
};

export const kickPlayer = async (code, username, commissionerName) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/players/kick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, commissionerName })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to kick player');
  }
  return response.json();
};

export const requestToJoinLeague = async (code, username) => {
  const response = await fetch(`${API_BASE}/api/leagues/${code}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send join request');
  }
  return response.json();
};

export const generateInviteCode = async (leagueCode, commissionerName) => {
  const response = await fetch(`${API_BASE}/api/leagues/${leagueCode}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commissionerName })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate invite code');
  }
  return response.json();
};

export const joinByInviteCode = async (inviteCode, username) => {
  const response = await fetch(`${API_BASE}/api/leagues/invite/${inviteCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join with invite code');
  }
  return response.json();
};
