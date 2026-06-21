import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./categories-list";

/**
 * NLU + Agente Financeiro em uma chamada ao Lovable AI Gateway.
 * O modelo retorna JSON estruturado com intent, entities, transação proposta
 * e a resposta conversacional do agente.
 */

const NluSchema = z.object({
  intent: z.enum([
    "register_expense",
    "register_income",
    "transfer",
    "query_balance",
    "create_goal",
    "update_goal",
    "delete_goal",
    "ask_advice",
    "query_report",
    "correct_classification",
    "smalltalk",
  ]),
  intent_confidence: z.number().min(0).max(1),
  entities: z.object({
    amount: z.number().nullable(),
    currency: z.string().nullable(),
    date: z.string().nullable().describe("ISO date YYYY-MM-DD"),
    category: z.string().nullable(),
    category_confidence: z.number().min(0).max(1).nullable(),
    category_alternatives: z.array(z.string()).default([]),
    merchant: z.string().nullable(),
    note: z.string().nullable(),
    recurrence_flag: z.boolean().default(false),
    goal_title: z.string().nullable().default(null),
    goal_target_amount: z.number().nullable().default(null),
    goal_target_date: z.string().nullable().default(null).describe("ISO date YYYY-MM-DD"),
    goal_current_amount: z.number().nullable().default(null),
  }),
  reply: z.string().describe("Resposta amigável e curta do agente, em PT-BR"),
});

export type NluResult = z.infer<typeof NluSchema>;

const SendMessageInput = z.object({
  threadId: z.string().uuid(),
  text: z.string().min(1).max(1000),
});

function buildSystemPrompt(monthlyIncome: number | null): string {
  return `Você é o "Agente Financeiro", um assistente educado e didático de finanças pessoais em português brasileiro.

Seu trabalho: analisar a mensagem do usuário e extrair informações financeiras estruturadas, além de responder de forma curta, amigável e útil.

CATEGORIAS DE DESPESA disponíveis: ${EXPENSE_CATEGORIES.join(", ")}.
CATEGORIAS DE RECEITA disponíveis: ${INCOME_CATEGORIES.join(", ")}.
${monthlyIncome ? `Renda mensal informada: R$ ${monthlyIncome.toFixed(2)}.` : "Renda mensal: não informada."}

REGRAS:
- Sempre retorne JSON válido seguindo o schema solicitado.
- Identifique intent corretamente. Se o usuário diz "gastei 30 no Uber", intent = register_expense.
- Extraia amount em número (ex: "R$ 23,50" → 23.5). Se não há valor, amount = null.
- Para date: hoje = ${new Date().toISOString().slice(0, 10)}. "ontem" = um dia atrás. Use YYYY-MM-DD.
- Para category: escolha SEMPRE uma das categorias listadas. Use category_alternatives para 2-3 outras opções razoáveis.
- category_confidence: sua certeza de 0 a 1 na categoria escolhida.
- Para merchant: extraia o nome do estabelecimento quando claro ("Uber", "iFood", "Padaria").
- O campo "reply" deve ser CURTO (1-2 frases), tom educativo e acolhedor. Se for transação, confirme o resumo. Se for dúvida, responda diretamente.
- Para "ask_advice" ou "query_report": dê uma resposta útil e curta no campo reply.
- Nunca invente valores.`;
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendMessageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. valida thread
    const { data: thread } = await supabase
      .from("threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!thread) throw new Error("Conversa não encontrada");

    // 2. salva mensagem do usuário
    const { data: userMsg, error: userMsgErr } = await supabase
      .from("messages")
      .insert({
        thread_id: data.threadId,
        user_id: userId,
        role: "user",
        content: data.text,
      })
      .select()
      .single();
    if (userMsgErr) throw userMsgErr;

    // 3. busca profile para o prompt
    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_income")
      .eq("id", userId)
      .maybeSingle();

    // 4. chama Lovable AI
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    let nlu: NluResult;
    try {
      const result = await generateText({
        model,
        system: buildSystemPrompt(profile?.monthly_income ? Number(profile.monthly_income) : null),
        prompt: `Mensagem do usuário: "${data.text}"\n\nResponda SOMENTE com um objeto JSON válido seguindo este formato (sem markdown, sem comentários):\n{\n  "intent": "register_expense" | "register_income" | "transfer" | "query_balance" | "create_goal" | "update_goal" | "delete_goal" | "ask_advice" | "query_report" | "correct_classification" | "smalltalk",\n  "intent_confidence": 0.0-1.0,\n  "entities": {\n    "amount": number | null,\n    "currency": "BRL" | null,\n    "date": "YYYY-MM-DD" | null,\n    "category": string | null,\n    "category_confidence": 0.0-1.0 | null,\n    "category_alternatives": [string, string, string],\n    "merchant": string | null,\n    "note": string | null,\n    "recurrence_flag": boolean,\n    "goal_title": string | null,\n    "goal_target_amount": number | null,\n    "goal_target_date": "YYYY-MM-DD" | null,\n    "goal_current_amount": number | null\n  },\n  "reply": "resposta curta e amigável em PT-BR"\n}\n\nPara intent = create_goal: extraia goal_title (ex: "Viagem", "Reserva de emergência"), goal_target_amount (valor a alcançar) e goal_target_date quando houver prazo (ex: "em julho" → último dia de julho do ano corrente ou próximo). goal_current_amount é opcional.\nPara intent = update_goal (ex: "aportei 200 na viagem"): goal_title é o nome da meta e amount é o aporte.\nPara intent = delete_goal: goal_title é o nome da meta a remover.`,
      });
      const cleaned = result.text.replace(/```json\n?|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      nlu = NluSchema.parse(parsed);
    } catch (e) {
      console.error("[chat] NLU error", e);
      nlu = {
        intent: "smalltalk",
        intent_confidence: 0.3,
        entities: {
          amount: null, currency: null, date: null, category: null,
          category_confidence: null, category_alternatives: [],
          merchant: null, note: null, recurrence_flag: false,
          goal_title: null, goal_target_amount: null, goal_target_date: null, goal_current_amount: null,
        },
        reply: "Não consegui processar agora. Pode tentar reformular?",
      };
    }

    // 5. monta proposta de transação se aplicável
    let proposedTransaction: null | {
      kind: "expense" | "income";
      amount: number;
      category: string | null;
      category_confidence: number | null;
      category_alternatives: string[];
      merchant: string | null;
      occurred_at: string;
      note: string | null;
      is_recurring: boolean;
    } = null;

    let savedTransactionId: string | null = null;
    if (
      (nlu.intent === "register_expense" || nlu.intent === "register_income") &&
      nlu.entities.amount && nlu.entities.amount > 0
    ) {
      const kind = nlu.intent === "register_expense" ? "expense" : "income";
      const occurred_at = nlu.entities.date ?? new Date().toISOString().slice(0, 10);
      proposedTransaction = {
        kind,
        amount: nlu.entities.amount,
        category: nlu.entities.category,
        category_confidence: nlu.entities.category_confidence,
        category_alternatives: nlu.entities.category_alternatives.filter(
          (c) => ALL_CATEGORIES.includes(c as (typeof ALL_CATEGORIES)[number]),
        ),
        merchant: nlu.entities.merchant,
        occurred_at,
        note: nlu.entities.note,
        is_recurring: nlu.entities.recurrence_flag,
      };

      // Auto-save da transação
      try {
        let categoryId: string | null = null;
        if (nlu.entities.category) {
          const { data: cat } = await supabase
            .from("categories").select("id").eq("name", nlu.entities.category)
            .or(`user_id.eq.${userId},user_id.is.null`).limit(1).maybeSingle();
          categoryId = cat?.id ?? null;
        }
        const { data: acc } = await supabase
          .from("accounts").select("id").eq("user_id", userId).eq("is_default", true).limit(1).maybeSingle();
        const { data: tx, error: txErr } = await supabase.from("transactions").insert({
          user_id: userId,
          account_id: acc?.id ?? null,
          category_id: categoryId,
          kind,
          amount: nlu.entities.amount,
          merchant: nlu.entities.merchant,
          description: nlu.entities.merchant ?? nlu.entities.note,
          note: nlu.entities.note,
          occurred_at,
          is_recurring: nlu.entities.recurrence_flag,
          source: "chat",
          raw_message_id: userMsg.id,
          confidence: nlu.entities.category_confidence,
        }).select().single();
        if (!txErr && tx) {
          savedTransactionId = tx.id;
          const sign = kind === "expense" ? "-" : "+";
          nlu.reply = `${nlu.reply}\n\n✅ Salvo: ${sign}R$ ${nlu.entities.amount.toFixed(2)}${nlu.entities.category ? ` em ${nlu.entities.category}` : ""}.`;
        } else if (txErr) {
          console.error("[chat] auto-save tx error", txErr);
        }
      } catch (e) {
        console.error("[chat] auto-save tx exception", e);
      }
    }

    // 5b. ações de meta
    let goalAction: null | { action: "created" | "updated" | "deleted"; goal_id: string | null; goal_title: string; message: string } = null;
    try {
      if (nlu.intent === "create_goal" && nlu.entities.goal_title && nlu.entities.goal_target_amount && nlu.entities.goal_target_amount > 0) {
        const { data: g, error } = await supabase.from("goals").insert({
          user_id: userId,
          title: nlu.entities.goal_title,
          target_amount: nlu.entities.goal_target_amount,
          current_amount: nlu.entities.goal_current_amount ?? 0,
          target_date: nlu.entities.goal_target_date,
        }).select().single();
        if (!error && g) {
          goalAction = { action: "created", goal_id: g.id, goal_title: g.title, message: `Meta "${g.title}" criada: R$ ${Number(g.target_amount).toFixed(2)}${g.target_date ? ` até ${g.target_date}` : ""}.` };
          nlu.reply = `${nlu.reply}\n\n✅ ${goalAction.message}`;
        }
      } else if (nlu.intent === "update_goal" && nlu.entities.goal_title && nlu.entities.amount && nlu.entities.amount > 0) {
        const { data: existing } = await supabase
          .from("goals").select("*").eq("user_id", userId).ilike("title", `%${nlu.entities.goal_title}%`).limit(1).maybeSingle();
        if (existing) {
          const newAmount = Number(existing.current_amount) + nlu.entities.amount;
          const { data: g } = await supabase.from("goals").update({ current_amount: newAmount }).eq("id", existing.id).select().single();
          if (g) {
            const remaining = Math.max(0, Number(g.target_amount) - newAmount);
            goalAction = { action: "updated", goal_id: g.id, goal_title: g.title, message: `+R$ ${nlu.entities.amount.toFixed(2)} em "${g.title}". Faltam R$ ${remaining.toFixed(2)}.` };
            nlu.reply = `${nlu.reply}\n\n✅ ${goalAction!.message}`;
          }
        }
      } else if (nlu.intent === "delete_goal" && nlu.entities.goal_title) {
        const { data: existing } = await supabase
          .from("goals").select("*").eq("user_id", userId).ilike("title", `%${nlu.entities.goal_title}%`).limit(1).maybeSingle();
        if (existing) {
          await supabase.from("goals").delete().eq("id", existing.id);
          goalAction = { action: "deleted", goal_id: existing.id, goal_title: existing.title, message: `Meta "${existing.title}" removida.` };
          nlu.reply = `${nlu.reply}\n\n🗑️ ${goalAction!.message}`;
        }
      }
    } catch (e) {
      console.error("[chat] goal action error", e);
    }

    // 6. salva resposta do assistente
    const { data: asstMsg, error: asstErr } = await supabase
      .from("messages")
      .insert({
        thread_id: data.threadId,
        user_id: userId,
        role: "assistant",
        content: nlu.reply,
        parts: {
          intent: nlu.intent,
          intent_confidence: nlu.intent_confidence,
          entities: nlu.entities,
          proposed_transaction: proposedTransaction,
          goal_action: goalAction,
          saved_transaction_id: savedTransactionId,
        },
      })
      .select()
      .single();
    if (asstErr) throw asstErr;

    // 7. atualiza título do thread se for "Nova conversa"
    if (thread.title === "Nova conversa") {
      const newTitle = data.text.slice(0, 40);
      await supabase
        .from("threads")
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq("id", thread.id);
    } else {
      await supabase
        .from("threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", thread.id);
    }

    return {
      userMessage: userMsg,
      assistantMessage: asstMsg,
      nlu,
      proposedTransaction,
    };
  });

// Confirma uma transação proposta
const ConfirmTxInput = z.object({
  messageId: z.string().uuid(),
  kind: z.enum(["expense", "income"]),
  amount: z.number().positive(),
  category: z.string().nullable(),
  merchant: z.string().nullable(),
  occurred_at: z.string(),
  note: z.string().nullable(),
  is_recurring: z.boolean(),
  account_id: z.string().uuid().nullable(),
  original_category: z.string().nullable(),
  original_confidence: z.number().nullable(),
  original_text: z.string(),
});

export const saveProposedTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConfirmTxInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // resolve category_id
    let categoryId: string | null = null;
    if (data.category) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("name", data.category)
        .or(`user_id.eq.${userId},user_id.is.null`)
        .limit(1)
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    // resolve account
    let accountId = data.account_id;
    if (!accountId) {
      const { data: acc } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("is_default", true)
        .limit(1)
        .maybeSingle();
      accountId = acc?.id ?? null;
    }

    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: accountId,
        category_id: categoryId,
        kind: data.kind,
        amount: data.amount,
        merchant: data.merchant,
        description: data.merchant ?? data.note,
        note: data.note,
        occurred_at: data.occurred_at,
        is_recurring: data.is_recurring,
        source: "chat",
        raw_message_id: data.messageId,
        confidence: data.original_confidence,
      })
      .select()
      .single();
    if (error) throw error;

    // Se o usuário corrigiu a categoria, salva para futuro re-treino
    if (
      data.original_category &&
      data.category &&
      data.original_category !== data.category
    ) {
      await supabase.from("classification_corrections").insert({
        user_id: userId,
        text: data.original_text,
        amount: data.amount,
        merchant: data.merchant,
        predicted_category: data.original_category,
        predicted_confidence: data.original_confidence,
        corrected_category: data.category,
      });
    }

    return tx;
  });
