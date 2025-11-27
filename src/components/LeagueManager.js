/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-loop-func */
/* eslint-disable no-dupe-keys */
import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { createLeague, browseLeagues, getLeagueByCode, joinLeague, getLeaguePlayers, updateLeague, updateLeagueSchedule, acceptPlayerRequest, kickPlayer, requestToJoinLeague, generateInviteCode, joinByInviteCode } from './api';
import './LeagueManager.css';

const LeagueManager = ({ username }) => {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'browse', 'create', 'view'
  const [leagues, setLeagues] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]); // Leagues user is active in
  const [currentLeague, setCurrentLeague] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Browse filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'open', 'in_progress', 'completed'
  const [formatFilter, setFormatFilter] = useState('all'); // 'all', 'National Dex', 'SV OU', etc.

  // Create league form state
  const [leagueName, setLeagueName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [splitIntoPools, setSplitIntoPools] = useState(false);
  const [numPools, setNumPools] = useState(2);
  const [leagueWeeks, setLeagueWeeks] = useState(8);
  const [bracketType, setBracketType] = useState('round_robin');

  // Rules state
  const [draftRules, setDraftRules] = useState('');
  const [battleRules, setBattleRules] = useState('');
  const [isEditingRules, setIsEditingRules] = useState(false);

  // Draft format modal state
  const [showDraftFormatModal, setShowDraftFormatModal] = useState(false);
  
  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Manage Players modal state
  const [showManagePlayersModal, setShowManagePlayersModal] = useState(false);
  
  // Invite code modal state
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  
  // Bracket modal state
  const [showBracketModal, setShowBracketModal] = useState(false);
  const [bracketMatches, setBracketMatches] = useState([]);
  
  // Edit League Settings modal state
  const [showEditLeagueModal, setShowEditLeagueModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [eventType, setEventType] = useState('match');
  const [events, setEvents] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [draftFormat, setDraftFormat] = useState('');
  const [draftPointsLimit, setDraftPointsLimit] = useState(120);
  const [draftTeamSize, setDraftTeamSize] = useState(12);
  const [draftGenerations, setDraftGenerations] = useState([1,2,3,4,5,6,7,8,9]);
  const [draftBannedPokemon, setDraftBannedPokemon] = useState([]);
  const [draftPokemonList, setDraftPokemonList] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    return new Date(today.setDate(diff));
  });
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [draftPointsMap, setDraftPointsMap] = useState({});
  const [presetsList, setPresetsList] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [draftSuggestionsVisible, setDraftSuggestionsVisible] = useState(false);
  const [selectedPokemonForPoints, setSelectedPokemonForPoints] = useState([]);
  const [pointsValueInput, setPointsValueInput] = useState(1);
  const [allowTrading, setAllowTrading] = useState(false);
  const [enableTimer, setEnableTimer] = useState(true);
  const [maxTradeLimit, setMaxTradeLimit] = useState(1);
  const [unlimitedTrades, setUnlimitedTrades] = useState(false);
  const [firstRoundTimer, setFirstRoundTimer] = useState(720); // 12 hours in minutes
  const [subsequentRoundTimer, setSubsequentRoundTimer] = useState(360); // 6 hours in minutes
  const [allowSeasonalTrading, setAllowSeasonalTrading] = useState(false);
  const [maxSeasonalTradeLimit, setMaxSeasonalTradeLimit] = useState(1);
  const [unlimitedSeasonalTrades, setUnlimitedSeasonalTrades] = useState(false);

  // Export to Calendar modal state
  const [showExportCalendarModal, setShowExportCalendarModal] = useState(false);
  const [exportWeekNumber, setExportWeekNumber] = useState(null);
  const [exportWeekMatches, setExportWeekMatches] = useState([]);
  const [exportDate, setExportDate] = useState(new Date());

  // Replay modal state
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [selectedMatchForReplay, setSelectedMatchForReplay] = useState(null);
  const [replayLink, setReplayLink] = useState('');

  const DEFAULT_DRAFT_RULES = `-credit to abriel and princess autumn for this default text-
You have up to 120 points with which to draft 10-12 Pokémon. Costs are listed on the draft board.
If a Pokémon is picked by someone else, you may not pick it.
For the first round, there is a 12 hour timer. After the first round ends, there will be a continuous 6 hour timer within which you must pick, or you will be skipped, and will be required to make-up your pick when you are next online. 
Your timer will halve every time you are skipped. It is recommended to leave picks (with backups) with your pool moderator to avoid this.
Declare two Tera Captains equal to or less than 25 points. These are the only Pokémon on your draft that may terastallize.
The following Pokémon may not be Tera-Captains:
- Baxcalibur
- Blaziken
- Chi-Yu 
- Darkrai 
- Deoxys-Speed
- Dragonite
- Enamorus-Incarnate 
- Garchomp
- Gouging Fire
- Iron Boulder 
- Iron Bundle
- Iron Valiant 
- Kingambit 
- Kyurem
- Latios 
- Ogerpon-Hearthflame 
- Palafin 
- Roaring Moon 
- Sneasler
- Terapagos 
- Ursaluna-Bloodmoon 
- Volcarona

The following Pokémon have access to all of their forms (although you may only bring up to 1 to each battle):
- Pikachu 
- Basculin 
- Oricorio 
- Toxtricity 
- Indeedee 
- Basculegion 
- Oinkologne 
- Squawkabilly 
- Tatsugiri 
- Meowstic

Smogon's Species Clause applies to your draft.`;

  const DEFAULT_BATTLE_RULES = `-credit to abriel and princess autumn for this default text-
All games must be played in the [Gen 9] Tera Preview Draft tier on smogtours.psim.us or psim.us. Be aware that each game on smogtours starts a timer automatically and cannot be turned off.
General tournament rules and regulations can be found here.
SV cartridge win conditions are in place; there are no ties.
Each set is a best-of-one set.

The following clauses apply:
- Species Clause: A player cannot have two Pokémon with the same National Pokédex number on a team.
- Sleep Clause: If a player has already put a Pokémon on their opponent's side to sleep and it is still sleeping, another one can't be put to sleep.
- Evasion Clause: A Pokémon may not hold an item, use a move or possess an ability that can increase their evasion stat.
- OHKO Clause: A Pokémon may not have the moves Fissure, Guillotine, Horn Drill, or Sheer Cold in its moveset.
- Moody Clause: A team cannot have a Pokémon with the ability Moody.
- Endless Battle Clause: Players cannot intentionally prevent an opponent from being able to end the game without forfeiting.
- Baton Pass Clause: A Pokémon may not have Baton Pass in its moveset.

Any items unreleased in SV are banned.
Quick Claw, King's Rock, and Razor Fang are banned.
Replays must be posted to the appropriate channel.`;

  useEffect(() => {
    if (view === 'dashboard') {
      loadMyLeagues();
    } else if (view === 'browse') {
      loadLeagues();
    }
  }, [view]);

  useEffect(() => {
    // Load presets from JSON
    fetch('/presets.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.presets) {
          setPresetsList(data.presets);
        }
      })
      .catch(err => {
        console.error('Failed to load presets:', err);
      });
  }, []);

  useEffect(() => {
    if (showDraftFormatModal && draftPokemonList.length === 0) {
      fetchPokemonList();
    }
    // Ensure generations are set when modal opens
    if (showDraftFormatModal && draftGenerations.length === 0) {
      setDraftGenerations([1,2,3,4,5,6,7,8,9]);
    }
  }, [showDraftFormatModal]);

  const fetchPokemonList = async () => {
    try {
      // Fetch from pokemon_data.json which has all the data we need
      const response = await fetch('/pokemon_data.json');
      const pokemonData = await response.json();
      
      // Filter to exclude alternate forms (keep only base species and regional variants)
      const keepRegional = ['alola', 'galar', 'hisui', 'paldea'];
      const filteredData = pokemonData.filter(p => {
        const name = p.form_name.toLowerCase();
        const species = p.species_name.toLowerCase();
        
        // Keep if form_name === species_name (base form)
        if (name === species) return true;
        
        // Keep regional variants
        if (keepRegional.some(region => name.includes(region))) return true;
        
        // Exclude everything else (megas, gmax, totem, primal, etc.)
        return false;
      });
      
      // Map to the format we need (using form_name for display)
      const pokemonWithImages = filteredData.map(p => ({
        id: p.id,
        name: p.form_name.charAt(0).toUpperCase() + p.form_name.slice(1),
        img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`,
        generation: getGeneration(p.id),
        legendary: p.legendary || false,
        paradox: p.paradox || false
      }));
      
      // Remove any duplicates by name (shouldn't be any, but just in case)
      const uniquePokemon = [];
      const seenNames = new Set();
      pokemonWithImages.forEach(p => {
        if (!seenNames.has(p.name)) {
          seenNames.add(p.name);
          uniquePokemon.push(p);
        }
      });
      
      setDraftPokemonList(uniquePokemon);
      
      // Initialize all Pokemon with 1 point
      const initialPoints = {};
      uniquePokemon.forEach(p => {
        initialPoints[p.name] = 1;
      });
      setDraftPointsMap(initialPoints);
    } catch (err) {
      console.error('Failed to fetch Pokemon:', err);
    }
  };

  const banAllLegendaries = () => {
    const legendaryPokemon = draftPokemonList.filter(p => p.legendary);
    if (legendaryPokemon.length === 0) {
      alert('No legendary Pokémon found to ban');
      return;
    }
    const newPointsMap = { ...draftPointsMap };
    legendaryPokemon.forEach(p => {
      newPointsMap[p.name] = 0;
    });
    setDraftPointsMap(newPointsMap);
    alert(`Banned ${legendaryPokemon.length} legendary Pokémon`);
  };

  const banAllParadox = () => {
    const paradoxPokemon = draftPokemonList.filter(p => p.paradox);
    if (paradoxPokemon.length === 0) {
      alert('No Paradox Pokémon found to ban');
      return;
    }
    const newPointsMap = { ...draftPointsMap };
    paradoxPokemon.forEach(p => {
      newPointsMap[p.name] = 0;
    });
    setDraftPointsMap(newPointsMap);
    alert(`Banned ${paradoxPokemon.length} Paradox Pokémon`);
  };

  const formatTimerMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
    return `:${mins.toString().padStart(2, '0')}`;
  };

  const parseTimerInput = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    
    // Format: H:MM or :MM
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const hours = parts[0] === '' ? 0 : parseInt(parts[0], 10);
      const mins = parseInt(parts[1], 10);
      if (isNaN(hours) || isNaN(mins)) return null;
      return hours * 60 + mins;
    }
    return null;
  };

  const getGeneration = (id) => {
    if (id <= 151) return 1;
    if (id <= 251) return 2;
    if (id <= 386) return 3;
    if (id <= 493) return 4;
    if (id <= 649) return 5;
    if (id <= 721) return 6;
    if (id <= 809) return 7;
    if (id <= 905) return 8;
    return 9;
  };

  const loadMyLeagues = async () => {
    if (!username) {
      setMyLeagues([]);
      return;
    }
    try {
      setLoading(true);
      // TODO: Create API endpoint to get leagues by player username
      // For now, just filter from all leagues
      const data = await browseLeagues();
      const allLeagues = data.leagues || [];
      
      // Separate leagues by role
      const hostedLeagues = [];
      const joinedLeagues = [];
      
      for (const league of allLeagues) {
        // Check if user is commissioner
        if (league.commissionerName === username) {
          hostedLeagues.push({ ...league, role: 'host' });
        }
        
        // TODO: Check if user is in players list once we have that endpoint
        // For now, we'll need to fetch players for each league to determine this
        // This is inefficient and should be replaced with a proper API endpoint
      }
      
      // Combine both with role indicator
      setMyLeagues([...hostedLeagues, ...joinedLeagues]);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

      const data = await createLeague({
        name: leagueName,
        commissioner: username,
        isPublic,
        maxPlayers,
        splitIntoPools,
        numPools: splitIntoPools ? numPools : 1,
        leagueWeeks,
        bracketType
      });

      setMessage(`League created! Code: ${data.league.code}`);
      setCurrentLeague(data.league);
      setView('view');
      setError('');
      
      // Reset form
      setLeagueName('');
      setIsPublic(true);
      setMaxPlayers(8);
      setSplitIntoPools(false);
      setNumPools(2);
      setLeagueWeeks(8);
      setBracketType('round_robin');
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
      setDraftRules(leagueData.league.draftRules || DEFAULT_DRAFT_RULES);
      setBattleRules(leagueData.league.battleRules || DEFAULT_BATTLE_RULES);
      setIsEditingRules(false);
      
      // Load draft format data
      setDraftFormat(leagueData.league.format || '');
      setDraftPointsLimit(leagueData.league.rules?.pointsLimit || 120);
      setDraftTeamSize(leagueData.league.rules?.teamSize || 12);
      setDraftGenerations(leagueData.league.rules?.allowedGenerations || [1,2,3,4,5,6,7,8,9]);
      setDraftBannedPokemon(leagueData.league.rules?.bannedPokemon || []);
      setDraftPointsMap(leagueData.league.pokemonPointValues || {});
      
      // Load schedule if exists
      if (leagueData.league.schedule && Array.isArray(leagueData.league.schedule)) {
        setEvents(leagueData.league.schedule);
      }
      
      // Load bracket if exists
      if (leagueData.league.bracket && leagueData.league.bracket.matches) {
        setBracketMatches(leagueData.league.bracket.matches);
      }
      
      // Debug log for commissioner comparison
      console.log('League loaded:', {
        commissioner: leagueData.league.commissionerName,
        currentUser: username,
        match: leagueData.league.commissionerName === username
      });
      
      setView('view');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAsPlayer = async () => {
    if (!currentLeague || !username) return;

    try {
      setLoading(true);
      await joinLeague(currentLeague.code, {
        username: username,
        team: []
      });
      
      // Reload players list
      const playersData = await getLeaguePlayers(currentLeague.code);
      setPlayers(playersData.players || []);
      setMessage('Successfully joined as player!');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraftFormat = async () => {
    if (!currentLeague) return;

    try {
      setLoading(true);
      await updateLeague(currentLeague.code, {
        format: draftFormat,
        rules: {
          pointsLimit: draftPointsLimit,
          teamSize: draftTeamSize,
          allowedGenerations: draftGenerations,
          bannedPokemon: draftBannedPokemon
        },
        pokemonPointValues: draftPointsMap
      });
      
      setCurrentLeague({
        ...currentLeague,
        format: draftFormat,
        rules: {
          pointsLimit: draftPointsLimit,
          teamSize: draftTeamSize,
          allowedGenerations: draftGenerations,
          bannedPokemon: draftBannedPokemon
        },
        pokemonPointValues: draftPointsMap
      });
      setShowDraftFormatModal(false);
      setMessage('Draft format saved successfully!');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportFormat = () => {
    const exportData = {
      version: 1,
      format: draftFormat,
      settings: {
        pointsLimit: draftPointsLimit,
        teamSizeLimit: draftTeamSize,
        genFilter: draftGenerations.length === 9 ? 0 : Math.max(...draftGenerations),
        allowTrading: allowTrading,
        maxTradeLimit: maxTradeLimit,
        unlimitedTrades: unlimitedTrades
      },
      allowedGenerations: draftGenerations,
      bannedPokemon: draftBannedPokemon,
      pointsMap: draftPointsMap
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const leagueName = currentLeague?.name || 'league';
    const formatName = draftFormat || 'format';
    a.download = `${leagueName}_${formatName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage('Format exported successfully!');
  };

  const handleImportFormat = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const txt = e.target.result;
        let parsed = null;
        let importedSettings = null;
        let importedBanList = null;
        
        try {
          const jsonData = JSON.parse(txt);
          if (typeof jsonData !== 'object') {
            parsed = null;
          } else {
            // Check if it's the new format with version and settings
            if (jsonData.version && jsonData.pointsMap) {
              parsed = jsonData.pointsMap;
              
              // Extract format name
              if (jsonData.format) setDraftFormat(jsonData.format);
              
              // Extract settings if present
              if (jsonData.settings) {
                importedSettings = {
                  pointsLimit: jsonData.settings.pointsLimit,
                  teamSizeLimit: jsonData.settings.teamSizeLimit,
                  genFilter: jsonData.settings.genFilter,
                  allowTrading: jsonData.settings.allowTrading ?? false,
                  maxTradeLimit: jsonData.settings.maxTradeLimit ?? 0,
                  unlimitedTrades: jsonData.settings.unlimitedTrades ?? false
                };
              }
              
              // Extract allowed generations
              if (jsonData.allowedGenerations && Array.isArray(jsonData.allowedGenerations)) {
                setDraftGenerations(jsonData.allowedGenerations);
              }
              
              // Extract ban list if present
              if (jsonData.bannedPokemon && Array.isArray(jsonData.bannedPokemon)) {
                importedBanList = jsonData.bannedPokemon;
              }
            } else {
              // Old format: check for direct properties
              if (jsonData.format) setDraftFormat(jsonData.format);
              if (jsonData.pointsLimit) setDraftPointsLimit(jsonData.pointsLimit);
              if (jsonData.teamSize) setDraftTeamSize(jsonData.teamSize);
              if (jsonData.allowedGenerations) setDraftGenerations(jsonData.allowedGenerations);
              if (jsonData.bannedPokemon) setDraftBannedPokemon(jsonData.bannedPokemon);
              parsed = jsonData.pointsMap || jsonData;
            }
          }
        } catch (err) {
          // Try CSV parse: each line name,points
          const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const pm = {};
          for (const ln of lines) {
            const parts = ln.split(',').map(s => s.trim());
            if (parts.length >= 2) {
              const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
              let val = Number(parts[1]);
              if (!Number.isFinite(val)) val = 1;
              // Allow explicit 0 (banned); clamp other numeric values to 1..20
              if (val !== 0) val = Math.max(1, Math.min(20, val));
              pm[name] = val;
            }
          }
          if (Object.keys(pm).length > 0) {
            parsed = pm;
          }
        }
        
        if (parsed) {
          // Apply imported settings if available
          if (importedSettings) {
            setDraftPointsLimit(importedSettings.pointsLimit ?? draftPointsLimit);
            setDraftTeamSize(importedSettings.teamSizeLimit ?? draftTeamSize);
            setAllowTrading(importedSettings.allowTrading ?? false);
            setMaxTradeLimit(importedSettings.maxTradeLimit ?? 0);
            setUnlimitedTrades(importedSettings.unlimitedTrades ?? false);
            
            if (importedSettings.genFilter != null) {
              // Convert genFilter to generations array
              if (importedSettings.genFilter === 0) {
                setDraftGenerations([1,2,3,4,5,6,7,8,9]);
              } else {
                const gens = [];
                for (let i = 1; i <= importedSettings.genFilter; i++) {
                  gens.push(i);
                }
                setDraftGenerations(gens);
              }
            }
          }
          
          // Update ban list if provided
          if (importedBanList) {
            setDraftBannedPokemon(importedBanList);
          }
          
          // Import points map
          setDraftPointsMap(parsed);
          setMessage('Format imported successfully!');
        } else {
          setError('Failed to parse format file. Please use a valid JSON or CSV file.');
        }
      } catch (err) {
        console.error('Import error:', err);
        setError('Failed to import format file.');
      }
    };
    reader.readAsText(file);
  };

  const handlePresetChange = (presetId) => {
    setSelectedPreset(presetId);
    
    if (presetId) {
      const preset = presetsList.find(p => p.id === presetId);
      if (preset) {
        setDraftFormat(preset.name);
        setDraftPointsLimit(preset.pointsLimit || 120);
        setDraftTeamSize(preset.teamSizeLimit || 12);
        
        if (preset.generationFilter) {
          const maxGen = preset.generationFilter;
          setDraftGenerations(Array.from({length: maxGen}, (_, i) => i + 1));
        }
        
        if (preset.points) {
          // Normalize point values - convert lowercase keys to proper case
          const normalizedPoints = {};
          Object.keys(preset.points).forEach(key => {
            const properName = key.charAt(0).toUpperCase() + key.slice(1);
            normalizedPoints[properName] = preset.points[key];
          });
          setDraftPointsMap(normalizedPoints);
        }
        
        setMessage(`Preset "${preset.name}" loaded successfully!`);
      }
    }
  };

  const handleSaveRules = async () => {
    if (!currentLeague) return;

    try {
      setLoading(true);
      await updateLeague(currentLeague.code, {
        draftRules,
        battleRules
      });
      
      setCurrentLeague({
        ...currentLeague,
        draftRules,
        battleRules
      });
      setIsEditingRules(false);
      setMessage('Rules saved successfully!');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptPlayer = async (playerUsername) => {
    if (!currentLeague) return;
    
    try {
      setLoading(true);
      await acceptPlayerRequest(currentLeague.code, playerUsername, username);
      
      // Refresh league and player data
      const leagueData = await getLeagueByCode(currentLeague.code);
      const playersData = await getLeaguePlayers(currentLeague.code);
      
      setCurrentLeague(leagueData.league);
      setPlayers(playersData.players || []);
      setMessage(`${playerUsername} accepted into the league!`);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKickPlayer = async (playerUsername) => {
    if (!currentLeague) return;
    
    if (!window.confirm(`Are you sure you want to remove ${playerUsername} from the league?`)) {
      return;
    }
    
    try {
      setLoading(true);
      await kickPlayer(currentLeague.code, playerUsername, username);
      
      // Refresh league and player data
      const leagueData = await getLeagueByCode(currentLeague.code);
      const playersData = await getLeaguePlayers(currentLeague.code);
      
      setCurrentLeague(leagueData.league);
      setPlayers(playersData.players || []);
      setMessage(`${playerUsername} removed from the league.`);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInviteCode = async () => {
    if (!currentLeague) return;
    
    try {
      setLoading(true);
      const result = await generateInviteCode(currentLeague.code, username);
      
      // Copy to clipboard
      const inviteUrl = `${window.location.origin}?invite=${result.inviteCode}`;
      await navigator.clipboard.writeText(result.inviteCode);
      
      // Refresh league data to get updated invite codes
      const leagueData = await getLeagueByCode(currentLeague.code);
      setCurrentLeague(leagueData.league);
      
      setMessage(`Invite code ${result.inviteCode} copied to clipboard! (Valid for 24 hours)`);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestToJoin = async (leagueCode) => {
    try {
      setLoading(true);
      await requestToJoinLeague(leagueCode, username);
      setMessage('Join request sent! The commissioner will review your request.');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByInviteCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }
    
    try {
      setLoading(true);
      const result = await joinByInviteCode(inviteCode.trim().toUpperCase(), username);
      
      // Load the league
      await handleViewLeague(result.league.code);
      setShowInviteCodeModal(false);
      setInviteCode('');
      setMessage('Successfully joined the league!');
      setError('');
    } catch (err) {
      setError(err.message || 'Invalid or expired invite code');
    } finally {
      setLoading(false);
    }
  };

  // Generate round-robin matches for all players
  const generateRoundRobinMatches = () => {
    if (!players || players.length < 2) {
      setError('Need at least 2 players to generate matches');
      return;
    }

    const matches = [];
    const playerList = players.map(p => p.username || p);
    const totalWeeks = currentLeague?.leagueWeeks || 8;
    const n = playerList.length;

    // Round-robin scheduling algorithm (balanced distribution)
    // This ensures each player plays at most once per week when possible
    const schedule = [];
    
    // If odd number of players, add a "bye" placeholder
    const hasOddPlayers = n % 2 === 1;
    const players_with_bye = hasOddPlayers ? [...playerList, null] : [...playerList];
    const totalPlayers = players_with_bye.length;

    // Generate rounds using round-robin rotation algorithm
    for (let week = 0; week < totalWeeks; week++) {
      const weekMatches = [];
      
      // In each round, pair players
      for (let i = 0; i < totalPlayers / 2; i++) {
        const home = (week + i) % (totalPlayers - 1);
        const away = (totalPlayers - 1 - i + week) % (totalPlayers - 1);
        
        let player1Index = home;
        let player2Index = away;
        
        // The last player stays fixed
        if (i === 0) {
          player2Index = totalPlayers - 1;
        }
        
        const p1 = players_with_bye[player1Index];
        const p2 = players_with_bye[player2Index];
        
        // Skip if either player is a bye
        if (p1 && p2) {
          weekMatches.push({ player1: p1, player2: p2, week: week + 1 });
        }
      }
      
      schedule.push(...weekMatches);
      
      // Stop if we've generated all possible matches
      if (schedule.length >= (n * (n - 1)) / 2) {
        break;
      }
    }

    // Convert to match format with IDs
    const generatedMatches = schedule.map((match, index) => ({
      id: `match-${index}`,
      player1: match.player1,
      player2: match.player2,
      winner: null,
      score: null,
      week: match.week
    }));

    setBracketMatches(generatedMatches);
    
    // Count matches per week
    const matchesPerWeek = {};
    generatedMatches.forEach(m => {
      matchesPerWeek[m.week] = (matchesPerWeek[m.week] || 0) + 1;
    });
    
    const distribution = Object.entries(matchesPerWeek)
      .map(([week, count]) => `Week ${week}: ${count}`)
      .join(', ');
    
    setMessage(`Generated ${generatedMatches.length} matches (${distribution})`);
  };

  // Generate single elimination bracket
  const generateSingleEliminationBracket = () => {
    if (!players || players.length < 2) {
      setError('Need at least 2 players to generate bracket');
      return;
    }

    const playerList = players.map(p => p.username || p);
    const n = playerList.length;
    
    // Calculate the number of rounds needed
    const rounds = Math.ceil(Math.log2(n));
    const bracketSize = Math.pow(2, rounds); // Next power of 2
    const byes = bracketSize - n; // Number of byes needed
    
    // Shuffle players for random seeding
    const seededPlayers = [...playerList].sort(() => Math.random() - 0.5);
    
    // Add null for bye positions
    for (let i = 0; i < byes; i++) {
      seededPlayers.push(null);
    }
    
    const matches = [];
    let matchId = 0;
    
    // Generate Round 1 matches (Week 1)
    const round1Matches = [];
    for (let i = 0; i < seededPlayers.length; i += 2) {
      const player1 = seededPlayers[i];
      const player2 = seededPlayers[i + 1];
      
      // Skip if both are byes
      if (!player1 && !player2) continue;
      
      const match = {
        id: `r1-m${matchId}`,
        round: 1,
        week: 1,
        matchNumber: matchId + 1,
        player1: player1,
        player2: player2,
        winner: null,
        score: null,
        nextMatchId: null // Will be set below
      };
      
      // Auto-advance if opponent is a bye
      if (player1 && !player2) {
        match.winner = player1;
      } else if (!player1 && player2) {
        match.winner = player2;
      }
      
      round1Matches.push(match);
      matches.push(match);
      matchId++;
    }
    
    // Generate subsequent rounds (each round = 1 week)
    let previousRoundMatches = round1Matches;
    for (let round = 2; round <= rounds; round++) {
      const roundMatches = [];
      matchId = 0;
      
      for (let i = 0; i < previousRoundMatches.length; i += 2) {
        const match = {
          id: `r${round}-m${matchId}`,
          round: round,
          week: round,
          matchNumber: matchId + 1,
          player1: null,
          player2: null,
          winner: null,
          score: null,
          nextMatchId: null
        };
        
        // Set nextMatchId for previous round matches
        if (previousRoundMatches[i]) {
          previousRoundMatches[i].nextMatchId = match.id;
        }
        if (previousRoundMatches[i + 1]) {
          previousRoundMatches[i + 1].nextMatchId = match.id;
        }
        
        roundMatches.push(match);
        matches.push(match);
        matchId++;
      }
      
      previousRoundMatches = roundMatches;
    }
    
    setBracketMatches(matches);
    setMessage(`Generated single elimination bracket with ${rounds} rounds (${n} players, ${byes} byes)`);
  };

  // Generate double elimination bracket
  const generateDoubleEliminationBracket = () => {
    if (!players || players.length < 2) {
      setError('Need at least 2 players to generate bracket');
      return;
    }

    const playerList = players.map(p => p.username || p);
    const n = playerList.length;
    
    // Calculate the number of rounds needed for winners bracket
    const rounds = Math.ceil(Math.log2(n));
    const bracketSize = Math.pow(2, rounds);
    const byes = bracketSize - n;
    
    // Shuffle players for random seeding
    const seededPlayers = [...playerList].sort(() => Math.random() - 0.5);
    
    // Add null for bye positions
    for (let i = 0; i < byes; i++) {
      seededPlayers.push(null);
    }
    
    const matches = [];
    let matchId = 0;
    
    // ===== WINNERS BRACKET =====
    
    // Generate Winners Week 1
    const winnersRound1 = [];
    for (let i = 0; i < seededPlayers.length; i += 2) {
      const player1 = seededPlayers[i];
      const player2 = seededPlayers[i + 1];
      
      if (!player1 && !player2) continue;
      
      const match = {
        id: `w1-m${matchId}`,
        bracket: 'winners',
        round: 1,
        week: 1,
        matchNumber: matchId + 1,
        player1: player1,
        player2: player2,
        winner: null,
        loser: null,
        score: null,
        nextMatchId: null,
        loserNextMatchId: null
      };
      
      // Auto-advance if opponent is a bye
      if (player1 && !player2) {
        match.winner = player1;
        match.loser = null;
      } else if (!player1 && player2) {
        match.winner = player2;
        match.loser = null;
      }
      
      winnersRound1.push(match);
      matches.push(match);
      matchId++;
    }
    
    // Generate subsequent winners rounds
    let previousWinnersRound = winnersRound1;
    for (let round = 2; round <= rounds; round++) {
      const roundMatches = [];
      matchId = 0;
      
      // Each winners round is 2 weeks apart (to allow for losers bracket rounds in between)
      const week = 1 + (round - 1) * 2;
      
      for (let i = 0; i < previousWinnersRound.length; i += 2) {
        const match = {
          id: `w${round}-m${matchId}`,
          bracket: 'winners',
          round: round,
          week: week,
          matchNumber: matchId + 1,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          score: null,
          nextMatchId: null,
          loserNextMatchId: null
        };
        
        // Set nextMatchId for previous round winners
        if (previousWinnersRound[i]) {
          previousWinnersRound[i].nextMatchId = match.id;
        }
        if (previousWinnersRound[i + 1]) {
          previousWinnersRound[i + 1].nextMatchId = match.id;
        }
        
        roundMatches.push(match);
        matches.push(match);
        matchId++;
      }
      
      previousWinnersRound = roundMatches;
    }
    
    // ===== LOSERS BRACKET =====
    
    // Losers bracket has (2 * rounds - 1) rounds
    const losersRounds = 2 * rounds - 1;
    let losersMatchId = 0;
    
    // First losers round receives losers from Winners Round 1 (Week 2)
    const losersRound1 = [];
    for (let i = 0; i < winnersRound1.length; i += 2) {
      const match = {
        id: `l1-m${losersMatchId}`,
        bracket: 'losers',
        round: 1,
        week: 2,
        matchNumber: losersMatchId + 1,
        player1: null,
        player2: null,
        winner: null,
        loser: null,
        score: null,
        nextMatchId: null,
        loserNextMatchId: null // Losers bracket losers are eliminated
      };
      
      // Set loserNextMatchId for winners round 1 matches
      if (winnersRound1[i]) {
        winnersRound1[i].loserNextMatchId = match.id;
      }
      if (winnersRound1[i + 1]) {
        winnersRound1[i + 1].loserNextMatchId = match.id;
      }
      
      losersRound1.push(match);
      matches.push(match);
      losersMatchId++;
    }
    
    // Generate remaining losers rounds (alternating between "drop-down" and "consolidation" rounds)
    let previousLosersRound = losersRound1;
    let winnersRoundIndex = 2; // Start with Winners Round 2 for drop-downs
    
    for (let lRound = 2; lRound <= losersRounds; lRound++) {
      const isDropDownRound = lRound % 2 === 0; // Even rounds receive new losers from winners
      const roundMatches = [];
      losersMatchId = 0;
      
      // Calculate week: losers rounds happen between winners rounds
      // Week pattern: W1->L1(W2)->L2(W3)->W2(W4)->L3(W5)->L4(W6)->W3(W7)...
      const week = 2 + lRound - 1;
      
      const numMatches = isDropDownRound 
        ? previousLosersRound.length 
        : Math.ceil(previousLosersRound.length / 2);
      
      for (let i = 0; i < numMatches; i++) {
        const match = {
          id: `l${lRound}-m${losersMatchId}`,
          bracket: 'losers',
          round: lRound,
          week: week,
          matchNumber: losersMatchId + 1,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          score: null,
          nextMatchId: null,
          loserNextMatchId: null
        };
        
        if (isDropDownRound) {
          // Drop-down round: winners from previous losers round vs losers from winners bracket
          if (previousLosersRound[i]) {
            previousLosersRound[i].nextMatchId = match.id;
          }
          
          // Connect losers from winners bracket
          const winnersRoundMatches = matches.filter(m => m.bracket === 'winners' && m.round === winnersRoundIndex);
          if (winnersRoundMatches[i]) {
            winnersRoundMatches[i].loserNextMatchId = match.id;
          }
        } else {
          // Consolidation round: pair up winners from previous losers round
          if (previousLosersRound[i * 2]) {
            previousLosersRound[i * 2].nextMatchId = match.id;
          }
          if (previousLosersRound[i * 2 + 1]) {
            previousLosersRound[i * 2 + 1].nextMatchId = match.id;
          }
        }
        
        roundMatches.push(match);
        matches.push(match);
        losersMatchId++;
      }
      
      if (isDropDownRound) {
        winnersRoundIndex++;
      }
      
      previousLosersRound = roundMatches;
    }
    
    // ===== GRAND FINALS =====
    const grandFinalsWeek = 2 + losersRounds;
    
    const grandFinals = {
      id: 'grand-finals',
      bracket: 'finals',
      round: 1,
      week: grandFinalsWeek,
      matchNumber: 1,
      player1: null, // Winner of winners bracket
      player2: null, // Winner of losers bracket
      winner: null,
      loser: null,
      score: null,
      nextMatchId: null,
      loserNextMatchId: null
    };
    
    // Connect winners bracket finals to grand finals
    const winnersBracketFinals = matches.filter(m => m.bracket === 'winners' && m.round === rounds);
    if (winnersBracketFinals[0]) {
      winnersBracketFinals[0].nextMatchId = 'grand-finals';
    }
    
    // Connect losers bracket finals to grand finals
    if (previousLosersRound.length > 0) {
      previousLosersRound[0].nextMatchId = 'grand-finals';
    }
    
    matches.push(grandFinals);
    
    // Optional: Grand Finals Reset (if losers bracket winner wins first grand finals)
    const grandFinalsReset = {
      id: 'grand-finals-reset',
      bracket: 'finals',
      round: 2,
      week: grandFinalsWeek + 1,
      matchNumber: 2,
      player1: null,
      player2: null,
      winner: null,
      loser: null,
      score: null,
      nextMatchId: null,
      loserNextMatchId: null
    };
    
    matches.push(grandFinalsReset);
    
    setBracketMatches(matches);
    setMessage(`Generated double elimination bracket (${n} players, ${byes} byes, ${matches.length} total matches)`);
  };

  // Generate Swiss system bracket
  const generateSwissBracket = () => {
    if (!players || players.length < 2) {
      setError('Need at least 2 players to generate bracket');
      return;
    }

    const playerList = players.map(p => p.username || p);
    const n = playerList.length;
    
    // Calculate number of rounds (typically log2(n) rounded up, or specified by league)
    const numRounds = Math.ceil(Math.log2(n));
    
    // Initialize player standings (wins, losses, buchholz score, etc.)
    const standings = playerList.map(name => ({
      name,
      wins: 0,
      losses: 0,
      draws: 0,
      opponents: [], // Track who they've played
      buchholz: 0 // Tiebreaker: sum of opponents' scores
    }));
    
    const matches = [];
    let matchId = 0;
    
    // Generate Round 1 (Week 1) - random or seeded pairing
    const shuffledPlayers = [...playerList].sort(() => Math.random() - 0.5);
    const hasOddPlayers = n % 2 === 1;
    
    // Round 1: pair players sequentially
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      const player1 = shuffledPlayers[i];
      const player2 = shuffledPlayers[i + 1] || null; // null = bye
      
      const match = {
        id: `r1-m${matchId}`,
        round: 1,
        week: 1,
        matchNumber: matchId + 1,
        player1: player1,
        player2: player2,
        winner: player2 ? null : player1, // Auto-win if bye
        score: null,
        pairing: 'initial'
      };
      
      matches.push(match);
      matchId++;
    }
    
    // Generate placeholder matches for subsequent rounds (each round = 1 week)
    // In Swiss system, pairings are determined after each round completes based on standings
    for (let round = 2; round <= numRounds; round++) {
      matchId = 0;
      const numMatches = Math.floor(n / 2); // Always same number of matches per round
      
      for (let i = 0; i < numMatches; i++) {
        const match = {
          id: `r${round}-m${matchId}`,
          round: round,
          week: round,
          matchNumber: matchId + 1,
          player1: null, // TBD based on previous round results
          player2: null,
          winner: null,
          score: null,
          pairing: 'pending' // Will be calculated after previous round
        };
        
        matches.push(match);
        matchId++;
      }
      
      // Handle bye if odd number of players
      if (hasOddPlayers) {
        const byeMatch = {
          id: `r${round}-bye`,
          round: round,
          week: round,
          matchNumber: 'bye',
          player1: null, // Lowest-ranked player who hasn't had bye
          player2: null,
          winner: null, // Will be set to player1 automatically
          score: null,
          pairing: 'bye'
        };
        matches.push(byeMatch);
      }
    }
    
    setBracketMatches(matches);
    setMessage(`Generated Swiss system bracket: ${numRounds} rounds, ${n} players`);
  };

  // Calculate Swiss pairings for next round based on current standings
  const calculateSwissPairings = (weekNumber) => {
    // Get all matches up to the previous week
    const previousMatches = bracketMatches.filter(m => m.week < weekNumber);
    
    // Calculate current standings
    const standings = {};
    players.forEach(p => {
      const name = p.username || p;
      standings[name] = {
        name,
        wins: 0,
        losses: 0,
        draws: 0,
        opponents: [],
        points: 0
      };
    });
    
    // Process completed matches
    previousMatches.forEach(match => {
      if (match.winner) {
        const loser = match.player1 === match.winner ? match.player2 : match.player1;
        
        standings[match.winner].wins++;
        standings[match.winner].points += 1;
        standings[match.winner].opponents.push(loser);
        
        if (loser) {
          standings[loser].losses++;
          standings[loser].opponents.push(match.winner);
        }
      }
    });
    
    // Sort players by points (wins), then by buchholz (opponents' points)
    const sortedPlayers = Object.values(standings).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      
      // Tiebreaker: Buchholz (sum of opponents' points)
      const aBuchholz = a.opponents.reduce((sum, opp) => sum + (standings[opp]?.points || 0), 0);
      const bBuchholz = b.opponents.reduce((sum, opp) => sum + (standings[opp]?.points || 0), 0);
      return bBuchholz - aBuchholz;
    });
    
    // Pair players with similar scores, avoiding rematches
    const paired = new Set();
    const newPairings = [];
    
    for (let i = 0; i < sortedPlayers.length; i++) {
      if (paired.has(sortedPlayers[i].name)) continue;
      
      // Find best opponent: same score, haven't played before
      let opponent = null;
      for (let j = i + 1; j < sortedPlayers.length; j++) {
        const candidate = sortedPlayers[j];
        if (paired.has(candidate.name)) continue;
        if (sortedPlayers[i].opponents.includes(candidate.name)) continue; // No rematches
        
        opponent = candidate;
        break;
      }
      
      // If no valid opponent found (everyone at this score already played), pair with closest score
      if (!opponent) {
        for (let j = i + 1; j < sortedPlayers.length; j++) {
          const candidate = sortedPlayers[j];
          if (paired.has(candidate.name)) continue;
          opponent = candidate;
          break;
        }
      }
      
      if (opponent) {
        newPairings.push({
          player1: sortedPlayers[i].name,
          player2: opponent.name
        });
        paired.add(sortedPlayers[i].name);
        paired.add(opponent.name);
      } else {
        // Bye for this player
        newPairings.push({
          player1: sortedPlayers[i].name,
          player2: null
        });
        paired.add(sortedPlayers[i].name);
      }
    }
    
    // Update matches for this week
    const updatedMatches = bracketMatches.map(match => {
      if (match.week === weekNumber) {
        const pairingIndex = match.matchNumber === 'bye' ? newPairings.length - 1 : match.matchNumber - 1;
        const pairing = newPairings[pairingIndex];
        
        if (pairing) {
          return {
            ...match,
            player1: pairing.player1,
            player2: pairing.player2,
            winner: pairing.player2 ? null : pairing.player1, // Auto-win if bye
            pairing: pairing.player2 ? 'calculated' : 'bye'
          };
        }
      }
      return match;
    });
    
    setBracketMatches(updatedMatches);
    setMessage(`Calculated pairings for Week ${weekNumber}`);
  };

  const generateBracket = () => {
    if (currentLeague?.bracketType === 'round_robin') {
      generateRoundRobinMatches();
    } else if (currentLeague?.bracketType === 'single_elimination') {
      generateSingleEliminationBracket();
    } else if (currentLeague?.bracketType === 'double_elimination') {
      generateDoubleEliminationBracket();
    } else if (currentLeague?.bracketType === 'swiss') {
      generateSwissBracket();
    } else {
      setError(`Bracket type "${currentLeague?.bracketType}" not yet implemented`);
    }
  };

  const updateMatchResult = (matchId, winner, score) => {
    setBracketMatches(prev => 
      prev.map(match => 
        match.id === matchId 
          ? { ...match, winner, score }
          : match
      )
    );
  };

  const updateMatchWeek = (matchId, week) => {
    setBracketMatches(prev => 
      prev.map(match => 
        match.id === matchId 
          ? { ...match, week: parseInt(week) }
          : match
      )
    );
  };

  const handleExportWeekToCalendar = (weekNumber, matches) => {
    setExportWeekNumber(weekNumber);
    setExportWeekMatches(matches);
    setExportDate(new Date());
    setShowExportCalendarModal(true);
  };

  const handleConfirmExportToCalendar = async () => {
    if (!exportWeekMatches || exportWeekMatches.length === 0) {
      setError('No matches to export');
      return;
    }

    try {
      setLoading(true);
      
      // Build all events first, then update schedule once
      const updatedSchedule = [...(currentLeague.schedule || [])];
      
      // Create calendar events for each match
      for (const match of exportWeekMatches) {
        if (match.player1 && match.player2) {
          const matchPlayers = [match.player1, match.player2].filter(p => p !== 'TBD' && p !== null);
          
          if (matchPlayers.length === 2) {
            const eventData = {
              id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              date: exportDate,
              type: 'match',
              notes: `Week ${exportWeekNumber} - Match ${match.matchNumber}: ${match.player1} vs ${match.player2}`,
              players: matchPlayers
            };

            updatedSchedule.push(eventData);
            // Small delay to ensure unique timestamps
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      }

      // Update schedule once with all events
      await updateLeagueSchedule(currentLeague.code, username, updatedSchedule);

      // Refresh events by updating the currentLeague schedule
      setCurrentLeague(prev => ({
        ...prev,
        schedule: updatedSchedule
      }));
      setEvents(updatedSchedule);

      setMessage(`Successfully exported ${exportWeekMatches.filter(m => m.player1 && m.player2).length} matches to calendar for Week ${exportWeekNumber}`);
      setShowExportCalendarModal(false);
      setShowBracketModal(false);
      setError('');
    } catch (err) {
      setError('Failed to export matches to calendar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReplay = (match) => {
    setSelectedMatchForReplay(match);
    setReplayLink(match.replay || '');
    setShowReplayModal(true);
  };

  const handleSaveReplay = async () => {
    if (!selectedMatchForReplay) return;

    try {
      setLoading(true);
      
      // Update the match with the replay link
      const updatedMatches = bracketMatches.map(m => {
        if (m.id === selectedMatchForReplay.id) {
          return { ...m, replay: replayLink };
        }
        return m;
      });

      setBracketMatches(updatedMatches);

      // Save to backend
      await updateLeague(currentLeague.code, {
        bracket: {
          type: currentLeague.bracketType,
          matches: updatedMatches
        }
      });

      setMessage('Replay link saved successfully');
      setShowReplayModal(false);
      setSelectedMatchForReplay(null);
      setReplayLink('');
    } catch (err) {
      setError('Failed to save replay link: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLeagueSettings = async () => {
    if (!currentLeague) return;
    
    try {
      setLoading(true);
      await updateLeague(currentLeague.code, {
        status: currentLeague.status,
        maxPlayers: currentLeague.maxPlayers,
        leagueWeeks: currentLeague.leagueWeeks,
        bracketType: currentLeague.bracketType,
        splitIntoPools: currentLeague.splitIntoPools,
        numPools: currentLeague.numPools
      });
      
      setShowEditLeagueModal(false);
      setMessage('League settings updated successfully!');
      setError('');
    } catch (err) {
      setError('Failed to update league settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter leagues based on status and format
  const filteredLeagues = leagues.filter(league => {
    const statusMatch = statusFilter === 'all' || league.status === statusFilter;
    const formatMatch = formatFilter === 'all' || league.format === formatFilter;
    return statusMatch && formatMatch;
  });

  // Get unique formats from all leagues for filter dropdown
  const availableFormats = ['all', ...new Set(leagues.map(l => l.format))];

  return (
    <div className="league-manager">
      {view !== 'view' && (
        <div className="league-nav">
          <button 
            className={view === 'dashboard' ? 'active' : ''} 
            onClick={() => setView('dashboard')}
          >
            League Dashboard
          </button>
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
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {view === 'dashboard' && (
        <div className="dashboard-section">
          <h2>My Leagues</h2>
          {!username ? (
            <p>Please log in to view your leagues</p>
          ) : loading ? (
            <p>Loading...</p>
          ) : myLeagues.length === 0 ? (
            <p>You are not active in any leagues. Browse or create a league to get started!</p>
          ) : (
            <>
              {/* Leagues you host */}
              {myLeagues.filter(l => l.role === 'host').length > 0 && (
                <>
                  <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#1d8ca8' }}>
                    Leagues You Host
                  </h3>
                  <div className="leagues-grid">
                    {myLeagues.filter(l => l.role === 'host').map(league => (
                      <div key={league._id} className="league-card league-card-host">
                        <div className="league-role-badge">Host</div>
                        <h3>{league.name}</h3>
                        <p><strong>Code:</strong> {league.code}</p>
                        <p><strong>Format:</strong> {league.format}</p>
                        <p><strong>Status:</strong> {league.status}</p>
                        <p><strong>Rules:</strong></p>
                        <ul>
                          <li>Points Limit: {league.rules.pointsLimit}</li>
                          <li>Team Size: {league.rules.teamSize}</li>
                        </ul>
                        <button onClick={() => handleViewLeague(league.code)}>
                          Manage League
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              {/* Leagues you're a player in */}
              {myLeagues.filter(l => l.role === 'player').length > 0 && (
                <>
                  <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#1d8ca8' }}>
                    Leagues You're Playing In
                  </h3>
                  <div className="leagues-grid">
                    {myLeagues.filter(l => l.role === 'player').map(league => (
                      <div key={league._id} className="league-card league-card-player">
                        <div className="league-role-badge">Player</div>
                        <h3>{league.name}</h3>
                        <p><strong>Code:</strong> {league.code}</p>
                        <p><strong>Format:</strong> {league.format}</p>
                        <p><strong>Status:</strong> {league.status}</p>
                        <p><strong>Rules:</strong></p>
                        <ul>
                          <li>Points Limit: {league.rules.pointsLimit}</li>
                          <li>Team Size: {league.rules.teamSize}</li>
                        </ul>
                        <button onClick={() => handleViewLeague(league.code)}>
                          View League
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {view === 'browse' && (
        <div className="browse-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Browse Leagues</h2>
            <button 
              onClick={() => setShowInviteCodeModal(true)}
              className="admin-btn"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Join by Invite Code
            </button>
          </div>
          
          <div className="filters-row">
            <div className="filter-group">
              <label>Status:</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="open">Actively Recruiting</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Closed</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Format:</label>
              <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
                {availableFormats.map(fmt => (
                  <option key={fmt} value={fmt}>
                    {fmt === 'all' ? 'All Formats' : fmt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : filteredLeagues.length === 0 ? (
            <p>No leagues found matching your filters.</p>
          ) : (
            <div className="leagues-grid">
              {filteredLeagues.map(league => (
                <div key={league._id} className="league-card">
                  <h3>{league.name}</h3>
                  <p><strong>Code:</strong> {league.code}</p>
                  <p><strong>Format:</strong> {league.format}</p>
                  <p><strong>Commissioner:</strong> {league.commissionerName}</p>
                  <p><strong>Status:</strong> {league.status}</p>
                  <p><strong>Rules:</strong></p>
                  <ul>
                    <li>Points Limit: {league.rules.pointsLimit}</li>
                    <li>Team Size: {league.rules.teamSize}</li>
                    <li>Generations: {league.rules.allowedGenerations?.join(', ')}</li>
                  </ul>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleViewLeague(league.code)}>
                      View Details
                    </button>
                    {league.status === 'open' && !players.some(p => (p.username || p) === username) && (
                      <button 
                        onClick={() => handleRequestToJoin(league.code)}
                        style={{ background: '#10b981' }}
                      >
                        Request to Join
                      </button>
                    )}
                  </div>
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
              <label>Visibility:</label>
              <select value={isPublic ? 'public' : 'private'} onChange={(e) => setIsPublic(e.target.value === 'public')}>
                <option value="public">Public - Anyone can find and join</option>
                <option value="private">Private - Only visible with league code</option>
              </select>
            </div>

            <div className="form-group">
              <label>Max Players:</label>
              <input
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 1)}
                min="1"
                max="24"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={splitIntoPools}
                  onChange={(e) => setSplitIntoPools(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Split players into draft pools?
              </label>
              <div style={{ marginTop: '10px', marginLeft: '30px' }}>
                <label style={{ fontSize: '13px', color: splitIntoPools ? '#333' : '#94a3b8' }}>
                  Number of Pools:
                </label>
                <input
                  type="number"
                  value={numPools}
                  onChange={(e) => setNumPools(parseInt(e.target.value) || 1)}
                  min="1"
                  max="6"
                  disabled={!splitIntoPools}
                  style={{ marginTop: '5px' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>League Duration (weeks):</label>
              <input
                type="number"
                value={leagueWeeks}
                onChange={(e) => setLeagueWeeks(parseInt(e.target.value) || 1)}
                min="1"
                max="52"
                required
              />
            </div>

            <div className="form-group">
              <label>Bracket Type:</label>
              <select value={bracketType} onChange={(e) => setBracketType(e.target.value)}>
                <option value="round_robin">Round Robin</option>
                <option value="swiss">Swiss</option>
                <option value="single_elimination">Single Elimination</option>
                <option value="group_stage">Group Stage</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Creating...' : 'Create League'}
            </button>
          </form>
        </div>
      )}

      {view === 'view' && currentLeague && (
        <div className="view-section">
          <button onClick={() => setView('dashboard')} className="back-btn">
            ← Back to Dashboard
          </button>
          
          {/* Admin View */}
          {currentLeague.commissionerName === username ? (
            <>
              <div className="league-view-header">
                <h2>{currentLeague.name}</h2>
                <span className="admin-badge">Administrator</span>
              </div>

              <div className="league-info-grid">
                <div className="league-info-item">
                  <div className="league-info-label">League Code</div>
                  <div className="league-info-value">{currentLeague.code}</div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Commissioner</div>
                  <div className="league-info-value">{currentLeague.commissionerName || currentLeague.commissioner}</div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Status</div>
                  <div className="league-info-value">
                    <span className={`status-badge ${currentLeague.status}`}>
                      {currentLeague.status}
                    </span>
                  </div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Visibility</div>
                  <div className="league-info-value">{currentLeague.isPublic ? 'Public' : 'Private'}</div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Max Players</div>
                  <div className="league-info-value">{currentLeague.maxPlayers || 'Unlimited'}</div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Duration</div>
                  <div className="league-info-value">{currentLeague.leagueWeeks || 'Not set'} weeks</div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Bracket Type</div>
                  <div className="league-info-value">
                    {currentLeague.bracketType ? currentLeague.bracketType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Not set'}
                  </div>
                </div>
                {currentLeague.splitIntoPools && (
                  <div className="league-info-item">
                    <div className="league-info-label">Draft Pools</div>
                    <div className="league-info-value">{currentLeague.numPools || 1} pools</div>
                  </div>
                )}
              </div>

              <div className="admin-section">
                <h3>League Management</h3>
                <div className="admin-buttons">
                  <button onClick={() => setShowEditLeagueModal(true)} className="admin-btn">Edit League Settings</button>
                  <button onClick={() => setShowBracketModal(true)} className="admin-btn">Bracket</button>
                  <button onClick={() => setShowManagePlayersModal(true)} className="admin-btn">Manage Players</button>
                  <button onClick={() => setShowDraftFormatModal(true)} className="admin-btn">Set Draft Format</button>
                  <button onClick={() => setShowScheduleModal(true)} className="admin-btn">Edit Schedule</button>
                </div>
              </div>

              {/* Schedule Section */}
              <div className="league-section">
                <h3>Schedule</h3>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px' }}>
                  {/* Week Navigation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <button 
                      onClick={() => {
                        const newWeek = new Date(currentWeekStart);
                        newWeek.setDate(newWeek.getDate() - 7);
                        setCurrentWeekStart(newWeek);
                      }}
                      className="back-btn"
                      style={{ padding: '5px 15px' }}
                    >
                      ← Previous Week
                    </button>
                    <span style={{ fontWeight: '600', fontSize: '15px' }}>
                      {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button 
                      onClick={() => {
                        const newWeek = new Date(currentWeekStart);
                        newWeek.setDate(newWeek.getDate() + 7);
                        setCurrentWeekStart(newWeek);
                      }}
                      className="admin-btn"
                      style={{ padding: '5px 15px' }}
                    >
                      Next Week →
                    </button>
                  </div>

                  {/* Week View */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', overflow: 'visible' }}>
                    {Array.from({ length: 7 }).map((_, index) => {
                      const day = new Date(currentWeekStart);
                      day.setDate(day.getDate() + index);
                      const dayEvents = events.filter(e => 
                        new Date(e.date).toDateString() === day.toDateString()
                      );
                      const isToday = day.toDateString() === new Date().toDateString();

                      return (
                        <div 
                          key={index}
                          style={{
                            border: isToday ? '2px solid #1d8ca8' : '1px solid #e0e0e0',
                            borderRadius: '6px',
                            padding: '10px',
                            background: isToday ? '#e6f7ff' : '#f8f9fa',
                            minHeight: '120px',
                            overflow: 'visible',
                            position: 'relative'
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '3px' }}>
                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>
                            {day.getDate()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'visible', position: 'relative' }}>
                            {dayEvents.map(event => (
                              <div
                                key={event.id}
                                style={{
                                  position: 'relative'
                                }}
                                onMouseEnter={() => setHoveredEvent(event.id)}
                                onMouseLeave={() => setHoveredEvent(null)}
                              >
                                <div
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: '#fff',
                                    background:
                                      event.type === 'draft_start' ? '#8b5cf6' :
                                      event.type === 'match' ? '#3b82f6' :
                                      event.type === 'meeting' ? '#10b981' :
                                      event.type === 'playoffs_start' ? '#ec4899' :
                                      event.type === 'playoffs_end' ? '#f97316' :
                                      event.type === 'league_end' ? '#ef4444' :
                                      '#f59e0b',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {event.type.replace(/_/g, ' ')}
                                </div>
                                {hoveredEvent === event.id && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '0',
                                    marginTop: '4px',
                                    background: '#fff',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    padding: '10px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    zIndex: 1000,
                                    minWidth: '200px',
                                    whiteSpace: 'normal',
                                    color: '#333',
                                    fontSize: '12px'
                                  }}>
                                    <div style={{ fontWeight: '700', marginBottom: '6px', color:
                                      event.type === 'draft_start' ? '#8b5cf6' :
                                      event.type === 'match' ? '#3b82f6' :
                                      event.type === 'meeting' ? '#10b981' :
                                      event.type === 'playoffs_start' ? '#ec4899' :
                                      event.type === 'playoffs_end' ? '#f97316' :
                                      event.type === 'league_end' ? '#ef4444' :
                                      '#f59e0b'
                                    }}>
                                      {event.type.replace(/_/g, ' ').toUpperCase()}
                                    </div>
                                    {event.notes && (
                                      <div style={{ marginBottom: '8px', fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
                                        {event.notes}
                                      </div>
                                    )}
                                    {event.players && event.players.length > 0 && (
                                      <div>
                                        <div style={{ fontWeight: '600', fontSize: '10px', color: '#888', marginBottom: '4px' }}>PLAYERS:</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                          {event.players.map(player => (
                                            <span key={player} style={{ background: '#e0e0e0', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', color: '#333' }}>
                                              {player}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="league-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Players</h3>
                    <p className="player-count" style={{ margin: '5px 0 0 0' }}>{players.length}/{currentLeague.maxPlayers || '∞'} players</p>
                  </div>
                  {!players.some(p => p.username === username) && (
                    <button onClick={handleJoinAsPlayer} className="admin-btn" style={{ margin: 0 }}>
                      Join as Player?
                    </button>
                  )}
                </div>
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
                            <td>{player.wins || 0}</td>
                            <td>{player.losses || 0}</td>
                            <td>{winRate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Rules Section - Visible to all, editable by admin */}
              <div className="league-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0 }}>League Rules</h3>
                  {currentLeague.commissionerName === username && (
                    <div>
                      {isEditingRules ? (
                        <>
                          <button onClick={handleSaveRules} className="admin-btn" style={{ margin: '0 8px 0 0' }}>
                            Save Rules
                          </button>
                          <button onClick={() => setIsEditingRules(false)} className="back-btn" style={{ margin: 0 }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setIsEditingRules(true)} className="admin-btn" style={{ margin: 0 }}>
                          Edit Rules
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#1d8ca8', marginBottom: '8px' }}>Draft Rules</h4>
                  {isEditingRules && currentLeague.commissionerName === username ? (
                    <textarea
                      value={draftRules}
                      onChange={(e) => setDraftRules(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '300px',
                        padding: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        resize: 'vertical'
                      }}
                    />
                  ) : (
                    <div style={{
                      background: '#f8f9fa',
                      padding: '15px',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'pre-wrap',
                      fontSize: '14px',
                      lineHeight: '1.6'
                    }}>
                      {draftRules}
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ color: '#1d8ca8', marginBottom: '8px' }}>Battle Rules</h4>
                  {isEditingRules && currentLeague.commissionerName === username ? (
                    <textarea
                      value={battleRules}
                      onChange={(e) => setBattleRules(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '300px',
                        padding: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        resize: 'vertical'
                      }}
                    />
                  ) : (
                    <div style={{
                      background: '#f8f9fa',
                      padding: '15px',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'pre-wrap',
                      fontSize: '14px',
                      lineHeight: '1.6'
                    }}>
                      {battleRules}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Player View */
            <>
              <div className="league-view-header">
                <h2>{currentLeague.name}</h2>
              </div>

              <div className="league-info-grid">
                <div className="league-info-item">
                  <div className="league-info-label">League Code</div>
                  <div className="league-info-value">{currentLeague.code}</div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Commissioner</div>
                  <div className="league-info-value">{currentLeague.commissionerName || currentLeague.commissioner}</div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Status</div>
                  <div className="league-info-value">
                    <span className={`status-badge ${currentLeague.status}`}>
                      {currentLeague.status}
                    </span>
                  </div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Duration</div>
                  <div className="league-info-value">{currentLeague.leagueWeeks || 'Not set'} weeks</div>
                </div>
                <div className="league-info-item">
                  <div className="league-info-label">Bracket Type</div>
                  <div className="league-info-value">
                    {currentLeague.bracketType ? currentLeague.bracketType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Not set'}
                  </div>
                </div>
              </div>

              <div className="league-section">
                <h3>Standings</h3>
                <p className="player-count">{players.length} players</p>
                {loading ? (
                  <p>Loading standings...</p>
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
                            <td>{player.wins || 0}</td>
                            <td>{player.losses || 0}</td>
                            <td>{winRate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Rules Section - Read-only for players */}
              <div className="league-section">
                <h3>League Rules</h3>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#1d8ca8', marginBottom: '8px' }}>Draft Rules</h4>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    whiteSpace: 'pre-wrap',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}>
                    {draftRules}
                  </div>
                </div>

                <div>
                  <h4 style={{ color: '#1d8ca8', marginBottom: '8px' }}>Battle Rules</h4>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    whiteSpace: 'pre-wrap',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}>
                    {battleRules}
                  </div>
                </div>
              </div>

              {/* Schedule Section - Player View */}
              <div className="league-section">
                <h3>Schedule</h3>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px' }}>
                  {/* Week Navigation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <button 
                      onClick={() => {
                        const newWeek = new Date(currentWeekStart);
                        newWeek.setDate(newWeek.getDate() - 7);
                        setCurrentWeekStart(newWeek);
                      }}
                      className="back-btn"
                      style={{ padding: '5px 15px' }}
                    >
                      ← Previous Week
                    </button>
                    <span style={{ fontWeight: '600', fontSize: '15px' }}>
                      {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button 
                      onClick={() => {
                        const newWeek = new Date(currentWeekStart);
                        newWeek.setDate(newWeek.getDate() + 7);
                        setCurrentWeekStart(newWeek);
                      }}
                      className="admin-btn"
                      style={{ padding: '5px 15px' }}
                    >
                      Next Week →
                    </button>
                  </div>

                  {/* Week View */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', overflow: 'visible' }}>
                    {Array.from({ length: 7 }).map((_, index) => {
                      const day = new Date(currentWeekStart);
                      day.setDate(day.getDate() + index);
                      const dayEvents = events.filter(e => 
                        new Date(e.date).toDateString() === day.toDateString()
                      );
                      const isToday = day.toDateString() === new Date().toDateString();

                      return (
                        <div 
                          key={index}
                          style={{
                            border: isToday ? '2px solid #1d8ca8' : '1px solid #e0e0e0',
                            borderRadius: '6px',
                            padding: '10px',
                            background: isToday ? '#e6f7ff' : '#f8f9fa',
                            minHeight: '120px',
                            overflow: 'visible',
                            position: 'relative'
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '3px' }}>
                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>
                            {day.getDate()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'visible', position: 'relative' }}>
                            {dayEvents.map(event => (
                              <div
                                key={event.id}
                                style={{
                                  position: 'relative'
                                }}
                                onMouseEnter={() => setHoveredEvent(event.id)}
                                onMouseLeave={() => setHoveredEvent(null)}
                              >
                                <div
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: '#fff',
                                    background:
                                      event.type === 'draft_start' ? '#8b5cf6' :
                                      event.type === 'match' ? '#3b82f6' :
                                      event.type === 'meeting' ? '#10b981' :
                                      event.type === 'playoffs_start' ? '#ec4899' :
                                      event.type === 'playoffs_end' ? '#f97316' :
                                      event.type === 'league_end' ? '#ef4444' :
                                      '#f59e0b',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {event.type.replace(/_/g, ' ')}
                                </div>
                                {hoveredEvent === event.id && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '0',
                                    marginTop: '4px',
                                    background: '#fff',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    padding: '10px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    zIndex: 1000,
                                    minWidth: '200px',
                                    whiteSpace: 'normal',
                                    color: '#333',
                                    fontSize: '12px'
                                  }}>
                                    <div style={{ fontWeight: '700', marginBottom: '6px', color:
                                      event.type === 'draft_start' ? '#8b5cf6' :
                                      event.type === 'match' ? '#3b82f6' :
                                      event.type === 'meeting' ? '#10b981' :
                                      event.type === 'playoffs_start' ? '#ec4899' :
                                      event.type === 'playoffs_end' ? '#f97316' :
                                      event.type === 'league_end' ? '#ef4444' :
                                      '#f59e0b'
                                    }}>
                                      {event.type.replace(/_/g, ' ').toUpperCase()}
                                    </div>
                                    {event.notes && (
                                      <div style={{ marginBottom: '8px', fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
                                        {event.notes}
                                      </div>
                                    )}
                                    {event.players && event.players.length > 0 && (
                                      <div>
                                        <div style={{ fontWeight: '600', fontSize: '10px', color: '#888', marginBottom: '4px' }}>PLAYERS:</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                          {event.players.map(player => (
                                            <span key={player} style={{ background: '#e0e0e0', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', color: '#333' }}>
                                              {player}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Draft Format Modal */}
      {showDraftFormatModal && (
        <div className="modal-overlay" onClick={() => setShowDraftFormatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Set Draft Format</h2>
              <button onClick={() => setShowDraftFormatModal(false)} className="modal-close">&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ margin: 0 }}>Format Settings</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleExportFormat} className="import-button">
                      Export Format
                    </button>
                    <input
                      id="format-import-input"
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImportFormat(e.target.files[0]);
                        }
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => document.getElementById('format-import-input').click()}
                      className="import-button"
                    >
                      Import Format
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Format Name</label>
                <input
                  type="text"
                  value={draftFormat}
                  onChange={(e) => setDraftFormat(e.target.value)}
                  placeholder="e.g., National Dex, SV OU, VGC 2024"
                />
              </div>

              <div className="form-group">
                <label>Points Limit</label>
                <input
                  type="number"
                  value={draftPointsLimit}
                  onChange={(e) => setDraftPointsLimit(Number(e.target.value))}
                  min="1"
                  max="1000"
                />
              </div>

              <div className="form-group">
                <label>Team Size</label>
                <input
                  type="number"
                  value={draftTeamSize}
                  onChange={(e) => setDraftTeamSize(Number(e.target.value))}
                  min="1"
                  max="60"
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowTrading}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      setAllowTrading(newValue);
                      if (newValue && maxTradeLimit === 0) {
                        setMaxTradeLimit(1);
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Draft Trading
                </label>
              </div>

              {allowTrading && (
                <>
                  <div className="form-group" style={{ marginLeft: '24px' }}>
                    <label>Max Trades Per Player</label>
                    <input
                      type="number"
                      min="0"
                      value={maxTradeLimit}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setMaxTradeLimit(val);
                      }}
                      disabled={unlimitedTrades}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginLeft: '24px' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={unlimitedTrades}
                        onChange={(e) => setUnlimitedTrades(e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      Allow Unlimited Trades
                    </label>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowSeasonalTrading}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      setAllowSeasonalTrading(newValue);
                      if (newValue && maxSeasonalTradeLimit === 0) {
                        setMaxSeasonalTradeLimit(1);
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Seasonal Trading
                </label>
              </div>

              {allowSeasonalTrading && (
                <>
                  <div className="form-group" style={{ marginLeft: '24px' }}>
                    <label>Max Seasonal Trades Per Player</label>
                    <input
                      type="number"
                      min="0"
                      value={maxSeasonalTradeLimit}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setMaxSeasonalTradeLimit(val);
                      }}
                      disabled={unlimitedSeasonalTrades}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginLeft: '24px' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={unlimitedSeasonalTrades}
                        onChange={(e) => setUnlimitedSeasonalTrades(e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      Allow Unlimited Seasonal Trades
                    </label>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={enableTimer}
                    onChange={(e) => setEnableTimer(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Enable Draft Timer
                </label>
              </div>

              {enableTimer && (
                <>
                  <div className="form-group" style={{ marginLeft: '24px' }}>
                    <label>1st Round Timer (format: H:MM or :MM)</label>
                    <input
                      type="text"
                      defaultValue={formatTimerMinutes(firstRoundTimer)}
                      placeholder="12:00 (12 hours)"
                      onBlur={(e) => {
                        const minutes = parseTimerInput(e.target.value);
                        if (minutes !== null) {
                          setFirstRoundTimer(minutes);
                        } else {
                          e.target.value = formatTimerMinutes(firstRoundTimer);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginLeft: '24px' }}>
                    <label>Subsequent Rounds Timer (format: H:MM or :MM)</label>
                    <input
                      type="text"
                      defaultValue={formatTimerMinutes(subsequentRoundTimer)}
                      placeholder="6:00 (6 hours)"
                      onBlur={(e) => {
                        const minutes = parseTimerInput(e.target.value);
                        if (minutes !== null) {
                          setSubsequentRoundTimer(minutes);
                        } else {
                          e.target.value = formatTimerMinutes(subsequentRoundTimer);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Generation Filter</label>
                <select
                  value={draftGenerations.length === 0 ? 0 : (draftGenerations.length === 9 ? 0 : Math.max(...draftGenerations))}
                  onChange={(e) => {
                    const maxGen = Number(e.target.value);
                    if (maxGen === 0) {
                      setDraftGenerations([1,2,3,4,5,6,7,8,9]);
                    } else {
                      const gens = [];
                      for (let i = 1; i <= maxGen; i++) {
                        gens.push(i);
                      }
                      setDraftGenerations(gens);
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  <option value={0}>All Generations</option>
                  {[1,2,3,4,5,6,7,8,9].map(gen => (
                    <option key={gen} value={gen}>Gen {gen}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Format Presets</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">-- Select Preset --</option>
                  {presetsList.map(preset => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <button
                    type="button"
                    onClick={banAllLegendaries}
                    className="admin-btn"
                    style={{ width: '100%', padding: '8px' }}
                  >
                    Ban Legendaries
                  </button>
                </div>
                <div style={{ flex: 1 }}>
                  <button
                    type="button"
                    onClick={banAllParadox}
                    className="admin-btn"
                    style={{ width: '100%', padding: '8px' }}
                  >
                    Ban Paradox
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Pokémon Point Values</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Search Pokémon to set points"
                      value={draftSearchQuery}
                      onChange={(e) => {
                        setDraftSearchQuery(e.target.value.toLowerCase());
                        setDraftSuggestionsVisible(true);
                      }}
                      onBlur={() => setTimeout(() => setDraftSuggestionsVisible(false), 150)}
                      onFocus={() => { if (draftSearchQuery) setDraftSuggestionsVisible(true); }}
                      style={{ width: '100%' }}
                    />
                    {draftSuggestionsVisible && draftSearchQuery && (
                      <div
                        className="suggestions-dropdown"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 1000,
                          background: '#fff',
                          border: '1px solid #ddd',
                          boxShadow: '0 6px 16px rgba(16,24,40,0.06)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          borderRadius: '6px',
                          marginTop: '4px'
                        }}
                      >
                        {draftPokemonList
                          .filter(p => p.name.toLowerCase().includes(draftSearchQuery))
                          .slice(0, 8)
                          .map(p => (
                            <div
                              key={p.id}
                              className="suggestion-item"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                cursor: 'pointer'
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                // Add to selected Pokemon list if not already there
                                if (!selectedPokemonForPoints.find(sp => sp.id === p.id)) {
                                  setSelectedPokemonForPoints([...selectedPokemonForPoints, p]);
                                }
                                setDraftSearchQuery('');
                                setDraftSuggestionsVisible(false);
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                            >
                              <img src={p.img} alt={p.name} style={{ width: '32px', height: '32px' }} />
                              <span>{p.name}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={pointsValueInput}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                      setPointsValueInput(val);
                    }}
                    style={{ width: '70px' }}
                  />
                  <button
                    onClick={() => {
                      if (selectedPokemonForPoints.length === 0) {
                        alert('Please select Pokémon first');
                        return;
                      }
                      const newPointsMap = { ...draftPointsMap };
                      selectedPokemonForPoints.forEach(p => {
                        newPointsMap[p.name] = pointsValueInput;
                      });
                      setDraftPointsMap(newPointsMap);
                      setSelectedPokemonForPoints([]);
                      setPointsValueInput(1);
                    }}
                    className="admin-btn"
                    style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}
                  >
                    Set Points
                  </button>
                </div>
                
                {/* Display selected Pokemon as removable chips */}
                {selectedPokemonForPoints.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {selectedPokemonForPoints.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#e0e7ff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        <img src={p.img} alt={p.name} style={{ width: '20px', height: '20px' }} />
                        <span>{p.name}</span>
                        <button
                          onClick={() =>
                            setSelectedPokemonForPoints(selectedPokemonForPoints.filter(sp => sp.id !== p.id))
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: 0,
                            lineHeight: 1,
                            color: '#6366f1'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setSelectedPokemonForPoints([])}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                )}
                <div className="PointsGrid" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {[0, ...Array.from({length:30}, (_,i) => i+1)].map((val) => (
                    <div 
                      key={val} 
                      className="PointsTile"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('drag-over');
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('drag-over');
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('drag-over');
                        
                        const pokemonName = e.dataTransfer.getData('pokemon-name');
                        if (pokemonName) {
                          setDraftPointsMap({
                            ...draftPointsMap,
                            [pokemonName]: val
                          });
                        }
                      }}
                    >
                      <div className="points-header">{val === 0 ? 'Banned' : `Points ${val}`}</div>
                      <div className="points-list">
                        {draftPokemonList.filter(p => {
                            const pm = draftPointsMap[p.name];
                            const pmNum = pm == null ? null : Number(pm);
                            if (val === 0) return pmNum === 0;
                            const effective = (pmNum == null) ? 1 : pmNum;
                            return effective === val;
                          }).filter(p => {
                            // For the Banned column (val === 0) always show banned entries
                            if (val === 0) return true;
                            return draftGenerations.includes(p.generation);
                          }).map(p => (
                          <div 
                            key={p.id} 
                            className="points-item-row"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('pokemon-name', p.name);
                              e.currentTarget.classList.add('dragging');
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.classList.remove('dragging');
                            }}
                            style={{ cursor: 'grab' }}
                          >
                            <img src={p.img} alt={p.name} className="points-sprite" />
                            <span className="points-name">{p.name}</span>
                            { (Number(draftPointsMap[p.name]) === 0) && (<span className="banned-badge">BANNED</span>) }
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                  Drag and drop Pokémon between columns to set their point values. Default is 1 point.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowDraftFormatModal(false)} className="back-btn">
                Cancel
              </button>
              <button onClick={handleSaveDraftFormat} className="admin-btn">
                Save Draft Format
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Players Modal */}
      {showManagePlayersModal && (
        <div className="modal-overlay" onClick={() => setShowManagePlayersModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <div className="modal-header">
              <h2>Manage Players</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  onClick={handleGenerateInviteCode}
                  className="admin-btn"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  Generate Invite Code
                </button>
                <button onClick={() => setShowManagePlayersModal(false)} className="modal-close">&times;</button>
              </div>
            </div>
            
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Left Column: Join Requests */}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>
                    Join Requests
                  </h3>
                  <div style={{ 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '8px', 
                    padding: '15px',
                    background: '#f8f9fa',
                    minHeight: '200px'
                  }}>
                    {currentLeague?.pendingPlayers && currentLeague.pendingPlayers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {currentLeague.pendingPlayers.map((player, index) => (
                          <div 
                            key={index}
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: '10px',
                              background: '#fff',
                              borderRadius: '6px',
                              border: '1px solid #ddd'
                            }}
                          >
                            <span style={{ fontWeight: '500', color: '#333' }}>{player}</span>
                            <button
                              onClick={() => handleAcceptPlayer(player)}
                              className="admin-btn"
                              style={{ padding: '6px 12px', fontSize: '13px' }}
                            >
                              Accept
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#666', textAlign: 'center', margin: '20px 0' }}>
                        No pending join requests
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column: Active Players */}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>
                    Active Players ({players.length})
                  </h3>
                  <div style={{ 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '8px', 
                    padding: '15px',
                    background: '#f8f9fa',
                    minHeight: '200px',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    {players.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {players.map((player, index) => (
                          <div 
                            key={index}
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: '10px',
                              background: '#fff',
                              borderRadius: '6px',
                              border: '1px solid #ddd'
                            }}
                          >
                            <span style={{ fontWeight: '500', color: '#333' }}>
                              {player.username || player}
                              {player.username === currentLeague?.commissionerName && (
                                <span style={{ 
                                  marginLeft: '8px', 
                                  fontSize: '11px', 
                                  color: '#666',
                                  background: '#e0e0e0',
                                  padding: '2px 6px',
                                  borderRadius: '3px'
                                }}>
                                  Commissioner
                                </span>
                              )}
                            </span>
                            {player.username !== currentLeague?.commissionerName && (
                              <button
                                onClick={() => handleKickPlayer(player.username || player)}
                                style={{ 
                                  padding: '6px 12px', 
                                  fontSize: '13px',
                                  background: '#dc3545',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '500'
                                }}
                                onMouseOver={(e) => e.target.style.background = '#c82333'}
                                onMouseOut={(e) => e.target.style.background = '#dc3545'}
                              >
                                Kick Player
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#666', textAlign: 'center', margin: '20px 0' }}>
                        No active players
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Code Modal */}
      {showInviteCodeModal && (
        <div className="modal-overlay" onClick={() => setShowInviteCodeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h2>Join by Invite Code</h2>
              <button onClick={() => setShowInviteCodeModal(false)} className="modal-close">&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Enter League Code:</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    fontSize: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: '600',
                    textAlign: 'center',
                    border: '2px solid #ddd',
                    borderRadius: '6px'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleJoinByInviteCode();
                    }
                  }}
                  autoFocus
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  onClick={() => {
                    setShowInviteCodeModal(false);
                    setInviteCode('');
                    setError('');
                  }}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleJoinByInviteCode}
                  className="admin-btn"
                  style={{ flex: 1, padding: '10px', fontSize: '14px' }}
                  disabled={loading}
                >
                  {loading ? 'Joining...' : 'Join League'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bracket Modal */}
      {showBracketModal && (
        <div className="modal-overlay" onClick={() => setShowBracketModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1400px', maxHeight: '90vh', width: '95%' }}>
            <div className="modal-header">
              <h2>Bracket Manager - {currentLeague?.bracketType?.replace('_', ' ').toUpperCase()}</h2>
              <button onClick={() => setShowBracketModal(false)} className="modal-close">&times;</button>
            </div>
            
            <div className="modal-body">
              {/* Controls */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <button 
                  onClick={generateBracket}
                  className="admin-btn"
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  Generate Bracket
                </button>
                <button 
                  onClick={() => setBracketMatches([])}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '14px',
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Clear All
                </button>
                <button 
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await updateLeague(currentLeague.code, {
                        bracket: {
                          type: currentLeague.bracketType,
                          matches: bracketMatches
                        }
                      });
                      setMessage('Bracket saved successfully!');
                      setError('');
                    } catch (err) {
                      setError('Failed to save bracket: ' + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '14px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Save Bracket
                </button>
                <div style={{ marginLeft: 'auto', color: '#666', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                  {bracketMatches.length} matches
                </div>
              </div>

              {/* Round Robin Match Grid */}
              {currentLeague?.bracketType === 'round_robin' && (
                <div>
                  {bracketMatches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      <p>No matches generated yet.</p>
                      <p style={{ fontSize: '14px' }}>Click "Generate Matches" to create all round-robin matchups.</p>
                    </div>
                  ) : (
                    <div>
                      {/* Group matches by week */}
                      {Array.from({ length: currentLeague.leagueWeeks }, (_, weekIndex) => {
                        const weekNumber = weekIndex + 1;
                        const weekMatches = bracketMatches.filter(m => m.week === weekNumber);
                        
                        if (weekMatches.length === 0) return null;
                        
                        return (
                          <div key={weekNumber} style={{ marginBottom: '30px' }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: '15px'
                            }}>
                              <h3 style={{ 
                                fontSize: '16px', 
                                fontWeight: '700', 
                                color: '#333',
                                margin: 0,
                                padding: '10px 15px',
                                background: '#f0f9ff',
                                borderRadius: '6px',
                                borderLeft: '4px solid #3b82f6'
                              }}>
                                Week {weekNumber} ({weekMatches.length} matches)
                              </h3>
                              
                              <button
                                onClick={() => handleExportWeekToCalendar(weekNumber, weekMatches)}
                                style={{
                                  padding: '8px 16px',
                                  fontSize: '13px',
                                  background: '#10b981',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                                title="Export week to calendar"
                              >
                                📅 Export to Calendar
                              </button>
                            </div>
                            
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                              gap: '15px',
                              padding: '10px'
                            }}>
                              {weekMatches.map((match, index) => (
                                <div 
                                  key={match.id}
                                  style={{
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '8px',
                                    padding: '15px',
                                    background: match.winner ? '#f0fdf4' : '#fff',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginBottom: '10px'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>
                                        Match {bracketMatches.indexOf(match) + 1}
                                      </span>
                                      <select
                                        value={match.week || 1}
                                        onChange={(e) => updateMatchWeek(match.id, e.target.value)}
                                        style={{
                                          padding: '2px 6px',
                                          fontSize: '11px',
                                          border: '1px solid #ddd',
                                          borderRadius: '3px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {Array.from({ length: currentLeague.leagueWeeks }, (_, i) => (
                                          <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                                        ))}
                                      </select>
                                    </div>
                                    {match.winner && (
                                      <span style={{ 
                                        fontSize: '11px', 
                                        background: '#10b981', 
                                        color: '#fff',
                                        padding: '2px 8px',
                                        borderRadius: '3px'
                                      }}>
                                        Complete
                                      </span>
                                    )}
                                  </div>

                                  {/* Players */}
                                  <div style={{ marginBottom: '12px' }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              padding: '8px',
                              background: match.winner === match.player1 ? '#d1fae5' : '#f8f9fa',
                              borderRadius: '4px',
                              marginBottom: '6px',
                              border: match.winner === match.player1 ? '2px solid #10b981' : '1px solid #e0e0e0'
                            }}>
                              <span style={{ fontWeight: match.winner === match.player1 ? '700' : '500', flex: 1 }}>
                                {match.player1}
                              </span>
                              <button
                                onClick={() => updateMatchResult(match.id, match.player1, null)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  background: match.winner === match.player1 ? '#10b981' : '#e0e0e0',
                                  color: match.winner === match.player1 ? '#fff' : '#333',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                {match.winner === match.player1 ? 'Winner' : 'Set Winner'}
                              </button>
                            </div>

                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              padding: '8px',
                              background: match.winner === match.player2 ? '#d1fae5' : '#f8f9fa',
                              borderRadius: '4px',
                              border: match.winner === match.player2 ? '2px solid #10b981' : '1px solid #e0e0e0'
                            }}>
                              <span style={{ fontWeight: match.winner === match.player2 ? '700' : '500', flex: 1 }}>
                                {match.player2}
                              </span>
                              <button
                                onClick={() => updateMatchResult(match.id, match.player2, null)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  background: match.winner === match.player2 ? '#10b981' : '#e0e0e0',
                                  color: match.winner === match.player2 ? '#fff' : '#333',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                {match.winner === match.player2 ? 'Winner' : 'Set Winner'}
                              </button>
                            </div>
                          </div>

                          {/* Score input */}
                          <input
                            type="text"
                            placeholder="Score (e.g., 2-1)"
                            value={match.score || ''}
                            onChange={(e) => updateMatchResult(match.id, match.winner, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px',
                              fontSize: '13px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              textAlign: 'center',
                              marginBottom: '8px'
                            }}
                          />

                          {/* Add Replay Button */}
                          <button
                            onClick={() => handleAddReplay(match)}
                            style={{
                              width: '100%',
                              padding: '6px',
                              fontSize: '12px',
                              background: '#6366f1',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            {match.replay ? '📝 Edit Replay' : '➕ Add Replay'}
                          </button>

                          {/* Display Replay Link */}
                          {match.replay && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px',
                              background: '#f0f9ff',
                              borderRadius: '4px',
                              fontSize: '11px',
                              wordBreak: 'break-all'
                            }}>
                              <div style={{ fontWeight: '600', marginBottom: '4px', color: '#333' }}>Replay:</div>
                              <a 
                                href={match.replay} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: '#3b82f6', textDecoration: 'none' }}
                              >
                                {match.replay}
                              </a>
                            </div>
                          )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Single Elimination Bracket Tree */}
              {currentLeague?.bracketType === 'single_elimination' && (
                <div>
                  {bracketMatches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      <p>No bracket generated yet.</p>
                      <p style={{ fontSize: '14px' }}>Click "Generate Bracket" to create single elimination bracket.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', padding: '20px' }}>
                      {/* Get round names */}
                      {(() => {
                        const maxWeek = Math.max(...bracketMatches.map(m => m.week));
                        const weekNames = [];
                        for (let w = 1; w <= maxWeek; w++) {
                          if (w === maxWeek) weekNames.push('Finals (Week ' + w + ')');
                          else if (w === maxWeek - 1) weekNames.push('Semifinals (Week ' + w + ')');
                          else if (w === maxWeek - 2) weekNames.push('Quarterfinals (Week ' + w + ')');
                          else weekNames.push(`Week ${w}`);
                        }
                        
                        return (
                          <div style={{ display: 'flex', gap: '40px', minWidth: 'fit-content' }}>
                            {Array.from({ length: maxWeek }, (_, weekIndex) => {
                              const week = weekIndex + 1;
                              const weekMatches = bracketMatches.filter(m => m.week === week);
                              
                              return (
                                <div key={week} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ 
                                      fontSize: '14px', 
                                      fontWeight: '700', 
                                      color: '#333',
                                      textAlign: 'center',
                                      margin: 0,
                                      padding: '8px 12px',
                                      background: '#f0f9ff',
                                      borderRadius: '6px'
                                    }}>
                                      {weekNames[weekIndex]}
                                    </h3>
                                    <button
                                      onClick={() => handleExportWeekToCalendar(week, weekMatches)}
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '11px',
                                        background: '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                      }}
                                      title="Export week to calendar"
                                    >
                                      📅 Export
                                    </button>
                                  </div>
                                  
                                  <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: `${Math.pow(2, weekIndex) * 30}px`,
                                    marginTop: `${Math.pow(2, weekIndex - 1) * 30}px`
                                  }}>
                                    {weekMatches.map((match) => (
                                      <div 
                                        key={match.id}
                                        style={{
                                          border: '2px solid #e0e0e0',
                                          borderRadius: '8px',
                                          padding: '12px',
                                          background: match.winner ? '#f0fdf4' : '#fff',
                                          minWidth: '220px',
                                          position: 'relative'
                                        }}
                                      >
                                        {/* Match label */}
                                        <div style={{ 
                                          fontSize: '11px', 
                                          fontWeight: '600', 
                                          color: '#666',
                                          marginBottom: '8px',
                                          textAlign: 'center'
                                        }}>
                                          Match {match.matchNumber}
                                          {match.winner && (
                                            <span style={{ 
                                              marginLeft: '8px',
                                              background: '#10b981', 
                                              color: '#fff',
                                              padding: '2px 6px',
                                              borderRadius: '3px',
                                              fontSize: '10px'
                                            }}>
                                              Complete
                                            </span>
                                          )}
                                        </div>

                                        {/* Player 1 */}
                                        <div style={{ 
                                          display: 'flex', 
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '6px 8px',
                                          background: match.winner === match.player1 ? '#d1fae5' : '#f8f9fa',
                                          borderRadius: '4px',
                                          marginBottom: '4px',
                                          border: match.winner === match.player1 ? '2px solid #10b981' : '1px solid #e0e0e0'
                                        }}>
                                          <span style={{ 
                                            fontWeight: match.winner === match.player1 ? '700' : '500',
                                            fontSize: '13px',
                                            flex: 1,
                                            color: match.player1 ? '#333' : '#999'
                                          }}>
                                            {match.player1 || 'TBD'}
                                          </span>
                                          {match.player1 && (
                                            <button
                                              onClick={() => {
                                                updateMatchResult(match.id, match.player1, null);
                                                // Auto-advance winner to next match
                                                if (match.nextMatchId) {
                                                  const nextMatch = bracketMatches.find(m => m.id === match.nextMatchId);
                                                  if (nextMatch) {
                                                    const updated = bracketMatches.map(m => {
                                                      if (m.id === match.nextMatchId) {
                                                        // Determine if this winner goes to player1 or player2 slot
                                                        const matchesInRound = bracketMatches.filter(bm => bm.round === match.round);
                                                        const matchIndexInRound = matchesInRound.findIndex(bm => bm.id === match.id);
                                                        return {
                                                          ...m,
                                                          [matchIndexInRound % 2 === 0 ? 'player1' : 'player2']: match.player1
                                                        };
                                                      }
                                                      return m;
                                                    });
                                                    setBracketMatches(updated);
                                                  }
                                                }
                                              }}
                                              style={{
                                                padding: '3px 8px',
                                                fontSize: '10px',
                                                background: match.winner === match.player1 ? '#10b981' : '#e0e0e0',
                                                color: match.winner === match.player1 ? '#fff' : '#333',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              {match.winner === match.player1 ? '✓' : 'Win'}
                                            </button>
                                          )}
                                        </div>

                                        {/* Player 2 */}
                                        <div style={{ 
                                          display: 'flex', 
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '6px 8px',
                                          background: match.winner === match.player2 ? '#d1fae5' : '#f8f9fa',
                                          borderRadius: '4px',
                                          border: match.winner === match.player2 ? '2px solid #10b981' : '1px solid #e0e0e0'
                                        }}>
                                          <span style={{ 
                                            fontWeight: match.winner === match.player2 ? '700' : '500',
                                            fontSize: '13px',
                                            flex: 1,
                                            color: match.player2 ? '#333' : '#999'
                                          }}>
                                            {match.player2 || 'TBD'}
                                          </span>
                                          {match.player2 && (
                                            <button
                                              onClick={() => {
                                                updateMatchResult(match.id, match.player2, null);
                                                // Auto-advance winner to next match
                                                if (match.nextMatchId) {
                                                  const nextMatch = bracketMatches.find(m => m.id === match.nextMatchId);
                                                  if (nextMatch) {
                                                    const updated = bracketMatches.map(m => {
                                                      if (m.id === match.nextMatchId) {
                                                        const matchesInRound = bracketMatches.filter(bm => bm.round === match.round);
                                                        const matchIndexInRound = matchesInRound.findIndex(bm => bm.id === match.id);
                                                        return {
                                                          ...m,
                                                          [matchIndexInRound % 2 === 0 ? 'player1' : 'player2']: match.player2
                                                        };
                                                      }
                                                      return m;
                                                    });
                                                    setBracketMatches(updated);
                                                  }
                                                }
                                              }}
                                              style={{
                                                padding: '3px 8px',
                                                fontSize: '10px',
                                                background: match.winner === match.player2 ? '#10b981' : '#e0e0e0',
                                                color: match.winner === match.player2 ? '#fff' : '#333',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              {match.winner === match.player2 ? '✓' : 'Win'}
                                            </button>
                                          )}
                                        </div>

                                        {/* Add Replay Button */}
                                        <button
                                          onClick={() => handleAddReplay(match)}
                                          style={{
                                            width: '100%',
                                            padding: '5px',
                                            fontSize: '10px',
                                            background: '#6366f1',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: '500',
                                            marginTop: '6px'
                                          }}
                                        >
                                          {match.replay ? '📝 Edit Replay' : '➕ Add Replay'}
                                        </button>

                                        {/* Display Replay Link */}
                                        {match.replay && (
                                          <div style={{
                                            marginTop: '6px',
                                            padding: '6px',
                                            background: '#f0f9ff',
                                            borderRadius: '4px',
                                            fontSize: '9px',
                                            wordBreak: 'break-all'
                                          }}>
                                            <div style={{ fontWeight: '600', marginBottom: '3px', color: '#333' }}>Replay:</div>
                                            <a 
                                              href={match.replay} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              style={{ color: '#3b82f6', textDecoration: 'none' }}
                                            >
                                              {match.replay}
                                            </a>
                                          </div>
                                        )}

                                        {/* Connection line to next round */}
                                        {match.nextMatchId && week < maxWeek && (
                                          <div style={{
                                            position: 'absolute',
                                            right: '-20px',
                                            top: '50%',
                                            width: '20px',
                                            height: '2px',
                                            background: '#cbd5e0',
                                            transform: 'translateY(-50%)'
                                          }} />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Unsupported bracket types */}
              {currentLeague?.bracketType && 
               currentLeague.bracketType !== 'round_robin' && 
               currentLeague.bracketType !== 'single_elimination' && 
               currentLeague.bracketType !== 'double_elimination' &&
               currentLeague.bracketType !== 'swiss' && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <p>Bracket type "{currentLeague.bracketType}" is not yet implemented.</p>
                  <p style={{ fontSize: '14px', marginTop: '10px' }}>
                    Currently supported: Round Robin, Single Elimination, Double Elimination, Swiss System
                  </p>
                </div>
              )}

              {/* Swiss System Bracket */}
              {currentLeague?.bracketType === 'swiss' && (
                <div>
                  {bracketMatches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      <p>No bracket generated yet.</p>
                      <p style={{ fontSize: '14px' }}>Click "Generate Bracket" to create Swiss system bracket.</p>
                    </div>
                  ) : (
                    <div style={{ padding: '20px' }}>
                      {/* Rounds */}
                      {(() => {
                        const maxWeek = Math.max(...bracketMatches.map(m => m.week));
                        
                        return Array.from({ length: maxWeek }, (_, weekIndex) => {
                          const week = weekIndex + 1;
                          const weekMatches = bracketMatches.filter(m => m.week === week && m.matchNumber !== 'bye');
                          const byeMatch = bracketMatches.find(m => m.week === week && m.matchNumber === 'bye');
                          
                          // Check if round is complete
                          const allMatchesComplete = weekMatches.every(m => m.winner);
                          const hasUnpairedMatches = weekMatches.some(m => !m.player1 || !m.player2);
                          
                          return (
                            <div key={week} style={{ marginBottom: '30px' }}>
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginBottom: '15px',
                                gap: '10px'
                              }}>
                                <h3 style={{ 
                                  fontSize: '16px', 
                                  fontWeight: '700', 
                                  color: '#333',
                                  padding: '10px 15px',
                                  background: '#f0f9ff',
                                  borderRadius: '6px',
                                  borderLeft: '4px solid #3b82f6',
                                  margin: 0
                                }}>
                                  Week {week} {allMatchesComplete ? '✓' : ''}
                                </h3>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  {/* Export to Calendar Button */}
                                  <button
                                    onClick={() => handleExportWeekToCalendar(week, weekMatches)}
                                    style={{
                                      padding: '8px 16px',
                                      fontSize: '13px',
                                      background: '#10b981',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontWeight: '600'
                                    }}
                                    title="Export week to calendar"
                                  >
                                    📅 Export to Calendar
                                  </button>

                                  {/* Calculate Pairings Button for future rounds */}
                                  {week > 1 && hasUnpairedMatches && (
                                    <button
                                      onClick={() => calculateSwissPairings(week)}
                                      style={{
                                        padding: '8px 16px',
                                        fontSize: '13px',
                                        background: '#3b82f6',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                      }}
                                    >
                                      Calculate Pairings
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '15px'
                              }}>
                                {weekMatches.map((match) => (
                                  <div 
                                    key={match.id}
                                    style={{
                                      border: '2px solid #e0e0e0',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      background: match.winner ? '#f0fdf4' : (!match.player1 || !match.player2 ? '#fafafa' : '#fff')
                                    }}
                                  >
                                    <div style={{ 
                                      fontSize: '11px', 
                                      fontWeight: '600', 
                                      color: '#666',
                                      marginBottom: '8px',
                                      display: 'flex',
                                      justifyContent: 'space-between'
                                    }}>
                                      <span>Match {match.matchNumber}</span>
                                      {match.pairing === 'pending' && (
                                        <span style={{ color: '#f59e0b' }}>Pending</span>
                                      )}
                                    </div>

                                    {/* Player 1 */}
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 8px',
                                      background: match.winner === match.player1 ? '#d1fae5' : '#f8f9fa',
                                      borderRadius: '4px',
                                      marginBottom: '4px',
                                      border: match.winner === match.player1 ? '2px solid #10b981' : '1px solid #e0e0e0'
                                    }}>
                                      <span style={{ 
                                        fontWeight: match.winner === match.player1 ? '700' : '500',
                                        fontSize: '13px',
                                        flex: 1,
                                        color: match.player1 ? '#333' : '#999'
                                      }}>
                                        {match.player1 || 'TBD'}
                                      </span>
                                      {match.player1 && match.player2 && (
                                        <button
                                          onClick={() => updateMatchResult(match.id, match.player1, null)}
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: '10px',
                                            background: match.winner === match.player1 ? '#10b981' : '#e0e0e0',
                                            color: match.winner === match.player1 ? '#fff' : '#333',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          {match.winner === match.player1 ? '✓' : 'Win'}
                                        </button>
                                      )}
                                    </div>

                                    {/* Player 2 */}
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 8px',
                                      background: match.winner === match.player2 ? '#d1fae5' : '#f8f9fa',
                                      borderRadius: '4px',
                                      border: match.winner === match.player2 ? '2px solid #10b981' : '1px solid #e0e0e0'
                                    }}>
                                      <span style={{ 
                                        fontWeight: match.winner === match.player2 ? '700' : '500',
                                        fontSize: '13px',
                                        flex: 1,
                                        color: match.player2 ? '#333' : '#999'
                                      }}>
                                        {match.player2 || (match.pairing === 'bye' ? 'BYE' : 'TBD')}
                                      </span>
                                      {match.player1 && match.player2 && (
                                        <button
                                          onClick={() => updateMatchResult(match.id, match.player2, null)}
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: '10px',
                                            background: match.winner === match.player2 ? '#10b981' : '#e0e0e0',
                                            color: match.winner === match.player2 ? '#fff' : '#333',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          {match.winner === match.player2 ? '✓' : 'Win'}
                                        </button>
                                      )}
                                    </div>

                                    {/* Add Replay Button */}
                                    <button
                                      onClick={() => handleAddReplay(match)}
                                      style={{
                                        width: '100%',
                                        padding: '5px',
                                        fontSize: '11px',
                                        background: '#6366f1',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        marginTop: '6px'
                                      }}
                                    >
                                      {match.replay ? '📝 Edit Replay' : '➕ Add Replay'}
                                    </button>

                                    {/* Display Replay Link */}
                                    {match.replay && (
                                      <div style={{
                                        marginTop: '6px',
                                        padding: '6px',
                                        background: '#f0f9ff',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        wordBreak: 'break-all'
                                      }}>
                                        <div style={{ fontWeight: '600', marginBottom: '3px', color: '#333' }}>Replay:</div>
                                        <a 
                                          href={match.replay} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          style={{ color: '#3b82f6', textDecoration: 'none' }}
                                        >
                                          {match.replay}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                
                                {/* Bye match if exists */}
                                {byeMatch && byeMatch.player1 && (
                                  <div 
                                    style={{
                                      border: '2px dashed #fbbf24',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      background: '#fffbeb'
                                    }}
                                  >
                                    <div style={{ 
                                      fontSize: '11px', 
                                      fontWeight: '600', 
                                      color: '#f59e0b',
                                      marginBottom: '8px'
                                    }}>
                                      Bye Round
                                    </div>
                                    <div style={{ 
                                      padding: '6px 8px',
                                      background: '#fef3c7',
                                      borderRadius: '4px',
                                      fontWeight: '600',
                                      fontSize: '13px',
                                      textAlign: 'center'
                                    }}>
                                      {byeMatch.player1} (Bye - Auto Win)
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Double Elimination Bracket */}
              {currentLeague?.bracketType === 'double_elimination' && (
                <div>
                  {bracketMatches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      <p>No bracket generated yet.</p>
                      <p style={{ fontSize: '14px' }}>Click "Generate Bracket" to create double elimination bracket.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', padding: '20px' }}>
                      {/* Winners Bracket */}
                      <div style={{ marginBottom: '40px' }}>
                        <h2 style={{ 
                          fontSize: '18px', 
                          fontWeight: '700', 
                          color: '#333',
                          marginBottom: '20px',
                          padding: '12px 20px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: '#fff',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          Winners Bracket
                        </h2>
                        
                        {(() => {
                          const winnersMatches = bracketMatches.filter(m => m.bracket === 'winners');
                          const maxWeek = Math.max(...winnersMatches.map(m => m.week));
                          const maxRound = Math.max(...winnersMatches.map(m => m.round));
                          
                          return (
                            <div style={{ display: 'flex', gap: '40px', minWidth: 'fit-content' }}>
                              {Array.from({ length: maxRound }, (_, roundIndex) => {
                                const round = roundIndex + 1;
                                const roundMatches = winnersMatches.filter(m => m.round === round);
                                const week = roundMatches[0]?.week;
                                
                                const roundNames = [];
                                for (let r = 1; r <= maxRound; r++) {
                                  if (r === maxRound) roundNames.push('WB Finals');
                                  else if (r === maxRound - 1) roundNames.push('WB Semifinals');
                                  else roundNames.push(`WB Round ${r}`);
                                }
                                
                                return (
                                  <div key={round} style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ 
                                      fontSize: '13px', 
                                      fontWeight: '700', 
                                      color: '#333',
                                      textAlign: 'center',
                                      marginBottom: '15px',
                                      padding: '6px 10px',
                                      background: '#ede9fe',
                                      borderRadius: '6px',
                                      border: '1px solid #c4b5fd'
                                    }}>
                                      {roundNames[roundIndex]} (Week {week})
                                    </h3>
                                    
                                    <div style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      gap: `${Math.pow(2, roundIndex) * 25}px`,
                                      marginTop: `${Math.pow(2, roundIndex - 1) * 25}px`
                                    }}>
                                      {roundMatches.map((match) => (
                                        <div 
                                          key={match.id}
                                          style={{
                                            border: '2px solid #c4b5fd',
                                            borderRadius: '6px',
                                            padding: '10px',
                                            background: match.winner ? '#f5f3ff' : '#fff',
                                            minWidth: '200px',
                                            position: 'relative'
                                          }}
                                        >
                                          <div style={{ 
                                            fontSize: '10px', 
                                            fontWeight: '600', 
                                            color: '#7c3aed',
                                            marginBottom: '6px',
                                            textAlign: 'center'
                                          }}>
                                            Match {match.matchNumber}
                                          </div>

                                          {/* Player 1 */}
                                          <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '5px 6px',
                                            background: match.winner === match.player1 ? '#ddd6fe' : '#f8f9fa',
                                            borderRadius: '3px',
                                            marginBottom: '3px',
                                            border: match.winner === match.player1 ? '2px solid #7c3aed' : '1px solid #e0e0e0'
                                          }}>
                                            <span style={{ 
                                              fontWeight: match.winner === match.player1 ? '700' : '500',
                                              fontSize: '12px',
                                              flex: 1,
                                              color: match.player1 ? '#333' : '#999'
                                            }}>
                                              {match.player1 || 'TBD'}
                                            </span>
                                            {match.player1 && (
                                              <button
                                                onClick={() => {
                                                  const loser = match.player2;
                                                  updateMatchResult(match.id, match.player1, null);
                                                  
                                                  // Advance winner to next winners match
                                                  if (match.nextMatchId) {
                                                    const updated = [...bracketMatches];
                                                    const nextMatch = updated.find(m => m.id === match.nextMatchId);
                                                    if (nextMatch) {
                                                      const matchesInRound = bracketMatches.filter(bm => bm.bracket === 'winners' && bm.round === match.round);
                                                      const matchIndexInRound = matchesInRound.findIndex(bm => bm.id === match.id);
                                                      nextMatch[matchIndexInRound % 2 === 0 ? 'player1' : 'player2'] = match.player1;
                                                    }
                                                    
                                                    // Send loser to losers bracket
                                                    if (loser && match.loserNextMatchId) {
                                                      const loserMatch = updated.find(m => m.id === match.loserNextMatchId);
                                                      if (loserMatch) {
                                                        const winnersRoundMatches = bracketMatches.filter(bm => bm.bracket === 'winners' && bm.round === match.round);
                                                        const idx = winnersRoundMatches.findIndex(bm => bm.id === match.id);
                                                        loserMatch[idx % 2 === 0 ? 'player1' : 'player2'] = loser;
                                                      }
                                                    }
                                                    
                                                    setBracketMatches(updated);
                                                  }
                                                }}
                                                style={{
                                                  padding: '2px 6px',
                                                  fontSize: '9px',
                                                  background: match.winner === match.player1 ? '#7c3aed' : '#e0e0e0',
                                                  color: match.winner === match.player1 ? '#fff' : '#333',
                                                  border: 'none',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                {match.winner === match.player1 ? '✓' : 'W'}
                                              </button>
                                            )}
                                          </div>

                                          {/* Player 2 */}
                                          <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '5px 6px',
                                            background: match.winner === match.player2 ? '#ddd6fe' : '#f8f9fa',
                                            borderRadius: '3px',
                                            border: match.winner === match.player2 ? '2px solid #7c3aed' : '1px solid #e0e0e0'
                                          }}>
                                            <span style={{ 
                                              fontWeight: match.winner === match.player2 ? '700' : '500',
                                              fontSize: '12px',
                                              flex: 1,
                                              color: match.player2 ? '#333' : '#999'
                                            }}>
                                              {match.player2 || 'TBD'}
                                            </span>
                                            {match.player2 && (
                                              <button
                                                onClick={() => {
                                                  const loser = match.player1;
                                                  updateMatchResult(match.id, match.player2, null);
                                                  
                                                  // Advance winner to next winners match
                                                  if (match.nextMatchId) {
                                                    const updated = [...bracketMatches];
                                                    const nextMatch = updated.find(m => m.id === match.nextMatchId);
                                                    if (nextMatch) {
                                                      const matchesInRound = bracketMatches.filter(bm => bm.bracket === 'winners' && bm.round === match.round);
                                                      const matchIndexInRound = matchesInRound.findIndex(bm => bm.id === match.id);
                                                      nextMatch[matchIndexInRound % 2 === 0 ? 'player1' : 'player2'] = match.player2;
                                                    }
                                                    
                                                    // Send loser to losers bracket
                                                    if (loser && match.loserNextMatchId) {
                                                      const loserMatch = updated.find(m => m.id === match.loserNextMatchId);
                                                      if (loserMatch) {
                                                        const winnersRoundMatches = bracketMatches.filter(bm => bm.bracket === 'winners' && bm.round === match.round);
                                                        const idx = winnersRoundMatches.findIndex(bm => bm.id === match.id);
                                                        loserMatch[idx % 2 === 0 ? 'player1' : 'player2'] = loser;
                                                      }
                                                    }
                                                    
                                                    setBracketMatches(updated);
                                                  }
                                                }}
                                                style={{
                                                  padding: '2px 6px',
                                                  fontSize: '9px',
                                                  background: match.winner === match.player2 ? '#7c3aed' : '#e0e0e0',
                                                  color: match.winner === match.player2 ? '#fff' : '#333',
                                                  border: 'none',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                {match.winner === match.player2 ? '✓' : 'W'}
                                              </button>
                                            )}
                                          </div>

                                          {match.nextMatchId && round < maxRound && (
                                            <div style={{
                                              position: 'absolute',
                                              right: '-20px',
                                              top: '50%',
                                              width: '20px',
                                              height: '2px',
                                              background: '#c4b5fd',
                                              transform: 'translateY(-50%)'
                                            }} />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Losers Bracket */}
                      <div style={{ marginBottom: '40px' }}>
                        <h2 style={{ 
                          fontSize: '18px', 
                          fontWeight: '700', 
                          marginBottom: '20px',
                          padding: '12px 20px',
                          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                          color: '#fff',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          Losers Bracket
                        </h2>
                        
                        {(() => {
                          const losersMatches = bracketMatches.filter(m => m.bracket === 'losers');
                          const maxRound = Math.max(...losersMatches.map(m => m.round));
                          
                          return (
                            <div style={{ display: 'flex', gap: '40px', minWidth: 'fit-content' }}>
                              {Array.from({ length: maxRound }, (_, roundIndex) => {
                                const round = roundIndex + 1;
                                const roundMatches = losersMatches.filter(m => m.round === round);
                                const week = roundMatches[0]?.week;
                                
                                if (roundMatches.length === 0) return null;
                                
                                return (
                                  <div key={round} style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ 
                                      fontSize: '13px', 
                                      fontWeight: '700', 
                                      color: '#333',
                                      textAlign: 'center',
                                      marginBottom: '15px',
                                      padding: '6px 10px',
                                      background: '#fce7f3',
                                      borderRadius: '6px',
                                      border: '1px solid #fbcfe8'
                                    }}>
                                      {round === maxRound ? `LB Finals (Week ${week})` : `LB Round ${round} (Week ${week})`}
                                    </h3>
                                    
                                    <div style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      gap: '20px'
                                    }}>
                                      {roundMatches.map((match) => (
                                        <div 
                                          key={match.id}
                                          style={{
                                            border: '2px solid #fbcfe8',
                                            borderRadius: '6px',
                                            padding: '10px',
                                            background: match.winner ? '#fef3f8' : '#fff',
                                            minWidth: '200px',
                                            position: 'relative'
                                          }}
                                        >
                                          <div style={{ 
                                            fontSize: '10px', 
                                            fontWeight: '600', 
                                            color: '#ec4899',
                                            marginBottom: '6px',
                                            textAlign: 'center'
                                          }}>
                                            Match {match.matchNumber}
                                          </div>

                                          <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '5px 6px',
                                            background: match.winner === match.player1 ? '#fce7f3' : '#f8f9fa',
                                            borderRadius: '3px',
                                            marginBottom: '3px',
                                            border: match.winner === match.player1 ? '2px solid #ec4899' : '1px solid #e0e0e0'
                                          }}>
                                            <span style={{ 
                                              fontWeight: match.winner === match.player1 ? '700' : '500',
                                              fontSize: '12px',
                                              flex: 1,
                                              color: match.player1 ? '#333' : '#999'
                                            }}>
                                              {match.player1 || 'TBD'}
                                            </span>
                                            {match.player1 && (
                                              <button
                                                onClick={() => {
                                                  updateMatchResult(match.id, match.player1, null);
                                                  if (match.nextMatchId) {
                                                    const updated = [...bracketMatches];
                                                    const nextMatch = updated.find(m => m.id === match.nextMatchId);
                                                    if (nextMatch) {
                                                      const matchesInRound = bracketMatches.filter(bm => bm.bracket === 'losers' && bm.round === match.round);
                                                      const idx = matchesInRound.findIndex(bm => bm.id === match.id);
                                                      nextMatch[idx % 2 === 0 ? 'player1' : 'player2'] = match.player1;
                                                    }
                                                    setBracketMatches(updated);
                                                  }
                                                }}
                                                style={{
                                                  padding: '2px 6px',
                                                  fontSize: '9px',
                                                  background: match.winner === match.player1 ? '#ec4899' : '#e0e0e0',
                                                  color: match.winner === match.player1 ? '#fff' : '#333',
                                                  border: 'none',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                {match.winner === match.player1 ? '✓' : 'W'}
                                              </button>
                                            )}
                                          </div>

                                          <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '5px 6px',
                                            background: match.winner === match.player2 ? '#fce7f3' : '#f8f9fa',
                                            borderRadius: '3px',
                                            border: match.winner === match.player2 ? '2px solid #ec4899' : '1px solid #e0e0e0'
                                          }}>
                                            <span style={{ 
                                              fontWeight: match.winner === match.player2 ? '700' : '500',
                                              fontSize: '12px',
                                              flex: 1,
                                              color: match.player2 ? '#333' : '#999'
                                            }}>
                                              {match.player2 || 'TBD'}
                                            </span>
                                            {match.player2 && (
                                              <button
                                                onClick={() => {
                                                  updateMatchResult(match.id, match.player2, null);
                                                  if (match.nextMatchId) {
                                                    const updated = [...bracketMatches];
                                                    const nextMatch = updated.find(m => m.id === match.nextMatchId);
                                                    if (nextMatch) {
                                                      const matchesInRound = bracketMatches.filter(bm => bm.bracket === 'losers' && bm.round === match.round);
                                                      const idx = matchesInRound.findIndex(bm => bm.id === match.id);
                                                      nextMatch[idx % 2 === 0 ? 'player1' : 'player2'] = match.player2;
                                                    }
                                                    setBracketMatches(updated);
                                                  }
                                                }}
                                                style={{
                                                  padding: '2px 6px',
                                                  fontSize: '9px',
                                                  background: match.winner === match.player2 ? '#ec4899' : '#e0e0e0',
                                                  color: match.winner === match.player2 ? '#fff' : '#333',
                                                  border: 'none',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                {match.winner === match.player2 ? '✓' : 'W'}
                                              </button>
                                            )}
                                          </div>

                                          {match.nextMatchId && round < maxRound && (
                                            <div style={{
                                              position: 'absolute',
                                              right: '-20px',
                                              top: '50%',
                                              width: '20px',
                                              height: '2px',
                                              background: '#fbcfe8',
                                              transform: 'translateY(-50%)'
                                            }} />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Grand Finals */}
                      <div>
                        <h2 style={{ 
                          fontSize: '18px', 
                          fontWeight: '700', 
                          marginBottom: '20px',
                          padding: '12px 20px',
                          background: 'linear-gradient(135deg, #ffd89b 0%, #19547b 100%)',
                          color: '#fff',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          Grand Finals
                        </h2>
                        
                        {(() => {
                          const finalsMatches = bracketMatches.filter(m => m.bracket === 'finals');
                          
                          return (
                            <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', minWidth: 'fit-content' }}>
                              {finalsMatches.map((match, idx) => (
                                <div key={match.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                  <h3 style={{ 
                                    fontSize: '13px', 
                                    fontWeight: '700', 
                                    color: '#333',
                                    textAlign: 'center',
                                    marginBottom: '15px',
                                    padding: '6px 10px',
                                    background: '#fef3c7',
                                    borderRadius: '6px',
                                    border: '1px solid #fde68a'
                                  }}>
                                    {idx === 0 ? `Grand Finals (Week ${match.week})` : `GF Reset (Week ${match.week})`}
                                  </h3>
                                  
                                  <div 
                                    style={{
                                      border: '3px solid #f59e0b',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      background: match.winner ? '#fffbeb' : '#fff',
                                      minWidth: '220px'
                                    }}
                                  >
                                    <div style={{ 
                                      fontSize: '11px', 
                                      fontWeight: '700', 
                                      color: '#f59e0b',
                                      marginBottom: '8px',
                                      textAlign: 'center'
                                    }}>
                                      Championship Match
                                    </div>

                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 8px',
                                      background: match.winner === match.player1 ? '#fef3c7' : '#f8f9fa',
                                      borderRadius: '4px',
                                      marginBottom: '4px',
                                      border: match.winner === match.player1 ? '2px solid #f59e0b' : '1px solid #e0e0e0'
                                    }}>
                                      <span style={{ 
                                        fontWeight: match.winner === match.player1 ? '700' : '500',
                                        fontSize: '13px',
                                        flex: 1,
                                        color: match.player1 ? '#333' : '#999'
                                      }}>
                                        {match.player1 || 'Winners Champ'}
                                      </span>
                                      {match.player1 && (
                                        <button
                                          onClick={() => updateMatchResult(match.id, match.player1, null)}
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: '10px',
                                            background: match.winner === match.player1 ? '#f59e0b' : '#e0e0e0',
                                            color: match.winner === match.player1 ? '#fff' : '#333',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                          }}
                                        >
                                          {match.winner === match.player1 ? '👑' : 'Win'}
                                        </button>
                                      )}
                                    </div>

                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 8px',
                                      background: match.winner === match.player2 ? '#fef3c7' : '#f8f9fa',
                                      borderRadius: '4px',
                                      border: match.winner === match.player2 ? '2px solid #f59e0b' : '1px solid #e0e0e0'
                                    }}>
                                      <span style={{ 
                                        fontWeight: match.winner === match.player2 ? '700' : '500',
                                        fontSize: '13px',
                                        flex: 1,
                                        color: match.player2 ? '#333' : '#999'
                                      }}>
                                        {match.player2 || 'Losers Champ'}
                                      </span>
                                      {match.player2 && (
                                        <button
                                          onClick={() => updateMatchResult(match.id, match.player2, null)}
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: '10px',
                                            background: match.winner === match.player2 ? '#f59e0b' : '#e0e0e0',
                                            color: match.winner === match.player2 ? '#fff' : '#333',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                          }}
                                        >
                                          {match.winner === match.player2 ? '👑' : 'Win'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit League Settings Modal */}
      {showEditLeagueModal && currentLeague && (
        <div className="modal-overlay" onClick={() => setShowEditLeagueModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>Edit League Settings</h2>
              <button onClick={() => setShowEditLeagueModal(false)} className="modal-close">&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>League Status:</label>
                <select 
                  value={currentLeague.status}
                  onChange={(e) => setCurrentLeague({ ...currentLeague, status: e.target.value })}
                >
                  <option value="open">Open - Actively Recruiting</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="form-group">
                <label>Max Players:</label>
                <input
                  type="number"
                  value={currentLeague.maxPlayers}
                  onChange={(e) => setCurrentLeague({ ...currentLeague, maxPlayers: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="24"
                />
              </div>

              <div className="form-group">
                <label>League Duration (Weeks):</label>
                <input
                  type="number"
                  value={currentLeague.leagueWeeks}
                  onChange={(e) => setCurrentLeague({ ...currentLeague, leagueWeeks: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="52"
                />
              </div>

              <div className="form-group">
                <label>Bracket Type:</label>
                <select 
                  value={currentLeague.bracketType}
                  onChange={(e) => setCurrentLeague({ ...currentLeague, bracketType: e.target.value })}
                >
                  <option value="round_robin">Round Robin</option>
                  <option value="single_elimination">Single Elimination</option>
                  <option value="swiss">Swiss System</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={currentLeague.splitIntoPools || false}
                    onChange={(e) => setCurrentLeague({ ...currentLeague, splitIntoPools: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  Split players into draft pools?
                </label>
                {currentLeague.splitIntoPools && (
                  <div style={{ marginTop: '10px', marginLeft: '30px' }}>
                    <label style={{ fontSize: '13px' }}>Number of Pools:</label>
                    <input
                      type="number"
                      value={currentLeague.numPools || 2}
                      onChange={(e) => setCurrentLeague({ ...currentLeague, numPools: parseInt(e.target.value) || 2 })}
                      min="1"
                      max="8"
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  onClick={() => setShowEditLeagueModal(false)}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveLeagueSettings}
                  className="admin-btn"
                  style={{ flex: 1, padding: '10px', fontSize: '14px' }}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px', maxHeight: '90vh', width: '95%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Edit Schedule</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  onClick={async () => {
                    try {
                      await updateLeagueSchedule(currentLeague.code, username, events);
                      alert('Schedule saved successfully');
                    } catch (err) {
                      alert('Failed to save schedule: ' + err.message);
                    }
                  }}
                  className="admin-btn"
                  style={{ margin: 0 }}
                >
                  Save Schedule
                </button>
                <button onClick={() => setShowScheduleModal(false)} className="modal-close">&times;</button>
              </div>
            </div>
            
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* Event Type and Notes Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'end', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13px', color: '#555' }}>Event Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                    >
                      <option value="draft_start">Draft Start</option>
                      <option value="match">Match</option>
                      <option value="meeting">Meeting</option>
                      <option value="playoffs_start">Playoffs Start</option>
                      <option value="playoffs_end">Playoffs End</option>
                      <option value="league_end">League End</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13px', color: '#555' }}>Event Notes</label>
                    <input
                      type="text"
                      value={scheduleNotes}
                      onChange={(e) => setScheduleNotes(e.target.value)}
                      placeholder="Add notes about this event..."
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Three Column Layout: Calendar | Players | Events */}
                <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 1fr', gap: '20px' }}>
                  {/* Left Column: Compact Calendar */}
                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#333' }}>Select Date</h3>
                      <button
                        onClick={async () => {
                          if (!eventType) {
                            alert('Please select an event type');
                            return;
                          }
                          
                          if (!currentLeague) {
                            alert('League data not loaded');
                            return;
                          }
                          
                          const newEvent = {
                            id: Date.now().toString(),
                            type: eventType,
                            date: selectedDate.toISOString(),
                            notes: scheduleNotes,
                            dateDisplay: selectedDate.toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            }),
                            players: selectedPlayers
                          };
                          
                          const updatedEvents = [...events, newEvent];
                          const previousEvents = [...events];
                          setEvents(updatedEvents);
                          
                          // Save to database
                          try {
                            console.log('Adding event:', { code: currentLeague.code, username, event: newEvent });
                            await updateLeagueSchedule(currentLeague.code, username, updatedEvents);
                            alert(`Event added successfully with ${selectedPlayers.length} player(s)`);
                            setScheduleNotes('');
                            setSelectedPlayers([]);
                          } catch (err) {
                            console.error('Add event error:', err);
                            alert('Failed to save event: ' + err.message);
                            // Revert on error
                            setEvents(previousEvents);
                          }
                        }}
                        className="admin-btn"
                        style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', margin: 0 }}
                      >
                        + Add Event
                      </button>
                    </div>
                    <Calendar
                        onChange={setSelectedDate}
                        value={selectedDate}
                        minDate={new Date()}
                        className="compact-calendar"
                        tileContent={({ date, view }) => {
                          if (view === 'month') {
                            const dateEvents = events.filter(e => 
                              new Date(e.date).toDateString() === date.toDateString()
                            );
                            if (dateEvents.length > 0) {
                              return (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '2px' }}>
                                  {dateEvents.map(e => (
                                    <span 
                                      key={e.id}
                                      style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        backgroundColor: 
                                          e.type === 'draft_start' ? '#8b5cf6' :
                                          e.type === 'match' ? '#3b82f6' :
                                          e.type === 'meeting' ? '#10b981' :
                                          e.type === 'playoffs_start' ? '#ec4899' :
                                          e.type === 'playoffs_end' ? '#f97316' :
                                          e.type === 'league_end' ? '#ef4444' :
                                          '#f59e0b',
                                        display: 'inline-block'
                                      }}
                                    />
                                  ))}
                                </div>
                              );
                            }
                          }
                          return null;
                        }}
                        />
                  </div>

                  {/* Middle Column: Player Selection */}
                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>Assign Players</h3>
                    
                    <div style={{ border: '1px solid #e0e0e0', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f5f5f5' }}>
                          <tr>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '12px' }}>
                              <input
                                type="checkbox"
                                checked={players.length > 0 && selectedPlayers.length === players.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPlayers(players.map(p => p.username));
                                  } else {
                                    setSelectedPlayers([]);
                                  }
                                }}
                                style={{ marginRight: '8px' }}
                              />
                              Select All
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.length === 0 ? (
                            <tr>
                              <td style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                No players in league
                              </td>
                            </tr>
                          ) : (
                            players.map((player) => (
                              <tr key={player.username} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedPlayers.includes(player.username)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedPlayers([...selectedPlayers, player.username]);
                                        } else {
                                          setSelectedPlayers(selectedPlayers.filter(p => p !== player.username));
                                        }
                                      }}
                                      style={{ marginRight: '8px' }}
                                    />
                                    {player.username}
                                  </label>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Events on Selected Date */}
                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', maxHeight: '500px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#333' }}>Events on {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h3>
                      <button
                        onClick={async () => {
                          const selectedDateEvents = events.filter(e => 
                            new Date(e.date).toDateString() === selectedDate.toDateString()
                          );
                          if (selectedDateEvents.length === 0) {
                            alert('No events to clear on this date');
                            return;
                          }
                          if (!window.confirm(`Delete all ${selectedDateEvents.length} event(s) on ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}?`)) return;
                          const updatedEvents = events.filter(e => 
                            new Date(e.date).toDateString() !== selectedDate.toDateString()
                          );
                          const previousEvents = [...events];
                          setEvents(updatedEvents);
                          try {
                            await updateLeagueSchedule(currentLeague.code, username, updatedEvents);
                            alert('All events deleted successfully');
                          } catch (err) {
                            alert('Failed to delete events: ' + err.message);
                            setEvents(previousEvents);
                          }
                        }}
                        className="back-btn"
                        style={{ fontSize: '11px', padding: '4px 8px', margin: 0 }}
                      >
                        Clear All
                      </button>
                    </div>
                    {(() => {
                      const selectedDateEvents = events.filter(e => 
                        new Date(e.date).toDateString() === selectedDate.toDateString()
                      );
                      
                      if (selectedDateEvents.length === 0) {
                        return <p style={{ color: '#999', margin: 0, fontSize: '13px' }}>No events scheduled</p>;
                      }
                      
                      return selectedDateEvents.map(event => (
                          <div 
                            key={event.id}
                            style={{
                              padding: '10px',
                              marginBottom: '8px',
                              background: '#f8f9fa',
                              borderRadius: '6px',
                              borderLeft: `3px solid ${
                                event.type === 'draft_start' ? '#8b5cf6' :
                                event.type === 'match' ? '#3b82f6' :
                                event.type === 'meeting' ? '#10b981' :
                                event.type === 'playoffs_start' ? '#ec4899' :
                                event.type === 'playoffs_end' ? '#f97316' :
                                event.type === 'league_end' ? '#ef4444' :
                                '#f59e0b'
                              }`
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                              <strong style={{ 
                                fontSize: '13px',
                                color: 
                                  event.type === 'draft_start' ? '#8b5cf6' :
                                  event.type === 'match' ? '#3b82f6' :
                                  event.type === 'meeting' ? '#10b981' :
                                  event.type === 'playoffs_start' ? '#ec4899' :
                                  event.type === 'playoffs_end' ? '#f97316' :
                                  event.type === 'league_end' ? '#ef4444' :
                                  '#f59e0b',
                                textTransform: 'capitalize'
                              }}>
                                {event.type.replace(/_/g, ' ')}
                              </strong>
                              <button
                                onClick={async () => {
                                  if (!window.confirm('Delete this event?')) return;
                                  if (!currentLeague) {
                                    alert('League data not loaded');
                                    return;
                                  }
                                  const updatedEvents = events.filter(e => e.id !== event.id);
                                  const previousEvents = [...events];
                                  setEvents(updatedEvents);
                                  try {
                                    await updateLeagueSchedule(currentLeague.code, username, updatedEvents);
                                    alert('Event deleted successfully');
                                  } catch (err) {
                                    alert('Failed to delete event: ' + err.message);
                                    setEvents(previousEvents);
                                  }
                                }}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: '1' }}
                              >
                                ×
                              </button>
                            </div>
                            {event.notes && <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>{event.notes}</p>}
                            {event.players && event.players.length > 0 && (
                              <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                {event.players.map(player => (
                                  <span key={player} style={{ background: '#e0e0e0', padding: '2px 6px', borderRadius: '10px', fontSize: '10px' }}>{player}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Week to Calendar Modal */}
      {showExportCalendarModal && (
        <div className="modal-overlay" onClick={() => setShowExportCalendarModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '10px' }}>Export Week {exportWeekNumber}</h2>
            <p style={{ marginBottom: '15px', color: '#666', fontSize: '13px' }}>
              Schedule {exportWeekMatches.filter(m => m.player1 && m.player2).length} matches
            </p>

            <div style={{ marginBottom: '15px' }}>
              <Calendar
                onChange={setExportDate}
                value={exportDate}
                minDate={new Date()}
                className="compact-calendar"
              />
            </div>

            <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto' }}>
              <h4 style={{ marginTop: 0, marginBottom: '8px', fontSize: '12px', color: '#666' }}>Matches:</h4>
              {exportWeekMatches.filter(m => m.player1 && m.player2).map(match => (
                <div key={match.id} style={{ 
                  padding: '4px 6px', 
                  marginBottom: '3px', 
                  background: '#fff', 
                  borderRadius: '3px',
                  fontSize: '11px'
                }}>
                  <strong>M{match.matchNumber}:</strong> {match.player1} vs {match.player2}
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ gap: '8px' }}>
              <button 
                onClick={() => setShowExportCalendarModal(false)}
                style={{ 
                  padding: '8px 16px',
                  fontSize: '13px',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmExportToCalendar}
                disabled={loading}
                style={{ 
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Exporting...' : `Export to ${exportDate.toLocaleDateString()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Replay Modal */}
      {showReplayModal && (
        <div className="modal-overlay" onClick={() => setShowReplayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', padding: '30px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Add Replay Link</h2>
            
            {selectedMatchForReplay && (
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '8px' }}>
                  Match {selectedMatchForReplay.matchNumber}
                </div>
                <div style={{ fontSize: '14px' }}>
                  {selectedMatchForReplay.player1} vs {selectedMatchForReplay.player2}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: '500' }}>
                Pokémon Showdown Replay Link:
              </label>
              <input
                type="text"
                value={replayLink}
                onChange={(e) => setReplayLink(e.target.value)}
                placeholder="https://replay.pokemonshowdown.com/..."
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                Paste the replay link from Pokémon Showdown to verify the match result
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button 
                onClick={() => {
                  setShowReplayModal(false);
                  setSelectedMatchForReplay(null);
                  setReplayLink('');
                }}
                style={{ 
                  padding: '12px 24px',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveReplay}
                disabled={loading || !replayLink.trim()}
                style={{ 
                  padding: '12px 24px',
                  background: replayLink.trim() ? '#6366f1' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: replayLink.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {loading ? 'Saving...' : 'Save Replay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueManager;
