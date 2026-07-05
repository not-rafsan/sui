import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { title, slides } = await request.json();
    if (!title || !slides?.length) {
      return NextResponse.json({ error: 'Title and slides are required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    // Build a compact summary of slide content so the AI has context
    const slideSummaries = slides.map((s: Record<string, unknown>, i: number) => {
      if (s.type === 'cover') return `Slide ${i + 1} (Cover): ${s.title}`;
      if (s.type === 'cta') return `Slide ${i + 1} (CTA): ${s.title}`;
      return `Slide ${i + 1} (Ch${s.chapterNumber}): ${s.title} — ${s.subtitle}`;
    }).join('\n');

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an Instagram caption expert for a 3M+ follower business page. Generate ONE viral caption.

STRUCTURE (follow exactly):
Line 1: Hook — a single punchy sentence that creates curiosity or FOMO. No period at the end. Make someone STOP scrolling.
Line 2: (blank)
Line 3-5: Body — 2-3 short, punchy sentences. Each on its own line. Include at least ONE specific number (dollar amount, percentage, or timeframe). Conversational tone. Add NEW insight not in the carousel.
Line 6: (blank)
Line 7: Exactly 5 hashtags, space-separated. Mix 2 popular, 2 mid-tier, 1 niche. No generic tags.

BAD: "Transform your business with AI! #AI #Business"
GOOD: "I ignored this AI strategy for 8 months and it cost me $47K in lost revenue

The moment I automated my product research everything shifted

Week 1: $200 profit. Month 2: $3,400. Month 5: $11K consistent

The tools do 90% of the work — you just need to set them up once

Save this before the algorithm buries it

#AIBusiness #MakeMoneyOnline #PassiveIncomeTips #AutomationBusiness #SideHustleIdeas2025"

Return ONLY the raw caption text. No JSON, no quotes, no explanation.`
        },
        {
          role: 'user',
          content: `Generate a viral Instagram caption for this carousel:\n\nTitle: "${title}"\n\nSlide breakdown:\n${slideSummaries}\n\nReturn ONLY the caption text.`
        }
      ],
      temperature: 0.85,
      max_tokens: 500,
    });

    const caption = response.choices[0]?.message?.content?.trim() || '';
    // Strip any wrapping quotes the AI might add
    const cleaned = caption.replace(/^["']|["']$/g, '').trim();

    return NextResponse.json({ caption: cleaned });
  } catch (error: unknown) {
    console.error('Caption regen error:', error);
    const message = error instanceof Error ? error.message : 'Failed to regenerate caption';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}