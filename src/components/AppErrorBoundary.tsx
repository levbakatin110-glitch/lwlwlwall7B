"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null; repairing: boolean };

function hardRepair() {
  try {
    sessionStorage.setItem("maya-crash", "1");
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem("maya-mom-ai");
    localStorage.removeItem("maya-theme");
    localStorage.removeItem("maya-identity-v1");
    localStorage.removeItem("maya-onboarding-progress-v1");
  } catch {
    /* ignore */
  }
  try {
    document.cookie = "maya_id=; path=/; max-age=0; SameSite=Lax";
  } catch {
    /* ignore */
  }
  window.location.replace("/?fix=1");
}

/**
 * Ловит падения AppShell. Один раз чинит сама (без клика), иначе кнопки.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, repairing: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[maya] AppErrorBoundary", error, info.componentStack);
    try {
      const already = sessionStorage.getItem("maya-auto-repaired") === "1";
      if (!already) {
        sessionStorage.setItem("maya-auto-repaired", "1");
        this.setState({ repairing: true });
        hardRepair();
        return;
      }
    } catch {
      /* fall through to UI */
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    if (this.state.repairing) {
      return (
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight">
            Чиним Маю…
          </p>
          <p className="mt-2 text-sm text-muted">Сбрасываем старые данные</p>
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-display text-2xl font-semibold tracking-tight">
          Мая споткнулась
        </p>
        <p className="mt-2 text-sm text-muted">
          Нажми кнопку — откроем чистый старт.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium"
          >
            Попробовать снова
          </button>
          <button
            type="button"
            onClick={() => hardRepair()}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[var(--on-accent,#fff)]"
          >
            Очистить и открыть
          </button>
        </div>
      </div>
    );
  }
}
