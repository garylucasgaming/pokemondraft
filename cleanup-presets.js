const fs = require('fs');
const path = require('path');

// Read existing presets.json
const presetsPath = path.join(__dirname, 'public', 'presets.json');
const presetsData = JSON.parse(fs.readFileSync(presetsPath, 'utf-8'));

// IDs to remove (our previously created ones)
const idsToRemove = [
  'balanced-competitive',
  'casual-fun', 
  'no-legendaries',
  'gen1-only',
  'pseudo-legendary-focus',
  'national-dex' // This was from the first CSV parse
];

// Filter out the old presets
const filteredPresets = presetsData.presets.filter(preset => 
  !idsToRemove.includes(preset.id)
);

console.log(`Removed ${presetsData.presets.length - filteredPresets.length} presets`);
console.log(`Remaining presets: ${filteredPresets.length}`);

filteredPresets.forEach(preset => {
  console.log(`  - ${preset.name} (${preset.id})`);
});

// Update the data
presetsData.presets = filteredPresets;
presetsData.metadata.lastUpdated = new Date().toISOString().split('T')[0];

// Write back
fs.writeFileSync(presetsPath, JSON.stringify(presetsData, null, 2), 'utf-8');

console.log('\nSuccessfully cleaned up presets.json');
