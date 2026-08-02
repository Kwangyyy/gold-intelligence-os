"use client";

/**
 * States how old a page's underlying data is.
 *
 * Several pages carry a reference table that is revised once a quarter or once
 * a year — central bank reserves, above-ground stock, mining costs. Their
 * footers printed the *render* time next to the source name, so "World Gold
 * Council · 21:15" read as a live figure when the numbers were from Q4 2024.
 * This separates the two: the vintage of the data, and the fact that only the
 * page itself is current.
 */
export function DataVintage({ asOf, caveat }: { asOf?: string; caveat?: string }) {
  if (!asOf) return null;
  return (
    <div
      className="mt-3 rounded-xl px-3 py-2 text-[10px] leading-relaxed"
      style={{
        background: "rgba(251,146,60,0.06)",
        border: "1px solid rgba(251,146,60,0.18)",
        color: "rgba(251,146,60,0.85)",
      }}
    >
      <span className="font-bold">ⓘ ข้อมูลชุดนี้เป็นของ {asOf}</span>
      {caveat ? (
        <span style={{ color: "rgba(175,185,215,0.55)" }}> — {caveat}</span>
      ) : null}
    </div>
  );
}
