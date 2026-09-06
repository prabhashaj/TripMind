import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount = 0, currencyCode = "INR") {
  const code = currencyCode.toUpperCase();
  const symbolMap: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    AUD: "A$",
    AED: "AED ",
  };
  const symbol = symbolMap[code] || `${code} `;
  const formattedAmount = Math.round(amount).toLocaleString();
  return `${symbol}${formattedAmount}`;
}

export function computeBudgetTotal(budget: any) {
  if (!budget) return 0;
  if (typeof budget.total === "number") return budget.total;
  return ["intercity_transport", "local_transport", "accommodation", "food", "activities", "miscellaneous"]
    .reduce((total, key) => total + Number(budget[key] || 0), 0);
}
