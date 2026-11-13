import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Briefcase, Check, CheckCircle2, ArrowRight } from 'lucide-react';
import { apiGet, apiPost, errMsg } from '../../api/client';
import { ProviderOffer } from '../../api/types';
import {
  SectionHeader,
  Spinner,
  Callout,
  Badge,
  MetricBand,
  fmtNum,
  fmtPct,
  fmtTime,
} from '../../components/ui';
import { HBar } from '../../components/charts';

interface OfferWithOpp extends ProviderOffer {
  opportunityTitle: string;
}

export default function ProviderHome() {
  const nav = useNavigate();
  const [org, setOrg] = useState<any>(null);
  const [impact, setImpact] = useState<any[]>([]);
  const [cap, setCap] = useState<any[]>([]);
  const [offers, setOffers] = useState<OfferWithOpp[]>([]);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [err, setErr] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [o, i, c, oppsPage] = await Promise.all([
        apiGet<any>('/providers/me'),
        apiGet<any>('/providers/me/impact'),
        apiGet<any>('/providers/me/capacity'),
        apiGet<any>('/providers/me/opportunities', { page: 0, size: 50 }).catch(() => ({
          content: [],
        })),
      ]);
      setOrg(o);
      setImpact(i ?? []);
      setCap(c ?? []);

      const oppRows: any[] = oppsPage?.content ?? [];
      const allocatedOpps = oppRows.filter((row) => (row.allocatedCount ?? 0) > 0);
      if (allocatedOpps.length > 0) {
        const offerLists = await Promise.all(
          allocatedOpps.map(async (opp) => {
            try {
              const list = await apiGet<ProviderOffer[]>(
                `/providers/me/opportunities/${opp.id}/offers`
              );
              return (list ?? []).map((item) => ({
                ...item,
                opportunityTitle: opp.title as string,
              }));
            } catch {
              return [];
            }
          })
        );
        setOffers(offerLists.flat());
      } else {
        setOffers([]);
      }
    } catch (e) {
      setErr(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleConfirmJoining = async (offerId: number) => {
    setJoiningId(offerId);
    setActionErr('');
    setActionMsg('');
    try {
      const updated = await apiPost<ProviderOffer>(`/providers/me/offers/${offerId}/join`, {});
      setOffers((prev) =>
        prev.map((item) =>
          item.id === offerId ? { ...item, ...updated } : item
        )
      );
      setActionMsg('Candidate joining confirmed.');
    } catch (e) {
      setActionErr(errMsg(e));
    } finally {
      setJoiningId(null);
    }
  };

  if (!org && !err) return <Spinner label="Loading your organisation…" />;
  if (err && !org) return <Callout tone="danger">{err}</Callout>;

  const filled = impact.reduce((a, b) => a + b.allocated, 0);
  const unmet = impact.reduce((a, b) => a + b.unmetDemand, 0);
  const avgFit =
    impact.length > 0
      ? impact.reduce((a, b) => a + b.avgSuitability * b.allocated, 0) / Math.max(1, filled)
      : 0;
  const offersCount = offers.length > 0 ? offers.length : filled;
  const joinedCount = offers.filter((o) => o.status === 'JOINED').length;
  const pendingJoinOffers = offers.filter(
    (o) => o.status === 'ACCEPTED' || o.status === 'OFFERED'
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--na-border)] pb-5">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--na-ink-secondary)]">
            <Building2 className="h-4 w-4 text-[var(--na-accent-ink)]" aria-hidden="true" />
            <span>{org.orgType}</span>
            <span aria-hidden="true">/</span>
            <span>{org.state}</span>
          </div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[var(--na-ink-primary)]">
            {org.orgName}
          </h1>
          {org.about && (
            <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-[var(--na-ink-secondary)]">
              {org.about}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-primary active:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
          onClick={() => nav('/provider/opportunities')}
        >
          <Briefcase className="h-4 w-4" aria-hidden="true" />
          Manage opportunities
        </button>
      </div>

      <MetricBand
        items={[
          {
            label: 'Opportunities',
            value: fmtNum(org.opportunityCount),
            sub: `${fmtNum(org.activeCount)} open now`,
          },
          {
            label: 'Total seats',
            value: fmtNum(org.totalSeats),
            sub: `${fmtNum(filled)} allocated in latest run`,
            accent: true,
          },
          {
            label: 'Offers issued',
            value: fmtNum(offersCount),
            sub:
              avgFit > 0
                ? `${fmtPct(avgFit)} average candidate fit`
                : 'Awaiting allocation offers',
          },
          {
            label: 'Candidates joined',
            value: fmtNum(joinedCount),
            sub:
              unmet > 0
                ? `${fmtNum(unmet)} eligible demand unmet`
                : 'All eligible demand served',
          },
        ]}
      />

      {(offers.length > 0 || actionErr || actionMsg) && (
        <section className="space-y-3 rounded-[var(--na-radius-lg)] bg-[var(--na-stone)] p-5">
          <SectionHeader
            title="Offer review & joining confirmation"
            sub="Confirm reporting for candidates who have accepted an allocation offer"
            right={
              <button
                type="button"
                onClick={() => nav('/provider/opportunities')}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--na-radius-sm)] px-2 text-[13px] font-medium text-[var(--na-accent-ink)] hover:underline active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:opacity-50"
              >
                All opportunities
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            }
          />
          {actionErr && <Callout tone="danger">{actionErr}</Callout>}
          {actionMsg && <Callout tone="success">{actionMsg}</Callout>}
          {pendingJoinOffers.length === 0 ? (
            <p className="text-[14px] text-[var(--na-ink-secondary)]">
              No pending candidate joinings. All active offers have been processed.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--na-radius-md)] border border-[var(--na-border)] bg-[var(--na-surface)]">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className="th">Candidate</th>
                    <th className="th">Opportunity</th>
                    <th className="th">Status</th>
                    <th className="th">Offered</th>
                    <th className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingJoinOffers.map((o) => (
                    <tr key={o.id} className="tr-hover">
                      <td className="td font-medium">
                        {o.candidateName || `Candidate #${o.candidateId}`}
                      </td>
                      <td className="td text-[var(--na-ink-secondary)]">{o.opportunityTitle}</td>
                      <td className="td">
                        <Badge
                          tone={
                            o.status === 'ACCEPTED'
                              ? 'green'
                              : o.status === 'OFFERED'
                                ? 'amber'
                                : 'gray'
                          }
                        >
                          {o.status}
                        </Badge>
                      </td>
                      <td className="td tabular-nums text-[var(--na-ink-secondary)]">
                        {fmtTime(o.offeredAt)}
                      </td>
                      <td className="td text-right">
                        {o.status === 'ACCEPTED' ? (
                          <button
                            type="button"
                            className="btn-primary btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                            disabled={joiningId === o.id}
                            onClick={() => void handleConfirmJoining(o.id)}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            {joiningId === o.id ? 'Confirming…' : 'Confirm joining'}
                          </button>
                        ) : o.status === 'JOINED' ? (
                          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--na-status-success-text)]">
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            Joined
                          </span>
                        ) : (
                          <span className="text-[13px] text-[var(--na-ink-secondary)]">
                            Awaiting candidate response
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
          <SectionHeader title="Seats filled per opportunity" sub="Latest allocation run" />
          {impact.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--na-ink-secondary)]">
              No allocation impact data yet.
            </div>
          ) : (
            <HBar
              data={impact.map((x) => ({
                name: x.title.length > 22 ? `${x.title.slice(0, 22)}…` : x.title,
                value: x.allocated,
              }))}
              dataKey="value"
              height={Math.max(160, impact.length * 34)}
              color="var(--na-anchor)"
            />
          )}
        </div>

        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
          <SectionHeader title="Capacity vs demand" sub="Eligible demand relative to seats" />
          {cap.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--na-ink-secondary)]">
              No capacity data yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Opportunity</th>
                    <th className="th text-right">Seats</th>
                    <th className="th text-right">Eligible</th>
                    <th className="th text-right">Pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {cap.map((c) => (
                    <tr key={c.opportunityId} className="tr-hover">
                      <td className="td font-medium">{c.title}</td>
                      <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                        {fmtNum(c.capacity)}
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

      <section className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
        <SectionHeader
          title="Impact by opportunity"
          sub="Allocation outcome across your published seats"
        />
        {impact.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--na-ink-secondary)]">
            Publish opportunities to see allocation impact here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className="th">Opportunity</th>
                  <th className="th text-right">Capacity</th>
                  <th className="th text-right">Allocated</th>
                  <th className="th text-right">Unmet demand</th>
                  <th className="th text-right">Average suitability</th>
                </tr>
              </thead>
              <tbody>
                {impact.map((x) => (
                  <tr key={x.opportunityId} className="tr-hover">
                    <td className="td font-medium">{x.title}</td>
                    <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                      {fmtNum(x.capacity)}
                    </td>
                    <td className="td text-right">
                      <Badge tone={x.allocated > 0 ? 'green' : 'gray'}>
                        <span className="tabular-nums">{fmtNum(x.allocated)}</span>
                      </Badge>
                    </td>
                    <td className="td text-right">
                      {x.unmetDemand > 0 ? (
                        <Badge tone="amber">
                          <span className="tabular-nums">{fmtNum(x.unmetDemand)}</span>
                        </Badge>
                      ) : (
                        <span className="text-[var(--na-ink-tertiary)]">{'—'}</span>
                      )}
                    </td>
                    <td className="td tabular-nums text-right">{fmtPct(x.avgSuitability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
