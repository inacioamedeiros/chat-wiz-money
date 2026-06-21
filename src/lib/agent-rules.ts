/**
 * Motor de regras do Agente Financeiro.
 * Avalia transações e metas, retorna 1-3 recomendações priorizadas.
 */

export type AgentContext = {
  monthlyIncome: number;
  monthSpendByCategory: Record<string, number>;
  monthSpendTotal: number;
  goals: Array<{
    title: string;
    target_amount: number;
    current_amount: number;
    target_date: string | null;
  }>;
};

export type Recommendation = {
  id: string;
  title: string;
  body: string;
  priority: number; // 1 = mais urgente
  action?: { label: string; href: string };
};

type Rule = {
  id: string;
  evaluate: (ctx: AgentContext) => Recommendation | null;
};

const rules: Rule[] = [
  {
    id: "subscriptions-over-5pct",
    evaluate: (ctx) => {
      const subs = ctx.monthSpendByCategory["Assinaturas"] ?? 0;
      if (ctx.monthlyIncome > 0 && subs / ctx.monthlyIncome > 0.05) {
        return {
          id: "subscriptions-over-5pct",
          title: "Suas assinaturas estão pesando",
          body: `Você gastou R$ ${subs.toFixed(2)} em assinaturas este mês — mais de 5% da sua renda. Que tal revisar quais você realmente usa?`,
          priority: 1,
          action: { label: "Ver assinaturas", href: "/relatorios" },
        };
      }
      return null;
    },
  },
  {
    id: "food-over-25pct",
    evaluate: (ctx) => {
      const food = (ctx.monthSpendByCategory["Alimentação"] ?? 0) + (ctx.monthSpendByCategory["Mercado"] ?? 0);
      if (ctx.monthlyIncome > 0 && food / ctx.monthlyIncome > 0.25) {
        return {
          id: "food-over-25pct",
          title: "Alimentação acima do recomendado",
          body: `Alimentação e mercado somam R$ ${food.toFixed(2)} (mais de 25% da renda). Cozinhar 2 vezes por semana já pode economizar muito.`,
          priority: 2,
        };
      }
      return null;
    },
  },
  {
    id: "spending-over-income",
    evaluate: (ctx) => {
      if (ctx.monthlyIncome > 0 && ctx.monthSpendTotal > ctx.monthlyIncome * 0.9) {
        return {
          id: "spending-over-income",
          title: "Atenção: gastos próximos da renda",
          body: `Você já comprometeu mais de 90% da sua renda este mês. Vale a pena revisar os próximos dias.`,
          priority: 1,
          action: { label: "Ver relatório", href: "/relatorios" },
        };
      }
      return null;
    },
  },
  {
    id: "goal-progress",
    evaluate: (ctx) => {
      const behind = ctx.goals.find((g) => {
        if (!g.target_date) return false;
        const today = new Date();
        const target = new Date(g.target_date);
        const totalDays = Math.max(1, (target.getTime() - new Date(g.target_date).setDate(1)) / 86400000);
        const remaining = g.target_amount - g.current_amount;
        return remaining > 0 && target.getTime() - today.getTime() < 30 * 86400000;
      });
      if (behind) {
        const diff = behind.target_amount - behind.current_amount;
        return {
          id: "goal-progress",
          title: `Meta "${behind.title}" perto do prazo`,
          body: `Faltam R$ ${diff.toFixed(2)} para atingir e o prazo está próximo. Um aporte agora ajuda a fechar.`,
          priority: 2,
          action: { label: "Ver metas", href: "/metas" },
        };
      }
      return null;
    },
  },
  {
    id: "no-income-set",
    evaluate: (ctx) => {
      if (!ctx.monthlyIncome || ctx.monthlyIncome <= 0) {
        return {
          id: "no-income-set",
          title: "Configure sua renda mensal",
          body: "Saber sua renda permite que eu te dê dicas muito melhores e calcule percentuais reais.",
          priority: 3,
          action: { label: "Ir ao perfil", href: "/perfil" },
        };
      }
      return null;
    },
  },
  {
    id: "default-encourage",
    evaluate: (ctx) => {
      if (ctx.monthSpendTotal === 0) {
        return {
          id: "default-encourage",
          title: "Comece registrando uma transação",
          body: 'Use o chat: "Almoço R$ 25" ou "Salário R$ 3000". Eu cuido da categoria.',
          priority: 3,
          action: { label: "Abrir chat", href: "/chat" },
        };
      }
      return null;
    },
  },
];

export function generateRecommendations(ctx: AgentContext): Recommendation[] {
  return rules
    .map((r) => r.evaluate(ctx))
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
