import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

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

// GET - List workspaces for the current user
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: workspaces, error } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch workspaces error:', error);
      return NextResponse.json({ workspaces: [] });
    }

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

// POST - Create a new workspace
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const { data: workspace, error } = await supabaseAdmin
      .from('workspaces')
      .insert({
        user_id: user.id,
        name,
      })
      .select()
      .single();

    if (error) {
      console.error('Create workspace error:', error);
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        createdAt: workspace.created_at,
      },
    });
  } catch (error: any) {
    console.error('Create workspace error:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
