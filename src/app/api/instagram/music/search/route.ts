import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { join } from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const scriptPath = join(process.cwd(), 'scripts', 'ig-music-search.js');

    const result = await new Promise<{ tracks: unknown[] }>((resolve) => {
      const child = execFile(
        'node',
        [scriptPath, query],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) { resolve({ tracks: [] }); return; }
          try { resolve(JSON.parse(stdout)); }
          catch { resolve({ tracks: [] }); }
        }
      );
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}