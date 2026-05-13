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

    // Check approval status using admin client
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
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

// GET /api/workspaces - List workspaces for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - please log in again' }, { status: 401 });
    }
    if (!user.isApproved) {
      return NextResponse.json({ error: 'Not approved yet - please wait for admin approval' }, { status: 403 });
    }

    const { data: workspaces, error } = await getSupabaseAdmin()
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch workspaces error:', error);
      return NextResponse.json({ workspaces: [] });
    }

    // Map to camelCase for the frontend
    const mapped = (workspaces || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      createdAt: w.created_at,
    }));

    return NextResponse.json({ workspaces: mapped });
  } catch (error: any) {
    console.error('Get workspaces error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}

// POST /api/workspaces - Create a new workspace
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - please log in again' }, { status: 401 });
    }
    if (!user.isApproved) {
      return NextResponse.json({ error: 'Not approved yet - please wait for admin approval' }, { status: 403 });
    }

    const { name } = await req.json();
    const workspaceName = name || 'Untitled Workspace';

    const { data: workspace, error } = await getSupabaseAdmin()
      .from('workspaces')
      .insert({
        user_id: user.id,
        name: workspaceName,
      })
      .select()
      .single();

    if (error) {
      console.error('Create workspace error:', error);
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    // Map to camelCase for the frontend
    const mapped = {
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.created_at,
    };

    return NextResponse.json({ workspace: mapped });
  } catch (error: any) {
    console.error('Create workspace error:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
