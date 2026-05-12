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
    if (profile.is_approved === true) {
      isApproved = true;
    } else if (profile.role === 'admin' || profile.role === 'manager') {
      isApproved = true;
    }
  }

  return { id: user.id, email: user.email, isApproved };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify workspace belongs to user
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch messages error:', error);
      return NextResponse.json({ messages: [] });
    }

    // Map to camelCase
    const mapped = (messages || []).map((m: any) => ({
      id: m.id,
      workspaceId: m.workspace_id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    }));

    return NextResponse.json({ messages: mapped });
  } catch (error: any) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
