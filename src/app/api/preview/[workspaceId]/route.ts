import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

const STORAGE_BUCKET = 'workspace-files';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const url = new URL(req.url);
    const filePath = url.searchParams.get('file') || 'index.html';

    // Try to get the file from Supabase Storage
    const storagePath = `${workspaceId}/${filePath}`;
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (error || !data) {
      // Try listing files in the workspace to find any HTML file
      const { data: files } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .list(workspaceId);

      if (files && files.length > 0) {
        // Find the first HTML file
        const htmlFile = files.find(f => f.name.endsWith('.html'));
        if (htmlFile) {
          const { data: htmlData, error: htmlError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .download(`${workspaceId}/${htmlFile.name}`);

          if (!htmlError && htmlData) {
            const content = await htmlData.text();
            return new Response(content, {
              headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache',
              },
            });
          }
        }
      }

      // Return a placeholder page
      const placeholder = `<!DOCTYPE html>
<html>
<head>
  <title>No Preview Yet</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-300 min-h-screen flex items-center justify-center">
  <div class="text-center">
    <div class="text-4xl mb-4">9</div>
    <h2 class="text-xl font-bold text-emerald-400 mb-2">No Preview Available</h2>
    <p class="text-gray-500 text-sm">Ask 9mach AI to build something and the preview will appear here.</p>
  </div>
</body>
</html>`;
      return new Response(placeholder, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const content = await data.text();
    const contentType = getContentType(filePath);

    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Preview API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
