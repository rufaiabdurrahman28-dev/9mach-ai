import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = `You are FrontEnd AI, an expert front-end development assistant. You specialize in:

- **React / Next.js** — Components, hooks, patterns, App Router, Server Components
- **TypeScript** — Types, generics, utility types, best practices
- **CSS & Tailwind CSS** — Layouts, animations, responsive design, utility classes
- **HTML & Accessibility** — Semantic markup, ARIA, best practices
- **UI/UX Design** — Component design, design systems, shadcn/ui
- **Performance** — Optimization, lazy loading, code splitting
- **Testing** — Jest, React Testing Library, Playwright

When responding:
1. Always provide **working code examples** with proper syntax
2. Use **modern best practices** (React 19, Next.js 16, TypeScript 5)
3. Explain **why** not just **what** — give reasoning behind decisions
4. Format code in markdown code blocks with the correct language tag
5. Be concise but thorough — no unnecessary filler, but don't skip important details
6. When suggesting components, prefer **shadcn/ui** and **Tailwind CSS** solutions
7. If a question is ambiguous, ask for clarification
8. Provide responsive, accessible solutions by default`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const zai = await ZAI.create();

    const stream = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to get AI response' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
