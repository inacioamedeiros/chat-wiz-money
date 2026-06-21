import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const GoalInput = z.object({
  title: z.string().min(1).max(80),
  target_amount: z.number().positive(),
  current_amount: z.number().min(0).default(0),
  target_date: z.string().nullable(),
  recurrence: z.string().nullable().default(null),
});

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GoalInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g, error } = await supabase
      .from("goals").insert({ ...data, user_id: userId }).select().single();
    if (error) throw error;
    return g;
  });

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: GoalInput.partial(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g, error } = await supabase
      .from("goals").update(data.patch).eq("id", data.id).eq("user_id", userId).select().single();
    if (error) throw error;
    return g;
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("goals").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

const ProfileInput = z.object({
  full_name: z.string().nullable().optional(),
  monthly_income: z.number().min(0).nullable().optional(),
  onboarded: z.boolean().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p, error } = await supabase
      .from("profiles").update(data).eq("id", userId).select().single();
    if (error) throw error;
    return p;
  });

export const exportUserData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, accounts, categories, transactions, goals, threads, messages] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("accounts").select("*").eq("user_id", userId),
      supabase.from("categories").select("*").eq("user_id", userId),
      supabase.from("transactions").select("*").eq("user_id", userId),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("threads").select("*").eq("user_id", userId),
      supabase.from("messages").select("*").eq("user_id", userId),
    ]);
    return {
      exported_at: new Date().toISOString(),
      profile: profile.data,
      accounts: accounts.data,
      categories: categories.data,
      transactions: transactions.data,
      goals: goals.data,
      threads: threads.data,
      messages: messages.data,
    };
  });

export const deleteAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // delete em cascata via FKs (threads, messages, transactions, goals, etc.)
    await supabase.from("transactions").delete().eq("user_id", userId);
    await supabase.from("goals").delete().eq("user_id", userId);
    await supabase.from("threads").delete().eq("user_id", userId);
    await supabase.from("categories").delete().eq("user_id", userId);
    await supabase.from("accounts").delete().eq("user_id", userId);
    await supabase.from("classification_corrections").delete().eq("user_id", userId);
    return { ok: true };
  });
