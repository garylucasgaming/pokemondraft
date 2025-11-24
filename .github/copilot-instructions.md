# Pokémon Draft — AI Agent Instructions

## Project Overview

A real-time multiplayer Pokémon drafting application built with React and Socket.IO. Players create lobbies, set point values for Pokémon, and take turns drafting teams with constraints (points budget, team size limits, generation filters).

## Architecture

### Client-Side (React SPA)

- **Single-component architecture**: All logic lives in `src/App.js` (~2100 lines)
- **State management**: React hooks (useState, useEffect) — no Redux or context providers
- **Real-time communication**: Socket.IO client for lobby sync, draft turns, and selections
- **Persistence**: localStorage for saved teams and ongoing drafts (cookies for username only)

### Key State Patterns

1. **Dual view system**: `view` state toggles between `'lobby'` (setup) and `'draft'` (active picking)
2. **Optimistic updates**: Local picks stored in `optimisticSelections` before server confirmation
3. **Merged state**: `getMergedSelectionsForUser()` combines server `remoteSelections` + local `optimisticSelections` for immediate UI feedback
4. **Draft snapshot**: `draftPokemonList` freezes available Pokémon when draft starts (prevents mid-draft filter changes)

### Socket Events (Client → Server)

- `create_lobby`, `join_lobby`, `leave_lobby`: Lobby lifecycle
- `start_draft`: Host initiates drafting phase
- `select_pokemon`: Player picks a Pokémon (server validates turn + points)
- `update_settings`: Host changes points limit, team size, gen filter
- `set_points`: Host assigns point value to a Pokémon (1-20 or 0 for banned)
- `import_points`: Bulk upload point values from JSON/CSV file

### Socket Events (Server → Client)

- `lobby_update`: Full lobby state sync (users, settings, selections, turn order)
- `draft_started`: Transitions all clients to draft view with frozen Pokémon list
- `user_selected`: Broadcasts confirmed pick (removes optimistic state, updates all clients)
- `selections_update`: Full selections sync (reconciles optimistic picks)
- `select_rejected`: Reverts local optimistic pick (reasons: not your turn, insufficient points, already selected)
- `turn_update`, `points_update`: Real-time turn rotation and points tracking

## Critical Workflows

### Development Commands

```bash
npm start          # Dev server on http://localhost:3000
npm test           # Jest test runner (interactive)
npm run build      # Production build to /build
```

### Socket Connection Setup

```javascript
// Default socket URL derivation (App.js ~line 1401)
const socketUrl =
  process.env.REACT_APP_SOCKET_URL ||
  (process.env.NODE_ENV === "production"
    ? window.location.origin
    : "http://localhost:4000");
```

**Important**: Socket server is expected at port 4000 in dev. Set `REACT_APP_SOCKET_URL` to override.

### Data Validation & Sanitization

All user inputs are sanitized before localStorage persistence:

- **Lobby codes**: 4-12 uppercase alphanumeric characters (`sanitizeLobbyCode`)
- **Points**: Clamped to 0-1000 (`sanitizePoints`)
- **Team size**: Clamped to 1-60 (`sanitizeTeamSize`)
- **Schema versioning**: `CURRENT_SCHEMA_VERSION = 1` for saved teams/drafts
- **Expiry checks**: Teams expire after 90 days, ongoing drafts after 30 days

### Pokémon List Filtering Logic

```javascript
// Generation limits (App.js ~line 1031)
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
  9: 1010,
};

// Heuristic alternate-form exclusion (App.js ~line 870-900)
// Excludes: mega, gmax, totem, primal, etc.
// Keeps: regional variants (Alola, Galar, Hisui), hyphenated species (Jangmo-o, Porygon-Z)
```

**Why**: API returns 2000+ entries including alternate forms. Heuristic filters reduce to ~1010 base/regional forms.

### Points System

- **Default cost**: 1 point per Pokémon (if not in `pointsMap`)
- **Banned**: Set cost to 0 (hides from draft grid)
- **Host controls**: Only lobby host can assign points or import settings
- **Export/Import**: CSV format `name,points` or JSON `{"name": points}`

### Saved Teams & Rejoining

- **Auto-save on leave**: Leaving an active draft saves team + lobby metadata to localStorage
- **Rejoin flow**: "Ongoing Drafts" panel shows saved lobbies → rejoin restores team optimistically
- **Waiting state**: `waitingForPlayers` prevents picking until all expected players reconnect
- **Points restoration**: Saved `pointsRemainingByName` maps player names to their points (survives reconnects with new socket IDs)

## Code Conventions

### Naming Patterns

- **State setters**: Prefix with `set` (e.g., `setLobbyCode`, `setPokemonList`)
- **Event handlers**: Prefix with `handle` (e.g., `handleLeaveDraftButton`, `handleImportPointsFile`)
- **Utility functions**: Verb-first (e.g., `copyToClipboard`, `sanitizeLobbyCode`, `fetchLegendaryStatuses`)
- **Pokémon names**: Lowercase in code/storage, capitalize for display via `toShowdownName()`

### Error Handling

- **Validation failures**: Silent guards with console warnings (no user alerts unless critical)
- **Socket errors**: `.on('error')` logs + optional user notification
- **localStorage quota**: Try/catch blocks with fallback messages (App.js ~line 330, 400)

### Component Structure

- **Pages folder**: Footer pages (Credits, Contact, Privacy, Copyright) as separate components
- **Single App component**: No routes (HashRouter would be used if adding multi-page navigation)
- **Inline styles**: Minimal (moved to `App.css` for maintainability)

## External Dependencies

### Data Sources

- **PokéAPI**: Pokémon list (`https://pokeapi.co/api/v2/pokemon?limit=2000`), species legendary status
- **PokeAPI Sprites**: GitHub CDN for images (`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`)

### Libraries

- `react` + `react-dom` v19.2.0: Core framework
- `socket.io-client` v4.7.2: Real-time communication
- `axios`: HTTP requests (imported but could use `fetch` API)
- `@testing-library/*`: Jest + React Testing Library for tests

### Security

- **CSP header** in `public/index.html`: Restricts script/style sources, allows PokéAPI + localhost WebSocket
- **No backend authentication**: Lobbies are ephemeral, no user accounts or API keys

## Common Pitfalls

1. **Optimistic picks not clearing**: Ensure `select_rejected` handler removes from `optimisticSelections[myId]`
2. **Draft list vs full list**: Use `draftPokemonList` during draft view (frozen at start), `pokemonList` in lobby
3. **Socket ID vs display name**: Server events may key by socket ID or player name — check both in `remoteSelections`
4. **Turn enforcement**: `removePokemon()` guards against non-turn picks (`currentTurn !== socket.id`)
5. **Points map normalization**: Always lowercase keys via `normalizePointsMap()` before state updates

## Testing Strategy

- **Unit tests**: `App.test.js` (placeholder — expand with React Testing Library)
- **Manual testing**: Multi-tab localhost sessions to simulate multiplayer
- **Edge cases**: Reconnects, mid-draft leaves, expired saved teams

## Deployment Notes

- **Build output**: `npm run build` → `/build` directory (static hosting ready)
- **Socket server**: Separate Node.js backend required (not in this repo)
- **Environment variables**: Set `REACT_APP_SOCKET_URL` for production WebSocket endpoint

---

**Quick Start for AI Agents**: Read `App.js` lines 1-100 (state declarations), 1401-1700 (socket handlers), and 1143-1300 (core actions like `removePokemon`, `createLobby`, `startDraft`). The app is a state machine with two views; understand the lobby→draft transition to grasp the architecture.
