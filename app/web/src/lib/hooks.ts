"use client";

import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "@/components/SupabaseProvider";
import { supabase as anonClient } from "./supabase";
import { MOCK_POOLS, MOCK_POSITIONS } from "./mockData";
import type { Pool, Position, RafiEvent } from "./supabase";

// ═══════════════════════════════════════════════════════════
// Data hooks for the Rafi frontend.
//
// Architecture:
//   - Uses auth'd Supabase client from context (Privy JWT injected)
//   - Falls back to anon client for public reads
//   - Falls back to mock data when Supabase is not configured
//   - Frontend NEVER writes to Supabase
// ═══════════════════════════════════════════════════════════

// ── Pools ─────────────────────────────────────────────────
export function usePools(filters?: { state?: string; asset?: string }) {
  const supabase = useSupabase();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPools = useCallback(async () => {
    if (!supabase) {
      setPools(MOCK_POOLS as unknown as Pool[]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("pools")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.state) query = query.eq("state", filters.state);
    if (filters?.asset) query = query.eq("asset_symbol", filters.asset);

    const { data } = await query;
    if (data) setPools(data as Pool[]);
    setLoading(false);
  }, [supabase, filters?.state, filters?.asset]);

  useEffect(() => {
    fetchPools();
    if (!supabase) return;

    const channel = supabase
      .channel("pools-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pools" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setPools(prev => [payload.new as Pool, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setPools(prev =>
            prev.map(p => p.pool_id === (payload.new as Pool).pool_id ? (payload.new as Pool) : p)
          );
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPools, supabase]);

  return { pools, loading, refetch: fetchPools };
}

// ── Single Pool ───────────────────────────────────────────
export function usePool(poolId: number) {
  const supabase = useSupabase();
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      const mock = MOCK_POOLS.find(p => p.pool_id === poolId);
      setPool((mock as unknown as Pool) || null);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("pools")
        .select("*")
        .eq("pool_id", poolId)
        .single();
      if (data) setPool(data as Pool);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel(`pool-${poolId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "pools",
        filter: `pool_id=eq.${poolId}`,
      }, (payload) => {
        setPool(payload.new as Pool);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [poolId, supabase]);

  return { pool, loading };
}

// ── Pool Positions ────────────────────────────────────────
export function usePositions(poolId: number) {
  const supabase = useSupabase();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setPositions(MOCK_POSITIONS.filter(p => p.pool_id === poolId) as unknown as Position[]);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("positions")
        .select("*")
        .eq("pool_id", poolId)
        .order("created_at", { ascending: false });
      if (data) setPositions(data as Position[]);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel(`positions-${poolId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "positions",
        filter: `pool_id=eq.${poolId}`,
      }, (payload) => {
        setPositions(prev => [payload.new as Position, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [poolId, supabase]);

  return { positions, loading };
}

// ── User Positions (by wallet address) ────────────────────
export function useMyPositions(walletAddress: string | undefined) {
  const supabase = useSupabase();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setPositions([]);
      setLoading(false);
      return;
    }

    if (!supabase) {
      setPositions(
        MOCK_POSITIONS.filter(p => p.buyer === walletAddress) as unknown as Position[]
      );
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("positions")
        .select("*")
        .eq("buyer", walletAddress)
        .order("created_at", { ascending: false });
      if (data) setPositions(data as Position[]);
      setLoading(false);
    };
    fetch();
  }, [walletAddress, supabase]);

  return { positions, loading };
}

// ── Pool Events (activity feed) ───────────────────────────
export function usePoolEvents(poolId: number, limit = 20) {
  const supabase = useSupabase();
  const [events, setEvents] = useState<RafiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("pool_id", poolId)
        .order("slot", { ascending: false })
        .limit(limit);
      if (data) setEvents(data as RafiEvent[]);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel(`events-${poolId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "events",
        filter: `pool_id=eq.${poolId}`,
      }, (payload) => {
        setEvents(prev => [payload.new as RafiEvent, ...prev].slice(0, limit));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [poolId, limit, supabase]);

  return { events, loading };
}
