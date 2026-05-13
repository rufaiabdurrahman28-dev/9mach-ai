import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAuthUser(req: NextRequest) {
  try {
    let response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            response = NextResponse.next({ request: req });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    let isApproved = false;
    const { data: profile } = await getSupabaseAdmin()
      .from('profiles')
      .select('role, is_approved')
      .eq('id', user.id)
      .single();

    if (profile) {
      if (profile.is_approved === true) isApproved = true;
      else if (profile.role === 'admin' || profile.role === 'manager') isApproved = true;
    }

    return { id: user.id, email: user.email, isApproved };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify workspace belongs to user
    const { data: workspace } = await getSupabaseAdmin()
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { data: messages, error } = await getSupabaseAdmin()
      .from('messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch messages error:', error);
      return NextResponse.json({ messages: [] });
    }

    // Map to camelCase and normalize role names
    const mapped = (messages || []).map((m: any) => ({
      id: m.id,
      workspaceId: m.workspace_id,
      role: m.role === 'assistant' ? 'ai' : m.role,
      content: m.content,
      createdAt: m.created_at,
    }));

    return NextResponse.json({ messages: mapped });
  } catch (error: any) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
