import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProposedTransaction } from "@/lib/chat.functions";
import { listAccounts, listCategories } from "@/lib/dashboard.functions";
import { formatBRL } from "@/lib/finance";
import { toast } from "sonner";
import { Check, Pencil, X, Sparkles } from "lucide-react";

type Proposed = {
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

export function ProposedTransactionCard({
  messageId,
  proposed,
  originalText,
}: {
  messageId: string;
  proposed: Proposed;
  originalText: string;
}) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const [category, setCategory] = useState(proposed.category ?? "Outros");
  const [amount, setAmount] = useState(String(proposed.amount));
  const [merchant, setMerchant] = useState(proposed.merchant ?? "");
  const [date, setDate] = useState(proposed.occurred_at);
  const [note, setNote] = useState(proposed.note ?? "");
  const [recurring, setRecurring] = useState(proposed.is_recurring);

  const fetchAccounts = useServerFn(listAccounts);
  const fetchCategories = useServerFn(listCategories);
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts() });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: () => fetchCategories() });

  const save = useServerFn(saveProposedTransaction);
  const m = useMutation({
    mutationFn: () => save({
      data: {
        messageId,
        kind: proposed.kind,
        amount: Number(amount),
        category: category || null,
        merchant: merchant || null,
        occurred_at: date,
        note: note || null,
        is_recurring: recurring,
        account_id: accountsQ.data?.[0]?.id ?? null,
        original_category: proposed.category,
        original_confidence: proposed.category_confidence,
        original_text: originalText,
      },
    }),
    onSuccess: () => {
      setSaved(true);
      toast.success("Transação salva!");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (cancelled) return null;

  const lowConfidence = (proposed.category_confidence ?? 1) < 0.7;
  const cats = (categoriesQ.data ?? []).filter((c) => c.kind === proposed.kind);

  if (saved) {
    return (
      <Card className="border-success/40 bg-success/5 mt-2 max-w-md">
        <CardContent className="p-3 flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-success" />
          <span className="text-success-foreground font-medium">Salva</span>
          <span className="text-muted-foreground">· {formatBRL(amount)} · {category}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 mt-2 max-w-md shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Sparkles className="w-3 h-3" /> Transação detectada
        </div>

        {!edit ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-2xl font-bold tracking-tight ${proposed.kind === "expense" ? "text-foreground" : "text-success"}`}>
                {proposed.kind === "expense" ? "-" : "+"}{formatBRL(amount)}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString("pt-BR")}</span>
            </div>
            <div className="mt-1.5 text-sm">
              <span className="font-medium">{category}</span>
              {merchant && <span className="text-muted-foreground"> · {merchant}</span>}
            </div>

            {lowConfidence && proposed.category_alternatives.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1.5">Categoria pouco certa. Talvez:</p>
                <div className="flex flex-wrap gap-1.5">
                  {proposed.category_alternatives.slice(0, 3).map((alt) => (
                    <button
                      key={alt}
                      onClick={() => setCategory(alt)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${category === alt ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"}`}
                    >
                      {alt}
                    </button>
                  ))}
                  <button onClick={() => setEdit(true)} className="text-xs px-2.5 py-1 rounded-full border hover:bg-secondary">Outra</button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending} className="flex-1">
                <Check className="w-4 h-4" /> Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
                <Pencil className="w-4 h-4" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCancelled(true)} aria-label="Cancelar">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Valor</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {cats.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Estabelecimento</Label>
              <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nota</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              Marcar como recorrente
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending} className="flex-1">
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(false)}>Voltar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
