/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-loop-func */
/* eslint-disable no-dupe-keys */
import React, { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { createLeague, browseLeagues, getLeagueByCode, joinLeague, getLeaguePlayers, updateLeague, updateLeagueSchedule, acceptPlayerRequest, kickPlayer, requestToJoinLeague, generateInviteCode, joinByInviteCode } from './api';
import './LeagueManager.css';

const API_BASE = process.env.REACT_APP_SOCKET_URL || 
  (process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : 'http://localhost:8080');

const LeagueManager = ({ username, onStartLeagueDraft }) => {
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
  const [searchQuery, setSearchQuery] = useState(''); // Search by league name

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
  const [draftFormatModalKey, setDraftFormatModalKey] = useState(0);
  
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
  const [currentBracketWeek, setCurrentBracketWeek] = useState(1);
  const [playoffMatches, setPlayoffMatches] = useState([]);
  const [showPlayoffsTab, setShowPlayoffsTab] = useState(false);
  const [playoffsStarted, setPlayoffsStarted] = useState(false);
  const [currentPlayoffWeek, setCurrentPlayoffWeek] = useState(1);
  const [bracketView, setBracketView] = useState('regular'); // 'regular' or 'playoffs'
  
  // Edit League Settings modal state
  const [showEditLeagueModal, setShowEditLeagueModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [eventType, setEventType] = useState('match');
  const [events, setEvents] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  
  // League image upload state
  const [leagueImageUrl, setLeagueImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  
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
  const [allowMega, setAllowMega] = useState(false);
  const [allowGmax, setAllowGmax] = useState(false);

  // Draft Rules modal state
  const [showDraftRulesModal, setShowDraftRulesModal] = useState(false);
  const [captainCount, setCaptainCount] = useState(2);
  const [allowMegaCaptains, setAllowMegaCaptains] = useState(false);
  const [allowTeraCaptains, setAllowTeraCaptains] = useState(false);
  const [allowGmaxCaptains, setAllowGmaxCaptains] = useState(false);
  const [allowZMoveCaptains, setAllowZMoveCaptains] = useState(false);
  const [bannedCaptains, setBannedCaptains] = useState([]);
  const [captainSearchQuery, setCaptainSearchQuery] = useState('');
  const [captainSuggestionsVisible, setCaptainSuggestionsVisible] = useState(false);
  const [selectedPokemonForCaptainBan, setSelectedPokemonForCaptainBan] = useState([]);

  // Export to Calendar modal state
  const [showExportCalendarModal, setShowExportCalendarModal] = useState(false);
  const [exportWeekNumber, setExportWeekNumber] = useState(null);
  const [exportWeekMatches, setExportWeekMatches] = useState([]);
  const [exportDate, setExportDate] = useState(new Date());

  // Replay modal state
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [selectedMatchForReplay, setSelectedMatchForReplay] = useState(null);
  const [replayLink, setReplayLink] = useState('');

  // Match replay upload modal state
  const [showMatchReplayModal, setShowMatchReplayModal] = useState(false);
  const [selectedMatchForUpload, setSelectedMatchForUpload] = useState(null);
  const [matchReplayLink, setMatchReplayLink] = useState('');

  // Match team upload modal state
  const [showMatchTeamModal, setShowMatchTeamModal] = useState(false);
  const [selectedMatchForTeamUpload, setSelectedMatchForTeamUpload] = useState(null);
  const [matchTeamText, setMatchTeamText] = useState('');

  // View match teams modal state
  const [showViewMatchTeamsModal, setShowViewMatchTeamsModal] = useState(false);
  const [selectedMatchForView, setSelectedMatchForView] = useState(null);
  const matchExportRef = useRef(null);

  // Team submission modal state
  const [showTeamSubmissionModal, setShowTeamSubmissionModal] = useState(false);
  const [savedTeamsForSubmission, setSavedTeamsForSubmission] = useState([]);
  const [selectedTeamForSubmission, setSelectedTeamForSubmission] = useState(null);
  const [showPlayerTeamModal, setShowPlayerTeamModal] = useState(false);
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState(null);
  const [playerTeamData, setPlayerTeamData] = useState({}); // Map of teamId -> team data

  // Edit team modal state
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamImage, setEditTeamImage] = useState('');
  const [editTeamColor, setEditTeamColor] = useState('#667eea');
  const [editTeamColorEnd, setEditTeamColorEnd] = useState('#764ba2');

  // Ref for exporting team cards
  const teamCardsRef = useRef(null);

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
      loadMyLeagues(); // Also load user's leagues to show badges in browse view
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

  useEffect(() => {
    if (showDraftRulesModal && draftPokemonList.length === 0) {
      fetchPokemonList();
    }
  }, [showDraftRulesModal]);

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
      
      // Initialize points for Pokemon that don't already have a value
      // DON'T overwrite existing points from database
      setDraftPointsMap(prev => {
        const newPoints = { ...prev };
        uniquePokemon.forEach(p => {
          if (newPoints[p.name] === undefined) {
            newPoints[p.name] = 1;
          }
        });
        return newPoints;
      });
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

  const unbanAll = () => {
    const bannedPokemon = draftPokemonList.filter(p => draftPointsMap[p.name] === 0);
    if (bannedPokemon.length === 0) {
      alert('No banned Pokémon found');
      return;
    }
    const newPointsMap = { ...draftPointsMap };
    bannedPokemon.forEach(p => {
      newPointsMap[p.name] = 1;
    });
    setDraftPointsMap(newPointsMap);
    alert(`Unbanned ${bannedPokemon.length} Pokémon`);
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
      console.log('[loadMyLeagues] Fetching leagues for:', username);
      // Fetch leagues where user is commissioner or player
      const response = await fetch(`${API_BASE}/api/leagues?username=${username}`);
      console.log('[loadMyLeagues] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[loadMyLeagues] Error response:', errorText);
        throw new Error('Failed to load leagues');
      }
      
      const data = await response.json();
      console.log('[loadMyLeagues] Received data:', data);
      const leagues = data.leagues || [];
      console.log('[loadMyLeagues] Setting leagues:', leagues.length);
      console.log('[loadMyLeagues] League roles:', leagues.map(l => ({ name: l.name, role: l.role })));
      
      setMyLeagues(leagues);
      setError('');
    } catch (err) {
      console.error('[loadMyLeagues] Error:', err);
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
      console.log('Full league data received:', leagueData);
      const playersData = await getLeaguePlayers(code);
      
      setCurrentLeague(leagueData.league);
      setPlayers(playersData.players || []);
      setDraftRules(leagueData.league.draftRules || '');
      setBattleRules(leagueData.league.battleRules || DEFAULT_BATTLE_RULES);
      setIsEditingRules(false);
      
      // Load draft format data
      setDraftFormat(leagueData.league.format || '');
      console.log('Loading format from DB:', leagueData.league.format);
      console.log('Loading pokemonPointValues from DB:', leagueData.league.pokemonPointValues);
      console.log('pokemonPointValues type:', typeof leagueData.league.pokemonPointValues);
      console.log('pokemonPointValues keys:', leagueData.league.pokemonPointValues ? Object.keys(leagueData.league.pokemonPointValues).length : 'null');
      
      setDraftPointsLimit(leagueData.league.rules?.pointsLimit || 120);
      setDraftTeamSize(leagueData.league.rules?.teamSize || 12);
      setDraftGenerations(leagueData.league.rules?.allowedGenerations || [1,2,3,4,5,6,7,8,9]);
      setDraftBannedPokemon(leagueData.league.rules?.bannedPokemon || []);
      setDraftPointsMap(leagueData.league.pokemonPointValues || {});
      setAllowMega(leagueData.league.rules?.allowMega || false);
      setAllowGmax(leagueData.league.rules?.allowGmax || false);
      setAllowTrading(leagueData.league.rules?.allowTrading || false);
      setMaxTradeLimit(leagueData.league.rules?.maxTradeLimit || 0);
      setUnlimitedTrades(leagueData.league.rules?.unlimitedTrades || false);
      setAllowSeasonalTrading(leagueData.league.rules?.allowSeasonalTrading || false);
      setMaxSeasonalTradeLimit(leagueData.league.rules?.maxSeasonalTradeLimit || 1);
      setUnlimitedSeasonalTrades(leagueData.league.rules?.unlimitedSeasonalTrades || false);
      setEnableTimer(leagueData.league.rules?.timerEnabled || false);
      setFirstRoundTimer(leagueData.league.rules?.firstRoundTimer || 720);
      setSubsequentRoundTimer(leagueData.league.rules?.subsequentRoundTimer || 360);
      
      // Load captain rules data
      setCaptainCount(leagueData.league.captainRules?.captainCount || 2);
      setAllowMegaCaptains(leagueData.league.captainRules?.allowMegaCaptains ?? false);
      setAllowTeraCaptains(leagueData.league.captainRules?.allowTeraCaptains ?? false);
      setAllowGmaxCaptains(leagueData.league.captainRules?.allowGmaxCaptains ?? false);
      setAllowZMoveCaptains(leagueData.league.captainRules?.allowZMoveCaptains ?? false);
      setBannedCaptains(leagueData.league.captainRules?.bannedCaptains || []);
      
      // Load schedule if exists
      if (leagueData.league.schedule && Array.isArray(leagueData.league.schedule)) {
        setEvents(leagueData.league.schedule);
      }
      
      // Load league image if exists
      console.log('League object keys:', Object.keys(leagueData.league));
      console.log('Loading league image URL:', leagueData.league.imageUrl);
      console.log('Image URL type:', typeof leagueData.league.imageUrl);
      setLeagueImageUrl(leagueData.league.imageUrl || '');
      
      // Load bracket if exists
      if (leagueData.league.bracket && leagueData.league.bracket.matches) {
        console.log('Loading bracket matches:', leagueData.league.bracket.matches);
        console.log('First match teams data:', leagueData.league.bracket.matches[0]?.teams);
        setBracketMatches(leagueData.league.bracket.matches);
      }
      
      // Load playoff bracket if exists
      console.log('Loading league, playoffBracket:', leagueData.league.playoffBracket);
      
      if (leagueData.league.playoffBracket) {
        if (leagueData.league.playoffBracket.matches) {
          setPlayoffMatches(leagueData.league.playoffBracket.matches);
          console.log('Loaded playoff matches:', leagueData.league.playoffBracket.matches.length);
        }
        if (leagueData.league.playoffBracket.started) {
          setPlayoffsStarted(true);
          setShowPlayoffsTab(true);
          setBracketView('playoffs'); // Switch to playoffs view when loading active playoffs
          console.log('Playoffs are started, switching to playoffs view');
        }
      } else {
        console.log('No playoff bracket found in league data');
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
      
      const rulesToSave = {
        pointsLimit: draftPointsLimit,
        teamSize: draftTeamSize,
        allowedGenerations: draftGenerations,
        bannedPokemon: draftBannedPokemon,
        allowMega: allowMega,
        allowGmax: allowGmax,
        allowTrading: allowTrading,
        maxTradeLimit: maxTradeLimit,
        unlimitedTrades: unlimitedTrades,
        allowSeasonalTrading: allowSeasonalTrading,
        maxSeasonalTradeLimit: maxSeasonalTradeLimit,
        unlimitedSeasonalTrades: unlimitedSeasonalTrades,
        timerEnabled: enableTimer,
        firstRoundTimer: firstRoundTimer,
        subsequentRoundTimer: subsequentRoundTimer
      };
      
      console.log('Saving draft format with rules:', rulesToSave);
      console.log('Saving format name:', draftFormat);
      console.log('Saving pokemon points map:', draftPointsMap);
      console.log('Number of pokemon with points:', Object.keys(draftPointsMap).length);
      
      await updateLeague(currentLeague.code, {
        format: draftFormat,
        rules: rulesToSave,
        pokemonPointValues: draftPointsMap
      });
      
      setCurrentLeague({
        ...currentLeague,
        format: draftFormat,
        rules: rulesToSave,
        pokemonPointValues: draftPointsMap
      });
      setShowDraftFormatModal(false);
      setMessage('Draft format saved successfully!');
      setError('');
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraftRules = async () => {
    if (!currentLeague) return;

    try {
      setLoading(true);
      
      const captainRulesData = {
        captainCount: captainCount,
        allowMegaCaptains: allowMegaCaptains,
        allowTeraCaptains: allowTeraCaptains,
        allowGmaxCaptains: allowGmaxCaptains,
        allowZMoveCaptains: allowZMoveCaptains,
        bannedCaptains: bannedCaptains
      };
      
      console.log('Saving captain rules:', captainRulesData);
      
      const result = await updateLeague(currentLeague.code, {
        captainRules: captainRulesData
      });
      
      console.log('Save result:', result);
      
      // Reload the league to ensure we have fresh data
      const leagueData = await getLeagueByCode(currentLeague.code);
      setCurrentLeague(leagueData.league);
      
      // Update state variables from the fresh data
      setCaptainCount(leagueData.league.captainRules?.captainCount || 2);
      setAllowMegaCaptains(leagueData.league.captainRules?.allowMegaCaptains ?? false);
      setAllowTeraCaptains(leagueData.league.captainRules?.allowTeraCaptains ?? false);
      setAllowGmaxCaptains(leagueData.league.captainRules?.allowGmaxCaptains ?? false);
      setAllowZMoveCaptains(leagueData.league.captainRules?.allowZMoveCaptains ?? false);
      setBannedCaptains(leagueData.league.captainRules?.bannedCaptains || []);
      
      setShowDraftRulesModal(false);
      setMessage('Draft rules saved successfully!');
      setError('');
    } catch (err) {
      console.error('Save draft rules error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedTeamsForSubmission = async () => {
    console.log('[loadSavedTeamsForSubmission] Starting...');
    console.log('[loadSavedTeamsForSubmission] username:', username);
    console.log('[loadSavedTeamsForSubmission] currentLeague:', currentLeague);
    
    if (!currentLeague || !username) {
      console.log('[loadSavedTeamsForSubmission] Missing required data, returning early');
      return;
    }
    
    try {
      // First, check ALL teams for this user to debug
      const debugUrl = `${API_BASE}/api/teams?username=${encodeURIComponent(username)}`;
      console.log('[loadSavedTeamsForSubmission] DEBUG - Fetching ALL teams from:', debugUrl);
      const debugResponse = await fetch(debugUrl);
      const debugData = await debugResponse.json();
      console.log('[loadSavedTeamsForSubmission] DEBUG - All teams for user:', debugData.teams);
      console.log('[loadSavedTeamsForSubmission] DEBUG - League codes in teams:', debugData.teams?.map(t => ({
        name: t.name,
        leagueCode: t.leagueCode,
        hasLeagueCode: !!t.leagueCode
      })));
      
      // Now fetch with league code filter
      const url = `${API_BASE}/api/teams?username=${encodeURIComponent(username)}&leagueCode=${encodeURIComponent(currentLeague.code)}`;
      console.log('[loadSavedTeamsForSubmission] Fetching from:', url);
      
      const response = await fetch(url);
      console.log('[loadSavedTeamsForSubmission] Response status:', response.status);
      
      if (!response.ok) throw new Error('Failed to load saved teams');
      
      const data = await response.json();
      console.log('[loadSavedTeamsForSubmission] Received data:', data);
      console.log('[loadSavedTeamsForSubmission] Teams count:', data.teams?.length || 0);
      
      setSavedTeamsForSubmission(data.teams || []);
    } catch (err) {
      console.error('[loadSavedTeamsForSubmission] Error:', err);
      setError('Failed to load saved teams');
    }
  };

  const handleSubmitTeam = async () => {
    if (!selectedTeamForSubmission || !currentLeague) return;
    
    console.log('[handleSubmitTeam] Starting submission...');
    console.log('[handleSubmitTeam] Username:', username);
    console.log('[handleSubmitTeam] League code:', currentLeague.code);
    console.log('[handleSubmitTeam] Selected team:', selectedTeamForSubmission);
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/leagues/${currentLeague.code}/submit-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          teamId: selectedTeamForSubmission._id
        })
      });
      
      console.log('[handleSubmitTeam] Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit team' }));
        throw new Error(errorData.error || 'Failed to submit team');
      }
      
      const result = await response.json();
      console.log('[handleSubmitTeam] Response data:', result);
      
      // Reload players to reflect team submission
      console.log('[handleSubmitTeam] Reloading players...');
      const playersData = await getLeaguePlayers(currentLeague.code);
      console.log('[handleSubmitTeam] Reloaded players:', playersData.players);
      setPlayers(playersData.players);
      
      setShowTeamSubmissionModal(false);
      setMessage('Team submitted successfully!');
      setError('');
    } catch (err) {
      console.error('[handleSubmitTeam] Error:', err);
      setError(err.message);
      // Don't reload players on error - keep existing state
    } finally {
      setLoading(false);
    }
  };

  // Load team data when viewing a player's submitted team
  useEffect(() => {
    const loadAllSubmittedTeams = async () => {
      if (!players || players.length === 0) return;
      
      // Load teams for all players who have submitted
      const teamsToLoad = players.filter(p => p.teamSubmitted && p.submittedTeamId);
      
      console.log('[loadAllSubmittedTeams] Loading teams for', teamsToLoad.length, 'players');
      
      const teamDataMap = {};
      
      for (const player of teamsToLoad) {
        try {
          const response = await fetch(`${API_BASE}/api/teams/${player.submittedTeamId}`);
          if (response.ok) {
            const data = await response.json();
            teamDataMap[player.submittedTeamId] = data.team;
            console.log('[loadAllSubmittedTeams] Loaded team for', player.username);
          }
        } catch (err) {
          console.error('[loadAllSubmittedTeams] Error loading team for', player.username, err);
        }
      }
      
      setPlayerTeamData(teamDataMap);
    };
    
    if (players && players.length > 0) {
      loadAllSubmittedTeams();
    }
  }, [players]);

  // Handle replay link upload for a match
  const handleUploadReplayLink = (match) => {
    setSelectedMatchForUpload(match);
    setMatchReplayLink(match.replayLink || '');
    setShowMatchReplayModal(true);
  };

  const handleSaveReplayLink = async () => {
    if (!selectedMatchForUpload) return;
    
    try {
      setLoading(true);
      
      // Determine if this is a playoff match
      const isPlayoffMatch = playoffMatches.some(m => m.id === selectedMatchForUpload.id);
      const matches = isPlayoffMatch ? playoffMatches : bracketMatches;
      const setMatches = isPlayoffMatch ? setPlayoffMatches : setBracketMatches;
      
      const updated = matches.map(m =>
        m === selectedMatchForUpload ? { ...m, replayLink: matchReplayLink } : m
      );
      setMatches(updated);
      
      // Save to backend
      const updatePayload = isPlayoffMatch
        ? { playoffBracket: { matches: updated, started: true } }
        : { bracket: { type: currentLeague.bracketType, matches: updated } };
      
      await updateLeague(currentLeague.code, updatePayload);
      
      setMessage('Replay link saved successfully!');
      setTimeout(() => setMessage(''), 3000);
      setShowMatchReplayModal(false);
      setMatchReplayLink('');
      setSelectedMatchForUpload(null);
    } catch (err) {
      setError('Failed to save replay link: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle team upload for a match
  const handleUploadMatchTeam = (match) => {
    // Check if user already uploaded a team
    const existingTeam = match.teams?.[username];
    
    if (existingTeam) {
      const confirmOverwrite = window.confirm(
        'You have already uploaded a team for this match. Do you want to overwrite it?'
      );
      if (!confirmOverwrite) {
        return; // User cancelled
      }
    }
    
    setSelectedMatchForTeamUpload(match);
    // Load existing team for this user if it exists
    setMatchTeamText(existingTeam || '');
    setShowMatchTeamModal(true);
  };

  const handleSaveMatchTeam = async () => {
    if (!selectedMatchForTeamUpload) return;
    
    try {
      setLoading(true);
      
      // Determine if this is a playoff match
      const isPlayoffMatch = playoffMatches.some(m => m.id === selectedMatchForTeamUpload.id);
      const matches = isPlayoffMatch ? playoffMatches : bracketMatches;
      const setMatches = isPlayoffMatch ? setPlayoffMatches : setBracketMatches;
      
      const updated = matches.map(m => {
        if (m === selectedMatchForTeamUpload) {
          return { 
            ...m, 
            teams: { 
              ...m.teams, 
              [username]: matchTeamText 
            }
          };
        }
        return m;
      });
      setMatches(updated);
      
      console.log('Saving team to match. Updated matches:', updated);
      console.log('First match with teams:', updated.find(m => m.teams));
      
      // Save to backend
      const updatePayload = isPlayoffMatch
        ? { playoffBracket: { matches: updated, started: true } }
        : { bracket: { type: currentLeague.bracketType, matches: updated } };
      
      console.log('Update payload:', updatePayload);
      
      await updateLeague(currentLeague.code, updatePayload);
      
      setMessage('Team saved successfully!');
      setTimeout(() => setMessage(''), 3000);
      setShowMatchTeamModal(false);
      setMatchTeamText('');
      setSelectedMatchForTeamUpload(null);
    } catch (err) {
      setError('Failed to save team: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle viewing match teams
  const handleViewMatchTeams = (match) => {
    console.log('handleViewMatchTeams called with match:', match);
    console.log('Match has teams:', match.teams);
    setSelectedMatchForView(match);
    setShowViewMatchTeamsModal(true);
    console.log('Modal should open now');
  };

  // Handle exporting match as image
  const handleExportMatch = async () => {
    if (!matchExportRef.current) return;

    try {
      setLoading(true);
      const canvas = await html2canvas(matchExportRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const matchName = `${selectedMatchForView?.player1 || 'Team1'}_vs_${selectedMatchForView?.player2 || 'Team2'}`;
        link.download = `match_${matchName}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
      
      setMessage('Match exported successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to export match: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Parse Showdown format team text to extract Pokemon names
  const parseTeamText = (teamText) => {
    if (!teamText) return [];
    
    const lines = teamText.split('\n');
    const pokemon = [];
    
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('-') || line.startsWith('Ability:') || 
          line.startsWith('EVs:') || line.startsWith('Tera Type:') || 
          line.startsWith('IVs:') || line.startsWith('Shiny:') || 
          line.includes('Nature')) {
        continue;
      }
      
      // Extract pokemon name (before @ if item, or whole line)
      let pokemonName = line.split('@')[0].trim();
      if (pokemonName && pokemon.length < 6) {
        pokemon.push(pokemonName.toLowerCase());
      }
    }
    
    return pokemon;
  };

  // Get Pokemon sprite URL from name
  const getPokemonSpriteUrl = (pokemonName) => {
    if (!pokemonName) return null;
    
    // Normalize the name for PokeAPI
    let normalizedName = pokemonName.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Replace special chars with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    // Handle special cases
    const specialCases = {
      'nidoran-f': 'nidoran-f',
      'nidoran-m': 'nidoran-m',
      'mr-mime': 'mr-mime',
      'mime-jr': 'mime-jr',
      'type-null': 'type-null',
      'jangmo-o': 'jangmo-o',
      'hakamo-o': 'hakamo-o',
      'kommo-o': 'kommo-o',
      'tapu-koko': 'tapu-koko',
      'tapu-lele': 'tapu-lele',
      'tapu-bulu': 'tapu-bulu',
      'tapu-fini': 'tapu-fini',
      'porygon-z': 'porygon-z',
      'ho-oh': 'ho-oh'
    };
    
    if (specialCases[normalizedName]) {
      normalizedName = specialCases[normalizedName];
    }
    
    return `https://pokeapi.co/api/v2/pokemon/${normalizedName}`;
  };

  // Pokemon Card Component for displaying individual pokemon with sprite
  const PokemonCard = ({ pokemonName, gradientStart, gradientEnd }) => {
    const [spriteUrl, setSpriteUrl] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
      const fetchSprite = async () => {
        try {
          const apiUrl = getPokemonSpriteUrl(pokemonName);
          const response = await fetch(apiUrl);
          if (response.ok) {
            const data = await response.json();
            setSpriteUrl(data.sprites.front_default);
          }
        } catch (err) {
          console.error('Failed to fetch sprite for', pokemonName, err);
        } finally {
          setLoading(false);
        }
      };
      fetchSprite();
    }, [pokemonName]);
    
    return (
      <div 
        style={{
          aspectRatio: '1',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          borderRadius: '8px',
          background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          transition: 'transform 0.2s, box-shadow 0.2s',
          cursor: 'pointer',
          position: 'relative'
        }}
        title={pokemonName}
      >
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '8px' }}>Loading...</div>
        ) : spriteUrl ? (
          <>
            <img 
              src={spriteUrl} 
              alt={pokemonName}
              style={{
                width: '80%',
                height: 'auto',
                imageRendering: 'pixelated',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
              }}
            />
            <div style={{ 
              fontSize: '8px', 
              color: '#fff',
              fontWeight: '600',
              textAlign: 'center',
              textTransform: 'capitalize',
              wordBreak: 'break-word',
              marginTop: '2px'
            }}>
              {pokemonName}
            </div>
          </>
        ) : (
          <div style={{ 
            fontSize: '8px', 
            color: '#fff',
            fontWeight: '600',
            textAlign: 'center',
            textTransform: 'capitalize',
            wordBreak: 'break-word'
          }}>
            {pokemonName}
          </div>
        )}
      </div>
    );
  };

  // Handle player flagging a match result
  const handleFlagMatchResult = async (match, winner) => {
    if (match.player1 !== username && match.player2 !== username) {
      setError('You can only flag results for matches you are in.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setLoading(true);
      
      // Determine if this is a playoff match
      const isPlayoffMatch = playoffMatches.some(m => m.id === match.id);
      const matches = isPlayoffMatch ? playoffMatches : bracketMatches;
      const setMatches = isPlayoffMatch ? setPlayoffMatches : setBracketMatches;
      
      const updated = matches.map(m =>
        m === match ? { 
          ...m, 
          flaggedWinner: winner,
          flaggedBy: username,
          needsApproval: true 
        } : m
      );
      setMatches(updated);
      
      // Save to backend
      const updatePayload = isPlayoffMatch
        ? { playoffBracket: { matches: updated, started: true } }
        : { bracket: { type: currentLeague.bracketType, matches: updated } };
      
      await updateLeague(currentLeague.code, updatePayload);
      
      setMessage('Match result flagged for admin approval!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to flag match result: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin approves flagged match result
  const handleApproveMatchResult = async (match) => {
    try {
      setLoading(true);
      
      // Determine if this is a playoff match
      const isPlayoffMatch = playoffMatches.some(m => m.id === match.id);
      const matches = isPlayoffMatch ? playoffMatches : bracketMatches;
      const setMatches = isPlayoffMatch ? setPlayoffMatches : setBracketMatches;
      
      let updated = matches.map(m =>
        m === match ? { 
          ...m, 
          winner: m.flaggedWinner,
          flaggedWinner: null,
          flaggedBy: null,
          needsApproval: false 
        } : m
      );
      
      // Advance winner to next match for Single Elimination (both regular and playoffs)
      if (currentLeague.bracketType === 'single_elimination' || isPlayoffMatch) {
        const completedMatch = updated.find(m => m.id === match.id);
        updated = advanceWinnerToNextMatch(updated, completedMatch);
      }
      
      setMatches(updated);
      
      // Save to backend
      const updatePayload = isPlayoffMatch
        ? { playoffBracket: { matches: updated, started: true } }
        : { bracket: { type: currentLeague.bracketType, matches: updated } };
      
      await updateLeague(currentLeague.code, updatePayload);
      
      setMessage('Match result approved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to approve match result: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Advance winner to next match in Single Elimination
  const advanceWinnerToNextMatch = (updatedMatches, completedMatch) => {
    if (!completedMatch.nextMatchId || !completedMatch.winner) return updatedMatches;
    
    // Find the next match
    const nextMatch = updatedMatches.find(m => m.id === completedMatch.nextMatchId);
    if (!nextMatch) return updatedMatches;
    
    // Determine which position the winner should go to
    // First match in a pair goes to player1, second goes to player2
    const matchesInSameRound = updatedMatches.filter(m => m.round === completedMatch.round);
    const matchIndex = matchesInSameRound.findIndex(m => m.id === completedMatch.id);
    const isFirstOfPair = matchIndex % 2 === 0;
    
    // Update the next match with the winner
    return updatedMatches.map(m => {
      if (m.id === completedMatch.nextMatchId) {
        return {
          ...m,
          [isFirstOfPair ? 'player1' : 'player2']: completedMatch.winner
        };
      }
      return m;
    });
  };

  // Handle admin checkbox change with winner advancement
  const handleAdminSetWinner = async (match, player) => {
    // Determine if this is a playoff match
    const isPlayoffMatch = playoffMatches.some(m => m.id === match.id);
    const matches = isPlayoffMatch ? playoffMatches : bracketMatches;
    const setMatches = isPlayoffMatch ? setPlayoffMatches : setBracketMatches;
    
    let updated = matches.map(m =>
      m === match ? { ...m, winner: m.winner === player ? null : player } : m
    );
    
    // Advance winner to next match for Single Elimination (both regular and playoffs)
    if (currentLeague.bracketType === 'single_elimination' || isPlayoffMatch) {
      const completedMatch = updated.find(m => m.id === match.id);
      if (completedMatch.winner) {
        updated = advanceWinnerToNextMatch(updated, completedMatch);
      }
    }
    
    setMatches(updated);
    try {
      const updatePayload = isPlayoffMatch
        ? { playoffBracket: { matches: updated, started: true } }
        : { bracket: { type: currentLeague.bracketType, matches: updated } };
      
      await updateLeague(currentLeague.code, updatePayload);
    } catch (error) {
      console.error('Error saving bracket:', error);
    }
  };

  // Admin rejects flagged match result
  const handleRejectMatchResult = async (match) => {
    try {
      setLoading(true);
      
      // Determine if this is a playoff match
      const isPlayoffMatch = playoffMatches.some(m => m.id === match.id);
      const matches = isPlayoffMatch ? playoffMatches : bracketMatches;
      const setMatches = isPlayoffMatch ? setPlayoffMatches : setBracketMatches;
      
      const updated = matches.map(m =>
        m === match ? { 
          ...m, 
          flaggedWinner: null,
          flaggedBy: null,
          needsApproval: false 
        } : m
      );
      setMatches(updated);
      
      // Save to backend
      const updatePayload = isPlayoffMatch
        ? { playoffBracket: { matches: updated, started: true } }
        : { bracket: { type: currentLeague.bracketType, matches: updated } };
      
      await updateLeague(currentLeague.code, updatePayload);
      
      setMessage('Match result rejected.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to reject match result: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin regenerates bracket with randomized matches
  const handleRegenerateDraft = async () => {
    if (!window.confirm('Are you sure you want to regenerate the bracket? This will create new randomized matchups and cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      
      // First clear the bracket state
      setBracketMatches([]);
      
      // Wait a moment for state to update, then generate new bracket
      setTimeout(async () => {
        try {
          let generatedMatches = null;
          
          // Generate new bracket based on current bracket type
          if (currentLeague?.bracketType === 'round_robin') {
            generatedMatches = generateRoundRobinMatches();
          } else if (currentLeague?.bracketType === 'single_elimination') {
            generatedMatches = generateSingleEliminationBracket();
          } else if (currentLeague?.bracketType === 'double_elimination') {
            generatedMatches = generateDoubleEliminationBracket();
          } else if (currentLeague?.bracketType === 'swiss') {
            generatedMatches = generateSwissBracket();
          } else {
            setError(`Bracket type "${currentLeague?.bracketType}" not yet implemented`);
            setLoading(false);
            return;
          }
          
          if (!generatedMatches) {
            setError('Failed to generate bracket matches');
            setLoading(false);
            return;
          }
          
          // Save the newly generated bracket to database
          await updateLeague(currentLeague.code, {
            bracket: {
              type: currentLeague.bracketType,
              matches: generatedMatches
            }
          });
          
          setMessage('Bracket regenerated and saved successfully!');
          setTimeout(() => setMessage(''), 3000);
          setLoading(false);
          
        } catch (genError) {
          console.error('Error in bracket regeneration:', genError);
          setError('Failed to regenerate bracket: ' + genError.message);
          setLoading(false);
        }
      }, 100);
      
    } catch (err) {
      setError('Failed to regenerate bracket: ' + err.message);
      setLoading(false);
    }
  };

  const handleStartLeagueDraft = () => {
    if (!currentLeague) return;
    
    // Prepare draft settings from league data
    const draftSettings = {
      pointsLimit: currentLeague.rules?.pointsLimit || 120,
      teamSize: currentLeague.rules?.teamSize || 12,
      allowedGenerations: currentLeague.rules?.allowedGenerations || [1,2,3,4,5,6,7,8,9],
      bannedPokemon: currentLeague.rules?.bannedPokemon || [],
      pokemonPointValues: draftPointsMap || {},
      allowMega: currentLeague.rules?.allowMega || false,
      allowGmax: currentLeague.rules?.allowGmax || false,
      allowTrading: currentLeague.rules?.allowTrading || false,
      maxTradeLimit: currentLeague.rules?.maxTradeLimit || 0,
      unlimitedTrades: currentLeague.rules?.unlimitedTrades || false,
      timerEnabled: currentLeague.rules?.timerEnabled || false,
      firstRoundTimer: currentLeague.rules?.firstRoundTimer || 480,
      subsequentRoundTimer: currentLeague.rules?.subsequentRoundTimer || 480
    };
    
    // Call the parent callback to navigate and set up draft
    if (onStartLeagueDraft) {
      onStartLeagueDraft(currentLeague.code, draftSettings);
    }
  };

  const handleOpenDraftFormatModal = () => {
    if (!currentLeague) return;
    
    console.log('Opening draft format modal with league:', currentLeague);
    console.log('League rules:', currentLeague.rules);
    console.log('League format:', currentLeague.format);
    console.log('League pokemonPointValues:', currentLeague.pokemonPointValues);
    console.log('pokemonPointValues type:', typeof currentLeague.pokemonPointValues);
    console.log('pokemonPointValues is object?:', currentLeague.pokemonPointValues && typeof currentLeague.pokemonPointValues === 'object');
    console.log('pokemonPointValues keys:', currentLeague.pokemonPointValues ? Object.keys(currentLeague.pokemonPointValues) : 'null/undefined');
    console.log('pokemonPointValues keys count:', currentLeague.pokemonPointValues ? Object.keys(currentLeague.pokemonPointValues).length : 0);
    
    // Load current draft format data from league
    setDraftFormat(currentLeague.format || '');
    setDraftPointsLimit(currentLeague.rules?.pointsLimit || 120);
    setDraftTeamSize(currentLeague.rules?.teamSize || 12);
    setDraftGenerations(currentLeague.rules?.allowedGenerations || [1,2,3,4,5,6,7,8,9]);
    setDraftBannedPokemon(currentLeague.rules?.bannedPokemon || []);
    setDraftPointsMap(currentLeague.pokemonPointValues || {});
    console.log('Set draftPointsMap to:', currentLeague.pokemonPointValues || {});
    setAllowMega(currentLeague.rules?.allowMega || false);
    setAllowGmax(currentLeague.rules?.allowGmax || false);
    setAllowTrading(currentLeague.rules?.allowTrading || false);
    setMaxTradeLimit(currentLeague.rules?.maxTradeLimit || 0);
    setUnlimitedTrades(currentLeague.rules?.unlimitedTrades || false);
    setAllowSeasonalTrading(currentLeague.rules?.allowSeasonalTrading || false);
    setMaxSeasonalTradeLimit(currentLeague.rules?.maxSeasonalTradeLimit || 1);
    setUnlimitedSeasonalTrades(currentLeague.rules?.unlimitedSeasonalTrades || false);
    setEnableTimer(currentLeague.rules?.timerEnabled || false);
    setFirstRoundTimer(currentLeague.rules?.firstRoundTimer || 720);
    setSubsequentRoundTimer(currentLeague.rules?.subsequentRoundTimer || 360);
    
    console.log('Set enableTimer to:', currentLeague.rules?.timerEnabled);
    console.log('Set allowTrading to:', currentLeague.rules?.allowTrading);
    
    // Increment key to force modal re-render with fresh values
    setDraftFormatModalKey(prev => prev + 1);
    
    // Open the modal
    setShowDraftFormatModal(true);
  };

  const handleCancelPlayoffs = async () => {
    if (!window.confirm('Cancel playoffs? This will remove the playoff bracket and return to regular season view.')) {
      return;
    }

    try {
      setLoading(true);

      // Clear playoff data
      setPlayoffMatches([]);
      setPlayoffsStarted(false);
      setShowPlayoffsTab(false);
      setBracketView('regular');
      setCurrentPlayoffWeek(1);

      // Remove playoff bracket from database
      console.log('Cancelling playoffs for league:', currentLeague.code);
      
      const cancelResult = await updateLeague(currentLeague.code, {
        playoffBracket: null
      });
      
      console.log('Cancel playoffs result:', cancelResult);

      // Update local league state
      setCurrentLeague({ ...currentLeague, playoffBracket: null });

      setMessage('Playoffs cancelled successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to cancel playoffs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLeagueImageUrl = async () => {
    if (!leagueImageUrl.trim()) {
      setError('Please enter an image URL');
      return;
    }

    // Validate URL format
    try {
      new URL(leagueImageUrl);
    } catch (err) {
      setError('Please enter a valid URL');
      return;
    }

    try {
      setUploadingImage(true);
      console.log('Saving image URL:', leagueImageUrl);
      console.log('For league code:', currentLeague.code);
      
      const result = await updateLeague(currentLeague.code, {
        imageUrl: leagueImageUrl
      });
      
      console.log('Update result:', result);
      setCurrentLeague({ ...currentLeague, imageUrl: leagueImageUrl });
      setMessage('League image updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Save image URL error:', err);
      setError('Failed to save image URL: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveLeagueImage = async () => {
    if (!window.confirm('Remove league image?')) {
      return;
    }

    try {
      setLoading(true);

      await updateLeague(currentLeague.code, {
        imageUrl: null
      });

      setLeagueImageUrl('');
      setCurrentLeague({ ...currentLeague, imageUrl: null });
      setMessage('League image removed successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to remove image: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTeams = async () => {
    console.log('handleExportTeams called');
    console.log('teamCardsRef.current:', teamCardsRef.current);
    console.log('players.length:', players?.length);
    console.log('loading:', loading);
    
    if (loading) {
      setError('Please wait for teams to finish loading');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (!players || players.length === 0) {
      setError('No teams available to export');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (!teamCardsRef.current) {
      setError('Team cards element not found. Please try again.');
      setTimeout(() => setError(''), 3000);
      console.error('teamCardsRef.current is null');
      return;
    }

    try {
      setMessage('Generating image...');

      // Wait a moment for any state updates
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('Starting export with element:', teamCardsRef.current);
      console.log('Element children:', teamCardsRef.current.children.length);

      const canvas = await html2canvas(teamCardsRef.current, {
        backgroundColor: '#f4f8ff',
        scale: 2, // Higher quality
        logging: true, // Enable logging for debugging
        useCORS: true, // Allow cross-origin images
        allowTaint: true
      });

      console.log('Canvas created:', canvas.width, 'x', canvas.height);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Failed to create image');
          setTimeout(() => setError(''), 3000);
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const leagueName = currentLeague?.name || 'league';
        const sanitizedName = leagueName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${sanitizedName}_teams.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        setMessage('Teams exported successfully!');
        setTimeout(() => setMessage(''), 3000);
      });
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export teams: ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleStartPlayoffs = async () => {
    if (!window.confirm('Start playoffs with the top 50% of players? This will create a single elimination bracket.')) {
      return;
    }

    try {
      setLoading(true);

      // Get top 50% of players sorted by win rate
      const sortedPlayers = [...players].sort((a, b) => {
        const aWins = a.wins || 0;
        const aLosses = a.losses || 0;
        const bWins = b.wins || 0;
        const bLosses = b.losses || 0;
        
        const aWinRate = aWins + aLosses > 0 ? aWins / (aWins + aLosses) : 0;
        const bWinRate = bWins + bLosses > 0 ? bWins / (bWins + bLosses) : 0;
        
        if (bWinRate !== aWinRate) return bWinRate - aWinRate;
        
        // Tiebreaker: total wins
        return bWins - aWins;
      });

      const topHalfCount = Math.ceil(sortedPlayers.length / 2);
      const topPlayers = sortedPlayers.slice(0, topHalfCount);

      // Generate single elimination bracket for top players
      const playerList = topPlayers.map(p => p.username);
      const n = playerList.length;
      
      const rounds = Math.ceil(Math.log2(n));
      const bracketSize = Math.pow(2, rounds);
      const byes = bracketSize - n;
      
      // Seed players by rank (no shuffling for playoffs)
      const seededPlayers = [...playerList];
      
      // Add byes
      for (let i = 0; i < byes; i++) {
        seededPlayers.push(null);
      }
      
      const matches = [];
      let matchId = 0;
      
      // Generate Round 1
      const round1Matches = [];
      for (let i = 0; i < seededPlayers.length; i += 2) {
        const player1 = seededPlayers[i];
        const player2 = seededPlayers[i + 1];
        
        if (!player1 && !player2) continue;
        
        const match = {
          id: `playoff-r1-m${matchId}`,
          round: 1,
          week: 1,
          matchNumber: matchId + 1,
          player1: player1,
          player2: player2,
          winner: null,
          score: null,
          nextMatchId: null
        };
        
        // Auto-advance byes
        if (player1 && !player2) {
          match.winner = player1;
        } else if (!player1 && player2) {
          match.winner = player2;
        }
        
        round1Matches.push(match);
        matches.push(match);
        matchId++;
      }
      
      // Generate subsequent rounds
      let previousRoundMatches = round1Matches;
      for (let round = 2; round <= rounds; round++) {
        const roundMatches = [];
        matchId = 0;
        
        for (let i = 0; i < previousRoundMatches.length; i += 2) {
          const match = {
            id: `playoff-r${round}-m${matchId}`,
            round: round,
            week: round,
            matchNumber: matchId + 1,
            player1: null,
            player2: null,
            winner: null,
            score: null,
            nextMatchId: null
          };
          
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
      
      setPlayoffMatches(matches);
      setPlayoffsStarted(true);
      setShowPlayoffsTab(true);
      setBracketView('playoffs');
      setCurrentPlayoffWeek(1);
      
      // Save playoffs to database
      const playoffData = {
        matches: matches,
        started: true
      };
      
      console.log('Saving playoff bracket to database:', {
        leagueCode: currentLeague.code,
        playoffBracket: playoffData,
        matchCount: matches.length
      });
      
      const updateResult = await updateLeague(currentLeague.code, {
        playoffBracket: playoffData
      });
      
      console.log('Playoff bracket save result:', updateResult);

      // Update local league state
      setCurrentLeague({ 
        ...currentLeague, 
        playoffBracket: playoffData
      });
      
      setMessage(`Playoffs started with top ${topHalfCount} players!`);
      setTimeout(() => setMessage(''), 3000);
      setLoading(false);
      
    } catch (err) {
      console.error('Error starting playoffs:', err);
      setError('Failed to start playoffs: ' + err.message);
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
        unlimitedTrades: unlimitedTrades,
        allowMega: allowMega,
        allowGmax: allowGmax
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
                  unlimitedTrades: jsonData.settings.unlimitedTrades ?? false,
                  allowMega: jsonData.settings.allowMega ?? false,
                  allowGmax: jsonData.settings.allowGmax ?? false
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
            setAllowMega(importedSettings.allowMega ?? false);
            setAllowGmax(importedSettings.allowGmax ?? false);
            
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
        
        if (preset.allowMega !== undefined) {
          setAllowMega(preset.allowMega);
          if (preset.allowMega) {
            fetchMegaPokemon();
          } else {
            removeMegaPokemon();
          }
        }
        
        if (preset.allowGmax !== undefined) {
          setAllowGmax(preset.allowGmax);
          if (preset.allowGmax) {
            fetchGmaxPokemon();
          } else {
            removeGmaxPokemon();
          }
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

  // Fetch Mega Evolution Pokémon from PokeAPI
  const fetchMegaPokemon = async () => {
    try {
      const response = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=2000');
      const allPokemon = response.data.results;
      
      const megaForms = allPokemon.filter(p => {
        const name = p.name.toLowerCase();
        return name.includes('mega') && !name.includes('meganium') && !name.includes('yanmega');
      });
      
      const megaList = await Promise.all(
        megaForms.map(async (form) => {
          try {
            const detailResponse = await axios.get(form.url);
            const data = detailResponse.data;
            
            return {
              id: data.id,
              name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
              img: data.sprites?.front_default || data.sprites?.other?.['official-artwork']?.front_default || '',
              generation: Math.floor(data.id / 151) + 1,
              legendary: false,
              paradox: false
            };
          } catch (err) {
            console.error(`Failed to fetch details for ${form.name}:`, err);
            return null;
          }
        })
      );
      
      const validMega = megaList.filter(p => p !== null);
      
      setDraftPokemonList(prev => {
        const existingNames = new Set(prev.map(p => p.name.toLowerCase()));
        const newPokemon = validMega.filter(p => !existingNames.has(p.name.toLowerCase()));
        return [...prev, ...newPokemon].sort((a, b) => a.id - b.id);
      });
      
      // Initialize new Pokemon with 1 point
      setDraftPointsMap(prev => {
        const updated = { ...prev };
        validMega.forEach(p => {
          if (!updated[p.name]) {
            updated[p.name] = 1;
          }
        });
        return updated;
      });
    } catch (err) {
      console.error('Failed to fetch Mega Pokemon:', err);
    }
  };

  // Remove Mega Evolution Pokémon from the list
  const removeMegaPokemon = () => {
    setDraftPokemonList(prev => prev.filter(p => !p.name.toLowerCase().includes('-mega')));
  };

  // Fetch Gigantamax Pokémon from PokeAPI
  const fetchGmaxPokemon = async () => {
    try {
      const response = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=2000');
      const allPokemon = response.data.results;
      
      const gmaxForms = allPokemon.filter(p => {
        const name = p.name.toLowerCase();
        return name.includes('gmax') || name.includes('eternamax');
      });
      
      const gmaxList = await Promise.all(
        gmaxForms.map(async (form) => {
          try {
            const detailResponse = await axios.get(form.url);
            const data = detailResponse.data;
            
            return {
              id: data.id,
              name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
              img: data.sprites?.front_default || data.sprites?.other?.['official-artwork']?.front_default || '',
              generation: 8,
              legendary: false,
              paradox: false
            };
          } catch (err) {
            console.error(`Failed to fetch details for ${form.name}:`, err);
            return null;
          }
        })
      );
      
      const validGmax = gmaxList.filter(p => p !== null);
      
      setDraftPokemonList(prev => {
        const existingNames = new Set(prev.map(p => p.name.toLowerCase()));
        const newPokemon = validGmax.filter(p => !existingNames.has(p.name.toLowerCase()));
        return [...prev, ...newPokemon].sort((a, b) => a.id - b.id);
      });
      
      // Initialize new Pokemon with 1 point
      setDraftPointsMap(prev => {
        const updated = { ...prev };
        validGmax.forEach(p => {
          if (!updated[p.name]) {
            updated[p.name] = 1;
          }
        });
        return updated;
      });
    } catch (err) {
      console.error('Failed to fetch Gigantamax Pokemon:', err);
    }
  };

  // Remove Gigantamax Pokémon from the list
  const removeGmaxPokemon = () => {
    setDraftPokemonList(prev => prev.filter(p => {
      const name = p.name.toLowerCase();
      return !name.includes('-gmax') && !name.includes('eternamax');
    }));
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
      return null;
    }

    const matches = [];
    // Shuffle players for randomized matchups
    const playerList = players.map(p => p.username || p).sort(() => Math.random() - 0.5);
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
    
    return generatedMatches;
  };

  // Generate single elimination bracket
  const generateSingleEliminationBracket = () => {
    if (!players || players.length < 2) {
      setError('Need at least 2 players to generate bracket');
      return null;
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
    return matches;
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
    return matches;
  };

  // Generate Swiss system bracket
  const generateSwissBracket = () => {
    if (!players || players.length < 2) {
      setError('Need at least 2 players to generate bracket');
      return null;
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
    return matches;
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
      
      // Determine if this is a playoff match
      const isPlayoffMatch = playoffMatches.some(m => m.id === selectedMatchForReplay.id);
      const matches = isPlayoffMatch ? playoffMatches : bracketMatches;
      const setMatches = isPlayoffMatch ? setPlayoffMatches : setBracketMatches;
      
      // Update the match with the replay link
      const updatedMatches = matches.map(m => {
        if (m.id === selectedMatchForReplay.id) {
          return { ...m, replay: replayLink };
        }
        return m;
      });

      setMatches(updatedMatches);

      // Save to backend
      const updatePayload = isPlayoffMatch
        ? { playoffBracket: { matches: updatedMatches, started: true } }
        : { bracket: { type: currentLeague.bracketType, matches: updatedMatches } };
      
      await updateLeague(currentLeague.code, updatePayload);

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

  // Filter leagues based on status, format, and search query
  const filteredLeagues = leagues.filter(league => {
    const statusMatch = statusFilter === 'all' || league.status === statusFilter;
    const formatMatch = formatFilter === 'all' || league.format === formatFilter;
    const searchMatch = searchQuery === '' || league.name.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && formatMatch && searchMatch;
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
            <div className="leagues-grid">
              {myLeagues.map(league => (
                <div 
                  key={league._id} 
                  className={`league-card ${league.role === 'host' ? 'league-card-host' : 'league-card-player'}`}
                  style={{
                    backgroundImage: league.imageUrl ? `url(${league.imageUrl})` : 'none',
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    position: 'relative'
                  }}
                >
                  <div className="league-role-badge">{league.role === 'host' ? 'Host' : 'Player'}</div>
                  <div className="league-card-content">
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
                      {league.role === 'host' ? 'Manage League' : 'View League'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
          
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search leagues by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '12px',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
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
              {filteredLeagues.map(league => {
                // Determine user's role in this league
                const isHost = league.commissionerName === username;
                const myLeague = myLeagues.find(l => l.code === league.code);
                const isPlayer = myLeague && myLeague.role === 'player';
                const role = isHost ? 'host' : isPlayer ? 'player' : null;
                
                return (
                  <div 
                    key={league._id} 
                    className={`league-card ${role === 'host' ? 'league-card-host' : role === 'player' ? 'league-card-player' : ''}`}
                    style={{
                      backgroundImage: league.imageUrl ? `url(${league.imageUrl})` : 'none',
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      position: 'relative'
                    }}
                  >
                    {role && (
                      <div className="league-role-badge">
                        {role === 'host' ? 'Host' : 'Player'}
                      </div>
                    )}
                    <div className="league-card-content">
                      <h3>{league.name}</h3>
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
                        {league.status === 'open' && !role && (
                          <button 
                            onClick={() => handleRequestToJoin(league.code)}
                            style={{ background: '#10b981' }}
                          >
                            Request to Join
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
        <div 
          className="view-section"
        >
          <button onClick={() => setView('dashboard')} className="back-btn">
            ← Back to Dashboard
          </button>
          
          {/* League View */}
          <>
            <div className="league-view-header">
              <h2>{currentLeague.name}</h2>
              {currentLeague.commissionerName === username && <span className="admin-badge">Administrator</span>}
            </div>

              <div 
                className="league-info-grid"
                style={{
                  backgroundImage: leagueImageUrl ? `url(${leagueImageUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  position: 'relative'
                }}
              >
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
                  <button onClick={handleStartLeagueDraft} className="admin-btn">Start League Draft</button>
                  <button onClick={() => setShowEditLeagueModal(true)} className="admin-btn">Edit League Settings</button>
                  <button onClick={() => setShowManagePlayersModal(true)} className="admin-btn">Manage Players</button>
                  <button onClick={handleOpenDraftFormatModal} className="admin-btn">Set Draft Format</button>
                  <button onClick={() => setShowDraftRulesModal(true)} className="admin-btn">Set Draft Rules</button>
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

              {/* Bracket Section - Visible to all, editable by admin */}
              <div className="league-section">
                {/* Tabs for Regular Season and Playoffs (only show Playoffs tab for round robin with playoffs started) */}
                {currentLeague?.bracketType === 'round_robin' && showPlayoffsTab && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', borderBottom: '2px solid #e5e7eb' }}>
                    <button
                      onClick={() => setBracketView('regular')}
                      style={{
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        background: bracketView === 'regular' ? '#3b82f6' : 'transparent',
                        color: bracketView === 'regular' ? '#fff' : '#64748b',
                        border: 'none',
                        borderBottom: bracketView === 'regular' ? '2px solid #3b82f6' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Regular Season
                    </button>
                    <button
                      onClick={() => setBracketView('playoffs')}
                      style={{
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        background: bracketView === 'playoffs' ? '#ec4899' : 'transparent',
                        color: bracketView === 'playoffs' ? '#fff' : '#64748b',
                        border: 'none',
                        borderBottom: bracketView === 'playoffs' ? '2px solid #ec4899' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Playoffs 🏆
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <h3 style={{ margin: 0 }}>{bracketView === 'playoffs' ? 'Playoffs Bracket' : 'Bracket'}</h3>
                    {bracketView === 'regular' && bracketMatches.length > 0 && (() => {
                      const maxWeek = Math.max(...bracketMatches.map(m => m.week || 1));
                      return maxWeek > 1 && (
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <button
                            onClick={() => setCurrentBracketWeek(prev => Math.max(1, prev - 1))}
                            disabled={currentBracketWeek === 1}
                            style={{
                              padding: '6px 10px',
                              fontSize: '13px',
                              background: currentBracketWeek === 1 ? '#e5e7eb' : '#3b82f6',
                              color: currentBracketWeek === 1 ? '#94a3b8' : '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: currentBracketWeek === 1 ? 'not-allowed' : 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            ← Prev
                          </button>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155', minWidth: '80px', textAlign: 'center' }}>
                            Week {currentBracketWeek}
                          </span>
                          <button
                            onClick={() => setCurrentBracketWeek(prev => Math.min(maxWeek, prev + 1))}
                            disabled={currentBracketWeek === maxWeek}
                            style={{
                              padding: '6px 10px',
                              fontSize: '13px',
                              background: currentBracketWeek === maxWeek ? '#e5e7eb' : '#3b82f6',
                              color: currentBracketWeek === maxWeek ? '#94a3b8' : '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: currentBracketWeek === maxWeek ? 'not-allowed' : 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      );
                    })()}
                    {bracketView === 'playoffs' && playoffMatches.length > 0 && (() => {
                      const maxWeek = Math.max(...playoffMatches.map(m => m.week || 1));
                      return maxWeek > 1 && (
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <button
                            onClick={() => setCurrentPlayoffWeek(prev => Math.max(1, prev - 1))}
                            disabled={currentPlayoffWeek === 1}
                            style={{
                              padding: '6px 10px',
                              fontSize: '13px',
                              background: currentPlayoffWeek === 1 ? '#e5e7eb' : '#ec4899',
                              color: currentPlayoffWeek === 1 ? '#94a3b8' : '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: currentPlayoffWeek === 1 ? 'not-allowed' : 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            ← Prev
                          </button>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155', minWidth: '100px', textAlign: 'center' }}>
                            Round {currentPlayoffWeek}
                          </span>
                          <button
                            onClick={() => setCurrentPlayoffWeek(prev => Math.min(maxWeek, prev + 1))}
                            disabled={currentPlayoffWeek === maxWeek}
                            style={{
                              padding: '6px 10px',
                              fontSize: '13px',
                              background: currentPlayoffWeek === maxWeek ? '#e5e7eb' : '#ec4899',
                              color: currentPlayoffWeek === maxWeek ? '#94a3b8' : '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: currentPlayoffWeek === maxWeek ? 'not-allowed' : 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {currentLeague.commissionerName === username && bracketView === 'regular' && currentLeague?.bracketType === 'round_robin' && !playoffsStarted && (
                      <button
                        onClick={handleStartPlayoffs}
                        disabled={loading || players.length < 2}
                        style={{
                          padding: '8px 14px',
                          fontSize: '13px',
                          background: players.length < 2 ? '#e5e7eb' : '#ec4899',
                          color: players.length < 2 ? '#94a3b8' : '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: players.length < 2 ? 'not-allowed' : 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        🏆 Start Playoffs
                      </button>
                    )}
                    {currentLeague.commissionerName === username && bracketView === 'playoffs' && playoffsStarted && (
                      <button
                        onClick={handleCancelPlayoffs}
                        disabled={loading}
                        style={{
                          padding: '8px 14px',
                          fontSize: '13px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        ✕ Cancel Playoffs
                      </button>
                    )}
                    {currentLeague.commissionerName === username && bracketView === 'regular' && (
                      <button
                        onClick={handleRegenerateDraft}
                        className="admin-btn"
                        style={{
                          padding: '8px 16px',
                          fontSize: '13px',
                          background: '#f59e0b',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Regenerate Bracket
                      </button>
                    )}
                  </div>
                </div>

                {bracketView === 'playoffs' && !playoffsStarted ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666', background: '#fef3f2', borderRadius: '8px', border: '2px dashed #ec4899' }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>🏆</div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '600', color: '#ec4899' }}>Playoffs Not Started Yet</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
                      {currentLeague.commissionerName === username 
                        ? 'Click "Start Playoffs" to generate a bracket with the top 50% of players.' 
                        : 'The commissioner will start playoffs when the regular season is complete.'}
                    </p>
                  </div>
                ) : bracketView === 'playoffs' && playoffsStarted && playoffMatches.length > 0 ? (
                  <div>
                    {/* Playoffs Display - Single Elimination bracket */}
                    {(() => {
                      const weekMatches = playoffMatches.filter(m => m.week === currentPlayoffWeek);
                      
                      return (
                        <div>
                          <div style={{ marginBottom: '15px', padding: '12px', background: '#fef3f2', borderRadius: '6px', border: '1px solid #ec4899' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#ec4899', marginBottom: '4px' }}>
                              🏆 Playoffs - {weekMatches.length === 1 ? 'Finals' : `Round ${currentPlayoffWeek}`}
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              Top 50% players competing in single elimination format
                            </div>
                          </div>
                          {weekMatches.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', background: '#f8f9fa', borderRadius: '8px' }}>
                              No playoff matches scheduled for Round {currentPlayoffWeek}
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                              {weekMatches.map((match, idx) => {
                                const isPlayer1 = match.player1 === username;
                                const isPlayer2 = match.player2 === username;
                                const isPlayerInMatch = isPlayer1 || isPlayer2;

                                return (
                                  <div key={match.id} style={{
                                    background: match.winner ? '#f0fdf4' : '#fff',
                                    border: `2px solid ${match.winner ? '#16a34a' : '#ec4899'}`,
                                    borderRadius: '8px',
                                    padding: '12px',
                                    position: 'relative'
                                  }}>
                                    {match.winner && (
                                      <div style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        background: '#16a34a',
                                        color: '#fff',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '600'
                                      }}>
                                        ✓ Complete
                                      </div>
                                    )}
                                    
                                    <div style={{ marginBottom: '10px', fontSize: '12px', fontWeight: '600', color: '#ec4899' }}>
                                      Playoff Match {idx + 1}
                                    </div>
                                    
                                    {/* Player 1 */}
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px',
                                      background: match.winner === match.player1 ? '#dcfce7' : isPlayer1 ? '#dbeafe' : '#f8f9fa',
                                      borderRadius: '4px',
                                      marginBottom: '6px',
                                      border: match.winner === match.player1 ? '2px solid #16a34a' : '1px solid #e5e7eb'
                                    }}>
                                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#334155' }}>
                                        {match.player1}
                                      </span>
                                      {currentLeague.commissionerName === username && !match.winner && (
                                        <input
                                          type="checkbox"
                                          checked={false}
                                          onChange={() => handleAdminSetWinner(match, match.player1)}
                                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                      )}
                                      {match.winner === match.player1 && (
                                        <span style={{ color: '#16a34a', fontSize: '16px', fontWeight: 'bold' }}>✓</span>
                                      )}
                                    </div>

                                    {/* VS */}
                                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontWeight: '600', margin: '4px 0' }}>
                                      VS
                                    </div>

                                    {/* Player 2 */}
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px',
                                      background: match.winner === match.player2 ? '#dcfce7' : isPlayer2 ? '#dbeafe' : '#f8f9fa',
                                      borderRadius: '4px',
                                      marginBottom: '8px',
                                      border: match.winner === match.player2 ? '2px solid #16a34a' : '1px solid #e5e7eb'
                                    }}>
                                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#334155' }}>
                                        {match.player2}
                                      </span>
                                      {currentLeague.commissionerName === username && !match.winner && (
                                        <input
                                          type="checkbox"
                                          checked={false}
                                          onChange={() => handleAdminSetWinner(match, match.player2)}
                                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                      )}
                                      {match.winner === match.player2 && (
                                        <span style={{ color: '#16a34a', fontSize: '16px', fontWeight: 'bold' }}>✓</span>
                                      )}
                                    </div>

                                    {/* Replay Link */}
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                                      {match.replayLink ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>REPLAY:</span>
                                          <a
                                            href={match.replayLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              fontSize: '11px',
                                              color: '#3b82f6',
                                              textDecoration: 'none',
                                              flex: 1,
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap'
                                            }}
                                          >
                                            {match.replayLink}
                                          </a>
                                        </div>
                                      ) : isPlayerInMatch && (
                                        <button
                                          onClick={() => {
                                            setSelectedMatchForUpload(match);
                                            setMatchReplayLink('');
                                            setShowMatchReplayModal(true);
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '6px',
                                            fontSize: '11px',
                                            background: '#f1f5f9',
                                            color: '#64748b',
                                            border: '1px dashed #cbd5e1',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                          }}
                                        >
                                          + Add Replay Link
                                        </button>
                                      )}
                                    </div>

                                    {/* Flag Win Button */}
                                    {isPlayerInMatch && !match.winner && (
                                      <div style={{ marginTop: '8px' }}>
                                        <button
                                          onClick={() => handleFlagMatchResult(match, username)}
                                          disabled={match.needsApproval}
                                          style={{
                                            width: '100%',
                                            padding: '8px',
                                            fontSize: '12px',
                                            background: match.needsApproval ? '#f1f5f9' : '#3b82f6',
                                            color: match.needsApproval ? '#94a3b8' : '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: match.needsApproval ? 'not-allowed' : 'pointer',
                                            fontWeight: '600'
                                          }}
                                        >
                                          {match.needsApproval ? '⏳ Pending Approval' : '🚩 Flag Win'}
                                        </button>
                                      </div>
                                    )}

                                    {/* Admin Approval Section */}
                                    {currentLeague.commissionerName === username && match.needsApproval && match.flaggedWinner && (
                                      <div style={{
                                        marginTop: '10px',
                                        padding: '10px',
                                        background: '#fef3c7',
                                        borderRadius: '6px',
                                        border: '1px solid #f59e0b'
                                      }}>
                                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#92400e', marginBottom: '6px' }}>
                                          PENDING APPROVAL
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '8px' }}>
                                          <strong>{match.flaggedWinner}</strong> flagged as winner
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <button
                                            onClick={() => handleApproveMatchResult(match)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              fontSize: '12px',
                                              background: '#16a34a',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            ✓ Approve
                                          </button>
                                          <button
                                            onClick={() => handleRejectMatchResult(match)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              fontSize: '12px',
                                              background: '#ef4444',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            ✕ Reject
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : bracketView === 'regular' && bracketMatches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666', background: '#f8f9fa', borderRadius: '8px' }}>
                    <p style={{ margin: 0 }}>No bracket has been generated yet.</p>
                    {currentLeague.commissionerName === username && (
                      <p style={{ fontSize: '14px', marginTop: '8px', color: '#94a3b8' }}>Click "Generate Bracket" to create matchups.</p>
                    )}
                  </div>
                ) : bracketView === 'regular' ? (
                  <div>
                    {/* Round Robin Display */}
                    {currentLeague?.bracketType === 'round_robin' && (() => {
                      const weekMatches = bracketMatches.filter(m => m.week === currentBracketWeek);
                      
                      return (
                        <div>
                          {weekMatches.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', background: '#f8f9fa', borderRadius: '8px' }}>
                              No matches scheduled for Week {currentBracketWeek}
                            </div>
                          ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                                {weekMatches.map((match, idx) => {
                                  const isPlayerInMatch = match.player1 === username || match.player2 === username;
                                  
                                  return (
                                  <div 
                                    key={idx}
                                    style={{
                                      background: '#fff',
                                      border: match.needsApproval ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                                      borderRadius: '8px',
                                      padding: '14px',
                                      position: 'relative'
                                    }}
                                  >
                                    {match.needsApproval && (
                                      <div style={{ 
                                        position: 'absolute',
                                        top: '-8px',
                                        right: '10px',
                                        background: '#f59e0b',
                                        color: '#fff',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '10px',
                                        fontWeight: '700'
                                      }}>
                                        PENDING APPROVAL
                                      </div>
                                    )}
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600' }}>
                                      Match {match.matchNumber || idx + 1}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px',
                                        background: match.winner === match.player1 || match.flaggedWinner === match.player1 ? '#d1fae5' : '#f8f9fa',
                                        borderRadius: '4px',
                                        border: match.winner === match.player1 ? '2px solid #10b981' : match.flaggedWinner === match.player1 ? '2px solid #f59e0b' : 'none'
                                      }}>
                                        <span style={{ fontSize: '14px', fontWeight: '600' }}>{match.player1}</span>
                                        {currentLeague.commissionerName === username && !match.needsApproval && (
                                          <input
                                            type="checkbox"
                                            checked={match.winner === match.player1}
                                            onChange={async () => {
                                              const updated = bracketMatches.map(m =>
                                                m === match ? { ...m, winner: m.winner === match.player1 ? null : match.player1 } : m
                                              );
                                              setBracketMatches(updated);
                                              await updateLeague(currentLeague.code, {
                                                bracket: { type: currentLeague.bracketType, matches: updated }
                                              });
                                            }}
                                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                          />
                                        )}
                                        {currentLeague.commissionerName !== username && match.winner === match.player1 && (
                                          <span style={{ color: '#10b981', fontWeight: '700', fontSize: '18px' }}>✓</span>
                                        )}
                                        {isPlayerInMatch && !match.winner && !match.needsApproval && (
                                          <button
                                            onClick={() => handleFlagMatchResult(match, match.player1)}
                                            style={{
                                              padding: '4px 8px',
                                              fontSize: '11px',
                                              background: '#3b82f6',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            Flag Win
                                          </button>
                                        )}
                                      </div>
                                      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>vs</div>
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px',
                                        background: match.winner === match.player2 || match.flaggedWinner === match.player2 ? '#d1fae5' : '#f8f9fa',
                                        borderRadius: '4px',
                                        border: match.winner === match.player2 ? '2px solid #10b981' : match.flaggedWinner === match.player2 ? '2px solid #f59e0b' : 'none'
                                      }}>
                                        <span style={{ fontSize: '14px', fontWeight: '600' }}>{match.player2}</span>
                                        {currentLeague.commissionerName === username && !match.needsApproval && (
                                          <input
                                            type="checkbox"
                                            checked={match.winner === match.player2}
                                            onChange={async () => {
                                              const updated = bracketMatches.map(m =>
                                                m === match ? { ...m, winner: m.winner === match.player2 ? null : match.player2 } : m
                                              );
                                              setBracketMatches(updated);
                                              await updateLeague(currentLeague.code, {
                                                bracket: { type: currentLeague.bracketType, matches: updated }
                                              });
                                            }}
                                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                          />
                                        )}
                                        {currentLeague.commissionerName !== username && match.winner === match.player2 && (
                                          <span style={{ color: '#10b981', fontWeight: '700', fontSize: '18px' }}>✓</span>
                                        )}
                                        {isPlayerInMatch && !match.winner && !match.needsApproval && (
                                          <button
                                            onClick={() => handleFlagMatchResult(match, match.player2)}
                                            style={{
                                              padding: '4px 8px',
                                              fontSize: '11px',
                                              background: '#3b82f6',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            Flag Win
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Replay Link Section */}
                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                                      {match.replayLink ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          <a 
                                            href={match.replayLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            style={{ 
                                              color: '#3b82f6',
                                              fontSize: '13px',
                                              textDecoration: 'none',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                          >
                                            🎬 View Replay
                                          </a>
                                          {isPlayerInMatch && (
                                            <button
                                              onClick={() => handleUploadReplayLink(match)}
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#6b7280',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Update Link
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        isPlayerInMatch && (
                                          <button
                                            onClick={() => handleUploadReplayLink(match)}
                                            style={{
                                              padding: '6px 12px',
                                              fontSize: '12px',
                                              background: '#6366f1',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              width: '100%'
                                            }}
                                          >
                                            📤 Upload Replay
                                          </button>
                                        )
                                      )}
                                    </div>

                                    {/* Team Upload Section */}
                                    <div style={{ marginTop: '8px' }}>
                                      {isPlayerInMatch && (
                                        <button
                                          onClick={() => handleUploadMatchTeam(match)}
                                          style={{
                                            padding: '6px 12px',
                                            fontSize: '12px',
                                            background: match.teams?.[username] ? '#10b981' : '#8b5cf6',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            width: '100%'
                                          }}
                                        >
                                          {match.teams?.[username] ? '✓ Team Uploaded' : '📋 Upload Team'}
                                        </button>
                                      )}
                                      {match.teams && Object.keys(match.teams).length > 0 && (
                                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#666' }}>
                                          {Object.keys(match.teams).map(playerName => (
                                            <div key={playerName} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <span style={{ color: '#10b981' }}>✓</span>
                                              <span>{playerName}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <button
                                        onClick={() => handleViewMatchTeams(match)}
                                        style={{
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          background: '#3b82f6',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          width: '100%',
                                          marginTop: '6px'
                                        }}
                                      >
                                        👁️ View Teams
                                      </button>
                                    </div>

                                    {/* Admin Approval Section */}
                                    {match.needsApproval && currentLeague.commissionerName === username && (
                                      <div style={{ 
                                        marginTop: '12px', 
                                        padding: '10px',
                                        background: '#fef3c7',
                                        borderRadius: '6px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                      }}>
                                        <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                                          {match.flaggedBy} flagged {match.flaggedWinner} as winner
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <button
                                            onClick={() => handleApproveMatchResult(match)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              fontSize: '12px',
                                              background: '#10b981',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            ✓ Approve
                                          </button>
                                          <button
                                            onClick={() => handleRejectMatchResult(match)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              fontSize: '12px',
                                              background: '#ef4444',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            ✕ Reject
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Single Elimination Display */}
                    {currentLeague?.bracketType === 'single_elimination' && (() => {
                      const weekMatches = bracketMatches.filter(m => m.week === currentBracketWeek);
                      
                      return (
                        <div>
                          {weekMatches.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', background: '#f8f9fa', borderRadius: '8px' }}>
                              No matches scheduled for Week {currentBracketWeek}
                            </div>
                          ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                                {weekMatches.map((match, idx) => {
                                  const isPlayer1 = match.player1 === username;
                                  const isPlayer2 = match.player2 === username;
                                  const isPlayerInMatch = isPlayer1 || isPlayer2;
                                  const canFlagPlayer1 = isPlayerInMatch && !match.winner && !match.needsApproval;
                                  const canFlagPlayer2 = isPlayerInMatch && !match.winner && !match.needsApproval;
                                  
                                  return (
                                  <div 
                                    key={idx}
                                    style={{
                                      background: '#fff',
                                      border: match.needsApproval ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                                      borderRadius: '6px',
                                      padding: '12px',
                                      position: 'relative'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                                        Match {match.matchNumber || idx + 1}
                                      </div>
                                      {match.needsApproval && (
                                        <div style={{ 
                                          fontSize: '10px', 
                                          color: '#f59e0b', 
                                          fontWeight: '700',
                                          background: '#fef3c7',
                                          padding: '2px 6px',
                                          borderRadius: '3px'
                                        }}>
                                          PENDING APPROVAL
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px',
                                        background: match.winner === match.player1 ? '#d1fae5' : '#f8f9fa',
                                        borderRadius: '4px',
                                        border: match.winner === match.player1 ? '2px solid #10b981' : 'none'
                                      }}>
                                        <span style={{ fontSize: '14px', fontWeight: match.winner === match.player1 ? '700' : '500' }}>
                                          {match.player1 || 'TBD'}
                                        </span>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          {canFlagPlayer1 && (
                                            <button
                                              onClick={() => handleFlagMatchResult(match, match.player1)}
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#fbbf24',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                fontWeight: '600'
                                              }}
                                            >
                                              Flag Win
                                            </button>
                                          )}
                                          {currentLeague.commissionerName === username && match.player1 && (
                                            <input
                                              type="checkbox"
                                              checked={match.winner === match.player1}
                                              onChange={() => handleAdminSetWinner(match, match.player1)}
                                              style={{ cursor: 'pointer' }}
                                            />
                                          )}
                                          {currentLeague.commissionerName !== username && match.winner === match.player1 && (
                                            <span style={{ color: '#10b981', fontWeight: '700' }}>✓</span>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>vs</div>
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px',
                                        background: match.winner === match.player2 ? '#d1fae5' : '#f8f9fa',
                                        borderRadius: '4px',
                                        border: match.winner === match.player2 ? '2px solid #10b981' : 'none'
                                      }}>
                                        <span style={{ fontSize: '14px', fontWeight: match.winner === match.player2 ? '700' : '500' }}>
                                          {match.player2 || 'TBD'}
                                        </span>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          {canFlagPlayer2 && (
                                            <button
                                              onClick={() => handleFlagMatchResult(match, match.player2)}
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#fbbf24',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                fontWeight: '600'
                                              }}
                                            >
                                              Flag Win
                                            </button>
                                          )}
                                          {currentLeague.commissionerName === username && match.player2 && (
                                            <input
                                              type="checkbox"
                                              checked={match.winner === match.player2}
                                              onChange={() => handleAdminSetWinner(match, match.player2)}
                                              style={{ cursor: 'pointer' }}
                                            />
                                          )}
                                          {currentLeague.commissionerName !== username && match.winner === match.player2 && (
                                            <span style={{ color: '#10b981', fontWeight: '700' }}>✓</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Replay Link Section */}
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                                      {match.replayLink ? (
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          <a 
                                            href={match.replayLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            style={{
                                              flex: 1,
                                              fontSize: '12px',
                                              color: '#3b82f6',
                                              textDecoration: 'none',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap'
                                            }}
                                          >
                                            🎥 View Replay
                                          </a>
                                          {isPlayerInMatch && (
                                            <button
                                              onClick={() => handleUploadReplayLink(match)}
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#e5e7eb',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Update
                                            </button>
                                          )}
                                        </div>
                                      ) : isPlayerInMatch ? (
                                        <button
                                          onClick={() => handleUploadReplayLink(match)}
                                          style={{
                                            width: '100%',
                                            padding: '6px',
                                            fontSize: '12px',
                                            background: '#3b82f6',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          + Upload Replay Link
                                        </button>
                                      ) : (
                                        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                          No replay uploaded yet
                                        </div>
                                      )}
                                    </div>

                                    {/* Admin Approval Section */}
                                    {currentLeague.commissionerName === username && match.needsApproval && (
                                      <div style={{
                                        marginTop: '10px',
                                        padding: '10px',
                                        background: '#fef3c7',
                                        borderRadius: '4px',
                                        border: '1px solid #fbbf24'
                                      }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#92400e' }}>
                                          {match.flaggedBy} flagged {match.flaggedWinner} as winner
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <button
                                            onClick={() => handleApproveMatchResult(match)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              fontSize: '12px',
                                              background: '#10b981',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            ✓ Approve
                                          </button>
                                          <button
                                            onClick={() => handleRejectMatchResult(match)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              fontSize: '12px',
                                              background: '#ef4444',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            ✕ Reject
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Swiss System Display */}
                    {currentLeague?.bracketType === 'swiss' && (() => {
                      const weekMatches = bracketMatches.filter(m => m.week === currentBracketWeek);
                      
                      return (
                        <div>
                          {weekMatches.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', background: '#f8f9fa', borderRadius: '8px' }}>
                              No matches scheduled for Week {currentBracketWeek}
                            </div>
                          ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                                {weekMatches.map((match, idx) => {
                                  const isPlayer1 = match.player1 === username;
                                  const isPlayer2 = match.player2 === username;
                                  const isPlayerInMatch = isPlayer1 || isPlayer2;
                                  const canFlagPlayer1 = isPlayerInMatch && !match.winner && !match.needsApproval;
                                  const canFlagPlayer2 = isPlayerInMatch && !match.winner && !match.needsApproval;
                                  
                                  return (
                                  <div 
                                    key={idx}
                                    style={{
                                      background: '#fff',
                                      border: match.needsApproval ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                                      borderRadius: '6px',
                                      padding: '12px',
                                      position: 'relative'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                                        Match {match.matchNumber || idx + 1}
                                      </div>
                                      {match.needsApproval && (
                                        <div style={{ 
                                          fontSize: '10px', 
                                          color: '#f59e0b', 
                                          fontWeight: '700',
                                          background: '#fef3c7',
                                          padding: '2px 6px',
                                          borderRadius: '3px'
                                        }}>
                                          PENDING APPROVAL
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px',
                                        background: match.winner === match.player1 ? '#d1fae5' : '#f8f9fa',
                                        borderRadius: '4px',
                                        border: match.winner === match.player1 ? '2px solid #10b981' : 'none'
                                      }}>
                                        <span style={{ fontSize: '14px', fontWeight: match.winner === match.player1 ? '700' : '500' }}>
                                          {match.player1 || 'TBD'}
                                        </span>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          {canFlagPlayer1 && (
                                            <button
                                              onClick={() => handleFlagMatchResult(match, match.player1)}
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#fbbf24',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                fontWeight: '600'
                                              }}
                                            >
                                              Flag Win
                                            </button>
                                          )}
                                          {currentLeague.commissionerName === username && match.player1 && (
                                            <input
                                              type="checkbox"
                                              checked={match.winner === match.player1}
                                              onChange={() => handleAdminSetWinner(match, match.player1)}
                                              style={{ cursor: 'pointer' }}
                                            />
                                          )}
                                          {currentLeague.commissionerName !== username && match.winner === match.player1 && (
                                            <span style={{ color: '#10b981', fontWeight: '700' }}>✓</span>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>vs</div>
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px',
                                        background: match.winner === match.player2 ? '#d1fae5' : '#f8f9fa',
                                        borderRadius: '4px',
                                        border: match.winner === match.player2 ? '2px solid #10b981' : 'none'
                                      }}>
                                        <span style={{ fontSize: '14px', fontWeight: match.winner === match.player2 ? '700' : '500' }}>
                                          {match.player2 || 'TBD'}
                                        </span>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          {canFlagPlayer2 && (
                                            <button
                                              onClick={() => handleFlagMatchResult(match, match.player2)}
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#fbbf24',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                fontWeight: '600'
                                              }}
                                            >
                                              Flag Win
                                            </button>
                                          )}
                                          {currentLeague.commissionerName === username && match.player2 && (
                                            <input
                                              type="checkbox"
                                              checked={match.winner === match.player2}
                                              onChange={() => handleAdminSetWinner(match, match.player2)}
                                              style={{ cursor: 'pointer' }}
                                            />
                                          )}
                                          {currentLeague.commissionerName !== username && match.winner === match.player2 && (
                                            <span style={{ color: '#10b981', fontWeight: '700' }}>✓</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Replay Link Section */}
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                                      {match.replayLink ? (
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          <a 
                                            href={match.replayLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            style={{
                                              flex: 1,
                                              fontSize: '12px',
                                              color: '#3b82f6',
                                              textDecoration: 'none',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap'
                                            }}
                                          >
                                            🎥 View Replay
                                          </a>
                                          {isPlayerInMatch && (
                                            <button
                                              onClick={() => handleUploadReplayLink(match)}
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#e5e7eb',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Update
                                            </button>
                                          )}
                                        </div>
                                      ) : isPlayerInMatch ? (
                                        <button
                                          onClick={() => handleUploadReplayLink(match)}
                                          style={{
                                            width: '100%',
                                            padding: '6px',
                                            fontSize: '12px',
                                            background: '#3b82f6',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          + Upload Replay Link
                                        </button>
                                      ) : (
                                        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                          No replay uploaded yet
                                        </div>
                                      )}
                                    </div>

                                    {/* Team Upload Section */}
                                    <div style={{ marginTop: '8px' }}>
                                      {isPlayerInMatch && (
                                        <button
                                          onClick={() => handleUploadMatchTeam(match)}
                                          style={{
                                            padding: '6px 12px',
                                            fontSize: '12px',
                                            background: match.teams?.[username] ? '#10b981' : '#8b5cf6',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            width: '100%'
                                          }}
                                        >
                                          {match.teams?.[username] ? '✓ Team Uploaded' : '📋 Upload Team'}
                                        </button>
                                      )}
                                      {match.teams && Object.keys(match.teams).length > 0 && (
                                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#666' }}>
                                          {Object.keys(match.teams).map(playerName => (
                                            <div key={playerName} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <span style={{ color: '#10b981' }}>✓</span>
                                              <span>{playerName}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <button
                                        onClick={() => handleViewMatchTeams(match)}
                                        style={{
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          background: '#3b82f6',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          width: '100%',
                                          marginTop: '6px'
                                        }}
                                      >
                                        👁️ View Teams
                                      </button>
                                    </div>

                                    {/* Admin Approval Section */}
                                    {currentLeague.commissionerName === username && match.needsApproval && (
                                      <div style={{
                                        marginTop: '10px',
                                        padding: '10px',
                                        background: '#fef3c7',
                                        borderRadius: '4px',
                                        border: '1px solid #fbbf24'
                                      }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#92400e' }}>
                                          {match.flaggedBy} flagged {match.flaggedWinner} as winner
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <button
                                            onClick={() => handleApproveMatchResult(match)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              fontSize: '12px',
                                              background: '#10b981',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            ✓ Approve
                                          </button>
                                          <button
                                            onClick={() => handleRejectMatchResult(match)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              fontSize: '12px',
                                              background: '#ef4444',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            ✕ Reject
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Unsupported bracket type message */}
                    {currentLeague?.bracketType && 
                     currentLeague.bracketType !== 'round_robin' && 
                     currentLeague.bracketType !== 'single_elimination' && 
                     currentLeague.bracketType !== 'swiss' && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8f9fa', borderRadius: '8px' }}>
                        <p style={{ margin: 0 }}>Bracket type "{currentLeague.bracketType}" is not yet supported for display.</p>
                        <p style={{ fontSize: '14px', marginTop: '8px' }}>Currently supported: Round Robin, Single Elimination, Swiss System</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

                <div className="league-section" ref={teamCardsRef}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Players</h3>
                    <p className="player-count" style={{ margin: '5px 0 0 0' }}>{players.length}/{currentLeague.maxPlayers || '∞'} players</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {players.length > 0 && (
                      <button 
                        onClick={handleExportTeams}
                        className="admin-btn" 
                        style={{ margin: 0 }}
                        disabled={loading}
                      >
                        📸 Export Teams
                      </button>
                    )}
                    {players.some(p => p.username === username) && (
                      <>
                        <button 
                          onClick={() => {
                            setShowTeamSubmissionModal(true);
                            loadSavedTeamsForSubmission();
                          }} 
                          className="admin-btn" 
                          style={{ margin: 0 }}
                        >
                          Submit Team
                        </button>
                        {players.find(p => p.username === username)?.teamSubmitted && (
                          <button
                            onClick={() => {
                              const currentPlayer = players.find(p => p.username === username);
                              const teamData = currentPlayer.submittedTeamId && playerTeamData[currentPlayer.submittedTeamId] 
                                ? playerTeamData[currentPlayer.submittedTeamId] 
                                : null;
                              setEditingTeam(currentPlayer);
                              setEditTeamName(currentPlayer.teamCustomization?.teamName || teamData?.name || 'My Team');
                              setEditTeamImage(currentPlayer.teamCustomization?.teamImage || '');
                              setEditTeamColor(currentPlayer.teamCustomization?.cardColor || '#667eea');
                              setEditTeamColorEnd(currentPlayer.teamCustomization?.cardColorEnd || '#764ba2');
                              setShowEditTeamModal(true);
                            }}
                            className="admin-btn"
                            style={{ margin: 0 }}
                          >
                            Edit Team
                          </button>
                        )}
                      </>
                    )}
                    {!players.some(p => p.username === username) && (
                      <button onClick={handleJoinAsPlayer} className="admin-btn" style={{ margin: 0 }}>
                        Join as Player?
                      </button>
                    )}
                  </div>
                </div>
                {loading ? (
                  <p>Loading players...</p>
                ) : players.length === 0 ? (
                  <p>No players have joined yet.</p>
                ) : (
                  <div 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '16px',
                      marginTop: '20px'
                    }}
                  >
                    {players.map((player, idx) => {
                      const winRate = player.wins + player.losses > 0
                        ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
                        : '0.0';
                      
                      const teamData = player.submittedTeamId && playerTeamData[player.submittedTeamId] 
                        ? playerTeamData[player.submittedTeamId] 
                        : null;
                      
                      console.log('Player card render:', player.username, 'teamSubmitted:', player.teamSubmitted, 'submittedTeamId:', player.submittedTeamId, 'hasTeamData:', !!teamData);
                      
                      return (
                        <div 
                          key={player._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '24px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '24px',
                            background: `linear-gradient(135deg, ${player.teamCustomization?.cardColor || '#667eea'} 0%, ${player.teamCustomization?.cardColorEnd || '#764ba2'} 100%)`,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateX(4px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                          }}
                        >
                          {/* Team Image */}
                          <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '32px',
                            fontWeight: '700',
                            color: '#fff',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                          }}>
                            {(player.teamCustomization?.teamImage?.startsWith('http') || player.teamCustomization?.teamImage?.startsWith('data:')) ? (
                              <img 
                                key={player.teamCustomization.teamImage}
                                src={player.teamCustomization.teamImage} 
                                alt="Team" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  console.log('Image failed to load:', player.teamCustomization.teamImage?.substring(0, 50));
                                  e.target.style.display = 'none';
                                  e.target.parentElement.textContent = (player.teamCustomization?.teamName || teamData?.name || player.username || 'T').charAt(0).toUpperCase();
                                }}
                                onLoad={() => console.log('Image loaded successfully')}
                              />
                            ) : (
                              player.teamCustomization?.teamImage || (player.teamCustomization?.teamName || teamData?.name || player.username || 'T').charAt(0).toUpperCase()
                            )}
                          </div>

                          {/* Team Info */}
                          <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
                            <h4 style={{ 
                              margin: '0 0 4px 0', 
                              fontSize: '18px', 
                              fontWeight: '600',
                              color: '#fff'
                            }}>
                              {player.teamCustomization?.teamName || teamData?.name || `Team ${idx + 1}`}
                            </h4>
                            <div style={{ 
                              fontSize: '14px', 
                              color: 'rgba(255, 255, 255, 0.9)'
                            }}>
                              Coach: <span style={{ fontWeight: '500', color: '#fff' }}>{player.username}</span>
                            </div>
                          </div>

                          {/* Stats */}
                          <div style={{ 
                            display: 'flex', 
                            gap: '32px',
                            flexShrink: 0
                          }}>
                            <div style={{ textAlign: 'center', minWidth: '60px' }}>
                              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>Wins</div>
                              <div style={{ fontSize: '20px', fontWeight: '600', color: '#fff' }}>{player.wins || 0}</div>
                            </div>
                            <div style={{ textAlign: 'center', minWidth: '60px' }}>
                              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>Losses</div>
                              <div style={{ fontSize: '20px', fontWeight: '600', color: '#fff' }}>{player.losses || 0}</div>
                            </div>
                            <div style={{ textAlign: 'center', minWidth: '60px' }}>
                              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>Win %</div>
                              <div style={{ fontSize: '20px', fontWeight: '600', color: '#fff' }}>{winRate}%</div>
                            </div>
                          </div>

                          {/* Pokemon Team */}
                          <div style={{ 
                            borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                            paddingLeft: '24px',
                            flexShrink: 0
                          }}>
                            {teamData ? (
                              <div style={{
                                background: 'rgba(255, 255, 255, 0.15)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '12px',
                                padding: '12px',
                                backdropFilter: 'blur(10px)'
                              }}>
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  color: '#fff',
                                  marginBottom: '10px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Pokémon Team
                                </div>
                                <div style={{ 
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(5, 56px)',
                                  gap: '8px'
                                }}>
                                  {teamData.pokemon.map((pokemon, idx) => (
                                    <div 
                                      key={idx}
                                      style={{
                                        width: '56px',
                                        height: '56px',
                                        border: '1px solid rgba(255, 255, 255, 0.5)',
                                        borderRadius: '8px',
                                        background: `linear-gradient(135deg, ${player.teamCustomization?.cardColor || '#667eea'} 0%, ${player.teamCustomization?.cardColorEnd || '#764ba2'} 100%)`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        cursor: 'pointer'
                                      }}
                                      title={pokemon.name}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = 'none';
                                      }}
                                    >
                                      <img
                                        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id || idx + 1}.png`}
                                        alt={pokemon.name}
                                        style={{ 
                                          width: '48px', 
                                          height: '48px',
                                          objectFit: 'contain'
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : player.teamSubmitted ? (
                              <div style={{ 
                                color: '#fff',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                ✓ Team Submitted (Loading...)
                              </div>
                            ) : (
                              <div style={{ 
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontSize: '14px'
                              }}>
                                No team submitted
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rules Section - Visible to all, editable by admin */}
              <div className="league-section">
                <h3 style={{ marginBottom: '15px' }}>League Rules</h3>

                {/* Drafting Rules Panel */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#1d8ca8', marginBottom: '12px' }}>Drafting Rules</h4>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>Points Limit:</strong>
                        <div style={{ fontSize: '15px', marginTop: '4px' }}>{currentLeague.rules?.pointsLimit || 120}</div>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>Team Size:</strong>
                        <div style={{ fontSize: '15px', marginTop: '4px' }}>{currentLeague.rules?.teamSize || 12}</div>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>First Round Timer:</strong>
                        <div style={{ fontSize: '15px', marginTop: '4px' }}>
                          {enableTimer ? `${Math.floor(firstRoundTimer / 60)}:${String(firstRoundTimer % 60).padStart(2, '0')}` : 'Disabled'}
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>Subsequent Timer:</strong>
                        <div style={{ fontSize: '15px', marginTop: '4px' }}>
                          {enableTimer ? `${Math.floor(subsequentRoundTimer / 60)}:${String(subsequentRoundTimer % 60).padStart(2, '0')}` : 'Disabled'}
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>Captains Allowed:</strong>
                        <div style={{ fontSize: '15px', marginTop: '4px' }}>{currentLeague.captainRules?.captainCount || 2}</div>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>Captain Types:</strong>
                        <div style={{ fontSize: '13px', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {currentLeague.captainRules?.allowMegaCaptains && <span style={{ background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>Mega</span>}
                          {currentLeague.captainRules?.allowTeraCaptains && <span style={{ background: '#fce7f3', padding: '2px 8px', borderRadius: '4px' }}>Tera</span>}
                          {currentLeague.captainRules?.allowGmaxCaptains && <span style={{ background: '#ddd6fe', padding: '2px 8px', borderRadius: '4px' }}>Gmax</span>}
                          {currentLeague.captainRules?.allowZMoveCaptains && <span style={{ background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>Z-Move</span>}
                          {!currentLeague.captainRules?.allowMegaCaptains && !currentLeague.captainRules?.allowTeraCaptains && !currentLeague.captainRules?.allowGmaxCaptains && !currentLeague.captainRules?.allowZMoveCaptains && <span style={{ color: '#94a3b8' }}>None</span>}
                        </div>
                      </div>
                    </div>
                    {(currentLeague.captainRules?.bannedCaptains || []).length > 0 && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>Banned Captains:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {(currentLeague.captainRules?.bannedCaptains || []).map((name, idx) => {
                            const pokemon = draftPokemonList.find(p => p.name === name);
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#fee2e2',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  border: '1px solid #fecaca'
                                }}
                              >
                                {pokemon?.img && <img src={pokemon.img} alt={name} style={{ width: '16px', height: '16px' }} />}
                                <span>{name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#1d8ca8', marginBottom: '8px' }}>Draft Rules Notes</h4>
                  <textarea
                    value={draftRules}
                    onChange={(e) => {
                      if (currentLeague.commissionerName === username) {
                        setDraftRules(e.target.value);
                      }
                    }}
                    onBlur={async () => {
                      if (currentLeague.commissionerName === username) {
                        try {
                          await updateLeague(currentLeague.code, { draftRules });
                          setMessage('Draft rules notes saved');
                          setTimeout(() => setMessage(''), 2000);
                        } catch (err) {
                          setError('Failed to save draft rules notes');
                        }
                      }
                    }}
                    readOnly={currentLeague.commissionerName !== username}
                    placeholder={currentLeague.commissionerName === username ? "Add any additional draft rules or notes here..." : ""}
                    style={{
                      width: 'calc(100% - 20px)',
                      minHeight: '200px',
                      padding: '12px',
                      marginRight: '20px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      resize: 'vertical',
                      background: currentLeague.commissionerName === username ? '#fff' : '#f8f9fa',
                      cursor: currentLeague.commissionerName === username ? 'text' : 'default',
                      color: draftRules ? '#000' : '#94a3b8'
                    }}
                  />
                  {!draftRules && currentLeague.commissionerName !== username && (
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '14px', 
                      color: '#94a3b8',
                      fontStyle: 'italic'
                    }}>
                      No additional draft rules notes.
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ color: '#1d8ca8', marginBottom: '8px' }}>Battle Rules</h4>
                  <textarea
                    value={battleRules}
                    onChange={(e) => {
                      if (currentLeague.commissionerName === username) {
                        setBattleRules(e.target.value);
                      }
                    }}
                    onBlur={async () => {
                      if (currentLeague.commissionerName === username) {
                        try {
                          await updateLeague(currentLeague.code, { battleRules });
                          setMessage('Battle rules saved');
                          setTimeout(() => setMessage(''), 2000);
                        } catch (err) {
                          setError('Failed to save battle rules');
                        }
                      }
                    }}
                    readOnly={currentLeague.commissionerName !== username}
                    placeholder={currentLeague.commissionerName === username ? "Add battle rules or format here..." : ""}
                    style={{
                      width: 'calc(100% - 20px)',
                      minHeight: '300px',
                      padding: '12px',
                      marginRight: '20px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      resize: 'vertical',
                      background: currentLeague.commissionerName === username ? '#fff' : '#f8f9fa',
                      cursor: currentLeague.commissionerName === username ? 'text' : 'default',
                      color: battleRules ? '#000' : '#94a3b8'
                    }}
                  />
                  {!battleRules && currentLeague.commissionerName !== username && (
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '14px', 
                      color: '#94a3b8',
                      fontStyle: 'italic'
                    }}>
                      No battle rules specified.
                    </div>
                  )}
                </div>
              </div>
            </>
        </div>
      )}

      {/* Draft Format Modal */}
      {showDraftFormatModal && (
        <div className="modal-overlay" onClick={() => setShowDraftFormatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} key={draftFormatModalKey}>
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
                <label>
                  <input
                    type="checkbox"
                    checked={allowMega}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      setAllowMega(newValue);
                      if (newValue) {
                        fetchMegaPokemon();
                      } else {
                        removeMegaPokemon();
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Mega Evolutions
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowGmax}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      setAllowGmax(newValue);
                      if (newValue) {
                        fetchGmaxPokemon();
                      } else {
                        removeGmaxPokemon();
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Gigantamax
                </label>
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
                <div style={{ flex: 1 }}>
                  <button
                    type="button"
                    onClick={unbanAll}
                    className="admin-btn"
                    style={{ width: '100%', padding: '8px' }}
                  >
                    Unban All
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
                            
                            // Check if it's a mega or gmax form
                            const name = p.name.toLowerCase();
                            const isMega = name.includes('-mega');
                            const isGmax = name.includes('-gmax') || name.includes('eternamax');
                            
                            // Bypass generation filter for mega/gmax if allowed
                            const shouldIgnoreGen = (isMega && allowMega) || (isGmax && allowGmax);
                            if (shouldIgnoreGen) return true;
                            
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

      {/* Draft Rules Modal */}
      {showDraftRulesModal && (
        <div className="modal-overlay" onClick={() => setShowDraftRulesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Set Draft Rules</h2>
              <button onClick={() => setShowDraftRulesModal(false)} className="modal-close">&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Number of Captains Allowed</label>
                <input
                  type="number"
                  value={captainCount}
                  onChange={(e) => setCaptainCount(Number(e.target.value))}
                  min="0"
                  max="10"
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowMegaCaptains}
                    onChange={(e) => setAllowMegaCaptains(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Mega Captains
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowTeraCaptains}
                    onChange={(e) => setAllowTeraCaptains(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Tera Captains
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowGmaxCaptains}
                    onChange={(e) => setAllowGmaxCaptains(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Gigantamax Captains
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowZMoveCaptains}
                    onChange={(e) => setAllowZMoveCaptains(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Allow Z-Move Captains
                </label>
              </div>

              <div className="form-group">
                <label>Banned Captains</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Search Pokémon to ban as captain"
                      value={captainSearchQuery}
                      onChange={(e) => {
                        setCaptainSearchQuery(e.target.value.toLowerCase());
                        setCaptainSuggestionsVisible(true);
                      }}
                      onBlur={() => setTimeout(() => setCaptainSuggestionsVisible(false), 150)}
                      onFocus={() => { if (captainSearchQuery) setCaptainSuggestionsVisible(true); }}
                      style={{ width: '100%' }}
                    />
                    {captainSuggestionsVisible && captainSearchQuery && (
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
                          .filter(p => p.name.toLowerCase().includes(captainSearchQuery))
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
                                if (!selectedPokemonForCaptainBan.find(sp => sp.id === p.id)) {
                                  setSelectedPokemonForCaptainBan([...selectedPokemonForCaptainBan, p]);
                                }
                                setCaptainSearchQuery('');
                                setCaptainSuggestionsVisible(false);
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                            >
                              {p.img && <img src={p.img} alt={p.name} style={{ width: '32px', height: '32px' }} />}
                              <span>{p.name}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (selectedPokemonForCaptainBan.length === 0) {
                        alert('Please select Pokémon first');
                        return;
                      }
                      const newBannedCaptains = [...bannedCaptains];
                      selectedPokemonForCaptainBan.forEach(p => {
                        if (!newBannedCaptains.includes(p.name)) {
                          newBannedCaptains.push(p.name);
                        }
                      });
                      setBannedCaptains(newBannedCaptains);
                      setSelectedPokemonForCaptainBan([]);
                    }}
                    className="admin-btn"
                    style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}
                  >
                    Add to List
                  </button>
                </div>
                
                {/* Display selected Pokemon as removable chips */}
                {selectedPokemonForCaptainBan.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {selectedPokemonForCaptainBan.map((p) => (
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
                        {p.img && <img src={p.img} alt={p.name} style={{ width: '20px', height: '20px' }} />}
                        <span>{p.name}</span>
                        <button
                          onClick={() =>
                            setSelectedPokemonForCaptainBan(selectedPokemonForCaptainBan.filter(sp => sp.id !== p.id))
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
                      onClick={() => setSelectedPokemonForCaptainBan([])}
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

                {/* Display banned captains list */}
                {bannedCaptains.length > 0 && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '12px', 
                    background: '#f8f9fa', 
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>
                      Banned Captain Pokémon ({bannedCaptains.length})
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {bannedCaptains.map((name, idx) => {
                        const pokemon = draftPokemonList.find(p => p.name === name);
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#fee2e2',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '13px',
                              border: '1px solid #fecaca'
                            }}
                          >
                            {pokemon?.img && <img src={pokemon.img} alt={name} style={{ width: '18px', height: '18px' }} />}
                            <span>{name}</span>
                            <button
                              onClick={() => setBannedCaptains(bannedCaptains.filter(n => n !== name))}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: 0,
                                lineHeight: 1,
                                color: '#ef4444'
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowDraftRulesModal(false)} className="back-btn">
                Cancel
              </button>
              <button onClick={handleSaveDraftRules} className="admin-btn">
                Save Draft Rules
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
                <label>League Image URL:</label>
                <div style={{ marginTop: '10px' }}>
                  {leagueImageUrl ? (
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ position: 'relative', display: 'inline-block', marginBottom: '10px' }}>
                        <img 
                          src={leagueImageUrl} 
                          alt="League" 
                          style={{ 
                            maxWidth: '100%',
                            maxHeight: '200px', 
                            borderRadius: '8px',
                            display: 'block'
                          }} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div style="padding: 20px; border: 2px dashed #ef4444; border-radius: 8px; color: #ef4444; text-align: center;">Invalid image URL</div>';
                          }}
                        />
                      </div>
                      <button
                        onClick={handleRemoveLeagueImage}
                        disabled={uploadingImage}
                        style={{
                          padding: '6px 12px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: uploadingImage ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '20px', 
                      border: '2px dashed #cbd5e1', 
                      borderRadius: '8px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      marginBottom: '10px'
                    }}>
                      No image set
                    </div>
                  )}
                  <div>
                    <input
                      type="text"
                      placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                      value={leagueImageUrl}
                      onChange={(e) => setLeagueImageUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        marginBottom: '10px'
                      }}
                    />
                    <button
                      onClick={handleSaveLeagueImageUrl}
                      disabled={uploadingImage || !leagueImageUrl.trim()}
                      style={{
                        padding: '8px 16px',
                        background: (uploadingImage || !leagueImageUrl.trim()) ? '#e5e7eb' : '#3b82f6',
                        color: (uploadingImage || !leagueImageUrl.trim()) ? '#94a3b8' : '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (uploadingImage || !leagueImageUrl.trim()) ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '13px'
                      }}
                    >
                      {uploadingImage ? 'Saving...' : 'Save Image URL'}
                    </button>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                      Use a direct link to an image (Imgur, Discord CDN, etc.)
                    </div>
                  </div>
                </div>
              </div>

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
                  onChange={async (e) => {
                    const newBracketType = e.target.value;
                    setCurrentLeague({ ...currentLeague, bracketType: newBracketType });
                    
                    try {
                      // Clear current bracket
                      setBracketMatches([]);
                      
                      // Wait a bit for state to settle
                      setTimeout(async () => {
                        // Generate new matches based on bracket type
                        let generatedMatches = null;
                        if (newBracketType === 'round_robin') {
                          generatedMatches = generateRoundRobinMatches();
                        } else if (newBracketType === 'single_elimination') {
                          generatedMatches = generateSingleEliminationBracket();
                        } else if (newBracketType === 'swiss') {
                          generatedMatches = generateSwissBracket();
                        }
                        
                        // Save bracket type AND generated matches to database
                        if (generatedMatches && generatedMatches.length > 0) {
                          await updateLeague(currentLeague.code, { 
                            bracketType: newBracketType,
                            bracket: {
                              type: newBracketType,
                              matches: generatedMatches
                            }
                          });
                          setMessage('Bracket type updated and matches regenerated!');
                        } else {
                          // Just save bracket type if no matches were generated
                          await updateLeague(currentLeague.code, { bracketType: newBracketType });
                          setMessage('Bracket type updated!');
                        }
                        setTimeout(() => setMessage(''), 3000);
                      }, 100);
                    } catch (err) {
                      console.error('Failed to update bracket type:', err);
                      setError('Failed to update bracket type: ' + err.message);
                    }
                  }}
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

      {/* Edit Team Modal */}
      {showEditTeamModal && (
        <div className="modal-overlay" onClick={() => setShowEditTeamModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', padding: '30px' }}>
            <h2 style={{ marginTop: 0 }}>Edit Team</h2>
            
            {/* Team Preview */}
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              background: `linear-gradient(135deg, ${editTeamColor} 0%, ${editTeamColorEnd} 100%)`,
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              color: '#fff'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '8px',
                background: (editTeamImage.startsWith('http') || editTeamImage.startsWith('data:')) ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: '700',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                overflow: 'hidden'
              }}>
                {(editTeamImage.startsWith('http') || editTeamImage.startsWith('data:')) ? (
                  <img 
                    key={editTeamImage}
                    src={editTeamImage} 
                    alt="Team" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.textContent = (editTeamName || 'T').charAt(0).toUpperCase();
                    }}
                  />
                ) : (
                  editTeamImage || (editTeamName || 'T').charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '600' }}>{editTeamName || 'Team Name'}</div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Coach: {username}</div>
              </div>
            </div>

            {/* Team Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Team Name</label>
              <input
                type="text"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                placeholder="Enter team name"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
                maxLength={30}
              />
            </div>

            {/* Team Image/Initial */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Team Image URL</label>
              <input
                type="text"
                value={editTeamImage}
                onChange={(e) => setEditTeamImage(e.target.value)}
                placeholder="Enter image URL or a single character"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                Enter a full image URL (http://...) or a single character/emoji
              </div>
            </div>

            {/* Card Colors */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Card Background Gradient</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#6b7280' }}>Start Color</label>
                  <input
                    type="color"
                    value={editTeamColor}
                    onChange={(e) => setEditTeamColor(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#6b7280' }}>End Color</label>
                  <input
                    type="color"
                    value={editTeamColorEnd}
                    onChange={(e) => setEditTeamColorEnd(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => { setEditTeamColor('#667eea'); setEditTeamColorEnd('#764ba2'); }} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', cursor: 'pointer' }}>Purple</button>
                <button onClick={() => { setEditTeamColor('#f093fb'); setEditTeamColorEnd('#f5576c'); }} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: '#fff', cursor: 'pointer' }}>Pink</button>
                <button onClick={() => { setEditTeamColor('#4facfe'); setEditTeamColorEnd('#00f2fe'); }} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: '#fff', cursor: 'pointer' }}>Blue</button>
                <button onClick={() => { setEditTeamColor('#43e97b'); setEditTeamColorEnd('#38f9d7'); }} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: '#fff', cursor: 'pointer' }}>Green</button>
                <button onClick={() => { setEditTeamColor('#fa709a'); setEditTeamColorEnd('#fee140'); }} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: '#fff', cursor: 'pointer' }}>Sunset</button>
                <button onClick={() => { setEditTeamColor('#30cfd0'); setEditTeamColorEnd('#330867'); }} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', color: '#fff', cursor: 'pointer' }}>Ocean</button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowEditTeamModal(false)} 
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  try {
                    console.log('Saving team customization:', {
                      username,
                      leagueCode: currentLeague.code,
                      teamName: editTeamName,
                      teamImage: editTeamImage,
                      cardColor: editTeamColor,
                      cardColorEnd: editTeamColorEnd
                    });

                    // Update team customization in backend
                    const response = await fetch(`${API_BASE}/api/leagues/${currentLeague.code}/customize-team`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        username: username,
                        teamCustomization: {
                          teamName: editTeamName,
                          teamImage: editTeamImage,
                          cardColor: editTeamColor,
                          cardColorEnd: editTeamColorEnd
                        }
                      }),
                    });

                    const data = await response.json();
                    console.log('Server response:', data);

                    if (!response.ok) {
                      throw new Error(data.error || 'Failed to save team customization');
                    }

                    setShowEditTeamModal(false);
                    alert('Team customization saved successfully!');
                    
                    // Reload players to get updated data
                    const playersData = await getLeaguePlayers(currentLeague.code);
                    console.log('Reloaded players data:', playersData);
                    console.log('First player teamCustomization:', playersData.players?.[0]?.teamCustomization);
                    setPlayers(playersData.players || []);
                  } catch (error) {
                    console.error('Error saving team customization:', error);
                    alert(`Failed to save team customization: ${error.message}`);
                  }
                }}
                className="admin-btn"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Submission Modal */}
      {showTeamSubmissionModal && (
        <div className="modal-overlay" onClick={() => setShowTeamSubmissionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', padding: '30px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Submit Your Team</h2>
            
            <div style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>
              Select a saved team from your drafts to submit to this league:
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                Loading your saved teams...
              </div>
            ) : savedTeamsForSubmission.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                background: '#f8f9fa', 
                borderRadius: '8px',
                color: '#666'
              }}>
                <div style={{ fontSize: '16px', marginBottom: '10px' }}>No saved teams found</div>
                <div style={{ fontSize: '13px' }}>
                  Complete a draft with this league code first to save a team for this league.
                </div>
              </div>
            ) : (
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                marginBottom: '20px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                {savedTeamsForSubmission.map((team) => (
                  <div
                    key={team._id}
                    onClick={() => setSelectedTeamForSubmission(team)}
                    style={{
                      padding: '15px',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      background: selectedTeamForSubmission?._id === team._id ? '#eff6ff' : '#fff',
                      transition: 'background 0.15s',
                      ':hover': { background: '#f8f9fa' }
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTeamForSubmission?._id !== team._id) {
                        e.currentTarget.style.background = '#f8f9fa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTeamForSubmission?._id !== team._id) {
                        e.currentTarget.style.background = '#fff';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <input
                        type="radio"
                        checked={selectedTeamForSubmission?._id === team._id}
                        onChange={() => setSelectedTeamForSubmission(team)}
                        style={{ marginRight: '10px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                          Team from {new Date(team.createdAt).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          {team.pokemon.length} Pokémon · {team.pointsUsed}/{team.pointsLimit} points
                        </div>
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#475569',
                      marginLeft: '30px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px'
                    }}>
                      {team.pokemon.slice(0, 6).map((p, i) => (
                        <span key={i} style={{ 
                          background: '#e2e8f0',
                          padding: '2px 8px',
                          borderRadius: '3px'
                        }}>
                          {p.name}
                        </span>
                      ))}
                      {team.pokemon.length > 6 && (
                        <span style={{ color: '#94a3b8', padding: '2px 4px' }}>
                          +{team.pokemon.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setShowTeamSubmissionModal(false);
                  setSelectedTeamForSubmission(null);
                  setSavedTeamsForSubmission([]);
                }}
                style={{ 
                  padding: '12px 24px',
                  background: '#e5e7eb',
                  color: '#1f2937',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitTeam}
                disabled={loading || !selectedTeamForSubmission}
                style={{ 
                  padding: '12px 24px',
                  background: selectedTeamForSubmission ? '#6366f1' : '#cbd5e1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: selectedTeamForSubmission ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {loading ? 'Submitting...' : 'Submit Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Player Team Modal */}
      {showPlayerTeamModal && (
        <div className="modal-overlay" onClick={() => {
          setShowPlayerTeamModal(false);
          setSelectedPlayerTeam(null);
          setPlayerTeamData(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', padding: '30px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
              {selectedPlayerTeam?.username}'s Team
            </h2>
            
            {!playerTeamData ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                Loading team...
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                    {playerTeamData.pokemon.length} Pokémon
                    {playerTeamData.pointsRemaining != null && (
                      <span> · {playerTeamData.pointsRemaining} points remaining</span>
                    )}
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
                    gap: '15px' 
                  }}>
                    {playerTeamData.pokemon.map((pokemon, idx) => (
                      <div 
                        key={idx}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center',
                          background: '#fff'
                        }}
                      >
                        <img 
                          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idx + 1}.png`}
                          alt={pokemon.name}
                          style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          marginTop: '8px',
                          wordBreak: 'break-word'
                        }}>
                          {pokemon.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button 
                onClick={() => {
                  setShowPlayerTeamModal(false);
                  setSelectedPlayerTeam(null);
                  setPlayerTeamData(null);
                }}
                style={{ 
                  padding: '12px 24px',
                  background: '#e5e7eb',
                  color: '#1f2937',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Close
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

      {/* Match Replay Upload Modal */}
      {showMatchReplayModal && (
        <div className="modal-overlay" onClick={() => setShowMatchReplayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Upload Replay Link</h2>
              <button onClick={() => setShowMatchReplayModal(false)} className="modal-close">&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Enter the Pokemon Showdown replay link for this match
              </p>
              <input
                type="url"
                value={matchReplayLink}
                onChange={(e) => setMatchReplayLink(e.target.value)}
                placeholder="https://replay.pokemonshowdown.com/..."
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '15px'
                }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => {
                    setShowMatchReplayModal(false);
                    setMatchReplayLink('');
                  }}
                  style={{ 
                    padding: '8px 16px',
                    background: '#e0e0e0',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveReplayLink}
                  disabled={loading || !matchReplayLink.trim()}
                  style={{ 
                    padding: '8px 16px',
                    background: matchReplayLink.trim() ? '#3b82f6' : '#ccc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: matchReplayLink.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Team Upload Modal */}
      {showMatchTeamModal && (
        <div className="modal-overlay" onClick={() => setShowMatchTeamModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Upload Team for Match</h2>
              <button onClick={() => setShowMatchTeamModal(false)} className="modal-close">&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Paste your team in Pokemon Showdown format (the format used when exporting from the team builder)
              </p>
              <textarea
                value={matchTeamText}
                onChange={(e) => setMatchTeamText(e.target.value)}
                placeholder={`Example:\n\narchaludon\n\ntogekiss\n\nscizor @ expert-belt\nAbility: technician\nTera Type: Water\nEVs: 255 HP / 255 Spe\n- swords-dance\n- double-team\n- mimic\n- hyper-beam\n\ngholdengo\n\nkingambit\n\nforretress`}
                style={{
                  width: '100%',
                  minHeight: '300px',
                  padding: '10px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '15px',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => {
                    setShowMatchTeamModal(false);
                    setMatchTeamText('');
                  }}
                  style={{ 
                    padding: '8px 16px',
                    background: '#e0e0e0',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveMatchTeam}
                  disabled={loading || !matchTeamText.trim()}
                  style={{ 
                    padding: '8px 16px',
                    background: matchTeamText.trim() ? '#8b5cf6' : '#ccc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: matchTeamText.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  {loading ? 'Saving...' : 'Save Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Match Teams Modal */}
      {showViewMatchTeamsModal && selectedMatchForView && (
        <div className="modal-overlay" onClick={() => {
          console.log('Closing modal');
          setShowViewMatchTeamsModal(false);
          setSelectedMatchForView(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', width: '90%' }}>
            <div className="modal-header">
              <h2>Match Teams</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  onClick={handleExportMatch}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  {loading ? 'Exporting...' : 'Export as Image'}
                </button>
                <button onClick={() => setShowViewMatchTeamsModal(false)} className="modal-close">&times;</button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: '30px 20px' }}>
              <div ref={matchExportRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', background: '#1a1a2e', padding: '20px', borderRadius: '16px' }}>
                {/* Player 1 Team */}
                {(() => {
                  const player1 = players.find(p => p.username === selectedMatchForView.player1);
                  const team1Data = player1?.submittedTeamId && playerTeamData[player1.submittedTeamId] 
                    ? playerTeamData[player1.submittedTeamId] 
                    : null;
                  const uploadedTeam1 = selectedMatchForView.teams?.[selectedMatchForView.player1];
                  const pokemon1 = uploadedTeam1 ? parseTeamText(uploadedTeam1) : [];

                  return (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '20px',
                      padding: '30px',
                      background: `linear-gradient(135deg, ${player1?.teamCustomization?.cardColor || '#667eea'} 0%, ${player1?.teamCustomization?.cardColorEnd || '#764ba2'} 100%)`,
                      borderRadius: '16px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      {/* Team Image */}
                      <div style={{
                        width: '180px',
                        height: '180px',
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '72px',
                        fontWeight: '700',
                        color: '#fff',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                        overflow: 'hidden'
                      }}>
                        {(player1?.teamCustomization?.teamImage?.startsWith('http') || player1?.teamCustomization?.teamImage?.startsWith('data:')) ? (
                          <img 
                            src={player1.teamCustomization.teamImage} 
                            alt="Team" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.textContent = (player1?.teamCustomization?.teamName || team1Data?.name || selectedMatchForView.player1 || 'T').charAt(0).toUpperCase();
                            }}
                          />
                        ) : (
                          player1?.teamCustomization?.teamImage || (player1?.teamCustomization?.teamName || team1Data?.name || selectedMatchForView.player1 || 'T').charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Team Name */}
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '24px', 
                        fontWeight: '700',
                        color: '#fff',
                        textAlign: 'center'
                      }}>
                        {player1?.teamCustomization?.teamName || team1Data?.name || 'Team 1'}
                      </h3>

                      {/* Coach Name */}
                      <div style={{ 
                        fontSize: '16px', 
                        color: 'rgba(255, 255, 255, 0.9)',
                        textAlign: 'center'
                      }}>
                        Coach: <span style={{ fontWeight: '600', color: '#fff' }}>{selectedMatchForView.player1 || 'TBD'}</span>
                      </div>

                      {/* Pokemon Team */}
                      {uploadedTeam1 && pokemon1.length > 0 ? (
                        <div style={{
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.15)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '12px',
                          padding: '20px',
                          backdropFilter: 'blur(10px)'
                        }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#fff',
                            marginBottom: '15px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            textAlign: 'center'
                          }}>
                            Pokémon Team
                          </div>
                          <div style={{ 
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '8px'
                          }}>
                            {pokemon1.slice(0, 6).map((pokemonName, idx) => (
                              <PokemonCard
                                key={idx}
                                pokemonName={pokemonName}
                                gradientStart={player1?.teamCustomization?.cardColor || '#667eea'}
                                gradientEnd={player1?.teamCustomization?.cardColorEnd || '#764ba2'}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '14px',
                          fontStyle: 'italic'
                        }}>
                          No team uploaded
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* VS Badge */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: '900',
                    color: '#fff',
                    boxShadow: '0 6px 16px rgba(245, 87, 108, 0.4)',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    VS
                  </div>
                </div>

                {/* Player 2 Team */}
                {(() => {
                  const player2 = players.find(p => p.username === selectedMatchForView.player2);
                  const team2Data = player2?.submittedTeamId && playerTeamData[player2.submittedTeamId] 
                    ? playerTeamData[player2.submittedTeamId] 
                    : null;
                  const uploadedTeam2 = selectedMatchForView.teams?.[selectedMatchForView.player2];
                  const pokemon2 = uploadedTeam2 ? parseTeamText(uploadedTeam2) : [];

                  return (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '20px',
                      padding: '30px',
                      background: `linear-gradient(135deg, ${player2?.teamCustomization?.cardColor || '#667eea'} 0%, ${player2?.teamCustomization?.cardColorEnd || '#764ba2'} 100%)`,
                      borderRadius: '16px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      {/* Team Image */}
                      <div style={{
                        width: '180px',
                        height: '180px',
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '72px',
                        fontWeight: '700',
                        color: '#fff',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                        overflow: 'hidden'
                      }}>
                        {(player2?.teamCustomization?.teamImage?.startsWith('http') || player2?.teamCustomization?.teamImage?.startsWith('data:')) ? (
                          <img 
                            src={player2.teamCustomization.teamImage} 
                            alt="Team" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.textContent = (player2?.teamCustomization?.teamName || team2Data?.name || selectedMatchForView.player2 || 'T').charAt(0).toUpperCase();
                            }}
                          />
                        ) : (
                          player2?.teamCustomization?.teamImage || (player2?.teamCustomization?.teamName || team2Data?.name || selectedMatchForView.player2 || 'T').charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Team Name */}
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '24px', 
                        fontWeight: '700',
                        color: '#fff',
                        textAlign: 'center'
                      }}>
                        {player2?.teamCustomization?.teamName || team2Data?.name || 'Team 2'}
                      </h3>

                      {/* Coach Name */}
                      <div style={{ 
                        fontSize: '16px', 
                        color: 'rgba(255, 255, 255, 0.9)',
                        textAlign: 'center'
                      }}>
                        Coach: <span style={{ fontWeight: '600', color: '#fff' }}>{selectedMatchForView.player2 || 'TBD'}</span>
                      </div>

                      {/* Pokemon Team */}
                      {uploadedTeam2 && pokemon2.length > 0 ? (
                        <div style={{
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.15)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '12px',
                          padding: '20px',
                          backdropFilter: 'blur(10px)'
                        }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#fff',
                            marginBottom: '15px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            textAlign: 'center'
                          }}>
                            Pokémon Team
                          </div>
                          <div style={{ 
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '8px'
                          }}>
                            {pokemon2.slice(0, 6).map((pokemonName, idx) => (
                              <PokemonCard
                                key={idx}
                                pokemonName={pokemonName}
                                gradientStart={player2?.teamCustomization?.cardColor || '#667eea'}
                                gradientEnd={player2?.teamCustomization?.cardColorEnd || '#764ba2'}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '14px',
                          fontStyle: 'italic'
                        }}>
                          No team uploaded
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueManager;
