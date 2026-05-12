import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

async function getAuthUser(req: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;
  if (!accessToken) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !user) return null;

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

  return { id: user.id, email: user.email, isApproved };
}

export async function GET() {
  try {
    const user = await getAuthUser(new NextRequest('http://localhost'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: workspaces, error } = await supabaseAdmin
      .from('nimarc_workspaces')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch workspaces error:', error);
      return NextResponse.json({ workspaces: [] });
    }

    // Map to camelCase
    const mapped = (workspaces || []).map((w: any) => ({
      id: w.id,
      userId: w.user_id,
      name: w.name,
      createdAt: w.created_at,
    }));

    return NextResponse.json({ workspaces: mapped });
  } catch (error: any) {
    console.error('List workspaces error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();

    const { data: workspace, error } = await supabaseAdmin
      .from('nimarc_workspaces')
      .insert({
        user_id: user.id,
        name: name || 'Untitled Workspace',
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
        userId: workspace.user_id,
        name: workspace.name,
        createdAt: workspace.created_at,
      },
    });
  } catch (error: any) {
    console.error('Create workspace error:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
