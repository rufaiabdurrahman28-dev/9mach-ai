import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email and approve them
    const { data: nimarcUser, error: findError } = await supabaseAdmin
      .from('nimarc_users')
      .select('id, email, full_name, is_approved')
      .eq('email', email)
      .single();

    if (nimarcUser) {
      const { data, error } = await supabaseAdmin
        .from('nimarc_users')
        .update({ is_approved: true })
        .eq('email', email)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
      }

      return NextResponse.json({
        user: { id: data.id, email: data.email, fullName: data.full_name, isApproved: data.is_approved },
      });
    }

    // Fallback: create entry in nimarc_users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers.users.find(u => u.email === email);

    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('nimarc_users')
      .insert({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || '',
        is_approved: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
    }

    return NextResponse.json({
      user: { id: data.id, email: data.email, fullName: data.full_name, isApproved: data.is_approved },
    });
  } catch (error: any) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
  }
}
