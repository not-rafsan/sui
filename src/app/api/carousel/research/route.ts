import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, chapterCount = 5 } = body;

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const systemPrompt = `You are an expert Instagram content strategist for a 3M+ follower business page focused on AI-powered business ideas. You create viral, high-quality carousel content that educates and inspires entrepreneurs.

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
  "caption": "VIRAL HOOK LINE that stops the scroll\\n\\n2-3 short sentences of value-packed body text that expand on the carousel topic. Use line breaks between sentences. Be specific, not generic. Mention a number, result, or consequence.\\n\\n#Hashtag1 #Hashtag2 #Hashtag3 #Hashtag4 #Hashtag5",
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
    },
    {
      "type": "content",
      "chapterNumber": 2,
      ...
    }
  ],
  "slides": [
    // First slide is always type "cover"
    // Middle slides are type "content" (4-6 of them)
    // Last slide is always type "cta" with: title, subtitle, accentText
  ]
}

RULES:
- Generate exactly ${chapterCount} content chapters (plus 1 cover + 1 CTA = ${chapterCount + 2} total slides)
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

CAPTION RULES (CRITICAL — this determines reach):
The caption must follow this exact 3-part structure:

PART 1 — HOOK (first line, before any blank line):
- A single punchy sentence that creates curiosity, urgency, or FOMO
- Use patterns like: "Nobody talks about this but...", "I wasted 2 years before I discovered...", "This single shift took me from $0 to $10K/mo"
- Must make someone STOP scrolling. No generic motivational fluff.
- End the hook with NO period — let it hang for impact

PART 2 — BODY (after the hook, 2-3 lines separated by blank lines):
- Short, punchy sentences that deliver on the hook's promise
- Include at least ONE specific number (percentage, dollar amount, timeframe, or count)
- Write in a conversational, direct tone — like texting a friend who asks "how'd you do it?"
- Each sentence should be 1 line (not wrapped paragraphs). Use line breaks between them.
- Do NOT repeat what's already on the carousel slides — add NEW insight or context

PART 3 — HASHTAGS (last line, after a blank line):
- Exactly 5 hashtags, space-separated
- Mix: 2 mega-popular (1M+ posts), 2 mid-tier (100K-1M), 1 niche/specific
- No generic tags like #love #instagood #photo
- Tags must be relevant to the specific topic, not the same 5 every time

BAD EXAMPLE: "Transform your e-commerce game with AI-powered automation. From product discovery to profit maximization - complete system revealed. #AI #Dropshipping #Ecommerce #Automation #PassiveIncome"
GOOD EXAMPLE: "Everyone's building the wrong kind of online business in 2025

I discovered this AI dropshipping system 6 months ago and it completely changed everything

The first week I made $340 profit. By month 3 I hit $4,200. The secret? Letting AI handle every single repetitive task

Save this before you spend another dollar on courses

#Dropshipping #AIBusiness #MakeMoneyOnline #EcommerceTips #SideHustle2025"`;

    const userPrompt = `Create a high-quality Instagram carousel about: "${topic}"

Generate ${chapterCount} content chapters that form a progressive journey to earning money. Make the content specific, actionable, and worthy of a 3M+ follower business page. Include real tools, realistic earnings, and step-by-step progression.

Pay EXTRA attention to the caption — the hook line must be scroll-stopping and the body must include specific numbers. The hashtags must be unique to this topic, not generic.

Return ONLY the JSON object, no other text.`;

    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';

    // Robust JSON extraction — handle various LLM output formats
    let jsonStr = content.trim();

    // Remove markdown code fences (```json ... ``` or ``` ... ```)
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    // Try to extract JSON object if there's surrounding text
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    // Fix common JSON issues: trailing commas
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

    // Normalize slide data - ensure bulletPoints is always an array
    carouselData.slides = carouselData.slides.map((slide: Record<string, unknown>, idx: number) => {
      // Ensure type field
      if (idx === 0 && slide.type !== 'cta') slide.type = 'cover';
      else if (idx === carouselData.slides.length - 1 && slide.type !== 'cover') slide.type = 'cta';
      else if (!slide.type) slide.type = 'content';

      // Ensure bulletPoints is an array
      if (slide.type === 'content') {
        if (!Array.isArray(slide.bulletPoints)) {
          slide.bulletPoints = slide.bulletPoints
            ? String(slide.bulletPoints).split('\n').filter(Boolean).slice(0, 5)
            : ['Key insight about this step', 'Actionable strategy to implement', 'Tool or resource to use'];
        }
        // Ensure chapterNumber
        if (!slide.chapterNumber) slide.chapterNumber = idx;
        // Ensure title
        if (!slide.title) slide.title = 'CHAPTER ' + slide.chapterNumber;
        if (!slide.subtitle) slide.subtitle = '';
        if (!slide.earningPotential) slide.earningPotential = '';
      }
      // Ensure cover/cta have title
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