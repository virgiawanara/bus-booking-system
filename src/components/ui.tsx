import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-[18px] bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; loading?: boolean };
export function Button({ variant = 'primary', loading, className, children, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition disabled:opacity-40';
  const styles = {
    primary: 'bg-accent text-accent-ink hover:opacity-90',
    ghost: 'border border-line bg-white text-ink hover:border-ink/40',
    danger: 'border border-danger/30 bg-danger/5 text-danger hover:bg-danger/10',
  }[variant];
  return (
    <button className={cx(base, styles, className)} disabled={loading || rest.disabled} {...rest}>
      {loading ? 'Memproses…' : children}
    </button>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' }) {
  const styles = {
    neutral: 'bg-ink/5 text-ink-soft',
    ok: 'bg-ok/10 text-ok',
    warn: 'bg-warn/10 text-warn',
    danger: 'bg-danger/10 text-danger',
  }[tone];
  return <span className={cx('inline-flex rounded-full px-3 py-1 text-xs font-semibold', styles)}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('field', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx('field appearance-none', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('field min-h-24', props.className)} />;
}

export function Stepper({ step }: { step: number }) {
  const labels = ['Kebutuhan', 'Pilih Armada', 'Kontak', 'Konfirmasi'];
  return (
    <ol className="mb-5 flex items-center gap-1.5">
      {labels.map((l, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={l} className="flex flex-1 flex-col items-center gap-1">
            <div className={cx(
              'h-1.5 w-full rounded-full',
              done || active ? 'bg-accent' : 'bg-line',
            )} />
            <span className={cx('text-[11px] font-semibold', active || done ? 'text-ink' : 'text-ink-soft')}>{l}</span>
          </li>
        );
      })}
    </ol>
  );
}
