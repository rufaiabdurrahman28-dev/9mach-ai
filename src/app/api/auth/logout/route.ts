import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
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

    await supabase.auth.signOut();

    const jsonResponse = NextResponse.json({ success: true });

    // Copy any cookies (including cleared session cookies)
    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value);
    });

    // Also clear the old-style cookies just in case
    jsonResponse.cookies.delete('sb-access-token');
    jsonResponse.cookies.delete('sb-refresh-token');

    return jsonResponse;
  } catch (error: any) {
    console.error('Logout error:', error);
    // Even if there's an error, clear cookies
    const response = NextResponse.json({ success: true });
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    return response;
  }
}
