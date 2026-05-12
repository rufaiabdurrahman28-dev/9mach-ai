'use client';

import { useRouter } from './router';

export function LandingPage() {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-sm">9</span>
          </div>
          <span className="font-bold text-lg">9mach AI</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('login')}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('signup')}
            className="text-sm font-medium bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1.5 mb-8">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-gray-600">AI-Powered App Builder</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
            Contemplating the introduction of AI in the ecosystem.{' '}
            <span className="text-gray-400">Impact of AI on the ecosystem.</span>
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
            Describe what you want to build. Our AI understands and creates it instantly. 
            From landing pages to dashboards — just chat.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('signup')}
              className="w-full sm:w-auto bg-black text-white font-medium px-8 py-3.5 rounded-xl hover:bg-gray-800 transition-colors text-base"
            >
              Get Started Free
            </button>
            <button
              onClick={() => navigate('login')}
              className="w-full sm:w-auto bg-white text-gray-900 font-medium px-8 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors text-base"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Demo Preview */}
        <div className="mt-16 w-full max-w-4xl">
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-1">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-gray-400 font-mono">9mach AI Workspace</span>
              </div>
              <div className="flex h-64">
                <div className="w-1/2 p-4 bg-gray-950 font-mono text-sm">
                  <p className="text-emerald-400">user@nimarc:~$</p>
                  <p className="text-white">Build me a modern login page</p>
                  <p className="text-gray-500 mt-2">AI:</p>
                  <p className="text-gray-300 mt-1">Creating a modern login page with...</p>
                </div>
                <div className="w-1/2 p-4 bg-white border-l border-gray-200">
                  <div className="h-full rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                    <div className="w-48 bg-white rounded-xl shadow-lg p-6 text-center">
                      <div className="h-8 w-8 rounded-full bg-black mx-auto mb-3" />
                      <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
                      <div className="h-8 bg-gray-100 rounded mb-2" />
                      <div className="h-8 bg-gray-100 rounded mb-3" />
                      <div className="h-8 bg-black rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-gray-100">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-black flex items-center justify-center">
              <span className="text-white font-bold text-xs">9</span>
            </div>
            <span className="text-sm font-semibold">9mach AI</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Support
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              Telegram Support
            </a>
          </div>
          <p className="text-xs text-gray-400">&copy; 2025 9mach AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
