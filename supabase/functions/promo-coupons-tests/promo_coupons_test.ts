// Integration tests for promo coupon RPCs (validate_promo_coupon, redeem_promo_coupon).
// Verifies: happy path, min_order, active/expiry, max_uses (atomicity under concurrency),
// per_user_limit, and that RPCs require authentication.
//
// Run: supabase--test_edge_functions with functions=["promo-coupons-tests"].

import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

assert(SUPABASE_URL, "SUPABASE_URL must be set");
assert(SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY must be set");
assert(ANON_KEY, "an anon/publishable key must be set");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- helpers ----------

const rand = () => Math.random().toString(36).slice(2, 8).toUpperCase();

async function makeUser(): Promise<{ id: string; client: SupabaseClient; email: string; password: string }> {
  const email = `promo-test-${rand()}-${Date.now()}@test.local`;
  const password = `Pw!${rand()}${rand()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn: ${signErr.message}`);
  return { id: data.user.id, client, email, password };
}

async function insertCoupon(overrides: Record<string, unknown> = {}) {
  const code = `T-${rand()}${rand()}`.toUpperCase();
  const row = {
    code,
    discount_type: "fixed",
    discount_value: 10,
    min_order: 0,
    max_uses: null as number | null,
    per_user_limit: 1,
    expires_at: null as string | null,
    active: true,
    ...overrides,
  };
  const { data, error } = await admin
    .from("promo_coupons")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`insertCoupon: ${error.message}`);
  return data as { id: string; code: string; uses: number };
}

async function cleanup(couponId: string) {
  await admin.from("promo_coupon_redemptions").delete().eq("coupon_id", couponId);
  await admin.from("promo_coupons").delete().eq("id", couponId);
}

async function deleteUser(id: string) {
  await admin.auth.admin.deleteUser(id);
}

// ---------- tests ----------

Deno.test("validate_promo_coupon: returns discount for valid fixed coupon", async () => {
  const coupon = await insertCoupon({ discount_type: "fixed", discount_value: 15, min_order: 20 });
  const user = await makeUser();
  try {
    const { data, error } = await user.client.rpc("validate_promo_coupon", {
      _code: coupon.code,
      _order_total: 50,
    });
    assertEquals(error, null);
    const rows = data as Array<{ discount: string | number }>;
    assertEquals(rows.length, 1);
    assertEquals(Number(rows[0].discount), 15);
  } finally {
    await cleanup(coupon.id);
    await deleteUser(user.id);
  }
});

Deno.test("validate_promo_coupon: percent discount is rounded to 2 decimals", async () => {
  const coupon = await insertCoupon({ discount_type: "percent", discount_value: 10 });
  const user = await makeUser();
  try {
    const { data, error } = await user.client.rpc("validate_promo_coupon", {
      _code: coupon.code,
      _order_total: 33.33,
    });
    assertEquals(error, null);
    const rows = data as Array<{ discount: string | number }>;
    assertEquals(Number(rows[0].discount), 3.33);
  } finally {
    await cleanup(coupon.id);
    await deleteUser(user.id);
  }
});

Deno.test("validate_promo_coupon: rejects order below min_order", async () => {
  const coupon = await insertCoupon({ min_order: 100 });
  const user = await makeUser();
  try {
    const { error } = await user.client.rpc("validate_promo_coupon", {
      _code: coupon.code,
      _order_total: 50,
    });
    assertNotEquals(error, null);
    assert(error!.message.includes("order_below_minimum"), `got: ${error!.message}`);
  } finally {
    await cleanup(coupon.id);
    await deleteUser(user.id);
  }
});

Deno.test("validate_promo_coupon: rejects inactive coupon", async () => {
  const coupon = await insertCoupon({ active: false });
  const user = await makeUser();
  try {
    const { error } = await user.client.rpc("validate_promo_coupon", {
      _code: coupon.code,
      _order_total: 50,
    });
    assertNotEquals(error, null);
    assert(error!.message.includes("coupon_inactive"), `got: ${error!.message}`);
  } finally {
    await cleanup(coupon.id);
    await deleteUser(user.id);
  }
});

Deno.test("validate_promo_coupon: rejects expired coupon", async () => {
  const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const coupon = await insertCoupon({ expires_at: past });
  const user = await makeUser();
  try {
    const { error } = await user.client.rpc("validate_promo_coupon", {
      _code: coupon.code,
      _order_total: 50,
    });
    assertNotEquals(error, null);
    assert(error!.message.includes("coupon_expired"), `got: ${error!.message}`);
  } finally {
    await cleanup(coupon.id);
    await deleteUser(user.id);
  }
});

Deno.test("validate_promo_coupon: rejects unknown code", async () => {
  const user = await makeUser();
  try {
    const { error } = await user.client.rpc("validate_promo_coupon", {
      _code: "DOES-NOT-EXIST-" + rand(),
      _order_total: 50,
    });
    assertNotEquals(error, null);
    assert(error!.message.includes("coupon_not_found"), `got: ${error!.message}`);
  } finally {
    await deleteUser(user.id);
  }
});

Deno.test("redeem_promo_coupon: requires authentication (anon rejected)", async () => {
  const coupon = await insertCoupon();
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { error } = await anon.rpc("redeem_promo_coupon", {
      _code: coupon.code,
      _order_total: 50,
      _order_id: null,
    });
    // Either 401 from revoked EXECUTE, or "not_authenticated" from inside the fn.
    assertNotEquals(error, null);
  } finally {
    await cleanup(coupon.id);
  }
});

Deno.test("redeem_promo_coupon: increments uses and records redemption", async () => {
  const coupon = await insertCoupon({ max_uses: 5, per_user_limit: 5 });
  const user = await makeUser();
  try {
    const { data, error } = await user.client.rpc("redeem_promo_coupon", {
      _code: coupon.code,
      _order_total: 50,
      _order_id: null,
    });
    assertEquals(error, null);
    const rows = data as Array<{ id: string; code: string; discount: string | number }>;
    assertEquals(rows.length, 1);
    assertEquals(Number(rows[0].discount), 10);

    const { data: updated } = await admin
      .from("promo_coupons")
      .select("uses")
      .eq("id", coupon.id)
      .single();
    assertEquals((updated as { uses: number }).uses, 1);

    const { data: red } = await admin
      .from("promo_coupon_redemptions")
      .select("id, user_id")
      .eq("coupon_id", coupon.id);
    assertEquals((red ?? []).length, 1);
    assertEquals((red as Array<{ user_id: string }>)[0].user_id, user.id);
  } finally {
    await cleanup(coupon.id);
    await deleteUser(user.id);
  }
});

Deno.test("redeem_promo_coupon: enforces per_user_limit", async () => {
  const coupon = await insertCoupon({ per_user_limit: 1, max_uses: 10 });
  const user = await makeUser();
  try {
    const first = await user.client.rpc("redeem_promo_coupon", {
      _code: coupon.code,
      _order_total: 50,
      _order_id: null,
    });
    assertEquals(first.error, null);

    const second = await user.client.rpc("redeem_promo_coupon", {
      _code: coupon.code,
      _order_total: 50,
      _order_id: null,
    });
    assertNotEquals(second.error, null);
    assert(
      second.error!.message.includes("coupon_user_limit"),
      `got: ${second.error!.message}`,
    );

    const { data: updated } = await admin
      .from("promo_coupons")
      .select("uses")
      .eq("id", coupon.id)
      .single();
    // Only the first attempt should have incremented uses.
    assertEquals((updated as { uses: number }).uses, 1);
  } finally {
    await cleanup(coupon.id);
    await deleteUser(user.id);
  }
});

Deno.test(
  "redeem_promo_coupon: max_uses is atomic under concurrent calls",
  async () => {
    // 5 different users hammer a coupon with max_uses = 2 in parallel.
    // Exactly 2 must succeed; the rest must fail with coupon_exhausted.
    const coupon = await insertCoupon({ max_uses: 2, per_user_limit: 1 });
    const users = await Promise.all([
      makeUser(),
      makeUser(),
      makeUser(),
      makeUser(),
      makeUser(),
    ]);
    try {
      const results = await Promise.all(
        users.map((u) =>
          u.client.rpc("redeem_promo_coupon", {
            _code: coupon.code,
            _order_total: 50,
            _order_id: null,
          }),
        ),
      );
      const successes = results.filter((r) => r.error === null);
      const failures = results.filter((r) => r.error !== null);

      assertEquals(successes.length, 2, `expected 2 successes, got ${successes.length}`);
      assertEquals(failures.length, 3);
      for (const f of failures) {
        assert(
          f.error!.message.includes("coupon_exhausted"),
          `unexpected error: ${f.error!.message}`,
        );
      }

      const { data: updated } = await admin
        .from("promo_coupons")
        .select("uses")
        .eq("id", coupon.id)
        .single();
      assertEquals((updated as { uses: number }).uses, 2);

      const { data: red } = await admin
        .from("promo_coupon_redemptions")
        .select("id")
        .eq("coupon_id", coupon.id);
      assertEquals((red ?? []).length, 2);
    } finally {
      await cleanup(coupon.id);
      await Promise.all(users.map((u) => deleteUser(u.id)));
    }
  },
);

Deno.test("redeem_promo_coupon: does not increment uses when order below minimum", async () => {
  const coupon = await insertCoupon({ min_order: 100, max_uses: 5 });
  const user = await makeUser();
  try {
    const { error } = await user.client.rpc("redeem_promo_coupon", {
      _code: coupon.code,
      _order_total: 10,
      _order_id: null,
    });
    assertNotEquals(error, null);
    assert(error!.message.includes("order_below_minimum"), `got: ${error!.message}`);

    const { data: updated } = await admin
      .from("promo_coupons")
      .select("uses")
      .eq("id", coupon.id)
      .single();
    assertEquals((updated as { uses: number }).uses, 0);

    const { data: red } = await admin
      .from("promo_coupon_redemptions")
      .select("id")
      .eq("coupon_id", coupon.id);
    assertEquals((red ?? []).length, 0);
  } finally {
    await cleanup(coupon.id);
    await deleteUser(user.id);
  }
});
