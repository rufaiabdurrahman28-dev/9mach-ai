import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      const cookieStore2 = await cookies();
      cookieStore2.delete('session_token');
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        isApproved: session.user.isApproved,
      },
    });
  } catch (error: any) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null });
  }
}
