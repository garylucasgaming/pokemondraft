const fs = require('fs');
const path = require('path');

// Read the Data CSV file
const csvPath = path.join(__dirname, 'public', 'Copy of Draft League Example Draft Boards - Data.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV
const lines = csvContent.split('\n').map(line => line.split(','));

// Get headers (first row after skipping empty first column)
const headers = lines[0].slice(1, 10); // Columns B-J (SV, SS, SM, OA, V, ND, LC, U, 8N)
console.log('Format columns:', headers);

// Get format full names from column L (index 11)
const formatNames = {
  'SV.': 'SV OU',
  'SS.': 'SS OU', 
  'SM.': 'SM OU',
  'OA.': 'ORAS OU',
  'V.': 'VGC',
  'ND.': 'National Dex',
  'LC.': 'Little Cup',
  'U.': 'Natdex Ubers',
  '8N.': 'SS National Dex'
};

// Initialize presets for each format
const presets = {};
headers.forEach((header, index) => {
  const formatId = header.toLowerCase().replace('.', '').replace(/\s+/g, '-');
  const formatName = formatNames[header] || header.replace('.', '');
  presets[formatId] = {
    id: formatId,
    name: formatName,
    description: `Point values for ${formatName} format`,
    author: "Draft League Example",
    version: "1.0",
    pointsLimit: 100,
    teamSizeLimit: 10,
    points: {}
  };
});

// Parse Pokemon entries (skip header row)
let parsedCount = 0;
for (let i = 1; i < lines.length; i++) {
  const row = lines[i];
  if (row.length < 11) continue; // Skip incomplete rows
  
  const pokemonName = row[10]?.trim(); // Column K (index 10) has Pokemon name
  if (!pokemonName || pokemonName === 'Pokémon' || pokemonName === '-') continue;
  
  // Skip alternate forms that aren't needed (T = Tera, Z = Z-Move versions)
  if (pokemonName.includes('(T)') || pokemonName.includes('(Z)')) continue;
  
  // Parse point values for each format (columns B-J, indices 1-9)
  headers.forEach((header, headerIndex) => {
    const formatId = header.toLowerCase().replace('.', '').replace(/\s+/g, '-');
    const pointValue = row[headerIndex + 1]?.trim(); // +1 because first column is empty
    
    if (pointValue && pointValue !== '-' && !isNaN(pointValue)) {
      const points = parseInt(pointValue, 10);
      // Normalize pokemon name (lowercase, handle special cases)
      let normalizedName = pokemonName.toLowerCase()
        .replace(/♀/g, '-f')
        .replace(/♂/g, '-m')
        .replace(/\s+/g, '-')
        .replace(/[.']/g, '')
        .replace(/:/g, '');
      
      // Handle special name formats
      if (normalizedName.startsWith('mega-')) {
        normalizedName = 'mega-' + normalizedName.substring(5);
      }
      
      presets[formatId].points[normalizedName] = points;
    }
  });
  
  parsedCount++;
}

console.log(`Parsed ${parsedCount} Pokemon entries`);

// Read existing presets.json
const presetsPath = path.join(__dirname, 'public', 'presets.json');
let presetsData = { 
  presets: [], 
  metadata: { 
    version: "1.0", 
    lastUpdated: new Date().toISOString().split('T')[0], 
    schemaVersion: 1 
  } 
};

try {
  const existingContent = fs.readFileSync(presetsPath, 'utf-8');
  presetsData = JSON.parse(existingContent);
} catch (err) {
  console.log('No existing presets.json, creating new one');
}

// Add or update each format preset
Object.values(presets).forEach(preset => {
  const existingIndex = presetsData.presets.findIndex(p => p.id === preset.id);
  const pokemonCount = Object.keys(preset.points).length;
  
  if (pokemonCount === 0) {
    console.log(`Skipping ${preset.name} - no data`);
    return;
  }
  
  if (existingIndex >= 0) {
    console.log(`Updating ${preset.name} - ${pokemonCount} Pokemon`);
    presetsData.presets[existingIndex] = preset;
  } else {
    console.log(`Adding ${preset.name} - ${pokemonCount} Pokemon`);
    presetsData.presets.push(preset);
  }
});

// Update metadata
presetsData.metadata.lastUpdated = new Date().toISOString().split('T')[0];

// Write back to presets.json
fs.writeFileSync(presetsPath, JSON.stringify(presetsData, null, 2), 'utf-8');

console.log(`\nSuccessfully updated presets.json`);
console.log(`Total presets: ${presetsData.presets.length}`);
