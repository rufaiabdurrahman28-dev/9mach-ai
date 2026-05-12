'use client';

import { useRouter } from './router';

export function PendingPage() {
  const { navigate, user, refetchSession } = useRouter();

  const handleCheckStatus = async () => {
    await refetchSession();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refetchSession();
    navigate('landing');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button onClick={() => navigate('landing')} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-sm">9</span>
          </div>
          <span className="font-bold text-lg">9mach AI</span>
        </button>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign Out
        </button>
      </nav>

      {/* Pending Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="text-center max-w-md">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
            <svg className="h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-3">Awaiting Admin Approval</h1>
          <p className="text-gray-500 text-sm mb-2">
            Your account is currently pending approval from an administrator.
          </p>
          {user?.email && (
            <p className="text-gray-400 text-xs mb-8">
              Registered as: {user.email}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCheckStatus}
              className="bg-black text-white font-medium py-3 px-6 rounded-xl hover:bg-gray-800 transition-colors text-sm"
            >
              Check Status
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 font-medium py-3 px-6 rounded-xl hover:text-gray-900 transition-colors text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
