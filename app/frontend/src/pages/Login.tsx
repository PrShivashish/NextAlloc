import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { errMsg } from '../api/client';
import { LogoMark } from '../components/Logo';

const ROLES = [
  { id: 'candidate', label: 'Candidate', email: 'candidate@nextalloc.in', pass: 'Candidate@123' },
  { id: 'provider', label: 'Provider', email: 'provider@nextalloc.in', pass: 'Provider@123' },
  { id: 'admin', label: 'Admin', email: 'admin@nextalloc.in', pass: 'Admin@123' },
] as const;

type RoleId = (typeof ROLES)[number]['id'];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState<RoleId>('candidate');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const selectRole = (id: RoleId) => {
    setRole(id);
    setErr('');
    const matchedDemo = ROLES.some(r => r.email === email && r.pass === pass);
    if (matchedDemo) {
      const next = ROLES.find(r => r.id === id);
      if (next) {
        setEmail(next.email);
        setPass(next.pass);
      }
    }
  };

  const applyDemo = (r: (typeof ROLES)[number]) => {
    setRole(r.id);
    setEmail(r.email);
    setPass(r.pass);
    setErr('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const me = await login(email, pass);
      nav(me.role === 'ADMIN' ? '/admin' : me.role === 'PROVIDER' ? '/provider' : '/candidate');
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--na-surface)] lg:flex-row">
      {/* Form panel: top on mobile, right half on desktop */}
      <main className="flex flex-1 items-center justify-center bg-[var(--na-surface)] px-6 py-10 sm:px-10 lg:order-2 lg:px-16">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand header — establishes brand recognition before sign-in */}
          <div className="mb-6 flex items-center justify-between border-b border-[var(--na-border)] pb-4 lg:hidden">
            <LogoMark height={34} />
            <span className="text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
              SIH25033
            </span>
          </div>

          {/* Desktop logo mark on light surface */}
          <div className="mb-6 hidden lg:block">
            <LogoMark height={36} />
          </div>

          <h1 className="font-display text-[length:var(--na-text-h1)] font-semibold leading-[var(--na-leading-tight)] tracking-tight text-[var(--na-ink-primary)]">
            Sign in
          </h1>
          <p className="mt-1 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
            Select your portal persona or enter your institutional credentials.
          </p>

          <div
            role="tablist"
            aria-label="Account role"
            className="mt-6 grid grid-cols-3 gap-1 rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-1"
          >
            {ROLES.map(r => {
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectRole(r.id)}
                  className={`min-h-[40px] rounded-[var(--na-radius-sm)] px-3 py-2 text-[length:var(--na-text-body-sm)] font-medium transition-[background-color,color] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-90 ${
                    active
                      ? 'bg-[var(--na-surface)] text-[var(--na-ink-primary)] shadow-[var(--na-shadow-sm)]'
                      : 'text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)]'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-primary)]"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={`${role}@nextalloc.in`}
                className="min-h-[44px] w-full rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3.5 py-2.5 text-[16px] text-[var(--na-ink-primary)] placeholder:text-[var(--na-ink-tertiary)] sm:text-[length:var(--na-text-body-md)]"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-primary)]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  className="min-h-[44px] w-full rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] py-2.5 pl-3.5 pr-11 text-[16px] text-[var(--na-ink-primary)] placeholder:text-[var(--na-ink-tertiary)] sm:text-[length:var(--na-text-body-md)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[var(--na-radius-md)] text-[var(--na-ink-secondary)] transition-colors duration-150 hover:text-[var(--na-ink-primary)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                >
                  {showPass ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {err && (
              <p role="alert" className="text-[13.5px] font-medium text-[var(--na-error-text)]">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-accent)] px-4 py-2.5 text-[length:var(--na-text-body-md)] font-semibold text-[var(--na-ink-primary)] transition-[background-color,opacity] duration-150 hover:bg-[var(--na-accent-hover)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span>{busy ? 'Signing in…' : 'Sign in'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          <div className="mt-6 border-t border-[var(--na-border)] pt-5">
            <button
              type="button"
              aria-expanded={demoOpen}
              onClick={() => setDemoOpen(o => !o)}
              className="flex w-full min-h-[44px] items-center justify-between text-left text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-secondary)] transition-colors duration-150 hover:text-[var(--na-ink-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            >
              <span>Try a demo account</span>
              <ChevronDown
                className={`h-4 w-4 motion-safe:transition-transform duration-150 motion-reduce:transition-none ${demoOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {demoOpen && (
              <div className="mt-2 divide-y divide-[var(--na-border)] rounded-[var(--na-radius-md)] bg-[var(--na-well)] px-3.5 py-1">
                {ROLES.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                        {r.label}
                      </div>
                      <div className="truncate font-[family-name:var(--na-font-mono)] text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                        {r.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyDemo(r)}
                      className="min-h-[36px] shrink-0 rounded-[var(--na-radius-sm)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3 py-1.5 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-stone)]"
                    >
                      Fill
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Brand panel: below form on mobile, left 44% on desktop */}
      <aside className="flex flex-col justify-between bg-[var(--na-anchor)] px-6 py-10 text-[var(--na-anchor-ink)] sm:px-10 lg:order-1 lg:w-[44%] lg:p-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-[19px] font-bold tracking-tight text-[var(--na-anchor-ink)]">
              NextAlloc
            </span>
            <span className="text-[length:var(--na-text-caption)] font-medium text-[var(--na-anchor-muted)]">
              / SIH25033
            </span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--na-anchor-2)] px-3 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-anchor-ink)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--na-signal)]" aria-hidden="true" />
            National Node
          </span>
        </div>

        <div className="my-10 max-w-md space-y-6 lg:my-0">
          <div className="space-y-3">
            <h2 className="font-display text-[length:var(--na-text-h1)] font-semibold leading-[var(--na-leading-tight)] tracking-tight text-[var(--na-anchor-ink)] lg:text-[length:var(--na-text-display)]">
              Where merit meets opportunity, fairly.
            </h2>
            <p className="text-[length:var(--na-text-body-md)] leading-[var(--na-leading-relaxed)] text-[var(--na-anchor-muted)]">
              A transparent national allocation platform for candidates, institutions, and partner organisations, eliminating placement bias and honouring real student preferences.
            </p>
          </div>

          <dl className="divide-y divide-[var(--na-anchor-2)] border-y border-[var(--na-anchor-2)] text-[length:var(--na-text-body-sm)]">
            <div className="grid grid-cols-[130px_1fr] gap-3 py-3.5">
              <dt className="font-medium text-[var(--na-anchor-ink)]">
                Verified standing
              </dt>
              <dd className="text-[var(--na-anchor-muted)]">
                Institutional enrollment and college clearance are checked before matching begins.
              </dd>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-3 py-3.5">
              <dt className="font-medium text-[var(--na-anchor-ink)]">
                Impartial matching
              </dt>
              <dd className="text-[var(--na-anchor-muted)]">
                Global constraint solver matches candidates by verified skills and quotas without arbitrary cutoffs.
              </dd>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-3 py-3.5">
              <dt className="font-medium text-[var(--na-anchor-ink)]">
                Transparent results
              </dt>
              <dd className="text-[var(--na-anchor-muted)]">
                Every allocation provides explicit match reasons, auditable logs, and reproducible outcomes.
              </dd>
            </div>
          </dl>
        </div>

        <div className="text-[length:var(--na-text-caption)] text-[var(--na-anchor-muted)]">
          Smart India Hackathon 2026 · Ministry of Education &amp; AICTE Initiative
        </div>
      </aside>
    </div>
  );
}
