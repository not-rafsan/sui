import { NextRequest, NextResponse } from 'next/server';

const IS_RENDER = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 600, temperature = 0.9): Promise<string> {
  if (IS_RENDER) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) throw new Error('GEMINI_API_KEY env var not set. Add it in Render Environment settings.');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    return result.response.text() || '';
  } else {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, slides } = await request.json();
    if (!title || !slides?.length) {
      return NextResponse.json({ error: 'Title and slides are required' }, { status: 400 });
    }

    const contentSlides = slides.filter((s: Record<string, unknown>) => s.type === 'content');
    const checklistItems = contentSlides.map((s: Record<string, unknown>) => {
      const t = String(s.title || '').replace(/\n/g, ' ').trim();
      return t;
    }).join('", "');

    const systemPrompt = `You are an Instagram caption expert for a 3M+ follower business page. Generate ONE caption following this EXACT 6-part format:

PART 1 — OPENING (1-2 sentences):
"I just shared my [what it covers]—from [topic A] and [topic B] to [topic C] and [topic D]. If you are looking to [benefit 1], [benefit 2], and [benefit 3], this carousel is for you."

PART 2 — CHECKLIST (after blank line):
"Inside you will learn:" (with lightbulb emoji)
Then list each content slide topic with checkmark emoji, one per line (2-5 words each)

PART 3 — SAVE CTA (after blank line):
"Save this post so you can come back to it while [relevant activity]."

PART 4 — ENGAGEMENT (after blank line):
"Tell me in the comments:" (with pointing down emoji)
Then 1 specific question about the reader challenge related to the topic ending with "?"

PART 5 — SHARE + FOLLOW (after blank line):
"Share this with a friend who is [trying to / interested in] [related goal], and follow for more [niche] [content types]."

PART 6 — HASHTAGS (after blank line):
Exactly 5 relevant hashtags, space-separated.

Return ONLY the raw caption text. No JSON, no quotes, no explanation.`;

    const userPrompt = `Generate a caption for this carousel:\n\nTitle: "${title}"\nContent slide topics: "${checklistItems}"\n\nUse these exact slide topics in the checklist. Make the opening line reference these topics. Write a unique engagement question. Return ONLY the caption.`;

    const caption = await callAI(systemPrompt, userPrompt, 600, 0.9);
    const cleaned = (caption || '').replace(/^["']|["']$/g, '').trim();

    if (!cleaned) {
      return NextResponse.json({ error: 'AI returned empty response. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ caption: cleaned });
  } catch (error: unknown) {
    console.error('Caption regen error:', error);
    const message = error instanceof Error ? error.message : 'Failed to regenerate caption';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}