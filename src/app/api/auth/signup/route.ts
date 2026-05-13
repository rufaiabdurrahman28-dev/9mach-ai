import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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

    // Use admin client to create user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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

    // Update the auto-created profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        is_approved: false,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      // Fallback: just update full_name
      await supabaseAdmin
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', userId);
    }

    // Check approval status
    let isApproved = false;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_approved')
      .eq('id', userId)
      .single();

    if (profile) {
      if (profile.is_approved === true) isApproved = true;
      else if (profile.role === 'admin' || profile.role === 'manager') isApproved = true;
    }

    // Now sign in the user to create a session with @supabase/ssr cookies
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

    // Sign in the newly created user to establish a session
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Auto sign-in error after signup:', signInError.message);
      // Return success anyway - user can log in manually
    }

    const jsonResponse = NextResponse.json({
      user: {
        id: userId,
        email,
        fullName,
        isApproved,
      },
    });

    // Copy session cookies from Supabase
    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value);
    });

    return jsonResponse;
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error.message || 'Signup failed' }, { status: 500 });
  }
}
