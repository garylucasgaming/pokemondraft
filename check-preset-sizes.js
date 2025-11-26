const p = require('./public/presets.json');
console.log('Total presets:', p.presets.length);
p.presets.forEach(preset => {
  console.log(`${preset.name}: ${Object.keys(preset.points).length} pokemon`);
});
