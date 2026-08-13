import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface StatusBarProps {
  path?: string;
  error?: string;
  notice?: string;
  isBusy: boolean;
}

export function StatusBar({ path, error, notice, isBusy }: StatusBarProps) {
  const message = error || notice || (isBusy ? "文書を読み込んでいます…" : path ? "読込完了" : "待機中");

  return (
    <footer
      className={`statusbar ${error ? "has-error" : notice ? "has-notice" : ""}`}
      aria-live="polite"
    >
      <span className="statusbar__state">
        {error ? (
          <AlertTriangle aria-hidden="true" size={14} />
        ) : notice ? (
          <Info aria-hidden="true" size={14} />
        ) : (
          <CheckCircle2 aria-hidden="true" size={14} />
        )}
        <span className="statusbar__message" title={message}>
          {message}
        </span>
      </span>
      {path && <span className="statusbar__path">{path}</span>}
      <span className="statusbar__encoding">UTF-8 · 読み取り専用</span>
    </footer>
  );
}
