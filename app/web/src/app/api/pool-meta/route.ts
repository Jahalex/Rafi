import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/pool-meta
 *
 * Saves social metadata (title, description, emoji) to Supabase
 * after a pool is created on-chain.
 *
 * This is a best-effort call — failure doesn't affect the on-chain pool.
 * Lookup key = tx signature (matched by indexer to pool_pda).
 *
 * Body: { signature: string, title?: string, description?: string, emoji?: string }
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const { signature, title, description, emoji } = await req.json();

    if (!signature) {
      return NextResponse.json({ error: "signature required" }, { status: 400 });
    }

    // Sanitize
    const cleanTitle = typeof title === "string" ? title.slice(0, 60).trim() : null;
    const cleanDesc = typeof description === "string" ? description.slice(0, 140).trim() : null;
    const cleanEmoji = typeof emoji === "string" ? emoji.slice(0, 8).trim() : null;

    // Skip if nothing to save
    if (!cleanTitle && !cleanDesc && !cleanEmoji) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabase = getServiceClient();

    // Update pool row by tx_signature (set by indexer)
    const { error } = await supabase
      .from("pools")
      .update({
        ...(cleanTitle && { title: cleanTitle }),
        ...(cleanDesc && { description: cleanDesc }),
        ...(cleanEmoji && { emoji: cleanEmoji }),
      })
      .eq("tx_signature", signature);

    if (error) {
      console.error("[pool-meta] Supabase error:", error.message);
      // Non-blocking — return 200 anyway (metadata is optional)
      return NextResponse.json({ ok: true, warning: error.message });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[pool-meta] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
