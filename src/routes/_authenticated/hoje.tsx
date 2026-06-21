import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayDashboard } from "@/lib/dashboard.functions";
import { updateProfile } from "@/lib/goals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/finance";
import { Sparkles, TrendingUp, TrendingDown, Wallet, Lightbulb } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, Suspense } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({ meta: [{ title: "Hoje · Finlo" }] }),
  component: () => (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
      <TodayPage />
    </Suspense>
  ),
});

function TodayPage() {
  const fetchDashboard = useServerFn(getTodayDashboard);
  const { data } = useSuspenseQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header>
        <p className="text-sm text-muted-foreground">Olá{data.profile?.full_name ? `, ${data.profile.full_name.split(" ")[0]}` : ""} 👋</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Como está hoje</h1>
      </header>

      {/* Balance card */}
      <Card className="border-0 shadow-card bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-1">
            <Wallet className="w-4 h-4" /> Saldo estimado
          </div>
          <div className="text-4xl font-bold tracking-tight">{formatBRL(data.balance)}</div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-primary-foreground/10 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs opacity-80"><TrendingUp className="w-3.5 h-3.5" /> Entradas mês</div>
              <div className="font-semibold mt-0.5">{formatBRL(data.monthIncome)}</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs opacity-80"><TrendingDown className="w-3.5 h-3.5" /> Saídas mês</div>
              <div className="font-semibold mt-0.5">{formatBRL(data.monthExpense)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!data.profile?.monthly_income && <IncomeSetup />}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Recomendações do agente
          </h2>
          <div className="space-y-2.5">
            {data.recommendations.map((r) => (
              <Card key={r.id} className="border-0 shadow-soft">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center shrink-0">
                      <Lightbulb className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{r.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{r.body}</p>
                      {r.action && (
                        <Button size="sm" variant="link" asChild className="px-0 mt-1 h-auto">
                          <Link to={r.action.href}>{r.action.label} →</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Top categories */}
      {data.topCategories.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top categorias do mês</h2>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 space-y-2.5">
              {data.topCategories.map(([name, value]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span>{name}</span>
                  <span className="font-medium">{formatBRL(value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <Button asChild className="w-full" size="lg">
        <Link to="/chat">Registrar transação no chat</Link>
      </Button>
    </div>
  );
}

function IncomeSetup() {
  const qc = useQueryClient();
  const save = useServerFn(updateProfile);
  const [value, setValue] = useState("");
  const m = useMutation({
    mutationFn: (n: number) => save({ data: { monthly_income: n, onboarded: true } }),
    onSuccess: () => {
      toast.success("Renda salva!");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm">Informe sua renda mensal</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Para receber dicas baseadas no seu orçamento real.</p>
        <form
          onSubmit={(e) => { e.preventDefault(); const n = Number(value.replace(",", ".")); if (n > 0) m.mutate(n); }}
          className="flex gap-2 mt-3"
        >
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex: 3500" inputMode="decimal" />
          <Button type="submit" disabled={m.isPending}>Salvar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
