import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMonthlyReport, listTransactions } from "@/lib/dashboard.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBRL, PT_MONTHS } from "@/lib/finance";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Suspense, useState } from "react";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · Finlo" }] }),
  component: () => (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
      <ReportsPage />
    </Suspense>
  ),
});

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const fetchReport = useServerFn(getMonthlyReport);
  const fetchTxs = useServerFn(listTransactions);
  const { data: report } = useSuspenseQuery({
    queryKey: ["report", year, month],
    queryFn: () => fetchReport({ data: { year, month } }),
  });
  const { data: txs } = useSuspenseQuery({ queryKey: ["transactions"], queryFn: () => fetchTxs() });

  function nav(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  function exportCsv() {
    const rows = (report.rows ?? []) as Array<{ amount: number; kind: string; occurred_at: string; category?: { name?: string } | null }>;
    const header = "data,tipo,valor,categoria";
    const csv = [header, ...rows.map((r) => `${r.occurred_at},${r.kind},${r.amount},${(r.category as { name?: string } | null)?.name ?? ""}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finlo-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const variation = report.variationPct;
  const variationStr = variation > 0 ? `+${variation.toFixed(1)}%` : `${variation.toFixed(1)}%`;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Visão mensal das suas finanças.</p>
      </header>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon-sm" onClick={() => nav(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <h2 className="font-semibold capitalize">{PT_MONTHS[month - 1]} {year}</h2>
            <Button variant="ghost" size="icon-sm" onClick={() => nav(1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-secondary rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Entradas</div>
              <div className="font-semibold text-success mt-0.5">{formatBRL(report.income)}</div>
            </div>
            <div className="bg-secondary rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Saídas</div>
              <div className="font-semibold mt-0.5">{formatBRL(report.expense)}</div>
            </div>
            <div className="bg-secondary rounded-lg p-3">
              <div className="text-xs text-muted-foreground">vs mês anterior</div>
              <div className={`font-semibold mt-0.5 ${variation > 0 ? "text-destructive" : "text-success"}`}>{variationStr}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Gastos por categoria</h3>
          {report.chart.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados neste mês.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={report.chart}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {report.chart.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Top 5 categorias</h3>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-3.5 h-3.5" /> CSV</Button>
          </div>
          {report.topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">—</p>
          ) : (
            <ul className="space-y-2">
              {report.topCategories.map(([name, value]) => (
                <li key={name} className="flex justify-between text-sm">
                  <span>{name}</span>
                  <span className="font-medium">{formatBRL(value)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Últimas transações</h3>
          <div className="divide-y">
            {txs.slice(0, 20).map((t) => {
              const cat = (t.category as { name?: string; color?: string } | null) ?? null;
              return (
                <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.merchant || t.note || cat?.name || "Transação"}</div>
                    <div className="text-xs text-muted-foreground">{cat?.name ?? "—"} · {new Date(t.occurred_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <span className={`font-semibold ${t.kind === "expense" ? "text-foreground" : "text-success"}`}>
                    {t.kind === "expense" ? "-" : "+"}{formatBRL(t.amount)}
                  </span>
                </div>
              );
            })}
            {txs.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhuma transação ainda.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
