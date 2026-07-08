import { NextRequest, NextResponse } from 'next/server';

const IS_RENDER = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 600, temperature = 0.9) {
  if (IS_RENDER) {
    const token = process.env.ZAI_TOKEN || '';
    if (!token) throw new Error('ZAI_TOKEN env var not set on Render');

    const baseUrl = process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'default',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`AI API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
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

    // Extract content slide titles for the checklist
    const contentSlides = slides.filter((s: Record<string, unknown>) => s.type === 'content');
    const checklistItems = contentSlides.map((s: Record<string, unknown>) => {
      const t = String(s.title || '').replace(/\n/g, ' ').trim();
      return t;
    }).join('", "');

    const systemPrompt = `You are an Instagram caption expert for a 3M+ follower business page. Generate ONE caption following this EXACT 6-part format:

PART 1 — OPENING (1-2 sentences):
"I just shared my [what it covers]—from [topic A] and [topic B] to [topic C] and [topic D]. If you're looking to [benefit 1], [benefit 2], and [benefit 3], this carousel is for you."

PART 2 — CHECKLIST (after blank line):
"💡 Inside you'll learn:"
"✅ [topic 1]"
"✅ [topic 2]"
...one per content slide

PART 3 — SAVE CTA (after blank line):
"Save this post so you can come back to it while [relevant activity]."

PART 4 — ENGAGEMENT (after blank line):
"👇 Tell me in the comments:"
"[One specific question about the reader's challenge/opinion related to the topic]?"

PART 5 — SHARE + FOLLOW (after blank line):
"Share this with a friend who's [trying to / interested in] [related goal], and follow for more [niche] [content types]."

PART 6 — HASHTAGS (after blank line):
Exactly 5 relevant hashtags, space-separated.

EXAMPLE:
I just shared my complete AI-powered dropshipping blueprint—from product research and content creation to automation workflows and scaling strategies. If you're looking to save time, reduce manual work, and build smarter systems, this carousel is for you.

💡 Inside you'll learn:
✅ AI product research
✅ Store setup workflow
✅ Marketing automation
✅ Content generation
✅ Customer support automation
✅ Scaling strategy

Save this post so you can come back to it while building your store.

👇 Tell me in the comments:
What's the biggest challenge stopping you from starting an AI-powered business?

Share this with a friend who's trying to make money online, and follow for more practical AI systems, automations, and business blueprints.

#AI #Dropshipping #AIAutomation #OnlineBusiness #SideHustle

Return ONLY the raw caption text. No JSON, no quotes, no explanation.`;

    const userPrompt = `Generate a caption for this carousel:\n\nTitle: "${title}"\nContent slide topics: "${checklistItems}"\n\nUse these exact slide topics in the ✅ checklist. Make the opening line reference these topics. Write a unique engagement question. Return ONLY the caption.`;

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