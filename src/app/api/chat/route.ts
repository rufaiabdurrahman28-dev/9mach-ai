import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import ZAI from 'z-ai-web-dev-sdk';

const STORAGE_BUCKET = 'workspace-files';

const SYSTEM_PROMPT = `You are 9mach AI, an expert full-stack developer. You build REAL applications by creating files.

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
- ALWAYS use :::file: and :::endfile to create files - NEVER use markdown code blocks alone
- ALWAYS include <script src="https://cdn.tailwindcss.com"></script> for styling
- ALWAYS include proper meta viewport tag
- ALWAYS create complete, working HTML files
- If asked a question (not to build), answer normally without :::file: commands
- Keep explanations brief and focused
- When building multi-file projects, create all necessary files`;

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

async function writeFileToStorage(workspaceId: string, filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
  const storagePath = `${workspaceId}/${filePath}`;

  // Ensure parent "directories" exist by uploading the file
  // Supabase Storage creates folders automatically based on path
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, content, {
      contentType: getContentType(filePath),
      upsert: true,
    });

  if (error) {
    console.error('Storage upload error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const types: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'ts': 'text/typescript',
    'tsx': 'text/typescript',
    'jsx': 'text/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'txt': 'text/plain',
    'md': 'text/markdown',
  };
  return types[ext] || 'text/plain';
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
      output += `\n[Creating file: ${filePath}]\n`;
      continue;
    }

    if (line.trim() === ':::endfile' && inFile) {
      inFile = false;
      const result = await writeFileToStorage(workspaceId, filePath, fileContent);
      output += result.success
        ? `[File created: ${filePath}]\n`
        : `[Failed: ${result.error}]\n`;
      filePath = '';
      fileContent = '';
      continue;
    }

    if (inFile) {
      fileContent += (fileContent ? '\n' : '') + line;
      continue;
    }

    // Handle markdown code blocks as fallback
    if (line.trim().startsWith('```') && !inCodeBlock && line.trim().length > 3) {
      inCodeBlock = true;
      const langPart = line.trim().replace('```', '').trim();
      codeBlockLang = langPart;
      codeBlockContent = '';
      if (langPart.startsWith('file:')) {
        filePath = langPart.replace('file:', '').trim();
      } else {
        filePath = '';
      }
      continue;
    }

    if (line.trim() === '```' && inCodeBlock) {
      inCodeBlock = false;
      let detectedPath = filePath || 'index.html';
      if (!filePath) {
        if (codeBlockLang === 'css') detectedPath = 'style.css';
        else if (codeBlockLang === 'javascript' || codeBlockLang === 'js') detectedPath = 'script.js';
        else if (codeBlockContent.includes('<!DOCTYPE html') || codeBlockContent.includes('<html')) detectedPath = 'index.html';
      }

      if (codeBlockContent.trim().length > 50) {
        output += `\n[Creating file: ${detectedPath}]\n`;
        const result = await writeFileToStorage(workspaceId, detectedPath, codeBlockContent);
        output += result.success
          ? `[File created: ${detectedPath}]\n`
          : `[Failed: ${result.error}]\n`;
      }
      codeBlockContent = '';
      codeBlockLang = '';
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      continue;
    }

    output += line + '\n';
  }

  // Handle unclosed :::file: block
  if (inFile && filePath && fileContent.trim()) {
    const result = await writeFileToStorage(workspaceId, filePath, fileContent);
    output += result.success
      ? `\n[File created: ${filePath}]\n`
      : `\n[Failed: ${result.error}]\n`;
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.trim().length > 50) {
    let detectedPath = 'index.html';
    if (codeBlockContent.includes('<!DOCTYPE html') || codeBlockContent.includes('<html')) detectedPath = 'index.html';
    output += `\n[Creating file: ${detectedPath}]\n`;
    const result = await writeFileToStorage(workspaceId, detectedPath, codeBlockContent);
    output += result.success
      ? `[File created: ${detectedPath}]\n`
      : `[Failed: ${result.error}]\n`;
  }

  return output;
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

    // Call AI using z-ai-web-dev-sdk (non-streaming for reliability)
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    });

    const aiContent = completion.choices?.[0]?.message?.content || '';

    if (!aiContent) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    // Process the response (extract files and write to storage)
    const processedOutput = await processAiResponse(aiContent, workspaceId);

    // Save AI response to DB
    await supabaseAdmin.from('messages').insert({
      workspace_id: workspaceId,
      role: 'assistant',
      content: processedOutput,
    });

    // Return the processed output as plain text (the client will display it)
    return new Response(processedOutput, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get AI response' }, { status: 500 });
  }
}
