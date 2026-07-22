// Shared coordination lock for Xero API operations.
// Prevents background syncs from colliding with user-triggered invoice creation
// (which trips Xero's per-minute rate limit).
//
// Usage:
//   const holder = `sync-xero-contacts:${crypto.randomUUID()}`;
//   if (!(await acquireXeroLock(supabase, holder))) {
//     // another operation holds the lock — skip / defer
//   }
//   try { ... } finally { await releaseXeroLock(supabase, holder); }

const LOCK_NAME = "xero_api";

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export async function acquireXeroLock(
  supabase: SupabaseLike,
  holder: string,
  ttlSeconds = 60,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("try_acquire_xero_lock", {
    _lock_name: LOCK_NAME,
    _holder: holder,
    _ttl_seconds: ttlSeconds,
  });
  if (error) {
    console.error("[xeroLock] acquire error", error);
    return false;
  }
  return data === true;
}

export async function releaseXeroLock(
  supabase: SupabaseLike,
  holder: string,
): Promise<void> {
  const { error } = await supabase.rpc("release_xero_lock", {
    _lock_name: LOCK_NAME,
    _holder: holder,
  });
  if (error) console.error("[xeroLock] release error", error);
}

/**
 * Wait up to `maxWaitMs` for the lock, polling every `pollMs`.
 * Returns true if acquired, false if timed out.
 * Use this for user-facing operations that must run (e.g. invoice creation).
 */
export async function waitForXeroLock(
  supabase: SupabaseLike,
  holder: string,
  opts: { ttlSeconds?: number; maxWaitMs?: number; pollMs?: number } = {},
): Promise<boolean> {
  const { ttlSeconds = 90, maxWaitMs = 15000, pollMs = 500 } = opts;
  const deadline = Date.now() + maxWaitMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await acquireXeroLock(supabase, holder, ttlSeconds)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, pollMs));
  }
}