export const EXPENSE_CATEGORIES = [
  "Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação",
  "Mercado", "Assinaturas", "Roupas", "Viagem", "Contas", "Outros",
] as const;

export const INCOME_CATEGORIES = [
  "Salário", "Freelance", "Investimentos", "Outras receitas",
] as const;

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
