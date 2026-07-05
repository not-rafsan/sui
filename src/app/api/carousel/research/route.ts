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
  "caption": "I just shared my [what the carousel covers]—from [first topic] and [second topic] to [third topic] and [fourth topic]. [Benefit sentence about why they should care].\\n\\n💡 Inside you'll learn:\\n✅ [Topic from slide 1]\\n✅ [Topic from slide 2]\\n✅ [Topic from slide 3]\\n✅ [Topic from slide 4]\\n✅ [Topic from slide 5]\\n✅ [Topic from slide 6]\\n\\nSave this post so you can come back to it while [doing the thing].\\n\\n👇 Tell me in the comments:\\n[Engagement question related to the topic]?\\n\\nShare this with a friend who's [trying to / interested in] [related goal], and follow for more [niche] [content type].\\n\\n#Hashtag1 #Hashtag2 #Hashtag3 #Hashtag4 #Hashtag5",
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
The caption must follow this EXACT 6-part structure with these exact section breaks:

PART 1 — OPENING LINE (1-2 sentences):
- Start with "I just shared my [what the carousel covers]"
- Use em-dash (—) to list 2-4 key topics from the carousel: "—from [topic A] and [topic B] to [topic C] and [topic D]"
- End with a short benefit sentence: "If you're looking to [benefit 1], [benefit 2], and [benefit 3], this carousel is for you."
- First person, conversational, warm tone

PART 2 — CHECKLIST (after a blank line):
- Start with "💡 Inside you'll learn:" (lightbulb emoji + exactly this text)
- Then list each content slide topic with ✅ emoji, one per line
- Each line = 2-5 words, just the key topic from that slide (e.g. "✅ AI product research", "✅ Store setup workflow")
- Match the actual slide titles/chapters — do NOT make up topics that aren't in the carousel

PART 3 — SAVE CTA (after a blank line):
- "Save this post so you can come back to it while [doing the relevant activity]."
- The activity should match the carousel topic (e.g. "while building your store", "while setting up your funnel")

PART 4 — ENGAGEMENT QUESTION (after a blank line):
- "👇 Tell me in the comments:" (pointing down emoji + exactly this text)
- Then 1 question on the next line that asks about the reader's specific challenge, experience, or opinion related to the topic
- The question must end with "?" and be something people actually want to answer

PART 5 — SHARE + FOLLOW (after a blank line):
- "Share this with a friend who's [trying to / interested in / working on] [related goal], and follow for more [niche] [content types]."
- Be specific about the niche and content types (not generic "great content")

PART 6 — HASHTAGS (after a blank line):
- Exactly 5 hashtags, space-separated
- No generic tags like #love #instagood #photo
- Tags must be relevant to the specific topic

PERFECT EXAMPLE:
"I just shared my complete AI-powered dropshipping blueprint—from product research and content creation to automation workflows and scaling strategies. If you're looking to save time, reduce manual work, and build smarter systems, this carousel is for you.

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

#AI #Dropshipping #AIAutomation #OnlineBusiness #SideHustle"`;

    const userPrompt = `Create a high-quality Instagram carousel about: "${topic}"

Generate ${chapterCount} content chapters that form a progressive journey to earning money. Make the content specific, actionable, and worthy of a 3M+ follower business page. Include real tools, realistic earnings, and step-by-step progression.

For the caption: follow the 6-part format EXACTLY as described. The ✅ checklist items MUST match the actual slide topics you generate. The engagement question must be specific to the topic.

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