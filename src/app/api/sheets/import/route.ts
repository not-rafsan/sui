import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      console.error('CSV parse errors:', parsed.errors);
      return NextResponse.json(
        { error: 'Failed to parse CSV file', details: parsed.errors },
        { status: 400 }
      );
    }

    const rows = parsed.data as Record<string, string>[];

    // Group rows by Topic
    const topicGroups: Record<string, typeof rows> = {};
    for (const row of rows) {
      const topic = row['Topic'] || row['topic'] || row['TOPIC'] || 'Untitled';
      if (!topicGroups[topic]) {
        topicGroups[topic] = [];
      }
      topicGroups[topic].push(row);
    }

    const createdCarousels = [];

    for (const [topic, groupRows] of Object.entries(topicGroups)) {
      // Sort by chapter number
      groupRows.sort((a, b) => {
        const chapA = parseInt(a['Chapter'] || a['chapter'] || a['CHAPTER'] || '0', 10);
        const chapB = parseInt(b['Chapter'] || b['chapter'] || b['CHAPTER'] || '0', 10);
        return chapA - chapB;
      });

      const firstRow = groupRows[0];
      const titleField = firstRow['Title'] || firstRow['title'] || topic.toUpperCase();

      const slides = [
        {
          type: 'cover',
          title: titleField.toUpperCase(),
          subtitle: `THE COMPLETE ${topic.toUpperCase()} GUIDE`,
          accentText: `${groupRows.length} STEPS TO PROFIT`,
        },
        ...groupRows.map((row, index) => ({
          type: 'content',
          chapterNumber: index + 1,
          title: (row['Title'] || row['title'] || `Step ${index + 1}`).toUpperCase(),
          subtitle: row['Subtitle'] || row['subtitle'] || '',
          bulletPoints: (row['BulletPoints'] || row['bulletPoints'] || row['BULLETS'] || '')
            .split(';')
            .map((b: string) => b.trim())
            .filter(Boolean),
          earningPotential: row['EarningPotential'] || row['earningPotential'] || '',
        })),
        {
          type: 'cta',
          title: 'SAVE TO START',
          subtitle: 'FOLLOW FOR MORE',
          accentText: `#${topic.replace(/\s+/g, '').toUpperCase()}`,
        },
      ];

      const carousel = await db.carousel.create({
        data: {
          title: titleField.toUpperCase(),
          topic,
          slides: JSON.stringify(slides),
          caption: `Discover how to master ${topic.toLowerCase()} with these ${groupRows.length} proven steps. Save this for later! 🚀\n\n#${topic.replace(/\s+/g, '')} #AI #Business #Entrepreneurship #SideHustle`,
          status: 'ready',
        },
      });

      createdCarousels.push(carousel);
    }

    return NextResponse.json({
      success: true,
      count: createdCarousels.length,
      carousels: createdCarousels,
    }, { status: 201 });
  } catch (error) {
    console.error('Sheet import error:', error);
    return NextResponse.json({ error: 'Failed to import sheet' }, { status: 500 });
  }
}