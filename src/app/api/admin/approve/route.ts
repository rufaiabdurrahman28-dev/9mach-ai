import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

// Admin: approve a user by email
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { email },
      data: { isApproved: true },
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, isApproved: user.isApproved },
    });
  } catch (error: any) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
  }
}
