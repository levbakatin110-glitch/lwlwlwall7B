"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Ловит падения AppShell до английского global-error Next.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[maya] AppErrorBoundary", error, info.componentStack);
    try {
      sessionStorage.setItem("maya-crash", "1");
    } catch {
      /* ignore */
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-display text-2xl font-semibold tracking-tight">
          Мая споткнулась
        </p>
        <p className="mt-2 text-sm text-muted">
          Старые данные вкладки мешают открыться. Очистим и зайдём заново.
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
            onClick={() => {
              try {
                sessionStorage.setItem("maya-crash", "1");
              } catch {
                /* ignore */
              }
              window.location.href = "/?fix=1";
            }}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[var(--on-accent,#fff)]"
          >
            Очистить и открыть
          </button>
        </div>
      </div>
    );
  }
}
