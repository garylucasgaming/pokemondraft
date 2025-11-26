const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = path.join(__dirname, 'public', 'Copy of Draft League Example Draft Boards - Other Formats.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV (simple parser for this specific format)
const lines = csvContent.split('\n');

// Find the format name (line 5, column 3)
const formatLine = lines[4]; // 0-indexed, so line 5 is index 4
const formatMatch = formatLine.match(/,,([^,]+),/);
const formatName = formatMatch ? formatMatch[1].trim() : 'Unknown Format';

console.log(`Parsing format: ${formatName}`);

// Parse the point tier headers (line 3)
const headerLine = lines[2];
const headers = headerLine.split(',');

// Find point value columns (they contain "Points" or "Banned")
const pointColumns = [];
for (let i = 0; i < headers.length; i++) {
  const header = headers[i].trim();
  if (header.includes('Points') || header.includes('Banned')) {
    // Extract point value
    let pointValue = 0;
    if (header.includes('Banned')) {
      pointValue = 0;
    } else {
      const match = header.match(/(\d+)\s*Points?/);
      if (match) {
        pointValue = parseInt(match[1], 10);
      }
    }
    pointColumns.push({ index: i, value: pointValue });
  }
}

console.log(`Found ${pointColumns.length} point tiers`);

// Parse Pokemon entries (starting from line 5)
const pointsMap = {};

for (let lineIndex = 4; lineIndex < lines.length; lineIndex++) {
  const line = lines[lineIndex];
  if (!line.trim()) continue;
  
  const cells = line.split(',');
  
  // Pokemon appear in columns after the first banned entry
  for (const col of pointColumns) {
    // Check columns around this point tier (usually in groups of 3)
    for (let offset = 0; offset < 3; offset++) {
      const cellIndex = col.index + offset;
      if (cellIndex < cells.length) {
        const pokemonName = cells[cellIndex].trim();
        if (pokemonName && pokemonName.length > 0) {
          // Skip if it's a header or special text
          if (!pokemonName.includes('Points') && !pokemonName.includes('Banned')) {
            // Normalize the name (lowercase)
            const normalizedName = pokemonName.toLowerCase();
            // Only add if not already present (first occurrence = correct tier)
            if (!pointsMap[normalizedName]) {
              pointsMap[normalizedName] = col.value;
            }
          }
        }
      }
    }
  }
}

console.log(`Parsed ${Object.keys(pointsMap).length} Pokemon entries`);

// Create preset object
const preset = {
  id: formatName.toLowerCase().replace(/\s+/g, '-'),
  name: formatName,
  description: `Point values for ${formatName} format`,
  author: "Draft League Example",
  version: "1.0",
  pointsLimit: 100,
  teamSizeLimit: 10,
  points: pointsMap
};

// Read existing presets.json
const presetsPath = path.join(__dirname, 'public', 'presets.json');
let presetsData = { presets: [], metadata: { version: "1.0", lastUpdated: new Date().toISOString().split('T')[0], schemaVersion: 1 } };

try {
  const existingContent = fs.readFileSync(presetsPath, 'utf-8');
  presetsData = JSON.parse(existingContent);
} catch (err) {
  console.log('No existing presets.json, creating new one');
}

// Check if this preset already exists
const existingIndex = presetsData.presets.findIndex(p => p.id === preset.id);
if (existingIndex >= 0) {
  console.log(`Updating existing preset: ${preset.id}`);
  presetsData.presets[existingIndex] = preset;
} else {
  console.log(`Adding new preset: ${preset.id}`);
  presetsData.presets.push(preset);
}

// Update metadata
presetsData.metadata.lastUpdated = new Date().toISOString().split('T')[0];

// Write back to presets.json
fs.writeFileSync(presetsPath, JSON.stringify(presetsData, null, 2), 'utf-8');

console.log(`\nSuccessfully added ${formatName} preset to presets.json`);
console.log(`Total presets: ${presetsData.presets.length}`);
