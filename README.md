# Finlo · Agente Financeiro Conversacional

MVP web (PWA-ready) de finanças pessoais por chat em português brasileiro, construído com TanStack Start + Lovable Cloud + Lovable AI Gateway.

## O que está incluído

| Requisito do escopo original | Status |
|---|---|
| Chat com NLU (intent + entidades + confidence + fallback) | ✅ via Lovable AI Gateway (`google/gemini-3-flash-preview`) |
| Classificador de categoria + alternativas | ✅ retornadas no mesmo prompt; correções salvas em `classification_corrections` |
| Fluxo: detectar → propor → SALVAR/EDITAR/CANCELAR | ✅ `ProposedTransactionCard` |
| Metas com CRUD + aporte sugerido | ✅ fórmula `ceil((target - current) / months_remaining)` |
| Agente Financeiro (regras JSON, 1-3 recomendações priorizadas) | ✅ `src/lib/agent-rules.ts` |
| Tela Hoje, Chat, Metas, Relatórios, Perfil/Segurança | ✅ |
| Auth email/senha + Google | ✅ Lovable Cloud |
| Exportar / excluir dados | ✅ JSON, exclusão em cascata |
| Tom educativo, PT-BR | ✅ |
| Gráfico de barras + top 5 + variação vs mês anterior + CSV | ✅ |
| Multi-conversa (threads) | ✅ |
| TLS, RLS, dados isolados por usuário | ✅ |

## O que NÃO está incluído (escopo mobile original)

Como o Lovable constrói apps **web**, e não React Native:

- ❌ Build iOS/Android nativo (use Capacitor para empacotar se necessário)
- ❌ Biometria (Touch/Face ID) — não disponível em PWA; substituído por senha
- ❌ Terraform / Dockerfile / IaC AWS-GCP
- ❌ Modelo FastText local + `train_classifier.sh` (substituído por LLM com captura de correções para re-treino futuro)
- ❌ Figma exportável (design system está em `src/styles.css`)
- ❌ Sentry pago (usamos `lib/lovable-error-reporting.ts` interno)
- ❌ Testes E2E completos (deixados como sprint futura)

## Stack

- **Frontend**: React 19 + TanStack Start + TanStack Router + Tailwind v4
- **Backend**: TanStack server functions (`createServerFn`) — sem Edge Functions externos
- **DB**: PostgreSQL gerenciado (Lovable Cloud) com RLS por usuário
- **AI**: Lovable AI Gateway (`@ai-sdk/openai-compatible` + Vercel AI SDK)
- **UI**: shadcn/ui + AI Elements

## Rodando localmente

```bash
bun install
bun run dev    # http://localhost:8080
```

Variáveis necessárias (já injetadas pelo Lovable Cloud):
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

## Estrutura

```
src/
  routes/
    auth.tsx                       # login/cadastro
    _authenticated/
      route.tsx                    # gate de auth
      hoje.tsx                     # dashboard "Hoje"
      chat.index.tsx               # cria/redireciona thread
      chat.$threadId.tsx           # chat principal
      metas.tsx, relatorios.tsx, perfil.tsx
  lib/
    chat.functions.ts              # NLU + agente em uma chamada ao LLM
    threads.functions.ts           # CRUD de conversas
    dashboard.functions.ts         # hoje, relatórios, listagens
    goals.functions.ts             # metas, perfil, export, delete
    agent-rules.ts                 # motor de regras (JSON-like)
    finance.ts, categories-list.ts # helpers
  components/
    AppShell.tsx                   # nav lateral + bottom-nav mobile
    ProposedTransactionCard.tsx    # confirmação de transação detectada
```

## Métricas de beta (a coletar)

Para validar com 100 usuários no beta, recomendo instrumentar:

- `onboarding_completion_rate` — % de usuários que registram a 1ª transação
- `messages_per_user_week` — média de msgs no chat por usuário/semana
- `classification_corrections_count` — quantas vezes o usuário corrigiu a categoria sugerida (proxy da qualidade do NLU)
- `recommendation_adoption_rate` — cliques em CTAs das recomendações
- `nlu_confidence_avg` — média da confiança da intenção

A tabela `classification_corrections` já alimenta o futuro re-treino do classificador.

## Esforço estimado (entregue por sprint)

| Componente | Sprint |
|---|---|
| Schema DB + auth + RLS | 1 |
| Chat NLU + proposta de transação | 2 |
| Hoje + Metas + Relatórios + CSV | 3 |
| Polimento UI + privacidade + export | 4 |

## Próximos passos sugeridos

1. PWA: adicionar `manifest.webmanifest` se quiser instalável no celular.
2. OCR de comprovante via Lovable AI (upload de foto → extrai valor).
3. Notificações push (FCM) para lembretes de metas.
4. Substituir LLM por classificador FastText local (treinado em `classification_corrections`) quando o volume justificar.
