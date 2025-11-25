import logo from './logo.svg';
import './App.css';
import { useState, useEffect } from 'react';
import CreditsPage from './pages/Credits';
import ContactPage from './pages/Contact';
import PrivacyPage from './pages/Privacy';
import CopyrightPage from './pages/Copyright';
import axios from 'axios';
import { io } from 'socket.io-client';


function App() {

  const [PokemonName, setPokemonName] = useState("");
  const [PokemonChosen, setPokemonChosen] = useState(false);  
  const [PokemonData, setPokemonData] = useState({
    species: "",
    img: "",
    type: "",
    type2: ""
  });

  const [pokemonList, setPokemonList] = useState([]);

  const fetchPokemonData = () => {
    axios.get(`https://pokeapi.co/api/v2/pokemon/${PokemonName.toLowerCase()}`).then(
      (response) => {
        setPokemonData({
            species: response.data.species.name,
            img: response.data.sprites.front_default, 
            type1: response.data.types[0].type.name,
            type2: response.data.types[1] ? response.data.types[1].type.name : null
          });
        setPokemonChosen(true);
        }
      )
    };

  const [exportMessage, setExportMessage] = useState("");
  // saved username cookie key
  const usernameCookieKey = 'pkmndraft_username';

  const saveUsernameToCookie = (name) => {
    try {
      const key = usernameCookieKey;
      const maxAge = 60 * 60 * 24 * 365;
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(name)}; path=/; max-age=${maxAge}`;
      setExportMessage('Username saved');
      setTimeout(() => setExportMessage(''), 2500);
      // inform user about changing effects
      window.alert('Username saved. Changing this will prevent joining any currently saved ongoing drafts');
    } catch (err) {
      console.error('Failed to save username cookie', err);
      setExportMessage('Failed to save username');
      setTimeout(() => setExportMessage(''), 2500);
    }
  };

  const readUsernameFromCookie = () => {
    try {
      const key = usernameCookieKey;
      const c = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${encodeURIComponent(key)}=`));
      if (!c) return null;
      const raw = decodeURIComponent(c.split('=')[1]);
      return raw || null;
    } catch (err) {
      return null;
    }
  };
  const [savedTeamsVisible, setSavedTeamsVisible] = useState(false);
  const [savedTeams, setSavedTeams] = useState([]);
  const [copiedTeamKey, setCopiedTeamKey] = useState(null);
  const [footerPage, setFooterPage] = useState(null);
  const [ongoingDraftsVisible, setOngoingDraftsVisible] = useState(false);
  const [ongoingDrafts, setOngoingDrafts] = useState([]);
  const [viewedOngoingTeam, setViewedOngoingTeam] = useState(null);
  const [rejoinPending, setRejoinPending] = useState(null);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [leaveDraftConfirmVisible, setLeaveDraftConfirmVisible] = useState(false);
  const [draftComplete, setDraftComplete] = useState(false);
  const [finalTeams, setFinalTeams] = useState(null);
  // app view: 'lobby' (main), 'draft' (the drafting page), or 'teambuilder' (team builder page)
  const [view, setView] = useState('lobby');
  // Team builder state
  const [itemsList, setItemsList] = useState([]);
  const [naturesList, setNaturesList] = useState([]);
  const [teamBuilderData, setTeamBuilderData] = useState(null);
  const [teamBuilderLoaded, setTeamBuilderLoaded] = useState(false);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  // lobby state
  const [lobbyCode, setLobbyCode] = useState('');
  const [lobbyUsers, setLobbyUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [remoteSelections, setRemoteSelections] = useState({});
  // optimistic local picks (keyed by socket id)
  const [optimisticSelections, setOptimisticSelections] = useState({});
  const [hostId, setHostId] = useState(null);
  const [lobbySettings, setLobbySettings] = useState({ 
    pointsLimit: 100, 
    teamSizeLimit: 10,
    allowTrading: false,
    maxTradeLimit: 0,
    unlimitedTrades: false
  });
  const [banList, setBanList] = useState([]);
  const [pointsMap, setPointsMap] = useState({});
  const [pointsRemaining, setPointsRemaining] = useState({});
  // list of pokemon to show during an active draft (snapshot from lobby table)
  const [draftPokemonList, setDraftPokemonList] = useState([]);
  const [pointsSearchName, setPointsSearchName] = useState('');
  const [pointsValueSelected, setPointsValueSelected] = useState(1);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [lobbyDraftOrder, setLobbyDraftOrder] = useState([]);
  const [lobbyGenFilter, setLobbyGenFilter] = useState(0);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [localPlayerName, setLocalPlayerName] = useState('');
  const [draftSuggestionsVisible, setDraftSuggestionsVisible] = useState(false);
  
  // Advanced filter states
  const [filterTypes, setFilterTypes] = useState([]);
  const [filterGeneration, setFilterGeneration] = useState(0);
  const [filterPointsMin, setFilterPointsMin] = useState('');
  const [filterPointsMax, setFilterPointsMax] = useState('');
  const [filterAbility, setFilterAbility] = useState('');
  const [filterMove, setFilterMove] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Trading state
  const [tradingPhaseActive, setTradingPhaseActive] = useState(false);
  const [selectedForTrade, setSelectedForTrade] = useState([]); // [{pokemonName, ownerId}]
  const [pendingTradeOffer, setPendingTradeOffer] = useState(null); // {from, to, pokemon1, pokemon2}
  const [incomingTradeOffer, setIncomingTradeOffer] = useState(null);
  const [playersFinishedTrading, setPlayersFinishedTrading] = useState([]);
  const [tradesCompleted, setTradesCompleted] = useState({}); // {userId: count}
  const [showUnpickedModal, setShowUnpickedModal] = useState(null); // {pokemonName, ownerId}

  // Team builder constants
  const TEAM_BUILDER_STORAGE_KEY = 'pkmndraft_teambuilder';
  const MAX_EVS = 510;
  const MAX_SINGLE_EV = 255;
  const MAX_IV = 31;

  // Validation constants
  const CURRENT_SCHEMA_VERSION = 1;
  const MAX_SAVED_TEAM_AGE_DAYS = 90; // 3 months
  const MAX_ONGOING_DRAFT_AGE_DAYS = 30; // 1 month

  // Sanitization helpers
  const sanitizeTeamSize = (size) => {
    const num = Number(size);
    if (!Number.isFinite(num) || num < 1) return 1;
    if (num > 60) return 60;
    return Math.floor(num);
  };

  const sanitizePoints = (points) => {
    const num = Number(points);
    if (!Number.isFinite(num) || num < 0) return 0;
    if (num > 1000) return 1000;
    return Math.floor(num);
  };

  const sanitizeLobbyCode = (code) => {
    if (!code || typeof code !== 'string') return null;
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 4 || cleaned.length > 12) return null;
    return cleaned;
  };

  // Expiry validation
  const isExpired = (savedAt, maxAgeDays) => {
    if (!savedAt || !Number.isFinite(savedAt)) return true;
    const age = Date.now() - savedAt;
    return age > maxAgeDays * 24 * 60 * 60 * 1000;
  };

  // Schema validation for saved teams
  const validateSavedTeam = (payload) => {
    if (!payload || typeof payload !== 'object') return false;
    if (!payload.lobbyCode || typeof payload.lobbyCode !== 'string') return false;
    if (!Array.isArray(payload.team)) return false;
    if (payload.team.length === 0) return false;
    
    // Validate each Pokémon entry
    for (const p of payload.team) {
      if (!p || typeof p !== 'object') return false;
      if (!p.name || typeof p.name !== 'string') return false;
      // id and img are optional but should be correct types if present
      if (p.id != null && typeof p.id !== 'number' && typeof p.id !== 'string') return false;
      if (p.img != null && typeof p.img !== 'string') return false;
    }
    
    return true;
  };

  // Schema validation for ongoing drafts
  const validateOngoingDraft = (entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.code || typeof entry.code !== 'string') return false;
    if (!Array.isArray(entry.players)) return false;
    
    // Validate nested structures if present
    if (entry.settings && typeof entry.settings !== 'object') return false;
    if (entry.pointsRemainingByName && typeof entry.pointsRemainingByName !== 'object') return false;
    if (entry.pointsRemaining && typeof entry.pointsRemaining !== 'object') return false;
    if (entry.draftOrder && !Array.isArray(entry.draftOrder)) return false;
    
    return true;
  };

  // Normalize incoming points maps: lowercase keys and numeric values (allow 0 for banned)
  const normalizePointsMap = (pm) => {
    const out = {};
    if (!pm || typeof pm !== 'object') return out;
    for (const [k, v] of Object.entries(pm)) {
      const key = String(k).toLowerCase();
      const raw = Number(v);
      const val = Number.isFinite(raw) ? raw : 1;
      out[key] = val;
    }
    return out;
  };
  

  const toShowdownName = (raw) => {
    // Convert a pokemon api name like 'porygon-z' or 'mime-jr' to a Showdown-like
    // display: capitalize segments and keep hyphens (e.g., 'Porygon-Z').
    if (!raw) return '';
    return raw.split('-').map(seg => {
      if (seg.length === 0) return seg;
      return seg[0].toUpperCase() + seg.slice(1);
    }).join('-');
  };

  const copyToClipboard = async (text) => {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      return true;
    } catch (e) {
      console.error('Clipboard copy failed', e);
      return false;
    }
  };

  // Copy the current lobby code to clipboard with a short confirmation
  const copyLobbyCode = async () => {
    if (!lobbyCode) return;
    const ok = await copyToClipboard(lobbyCode);
    if (ok) {
      setExportMessage('Copied lobby code to clipboard');
      setTimeout(() => setExportMessage(''), 2000);
    } else {
      alert('Failed to copy lobby code to clipboard');
    }
  };

  // Paste whatever is on the clipboard into the lobby code input
  const pasteLobbyCodeFromClipboard = async () => {
    try {
      let text = '';
      if (navigator && navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      } else {
        // fallback: prompt the user to paste
        text = prompt('Paste lobby code here:') || '';
      }
      if (!text) {
        setExportMessage('Clipboard empty');
        setTimeout(() => setExportMessage(''), 2000);
        return;
      }
      const input = document.getElementById('join-code');
      if (input) {
        input.value = text.trim();
        setExportMessage('Pasted lobby code from clipboard');
        setTimeout(() => setExportMessage(''), 2000);
      } else {
        alert('Lobby code input not found');
      }
    } catch (e) {
      console.error('Failed to read clipboard', e);
      alert('Failed to read clipboard');
    }
  };

  const exportRemoved = async () => {
    // Export the current local player's team from `remoteSelections`.
    const localUser = (socket && lobbyUsers) ? lobbyUsers.find(u => u.id === socket.id) : null;
    const localName = localUser ? localUser.name : (localPlayerName || PokemonName || 'You');
    const team = getMergedSelectionsForUser(localUser || { id: socket && socket.id, name: localName });
    if (!team || team.length === 0) {
      setExportMessage('No selected Pokémon to export');
      setTimeout(() => setExportMessage(''), 2500);
      return;
    }
    const lines = team.map(p => toShowdownName(p.name || p));
    const text = lines.join('\n\n');
    const ok = await copyToClipboard(text);
    if (ok) {
      setExportMessage(`Copied ${lines.length} selected Pokémon to clipboard`);
      setTimeout(() => setExportMessage(''), 3000);
    } else {
      setExportMessage('Failed to copy to clipboard');
      setTimeout(() => setExportMessage(''), 3000);
    }
  };

  const exportPokemonData = async () => {
    if (!window.confirm('This will fetch data for all Pokemon from PokeAPI. This may take several minutes. Continue?')) {
      return;
    }
    
    setExportMessage('Fetching Pokemon data from PokeAPI... This may take a few minutes.');
    
    try {
      // First get the list of all Pokemon
      const listResponse = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=2000');
      const pokemonUrls = listResponse.data.results;
      
      const pokemonData = [];
      const seenSpecies = new Set();
      
      // Fetch data for each Pokemon
      for (let i = 0; i < pokemonUrls.length; i++) {
        try {
          const pokemonResponse = await axios.get(pokemonUrls[i].url);
          const pokemon = pokemonResponse.data;
          
          // Get species data for generation info
          const speciesResponse = await axios.get(pokemon.species.url);
          const species = speciesResponse.data;
          
          // Determine if this is a regional form
          const isRegionalForm = pokemon.name.includes('-alola') || 
                                  pokemon.name.includes('-galar') || 
                                  pokemon.name.includes('-hisui') || 
                                  pokemon.name.includes('-paldea');
          
          // Skip if species already exists and it's not a regional form
          const speciesName = species.name;
          if (seenSpecies.has(speciesName) && !isRegionalForm) {
            continue;
          }
          
          seenSpecies.add(speciesName);
          
          // Extract types
          const types = pokemon.types.map(t => t.type.name);
          
          // Extract all move names
          const moves = pokemon.moves.map(m => m.move.name);
          
          // Extract abilities
          const abilities = pokemon.abilities.map(a => a.ability.name);
          
          // Get generation number
          const generationNum = parseInt(species.generation.url.split('/').filter(Boolean).pop());
          
          // Build the data object
          const data = {
            id: pokemon.id,
            species_name: speciesName,
            form_name: pokemon.name,
            types: types,
            abilities: abilities,
            moves: moves,
            sprite_front_default: pokemon.sprites.front_default,
            generation: generationNum
          };
          
          pokemonData.push(data);
          
          // Update progress message every 50 Pokemon
          if ((i + 1) % 50 === 0) {
            setExportMessage(`Fetching Pokemon data... ${i + 1}/${pokemonUrls.length} processed`);
          }
        } catch (err) {
          console.error(`Failed to fetch data for ${pokemonUrls[i].name}:`, err);
        }
      }
      
      // Convert to JSON and download
      const jsonString = JSON.stringify(pokemonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pokemon_data_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportMessage(`Successfully exported ${pokemonData.length} Pokemon to JSON file!`);
      setTimeout(() => setExportMessage(''), 5000);
    } catch (err) {
      console.error('Failed to export Pokemon data:', err);
      setExportMessage('Failed to export Pokemon data. Check console for details.');
      setTimeout(() => setExportMessage(''), 5000);
    }
  };

  // Saved teams functionality removed - now using ongoing draft data
  
  const readSavedTeamsFromCookies = () => {
    // Now reads from ongoing drafts instead of separate team storage
    const currentUsername = PokemonName?.trim();
    if (!currentUsername) return [];
    
    const ongoingDrafts = readOngoingDraftsFromCookies();
    const userTeams = [];
    
    for (const draft of ongoingDrafts) {
      const code = draft.lobbyCode || draft.code;
      
      // Check if current user is in this draft's player data
      if (draft.playerData && draft.playerData[currentUsername]) {
        const playerData = draft.playerData[currentUsername];
        const team = playerData.selectedPokemon || [];
        
        if (team.length > 0) {
          userTeams.push({
            key: code,
            draftName: draft.draftName || `Draft ${code}`,
            lobbyCode: code,
            team: team,
            pointsRemaining: playerData.pointsRemaining,
            savedAt: draft.savedAt
          });
        }
      }
    }
    
    return userTeams;
  };
  
  const loadSavedTeam = (lobbyCode) => {
    try {
      const currentUsername = PokemonName?.trim();
      if (!currentUsername) {
        alert('Please set your username first');
        return;
      }
      
      const ongoingDrafts = readOngoingDraftsFromCookies();
      const draft = ongoingDrafts.find(d => (d.lobbyCode || d.code) === lobbyCode);
      
      if (!draft || !draft.playerData || !draft.playerData[currentUsername]) {
        alert('Team not found for your username in this draft.');
        setSavedTeams(readSavedTeamsFromCookies());
        return;
      }
      
      const team = draft.playerData[currentUsername].selectedPokemon || [];
      const entries = normalizeSavedTeamEntries(team);
      
      if (entries.length === 0) {
        alert('No Pokémon found in this team.');
        return;
      }
      
      const myId = socket ? socket.id : (`local-${Date.now()}`);
      setOptimisticSelections((prev) => ({ ...(prev || {}), [myId]: entries }));
      const ids = entries.map(p => p.id).filter(Boolean);
      if (ids.length > 0) {
        setPokemonList((prev) => prev.filter(p => !ids.includes(p.id)));
        setDraftPokemonList((prev) => prev.filter(p => !ids.includes(p.id)));
      }
      setExportMessage('Loaded team from ongoing draft');
      setTimeout(() => setExportMessage(''), 2500);
    } catch (err) {
      console.error('Failed to load team', err);
      setExportMessage('Failed to load team');
      setTimeout(() => setExportMessage(''), 2500);
    }
  };
  
  // deleteSavedTeamCookie removed - teams are part of ongoing drafts and shouldn't be deleted separately
  
  const exportSavedTeam = async (lobbyCode) => {
    try {
      if (!lobbyCode) return;
      const currentUsername = PokemonName?.trim();
      if (!currentUsername) {
        setExportMessage('Please set your username first');
        setTimeout(() => setExportMessage(''), 2500);
        return;
      }
      
      const ongoingDrafts = readOngoingDraftsFromCookies();
      const draft = ongoingDrafts.find(d => (d.lobbyCode || d.code) === lobbyCode);
      
      if (!draft || !draft.playerData || !draft.playerData[currentUsername]) {
        setExportMessage('Team not found');
        setTimeout(() => setExportMessage(''), 2500);
        return;
      }
      
      const team = draft.playerData[currentUsername].selectedPokemon || [];
      if (team.length === 0) {
        setExportMessage('No Pokémon to export');
        setTimeout(() => setExportMessage(''), 2500);
        return;
      }
      
      const entries = normalizeSavedTeamEntries(team);
      const lines = entries.map(p => toShowdownName(p.name || p));
      const text = lines.join('\n\n');
      const ok = await copyToClipboard(text);
      if (ok) {
        setExportMessage(`Copied ${lines.length} Pokémon to clipboard`);
        setCopiedTeamKey(lobbyCode);
        setTimeout(() => setCopiedTeamKey(null), 2500);
      } else {
        setExportMessage('Failed to copy team');
      }
      setTimeout(() => setExportMessage(''), 3000);
    } catch (err) {
      console.error('Failed to export team', err);
      setExportMessage('Failed to export team');
      setTimeout(() => setExportMessage(''), 2500);
    }
  };
  
  // clearSavedTeamsCookies removed - use clearOngoingDraftsCookie directly

  // ========== TEAM BUILDER FUNCTIONS ==========
  
  const fetchItemsList = async () => {
    try {
      // Load from local JSON file instead of PokeAPI
      const response = await fetch('/held_items.json');
      const items = await response.json();
      setItemsList(items.map(item => ({ name: item.name, description: item.description })));
    } catch (err) {
      console.error('Failed to fetch items list:', err);
      setItemsList([]);
    }
  };
  
  const fetchNaturesList = async () => {
    try {
      const response = await axios.get('https://pokeapi.co/api/v2/nature?limit=100');
      const natures = response.data.results || [];
      setNaturesList(natures.map(nature => nature.name));
    } catch (err) {
      console.error('Failed to fetch natures list:', err);
      setNaturesList([]);
    }
  };
  
  const createEmptyPokemonSlot = (slotNumber) => {
    return {
      slotNumber,
      pokemon: null, // { id, name, img, baseStats: {...} }
      heldItem: '',
      ability: '',
      nature: 'hardy',
      moves: ['', '', '', ''],
      ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      isCaptain: false
    };
  };
  
  const saveTeamBuilderData = (data) => {
    try {
      localStorage.setItem(TEAM_BUILDER_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save team builder data:', err);
    }
  };
  
  const loadTeamBuilderData = () => {
    try {
      const raw = localStorage.getItem(TEAM_BUILDER_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to load team builder data:', err);
      return null;
    }
  };
  
  const loadTeamIntoBuilder = async (lobbyCode) => {
    try {
      const currentUsername = PokemonName?.trim();
      if (!currentUsername) {
        alert('Please set your username first');
        return;
      }
      
      const ongoingDrafts = readOngoingDraftsFromCookies();
      const draft = ongoingDrafts.find(d => (d.lobbyCode || d.code) === lobbyCode);
      
      if (!draft || !draft.playerData || !draft.playerData[currentUsername]) {
        alert('Team not found in ongoing drafts');
        return;
      }
      
      const playerData = draft.playerData[currentUsername];
      const selectedPokemon = playerData.selectedPokemon || [];
      
      if (selectedPokemon.length === 0) {
        alert('No Pokemon in this team');
        return;
      }
      
      // Create team builder structure
      const teamData = {
        playerName: currentUsername,
        lobbyCode: lobbyCode,
        slots: []
      };
      
      // Create 12 slots
      for (let i = 0; i < 12; i++) {
        const slot = createEmptyPokemonSlot(i + 1);
        
        if (i < selectedPokemon.length) {
          const pkmn = selectedPokemon[i];
          // Fetch detailed Pokemon data including base stats and abilities from PokeAPI
          // But get moves from local JSON for faster loading
          try {
            // First, get moves from local JSON
            const jsonResponse = await fetch('/pokemon_data.json');
            const pokemonDataList = await jsonResponse.json();
            const pokemonFromJson = pokemonDataList.find(p => p.id === pkmn.id);
            
            // Fetch base stats and abilities from PokeAPI
            const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pkmn.id || pkmn.name.toLowerCase()}`);
            
            slot.pokemon = {
              id: response.data.id,
              name: response.data.name,
              img: pkmn.img || response.data.sprites.front_default,
              baseStats: {
                hp: response.data.stats.find(s => s.stat.name === 'hp')?.base_stat || 0,
                attack: response.data.stats.find(s => s.stat.name === 'attack')?.base_stat || 0,
                defense: response.data.stats.find(s => s.stat.name === 'defense')?.base_stat || 0,
                specialAttack: response.data.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0,
                specialDefense: response.data.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 0,
                speed: response.data.stats.find(s => s.stat.name === 'speed')?.base_stat || 0
              },
              abilities: response.data.abilities.map(a => a.ability.name),
              moves: pokemonFromJson?.moves || [] // Use moves from local JSON
            };
            
            // Set default ability (first one)
            if (slot.pokemon.abilities.length > 0) {
              slot.ability = slot.pokemon.abilities[0];
            }
          } catch (err) {
            console.error(`Failed to fetch detailed data for ${pkmn.name}:`, err);
            // Use basic data
            slot.pokemon = {
              id: pkmn.id,
              name: pkmn.name,
              img: pkmn.img,
              baseStats: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
              abilities: [],
              moves: []
            };
          }
        }
        
        teamData.slots.push(slot);
      }
      
      setTeamBuilderData(teamData);
      saveTeamBuilderData(teamData);
      setTeamBuilderLoaded(true);
      setView('teambuilder');
      
    } catch (err) {
      console.error('Failed to load team into builder:', err);
      alert('Failed to load team into builder');
    }
  };
  
  const calculateStatTotal = (base, iv, ev, level = 100, nature = 'hardy', statName = 'hp') => {
    // Pokemon stat calculation formula
    // HP: floor(((2 * Base + IV + floor(EV / 4)) * Level) / 100) + Level + 10
    // Other: floor((floor(((2 * Base + IV + floor(EV / 4)) * Level) / 100) + 5) * Nature)
    
    const evQuarter = Math.floor(ev / 4);
    
    if (statName === 'hp') {
      return Math.floor(((2 * base + iv + evQuarter) * level) / 100) + level + 10;
    } else {
      let baseStat = Math.floor(((2 * base + iv + evQuarter) * level) / 100) + 5;
      
      // Apply nature modifier
      const natureModifiers = getNatureModifiers(nature);
      const modifier = natureModifiers[statName] || 1.0;
      
      return Math.floor(baseStat * modifier);
    }
  };
  
  const getNatureModifiers = (nature) => {
    // Nature stat modifiers (1.1 for increased, 0.9 for decreased, 1.0 for neutral)
    const natures = {
      hardy: {},
      lonely: { attack: 1.1, defense: 0.9 },
      brave: { attack: 1.1, speed: 0.9 },
      adamant: { attack: 1.1, specialAttack: 0.9 },
      naughty: { attack: 1.1, specialDefense: 0.9 },
      bold: { defense: 1.1, attack: 0.9 },
      docile: {},
      relaxed: { defense: 1.1, speed: 0.9 },
      impish: { defense: 1.1, specialAttack: 0.9 },
      lax: { defense: 1.1, specialDefense: 0.9 },
      timid: { speed: 1.1, attack: 0.9 },
      hasty: { speed: 1.1, defense: 0.9 },
      serious: {},
      jolly: { speed: 1.1, specialAttack: 0.9 },
      naive: { speed: 1.1, specialDefense: 0.9 },
      modest: { specialAttack: 1.1, attack: 0.9 },
      mild: { specialAttack: 1.1, defense: 0.9 },
      quiet: { specialAttack: 1.1, speed: 0.9 },
      bashful: {},
      rash: { specialAttack: 1.1, specialDefense: 0.9 },
      calm: { specialDefense: 1.1, attack: 0.9 },
      gentle: { specialDefense: 1.1, defense: 0.9 },
      sassy: { specialDefense: 1.1, speed: 0.9 },
      careful: { specialDefense: 1.1, specialAttack: 0.9 },
      quirky: {}
    };
    
    return natures[nature] || {};
  };
  
  const updateTeamBuilderSlot = (slotIndex, field, value) => {
    if (!teamBuilderData) return;
    
    const newData = { ...teamBuilderData };
    const slot = { ...newData.slots[slotIndex] };
    
    if (field === 'heldItem' || field === 'ability' || field === 'nature' || field === 'isCaptain') {
      slot[field] = value;
    } else if (field.startsWith('move')) {
      const moveIndex = parseInt(field.replace('move', '')) - 1;
      slot.moves = [...slot.moves];
      slot.moves[moveIndex] = value;
    } else if (field.startsWith('iv')) {
      const stat = field.replace('iv', '');
      const statKey = stat.charAt(0).toLowerCase() + stat.slice(1);
      slot.ivs = { ...slot.ivs };
      slot.ivs[statKey] = Math.max(0, Math.min(MAX_IV, parseInt(value) || 0));
    } else if (field.startsWith('ev')) {
      const stat = field.replace('ev', '');
      const statKey = stat.charAt(0).toLowerCase() + stat.slice(1);
      
      // Calculate current total EVs excluding this stat
      const currentTotal = Object.keys(slot.evs).reduce((sum, key) => {
        if (key === statKey) return sum;
        return sum + (slot.evs[key] || 0);
      }, 0);
      
      // Calculate max allowable for this stat
      const maxAllowed = Math.min(MAX_SINGLE_EV, MAX_EVS - currentTotal);
      const newValue = Math.max(0, Math.min(maxAllowed, parseInt(value) || 0));
      
      slot.evs = { ...slot.evs };
      slot.evs[statKey] = newValue;
    }
    
    newData.slots[slotIndex] = slot;
    setTeamBuilderData(newData);
    saveTeamBuilderData(newData);
  };
  
  const getTotalEVs = (slot) => {
    if (!slot || !slot.evs) return 0;
    return Object.values(slot.evs).reduce((sum, val) => sum + (val || 0), 0);
  };
  
  const saveTeamToStorage = () => {
    if (!teamBuilderData) {
      alert('No team data to save');
      return;
    }
    
    try {
      const teamName = prompt('Enter a name for this team:', `${teamBuilderData.playerName}'s Team`);
      if (!teamName) return;
      
      const SAVED_TEAMS_KEY = 'pkmndraft_saved_teams';
      let savedTeams = [];
      try {
        const raw = localStorage.getItem(SAVED_TEAMS_KEY);
        if (raw) savedTeams = JSON.parse(raw) || [];
      } catch (e) { savedTeams = []; }
      
      const teamToSave = {
        id: Date.now(),
        name: teamName,
        playerName: teamBuilderData.playerName,
        data: teamBuilderData,
        savedAt: Date.now()
      };
      
      // Check if updating existing team with same name
      const existingIndex = savedTeams.findIndex(t => t.name === teamName);
      if (existingIndex >= 0) {
        savedTeams[existingIndex] = teamToSave;
      } else {
        savedTeams.push(teamToSave);
      }
      
      localStorage.setItem(SAVED_TEAMS_KEY, JSON.stringify(savedTeams));
      
      setExportMessage('Team saved!');
      setTimeout(() => setExportMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save team:', err);
      alert('Failed to save team');
    }
  };
  
  const loadSavedTeams = () => {
    try {
      const SAVED_TEAMS_KEY = 'pkmndraft_saved_teams';
      const raw = localStorage.getItem(SAVED_TEAMS_KEY);
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch (err) {
      console.error('Failed to load saved teams:', err);
      return [];
    }
  };
  
  const loadTeamFromStorage = (teamId) => {
    try {
      const savedTeams = loadSavedTeams();
      const team = savedTeams.find(t => t.id === teamId);
      
      if (!team || !team.data) {
        alert('Team not found');
        return;
      }
      
      setTeamBuilderData(team.data);
      saveTeamBuilderData(team.data);
      setTeamBuilderLoaded(true);
      setShowTeamSelector(false);
      
      setExportMessage('Team loaded successfully!');
      setTimeout(() => setExportMessage(''), 3000);
    } catch (err) {
      console.error('Failed to load team:', err);
      alert('Failed to load team');
    }
  };
  
  const deleteTeamFromStorage = (teamId) => {
    try {
      const SAVED_TEAMS_KEY = 'pkmndraft_saved_teams';
      let savedTeams = loadSavedTeams();
      savedTeams = savedTeams.filter(t => t.id !== teamId);
      localStorage.setItem(SAVED_TEAMS_KEY, JSON.stringify(savedTeams));
      
      setExportMessage('Team deleted!');
      setTimeout(() => setExportMessage(''), 3000);
    } catch (err) {
      console.error('Failed to delete team:', err);
      alert('Failed to delete team');
    }
  };

  // ========== END TEAM BUILDER FUNCTIONS ==========

  const addOngoingDraftToCookies = (code, otherPlayerNames = [], options = {}) => {
    // options: { settings, draftOrder, currentTurn, pointsRemaining, pointsMap }
    if (!code) return;
    
    const sanitizedCode = sanitizeLobbyCode(code);
    if (!sanitizedCode) {
      console.warn('Invalid lobby code for ongoing draft', code);
      return;
    }
    
    try {
      const key = 'pkmndraft_ongoing_drafts';
      let list = [];
      try {
        const raw = localStorage.getItem(key);
        if (raw) list = JSON.parse(raw) || [];
      } catch (e) { list = []; }
      
      // Build player data structure: username -> { selectedPokemon, pointsRemaining }
      const playerDataByUsername = {};
      
      if (lobbyUsers && lobbyUsers.length > 0) {
        for (const user of lobbyUsers) {
          const username = user.name;
          if (!username) continue;
          
          // Get selected Pokemon for this user
          const selectedPokemon = remoteSelections[user.id] || remoteSelections[username] || [];
          
          // Get points remaining
          const pointsRem = options.pointsRemaining && options.pointsRemaining[user.id] != null 
            ? sanitizePoints(options.pointsRemaining[user.id])
            : (options.settings?.pointsLimit || 100);
          
          playerDataByUsername[username] = {
            selectedPokemon: selectedPokemon.map(p => ({
              id: p.id,
              name: p.name,
              img: p.img
            })),
            pointsRemaining: pointsRem
          };
        }
      }
      
      // Sanitize settings if present
      const sanitizedSettings = options.settings ? {
        pointsLimit: sanitizePoints(options.settings.pointsLimit || 100),
        teamSizeLimit: sanitizeTeamSize(options.settings.teamSizeLimit || 10),
        genFilter: Number(options.settings.genFilter) || 0
      } : null;
      
      // Get draft name (use lobby code as fallback)
      const draftName = `Draft ${sanitizedCode}`;
      
      // Build player list (all usernames)
      const playerList = lobbyUsers ? lobbyUsers.map(u => u.name).filter(Boolean) : otherPlayerNames;
      
      // Build pick order (convert socket IDs to usernames)
      let pickOrder = [];
      if (options.draftOrder && Array.isArray(options.draftOrder) && lobbyUsers) {
        pickOrder = options.draftOrder.map(socketId => {
          const user = lobbyUsers.find(u => u.id === socketId);
          return user ? user.name : socketId;
        }).filter(Boolean);
      }
      
      // Get current pick (convert socket ID to username)
      let currentPick = null;
      if (options.currentTurn && lobbyUsers) {
        const currentUser = lobbyUsers.find(u => u.id === options.currentTurn);
        currentPick = currentUser ? currentUser.name : options.currentTurn;
      }
      
      // Create comprehensive draft entry
      const entry = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        draftName: draftName,
        lobbyCode: sanitizedCode,
        lobbySettings: sanitizedSettings,
        playerList: playerList,
        pickOrder: pickOrder,
        currentPick: currentPick,
        playerData: playerDataByUsername,
        pokemonPointValues: options.pointsMap || {},
        savedAt: Date.now()
      };
      
      // Avoid duplicate codes; replace if exists
      const filtered = list.filter(it => it.lobbyCode !== sanitizedCode && it.code !== sanitizedCode);
      filtered.push(entry);
      
      try { localStorage.setItem(key, JSON.stringify(filtered)); } catch (e) { console.error('localStorage set failed', e); }
    } catch (err) {
      console.error('Failed to add ongoing draft to storage', err);
    }
  };

  const openFooterPage = (page) => {
    setFooterPage(page);
    try {
      if (window && window.history && window.history.pushState) {
        window.history.pushState({ footerPage: page }, '', `#${page}`);
      }
    } catch (e) {
      // ignore
    }
  };

  const clearOngoingDraftsCookie = () => {
    // confirm destructive action
    if (!window.confirm('Delete all ongoing draft entries? This will remove locally-saved draft state and prevent restoring/rejoining from saved data. Are you sure?')) return;
    try {
      const key = 'pkmndraft_ongoing_drafts';
      try { localStorage.removeItem(key); } catch (e) { console.error('localStorage remove failed', e); }
      setOngoingDrafts([]);
      setViewedOngoingTeam(null);
      setExportMessage('Cleared ongoing drafts');
      setTimeout(() => setExportMessage(''), 2500);
    } catch (err) {
      console.error('Failed to clear ongoing drafts', err);
      setExportMessage('Failed to clear ongoing drafts');
      setTimeout(() => setExportMessage(''), 2500);
    }
  };

  const readOngoingDraftsFromCookies = () => {
    const key = 'pkmndraft_ongoing_drafts';
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      
      const validEntries = [];
      let hasInvalid = false;
      
      for (const entry of parsed) {
        // Support both old and new format
        const code = entry.lobbyCode || entry.code;
        
        // Validate basic structure
        if (!code || typeof code !== 'string') {
          console.warn('Invalid ongoing draft entry - missing code');
          hasInvalid = true;
          continue;
        }
        
        // Check expiry
        if (isExpired(entry.savedAt, MAX_ONGOING_DRAFT_AGE_DAYS)) {
          console.warn('Ongoing draft expired', code);
          hasInvalid = true;
          continue;
        }
        
        // Convert old format to new format if needed
        let sanitized;
        if (entry.lobbyCode && entry.playerData) {
          // New format - just sanitize
          sanitized = {
            schemaVersion: entry.schemaVersion || CURRENT_SCHEMA_VERSION,
            draftName: entry.draftName || `Draft ${code}`,
            lobbyCode: sanitizeLobbyCode(code) || code,
            lobbySettings: entry.lobbySettings ? {
              pointsLimit: sanitizePoints(entry.lobbySettings.pointsLimit || 100),
              teamSizeLimit: sanitizeTeamSize(entry.lobbySettings.teamSizeLimit || 10),
              genFilter: Number(entry.lobbySettings.genFilter) || 0
            } : null,
            playerList: Array.isArray(entry.playerList) ? entry.playerList : [],
            pickOrder: Array.isArray(entry.pickOrder) ? entry.pickOrder : [],
            currentPick: entry.currentPick || null,
            playerData: entry.playerData || {},
            pokemonPointValues: entry.pokemonPointValues || {},
            savedAt: entry.savedAt
          };
        } else {
          // Old format - convert to new
          sanitized = {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            draftName: `Draft ${code}`,
            lobbyCode: sanitizeLobbyCode(code) || code,
            lobbySettings: entry.settings ? {
              pointsLimit: sanitizePoints(entry.settings.pointsLimit || 100),
              teamSizeLimit: sanitizeTeamSize(entry.settings.teamSizeLimit || 10),
              genFilter: Number(entry.settings.genFilter) || 0
            } : null,
            playerList: Array.isArray(entry.players) ? entry.players : [],
            pickOrder: Array.isArray(entry.draftOrder) ? entry.draftOrder : [],
            currentPick: entry.currentTurn || null,
            playerData: {},
            pokemonPointValues: {},
            savedAt: entry.savedAt,
            // Keep old fields for backwards compatibility during rejoin
            _legacy: {
              pointsRemainingByName: entry.pointsRemainingByName || {}
            }
          };
        }
        
        validEntries.push(sanitized);
      }
      
      // If we removed invalid entries, update localStorage
      if (hasInvalid && validEntries.length > 0) {
        try {
          localStorage.setItem(key, JSON.stringify(validEntries));
        } catch (e) {
          console.error('Failed to clean up ongoing drafts', e);
        }
      } else if (hasInvalid && validEntries.length === 0) {
        try {
          localStorage.removeItem(key);
        } catch (e) {}
      }
      
      return validEntries;
    } catch (err) {
      console.warn('Failed to read ongoing drafts from storage', err);
      return [];
    }
  };

  const deleteOngoingDraft = (code) => {
    if (!code) return;
    if (!window.confirm(`Delete ongoing draft ${code}? This cannot be undone.`)) return;
    try {
      const key = 'pkmndraft_ongoing_drafts';
      let list = [];
      try {
        const raw = localStorage.getItem(key);
        if (raw) list = JSON.parse(raw) || [];
      } catch (e) { list = []; }
      const filtered = list.filter(it => it.lobbyCode !== code && it.code !== code);
      try {
        if (filtered.length === 0) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(filtered));
      } catch (e) { console.error('localStorage update failed', e); }
      setOngoingDrafts(filtered);
      // if currently viewing the team for this code, clear it
      if (viewedOngoingTeam && viewedOngoingTeam.lobbyCode === code) setViewedOngoingTeam(null);
      setExportMessage('Deleted ongoing draft');
      setTimeout(() => setExportMessage(''), 2500);
    } catch (err) {
      console.error('Failed to delete ongoing draft', err);
      setExportMessage('Failed to delete ongoing draft');
      setTimeout(() => setExportMessage(''), 2500);
    }
  };

  const readSavedTeamByCode = (code) => {
    const sanitizedCode = sanitizeLobbyCode(code);
    if (!sanitizedCode) return null;
    
    const key = `pkmndraft_team_${sanitizedCode}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      
      const parsed = JSON.parse(raw);
      
      // Validate schema
      if (!validateSavedTeam(parsed)) {
        console.warn('Invalid saved team schema, removing', sanitizedCode);
        try { localStorage.removeItem(key); } catch (e) {}
        return null;
      }
      
      // Check expiry
      if (isExpired(parsed.savedAt, MAX_SAVED_TEAM_AGE_DAYS)) {
        console.warn('Saved team expired, removing', sanitizedCode);
        try { localStorage.removeItem(key); } catch (e) {}
        return null;
      }
      
      // Sanitize nested values
      if (parsed.team) {
        parsed.team = parsed.team.map(p => ({
          id: p.id,
          name: String(p.name || '').toLowerCase(),
          img: p.img || null
        }));
      }
      
      return parsed;
    } catch (err) {
      console.error('Failed to read saved team from storage', code, err);
      // Remove corrupted entry
      try { localStorage.removeItem(key); } catch (e) {}
      return null;
    }
  };

  // Normalize various saved-team shapes into array of {id,name,img}
  const normalizeSavedTeamEntries = (teamData) => {
    if (!teamData) return [];
    // teamData may be an array of strings, array of objects, or an object with .team
    let arr = teamData;
    if (teamData.team && Array.isArray(teamData.team)) arr = teamData.team;
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => {
      if (!p) return null;
      if (typeof p === 'string') return { id: null, name: p, img: null };
      // p may already be {id,name,img} or other shapes
      return { id: p.id || p.name || null, name: p.name || p.id || String(p), img: p.img || null };
    }).filter(Boolean);
  };

  const handleRejoinComplete = (code, draftEntry = null) => {
    try {
      const currentUsername = PokemonName?.trim();
      if (!currentUsername) {
        setExportMessage('Please set your username first');
        setTimeout(() => setExportMessage(''), 2500);
        return;
      }
      
      // Get team from ongoing draft playerData
      if (!draftEntry || !draftEntry.playerData || !draftEntry.playerData[currentUsername]) {
        setExportMessage('No team found for your username in this draft');
        setTimeout(() => setExportMessage(''), 2500);
        return;
      }
      
      const playerData = draftEntry.playerData[currentUsername];
      const team = playerData.selectedPokemon || [];
      
      if (team.length === 0) {
        setExportMessage('No Pokémon found in saved team');
        setTimeout(() => setExportMessage(''), 2500);
        return;
      }
      
      // show the saved team in the viewed panel
      setViewedOngoingTeam({
        name: draftEntry.draftName || `Team Lobby#: ${code}`,
        lobbyCode: code,
        team: team
      });
      
      // Update BOTH optimistic and remote selections so the UI shows the team immediately
      const myId = socket ? socket.id : (`local-${Date.now()}`);
      const myName = localPlayerName || PokemonName;
      
      // Set remote selections (this is what the UI reads from)
      setRemoteSelections((prev) => {
        const updated = { ...(prev || {}) };
        updated[myId] = team;
        if (myName) updated[myName] = team;
        return updated;
      });
      
      // Also set optimistic selections as backup
      setOptimisticSelections((prev) => ({ ...(prev || {}), [myId]: team }));
      
      // hide those pokemon from visible lists
      const ids = team.map(p => p.id).filter(Boolean);
      if (ids.length > 0) {
        setPokemonList((prev) => prev.filter(p => !ids.includes(p.id)));
        setDraftPokemonList((prev) => prev.filter(p => !ids.includes(p.id)));
      }
      
      // restore pointsRemaining from playerData
      if (playerData.pointsRemaining != null && socket && socket.id) {
        setPointsRemaining((prev) => ({
          ...(prev || {}),
          [socket.id]: playerData.pointsRemaining
        }));
      }
      
      setExportMessage('Loaded your team for this lobby');
      setTimeout(() => setExportMessage(''), 2500);
    } catch (err) {
      console.error('Failed to load team on rejoin', err);
      setExportMessage('Failed to load team');
      setTimeout(() => setExportMessage(''), 2500);
    }
  };

  // Export current pointsMap to a downloadable text file (CSV: name,points)
  const exportPoints = () => {
    const map = pointsMap || {};
    const lines = Object.keys(map).map(k => `${k},${map[k]}`);
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pkmndraftsettings_${lobbyCode || 'export'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import points file (CSV or JSON). Only host can apply; we read file and emit to server.
  const handleImportPointsFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const txt = e.target.result;
      let parsed = null;
      try {
        parsed = JSON.parse(txt);
        if (typeof parsed !== 'object') parsed = null;
      } catch (err) {
        // try CSV parse: each line name,points
        const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const pm = {};
        for (const ln of lines) {
          const parts = ln.split(',').map(s => s.trim());
          if (parts.length >= 2) {
            const name = parts[0].toLowerCase();
            let val = Number(parts[1]);
            if (!Number.isFinite(val)) val = 1;
            // allow explicit 0 (banned); clamp other numeric values to 1..20
            if (val !== 0) val = Math.max(1, Math.min(20, val));
            pm[name] = val;
          }
        }
        parsed = pm;
      }
      if (parsed) {
        // emit to server as bulk import
        if (socket && lobbyCode) {
          console.log('Importing points to lobby:', lobbyCode);
          socket.emit('import_points', { code: lobbyCode, pointsMap: parsed }, (resp) => {
            console.log('Import points response:', resp);
            if (!resp || !resp.ok) {
              alert(resp && resp.error ? resp.error : 'Failed to import points');
            } else {
              setPointsMap(normalizePointsMap(resp.pointsMap || {}));
              alert('Settings imported successfully!');
            }
          });
        } else {
          // local: just set map
          alert('Not connected to a lobby. Create or join a lobby first.');
          setPointsMap(normalizePointsMap(parsed));
        }
      } else {
        alert('Failed to parse settings file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    // Load Pokemon data from local JSON file instead of PokeAPI
    fetch('/pokemon_data.json')
      .then(response => response.json())
      .then((data) => {
        // Transform the data to match our existing format
        const list = data.map(pokemon => ({
          id: pokemon.id,
          name: pokemon.form_name || pokemon.species_name,
          img: pokemon.sprite_front_default,
          types: pokemon.types,
          moves: pokemon.moves,
          generation: pokemon.generation
        })).sort((a, b) => a.id - b.id);
        
        setPokemonList(list);
      })
      .catch((err) => {
        console.error('Failed to load pokemon data from local file:', err);
        // Fallback to PokeAPI if local file fails
        console.log('Falling back to PokeAPI...');
        axios.get('https://pokeapi.co/api/v2/pokemon?limit=2000')
          .then((res) => {
            const rawList = res.data.results
              .map((p) => {
                const parts = p.url.split('/').filter(Boolean);
                const idStr = parts[parts.length - 1];
                const id = Number(idStr);
                return {
                  name: p.name,
                  id,
                  img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
                };
              })
              .filter((p) => !Number.isNaN(p.id));

            const excludeTokens = [
              'mega', 'gmax', 'g-max', 'primal', 'totem', 'therian', 'incarnate', 'eternal',
              'attack', 'defense', 'school', 'armored', 'masked', 'dusk', 'midnight', 'origin',
              'size', 'eternamax', 'shield', 'disguised', 'solo', 'aria', 'therian', 'resolute', 'zen', 'cap'
            ];
            const keepRegional = [
              'alola', 'alolan', 'galar', 'galarian', 'hisui', 'hisuian', 'paldea', 'paldean', 'kantonian', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos'
            ];
            const hyphenAllowTokens = [
              'galar', 'alola', 'hisui', 'female', 'hero', 'paldea', 'belly',
              'lele', 'koko', 'bulu', 'fini', 'average'
            ];
            const hyphenAllowNames = new Set([
              'jangmo-o','hakamo-o','kommo-o','wo-chien','chien-pao','ting-lu','chi-yu',
              'great-tusk','scream-tail','brute-bonnet','flutter-mane','slither-wing',
              'sandy-shocks','iron-trades','iron-bundle','iron-hands','iron-jugulis',
              'iron-moth','iron-thorns','oricorio-pom-pom','minior-red','mimikyu-busted',
              'toxtricity-amped','porygon-z','mime-jr','dudunsparce-two-segment',
              'tatsugiri-curly','calyrex-ice', 'nidoran-m', 'nidoran-f','urshifu-single-strike',
              'calyrex-shadow','type-null','lycanroc-midday', 'darmanitan-standard', 'doublade ', 'aegislash-shield'
            ]);
            const hyphenDisallowNames = new Set([
              'darmanitan-zen',
              'darmanitan-galar-zen'
            ]);

            const filtered = rawList.filter((p) => {
              const name = p.name.toLowerCase();
              if (name.includes('pikachu') && keepRegional.some((t) => name.includes(t))) return false;
              if (keepRegional.some((t) => name.includes(t))) return true;
              if (name.includes('-')) {
                if (hyphenDisallowNames.has(name)) return false;
                if (hyphenAllowTokens.some((t) => name.includes(t))) return true;
                if (hyphenAllowNames.has(name)) return true;
                return false;
              }
              if (excludeTokens.some((t) => name.includes(t))) return false;
              return true;
            });

            const byId = new Map();
            for (const item of filtered) {
              if (!byId.has(item.id)) byId.set(item.id, item);
            }
            const list = Array.from(byId.values()).sort((a, b) => a.id - b.id);
            setPokemonList(list);
          })
          .catch((err) => console.error('Failed to fetch pokemon list from PokeAPI:', err));
      });
    
    // Fetch items and natures for team builder
    fetchItemsList();
    fetchNaturesList();
  }, []);

  // handle back/forward navigation for footer pages
  useEffect(() => {
    const onPop = (ev) => {
      // read from location.hash
      const hash = (window.location.hash || '').replace('#', '');
      if (!hash) setFooterPage(null);
      else setFooterPage(hash);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // on mount, populate name input from cookie if available
  useEffect(() => {
    const saved = readUsernameFromCookie();
    if (saved) {
      setPokemonName(saved);
      // Inform user that a saved username was loaded
      setExportMessage(`Loaded saved username: ${saved}`);
      setTimeout(() => setExportMessage(''), 3500);
    }
  }, []);

  // on mount, perform one-time validation and cleanup of saved data
  useEffect(() => {
    try {
      // Validate and clean up saved teams
      const teams = readSavedTeamsFromCookies();
      let removedTeams = 0;
      
      // Validate and clean up ongoing drafts
      const drafts = readOngoingDraftsFromCookies();
      let removedDrafts = 0;
      
      // Count how many were removed by comparing before/after
      const teamCountBefore = (() => {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('pkmndraft_team_')) count++;
        }
        return count;
      })();
      
      const teamCountAfter = teams.length;
      removedTeams = teamCountBefore - teamCountAfter;
      
      const draftKey = 'pkmndraft_ongoing_drafts';
      const rawDrafts = localStorage.getItem(draftKey);
      const draftCountBefore = rawDrafts ? (JSON.parse(rawDrafts).length || 0) : 0;
      removedDrafts = draftCountBefore - drafts.length;
      
      // Notify user if data was cleaned up
      if (removedTeams > 0 || removedDrafts > 0) {
        const parts = [];
        if (removedTeams > 0) parts.push(`${removedTeams} saved team${removedTeams > 1 ? 's' : ''}`);
        if (removedDrafts > 0) parts.push(`${removedDrafts} ongoing draft${removedDrafts > 1 ? 's' : ''}`);
        console.info(`Cleaned up: ${parts.join(' and ')}`);
        // Optional: show message to user
        // alert(`Removed expired or corrupted data: ${parts.join(' and ')}`);
      }
    } catch (err) {
      console.error('Failed to validate saved data on mount', err);
    }
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [hideLegendaries, setHideLegendaries] = useState(false);
  const [legendaryMap, setLegendaryMap] = useState({});
  const [loadingLegendaries, setLoadingLegendaries] = useState(false);
  const [sortOption, setSortOption] = useState('id');
  // generation filter: 0 = all, 1..9 = show up to that generation
  const [genFilter, setGenFilter] = useState(0);
  const genLimits = {
    0: Infinity,
    1: 151,
    2: 251,
    3: 386,
    4: 493,
    5: 649,
    6: 721,
    7: 809,
    8: 905,
    9: 1010
  };

  const handleSetGenFilter = (g) => {
    setGenFilter(g);
    // if hiding legendaries, refresh the legendary map for visible pokemon
    if (hideLegendaries) {
      const visible = pokemonList.filter((p) => g === 0 || p.id <= genLimits[g]).map((p) => p.name.toLowerCase());
      fetchLegendaryStatuses(visible);
    }
  };

  const getCost = (p) => {
    if (!p) return 1;
    const name = (p.name || '').toLowerCase();
    if (pointsMap && pointsMap[name] != null) return Number(pointsMap[name]);
    if (pointsMap && pointsMap[p.name] != null) return Number(pointsMap[p.name]);
    return 1;
  };

  // Return the visible pokemon list for the draft area, filtered and sorted
  const getVisiblePokemonList = () => {
    const source = (draftPokemonList && draftPokemonList.length > 0) ? draftPokemonList : pokemonList;
    const gen = lobbyGenFilter || 0;
    const filtered = (source || []).filter((p) => {
      if (!p) return false;
      if (gen > 0 && p.id > genLimits[gen]) return false;
      const name = (p.name || '').toLowerCase();
      if (searchTerm && !name.includes(searchTerm)) return false;
      if (hideLegendaries && legendaryMap[name]) return false;
      if (pointsMap && Number(pointsMap[name]) === 0) return false;
      
      // Advanced filters
      // Type filter
      if (filterTypes.length > 0) {
        const hasMatchingType = p.types && p.types.some(type => filterTypes.includes(type));
        if (!hasMatchingType) return false;
      }
      
      // Generation filter (from advanced filters, distinct from lobbyGenFilter)
      if (filterGeneration > 0 && p.generation && p.generation !== filterGeneration) {
        return false;
      }
      
      // Points range filter
      const cost = getCost(p);
      if (filterPointsMin !== '' && cost < Number(filterPointsMin)) return false;
      if (filterPointsMax !== '' && cost > Number(filterPointsMax)) return false;
      
      // Ability filter
      if (filterAbility && p.abilities) {
        const hasAbility = p.abilities.some(ability => 
          ability.toLowerCase().includes(filterAbility.toLowerCase())
        );
        if (!hasAbility) return false;
      }
      
      // Move filter
      if (filterMove && p.moves) {
        const hasMove = p.moves.some(move => 
          move.toLowerCase().includes(filterMove.toLowerCase())
        );
        if (!hasMove) return false;
      }
      
      return true;
    });
    const sorted = filtered.slice();
    switch (sortOption) {
      case 'name':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'cost-asc':
        sorted.sort((a, b) => getCost(a) - getCost(b) || a.id - b.id);
        break;
      case 'cost-desc':
        sorted.sort((a, b) => getCost(b) - getCost(a) || a.id - b.id);
        break;
      case 'id':
      default:
        sorted.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    }
    return sorted;
  };

  const removePokemon = (id) => {
    // local guard: if in draft view ensure it's user's turn and they have enough points
    const listSource = (view === 'draft' && draftPokemonList && draftPokemonList.length > 0) ? draftPokemonList : pokemonList;
    if (view === 'draft' && (!draftPokemonList || draftPokemonList.length === 0)) {
      console.debug('removePokemon: draft snapshot empty, falling back to full pokemonList');
    }
    console.debug('removePokemon called', { id, view, currentTurn, socketId: socket && socket.id, lobbyCode });
    const toRemove = listSource.find((p) => Number(p.id) === Number(id));
    if (!toRemove) {
      // log some diagnostics: which source we used and the first few entries
      const sample = (listSource || []).slice(0, 20).map(p => ({ id: p && p.id, name: p && p.name, type: typeof (p && p.id) }));
      console.debug('removePokemon: toRemove not found', { id, idType: typeof id, listSourceLength: listSource.length, usingDraftList: view === 'draft' && draftPokemonList && draftPokemonList.length > 0, sample });
      return;
    }
    console.debug('removePokemon: found candidate', { id: toRemove.id, name: toRemove.name, idType: typeof toRemove.id });
    if (view === 'draft' && socket && lobbyCode) {
      // if we're waiting for other players during a rejoin, prevent picking
      if (waitingForPlayers) {
        console.debug('removePokemon: waiting for other players to join, cannot pick yet');
        return;
      }
      // enforce team size limit for local player
      try {
        const localUser = (socket && lobbyUsers) ? lobbyUsers.find(u => u.id === socket.id) : null;
        const merged = getMergedSelectionsForUser(localUser || { id: socket && socket.id, name: localPlayerName || PokemonName || 'You' });
        const teamLimit = (lobbySettings && lobbySettings.teamSizeLimit) ? Number(lobbySettings.teamSizeLimit) : 10;
        console.debug('removePokemon: team size check', { currentCount: merged.length, teamLimit });
        if (merged.length >= teamLimit) {
          console.debug('removePokemon: team already full, refusing pick');
          return;
        }
      } catch (err) {
        // ignore and continue with normal checks
      }
      // ensure current turn is this client
      if (currentTurn && socket.id !== currentTurn) {
        console.debug('removePokemon: not your turn', { socketId: socket.id, currentTurn });
        return;
      }
      const cost = (pointsMap[toRemove.name] == null) ? 1 : Number(pointsMap[toRemove.name]);
      const rem = pointsRemaining && pointsRemaining[socket.id] != null ? pointsRemaining[socket.id] : lobbySettings.pointsLimit;
      console.debug('removePokemon: cost/rem', { cost, rem, pointsMapEntry: pointsMap[toRemove.name] });
      if (rem < cost) {
        console.debug('removePokemon: insufficient points', { rem, cost });
        return;
      }
    }
    // Add an optimistic local pick for the current client so it shows
    // immediately in the sidebar, then emit the authoritative request.
    try {
      const localName = localPlayerName || PokemonName || 'You';
      const myId = socket ? socket.id : (`local-${Date.now()}`);
      // Optimistically add pick under our id
      console.debug('removePokemon: adding optimistic pick', { myId, pokemon: toRemove });
      setOptimisticSelections((prev) => {
        const copy = { ...(prev || {}) };
        copy[myId] = copy[myId] ? [...copy[myId], toRemove] : [toRemove];
        return copy;
      });
      // hide the pokemon locally from visible lists so it feels immediate
      setPokemonList((prev) => prev.filter(p => Number(p.id) !== Number(toRemove.id)));
      setDraftPokemonList((prev) => prev.filter(p => Number(p.id) !== Number(toRemove.id)));

      if (socket && lobbyCode) {
        console.debug('removePokemon: emitting select_pokemon', { code: lobbyCode, name: localName, pokemonId: toRemove.id });
        socket.emit('select_pokemon', { code: lobbyCode, name: localName, pokemon: toRemove });
      }
    } catch (e) {
      console.warn('socket emit failed', e);
    }
  };

  // --- Restore full Pokemon list ---
  const restoreFullPokemonList = () => {
    // Load from local JSON file instead of PokeAPI
    fetch('/pokemon_data.json')
      .then(response => response.json())
      .then((data) => {
        const list = data.map(pokemon => ({
          id: pokemon.id,
          name: pokemon.form_name || pokemon.species_name,
          img: pokemon.sprite_front_default,
          types: pokemon.types,
          moves: pokemon.moves,
          generation: pokemon.generation
        })).sort((a, b) => a.id - b.id);
        
        setPokemonList(list);
      })
      .catch((err) => {
        console.error('Failed to restore pokemon list from local file:', err);
        // Fallback to PokeAPI
        axios.get('https://pokeapi.co/api/v2/pokemon?limit=2000')
          .then((res) => {
            const rawList = res.data.results
              .map((p) => {
                const parts = p.url.split('/').filter(Boolean);
                const idStr = parts[parts.length - 1];
                const id = Number(idStr);
                return {
                  name: p.name,
                  id,
                  img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
                };
              })
              .filter((p) => !Number.isNaN(p.id));

            const excludeTokens = [
              'mega', 'gmax', 'g-max', 'primal', 'totem', 'therian', 'incarnate', 'eternal',
              'attack', 'defense', 'school', 'armored', 'masked', 'dusk', 'midnight', 'origin',
              'size', 'eternamax', 'shield', 'disguised', 'solo', 'aria', 'therian', 'resolute', 'zen', 'cap'
            ];
            const keepRegional = [
              'alola', 'alolan', 'galar', 'galarian', 'hisui', 'hisuian', 'paldea', 'paldean', 'kantonian', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos'
            ];
            const hyphenAllowTokens = [
              'galar', 'alola', 'hisui', 'female', 'hero', 'paldea', 'belly',
              'lele', 'koko', 'bulu', 'fini', 'average'
            ];
            const hyphenAllowNames = new Set([
              'jangmo-o','hakamo-o','kommo-o','wo-chien','chien-pao','ting-lu','chi-yu',
              'great-tusk','scream-tail','brute-bonnet','flutter-mane','slither-wing',
              'sandy-shocks','iron-trades','iron-bundle','iron-hands','iron-jugulis',
              'iron-moth','iron-thorns','oricorio-pom-pom','minior-red','mimikyu-busted',
              'toxtricity-amped','porygon-z','mime-jr','dudunsparce-two-segment',
              'tatsugiri-curly','calyrex-ice', 'nidoran-m', 'nidoran-f','urshifu-single-strike',
              'urshifu-rapid-strike', 'ho-oh', 'porygon2', 'type-null', 'sirfetchd', 'mr-rime', 'mr-mime', 'farfetchd', 'eiscue-ice', 'indeedee-male', 'morpeko-full-belly'
            ]);

            const filtered = rawList.filter((item) => {
              const name = item.name.toLowerCase();
              if (hyphenAllowNames.has(name)) return true;
              if (name.includes('-')) {
                if (keepRegional.some((t) => name.includes(t))) return true;
                if (hyphenAllowTokens.some((t) => name.includes(t))) return true;
                return false;
              }
              if (excludeTokens.some((t) => name.includes(t))) return false;
              return true;
            });

            const byId = new Map();
            for (const item of filtered) {
              if (!byId.has(item.id)) byId.set(item.id, item);
            }
            const list = Array.from(byId.values()).sort((a, b) => a.id - b.id);
            setPokemonList(list);
          })
          .catch((err) => console.error('Failed to restore pokemon list from PokeAPI:', err));
      });
  };

  // --- Lobby helpers (client-side scaffold) ---
  const generateLobbyCode = (length = 6) => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const createLobby = () => {
    // Restore full Pokemon list before creating lobby
    restoreFullPokemonList();
    // hide saved/ongoing panels when creating a lobby
    setSavedTeamsVisible(false);
    setOngoingDraftsVisible(false);
    const name = (PokemonName && PokemonName.trim()) ? PokemonName.trim() : `Player-${Math.floor(Math.random()*1000)}`;
    if (socket) {
      socket.emit('create_lobby', { name }, (resp) => {
        if (resp && resp.ok) {
          setLobbyCode(resp.code);
          setLobbyUsers(resp.users || [name]);
          setLocalPlayerName(name);
          if (resp.settings) setLobbySettings(resp.settings);
          if (resp.banList) setBanList(resp.banList);
          if (resp.pointsMap) setPointsMap(normalizePointsMap(resp.pointsMap));
          if (resp.pointsRemaining) setPointsRemaining(resp.pointsRemaining);
          if (resp.selections) {
            setRemoteSelections(resp.selections || {});
            const allSelectedIds = Object.values(resp.selections).flat().map(p => p.id).filter(Boolean);
            setPokemonList((prev) => prev.filter(p => !allSelectedIds.includes(p.id)));
          }
          if (resp.host) setHostId(resp.host);
          setView('lobby');
        }
      });
    } else {
      // fallback to client-only behavior
      const code = generateLobbyCode();
      setLobbyCode(code);
      setLobbyUsers([{ id: `local-${Date.now()}`, name }]);
      setLocalPlayerName(name);
      setView('lobby');
    }
  };

  const joinLobby = (code, savedPoints = null, savedSelections = null) => {
    // Restore full Pokemon list before joining lobby
    restoreFullPokemonList();
    // hide saved/ongoing panels when joining a lobby
    setSavedTeamsVisible(false);
    setOngoingDraftsVisible(false);
    if (!code || code.trim().length === 0) return;
    const name = (PokemonName && PokemonName.trim()) ? PokemonName.trim() : `Player-${Math.floor(Math.random()*1000)}`;
    if (socket) {
      socket.emit('join_lobby', { code: code.trim().toUpperCase(), name, savedPoints, savedSelections }, (resp) => {
        if (resp && resp.ok) {
          setLobbyCode(resp.code);
          setLobbyUsers(resp.users || []);
          setLocalPlayerName(name);
          if (resp.settings) setLobbySettings(resp.settings);
          if (resp.banList) setBanList(resp.banList);
          if (resp.pointsMap) setPointsMap(normalizePointsMap(resp.pointsMap));
          if (resp.pointsRemaining) setPointsRemaining(resp.pointsRemaining);
          if (resp.selections) {
            setRemoteSelections(resp.selections || {});
            const allSelectedIds = Object.values(resp.selections).flat().map(p => p.id).filter(Boolean);
            setPokemonList((prev) => prev.filter(p => !allSelectedIds.includes(p.id)));
          }
          if (resp.host) setHostId(resp.host);
          setView('lobby');
        } else {
          alert(resp && resp.error ? resp.error : 'Failed to join lobby');
        }
      });
    } else {
      setLobbyCode(code.trim().toUpperCase());
      setLobbyUsers((prev) => {
        if (prev.length >= 12) return prev;
        if (prev.some(p => p.name === name)) return prev;
        return [...prev, { id: `local-${Date.now()}`, name }];
      });
      setLocalPlayerName(name);
      setView('lobby');
    }
  };

  const leaveLobby = (skipAutoSave = false) => {
    // If leaving while in an active draft, save ongoing draft metadata
    if (!skipAutoSave && view === 'draft' && lobbyCode) {
      try {
        // other players' names (exclude local)
        const otherNames = (lobbyUsers || []).filter(u => u.id !== (socket && socket.id)).map(u => u.name);
        // record ongoing draft list entry including settings, draft order, currentTurn, pointsRemaining, and pointsMap
        addOngoingDraftToCookies(lobbyCode, otherNames, { 
          settings: lobbySettings, 
          draftOrder: lobbyDraftOrder, 
          currentTurn, 
          pointsRemaining,
          pointsMap 
        });
      } catch (err) {
        console.error('Error while saving ongoing draft on leave', err);
      }
    }
    if (socket && lobbyCode) socket.emit('leave_lobby', { code: lobbyCode }, () => {});
    setLobbyCode('');
    setLobbyUsers([]);
    // clear draft-specific state and return to main lobby view
    setDraftPokemonList([]);
    setOptimisticSelections({});
    setRemoteSelections({});
    setHideLegendaries(false);
    // Restore full Pokemon list when leaving lobby
    restoreFullPokemonList();
    setView('lobby');
  };

  const handleLeaveDraftButton = () => {
    // show a confirmation UI before performing the save+leave sequence
    setLeaveDraftConfirmVisible(true);
  };

  const cancelLeaveDraft = () => {
    setLeaveDraftConfirmVisible(false);
  };

  const confirmLeaveDraft = () => {
    setLeaveDraftConfirmVisible(false);
    if (!lobbyCode) {
      leaveLobby();
      return;
    }
    try {
      const otherNames = (lobbyUsers || []).filter(u => u.id !== (socket && socket.id)).map(u => u.name);
      addOngoingDraftToCookies(lobbyCode, otherNames, { 
        settings: lobbySettings, 
        draftOrder: lobbyDraftOrder, 
        currentTurn, 
        pointsRemaining,
        pointsMap 
      });
      // leave but skip the auto-save inside leaveLobby since we've already saved
      leaveLobby(true);
    } catch (err) {
      console.error('Failed while leaving draft', err);
      leaveLobby();
    }
  };

  // ========== TRADING FUNCTIONS ==========
  
  const handlePokemonClick = (pokemonName, ownerId) => {
    // Check if player has finished trading
    if (playersFinishedTrading.includes(ownerId)) {
      return; // Can't select from finished players
    }
    
    const myId = socket?.id;
    
    // Check if already selected
    const alreadySelected = selectedForTrade.find(s => s.pokemonName === pokemonName && s.ownerId === ownerId);
    if (alreadySelected) {
      // Deselect
      setSelectedForTrade(prev => prev.filter(s => !(s.pokemonName === pokemonName && s.ownerId === ownerId)));
      return;
    }
    
    // Can only select 1 from own team and 1 from another team
    const mySelection = selectedForTrade.find(s => s.ownerId === myId);
    const otherSelection = selectedForTrade.find(s => s.ownerId !== myId);
    
    if (ownerId === myId) {
      // Selecting from own team
      if (mySelection) {
        // Replace existing selection
        setSelectedForTrade(prev => prev.filter(s => s.ownerId !== myId).concat([{pokemonName, ownerId}]));
      } else {
        setSelectedForTrade(prev => [...prev, {pokemonName, ownerId}]);
      }
    } else {
      // Selecting from another team
      if (otherSelection) {
        // Replace existing selection
        setSelectedForTrade(prev => prev.filter(s => s.ownerId === myId || s.ownerId === ownerId).concat([{pokemonName, ownerId}]));
      } else {
        setSelectedForTrade(prev => [...prev, {pokemonName, ownerId}]);
      }
    }
  };
  
  const offerTrade = () => {
    if (selectedForTrade.length !== 2) return;
    
    const myId = socket?.id;
    const myPokemon = selectedForTrade.find(s => s.ownerId === myId);
    const theirPokemon = selectedForTrade.find(s => s.ownerId !== myId);
    
    if (!myPokemon || !theirPokemon) return;
    
    // Check trade limit
    const myTrades = tradesCompleted[myId] || 0;
    if (!lobbySettings.unlimitedTrades && myTrades >= lobbySettings.maxTradeLimit) {
      alert(`You have reached your trade limit (${lobbySettings.maxTradeLimit})`);
      return;
    }
    
    setPendingTradeOffer({
      from: myId,
      to: theirPokemon.ownerId,
      myPokemon: myPokemon.pokemonName,
      theirPokemon: theirPokemon.pokemonName
    });
  };
  
  const confirmOfferTrade = () => {
    if (!pendingTradeOffer || !socket) return;
    
    socket.emit('offer_trade', {
      code: lobbyCode,
      from: pendingTradeOffer.from,
      to: pendingTradeOffer.to,
      pokemon1: pendingTradeOffer.myPokemon,
      pokemon2: pendingTradeOffer.theirPokemon
    });
  };
  
  const cancelTrade = () => {
    setPendingTradeOffer(null);
    setSelectedForTrade([]);
  };
  
  const acceptTrade = () => {
    if (!incomingTradeOffer || !socket) return;
    
    // Check trade limit
    const myId = socket?.id;
    const myTrades = tradesCompleted[myId] || 0;
    if (!lobbySettings.unlimitedTrades && myTrades >= lobbySettings.maxTradeLimit) {
      alert(`You have reached your trade limit (${lobbySettings.maxTradeLimit})`);
      declineTrade();
      return;
    }
    
    socket.emit('accept_trade', {
      code: lobbyCode,
      tradeId: incomingTradeOffer.tradeId
    });
  };
  
  const declineTrade = () => {
    if (!incomingTradeOffer || !socket) return;
    
    socket.emit('decline_trade', {
      code: lobbyCode,
      tradeId: incomingTradeOffer.tradeId
    });
    
    setIncomingTradeOffer(null);
  };
  
  const finishTrading = () => {
    if (!socket) return;
    
    socket.emit('finish_trading', {
      code: lobbyCode,
      playerId: socket.id
    });
  };
  
  const tradeForUnpicked = (pokemonName, ownerId) => {
    setShowUnpickedModal({pokemonName, ownerId});
  };
  
  const confirmUnpickedTrade = (newPokemonName) => {
    if (!showUnpickedModal || !socket) return;
    
    socket.emit('trade_for_unpicked', {
      code: lobbyCode,
      playerId: showUnpickedModal.ownerId,
      oldPokemon: showUnpickedModal.pokemonName,
      newPokemon: newPokemonName
    });
  };
  
  // ========== END TRADING FUNCTIONS ==========

  const startDraft = () => {
    if (socket && lobbyCode) {
      socket.emit('start_draft', { code: lobbyCode }, (resp) => {
        if (resp && resp.ok) setView('draft');
      });
    } else {
      setView('draft');
    }
  };

  const fetchLegendaryStatuses = async (names) => {
    // Only fetch names we don't already have
    const toFetch = names.filter((n) => !(n in legendaryMap));
    // If there's nothing to fetch, return the cached mapping for requested names
    if (toFetch.length === 0) {
      const cached = {};
      for (const n of names) cached[n] = !!legendaryMap[n];
      return cached;
    }
    setLoadingLegendaries(true);

    // Helper: strip regional suffixes like '-galar', '-alola', '-hisui', etc.
    const regionalTokens = ['alola','alolan','galar','galarian','hisui','hisuian','paldea','paldean','kantonian','johto','hoenn','sinnoh','unova','kalos'];
    const getSpeciesName = (orig) => {
      const parts = orig.split('-');
      if (parts.length > 1) {
        const last = parts[parts.length - 1];
        if (regionalTokens.includes(last)) {
          return parts.slice(0, -1).join('-');
        }
      }
      return orig;
    };

    // Map originals to species names and build unique species list to fetch
    const origToSpecies = {};
    for (const o of toFetch) origToSpecies[o] = getSpeciesName(o);
    const speciesToOrig = {};
    for (const [orig, spec] of Object.entries(origToSpecies)) {
      speciesToOrig[spec] = speciesToOrig[spec] || [];
      speciesToOrig[spec].push(orig);
    }

    const speciesList = Object.keys(speciesToOrig);
    const concurrency = 50;
    const result = {};
    console.log(`Fetching legendary status for ${speciesList.length} unique species...`);
    for (let i = 0; i < speciesList.length; i += concurrency) {
      const chunk = speciesList.slice(i, i + concurrency);
      console.log(`Progress: ${Math.min(i + concurrency, speciesList.length)}/${speciesList.length}`);
      await Promise.all(chunk.map(async (species) => {
        try {
          const res = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${species}`);
          const isLegendary = !!(res.data.is_legendary || res.data.is_mythical);
          // assign the result to all original variant names that map to this species
          for (const orig of speciesToOrig[species]) result[orig] = isLegendary;
        } catch (err) {
          for (const orig of speciesToOrig[species]) result[orig] = false;
        }
      }));
      // update shared state incrementally for responsiveness
      setLegendaryMap((prev) => ({ ...prev, ...result }));
    }
    console.log('Legendary status fetch complete!');
    // Build final mapping for all requested names (use cached values when available)
    const finalMap = {};
    for (const n of names) {
      if (n in result) finalMap[n] = result[n];
      else finalMap[n] = !!legendaryMap[n];
    }
    setLoadingLegendaries(false);
    return finalMap;
  };

  // Ban all legendaries visible in the current pokemonList (host-only)
  const banAllLegendaries = async () => {
    if (!socket || !lobbyCode) return;
    // ensure we have legendary statuses for the visible pokemon
    const allNames = pokemonList.map(p => p.name.toLowerCase());
    const statusMap = await fetchLegendaryStatuses(allNames);
    const legends = Object.entries(statusMap || {}).filter(([n, v]) => v).map(([n]) => n);
    if (!legends || legends.length === 0) {
      alert('No legendaries found to ban');
      return;
    }
    const pm = {};
    for (const n of legends) pm[n] = 0;
    socket.emit('import_points', { code: lobbyCode, pointsMap: pm }, (resp) => {
      if (!resp || !resp.ok) {
        alert(resp && resp.error ? resp.error : 'Failed to ban legendaries');
      } else {
        setPointsMap(normalizePointsMap(resp.pointsMap || {}));
      }
    });
  };

  // Unban all currently banned Pokémon (host-only)
  const unbanAll = () => {
    if (!socket || !lobbyCode) return;
    // build a map of currently banned pokemon (points === 0) to set them to 1
    const pm = {};
    for (const [k, v] of Object.entries(pointsMap || {})) {
      if (Number(v) === 0) pm[k] = 1;
    }
    if (Object.keys(pm).length === 0) {
      alert('No banned Pokémon to unban');
      return;
    }
    socket.emit('import_points', { code: lobbyCode, pointsMap: pm }, (resp) => {
      if (!resp || !resp.ok) {
        alert(resp && resp.error ? resp.error : 'Failed to unban Pokémon');
      } else {
        setPointsMap(normalizePointsMap(resp.pointsMap || {}));
      }
    });
  };

  // restorePokemon removed: server is authoritative for restoring selections
  // and the client will reflect changes via server events.

  // Socket connection and handlers
  useEffect(() => {
    // Use environment variable or derive from window.location for production
    const socketUrl = process.env.REACT_APP_SOCKET_URL || (
      process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:4000'
    );
    const s = io(socketUrl);
    setSocket(s);
    s.on('connect', () => console.log('socket connected', s.id));
    s.on('lobby_update', (data) => {
      if (data && data.users) setLobbyUsers(data.users);
      if (data && data.code) setLobbyCode(data.code);
      if (data && data.host) setHostId(data.host);
      if (data && data.settings) setLobbySettings(data.settings);
      if (data && data.banList) setBanList(Array.isArray(data.banList) ? data.banList : []);
      if (data && data.pointsMap) setPointsMap(normalizePointsMap(data.pointsMap || {}));
      if (data && data.pointsRemaining) setPointsRemaining(data.pointsRemaining || {});
      if (data && data.selections) {
        setRemoteSelections(data.selections || {});
        // remove selected pokemons from our visible list
        const allSelectedIds = Object.values(data.selections).flat().map(p => p.id).filter(Boolean);
        setPokemonList((prev) => prev.filter(p => !allSelectedIds.includes(p.id)));
      }
      if (data && data.currentTurn) setCurrentTurn(data.currentTurn);
      // If we're in a rejoin flow, check whether all expected players have arrived
      try {
        if (rejoinPending && data && data.code && data.code === rejoinPending.code) {
          const names = (data.users || []).map(u => u.name);
          const missing = (rejoinPending.expectedPlayers || []).filter(n => !names.includes(n));
          if (missing.length > 0) {
            setWaitingForPlayers(true);
          } else {
            setWaitingForPlayers(false);
            // all present — load saved team for this lobby if available and restore points
            handleRejoinComplete(rejoinPending.code, rejoinPending.draftEntry || null);
            setRejoinPending(null);
          }
        }
      } catch (err) {
        console.error('Error handling rejoinPending check', err);
      }
      if (data && data.draftStarted) {
        setView('draft');
        if (data.pointsMap && typeof data.pointsMap === 'object') {
          setPokemonList((prev) => prev.filter(p => !(Number(data.pointsMap[p.name]) === 0)));
        }
      }
      if (data && data.draftOrder) setLobbyDraftOrder(data.draftOrder || []);
      if (data && data.settings && data.settings.genFilter != null) setLobbyGenFilter(Number(data.settings.genFilter) || 0);
    });
    s.on('banlist_update', (data) => {
      if (data && data.banList) setBanList(data.banList);
    });
    s.on('pointsMap_update', (data) => {
      if (data && data.pointsMap) {
        console.log('pointsMap_update received:', data.pointsMap);
        setPointsMap(normalizePointsMap(data.pointsMap || {}));
      }
    });
    s.on('points_update', (data) => {
      if (data && data.pointsRemaining) setPointsRemaining(data.pointsRemaining);
    });
    s.on('turn_update', (data) => {
      if (data && data.currentTurn) setCurrentTurn(data.currentTurn);
    });
    s.on('draft_started', (data) => {
      if (data && data.code) {
        setLobbyCode(data.code);
        if (data.pointsMap) setPointsMap(normalizePointsMap(data.pointsMap || {}));
        if (data.draftOrder) setLobbyDraftOrder(data.draftOrder || []);
        // compute allowed pokemon based on lobby gen filter and other visible filters
        const gen = lobbyGenFilter || 0;
        const allowed = pokemonList.filter((p) => {
          if (gen > 0 && p.id > genLimits[gen]) return false;
          const name = p.name.toLowerCase();
          if (hideLegendaries && legendaryMap[name]) return false;
          return true;
        });
        const pm = (data.pointsMap && typeof data.pointsMap === 'object') ? normalizePointsMap(data.pointsMap) : {};
        const allowedFiltered = allowed.filter(p => !(Number(pm[p.name]) === 0));
        // snapshot the table into draftPokemonList so draft uses the lobby table
        setDraftPokemonList(allowedFiltered);
        setView('draft');
      }
    });
    s.on('user_selected', (data) => {
      console.debug('socket event: user_selected', data);
      if (!data) return;
      setRemoteSelections((prev) => {
        const copy = { ...prev };
        // Server is authoritative; write selection into map using the key
        // the server provided. Prefer the selections map shape if present.
        if (data.name) {
          copy[data.name] = copy[data.name] || [];
          copy[data.name].push(data.pokemon);
        } else if (data.userId) {
          copy[data.userId] = copy[data.userId] || [];
          copy[data.userId].push(data.pokemon);
        } else if (data.id) {
          copy[data.id] = copy[data.id] || [];
          copy[data.id].push(data.pokemon);
        }
        return copy;
      });
      // remove optimistic pick for this client if present (reconcile)
      try {
        const myId = s.id;
        if (myId && data && data.pokemon && data.pokemon.id) {
          setOptimisticSelections((prev) => {
            if (!prev || !prev[myId]) return prev || {};
            const copy = { ...prev };
            copy[myId] = copy[myId].filter(p => p && p.id !== data.pokemon.id);
            if (copy[myId].length === 0) delete copy[myId];
            return copy;
          });
        }
      } catch (err) {
        // ignore
      }
      // remove the selected pokemon from the draft list for everyone
      if (data.pokemon && data.pokemon.id) {
        setDraftPokemonList((prev) => prev.filter(p => Number(p.id) !== Number(data.pokemon.id)));
      }
    });
    s.on('selections_update', (data) => {
      console.debug('socket event: selections_update', data);
      if (!data) return;
      setRemoteSelections(data.selections || {});
      const allSelectedIds = Object.values(data.selections || {}).flat().map(p => Number(p.id)).filter(Boolean);
      setDraftPokemonList((prev) => prev.filter(p => !allSelectedIds.includes(Number(p.id))));
      // Reconcile optimistic picks: remove any optimistic picks that the server now confirms
      try {
        const myId = s.id;
        if (myId && optimisticSelections && optimisticSelections[myId] && data.selections) {
          // collect server-confirmed ids for this client (by id or by name keys)
          const confirmedIds = new Set();
          const possibleKeys = [myId, socket && socket.id, localPlayerName];
          for (const k of possibleKeys) {
            if (!k) continue;
            const arr = data.selections[k] || data.selections[String(k)];
            if (Array.isArray(arr)) arr.forEach(p => { if (p && p.id) confirmedIds.add(p.id); });
          }
          // if none found, also attempt to find by scanning all selections for entries whose owner matches myId (best-effort)
          if (confirmedIds.size === 0) {
            for (const arr of Object.values(data.selections || {})) {
              if (!Array.isArray(arr)) continue;
              arr.forEach(p => { if (p && p.id) confirmedIds.add(p.id); });
            }
          }
          setOptimisticSelections((prev) => {
            if (!prev || !prev[myId]) return prev || {};
            const copy = { ...prev };
            copy[myId] = copy[myId].filter(p => !(p && confirmedIds.has(p.id)));
            if (copy[myId].length === 0) delete copy[myId];
            return copy;
          });
        }
      } catch (err) {
        // ignore
      }
    });
    s.on('select_rejected', (data) => {
      console.debug('socket event: select_rejected', data);
      if (!data || !data.pokemon) return;
      const pk = data.pokemon;
      // Selection was rejected by server. No optimistic state is kept
      // client-side, so simply notify the user (unless it's a benign
      // 'not_your_turn' rejection).
      if (data.reason && data.reason !== 'not_your_turn') {
        const msg = data.reason === 'already_selected' ? 'That Pokémon was already selected by someone else.' : data.reason === 'insufficient_points' ? 'You do not have enough points.' : 'Selection rejected';
        alert(msg);
      }
      // If we had an optimistic pick for this pokemon, remove it (revert)
      try {
        const myId = s.id;
        if (myId && pk && pk.id) {
          setOptimisticSelections((prev) => {
            if (!prev || !prev[myId]) return prev || {};
            const copy = { ...prev };
            copy[myId] = copy[myId].filter(p => p && p.id !== pk.id);
            if (copy[myId].length === 0) delete copy[myId];
            return copy;
          });
          // restore the pokemon to the visible lists so user can try again
          setPokemonList((prev) => (pk ? [...prev, pk] : prev));
          setDraftPokemonList((prev) => (pk ? [...prev, pk] : prev));
        }
      } catch (err) {
        // ignore
      }
    });
    s.on('start_rejected', (data) => {
      if (!data) return;
      if (data.reason === 'not_host') alert('Only the lobby host may start the draft.');
    });
    s.on('draft_complete', (data) => {
      console.log('Draft complete!', data);
      setDraftComplete(true);
      setFinalTeams(data);
      
      // Check if trading is enabled
      if (lobbySettings.allowTrading) {
        setTradingPhaseActive(true);
      }
      // Team is already saved in ongoing draft, no need to auto-save separately
    });
    
    // Trading socket handlers
    s.on('trade_offer_received', (data) => {
      setIncomingTradeOffer(data);
    });
    
    s.on('trade_accepted', (data) => {
      // Update final teams with the new selections
      if (data.updatedSelections) {
        setFinalTeams(prev => ({
          ...prev,
          selections: data.updatedSelections
        }));
      }
      setTradesCompleted(data.tradesCompleted || {});
      setPendingTradeOffer(null);
      setIncomingTradeOffer(null);
      setSelectedForTrade([]);
    });
    
    s.on('trade_declined', () => {
      setPendingTradeOffer(null);
      setSelectedForTrade([]);
      alert('Trade was declined');
    });
    
    s.on('trade_cancelled', () => {
      setIncomingTradeOffer(null);
    });
    
    s.on('player_finished_trading', (data) => {
      setPlayersFinishedTrading(data.playersFinished || []);
    });
    
    s.on('all_players_finished_trading', () => {
      setTradingPhaseActive(false);
    });
    
    s.on('unpicked_trade_completed', (data) => {
      // Update final teams with the new selection
      if (data.updatedSelections) {
        setFinalTeams(prev => ({
          ...prev,
          selections: data.updatedSelections
        }));
      }
      setShowUnpickedModal(null);
    });
    
    return () => {
      s.disconnect();
    };
  }, []);

  // Helper: get selections for a given lobby user by checking multiple
  // possible keys the server/client might use (display name or socket id).
  const getSelectionsForUser = (u) => {
    if (!remoteSelections) return [];
    const collected = [];
    if (u && u.name && remoteSelections[u.name]) collected.push(...remoteSelections[u.name]);
    if (u && u.id && remoteSelections[u.id]) collected.push(...remoteSelections[u.id]);
    if (u && u.id && remoteSelections[String(u.id)]) collected.push(...remoteSelections[String(u.id)]);
    // dedupe by id
    const seen = new Map();
    for (const it of collected) {
      if (!it) continue;
      const key = it.id != null ? it.id : JSON.stringify(it);
      if (!seen.has(key)) seen.set(key, it);
    }
    return Array.from(seen.values());
  };

  // Merge server-confirmed selections and local optimistic picks for display.
  const getMergedSelectionsForUser = (u) => {
    const server = getSelectionsForUser(u) || [];
    const myId = socket ? socket.id : null;
    const optim = (u && myId && u.id === myId && optimisticSelections && optimisticSelections[myId]) ? optimisticSelections[myId] : [];
    // merge and dedupe by id
    const seen = new Map();
    for (const it of [...server, ...optim]) {
      if (!it) continue;
      const key = it.id != null ? it.id : JSON.stringify(it);
      if (!seen.has(key)) seen.set(key, it);
    }
    return Array.from(seen.values());
  };
  

  
  // Precompute the local player's team for rendering convenience
  const _localUserForRender = (socket && lobbyUsers) ? lobbyUsers.find(u => u.id === socket.id) : null;
  const localTeamForRender = getMergedSelectionsForUser(_localUserForRender || { id: socket && socket.id, name: localPlayerName || PokemonName || 'You' });

  return (
    <div className="App">
      <div className= "TitleSection">
        <h1>Welcome to Pokemon Draft!</h1>
      </div>

      {view === 'lobby' && (
        <div className="LobbyContainer">
            {!lobbyCode && (
              <div className="LobbyControlsRow">
                <div className="control-group">
                  <input placeholder="Enter your name" id="name-input" className="JoinCodeInput" value={PokemonName} onChange={(e) => setPokemonName(e.target.value)} />
                  <button className="gen-button ml-8" onClick={() => { const val = (PokemonName || '').trim(); if (val) saveUsernameToCookie(val); else alert('Please enter a username before saving'); }}>Save Username</button>
                </div>
                
                <div className="control-group">
                  <button onClick={createLobby} className="export-button">Create Lobby</button>
                </div>
                
                <div className="control-group">
                  <input placeholder="Enter lobby code" id="join-code" className="JoinCodeInput" />
                  <button className="gen-button ml-8" onClick={pasteLobbyCodeFromClipboard}>Paste</button>
                  <button className="join-lobby-button ml-8" onClick={() => joinLobby(document.getElementById('join-code').value)}>Join Lobby</button>
                </div>
                
                <div className="control-group">
                  <button className="gen-button" onClick={() => {
                    // Initialize team builder with empty team
                    const emptyTeam = {
                      playerName: PokemonName || 'Player',
                      slots: Array(12).fill(null).map((_, idx) => createEmptySlot(idx))
                    };
                    setTeamBuilderData(emptyTeam);
                    setTeamBuilderLoaded(true);
                    setView('teambuilder');
                  }}>Team Builder</button>
                  <button className="gen-button ml-8" onClick={() => {
                    const drafts = readOngoingDraftsFromCookies();
                    setOngoingDrafts(drafts);
                    setView('ongoingdrafts');
                  }}>Ongoing Drafts</button>
                </div>
              </div>
            )}
          {lobbyCode ? (
            <div className="LobbyBox">
              <div className="LobbyHeaderRow">
                  <div>
                    <strong>Lobby Code:</strong>
                    <span className="LobbyCode">{lobbyCode}</span>
                    <button className="gen-button ml-8" onClick={copyLobbyCode}>Copy</button>
                    {exportMessage && (<span className="copy-confirm ml-8">{exportMessage}</span>)}
                  </div>
                  <div>
                    <button className="toggle-button btn-mr8" onClick={leaveLobby}>Leave</button>
                    {socket && hostId && socket.id === hostId && (
                      <button className="export-button" onClick={startDraft}>Start Draft</button>
                    )}
                  </div>
                </div>
                <div className="LobbyMeta">Max players: 12</div>

              <div className="LobbyMainRow">
                <div className="PlayersPanel">
                  <div className="PlayersTitle">Players ({lobbyUsers.length}):</div>
                  <ul className="PlayerList">
                    {lobbyUsers.map((u) => (
                      <li key={u.id} className="player-list-item">
                        <strong>{u.name}</strong>
                        <span className="player-points">Points: {pointsRemaining && pointsRemaining[u.id] != null ? pointsRemaining[u.id] : lobbySettings.pointsLimit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="SettingsPanel">
                      <div className="LobbySettingsTitle"><strong>Lobby Settings</strong></div>
                  {socket && hostId && socket.id === hostId ? (
                    // Host view with controls
                    <div>
                      <div className="row">
                        <div className="col-1">
                          <label className="label-small">Points Limit</label>
                          <input type="number" value={lobbySettings.pointsLimit} onChange={(e) => {
                              const newLimit = Number(e.target.value);
                              setLobbySettings((s) => ({...s, pointsLimit: newLimit}));
                              if (socket && lobbyCode && socket.id === hostId) {
                                socket.emit('update_settings', { code: lobbyCode, settings: { pointsLimit: newLimit, genFilter: lobbyGenFilter, teamSizeLimit: lobbySettings.teamSizeLimit } }, (resp) => {
                                  if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                });
                              }
                            }} className="input-full" />
                        </div>
                      </div>
                      <div className="row mt-8">
                        <div className="col-1">
                          <label className="label-small">Team Size Limit</label>
                          <input type="number" min={1} max={60} value={lobbySettings.teamSizeLimit} onChange={(e) => {
                              const newSize = Math.max(1, Math.min(60, Number(e.target.value) || 0));
                              setLobbySettings((s) => ({...s, teamSizeLimit: newSize}));
                              if (socket && lobbyCode && socket.id === hostId) {
                                socket.emit('update_settings', { code: lobbyCode, settings: { teamSizeLimit: newSize, pointsLimit: lobbySettings.pointsLimit, genFilter: lobbyGenFilter } }, (resp) => {
                                  if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                });
                              }
                            }} className="input-full" />
                        </div>
                      </div>
                      <div className="gen-filter-row">
                        <div className="col-1">
                          <label className="label-small">Generation Filter</label>
                          <select value={lobbyGenFilter} onChange={(e) => {
                              const newGen = Number(e.target.value);
                              setLobbyGenFilter(newGen);
                              if (socket && lobbyCode && socket.id === hostId) {
                                socket.emit('update_settings', { code: lobbyCode, settings: { pointsLimit: lobbySettings.pointsLimit, genFilter: newGen, teamSizeLimit: lobbySettings.teamSizeLimit, allowTrading: lobbySettings.allowTrading, maxTradeLimit: lobbySettings.maxTradeLimit, unlimitedTrades: lobbySettings.unlimitedTrades } }, (resp) => {
                                  if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                });
                              }
                            }} className="input-full">
                            <option value={0}>All</option>
                            {[1,2,3,4,5,6,7,8,9].map(g => <option key={g} value={g}>Gen {g}</option>)}
                          </select>
                        </div>
                        <div className="col-2">
                          <button className="gen-button ml-8 ban-legendaries-button" onClick={() => { if (socket && socket.id === hostId) banAllLegendaries(); }}>Ban Legendaries</button>
                          <button className="gen-button ml-8 unban-all-button" onClick={() => { if (socket && socket.id === hostId) unbanAll(); }}>Unban All</button>
                        </div>
                      </div>
                      
                      {/* Trading Settings */}
                      <div className="row mt-8">
                        <div className="col-1">
                          <label className="label-small">
                            <input 
                              type="checkbox" 
                              checked={lobbySettings.allowTrading} 
                              onChange={(e) => {
                                const newValue = e.target.checked;
                                setLobbySettings((s) => ({...s, allowTrading: newValue}));
                                if (socket && lobbyCode && socket.id === hostId) {
                                  socket.emit('update_settings', { code: lobbyCode, settings: { ...lobbySettings, allowTrading: newValue, genFilter: lobbyGenFilter } }, (resp) => {
                                    if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                  });
                                }
                              }}
                            />
                            {' '}Allow Trading After Draft
                          </label>
                        </div>
                      </div>
                      
                      {lobbySettings.allowTrading && (
                        <>
                          <div className="row mt-8">
                            <div className="col-1">
                              <label className="label-small">Max Trades Per Player</label>
                              <input 
                                type="number" 
                                min={0} 
                                value={lobbySettings.maxTradeLimit} 
                                onChange={(e) => {
                                  const newLimit = Math.max(0, Number(e.target.value) || 0);
                                  setLobbySettings((s) => ({...s, maxTradeLimit: newLimit}));
                                  if (socket && lobbyCode && socket.id === hostId) {
                                    socket.emit('update_settings', { code: lobbyCode, settings: { ...lobbySettings, maxTradeLimit: newLimit, genFilter: lobbyGenFilter } }, (resp) => {
                                      if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                    });
                                  }
                                }} 
                                className="input-full"
                                disabled={lobbySettings.unlimitedTrades}
                              />
                            </div>
                          </div>
                          <div className="row mt-8">
                            <div className="col-1">
                              <label className="label-small">
                                <input 
                                  type="checkbox" 
                                  checked={lobbySettings.unlimitedTrades} 
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setLobbySettings((s) => ({...s, unlimitedTrades: newValue}));
                                    if (socket && lobbyCode && socket.id === hostId) {
                                      socket.emit('update_settings', { code: lobbyCode, settings: { ...lobbySettings, unlimitedTrades: newValue, genFilter: lobbyGenFilter } }, (resp) => {
                                        if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                      });
                                    }
                                  }}
                                />
                                {' '}Allow Unlimited Trades
                              </label>
                            </div>
                          </div>
                        </>
                      )}

                      

                      <div className="mt-12">
                        <strong>Points assignment (host only)</strong>
                        <div className="points-controls">
                          <div className="points-search">
                              <input className="points-search-input" placeholder="pokemon-name" value={pointsSearchName} onChange={(e) => { setPointsSearchName(e.target.value.toLowerCase()); setSuggestionsVisible(true); }} />
                              {suggestionsVisible && pointsSearchName && (
                                <div className="points-suggestions suggestions-dropdown">
                                  {pokemonList.filter(p => {
                                    const gen = lobbyGenFilter || 0;
                                    if (gen > 0 && p.id > genLimits[gen]) return false;
                                    const name = p.name.toLowerCase();
                                    if (hideLegendaries && legendaryMap[name]) return false;
                                    return name.includes(pointsSearchName);
                                  }).slice(0, 10).map(p => (
                                    <div key={p.id} className="suggestion-item" onClick={() => { setPointsSearchName(p.name); setSuggestionsVisible(false); }}>{p.name}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          <select className="points-select" value={pointsValueSelected} onChange={(e) => setPointsValueSelected(Number(e.target.value))}>
                            <option key={0} value={0}>banned</option>
                            {Array.from({length:20}, (_,i) => i+1).map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <button className="set-button" onClick={() => {
                            if (!pointsSearchName) return alert('Enter a pokemon name');
                            console.debug('emitting set_points', { code: lobbyCode, name: pointsSearchName, value: pointsValueSelected });
                            socket.emit('set_points', { code: lobbyCode, name: pointsSearchName, value: pointsValueSelected }, (resp) => {
                              console.debug('set_points response:', resp);
                              if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to set points');
                              else {
                                setPointsMap(resp.pointsMap || {});
                                setPointsSearchName('');
                              }
                            });
                          }}>Set</button>
                          <button className="export-button" onClick={() => exportPoints()}>Export Settings</button>
                          <input id="points-import-input" type="file" accept=".txt,.json,text/plain" className="hidden-file-input" onChange={(e) => { if (e.target.files && e.target.files[0]) handleImportPointsFile(e.target.files[0]); e.target.value = ''; }} />
                          <button className="import-button" onClick={() => document.getElementById('points-import-input').click()}>Import Settings</button>
                        </div>

                        <div className="points-section">
                            <div className="points-title"><strong>Points table (1-20)</strong></div>
                            <div className="PointsGrid">
                              {[0, ...Array.from({length:20}, (_,i) => i+1)].map((val) => (
                                <div key={val} className="PointsTile">
                                  <div className="points-header">{val === 0 ? 'Banned' : `Points ${val}`}</div>
                                  <div className="points-list">
                                    {pokemonList.filter(p => {
                                        const pm = pointsMap[p.name];
                                        const pmNum = pm == null ? null : Number(pm);
                                        if (val === 0) return pmNum === 0;
                                        const effective = (pmNum == null) ? 1 : pmNum;
                                        return effective === val;
                                      }).filter(p => {
                                        // For the Banned column (val === 0) always show banned entries
                                        if (val === 0) return true;
                                        return (lobbyGenFilter === 0 || p.id <= genLimits[lobbyGenFilter]) && (!hideLegendaries || !legendaryMap[p.name]);
                                      }).map(p => (
                                      <div key={p.id} className="points-item-row">
                                        <img src={p.img} alt={p.name} className="points-sprite" />
                                        <span className="points-name">{p.name}</span>
                                        { (Number(pointsMap[p.name]) === 0) && (<span className="banned-badge">BANNED</span>) }
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                      </div>
                    </div>
                  ) : (
                    // Non-host read-only view: show settings summary, ban list and points table without controls
                    <div>
                      <div className="row">
                            <div className="col-1"><div className="fs-12">Points Limit: <strong>{lobbySettings.pointsLimit}</strong></div></div>
                          </div>
                      {/* Ban list box removed; bans are managed via the points table */}
                        <div className="mt-12">
                        <div className="points-title"><strong>Points table (Banned + 1-20)</strong></div>
                        <div className="PointsGrid">
                          {[0, ...Array.from({length:20}, (_,i) => i+1)].map((val) => (
                            <div key={val} className="PointsTile">
                              <div className="points-header">{val === 0 ? 'Banned' : `Points ${val}`}</div>
                              <div className="points-list">
                                {pokemonList.filter(p => {
                                    const pm = pointsMap[p.name];
                                    const pmNum = pm == null ? null : Number(pm);
                                    if (val === 0) return pmNum === 0;
                                    const effective = (pmNum == null) ? 1 : pmNum;
                                    return effective === val;
                                  }).filter(p => {
                                    if (val === 0) return true;
                                    return (lobbyGenFilter === 0 || p.id <= genLimits[lobbyGenFilter]) && (!hideLegendaries || !legendaryMap[p.name]);
                                  }).map(p => (
                                  <div key={p.id} className="points-item-row">
                                    <img src={p.img} alt={p.name} className="points-sprite" />
                                    <span>{p.name}</span>
                                    { (Number(pointsMap[p.name]) === 0) && (<span className="banned-badge">BANNED</span>) }
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Duplicate old points assignment/table removed — host controls above are used instead */}
            </div>
          ) : (
            <div className="muted-text">No lobby yet — create one or join with a code.</div>
          )}
        </div>
      )}

      {view === 'ongoingdrafts' && (
        <div className="LobbyContainer">
          <div className="OngoingDraftsPanel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Ongoing Drafts</h2>
              <button className="gen-button" onClick={() => setView('lobby')}>Back to Lobby</button>
            </div>
            {ongoingDrafts && ongoingDrafts.length > 0 ? (
              <>
            {ongoingDrafts.map((d) => {
              const code = d.lobbyCode || d.code;
              return (
              <div key={code} className="ongoing-draft-item">
                <div className="ongoing-draft-key"><strong>{d.draftName || code}</strong></div>
                <div className="ongoing-draft-players">
                  Players: {Array.isArray(d.playerList) && d.playerList.length > 0 
                    ? d.playerList.join(', ') 
                    : (Array.isArray(d.players) && d.players.length > 0 ? d.players.join(', ') : <em>—</em>)}
                </div>
                {(d.lobbySettings || d.settings) && (
                  <div className="ongoing-draft-settings">
                    Settings: PointsLimit {(d.lobbySettings?.pointsLimit || d.settings?.pointsLimit) || '—'}, 
                    TeamSize {(d.lobbySettings?.teamSizeLimit || d.settings?.teamSizeLimit) || '—'}
                  </div>
                )}
                {d.pickOrder && Array.isArray(d.pickOrder) && d.pickOrder.length > 0 && (
                  <div className="ongoing-draft-order">Pick Order: {d.pickOrder.join(' → ')}</div>
                )}
                {d.currentPick && (
                  <div className="ongoing-draft-current">Current Pick: <strong>{d.currentPick}</strong></div>
                )}
                {d.playerData && Object.keys(d.playerData).length > 0 && (
                  <div className="ongoing-draft-player-summary">
                    {Object.entries(d.playerData).map(([username, data]) => (
                      <div key={username} className="player-summary-item">
                        <span className="player-summary-name">{username}:</span>
                        <span className="player-summary-stats">
                          {data.selectedPokemon?.length || 0} Pokémon, {data.pointsRemaining} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                  <div className="ongoing-draft-actions">
                    <button className="gen-button" onClick={() => { 
                      const currentUsername = PokemonName?.trim();
                      const savedPoints = d.playerData && d.playerData[currentUsername]?.pointsRemaining != null 
                        ? d.playerData[currentUsername].pointsRemaining 
                        : (d._legacy?.pointsRemainingByName && d._legacy.pointsRemainingByName[currentUsername] != null 
                          ? d._legacy.pointsRemainingByName[currentUsername] 
                          : null);
                      const savedSelections = d.playerData && d.playerData[currentUsername]?.selectedPokemon 
                        ? d.playerData[currentUsername].selectedPokemon 
                        : null;
                      setRejoinPending({ code: code, expectedPlayers: d.playerList || d.players || [], draftEntry: d }); 
                      joinLobby(code, savedPoints, savedSelections); 
                    }}>Rejoin</button>
                    <button className="gen-button ml-8" onClick={() => {
                      const currentUsername = PokemonName?.trim();
                      if (d.playerData && d.playerData[currentUsername]) {
                        setViewedOngoingTeam({
                          name: d.draftName || `Team Lobby#: ${code}`,
                          lobbyCode: code,
                          team: d.playerData[currentUsername].selectedPokemon || []
                        });
                      } else {
                        alert('No team found for your username in this draft');
                      }
                    }}>View Team</button>
                    <button className="gen-button danger ml-8" onClick={() => {
                      deleteOngoingDraft(code);
                      // Refresh the list
                      const drafts = readOngoingDraftsFromCookies();
                      setOngoingDrafts(drafts);
                    }}>Delete</button>
                  </div>
              </div>
            )})}
            {viewedOngoingTeam && (
              <div className="viewed-ongoing-team">
                <h5>{viewedOngoingTeam.name || `Team Lobby#: ${viewedOngoingTeam.lobbyCode}`}</h5>
                <div className="saved-team-list">
                  {Array.isArray(viewedOngoingTeam.team) && viewedOngoingTeam.team.length > 0 ? (
                    <div className="saved-team-grid">
                      {normalizeSavedTeamEntries(viewedOngoingTeam.team).map((p) => (
                        <div key={p.id || p.name} className="saved-team-card">
                          {p.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                          <div className="pokemon-name">{p.name}</div>
                        </div>
                      ))}
                    </div>
                  ) : <em>No entries</em>}
                </div>
                <button className="gen-button mt-8" onClick={() => setViewedOngoingTeam(null)}>Close</button>
              </div>
            )}
            </>
            ) : (
              <div className="muted-text">No ongoing drafts found.</div>
            )}
          </div>
        </div>
      )}

      {view === 'draft' && (
        <div className="MainArea">
          {draftComplete && finalTeams ? (
            tradingPhaseActive ? (
              // Trading Phase UI
              <div className="trading-container">
                <h2 style={{ textAlign: 'center', color: '#ffd700', marginBottom: 20 }}>🔄 Trading Phase Has Started!</h2>
                <p style={{ textAlign: 'center', marginBottom: 20 }}>
                  Select 1 Pokémon from your team and 1 from another player's team to offer a trade.
                  {!lobbySettings.unlimitedTrades && ` (Max ${lobbySettings.maxTradeLimit} trades per player)`}
                </p>
                
                {/* Display all teams with selectable Pokemon */}
                <div className="trading-teams-grid">
                  {(finalTeams.users || []).map(user => {
                    const userSelections = finalTeams.selections[user.id] || [];
                    const isMyTeam = user.id === socket?.id;
                    const isFinished = playersFinishedTrading.includes(user.id);
                    const userTrades = tradesCompleted[user.id] || 0;
                    
                    return (
                      <div key={user.id} className="trading-team-card">
                        <div className="trading-team-header">
                          <h3>{user.name} {isMyTeam && '(You)'}</h3>
                          {isFinished && <span className="finished-badge">✓ Finished</span>}
                          {!lobbySettings.unlimitedTrades && (
                            <span className="trades-count">Trades: {userTrades}/{lobbySettings.maxTradeLimit}</span>
                          )}
                        </div>
                        <div className="trading-team-pokemon">
                          {userSelections.length > 0 ? (
                            <div className="trading-pokemon-grid">
                              {userSelections.map((p) => {
                                const isSelected = selectedForTrade.some(s => s.pokemonName === p.name && s.ownerId === user.id);
                                const canSelect = !isFinished && (isMyTeam || !playersFinishedTrading.includes(socket?.id));
                                
                                return (
                                  <div key={p.id || p.name} className="trading-pokemon-wrapper">
                                    <div 
                                      className={`trading-pokemon-card ${isSelected ? 'selected' : ''} ${canSelect ? 'selectable' : 'disabled'}`}
                                      onClick={() => canSelect && handlePokemonClick(p.name, user.id)}
                                    >
                                      {p.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                                      <div className="pokemon-name">{p.name}</div>
                                    </div>
                                    {isMyTeam && !isFinished && (
                                      <button 
                                        className="trade-unpicked-btn"
                                        onClick={() => tradeForUnpicked(p.name, user.id)}
                                      >
                                        Trade for Unpicked
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : <em>No selections</em>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Trade action buttons */}
                <div style={{ textAlign: 'center', marginTop: 30 }}>
                  {selectedForTrade.length === 2 && (
                    <button className="gen-button" onClick={offerTrade}>Offer Trade</button>
                  )}
                  {selectedForTrade.length > 0 && (
                    <button className="gen-button ml-8" onClick={() => setSelectedForTrade([])}>Clear Selection</button>
                  )}
                  {!playersFinishedTrading.includes(socket?.id) && (
                    <button className="export-button ml-8" onClick={finishTrading}>Finished Trading</button>
                  )}
                </div>
              </div>
            ) : (
              // Final Teams View (after trading complete)
              <div className="draft-complete-container">
                <h2 style={{ textAlign: 'center', color: '#16a34a', marginBottom: 20 }}>🎉 Draft Complete! Final Teams:</h2>
                <div className="final-teams-grid">
                  {(finalTeams.users || []).map(user => {
                    const userSelections = finalTeams.selections[user.id] || [];
                    const isMyTeam = user.id === socket?.id;
                    
                    return (
                      <div key={user.id} className="final-team-card">
                        <h3>{user.name} {isMyTeam && '(You)'}</h3>
                        <div className="final-team-pokemon">
                          {userSelections.length > 0 ? (
                            <div className="saved-team-grid">
                              {userSelections.map((p) => (
                                <div key={p.id || p.name} className="saved-team-card">
                                  {p.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                                  <div className="pokemon-name">{p.name}</div>
                                </div>
                              ))}
                            </div>
                          ) : <em>No selections</em>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ textAlign: 'center', marginTop: 30 }}>
                  <button className="export-button" onClick={() => {
                    // Save draft team to localStorage
                    const myTeam = finalTeams.selections[socket?.id] || [];
                    const teamName = prompt('Enter a name for this team:', `${PokemonName}'s Draft Team`);
                    if (!teamName) return;
                    
                    try {
                      const SAVED_TEAMS_KEY = 'pkmndraft_saved_teams';
                      let savedTeams = [];
                      try {
                        const raw = localStorage.getItem(SAVED_TEAMS_KEY);
                        if (raw) savedTeams = JSON.parse(raw) || [];
                      } catch (e) { savedTeams = []; }
                      
                      // Convert to team builder format
                      const teamBuilderSlots = Array(12).fill(null).map((_, idx) => {
                        if (idx < myTeam.length) {
                          const p = myTeam[idx];
                          return {
                            slotIndex: idx,
                            pokemon: p.name,
                            pokemonId: p.id,
                            pokemonName: p.name,
                            sprite: p.img,
                            isCaptain: idx === 0,
                            ability: '',
                            nature: 'hardy',
                            heldItem: '',
                            moves: ['', '', '', ''],
                            stats: {
                              hp: { base: 0, iv: 31, ev: 0 },
                              attack: { base: 0, iv: 31, ev: 0 },
                              defense: { base: 0, iv: 31, ev: 0 },
                              specialAttack: { base: 0, iv: 31, ev: 0 },
                              specialDefense: { base: 0, iv: 31, ev: 0 },
                              speed: { base: 0, iv: 31, ev: 0 }
                            },
                            ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
                            evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
                          };
                        }
                        return createEmptySlot(idx);
                      });
                      
                      const teamToSave = {
                        id: Date.now(),
                        name: teamName,
                        playerName: PokemonName,
                        data: {
                          playerName: PokemonName,
                          slots: teamBuilderSlots
                        },
                        savedAt: Date.now()
                      };
                      
                      // Check if updating existing team
                      const existingIndex = savedTeams.findIndex(t => t.name === teamName);
                      if (existingIndex >= 0) {
                        savedTeams[existingIndex] = teamToSave;
                      } else {
                        savedTeams.push(teamToSave);
                      }
                      
                      localStorage.setItem(SAVED_TEAMS_KEY, JSON.stringify(savedTeams));
                      alert('Team saved!');
                    } catch (err) {
                      console.error('Failed to save team:', err);
                      alert('Failed to save team');
                    }
                  }}>Save Team</button>
                  <button className="gen-button ml-8" onClick={() => {
                    // Load team into team builder
                    const myTeam = finalTeams.selections[socket?.id] || [];
                    // Convert to team builder format
                    const teamBuilderSlots = Array(12).fill(null).map((_, idx) => {
                      if (idx < myTeam.length) {
                        const p = myTeam[idx];
                        return {
                          slotIndex: idx,
                          pokemon: p.name,
                          pokemonId: p.id,
                          pokemonName: p.name,
                          sprite: p.img,
                          isCaptain: idx === 0,
                          ability: '',
                          nature: 'hardy',
                          heldItem: '',
                          moves: ['', '', '', ''],
                          stats: {
                            hp: { base: 0, iv: 31, ev: 0 },
                            attack: { base: 0, iv: 31, ev: 0 },
                            defense: { base: 0, iv: 31, ev: 0 },
                            specialAttack: { base: 0, iv: 31, ev: 0 },
                            specialDefense: { base: 0, iv: 31, ev: 0 },
                            speed: { base: 0, iv: 31, ev: 0 }
                          },
                          ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
                          evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
                        };
                      }
                      return createEmptySlot(idx);
                    });
                    
                    setTeamBuilderData({
                      playerName: PokemonName,
                      slots: teamBuilderSlots
                    });
                    setTeamBuilderLoaded(true);
                    setView('teambuilder');
                  }}>Show Team in Team Builder</button>
                  <button className="gen-button ml-8" onClick={() => { 
                    leaveLobby(true); 
                    setDraftComplete(false); 
                    setFinalTeams(null); 
                    setTradingPhaseActive(false);
                  }}>Return to Lobby</button>
                </div>
                {exportMessage && (<div className="export-msg" style={{ textAlign: 'center', marginTop: 10 }}>{exportMessage}</div>)}
              </div>
            )
          ) : (
            <>
          <div className="DisplaySection">
                    <div className="draft-header">
                    <h2>Available Pokémon ({draftPokemonList.length > 0 ? draftPokemonList.length : pokemonList.length}) — click to select</h2>
              <div className="lobby-label">Lobby: <strong>{lobbyCode || '—'}</strong></div>
            </div>
            {(draftPokemonList.length === 0 && pokemonList.length === 0) ? (
              <h3>No Pokémon available</h3>
            ) : (
              <div>
                {/* Advanced Filters Toggle */}
                <div style={{ marginBottom: '12px' }}>
                  <button 
                    className="gen-button" 
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
                  </button>
                  {(filterTypes.length > 0 || filterGeneration > 0 || filterPointsMin || filterPointsMax || filterAbility || filterMove) && (
                    <button 
                      className="gen-button ml-8" 
                      onClick={() => {
                        setFilterTypes([]);
                        setFilterGeneration(0);
                        setFilterPointsMin('');
                        setFilterPointsMax('');
                        setFilterAbility('');
                        setFilterMove('');
                      }}
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
                
                {/* Advanced Filters Panel */}
                {showAdvancedFilters && (
                  <div className="advanced-filters-panel">
                    {/* Type Filter */}
                    <div className="filter-section">
                      <label className="filter-label">Types:</label>
                      <div className="type-filters">
                        {['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'].map(type => (
                          <button
                            key={type}
                            className={`type-filter-btn ${filterTypes.includes(type) ? 'active' : ''}`}
                            onClick={() => {
                              if (filterTypes.includes(type)) {
                                setFilterTypes(filterTypes.filter(t => t !== type));
                              } else {
                                setFilterTypes([...filterTypes, type]);
                              }
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Generation Filter */}
                    <div className="filter-section">
                      <label className="filter-label">Generation:</label>
                      <select value={filterGeneration} onChange={(e) => setFilterGeneration(Number(e.target.value))} className="filter-select">
                        <option value={0}>All Generations</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(gen => (
                          <option key={gen} value={gen}>Gen {gen}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Points Range Filter */}
                    <div className="filter-section">
                      <label className="filter-label">Points Range:</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          placeholder="Min" 
                          value={filterPointsMin} 
                          onChange={(e) => setFilterPointsMin(e.target.value)}
                          className="filter-input"
                          style={{ width: '80px' }}
                        />
                        <span>to</span>
                        <input 
                          type="number" 
                          placeholder="Max" 
                          value={filterPointsMax} 
                          onChange={(e) => setFilterPointsMax(e.target.value)}
                          className="filter-input"
                          style={{ width: '80px' }}
                        />
                      </div>
                    </div>
                    
                    {/* Ability Filter */}
                    <div className="filter-section">
                      <label className="filter-label">Ability:</label>
                      <input 
                        type="text" 
                        placeholder="Search by ability" 
                        value={filterAbility} 
                        onChange={(e) => setFilterAbility(e.target.value)}
                        className="filter-input"
                      />
                    </div>
                    
                    {/* Move Filter */}
                    <div className="filter-section">
                      <label className="filter-label">Move:</label>
                      <input 
                        type="text" 
                        placeholder="Search by move" 
                        value={filterMove} 
                        onChange={(e) => setFilterMove(e.target.value)}
                        className="filter-input"
                      />
                    </div>
                  </div>
                )}
                
                <div className="search-box" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc' }}>
                      <option value="id">ID #</option>
                      <option value="name">Name (A–Z)</option>
                      <option value="cost-asc">Cost ↑</option>
                      <option value="cost-desc">Cost ↓</option>
                    </select>
                    <input placeholder="Search Pokémon" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value.toLowerCase()); setDraftSuggestionsVisible(true); }} onBlur={() => setTimeout(() => setDraftSuggestionsVisible(false), 150)} onFocus={() => { if (searchTerm) setDraftSuggestionsVisible(true); }} />
                  </div>
                  {loadingLegendaries && (<span className="ml-8">Loading...</span>)}
                  {draftSuggestionsVisible && searchTerm && (
                    <div className="suggestions-dropdown" style={{ position: 'absolute', top: '36px', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid #ccc', maxHeight: '200px', overflowY: 'auto' }}>
                      {(draftPokemonList.length > 0 ? draftPokemonList : pokemonList).filter(p => p.name.toLowerCase().includes(searchTerm)).slice(0,8).map(p => (
                        <div key={p.id} className="suggestion-item" style={{ padding: '6px 8px', cursor: 'pointer' }} onMouseDown={(ev) => { ev.preventDefault(); setSearchTerm(p.name.toLowerCase()); setDraftSuggestionsVisible(false); }}>{p.name}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pokemon-grid">
                      {getVisiblePokemonList().map((p) => {
                      const isDisabled = (view === 'draft' && ((currentTurn && socket && socket.id !== currentTurn) || (socket && socket.id === currentTurn && localTeamForRender.length >= (lobbySettings.teamSizeLimit || 10))));
                      const cost = pointsMap && pointsMap[p.name] !== undefined ? Number(pointsMap[p.name]) : 1;
                        return (
                          <div key={p.id} className={`pokemon-card ${isDisabled ? 'disabled' : ''}`} onClick={() => { console.debug('card click', { id: p.id, isDisabled, socketId: socket && socket.id, currentTurn, view }); if (isDisabled) return; removePokemon(p.id); }}>
                            <div className="pokemon-cost-badge">{cost}</div>
                            <img className="pokemon-img" src={p.img} alt={p.name} />
                            <div className="pokemon-name">{p.name}</div>
                          </div>
                        );
                      })}
                </div>
              </div>
            )}
          </div>
            <aside className="Sidebar">
              <h3>Selected Pokémon ({localTeamForRender.length} / {lobbySettings && lobbySettings.teamSizeLimit ? lobbySettings.teamSizeLimit : 10})</h3>
            <div className="mb-8">
              <button className="export-button" onClick={exportRemoved}>Export Team</button>
              <button className="gen-button ml-8" onClick={handleLeaveDraftButton}>Leave Draft</button>
              {exportMessage && (<div className="export-msg">{exportMessage}</div>)}
            </div>

            {leaveDraftConfirmVisible && (
              <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
                <div style={{background:'#fff',padding:20,borderRadius:8,maxWidth:520,width:'90%',boxShadow:'0 6px 30px rgba(0,0,0,0.3)'}}>
                  <h3>Leave Draft?</h3>
                  <p>The ongoing draft will be saved for you to rejoin later. Your current team will also be saved locally. Do you want to continue and leave the draft now?</p>
                  <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
                    <button className="gen-button" onClick={cancelLeaveDraft}>Cancel</button>
                    <button className="gen-button ml-8" onClick={confirmLeaveDraft}>Yes, Save & Leave</button>
                  </div>
                </div>
              </div>
            )}
              {lobbyUsers.length > 0 && (
                <div className="mb-10">
                  <strong>Players & Picks</strong>
                  <ul>
                    {(
                      (lobbyDraftOrder && lobbyDraftOrder.length > 0) ?
                        lobbyDraftOrder.map((id) => lobbyUsers.find(u => u.id === id) ).filter(Boolean)
                      : lobbyUsers
                    ).map((u) => (
                      <li key={u.id} className={currentTurn === u.id ? 'player-item current' : 'player-item'}>
                          <div className={currentTurn === u.id ? 'player-name current' : 'player-name'}>{u.name} {currentTurn === u.id && (<span className="player-current"> (Picking)</span>)}</div>
                          <div className="player-meta">
                            <div className="fs-12 muted">Team:</div>
                            <div>{(() => { const sel = (socket && u.id === socket.id) ? getMergedSelectionsForUser(u) : getSelectionsForUser(u); return (sel && sel.length > 0) ? sel.map(p => p.name || p).join(', ') : <em className="muted">—</em>; })()}</div>
                            <div className="fs-12 muted mt-4">Points: {pointsRemaining && pointsRemaining[u.id] != null ? pointsRemaining[u.id] : lobbySettings.pointsLimit}</div>
                          </div>
                        </li>
                    ))}
                  </ul>
                </div>
              )}
            <div className="mb-6">
              <strong>Your Team</strong>
              <div className="removed-list">
                {localTeamForRender.length === 0 ? (<div><em>None selected yet</em></div>) : localTeamForRender.map((p) => (
                  <div key={p.id || (p.name)} className="removed-item">
                    {p.img && <img src={p.img} alt={p.name} />}
                    <div className="removed-name">{p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          </>
          )}
        </div>
      )}

      {/* Trade Offer Modal (Initiator) */}
      {pendingTradeOffer && (
        <div className="modal-overlay">
          <div className="trade-modal">
            <h3>Offer Trade?</h3>
            <div className="trade-pokemon-display">
              <div className="trade-pokemon-side">
                <h4>Your Pokémon</h4>
                <div className="trade-pokemon-preview">
                  {(() => {
                    const p = pokemonList.find(pk => pk.name === pendingTradeOffer.myPokemon);
                    return (
                      <div className="trading-pokemon-card">
                        {p?.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                        <div className="pokemon-name">{pendingTradeOffer.myPokemon}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="trade-arrow">↔</div>
              <div className="trade-pokemon-side">
                <h4>Their Pokémon</h4>
                <div className="trade-pokemon-preview">
                  {(() => {
                    const p = pokemonList.find(pk => pk.name === pendingTradeOffer.theirPokemon);
                    return (
                      <div className="trading-pokemon-card">
                        {p?.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                        <div className="pokemon-name">{pendingTradeOffer.theirPokemon}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="modal-buttons">
              <button className="gen-button" onClick={cancelTrade}>Cancel</button>
              <button className="export-button ml-8" onClick={confirmOfferTrade}>Offer Trade</button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Trade Offer Modal */}
      {incomingTradeOffer && (
        <div className="modal-overlay">
          <div className="trade-modal">
            <h3>Trade Offer Received!</h3>
            <p>{incomingTradeOffer.fromName} wants to trade with you</p>
            <div className="trade-pokemon-display">
              <div className="trade-pokemon-side">
                <h4>They Offer</h4>
                <div className="trade-pokemon-preview">
                  {(() => {
                    const p = pokemonList.find(pk => pk.name === incomingTradeOffer.pokemon1);
                    return (
                      <div className="trading-pokemon-card">
                        {p?.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                        <div className="pokemon-name">{incomingTradeOffer.pokemon1}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="trade-arrow">↔</div>
              <div className="trade-pokemon-side">
                <h4>You Give</h4>
                <div className="trade-pokemon-preview">
                  {(() => {
                    const p = pokemonList.find(pk => pk.name === incomingTradeOffer.pokemon2);
                    return (
                      <div className="trading-pokemon-card">
                        {p?.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                        <div className="pokemon-name">{incomingTradeOffer.pokemon2}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="modal-buttons">
              <button className="gen-button" onClick={declineTrade}>Decline</button>
              <button className="export-button ml-8" onClick={acceptTrade}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {/* Trade for Unpicked Modal */}
      {showUnpickedModal && (
        <div className="modal-overlay">
          <div className="trade-modal unpicked-modal">
            <h3>Trade for Unpicked Pokémon</h3>
            <p>Select a Pokémon to replace <strong>{showUnpickedModal.pokemonName}</strong></p>
            <div className="unpicked-pokemon-list">
              {(() => {
                const allPicked = Object.values(finalTeams?.selections || {}).flat().map(p => p.name);
                const unpicked = pokemonList.filter(p => !allPicked.includes(p.name) && getCost(p) > 0);
                return unpicked.map(p => (
                  <div 
                    key={p.id} 
                    className="unpicked-pokemon-card"
                    onClick={() => confirmUnpickedTrade(p.name)}
                  >
                    {p.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                    <div className="pokemon-name">{p.name}</div>
                    <div className="pokemon-cost">{getCost(p)} pts</div>
                  </div>
                ));
              })()}
            </div>
            <div className="modal-buttons">
              <button className="gen-button" onClick={() => setShowUnpickedModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {view === 'teambuilder' && teamBuilderData && !showTeamSelector && (
        <div className="TeamBuilderContainer">
          <div className="team-builder-header">
            <div>
              <h2>Team Builder - {teamBuilderData.playerName}</h2>
            </div>
            <div className="team-builder-header-buttons">
              <button className="gen-button" onClick={saveTeamToStorage}>Save Team</button>
              <button className="gen-button ml-8" onClick={() => setShowTeamSelector(true)}>Load Team</button>
              <button className="gen-button ml-8" onClick={() => setView('lobby')}>Back to Lobby</button>
              {exportMessage && <span className="ml-8" style={{ color: '#16a34a', fontWeight: 600 }}>{exportMessage}</span>}
            </div>
          </div>

          <div className="team-builder-horizontal">
            {teamBuilderData.slots.map((slot, idx) => {
              if (!slot.pokemon) {
                return (
                  <div key={idx} className="team-builder-slot empty">
                    <div className="slot-number">Slot {slot.slotNumber}</div>
                    <div className="empty-slot-placeholder">Empty</div>
                  </div>
                );
              }

              const totalEVs = getTotalEVs(slot);
              const remainingEVs = MAX_EVS - totalEVs;

              return (
                <div key={idx} className="team-builder-slot">
                  <div className="slot-number">Slot {slot.slotNumber}</div>
                  <div className="pokemon-builder-card">
                    <img src={slot.pokemon.img} alt={slot.pokemon.name} className="pokemon-img" />
                    <div className="pokemon-name">{slot.pokemon.name}</div>

                    <div className="builder-section">
                      <label>Held Item:</label>
                      <select value={slot.heldItem} onChange={(e) => updateTeamBuilderSlot(idx, 'heldItem', e.target.value)}>
                        <option value="">None</option>
                        {itemsList.map(item => {
                          const itemName = typeof item === 'string' ? item : item.name;
                          const itemDesc = typeof item === 'object' && item.description ? ` - ${item.description}` : '';
                          return <option key={itemName} value={itemName} title={item.description || ''}>{itemName}</option>;
                        })}
                      </select>
                    </div>

                    <div className="builder-section">
                      <label>Ability:</label>
                      <select value={slot.ability} onChange={(e) => updateTeamBuilderSlot(idx, 'ability', e.target.value)}>
                        <option value="">Select ability</option>
                        {slot.pokemon.abilities && slot.pokemon.abilities.map(ability => 
                          <option key={ability} value={ability}>{ability}</option>
                        )}
                      </select>
                    </div>

                    <div className="builder-section">
                      <label>Nature:</label>
                      <select value={slot.nature} onChange={(e) => updateTeamBuilderSlot(idx, 'nature', e.target.value)}>
                        {naturesList.map(nature => <option key={nature} value={nature}>{nature}</option>)}
                      </select>
                    </div>

                    <div className="builder-section moves-section">
                      <label>Moves:</label>
                      {[1, 2, 3, 4].map(moveNum => (
                        <div key={moveNum} className="move-row">
                          <span className="move-label">Move {moveNum}:</span>
                          <select value={slot.moves[moveNum - 1] || ''} onChange={(e) => updateTeamBuilderSlot(idx, `move${moveNum}`, e.target.value)}>
                            <option value="">None</option>
                            {slot.pokemon.moves && slot.pokemon.moves.map(move => 
                              <option key={move} value={move}>{move}</option>
                            )}
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="builder-section stats-section">
                      <label>Stats (Base | IV | EV = Total):</label>
                      <div className="ev-tracker">EVs: {totalEVs} / {MAX_EVS} (Remaining: {remainingEVs})</div>
                      {['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'].map(statKey => {
                        const statDisplay = statKey === 'specialAttack' ? 'Sp. Atk' : 
                                          statKey === 'specialDefense' ? 'Sp. Def' : 
                                          statKey.charAt(0).toUpperCase() + statKey.slice(1);
                        const base = slot.pokemon.baseStats[statKey] || 0;
                        const iv = slot.ivs[statKey] || 0;
                        const ev = slot.evs[statKey] || 0;
                        const total = calculateStatTotal(base, iv, ev, 100, slot.nature, statKey);
                        
                        return (
                          <div key={statKey} className="stat-row">
                            <span className="stat-name">{statDisplay}:</span>
                            <span className="stat-base">{base}</span>
                            <input 
                              type="number" 
                              min="0" 
                              max={MAX_IV} 
                              value={iv} 
                              onChange={(e) => updateTeamBuilderSlot(idx, `iv${statKey.charAt(0).toUpperCase() + statKey.slice(1)}`, e.target.value)}
                              className="stat-input iv-input"
                            />
                            <input 
                              type="number" 
                              min="0" 
                              max={Math.min(MAX_SINGLE_EV, remainingEVs + ev)} 
                              value={ev} 
                              onChange={(e) => updateTeamBuilderSlot(idx, `ev${statKey.charAt(0).toUpperCase() + statKey.slice(1)}`, e.target.value)}
                              className="stat-input ev-input"
                            />
                            <span className="stat-total">= {total}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="builder-section">
                      <label>Is Captain:</label>
                      <select value={slot.isCaptain.toString()} onChange={(e) => updateTeamBuilderSlot(idx, 'isCaptain', e.target.value === 'true')}>
                        <option value="false">False</option>
                        <option value="true">True</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'teambuilder' && showTeamSelector && (
        <div className="TeamBuilderContainer">
          <div className="team-builder-header">
            <h2>Load Team</h2>
            <button className="gen-button" onClick={() => setShowTeamSelector(false)}>Back to Team Builder</button>
          </div>

          <div className="team-selector-content">
            <div className="team-selector-section">
              <h3>Saved Teams</h3>
              {(() => {
                const savedTeams = loadSavedTeams();
                if (savedTeams.length === 0) {
                  return <div className="muted-text">No saved teams found. Save a team from the team builder to see it here.</div>;
                }
                
                return (
                  <div className="team-selector-grid">
                    {savedTeams.map((team) => (
                      <div key={team.id} className="team-selector-card">
                        <div className="team-selector-card-header">
                          <strong>{team.name}</strong>
                          <div className="fs-12 muted">
                            {new Date(team.savedAt).toLocaleDateString()} {new Date(team.savedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="team-selector-card-body">
                          <div className="saved-team-grid">
                            {team.data.slots.filter(s => s.pokemonName).slice(0, 6).map((slot, idx) => (
                              <div key={idx} className="saved-team-card-small">
                                {slot.sprite && <img src={slot.sprite} alt={slot.pokemonName} />}
                              </div>
                            ))}
                          </div>
                          <div className="fs-12 muted mt-8">
                            {team.data.slots.filter(s => s.pokemonName).length} Pokémon
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button 
                            className="gen-button" 
                            style={{ flex: 1 }}
                            onClick={() => loadTeamFromStorage(team.id)}
                          >
                            Load
                          </button>
                          <button 
                            className="gen-button" 
                            style={{ flex: 1, backgroundColor: '#dc2626' }}
                            onClick={() => {
                              if (window.confirm(`Delete team "${team.name}"?`)) {
                                deleteTeamFromStorage(team.id);
                                // Force re-render by toggling the selector
                                setShowTeamSelector(false);
                                setTimeout(() => setShowTeamSelector(true), 10);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="team-selector-section">
              <h3>Load from Ongoing Drafts</h3>
              {(() => {
                const teams = readSavedTeamsFromCookies();
                if (teams.length === 0) {
                  return <div className="muted-text">No teams found in ongoing drafts</div>;
                }
                
                return (
                  <div className="team-selector-grid">
                    {teams.map((team) => (
                      <div key={team.key} className="team-selector-card">
                        <div className="team-selector-card-header">
                          <strong>{team.draftName || team.key}</strong>
                          <div className="fs-12 muted">Lobby: {team.lobbyCode}</div>
                        </div>
                        <div className="team-selector-card-body">
                          <div className="saved-team-grid">
                            {team.team.slice(0, 6).map((p) => (
                              <div key={p.id || p.name} className="saved-team-card-small">
                                {p.img && <img src={p.img} alt={p.name} />}
                              </div>
                            ))}
                          </div>
                          <div className="fs-12 muted mt-8">
                            {team.team.length} Pokémon | {team.pointsRemaining} pts remaining
                          </div>
                        </div>
                        <button 
                          className="gen-button mt-8" 
                          onClick={() => {
                            loadTeamIntoBuilder(team.key);
                            setShowTeamSelector(false);
                          }}
                        >
                          Load This Team
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <footer className="AppFooter">
        <div className="footer-inner">
          <div className="footer-col">
            <strong>Pokémon Draft</strong>
            <div className="fs-12 muted">A lightweight drafting tool</div>
            <div className="fs-12 muted" style={{marginTop:8}}>© {new Date().getFullYear()} Gary Lucas</div>
          </div>
          <div className="footer-col footer-links">
            <div><a href="#credits" onClick={(e)=>{e.preventDefault(); openFooterPage('credits');}}>Credits</a></div>
            <div><a href="#contact" onClick={(e)=>{e.preventDefault(); openFooterPage('contact');}}>Contact</a></div>
            <div><a href="#privacy" onClick={(e) => { e.preventDefault(); openFooterPage('privacy'); }}>Privacy Policy</a></div>
            <div><a href="#copyright" onClick={(e)=>{e.preventDefault(); openFooterPage('copyright');}}>Copyright</a></div>
          </div>
        </div>
      </footer>
      {footerPage && (
        <div className="footer-page-overlay" onClick={() => { setFooterPage(null); window.history.pushState({}, '', window.location.pathname); }}>
          <div className="footer-page" onClick={(e) => e.stopPropagation()}>
            {footerPage === 'credits' && <CreditsPage />}
            {footerPage === 'contact' && <ContactPage />}
            {footerPage === 'privacy' && <PrivacyPage />}
            {footerPage === 'copyright' && <CopyrightPage />}
            <div style={{textAlign:'right'}}>
              <button className="close-btn" onClick={() => { setFooterPage(null); window.history.pushState({}, '', window.location.pathname); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

