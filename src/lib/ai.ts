/**
 * Shared AI caller — works everywhere:
 *   Local dev:  z-ai-web-dev-sdk (Z.ai internal network)
 *   Render:     Groq (free, fast, OpenAI-compatible, global)
 */

const IS_RENDER = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callAI(
  messages: AIMessage[],
  options: { maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const { maxTokens = 4000, temperature = 0.7, jsonMode = false } = options;

  if (IS_RENDER) {
    // Render: use Groq (free, works from anywhere, no region restrictions)
    const Groq = (await import('groq-sdk')).default;
    const apiKey = process.env.GROQ_API_KEY || '';
    if (!apiKey) {
      throw new Error(
        'GROQ_API_KEY not set. Get a free key at https://console.groq.com/keys and add it in Render Environment settings.'
      );
    }

    const client = new Groq({ apiKey });

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.choices[0]?.message?.content || '';
  } else {
    // Local: use z-ai-web-dev-sdk
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || '';
  }
}