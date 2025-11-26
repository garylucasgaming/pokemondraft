import React, { useState, useEffect } from 'react';
import { createLeague, browseLeagues, getLeagueByCode, joinLeague, getLeaguePlayers } from './api';
import './LeagueManager.css';

const LeagueManager = ({ username }) => {
  const [view, setView] = useState('browse'); // 'browse', 'create', 'view'
  const [leagues, setLeagues] = useState([]);
  const [currentLeague, setCurrentLeague] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Create league form state
  const [leagueName, setLeagueName] = useState('');
  const [format, setFormat] = useState('National Dex');
  const [pointsLimit, setPointsLimit] = useState(100);
  const [teamSize, setTeamSize] = useState(6);
  const [selectedGens, setSelectedGens] = useState([1,2,3,4,5,6,7,8,9]);
  const [bannedPokemon, setBannedPokemon] = useState('');

  // Join league form state
  const [joinCode, setJoinCode] = useState('');
  const [teamPokemon, setTeamPokemon] = useState([]);
  const [pokemonName, setPokemonName] = useState('');
  const [pokemonPoints, setPokemonPoints] = useState(1);

  useEffect(() => {
    if (view === 'browse') {
      loadLeagues();
    }
  }, [view]);

  const loadLeagues = async () => {
    try {
      setLoading(true);
      const data = await browseLeagues();
      setLeagues(data.leagues || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeague = async (e) => {
    e.preventDefault();
    if (!leagueName || !username) {
      setError('League name and username required');
      return;
    }

    try {
      setLoading(true);
      const bannedList = bannedPokemon
        .split(',')
        .map(p => p.trim().toLowerCase())
        .filter(p => p);

      const data = await createLeague({
        name: leagueName,
        commissioner: username,
        format,
        rules: {
          pointsLimit,
          teamSize,
          allowedGenerations: selectedGens,
          bannedPokemon: bannedList
        }
      });

      setMessage(`League created! Code: ${data.league.code}`);
      setCurrentLeague(data.league);
      setView('view');
      setError('');
      
      // Reset form
      setLeagueName('');
      setBannedPokemon('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLeague = async (code) => {
    try {
      setLoading(true);
      const leagueData = await getLeagueByCode(code);
      const playersData = await getLeaguePlayers(code);
      
      setCurrentLeague(leagueData.league);
      setPlayers(playersData.players || []);
      setView('view');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPokemon = () => {
    if (!pokemonName) return;
    
    const totalPoints = teamPokemon.reduce((sum, p) => sum + p.points, 0);
    if (totalPoints + pokemonPoints > pointsLimit) {
      setError(`Adding this Pokémon would exceed points limit (${pointsLimit})`);
      return;
    }

    if (teamPokemon.length >= teamSize) {
      setError(`Team size limit reached (${teamSize})`);
      return;
    }

    setTeamPokemon([...teamPokemon, { 
      name: pokemonName.toLowerCase(), 
      points: pokemonPoints 
    }]);
    setPokemonName('');
    setPokemonPoints(1);
    setError('');
  };

  const handleRemovePokemon = (index) => {
    setTeamPokemon(teamPokemon.filter((_, i) => i !== index));
  };

  const handleJoinLeague = async () => {
    if (!joinCode || !username || teamPokemon.length === 0) {
      setError('League code, username, and at least one Pokémon required');
      return;
    }

    try {
      setLoading(true);
      await joinLeague(joinCode, {
        username,
        team: teamPokemon
      });

      setMessage('Successfully joined league!');
      setTeamPokemon([]);
      setJoinCode('');
      handleViewLeague(joinCode);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleGen = (gen) => {
    if (selectedGens.includes(gen)) {
      setSelectedGens(selectedGens.filter(g => g !== gen));
    } else {
      setSelectedGens([...selectedGens, gen].sort());
    }
  };

  const totalTeamPoints = teamPokemon.reduce((sum, p) => sum + p.points, 0);

  return (
    <div className="league-manager">
      <div className="league-nav">
        <button 
          className={view === 'browse' ? 'active' : ''} 
          onClick={() => setView('browse')}
        >
          Browse Leagues
        </button>
        <button 
          className={view === 'create' ? 'active' : ''} 
          onClick={() => setView('create')}
        >
          Create League
        </button>
        <button 
          className={view === 'join' ? 'active' : ''} 
          onClick={() => setView('join')}
        >
          Join League
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {view === 'browse' && (
        <div className="browse-section">
          <h2>Available Leagues</h2>
          {loading ? (
            <p>Loading...</p>
          ) : leagues.length === 0 ? (
            <p>No leagues found. Create one to get started!</p>
          ) : (
            <div className="leagues-grid">
              {leagues.map(league => (
                <div key={league._id} className="league-card">
                  <h3>{league.name}</h3>
                  <p><strong>Code:</strong> {league.code}</p>
                  <p><strong>Format:</strong> {league.format}</p>
                  <p><strong>Commissioner:</strong> {league.commissioner}</p>
                  <p><strong>Status:</strong> {league.status}</p>
                  <p><strong>Rules:</strong></p>
                  <ul>
                    <li>Points Limit: {league.rules.pointsLimit}</li>
                    <li>Team Size: {league.rules.teamSize}</li>
                    <li>Generations: {league.rules.allowedGenerations?.join(', ')}</li>
                  </ul>
                  <button onClick={() => handleViewLeague(league.code)}>
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'create' && (
        <div className="create-section">
          <h2>Create New League</h2>
          <form onSubmit={handleCreateLeague}>
            <div className="form-group">
              <label>League Name:</label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="My Awesome League"
                required
              />
            </div>

            <div className="form-group">
              <label>Format:</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option>National Dex</option>
                <option>SV OU</option>
                <option>VGC 2024</option>
                <option>Little Cup</option>
                <option>Ubers</option>
                <option>Custom</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Points Limit:</label>
                <input
                  type="number"
                  value={pointsLimit}
                  onChange={(e) => setPointsLimit(parseInt(e.target.value))}
                  min="1"
                  max="1000"
                />
              </div>

              <div className="form-group">
                <label>Team Size:</label>
                <input
                  type="number"
                  value={teamSize}
                  onChange={(e) => setTeamSize(parseInt(e.target.value))}
                  min="1"
                  max="60"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Allowed Generations:</label>
              <div className="gen-selector">
                {[1,2,3,4,5,6,7,8,9].map(gen => (
                  <button
                    key={gen}
                    type="button"
                    className={selectedGens.includes(gen) ? 'active' : ''}
                    onClick={() => toggleGen(gen)}
                  >
                    Gen {gen}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Banned Pokémon (comma-separated):</label>
              <textarea
                value={bannedPokemon}
                onChange={(e) => setBannedPokemon(e.target.value)}
                placeholder="mewtwo, rayquaza, kyogre"
                rows="3"
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Creating...' : 'Create League'}
            </button>
          </form>
        </div>
      )}

      {view === 'join' && (
        <div className="join-section">
          <h2>Join League</h2>
          
          <div className="form-group">
            <label>League Code:</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCD123"
              maxLength="12"
            />
          </div>

          <h3>Build Your Team</h3>
          <div className="team-builder">
            <div className="add-pokemon-form">
              <input
                type="text"
                value={pokemonName}
                onChange={(e) => setPokemonName(e.target.value)}
                placeholder="Pokémon name"
              />
              <input
                type="number"
                value={pokemonPoints}
                onChange={(e) => setPokemonPoints(parseInt(e.target.value) || 1)}
                min="0"
                max="20"
                style={{ width: '80px' }}
              />
              <button type="button" onClick={handleAddPokemon}>
                Add
              </button>
            </div>

            <div className="team-summary">
              <p><strong>Team Size:</strong> {teamPokemon.length} / {teamSize || 6}</p>
              <p><strong>Total Points:</strong> {totalTeamPoints} / {pointsLimit || 100}</p>
            </div>

            {teamPokemon.length > 0 && (
              <div className="team-list">
                {teamPokemon.map((p, idx) => (
                  <div key={idx} className="team-pokemon">
                    <span>{p.name}</span>
                    <span>({p.points} pts)</span>
                    <button onClick={() => handleRemovePokemon(idx)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={handleJoinLeague} 
            disabled={loading || teamPokemon.length === 0}
            className="submit-btn"
          >
            {loading ? 'Joining...' : 'Join League'}
          </button>
        </div>
      )}

      {view === 'view' && currentLeague && (
        <div className="view-section">
          <button onClick={() => setView('browse')} className="back-btn">
            ← Back to Browse
          </button>
          
          <h2>{currentLeague.name}</h2>
          <div className="league-info">
            <p><strong>Code:</strong> {currentLeague.code}</p>
            <p><strong>Format:</strong> {currentLeague.format}</p>
            <p><strong>Commissioner:</strong> {currentLeague.commissioner}</p>
            <p><strong>Status:</strong> {currentLeague.status}</p>
            <p><strong>Rules:</strong></p>
            <ul>
              <li>Points Limit: {currentLeague.rules.pointsLimit}</li>
              <li>Team Size: {currentLeague.rules.teamSize}</li>
              <li>Generations: {currentLeague.rules.allowedGenerations?.join(', ')}</li>
              {currentLeague.rules.bannedPokemon?.length > 0 && (
                <li>Banned: {currentLeague.rules.bannedPokemon.join(', ')}</li>
              )}
            </ul>
          </div>

          <h3>Standings</h3>
          {loading ? (
            <p>Loading players...</p>
          ) : players.length === 0 ? (
            <p>No players have joined yet.</p>
          ) : (
            <table className="standings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Win %</th>
                  <th>Total Points</th>
                  <th>Team Size</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, idx) => {
                  const winRate = player.wins + player.losses > 0
                    ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
                    : '0.0';
                  
                  return (
                    <tr key={player._id}>
                      <td>{idx + 1}</td>
                      <td>{player.username}</td>
                      <td>{player.wins}</td>
                      <td>{player.losses}</td>
                      <td>{winRate}%</td>
                      <td>{player.totalPoints}</td>
                      <td>{player.team?.length || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default LeagueManager;
