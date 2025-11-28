/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import './App.css';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import CreditsPage from './pages/Credits';
import ContactPage from './pages/Contact';
import PrivacyPage from './pages/Privacy';
import CopyrightPage from './pages/Copyright';
import LeagueManager from './components/LeagueManager';
import { AuthProvider, useAuth } from './components/AuthContext';
import AuthModal from './components/AuthModal';
import axios from 'axios';
import { io } from 'socket.io-client';


function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [PokemonName, setPokemonName] = useState("");
  
  // Set PokemonName from authenticated user
  useEffect(() => {
    if (user) {
      setPokemonName(user.username);
    }
  }, [user]);
  
  // Show auth modal on mount if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setShowAuthModal(true);
    }
  }, [loading, user]);
  
  // Socket URL configuration - used throughout the app
  const socketUrl = process.env.REACT_APP_SOCKET_URL || (
    process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:4000'
  );

  // Removed unused PokemonChosen and PokemonData state

  const [pokemonList, setPokemonList] = useState([]);

  // Removed unused fetchPokemonData function

  const [exportMessage, setExportMessage] = useState("");
  // saved username cookie key
  const usernameCookieKey = 'pkmndraft_username';

  // Removed unused saveUsernameToCookie function

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
  // Removed unused savedTeamsVisible, savedTeams, copiedTeamKey state
  const [footerPage, setFooterPage] = useState(null);
  // Removed unused ongoingDraftsVisible state
  const [ongoingDrafts, setOngoingDrafts] = useState([]);
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [viewedOngoingTeam, setViewedOngoingTeam] = useState(null);
  // Removed unused rejoinPending and waitingForPlayers state
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
  const [savedTeamsFromDB, setSavedTeamsFromDB] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState([]); // Array of slot indices
  // lobby state
  const [lobbyCode, setLobbyCode] = useState('');
  const lobbyCodeRef = useRef('');
  const [lobbyName, setLobbyName] = useState('');
  const [lobbyUsers, setLobbyUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [remoteSelections, setRemoteSelections] = useState({});
  // optimistic local picks (keyed by socket id)
  const [optimisticSelections, setOptimisticSelections] = useState({});
  const [hostId, setHostId] = useState(null);
  const hostIdRef = useRef(null);
  const [lobbySettings, setLobbySettings] = useState({ 
    pointsLimit: 100, 
    teamSizeLimit: 10,
    allowTrading: false,
    maxTradeLimit: 0,
    unlimitedTrades: false,
    timerEnabled: false,
    firstRoundTimer: 480, // 8 hours in minutes
    subsequentRoundTimer: 480, // 8 hours in minutes
    allowMega: false,
    allowGmax: false
  });
  const [lobbyLeagueCode, setLobbyLeagueCode] = useState(''); // League code to link draft to a league
  const lobbySettingsRef = useRef(lobbySettings);
  
  // Sync refs with state for use in event handler closures
  useEffect(() => {
    lobbyCodeRef.current = lobbyCode;
  }, [lobbyCode]);
  
  useEffect(() => {
    hostIdRef.current = hostId;
  }, [hostId]);
  
  useEffect(() => {
    lobbySettingsRef.current = lobbySettings;
  }, [lobbySettings]);

  // Fetch teams from database when team selector is opened
  useEffect(() => {
    if (showTeamSelector && view === 'teambuilder') {
      fetchTeamsFromDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTeamSelector, view]);
  
  // Load presets from JSON
  useEffect(() => {
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
  
  const [banList, setBanList] = useState([]);
  const [pointsMap, setPointsMap] = useState({});
  const [pointsRemaining, setPointsRemaining] = useState({});
  // list of pokemon to show during an active draft (snapshot from lobby table)
  const [draftPokemonList, setDraftPokemonList] = useState([]);
  const [pointsSearchName, setPointsSearchName] = useState('');
  const [pointsValueSelected, setPointsValueSelected] = useState(1);
  const [selectedPokemonForPoints, setSelectedPokemonForPoints] = useState([]); // Array of pokemon objects to apply points to
  const [currentTurn, setCurrentTurn] = useState(null);
  const [currentTurnStartTime, setCurrentTurnStartTime] = useState(null); // When current player's turn started
  const [timeRemaining, setTimeRemaining] = useState(null); // Time remaining in seconds for current turn
  const [lobbyDraftOrder, setLobbyDraftOrder] = useState([]);
  const [lobbyGenFilter, setLobbyGenFilter] = useState(0);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [localPlayerName, setLocalPlayerName] = useState('');
  const [draftSuggestionsVisible, setDraftSuggestionsVisible] = useState(false);
  const [searchTerms, setSearchTerms] = useState([]); // Array of search terms for multi-search
  
  // Advanced filter states
  const [filterTypes, setFilterTypes] = useState([]);
  const [filterTypesInclusive, setFilterTypesInclusive] = useState(false); // false = exclusive (AND), true = inclusive (OR)
  const [filterGeneration, setFilterGeneration] = useState(0);
  const [filterPointsMin, setFilterPointsMin] = useState('');
  const [filterPointsMax, setFilterPointsMax] = useState('');
  const [filterAbility, setFilterAbility] = useState('');
  const [filterMoves, setFilterMoves] = useState([]); // Applied filters (array)
  const [filterMoveInput, setFilterMoveInput] = useState(''); // Current input text
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [allAbilitiesList, setAllAbilitiesList] = useState([]); // All abilities from PokeAPI
  const [abilitySuggestions, setAbilitySuggestions] = useState([]);
  const [showAbilitySuggestions, setShowAbilitySuggestions] = useState(false);
  const [pokemonWithAbility, setPokemonWithAbility] = useState([]); // Pokemon species that have the selected ability
  const [moveSuggestions, setMoveSuggestions] = useState([]);
  const [showMoveSuggestions, setShowMoveSuggestions] = useState(false);
  
  // Trading state
  const [tradingPhaseActive, setTradingPhaseActive] = useState(false);
  const [selectedForTrade, setSelectedForTrade] = useState([]); // [{pokemonName, ownerId}]
  const [pendingTradeOffer, setPendingTradeOffer] = useState(null); // {from, to, pokemon1, pokemon2}
  const [incomingTradeOffer, setIncomingTradeOffer] = useState(null);
  const [playersFinishedTrading, setPlayersFinishedTrading] = useState([]);
  const [tradesCompleted, setTradesCompleted] = useState({}); // {userId: count}
  const [showUnpickedModal, setShowUnpickedModal] = useState(null); // {pokemonName, ownerId}
  const [unpickedSearchQuery, setUnpickedSearchQuery] = useState('');
  
  // Draft selection confirmation
  const [pendingDraftSelection, setPendingDraftSelection] = useState(null); // {id, pokemon}
  
  // Presets
  const [presetsList, setPresetsList] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // Team builder constants
  const TEAM_BUILDER_STORAGE_KEY = 'pkmndraft_teambuilder';
  
  // Team composition checklist data
  const checklistData = {
    entryHazard: {
      moves: ['spikes', 'ceaseless-edge', 'stealth-rock', 'stone-axe', 'toxic-spikes', 'toxic-debris', 'sticky-web']
    },
    spinner: {
      moves: ['rapid-spin', 'defog', 'mortal-spin', 'tidy-up', 'court-change'],
      abilities: ['screen-cleaner']
    },
    recovery: {
      moves: ['roost', 'slack-off', 'recover', 'moonlight', 'morning-sun', 'synthesis', 'wish', 'soft-boiled'],
      abilities: ['volt-absorb', 'water-absorb', 'poison-heal']
    },
    cleric: {
      moves: ['heal-bell', 'aromatherapy', 'wish'],
      abilities: ['healer']
    },
    statusMove: {
      moves: ['acid-armor', 'acupressure', 'after-you', 'agility', 'ally-switch', 'amnesia', 'aqua-ring', 'aromatic-mist', 'attract', 'aurora-veil', 'baby-doll-eyes', 'baneful-bunker', 'baton-pass', 'belly-drum', 'block', 'bulk-up', 'burning-bulwark', 'calm-mind', 'celebrate', 'charge', 'charm', 'chilly-reception', 'clangorous-soul', 'coaching', 'coil', 'confide', 'confuse-ray', 'conversion', 'conversion-2', 'copycat', 'cosmic-power', 'cotton-guard', 'cotton-spore', 'court-change', 'curse', 'dark-void', 'decorate', 'defend-order', 'defense-curl', 'defog', 'destiny-bond', 'detect', 'disable', 'doodle', 'double-team', 'dragon-cheer', 'dragon-dance', 'eerie-impulse', 'electric-terrain', 'encore', 'endure', 'entrainment', 'fairy-lock', 'fake-tears', 'feather-dance', 'fillet-away', 'flatter', 'floral-healing', 'focus-energy', 'follow-me', "forest's-curse", 'gastro-acid', 'glare', 'grassy-terrain', 'gravity', 'growl', 'growth', 'guard-split', 'guard-swap', 'happy-hour', 'harden', 'haze', 'heal-bell', 'heal-pulse', 'healing-wish', 'heart-swap', 'helping-hand', 'hone-claws', 'howl', 'hypnosis', 'imprison', 'ingrain', 'instruct', 'iron-defense', 'jungle-healing', 'leech-seed', 'leer', 'life-dew', 'light-screen', 'lock-on', 'lunar-blessing', 'lunar-dance', 'magic-powder', 'magic-room', 'magnet-rise', 'magnetic-flux', 'mean-look', 'memento', 'metal-sound', 'metronome', 'milk-drink', 'mimic', 'minimize', 'mist', 'misty-terrain', 'moonlight', 'morning-sun', 'nasty-plot', 'no-retreat', 'noble-roar', 'pain-split', 'parting-shot', 'perish-song', 'play-nice', 'poison-gas', 'poison-powder', 'power-split', 'power-swap', 'power-trick', 'protect', 'psych-up', 'psychic-terrain', 'quash', 'quick-guard', 'quiver-dance', 'rage-powder', 'rain-dance', 'recover', 'recycle', 'reflect', 'reflect-type', 'rest', 'revival-blessing', 'roar', 'rock-polish', 'role-play', 'roost', 'safeguard', 'sand-attack', 'sandstorm', 'scary-face', 'screech', 'shed-tail', 'shell-smash', 'shelter', 'shift-gear', 'shore-up', 'silk-trap', 'simple-beam', 'sing', 'sketch', 'skill-swap', 'slack-off', 'sleep-powder', 'sleep-talk', 'smokescreen', 'snowscape', 'soak', 'soft-boiled', 'speed-swap', 'spicy-extract', 'spikes', 'spiky-shield', 'spite', 'splash', 'spore', 'stealth-rock', 'sticky-web', 'stockpile', 'strength-sap', 'string-shot', 'stuff-cheeks', 'stun-spore', 'substitute', 'sunny-day', 'supersonic', 'swagger', 'swallow', 'sweet-kiss', 'sweet-scent', 'switcheroo', 'swords-dance', 'synthesis', 'tail-glow', 'tail-whip', 'tailwind', 'take-heart', 'tar-shot', 'taunt', 'tearful-look', 'teatime', 'teeter-dance', 'teleport', 'thunder-wave', 'tickle', 'tidy-up', 'topsy-turvy', 'torment', 'toxic', 'toxic-spikes', 'toxic-thread', 'transform', 'trick', 'trick-room', 'victory-dance', 'whirlwind', 'wide-guard', 'will-o-wisp', 'wish', 'withdraw', 'wonder-room', 'work-up', 'worry-seed', 'yawn']
    },
    phazer: {
      moves: ['roar', 'whirlwind', 'dragon-tail', 'circle-throw', 'haze', 'perish-song', 'topsy-turvy', 'clear-smog', 'heart-swap', 'spectral-thief', 'psych-up']
    },
    boosting: {
      moves: ['ominous-wind', 'ancient-power', 'silver-wind', 'power-up-punch', 'acid-spray', 'leaf-tornado', 'psychic', 'earth-power', 'muddy-water', 'bubble-beam', 'skull-bash', 'crabhammer', 'night-slash', 'icy-wind', 'sand-tomb', 'close-combat', 'overheat', 'octazooka', 'mirror-shot', 'superpower', 'draco-meteor', 'psycho-boost', 'fell-stinger', 'nasty-plot', 'swords-dance', 'calm-mind', 'bulk-up', 'geomancy', 'quiver-dance', 'tail-glow', 'dragon-dance', 'shell-smash', 'cotton-guard', 'autotomize', 'shift-gear', 'work-up', 'cosmic-power', 'defend-order', 'hone-claws', 'coil', 'stockpile', 'growth', 'belly-drum', 'rock-polish', 'amnesia', 'agility', 'iron-defense'],
      abilities: ['huge-power', 'blaze', 'chlorophyll', 'flash-fire', 'flower-gift', 'fur-coat', 'gorilla-tactics', 'grass-pelt', 'guts', 'hustle', 'ice-scales', 'marvel-scale', 'minus', 'orichalcum-pulse', 'overgrow', 'plus', 'protosynthesis', 'pure-power', 'quark-drive', 'quick-feet', 'sand-rush', 'slush-rush', 'solar-power', 'surge-surfer', 'swarm', 'swift-swim', 'torrent', 'unburden', 'defiant', 'adaptability', 'aerilate', 'analytic', 'battery', 'battle-bond', "dragon's-maw", 'galvanize', 'iron-fist', 'mega-launcher', 'normalize', 'pixilate', 'power-spot', 'punk-rock', 'reckless', 'refrigerate', 'rivalry', 'rocky-payload', 'sand-force', 'sharpness', 'sheer-force', 'stakeout', 'steelworker', 'steely-spirit', 'strong-jaw', 'supreme-overlord', 'technician', 'tough-claws', 'toxic-boost', 'transistor', 'water-bubble']
    },
    voltTurn: {
      moves: ['baton-pass', 'chilly-reception', 'flip-turn', 'parting-shot', 'shed-tail', 'teleport', 'u-turn', 'volt-switch']
    },
    choiceItem: {
      items: ['choice-band', 'choice-scarf', 'choice-specs']
    }
  };
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

  // Timer input parsing and formatting helpers
  const parseTimerInput = (input) => {
    // Format: "H:MM" (hours:minutes) or ":MM" (minutes only)
    // Examples: "8:00" = 480 minutes, ":30" = 30 minutes, ":05" = 5 minutes
    if (!input || typeof input !== 'string') return null;
    
    const trimmed = input.trim();
    if (trimmed.startsWith(':')) {
      // Minutes only format ":MM"
      const minutes = parseInt(trimmed.substring(1), 10);
      if (isNaN(minutes) || minutes < 1) return null;
      return Math.min(minutes, 10080); // Max 1 week (10080 minutes)
    } else if (trimmed.includes(':')) {
      // Hours:Minutes format "H:MM"
      const parts = trimmed.split(':');
      if (parts.length !== 2) return null;
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes > 59) return null;
      const totalMinutes = hours * 60 + minutes;
      return Math.min(totalMinutes, 10080); // Max 1 week
    }
    return null;
  };

  const formatTimerMinutes = (minutes) => {
    if (!minutes || minutes < 1) return ':00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
      return `:${mins.toString().padStart(2, '0')}`;
    }
    return `${hours}:${mins.toString().padStart(2, '0')}`;
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

  // Removed unused validateOngoingDraft function

  // Normalize incoming points maps: lowercase keys and numeric values (allow 0 for banned)
  const normalizePointsMap = (pm) => {
    const out = {};
    if (!pm || typeof pm !== 'object') return out;
    for (const [k, v] of Object.entries(pm)) {
      const key = String(k).toLowerCase();
      const raw = Number(v);
      const val = Number.isFinite(raw) ? raw : 1;
      
      // Store with original key
      out[key] = val;
      
      // Also store with normalized key (handles mega- prefix conversion)
      const normalized = normalizePokemonName(key);
      if (normalized !== key) {
        out[normalized] = val;
      }
      
      // Also handle reverse conversion (charizard-mega -> mega-charizard)
      if (key.includes('-mega')) {
        const parts = key.split('-mega');
        if (parts.length === 2) {
          const baseName = parts[0];
          const suffix = parts[1]; // Could be empty or have additional parts like "-x"
          const reverseName = suffix ? `mega-${baseName}${suffix}` : `mega-${baseName}`;
          out[reverseName] = val;
        }
      }
      
      // Handle gmax similarly
      if (key.includes('-gmax')) {
        const parts = key.split('-gmax');
        if (parts.length === 2) {
          const baseName = parts[0];
          const suffix = parts[1];
          const reverseName = suffix ? `gmax-${baseName}${suffix}` : `gmax-${baseName}`;
          out[reverseName] = val;
        }
      }
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

  // Removed unused exportRemoved function

  // Removed unused exportPokemonData function

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
  
  // Analyze team composition for checklist
  const analyzeTeamComposition = () => {
    if (!teamBuilderData || !teamBuilderData.slots) return {};
    
    const results = {};
    const filledSlots = teamBuilderData.slots.filter(slot => slot && slot.pokemon);
    
    console.log('Analyzing team composition. Filled slots:', filledSlots.length);
    
    Object.keys(checklistData).forEach(category => {
      const categoryData = checklistData[category];
      const matchingPokemon = [];
      
      filledSlots.forEach(slot => {
        let matches = false;
        
        console.log(`Checking ${slot.pokemon?.name}:`, {
          moves: slot.moves,
          ability: slot.ability,
          heldItem: slot.heldItem
        });
        
        // Check moves - slot.moves is an array of move names
        if (categoryData.moves && slot.moves && Array.isArray(slot.moves) && slot.moves.length > 0) {
          const slotMoves = slot.moves
            .filter(m => m && typeof m === 'string')
            .map(m => m.toLowerCase().trim())
            .filter(m => m.length > 0);
          
          if (slotMoves.length > 0) {
            matches = categoryData.moves.some(reqMove => 
              slotMoves.includes(reqMove)
            );
            if (matches) {
              console.log(`  ${category}: matched via moves`, slotMoves);
            }
          }
        }
        
        // Check abilities - only if moves didn't match
        if (!matches && categoryData.abilities && slot.ability) {
          const slotAbility = String(slot.ability).toLowerCase().trim();
          if (slotAbility.length > 0) {
            matches = categoryData.abilities.includes(slotAbility);
            if (matches) {
              console.log(`  ${category}: matched via ability`, slotAbility);
            }
          }
        }
        
        // Check items - only if neither moves nor abilities matched
        if (!matches && categoryData.items && slot.heldItem) {
          const slotItem = String(slot.heldItem).toLowerCase().trim();
          if (slotItem.length > 0) {
            matches = categoryData.items.includes(slotItem);
            if (matches) {
              console.log(`  ${category}: matched via item`, slotItem);
            }
          }
        }
        
        if (matches) {
          // Push the pokemon name
          const pokemonName = slot.pokemon?.name || slot.pokemon || 'Unknown';
          matchingPokemon.push(pokemonName);
        }
      });
      
      results[category] = matchingPokemon;
    });
    
    console.log('Team composition results:', results);
    return results;
  };
  
  const teamComposition = useMemo(() => analyzeTeamComposition(), [teamBuilderData]);
  
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
      teraType: '', // Tera Type for Gen 9
      moves: ['', '', '', ''],
      ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      isCaptain: false
    };
  };
  
  const createEmptySlot = (idx) => {
    return {
      slotIndex: idx,
      pokemon: null,
      pokemonId: null,
      pokemonName: '',
      sprite: '',
      isCaptain: false,
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
      
      if (!draft) {
        console.error('Draft not found for code:', lobbyCode);
        alert('Draft not found');
        return;
      }
      
      if (!draft.playerData) {
        console.error('No playerData in draft:', draft);
        alert('No player data in draft');
        return;
      }
      
      if (!draft.playerData[currentUsername]) {
        console.error('No data for username:', currentUsername, 'Available users:', Object.keys(draft.playerData));
        alert('Team not found for your username in this draft');
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
      alert('Failed to load team into builder: ' + err.message);
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
    
    if (field === 'heldItem' || field === 'ability' || field === 'nature' || field === 'teraType' || field === 'isCaptain') {
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
  
  const saveTeamToStorage = async () => {
    if (!teamBuilderData) {
      alert('No team data to save');
      return;
    }
    
    try {
      const defaultName = lobbyCode ? `${PokemonName}-${lobbyCode} team` : `${teamBuilderData.playerName}'s Team`;
      const teamName = prompt('Enter a name for this team:', defaultName);
      if (!teamName) return;
      
      // Check if a team with this name already exists
      const existingTeamsResponse = await axios.get(`${socketUrl}/api/teams?username=${encodeURIComponent(PokemonName)}`);
      const existingTeams = existingTeamsResponse.data.teams || [];
      const existingTeam = existingTeams.find(t => t.name === teamName);
      
      if (existingTeam) {
        const overwrite = window.confirm(`A team named "${teamName}" already exists. Do you want to overwrite it?`);
        if (!overwrite) return;
      }
      
      // Get filled slots (with pokemon)
      const filledSlots = teamBuilderData.slots.filter(slot => slot && slot.pokemon);
      
      if (filledSlots.length === 0) {
        alert('No Pokémon to save!');
        return;
      }

      // Prepare pokemon array for database
      const pokemonForDB = filledSlots.map(slot => ({
        name: slot.pokemon.name,
        moves: slot.moves || [],
        ability: slot.ability || '',
        item: slot.heldItem || '',
        nature: slot.nature || 'Hardy',
        teraType: slot.teraType || '',
        evs: slot.evs || {
          hp: 0, attack: 0, defense: 0,
          specialAttack: 0, specialDefense: 0, speed: 0
        },
        ivs: slot.ivs || {
          hp: 31, attack: 31, defense: 31,
          specialAttack: 31, specialDefense: 31, speed: 31
        },
        level: 50,
        gender: '',
        shiny: false
      }));

      const teamData = {
        username: PokemonName,
        name: teamName,
        pokemon: pokemonForDB,
        format: 'Custom',
        description: 'Team created in Team Builder',
        isPublic: false,
        teamBuilderData: teamBuilderData
      };
      
      // Only include userId if user is logged in
      if (user?._id) {
        teamData.userId = user._id;
      }

      // If overwriting, delete the old team first
      if (existingTeam) {
        await axios.delete(`${socketUrl}/api/teams/${existingTeam._id}`);
      }

      const response = await axios.post(`${socketUrl}/api/teams`, teamData);
      
      if (response.data.success) {
        setExportMessage('Team saved to database!');
        setTimeout(() => setExportMessage(''), 3000);
        // Refresh the teams list if selector is open
        if (showTeamSelector) {
          fetchTeamsFromDB();
        }
      }
    } catch (err) {
      console.error('Failed to save team:', err);
      alert(err.response?.data?.error || 'Failed to save team');
    }
  };
  
  const togglePokemonSelection = (slotIndex) => {
    setSelectedForExport(prev => {
      if (prev.includes(slotIndex)) {
        return prev.filter(idx => idx !== slotIndex);
      } else {
        if (prev.length >= 6) {
          alert('You can only select up to 6 Pokémon for export');
          return prev;
        }
        return [...prev, slotIndex];
      }
    });
  };

  const exportToShowdown = () => {
    if (!teamBuilderData || selectedForExport.length === 0) {
      alert('Please select at least one Pokémon to export');
      return;
    }

    const exportText = selectedForExport.map(slotIndex => {
      const slot = teamBuilderData.slots[slotIndex];
      if (!slot || !slot.pokemon) return '';

      let lines = [];
      
      // Pokemon name @ held item
      const heldItem = slot.heldItem || '';
      lines.push(`${slot.pokemon.name}${heldItem ? ' @ ' + heldItem : ''}`);
      
      // Ability
      if (slot.ability) {
        lines.push(`Ability: ${slot.ability}`);
      }
      
      // Tera Type
      if (slot.teraType) {
        const teraTypeCapitalized = slot.teraType.charAt(0).toUpperCase() + slot.teraType.slice(1);
        lines.push(`Tera Type: ${teraTypeCapitalized}`);
      }
      
      // EVs
      const evs = [];
      if (slot.evs.hp > 0) evs.push(`${slot.evs.hp} HP`);
      if (slot.evs.attack > 0) evs.push(`${slot.evs.attack} Atk`);
      if (slot.evs.defense > 0) evs.push(`${slot.evs.defense} Def`);
      if (slot.evs.specialAttack > 0) evs.push(`${slot.evs.specialAttack} SpA`);
      if (slot.evs.specialDefense > 0) evs.push(`${slot.evs.specialDefense} SpD`);
      if (slot.evs.speed > 0) evs.push(`${slot.evs.speed} Spe`);
      if (evs.length > 0) {
        lines.push(`EVs: ${evs.join(' / ')}`);
      }
      
      // Nature
      if (slot.nature && slot.nature !== 'Hardy') {
        lines.push(`${slot.nature} Nature`);
      }
      
      // IVs (only if not all 31)
      const ivs = [];
      if (slot.ivs.hp < 31) ivs.push(`${slot.ivs.hp} HP`);
      if (slot.ivs.attack < 31) ivs.push(`${slot.ivs.attack} Atk`);
      if (slot.ivs.defense < 31) ivs.push(`${slot.ivs.defense} Def`);
      if (slot.ivs.specialAttack < 31) ivs.push(`${slot.ivs.specialAttack} SpA`);
      if (slot.ivs.specialDefense < 31) ivs.push(`${slot.ivs.specialDefense} SpD`);
      if (slot.ivs.speed < 31) ivs.push(`${slot.ivs.speed} Spe`);
      if (ivs.length > 0) {
        lines.push(`IVs: ${ivs.join(' / ')}`);
      }
      
      // Moves
      slot.moves.forEach(move => {
        if (move) {
          lines.push(`- ${move}`);
        }
      });
      
      return lines.join('\n');
    }).filter(text => text).join('\n\n');

    // Copy to clipboard
    navigator.clipboard.writeText(exportText).then(() => {
      setExportMessage('✅ Copied to clipboard!');
      setTimeout(() => setExportMessage(''), 3000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard. Please try again.');
    });
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

  const fetchTeamsFromDB = async () => {
    try {
      setLoadingTeams(true);
      const currentUsername = PokemonName?.trim();
      if (!currentUsername) {
        console.error('No username set, cannot fetch teams');
        setSavedTeamsFromDB([]);
        setLoadingTeams(false);
        return;
      }

      console.log('Fetching teams for username:', currentUsername, 'from:', `${socketUrl}/api/teams`);
      const response = await axios.get(`${socketUrl}/api/teams?username=${encodeURIComponent(currentUsername)}`);
      console.log('Teams response:', response.data);
      if (response.data.success) {
        setSavedTeamsFromDB(response.data.teams || []);
      }
    } catch (error) {
      console.error('Failed to fetch teams from database:', error);
      setSavedTeamsFromDB([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadTeamFromDB = async (team) => {
    try {
      if (!team || !team.teamBuilderData || !team.teamBuilderData.slots) {
        alert('Team data is missing or corrupted');
        return;
      }

      // Ensure we have exactly 12 slots, filling missing ones with null
      const slots = Array(12).fill(null).map((_, idx) => {
        const slot = team.teamBuilderData.slots[idx];
        if (slot && slot.pokemon) {
          // Find the pokemon in the main list to get full data (abilities, moves, etc.)
          const fullPokemonData = pokemonList.find(p => 
            p.id === slot.pokemon.id || p.name.toLowerCase() === slot.pokemon.name.toLowerCase()
          );

          // Merge saved pokemon data with full data from pokemonList
          const pokemon = {
            ...slot.pokemon,
            // Use full data abilities if available, otherwise fall back to saved data
            abilities: fullPokemonData?.abilities || slot.pokemon.abilities || [],
            moves: fullPokemonData?.moves || slot.pokemon.moves || [],
            types: fullPokemonData?.types || slot.pokemon.types || []
          };

          // Ensure the slot has all required properties
          return {
            slotNumber: slot.slotNumber || idx + 1,
            pokemon: pokemon,
            heldItem: slot.heldItem || '',
            ability: slot.ability || '',
            nature: slot.nature || 'hardy',
            teraType: slot.teraType || '',
            moves: Array.isArray(slot.moves) && slot.moves.length === 4 ? slot.moves : ['', '', '', ''],
            ivs: slot.ivs || { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
            evs: slot.evs || { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
            isCaptain: slot.isCaptain || false
          };
        }
        // Return null for empty slots
        return null;
      });

      const teamData = {
        playerName: team.teamBuilderData.playerName || team.username || 'Player',
        slots: slots
      };

      setTeamBuilderData(teamData);
      setTeamBuilderLoaded(true);
      setShowTeamSelector(false);
      setView('teambuilder');
    } catch (error) {
      console.error('Failed to load team from database:', error);
      alert('Failed to load team: ' + error.message);
    }
  };
  
  const loadTeamFromStorage = async (teamId) => {
    try {
      const savedTeams = loadSavedTeams();
      
      if (!savedTeams || savedTeams.length === 0) {
        alert('Sorry, no teams to load. Save a team from the team builder first.');
        return;
      }
      
      const team = savedTeams.find(t => t.id === teamId);
      
      if (!team) {
        alert('Sorry, team not found. It may have been deleted.');
        return;
      }
      
      if (!team.data || !team.data.slots) {
        alert('Sorry, team data is corrupted or invalid.');
        return;
      }
      
      // Check if team has any Pokemon
      const pokemonCount = team.data.slots.filter(s => s && s.pokemon).length;
      if (pokemonCount === 0) {
        alert('Sorry, this team has no Pokémon to load.');
        return;
      }
      
      
      // Fetch pokemon_data.json to get moves and abilities
      const response = await fetch('/pokemon_data.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch pokemon_data.json: ${response.status}`);
      }
      const allPokemon = await response.json();
      
      // Process each slot and fetch full data including base stats from PokeAPI
      const processedSlots = await Promise.all(team.data.slots.map(async (slot, idx) => {
        // Check if slot has pokemon data
        if (slot && (slot.pokemon || slot.pokemonName)) {
          // Get the pokemon name and ID - handle both old format (string) and new format (object)
          let pokemonName, pokemonId;
          
          if (typeof slot.pokemon === 'object' && slot.pokemon !== null) {
            // New format - pokemon is an object
            pokemonName = (slot.pokemon.name || '').toLowerCase();
            pokemonId = slot.pokemon.id || 0;
          } else {
            // Old format - pokemon is a string or pokemonName exists
            pokemonName = (slot.pokemonName || slot.pokemon || '').toLowerCase();
            pokemonId = slot.pokemonId || 0;
          }
          
          // Find the full pokemon data from pokemon_data.json
          const fullPokemonData = allPokemon.find(p => 
            (p.form_name || '').toLowerCase() === pokemonName || 
            (p.species_name || '').toLowerCase() === pokemonName ||
            p.id === pokemonId
          );
          
          let pokemonObj;
          
          if (typeof slot.pokemon === 'object' && slot.pokemon !== null && slot.pokemon.moves && slot.pokemon.moves.length > 0 && slot.pokemon.baseStats && slot.pokemon.baseStats.hp > 0) {
            // New format with full data already loaded - use it as is
            pokemonObj = slot.pokemon;
          } else if (fullPokemonData) {
            // Found pokemon in data - fetch base stats from PokeAPI
            try {
              const pokeApiResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon/${fullPokemonData.id}`);
              const stats = pokeApiResponse.data.stats;
              
              pokemonObj = {
                id: fullPokemonData.id,
                name: getPokemonDisplayName(fullPokemonData.form_name, fullPokemonData.species_name),
                img: fullPokemonData.sprite_front_default || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${fullPokemonData.id}.png`,
                baseStats: {
                  hp: stats.find(s => s.stat.name === 'hp')?.base_stat || 0,
                  attack: stats.find(s => s.stat.name === 'attack')?.base_stat || 0,
                  defense: stats.find(s => s.stat.name === 'defense')?.base_stat || 0,
                  specialAttack: stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0,
                  specialDefense: stats.find(s => s.stat.name === 'special-defense')?.base_stat || 0,
                  speed: stats.find(s => s.stat.name === 'speed')?.base_stat || 0
                },
                abilities: fullPokemonData.abilities || [],
                moves: fullPokemonData.moves || [],
                types: fullPokemonData.types || []
              };
            } catch (err) {
              console.error(`Failed to fetch stats for ${pokemonName}:`, err);
              // Fallback - use saved stats or zeros
              pokemonObj = {
                id: fullPokemonData.id,
                name: getPokemonDisplayName(fullPokemonData.form_name, fullPokemonData.species_name),
                img: fullPokemonData.sprite_front_default || slot.sprite || '',
                baseStats: slot.stats ? {
                  hp: slot.stats.hp?.base || 0,
                  attack: slot.stats.attack?.base || 0,
                  defense: slot.stats.defense?.base || 0,
                  specialAttack: slot.stats.specialAttack?.base || 0,
                  specialDefense: slot.stats.specialDefense?.base || 0,
                  speed: slot.stats.speed?.base || 0
                } : {
                  hp: 0, attack: 0, defense: 0, 
                  specialAttack: 0, specialDefense: 0, speed: 0
                },
                abilities: fullPokemonData.abilities || [],
                moves: fullPokemonData.moves || [],
                types: fullPokemonData.types || []
              };
            }
          } else {
            // Fallback - reconstruct from old format
            pokemonObj = {
              id: pokemonId,
              name: pokemonName,
              img: slot.sprite || '',
              baseStats: slot.stats ? {
                hp: slot.stats.hp?.base || 0,
                attack: slot.stats.attack?.base || 0,
                defense: slot.stats.defense?.base || 0,
                specialAttack: slot.stats.specialAttack?.base || 0,
                specialDefense: slot.stats.specialDefense?.base || 0,
                speed: slot.stats.speed?.base || 0
              } : {
                hp: 0, attack: 0, defense: 0, 
                specialAttack: 0, specialDefense: 0, speed: 0
              },
              abilities: [],
              moves: [],
              types: []
            };
          }
          
          // Build the slot with proper defaults
          return {
            slotNumber: slot.slotNumber || (slot.slotIndex !== undefined ? slot.slotIndex + 1 : idx + 1),
            pokemon: pokemonObj,
            heldItem: slot.heldItem || '',
            ability: slot.ability || (pokemonObj.abilities && pokemonObj.abilities[0]) || '',
            nature: slot.nature || 'hardy',
            teraType: slot.teraType || '',
            moves: Array.isArray(slot.moves) && slot.moves.length === 4 ? slot.moves : ['', '', '', ''],
            ivs: (slot.ivs && typeof slot.ivs === 'object') ? slot.ivs : { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
            evs: (slot.evs && typeof slot.evs === 'object') ? slot.evs : { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
            isCaptain: slot.isCaptain || false
          };
        }
        // Otherwise return empty slot
        return createEmptySlot(idx);
      }));
      
      const loadedData = {
        playerName: team.data.playerName || team.playerName || 'Player',
        slots: processedSlots
      };
      
      setTeamBuilderData(loadedData);
      setTeamBuilderLoaded(true);
      setShowTeamSelector(false);
      
      // Force a small delay to ensure state updates properly
      setTimeout(() => {
        setExportMessage('Team loaded successfully!');
        setTimeout(() => setExportMessage(''), 3000);
      }, 100);
    } catch (err) {
      console.error('Failed to load team:', err);
      alert('Failed to load team: ' + err.message);
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
        genFilter: Number(options.settings.genFilter) || 0,
        allowTrading: Boolean(options.settings.allowTrading),
        maxTradeLimit: Number(options.settings.maxTradeLimit) || 0,
        unlimitedTrades: Boolean(options.settings.unlimitedTrades)
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

  // Fetch ongoing drafts from MongoDB API
  const fetchOngoingDraftsFromAPI = async (username, searchQuery = '') => {
    if (!username || !username.trim()) {
      console.warn('Cannot fetch drafts without username');
      return [];
    }

    try {
      const socketUrl = process.env.REACT_APP_SOCKET_URL || 
        (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
      
      // Use search endpoint if there's a query, otherwise use username endpoint
      const endpoint = searchQuery.trim() 
        ? `${socketUrl}/api/drafts/search?username=${encodeURIComponent(username)}&query=${encodeURIComponent(searchQuery)}`
        : `${socketUrl}/api/drafts/username/${encodeURIComponent(username)}`;
      
      const response = await axios.get(endpoint);
      
      // Handle both array response (search) and object response (username endpoint)
      const draftsArray = Array.isArray(response.data) ? response.data : (response.data.sessions || []);
      
      if (draftsArray && Array.isArray(draftsArray)) {
        // Transform MongoDB format to match the expected format
        return draftsArray.map(draft => ({
          lobbyCode: draft.lobbyCode,
          code: draft.lobbyCode, // backward compatibility
          draftName: draft.lobbyName || `Draft ${draft.lobbyCode}`,
          hostUsername: draft.hostUsername,
          playerList: draft.participants?.map(p => p.username) || [],
          pickOrder: draft.turnOrder || [],
          currentPick: draft.currentTurn || null,
          playerData: draft.participants?.reduce((acc, participant) => {
            acc[participant.username] = {
              selectedPokemon: participant.selections?.map(s => ({
                id: s.pokemonId,
                name: s.pokemonName,
                points: s.points || 0,
                img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.pokemonId}.png`
              })) || [],
              pointsRemaining: participant.pointsRemaining
            };
            return acc;
          }, {}) || {},
          lobbySettings: draft.settings,
          pokemonPointValues: draft.pointsMap || {},
          savedAt: draft.updatedAt || draft.createdAt,
          status: draft.status
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch ongoing drafts from API:', error);
      // Fallback to localStorage
      return readOngoingDraftsFromCookies();
    }
  };

  // Fetch specific draft by lobby code from MongoDB
  const fetchDraftByCode = async (lobbyCode) => {
    try {
      const socketUrl = process.env.REACT_APP_SOCKET_URL || 
        (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
      
      const response = await axios.get(`${socketUrl}/api/drafts/${encodeURIComponent(lobbyCode)}`);
      
      if (response.data && response.data.session) {
        const draft = response.data.session;
        return {
          lobbyCode: draft.lobbyCode,
          code: draft.lobbyCode,
          draftName: draft.lobbyName || `Draft ${draft.lobbyCode}`,
          playerList: draft.participants?.map(p => p.username) || [],
          pickOrder: draft.turnOrder || [],
          currentPick: draft.currentTurn || null,
          playerData: draft.participants?.reduce((acc, participant) => {
            acc[participant.username] = {
              selectedPokemon: participant.selections?.map(s => ({
                id: s.pokemonId,
                name: s.pokemonName,
                points: s.points || 0,
                img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.pokemonId}.png`
              })) || [],
              pointsRemaining: participant.pointsRemaining
            };
            return acc;
          }, {}) || {},
          lobbySettings: draft.settings,
          pokemonPointValues: draft.pointsMap || {},
          savedAt: draft.updatedAt || draft.createdAt,
          status: draft.status,
          _fullDraft: draft // Keep full draft data for reference
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to fetch draft by code:', error);
      return null;
    }
  };

  const deleteOngoingDraft = async (code) => {
    if (!code) return;
    try {
      // Try to delete from MongoDB first
      try {
        const socketUrl = process.env.REACT_APP_SOCKET_URL || 
          (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
        
        await axios.delete(`${socketUrl}/api/drafts/${encodeURIComponent(code)}`);
      } catch (apiError) {
        console.warn('Failed to delete from MongoDB API (may not exist):', apiError);
      }

      // Also clean up localStorage
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

  // Rejoin draft from MongoDB - load draft state and go directly to draft view
  const rejoinDraftFromMongo = async (code, draftEntry) => {
    try {
      const currentUsername = PokemonName?.trim();
      if (!currentUsername) {
        alert('Please set your username first');
        return;
      }

      if (!draftEntry) {
        alert('Draft data not found');
        return;
      }

      // Get the full draft from the API response
      const fullDraft = draftEntry._fullDraft || draftEntry;

      // DON'T restore full list yet - we'll set the correct filtered list below
      
      // Set lobby code and settings
      setLobbyCode(code);
      
      const settings = fullDraft.settings || {};
      setLobbySettings({
        pointsLimit: settings.pointsLimit || 100,
        teamSizeLimit: settings.teamSizeLimit || 6,
        allowTrading: settings.allowTrading || false,
        maxTradeLimit: settings.maxTradeLimit || 0,
        unlimitedTrades: settings.unlimitedTrades || false,
        genFilter: settings.genFilter || 0,
        timerEnabled: settings.timerEnabled || false,
        firstRoundTimer: settings.firstRoundTimer || 480,
        subsequentRoundTimer: settings.subsequentRoundTimer || 480,
        allowMega: settings.allowMega || false,
        allowGmax: settings.allowGmax || false
      });

      // Set points map
      if (fullDraft.pointsMap) {
        setPointsMap(normalizePointsMap(fullDraft.pointsMap));
      }

      // Set gen filter if available
      if (settings.genFilter != null) {
        setLobbyGenFilter(settings.genFilter);
      }

      // Reconstruct lobby users from participants (read-only, preserve MongoDB data)
      const participants = fullDraft.participants || [];
      const users = participants.map((participant) => ({
        id: `mongo-${participant.username}`, // Use username-based ID for consistency
        name: participant.username,
        isConnected: participant.isConnected || false // Track connection status from MongoDB
      }));
      
      // Mark current user as connected and use socket.id for them
      const myUserIndex = users.findIndex(u => u.name === currentUsername);
      if (myUserIndex >= 0 && socket && socket.id) {
        users[myUserIndex] = {
          ...users[myUserIndex],
          id: socket.id, // Use socket.id for current user
          isConnected: true
        };
      }
      
      setLobbyUsers(users);
      setLocalPlayerName(currentUsername);

      // Set host based on MongoDB data
      const hostUsername = fullDraft.hostUsername;
      const hostUser = users.find(u => u.name === hostUsername);
      setHostId(hostUser?.id || users[0]?.id || socket?.id || `mongo-${currentUsername}`);

      // Find my user ID from the users list
      const myUser = users.find(u => u.name === currentUsername);
      const myUserId = myUser?.id;

      // Reconstruct all selections from all participants
      const allSelections = {};
      let myTeam = [];
      
      participants.forEach((participant) => {
        const username = participant.username;
        const userId = `mongo-${username}`; // Use username-based ID
        const team = (participant.selections || []).map(s => ({
          id: s.pokemonId,
          name: s.pokemonName,
          points: s.points || 0,
          img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.pokemonId}.png`
        }));
        
        // Store by username and mongo ID
        allSelections[username] = team;
        allSelections[userId] = team;
        
        // Also store by socket.id for current user
        if (username === currentUsername && socket && socket.id) {
          allSelections[socket.id] = team;
        }
        
        if (username === currentUsername) {
          myTeam = team;
        }
      });
      
      setRemoteSelections(allSelections);

      // Set points remaining for all participants
      const pointsRemainingMap = {};
      participants.forEach((participant) => {
        const username = participant.username;
        const userId = `mongo-${username}`;
        if (participant.pointsRemaining != null) {
          pointsRemainingMap[username] = participant.pointsRemaining;
          pointsRemainingMap[userId] = participant.pointsRemaining;
          
          // Also store by socket.id for current user
          if (username === currentUsername && socket && socket.id) {
            pointsRemainingMap[socket.id] = participant.pointsRemaining;
          }
        }
      });
      setPointsRemaining(pointsRemainingMap);

      // Set the available pokemon list (remove already selected ones)
      const allSelectedIds = Object.values(allSelections).flat().map(p => p.id).filter(Boolean);
      
      // Use draftPokemon from MongoDB if available, otherwise calculate from full list
      if (fullDraft.draftPokemon && Array.isArray(fullDraft.draftPokemon) && fullDraft.draftPokemon.length > 0) {
        // MongoDB has the remaining available pokemon - use it directly
        setDraftPokemonList(fullDraft.draftPokemon);
        setPokemonList(fullDraft.draftPokemon);
      } else {
        // Calculate: restore full list, apply gen filter, remove selected and banned
        restoreFullPokemonList();
        
        // Wait for state to update, then filter
        setTimeout(() => {
          setPokemonList((prev) => {
            let filtered = prev.filter(p => !allSelectedIds.includes(p.id));
            // Apply points map filter (remove 0-point pokemon)
            if (fullDraft.pointsMap) {
              filtered = filtered.filter(p => {
                const cost = fullDraft.pointsMap[p.name?.toLowerCase()] ?? 1;
                return cost !== 0;
              });
            }
            return filtered;
          });
          setDraftPokemonList((prev) => {
            let filtered = prev.filter(p => !allSelectedIds.includes(p.id));
            // Apply points map filter (remove 0-point pokemon)
            if (fullDraft.pointsMap) {
              filtered = filtered.filter(p => {
                const cost = fullDraft.pointsMap[p.name?.toLowerCase()] ?? 1;
                return cost !== 0;
              });
            }
            return filtered;
          });
        }, 0);
      }

      // Set draft order (turn order) - read from MongoDB, use socket.id for current player
      if (fullDraft.turnOrder && fullDraft.turnOrder.length > 0) {
        // Turn order from MongoDB contains usernames
        // Map them to our user IDs, using socket.id for current player
        const mappedTurnOrder = fullDraft.turnOrder.map(turn => {
          // Check if this turn is for the current user
          if (turn === currentUsername) {
            return socket?.id || `mongo-${turn}`;
          }
          // Find user by name
          const user = users.find(u => u.name === turn);
          return user ? user.id : `mongo-${turn}`;
        }).filter(Boolean);
        setLobbyDraftOrder(mappedTurnOrder);
      }

      // Set current turn if available - use socket.id if it's current player's turn
      if (fullDraft.currentTurn) {
        // Check if it's the current user's turn
        if (fullDraft.currentTurn === currentUsername) {
          setCurrentTurn(socket?.id || `mongo-${currentUsername}`);
        } else {
          // Find the user and use their ID
          const turnUser = users.find(u => u.name === fullDraft.currentTurn);
          const mappedCurrentTurn = turnUser?.id || `mongo-${fullDraft.currentTurn}`;
          setCurrentTurn(mappedCurrentTurn);
        }
      }
      
      // Set current turn start time if available (for timer persistence)
      if (fullDraft.currentTurnStartTime) {
        setCurrentTurnStartTime(fullDraft.currentTurnStartTime);
      }

      // Update connection status in MongoDB
      try {
        const socketUrl = process.env.REACT_APP_SOCKET_URL || 
          (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
        
        await axios.post(`${socketUrl}/api/drafts/${encodeURIComponent(code)}/connection-status`, {
          username: currentUsername,
          isConnected: true
        });
      } catch (error) {
        console.error('Failed to update connection status:', error);
      }

      // Go to draft view
      setView('draft');

      setExportMessage('Rejoined draft successfully');
      setTimeout(() => setExportMessage(''), 2500);

    } catch (error) {
      console.error('Failed to rejoin draft - detailed error:', error);
      console.error('Error stack:', error.stack);
      alert(`Failed to rejoin draft: ${error.message}`);
    }
  };

  // Export current pointsMap to a downloadable text file (CSV: name,points)
  const exportPoints = () => {
    // Create comprehensive settings export including all lobby settings
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      lobbyCode: lobbyCode || 'unknown',
      settings: {
        pointsLimit: lobbySettings.pointsLimit,
        teamSizeLimit: lobbySettings.teamSizeLimit,
        genFilter: lobbyGenFilter,
        allowTrading: lobbySettings.allowTrading || false,
        maxTradeLimit: lobbySettings.maxTradeLimit || 0,
        unlimitedTrades: lobbySettings.unlimitedTrades || false
      },
      pointsMap: pointsMap || {},
      banList: banList || []
    };
    
    const jsonText = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pkmndraftsettings_${lobbyCode || 'export'}.json`;
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
            
            // Extract ban list if present
            if (jsonData.banList && Array.isArray(jsonData.banList)) {
              importedBanList = jsonData.banList;
            }
          } else {
            // Old format: just pointsMap as object
            parsed = jsonData;
          }
        }
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
        if (Object.keys(pm).length > 0) {
          parsed = pm;
        }
      }
      
      if (parsed) {
        // emit to server as bulk import
        if (socket && lobbyCode) {
          // If we have imported settings, apply them first
          if (importedSettings) {
            const newSettings = {
              pointsLimit: importedSettings.pointsLimit ?? lobbySettings.pointsLimit,
              teamSizeLimit: importedSettings.teamSizeLimit ?? lobbySettings.teamSizeLimit,
              allowTrading: importedSettings.allowTrading ?? false,
              maxTradeLimit: importedSettings.maxTradeLimit ?? 0,
              unlimitedTrades: importedSettings.unlimitedTrades ?? false
            };
            
            // Update local settings immediately
            setLobbySettings(newSettings);
            
            if (importedSettings.genFilter != null) {
              setLobbyGenFilter(importedSettings.genFilter);
            }
            
            // Send settings to server
            socket.emit('update_settings', { 
              code: lobbyCode, 
              settings: {
                ...newSettings,
                genFilter: importedSettings.genFilter ?? lobbyGenFilter
              }
            }, (resp) => {
              if (!resp || !resp.ok) {
                console.warn('Failed to update lobby settings:', resp?.error);
              } else {
              }
            });
          }
          
          // Update ban list if provided
          if (importedBanList) {
            setBanList(importedBanList);
          }
          
          // Import points map
          socket.emit('import_points', { code: lobbyCode, pointsMap: parsed }, (resp) => {
            if (!resp || !resp.ok) {
              alert(resp && resp.error ? resp.error : 'Failed to import points');
            } else {
              setPointsMap(normalizePointsMap(resp.pointsMap || {}));
              let message = 'Points imported successfully';
              if (importedSettings) message += '\nLobby settings updated';
              if (importedBanList) message += '\nBan list updated';
              alert(message + '!');
            }
          });
        } else {
          // local: just set map
          alert('Not connected to a lobby. Create or join a lobby first.');
          setPointsMap(normalizePointsMap(parsed));
          if (importedSettings) {
            setLobbySettings(prev => ({
              ...prev,
              pointsLimit: importedSettings.pointsLimit ?? prev.pointsLimit,
              teamSizeLimit: importedSettings.teamSizeLimit ?? prev.teamSizeLimit,
              allowTrading: importedSettings.allowTrading ?? prev.allowTrading,
              maxTradeLimit: importedSettings.maxTradeLimit ?? prev.maxTradeLimit,
              unlimitedTrades: importedSettings.unlimitedTrades ?? prev.unlimitedTrades
            }));
            if (importedSettings.genFilter != null) {
              setLobbyGenFilter(importedSettings.genFilter);
            }
          }
          if (importedBanList) {
            setBanList(importedBanList);
          }
        }
      } else {
        alert('Failed to parse settings file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };
  
  // Helper function to determine the correct Pokemon name
  const getPokemonDisplayName = (formName, speciesName) => {
    if (!formName || !speciesName) return formName || speciesName;
    
    const specialFormTokens = ['alola', 'alolan', 'galar', 'galarian', 'hisui', 'hisuian', 'paldea', 'paldean', 'mega', 'gmax'];
    const formLower = formName.toLowerCase();
    
    // If the form name contains a special form token, use the form name
    if (specialFormTokens.some(token => formLower.includes(token))) {
      return formName;
    }
    
    // Otherwise use the species name
    return speciesName;
  };

  // Helper function to normalize Pokemon names for matching (handles different mega/gmax naming conventions)
  const normalizePokemonName = (name) => {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    
    // Handle mega- prefix (presets format) -> convert to -mega suffix (PokeAPI format)
    // mega-charizard-x -> charizard-mega-x
    if (lower.startsWith('mega-')) {
      const withoutPrefix = lower.substring(5); // Remove "mega-"
      const parts = withoutPrefix.split('-');
      if (parts.length === 1) {
        // mega-charizard -> charizard-mega
        return `${parts[0]}-mega`;
      } else {
        // mega-charizard-x -> charizard-mega-x
        return `${parts[0]}-mega-${parts.slice(1).join('-')}`;
      }
    }
    
    return lower;
  };

  useEffect(() => {
    // Fetch abilities list from PokeAPI after pokemon data loads
    if (pokemonList.length > 0 && allAbilitiesList.length === 0) {
      fetchAllAbilities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokemonList.length]);

  useEffect(() => {
    // Load Pokemon data from local JSON file instead of PokeAPI
    fetch('/pokemon_data.json')
      .then(response => response.json())
      .then((data) => {
        const sampleParadox = data.find(p => p.form_name === 'great-tusk');
        
        // Filter out unwanted forms (same logic as PokeAPI fallback)
        const excludeTokens = [
          'mega', 'gmax', 'g-max', 'primal', 'totem', 'therian', 'incarnate', 'eternal',
          'attack', 'defense', 'school', 'armored', 'masked', 'dusk', 'midnight', 'origin',
          'size', 'eternamax', 'shield', 'disguised', 'solo', 'aria', 'resolute', 'zen', 'cap'
        ];
        const keepRegional = [
          'alola', 'alolan', 'galar', 'galarian', 'hisui', 'hisuian', 'paldea', 'paldean'
        ];
        // Whitelist for pokemon whose base names contain exclusion tokens but should be kept
        const allowedBaseNames = new Set([
          'meganium', 'ariados', 'altaria', 'duskull', 'shieldon', 'yanmega', 
          'dusknoir', 'solosis', 'zamazenta', 'capsakid', 'finizen'
        ]);
        
        const filteredData = data.filter(pokemon => {
          const name = pokemon.form_name.toLowerCase();
          
          // Allow whitelisted base forms (false positives)
          if (allowedBaseNames.has(name)) {
            return true;
          }
          
          // First check exclude tokens
          if (excludeTokens.some(t => name.includes(t))) {
            // Exception: allow regional variants that aren't Pikachu
            if (!name.includes('pikachu') && keepRegional.some(t => name.includes(t))) {
              return true;
            }
            return false;
          }
          
          // Exclude Pikachu regional variants (they have special forms)
          if (name.includes('pikachu') && keepRegional.some(t => name.includes(t))) {
            return false;
          }
          
          return true;
        });
        
        // Transform the data to match our existing format
        const list = filteredData.map(pokemon => ({
          id: pokemon.id,
          name: getPokemonDisplayName(pokemon.form_name, pokemon.species_name),
          img: pokemon.sprite_front_default,
          types: pokemon.types,
          abilities: pokemon.abilities,
          moves: pokemon.moves,
          generation: pokemon.generation,
          legendary: pokemon.legendary || false,
          paradox: pokemon.paradox || false
        })).sort((a, b) => a.id - b.id);
        
        // Build legendary map from the data
        const legMap = {};
        filteredData.forEach(pokemon => {
          legMap[getPokemonDisplayName(pokemon.form_name, pokemon.species_name)] = pokemon.legendary || false;
        });
        setLegendaryMap(legMap);
        
        setPokemonList(list);
      })
      .catch((err) => {
        console.error('Failed to load pokemon data from local file:', err);
        // Fallback to PokeAPI if local file fails
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
              'calyrex-shadow','type-null','lycanroc-midday', 'darmanitan-standard', 'doublade ', 'aegislash-shield', 'Meganium', 'Yanmega'
            ]);
            const hyphenDisallowNames = new Set([
              'darmanitan-zen',
              'darmanitan-galar-zen'
            ]);

            const filtered = rawList.filter((p) => {
              const name = p.name.toLowerCase();
              
              // First check exclude tokens - this takes priority over everything
              if (excludeTokens.some((t) => name.includes(t))) {
                // Exception: allow regional variants that aren't Pikachu
                if (!name.includes('pikachu') && keepRegional.some((t) => name.includes(t))) {
                  return true;
                }
                return false;
              }
              
              // Exclude Pikachu regional variants (they have special forms)
              if (name.includes('pikachu') && keepRegional.some((t) => name.includes(t))) return false;
              
              // Keep regional variants
              if (keepRegional.some((t) => name.includes(t))) return true;
              
              // Handle hyphenated names
              if (name.includes('-')) {
                if (hyphenDisallowNames.has(name)) return false;
                if (hyphenAllowTokens.some((t) => name.includes(t))) return true;
                if (hyphenAllowNames.has(name)) return true;
                return false;
              }
              
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

  // Timer countdown effect
  useEffect(() => {
    if (!lobbySettings.timerEnabled || view !== 'draft') {
      setTimeRemaining(null);
      return;
    }

    // If we're in draft mode with timer enabled but no start time, initialize it
    if (!currentTurnStartTime && currentTurn) {
      setCurrentTurnStartTime(new Date().toISOString());
      return;
    }

    if (!currentTurnStartTime) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const turnStart = new Date(currentTurnStartTime).getTime();
      const elapsed = Math.floor((now - turnStart) / 1000); // seconds elapsed
      
      // Determine which timer to use based on round
      const totalPicks = Object.values(remoteSelections).reduce((sum, picks) => sum + (picks?.length || 0), 0);
      const playersCount = lobbyUsers.length || 1;
      const roundNumber = Math.floor(totalPicks / playersCount) + 1;
      
      const timerMinutes = roundNumber === 1 ? lobbySettings.firstRoundTimer : lobbySettings.subsequentRoundTimer;
      const timerSeconds = timerMinutes * 60;
      
      const remaining = Math.max(0, timerSeconds - elapsed);
      setTimeRemaining(remaining);
      
      // If time runs out and we haven't been notified, the server should skip turn
      // (We'll handle this on the server side)
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [lobbySettings.timerEnabled, lobbySettings.firstRoundTimer, lobbySettings.subsequentRoundTimer, currentTurnStartTime, view, remoteSelections, lobbyUsers.length, currentTurn]);

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
    const normalizedName = normalizePokemonName(name);
    
    // Try original name first, then normalized name
    if (pointsMap && pointsMap[name] != null) return Number(pointsMap[name]);
    if (pointsMap && pointsMap[normalizedName] != null) return Number(pointsMap[normalizedName]);
    if (pointsMap && pointsMap[p.name] != null) return Number(pointsMap[p.name]);
    return 1;
  };

  // Return the visible pokemon list for the draft area, filtered and sorted
  const getVisiblePokemonList = () => {
    const source = (draftPokemonList && draftPokemonList.length > 0) ? draftPokemonList : pokemonList;
    const gen = lobbyGenFilter || 0;
    const filtered = (source || []).filter((p) => {
      if (!p) return false;
      const name = (p.name || '').toLowerCase();
      
      // Check if this is a mega/gmax/eternamax form and bypass generation filter if enabled
      const isMega = name.includes('-mega');
      const isGmax = name.includes('-gmax') || name.includes('eternamax');
      const shouldIgnoreGen = (isMega && lobbySettings.allowMega) || (isGmax && lobbySettings.allowGmax);
      
      if (gen > 0 && !shouldIgnoreGen && p.id > genLimits[gen]) return false;
      // Multi-search: if there are selected terms, Pokemon must match at least one
      if (searchTerms.length > 0) {
        const matchesAnyTerm = searchTerms.some(term => name.includes(term.toLowerCase()));
        if (!matchesAnyTerm) return false;
      }
      // Single search term (typing in progress)
      if (searchTerm && !name.includes(searchTerm)) return false;
      if (hideLegendaries && p.legendary) return false;
      
      // Check if banned (support both naming conventions)
      const normalizedName = normalizePokemonName(name);
      if (pointsMap && (Number(pointsMap[name]) === 0 || Number(pointsMap[normalizedName]) === 0)) return false;
      
      // Advanced filters
      // Type filter - supports both inclusive (OR) and exclusive (AND) logic
      if (filterTypes.length > 0) {
        if (!p.types || !Array.isArray(p.types)) return false;
        if (filterTypesInclusive) {
          // Inclusive mode: Pokemon must have AT LEAST ONE selected type (OR logic)
          const hasAnyType = filterTypes.some(selectedType => 
            p.types.some(pokemonType => pokemonType === selectedType)
          );
          if (!hasAnyType) return false;
        } else {
          // Exclusive mode: Pokemon must have ALL selected types (AND logic)
          const hasAllTypes = filterTypes.every(selectedType => 
            p.types.some(pokemonType => pokemonType === selectedType)
          );
          if (!hasAllTypes) return false;
        }
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
      if (filterAbility && filterAbility.trim() && pokemonWithAbility.length > 0) {
        // Check if this Pokemon's name matches any species that have the ability
        const pokemonName = (p.name || '').toLowerCase();
        const hasAbility = pokemonWithAbility.some(speciesName => 
          pokemonName.includes(speciesName) || speciesName.includes(pokemonName)
        );
        if (!hasAbility) return false;
      }
      
      // Move filter (all selected moves must be present)
      if (filterMoves && filterMoves.length > 0) {
        if (!p.moves || !Array.isArray(p.moves) || p.moves.length === 0) return false;
        const hasAllMoves = filterMoves.every(filterMove => 
          p.moves.some(move => 
            move && move.toLowerCase().includes(filterMove.toLowerCase())
          )
        );
        if (!hasAllMoves) return false;
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
      default:
        // ID (default)
    }
    return sorted;
  };

  // Memoize the visible pokemon list to avoid recalculating on every render
  const visiblePokemonList = useMemo(() => getVisiblePokemonList(), [
    draftPokemonList, 
    pokemonList, 
    lobbyGenFilter, 
    searchTerm,
    searchTerms, 
    hideLegendaries, 
    pointsMap, 
    filterTypes, 
    filterTypesInclusive, 
    filterGeneration, 
    filterPointsMin, 
    filterPointsMax, 
    filterAbility, 
    pokemonWithAbility, 
    filterMoves, 
    sortOption,
    lobbySettings.allowMega,
    lobbySettings.allowGmax
  ]);

  // Memoize filtered suggestions for points search to avoid filtering on every render
  const pointsSearchSuggestions = useMemo(() => {
    if (!pointsSearchName) return [];
    return pokemonList.filter(p => {
      const gen = lobbyGenFilter || 0;
      const name = p.name.toLowerCase();
      // Ignore generation filter for mega/gmax forms if those settings are enabled
      const isMega = name.includes('-mega');
      const isGmax = name.includes('-gmax');
      const shouldIgnoreGen = (isMega && lobbySettings.allowMega) || (isGmax && lobbySettings.allowGmax);
      
      if (gen > 0 && !shouldIgnoreGen && p.id > genLimits[gen]) return false;
      if (hideLegendaries && p.legendary) return false;
      return name.includes(pointsSearchName);
    }).slice(0, 10);
  }, [pointsSearchName, pokemonList, lobbyGenFilter, hideLegendaries, lobbySettings.allowMega, lobbySettings.allowGmax]);

  // Memoize draft search suggestions to avoid filtering on every render
  const draftSearchSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    const list = draftPokemonList.length > 0 ? draftPokemonList : pokemonList;
    return list.filter(p => p.name.toLowerCase().includes(searchTerm)).slice(0, 8);
  }, [searchTerm, draftPokemonList, pokemonList]);

  // Fetch all abilities from PokeAPI and filter by what's in our pokemon_data.json
  const fetchAllAbilities = async () => {
    try {
      if (pokemonList.length === 0) return;
      
      // Fetch all abilities from PokeAPI
      const response = await axios.get('https://pokeapi.co/api/v2/ability?limit=1000');
      const allAbilities = response.data.results.map(ability => ({
        name: ability.name,
        displayName: ability.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      }));
      
      // Get unique abilities from our pokemon data
      const pokemonAbilities = new Set();
      pokemonList.forEach(p => {
        if (p.abilities && Array.isArray(p.abilities)) {
          p.abilities.forEach(ability => {
            if (ability) {
              // Normalize to match PokeAPI format (lowercase, no spaces)
              const normalized = ability.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
              pokemonAbilities.add(normalized);
            }
          });
        }
      });
      
      // Filter abilities to only those in our pokemon data
      const filteredAbilities = allAbilities.filter(ability => {
        const normalized = ability.name.replace(/-/g, '');
        return pokemonAbilities.has(normalized);
      });
      
      // Sort and set
      const sorted = filteredAbilities.sort((a, b) => 
        a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())
      );
      
      setAllAbilitiesList(sorted);
    } catch (err) {
      console.error('Failed to fetch abilities from PokeAPI:', err);
    }
  };

  // Get unique moves from pokemon list for autocomplete
  const getUniqueMoves = () => {
    const allMoves = pokemonList
      .flatMap(p => p.moves || [])
      .filter(move => move && move.trim());
    return [...new Set(allMoves)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  };

  // Fetch Pokemon with a specific ability from PokeAPI
  const fetchPokemonWithAbility = async (abilityName) => {
    if (!abilityName) {
      setPokemonWithAbility([]);
      return;
    }
    
    try {
      // Convert display name back to API format (lowercase with hyphens)
      const apiAbilityName = abilityName.toLowerCase().replace(/\s+/g, '-');
      const response = await axios.get(`https://pokeapi.co/api/v2/ability/${apiAbilityName}`);
      
      // Extract Pokemon species names that have this ability
      const speciesNames = response.data.pokemon.map(p => {
        // Extract species name from URL or use pokemon.name
        const speciesName = p.pokemon.species?.name || p.pokemon.name;
        return speciesName.toLowerCase();
      });
      
      setPokemonWithAbility(speciesNames);
    } catch (err) {
      console.error('Failed to fetch Pokemon with ability:', err);
      setPokemonWithAbility([]);
    }
  };

  // Update ability suggestions
  const updateAbilitySuggestions = (input) => {
    if (!input || input.trim() === '') {
      setAbilitySuggestions([]);
      setShowAbilitySuggestions(false);
      return;
    }
    const filtered = allAbilitiesList.filter(ability => 
      ability.displayName.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 10);
    setAbilitySuggestions(filtered);
    setShowAbilitySuggestions(filtered.length > 0);
  };

  // Update move suggestions
  const updateMoveSuggestions = (input) => {
    if (!input || input.trim() === '') {
      setMoveSuggestions([]);
      setShowMoveSuggestions(false);
      return;
    }
    const uniqueMoves = getUniqueMoves();
    const filtered = uniqueMoves.filter(move => 
      move.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 10);
    setMoveSuggestions(filtered);
    setShowMoveSuggestions(filtered.length > 0);
  };

  // Reset all filters to default
  const resetAllFilters = () => {
    setFilterTypes([]);
    setFilterGeneration(0);
    setFilterPointsMin('');
    setFilterPointsMax('');
    setFilterAbility('');
    setFilterMoves([]);
    setFilterMoveInput('');
    setAbilitySuggestions([]);
    setShowAbilitySuggestions(false);
    setPokemonWithAbility([]);
    setMoveSuggestions([]);
    setShowMoveSuggestions(false);
  };
  
  const confirmDraftSelection = () => {
    if (pendingDraftSelection) {
      removePokemon(pendingDraftSelection.id);
      setPendingDraftSelection(null);
    }
  };
  
  const cancelDraftSelection = () => {
    setPendingDraftSelection(null);
  };

  const removePokemon = (id) => {
    // local guard: if in draft view ensure it's user's turn and they have enough points
    const listSource = (view === 'draft' && draftPokemonList && draftPokemonList.length > 0) ? draftPokemonList : pokemonList;
    if (view === 'draft' && (!draftPokemonList || draftPokemonList.length === 0)) {
    }
    const toRemove = listSource.find((p) => Number(p.id) === Number(id));
    if (!toRemove) {
      // log some diagnostics: which source we used and the first few entries
      const sample = (listSource || []).slice(0, 20).map(p => ({ id: p && p.id, name: p && p.name, type: typeof (p && p.id) }));
      return;
    }
    if (view === 'draft' && socket && lobbyCode) {
      // enforce team size limit for local player
      try {
        const localUser = (socket && lobbyUsers) ? lobbyUsers.find(u => u.id === socket.id) : null;
        const merged = getMergedSelectionsForUser(localUser || { id: socket && socket.id, name: localPlayerName || PokemonName || 'You' });
        const teamLimit = (lobbySettings && lobbySettings.teamSizeLimit) ? Number(lobbySettings.teamSizeLimit) : 10;
        if (merged.length >= teamLimit) {
          return;
        }
      } catch (err) {
        // ignore and continue with normal checks
      }
      // ensure current turn is this client
      if (currentTurn && socket.id !== currentTurn) {
        return;
      }
      const cost = (pointsMap[toRemove.name] == null) ? 1 : Number(pointsMap[toRemove.name]);
      const rem = pointsRemaining && pointsRemaining[socket.id] != null ? pointsRemaining[socket.id] : lobbySettings.pointsLimit;
      if (rem < cost) {
        return;
      }
    }
    // Add an optimistic local pick for the current client so it shows
    // immediately in the sidebar, then emit the authoritative request.
    try {
      const localName = localPlayerName || PokemonName || 'You';
      const myId = socket ? socket.id : (`local-${Date.now()}`);
      // Optimistically add pick under our id
      setOptimisticSelections((prev) => {
        const copy = { ...(prev || {}) };
        copy[myId] = copy[myId] ? [...copy[myId], toRemove] : [toRemove];
        return copy;
      });
      // hide the pokemon locally from visible lists so it feels immediate
      setPokemonList((prev) => prev.filter(p => Number(p.id) !== Number(toRemove.id)));
      setDraftPokemonList((prev) => prev.filter(p => Number(p.id) !== Number(toRemove.id)));

      if (socket && lobbyCode) {
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
          name: getPokemonDisplayName(pokemon.form_name, pokemon.species_name),
          img: pokemon.sprite_front_default,
          types: pokemon.types,
          moves: pokemon.moves,
          generation: pokemon.generation,
          legendary: pokemon.legendary || false,
          paradox: pokemon.paradox || false
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
              
              // First check exclude tokens - this takes priority over everything
              if (excludeTokens.some((t) => name.includes(t))) {
                // Exception: allow regional variants that aren't Pikachu
                if (!name.includes('pikachu') && keepRegional.some((t) => name.includes(t))) {
                  return true;
                }
                return false;
              }
              
              // Exclude Pikachu regional variants (they have special forms)
              if (name.includes('pikachu') && keepRegional.some((t) => name.includes(t))) return false;
              
              // Handle explicitly allowed names
              if (hyphenAllowNames.has(name)) return true;
              
              // Handle hyphenated names
              if (name.includes('-')) {
                if (keepRegional.some((t) => name.includes(t))) return true;
                if (hyphenAllowTokens.some((t) => name.includes(t))) return true;
                return false;
              }
              
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
    // Require authentication or username
    if (!user && !PokemonName?.trim()) {
      setShowAuthModal(true);
      return;
    }
    
    // Restore full Pokemon list before creating lobby
    restoreFullPokemonList();
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
    // Require authentication or username
    if (!user && !PokemonName?.trim()) {
      setShowAuthModal(true);
      return;
    }
    
    // Restore full Pokemon list before joining lobby
    restoreFullPokemonList();
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
    // MongoDB handles persistence automatically when leaving
    // Just leave the lobby and return to main page
    leaveLobby();
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
    
    // Check if either player has finished trading
    if (playersFinishedTrading.includes(myId)) {
      alert('You have already finished trading');
      return;
    }
    if (playersFinishedTrading.includes(theirPokemon.ownerId)) {
      alert('That player has already finished trading');
      return;
    }
    
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
    
    
    // Set a timeout to close modal even if server doesn't respond
    const timeout = setTimeout(() => {
      setPendingTradeOffer(null);
      setSelectedForTrade([]);
    }, 1000);
    
    socket.emit('offer_trade', {
      code: lobbyCode,
      from: pendingTradeOffer.from,
      to: pendingTradeOffer.to,
      pokemon1: pendingTradeOffer.myPokemon,
      pokemon2: pendingTradeOffer.theirPokemon
    }, (response) => {
      clearTimeout(timeout);
      if (response && response.ok) {
        // Clear the modal and selections after successful send
        setPendingTradeOffer(null);
        setSelectedForTrade([]);
      } else if (response && response.error) {
        alert(response.error);
      }
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
    
    // Find the full Pokemon object from pokemonList
    const newPokemon = pokemonList.find(p => p.name === newPokemonName);
    
    
    // Set a timeout to close modal even if server doesn't respond
    const timeout = setTimeout(() => {
      setShowUnpickedModal(null);
      setUnpickedSearchQuery('');
    }, 1000);
    
    socket.emit('trade_for_unpicked', {
      code: lobbyCode,
      playerId: showUnpickedModal.ownerId,
      oldPokemon: showUnpickedModal.pokemonName,
      newPokemon: newPokemonName,
      newPokemonData: newPokemon // Send full Pokemon data
    }, (response) => {
      clearTimeout(timeout);
      if (response && response.ok) {
        setShowUnpickedModal(null);
        setUnpickedSearchQuery('');
      } else if (response && response.error) {
        alert(response.error);
      }
    });
  };
  
  // ========== END TRADING FUNCTIONS ==========

  const startDraft = () => {
    if (socket && lobbyCode) {
      socket.emit('start_draft', { code: lobbyCode, leagueCode: lobbyLeagueCode }, (resp) => {
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
    for (let i = 0; i < speciesList.length; i += concurrency) {
      const chunk = speciesList.slice(i, i + concurrency);
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
    // Build final mapping for all requested names (use cached values when available)
    const finalMap = {};
    for (const n of names) {
      if (n in result) finalMap[n] = result[n];
      else finalMap[n] = !!legendaryMap[n];
    }
    setLoadingLegendaries(false);
    return finalMap;
  };

  // Fetch Mega Evolution Pokémon from PokeAPI
  const fetchMegaPokemon = async () => {
    try {
      // Fetch all Pokemon forms from PokeAPI
      const response = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=2000');
      const allPokemon = response.data.results;
      
      // Filter for mega evolutions
      const megaForms = allPokemon.filter(p => {
        const name = p.name.toLowerCase();
        return name.includes('mega') && !name.includes('meganium') && !name.includes('yanmega');
      });
      
      console.log(`Found ${megaForms.length} mega forms from PokeAPI`);
      
      // Fetch detailed data for each mega form
      const megaList = await Promise.all(
        megaForms.map(async (form) => {
          try {
            const detailResponse = await axios.get(form.url);
            const data = detailResponse.data;
            
            return {
              id: data.id,
              name: data.name,
              img: data.sprites?.front_default || data.sprites?.other?.['official-artwork']?.front_default || '',
              types: data.types?.map(t => t.type.name) || [],
              abilities: data.abilities?.map(a => a.ability.name) || [],
              moves: data.moves?.map(m => m.move.name) || [],
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
      
      // Filter out any failed fetches
      const validMega = megaList.filter(p => p !== null);
      
      // Add to pokemon list, avoiding duplicates
      setPokemonList(prev => {
        const existingNames = new Set(prev.map(p => p.name.toLowerCase()));
        const newPokemon = validMega.filter(p => !existingNames.has(p.name.toLowerCase()));
        console.log(`Adding ${newPokemon.length} new mega Pokemon (${validMega.length - newPokemon.length} were duplicates)`);
        return [...prev, ...newPokemon].sort((a, b) => a.id - b.id);
      });
      
      console.log(`Total mega Pokemon processed: ${validMega.length}`);
    } catch (err) {
      console.error('Failed to fetch Mega Pokemon:', err);
      alert('Failed to load Mega Pokemon. Please try again.');
    }
  };

  // Remove Mega Evolution Pokémon from the list
  const removeMegaPokemon = () => {
    setPokemonList(prev => prev.filter(p => !p.name.includes('-mega')));
  };

  // Fetch Gigantamax Pokémon from PokeAPI
  const fetchGmaxPokemon = async () => {
    try {
      // Fetch all Pokemon forms from PokeAPI
      const response = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=2000');
      const allPokemon = response.data.results;
      
      // Filter for gigantamax forms and eternamax
      const gmaxForms = allPokemon.filter(p => {
        const name = p.name.toLowerCase();
        return name.includes('gmax') || name.includes('eternamax');
      });
      
      console.log(`Found ${gmaxForms.length} gmax/eternamax forms from PokeAPI`);
      
      // Fetch detailed data for each gmax form
      const gmaxList = await Promise.all(
        gmaxForms.map(async (form) => {
          try {
            const detailResponse = await axios.get(form.url);
            const data = detailResponse.data;
            
            return {
              id: data.id,
              name: data.name,
              img: data.sprites?.front_default || data.sprites?.other?.['official-artwork']?.front_default || '',
              types: data.types?.map(t => t.type.name) || [],
              abilities: data.abilities?.map(a => a.ability.name) || [],
              moves: data.moves?.map(m => m.move.name) || [],
              generation: 8, // Gigantamax introduced in Gen 8
              legendary: false,
              paradox: false
            };
          } catch (err) {
            console.error(`Failed to fetch details for ${form.name}:`, err);
            return null;
          }
        })
      );
      
      // Filter out any failed fetches
      const validGmax = gmaxList.filter(p => p !== null);
      
      // Add to pokemon list, avoiding duplicates
      setPokemonList(prev => {
        const existingNames = new Set(prev.map(p => p.name.toLowerCase()));
        const newPokemon = validGmax.filter(p => !existingNames.has(p.name.toLowerCase()));
        console.log(`Adding ${newPokemon.length} new gmax Pokemon (${validGmax.length - newPokemon.length} were duplicates)`);
        return [...prev, ...newPokemon].sort((a, b) => a.id - b.id);
      });
      
      console.log(`Total gmax Pokemon processed: ${validGmax.length}`);
    } catch (err) {
      console.error('Failed to fetch Gigantamax Pokemon:', err);
      alert('Failed to load Gigantamax Pokemon. Please try again.');
    }
  };

  // Remove Gigantamax Pokémon from the list
  const removeGmaxPokemon = () => {
    setPokemonList(prev => prev.filter(p => !p.name.includes('-gmax') && !p.name.includes('eternamax')));
  };

  // Ban all legendaries visible in the current pokemonList (host-only)
  const banAllLegendaries = () => {
    if (!socket || !lobbyCode) return;
    
    // Use legendary field from pokemon_data.json (already loaded)
    const legendaryPokemon = pokemonList.filter(p => p.legendary);
    
    if (!legendaryPokemon || legendaryPokemon.length === 0) {
      alert('No legendary Pokémon found to ban. Make sure to do a hard refresh (Ctrl+Shift+R) to reload pokemon_data.json');
      return;
    }
    
    
    const pm = {};
    for (const p of legendaryPokemon) {
      pm[p.name.toLowerCase()] = 0;
    }
    
    socket.emit('import_points', { code: lobbyCode, pointsMap: pm }, (resp) => {
      if (!resp || !resp.ok) {
        alert(resp && resp.error ? resp.error : 'Failed to ban legendaries');
      } else {
        setPointsMap(normalizePointsMap(resp.pointsMap || {}));
      }
    });
  };

  // Ban all Paradox Pokémon visible in the current pokemonList (host-only)
  const banAllParadox = () => {
    if (!socket || !lobbyCode) return;
    const paradoxPokemon = pokemonList.filter(p => p.paradox);
    if (!paradoxPokemon || paradoxPokemon.length === 0) {
      alert('No Paradox Pokémon found to ban. Make sure to do a hard refresh (Ctrl+Shift+R) to reload pokemon_data.json');
      return;
    }
    const pm = {};
    for (const p of paradoxPokemon) pm[p.name.toLowerCase()] = 0;
    socket.emit('import_points', { code: lobbyCode, pointsMap: pm }, (resp) => {
      if (!resp || !resp.ok) {
        alert(resp && resp.error ? resp.error : 'Failed to ban Paradox Pokémon');
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
    s.on('lobby_update', (data) => {
      // When rejoined from MongoDB, preserve participant list and only update connection status
      if (data && data.users) {
        setLobbyUsers(prev => {
          // If we have no users yet, just use the socket data
          if (prev.length === 0) {
            return data.users;
          }
          
          // If we have users with mongo- IDs, we're in MongoDB mode - preserve all participants
          const hasMongoUsers = prev.some(u => u.id && u.id.toString().startsWith('mongo-'));
          
          if (hasMongoUsers) {
            // Keep all existing users, just update connection status based on socket data
            return prev.map(user => {
              const socketUser = data.users.find(su => su.name === user.name);
              if (socketUser) {
                // User is connected via socket - use their socket.id and mark connected
                return {
                  ...user,
                  id: socketUser.id,
                  isConnected: true
                };
              }
              // User not in socket - keep their mongo ID and mark disconnected
              return {
                ...user,
                isConnected: false
              };
            });
          }
          
          // Normal socket-only mode - just replace
          return data.users;
        });
      }
      if (data && data.code) setLobbyCode(data.code);
      if (data && data.host) setHostId(data.host);
      if (data && data.leagueCode !== undefined) setLobbyLeagueCode(data.leagueCode || '');
      if (data && data.lobbyName !== undefined) setLobbyName(data.lobbyName || '');
      if (data && data.settings) {
        setLobbySettings(data.settings);
        // Immediately cache settings to localStorage for draft_complete fallback
        if (data.code) {
          try {
            localStorage.setItem('draftSettings_' + data.code, JSON.stringify(data.settings));
          } catch (err) {
            console.warn('Failed to cache settings from lobby_update:', err);
          }
        }
      }
      if (data && data.banList) setBanList(Array.isArray(data.banList) ? data.banList : []);
      if (data && data.pointsMap) setPointsMap(normalizePointsMap(data.pointsMap || {}));
      if (data && data.pointsRemaining) setPointsRemaining(data.pointsRemaining || {});
      if (data && data.tradesCompleted) setTradesCompleted(data.tradesCompleted || {});
      if (data && data.playersFinishedTrading) setPlayersFinishedTrading(data.playersFinishedTrading || []);
      if (data && data.selections) {
        setRemoteSelections(data.selections || {});
        // remove selected pokemons from our visible list
        const allSelectedIds = Object.values(data.selections).flat().map(p => p.id).filter(Boolean);
        setPokemonList((prev) => prev.filter(p => !allSelectedIds.includes(p.id)));
      }
      if (data && data.currentTurn) {
        setCurrentTurn(data.currentTurn);
        // If timer is enabled but server doesn't send currentTurnStartTime, set it client-side
        if (lobbySettings.timerEnabled && !data.currentTurnStartTime) {
          setCurrentTurnStartTime(new Date().toISOString());
        }
      }
      if (data && data.currentTurnStartTime) setCurrentTurnStartTime(data.currentTurnStartTime);
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
        
        // Save ongoing draft with current lobby settings (for ALL players)
        try {
          const currentSettings = lobbySettingsRef.current;
          addOngoingDraftToCookies(data.code, [], {
            settings: currentSettings,
            draftOrder: data.draftOrder,
            currentTurn: null,
            pointsRemaining: {},
            pointsMap: data.pointsMap
          });
        } catch (err) {
          console.warn('Failed to save draft on start:', err);
        }
        
        // If host, cache current settings for draft_complete fallback
        if (s && s.id === hostIdRef.current) {
          try {
            const settingsCache = {
              allowTrading: lobbySettings.allowTrading,
              maxTradeLimit: lobbySettings.maxTradeLimit,
              unlimitedTrades: lobbySettings.unlimitedTrades,
              lobbyCode: data.code,
              hostSocketId: s.id
            };
            localStorage.setItem('hostDraftSettings_' + data.code, JSON.stringify(settingsCache));
          } catch (err) {
            console.warn('Failed to cache host settings:', err);
          }
        }
        // compute allowed pokemon based on lobby gen filter and other visible filters
        const gen = lobbyGenFilter || 0;
        const allowed = pokemonList.filter((p) => {
          if (gen > 0 && p.id > genLimits[gen]) return false;
          const name = p.name.toLowerCase();
          if (hideLegendaries && p.legendary) return false;
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
        setPokemonList((prev) => prev.filter(p => Number(p.id) !== Number(data.pokemon.id)));
        setDraftPokemonList((prev) => prev.filter(p => Number(p.id) !== Number(data.pokemon.id)));
      }
    });
    s.on('selections_update', (data) => {
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
          // (only if it's not already there)
          setPokemonList((prev) => {
            if (prev.some(p => Number(p.id) === Number(pk.id))) return prev;
            return [...prev, pk];
          });
          setDraftPokemonList((prev) => {
            if (prev.some(p => Number(p.id) === Number(pk.id))) return prev;
            return [...prev, pk];
          });
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
      setDraftComplete(true);
      setFinalTeams(data);
      
      // Update lobby settings if provided by server
      if (data.settings) {
        setLobbySettings(data.settings);
      }
      if (data.leagueCode !== undefined) {
        setLobbyLeagueCode(data.leagueCode || '');
      }
      
      // Determine trading status: server > cached host settings > local state
      let tradingEnabled = data.settings?.allowTrading ?? lobbySettings.allowTrading;
      
      // Try to get settings from saved ongoing draft first, or from lobby cache
      let savedDraftSettings = null;
      try {
        const code = lobbyCodeRef.current;
        if (code) {
          // Try ongoing draft first
          const ongoingDrafts = readOngoingDraftsFromCookies();
          const draft = ongoingDrafts.find(d => (d.lobbyCode || d.code) === code);
          if (draft && draft.lobbySettings) {
            savedDraftSettings = draft.lobbySettings;
          }
          
          // If no trading settings in draft, try direct cache from lobby_update
          if (!savedDraftSettings || savedDraftSettings.allowTrading === undefined) {
            const cachedStr = localStorage.getItem('draftSettings_' + code);
            if (cachedStr) {
              const cachedSettings = JSON.parse(cachedStr);
              // Merge with draft settings if they exist
              savedDraftSettings = savedDraftSettings 
                ? { ...savedDraftSettings, ...cachedSettings }
                : cachedSettings;
            }
          }
          
          if (savedDraftSettings) {
            tradingEnabled = savedDraftSettings.allowTrading || false;
            // Update local state
            setLobbySettings(prev => ({
              ...prev,
              allowTrading: savedDraftSettings.allowTrading,
              maxTradeLimit: savedDraftSettings.maxTradeLimit,
              unlimitedTrades: savedDraftSettings.unlimitedTrades
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to read saved draft settings:', err);
      }
      
      // If host and we have trading enabled, broadcast to all players
      if (s && s.id === hostIdRef.current && tradingEnabled && savedDraftSettings) {
        const code = lobbyCodeRef.current;
        if (code) {
          s.emit('start_trading_phase', { code: code, settings: savedDraftSettings });
        }
      }
      
      
      if (tradingEnabled) {
        setTradingPhaseActive(true);
      } else {
      }
      // Team is already saved in ongoing draft, no need to auto-save separately
    });
    
    // Trading socket handlers
    s.on('trading_phase_start', (data) => {
      if (data && data.settings) {
        setLobbySettings(prev => ({
          ...prev,
          allowTrading: data.settings.allowTrading,
          maxTradeLimit: data.settings.maxTradeLimit,
          unlimitedTrades: data.settings.unlimitedTrades
        }));
        setTradingPhaseActive(true);
      }
    });
    
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
      
      // Reconstruct the Pokemon data from our local list
      if (data.updatedSelections && data.playerId && data.newPokemonName !== undefined) {
        const updatedSelections = { ...data.updatedSelections };
        
        // Try to find the new Pokemon from multiple sources
        // 1. Try pokemonList first
        let newPokemon = pokemonList.find(p => p.name === data.newPokemonName);
        
        // 2. If not found and we're in draft, try draftPokemonList
        if (!newPokemon && draftPokemonList && draftPokemonList.length > 0) {
          newPokemon = draftPokemonList.find(p => p.name === data.newPokemonName);
        }
        
        // 3. If still not found, try to find it in finalTeams selections (in case it was traded)
        if (!newPokemon && finalTeams?.selections) {
          for (const userId in finalTeams.selections) {
            const found = finalTeams.selections[userId].find(p => p && p.name === data.newPokemonName);
            if (found) {
              newPokemon = found;
              break;
            }
          }
        }
        
        if (newPokemon && updatedSelections[data.playerId]) {
          // Update the Pokemon at the correct index with full data
          if (data.pokemonIndex !== undefined) {
            updatedSelections[data.playerId][data.pokemonIndex] = {
              id: newPokemon.id,
              name: newPokemon.name,
              img: newPokemon.img,
              abilities: newPokemon.abilities,
              moves: newPokemon.moves,
              stats: newPokemon.stats
            };
          }
        } else {
          console.warn('Could not find Pokemon data for:', data.newPokemonName);
        }
        
        // Update final teams with reconstructed data
        setFinalTeams(prev => ({
          ...prev,
          selections: updatedSelections
        }));
      } else if (data.updatedSelections) {
        // Fallback: use server data as-is
        setFinalTeams(prev => ({
          ...prev,
          selections: data.updatedSelections
        }));
      }
      
      // Update trade count
      if (data.tradesCompleted) {
        setTradesCompleted(data.tradesCompleted);
      }
      setShowUnpickedModal(null);
      setUnpickedSearchQuery('');
    });
    
    return () => {
      s.disconnect();
    };
  }, []);

  // Handle browser close/refresh - auto-save draft and notify server
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // If in an active draft, save to localStorage
      if (view === 'draft' && lobbyCode) {
        try {
          const otherNames = (lobbyUsers || []).filter(u => u.id !== (socket && socket.id)).map(u => u.name);
          addOngoingDraftToCookies(lobbyCode, otherNames, { 
            settings: lobbySettings, 
            draftOrder: lobbyDraftOrder, 
            currentTurn, 
            pointsRemaining,
            pointsMap 
          });
        } catch (err) {
          console.error('Error auto-saving draft on unload:', err);
        }
        
        // Notify server that user is disconnecting
        if (socket && lobbyCode) {
          // Use sendBeacon for more reliable delivery during page unload
          const apiUrl = process.env.REACT_APP_API_URL || 
            (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
          
          try {
            // Send connection status update via beacon (more reliable than socket during unload)
            const currentUsername = PokemonName?.trim();
            if (currentUsername) {
              navigator.sendBeacon(
                `${apiUrl}/api/drafts/${lobbyCode}/connection-status`,
                JSON.stringify({ username: currentUsername, isConnected: false })
              );
            }
          } catch (err) {
            console.warn('Failed to send disconnect beacon:', err);
          }
          
          // Also try socket emit as fallback
          socket.emit('leave_lobby', { code: lobbyCode });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [view, lobbyCode, lobbyUsers, socket, PokemonName, lobbySettings, lobbyDraftOrder, currentTurn, pointsRemaining, pointsMap]);

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

  // Memoize whether cards should be disabled (prevents recalculating on every render)
  const areCardsDisabled = useMemo(() => {
    if (view !== 'draft') return false;
    if (currentTurn && socket && socket.id !== currentTurn) return true;
    if (socket && socket.id === currentTurn && localTeamForRender.length >= (lobbySettings.teamSizeLimit || 10)) return true;
    return false;
  }, [view, currentTurn, socket, localTeamForRender.length, lobbySettings.teamSizeLimit]);

  // Use callback to avoid recreating the handler on every render
  const handlePokemonCardClick = useCallback((pokemonId, pokemon) => {
    if (areCardsDisabled) return;
    setPendingDraftSelection({ id: pokemonId, pokemon });
  }, [areCardsDisabled]);

  // Memoize ordered players list to avoid recalculating on every render
  const orderedPlayers = useMemo(() => {
    if (lobbyDraftOrder && lobbyDraftOrder.length > 0) {
      return lobbyDraftOrder.map((id) => lobbyUsers.find(u => u.id === id)).filter(Boolean);
    }
    return lobbyUsers;
  }, [lobbyDraftOrder, lobbyUsers]);

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
                  {user ? (
                    <>
                      <span style={{ marginRight: '10px' }}>Logged in as: <strong>{user.username}</strong></span>
                      <button className="gen-button" onClick={logout}>Logout</button>
                    </>
                  ) : (
                    <button className="gen-button" onClick={() => setShowAuthModal(true)}>Login</button>
                  )}
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
                  <button className="nav-button" onClick={() => {
                    setView('teambuilder');
                    setShowTeamSelector(true);
                  }}>Team Builder</button>
                  <button className="nav-button ml-8" onClick={async () => {
                    const currentUsername = PokemonName?.trim();
                    if (!currentUsername) {
                      alert('Please log in or enter a username first');
                      return;
                    }
                    setDraftSearchQuery(''); // Clear search when opening
                    const drafts = await fetchOngoingDraftsFromAPI(currentUsername);
                    setOngoingDrafts(drafts);
                    setView('ongoingdrafts');
                  }}>Ongoing Drafts</button>
                  <button className="nav-button ml-8" onClick={() => {
                    setView('leagues');
                  }}>Leagues</button>
                </div>
              </div>
            )}
          {lobbyCode ? (
            <div className="LobbyBox">
              <div className="LobbyHeader">
                <div className="LobbyHeaderRow">
                  <div className="LobbyCodeSection">
                    {socket && hostId && socket.id === hostId && (
                      <div style={{ display: 'flex', alignItems: 'center', marginRight: '16px' }}>
                        <label className="label-small" style={{ marginRight: '8px', whiteSpace: 'nowrap' }}>Lobby Name:</label>
                        <input 
                          type="text" 
                          defaultValue={lobbyName} 
                          onBlur={(e) => {
                            const newName = e.target.value;
                            setLobbyName(newName);
                            if (socket && lobbyCode) {
                              socket.emit('update_lobby_name', { code: lobbyCode, lobbyName: newName }, (resp) => {
                                if (!resp || !resp.ok) {
                                  console.warn('Failed to update lobby name:', resp?.error);
                                }
                              });
                            }
                          }}
                          placeholder="Enter a name..." 
                          style={{ padding: '4px 8px', width: '180px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                    )}
                    <strong>Lobby Code:</strong>
                    <span className="LobbyCode">{lobbyCode}</span>
                    <button className="gen-button ml-8" onClick={copyLobbyCode}>Copy</button>
                    <span className="ml-8" style={{ color: '#666', fontSize: '14px' }}>| League Code:</span>
                    <span className="LobbyCode" style={{ fontSize: '14px' }}>{lobbyLeagueCode || 'None'}</span>
                    {socket && hostId && socket.id === hostId && (
                      <>
                        <button className="start-draft-button ml-8" onClick={startDraft}>Start Draft</button>
                        <button className="export-button ml-8" onClick={() => exportPoints()}>Export Settings</button>
                        <input id="points-import-input" type="file" accept=".txt,.json,text/plain" className="hidden-file-input" onChange={(e) => { if (e.target.files && e.target.files[0]) handleImportPointsFile(e.target.files[0]); e.target.value = ''; }} />
                        <button className="import-button ml-8" onClick={() => document.getElementById('points-import-input').click()}>Import Settings</button>
                      </>
                    )}
                    {exportMessage && (<span className="copy-confirm ml-8">{exportMessage}</span>)}
                  </div>
                  <div>
                    <button className="toggle-button btn-mr8" onClick={leaveLobby}>Leave</button>
                  </div>
                </div>
              </div>

              <div className="LobbyMainRow">
                <div className="PlayersPanel">
                  <div className="panel-card">
                    <div className="panel-header">
                      <strong>Players ({lobbyUsers.length})</strong>
                      <span className="panel-meta">Max: 12</span>
                    </div>
                    <ul className="PlayerList">
                    {lobbyUsers.map((u) => (
                      <li key={u.id} className="player-list-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span 
                            className="connection-dot" 
                            style={{ 
                              width: '8px', 
                              height: '8px', 
                              borderRadius: '50%', 
                              backgroundColor: u.isConnected ? '#10b981' : '#6b7280',
                              flexShrink: 0
                            }}
                            title={u.isConnected ? 'Connected' : 'Disconnected'}
                          />
                          <strong>{u.name}</strong>
                        </div>
                        <span className="player-points">Points: {pointsRemaining && pointsRemaining[u.id] != null ? pointsRemaining[u.id] : lobbySettings.pointsLimit}</span>
                      </li>
                    ))}
                  </ul>
                  </div>
                </div>

                <div className="SettingsAndPointsContainer">
                  {/* Lobby Settings - Card-based grid layout */}
                  <div className="SettingsPanel">
                    <div className="LobbySettingsTitle"><strong>Lobby Settings</strong></div>
                    {socket && hostId && socket.id === hostId ? (
                    // Host view with controls
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                      {/* Column 1: Points & Team Size */}
                      <div className="settings-card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="row">
                          <div className="col-1">
                            <label className="label-small">Points Limit</label>
                            <input type="number" defaultValue={lobbySettings.pointsLimit} onBlur={(e) => {
                                const newLimit = Number(e.target.value);
                                if (newLimit === lobbySettings.pointsLimit) return;
                                setLobbySettings((s) => ({...s, pointsLimit: newLimit}));
                                if (socket && lobbyCode && socket.id === hostId) {
                                  socket.emit('update_settings', { code: lobbyCode, settings: { pointsLimit: newLimit, genFilter: lobbyGenFilter, teamSizeLimit: lobbySettings.teamSizeLimit } }, (resp) => {
                                    if (!resp || !resp.ok) {
                                      alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                      e.target.value = lobbySettings.pointsLimit;
                                    }
                                  });
                                }
                              }} className="input-full" />
                          </div>
                        </div>
                        
                        <div className="row" style={{ marginTop: '10px' }}>
                          <div className="col-1">
                            <label className="label-small">Team Size Limit</label>
                            <input type="number" min={1} max={60} defaultValue={lobbySettings.teamSizeLimit} onBlur={(e) => {
                                const newSize = Math.max(1, Math.min(60, Number(e.target.value) || 0));
                                if (newSize === lobbySettings.teamSizeLimit) return;
                                setLobbySettings((s) => ({...s, teamSizeLimit: newSize}));
                                if (socket && lobbyCode && socket.id === hostId) {
                                  socket.emit('update_settings', { code: lobbyCode, settings: { teamSizeLimit: newSize, pointsLimit: lobbySettings.pointsLimit, genFilter: lobbyGenFilter } }, (resp) => {
                                    if (!resp || !resp.ok) {
                                      alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                      e.target.value = lobbySettings.teamSizeLimit;
                                    }
                                  });
                                }
                              }} className="input-full" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Column 2: Generation Filter & Load Preset */}
                      <div className="settings-card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="row">
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
                        </div>
                        
                        <div className="row" style={{ marginTop: '10px' }}>
                          <div className="col-1">
                            <label className="label-small">Load Preset</label>
                            <select value={selectedPreset} onChange={(e) => {
                                const presetId = e.target.value;
                                setSelectedPreset(presetId);
                                
                                if (presetId && socket && lobbyCode && socket.id === hostId) {
                                  const preset = presetsList.find(p => p.id === presetId);
                                  if (preset) {
                                    setExportMessage(`Loading preset "${preset.name}"...`);
                                    
                                    // Apply preset settings including mega/gmax flags
                                    const newSettings = {
                                      pointsLimit: preset.pointsLimit,
                                      teamSizeLimit: preset.teamSizeLimit,
                                      genFilter: preset.generationFilter || 0,
                                      allowTrading: lobbySettings.allowTrading,
                                      maxTradeLimit: lobbySettings.maxTradeLimit,
                                      unlimitedTrades: lobbySettings.unlimitedTrades,
                                      allowMega: preset.allowMega || false,
                                      allowGmax: preset.allowGmax || false
                                    };
                                    
                                    setLobbySettings(s => ({
                                      ...s,
                                      pointsLimit: preset.pointsLimit,
                                      teamSizeLimit: preset.teamSizeLimit,
                                      allowMega: preset.allowMega || false,
                                      allowGmax: preset.allowGmax || false
                                    }));
                                    
                                    // Load mega/gmax Pokemon if needed
                                    if (preset.allowMega) {
                                      fetchMegaPokemon();
                                    } else {
                                      removeMegaPokemon();
                                    }
                                    if (preset.allowGmax) {
                                      fetchGmaxPokemon();
                                    } else {
                                      removeGmaxPokemon();
                                    }
                                    
                                    if (preset.generationFilter) {
                                      setLobbyGenFilter(preset.generationFilter);
                                    }
                                    
                                    // Send preset ID to server - server handles all the heavy lifting
                                    socket.emit('load_preset', { 
                                      code: lobbyCode, 
                                      presetId: preset.id 
                                    }, (resp) => {
                                      if (resp && resp.ok) {
                                        // Update local state with server response
                                        if (resp.settings) {
                                          setLobbySettings(s => ({
                                            ...s,
                                            pointsLimit: resp.settings.pointsLimit,
                                            teamSizeLimit: resp.settings.teamSizeLimit
                                          }));
                                          if (resp.settings.genFilter) {
                                            setLobbyGenFilter(resp.settings.genFilter);
                                          }
                                        }
                                        setExportMessage(`Preset "${preset.name}" loaded successfully!`);
                                        setTimeout(() => setExportMessage(''), 3000);
                                      } else {
                                        setExportMessage(resp?.error || 'Failed to load preset');
                                        setTimeout(() => setExportMessage(''), 3000);
                                      }
                                    });
                                  }
                                }
                              }} className="input-full">
                              <option value="">-- Select Preset --</option>
                              {presetsList.map(preset => (
                                <option key={preset.id} value={preset.id}>{preset.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      {/* Column 3: Ban Buttons */}
                      <div className="settings-card">
                        <label className="label-small" style={{ marginBottom: '6px', display: 'block' }}>Quick Ban Actions</label>
                        <button className="gen-button ban-legendaries-button" style={{ width: '100%', marginBottom: '6px' }} onClick={() => { if (socket && socket.id === hostId) banAllLegendaries(); }}>Ban Legendaries</button>
                        <button className="gen-button ban-legendaries-button" style={{ width: '100%', marginBottom: '6px' }} onClick={() => { if (socket && socket.id === hostId) banAllParadox(); }}>Ban Paradox</button>
                        <button className="gen-button unban-all-button" style={{ width: '100%' }} onClick={() => { if (socket && socket.id === hostId) unbanAll(); }}>Unban All</button>
                      </div>
                      
                      {/* Column 4: Trading & Timer */}
                      <div className="settings-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <input 
                            type="checkbox" 
                            id="allow-trading"
                            checked={lobbySettings.allowTrading} 
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              // Set default trade limit to 1 when enabling trading
                              const updatedSettings = {
                                ...lobbySettings,
                                allowTrading: newValue,
                                maxTradeLimit: newValue && lobbySettings.maxTradeLimit === 0 ? 1 : lobbySettings.maxTradeLimit
                              };
                              setLobbySettings(updatedSettings);
                              if (socket && lobbyCode && socket.id === hostId) {
                                socket.emit('update_settings', { code: lobbyCode, settings: { ...updatedSettings, genFilter: lobbyGenFilter } }, (resp) => {
                                  if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                });
                                // Cache updated settings for draft_complete fallback
                                try {
                                  const cacheKey = 'hostDraftSettings_' + lobbyCode;
                                  const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
                                  cached.allowTrading = newValue;
                                  cached.maxTradeLimit = updatedSettings.maxTradeLimit;
                                  cached.lobbyCode = lobbyCode;
                                  cached.hostSocketId = socket.id;
                                  localStorage.setItem(cacheKey, JSON.stringify(cached));
                                } catch (err) {
                                  console.warn('Failed to cache setting update:', err);
                                }
                              }
                            }}
                          />
                          <label htmlFor="allow-trading" className="label-small" style={{ cursor: 'pointer' }}>Allow Trading</label>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          <input 
                            type="checkbox" 
                            id="timer-enabled"
                            checked={lobbySettings.timerEnabled} 
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              const updatedSettings = {
                                ...lobbySettings,
                                timerEnabled: newValue
                              };
                              setLobbySettings(updatedSettings);
                              if (socket && lobbyCode && socket.id === hostId) {
                                socket.emit('update_settings', { code: lobbyCode, settings: { ...updatedSettings, genFilter: lobbyGenFilter } }, (resp) => {
                                  if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                });
                              }
                            }}
                          />
                          <label htmlFor="timer-enabled" className="label-small" style={{ cursor: 'pointer' }}>Enable Draft Timer</label>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          <input 
                            type="checkbox" 
                            id="allow-mega"
                            checked={lobbySettings.allowMega} 
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setLobbySettings((s) => ({...s, allowMega: newValue}));
                              if (newValue) {
                                fetchMegaPokemon();
                              } else {
                                removeMegaPokemon();
                              }
                              if (socket && lobbyCode && socket.id === hostId) {
                                socket.emit('update_settings', { code: lobbyCode, settings: { ...lobbySettings, allowMega: newValue, genFilter: lobbyGenFilter } }, (resp) => {
                                  if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                });
                              }
                            }}
                          />
                          <label htmlFor="allow-mega" className="label-small" style={{ cursor: 'pointer' }}>Allow Mega</label>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          <input 
                            type="checkbox" 
                            id="allow-gmax"
                            checked={lobbySettings.allowGmax} 
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setLobbySettings((s) => ({...s, allowGmax: newValue}));
                              if (newValue) {
                                fetchGmaxPokemon();
                              } else {
                                removeGmaxPokemon();
                              }
                              if (socket && lobbyCode && socket.id === hostId) {
                                socket.emit('update_settings', { code: lobbyCode, settings: { ...lobbySettings, allowGmax: newValue, genFilter: lobbyGenFilter } }, (resp) => {
                                  if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                });
                              }
                            }}
                          />
                          <label htmlFor="allow-gmax" className="label-small" style={{ cursor: 'pointer' }}>Allow Gmax</label>
                        </div>
                      </div>
                      
                      {/* Conditional sections that span full width */}
                      {lobbySettings.allowTrading && (
                        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <div className="row" style={{ flex: '1 1 200px' }}>
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
                                      // Cache updated settings
                                      try {
                                        const cacheKey = 'hostDraftSettings_' + lobbyCode;
                                        const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
                                        cached.maxTradeLimit = newLimit;
                                        cached.lobbyCode = lobbyCode;
                                        cached.hostSocketId = socket.id;
                                        localStorage.setItem(cacheKey, JSON.stringify(cached));
                                      } catch (err) {
                                        console.warn('Failed to cache setting update:', err);
                                      }
                                    }
                                  }} 
                                  className="input-full"
                                  disabled={lobbySettings.unlimitedTrades}
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 200px' }}>
                              <input 
                                type="checkbox" 
                                id="unlimited-trades"
                                checked={lobbySettings.unlimitedTrades} 
                                onChange={(e) => {
                                  const newValue = e.target.checked;
                                  setLobbySettings((s) => ({...s, unlimitedTrades: newValue}));
                                  if (socket && lobbyCode && socket.id === hostId) {
                                    socket.emit('update_settings', { code: lobbyCode, settings: { ...lobbySettings, unlimitedTrades: newValue, genFilter: lobbyGenFilter } }, (resp) => {
                                      // Cache updated settings
                                      try {
                                        const cacheKey = 'hostDraftSettings_' + lobbyCode;
                                        const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
                                        cached.unlimitedTrades = newValue;
                                        cached.lobbyCode = lobbyCode;
                                        cached.hostSocketId = socket.id;
                                        localStorage.setItem(cacheKey, JSON.stringify(cached));
                                      } catch (err) {
                                        console.warn('Failed to cache setting update:', err);
                                      }
                                      if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                    });
                                  }
                                }}
                              />
                              <label htmlFor="unlimited-trades" className="label-small" style={{ cursor: 'pointer' }}>Allow Unlimited Trades</label>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {lobbySettings.timerEnabled && (
                        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <div className="row" style={{ flex: '1 1 200px' }}>
                              <div className="col-1">
                                <label className="label-small">1st Round Timer (format: H:MM or :MM)</label>
                                <input 
                                  type="text" 
                                  defaultValue={formatTimerMinutes(lobbySettings.firstRoundTimer)}
                                  placeholder="8:00 (8 hours)"
                                  onBlur={(e) => {
                                    const minutes = parseTimerInput(e.target.value);
                                    if (minutes !== null) {
                                      setLobbySettings((s) => ({...s, firstRoundTimer: minutes}));
                                      if (socket && lobbyCode && socket.id === hostId) {
                                        socket.emit('update_settings', { code: lobbyCode, settings: { ...lobbySettings, firstRoundTimer: minutes, genFilter: lobbyGenFilter } }, (resp) => {
                                          if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                        });
                                      }
                                    } else {
                                      // Reset to current value if invalid
                                      e.target.value = formatTimerMinutes(lobbySettings.firstRoundTimer);
                                    }
                                  }}
                                  className="input-full" 
                                />
                              </div>
                            </div>
                            <div className="row" style={{ flex: '1 1 200px' }}>
                              <div className="col-1">
                                <label className="label-small">Subsequent Rounds Timer (format: H:MM or :MM)</label>
                                <input 
                                  type="text" 
                                  defaultValue={formatTimerMinutes(lobbySettings.subsequentRoundTimer)}
                                  placeholder="8:00 (8 hours)"
                                  onBlur={(e) => {
                                    const minutes = parseTimerInput(e.target.value);
                                    if (minutes !== null) {
                                      setLobbySettings((s) => ({...s, subsequentRoundTimer: minutes}));
                                      if (socket && lobbyCode && socket.id === hostId) {
                                        socket.emit('update_settings', { code: lobbyCode, settings: { ...lobbySettings, subsequentRoundTimer: minutes, genFilter: lobbyGenFilter } }, (resp) => {
                                          if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to update settings');
                                        });
                                      }
                                    } else {
                                      // Reset to current value if invalid
                                      e.target.value = formatTimerMinutes(lobbySettings.subsequentRoundTimer);
                                    }
                                  }}
                                  className="input-full" 
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Non-host read-only view: show settings summary
                    <div>
                      <div className="row">
                            <div className="col-1"><div className="fs-12">Points Limit: <strong>{lobbySettings.pointsLimit}</strong></div></div>
                          </div>
                    </div>
                  )}
                </div>

                {/* Points Table - Always Visible */}
                <div className="points-section-full-width">
                  <div className="panel-card">
                    <div className="panel-header"><strong>Points Table</strong></div>
                  
                  {/* Points Assignment Controls - Host Only */}
                  {socket && hostId && socket.id === hostId && (
                    <>
                      {/* Multi-select Search and Controls */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input 
                            className="points-search-input" 
                            placeholder="Search & select Pokémon..." 
                            value={pointsSearchName} 
                            onChange={(e) => { 
                              setPointsSearchName(e.target.value.toLowerCase()); 
                              setSuggestionsVisible(true); 
                            }} 
                            style={{ width: '100%' }}
                          />
                          {suggestionsVisible && pointsSearchName && (
                            <div className="points-suggestions suggestions-dropdown">
                              {pointsSearchSuggestions.map(p => (
                                <div 
                                  key={p.id} 
                                  className="suggestion-item" 
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', cursor: 'pointer' }} 
                                  onClick={() => {
                                    // Add to selected Pokemon list if not already there
                                    if (!selectedPokemonForPoints.find(sp => sp.id === p.id)) {
                                      setSelectedPokemonForPoints([...selectedPokemonForPoints, p]);
                                    }
                                    setPointsSearchName('');
                                    setSuggestionsVisible(false);
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                                >
                                  {p.img ? <img src={p.img} alt={p.name} style={{ width: '32px', height: '32px' }} /> : <div style={{ width: '32px', height: '32px', backgroundColor: '#e5e7eb' }} />}
                                  <span>{p.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <select 
                          className="points-select" 
                          value={pointsValueSelected} 
                          onChange={(e) => setPointsValueSelected(Number(e.target.value))}
                          style={{ width: '100px' }}
                        >
                          <option key={0} value={0}>Banned</option>
                          {Array.from({length:30}, (_,i) => i+1).map(n => <option key={n} value={n}>{n} pts</option>)}
                        </select>
                        <button 
                          className="set-button" 
                          onClick={() => {
                            if (selectedPokemonForPoints.length === 0) return alert('Select Pokémon first');
                            
                            // Apply points to all selected Pokemon
                            const promises = selectedPokemonForPoints.map(p => {
                              return new Promise((resolve) => {
                                socket.emit('set_points', { code: lobbyCode, name: p.name, value: pointsValueSelected }, (resp) => {
                                  resolve(resp);
                                });
                              });
                            });

                            Promise.all(promises).then((responses) => {
                              const failed = responses.filter(r => !r || !r.ok);
                              if (failed.length > 0) {
                                alert(`Failed to set points for ${failed.length} Pokémon`);
                              } else {
                                // Get the latest pointsMap from the last response
                                const lastResp = responses[responses.length - 1];
                                if (lastResp && lastResp.pointsMap) {
                                  setPointsMap(normalizePointsMap(lastResp.pointsMap));
                                }
                                setSelectedPokemonForPoints([]);
                              }
                            });
                          }}
                          style={{ whiteSpace: 'nowrap', padding: '8px 16px' }}
                        >
                          Set Points
                        </button>
                      </div>

                      {/* Display selected Pokemon as removable chips */}
                      {selectedPokemonForPoints.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}>
                          <div style={{ width: '100%', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            <strong>Selected ({selectedPokemonForPoints.length}):</strong>
                          </div>
                          {selectedPokemonForPoints.map(p => (
                            <div 
                              key={p.id} 
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#e0e7ff',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                border: '1px solid #c7d2fe'
                              }}
                            >
                              {p.img ? <img src={p.img} alt={p.name} style={{ width: '20px', height: '20px' }} /> : <div style={{ width: '20px', height: '20px', backgroundColor: '#e5e7eb', display: 'inline-block' }} />}
                              <span>{p.name}</span>
                              <button 
                                onClick={() => setSelectedPokemonForPoints(selectedPokemonForPoints.filter(sp => sp.id !== p.id))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '18px',
                                  padding: 0,
                                  lineHeight: 1,
                                  color: '#6366f1',
                                  fontWeight: 'bold'
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => setSelectedPokemonForPoints([])}
                            style={{
                              padding: '6px 10px',
                              fontSize: '12px',
                              borderRadius: '4px',
                              border: '1px solid #d1d5db',
                              background: '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="PointsGrid">
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
                          
                          // Only allow host to drag and drop
                          if (!socket || !hostId || socket.id !== hostId) return;
                          
                          const pokemonName = e.dataTransfer.getData('pokemon-name');
                          if (pokemonName) {
                            socket.emit('set_points', { code: lobbyCode, name: pokemonName, value: val }, (resp) => {
                              if (!resp || !resp.ok) {
                                alert(resp && resp.error ? resp.error : 'Failed to set points');
                              } else {
                                setPointsMap(normalizePointsMap(resp.pointsMap || {}));
                              }
                            });
                          }
                        }}
                      >
                        <div className="points-header">{val === 0 ? 'Banned' : `Points ${val}`}</div>
                        <div className="points-list">
                          {pokemonList.filter(p => {
                              const name = (p.name || '').toLowerCase();
                              const normalizedName = normalizePokemonName(name);
                              
                              // Check both naming conventions
                              const pm = pointsMap[p.name] ?? pointsMap[name] ?? pointsMap[normalizedName];
                              const pmNum = pm == null ? null : Number(pm);
                              if (val === 0) return pmNum === 0;
                              const effective = (pmNum == null) ? 1 : pmNum;
                              return effective === val;
                            }).filter(p => {
                              // For the Banned column (val === 0) always show banned entries
                              if (val === 0) return true;
                              
                              // Check if this is a mega/gmax form
                              const name = p.name.toLowerCase();
                              const isMega = name.includes('-mega');
                              const isGmax = name.includes('-gmax');
                              const shouldIgnoreGen = (isMega && lobbySettings.allowMega) || (isGmax && lobbySettings.allowGmax);
                              
                              // Apply generation filter unless it's a mega/gmax form with the setting enabled
                              const passesGenFilter = shouldIgnoreGen || lobbyGenFilter === 0 || p.generation <= lobbyGenFilter;
                              return passesGenFilter && (!hideLegendaries || !p.legendary);
                            }).map(p => (
                            <div 
                              key={p.id} 
                              className="points-item-row"
                              draggable={socket && hostId && socket.id === hostId}
                              onDragStart={(e) => {
                                if (socket && hostId && socket.id === hostId) {
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('pokemon-name', p.name);
                                  e.currentTarget.classList.add('dragging');
                                }
                              }}
                              onDragEnd={(e) => {
                                e.currentTarget.classList.remove('dragging');
                              }}
                              style={{ cursor: (socket && hostId && socket.id === hostId) ? 'grab' : 'default' }}
                            >
                              {p.img ? <img src={p.img} alt={p.name} className="points-sprite" /> : <div className="points-sprite" style={{ backgroundColor: '#e5e7eb' }} />}
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
            
            <div style={{ marginBottom: '20px' }}>
              <input 
                type="text" 
                placeholder="Search by lobby name, code, or player..." 
                value={draftSearchQuery}
                onChange={(e) => setDraftSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
              />
              <button 
                className="gen-button" 
                style={{ marginTop: '8px' }}
                onClick={async () => {
                  const currentUsername = PokemonName?.trim();
                  if (!currentUsername) {
                    alert('Please enter your username first');
                    return;
                  }
                  const drafts = await fetchOngoingDraftsFromAPI(currentUsername, draftSearchQuery);
                  setOngoingDrafts(drafts);
                }}
              >
                Search
              </button>
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
                    {d.status !== 'completed' && (
                      <button className="gen-button" onClick={async () => { 
                      const currentUsername = PokemonName?.trim();
                      if (!currentUsername) {
                        alert('Please enter your username first');
                        return;
                      }
                      
                      // Fetch latest draft data from MongoDB
                      const latestDraft = await fetchDraftByCode(code);
                      
                      if (!latestDraft) {
                        alert('Draft not found in database. It may have expired or been deleted.');
                        // Refresh the list
                        const drafts = await fetchOngoingDraftsFromAPI(currentUsername);
                        setOngoingDrafts(drafts);
                        return;
                      }
                      
                      // Rejoin directly by loading the draft state from MongoDB
                      await rejoinDraftFromMongo(code, latestDraft);
                    }}>Rejoin</button>
                    )}
                    <button className="gen-button ml-8" onClick={() => {
                      const currentUsername = PokemonName?.trim();
                      
                      // Toggle team visibility
                      if (viewedOngoingTeam && viewedOngoingTeam.lobbyCode === code) {
                        setViewedOngoingTeam(null);
                      } else {
                        if (d.playerData && d.playerData[currentUsername]) {
                          const team = d.playerData[currentUsername].selectedPokemon || [];
                          
                          setViewedOngoingTeam({
                            name: d.draftName || `Team Lobby#: ${code}`,
                            lobbyCode: code,
                            team: team
                          });
                        } else {
                          alert('No team found for your username in this draft');
                        }
                      }
                    }}>{viewedOngoingTeam && viewedOngoingTeam.lobbyCode === code ? 'Hide Team' : 'View Team'}</button>
                    <button className="gen-button warning ml-8" onClick={async () => {
                      const currentUsername = PokemonName?.trim();
                      if (!currentUsername) {
                        alert('Please enter your username first');
                        return;
                      }
                      
                      const confirmed = window.confirm(
                        `Leave draft "${d.draftName || code}"?\n\n` +
                        'WARNING: Leaving will permanently remove you from this draft. ' +
                        'You will NOT be able to rejoin, and your picks will be lost.\n\n' +
                        'Are you sure you want to leave?'
                      );
                      
                      if (!confirmed) return;
                      
                      try {
                        const socketUrl = process.env.REACT_APP_SOCKET_URL || 
                          (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
                        
                        const response = await axios.post(
                          `${socketUrl}/api/drafts/${encodeURIComponent(code)}/participant/${encodeURIComponent(currentUsername)}/leave`
                        );
                        
                        if (response.data.success) {
                          alert('Successfully left the draft');
                          // Refresh the list
                          const drafts = await fetchOngoingDraftsFromAPI(currentUsername, draftSearchQuery);
                          setOngoingDrafts(drafts);
                        }
                      } catch (error) {
                        console.error('Failed to leave draft:', error);
                        alert(error.response?.data?.error || 'Failed to leave draft');
                      }
                    }}>Leave Draft</button>
                    {d.hostUsername === PokemonName?.trim() && (
                      <button className="gen-button danger ml-8" onClick={async () => {
                        if (!window.confirm(`Delete draft "${d.draftName || code}"? This cannot be undone.`)) return;
                        
                        await deleteOngoingDraft(code);
                        // Refresh the list from API
                        const currentUsername = PokemonName?.trim();
                        if (currentUsername) {
                          const drafts = await fetchOngoingDraftsFromAPI(currentUsername, draftSearchQuery);
                          setOngoingDrafts(drafts);
                        }
                      }}>Delete</button>
                    )}
                  </div>
                  
                  {/* Show team inline within the draft card */}
                  {viewedOngoingTeam && viewedOngoingTeam.lobbyCode === code && (
                    <div className="viewed-ongoing-team" style={{ marginTop: '15px' }}>
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
                    </div>
                  )}
              </div>
            )})}
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
                <p style={{ textAlign: 'center', marginBottom: 10 }}>
                  Select 1 Pokémon from your team and 1 from another player's team to offer a trade.
                </p>
                
                {/* Trade Limit Tracker */}
                <div style={{ textAlign: 'center', marginBottom: 20, fontSize: '1.1em', fontWeight: 'bold' }}>
                  {lobbySettings.unlimitedTrades ? (
                    <span>Trades Allowed: <span style={{ color: '#ffd700' }}>Unlimited</span></span>
                  ) : (
                    <span>Your Trades: <span style={{ color: (tradesCompleted[socket?.id] || 0) >= lobbySettings.maxTradeLimit ? '#ef4444' : '#10b981' }}>{tradesCompleted[socket?.id] || 0}</span> / {lobbySettings.maxTradeLimit}</span>
                  )}
                </div>
                
                {/* Trade action buttons */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
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
                  <button className="export-button" onClick={async () => {
                    // Save draft team to database
                    const myTeam = finalTeams.selections[socket?.id] || [];
                    const defaultName = lobbyCode ? `${PokemonName}-${lobbyCode} team` : `${PokemonName}'s Draft Team`;
                    const teamName = prompt('Enter a name for this team:', defaultName);
                    if (!teamName) return;
                    
                    try {
                      // Check if a team with this name already exists
                      const socketUrl = process.env.REACT_APP_SOCKET_URL || 
                        (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
                      
                      const existingTeamsResponse = await axios.get(`${socketUrl}/api/teams?username=${encodeURIComponent(PokemonName)}`);
                      const existingTeams = existingTeamsResponse.data.teams || [];
                      const existingTeam = existingTeams.find(t => t.name === teamName);
                      
                      if (existingTeam) {
                        const overwrite = window.confirm(`A team named "${teamName}" already exists. Do you want to overwrite it?`);
                        if (!overwrite) return;
                      }
                      // Convert to team builder format for database
                      const teamBuilderSlots = Array(12).fill(null).map((_, idx) => {
                        if (idx < myTeam.length) {
                          const p = myTeam[idx];
                          
                          // Look up full pokemon data from the list to get complete abilities/moves
                          const fullPokemonData = (draftPokemonList.length > 0 ? draftPokemonList : pokemonList).find(pk => 
                            pk.id === p.id || pk.name.toLowerCase() === p.name.toLowerCase()
                          );
                          
                          // Ensure Pokemon has the correct structure for team builder
                          const pokemonForBuilder = {
                            id: p.id,
                            name: p.name,
                            img: p.img,
                            // Convert stats to baseStats if needed
                            baseStats: p.baseStats || (p.stats ? {
                              hp: p.stats.hp?.base_stat || p.stats.hp || 0,
                              attack: p.stats.attack?.base_stat || p.stats.attack || 0,
                              defense: p.stats.defense?.base_stat || p.stats.defense || 0,
                              specialAttack: p.stats['special-attack']?.base_stat || p.stats.specialAttack || p.stats['specialAttack'] || 0,
                              specialDefense: p.stats['special-defense']?.base_stat || p.stats.specialDefense || p.stats['specialDefense'] || 0,
                              speed: p.stats.speed?.base_stat || p.stats.speed || 0
                            } : {
                              hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0
                            }),
                            // Use full data if available, otherwise fall back to what we have
                            abilities: fullPokemonData?.abilities || p.abilities || [],
                            moves: fullPokemonData?.moves || p.moves || [],
                            types: fullPokemonData?.types || p.types || []
                          };
                          
                          return {
                            slotNumber: idx + 1,
                            pokemon: pokemonForBuilder,
                            ability: p.abilities?.[0] || '',
                            nature: 'Hardy',
                            heldItem: '',
                            teraType: '',
                            moves: ['', '', '', ''],
                            ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
                            evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
                          };
                        }
                        return null;
                      });
                      
                      // Prepare pokemon array for database (matching schema)
                      const pokemonForDB = myTeam.map(p => ({
                        name: p.name,
                        moves: p.moves || [],
                        ability: p.abilities?.[0] || '',
                        item: '',
                        nature: 'Hardy',
                        teraType: '',
                        evs: {
                          hp: 0,
                          attack: 0,
                          defense: 0,
                          specialAttack: 0,
                          specialDefense: 0,
                          speed: 0
                        },
                        ivs: {
                          hp: 31,
                          attack: 31,
                          defense: 31,
                          specialAttack: 31,
                          specialDefense: 31,
                          speed: 31
                        },
                        level: 50,
                        gender: '',
                        shiny: false
                      }));

                      const teamData = {
                        username: PokemonName,
                        name: teamName,
                        pokemon: pokemonForDB,
                        format: 'Draft',
                        description: `Draft team from ${lobbyCode || 'draft session'}`,
                        isPublic: false,
                        teamBuilderData: {
                          playerName: PokemonName,
                          slots: teamBuilderSlots
                        }
                      };
                      
                      // Only include userId if user is logged in
                      if (user?._id) {
                        teamData.userId = user._id;
                      }

                      // If overwriting, delete the old team first
                      if (existingTeam) {
                        await axios.delete(`${socketUrl}/api/teams/${existingTeam._id}`);
                      }

                      const response = await axios.post(`${socketUrl}/api/teams`, teamData);
                      
                      if (response.data.success) {
                        alert('Team saved to database!');
                        // Return to lobby
                        setDraftComplete(false);
                        setFinalTeams(null);
                        setTradingPhaseActive(false);
                        setView('lobby');
                      }
                    } catch (err) {
                      console.error('Failed to save team - Full error:', err);
                      console.error('Error response:', err.response?.data);
                      alert(err.response?.data?.error || 'Failed to save team');
                    }
                  }}>Save Team</button>
                  <button className="gen-button ml-8" onClick={async () => {
                    // Mark draft as completed in MongoDB
                    if (lobbyCode) {
                      try {
                        const socketUrl = process.env.REACT_APP_SOCKET_URL || 
                          (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
                        
                        await axios.patch(`${socketUrl}/api/drafts/${encodeURIComponent(lobbyCode)}/status`, {
                          status: 'completed'
                        });
                      } catch (error) {
                        console.error('Failed to mark draft as completed:', error);
                      }
                    }
                    
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
              {lobbySettings.timerEnabled && currentTurnStartTime && timeRemaining !== null && (
                <div className="timer-display" style={{ 
                  marginTop: '10px', 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: timeRemaining < 300 ? '#ff4444' : '#16a34a' 
                }}>
                  Time Remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </div>
              )}
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
                  {(filterTypes.length > 0 || filterGeneration > 0 || filterPointsMin || filterPointsMax || filterAbility || filterMoves.length > 0) && (
                    <>
                      <button 
                        className="gen-button ml-8" 
                        onClick={resetAllFilters}
                      >
                        Reset Filters
                      </button>
                      <span style={{ marginLeft: '12px', fontSize: '14px', color: '#666' }}>
                        {(() => {
                          const activeFilters = [];
                          if (filterTypes.length > 0) activeFilters.push(`${filterTypes.length} type(s)`);
                          if (filterGeneration > 0) activeFilters.push(`Gen ${filterGeneration}`);
                          if (filterPointsMin || filterPointsMax) activeFilters.push('Points range');
                          if (filterAbility) activeFilters.push('Ability');
                          if (filterMoves.length > 0) activeFilters.push(`${filterMoves.length} Move${filterMoves.length > 1 ? 's' : ''}`);
                          return `Active: ${activeFilters.join(', ')}`;
                        })()}
                      </span>
                    </>
                  )}
                </div>
                
                {/* Advanced Filters Panel */}
                {showAdvancedFilters && (
                  <div className="advanced-filters-panel">
                    {/* Type Filter */}
                    <div className="filter-section">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <label className="filter-label" style={{ margin: 0 }}>Types:</label>
                        {filterTypes.length > 1 && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={filterTypesInclusive}
                              onChange={(e) => setFilterTypesInclusive(e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span title={filterTypesInclusive ? 'Showing Pokémon with ANY selected type' : 'Showing Pokémon with ALL selected types'}>
                              {filterTypesInclusive ? 'OR' : 'AND'}
                            </span>
                          </label>
                        )}
                      </div>
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
                    <div className="filter-section" style={{ position: 'relative' }}>
                      <label className="filter-label">Ability:</label>
                      <input 
                        type="text" 
                        placeholder="Search by ability" 
                        value={filterAbility} 
                        onChange={(e) => {
                          setFilterAbility(e.target.value);
                          updateAbilitySuggestions(e.target.value);
                          if (!e.target.value.trim()) {
                            setPokemonWithAbility([]);
                          }
                        }}
                        onFocus={() => {
                          if (filterAbility) updateAbilitySuggestions(filterAbility);
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowAbilitySuggestions(false), 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && filterAbility.trim()) {
                            fetchPokemonWithAbility(filterAbility);
                            setShowAbilitySuggestions(false);
                          }
                        }}
                        className="filter-input"
                      />
                      {showAbilitySuggestions && abilitySuggestions.length > 0 && (
                        <div className="suggestions-dropdown" style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: 0, 
                          right: 0, 
                          zIndex: 1000, 
                          background: '#fff', 
                          border: '1px solid #ccc', 
                          maxHeight: '200px', 
                          overflowY: 'auto',
                          marginTop: '2px',
                          borderRadius: '4px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                          {abilitySuggestions.map((ability, idx) => (
                            <div 
                              key={idx}
                              className="suggestion-item" 
                              style={{ 
                                padding: '8px 12px', 
                                cursor: 'pointer',
                                borderBottom: idx < abilitySuggestions.length - 1 ? '1px solid #eee' : 'none'
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setFilterAbility(ability.displayName);
                                fetchPokemonWithAbility(ability.displayName);
                                setShowAbilitySuggestions(false);
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = '#f0f0f0';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = '#fff';
                              }}
                            >
                              {ability.displayName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Move Filter */}
                    <div className="filter-section" style={{ position: 'relative' }}>
                      <label className="filter-label">Moves:</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {/* Selected moves chips */}
                        {filterMoves.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                            {filterMoves.map((move, idx) => (
                              <div key={idx} style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                padding: '2px 8px',
                                background: '#1d8ca8',
                                color: 'white',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '500'
                              }}>
                                <span>{move}</span>
                                <button 
                                  onClick={() => setFilterMoves(filterMoves.filter(m => m !== move))}
                                  style={{ 
                                    background: 'none',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: 0,
                                    marginLeft: '2px',
                                    fontSize: '14px',
                                    lineHeight: 1,
                                    fontWeight: 'bold'
                                  }}
                                >×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <input 
                          type="text" 
                          placeholder="Add move to filter" 
                          value={filterMoveInput} 
                          onChange={(e) => {
                            setFilterMoveInput(e.target.value);
                            updateMoveSuggestions(e.target.value);
                          }}
                          onFocus={() => {
                            if (filterMoveInput) updateMoveSuggestions(filterMoveInput);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowMoveSuggestions(false), 200);
                          }}
                          className="filter-input"
                        />
                      </div>
                      {showMoveSuggestions && moveSuggestions.length > 0 && (
                        <div className="suggestions-dropdown" style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: 0, 
                          right: 0, 
                          zIndex: 1000, 
                          background: '#fff', 
                          border: '1px solid #ccc', 
                          maxHeight: '200px', 
                          overflowY: 'auto',
                          marginTop: '2px',
                          borderRadius: '4px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                          {moveSuggestions.map((move, idx) => (
                            <div 
                              key={idx}
                              className="suggestion-item" 
                              style={{ 
                                padding: '8px 12px', 
                                cursor: 'pointer',
                                borderBottom: idx < moveSuggestions.length - 1 ? '1px solid #eee' : 'none'
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (!filterMoves.includes(move)) {
                                  setFilterMoves([...filterMoves, move]);
                                }
                                setFilterMoveInput('');
                                setShowMoveSuggestions(false);
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = '#f0f0f0';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = '#fff';
                              }}
                            >
                              {move}
                            </div>
                          ))}
                        </div>
                      )}
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
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input placeholder="Search Pokémon" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value.toLowerCase()); setDraftSuggestionsVisible(true); }} onBlur={() => setTimeout(() => setDraftSuggestionsVisible(false), 150)} onFocus={() => { if (searchTerm) setDraftSuggestionsVisible(true); }} style={{ width: '100%' }} />
                      {draftSuggestionsVisible && searchTerm && (
                        <div className="suggestions-dropdown" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #ddd', boxShadow: '0 6px 16px rgba(16,24,40,0.06)', maxWidth: '400px', maxHeight: '220px', overflowY: 'auto', borderRadius: '6px', marginTop: '4px' }}>
                          {draftSearchSuggestions.map(p => (
                            <div key={p.id} className="suggestion-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', cursor: 'pointer' }} onMouseDown={(ev) => { 
                              ev.preventDefault(); 
                              // Add to searchTerms if not already there
                              if (!searchTerms.some(term => term.toLowerCase() === p.name.toLowerCase())) {
                                setSearchTerms([...searchTerms, p.name]);
                              }
                              setSearchTerm('');
                              setDraftSuggestionsVisible(false); 
                            }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>
                              {p.img ? <img src={p.img} alt={p.name} style={{ width: '32px', height: '32px' }} /> : <div style={{ width: '32px', height: '32px', backgroundColor: '#e5e7eb' }} />}
                              <span>{p.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Display selected search terms as removable chips */}
                  {searchTerms.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                      {searchTerms.map((term, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e0e7ff', padding: '4px 8px', borderRadius: '4px', fontSize: '14px' }}>
                          <span>{term}</span>
                          <button 
                            onClick={() => setSearchTerms(searchTerms.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1, color: '#6366f1' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => setSearchTerms([])}
                        style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                  {loadingLegendaries && (<span className="ml-8">Loading...</span>)}
                </div>

                <div className="pokemon-grid">
                      {visiblePokemonList.map((p) => {
                      const cost = pointsMap && pointsMap[p.name] !== undefined ? Number(pointsMap[p.name]) : 1;
                        return (
                          <div key={p.id} className={`pokemon-card ${areCardsDisabled ? 'disabled' : ''}`} onClick={() => handlePokemonCardClick(p.id, p)}>
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
              <button className="gen-button" onClick={handleLeaveDraftButton}>Leave Draft</button>
              {exportMessage && (<div className="export-msg">{exportMessage}</div>)}
            </div>

              {lobbyUsers.length > 0 && (
                <div className="mb-10">
                  <strong>Players & Picks</strong>
                  <ul>
                    {orderedPlayers.map((u) => {
                      const sel = (socket && u.id === socket.id) ? getMergedSelectionsForUser(u) : getSelectionsForUser(u);
                      const teamDisplay = (sel && sel.length > 0) ? sel.map(p => p.name || p).join(', ') : null;
                      return (
                      <li key={u.id} className={currentTurn === u.id ? 'player-item current' : 'player-item'}>
                          <div className={currentTurn === u.id ? 'player-name current' : 'player-name'} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span 
                              className="connection-dot" 
                              style={{ 
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '50%', 
                                backgroundColor: u.isConnected ? '#10b981' : '#6b7280',
                                flexShrink: 0
                              }}
                              title={u.isConnected ? 'Connected' : 'Disconnected'}
                            />
                            {u.name} 
                            {currentTurn === u.id && (
                              <>
                                <span className="player-current"> (Picking)</span>
                                {lobbySettings.timerEnabled && timeRemaining !== null && (
                                  <span style={{ 
                                    marginLeft: '8px',
                                    fontWeight: 'bold',
                                    color: timeRemaining < 300 ? '#ff4444' : '#16a34a',
                                    fontSize: '14px'
                                  }}>
                                    ⏱ {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="player-meta">
                            <div className="fs-12 muted">Team:</div>
                            <div>{teamDisplay || <em className="muted">—</em>}</div>
                            <div className="fs-12 muted mt-4">Points: {pointsRemaining && pointsRemaining[u.id] != null ? pointsRemaining[u.id] : lobbySettings.pointsLimit}</div>
                          </div>
                        </li>
                      );
                    })}
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

      {/* Helper function to find Pokemon from any available source */}
      {(() => {
        const findPokemonByName = (name) => {
          if (!name) return null;
          // Try pokemonList first
          let p = pokemonList.find(pk => pk.name === name);
          if (p) return p;
          // Try draftPokemonList
          if (draftPokemonList && draftPokemonList.length > 0) {
            p = draftPokemonList.find(pk => pk.name === name);
            if (p) return p;
          }
          // Try finalTeams selections
          if (finalTeams && finalTeams.selections) {
            for (const userId in finalTeams.selections) {
              const found = finalTeams.selections[userId].find(pk => pk?.name === name);
              if (found) return found;
            }
          }
          return null;
        };
        window._findPokemonByName = findPokemonByName; // Make accessible to modals
        return null;
      })()}

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
                    const p = window._findPokemonByName?.(pendingTradeOffer.myPokemon);
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
                    const p = window._findPokemonByName?.(pendingTradeOffer.theirPokemon);
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
      
      {/* Draft Selection Confirmation Modal */}
      {pendingDraftSelection && (
        <div className="modal-overlay">
          <div className="trade-modal">
            <h3>Confirm Selection</h3>
            <p>Do you want to draft this Pokémon?</p>
            <div className="trade-pokemon-display" style={{ justifyContent: 'center' }}>
              <div className="trade-pokemon-side">
                <div className="trade-pokemon-preview">
                  <div className="trading-pokemon-card">
                    {pendingDraftSelection.pokemon.img ? (
                      <img src={pendingDraftSelection.pokemon.img} alt={pendingDraftSelection.pokemon.name} className="pokemon-img" style={{ width: '120px', height: '120px' }} />
                    ) : (
                      <div className="pokemon-img" style={{ width: '120px', height: '120px', backgroundColor: '#e5e7eb' }} />
                    )}
                    <div className="pokemon-name" style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '10px' }}>{pendingDraftSelection.pokemon.name}</div>
                    <div className="pokemon-cost-badge" style={{ position: 'relative', margin: '10px auto', fontSize: '16px' }}>
                      Cost: {pointsMap && pointsMap[pendingDraftSelection.pokemon.name] !== undefined ? Number(pointsMap[pendingDraftSelection.pokemon.name]) : 1} points
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-buttons">
              <button className="gen-button" onClick={cancelDraftSelection}>Cancel</button>
              <button className="export-button ml-8" onClick={confirmDraftSelection}>Confirm Draft</button>
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
                    const p = window._findPokemonByName?.(incomingTradeOffer.pokemon1);
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
                    const p = window._findPokemonByName?.(incomingTradeOffer.pokemon2);
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
            <div className="search-container">
              <input 
                type="text" 
                placeholder="Search Pokémon..."
                value={unpickedSearchQuery}
                onChange={(e) => setUnpickedSearchQuery(e.target.value)}
                className="pokemon-search-input"
                autoFocus
              />
            </div>
            <div className="unpicked-pokemon-list">
              {(() => {
                const allPicked = Object.values(finalTeams?.selections || {}).flat().map(p => p.name);
                let unpicked = pokemonList.filter(p => !allPicked.includes(p.name) && getCost(p) > 0);
                
                // Filter by search query
                if (unpickedSearchQuery.trim()) {
                  const query = unpickedSearchQuery.toLowerCase();
                  unpicked = unpicked.filter(p => p.name.toLowerCase().includes(query));
                }
                
                if (unpicked.length === 0) {
                  return <p className="no-results">No Pokémon found</p>;
                }
                
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
              {selectedForExport.length > 0 && (
                <p style={{ margin: '5px 0 0 0', color: '#10b981', fontWeight: 600 }}>
                  {selectedForExport.length} Pokémon selected for export
                </p>
              )}
            </div>
            <div className="team-builder-header-buttons">
              {teamBuilderLoaded && (
                <button className="gen-button" onClick={saveTeamToStorage}>Save Team</button>
              )}
              <button className="gen-button ml-8" onClick={() => setShowTeamSelector(true)}>Load Team</button>
              {selectedForExport.length > 0 && (
                <button className="export-button ml-8" onClick={exportToShowdown}>Export to Showdown</button>
              )}
              <button className="gen-button ml-8" onClick={() => setView('lobby')}>Back to Lobby</button>
              {exportMessage && <span className="ml-8" style={{ color: '#16a34a', fontWeight: 600 }}>{exportMessage}</span>}
            </div>
          </div>

          {/* Team Composition Checklist */}
          <div className="team-composition-panel" style={{ 
            background: '#f9fafb', 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px', 
            padding: '16px', 
            marginBottom: '20px' 
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              {/* General Section */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>General</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.entryHazard && teamComposition.entryHazard.length > 0}
                      readOnly
                    />
                    <span>Entry Hazard</span>
                    {teamComposition.entryHazard?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.entryHazard.join(', ')})</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.spinner && teamComposition.spinner.length > 0}
                      readOnly
                    />
                    <span>Spinner/Defogger</span>
                    {teamComposition.spinner?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.spinner.join(', ')})</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.recovery && teamComposition.recovery.length > 0}
                      readOnly
                    />
                    <span>Reliable Recovery</span>
                    {teamComposition.recovery?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.recovery.join(', ')})</span>
                    )}
                  </label>
                </div>
              </div>

              {/* Defensive Section */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>Defensive</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.cleric && teamComposition.cleric.length > 0}
                      readOnly
                    />
                    <span>Cleric</span>
                    {teamComposition.cleric?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.cleric.join(', ')})</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.statusMove && teamComposition.statusMove.length > 0}
                      readOnly
                    />
                    <span>Status Move</span>
                    {teamComposition.statusMove?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.statusMove.join(', ')})</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.phazer && teamComposition.phazer.length > 0}
                      readOnly
                    />
                    <span>Phazer</span>
                    {teamComposition.phazer?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.phazer.join(', ')})</span>
                    )}
                  </label>
                </div>
              </div>

              {/* Offensive Section */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>Offensive</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.boosting && teamComposition.boosting.length > 0}
                      readOnly
                    />
                    <span>Boosting Move</span>
                    {teamComposition.boosting?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.boosting.join(', ')})</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.voltTurn && teamComposition.voltTurn.length > 0}
                      readOnly
                    />
                    <span>Volt-turn Move</span>
                    {teamComposition.voltTurn?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.voltTurn.join(', ')})</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                    <input 
                      type="checkbox" 
                      className="team-composition-checkbox"
                      checked={teamComposition.choiceItem && teamComposition.choiceItem.length > 0}
                      readOnly
                    />
                    <span>Choice Item</span>
                    {teamComposition.choiceItem?.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({teamComposition.choiceItem.join(', ')})</span>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="team-builder-horizontal">
            {teamBuilderData.slots.filter(slot => slot && slot.pokemon).length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', width: '100%' }}>
                <p style={{ fontSize: '18px', color: '#666' }}>No Pokémon in this team yet.</p>
                <button className="gen-button" onClick={() => setShowTeamSelector(true)}>Load a Team</button>
              </div>
            ) : (
              <>
                <div style={{ width: '100%', textAlign: 'center', marginBottom: '15px', padding: '10px', background: '#f0f9ff', borderRadius: '8px' }}>
                  <p style={{ margin: 0, color: '#1e40af', fontSize: '14px' }}>
                    💡 Click on Pokémon cards to select up to 6 for export into Leagues or Showdown
                  </p>
                </div>
                {teamBuilderData.slots.filter(slot => slot && slot.pokemon).map((slot, idx) => {
                const totalEVs = getTotalEVs(slot);
                const remainingEVs = MAX_EVS - totalEVs;
                const isSelected = selectedForExport.includes(idx);

                return (
                  <div 
                    key={idx} 
                    className={`team-builder-slot ${isSelected ? 'selected-for-export' : ''}`}
                    onClick={(e) => {
                      // Only toggle selection if clicking on the slot itself, not inputs/selects
                      if (e.target.closest('select, input')) return;
                      togglePokemonSelection(idx);
                    }}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: '#10b981',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        zIndex: 10
                      }}>
                        SELECTED
                      </div>
                    )}
                    <div className="slot-number">Slot {slot.slotNumber}</div>
                    <div className="pokemon-builder-card">
                      {slot.pokemon.img ? (
                        <img src={slot.pokemon.img} alt={slot.pokemon.name} className="pokemon-img" />
                      ) : (
                        <div className="pokemon-img" style={{ backgroundColor: '#e5e7eb' }} />
                      )}
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

                    <div className="builder-section">
                      <label>Tera Type:</label>
                      <select value={slot.teraType} onChange={(e) => updateTeamBuilderSlot(idx, 'teraType', e.target.value)}>
                        <option value="">None</option>
                        <option value="normal">Normal</option>
                        <option value="fire">Fire</option>
                        <option value="water">Water</option>
                        <option value="electric">Electric</option>
                        <option value="grass">Grass</option>
                        <option value="ice">Ice</option>
                        <option value="fighting">Fighting</option>
                        <option value="poison">Poison</option>
                        <option value="ground">Ground</option>
                        <option value="flying">Flying</option>
                        <option value="psychic">Psychic</option>
                        <option value="bug">Bug</option>
                        <option value="rock">Rock</option>
                        <option value="ghost">Ghost</option>
                        <option value="dragon">Dragon</option>
                        <option value="dark">Dark</option>
                        <option value="steel">Steel</option>
                        <option value="fairy">Fairy</option>
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
                        const base = slot.pokemon?.baseStats?.[statKey] || 0;
                        const iv = slot.ivs?.[statKey] || 0;
                        const ev = slot.evs?.[statKey] || 0;
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
            </>
            )}
          </div>
        </div>
      )}

      {view === 'teambuilder' && showTeamSelector && (
        <div className="TeamBuilderContainer">
          <div className="team-builder-header">
            <h2>Load Team</h2>
            <button className="gen-button" onClick={() => setView('lobby')}>Back to Lobby</button>
          </div>

          <div className="team-selector-content">
            <div className="team-selector-section">
              <h3>Saved Teams (Database)</h3>
              {(() => {
                if (loadingTeams) {
                  return <div className="muted-text">Loading teams...</div>;
                }

                if (savedTeamsFromDB.length === 0) {
                  return <div className="muted-text">No saved teams found. Save a team from the team builder to see it here.</div>;
                }
                
                return (
                  <div className="team-selector-grid">
                    {savedTeamsFromDB.map((team) => (
                      <div key={team._id} className="team-selector-card">
                        <div className="team-selector-card-header">
                          <strong>{team.name}</strong>
                          <div className="fs-12 muted">
                            {new Date(team.createdAt).toLocaleDateString()} {new Date(team.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="team-selector-card-body">
                          <div className="saved-team-grid">
                            {team.teamBuilderData?.slots?.filter(s => s && s.pokemon).slice(0, 6).map((slot, idx) => (
                              <div key={idx} className="saved-team-card-small">
                                <img 
                                  src={slot.pokemon.img || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${slot.pokemon.id || 1}.png`} 
                                  alt={slot.pokemon.name} 
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              </div>
                            )) || team.pokemon?.slice(0, 6).map((pokemon, idx) => (
                              <div key={idx} className="saved-team-card-small">
                                <div className="fs-10">{pokemon.name}</div>
                              </div>
                            ))}
                          </div>
                          <div className="fs-12 muted mt-8">
                            {team.pokemon.length} Pokémon
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button 
                            className="gen-button" 
                            style={{ flex: 1 }}
                            onClick={() => loadTeamFromDB(team)}
                          >
                            Load
                          </button>
                          <button 
                            className="gen-button" 
                            style={{ flex: 1, backgroundColor: '#dc2626' }}
                            onClick={async () => {
                              if (window.confirm(`Delete team "${team.name}"?`)) {
                                try {
                                  await axios.delete(`${socketUrl}/api/teams/${team._id}`);
                                  fetchTeamsFromDB(); // Refresh list
                                } catch (error) {
                                  console.error('Failed to delete team:', error);
                                  alert('Failed to delete team');
                                }
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

      {view === 'leagues' && (
        <div className="leagues-container">
          <button className="gen-button" onClick={() => setView('lobby')} style={{ margin: '20px' }}>
            Back to Lobby
          </button>
          <LeagueManager 
            username={PokemonName || 'Guest'} 
            onStartLeagueDraft={(leagueCode, draftSettings) => {
              // Set lobby league code
              setLobbyLeagueCode(leagueCode);
              
              // Apply draft settings to lobby
              const newSettings = {
                pointsLimit: draftSettings.pointsLimit || 120,
                teamSizeLimit: draftSettings.teamSize || 12,
                allowTrading: draftSettings.allowTrading || false,
                maxTradeLimit: draftSettings.maxTradeLimit || 0,
                unlimitedTrades: draftSettings.unlimitedTrades || false,
                genFilter: draftSettings.allowedGenerations?.[draftSettings.allowedGenerations.length - 1] || 0,
                timerEnabled: draftSettings.timerEnabled || false,
                firstRoundTimer: draftSettings.firstRoundTimer || 480,
                subsequentRoundTimer: draftSettings.subsequentRoundTimer || 480,
                allowMega: draftSettings.allowMega || false,
                allowGmax: draftSettings.allowGmax || false
              };
              setLobbySettings(newSettings);
              
              // Set points map and ban list
              const newPointsMap = draftSettings.pokemonPointValues || {};
              const newBanList = draftSettings.bannedPokemon || [];
              setPointsMap(newPointsMap);
              setBanList(newBanList);
              
              // Create lobby with the settings
              restoreFullPokemonList();
              const name = (PokemonName && PokemonName.trim()) ? PokemonName.trim() : `Player-${Math.floor(Math.random()*1000)}`;
              if (socket) {
                socket.emit('create_lobby', { 
                  name,
                  settings: newSettings,
                  pointsMap: newPointsMap,
                  banList: newBanList,
                  leagueCode: leagueCode
                }, (resp) => {
                  if (resp && resp.ok) {
                    setLobbyCode(resp.code);
                    setLobbyUsers(resp.users || [name]);
                    setLocalPlayerName(name);
                    if (resp.host) setHostId(resp.host);
                    // Update with confirmed settings from server
                    if (resp.settings) setLobbySettings(resp.settings);
                    if (resp.pointsMap) setPointsMap(normalizePointsMap(resp.pointsMap));
                    if (resp.banList) setBanList(Array.isArray(resp.banList) ? resp.banList : []);
                    if (resp.pointsRemaining) setPointsRemaining(resp.pointsRemaining);
                    if (resp.leagueCode) setLobbyLeagueCode(resp.leagueCode);
                    setView('lobby');
                  }
                });
              } else {
                // fallback to client-only behavior
                const code = `${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                setLobbyCode(code);
                setLobbyUsers([{ id: `local-${Date.now()}`, name }]);
                setLocalPlayerName(name);
                setView('lobby');
              }
            }}
          />
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
      
      {showAuthModal && (
        <AuthModal 
          onClose={() => {
            setShowAuthModal(false);
            // If user closed modal without logging in, allow guest access
            if (!user && !PokemonName) {
              const guestName = prompt('Enter a guest username to continue:');
              if (guestName) {
                setPokemonName(guestName);
              }
            }
          }} 
        />
      )}
    </div>
  );
}

export default App;

