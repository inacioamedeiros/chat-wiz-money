import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateRecommendations, type AgentContext } from "./agent-rules";

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  return { start, end };
}

export const getTodayDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { start, end } = monthRange();

    const [{ data: profile }, { data: accounts }, { data: txs }, { data: goals }] = await Promise.all([
      supabase.from("profiles").select("full_name, monthly_income, currency, onboarded").eq("id", userId).maybeSingle(),
      supabase.from("accounts").select("id, name, initial_balance").eq("user_id", userId),
      supabase.from("transactions")
        .select("amount, kind, occurred_at, category:categories(name)")
        .eq("user_id", userId)
        .gte("occurred_at", start)
        .lt("occurred_at", end),
      supabase.from("goals").select("title, target_amount, current_amount, target_date").eq("user_id", userId),
    ]);

    const initial = (accounts ?? []).reduce((s, a) => s + Number(a.initial_balance ?? 0), 0);
    let income = 0, expense = 0;
    const byCat: Record<string, number> = {};
    for (const t of txs ?? []) {
      const amt = Number(t.amount);
      if (t.kind === "income") income += amt;
      else if (t.kind === "expense") {
        expense += amt;
        const cat = (t.category as { name?: string } | null)?.name ?? "Outros";
        byCat[cat] = (byCat[cat] ?? 0) + amt;
      }
    }
    const balance = initial + income - expense;

    const ctx: AgentContext = {
      monthlyIncome: Number(profile?.monthly_income ?? 0),
      monthSpendByCategory: byCat,
      monthSpendTotal: expense,
      goals: (goals ?? []).map((g) => ({
        title: g.title,
        target_amount: Number(g.target_amount),
        current_amount: Number(g.current_amount),
        target_date: g.target_date,
      })),
    };
    const recommendations = generateRecommendations(ctx);

    return {
      profile: profile ?? null,
      balance,
      monthIncome: income,
      monthExpense: expense,
      topCategories: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5),
      recommendations,
      goals: goals ?? [],
    };
  });

export const getMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const start = new Date(data.year, data.month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(data.year, data.month, 1).toISOString().slice(0, 10);
    const prevStart = new Date(data.year, data.month - 2, 1).toISOString().slice(0, 10);

    const [{ data: cur }, { data: prev }] = await Promise.all([
      supabase.from("transactions")
        .select("amount, kind, occurred_at, category:categories(name)")
        .eq("user_id", userId).gte("occurred_at", start).lt("occurred_at", end),
      supabase.from("transactions")
        .select("amount, kind, occurred_at, category:categories(name)")
        .eq("user_id", userId).gte("occurred_at", prevStart).lt("occurred_at", start),
    ]);

    const tally = (rows: typeof cur) => {
      const byCat: Record<string, number> = {};
      let income = 0, expense = 0;
      for (const t of rows ?? []) {
        const amt = Number(t.amount);
        if (t.kind === "income") income += amt;
        else if (t.kind === "expense") {
          expense += amt;
          const c = (t.category as { name?: string } | null)?.name ?? "Outros";
          byCat[c] = (byCat[c] ?? 0) + amt;
        }
      }
      return { income, expense, byCat };
    };
    const c = tally(cur);
    const p = tally(prev);

    const variation = p.expense > 0 ? ((c.expense - p.expense) / p.expense) * 100 : 0;
    const chart = Object.entries(c.byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    return {
      year: data.year, month: data.month,
      income: c.income, expense: c.expense,
      previousExpense: p.expense,
      variationPct: variation,
      topCategories: chart.slice(0, 5),
      chart,
      rows: cur ?? [],
    };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("transactions")
      .select("id, kind, amount, merchant, note, occurred_at, is_recurring, category:categories(name, color, icon), account:accounts(name)")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, kind, color, icon")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("accounts").select("*").eq("user_id", userId).order("created_at");
    if (error) throw error;
    return data ?? [];
  });
