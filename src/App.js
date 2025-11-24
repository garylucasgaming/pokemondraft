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
  // app view: 'lobby' (main) or 'draft' (the drafting page)
  const [view, setView] = useState('lobby');
  // lobby state
  const [lobbyCode, setLobbyCode] = useState('');
  const [lobbyUsers, setLobbyUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [remoteSelections, setRemoteSelections] = useState({});
  // optimistic local picks (keyed by socket id)
  const [optimisticSelections, setOptimisticSelections] = useState({});
  const [hostId, setHostId] = useState(null);
  const [lobbySettings, setLobbySettings] = useState({ pointsLimit: 100, teamSizeLimit: 10 });
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

  const saveTeamToCookie = (options = {}) => {
    // options: { lobbyCodeOverride, teamNameOverride }
    const localUser = (socket && lobbyUsers) ? lobbyUsers.find(u => u.id === socket.id) : null;
    const localName = localUser ? localUser.name : (localPlayerName || PokemonName || 'You');
    const team = getMergedSelectionsForUser(localUser || { id: socket && socket.id, name: localName });
    if (!team || team.length === 0) {
      setExportMessage('No selected Pokémon to save');
      setTimeout(() => setExportMessage(''), 2500);
      return;
    }
    try {
      const code = sanitizeLobbyCode(options.lobbyCodeOverride || lobbyCode || 'global');
      if (!code) {
        setExportMessage('Invalid lobby code');
        setTimeout(() => setExportMessage(''), 2500);
        return false;
      }
      
      const teamName = options.teamNameOverride || `Team Lobby#: ${code}`;
      const key = `pkmndraft_team_${code}`;
      
      // if a saved team already exists for this code, confirm overwrite
      const existing = readSavedTeamByCode(code);
      if (existing) {
        const ok = window.confirm(`A saved team already exists for lobby ${code}. Overwrite?`);
        if (!ok) return false;
      }
      
      // Validate and sanitize team entries
      const sanitizedTeam = team.map(p => ({
        id: p.id || null,
        name: String(p.name || '').toLowerCase(),
        img: p.img || null
      })).filter(p => p.name);
      
      if (sanitizedTeam.length === 0) {
        setExportMessage('No valid Pokémon to save');
        setTimeout(() => setExportMessage(''), 2500);
        return false;
      }
      
      const payload = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        name: teamName,
        lobbyCode: code,
        savedAt: Date.now(),
        team: sanitizedTeam
      };
      
      const value = JSON.stringify(payload);
      
      // store in localStorage (do not use cookies for large blobs)
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // localStorage may be unavailable or full
        console.error('localStorage.setItem failed', e);
        throw e;
      }
      
      // refresh saved teams state if visible
      try { setSavedTeams(readSavedTeamsFromCookies()); } catch (e) { /* ignore */ }
      setExportMessage('Team saved locally');
      setTimeout(() => setExportMessage(''), 2500);
      return true;
    } catch (err) {
      console.error('Failed to save team to storage', err);
      setExportMessage('Failed to save team');
      setTimeout(() => setExportMessage(''), 2500);
      return false;
    }
  };

  const addOngoingDraftToCookies = (code, otherPlayerNames = [], options = {}) => {
    // options: { settings, draftOrder, currentTurn, pointsRemaining }
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
      
      // Build a name-to-points map from pointsRemaining (socketId->points) and lobbyUsers (socketId->name)
      let pointsRemainingByName = null;
      if (options.pointsRemaining && lobbyUsers && lobbyUsers.length > 0) {
        pointsRemainingByName = {};
        for (const user of lobbyUsers) {
          if (user.id && options.pointsRemaining[user.id] != null) {
            pointsRemainingByName[user.name] = sanitizePoints(options.pointsRemaining[user.id]);
          }
        }
      }
      
      // Sanitize settings if present
      const sanitizedSettings = options.settings ? {
        pointsLimit: sanitizePoints(options.settings.pointsLimit || 100),
        teamSizeLimit: sanitizeTeamSize(options.settings.teamSizeLimit || 10),
        genFilter: Number(options.settings.genFilter) || 0
      } : null;
      
      // Avoid duplicate codes; replace if exists
      const entry = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        code: sanitizedCode,
        players: Array.isArray(otherPlayerNames) ? otherPlayerNames.filter(n => typeof n === 'string') : [],
        settings: sanitizedSettings,
        draftOrder: options.draftOrder || null,
        currentTurn: options.currentTurn || null,
        pointsRemaining: options.pointsRemaining || null,
        pointsRemainingByName: pointsRemainingByName,
        savedAt: Date.now()
      };
      
      const filtered = list.filter(it => it.code !== sanitizedCode);
      filtered.push(entry);
      
      try { localStorage.setItem(key, JSON.stringify(filtered)); } catch (e) { console.error('localStorage set failed', e); }
    } catch (err) {
      console.error('Failed to add ongoing draft to storage', err);
    }
  };

  const readSavedTeamsFromCookies = () => {
    const prefix = 'pkmndraft_team_';
    const out = [];
    const keysToRemove = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        
        try {
          const val = localStorage.getItem(key);
          const parsed = val ? JSON.parse(val) : null;
          
          // Validate schema
          if (!parsed || !validateSavedTeam(parsed)) {
            console.warn('Invalid saved team, marking for removal', key);
            keysToRemove.push(key);
            continue;
          }
          
          // Check expiry
          if (isExpired(parsed.savedAt, MAX_SAVED_TEAM_AGE_DAYS)) {
            console.warn('Saved team expired, marking for removal', key);
            keysToRemove.push(key);
            continue;
          }
          
          out.push({ key, team: parsed });
        } catch (err) {
          console.warn('Failed to parse saved team from storage', key, err);
          keysToRemove.push(key);
        }
      }
      
      // Clean up invalid entries
      keysToRemove.forEach(k => {
        try { localStorage.removeItem(k); } catch (e) {}
      });
      
    } catch (err) {
      console.warn('Failed to read saved teams from storage', err);
    }
    return out;
  };

  const loadSavedTeam = (cookieKey) => {
    try {
      // cookieKey is like 'pkmndraft_team_<code>'
      const code = cookieKey.replace('pkmndraft_team_', '');
      const payload = readSavedTeamByCode(code);
      if (!payload) {
        alert('Saved team not found or invalid. It may have expired or been corrupted.');
        // Refresh saved teams list to remove invalid entry from UI
        const teams = readSavedTeamsFromCookies();
        setSavedTeams(teams);
        return;
      }
      const entries = normalizeSavedTeamEntries(payload.team);
      if (entries.length === 0) {
        alert('Saved team contains no valid Pokémon entries.');
        return;
      }
      const myId = socket ? socket.id : (`local-${Date.now()}`);
      setOptimisticSelections((prev) => ({ ...(prev || {}), [myId]: entries }));
      const ids = entries.map(p => p.id).filter(Boolean);
      if (ids.length > 0) {
        setPokemonList((prev) => prev.filter(p => !ids.includes(p.id)));
        setDraftPokemonList((prev) => prev.filter(p => !ids.includes(p.id)));
      }
      setExportMessage('Loaded saved team locally');
      setTimeout(() => setExportMessage(''), 2500);
    } catch (err) {
      console.error('Failed to load saved team', err);
      setExportMessage('Failed to load saved team');
      setTimeout(() => setExportMessage(''), 2500);
    }
  };

  const deleteSavedTeamCookie = (cookieKey) => {
    if (!window.confirm('Delete this saved team? This cannot be undone.')) return;
    try {
      // remove from localStorage
      try { localStorage.removeItem(cookieKey); } catch (e) { console.error('localStorage remove failed', e); }
      // refresh savedTeams state
      const teams = readSavedTeamsFromCookies();
      setSavedTeams(teams);
      setExportMessage('Deleted saved team');
      setTimeout(() => setExportMessage(''), 2500);
    } catch (err) {
      console.error('Failed to delete saved team cookie', err);
      setExportMessage('Failed to delete saved team');
      setTimeout(() => setExportMessage(''), 2500);
    }
  };

  const exportSavedTeam = async (cookieKey) => {
    try {
      if (!cookieKey) return;
      const code = cookieKey.replace('pkmndraft_team_', '');
      const payload = readSavedTeamByCode(code);
      if (!payload || !Array.isArray(payload.team) || payload.team.length === 0) {
        setExportMessage('No saved team to export');
        setTimeout(() => setExportMessage(''), 2500);
        return;
      }
      const entries = normalizeSavedTeamEntries(payload.team);
      const lines = entries.map(p => toShowdownName(p.name || p));
      const text = lines.join('\n\n');
      const ok = await copyToClipboard(text);
      if (ok) {
        setExportMessage(`Copied ${lines.length} Pokémon to clipboard`);
        setCopiedTeamKey(cookieKey);
        setTimeout(() => setCopiedTeamKey(null), 2500);
      } else {
        setExportMessage('Failed to copy saved team');
      }
      setTimeout(() => setExportMessage(''), 3000);
    } catch (err) {
      console.error('Failed to export saved team', err);
      setExportMessage('Failed to export saved team');
      setTimeout(() => setExportMessage(''), 2500);
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

  const clearSavedTeamsCookies = () => {
    // confirm destructive action
    if (!window.confirm('Delete all saved teams? This will remove all locally-saved teams and you will not be able to rejoin those lobbies from saved data. Are you sure?')) return;
    try {
      const prefix = 'pkmndraft_team_';
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
      } catch (e) {
        console.error('Failed clearing saved teams from localStorage', e);
      }
      setSavedTeams([]);
      setExportMessage('Cleared saved teams');
      setTimeout(() => setExportMessage(''), 2500);
    } catch (err) {
      console.error('Failed to clear saved teams', err);
      setExportMessage('Failed to clear saved teams');
      setTimeout(() => setExportMessage(''), 2500);
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
        // Validate schema
        if (!validateOngoingDraft(entry)) {
          console.warn('Invalid ongoing draft entry', entry.code);
          hasInvalid = true;
          continue;
        }
        
        // Check expiry
        if (isExpired(entry.savedAt, MAX_ONGOING_DRAFT_AGE_DAYS)) {
          console.warn('Ongoing draft expired', entry.code);
          hasInvalid = true;
          continue;
        }
        
        // Sanitize nested values
        const sanitized = {
          ...entry,
          code: sanitizeLobbyCode(entry.code) || entry.code,
          players: Array.isArray(entry.players) ? entry.players : []
        };
        
        // Sanitize settings if present
        if (sanitized.settings) {
          sanitized.settings = {
            pointsLimit: sanitizePoints(sanitized.settings.pointsLimit || 100),
            teamSizeLimit: sanitizeTeamSize(sanitized.settings.teamSizeLimit || 10),
            genFilter: Number(sanitized.settings.genFilter) || 0
          };
        }
        
        // Sanitize pointsRemaining if present
        if (sanitized.pointsRemainingByName) {
          const cleaned = {};
          for (const [name, pts] of Object.entries(sanitized.pointsRemainingByName)) {
            if (typeof name === 'string' && name.length > 0) {
              cleaned[name] = sanitizePoints(pts);
            }
          }
          sanitized.pointsRemainingByName = cleaned;
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
      const filtered = list.filter(it => it.code !== code);
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
      const payload = readSavedTeamByCode(code);
      if (!payload || !Array.isArray(payload.team) || payload.team.length === 0) {
        setExportMessage('No saved team found for this lobby');
        setTimeout(() => setExportMessage(''), 2500);
        return;
      }
      // show the saved team in the viewed panel
      setViewedOngoingTeam(payload);
      
      // Update BOTH optimistic and remote selections so the UI shows the team immediately
      const myId = socket ? socket.id : (`local-${Date.now()}`);
      const myName = localPlayerName || PokemonName;
      
      // Set remote selections (this is what the UI reads from)
      setRemoteSelections((prev) => {
        const updated = { ...(prev || {}) };
        updated[myId] = payload.team;
        if (myName) updated[myName] = payload.team;
        return updated;
      });
      
      // Also set optimistic selections as backup
      setOptimisticSelections((prev) => ({ ...(prev || {}), [myId]: payload.team }));
      
      // hide those pokemon from visible lists
      const ids = payload.team.map(p => p.id).filter(Boolean);
      if (ids.length > 0) {
        setPokemonList((prev) => prev.filter(p => !ids.includes(p.id)));
        setDraftPokemonList((prev) => prev.filter(p => !ids.includes(p.id)));
      }
      // restore pointsRemaining by matching saved names to current socket IDs
      if (draftEntry && draftEntry.pointsRemainingByName && typeof draftEntry.pointsRemainingByName === 'object' && lobbyUsers && lobbyUsers.length > 0) {
        try {
          const remappedPoints = {};
          for (const user of lobbyUsers) {
            if (user.name && draftEntry.pointsRemainingByName[user.name] != null) {
              remappedPoints[user.id] = draftEntry.pointsRemainingByName[user.name];
            }
          }
          if (Object.keys(remappedPoints).length > 0) {
            setPointsRemaining(remappedPoints);
          }
        } catch (e) {
          console.warn('Failed to remap pointsRemaining on rejoin', e);
        }
      }
      setExportMessage('Loaded saved team for this lobby');
      setTimeout(() => setExportMessage(''), 2500);
    } catch (err) {
      console.error('Failed to load saved team on rejoin', err);
      setExportMessage('Failed to load saved team');
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
          socket.emit('import_points', { code: lobbyCode, pointsMap: parsed }, (resp) => {
            if (!resp || !resp.ok) alert(resp && resp.error ? resp.error : 'Failed to import points');
              else setPointsMap(normalizePointsMap(resp.pointsMap || {}));
          });
        } else {
          // local: just set map
          setPointsMap(normalizePointsMap(parsed));
        }
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    // fetch a large number to include Gen 1-9 and normalize ids
    axios.get('https://pokeapi.co/api/v2/pokemon?limit=2000')
      .then((res) => {
        // build raw list
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
          .filter((p) => !Number.isNaN(p.id)); // drop any non-numeric entries

        // Heuristic filtering: exclude known alternate form tokens (mega, gmax, totem, etc.)
        // but keep regional variants (alola, galar, hisui, paldea, etc.). This is a
        // heuristic approach — we can make it exact later via species "is_default" checks.
        const excludeTokens = [
          'mega', 'gmax', 'g-max', 'primal', 'totem', 'therian', 'incarnate', 'eternal',
          'attack', 'defense', 'school', 'armored', 'masked', 'dusk', 'midnight', 'origin',
          'size', 'eternamax', 'shield', 'disguised', 'solo', 'aria', 'therian', 'resolute', 'zen', 'cap'
        ];
        const keepRegional = [
          'alola', 'alolan', 'galar', 'galarian', 'hisui', 'hisuian', 'paldea', 'paldean', 'kantonian', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos'
        ];

        // Hyphen rules: exclude most names containing '-' except when they contain
        // one of these allowed tokens or are explicitly allowed by name.
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
            // Special-case: exclude any Pikachu that contains a regional token
            // (we want to keep only base Pikachu without region qualifiers).
            if (name.includes('pikachu') && keepRegional.some((t) => name.includes(t))) return false;
          
            // always keep regional variants (for other species)
          if (keepRegional.some((t) => name.includes(t))) return true;

          // If name contains hyphen, we have special rules:
          if (name.includes('-')) {
           
            // explicitly exclude specified hyphenated names (e.g., Darmanitan zen forms)
            if (hyphenDisallowNames.has(name)) return false;

            // allow if it contains an allowed hyphen token
            if (hyphenAllowTokens.some((t) => name.includes(t))) return true;
            // allow if it is explicitly listed
            if (hyphenAllowNames.has(name)) return true;
            // otherwise exclude hyphenated forms
            return false;
          }

          // exclude if any exclude token matches (for non-hyphenated names)
          if (excludeTokens.some((t) => name.includes(t))) return false;
          return true;
        });

        // deduplicate by id just in case, then sort by id
        const byId = new Map();
        for (const item of filtered) {
          if (!byId.has(item.id)) byId.set(item.id, item);
        }
        const list = Array.from(byId.values()).sort((a, b) => a.id - b.id);

        setPokemonList(list);
      })
      .catch((err) => console.error('Failed to fetch pokemon list', err));
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

  // --- Lobby helpers (client-side scaffold) ---
  const generateLobbyCode = (length = 6) => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const createLobby = () => {
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
    // If leaving while in an active draft, save ongoing draft metadata and auto-save the team
    if (!skipAutoSave && view === 'draft' && lobbyCode) {
      try {
        // other players' names (exclude local)
        const otherNames = (lobbyUsers || []).filter(u => u.id !== (socket && socket.id)).map(u => u.name);
        // auto-save current team with lobby code metadata
        saveTeamToCookie({ lobbyCodeOverride: lobbyCode, teamNameOverride: `Team Lobby#: ${lobbyCode}` });
        // record ongoing draft list entry including settings, draft order, currentTurn, and pointsRemaining
        addOngoingDraftToCookies(lobbyCode, otherNames, { settings: lobbySettings, draftOrder: lobbyDraftOrder, currentTurn, pointsRemaining });
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
      const saved = saveTeamToCookie({ lobbyCodeOverride: lobbyCode, teamNameOverride: `Team Lobby#: ${lobbyCode}` });
      if (!saved) return; // user cancelled or failed
      const otherNames = (lobbyUsers || []).filter(u => u.id !== (socket && socket.id)).map(u => u.name);
      addOngoingDraftToCookies(lobbyCode, otherNames, { settings: lobbySettings, draftOrder: lobbyDraftOrder, currentTurn, pointsRemaining });
      // leave but skip the auto-save inside leaveLobby since we've already saved
      leaveLobby(true);
    } catch (err) {
      console.error('Failed while leaving draft', err);
      leaveLobby();
    }
  };

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
      // remove the selected pokemon from the visible list for everyone
      if (data.pokemon && data.pokemon.id) {
        setPokemonList((prev) => prev.filter(p => p.id !== data.pokemon.id));
        setDraftPokemonList((prev) => prev.filter(p => p.id !== data.pokemon.id));
      }
    });
    s.on('selections_update', (data) => {
      console.debug('socket event: selections_update', data);
      if (!data) return;
      setRemoteSelections(data.selections || {});
      const allSelectedIds = Object.values(data.selections || {}).flat().map(p => p.id).filter(Boolean);
      setPokemonList((prev) => prev.filter(p => !allSelectedIds.includes(p.id)));
      setDraftPokemonList((prev) => prev.filter(p => !allSelectedIds.includes(p.id)));
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
                <input placeholder="Enter your name" id="name-input" className="JoinCodeInput" value={PokemonName} onChange={(e) => setPokemonName(e.target.value)} />
                <button className="gen-button ml-8" onClick={() => { const val = (PokemonName || '').trim(); if (val) saveUsernameToCookie(val); else alert('Please enter a username before saving'); }}>Save Username</button>
                  <button onClick={createLobby} className="export-button">Create Lobby</button>
                  <input placeholder="Enter lobby code" id="join-code" className="JoinCodeInput" />
                  <button className="gen-button ml-8" onClick={pasteLobbyCodeFromClipboard}>Paste</button>
                  <button className="gen-button" onClick={() => joinLobby(document.getElementById('join-code').value)}>Join Lobby</button>
                  <button className="gen-button ml-8" onClick={() => {
                    const teams = readSavedTeamsFromCookies();
                    setSavedTeams(teams);
                    setSavedTeamsVisible((v) => !v);
                  }}>{savedTeamsVisible ? 'Hide Saved Teams' : 'Show Saved Teams'}</button>
                  <button className="gen-button ml-8" onClick={() => {
                    const drafts = readOngoingDraftsFromCookies();
                    setOngoingDrafts(drafts);
                    setOngoingDraftsVisible((v) => !v);
                  }}>{ongoingDraftsVisible ? 'Hide Ongoing Drafts' : 'Show Ongoing Drafts'}</button>
                  <button className="gen-button ml-8" onClick={() => { clearSavedTeamsCookies(); }}>Clear Saved Teams</button>
                  <button className="gen-button ml-8" onClick={() => { clearOngoingDraftsCookie(); }}>Clear Ongoing Drafts</button>
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
                        {currentTurn === u.id && (<span className="player-current"> (Current Turn)</span>)}
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
                                socket.emit('update_settings', { code: lobbyCode, settings: { pointsLimit: lobbySettings.pointsLimit, genFilter: newGen, teamSizeLimit: lobbySettings.teamSizeLimit } }, (resp) => {
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
          {savedTeamsVisible && savedTeams && savedTeams.length > 0 && (
            <div className="SavedTeamsPanel">
              <h4>Saved Teams</h4>
              {savedTeams.map((s) => (
                <div key={s.key} className="saved-team-item">
                  <div className="saved-team-key"><strong>{s.key.replace('pkmndraft_team_', '')}</strong></div>
                  <div className="saved-team-list">
                    {(() => {
                      const entries = normalizeSavedTeamEntries(s.team);
                      if (entries && entries.length > 0) {
                        return (
                          <div className="saved-team-grid">
                            {entries.map((p) => (
                              <div key={p.id || p.name} className="saved-team-card">
                                {p.img ? <img src={p.img} alt={p.name} className="pokemon-img" /> : <div className="pokemon-img placeholder" />}
                                <div className="pokemon-name">{p.name}</div>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <em>No entries</em>;
                    })()}
                  </div>
                  <div className="saved-team-actions">
                    <button className="gen-button" onClick={() => exportSavedTeam(s.key)}>Export</button>
                    {copiedTeamKey === s.key && (<span className="copy-confirm ml-8">Copied!</span>)}
                    <button className="gen-button" onClick={() => deleteSavedTeamCookie(s.key)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {ongoingDraftsVisible && ongoingDrafts && ongoingDrafts.length > 0 && (
            <div className="OngoingDraftsPanel">
              <h4>Ongoing Drafts</h4>
              {ongoingDrafts.map((d) => (
                <div key={d.code} className="ongoing-draft-item">
                  <div className="ongoing-draft-key"><strong>{d.code}</strong></div>
                  <div className="ongoing-draft-players">Players: {Array.isArray(d.players) && d.players.length > 0 ? d.players.join(', ') : <em>—</em>}</div>
                  {d.settings && (
                    <div className="ongoing-draft-settings">Settings: PointsLimit {d.settings.pointsLimit || '—'}, TeamSize {d.settings.teamSizeLimit || '—'}</div>
                  )}
                  {d.draftOrder && Array.isArray(d.draftOrder) && d.draftOrder.length > 0 && (
                    <div className="ongoing-draft-order">Draft Order: {d.draftOrder.join(', ')}</div>
                  )}
                  {d.currentTurn && (
                    <div className="ongoing-draft-current">Current Pick: {d.currentTurn}</div>
                  )}
                    <div className="ongoing-draft-actions">
                      <button className="gen-button" onClick={() => { 
                        const savedPoints = d.pointsRemainingByName && d.pointsRemainingByName[PokemonName] != null ? d.pointsRemainingByName[PokemonName] : null;
                        const savedTeam = readSavedTeamByCode(d.code);
                        const savedSelections = savedTeam && savedTeam.team ? savedTeam.team : null;
                        setRejoinPending({ code: d.code, expectedPlayers: d.players || [], draftEntry: d }); 
                        joinLobby(d.code, savedPoints, savedSelections); 
                      }}>Rejoin</button>
                      <button className="gen-button ml-8" onClick={() => {
                        const team = readSavedTeamByCode(d.code);
                        setViewedOngoingTeam(team);
                      }}>View Team</button>
                      <button className="gen-button danger ml-8" onClick={() => deleteOngoingDraft(d.code)}>Delete</button>
                    </div>
                </div>
              ))}
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
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'draft' && (
        <div className="MainArea">
          <div className="DisplaySection">
                    <div className="draft-header">
                    <h2>Available Pokémon ({draftPokemonList.length > 0 ? draftPokemonList.length : pokemonList.length}) — click to select</h2>
              <div className="lobby-label">Lobby: <strong>{lobbyCode || '—'}</strong></div>
            </div>
            {(draftPokemonList.length === 0 && pokemonList.length === 0) ? (
              <h3>No Pokémon available</h3>
            ) : (
              <div>
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
                      {draftPokemonList.length > 0 ? draftPokemonList.map((p) => {
                      const isDisabled = (view === 'draft' && ((currentTurn && socket && socket.id !== currentTurn) || (socket && socket.id === currentTurn && localTeamForRender.length >= (lobbySettings.teamSizeLimit || 10))));
                        return (
                          <div key={p.id} className={`pokemon-card ${isDisabled ? 'disabled' : ''}`} onClick={() => { console.debug('card click', { id: p.id, isDisabled, socketId: socket && socket.id, currentTurn, view }); if (isDisabled) return; removePokemon(p.id); }}>
                            <img className="pokemon-img" src={p.img} alt={p.name} />
                            <div className="pokemon-name">{p.name}</div>
                          </div>
                        );
                    }) : (
                      // fallback to full list if draft snapshot missing
                      pokemonList
                      .filter((p) => {
                        if (lobbyGenFilter > 0 && p.id > genLimits[lobbyGenFilter]) return false;
                        const name = p.name.toLowerCase();
                        if (searchTerm && !name.includes(searchTerm)) return false;
                        if (hideLegendaries) {
                          if (legendaryMap[name]) return false;
                        }
                        if (pointsMap && Number(pointsMap[p.name]) === 0) return false;
                        return true;
                      }).map((p) => {
                        const isDisabled = (view === 'draft' && ((currentTurn && socket && socket.id !== currentTurn) || (socket && socket.id === currentTurn && localTeamForRender.length >= (lobbySettings.teamSizeLimit || 10))));
                        return (
                          <div key={p.id} className={`pokemon-card ${isDisabled ? 'disabled' : ''}`} onClick={() => { console.debug('card click', { id: p.id, isDisabled, socketId: socket && socket.id, currentTurn, view }); if (isDisabled) return; removePokemon(p.id); }}>
                            <img className="pokemon-img" src={p.img} alt={p.name} />
                            <div className="pokemon-name">{p.name}</div>
                          </div>
                        );
                      })
                    )}
                </div>
              </div>
            )}
          </div>
            <aside className="Sidebar">
              <h3>Selected Pokémon ({localTeamForRender.length} / {lobbySettings && lobbySettings.teamSizeLimit ? lobbySettings.teamSizeLimit : 10})</h3>
            <div className="mb-8">
              <button className="export-button" onClick={exportRemoved}>Export Team</button>
              <button className="export-button ml-8" onClick={saveTeamToCookie}>Save Team</button>
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

