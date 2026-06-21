export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (Number.isNaN(n)) return BRL.format(0);
  return BRL.format(n);
}

export function monthsBetween(from: Date, to: Date): number {
  const m =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  return Math.max(1, m);
}

export function suggestedMonthlyContribution(
  target: number,
  current: number,
  targetDate: Date | string | null,
): number {
  const remaining = Math.max(0, target - current);
  if (!targetDate) return Math.ceil(remaining / 12);
  const td = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  const months = monthsBetween(new Date(), td);
  return Math.ceil(remaining / months);
}

export const PT_MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
