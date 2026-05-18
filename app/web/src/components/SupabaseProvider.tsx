"use client";

import { createContext, useContext, useMemo } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { usePrivy } from "@privy-io/react-auth";
import { createAuthClient, createAnonClient } from "@/lib/supabase";

// ── Context ──
interface SupabaseContextType {
  supabase: SupabaseClient | null;
}

const SupabaseContext = createContext<SupabaseContextType>({ supabase: null });

// ── Provider ──
// Creates a Supabase client that automatically injects the Privy JWT
// into every request via the `accessToken` option.
// When the user is not logged in, falls back to the anon client (public read).
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getAccessToken, authenticated } = usePrivy();

  const supabase = useMemo(() => {
    if (authenticated) {
      return createAuthClient(getAccessToken);
    }
    return createAnonClient();
  }, [authenticated, getAccessToken]);

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
}

// ── Hook ──
export function useSupabase(): SupabaseClient | null {
  const { supabase } = useContext(SupabaseContext);
  return supabase;
}
