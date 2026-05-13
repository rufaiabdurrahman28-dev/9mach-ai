import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { join, resolve, extname } from 'path';

const PORT = 3003;
const WORKSPACES_ROOT = '/home/z/my-project/workspaces';

// Ensure workspaces root exists
if (!existsSync(WORKSPACES_ROOT)) {
  mkdirSync(WORKSPACES_ROOT, { recursive: true });
}

function getWorkspaceDir(workspaceId: string): string {
  const dir = join(WORKSPACES_ROOT, workspaceId, 'project');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// MIME types for serving files
function getMimeType(path: string): string {
  const ext = extname(path).toLowerCase();
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.jsx': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  return types[ext] || 'text/plain';
}

// List files recursively
function listFiles(dir: string, baseDir: string = ''): Array<{ path: string; type: string }> {
  const files: Array<{ path: string; type: string }> = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = baseDir ? `${baseDir}/${entry}` : entry;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.next' && entry !== '.git') {
        files.push({ path: relativePath, type: 'directory' });
        files.push(...listFiles(fullPath, relativePath));
      }
    } else {
      files.push({ path: relativePath, type: 'file' });
    }
  }
  return files;
}

// Execute a command and return output
function executeCommand(command: string, cwd: string, timeout: number = 30000): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      cwd,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PATH: process.env.PATH },
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
    });
    return { success: true, output: output || 'Command completed.' };
  } catch (error: any) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    return {
      success: false,
      output: (stdout + '\n' + stderr).trim() || `Command failed with code ${error.status}`,
    };
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/api/health') {
        return Response.json({ status: 'ok' }, { headers: corsHeaders });
      }

      // Execute a command
      if (path === '/api/execute' && req.method === 'POST') {
        const body = await req.json();
        const { workspaceId, command } = body;

        if (!workspaceId || !command) {
          return Response.json({ error: 'workspaceId and command required' }, { status: 400, headers: corsHeaders });
        }

        const cwd = getWorkspaceDir(workspaceId);
        const result = executeCommand(command, cwd);

        return Response.json(result, { headers: corsHeaders });
      }

      // Write a file
      if (path === '/api/write-file' && req.method === 'POST') {
        const body = await req.json();
        const { workspaceId, filePath, content } = body;

        if (!workspaceId || !filePath || content === undefined) {
          return Response.json({ error: 'workspaceId, filePath, and content required' }, { status: 400, headers: corsHeaders });
        }

        const cwd = getWorkspaceDir(workspaceId);
        const fullPath = resolve(cwd, filePath);

        // Security: ensure the path is within the workspace
        if (!fullPath.startsWith(resolve(cwd))) {
          return Response.json({ error: 'Path traversal not allowed' }, { status: 403, headers: corsHeaders });
        }

        // Create parent directories
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        writeFileSync(fullPath, content, 'utf-8');

        return Response.json({ success: true, path: filePath }, { headers: corsHeaders });
      }

      // Create directory
      if (path === '/api/create-dir' && req.method === 'POST') {
        const body = await req.json();
        const { workspaceId, dirPath } = body;

        if (!workspaceId || !dirPath) {
          return Response.json({ error: 'workspaceId and dirPath required' }, { status: 400, headers: corsHeaders });
        }

        const cwd = getWorkspaceDir(workspaceId);
        const fullPath = resolve(cwd, dirPath);

        if (!fullPath.startsWith(resolve(cwd))) {
          return Response.json({ error: 'Path traversal not allowed' }, { status: 403, headers: corsHeaders });
        }

        mkdirSync(fullPath, { recursive: true });

        return Response.json({ success: true, path: dirPath }, { headers: corsHeaders });
      }

      // List files
      if (path === '/api/files' && req.method === 'GET') {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          return Response.json({ error: 'workspaceId required' }, { status: 400, headers: corsHeaders });
        }

        const cwd = getWorkspaceDir(workspaceId);
        const files = listFiles(cwd);

        return Response.json({ files }, { headers: corsHeaders });
      }

      // Serve preview files
      if (path.startsWith('/api/preview/')) {
        const parts = path.replace('/api/preview/', '').split('/');
        const workspaceId = parts[0];
        const filePath = parts.slice(1).join('/') || 'index.html';

        const cwd = getWorkspaceDir(workspaceId);
        const fullPath = resolve(cwd, filePath);

        if (!fullPath.startsWith(resolve(cwd))) {
          return new Response('Forbidden', { status: 403, headers: corsHeaders });
        }

        // If file exists, serve it
        if (existsSync(fullPath) && statSync(fullPath).isFile()) {
          const content = readFileSync(fullPath);
          const mimeType = getMimeType(fullPath);
          return new Response(content, {
            headers: { ...corsHeaders, 'Content-Type': mimeType },
          });
        }

        // If directory and has index.html
        if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
          const indexPath = join(fullPath, 'index.html');
          if (existsSync(indexPath)) {
            const content = readFileSync(indexPath);
            return new Response(content, {
              headers: { ...corsHeaders, 'Content-Type': 'text/html' },
            });
          }
        }

        // Auto-generate a preview if no index.html exists
        // Check for any HTML files in the workspace
        const allFiles = listFiles(cwd);
        const htmlFile = allFiles.find(
          (f) => f.path.endsWith('.html')
        );

        if (htmlFile) {
          const content = readFileSync(join(cwd, htmlFile.path));
          return new Response(content, {
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          });
        }

        // Check if it's a React project (has package.json with react)
        const packageJsonPath = join(cwd, 'package.json');
        if (existsSync(packageJsonPath)) {
          const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          if (pkg.dependencies?.react || pkg.dependencies?.next) {
            // Return a "building" page
            const buildingHtml = `<!DOCTYPE html>
<html>
<head><title>Building...</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#0a0a0a;color:#4ade80">
<div style="text-align:center">
<div style="font-size:2rem;margin-bottom:1rem">⚙️</div>
<h2>Building Project...</h2>
<p style="color:#666;font-size:0.9rem">Run <code style="background:#1a1a1a;padding:2px 8px;border-radius:4px">npm run dev</code> to start the development server</p>
</div>
</body>
</html>`;
            return new Response(buildingHtml, {
              headers: { ...corsHeaders, 'Content-Type': 'text/html' },
            });
          }
        }

        return new Response('No preview available yet. Ask the AI to build something!', {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }

      // Delete workspace files
      if (path === '/api/cleanup' && req.method === 'POST') {
        const body = await req.json();
        const { workspaceId } = body;
        const cwd = join(WORKSPACES_ROOT, workspaceId);
        if (existsSync(cwd)) {
          rmSync(cwd, { recursive: true, force: true });
        }
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    } catch (error: any) {
      console.error('Terminal service error:', error);
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
  },
});

console.log(`🔧 Terminal service running on port ${PORT}`);
