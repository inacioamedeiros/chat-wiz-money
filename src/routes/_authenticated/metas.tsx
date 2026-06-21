import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGoals, createGoal, updateGoal, deleteGoal } from "@/lib/goals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatBRL, suggestedMonthlyContribution } from "@/lib/finance";
import { Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({ meta: [{ title: "Metas · Finlo" }] }),
  component: () => (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
      <GoalsPage />
    </Suspense>
  ),
});

function GoalsPage() {
  const qc = useQueryClient();
  const fetchGoals = useServerFn(listGoals);
  const create = useServerFn(createGoal);
  const update = useServerFn(updateGoal);
  const remove = useServerFn(deleteGoal);
  const { data: goals } = useSuspenseQuery({ queryKey: ["goals"], queryFn: () => fetchGoals() });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");

  const createM = useMutation({
    mutationFn: () => create({
      data: {
        title,
        target_amount: Number(target),
        current_amount: 0,
        target_date: date || null,
        recurrence: null,
      },
    }),
    onSuccess: () => {
      toast.success("Meta criada!");
      setOpen(false); setTitle(""); setTarget(""); setDate("");
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const addM = useMutation({
    mutationFn: ({ id, amount, current }: { id: string; amount: number; current: number }) =>
      update({ data: { id, patch: { current_amount: current + amount } } }),
    onSuccess: () => {
      toast.success("Aporte registrado!");
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Metas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seus objetivos financeiros.</p>
        </div>
        <Button onClick={() => setOpen(!open)} size="sm">
          <Plus className="w-4 h-4" /> Nova meta
        </Button>
      </header>

      {open && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reserva de emergência" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor alvo (R$)</Label><Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" /></div>
              <div><Label>Data alvo (opcional)</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createM.mutate()} disabled={!title || !target || createM.isPending}>Salvar meta</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {goals.length === 0 && !open && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Target className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold">Nenhuma meta ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">Defina um objetivo para começar a acompanhar.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {goals.map((g) => {
          const current = Number(g.current_amount);
          const targetAmt = Number(g.target_amount);
          const pct = Math.min(100, (current / targetAmt) * 100);
          const suggested = suggestedMonthlyContribution(targetAmt, current, g.target_date);
          return (
            <Card key={g.id} className="border-0 shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{g.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {formatBRL(current)} de {formatBRL(targetAmt)}
                      {g.target_date && ` · até ${new Date(g.target_date).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <button onClick={() => { if (confirm("Excluir esta meta?")) remove({ data: { id: g.id } }).then(() => qc.invalidateQueries({ queryKey: ["goals"] })); }} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <Progress value={pct} className="mt-3 h-2" />
                <div className="flex justify-between items-center mt-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Sugestão: <strong className="text-foreground">{formatBRL(suggested)}/mês</strong>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    const v = prompt("Quanto aportar agora? (R$)");
                    if (v) {
                      const n = Number(v.replace(",", "."));
                      if (n > 0) addM.mutate({ id: g.id, amount: n, current });
                    }
                  }}>+ Aportar</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
