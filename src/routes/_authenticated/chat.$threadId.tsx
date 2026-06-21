import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  listThreads,
  getThreadMessages,
  createThread,
  deleteThread,
} from "@/lib/threads.functions";
import { sendChatMessage, saveProposedTransaction } from "@/lib/chat.functions";
import { listAccounts, listCategories } from "@/lib/dashboard.functions";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, MessageCircle } from "lucide-react";
import { ProposedTransactionCard } from "@/components/ProposedTransactionCard";
import { formatBRL } from "@/lib/finance";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "Chat · Finlo" }] }),
  component: () => (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
      <ChatPage />
    </Suspense>
  ),
});

function ChatPage() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchThreads = useServerFn(listThreads);
  const fetchMessages = useServerFn(getThreadMessages);
  const sendFn = useServerFn(sendChatMessage);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);

  const { data: threads } = useSuspenseQuery({
    queryKey: ["threads"],
    queryFn: () => fetchThreads(),
  });
  const { data: messages } = useSuspenseQuery({
    queryKey: ["messages", threadId],
    queryFn: () => fetchMessages({ data: { threadId } }),
  });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, [threadId]);

  async function onSend(text: string) {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setInput("");
    try {
      await sendFn({ data: { threadId, text: value } });
      await qc.invalidateQueries({ queryKey: ["messages", threadId] });
      await qc.invalidateQueries({ queryKey: ["threads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function newThread() {
    const t = await createFn();
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  }

  async function removeThread(id: string) {
    if (!confirm("Excluir esta conversa?")) return;
    await deleteFn({ data: { threadId: id } });
    qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === threadId) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining[0]) navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id } });
      else newThread();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen md:h-screen max-h-screen">
      {/* Thread list - desktop only */}
      <aside className="hidden lg:flex lg:w-64 flex-col border-r bg-sidebar">
        <div className="p-3 border-b">
          <Button onClick={newThread} size="sm" className="w-full">
            <Plus className="w-4 h-4" /> Nova conversa
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {threads.map((t) => (
            <div key={t.id} className="group relative">
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className={`block px-3 py-2 text-sm rounded-md truncate ${t.id === threadId ? "bg-sidebar-accent font-medium" : "hover:bg-sidebar-accent/50"}`}
              >
                {t.title}
              </Link>
              <button
                onClick={() => removeThread(t.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                aria-label="Excluir conversa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b px-4 py-3 bg-card">
          <div>
            <h1 className="font-semibold text-sm truncate">{threads.find((t) => t.id === threadId)?.title ?? "Conversa"}</h1>
            <p className="text-xs text-muted-foreground">Agente Financeiro</p>
          </div>
          <Button onClick={newThread} size="icon-sm" variant="ghost" aria-label="Nova conversa">
            <Plus className="w-4 h-4" />
          </Button>
        </header>

        <Conversation className="flex-1">
          <ConversationContent>
            {!hasMessages && <EmptyState onPick={onSend} />}
            {messages.map((m) => {
              const parts = m.parts as null | {
                proposed_transaction?: {
                  kind: "expense" | "income";
                  amount: number;
                  category: string | null;
                  category_confidence: number | null;
                  category_alternatives: string[];
                  merchant: string | null;
                  occurred_at: string;
                  note: string | null;
                  is_recurring: boolean;
                };
              };
              return (
                <Message key={m.id} from={m.role as "user" | "assistant"}>
                  <MessageContent>
                    {m.role === "assistant" ? (
                      <MessageResponse>{m.content}</MessageResponse>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </MessageContent>
                  {parts?.proposed_transaction && (
                    <ProposedTransactionCard
                      messageId={m.id}
                      originalText={messages[messages.indexOf(m) - 1]?.content ?? ""}
                      proposed={parts.proposed_transaction}
                    />
                  )}
                </Message>
              );
            })}
            {sending && (
              <Message from="assistant">
                <MessageContent><Shimmer>Pensando...</Shimmer></MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t bg-card p-3">
          <PromptInput
            onSubmit={(e) => { e.preventDefault?.(); onSend(input); }}
          >
            <PromptInputTextarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Ex: "Almoço R$ 32" ou "Quanto gastei com Uber?"'
              disabled={sending}
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={sending ? "submitted" : undefined} disabled={!input.trim() || sending} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const examples = [
    "Almoço R$ 32",
    "Uber R$ 18",
    "Salário R$ 3500",
    "iFood ontem R$ 45",
    "Quanto gastei em alimentação?",
    "Quero juntar R$ 5000 para uma viagem",
  ];
  return (
    <div className="max-w-md mx-auto text-center py-10">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4">
        <MessageCircle className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-semibold">Comece a conversar</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Conte uma despesa, peça um conselho ou crie uma meta. Eu entendo linguagem natural.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-6">
        {examples.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="text-xs px-3 py-2 rounded-lg border bg-card hover:bg-secondary text-left"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
