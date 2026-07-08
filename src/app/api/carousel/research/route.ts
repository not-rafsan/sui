import { NextRequest, NextResponse } from 'next/server';

const IS_RENDER = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

/**
 * AI call helper — dual mode:
 *   Local:  z-ai-web-dev-sdk (internal Z.ai network)
 *   Render: Google Gemini (free, public API)
 */
async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 4000, temperature = 0.7): Promise<string> {
  if (IS_RENDER) {
    // Render: use Google Gemini (free tier, works from anywhere)
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
    // Local: use z-ai-web-dev-sdk
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

const SYSTEM_PROMPT = `You are an expert Instagram content strategist for a 3M+ follower business page focused on AI-powered business ideas. You create viral, high-quality carousel content that educates and inspires entrepreneurs.

When given a topic, you must research and generate a complete Instagram carousel with 4-7 chapters. Each chapter represents a progressive step toward earning money using AI or the given business concept.

YOUR RESEARCH PROCESS:
1. Think deeply about the most current, actionable, and profitable angles for the given topic
2. Research real-world examples, tools, and strategies
3. Structure content as a progressive money-earning journey
4. Make each chapter build on the previous one
5. Include specific, actionable advice (not vague tips)

OUTPUT FORMAT - Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "title": "SHORT ATTENTION-GRABBING TITLE IN ALL CAPS",
  "caption": "...",
  "slides": [
    {
      "type": "cover",
      "title": "MAIN HEADLINE",
      "subtitle": "Supporting text or timeframe",
      "accentText": "Optional small accent text"
    },
    {
      "type": "content",
      "chapterNumber": 1,
      "title": "CHAPTER TITLE",
      "subtitle": "Brief description",
      "bulletPoints": ["Point 1 with specific detail", "Point 2 with actionable step", "Point 3 with tool or resource", "Point 4 with expected outcome"],
      "earningPotential": "$X,XXX - $XX,XXX/mo"
    }
  ]
}

RULES:
- Generate exactly CHAPTER_COUNT content chapters (plus 1 cover + 1 CTA = CHAPTER_COUNT + 2 total slides)
- Cover slide title: Must be 3-5 words, ALL CAPS. The most important/impactful word should naturally be the longest word (it will be displayed BIGGER). Example: "AI AUTOMATED DROPSHIPPING SYSTEM" or "PASSIVE INCOME MACHINE BLUEPRINT"
- Cover slide subtitle: timeframe or hook like "IN 7 DAYS ONLY" or "STEP BY STEP GUIDE", ALL CAPS, under 8 words
- Cover slide accentText: a small label like "THE COMPLETE GUIDE" or "MONEY MAKING GUIDE"
- Content slides: progressive journey from getting started to scaling earnings
- Each content slide has 3-5 concise bullet points (5-12 words each)
- CTA slide: "SAVE TO START" as title, "FOLLOW FOR MORE" as subtitle, "@YOURHANDLE" as accentText
- All text should be concise and punchy (Instagram carousel style for a 3M+ follower page)
- Use real, specific numbers and tools where possible
- earningPotential should be realistic and progressive
- Keep bullet points SHORT — each 5-12 words max for clean layout

CAPTION RULES (CRITICAL):
The caption must follow this EXACT 6-part structure:

PART 1 — OPENING LINE (1-2 sentences):
- Start with "I just shared my [what the carousel covers]"
- Use em-dash to list 2-4 key topics: "from [topic A] and [topic B] to [topic C] and [topic D]"
- End with: "If you are looking to [benefit 1], [benefit 2], and [benefit 3], this carousel is for you."

PART 2 — CHECKLIST (after a blank line):
- "Inside you will learn:" (with lightbulb emoji)
- Then list each content slide topic with checkmark emoji, one per line
- Each line = 2-5 words, just the key topic from that slide

PART 3 — SAVE CTA (after a blank line):
- "Save this post so you can come back to it while [relevant activity]."

PART 4 — ENGAGEMENT QUESTION (after a blank line):
- "Tell me in the comments:" (with pointing down emoji)
- Then 1 question about the reader specific challenge related to the topic, ending with "?"

PART 5 — SHARE + FOLLOW (after a blank line):
- "Share this with a friend who is [trying to / interested in] [related goal], and follow for more [niche] [content types]."

PART 6 — HASHTAGS (after a blank line):
- Exactly 5 hashtags, space-separated, relevant to the specific topic`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, chapterCount = 5 } = body;

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    // Build the system prompt with correct chapter count
    const systemPrompt = SYSTEM_PROMPT.replace(/CHAPTER_COUNT/g, String(chapterCount));

    const userPrompt = `Create a high-quality Instagram carousel about: "${topic}"

Generate ${chapterCount} content chapters that form a progressive journey to earning money. Make the content specific, actionable, and worthy of a 3M+ follower business page. Include real tools, realistic earnings, and step-by-step progression.

For the caption: follow the 6-part format EXACTLY as described. The checklist items MUST match the actual slide topics you generate. The engagement question must be specific to the topic.

Return ONLY the JSON object, no other text.`;

    const content = await callAI(systemPrompt, userPrompt, 4000, 0.7);

    if (!content) {
      return NextResponse.json({ error: 'AI returned empty response. Please try again.' }, { status: 500 });
    }

    // Robust JSON extraction
    let jsonStr = content.trim();

    // Remove markdown code fences
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    // Extract JSON object if there is surrounding text
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    // Fix trailing commas
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

    let carouselData: Record<string, unknown>;
    try {
      carouselData = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('JSON parse error, raw content:', content.substring(0, 500));
      console.error('Cleaned content:', jsonStr.substring(0, 500));
      console.error('Parse error:', parseErr);
      return NextResponse.json({ error: 'AI returned invalid data. Please try again.' }, { status: 500 });
    }

    // Validate the structure
    if (!carouselData.slides || !Array.isArray(carouselData.slides)) {
      return NextResponse.json({ error: 'Invalid carousel data structure' }, { status: 500 });
    }

    // Normalize slide data
    carouselData.slides = carouselData.slides.map((slide: Record<string, unknown>, idx: number) => {
      if (idx === 0 && slide.type !== 'cta') slide.type = 'cover';
      else if (idx === carouselData.slides.length - 1 && slide.type !== 'cover') slide.type = 'cta';
      else if (!slide.type) slide.type = 'content';

      if (slide.type === 'content') {
        if (!Array.isArray(slide.bulletPoints)) {
          slide.bulletPoints = slide.bulletPoints
            ? String(slide.bulletPoints).split('\n').filter(Boolean).slice(0, 5)
            : ['Key insight about this step', 'Actionable strategy to implement', 'Tool or resource to use'];
        }
        if (!slide.chapterNumber) slide.chapterNumber = idx;
        if (!slide.title) slide.title = 'CHAPTER ' + slide.chapterNumber;
        if (!slide.subtitle) slide.subtitle = '';
        if (!slide.earningPotential) slide.earningPotential = '';
      }
      if (slide.type === 'cover' || slide.type === 'cta') {
        if (!slide.title) slide.title = slide.type === 'cover' ? 'YOUR TITLE' : 'SAVE TO START';
        if (!slide.subtitle) slide.subtitle = '';
      }
      return slide;
    });

    return NextResponse.json(carouselData);
  } catch (error: unknown) {
    console.error('Research error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate carousel content';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}