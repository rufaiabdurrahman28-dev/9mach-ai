import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = `You are 9mach AI, an expert full-stack developer. When the user asks you to build something:

1. Output complete, working HTML code with inline CSS and JavaScript
2. The code must be self-contained and runnable in an iframe
3. Make the design modern, responsive, and visually appealing
4. Use clean, semantic HTML5
5. For styling, use modern CSS (flexbox, grid, custom properties, animations)
6. For interactivity, use vanilla JavaScript
7. Always wrap the complete HTML in a single code block with language tag "html"
8. Keep responses concise — focus on the code output
9. If the user asks a question (not to build something), answer helpfully without code
10. When building UIs, make them production-quality with proper spacing, colors, and typography`;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || !session.user.isApproved) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, content } = await req.json();

    if (!workspaceId || !content) {
      return NextResponse.json({ error: 'workspaceId and content are required' }, { status: 400 });
    }

    // Verify workspace belongs to user
    const workspace = await db.workspace.findFirst({
      where: { id: workspaceId, userId: session.user.id },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Save user message
    await db.message.create({
      data: {
        workspaceId,
        role: 'user',
        content,
      },
    });

    // Fetch last 30 messages for context
    const history = await db.message.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const messages = history.reverse().map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));

    // Call AI with streaming
    const zai = await ZAI.create();
    const stream = await zai.chat.completions.create({
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    });

    const encoder = new TextEncoder();
    let accumulated = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              accumulated += content;
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();

          // Save AI response after streaming completes
          await db.message.create({
            data: {
              workspaceId,
              role: 'ai',
              content: accumulated,
            },
          });
        } catch (error) {
          console.error('Stream error:', error);
          // Still save whatever we accumulated
          if (accumulated) {
            await db.message.create({
              data: {
                workspaceId,
                role: 'ai',
                content: accumulated,
              },
            });
          }
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
    return NextResponse.json({ error: error.message || 'Failed to get AI response' }, { status: 500 });
  }
}
