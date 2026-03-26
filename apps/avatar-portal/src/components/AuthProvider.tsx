"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAvatarStore } from "@/lib/store";

// Syncs Supabase auth state → Zustand store
// Wrap the app with this so all components can read `user` from the store.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAvatarStore((s) => s.setUser);
  const supabase = createClient();

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null),
    );

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
