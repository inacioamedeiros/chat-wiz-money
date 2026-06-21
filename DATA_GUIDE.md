# DATA_GUIDE — Dados, classificação e re-treino

## Formato CSV esperado (compatível com o escopo original)

```
id,text,amount,merchant,date,category,label
1,"Almoço no restaurante",32.00,"Restaurante Sabor",2026-06-21,Alimentação,expense
2,"Salário do mês",3500.00,"Empresa X",2026-06-05,Salário,income
3,"Corrida de Uber",23.50,"Uber",2026-06-20,Transporte,expense
```

- `text` — frase original do usuário
- `amount` — valor em BRL (ponto como decimal)
- `merchant` — estabelecimento (pode ser vazio)
- `date` — ISO `YYYY-MM-DD`
- `category` — uma das categorias suportadas (veja `src/lib/categories-list.ts`)
- `label` — `expense` ou `income`

## Como funciona a classificação hoje

Este MVP usa o **Lovable AI Gateway** (`google/gemini-3-flash-preview`) em vez de um modelo FastText treinado localmente. Vantagens para a fase de validação:

- Zero infra de ML para gerenciar.
- Suporta variações coloquiais em PT-BR sem treino.
- Devolve `confidence` e `alternatives` no mesmo prompt.

Limitação: custo por requisição. Após validar o produto, vale migrar para um classificador próprio.

## Captura de correções (já implementada)

Sempre que o usuário muda a categoria sugerida no card de proposta, a aplicação grava em `classification_corrections`:

```sql
classification_corrections (
  text, amount, merchant,
  predicted_category, predicted_confidence,
  corrected_category, ...
)
```

Esses dados são o **dataset de fine-tuning** para a próxima geração do modelo.

## Migrando para classificador próprio (roadmap)

Quando houver volume suficiente (~5k correções):

1. **Exportar dataset**:
   ```sql
   SELECT text, amount, merchant, corrected_category AS category
   FROM classification_corrections;
   ```
   Salvar como CSV no formato acima.

2. **Treinar FastText** (script externo, fora do escopo deste MVP):
   ```bash
   # Pseudo-código
   fasttext supervised -input train.txt -output model_v2 \
     -epoch 25 -lr 0.5 -wordNgrams 2
   ```

3. **Servir via endpoint REST** (`POST /classify`) e substituir a chamada Gemini em `src/lib/chat.functions.ts` por:
   ```ts
   const r = await fetch(process.env.CLASSIFIER_URL!, {
     method: "POST",
     body: JSON.stringify({ text, amount, merchant, date }),
   });
   const { category, confidence, alternatives } = await r.json();
   ```

4. **Versionamento**: armazene `model_version` no campo `confidence` ou crie coluna `classifier_version` em `transactions`.

## Dataset sintético inicial

Para gerar 2.000 exemplos em PT-BR coloquial (não incluído por economia de espaço), recomendo prompt único ao Lovable AI:

```
Gere 200 frases coloquiais brasileiras de gasto/receita,
cobrindo: alimentação, transporte, mercado, lazer, salário, freelance,
assinaturas, contas, saúde. Formato CSV: text,amount,category,label.
```

Rode 10 vezes com seeds diferentes para chegar a 2.000 linhas.

## Estrutura completa do banco

Veja `supabase/migrations/` no projeto Lovable Cloud (gerado automaticamente). Tabelas principais:

- `profiles` — usuário + renda mensal
- `accounts` — contas (carteira, cartão, etc.)
- `categories` — globais (`user_id IS NULL`) + customizadas por usuário
- `transactions` — todas as movimentações
- `goals` — metas com aporte sugerido
- `threads` + `messages` — histórico do chat
- `classification_corrections` — feedback de classificação

Todas as tabelas têm **RLS** que limita o acesso ao `auth.uid()` do dono.
