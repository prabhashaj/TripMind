export function cn(...values: Array<string | Record<string, boolean> | false | null | undefined>) {
  return values.flatMap((value) => {
    if (!value) return [];
    if (typeof value === "string") return [value];
    return Object.entries(value).filter(([, enabled]) => enabled).map(([name]) => name);
  }).join(" ");
}

export function formatINR(amount = 0) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function computeBudgetTotal(budget: any) {
  if (!budget) return 0;
  if (typeof budget.total === "number") return budget.total;
  return ["intercity_transport", "local_transport", "accommodation", "food", "activities", "miscellaneous"]
    .reduce((total, key) => total + Number(budget[key] || 0), 0);
}
