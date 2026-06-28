"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { ChatMessage } from "@/lib/gemini";
import { Card } from "@/components/shared";
import { Disclaimer } from "@/components/Disclaimer";
import { PageHeader } from "@/components/PageHeader";

export default function ChatPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const reply = res.ok && data.reply ? data.reply : t("chatError");
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: t("chatError") }]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [t("chatSuggest1"), t("chatSuggest2"), t("chatSuggest3"), t("chatSuggest4")];

  return (
    <main className="mx-auto flex h-[calc(100vh-57px)] max-w-3xl flex-col px-4 py-6 sm:px-6">
      <PageHeader title={t("chatTitle")} subtitle={t("chatSubtitle")} />

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-base-border bg-base-card/40 p-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="text-4xl">🤖</div>
            <div>
              <div className="font-semibold text-silver">{t("chatEmptyTitle")}</div>
              <div className="mt-1 text-sm text-silver/50">{t("chatEmptyHint")}</div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-base-border bg-base-panel px-3 py-1.5 text-xs text-silver/80 transition-colors hover:border-neon/40 hover:text-neon"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} youLabel={t("chatYou")} aiLabel={t("chatAi")} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-silver/50">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-neon" />
            {t("chatThinking")}
          </div>
        )}
      </div>

      <div className="mt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chatPlaceholder")}
            className="flex-1 rounded-xl border border-base-border bg-base-panel px-4 py-2.5 text-sm text-silver outline-none placeholder:text-silver/30 focus:border-neon/50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-neon/20 px-5 py-2.5 text-sm font-semibold text-neon transition-colors hover:bg-neon/30 disabled:opacity-40"
          >
            {t("chatSend")}
          </button>
        </form>
        <div className="mt-3">
          <Disclaimer />
        </div>
      </div>
    </main>
  );
}

function Bubble({
  role,
  content,
  youLabel,
  aiLabel,
}: {
  role: "user" | "assistant";
  content: string;
  youLabel: string;
  aiLabel: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`mb-1 text-[11px] ${isUser ? "text-right text-silver/40" : "text-neon/70"}`}>
          {isUser ? youLabel : aiLabel}
        </div>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-neon/15 text-silver"
              : "rounded-tl-sm border border-base-border bg-base-panel text-silver/90"
          }`}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
