import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null });
    }

    // Verify the token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return NextResponse.json({ user: null });
    }

    // Check approval status
    let isApproved = false;
    const { data: nimarcUser } = await supabaseAdmin
      .from('nimarc_users')
      .select('is_approved, full_name')
      .eq('id', user.id)
      .single();

    if (nimarcUser) {
      isApproved = nimarcUser.is_approved;
    } else {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();

      if (profile && (profile.role === 'admin' || profile.role === 'manager')) {
        isApproved = true;
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: nimarcUser?.full_name || user.user_metadata?.full_name || '',
        isApproved,
      },
    });
  } catch (error: any) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null });
  }
}
