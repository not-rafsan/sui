import { NextRequest, NextResponse } from 'next/server';

// Inline music catalog (no child_process needed — works on Render standalone)
const MUSIC_CATALOG = [
  { id: 'phonk_1', title: 'Murder In My Mind', artist: 'Kordhell', genre: 'Phonk', vibe: 'dark energetic' },
  { id: 'phonk_2', title: 'Close Eyes', artist: 'KSLV', genre: 'Phonk', vibe: 'dark atmospheric' },
  { id: 'phonk_3', title: 'Metamorphosis', artist: 'INTERWORLD', genre: 'Phonk', vibe: 'dark intense' },
  { id: 'phonk_4', title: 'Ra Ra Rasputin', artist: 'Boney M', genre: 'Phonk Remix', vibe: 'dark remix' },
  { id: 'phonk_5', title: 'OVERRIDE', artist: 'VXLLY', genre: 'Phonk', vibe: 'dark bass' },
  { id: 'lofi_1', title: 'Snowman', artist: 'Øneheart', genre: 'Lo-fi', vibe: 'chill relaxing' },
  { id: 'lofi_2', title: 'Still Breathing', artist: 'Øneheart & reidenshi', genre: 'Lo-fi', vibe: 'chill emotional' },
  { id: 'lofi_3', title: 'Dreams', artist: 'Joakim Karud', genre: 'Lo-fi', vibe: 'chill hopeful' },
  { id: 'lofi_4', title: 'Lofi Study', artist: 'FASSounds', genre: 'Lo-fi', vibe: 'chill focused' },
  { id: 'lofi_5', title: 'Coffee', artist: 'L.Dre', genre: 'Lo-fi Hip Hop', vibe: 'chill smooth' },
  { id: 'motiv_1', title: 'Eye of the Tiger', artist: 'Survivor', genre: 'Rock', vibe: 'motivational powerful' },
  { id: 'motiv_2', title: 'Lose Yourself', artist: 'Eminem', genre: 'Hip Hop', vibe: 'motivational intense' },
  { id: 'motiv_3', title: 'Stronger', artist: 'Kanye West', genre: 'Hip Hop', vibe: 'motivational upbeat' },
  { id: 'motiv_4', title: 'Titanium', artist: 'David Guetta ft. Sia', genre: 'EDM', vibe: 'motivational emotional' },
  { id: 'motiv_5', title: 'Unstoppable', artist: 'Sia', genre: 'Pop', vibe: 'motivational anthemic' },
  { id: 'cinem_1', title: 'Time', artist: 'Hans Zimmer', genre: 'Cinematic', vibe: 'cinematic epic' },
  { id: 'cinem_2', title: 'Interstellar Main Theme', artist: 'Hans Zimmer', genre: 'Cinematic', vibe: 'cinematic space' },
  { id: 'cinem_3', title: 'Cornfield Chase', artist: 'Hans Zimmer', genre: 'Cinematic', vibe: 'cinematic hopeful' },
  { id: 'cinem_4', title: 'Experience', artist: 'Ludovico Einaudi', genre: 'Cinematic', vibe: 'cinematic emotional' },
  { id: 'cinem_5', title: 'Day One', artist: 'Hans Zimmer', genre: 'Cinematic', vibe: 'cinematic building' },
  { id: 'trap_1', title: 'HUMBLE.', artist: 'Kendrick Lamar', genre: 'Trap', vibe: 'trap hard' },
  { id: 'trap_2', title: 'SICKO MODE', artist: 'Travis Scott', genre: 'Trap', vibe: 'trap psychedelic' },
  { id: 'trap_3', title: 'GOOSEBUMPS', artist: 'Travis Scott', genre: 'Trap', vibe: 'trap melodic' },
  { id: 'trap_4', title: 'Mask Off', artist: 'Future', genre: 'Trap', vibe: 'trap smooth' },
  { id: 'trap_5', title: 'Yes Indeed', artist: 'Lil Baby & Drake', genre: 'Trap', vibe: 'trap chill' },
  { id: 'synth_1', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Synthwave', vibe: 'retro energetic' },
  { id: 'synth_2', title: 'Nightcall', artist: 'Kavinsky', genre: 'Synthwave', vibe: 'retro moody' },
  { id: 'synth_3', title: 'A Real Hero', artist: 'College & Electric Youth', genre: 'Synthwave', vibe: 'retro driving' },
  { id: 'synth_4', title: 'Sunset', artist: 'The Midnight', genre: 'Synthwave', vibe: 'retro nostalgic' },
  { id: 'synth_5', title: 'Tech Noir', artist: 'Gunship', genre: 'Synthwave', vibe: 'retro cinematic' },
  { id: 'aesth_1', title: 'Run Boy Run', artist: 'Woodkid', genre: 'Indie', vibe: 'aesthetic urgent' },
  { id: 'aesth_2', title: 'Intro', artist: 'The xx', genre: 'Indie', vibe: 'aesthetic minimal' },
  { id: 'aesth_3', title: 'Midnight City', artist: 'M83', genre: 'Electronic', vibe: 'aesthetic dreamy' },
  { id: 'aesth_4', title: 'Genesis', artist: 'Grimes', genre: 'Art Pop', vibe: 'aesthetic ethereal' },
  { id: 'aesth_5', title: 'Breathe Deeper', artist: 'Tame Impala', genre: 'Psychedelic', vibe: 'aesthetic trippy' },
  { id: 'edm_1', title: 'Alone', artist: 'Marshmello', genre: 'EDM', vibe: 'edm uplifting' },
  { id: 'edm_2', title: 'Strobe', artist: 'deadmau5', genre: 'EDM', vibe: 'edm progressive' },
  { id: 'edm_3', title: 'Faded', artist: 'Alan Walker', genre: 'EDM', vibe: 'edm emotional' },
  { id: 'edm_4', title: 'Levels', artist: 'Avicii', genre: 'EDM', vibe: 'edm euphoric' },
  { id: 'edm_5', title: 'Clarity', artist: 'Zedd ft. Foxes', genre: 'EDM', vibe: 'edm melodic' },
  { id: 'hh_1', title: 'N.Y. State of Mind', artist: 'DJ Premier', genre: 'Hip Hop', vibe: 'hiphop classic' },
  { id: 'hh_2', title: 'Jesus Walks', artist: 'Kanye West', genre: 'Hip Hop', vibe: 'hiphop soulful' },
  { id: 'hh_3', title: 'Power', artist: 'Kanye West', genre: 'Hip Hop', vibe: 'hiphop anthemic' },
  { id: 'hh_4', title: 'Alright', artist: 'Kendrick Lamar', genre: 'Hip Hop', vibe: 'hiphop uplifting' },
  { id: 'hh_5', title: 'Runaway', artist: 'Kanye West', genre: 'Hip Hop', vibe: 'hiphop emotional' },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim() || '';

  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    // Score each track by relevance
    const scored = MUSIC_CATALOG.map(track => {
      const searchText = `${track.title} ${track.artist} ${track.genre} ${track.vibe}`.toLowerCase();
      let score = 0;

      if (track.title.toLowerCase() === query) score = 100;
      else if (track.artist.toLowerCase() === query) score = 90;
      else if (track.genre.toLowerCase() === query) score = 80;
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

    const tracks = scored
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

    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}