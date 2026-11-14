import React, { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Star,
  Users,
  Award,
  Check,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiPatch, errMsg } from '../../api/client';
import { Spinner, Callout, Badge, Modal, fmtNum, fmtTime, formatEnumLabel } from '../../components/ui';
import { ProviderOffer } from '../../api/types';

const SECTOR_OPTIONS: [string, string][] = [
  ['SOFTWARE_IT', 'Software & IT'],
  ['DATA_ANALYTICS', 'Data & Analytics'],
  ['FINANCE_BANKING', 'Finance & Banking'],
  ['DESIGN_MEDIA', 'Design & Media'],
  ['MARKETING_COMMUNICATION', 'Marketing & Communication'],
  ['PUBLIC_ADMIN_POLICY', 'Public Administration & Policy'],
  ['HEALTHCARE_BIOTECH', 'Healthcare & Biotech'],
  ['MANUFACTURING_OPERATIONS', 'Manufacturing & Operations'],
  ['RESEARCH_DEVELOPMENT', 'Research & Development'],
  ['ENVIRONMENTAL_ENERGY', 'Environmental & Energy'],
];

// Labels must match backend Labels.java exactly — candidates see the same wording everywhere.
const QUALS: [string, string][] = [
  ['HIGHER_SECONDARY', 'Higher Secondary'],
  ['BACHELORS', "Bachelor's Degree"],
  ['POST_GRADUATE', 'Postgraduate'],
  ['DOCTORAL', 'Doctoral'],
];

const STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Gujarat',
  'Haryana',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

const BLANK = {
  title: '',
  sector: '',
  state: '',
  city: '',
  capacity: 5,
  durationMonths: 3,
  minQualification: 'BACHELORS',
  description: '',
  mandatorySkills: '' as string | never[],
  niceSkills: '' as string | never[],
};

const SECTOR_BY_LABEL: Record<string, string> = Object.fromEntries(
  SECTOR_OPTIONS.map(([v, l]) => [l, v])
);
const QUAL_BY_LABEL: Record<string, string> = Object.fromEntries(
  QUALS.map(([v, l]) => [l, v])
);
const QUAL_LABEL: Record<string, string> = Object.fromEntries(QUALS.map(([v, l]) => [v, l]));
const SECTOR_LABEL: Record<string, string> = Object.fromEntries(
  SECTOR_OPTIONS.map(([v, l]) => [v, l])
);

export default function ProviderOpportunities() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<any>(BLANK);
  const [busy, setBusy] = useState(false);

  const [selectedOppForOffers, setSelectedOppForOffers] = useState<any | null>(null);
  const [offersList, setOffersList] = useState<ProviderOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [joiningBusy, setJoiningBusy] = useState<number | null>(null);
  const [offersMsg, setOffersMsg] = useState('');
  const [offersErr, setOffersErr] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const d = await apiGet<any>('/providers/me/opportunities', { page: 0, size: 50 });
      setRows(d.content ?? []);
    } catch (e) {
      setErr(errMsg(e));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setForm({ ...BLANK });
    setIsNew(true);
    setEditing({});
  };

  const openEdit = (o: any) => {
    setForm({
      title: o.title,
      sector: SECTOR_BY_LABEL[o.sector] ?? o.sector,
      state: o.state,
      city: o.city ?? '',
      capacity: o.capacity,
      durationMonths: o.durationMonths,
      minQualification: QUAL_BY_LABEL[o.minQualification] ?? o.minQualification,
      description: o.description ?? '',
      mandatorySkills: Array.isArray(o.mandatorySkills)
        ? o.mandatorySkills.join(', ')
        : o.mandatorySkills ?? '',
      niceSkills: Array.isArray(o.niceSkills)
        ? o.niceSkills.join(', ')
        : o.niceSkills ?? '',
    });
    setIsNew(false);
    setEditing(o);
  };

  const save = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const body = {
      title: form.title,
      sector: form.sector,
      state: form.state,
      city: form.city || null,
      capacity: Number(form.capacity),
      durationMonths: Number(form.durationMonths),
      minQualification: form.minQualification,
      description: form.description,
      mandatorySkills: String(form.mandatorySkills)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      niceSkills: String(form.niceSkills)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (isNew) await apiPost('/providers/me/opportunities', body);
      else await apiPut(`/providers/me/opportunities/${editing.id}`, body);
      setMsg(isNew ? 'Opportunity published.' : 'Opportunity updated.');
      setEditing(null);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };

  const setStatus = async (id: number, status: string) => {
    const verb: Record<string, string> = {
      ACTIVE: 'reopened',
      PAUSED: 'paused (hidden from candidates)',
      CLOSED: 'closed',
    };
    try {
      await apiPatch(`/providers/me/opportunities/${id}/status`, { status });
      setMsg(`Opportunity ${verb[status] ?? status.toLowerCase()}.`);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const openOffers = async (opp: any) => {
    setSelectedOppForOffers(opp);
    setOffersLoading(true);
    setOffersErr('');
    setOffersMsg('');
    try {
      const data = await apiGet<ProviderOffer[]>(`/providers/me/opportunities/${opp.id}/offers`);
      setOffersList(data ?? []);
    } catch (e) {
      setOffersErr(errMsg(e));
    } finally {
      setOffersLoading(false);
    }
  };

  const handleConfirmJoining = async (offerId: number) => {
    setJoiningBusy(offerId);
    setOffersErr('');
    setOffersMsg('');
    try {
      const updated = await apiPost<ProviderOffer>(`/providers/me/offers/${offerId}/join`, {});
      setOffersList((prev) => prev.map((o) => (o.id === offerId ? updated : o)));
      setOffersMsg('Candidate joining successfully confirmed.');
      await load();
    } catch (e) {
      setOffersErr(errMsg(e));
    } finally {
      setJoiningBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--na-border)] pb-5">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[var(--na-ink-primary)]">
            My opportunities
          </h1>
          <p className="mt-1 text-[15px] text-[var(--na-ink-secondary)]">
            Publish, update, pause, or close the internships your organisation offers.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
          onClick={openNew}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New opportunity
        </button>
      </div>

      {err && <Callout tone="warn">{err}</Callout>}
      {msg && <Callout tone="success">{msg}</Callout>}

      <div className="overflow-hidden rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
        {loading ? (
          <Spinner label="Loading opportunities…" />
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[var(--na-ink-secondary)]">
            You have not published any opportunities yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className="th">Opportunity</th>
                  <th className="th">Location</th>
                  <th className="th text-right">Seats</th>
                  <th className="th text-right">Eligible</th>
                  <th className="th text-right">Preferences</th>
                  <th className="th text-right">Allocated</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="tr-hover">
                    <td className="td">
                      <div className="font-semibold text-[var(--na-ink-primary)]">{o.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[12px] text-[var(--na-ink-secondary)]">
                        <span>{o.sector}</span>
                        <span className="tabular-nums">{o.durationMonths} months</span>
                      </div>
                    </td>
                    <td className="td text-[var(--na-ink-secondary)]">
                      {o.city ? `${o.city}, ` : ''}
                      {o.state}
                    </td>
                    <td className="td tabular-nums text-right">{fmtNum(o.capacity)}</td>
                    <td className="td text-right">
                      <span className="inline-flex items-center gap-1 tabular-nums text-[var(--na-ink-secondary)]">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {fmtNum(o.eligibleCount)}
                      </span>
                    </td>
                    <td className="td text-right">
                      <span className="inline-flex items-center gap-1 tabular-nums text-[var(--na-ink-secondary)]">
                        <Star className="h-3.5 w-3.5" aria-hidden="true" />
                        {fmtNum(o.preferenceCount)}
                      </span>
                    </td>
                    <td className="td text-right">
                      {o.allocatedCount > 0 ? (
                        <Badge tone="green">
                          <span className="tabular-nums">{fmtNum(o.allocatedCount)}</span>
                        </Badge>
                      ) : (
                        <span className="text-[var(--na-ink-tertiary)]">{'—'}</span>
                      )}
                    </td>
                    <td className="td">
                      <Badge
                        tone={
                          (o.status ?? '').toUpperCase() === 'ACTIVE'
                            ? 'green'
                            : (o.status ?? '').toUpperCase() === 'PAUSED'
                              ? 'amber'
                              : 'gray'
                        }
                      >
                        {formatEnumLabel(o.status)}
                      </Badge>
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-[var(--na-accent-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                          onClick={() => void openOffers(o)}
                          title="View allocated candidates and manage joining"
                        >
                          <Award className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="tabular-nums">
                            Offers ({o.allocatedCount > 0 ? o.allocatedCount : 0})
                          </span>
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                          onClick={() => openEdit(o)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </button>
                        {o.status === 'Active' && (
                          <button
                            type="button"
                            className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                            onClick={() => void setStatus(o.id, 'PAUSED')}
                            aria-label={`Pause ${o.title}`}
                            title="Pause — hide from candidates without deleting"
                          >
                            <PauseCircle
                              className="h-4 w-4 text-[var(--na-status-warning-text)]"
                              aria-hidden="true"
                            />
                          </button>
                        )}
                        {o.status === 'Paused' && (
                          <button
                            type="button"
                            className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                            onClick={() => void setStatus(o.id, 'ACTIVE')}
                            aria-label={`Reopen ${o.title}`}
                            title="Open again"
                          >
                            <CheckCircle2
                              className="h-4 w-4 text-[var(--na-status-success-text)]"
                              aria-hidden="true"
                            />
                          </button>
                        )}
                        {o.status !== 'Closed' && (
                          <button
                            type="button"
                            className="btn-ghost btn-sm text-[var(--na-status-error-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                            onClick={() => void setStatus(o.id, 'CLOSED')}
                            aria-label={`Close ${o.title}`}
                            title="Close — permanently stop the internship"
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'New opportunity' : 'Edit opportunity'}
        wide
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="opp-title" className="label">
              Title
            </label>
            <input
              id="opp-title"
              className="input"
              value={form.title}
              onChange={(e) => upd('title', e.target.value)}
              placeholder="e.g. Data Analytics Intern"
            />
            <p className="mt-1 text-[12px] text-[var(--na-ink-secondary)]">
              Displayed to candidates when browsing internships.
            </p>
          </div>
          <div>
            <label htmlFor="opp-sector" className="label">
              Sector
            </label>
            <select
              id="opp-sector"
              className="input"
              value={form.sector}
              onChange={(e) => upd('sector', e.target.value)}
            >
              <option value="">Select…</option>
              {SECTOR_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-[var(--na-ink-secondary)]">
              Used for candidate interest matching and sector reports.
            </p>
          </div>
          <div>
            <label htmlFor="opp-qual" className="label">
              Minimum qualification
            </label>
            <select
              id="opp-qual"
              className="input"
              value={form.minQualification}
              onChange={(e) => upd('minQualification', e.target.value)}
            >
              {QUALS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-[var(--na-ink-secondary)]">
              Candidates below this level are excluded during allocation.
            </p>
          </div>
          <div>
            <label htmlFor="opp-state" className="label">
              State
            </label>
            <select
              id="opp-state"
              className="input"
              value={form.state}
              onChange={(e) => upd('state', e.target.value)}
            >
              <option value="">Select…</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-[var(--na-ink-secondary)]">
              Used for location fit and regional reporting.
            </p>
          </div>
          <div>
            <label htmlFor="opp-city" className="label">
              City or district
            </label>
            <input
              id="opp-city"
              className="input"
              value={form.city}
              onChange={(e) => upd('city', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="opp-capacity" className="label">
              Seats (capacity)
            </label>
            <input
              id="opp-capacity"
              className="input tabular-nums"
              type="number"
              min={1}
              max={200}
              value={form.capacity}
              onChange={(e) => upd('capacity', e.target.value)}
            />
            <p className="mt-1 text-[12px] text-[var(--na-ink-secondary)]">
              Maximum seats available in one allocation run.
            </p>
          </div>
          <div>
            <label htmlFor="opp-duration" className="label">
              Duration (months)
            </label>
            <input
              id="opp-duration"
              className="input tabular-nums"
              type="number"
              min={1}
              max={24}
              value={form.durationMonths}
              onChange={(e) => upd('durationMonths', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="opp-req-skills" className="label">
              Required skills (comma-separated)
            </label>
            <input
              id="opp-req-skills"
              className="input"
              value={form.mandatorySkills}
              onChange={(e) => upd('mandatorySkills', e.target.value)}
              placeholder="e.g. Python, SQL"
            />
            <p className="mt-1 text-[12px] text-[var(--na-ink-secondary)]">
              Candidates must hold all of these verified skills to be eligible.
            </p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="opp-pref-skills" className="label">
              Preferred skills (comma-separated, optional)
            </label>
            <input
              id="opp-pref-skills"
              className="input"
              value={form.niceSkills}
              onChange={(e) => upd('niceSkills', e.target.value)}
              placeholder="e.g. Power BI, Statistics"
            />
            <p className="mt-1 text-[12px] text-[var(--na-ink-secondary)]">
              Optional skills that increase candidate fit scores.
            </p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="opp-desc" className="label">
              Description
            </label>
            <textarea
              id="opp-desc"
              className="input min-h-[90px]"
              value={form.description}
              onChange={(e) => upd('description', e.target.value)}
              placeholder="What will the intern work on and learn?"
            />
          </div>
        </div>

        {form.title && (
          <div className="mt-5 rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-4">
            <div className="mb-2 text-[12px] font-medium text-[var(--na-ink-secondary)]">
              Candidate listing preview
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-[var(--na-ink-primary)]">
                  {form.title}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-3 text-[13px] text-[var(--na-ink-secondary)]">
                  <span>{SECTOR_LABEL[form.sector] ?? '—'}</span>
                  <span>
                    {form.city ? `${form.city}, ` : ''}
                    {form.state || '—'}
                  </span>
                  <span className="tabular-nums">{form.capacity} seats</span>
                  <span className="tabular-nums">{form.durationMonths} months</span>
                </div>
              </div>
              <div className="text-[12px] text-[var(--na-ink-secondary)]">
                Min qualification: {QUAL_LABEL[form.minQualification] ?? '—'}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {String(form.mandatorySkills)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (
                  <Badge key={`m-${s}`} tone="navy">
                    {s} (required)
                  </Badge>
                ))}
              {String(form.niceSkills)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (
                  <Badge key={`n-${s}`} tone="saffron">
                    {s} (preferred)
                  </Badge>
                ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            onClick={() => setEditing(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            onClick={() => void save()}
            disabled={busy || !form.title || !form.sector || !form.state}
          >
            {busy ? 'Saving…' : isNew ? 'Publish' : 'Save changes'}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!selectedOppForOffers}
        onClose={() => setSelectedOppForOffers(null)}
        title={`Allocated candidates & offers: ${selectedOppForOffers?.title ?? ''}`}
        wide
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--na-border)] pb-3">
            <div className="flex flex-wrap gap-4 text-[13px] text-[var(--na-ink-secondary)]">
              <span>
                Capacity:{' '}
                <strong className="tabular-nums font-semibold text-[var(--na-ink-primary)]">
                  {selectedOppForOffers?.capacity ?? 0} seats
                </strong>
              </span>
              <span>
                Duration:{' '}
                <strong className="tabular-nums font-semibold text-[var(--na-ink-primary)]">
                  {selectedOppForOffers?.durationMonths ?? 0} months
                </strong>
              </span>
            </div>
            <Badge tone="green">
              <span className="tabular-nums">
                {offersList.filter((o) => o.status === 'JOINED' || o.status === 'ACCEPTED').length}{' '}
                / {selectedOppForOffers?.capacity ?? 0} seats active
              </span>
            </Badge>
          </div>

          {offersErr && <Callout tone="danger">{offersErr}</Callout>}
          {offersMsg && <Callout tone="success">{offersMsg}</Callout>}

          {offersLoading ? (
            <Spinner label="Loading candidate offers…" />
          ) : offersList.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--na-ink-secondary)]">
              No candidates have been allocated to this opportunity in recent runs yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Candidate</th>
                    <th className="th">Qualification</th>
                    <th className="th">Offer status</th>
                    <th className="th">Timestamps</th>
                    <th className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offersList.map((o) => (
                    <tr key={o.id} className="tr-hover">
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
                      <td className="td tabular-nums text-[12px] text-[var(--na-ink-secondary)]">
                        <div>Offered: {fmtTime(o.offeredAt)}</div>
                        {o.respondedAt && <div>Responded: {fmtTime(o.respondedAt)}</div>}
                        {o.joinedAt && (
                          <div className="font-medium text-[var(--na-status-success-text)]">
                            Joined: {fmtTime(o.joinedAt)}
                          </div>
                        )}
                      </td>
                      <td className="td text-right">
                        {o.status === 'ACCEPTED' && (
                          <button
                            type="button"
                            className="btn-primary btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                            disabled={joiningBusy === o.id}
                            onClick={() => void handleConfirmJoining(o.id)}
                            title="Confirm candidate has reported and joined"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Confirm joining
                          </button>
                        )}
                        {o.status === 'JOINED' && (
                          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--na-status-success-text)]">
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            Joined
                          </span>
                        )}
                        {o.status === 'OFFERED' && (
                          <span className="text-[13px] text-[var(--na-ink-secondary)]">
                            Awaiting candidate
                          </span>
                        )}
                        {o.status === 'DECLINED' && (
                          <span className="text-[13px] text-[var(--na-status-error-text)]">
                            Declined
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="btn-ghost focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
              onClick={() => setSelectedOppForOffers(null)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
