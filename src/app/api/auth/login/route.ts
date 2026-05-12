import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check approval status from nimarc_users table
    let isApproved = false;
    const { data: nimarcUser } = await supabaseAdmin
      .from('nimarc_users')
      .select('is_approved, full_name')
      .eq('id', authData.user.id)
      .single();

    if (nimarcUser) {
      isApproved = nimarcUser.is_approved;
    } else {
      // Fallback: check profiles table - managers/admins are auto-approved
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, full_name')
        .eq('id', authData.user.id)
        .single();

      if (profile && (profile.role === 'admin' || profile.role === 'manager')) {
        isApproved = true;
      }
    }

    // Set session cookie
    const response = NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName: nimarcUser?.full_name || authData.user.user_metadata?.full_name || '',
        isApproved,
      },
    });

    // Set the auth token as a cookie
    response.cookies.set('sb-access-token', authData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    response.cookies.set('sb-refresh-token', authData.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
