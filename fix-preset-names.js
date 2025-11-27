const fs = require('fs');
const https = require('https');
const http = require('http');

// Fetch data from a URL
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Build a comprehensive mapping of preset names -> PokeAPI names
async function buildNameMapping() {
  console.log('Fetching Pokemon list from PokeAPI...');
  const data = await fetchJSON('https://pokeapi.co/api/v2/pokemon?limit=2000');
  const allPokemon = data.results.map(p => p.name);
  
  const mapping = {};
  
  // Create direct mappings
  allPokemon.forEach(name => {
    mapping[name] = name; // Direct match
  });
  
  // Handle special cases
  allPokemon.forEach(name => {
    const lower = name.toLowerCase();
    
    // Regional forms: alolan-sandslash <-> sandslash-alola
    if (lower.includes('-alola')) {
      const base = lower.replace('-alola', '');
      mapping[`alolan-${base}`] = name;
    }
    if (lower.includes('-galar')) {
      const base = lower.replace('-galar', '');
      mapping[`galarian-${base}`] = name;
    }
    if (lower.includes('-hisui')) {
      const base = lower.replace('-hisui', '');
      mapping[`hisuian-${base}`] = name;
    }
    if (lower.includes('-paldea')) {
      const base = lower.replace('-paldea', '');
      mapping[`paldean-${base}`] = name;
    }
    
    // Mega forms: mega-charizard-x <-> charizard-mega-x
    if (lower.includes('-mega')) {
      const parts = lower.split('-mega');
      const base = parts[0];
      const suffix = parts[1] || '';
      if (suffix) {
        mapping[`mega-${base}${suffix}`] = name;
      } else {
        mapping[`mega-${base}`] = name;
      }
    }
    
    // Gmax forms
    if (lower.includes('-gmax')) {
      const parts = lower.split('-gmax');
      const base = parts[0];
      const suffix = parts[1] || '';
      if (suffix) {
        mapping[`gmax-${base}${suffix}`] = name;
      } else {
        mapping[`gmax-${base}`] = name;
      }
    }
    
    // Eternamax Eternatus: eternamax-eternatus <-> eternatus-eternamax
    if (lower === 'eternatus-eternamax') {
      mapping['eternamax-eternatus'] = name;
    }
    
    // Nidoran special cases
    if (lower === 'nidoran-m') {
      mapping['nidoran-male'] = name;
    }
    if (lower === 'nidoran-f') {
      mapping['nidoran-female'] = name;
    }
    
    // Mr. Mime special cases
    if (lower === 'mr-mime') {
      mapping['mr.mime'] = name;
      mapping['mr. mime'] = name;
    }
    if (lower === 'mr-mime-galar') {
      mapping['galarian-mr.mime'] = name;
      mapping['galarian-mr. mime'] = name;
    }
    
    // Mime Jr.
    if (lower === 'mime-jr') {
      mapping['mime-jr.'] = name;
      mapping['mime jr.'] = name;
      mapping['mime jr'] = name;
    }
    
    // Farfetch'd
    if (lower === 'farfetchd') {
      mapping["farfetch'd"] = name;
      mapping['farfetchd'] = name;
    }
    if (lower === 'farfetchd-galar') {
      mapping["galarian-farfetch'd"] = name;
      mapping['galarian-farfetchd'] = name;
    }
    
    // Sirfetch'd
    if (lower === 'sirfetchd') {
      mapping["sirfetch'd"] = name;
    }
    
    // Type: Null
    if (lower === 'type-null') {
      mapping['type:null'] = name;
      mapping['type: null'] = name;
    }
    
    // Porygon-Z
    if (lower === 'porygon-z') {
      mapping['porygonz'] = name;
      mapping['porygon z'] = name;
    }
    
    // Jangmo-o, Hakamo-o, Kommo-o
    if (lower === 'jangmo-o') {
      mapping['jangmoo'] = name;
    }
    if (lower === 'hakamo-o') {
      mapping['hakamoo'] = name;
    }
    if (lower === 'kommo-o') {
      mapping['kommoo'] = name;
    }
    
    // Ho-Oh
    if (lower === 'ho-oh') {
      mapping['hooh'] = name;
      mapping['ho oh'] = name;
    }
  });
  
  return mapping;
}

// Update presets file
async function updatePresets() {
  try {
    const mapping = await buildNameMapping();
    
    console.log('Reading presets.json...');
    const presetsPath = './public/presets.json';
    const presetsData = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
    
    let totalUpdated = 0;
    let notFoundList = [];
    
    presetsData.presets.forEach(preset => {
      console.log(`\nProcessing preset: ${preset.name}`);
      const oldPoints = { ...preset.points };
      const newPoints = {};
      let presetUpdated = 0;
      let hasMega = false;
      let hasGmax = false;
      let changed99to0 = 0;
      
      Object.keys(preset.points).forEach(pokemonName => {
        const lower = pokemonName.toLowerCase().trim();
        let pointValue = preset.points[pokemonName];
        
        // Change 99 to 0 (banned)
        if (pointValue === 99) {
          pointValue = 0;
          changed99to0++;
        }
        
        // Check if this preset has mega or gmax pokemon
        if (lower.includes('-mega') || lower.includes('mega-')) {
          hasMega = true;
        }
        if (lower.includes('-gmax') || lower.includes('gmax-') || lower.includes('eternamax')) {
          hasGmax = true;
        }
        
        // Try to find a mapping
        if (mapping[lower]) {
          newPoints[mapping[lower]] = pointValue;
          if (mapping[lower] !== lower) {
            presetUpdated++;
            console.log(`  ${pokemonName} -> ${mapping[lower]}`);
          }
        } else {
          // Keep original if no mapping found
          newPoints[pokemonName] = pointValue;
          notFoundList.push({ preset: preset.name, pokemon: pokemonName });
          console.log(`  ⚠️  No mapping found for: ${pokemonName}`);
        }
      });
      
      preset.points = newPoints;
      
      // Add allowMega and allowGmax flags
      if (hasMega) {
        preset.allowMega = true;
        console.log(`  ✅ Added allowMega: true`);
      }
      if (hasGmax) {
        preset.allowGmax = true;
        console.log(`  ✅ Added allowGmax: true`);
      }
      if (changed99to0 > 0) {
        console.log(`  ✅ Changed ${changed99to0} Pokemon from 99 points to 0 (banned)`);
      }
      
      totalUpdated += presetUpdated;
      console.log(`  Updated ${presetUpdated} Pokemon names in this preset`);
    });
    
    // Write updated presets
    console.log('\nWriting updated presets.json...');
    fs.writeFileSync(presetsPath, JSON.stringify(presetsData, null, 2), 'utf8');
    
    console.log(`\n✅ Done! Updated ${totalUpdated} Pokemon names across all presets`);
    
    if (notFoundList.length > 0) {
      console.log(`\n⚠️  ${notFoundList.length} Pokemon names could not be mapped:`);
      notFoundList.forEach(item => {
        console.log(`   ${item.preset}: ${item.pokemon}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updatePresets();
