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

    // Create profile with is_approved = false
    const { error: profileError } = await supabaseAdmin
      .from('nimarc_users')
      .insert({
        id: userId,
        email,
        full_name: fullName,
        is_approved: false,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // If nimarc_users table doesn't exist, try profiles table
      const { error: profileError2 } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name: fullName,
          role: 'user',
        });
      
      if (profileError2) {
        console.error('Profile creation error (fallback):', profileError2);
      }
    }

    return NextResponse.json({
      user: {
        id: userId,
        email,
        fullName,
        isApproved: false,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error.message || 'Signup failed' }, { status: 500 });
  }
}
