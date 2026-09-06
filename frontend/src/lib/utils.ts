import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
