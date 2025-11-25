const fs = require('fs');
const https = require('https');

// Read the existing pokemon_data.json
const pokemonData = JSON.parse(fs.readFileSync('./public/pokemon_data.json', 'utf8'));

console.log(`Found ${pokemonData.length} Pokemon to update`);

// Function to fetch data from PokeAPI
function fetchFromAPI(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
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

// Function to add a delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function updateAbilities() {
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < pokemonData.length; i++) {
    const pokemon = pokemonData[i];
    
    try {
      // Fetch Pokemon data from PokeAPI using the ID
      const url = `https://pokeapi.co/api/v2/pokemon/${pokemon.id}`;
      const apiData = await fetchFromAPI(url);
      
      // Extract abilities
      const abilities = apiData.abilities.map(a => a.ability.name);
      
      // Add abilities to the pokemon object
      pokemon.abilities = abilities;
      
      updated++;
      
      // Log progress every 50 Pokemon
      if ((i + 1) % 50 === 0) {
        console.log(`Progress: ${i + 1}/${pokemonData.length} (${updated} updated, ${failed} failed)`);
      }
      
      // Add a small delay to avoid rate limiting
      await delay(50);
      
    } catch (err) {
      console.error(`Failed to fetch abilities for Pokemon ID ${pokemon.id} (${pokemon.species_name}):`, err.message);
      pokemon.abilities = [];
      failed++;
    }
  }

  // Write the updated data back to the file
  fs.writeFileSync('./public/pokemon_data.json', JSON.stringify(pokemonData, null, 2));
  
  console.log(`\nUpdate complete!`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${pokemonData.length}`);
}

updateAbilities().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
