import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayDashboard } from "@/lib/dashboard.functions";
import { updateProfile, exportUserData, deleteAccountData } from "@/lib/goals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/finance";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Download, LogOut, Shield, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Perfil · Finlo" }] }),
  component: () => (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
      <ProfilePage />
    </Suspense>
  ),
});

function ProfilePage() {
  const fetchDashboard = useServerFn(getTodayDashboard);
  const save = useServerFn(updateProfile);
  const doExport = useServerFn(exportUserData);
  const doDelete = useServerFn(deleteAccountData);
  const navigate = useNavigate();
  const { data } = useSuspenseQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });

  const [name, setName] = useState(data.profile?.full_name ?? "");
  const [income, setIncome] = useState(String(data.profile?.monthly_income ?? ""));

  const saveM = useMutation({
    mutationFn: () => save({
      data: {
        full_name: name || null,
        monthly_income: income ? Number(income.replace(",", ".")) : null,
      },
    }),
    onSuccess: () => toast.success("Salvo!"),
  });

  async function handleExport() {
    const dump = await doExport();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "finlo-export.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados.");
  }

  async function handleDelete() {
    if (!confirm("Tem certeza? Isso apaga TODAS as suas transações, metas e conversas.")) return;
    if (!confirm("Esta ação é permanente. Confirmar?")) return;
    await doDelete();
    await supabase.auth.signOut();
    toast.success("Conta removida.");
    navigate({ to: "/auth" });
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">Seus dados e privacidade.</p>
      </header>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Dados pessoais</h3>
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Renda mensal (R$)</Label>
            <Input value={income} onChange={(e) => setIncome(e.target.value)} inputMode="decimal" placeholder="Ex: 3500" />
            <p className="text-xs text-muted-foreground mt-1">Usado para personalizar recomendações.</p>
          </div>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>Salvar</Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-4">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-success" /> Privacidade</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Seus dados são protegidos por criptografia TLS em trânsito e isolados por usuário no banco com regras de acesso (RLS). Não compartilhamos com terceiros.
          </p>
          <div className="flex flex-col gap-2 mt-4">
            <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4" /> Exportar meus dados (JSON)</Button>
            <Button variant="destructive" onClick={handleDelete}><Trash2 className="w-4 h-4" /> Excluir minha conta</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Sessão</div>
            <div className="text-xs text-muted-foreground">Saldo: {formatBRL(data.balance)}</div>
          </div>
          <Button variant="ghost" onClick={logout}><LogOut className="w-4 h-4" /> Sair</Button>
        </CardContent>
      </Card>
    </div>
  );
}
