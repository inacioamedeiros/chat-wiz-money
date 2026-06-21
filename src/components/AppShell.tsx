import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Home, Target, BarChart3, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

const tabs = [
  { to: "/hoje", label: "Hoje", icon: Home },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-sidebar p-4 gap-1">
        <div className="px-2 py-3 mb-4">
          <h2 className="text-xl font-bold tracking-tight text-primary">Finlo</h2>
          <p className="text-xs text-muted-foreground">Agente financeiro</p>
        </div>
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-sidebar-accent"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </Link>
          );
        })}
        <div className="mt-auto">
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-muted-foreground">
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">{children}</main>

      {/* Bottom nav - mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t z-50 safe-bottom">
        <div className="grid grid-cols-5">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <t.icon className="w-5 h-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
