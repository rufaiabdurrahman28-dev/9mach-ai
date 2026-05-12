import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user profile by email and approve them
    const { data: profile, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, is_approved, role')
      .eq('email', email)
      .single();

    if (!profile) {
      // User profile not found — check if they exist in auth
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = authUsers.users.find(u => u.email === email);

      if (!authUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Create a profile entry
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || '',
          is_approved: true,
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: 'Failed to create and approve user' }, { status: 500 });
      }

      return NextResponse.json({
        user: {
          id: newProfile.id,
          email: newProfile.email,
          fullName: newProfile.full_name,
          isApproved: newProfile.is_approved,
        },
      });
    }

    // Update is_approved to true
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_approved: true })
      .eq('email', email)
      .select()
      .single();

    if (updateError) {
      // If is_approved column doesn't exist yet, try updating role instead
      const { data: roleUpdated, error: roleError } = await supabaseAdmin
        .from('profiles')
        .update({ role: 'manager' })
        .eq('email', email)
        .select()
        .single();

      if (roleError) {
        return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
      }

      return NextResponse.json({
        user: {
          id: roleUpdated.id,
          email: roleUpdated.email,
          fullName: roleUpdated.full_name,
          isApproved: true,
        },
      });
    }

    return NextResponse.json({
      user: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        fullName: updatedProfile.full_name,
        isApproved: updatedProfile.is_approved,
      },
    });
  } catch (error: any) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
  }
}
