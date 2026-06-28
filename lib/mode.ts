"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Mode = "beginner" | "pro";

interface ModeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggle: () => void;
  isBeginner: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("pro");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("gios.mode") : null;
    if (saved === "beginner" || saved === "pro") setModeState(saved);
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem("gios.mode", m);
  }, []);

  const toggle = useCallback(() => setMode(mode === "pro" ? "beginner" : "pro"), [mode, setMode]);

  const value = useMemo<ModeContextValue>(
    () => ({ mode, setMode, toggle, isBeginner: mode === "beginner" }),
    [mode, setMode, toggle]
  );

  return createElement(ModeContext.Provider, { value }, children);
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
