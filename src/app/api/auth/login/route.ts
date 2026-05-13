import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Create a response object that we'll use to set cookies
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

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check approval status from profiles table
    let isApproved = false;
    let fullName = '';

    // Use admin client to check profile (bypasses RLS)
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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

    // Build the JSON response with user data
    const jsonResponse = NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName,
        isApproved,
      },
    });

    // Copy cookies from the Supabase session response
    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value);
    });

    return jsonResponse;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
