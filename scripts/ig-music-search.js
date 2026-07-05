/**
 * Music search - searches local curated catalog.
 * Takes query from argv[2], outputs JSON array of matching tracks to stdout.
 * Also supports genre browsing: if query matches a genre exactly, return that genre.
 */

const catalog = require('./music-catalog');

const query = (process.argv[2] || '').toLowerCase().trim();

if (!query) {
  console.log(JSON.stringify({ tracks: [] }));
  process.exit(0);
}

// Score each track by relevance
const scored = catalog.map(track => {
  const searchText = `${track.title} ${track.artist} ${track.genre} ${track.vibe}`.toLowerCase();
  let score = 0;

  // Exact title or artist match = highest
  if (track.title.toLowerCase() === query) score = 100;
  else if (track.artist.toLowerCase() === query) score = 90;
  // Genre exact match
  else if (track.genre.toLowerCase() === query) score = 80;
  // Word matches
  else {
    const words = query.split(/\s+/);
    for (const word of words) {
      if (track.title.toLowerCase().includes(word)) score += 15;
      if (track.artist.toLowerCase().includes(word)) score += 12;
      if (track.genre.toLowerCase().includes(word)) score += 10;
      if (track.vibe.toLowerCase().includes(word)) score += 8;
    }
  }

  return { ...track, score };
});

// Sort by score, take top 10
const results = scored
  .filter(t => t.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 10)
  .map(({ score, ...track }) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    display_name: `${track.title} — ${track.artist}`,
    genre: track.genre,
    vibe: track.vibe,
  }));

console.log(JSON.stringify({ tracks: results }));