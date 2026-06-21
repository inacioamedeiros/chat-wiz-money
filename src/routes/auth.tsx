import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar · Finlo" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já está logado.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/hoje" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Falha no login Google");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/hoje" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-card">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Finlo</h1>
          <p className="text-sm text-muted-foreground mt-1">Seu agente financeiro por chat</p>
        </div>

        <Card className="border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
              <button
                onClick={() => setMode("signin")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "signin" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
              >Entrar</button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "signup" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
              >Criar conta</button>
            </div>

            <form onSubmit={handleEmail} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Como devemos te chamar?</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button variant="outline" onClick={handleGoogle} disabled={loading} className="w-full">
              Continuar com Google
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Ao continuar você concorda com nossos termos.<br />
          Seus dados são criptografados e nunca compartilhados.
        </p>
      </div>
    </div>
  );
}
