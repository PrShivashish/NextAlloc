import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import {
  ArrowLeft,
  Download,
  XCircle,
  Trophy,
  GitCompareArrows,
  Scale,
  Map as MapIcon,
  Route,
  Fingerprint,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Award,
  RefreshCw,
} from 'lucide-react';
import { apiGet, apiPost, apiDownload, ApiError, errMsg } from '../../api/client';
import {
  RunDetail as RD,
  Comparison,
  WhyDto,
  Fairness,
  GeoRow,
  Movement,
  ConflictRow,
  ProviderOffer,
} from '../../api/types';
import {
  SectionHeader,
  Spinner,
  Callout,
  Badge,
  MetricBand,
  Disclosure,
  statusTone,
  KV,
  Modal,
  fmtNum,
  fmtPct,
  fmtMs,
  fmtTime,
} from '../../components/ui';
import { HBar, FactorBars } from '../../components/charts';

const TABS = [
  { id: 'compare', label: 'Strategy comparison', icon: GitCompareArrows },
  { id: 'why', label: 'Why this allocation', icon: HelpCircle },
  { id: 'fairness', label: 'Fairness', icon: Scale },
  { id: 'geo', label: 'Geography', icon: MapIcon },
  { id: 'moves', label: 'Movements & conflicts', icon: Route },
  { id: 'offers', label: 'Offers & lifecycle', icon: Award },
  { id: 'prov', label: 'Provenance', icon: Fingerprint },
];

function runReportUrl(id: number) {
  return `/api/admin/runs/${id}/report`;
}

function readToken(name: string, fallbackVar: string): string {
  if (typeof window === 'undefined') return fallbackVar;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallbackVar;
}

export default function AdminRunDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [d, setD] = useState<RD | null>(null);
  const [cmp, setCmp] = useState<Comparison | null>(null);
  const [whyList, setWhyList] = useState<any[]>([]);
  const [whySel, setWhySel] = useState<any>(null);
  const [fair, setFair] = useState<Fairness | null>(null);
  const [geo, setGeo] = useState<GeoRow[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [tab, setTab] = useState(() => sp.get('tab') ?? 'compare');
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [generatingOffers, setGeneratingOffers] = useState(false);
  const [offersMsg, setOffersMsg] = useState('');
  const [offersErr, setOffersErr] = useState('');
  const [err, setErr] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [geoErr, setGeoErr] = useState('');
  const mapRef = useRef<any>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const geoJsonRef = useRef<any>(null);
  const loadedRef = useRef(false);

  const runId = Number(id);
  const active =
    d &&
    (d.run.status === 'Queued' ||
      d.run.status === 'Running' ||
      d.run.status.toLowerCase().includes('progress'));
  const activeRef = useRef(false);
  activeRef.current = !!active;

  const load = async (silent = false) => {
    try {
      const rd = await apiGet<RD>(`/admin/runs/${runId}`);
      setD(rd);
      if (String(rd.run.status ?? '').toLowerCase() === 'completed' && !loadedRef.current) {
        loadedRef.current = true;
        try {
          setCmp(await apiGet<Comparison>(`/admin/runs/${runId}/comparison`));
        } catch {}
        try {
          setFair(await apiGet<Fairness>(`/admin/runs/${runId}/fairness`));
        } catch {}
        try {
          const g = await apiGet<any>(`/admin/runs/${runId}/geography`);
          setGeo(g.states ?? []);
        } catch {}
        try {
          const m = await apiGet<any>(`/admin/runs/${runId}/movements`, { limit: 100 });
          setMoves(m.content ?? m);
        } catch {}
        try {
          setConflicts((await apiGet<any>(`/admin/runs/${runId}/conflicts`)) ?? []);
        } catch {}
        try {
          const w = await apiGet<any>(`/admin/runs/${runId}/why/assigned`, { limit: 100 });
          const arr = Array.isArray(w) ? w : w.content ?? [];
          if (arr.length > 0) setWhyList(arr);
        } catch {
          try {
            const m = await apiGet<any>(`/admin/runs/${runId}/movements`, { limit: 40 });
            setWhyList((m.content ?? m) as Movement[]);
          } catch {}
        }
      }
    } catch (e) {
      if (silent) return;
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true);
        setErr('');
        return;
      }
      setErr(errMsg(e));
    }
  };

  useEffect(() => {
    loadedRef.current = false;
    setD(null);
    setCmp(null);
    setFair(null);
    setGeo([]);
    setWhyList([]);
    setMoves([]);
    setConflicts([]);
    setWhySel(null);
    setNotFound(false);
    setErr('');
    void load();
    const t = setInterval(() => {
      if (activeRef.current) void load(true);
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const openWhy = async (candidateId: number) => {
    try {
      const w = await apiGet<WhyDto>(`/admin/runs/${runId}/why/${candidateId}`);
      setWhySel(w);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  // Leaflet map using design tokens resolved from CSS variables
  useEffect(() => {
    if (tab !== 'geo' || !mapDivRef.current || geo.length === 0 || geoErr) return;
    let cancelled = false;
    (async () => {
      try {
        if (!geoJsonRef.current) {
          const r = await fetch('/india-states.json');
          geoJsonRef.current = await r.json();
        }
        if (cancelled || !mapDivRef.current) return;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        const map = L.map(mapDivRef.current, {
          zoomControl: true,
          attributionControl: false,
          minZoom: 4,
          maxZoom: 7,
        }).setView([23.5, 79], 4);
        mapRef.current = map;

        const errFill = readToken('--na-status-error-text', 'crimson');
        const accentHover = readToken('--na-accent-hover', 'darkorange');
        const accentFill = readToken('--na-accent', 'orange');
        const okFill = readToken('--na-status-success-text', 'seagreen');
        const emptyFill = readToken('--na-well', 'gainsboro');
        const strokeColor = readToken('--na-surface', 'white');

        const color = (v: number) =>
          v >= 3 ? errFill : v >= 2 ? accentHover : v >= 1.2 ? accentFill : okFill;
        const norm: Record<string, string> = {
          Orissa: 'Odisha',
          Uttaranchal: 'Uttarakhand',
          'Andaman and Nicobar': 'Andaman and Nicobar Islands',
          Pondicherry: 'Puducherry',
        };
        L.geoJSON(geoJsonRef.current, {
          style: (f: any) => {
            const name = norm[f.properties?.NAME_1] ?? f.properties?.NAME_1;
            const row = geo.find((g) => g.state === name);
            return {
              fillColor: row ? color(row.pressure) : emptyFill,
              fillOpacity: 0.78,
              color: strokeColor,
              weight: 1,
            };
          },
          onEachFeature: (f: any, layer: any) => {
            const name = norm[f.properties?.NAME_1] ?? f.properties?.NAME_1;
            const row = geo.find((g) => g.state === name);
            layer.bindTooltip(
              `<div style="font-size:12px"><b>${name}</b><br/>Demand ${
                row?.demand ?? '—'
              } | Capacity ${row?.capacity ?? '—'}<br/>Allocated ${
                row?.allocated ?? '—'
              } | Pressure ${row?.pressure ?? '—'}</div>`
            );
          },
        }).addTo(map);
      } catch {
        setGeoErr('The map could not be loaded in this browser.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, geo, geoErr]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    },
    []
  );

  const fetchOffers = async () => {
    if (!runId) return;
    setOffersLoading(true);
    setOffersErr('');
    try {
      const data = await apiGet<ProviderOffer[]>(`/admin/runs/${runId}/offers`);
      setOffers(data ?? []);
    } catch (e) {
      setOffersErr(errMsg(e));
    } finally {
      setOffersLoading(false);
    }
  };

  const handleGenerateOffers = async () => {
    if (!runId) return;
    setGeneratingOffers(true);
    setOffersErr('');
    setOffersMsg('');
    try {
      const res = await apiPost<any>(`/admin/runs/${runId}/generate-offers`, {});
      setOffersMsg(`Generated ${res.offersGenerated ?? 0} offers for this run.`);
      await fetchOffers();
    } catch (e) {
      setOffersErr(errMsg(e));
    } finally {
      setGeneratingOffers(false);
    }
  };

  useEffect(() => {
    if (tab === 'offers') {
      void fetchOffers();
    }
  }, [tab, runId]);

  if (notFound) {
    return (
      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-10 text-center">
        <AlertTriangle
          className="mx-auto h-8 w-8 text-[var(--na-accent-ink)]"
          aria-hidden="true"
        />
        <div className="font-display mt-3 text-[18px] font-semibold text-[var(--na-ink-primary)]">
          This run does not exist
        </div>
        <p className="mt-1 text-[14px] text-[var(--na-ink-secondary)]">
          Allocation run #{id} was not found. It may belong to an earlier dataset that has been
          replaced.
        </p>
        <div className="mt-5">
          <button
            type="button"
            className="btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            onClick={() => nav('/admin/runs')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to all runs
          </button>
        </div>
      </div>
    );
  }

  if (!d) {
    return (
      <div className="space-y-4">
        {err ? <Callout tone="danger">{err}</Callout> : <Spinner label="Loading run…" />}
      </div>
    );
  }

  const r = d.run;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--na-border)] pb-5">
        <div className="space-y-2">
          <button
            type="button"
            className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            onClick={() => nav('/admin/runs')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All runs
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display tabular-nums text-[28px] font-semibold tracking-tight text-[var(--na-ink-primary)]">
              Allocation run #{r.number}
            </h1>
            <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            {r.solverStatus && <Badge tone={statusTone(r.solverStatus)}>{r.solverStatus}</Badge>}
            {r.stale && <Badge tone="gray">superseded dataset</Badge>}
            {r.reallocation && (
              <Badge tone="saffron">reallocation from #{r.parentRunNumber}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-[var(--na-ink-secondary)]">
            <span>{r.scenario}</span>
            <span>{r.policyName}</span>
            <span className="tabular-nums">Started {fmtTime(r.createdAt)}</span>
            <span className="tabular-nums">{fmtMs(r.totalRuntimeMs)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {active && (
            <button
              type="button"
              className="btn-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                try {
                  await apiPost(`/admin/runs/${runId}/cancel`);
                  await load();
                } catch (e) {
                  setErr(errMsg(e));
                }
                setCancelling(false);
              }}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              {cancelling ? 'Cancelling…' : 'Cancel run'}
            </button>
          )}
          {r.status === 'Completed' && (
            <button
              type="button"
              className="btn-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
              disabled={pdfBusy}
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await apiDownload(runReportUrl(runId), `NextAlloc-Report-Run${r.number}.pdf`);
                } catch (e) {
                  setErr(errMsg(e));
                }
                setPdfBusy(false);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {pdfBusy ? 'Preparing…' : 'Download report (PDF)'}
            </button>
          )}
        </div>
      </div>

      {err && <Callout tone="warn">{err}</Callout>}

      {d.infeasibleMessage && (
        <Callout tone="danger" title="This configuration could not be satisfied.">
          {d.infeasibleMessage}
        </Callout>
      )}

      {d.dataset && (
        <MetricBand
          items={[
            {
              label: 'Candidates',
              value: fmtNum(d.dataset.candidateCount),
              sub: `${d.dataset.name} (v${d.dataset.version})`,
            },
            {
              label: 'Opportunities',
              value: fmtNum(d.dataset.opportunityCount),
              sub: 'Active seats included in solve',
            },
            {
              label: 'Total seats',
              value: fmtNum(d.dataset.seatCount),
              sub: cmp ? `${fmtNum(cmp.globalAllocated)} allocated` : 'Synthetic cohort dataset',
              accent: true,
            },
            {
              label: 'Total runtime',
              value: fmtMs(r.totalRuntimeMs),
              sub: r.solverStatus ?? r.status,
            },
          ]}
        />
      )}

      {d.stages.length > 0 && (
        <section className="rounded-[var(--na-radius-lg)] bg-[var(--na-stone)] p-5">
          <SectionHeader
            title="Execution stages"
            sub="Measured stage durations from the allocation engine"
          />
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {d.stages.map((s, i) => (
              <div
                key={s.stage}
                className="rounded-[var(--na-radius-md)] bg-[var(--na-surface)] p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="tabular-nums inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--na-anchor)] text-[11px] font-semibold text-[var(--na-anchor-ink)]">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-medium leading-tight text-[var(--na-ink-primary)]">
                    {s.stage}
                  </span>
                </div>
                <div className="tabular-nums mt-2 text-[12px] text-[var(--na-ink-secondary)]">
                  {fmtMs(s.ms)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div
        role="tablist"
        aria-label="Run analysis tabs"
        className="flex flex-wrap gap-1.5 border-b border-[var(--na-border)] pb-3"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex min-h-[38px] items-center gap-2 rounded-[var(--na-radius-md)] border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50 ${
              tab === t.id
                ? 'border-[var(--na-ink-primary)] bg-[var(--na-ink-primary)] text-[var(--na-ink-inverse)]'
                : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-well)]'
            }`}
          >
            <t.icon className="h-4 w-4" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'compare' && <CompareTab cmp={cmp} whyList={whyList} onWhy={openWhy} />}
      {tab === 'why' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5 lg:col-span-2">
            <SectionHeader
              title="Allocated candidates"
              sub="Select an assignment to inspect its factor breakdown"
            />
            <WhyPicker whyList={whyList} total={cmp?.globalAllocated ?? 0} onWhy={openWhy} />
          </div>
          <div className="rounded-[var(--na-radius-lg)] bg-[var(--na-stone)] p-5">
            <SectionHeader title="How explanations work" />
            <div className="space-y-3 text-[14px] leading-relaxed text-[var(--na-ink-secondary)]">
              <p>
                Every assignment is explained factor by factor across skills, qualification,
                interest, location, preference, learning potential, and experience, each with its
                weight and contribution to the suitability score.
              </p>
              <p>
                Narratives are built directly from the stored suitability breakdown of that
                assignment.
              </p>
            </div>
          </div>
        </div>
      )}
      {tab === 'fairness' && <FairnessTab fair={fair} />}
      {tab === 'geo' && (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-4 lg:col-span-3">
            <SectionHeader
              title="Allocation pressure by state"
              sub="Higher pressure indicates stronger demand relative to local seats"
            />
            {geo.length === 0 ? (
              <Spinner label="Loading geography…" />
            ) : geoErr ? (
              <Callout tone="warn">{geoErr}</Callout>
            ) : (
              <div ref={mapDivRef} className="h-[420px] w-full" />
            )}
          </div>
          <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5 lg:col-span-2">
            <SectionHeader title="State pressure table" />
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">State</th>
                    <th className="th text-right">Demand</th>
                    <th className="th text-right">Capacity</th>
                    <th className="th text-right">Allocated</th>
                    <th className="th text-right">Pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {geo.map((g) => (
                    <tr key={g.state} className="tr-hover">
                      <td className="td font-medium">{g.state}</td>
                      <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                        {fmtNum(g.demand)}
                      </td>
                      <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                        {fmtNum(g.capacity)}
                      </td>
                      <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                        {fmtNum(g.allocated)}
                      </td>
                      <td className="td text-right">
                        <Badge
                          tone={g.pressure >= 2 ? 'red' : g.pressure >= 1.2 ? 'amber' : 'green'}
                        >
                          <span className="tabular-nums">{g.pressure.toFixed(1)}×</span>
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {tab === 'moves' && <MovesTab moves={moves} conflicts={conflicts} />}
      {tab === 'offers' && (
        <OffersTab
          offers={offers}
          loading={offersLoading}
          onRefresh={fetchOffers}
          onGenerate={handleGenerateOffers}
          generating={generatingOffers}
          msg={offersMsg}
          err={offersErr}
        />
      )}
      {tab === 'prov' && d.provenance && <ProvTab p={d.provenance} />}

      <Modal
        open={!!whySel}
        onClose={() => setWhySel(null)}
        title={whySel ? `Assignment breakdown: ${whySel.candidateName}` : ''}
        wide
      >
        {whySel && (
          <div className="space-y-4">
            {whySel.opportunityTitle && (
              <div className="text-[14px] font-medium text-[var(--na-ink-primary)]">
                Assigned opportunity: {whySel.opportunityTitle}
              </div>
            )}
            {whySel.narrative && (
              <Callout tone="info" title="Summary">
                {whySel.narrative}
              </Callout>
            )}
            <div className="flex flex-wrap gap-2">
              {whySel.sector && <Badge tone="navy">{whySel.sector}</Badge>}
              {whySel.state && <Badge tone="gray">{whySel.state}</Badge>}
              {typeof whySel.suitability === 'number' && (
                <Badge tone="saffron">
                  <span className="tabular-nums">Suitability {whySel.suitability.toFixed(1)}</span>
                </Badge>
              )}
              {whySel.preferenceRank && (
                <Badge tone="green">
                  <span className="tabular-nums">Rank #{whySel.preferenceRank} preference</span>
                </Badge>
              )}
            </div>
            {Array.isArray(whySel.factors) && whySel.factors.length > 0 ? (
              <FactorBars factors={whySel.factors} />
            ) : (
              <div className="text-[13px] text-[var(--na-ink-secondary)]">
                {whySel.reason || 'This assignment was unaffected by the operational change.'}
              </div>
            )}
            {Array.isArray(whySel.factors) && whySel.factors.length > 0 && (
              <div className="rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3.5 text-[13px] text-[var(--na-ink-secondary)]">
                Eligible for{' '}
                <span className="tabular-nums font-medium text-[var(--na-ink-primary)]">
                  {fmtNum(whySel.eligibleCount)}
                </span>{' '}
                opportunities; this assignment achieved the highest global suitability.
                {whySel.seatCount > 0 && (
                  <>
                    {' '}
                    <span className="tabular-nums">{fmtNum(whySel.seatCount)}</span> seats were
                    available.
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CompareTab({
  cmp,
  whyList,
  onWhy,
}: {
  cmp: Comparison | null;
  whyList: any[];
  onWhy: (c: number) => void;
}) {
  if (!cmp) {
    return (
      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-4">
        <Spinner label="Computing the comparison…" />
      </div>
    );
  }
  const rows = whyList.filter((w) => w.factors).slice(0, 8);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-status-success-border)] bg-[var(--na-surface)] p-5">
          <div className="mb-3 flex items-center gap-2 text-[var(--na-status-success-text)]">
            <Trophy className="h-5 w-5" aria-hidden="true" />
            <span className="font-display text-[16px] font-semibold">
              NextAlloc global allocation
            </span>
          </div>
          <MetricRow k="Candidates allocated" v={fmtNum(cmp.globalAllocated)} />
          <MetricRow k="Average suitability" v={fmtPct(cmp.globalSuitability)} />
          <MetricRow k="Preference satisfaction" v={fmtPct(cmp.globalPreferenceSatisfaction)} />
          <MetricRow k="Objective value" v={fmtNum(cmp.globalObjective)} />
        </div>

        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
          <div className="mb-3 flex items-center gap-2 text-[var(--na-ink-primary)]">
            <GitCompareArrows className="h-5 w-5" aria-hidden="true" />
            <span className="font-display text-[16px] font-semibold">
              Sequential baseline (candidate-by-candidate)
            </span>
          </div>
          <MetricRow k="Candidates allocated" v={fmtNum(cmp.baselineAllocated)} />
          <MetricRow k="Average suitability" v={fmtPct(cmp.baselineSuitability)} />
          <MetricRow k="Preference satisfaction" v={fmtPct(cmp.baselinePreferenceSatisfaction)} />
          <MetricRow k="Objective value" v={fmtNum(cmp.baselineObjective)} />
        </div>
      </div>

      <Callout
        tone={cmp.globalSuitability > cmp.baselineSuitability ? 'success' : 'info'}
        title="Reading this comparison"
      >
        {cmp.summary} Both strategies run on the identical dataset, eligibility set, and suitability
        scores.
      </Callout>

      {rows.length > 0 && (
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
          <SectionHeader
            title="Sample explanations"
            sub="Select a candidate for the full factor-level breakdown"
          />
          <div className="grid gap-2.5 md:grid-cols-2">
            {rows.map((w: any) => (
              <button
                key={w.candidateId}
                type="button"
                onClick={() => onWhy(w.candidateId)}
                className="flex items-center justify-between rounded-[var(--na-radius-md)] border border-[var(--na-border)] bg-[var(--na-surface)] p-3 text-left transition-colors duration-150 hover:border-[var(--na-border-strong)] hover:bg-[var(--na-well)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:opacity-50"
              >
                <div className="min-w-0 pr-3">
                  <div className="truncate text-[14px] font-semibold text-[var(--na-ink-primary)]">
                    {w.candidateName}
                  </div>
                  <div className="truncate text-[12px] text-[var(--na-ink-secondary)]">
                    {w.opportunityTitle} ({w.sector})
                  </div>
                </div>
                <Badge tone="saffron">
                  <span className="tabular-nums">{w.suitability.toFixed(1)}</span>
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--na-border)] py-2.5 last:border-0">
      <span className="text-[13px] text-[var(--na-ink-secondary)]">{k}</span>
      <span className="font-display tabular-nums text-[16px] font-bold text-[var(--na-ink-primary)]">
        {v}
      </span>
    </div>
  );
}

function WhyPicker({
  whyList,
  total,
  onWhy,
}: {
  whyList: any[];
  total: number;
  onWhy: (c: number) => void;
}) {
  const rows = whyList.slice(0, 100);
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--na-ink-secondary)]">
        Assignments will appear here once the run completes.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px]">
        <thead>
          <tr>
            <th className="th">Candidate</th>
            <th className="th">Opportunity</th>
            <th className="th text-right">Suitability</th>
            <th className="th text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w: any) => (
            <tr key={w.candidateId} className="tr-hover">
              <td className="td font-medium">{w.candidateName}</td>
              <td className="td text-[var(--na-ink-secondary)]">
                {w.opportunityTitle || w.after || '—'}
              </td>
              <td className="td text-right">
                <Badge tone="saffron">
                  <span className="tabular-nums">
                    {w.suitability != null
                      ? w.suitability.toFixed(1)
                      : w.afterScore != null
                        ? w.afterScore.toFixed(1)
                        : '—'}
                  </span>
                </Badge>
              </td>
              <td className="td text-right">
                <button
                  type="button"
                  className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                  onClick={() => onWhy(w.candidateId)}
                >
                  Explain
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > rows.length && (
        <p className="mt-3 tabular-nums text-[12px] text-[var(--na-ink-secondary)]">
          Showing the first {fmtNum(rows.length)} of {fmtNum(total)} assignments.
        </p>
      )}
    </div>
  );
}

function FairnessTab({ fair }: { fair: Fairness | null }) {
  if (!fair) {
    return (
      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-4">
        <Spinner label="Computing fairness metrics…" />
      </div>
    );
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
        <SectionHeader title="By location type" sub="Rural, urban, and semi-urban outcomes" />
        <HBar
          data={fair.ruralUrban.map((g) => ({ name: g.groupValue, value: g.rate }))}
          dataKey="value"
          suffix="%"
          height={200}
          color="var(--na-status-success-text)"
        />
        <table className="mt-3 w-full">
          <thead>
            <tr>
              <th className="th">Group</th>
              <th className="th text-right">Population</th>
              <th className="th text-right">Allocated</th>
              <th className="th text-right">Rate</th>
              <th className="th text-right">Avg suitability</th>
            </tr>
          </thead>
          <tbody>
            {fair.ruralUrban.map((g) => (
              <tr key={g.groupValue} className="tr-hover">
                <td className="td font-medium">{g.groupValue}</td>
                <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                  {fmtNum(g.population)}
                </td>
                <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                  {fmtNum(g.allocated)}
                </td>
                <td className="td tabular-nums text-right">{fmtPct(g.rate)}</td>
                <td className="td tabular-nums text-right">{fmtPct(g.avgSuitability)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
        <SectionHeader title="By state" sub="Top states by candidate population" />
        <HBar
          data={fair.states.slice(0, 8).map((g) => ({ name: g.groupValue, value: g.rate }))}
          dataKey="value"
          suffix="%"
          height={220}
          color="var(--na-accent)"
        />
        <table className="mt-3 w-full">
          <thead>
            <tr>
              <th className="th">State</th>
              <th className="th text-right">Population</th>
              <th className="th text-right">Allocated</th>
              <th className="th text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {fair.states.slice(0, 6).map((g) => (
              <tr key={g.groupValue} className="tr-hover">
                <td className="td font-medium">{g.groupValue}</td>
                <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                  {fmtNum(g.population)}
                </td>
                <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                  {fmtNum(g.allocated)}
                </td>
                <td className="td tabular-nums text-right">{fmtPct(g.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovesTab({
  moves,
  conflicts,
}: {
  moves: Movement[];
  conflicts: ConflictRow[];
}) {
  const changed = moves.filter((m) => m.status !== 'UNCHANGED');
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
        <SectionHeader
          title="Movements"
          sub={`${fmtNum(changed.length)} of ${fmtNum(moves.length)} assignments differ versus the sequential baseline`}
        />
        {changed.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--na-ink-secondary)]">
            No movements recorded.
          </div>
        ) : (
          <div className="max-h-[430px] overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Candidate</th>
                  <th className="th">Change</th>
                  <th className="th text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {changed.map((m) => (
                  <tr key={m.candidateId} className="tr-hover">
                    <td className="td font-medium">{m.candidateName}</td>
                    <td className="td text-[13px] text-[var(--na-ink-secondary)]">
                      <Badge
                        tone={
                          m.status === 'ADDED'
                            ? 'green'
                            : m.status === 'REMOVED'
                              ? 'red'
                              : 'amber'
                        }
                      >
                        {m.status}
                      </Badge>
                      <div className="mt-1">
                        {m.before ?? '—'} to {m.after ?? '—'}
                      </div>
                    </td>
                    <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                      {m.beforeScore != null ? m.beforeScore.toFixed(1) : '—'} /{' '}
                      {m.afterScore != null ? m.afterScore.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
        <SectionHeader
          title="Most contested opportunities"
          sub="Ordered by demand pressure"
        />
        {conflicts.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--na-ink-secondary)]">
            No conflict data.
          </div>
        ) : (
          <div className="max-h-[430px] overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Opportunity</th>
                  <th className="th text-right">Seats</th>
                  <th className="th text-right">Filled</th>
                  <th className="th text-right">Eligible</th>
                  <th className="th text-right">Pressure</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c) => (
                  <tr key={c.opportunityId} className="tr-hover">
                    <td className="td font-medium">{c.title}</td>
                    <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                      {fmtNum(c.seats)}
                    </td>
                    <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                      {fmtNum(c.allocated)}
                    </td>
                    <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                      {fmtNum(c.eligible)}
                    </td>
                    <td className="td text-right">
                      <Badge
                        tone={c.pressure >= 2 ? 'red' : c.pressure >= 1 ? 'amber' : 'green'}
                      >
                        <span className="tabular-nums">{c.pressure.toFixed(1)}×</span>
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProvTab({ p }: { p: NonNullable<RD['provenance']> }) {
  return (
    <div className="space-y-4 rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
      <SectionHeader
        title="Run provenance"
        sub="Configuration and execution summary for reproducing this run"
      />
      <div className="grid gap-x-10 md:grid-cols-2">
        <div>
          <KV k="Run identifier" v={`Run #${p.runNumber} (${p.runId})`} />
          <KV k="Scenario" v={p.scenario} />
          <KV k="Dataset version" v={`v${p.datasetVersion}`} />
          <KV
            k="Cohort size"
            v={`${fmtNum(p.candidates)} candidates, ${fmtNum(p.opportunities)} opportunities, ${fmtNum(p.seats)} seats`}
          />
        </div>
        <div>
          <KV k="Policy" v={`${p.policyName} (${p.policyKey}, ${p.policyVersion})`} />
          <KV k="Optimizer" v={p.optimizer} />
          <KV k="Solver outcome" v={p.solverStatus ?? '—'} />
          <KV k="Solver / total time" v={`${fmtMs(p.solverRuntimeMs)} / ${fmtMs(p.totalRuntimeMs)}`} />
        </div>
      </div>

      <Disclosure label="Technical provenance, seed & fingerprint details">
        <div className="grid gap-x-10 md:grid-cols-2">
          <div>
            <KV
              k="Dataset fingerprint"
              v={<span className="na-mono">{p.datasetFingerprint}</span>}
            />
            <KV k="Seeder seed" v={<span className="na-mono">{p.seed}</span>} />
            <KV k="Solver seed / workers" v={`${p.solverSeed} / ${p.workers}`} />
          </div>
          <div>
            <KV
              k="Weights"
              v={Object.entries(p.weights)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')}
            />
            <KV
              k="Objective / variables / constraints"
              v={`${fmtNum(p.objective)} / ${fmtNum(p.variables)} / ${fmtNum(p.constraints)}`}
            />
          </div>
        </div>
      </Disclosure>

      <div className="flex items-start gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3.5 text-[13px] text-[var(--na-ink-secondary)]">
        <CheckCircle2
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--na-status-success-text)]"
          aria-hidden="true"
        />
        <span>
          Re-running with the same dataset version, seed, and policy produces the identical
          allocation.
        </span>
      </div>
    </div>
  );
}

function OffersTab({
  offers,
  loading,
  onRefresh,
  onGenerate,
  generating,
  msg,
  err,
}: {
  offers: ProviderOffer[];
  loading: boolean;
  onRefresh: () => void;
  onGenerate: () => void;
  generating: boolean;
  msg: string;
  err: string;
}) {
  const [filter, setFilter] = useState('ALL');
  const counts = {
    total: offers.length,
    offered: offers.filter((o) => o.status === 'OFFERED').length,
    accepted: offers.filter((o) => o.status === 'ACCEPTED').length,
    joined: offers.filter((o) => o.status === 'JOINED').length,
    declined: offers.filter((o) => o.status === 'DECLINED').length,
    expired: offers.filter((o) => o.status === 'EXPIRED').length,
  };

  const filtered = filter === 'ALL' ? offers : offers.filter((o) => o.status === filter);

  return (
    <div className="space-y-5 rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--na-border)] pb-4">
        <SectionHeader
          title="Offer lifecycle & placement"
          sub="Allocation offer records and candidate response tracking"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh offers"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <button
            type="button"
            className="btn-primary btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            onClick={onGenerate}
            disabled={generating}
            title="Generate durable offers from run assignments"
          >
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            {generating ? 'Generating…' : 'Generate run offers'}
          </button>
        </div>
      </div>

      {err && <Callout tone="danger">{err}</Callout>}
      {msg && <Callout tone="success">{msg}</Callout>}

      <MetricBand
        items={[
          { label: 'Total offers', value: fmtNum(counts.total) },
          { label: 'Offered', value: fmtNum(counts.offered) },
          { label: 'Accepted', value: fmtNum(counts.accepted), accent: counts.accepted > 0 },
          {
            label: 'Joined',
            value: fmtNum(counts.joined),
            sub: `${fmtNum(counts.declined)} declined, ${fmtNum(counts.expired)} expired`,
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {['ALL', 'OFFERED', 'ACCEPTED', 'JOINED', 'DECLINED'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`min-h-[34px] rounded-[var(--na-radius-md)] border px-3 py-1 text-[12px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50 ${
                filter === status
                  ? 'border-[var(--na-ink-primary)] bg-[var(--na-ink-primary)] text-[var(--na-ink-inverse)]'
                  : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-well)]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="tabular-nums text-[12px] text-[var(--na-ink-secondary)]">
          Showing {fmtNum(filtered.length)} of {fmtNum(offers.length)} offers
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <Spinner label="Loading run offers…" />
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--na-ink-secondary)]">
            No offers matching the selected filter. Select &ldquo;Generate run offers&rdquo; to
            create offers for this completed run.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Offer ID</th>
                <th className="th">Candidate</th>
                <th className="th">Qualification</th>
                <th className="th">Status</th>
                <th className="th">Offered</th>
                <th className="th">Responded / joined</th>
                <th className="th">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="tr-hover">
                  <td className="td na-mono text-[var(--na-ink-secondary)]">#{o.id}</td>
                  <td className="td font-medium">
                    {o.candidateName || `Candidate #${o.candidateId}`}
                  </td>
                  <td className="td text-[13px] text-[var(--na-ink-secondary)]">
                    {o.qualification || '—'}
                  </td>
                  <td className="td">
                    <Badge
                      tone={
                        o.status === 'JOINED' || o.status === 'ACCEPTED'
                          ? 'green'
                          : o.status === 'OFFERED'
                            ? 'amber'
                            : o.status === 'DECLINED'
                              ? 'red'
                              : 'gray'
                      }
                    >
                      {o.status}
                    </Badge>
                  </td>
                  <td className="td tabular-nums text-[13px] text-[var(--na-ink-secondary)]">
                    {fmtTime(o.offeredAt)}
                  </td>
                  <td className="td tabular-nums text-[13px] text-[var(--na-ink-secondary)]">
                    {o.joinedAt ? (
                      <span className="font-medium text-[var(--na-status-success-text)]">
                        Joined {fmtTime(o.joinedAt)}
                      </span>
                    ) : o.respondedAt ? (
                      <span>Responded {fmtTime(o.respondedAt)}</span>
                    ) : (
                      <span>Pending response</span>
                    )}
                  </td>
                  <td className="td text-[13px] text-[var(--na-ink-secondary)]">
                    {o.declineReason ? (
                      <span
                        className="text-[var(--na-status-error-text)]"
                        title={o.declineReason}
                      >
                        Reason: {o.declineReason}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
