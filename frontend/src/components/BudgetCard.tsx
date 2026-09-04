'use client';

import type { Budget } from '@/lib/api';

interface BudgetCardProps {
  budget: Budget;
  targetBudget?: number | null;
}

function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  intercity_transport: { label: 'Intercity Transport', icon: '✈', color: '#60a5fa' },
  local_transport: { label: 'Local Transport', icon: '🚕', color: '#818cf8' },
  accommodation: { label: 'Accommodation', icon: '🏨', color: '#8b5cf6' },
  food: { label: 'Food & Dining', icon: '🍽', color: '#f87171' },
  activities: { label: 'Activities', icon: '📍', color: '#34d399' },
  miscellaneous: { label: 'Miscellaneous', icon: '💼', color: '#9ca3b5' },
};

export function BudgetCard({ budget, targetBudget }: BudgetCardProps) {
  const total = budget.intercity_transport + budget.local_transport + budget.accommodation + budget.food + budget.activities + budget.miscellaneous;
  const rangeMin = total * 0.9;
  const rangeMax = total * 1.15;

  const isOverBudget = targetBudget && total > targetBudget;
  const overage = targetBudget && isOverBudget ? total - targetBudget : 0;

  const categoryBreakdown = [
    { key: 'intercity_transport', value: budget.intercity_transport },
    { key: 'accommodation', value: budget.accommodation },
    { key: 'food', value: budget.food },
    { key: 'activities', value: budget.activities },
    { key: 'local_transport', value: budget.local_transport },
    { key: 'miscellaneous', value: budget.miscellaneous },
  ].filter((c) => c.value > 0);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-bg-card)',
        border: isOverBudget ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid var(--color-border)',
      }}
    >
      {/* Header — total */}
      <div className="px-6 py-6 text-center" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Trip estimate
        </p>
        <div
          className="text-5xl font-bold font-display mb-1 animate-fade-in-up"
          style={{ color: isOverBudget ? 'var(--color-error)' : 'var(--color-text-primary)' }}
        >
          {formatCurrency(total, budget.currency)}
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Range: {formatCurrency(rangeMin, budget.currency)} – {formatCurrency(rangeMax, budget.currency)}
        </p>

        {/* Over budget warning */}
        {isOverBudget && (
          <div
            className="mt-4 px-4 py-2.5 rounded-xl text-sm animate-fade-in"
            style={{
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid rgba(248, 113, 113, 0.2)',
              color: 'var(--color-error)',
            }}
          >
            {formatCurrency(overage, budget.currency)} over your {formatCurrency(targetBudget!, budget.currency)} budget.
            Try asking: "Optimize my budget" or "Find a cheaper hotel".
          </div>
        )}

        {/* Within budget */}
        {targetBudget && !isOverBudget && (
          <div
            className="mt-4 px-4 py-2 rounded-xl text-sm animate-fade-in"
            style={{
              background: 'rgba(52, 211, 153, 0.07)',
              border: '1px solid rgba(52, 211, 153, 0.15)',
              color: 'var(--color-success)',
            }}
          >
            Within your {formatCurrency(targetBudget, budget.currency)} budget
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div className="p-6">
        <p className="text-xs font-medium mb-4" style={{ color: 'var(--color-text-muted)' }}>Breakdown</p>

        {/* Visual bar */}
        <div className="flex h-2 rounded-full overflow-hidden mb-6 gap-px">
          {categoryBreakdown.map(({ key, value }) => {
            const config = CATEGORY_CONFIG[key];
            const pct = (value / total) * 100;
            return (
              <div
                key={key}
                style={{ width: `${pct}%`, background: config.color }}
                title={`${config.label}: ${Math.round(pct)}%`}
              />
            );
          })}
        </div>

        {/* Line items */}
        <div className="space-y-3">
          {(budget.line_items || []).map((item, i) => {
            const catKey = item.category;
            const config = CATEGORY_CONFIG[catKey] || { label: item.label, icon: '📋', color: '#9ca3b5' };
            return (
              <div key={i} className="flex items-center justify-between gap-3 animate-fade-in-up">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: `${config.color}15` }}
                  >
                    {config.icon}
                  </div>
                  <div>
                    <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {item.label}
                    </div>
                    {item.is_estimated && (
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Estimated
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {formatCurrency(item.amount, item.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
