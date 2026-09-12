import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export interface MobileDetailProps {
  title: string;
  backLabel: string;
  onBack: () => void;
  kicker?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  destructiveActions?: ReactNode;
  children: ReactNode;
}

/** Layout contract for an item detail shown instead of a list on mobile. */
export function MobileDetail({
  title,
  backLabel,
  onBack,
  kicker,
  status,
  actions,
  destructiveActions,
  children,
}: MobileDetailProps) {
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <section className="mobile-detail" aria-label={title}>
      <header className="mobile-detail-header">
        <button
          ref={backRef}
          type="button"
          className="btn btn-icon mobile-detail-back"
          aria-label={backLabel}
          onClick={onBack}
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <div className="mobile-detail-heading">
          {kicker && <div className="card-kicker">{kicker}</div>}
          <h1 className="mobile-detail-title">{title}</h1>
          {status && <div className="mobile-detail-status">{status}</div>}
        </div>
        {actions && <div className="mobile-detail-actions">{actions}</div>}
      </header>

      <div className="mobile-detail-body">{children}</div>

      {destructiveActions && (
        <footer className="mobile-detail-destructive">{destructiveActions}</footer>
      )}
    </section>
  );
}
