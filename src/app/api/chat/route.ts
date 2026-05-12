import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import ZAI from 'z-ai-web-dev-sdk';

const TERMINAL_SERVICE_URL = 'http://localhost:3003';

const SYSTEM_PROMPT = `You are 9mach AI, an expert full-stack developer who works through a terminal. You build REAL applications by creating files and executing commands.

When the user asks you to build something, you MUST respond using these special command formats:

1. **Create a file** (most common):
:::file:path/to/file.ext
<file contents here>
:::endfile

2. **Execute a terminal command**:
:::exec:command here

3. **Create a directory**:
:::mkdir:path/to/directory

4. **Regular text** (explanations, questions):
Just type normally outside of command blocks.

**IMPORTANT RULES:**
- When building a web app, ALWAYS create a complete \`index.html\` file that works standalone
- For React apps, create a single HTML file that loads React from CDN (https://unpkg.com/react@18/umd/react.production.min.js and https://unpkg.com/react-dom@18/umd/react-dom.production.min.js) and uses Babel standalone for JSX
- For styling, include Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>)
- Make ALL code production-quality with modern, responsive design
- Always explain what you're doing before and after commands
- Create proper project structures (src/, components/, etc.) when building complex apps
- Keep responses concise but thorough
- If the user asks a question (not to build something), just answer normally without commands
- When building UIs, make them visually stunning with proper colors, spacing, and typography
- ALWAYS include proper meta viewport tag for responsive design

**Example response for "Build me a login page":**

I'll create a modern login page for you with Tailwind CSS styling.

:::file:index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <!-- Login form here -->
</body>
</html>
:::endfile

Login page created! The preview should now show a modern login form with email and password fields.`;

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
  const lines = aiResponse.split('\n');
  let output = '';
  let inFile = false;
  let filePath = '';
  let fileContent = '';

  for (const line of lines) {
    if (line.startsWith(':::file:')) {
      inFile = true;
      filePath = line.replace(':::file:', '').trim();
      fileContent = '';
      output += `\n\x1b[33m📝 Creating file: ${filePath}\x1b[0m\n`;
      continue;
    }

    if (line.trim() === ':::endfile' && inFile) {
      inFile = false;
      const result = await callTerminalService('/api/write-file', {
        workspaceId,
        filePath,
        content: fileContent,
      });

      if (result.success) {
        output += `\x1b[32m✓ File created: ${filePath}\x1b[0m\n`;
      } else {
        output += `\x1b[31m✗ Failed to create file: ${result.output}\x1b[0m\n`;
      }

      filePath = '';
      fileContent = '';
      continue;
    }

    if (inFile) {
      fileContent += (fileContent ? '\n' : '') + line;
      continue;
    }

    if (line.startsWith(':::exec:')) {
      const command = line.replace(':::exec:', '').trim();
      output += `\n\x1b[33m$ ${command}\x1b[0m\n`;

      const result = await callTerminalService('/api/execute', {
        workspaceId,
        command,
      });

      if (result.output) {
        output += `${result.output}\n`;
      }
      if (result.success) {
        output += '\x1b[32m✓ Command completed\x1b[0m\n';
      } else {
        output += '\x1b[31m✗ Command failed\x1b[0m\n';
      }
      continue;
    }

    if (line.startsWith(':::mkdir:')) {
      const dirPath = line.replace(':::mkdir:', '').trim();
      output += `\n\x1b[33m📁 Creating directory: ${dirPath}\x1b[0m\n`;

      const result = await callTerminalService('/api/create-dir', {
        workspaceId,
        dirPath,
      });

      if (result.success) {
        output += '\x1b[32m✓ Directory created\x1b[0m\n';
      } else {
        output += '\x1b[31m✗ Failed to create directory\x1b[0m\n';
      }
      continue;
    }

    output += line + '\n';
  }

  if (inFile && filePath) {
    const result = await callTerminalService('/api/write-file', {
      workspaceId,
      filePath,
      content: fileContent,
    });

    if (result.success) {
      output += `\n\x1b[32m✓ File created: ${filePath}\x1b[0m\n`;
    } else {
      output += `\n\x1b[31m✗ Failed to create file: ${result.output}\x1b[0m\n`;
    }
  }

  return output;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check approval
    let isApproved = false;
    const { data: nimarcUser } = await supabaseAdmin
      .from('nimarc_users')
      .select('is_approved')
      .eq('id', user.id)
      .single();

    if (nimarcUser) {
      isApproved = nimarcUser.is_approved;
    } else {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile && (profile.role === 'admin' || profile.role === 'manager')) {
        isApproved = true;
      }
    }

    if (!isApproved) {
      return NextResponse.json({ error: 'Not approved' }, { status: 403 });
    }

    const { workspaceId, content } = await req.json();

    if (!workspaceId || !content) {
      return NextResponse.json({ error: 'workspaceId and content are required' }, { status: 400 });
    }

    // Verify workspace belongs to user
    const { data: workspace } = await supabaseAdmin
      .from('nimarc_workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Save user message
    await supabaseAdmin.from('nimarc_messages').insert({
      workspace_id: workspaceId,
      role: 'user',
      content,
    });

    // Fetch last 30 messages for context
    const { data: history } = await supabaseAdmin
      .from('nimarc_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(30);

    const messages = (history || [])
      .reverse()
      .map((m: any) => ({
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

          // Process AI response to execute terminal commands
          const processedOutput = await processAiResponse(accumulated, workspaceId);

          // Save processed AI response
          await supabaseAdmin.from('nimarc_messages').insert({
            workspace_id: workspaceId,
            role: 'ai',
            content: processedOutput,
          });
        } catch (error) {
          console.error('Stream error:', error);
          if (accumulated) {
            await supabaseAdmin.from('nimarc_messages').insert({
              workspace_id: workspaceId,
              role: 'ai',
              content: accumulated,
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
