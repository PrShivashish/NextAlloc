import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Loader2,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

export function Spinner({ label = 'Working…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2.5 py-10 text-[var(--na-ink-secondary)]"
    >
      <Loader2
        className="h-[18px] w-[18px] motion-safe:animate-spin text-[var(--na-accent)]"
        aria-hidden="true"
      />
      <span className="text-[14px] font-medium">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-[var(--na-ink-tertiary)]" aria-hidden="true">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <div className="text-[15px] font-semibold text-[var(--na-ink-primary)]">{title}</div>
      {hint && (
        <div className="max-w-sm text-[13px] leading-relaxed text-[var(--na-ink-secondary)]">
          {hint}
        </div>
      )}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  green:
    'bg-[var(--na-status-success-bg)] text-[var(--na-status-success-text)] border border-[var(--na-status-success-border)]',
  amber:
    'bg-[var(--na-status-warning-bg)] text-[var(--na-status-warning-text)] border border-[var(--na-status-warning-border)]',
  red:
    'bg-[var(--na-status-error-bg)] text-[var(--na-status-error-text)] border border-[var(--na-status-error-border)]',
  blue:
    'bg-[var(--na-status-info-bg)] text-[var(--na-status-info-text)] border border-[var(--na-status-info-border)]',
  navy:
    'bg-[var(--na-well)] text-[var(--na-ink-primary)] border border-[var(--na-border)]',
  gray:
    'bg-[var(--na-status-neutral-bg)] text-[var(--na-ink-secondary)] border border-[var(--na-status-neutral-border)]',
  saffron:
    'bg-[var(--na-accent-subtle)] text-[var(--na-accent-ink)] border border-[var(--na-border)]',
};

export function Badge({
  tone = 'gray',
  children,
  dot: _dot,
}: {
  tone?: keyof typeof badgeTones;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return <span className={`chip ${badgeTones[tone] ?? badgeTones.gray}`}>{children}</span>;
}

export function statusTone(status: string): keyof typeof badgeTones {
  const s = status.toLowerCase();
  if (
    s.includes('optimal') ||
    s.includes('completed') ||
    s.includes('ready') ||
    s.includes('allocated') ||
    s.includes('online') ||
    s.includes('active')
  ) {
    return 'green';
  }
  if (s.includes('feasible')) return 'blue';
  if (s.includes('infeasible') || s.includes('fail') || s.includes('blocked')) return 'red';
  if (
    s.includes('progress') ||
    s.includes('running') ||
    s.includes('queued') ||
    s.includes('partial') ||
    s.includes('attention')
  ) {
    return 'amber';
  }
  if (s.includes('superseded') || s.includes('stale')) return 'gray';
  return 'navy';
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  tone = 'navy',
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'navy' | 'saffron' | 'leaf' | 'red';
}) {
  const tones = {
    navy: 'text-[var(--na-ink-primary)] bg-[var(--na-well)]',
    saffron: 'text-[var(--na-accent-ink)] bg-[var(--na-accent-subtle)]',
    leaf: 'text-[var(--na-success-text)] bg-[var(--na-success-bg)]',
    red: 'text-[var(--na-error-text)] bg-[var(--na-error-bg)]',
  };
  return (
    <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[var(--na-ink-secondary)]">{label}</div>
          <div className="font-display tabular-nums mt-2 truncate text-[28px] font-bold leading-none text-[var(--na-ink-primary)]">
            {value}
          </div>
          {sub && (
            <div className="mt-2 text-[13px] text-[var(--na-ink-secondary)]">{sub}</div>
          )}
        </div>
        {icon && (
          <div
            className={`shrink-0 rounded-[var(--na-radius-md)] p-2.5 ${tones[tone]}`}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export interface MetricBandItem {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}

export function MetricBand({
  items,
  className = '',
}: {
  items: MetricBandItem[];
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 border-y border-[var(--na-border)] lg:grid-cols-4 ${className}`}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          className="min-w-0 border-b border-[var(--na-border)] py-3.5 [&:nth-child(odd)]:pr-3 [&:nth-child(even)]:border-l [&:nth-child(even)]:pl-3 [&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-l lg:px-5 lg:py-4 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0 [&:nth-child(odd)]:lg:pr-5 [&:nth-child(even)]:lg:pl-5 [&:nth-child(odd)]:lg:first:pl-0 [&:nth-child(even)]:lg:last:pr-0"
        >
          <div
            className={`font-display tabular-nums break-words text-[22px] font-bold leading-tight sm:text-[28px] ${
              item.accent ? 'text-[var(--na-accent-ink)]' : 'text-[var(--na-ink-primary)]'
            }`}
          >
            {item.value}
          </div>
          <div className="mt-1 text-[13px] font-medium text-[var(--na-ink-secondary)]">
            {item.label}
          </div>
          {item.sub && (
            <div className="mt-1 text-[12px] text-[var(--na-ink-tertiary)]">{item.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Disclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="border-t border-[var(--na-border)] pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--na-radius-sm)] px-1 py-1 text-[13px] font-medium text-[var(--na-ink-secondary)] transition-colors duration-150 hover:text-[var(--na-ink-primary)] active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span>{label}</span>
      </button>
      {open && (
        <div
          id={panelId}
          className="mt-2 rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-4 text-[13px] text-[var(--na-ink-primary)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[18px] font-semibold text-[var(--na-ink-primary)]">
          {title}
        </h2>
        {sub && <p className="mt-1 text-[13px] text-[var(--na-ink-secondary)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'success' | 'danger';
  title?: string;
  children: React.ReactNode;
}) {
  const map = {
    info: {
      box: 'border-[var(--na-status-info-border)] bg-[var(--na-status-info-bg)]',
      ic: <Info className="h-4 w-4 text-[var(--na-status-info-text)]" aria-hidden="true" />,
    },
    warn: {
      box: 'border-[var(--na-status-warning-border)] bg-[var(--na-status-warning-bg)]',
      ic: (
        <AlertTriangle
          className="h-4 w-4 text-[var(--na-status-warning-text)]"
          aria-hidden="true"
        />
      ),
    },
    success: {
      box: 'border-[var(--na-status-success-border)] bg-[var(--na-status-success-bg)]',
      ic: (
        <CheckCircle2
          className="h-4 w-4 text-[var(--na-status-success-text)]"
          aria-hidden="true"
        />
      ),
    },
    danger: {
      box: 'border-[var(--na-status-error-border)] bg-[var(--na-status-error-bg)]',
      ic: (
        <AlertTriangle
          className="h-4 w-4 text-[var(--na-status-error-text)]"
          aria-hidden="true"
        />
      ),
    },
  };
  const m = map[tone];
  return (
    <div className={`rounded-[var(--na-radius-md)] border px-4 py-3 ${m.box}`}>
      <div className="flex gap-2.5">
        <div className="mt-0.5 shrink-0">{m.ic}</div>
        <div className="text-[13px] leading-relaxed text-[var(--na-ink-primary)]">
          {title && <span className="mr-1 font-semibold">{title}</span>}
          {children}
        </div>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      wasOpenRef.current = true;
      window.requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    } else if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--na-z-modal)] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--na-ink-primary)_35%,transparent)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative flex max-h-[86vh] w-full flex-col rounded-[var(--na-radius-lg)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] shadow-[var(--na-shadow-md)] outline-none ${
          wide ? 'max-w-3xl' : 'max-w-xl'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--na-border)] px-5 py-3.5">
          <h3
            id={titleId}
            className="font-display text-[16px] font-semibold text-[var(--na-ink-primary)]"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--na-radius-md)] text-[var(--na-ink-secondary)] transition-colors duration-150 hover:bg-[var(--na-well)] hover:text-[var(--na-ink-primary)] active:bg-[var(--na-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--na-border)] py-2 last:border-0">
      <span className="shrink-0 text-[13px] font-medium text-[var(--na-ink-secondary)]">{k}</span>
      <span className="tabular-nums text-right text-[13px] font-semibold text-[var(--na-ink-primary)]">
        {v}
      </span>
    </div>
  );
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN');
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const ENUM_LABELS: Record<string, string> = {
  HEAD_OF_DEPARTMENT: 'Head of Department (HOD)',
  DEAN: 'Dean of Academic Affairs',
  PRINCIPAL: 'College Principal',
  TRAINING_AND_PLACEMENT_OFFICER: 'Training & Placement Officer',
  REGISTRAR: 'University Registrar',
  OTHER_UNRECOGNIZED: 'Other institutional authority',
  CLAIMED_FINAL_YEAR: 'Claimed final year',
  VERIFIED_FINAL_YEAR: 'Verified final year',
  VERIFIED_NOT_FINAL_YEAR: 'Verified non-final year',
  UNVERIFIED: 'Unverified',
  UNKNOWN: 'Unspecified',
  ENROLLED_FULL_TIME: 'Enrolled full-time',
  ENROLLED_DISTANCE_PART_TIME: 'Distance / part-time',
  NOT_ENROLLED: 'Not currently enrolled',
  SUBMITTED: 'Submitted',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  PENDING_ADDITIONAL_INFO: 'Clarification requested',
};

export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return '—';
  if (ENUM_LABELS[value]) return ENUM_LABELS[value];
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
