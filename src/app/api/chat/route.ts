import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import ZAI from 'z-ai-web-dev-sdk';

const TERMINAL_SERVICE_URL = process.env.TERMINAL_SERVICE_URL || 'http://localhost:3003';

const SYSTEM_PROMPT = `You are 9mach AI, an expert full-stack developer. You build REAL applications by creating files on disk.

CRITICAL: When you build something, you MUST use this EXACT format to create files:

:::file:path/to/file.ext
complete file contents here
:::endfile

For example, to build a landing page:

I'll build a modern landing page for you!

:::file:index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Page</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white">
    <h1>Hello World</h1>
</body>
</html>
:::endfile

Your landing page is ready!

RULES:
- ALWAYS use :::file: and :::endfile to create files - NEVER use markdown code blocks
- ALWAYS include <script src="https://cdn.tailwindcss.com"></script> for styling
- ALWAYS include proper meta viewport tag
- ALWAYS create complete, working HTML files
- If asked a question (not to build), answer normally without :::file: commands
- Keep explanations brief and focused`;

interface TerminalResult {
  success: boolean;
  output: string;
  path?: string;
}

async function callTerminalService(endpoint: string, body: any): Promise<TerminalResult> {
  try {
    const res = await fetch(`${TERMINAL_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, output: `Terminal service error: ${error.message}` };
  }
}

async function processAiResponse(aiResponse: string, workspaceId: string): Promise<string> {
  let output = '';
  let inFile = false;
  let filePath = '';
  let fileContent = '';
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockContent = '';

  const lines = aiResponse.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle :::file: format
    if (line.startsWith(':::file:')) {
      inFile = true;
      filePath = line.replace(':::file:', '').trim();
      fileContent = '';
      output += `\n\x1b[33mCreating file: ${filePath}\x1b[0m\n`;
      continue;
    }

    if (line.trim() === ':::endfile' && inFile) {
      inFile = false;
      const result = await callTerminalService('/api/write-file', {
        workspaceId,
        filePath,
        content: fileContent,
      });
      output += result.success
        ? `\x1b[32mFile created: ${filePath}\x1b[0m\n`
        : `\x1b[31mFailed: ${result.output}\x1b[0m\n`;
      filePath = '';
      fileContent = '';
      continue;
    }

    if (inFile) {
      fileContent += (fileContent ? '\n' : '') + line;
      continue;
    }

    // Handle markdown code blocks (```html, ```css, ```file:path, etc.) as fallback
    if (line.trim().startsWith('```') && !inCodeBlock && line.trim().length > 3) {
      inCodeBlock = true;
      const langPart = line.trim().replace('```', '').trim();
      codeBlockLang = langPart;
      codeBlockContent = '';
      // Extract filename from ```file:path format
      if (langPart.startsWith('file:')) {
        filePath = langPart.replace('file:', '').trim();
      } else {
        filePath = '';
      }
      continue;
    }

    if (line.trim() === '```' && inCodeBlock) {
      inCodeBlock = false;
      // Determine file path
      let detectedPath = filePath || 'index.html';
      if (!filePath) {
        if (codeBlockLang === 'css') detectedPath = 'style.css';
        else if (codeBlockLang === 'javascript' || codeBlockLang === 'js') detectedPath = 'script.js';
        else if (codeBlockContent.includes('<!DOCTYPE html') || codeBlockContent.includes('<html')) detectedPath = 'index.html';
      }

      // Only create file if it looks like actual code
      if (codeBlockContent.trim().length > 50) {
        output += `\n\x1b[33mCreating file: ${detectedPath}\x1b[0m\n`;
        const result = await callTerminalService('/api/write-file', {
          workspaceId,
          filePath: detectedPath,
          content: codeBlockContent,
        });
        output += result.success
          ? `\x1b[32mFile created: ${detectedPath}\x1b[0m\n`
          : `\x1b[31mFailed: ${result.output}\x1b[0m\n`;
      }
      codeBlockContent = '';
      codeBlockLang = '';
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      continue;
    }

    // Handle :::exec: commands
    if (line.startsWith(':::exec:')) {
      const command = line.replace(':::exec:', '').trim();
      output += `\n\x1b[33m$ ${command}\x1b[0m\n`;
      const result = await callTerminalService('/api/execute', {
        workspaceId,
        command,
      });
      if (result.output) output += `${result.output}\n`;
      output += result.success ? '\x1b[32mCommand completed\x1b[0m\n' : '\x1b[31mCommand failed\x1b[0m\n';
      continue;
    }

    // Handle :::mkdir: commands
    if (line.startsWith(':::mkdir:')) {
      const dirPath = line.replace(':::mkdir:', '').trim();
      output += `\n\x1b[33mCreating directory: ${dirPath}\x1b[0m\n`;
      const result = await callTerminalService('/api/create-dir', {
        workspaceId,
        dirPath,
      });
      output += result.success ? '\x1b[32mDirectory created\x1b[0m\n' : '\x1b[31mFailed\x1b[0m\n';
      continue;
    }

    output += line + '\n';
  }

  // Handle unclosed :::file: block
  if (inFile && filePath && fileContent.trim()) {
    const result = await callTerminalService('/api/write-file', {
      workspaceId,
      filePath,
      content: fileContent,
    });
    output += result.success
      ? `\n\x1b[32mFile created: ${filePath}\x1b[0m\n`
      : `\n\x1b[31mFailed: ${result.output}\x1b[0m\n`;
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.trim().length > 50) {
    let detectedPath = 'index.html';
    if (codeBlockContent.includes('<!DOCTYPE html') || codeBlockContent.includes('<html')) detectedPath = 'index.html';
    output += `\n\x1b[33mCreating file: ${detectedPath}\x1b[0m\n`;
    const result = await callTerminalService('/api/write-file', {
      workspaceId,
      filePath: detectedPath,
      content: codeBlockContent,
    });
    output += result.success
      ? `\x1b[32mFile created: ${detectedPath}\x1b[0m\n`
      : `\x1b[31mFailed: ${result.output}\x1b[0m\n`;
  }

  return output;
}

async function getAuthUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;
  if (!accessToken) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !user) return null;

  let isApproved = false;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, is_approved')
    .eq('id', user.id)
    .single();

  if (profile) {
    if (profile.is_approved === true) isApproved = true;
    else if (profile.role === 'admin' || profile.role === 'manager') isApproved = true;
  }

  return { id: user.id, email: user.email, isApproved };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.isApproved) return NextResponse.json({ error: 'Not approved' }, { status: 403 });

    const { workspaceId, content } = await req.json();
    if (!workspaceId || !content) return NextResponse.json({ error: 'workspaceId and content are required' }, { status: 400 });

    // Verify workspace belongs to user
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    // Save user message
    await supabaseAdmin.from('messages').insert({
      workspace_id: workspaceId,
      role: 'user',
      content,
    });

    // Fetch last 20 messages for context
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(20);

    const messages = (history || [])
      .reverse()
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    // Call AI (non-streaming for reliability, then stream the processed result)
    const zai = await ZAI.create();
    
    let aiContent = '';
    
    try {
      // Try streaming first with SSE parsing
      const stream = await zai.chat.completions.create({
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      });

      const reader = (stream as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const encoder = new TextEncoder();

      // Create our own readable stream that pipes AI content to the client
      const readable = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const events = buffer.split('\n\n');
              buffer = events.pop() || '';

              for (const event of events) {
                for (const line of event.split('\n')) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;
                    try {
                      const parsed = JSON.parse(data);
                      const content = parsed.choices?.[0]?.delta?.content || '';
                      if (content) {
                        aiContent += content;
                        controller.enqueue(encoder.encode(content));
                      }
                    } catch {}
                  }
                }
              }
            }

            // Process any remaining buffer
            if (buffer) {
              for (const line of buffer.split('\n')) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                      aiContent += content;
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch {}
                }
              }
            }

            controller.close();

            // After streaming is done, process the response and save
            if (aiContent) {
              const processedOutput = await processAiResponse(aiContent, workspaceId);
              await supabaseAdmin.from('messages').insert({
                workspace_id: workspaceId,
                role: 'assistant',
                content: processedOutput,
              });
            }
          } catch (error) {
            console.error('Stream processing error:', error);
            if (aiContent) {
              const processedOutput = await processAiResponse(aiContent, workspaceId);
              await supabaseAdmin.from('messages').insert({
                workspace_id: workspaceId,
                role: 'assistant',
                content: processedOutput,
              });
            }
            try { controller.close(); } catch {}
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
    } catch (streamError) {
      console.error('Streaming failed, trying non-streaming:', streamError);
      
      // Fallback to non-streaming
      const completion = await zai.chat.completions.create({
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      });

      aiContent = completion.choices?.[0]?.message?.content || '';
      
      if (!aiContent) {
        return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
      }

      // Process the response
      const processedOutput = await processAiResponse(aiContent, workspaceId);

      // Save to DB
      await supabaseAdmin.from('messages').insert({
        workspace_id: workspaceId,
        role: 'assistant',
        content: processedOutput,
      });

      return new Response(processedOutput, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get AI response' }, { status: 500 });
  }
}
