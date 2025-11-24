const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 5000;

function fetchRemote(remoteUrl, res) {
  https.get(remoteUrl, (r) => {
    let data = '';
    r.on('data', (chunk) => data += chunk);
    r.on('end', () => {
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': r.headers['content-type'] || 'text/html; charset=utf-8'
      };
      res.writeHead(200, headers);
      res.end(data);
    });
  }).on('error', (err) => {
    res.writeHead(502, { 'Access-Control-Allow-Origin': '*' });
    res.end('Proxy fetch error: ' + String(err));
  });
}

const server = http.createServer((req, res) => {
  // allow CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const parts = parsed.pathname.split('/').filter(Boolean);

  // /formats -> fetch formats-data.json from Showdown repo
  if (parsed.pathname === '/formats' || parsed.pathname === '/formats-data.json') {
    const remote = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/formats-data.json';
    fetchRemote(remote, res);
    return;
  }

  // /tier/<name> -> fetch dex.pokemonshowdown.com/tiers/<name>
  if (parts[0] === 'tier' && parts[1]) {
    const tier = parts[1];
    const remote = `https://dex.pokemonshowdown.com/tiers/${tier}`;
    fetchRemote(remote, res);
    return;
  }

  // default: show a small help page
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('Proxy server running. Available endpoints:\n - /formats -> formats-data.json\n - /tier/<tier> -> dex.pokemonshowdown.com/tiers/<tier>\n');
});

server.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
