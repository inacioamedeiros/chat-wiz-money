import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteTransaction, updateTransaction } from "@/lib/chat.functions";
import { listCategories } from "@/lib/dashboard.functions";
import { formatBRL } from "@/lib/finance";
import { toast } from "sonner";
import { Check, Pencil, Undo2, Sparkles } from "lucide-react";

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
  messageId: _messageId,
  proposed,
  originalText,
  savedTransactionId,
}: {
  messageId: string;
  proposed: Proposed;
  originalText: string;
  savedTransactionId: string | null;
}) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [txId, setTxId] = useState(savedTransactionId);

  const [category, setCategory] = useState(proposed.category ?? "Outros");
  const [amount, setAmount] = useState(String(proposed.amount));
  const [merchant, setMerchant] = useState(proposed.merchant ?? "");
  const [date, setDate] = useState(proposed.occurred_at);
  const [note, setNote] = useState(proposed.note ?? "");
  const [recurring, setRecurring] = useState(proposed.is_recurring);

  const fetchCategories = useServerFn(listCategories);
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: () => fetchCategories() });

  const delFn = useServerFn(deleteTransaction);
  const updFn = useServerFn(updateTransaction);

  const delM = useMutation({
    mutationFn: () => delFn({ data: { id: txId! } }),
    onSuccess: () => {
      setDeleted(true);
      setTxId(null);
      toast.success("Transação removida");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const updM = useMutation({
    mutationFn: () => updFn({
      data: {
        id: txId!,
        category: category || null,
        amount: Number(amount),
        merchant: merchant || null,
        note: note || null,
        occurred_at: date,
        is_recurring: recurring,
        original_category: proposed.category,
        original_confidence: proposed.category_confidence,
        original_text: originalText,
      },
    }),
    onSuccess: () => {
      setEdit(false);
      toast.success("Transação atualizada");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (deleted || !txId) {
    return (
      <Card className="border-muted mt-2 max-w-md opacity-60">
        <CardContent className="p-3 text-sm text-muted-foreground">Transação removida.</CardContent>
      </Card>
    );
  }

  const lowConfidence = (proposed.category_confidence ?? 1) < 0.7;
  const cats = (categoriesQ.data ?? []).filter((c) => c.kind === proposed.kind);

  return (
    <Card className="border-primary/20 mt-2 max-w-md shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-success mb-2">
          <Check className="w-3 h-3" /> Salva automaticamente
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
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                  <Sparkles className="w-3 h-3" /> Categoria pouco certa. Trocar para:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {proposed.category_alternatives.slice(0, 3).map((alt) => (
                    <button
                      key={alt}
                      onClick={() => { setCategory(alt); updM.mutate(); }}
                      disabled={updM.isPending}
                      className="text-xs px-2.5 py-1 rounded-full border hover:bg-secondary"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => setEdit(true)} className="flex-1">
                <Pencil className="w-4 h-4" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => delM.mutate()} disabled={delM.isPending}>
                <Undo2 className="w-4 h-4" /> Desfazer
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
              <Button size="sm" onClick={() => updM.mutate()} disabled={updM.isPending} className="flex-1">
                Salvar alterações
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(false)}>Voltar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
