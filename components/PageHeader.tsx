"use client";

import type { ReactNode } from "react";

// Shared luxury page header — gold→purple accent bar + gradient title.
export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-gold via-gold-deep to-royal shadow-goldglow" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-royal">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-silver/50">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="self-start sm:self-auto">{right}</div>}
    </header>
  );
}
