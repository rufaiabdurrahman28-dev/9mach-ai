import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
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

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ user: null });
    }

    // Check approval status using admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let isApproved = false;
    let fullName = '';
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_approved, full_name')
      .eq('id', user.id)
      .single();

    if (profile) {
      fullName = profile.full_name || user.user_metadata?.full_name || '';
      if (profile.is_approved === true) {
        isApproved = true;
      } else if (profile.role === 'admin' || profile.role === 'manager') {
        isApproved = true;
      }
    } else {
      fullName = user.user_metadata?.full_name || '';
    }

    const jsonResponse = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName,
        isApproved,
      },
    });

    // Copy any refreshed cookies
    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value);
    });

    return jsonResponse;
  } catch (error: any) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null });
  }
}
