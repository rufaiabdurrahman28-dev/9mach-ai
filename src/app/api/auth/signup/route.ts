import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password, confirmPassword } = await req.json();

    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // The trigger (handle_new_user) auto-creates a profile row.
    // Update it with is_approved = false and full_name
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        is_approved: false,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      // If is_approved column doesn't exist yet, just update full_name
      const { error: fallbackError } = await supabaseAdmin
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', userId);

      if (fallbackError) {
        console.error('Profile fallback update error:', fallbackError);
      }
    }

    // Auto-approve if the user's role is admin/manager (existing users)
    let isApproved = false;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_approved')
      .eq('id', userId)
      .single();

    if (profile) {
      if (profile.is_approved === true) {
        isApproved = true;
      } else if (profile.role === 'admin' || profile.role === 'manager') {
        isApproved = true;
        // Update is_approved
        await supabaseAdmin
          .from('profiles')
          .update({ is_approved: true })
          .eq('id', userId);
      }
    }

    return NextResponse.json({
      user: {
        id: userId,
        email,
        fullName,
        isApproved,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error.message || 'Signup failed' }, { status: 500 });
  }
}
