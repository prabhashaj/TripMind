'use client';

import type { Budget } from '@/lib/api';

interface BudgetCardProps {
  budget: Budget;
  targetBudget?: number | null;
}

function fmtCurrency(amount: number, currency = 'INR'): string {
  if (currency === 'INR') return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

function fmtTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch {
    return isoString;
  }
}

const CATEGORY_CONFIG: Record<string, { label: string; abbr: string; color: string }> = {
  intercity_transport: { label: 'Intercity Transport', abbr: 'AIR',   color: '#60a5fa' },
  local_transport:     { label: 'Local Transport',     abbr: 'LOCAL', color: '#a77a2b' },
  accommodation:       { label: 'Accommodation',        abbr: 'STAY',  color: '#a77a2b' },
  food:                { label: 'Food & Dining',         abbr: 'FOOD',  color: '#f87171' },
  activities:          { label: 'Activities',            abbr: 'ACT',   color: '#34d399' },
  miscellaneous:       { label: 'Miscellaneous',         abbr: 'OTHER', color: '#89909a' },
};

export function BudgetCard({ budget, targetBudget }: BudgetCardProps) {
  const total =
    (budget.intercity_transport ?? 0) +
    (budget.local_transport ?? 0) +
    (budget.accommodation ?? 0) +
    (budget.food ?? 0) +
    (budget.activities ?? 0) +
    (budget.miscellaneous ?? 0);

  const rangeMin = total * 0.9;
  const rangeMax = total * 1.15;

  const isOverBudget = targetBudget && total > targetBudget;
  const overage = targetBudget && isOverBudget ? total - targetBudget : 0;

  const categoryBreakdown = [
    { key: 'intercity_transport', value: budget.intercity_transport ?? 0 },
    { key: 'accommodation',       value: budget.accommodation ?? 0 },
    { key: 'food',                value: budget.food ?? 0 },
    { key: 'activities',          value: budget.activities ?? 0 },
    { key: 'local_transport',     value: budget.local_transport ?? 0 },
    { key: 'miscellaneous',       value: budget.miscellaneous ?? 0 },
  ].filter((c) => c.value > 0);

  /* FX metadata — optional fields added in Phase 2 */
  const fxRate: number | undefined = budget.fx_rate;
  const fxFrom: string | undefined = budget.fx_from_currency;
  const fxTimestamp: string | undefined = budget.fx_timestamp;
  const hasFx = fxRate && fxFrom && fxFrom !== budget.currency;

  return (
    <div className={`budget-card${isOverBudget ? ' budget-card--over' : ''}`}>
      {/* ── Header — total amount ── */}
      <div className="budget-card-header">
        <p className="budget-card-trip-label">Trip estimate</p>

        <div className={`budget-card-total${isOverBudget ? ' budget-card-total--over' : ''} animate-fade-in-up`}>
          {fmtCurrency(total, budget.currency)}
        </div>

        <p className="budget-card-range">
          Range: {fmtCurrency(rangeMin, budget.currency)} – {fmtCurrency(rangeMax, budget.currency)}
        </p>

        {/* ── FX rate note ── */}
        {hasFx && (
          <p className="fx-rate-note">
            1 {fxFrom} = {budget.currency === 'INR' ? '₹' : ''}{fxRate?.toFixed(2)} {budget.currency}
            <span className="fx-rate-divider">·</span>
            {fxTimestamp ? `updated ${fmtTime(fxTimestamp)}` : 'live rate'}
          </p>
        )}

        {/* Over budget banner */}
        {isOverBudget && (
          <div className="budget-banner budget-banner--over animate-fade-in">
            {fmtCurrency(overage, budget.currency)} over your {fmtCurrency(targetBudget!, budget.currency)} budget.
            Try asking: "Optimize my budget" or "Find a cheaper hotel".
          </div>
        )}

        {/* Within budget banner */}
        {targetBudget && !isOverBudget && (
          <div className="budget-banner budget-banner--ok animate-fade-in">
            Within your {fmtCurrency(targetBudget, budget.currency)} budget
          </div>
        )}
      </div>

      {/* ── Breakdown ── */}
      <div className="budget-card-body">
        <p className="budget-breakdown-label">Breakdown</p>

        {/* Proportional colour bar */}
        <div className="budget-bar">
          {categoryBreakdown.map(({ key, value }) => {
            const config = CATEGORY_CONFIG[key];
            const pct = (value / total) * 100;
            return (
              <div
                key={key}
                className="budget-bar-segment"
                style={{ width: `${pct}%`, background: config.color }}
                title={`${config.label}: ${Math.round(pct)}%`}
              />
            );
          })}
        </div>

        {/* Line items */}
        <div className="budget-line-items">
          {(budget.line_items || []).map((item: any, i: number) => {
            const catKey = item.category;
            const config = CATEGORY_CONFIG[catKey] || { label: item.label, abbr: '📋', color: '#9ca3b5' };
            return (
              <div key={i} className="budget-line-row animate-fade-in-up">
                <div className="budget-line-left">
                  <div
                    className="budget-line-icon"
                    style={{ background: `${config.color}18` }}
                  >
                    {config.abbr}
                  </div>
                  <div>
                    <div className="budget-line-name">{item.label}</div>
                    {item.is_estimated && (
                      <div className="budget-line-estimated">Estimated</div>
                    )}
                    {/* Per-line FX note if line has a different source currency */}
                    {hasFx && item.source_currency && item.source_currency !== budget.currency && (
                      <div className="fx-rate-note">
                        {fmtCurrency(item.source_amount, item.source_currency)}
                        <span className="fx-rate-divider">→</span>
                        {fmtCurrency(item.amount, budget.currency)}
                      </div>
                    )}
                  </div>
                </div>
                <span className="budget-line-amount">
                  {fmtCurrency(item.amount, item.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
