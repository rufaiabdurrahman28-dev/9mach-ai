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

    // Check approval status from profiles table
    let isApproved = false;
    let fullName = '';
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_approved, full_name')
      .eq('id', authData.user.id)
      .single();

    if (profile) {
      fullName = profile.full_name || authData.user.user_metadata?.full_name || '';
      if (profile.is_approved === true) {
        isApproved = true;
      } else if (profile.role === 'admin' || profile.role === 'manager') {
        isApproved = true;
      }
    } else {
      fullName = authData.user.user_metadata?.full_name || '';
    }

    // Set session cookie
    const response = NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName,
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
