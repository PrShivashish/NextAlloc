import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  User, GraduationCap, Wrench, Heart, ListOrdered, FileText, Plus, X, Save,
  Upload, SearchCheck, AlertTriangle, CheckCircle2, Sparkles, ShieldCheck,
  Download, RefreshCw, Building2, Calendar, FileCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { apiGet, apiPost, apiPut, apiDownload, errMsg } from '../../api/client';
import {
  ResumeSuggestionsView,
  Readiness,
  CandidateAcademicDto,
  CandidateAcademicInput,
  NocEvidenceDto,
  EnrollmentStatus,
  FinalYearStatus,
  SignatoryRole,
  RelatedSkill,
} from '../../api/types';
import { SectionHeader, Callout, Badge, Spinner, fmtTime } from '../../components/ui';
import { ScoreRing } from '../../components/ScoreRing';

const SKILL_SUGGESTIONS = [
  'Python', 'Java', 'C++', 'SQL', 'Data Analysis', 'Machine Learning', 'Excel', 'Statistics',
  'Power BI', 'Tableau', 'Web Development', 'React', 'Node.js', 'JavaScript', 'HTML CSS', 'Git',
  'Cloud Computing', 'DevOps', 'Cybersecurity', 'NLP', 'Deep Learning', 'Communication',
  'Presentation', 'Research', 'Content Writing', 'Graphic Design', 'UI/UX Design', 'Digital Marketing',
  'Social Media', 'SEO', 'Finance', 'Accounting', 'Budgeting',
  'Public Administration', 'Policy Analysis', 'HR Management', 'Operations',
  'Supply Chain', 'Legal Research', 'Environmental Science', 'Healthcare Data',
  'Project Management',
];
const RELATED_SKILL_SUGGESTIONS = [
  'Spring Boot', 'Hibernate', 'Quarkus', 'FastAPI', 'Django', 'Flask',
  'PyTorch', 'TensorFlow', 'Keras', 'Pandas', 'NumPy', 'Scikit-Learn',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes',
  'AWS', 'Azure', 'GCP', 'Git', 'Linux', 'Terraform', 'Next.js', 'Vue.js',
];
const SECTOR_OPTIONS = [
  ['SOFTWARE_IT', 'Software & IT'], ['DATA_ANALYTICS', 'Data & Analytics'], ['FINANCE_BANKING', 'Finance & Banking'],
  ['DESIGN_MEDIA', 'Design & Media'], ['MARKETING_COMMUNICATION', 'Marketing & Communication'],
  ['PUBLIC_ADMIN_POLICY', 'Public Administration & Policy'], ['HEALTHCARE_BIOTECH', 'Healthcare & Biotech'],
  ['MANUFACTURING_OPERATIONS', 'Manufacturing & Operations'], ['RESEARCH_DEVELOPMENT', 'Research & Development'],
  ['ENVIRONMENTAL_ENERGY', 'Environmental & Energy'],
];

const ENROLLMENT_OPTIONS: [string, string][] = [
  ['ENROLLED_FULL_TIME', 'Enrolled Full-Time in College/University'],
  ['ENROLLED_DISTANCE_PART_TIME', 'Enrolled in Distance / Part-Time Learning'],
  ['NOT_ENROLLED', 'Not Currently Enrolled (Graduated / Discontinued)'],
  ['UNKNOWN', 'Status Unspecified'],
];

const SIGNATORY_ROLES: [SignatoryRole, string][] = [
  ['HEAD_OF_DEPARTMENT', 'Head of Department (HOD)'],
  ['DEAN', 'Dean of Academic Affairs / College Dean'],
  ['PRINCIPAL', 'College Principal / Head of Institution'],
  ['TRAINING_AND_PLACEMENT_OFFICER', 'Training & Placement Officer (TPO)'],
  ['REGISTRAR', 'University Registrar'],
  ['OTHER_UNRECOGNIZED', 'Other College Authority'],
];
// Labels match backend Labels.java — the same wording candidates see in lists and reports.
const QUALS = [['HIGHER_SECONDARY', 'Higher Secondary'], ['BACHELORS', "Bachelor's Degree"], ['POST_GRADUATE', 'Postgraduate'], ['DOCTORAL', 'Doctoral']];
const STATUSES = [['STUDENT', 'Student'], ['GRADUATE', 'Recent graduate'], ['WORKING', 'Working professional']];
const LOC_TYPES = [['URBAN', 'Urban'], ['SEMI_URBAN', 'Semi-urban'], ['RURAL', 'Rural']];
const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Gujarat', 'Haryana', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name', phone: 'Phone', qualification: 'Highest qualification',
  candidateStatus: 'Current status', state: 'State', district: 'District',
  experienceYears: 'Experience (years)', bio: 'About you',
};

export default function CandidateProfile() {
  const nav = useNavigate();
  const [p, setP] = useState<any>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<{ opportunityId: number; rank: number; title: string; sector: string }[]>([]);
  const [resume, setResume] = useState<any>(null);
  const [sugg, setSugg] = useState<ResumeSuggestionsView | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [skillDraft, setSkillDraft] = useState('');
  const [relatedSkills, setRelatedSkills] = useState<RelatedSkill[]>([]);
  const [relatedSkillDraft, setRelatedSkillDraft] = useState('');
  const [oppSearch, setOppSearch] = useState('');
  const [oppResults, setOppResults] = useState<any[]>([]);
  const [oppNoMatch, setOppNoMatch] = useState<'' | 'none' | 'dups'>('');
  const [prefMsg, setPrefMsg] = useState('');
  const searchSeq = useRef(0);
  const prefMsgTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(prefMsgTimer.current), []);
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Academic Declaration State (Gate 2)
  const [academic, setAcademic] = useState<CandidateAcademicDto | null>(null);
  const [acadDraft, setAcadDraft] = useState({
    enrollmentStatus: 'ENROLLED_FULL_TIME',
    degreeProgram: '',
    institutionName: '',
    institutionAisheCode: '',
    currentAcademicYear: '',
    programDurationYears: '',
    expectedCompletionDate: '',
  });
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [academicConflict, setAcademicConflict] = useState(false);
  const [academicMsg, setAcademicMsg] = useState('');
  const [academicErr, setAcademicErr] = useState('');

  // Institutional NOC State (Gate 3)
  const [noc, setNoc] = useState<NocEvidenceDto | null>(null);
  const [showNocModal, setShowNocModal] = useState(false);
  const [nocFile, setNocFile] = useState<File | null>(null);
  const [nocIssuingInst, setNocIssuingInst] = useState('');
  const [nocSignatoryName, setNocSignatoryName] = useState('');
  const [nocSignatoryRole, setNocSignatoryRole] = useState<SignatoryRole>('HEAD_OF_DEPARTMENT');
  const [nocSignatoryEmail, setNocSignatoryEmail] = useState('');
  const [nocValidFrom, setNocValidFrom] = useState('');
  const [nocValidUntil, setNocValidUntil] = useState('');
  const [nocNoConflict, setNocNoConflict] = useState(false);
  const [savingNoc, setSavingNoc] = useState(false);
  const [nocMsg, setNocMsg] = useState('');
  const [nocErr, setNocErr] = useState('');

  // Resume review state — keyed by resume id so a replacement resume can
  // never inherit (or submit) the previous file's accept/reject choices.
  const [reviewResumeId, setReviewResumeId] = useState<number | null>(null);
  const [acceptField, setAcceptField] = useState<Record<string, boolean>>({});
  const [acceptSkill, setAcceptSkill] = useState<Record<string, boolean>>({});
  const [acceptInterest, setAcceptInterest] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);

  const load = async () => {
    try {
      const [prof, pr, rs, o, rd, acad, myNoc, myRelated] = await Promise.all([
        apiGet<any>('/candidates/me/profile'),
        apiGet<any>('/candidates/me/preferences'),
        apiGet<any>('/candidates/me/resume').catch(() => null),
        // All statuses (incl. paused) so an existing preference always resolves its title.
        apiGet<any>('/opportunities', { page: 0, size: 100, availableOnly: false }).catch(() => null),
        apiGet<Readiness>('/candidates/me/readiness').catch(() => null),
        apiGet<CandidateAcademicDto>('/candidates/me/academic').catch(() => null),
        apiGet<NocEvidenceDto>('/candidates/me/evidence/noc').catch(() => null),
        apiGet<RelatedSkill[]>('/candidates/me/related-skills').catch(() => []),
      ]);
      setP(prof);
      setSkills((prof.skills ?? []).map((s: any) => s.canonical));
      setRelatedSkills(myRelated ?? []);
      setInterests((prof.interests ?? []).map((s: any) => String(s)));
      const titles: Record<number, { title: string; sector: string }> = {};
      (o?.content ?? []).forEach((c: any) => { titles[c.id] = { title: c.title, sector: c.sector }; });
      setPrefs((pr ?? []).map((x: any) => ({
        opportunityId: x.opportunityId, rank: x.rank,
        title: titles[x.opportunityId]?.title ?? 'Opportunity',
        sector: titles[x.opportunityId]?.sector ?? '',
      })).sort((a: any, b: any) => a.rank - b.rank));
      setResume(rs ?? null);
      setReadiness(rd ?? null);

      if (acad) {
        setAcademic(acad);
        setAcadDraft({
          enrollmentStatus: String(acad.enrollmentStatus || 'ENROLLED_FULL_TIME'),
          degreeProgram: acad.degreeProgram || '',
          institutionName: acad.institutionName || '',
          institutionAisheCode: acad.institutionAisheCode || '',
          currentAcademicYear: acad.currentAcademicYear != null ? String(acad.currentAcademicYear) : '',
          programDurationYears: acad.programDurationYears != null ? String(acad.programDurationYears) : '',
          expectedCompletionDate: acad.expectedCompletionDate || '',
        });
        setNocIssuingInst(prev => prev || acad.institutionName || '');
      }

      setNoc(myNoc ?? null);

      if (rs && rs.status === 'PENDING_REVIEW') {
        apiGet<ResumeSuggestionsView>('/candidates/me/resume/suggestions')
          .then(s => setSugg(s))
          .catch(() => setSugg(null));
      } else {
        setSugg(null);
      }
    } catch (e) { setErr(errMsg(e)); }
  };
  useEffect(() => { void load(); }, []);

  // Reset review state whenever the reviewed resume changes (replacement safety).
  useEffect(() => {
    if (sugg && sugg.resumeId != null && sugg.resumeId !== reviewResumeId) {
      const f: Record<string, boolean> = {};
      for (const field of sugg.fields) {
        const cur = currentValue(p, field.field);
        f[field.field] = cur === ''; // blank → safe to auto-accept; existing data → never
      }
      const s: Record<string, boolean> = {};
      for (const sk of sugg.skills) s[sk] = !skills.includes(sk);
      const i: Record<string, boolean> = {};
      for (const it of sugg.interests) i[it] = true;
      setAcceptField(f); setAcceptSkill(s); setAcceptInterest(i);
      setReviewResumeId(sugg.resumeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugg?.resumeId]);

  const currentValue = (prof: any, field: string): string => {
    if (!prof) return '';
    switch (field) {
      case 'fullName': return prof.fullName ?? '';
      case 'phone': return prof.phone ?? '';
      case 'qualification': return prof.qualification ?? '';
      case 'candidateStatus': return prof.candidateStatus ?? '';
      case 'state': return prof.state ?? '';
      case 'district': return prof.district ?? '';
      case 'experienceYears': return (prof.experienceYears ?? 0) ? String(prof.experienceYears) : '';
      case 'bio': return prof.bio ?? '';
      default: return '';
    }
  };

  const saveBasic = async () => {
    setSaving('basic'); setMsg(''); setErr('');
    try {
      await apiPut('/candidates/me/profile', {
        fullName: p.fullName, phone: p.phone, dob: p.dob, state: p.state, district: p.district,
        locationType: p.locationType, qualification: p.qualification, candidateStatus: p.candidateStatus,
        bio: p.bio, experienceYears: p.experienceYears === '' ? null : Number(p.experienceYears),
      });
      setMsg('Profile details saved.'); await load();
    } catch (e) { setErr(errMsg(e)); }
    setSaving('');
  };

  const saveAcademic = async () => {
    setSavingAcademic(true);
    setAcademicMsg('');
    setAcademicErr('');
    setAcademicConflict(false);
    try {
      const input: CandidateAcademicInput = {
        enrollmentStatus: acadDraft.enrollmentStatus,
        degreeProgram: acadDraft.degreeProgram.trim(),
        institutionName: acadDraft.institutionName.trim(),
        institutionAisheCode: acadDraft.institutionAisheCode.trim(),
        currentAcademicYear: acadDraft.currentAcademicYear === '' ? null : Number(acadDraft.currentAcademicYear),
        programDurationYears: acadDraft.programDurationYears === '' ? null : Number(acadDraft.programDurationYears),
        expectedCompletionDate: acadDraft.expectedCompletionDate || null,
        expectedVersion: academic?.version ?? 0,
      };

      const updated = await apiPut<CandidateAcademicDto>('/candidates/me/academic', input);
      setAcademic(updated);
      setAcadDraft({
        enrollmentStatus: String(updated.enrollmentStatus || 'ENROLLED_FULL_TIME'),
        degreeProgram: updated.degreeProgram || '',
        institutionName: updated.institutionName || '',
        institutionAisheCode: updated.institutionAisheCode || '',
        currentAcademicYear: updated.currentAcademicYear != null ? String(updated.currentAcademicYear) : '',
        programDurationYears: updated.programDurationYears != null ? String(updated.programDurationYears) : '',
        expectedCompletionDate: updated.expectedCompletionDate || '',
      });
      setAcademicMsg(`Academic declaration updated successfully (Record v${updated.version}). Status: ${updated.finalYearStatus}.`);
    } catch (e: any) {
      if (e.status === 409) {
        setAcademicConflict(true);
        setAcademicErr('Concurrency Conflict (HTTP 409): The academic record has been updated since this page was loaded (e.g. by an administrator review). To prevent overwriting newer authoritative data, your pending edits were not saved.');
      } else {
        setAcademicErr(errMsg(e));
      }
    } finally {
      setSavingAcademic(false);
    }
  };

  const refreshAcademic = async () => {
    setAcademicConflict(false);
    setAcademicErr('');
    try {
      const fresh = await apiGet<CandidateAcademicDto>('/candidates/me/academic');
      setAcademic(fresh);
      setAcadDraft({
        enrollmentStatus: String(fresh.enrollmentStatus || 'ENROLLED_FULL_TIME'),
        degreeProgram: fresh.degreeProgram || '',
        institutionName: fresh.institutionName || '',
        institutionAisheCode: fresh.institutionAisheCode || '',
        currentAcademicYear: fresh.currentAcademicYear != null ? String(fresh.currentAcademicYear) : '',
        programDurationYears: fresh.programDurationYears != null ? String(fresh.programDurationYears) : '',
        expectedCompletionDate: fresh.expectedCompletionDate || '',
      });
      setAcademicMsg('Loaded latest academic record from server.');
    } catch (e: any) {
      setAcademicErr(errMsg(e));
    }
  };

  const submitNoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setNocErr('');
    setNocMsg('');

    if (!nocFile) {
      setNocErr('Please select a PDF document to upload.');
      return;
    }

    if (!nocFile.name.toLowerCase().endsWith('.pdf') && nocFile.type !== 'application/pdf') {
      setNocErr('Unsupported file format: NextAlloc accepts only PDF documents (.pdf) for institutional NOCs.');
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (nocFile.size > MAX_SIZE) {
      const sizeMb = (nocFile.size / (1024 * 1024)).toFixed(2);
      setNocErr(`File exceeds limit: The selected file is ${sizeMb} MB. Institutional NOC uploads are strictly limited to 5.00 MB. Please compress your PDF.`);
      return;
    }

    if (!nocIssuingInst.trim()) {
      setNocErr('Issuing institution name is required.');
      return;
    }
    if (!nocSignatoryName.trim()) {
      setNocErr('Signatory authority name is required.');
      return;
    }
    if (!nocSignatoryEmail.trim()) {
      setNocErr('Signatory official email address is required.');
      return;
    }
    if (!nocValidFrom || !nocValidUntil) {
      setNocErr('Both NOC validity start date and end date are required.');
      return;
    }
    if (nocValidUntil < nocValidFrom) {
      setNocErr('Validity end date cannot precede the start date.');
      return;
    }
    if (!nocNoConflict) {
      setNocErr('You must declare that the internship does not conflict with regular coursework & exams.');
      return;
    }

    setSavingNoc(true);
    try {
      const fd = new FormData();
      fd.append('file', nocFile);
      fd.append('issuingInstitution', nocIssuingInst.trim());
      fd.append('signatoryName', nocSignatoryName.trim());
      fd.append('signatoryRole', nocSignatoryRole);
      fd.append('signatoryEmail', nocSignatoryEmail.trim());
      fd.append('declaresNoAcademicConflict', String(nocNoConflict));
      fd.append('validFrom', nocValidFrom);
      fd.append('validUntil', nocValidUntil);

      const res = await apiPost<NocEvidenceDto>('/candidates/me/evidence/noc', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setNoc(res);
      setShowNocModal(false);
      setNocFile(null);
      setNocMsg(`Institutional NOC successfully submitted (ID #${res.id}). Current status: SUBMITTED (Pending administrator verification).`);
    } catch (e: any) {
      setNocErr(errMsg(e));
    } finally {
      setSavingNoc(false);
    }
  };

  const downloadMyNoc = async () => {
    try {
      await apiDownload('/api/candidates/me/evidence/noc/download', 'my-institutional-noc.pdf');
    } catch (e: any) {
      setNocErr(errMsg(e));
    }
  };
  const saveSkills = async () => {
    setSaving('skills'); setMsg(''); setErr('');
    try { await apiPut('/candidates/me/skills', skills); setMsg('Skills updated.'); await load(); }
    catch (e) { setErr(errMsg(e)); }
    setSaving('');
  };
  const saveInterests = async () => {
    setSaving('interests'); setMsg(''); setErr('');
    try { await apiPut('/candidates/me/interests', interests); setMsg('Interests saved.'); await load(); }
    catch (e) { setErr(errMsg(e)); }
    setSaving('');
  };
  const savePrefs = async () => {
    setSaving('prefs'); setMsg(''); setErr('');
    try { await apiPut('/candidates/me/preferences', prefs.map(x => ({ opportunityId: x.opportunityId, rank: x.rank }))); setMsg('Preferences saved.'); await load(); }
    catch (e) { setErr(errMsg(e)); }
    setSaving('');
  };
  const addSkill = () => {
    const v = skillDraft.trim();
    if (!v) return;
    if (!skills.includes(v)) setSkills(s => [...s, v]);
    setSkillDraft('');
  };

  const addRelatedSkill = () => {
    const v = relatedSkillDraft.trim();
    if (!v) return;
    const exists = relatedSkills.some(s => (s.raw || s.rawLabel || '').toLowerCase() === v.toLowerCase());
    if (!exists) {
      setRelatedSkills(prev => [...prev, {
        raw: v,
        rawLabel: v,
        conceptId: 'CUSTOM',
        relatedCanonical: 'General',
        relationshipType: 'DECLARED',
        claimSource: 'SELF_DECLARED',
        evidenceStatus: 'UNVERIFIED',
      }]);
    }
    setRelatedSkillDraft('');
  };

  const removeRelatedSkill = (idx: number) => {
    setRelatedSkills(prev => prev.filter((_, i) => i !== idx));
  };

  const saveRelatedSkills = async () => {
    setSaving('relatedSkills'); setMsg(''); setErr('');
    try {
      const payload = relatedSkills.map(s => s.raw || s.rawLabel || '').filter(Boolean);
      const res = await apiPut<RelatedSkill[]>('/candidates/me/related-skills', payload);
      setRelatedSkills(res);
      setMsg('Related concepts and frameworks saved successfully.');
    } catch (e) { setErr(errMsg(e)); }
    setSaving('');
  };
  const MAX_PREFS = 10; // backend rejects ranks above 10

  const flashPrefMsg = (m: string) => {
    setPrefMsg(m);
    window.clearTimeout(prefMsgTimer.current);
    prefMsgTimer.current = window.setTimeout(() => setPrefMsg(''), 3000);
  };

  const searchOpps = async (term: string) => {
    setOppSearch(term);
    if (!term.trim()) { setOppResults([]); setOppNoMatch(''); return; }
    const seq = ++searchSeq.current;
    try {
      const d = await apiGet<any>('/opportunities', { page: 0, size: 6, q: term, availableOnly: true });
      if (seq !== searchSeq.current) return; // a newer search superseded this one
      const all = d.content ?? [];
      const fresh = all.filter((o: any) => !prefs.some(x => x.opportunityId === o.id));
      setOppResults(fresh);
      setOppNoMatch(all.length === 0 ? 'none' : fresh.length === 0 ? 'dups' : '');
    } catch {
      if (seq === searchSeq.current) { setOppResults([]); setOppNoMatch('none'); }
    }
  };
  const addPref = (id: number) => {
    if (prefs.some(x => x.opportunityId === id)) { flashPrefMsg('That opportunity is already in your list.'); return; }
    if (prefs.length >= MAX_PREFS) { flashPrefMsg(`You can rank at most ${MAX_PREFS} opportunities.`); return; }
    const o = oppResults.find(x => x.id === id);
    const rank = prefs.length + 1;
    setPrefs(ps => [...ps, { opportunityId: id, rank: ps.length + 1, title: o?.title ?? 'Opportunity', sector: o?.sector ?? '' }]);
    setOppResults([]); setOppSearch(''); setOppNoMatch('');
    flashPrefMsg(`Added “${o?.title ?? 'Opportunity'}” as preference #${rank}.`);
  };
  const removePref = (id: number) => {
    const x = prefs.find(y => y.opportunityId === id);
    setPrefs(ps => ps.filter(y => y.opportunityId !== id).map((y, k) => ({ ...y, rank: k + 1 })));
    flashPrefMsg(`Removed “${x?.title ?? 'Opportunity'}”. Ranks updated.`);
  };
  const movePref = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= prefs.length) return;
    const next = [...prefs];
    [next[idx], next[j]] = [next[j], next[idx]];
    setPrefs(next.map((x, k) => ({ ...x, rank: k + 1 })));
  };

  const onResume = async (f: File | null) => {
    if (!f) return;
    setSaving('resume'); setErr(''); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await apiPost<any>('/candidates/me/resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } } as any);
      setResume(r);
      if (r.status === 'PENDING_REVIEW') {
        setMsg(`Resume received. ${r.pendingSkills?.length ?? 0} skills and profile suggestions found — please review them below.`);
      } else if (r.status === 'REVIEWED') {
        setMsg('Resume received — nothing needed your review.');
      }
      await load();
    } catch (e) { setErr(errMsg(e)); }
    setSaving('');
  };

  const applySuggestions = async (ignoreAll: boolean) => {
    if (!sugg) return;
    setApplying(true); setErr(''); setMsg('');
    try {
      const profile: Record<string, string> = {};
      if (!ignoreAll) {
        for (const f of sugg.fields) {
          if (acceptField[f.field]) profile[f.field] = f.value;
        }
      }
      const skillsSel = ignoreAll ? [] : sugg.skills.filter(s => acceptSkill[s] !== false);
      const interestsSel = ignoreAll ? [] : sugg.interests.filter(s => acceptInterest[s] !== false);
      const r = await apiPost<any>('/candidates/me/resume/apply-suggestions',
        { resumeId: sugg.resumeId, profile, skills: skillsSel, interests: interestsSel });
      setResume(r);
      setSugg(null);
      setReviewResumeId(null);
      setMsg(ignoreAll
        ? 'Suggestions dismissed — your resume is marked as reviewed.'
        : 'Confirmed suggestions saved to your profile.');
      await load();
    } catch (e) { setErr(errMsg(e)); }
    setApplying(false);
  };

  const skillOptions = useMemo(() => SKILL_SUGGESTIONS.filter(s => !skills.includes(s)), [skills]);

  if (!p) return <div className="space-y-4">{err && <Callout tone="danger">{err}</Callout>}{!err && <Spinner label="Loading your profile…" />}</div>;

  const upd = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const pendingReview = resume?.status === 'PENDING_REVIEW' && sugg;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold text-ink">My Profile</h1>
          <p className="mt-1 text-[13.5px] text-navy-500">A complete, accurate profile is what the engine uses to judge eligibility and suitability.</p>
        </div>
        {readiness && (
          <div className="flex items-center gap-3 rounded-xl bg-navy-50/70 px-4 py-2.5 ring-1 ring-navy-100">
            <ScoreRing value={readiness.overall} size={44} stroke={5} />
            <div>
              <div className="text-[12px] font-bold text-ink">Profile strength</div>
              <div className="text-[11.5px] text-navy-500">{readiness.overall >= 80 ? 'Strong — ready for allocation' : readiness.overall >= 50 ? 'Good — a couple of gaps' : 'Building — see the items below'}</div>
            </div>
          </div>
        )}
      </div>

      {err && <Callout tone="warn">{err}</Callout>}
      {msg && <Callout tone="success">{msg}</Callout>}

      {/* 1 · Personal information */}
      <div className="card p-5">
        <SectionHeader title="Personal information" right={<span className="chip bg-navy-50 text-navy-500 ring-1 ring-navy-100"><User className="h-3.5 w-3.5" /> identity</span>} />
        <div className="grid gap-4 md:grid-cols-3">
          <div><label className="label">Full name</label><input className="input" value={p.fullName ?? ''} onChange={e => upd('fullName', e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input" value={p.phone ?? ''} onChange={e => upd('phone', e.target.value)} placeholder="+91…" /></div>
          <div><label className="label">Date of birth</label><input className="input" type="date" value={p.dob ?? ''} onChange={e => upd('dob', e.target.value)} /></div>
          <div><label className="label">State</label>
            <select className="input" value={p.state ?? ''} onChange={e => upd('state', e.target.value)}>
              <option value="">Select…</option>{STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">District</label><input className="input" value={p.district ?? ''} onChange={e => upd('district', e.target.value)} /></div>
          <div><label className="label">Location type</label>
            <select className="input" value={p.locationType ?? ''} onChange={e => upd('locationType', e.target.value)}>
              <option value="">Select…</option>{LOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={saveBasic} disabled={saving === 'basic'}><Save className="h-4 w-4" />{saving === 'basic' ? 'Saving…' : 'Save details'}</button>
        </div>
      </div>

      {/* 2 · Academic enrollment declaration (Gate 2) */}
      <div id="academic-section" className="card p-5">
        <SectionHeader
          title="Academic enrollment declaration"
          sub="Declare your college, degree, and study year. Server rules derive your standing; only authorized administrators grant verified final-year status upon validating your NOC."
          right={
            <div className="flex items-center gap-2">
              <span className="chip bg-navy-50 text-navy-500 ring-1 ring-navy-100">
                <Building2 className="h-3.5 w-3.5" /> academic profile
              </span>
              {academic && (
                <span className="rounded-md bg-navy-100 px-2 py-0.5 text-xs font-mono font-semibold text-navy-700">
                  Record v{academic.version}
                </span>
              )}
            </div>
          }
        />

        {academicErr && <Callout tone="danger">{academicErr}</Callout>}
        {academicMsg && <Callout tone="success">{academicMsg}</Callout>}

        {academicConflict && (
          <div className="card my-3 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <div className="font-semibold text-amber-900">Academic Concurrency Conflict (HTTP 409)</div>
                <p className="mt-1 text-xs text-amber-800">
                  Your academic record was updated on the server (e.g. by administrative review or another session) since you loaded this page.
                  To protect authoritative data, your pending edits were not saved.
                </p>
                <button onClick={refreshAcademic} className="btn-ghost btn-sm mt-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh Latest Academic Record
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Banner */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-navy-50/70 p-3.5 ring-1 ring-navy-100">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-navy-600">Verification Standing:</span>
            <Badge
              tone={
                academic?.finalYearStatus === 'VERIFIED_FINAL_YEAR'
                  ? 'green'
                  : academic?.finalYearStatus === 'CLAIMED_FINAL_YEAR'
                    ? 'amber'
                    : academic?.finalYearStatus === 'VERIFIED_NOT_FINAL_YEAR'
                      ? 'red'
                      : 'gray'
              }
              dot
            >
              {academic?.finalYearStatus === 'VERIFIED_FINAL_YEAR'
                ? 'VERIFIED FINAL YEAR — Cleared for Final-Year Opportunities'
                : academic?.finalYearStatus === 'CLAIMED_FINAL_YEAR'
                  ? 'CLAIMED FINAL YEAR — Pending Administrator NOC Verification'
                  : academic?.finalYearStatus === 'VERIFIED_NOT_FINAL_YEAR'
                    ? 'VERIFIED NOT FINAL YEAR — Ineligible for Final-Year Policy'
                    : 'STANDING UNVERIFIED'}
            </Badge>
          </div>
          <div className="text-[11.5px] text-navy-500">
            {academic?.finalYearStatus === 'VERIFIED_FINAL_YEAR'
              ? 'Institutional verification completed.'
              : 'Submit your institutional NOC below for administrative review.'}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">Enrollment Status</label>
            <select
              className="input"
              value={acadDraft.enrollmentStatus}
              onChange={(e) => setAcadDraft(d => ({ ...d, enrollmentStatus: e.target.value }))}
            >
              {ENROLLMENT_OPTIONS.map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Institution Name</label>
            <input
              className="input"
              value={acadDraft.institutionName}
              onChange={(e) => setAcadDraft(d => ({ ...d, institutionName: e.target.value }))}
              placeholder="e.g. National Institute of Technology"
            />
          </div>
          <div>
            <label className="label">Institution AISHE Code</label>
            <input
              className="input"
              value={acadDraft.institutionAisheCode}
              onChange={(e) => setAcadDraft(d => ({ ...d, institutionAisheCode: e.target.value }))}
              placeholder="e.g. U-12345 or C-54321"
            />
          </div>
          <div>
            <label className="label">Degree Program</label>
            <input
              className="input"
              value={acadDraft.degreeProgram}
              onChange={(e) => setAcadDraft(d => ({ ...d, degreeProgram: e.target.value }))}
              placeholder="e.g. B.Tech Computer Science"
            />
          </div>
          <div>
            <label className="label">Current Academic Year</label>
            <input
              className="input"
              type="number"
              min="1"
              max="10"
              value={acadDraft.currentAcademicYear}
              onChange={(e) => setAcadDraft(d => ({ ...d, currentAcademicYear: e.target.value }))}
              placeholder="e.g. 4"
            />
          </div>
          <div>
            <label className="label">Program Duration (Years)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="10"
              value={acadDraft.programDurationYears}
              onChange={(e) => setAcadDraft(d => ({ ...d, programDurationYears: e.target.value }))}
              placeholder="e.g. 4"
            />
          </div>
          <div className="md:col-span-3">
            <label className="label">Expected Completion Date</label>
            <input
              className="input max-w-xs"
              type="date"
              value={acadDraft.expectedCompletionDate}
              onChange={(e) => setAcadDraft(d => ({ ...d, expectedCompletionDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-3">
          <div className="text-[11.5px] text-navy-400">
            Modifying institution, AISHE, year, or graduation date resets standing to Claimed/Unknown until re-verified.
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary"
              onClick={saveAcademic}
              disabled={savingAcademic}
            >
              <Save className="h-4 w-4" />
              {savingAcademic ? 'Saving Declaration…' : 'Save Academic Declaration'}
            </button>
          </div>
        </div>
      </div>

      {/* 3 · Institutional No Objection Certificate (Gate 3) */}
      <div id="noc-section" className="card p-5">
        <SectionHeader
          title="Institutional No Objection Certificate (NOC)"
          sub="Upload an official certificate from your college authority certifying that your internship does not conflict with classes or examinations."
          right={
            <span className="chip bg-navy-50 text-navy-500 ring-1 ring-navy-100">
              <ShieldCheck className="h-3.5 w-3.5" /> institutional clearance
            </span>
          }
        />

        {nocErr && <Callout tone="danger">{nocErr}</Callout>}
        {nocMsg && <Callout tone="success">{nocMsg}</Callout>}

        {noc ? (
          <div className="space-y-4">
            {/* Active NOC Card */}
            <div className="rounded-xl border border-navy-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-5 w-5 text-navy-600" />
                  <div>
                    <div className="text-sm font-bold text-ink">Active Institutional NOC (Evidence #{noc.id})</div>
                    <div className="text-[11.5px] text-navy-400">Fingerprint: <span className="font-mono">{noc.documentSha256 ? noc.documentSha256.substring(0, 16) + '…' : '—'}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      noc.verificationStatus === 'VERIFIED'
                        ? 'green'
                        : noc.verificationStatus === 'SUBMITTED'
                          ? 'amber'
                          : noc.verificationStatus === 'REJECTED'
                            ? 'red'
                            : 'amber'
                    }
                    dot
                  >
                    {noc.verificationStatus === 'VERIFIED'
                      ? 'VERIFIED & APPROVED'
                      : noc.verificationStatus === 'SUBMITTED'
                        ? 'SUBMITTED — Pending Review'
                        : noc.verificationStatus === 'REJECTED'
                          ? 'REJECTED'
                          : noc.verificationStatus === 'PENDING_ADDITIONAL_INFO'
                            ? 'CLARIFICATION REQUESTED'
                            : noc.verificationStatus}
                  </Badge>
                  <span className="rounded-md bg-navy-100 px-2 py-0.5 text-xs font-mono font-semibold text-navy-700">
                    v{noc.version}
                  </span>
                </div>
              </div>

              {/* NOC Metadata */}
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="font-semibold text-navy-500">Issuing Institution:</span>
                  <div className="mt-0.5 font-medium text-ink">{noc.issuingInstitution}</div>
                </div>
                <div>
                  <span className="font-semibold text-navy-500">Signatory Authority:</span>
                  <div className="mt-0.5 font-medium text-ink">{noc.signatoryName} ({noc.signatoryRole})</div>
                  <div className="text-[11px] text-navy-400">{noc.signatoryEmail}</div>
                </div>
                <div>
                  <span className="font-semibold text-navy-500">Validity Period:</span>
                  <div className="mt-0.5 font-medium text-ink">{noc.validFrom || '—'} to {noc.validUntil || '—'}</div>
                </div>
                <div>
                  <span className="font-semibold text-navy-500">Conflict Certification:</span>
                  <div className="mt-0.5 font-medium text-emerald-700">
                    {noc.declaresNoAcademicConflict ? '✓ Certified no conflict' : '✗ Conflict declared'}
                  </div>
                </div>
              </div>

              {/* Reviewer Feedback / Notes if Rejected or Clarification */}
              {noc.verificationStatus === 'REJECTED' && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <div className="font-semibold">Administrator Rejection Feedback:</div>
                  <div className="mt-0.5">Reason: <strong>{noc.rejectionReasonCode || 'General rejection'}</strong></div>
                  {noc.rejectionNotes && <div className="mt-1">Notes: {noc.rejectionNotes}</div>}
                </div>
              )}

              {noc.verificationStatus === 'PENDING_ADDITIONAL_INFO' && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="font-semibold">Clarification Requested by Administrator:</div>
                  <div className="mt-0.5">{noc.rejectionNotes || 'Please upload an updated document clarifying dates or signatory authority.'}</div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-3">
                <button
                  onClick={downloadMyNoc}
                  className="btn-ghost btn-sm"
                  title="Download your active submitted NOC PDF"
                >
                  <Download className="h-4 w-4" /> Download Submitted PDF
                </button>
                <button
                  onClick={() => setShowNocModal(true)}
                  className="btn-primary btn-sm"
                >
                  <Upload className="h-4 w-4" /> Upload New Revision / Replace NOC
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50/50 p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-navy-400" />
            <div className="font-display mt-2 text-sm font-bold text-ink">No Institutional NOC On File</div>
            <p className="mx-auto mt-1 max-w-md text-xs text-navy-500">
              Upload a signed No Objection Certificate from your Dean, Principal, or Head of Department to qualify for internships requiring institutional clearance.
            </p>
            <button
              onClick={() => setShowNocModal(true)}
              className="btn-primary btn-sm mt-4"
            >
              <Upload className="h-4 w-4" /> Upload Institutional NOC (PDF)
            </button>
          </div>
        )}

        {/* Upload Modal / Form */}
        {showNocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4">
            <div className="card w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">Upload Institutional NOC</h3>
                  <p className="mt-0.5 text-xs text-navy-500">
                    PDF format only · Maximum file size 5.00 MB
                  </p>
                </div>
                <button onClick={() => setShowNocModal(false)} className="text-navy-400 hover:text-ink">
                  ✕
                </button>
              </div>

              <form onSubmit={submitNoc} className="mt-4 space-y-3.5">
                <div>
                  <label className="label">NOC Document (PDF, max 5 MB) <span className="text-red-500">*</span></label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="input py-2 text-xs"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f && f.size > 5 * 1024 * 1024) {
                        setNocErr(`File exceeds limit: ${(f.size / (1024 * 1024)).toFixed(2)} MB is greater than the allowed 5 MB maximum.`);
                        setNocFile(null);
                      } else {
                        setNocErr('');
                        setNocFile(f);
                      }
                    }}
                  />
                  {nocFile && (
                    <div className="mt-1 text-[11px] text-emerald-700">
                      Selected: {nocFile.name} ({(nocFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Issuing Institution <span className="text-red-500">*</span></label>
                    <input
                      className="input"
                      value={nocIssuingInst}
                      onChange={(e) => setNocIssuingInst(e.target.value)}
                      placeholder="e.g. National Institute of Tech"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Signatory Role <span className="text-red-500">*</span></label>
                    <select
                      className="input"
                      value={nocSignatoryRole}
                      onChange={(e) => setNocSignatoryRole(e.target.value as SignatoryRole)}
                    >
                      {SIGNATORY_ROLES.map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Signatory Authority Name <span className="text-red-500">*</span></label>
                    <input
                      className="input"
                      value={nocSignatoryName}
                      onChange={(e) => setNocSignatoryName(e.target.value)}
                      placeholder="e.g. Dr. Rajesh Kumar"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Signatory Official Email <span className="text-red-500">*</span></label>
                    <input
                      className="input"
                      type="email"
                      value={nocSignatoryEmail}
                      onChange={(e) => setNocSignatoryEmail(e.target.value)}
                      placeholder="e.g. dean@college.edu.in"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Validity Start Date <span className="text-red-500">*</span></label>
                    <input
                      className="input"
                      type="date"
                      value={nocValidFrom}
                      onChange={(e) => setNocValidFrom(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Validity End Date <span className="text-red-500">*</span></label>
                    <input
                      className="input"
                      type="date"
                      value={nocValidUntil}
                      onChange={(e) => setNocValidUntil(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-navy-200 bg-navy-50/60 p-3 text-xs text-navy-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded text-saffron-500"
                    checked={nocNoConflict}
                    onChange={(e) => setNocNoConflict(e.target.checked)}
                    required
                  />
                  <span>
                    <strong className="text-ink">No Academic Conflict Declaration:</strong> I hereby certify that participation in this internship does not conflict with mandatory coursework, exams, or institutional requirements, as endorsed by the signatory authority.
                  </span>
                </label>

                <div className="mt-4 flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNocModal(false)}
                    className="btn-ghost btn-sm"
                    disabled={savingNoc}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary btn-sm"
                    disabled={savingNoc || !nocFile || !nocNoConflict}
                  >
                    {savingNoc ? 'Uploading NOC…' : 'Submit Certificate for Verification'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* 4 · Education & experience */}
      <div className="card p-5">
        <SectionHeader title="Education & experience" right={<span className="chip bg-navy-50 text-navy-500 ring-1 ring-navy-100"><GraduationCap className="h-3.5 w-3.5" /> education</span>} />
        <div className="grid gap-4 md:grid-cols-3">
          <div><label className="label">Highest qualification</label>
            <select className="input" value={p.qualification ?? ''} onChange={e => upd('qualification', e.target.value)}>
              <option value="">Select…</option>{QUALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className="label">Current status</label>
            <select className="input" value={p.candidateStatus ?? ''} onChange={e => upd('candidateStatus', e.target.value)}>
              <option value="">Select…</option>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className="label">Experience (years)</label><input className="input" type="number" min={0} max={40} step={0.5} value={p.experienceYears ?? 0} onChange={e => upd('experienceYears', e.target.value)} /></div>
          <div className="md:col-span-3"><label className="label">A line about yourself</label><textarea className="input min-h-[70px]" value={p.bio ?? ''} onChange={e => upd('bio', e.target.value)} placeholder="Your focus, projects, and what you are looking for." /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={saveBasic} disabled={saving === 'basic'}><Save className="h-4 w-4" />{saving === 'basic' ? 'Saving…' : 'Save details'}</button>
        </div>
      </div>

      {/* 5 · Skills */}
      <div className="card p-5">
        <SectionHeader title="Skills" sub="Only recognised skills count toward eligibility — pick from the validated list." />
        <div className="flex flex-wrap gap-2">
          {skills.map(s => (
            <span key={s} className="chip bg-navy-100/70 text-navy-700 ring-1 ring-navy-200">
              {s}<button onClick={() => setSkills(x => x.filter(y => y !== s))} className="ml-0.5 rounded-full p-0.5 hover:bg-navy-200"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {skills.length === 0 && <span className="text-[13px] text-navy-400">No skills added yet.</span>}
        </div>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <input className="input" list="skill-sugg" placeholder="Add a skill (choose from the list)…" value={skillDraft}
              onChange={e => setSkillDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()} />
            <datalist id="skill-sugg">{skillOptions.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <button className="btn-ghost" onClick={addSkill}><Plus className="h-4 w-4" /> Add</button>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={saveSkills} disabled={saving === 'skills'}><Wrench className="h-4 w-4" />{saving === 'skills' ? 'Saving…' : 'Save skills'}</button>
        </div>
      </div>

      {/* 5b · Related Concepts & Soft Suitability Skills */}
      <div className="card p-5">
        <SectionHeader
          title="Related Concepts & Frameworks"
          sub="Enrich your profile with specialized tools, frameworks, and libraries (e.g. Spring Boot, PyTorch, Docker, FastAPI) for experimental soft suitability matching without weakening core eligibility."
          right={
            <span className="chip bg-navy-50 text-navy-600 ring-1 ring-navy-200">
              <Sparkles className="h-3.5 w-3.5 text-saffron-500" /> soft suitability
            </span>
          }
        />
        <div className="flex flex-wrap gap-2">
          {relatedSkills.map((s, idx) => (
            <span key={idx} className="chip bg-saffron-50/70 text-saffron-800 ring-1 ring-saffron-200">
              <span className="font-semibold">{s.raw || s.rawLabel}</span>
              {s.relatedCanonical && (
                <span className="text-[10px] text-saffron-600 font-normal">
                  {' '}→ {s.relatedCanonical} ({s.relationshipType})
                </span>
              )}
              <button
                type="button"
                onClick={() => removeRelatedSkill(idx)}
                className="ml-1 rounded-full p-0.5 hover:bg-saffron-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {relatedSkills.length === 0 && (
            <span className="text-[13px] text-navy-400">No related concepts recorded yet.</span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <input
              className="input"
              list="related-skill-sugg"
              placeholder="Add related framework or tool (e.g. Spring Boot, Docker, FastAPI)…"
              value={relatedSkillDraft}
              onChange={e => setRelatedSkillDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRelatedSkill()}
            />
            <datalist id="related-skill-sugg">
              {RELATED_SKILL_SUGGESTIONS.filter(rs => !relatedSkills.some(s => (s.raw || s.rawLabel || '').toLowerCase() === rs.toLowerCase())).map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <button className="btn-ghost" type="button" onClick={addRelatedSkill}>
            <Plus className="h-4 w-4" /> Add Concept
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-navy-100 pt-3">
          <span className="text-[11.5px] text-navy-400">
            Validated against Pragati's official skill taxonomy. Unrecognized terms will be safely rejected.
          </span>
          <button
            className="btn-primary"
            onClick={saveRelatedSkills}
            disabled={saving === 'relatedSkills'}
          >
            <Save className="h-4 w-4" />
            {saving === 'relatedSkills' ? 'Saving…' : 'Save Related Concepts'}
          </button>
        </div>
      </div>

      {/* 6 · Interests */}
      <div className="card p-5">
        <SectionHeader title="Interests" sub="Which sectors you are drawn to — helps the engine understand you." />
        <div className="flex flex-wrap gap-2">
          {SECTOR_OPTIONS.map(([v, l]) => {
            const on = interests.includes(v);
            return (
              <button key={v} onClick={() => setInterests(x => on ? x.filter(y => y !== v) : [...x, v])}
                className={`chip transition-all ${on ? 'bg-saffron-500 text-white ring-1 ring-saffron-500' : 'bg-white text-navy-600 ring-1 ring-navy-200 hover:bg-navy-50'}`}>
                {on && <CheckCircle2 className="h-3.5 w-3.5" />}{l}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={saveInterests} disabled={saving === 'interests'}><Heart className="h-4 w-4" />{saving === 'interests' ? 'Saving…' : 'Save interests'}</button>
        </div>
      </div>

      {/* 7 · Preferences */}
      <div className="card p-5">
        <SectionHeader title="Opportunity preferences" sub="Your preferences help NextAlloc understand what you value. They do not override eligibility, capacity, or the global allocation." />
        {prefs.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-navy-400">No preferences yet — search for an opportunity to start ranking.</div>
        ) : (
          <div className="space-y-2">
            {prefs.map((x, i) => (
              <div key={x.opportunityId} className="flex items-center gap-3 rounded-xl border border-navy-100 px-4 py-2.5">
                <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-saffron-500 text-[13px] font-bold text-white">{x.rank}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-ink">{x.title}</div>
                  <div className="text-[11.5px] text-navy-400">{x.sector}</div>
                </div>
                <div className="flex gap-1">
                  <button className="btn-ghost btn-sm" title="Move up" onClick={() => movePref(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn-ghost btn-sm" title="Move down" onClick={() => movePref(i, 1)} disabled={i === prefs.length - 1}>↓</button>
                  <button className="btn-ghost btn-sm text-red-500" title="Remove" onClick={() => removePref(x.opportunityId)}><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <input className="input w-full" placeholder="Search an opportunity to add as a preference…" value={oppSearch} onChange={e => searchOpps(e.target.value)} />
        </div>
        {oppSearch.trim() && oppResults.length === 0 && oppNoMatch !== '' && (
          <div className="mt-2 rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-3 text-center text-[12.5px] text-navy-500">
            {oppNoMatch === 'dups'
              ? 'All matching opportunities are already in your preference list.'
              : 'No matching opportunities found. Try a different title or keyword.'}
          </div>
        )}
        {oppResults.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-navy-100">
            {oppResults.map(o => (
              <button key={o.id} onClick={() => addPref(o.id)} className="flex w-full items-center justify-between border-b border-navy-50 px-4 py-2.5 text-left last:border-0 hover:bg-saffron-50/50">
                <span className="text-[13px] font-medium text-navy-700">{o.title}</span>
                <span className="text-[11.5px] text-navy-400">{o.sector} · {o.state}</span>
              </button>
            ))}
          </div>
        )}
        {prefMsg && <div className="mt-2 text-[12.5px] font-medium text-emerald-700">{prefMsg}</div>}
        {prefs.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[12px] text-navy-400">{prefs.length} of {MAX_PREFS} preferences · ranks 1–{prefs.length}</span>
            <button className="btn-primary" onClick={savePrefs} disabled={saving === 'prefs'}><ListOrdered className="h-4 w-4" />{saving === 'prefs' ? 'Saving…' : 'Save preferences'}</button>
          </div>
        )}
      </div>

      {/* 8 · Resume & profile autofill */}
      <div className="card p-5">
        <SectionHeader title="Resume & profile autofill"
          sub="Upload a PDF or Word resume. NextAlloc finds your details and skills — you review every suggestion before anything is saved." />
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/40 py-7 transition hover:border-saffron-300 hover:bg-saffron-50/30">
          <Upload className="h-6 w-6 text-navy-400" />
          <span className="text-[13px] font-semibold text-navy-600">{saving === 'resume' ? 'Uploading…' : 'Choose a file (PDF or DOCX, up to 5 MB)'}</span>
          <span className="text-[11.5px] text-navy-400">Replaces the previous resume — its unreviewed suggestions are discarded.</span>
          <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => onResume(e.target.files?.[0] ?? null)} />
        </label>

        {resume && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy-50/70 px-4 py-3 ring-1 ring-navy-100">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-navy-500" />
                <span className="text-[13px] font-semibold text-ink">{resume.originalName}</span>
                <Badge tone={resume.status === 'REVIEWED' ? 'green' : resume.status === 'PENDING_REVIEW' ? 'amber' : resume.status === 'FAILED' ? 'red' : 'navy'} dot>{resume.status.replace('_', ' ')}</Badge>
              </div>
              <span className="text-[11.5px] text-navy-400">{fmtTime(resume.createdAt)}</span>
            </div>

            {resume.status === 'FAILED' && (
              <Callout tone="danger" title="Could not read this file">
                {resume.statusMessage || 'Please upload a text-based PDF or a Word (.docx) resume.'}
              </Callout>
            )}

            {pendingReview && sugg && (
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl bg-saffron-50/70 p-4 ring-1 ring-saffron-100">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" />
                  <div className="text-[13px] leading-relaxed text-navy-800">
                    <span className="font-bold">Profile information found in your resume.</span>{' '}
                    Blank fields are pre-selected for safe auto-fill. Fields you have already filled are shown as{' '}
                    <span className="font-semibold">proposed updates</span> — nothing is changed until you confirm it here.
                  </div>
                </div>

                {sugg.fields.length > 0 && (
                  <div>
                    <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-navy-500">Profile fields</div>
                    <div className="space-y-2">
                      {sugg.fields.map(f => {
                        const cur = currentValue(p, f.field);
                        const isUpdate = cur !== '';
                        const isQual = f.field === 'qualification';
                        const isStatus = f.field === 'candidateStatus';
                        const shownValue = isQual
                          ? QUALS.find(([v]) => v === f.value)?.[1] ?? f.value
                          : isStatus ? STATUSES.find(([v]) => v === f.value)?.[1] ?? f.value : f.value;
                        return (
                          <div key={f.field} className={`rounded-xl border p-3.5 ${acceptField[f.field] ? 'border-emerald-200 bg-emerald-50/30' : 'border-navy-100'}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[13px] font-bold text-ink">{FIELD_LABELS[f.field] ?? f.field}</span>
                              <div className="flex items-center gap-2">
                                <Badge tone={f.confidence === 'High' ? 'green' : 'amber'}>{f.confidence} confidence</Badge>
                                <button onClick={() => setAcceptField(m => ({ ...m, [f.field]: !m[f.field] }))}
                                  className={`btn-ghost btn-sm ${acceptField[f.field] ? 'text-emerald-600' : 'text-navy-500'}`}>
                                  {acceptField[f.field] ? <><CheckCircle2 className="h-3.5 w-3.5" /> {isUpdate ? 'Use suggested value' : 'Fill in'}</> : <X className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                            <div className="mt-1.5 text-[13px] text-navy-700">
                              {isUpdate ? (<>Current: <span className="font-semibold">{cur}</span> → Suggested: <span className="font-semibold text-emerald-700">{shownValue}</span></>) : shownValue}
                            </div>
                            <div className="mt-1 text-[11.5px] italic text-navy-400">Source: {f.evidence}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sugg.skills.length > 0 && (
                  <div>
                    <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-navy-500">Skills detected</div>
                    <div className="flex flex-wrap gap-2">
                      {sugg.skills.map(s => (
                        <button key={s} onClick={() => setAcceptSkill(m => ({ ...m, [s]: m[s] === false ? true : false }))}
                          className={`chip ring-1 transition ${skills.includes(s) ? 'bg-navy-100/60 text-navy-400 ring-navy-200' : acceptSkill[s] !== false ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-navy-500 ring-navy-200'}`}>
                          {skills.includes(s) ? <><CheckCircle2 className="h-3.5 w-3.5" />{s} (already added)</> : <>{acceptSkill[s] !== false && <CheckCircle2 className="h-3.5 w-3.5" />}{s}</>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sugg.interests.length > 0 && (
                  <div>
                    <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-navy-500">Interests detected</div>
                    <div className="flex flex-wrap gap-2">
                      {sugg.interests.map(s => (
                        <button key={s} onClick={() => setAcceptInterest(m => ({ ...m, [s]: !m[s] }))}
                          className={`chip ring-1 transition ${acceptInterest[s] !== false ? 'bg-saffron-50 text-saffron-700 ring-saffron-200' : 'bg-white text-navy-500 ring-navy-200'}`}>
                          {SECTOR_OPTIONS.find(([v]) => v === s)?.[1] ?? s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sugg.fields.length === 0 && sugg.skills.length === 0 && sugg.interests.length === 0 && (
                  <Callout tone="info">No suggestions were found in this resume. Mark it as reviewed to continue.</Callout>
                )}

                <div className="flex flex-wrap justify-end gap-2 border-t border-navy-100 pt-4">
                  <button className="btn-ghost" disabled={applying} onClick={() => applySuggestions(true)}>
                    <ShieldCheck className="h-4 w-4" /> Dismiss suggestions
                  </button>
                  <button className="btn-primary" disabled={applying} onClick={() => applySuggestions(false)}>
                    <Save className="h-4 w-4" />{applying ? 'Applying…' : 'Apply confirmed suggestions'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
