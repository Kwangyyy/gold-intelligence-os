"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-8 w-full animate-pulse rounded-lg" style={{ background: "rgba(71,85,105,0.15)" }} />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-base-border/30 bg-base-panel/40 px-3 py-2">
        {session.user.image ? (
          <Image src={session.user.image} alt="avatar" width={24} height={24}
            className="rounded-full border border-gold/30" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: "rgba(245,196,81,0.2)", color: "#f5c451" }}>
            {session.user.name?.[0] ?? "?"}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] text-silver/70">
          {session.user.name ?? session.user.email}
        </span>
        <button onClick={() => signOut()}
          className="shrink-0 text-[10px] text-silver/30 transition-colors hover:text-red-400">
          ออก
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => signIn("google")}
      className="w-full rounded-xl border px-3 py-2 text-xs font-semibold transition-all"
      style={{
        borderColor: "rgba(245,196,81,0.35)",
        background: "rgba(245,196,81,0.06)",
        color: "rgba(245,196,81,0.8)",
      }}>
      🔑 เข้าสู่ระบบ (Google)
    </button>
  );
}
