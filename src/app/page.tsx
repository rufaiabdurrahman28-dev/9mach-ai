'use client';

import { RouterProvider, useRouter } from '@/components/9mach/router';
import { LandingPage } from '@/components/9mach/landing-page';
import { SignupPage } from '@/components/9mach/signup-page';
import { LoginPage } from '@/components/9mach/login-page';
import { PendingPage } from '@/components/9mach/pending-page';
import { ChatPage } from '@/components/9mach/chat-page';

function AppContent() {
  const { view, user, loading, refetchSession, navigate } = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refetchSession();
    navigate('landing');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-xl">9</span>
          </div>
          <p className="text-gray-400 text-sm">Loading 9mach AI...</p>
        </div>
      </div>
    );
  }

  switch (view) {
    case 'signup':
      return <SignupPage />;
    case 'login':
      return <LoginPage />;
    case 'pending':
      return <PendingPage />;
    case 'chat':
      return user ? <ChatPage user={user} onLogout={handleLogout} /> : <LoginPage />;
    default:
      return <LandingPage />;
  }
}

export default function Home() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
