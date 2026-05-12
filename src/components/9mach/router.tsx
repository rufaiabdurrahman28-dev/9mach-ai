'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

type View = 'landing' | 'signup' | 'login' | 'pending' | 'chat';

interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  isApproved: boolean;
}

interface RouterContextType {
  view: View;
  navigate: (view: View) => void;
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  loading: boolean;
  refetchSession: () => Promise<void>;
}

const RouterContext = createContext<RouterContextType>({
  view: 'landing',
  navigate: () => {},
  user: null,
  setUser: () => {},
  loading: true,
  refetchSession: async () => {},
});

export function useRouter() {
  return useContext(RouterContext);
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>('landing');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        if (data.user.isApproved) {
          setView('chat');
        } else {
          setView('pending');
        }
      } else {
        setUser(null);
        setView('landing');
      }
    } catch {
      setUser(null);
      setView('landing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchSession();
  }, [refetchSession]);

  const navigate = useCallback(
    (newView: View) => {
      // Auth-protect chat route
      if (newView === 'chat' && !user) {
        setView('login');
        return;
      }
      if (newView === 'chat' && user && !user.isApproved) {
        setView('pending');
        return;
      }
      setView(newView);
    },
    [user]
  );

  return (
    <RouterContext.Provider value={{ view, navigate, user, setUser, loading, refetchSession }}>
      {children}
    </RouterContext.Provider>
  );
}
