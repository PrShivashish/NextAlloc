import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  X,
  Save,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Download,
  RefreshCw,
  FileText,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Wrench,
  ListOrdered,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDownload, errMsg } from '../../api/client';
import {
  ResumeSuggestionsView,
  Readiness,
  CandidateAcademicDto,
  CandidateAcademicInput,
  NocEvidenceDto,
  SignatoryRole,
  RelatedSkill,
} from '../../api/types';
import { Callout, Badge, Spinner, Modal, Disclosure, fmtTime, formatEnumLabel } from '../../components/ui';

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

const QUALS = [
  ['HIGHER_SECONDARY', 'Higher Secondary'],
  ['BACHELORS', "Bachelor's Degree"],
  ['POST_GRADUATE', 'Postgraduate'],
  ['DOCTORAL', 'Doctoral'],
];

const STATUSES = [
  ['STUDENT', 'Student'],
  ['GRADUATE', 'Recent graduate'],
  ['WORKING', 'Working professional'],
];

const LOC_TYPES = [
  ['URBAN', 'Urban'],
  ['SEMI_URBAN', 'Semi-urban'],
  ['RURAL', 'Rural'],
];

const STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Gujarat', 'Haryana',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha',
  'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  phone: 'Phone',
  qualification: 'Highest qualification',
  candidateStatus: 'Current status',
  state: 'State',
  district: 'District',
  experienceYears: 'Experience (years)',
  bio: 'About you',
};

const inputCls =
  'min-h-[44px] w-full rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3.5 py-2 text-[16px] text-[var(--na-ink-primary)] placeholder:text-[var(--na-ink-tertiary)] sm:text-[length:var(--na-text-body-sm)]';

const labelCls =
  'mb-1.5 block text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-primary)]';

const primaryBtnCls =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-accent)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] transition-[background-color,opacity] duration-150 hover:bg-[var(--na-accent-hover)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-55';

const secondaryBtnCls =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-stone)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-55';

export default function CandidateProfile() {
  const [p, setP] = useState<any>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<
    { opportunityId: number; rank: number; title: string; sector: string }[]
  >([]);
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
      (o?.content ?? []).forEach((c: any) => {
        titles[c.id] = { title: c.title, sector: c.sector };
      });
      setPrefs(
        (pr ?? [])
          .map((x: any) => ({
            opportunityId: x.opportunityId,
            rank: x.rank,
            title: titles[x.opportunityId]?.title ?? 'Opportunity',
            sector: titles[x.opportunityId]?.sector ?? '',
          }))
          .sort((a: any, b: any) => a.rank - b.rank),
      );
      setResume(rs ?? null);
      setReadiness(rd ?? null);

      if (acad) {
        setAcademic(acad);
        setAcadDraft({
          enrollmentStatus: String(acad.enrollmentStatus || 'ENROLLED_FULL_TIME'),
          degreeProgram: acad.degreeProgram || '',
          institutionName: acad.institutionName || '',
          institutionAisheCode: acad.institutionAisheCode || '',
          currentAcademicYear:
            acad.currentAcademicYear != null ? String(acad.currentAcademicYear) : '',
          programDurationYears:
            acad.programDurationYears != null ? String(acad.programDurationYears) : '',
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
    } catch (e) {
      setErr(errMsg(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (sugg && sugg.resumeId != null && sugg.resumeId !== reviewResumeId) {
      const f: Record<string, boolean> = {};
      for (const field of sugg.fields) {
        const cur = currentValue(p, field.field);
        f[field.field] = cur === '';
      }
      const s: Record<string, boolean> = {};
      for (const sk of sugg.skills) s[sk] = !skills.includes(sk);
      const i: Record<string, boolean> = {};
      for (const it of sugg.interests) i[it] = true;
      setAcceptField(f);
      setAcceptSkill(s);
      setAcceptInterest(i);
      setReviewResumeId(sugg.resumeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugg?.resumeId]);

  const currentValue = (prof: any, field: string): string => {
    if (!prof) return '';
    switch (field) {
      case 'fullName':
        return prof.fullName ?? '';
      case 'phone':
        return prof.phone ?? '';
      case 'qualification':
        return prof.qualification ?? '';
      case 'candidateStatus':
        return prof.candidateStatus ?? '';
      case 'state':
        return prof.state ?? '';
      case 'district':
        return prof.district ?? '';
      case 'experienceYears':
        return (prof.experienceYears ?? 0) ? String(prof.experienceYears) : '';
      case 'bio':
        return prof.bio ?? '';
      default:
        return '';
    }
  };

  const saveBasic = async () => {
    setSaving('basic');
    setMsg('');
    setErr('');
    try {
      await apiPut('/candidates/me/profile', {
        fullName: p.fullName,
        phone: p.phone,
        dob: p.dob,
        state: p.state,
        district: p.district,
        locationType: p.locationType,
        qualification: p.qualification,
        candidateStatus: p.candidateStatus,
        bio: p.bio,
        experienceYears: p.experienceYears === '' ? null : Number(p.experienceYears),
      });
      setMsg('Profile details saved.');
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
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
        currentAcademicYear:
          acadDraft.currentAcademicYear === '' ? null : Number(acadDraft.currentAcademicYear),
        programDurationYears:
          acadDraft.programDurationYears === '' ? null : Number(acadDraft.programDurationYears),
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
        currentAcademicYear:
          updated.currentAcademicYear != null ? String(updated.currentAcademicYear) : '',
        programDurationYears:
          updated.programDurationYears != null ? String(updated.programDurationYears) : '',
        expectedCompletionDate: updated.expectedCompletionDate || '',
      });
      setAcademicMsg(
        `Academic declaration updated (Record v${updated.version}). Status: ${updated.finalYearStatus}.`,
      );
    } catch (e: any) {
      if (e.status === 409) {
        setAcademicConflict(true);
        setAcademicErr(
          'Concurrency Conflict (HTTP 409): The academic record was updated since this page was loaded. Refresh before saving.',
        );
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
        currentAcademicYear:
          fresh.currentAcademicYear != null ? String(fresh.currentAcademicYear) : '',
        programDurationYears:
          fresh.programDurationYears != null ? String(fresh.programDurationYears) : '',
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
      setNocErr(
        'Unsupported file format: NextAlloc accepts only PDF documents (.pdf) for institutional NOCs.',
      );
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (nocFile.size > MAX_SIZE) {
      const sizeMb = (nocFile.size / (1024 * 1024)).toFixed(2);
      setNocErr(
        `File exceeds limit: The selected file is ${sizeMb} MB. Institutional NOC uploads are strictly limited to 5.00 MB.`,
      );
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
      setNocErr('You must declare that the internship does not conflict with regular coursework and exams.');
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
      setNocMsg(
        `Institutional NOC submitted (ID #${res.id}). Status: ${res.verificationStatus}.`,
      );
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
    setSaving('skills');
    setMsg('');
    setErr('');
    try {
      await apiPut('/candidates/me/skills', skills);
      setMsg('Skills updated.');
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setSaving('');
  };

  const saveInterests = async () => {
    setSaving('interests');
    setMsg('');
    setErr('');
    try {
      await apiPut('/candidates/me/interests', interests);
      setMsg('Interests saved.');
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setSaving('');
  };

  const savePrefs = async () => {
    setSaving('prefs');
    setMsg('');
    setErr('');
    try {
      await apiPut(
        '/candidates/me/preferences',
        prefs.map(x => ({ opportunityId: x.opportunityId, rank: x.rank })),
      );
      setMsg('Preferences saved.');
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
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
    const exists = relatedSkills.some(
      s => (s.raw || s.rawLabel || '').toLowerCase() === v.toLowerCase(),
    );
    if (!exists) {
      setRelatedSkills(prev => [
        ...prev,
        {
          raw: v,
          rawLabel: v,
          conceptId: 'CUSTOM',
          relatedCanonical: 'General',
          relationshipType: 'DECLARED',
          claimSource: 'SELF_DECLARED',
          evidenceStatus: 'UNVERIFIED',
        },
      ]);
    }
    setRelatedSkillDraft('');
  };

  const removeRelatedSkill = (idx: number) => {
    setRelatedSkills(prev => prev.filter((_, i) => i !== idx));
  };

  const saveRelatedSkills = async () => {
    setSaving('relatedSkills');
    setMsg('');
    setErr('');
    try {
      const payload = relatedSkills.map(s => s.raw || s.rawLabel || '').filter(Boolean);
      const res = await apiPut<RelatedSkill[]>('/candidates/me/related-skills', payload);
      setRelatedSkills(res);
      setMsg('Related concepts and frameworks saved.');
    } catch (e) {
      setErr(errMsg(e));
    }
    setSaving('');
  };

  const MAX_PREFS = 10;

  const flashPrefMsg = (m: string) => {
    setPrefMsg(m);
    window.clearTimeout(prefMsgTimer.current);
    prefMsgTimer.current = window.setTimeout(() => setPrefMsg(''), 3000);
  };

  const searchOpps = async (term: string) => {
    setOppSearch(term);
    if (!term.trim()) {
      setOppResults([]);
      setOppNoMatch('');
      return;
    }
    const seq = ++searchSeq.current;
    try {
      const d = await apiGet<any>('/opportunities', {
        page: 0,
        size: 6,
        q: term,
        availableOnly: true,
      });
      if (seq !== searchSeq.current) return;
      const all = d.content ?? [];
      const fresh = all.filter((o: any) => !prefs.some(x => x.opportunityId === o.id));
      setOppResults(fresh);
      setOppNoMatch(all.length === 0 ? 'none' : fresh.length === 0 ? 'dups' : '');
    } catch {
      if (seq === searchSeq.current) {
        setOppResults([]);
        setOppNoMatch('none');
      }
    }
  };

  const addPref = (id: number) => {
    if (prefs.some(x => x.opportunityId === id)) {
      flashPrefMsg('That opportunity is already in your list.');
      return;
    }
    if (prefs.length >= MAX_PREFS) {
      flashPrefMsg(`You can rank at most ${MAX_PREFS} opportunities.`);
      return;
    }
    const o = oppResults.find(x => x.id === id);
    const rank = prefs.length + 1;
    setPrefs(ps => [
      ...ps,
      {
        opportunityId: id,
        rank: ps.length + 1,
        title: o?.title ?? 'Opportunity',
        sector: o?.sector ?? '',
      },
    ]);
    setOppResults([]);
    setOppSearch('');
    setOppNoMatch('');
    flashPrefMsg(`Added "${o?.title ?? 'Opportunity'}" as preference #${rank}.`);
  };

  const removePref = (id: number) => {
    const x = prefs.find(y => y.opportunityId === id);
    setPrefs(ps =>
      ps.filter(y => y.opportunityId !== id).map((y, k) => ({ ...y, rank: k + 1 })),
    );
    flashPrefMsg(`Removed "${x?.title ?? 'Opportunity'}". Ranks updated.`);
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
    setSaving('resume');
    setErr('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await apiPost<any>('/candidates/me/resume', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      } as any);
      setResume(r);
      if (r.status === 'PENDING_REVIEW') {
        setMsg(
          `Resume uploaded. ${r.pendingSkills?.length ?? 0} skills and profile suggestions found. Review them below.`,
        );
      } else if (r.status === 'REVIEWED') {
        setMsg('Resume uploaded. No suggestions needed review.');
      }
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setSaving('');
  };

  const applySuggestions = async (ignoreAll: boolean) => {
    if (!sugg) return;
    setApplying(true);
    setErr('');
    setMsg('');
    try {
      const profile: Record<string, string> = {};
      if (!ignoreAll) {
        for (const f of sugg.fields) {
          if (acceptField[f.field]) profile[f.field] = f.value;
        }
      }
      const skillsSel = ignoreAll ? [] : sugg.skills.filter(s => acceptSkill[s] !== false);
      const interestsSel = ignoreAll
        ? []
        : sugg.interests.filter(s => acceptInterest[s] !== false);
      const r = await apiPost<any>('/candidates/me/resume/apply-suggestions', {
        resumeId: sugg.resumeId,
        profile,
        skills: skillsSel,
        interests: interestsSel,
      });
      setResume(r);
      setSugg(null);
      setReviewResumeId(null);
      setMsg(
        ignoreAll
          ? 'Suggestions dismissed. Resume marked as reviewed.'
          : 'Confirmed suggestions saved to your profile.',
      );
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setApplying(false);
  };

  const skillOptions = useMemo(() => SKILL_SUGGESTIONS.filter(s => !skills.includes(s)), [skills]);

  if (!p) {
    return (
      <div className="space-y-4">
        {err && <Callout tone="danger">{err}</Callout>}
        {!err && <Spinner label="Loading your profile…" />}
      </div>
    );
  }

  const upd = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const pendingReview = resume?.status === 'PENDING_REVIEW' && sugg;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-[var(--na-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[length:var(--na-text-h1)] font-semibold leading-[var(--na-leading-tight)] text-[var(--na-ink-primary)]">
            Your profile
          </h1>
          <p className="mt-1.5 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
            Keep your personal details, academic declaration, institutional NOC, skills, and preferences current.
          </p>
        </div>

        {readiness && (
          <div className="flex items-baseline gap-3 self-start rounded-[var(--na-radius-md)] bg-[var(--na-stone)] px-4 py-2.5 sm:self-auto">
            <span className="text-[length:var(--na-text-h2)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
              {readiness.overall}%
            </span>
            <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              Profile readiness
            </span>
          </div>
        )}
      </header>

      {err && <Callout tone="warn">{err}</Callout>}
      {msg && <Callout tone="success">{msg}</Callout>}

      {/* Quick jump navigation for long profile page */}
      <nav
        aria-label="Profile sections"
        className="flex flex-wrap gap-1.5 border-b border-[var(--na-border)] pb-3"
      >
        {[
          ['#personal-section', 'Personal info'],
          ['#academic-section', 'Academic declaration'],
          ['#noc-section', 'Institutional NOC'],
          ['#skills-section', 'Skills profile'],
          ['#resume-section', 'Resume'],
          ['#preferences-section', 'Preferences'],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-[var(--na-radius-sm)] bg-[var(--na-well)] px-3 py-1.5 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)] transition-colors hover:bg-[var(--na-stone)] hover:text-[var(--na-ink-primary)]"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* 1. Personal information */}
      <section
        id="personal-section"
        aria-label="Personal information"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
          Personal information
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="prof-fullname" className={labelCls}>
              Full name
            </label>
            <input
              id="prof-fullname"
              className={inputCls}
              value={p.fullName ?? ''}
              onChange={e => upd('fullName', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="prof-phone" className={labelCls}>
              Phone
            </label>
            <input
              id="prof-phone"
              className={inputCls}
              value={p.phone ?? ''}
              onChange={e => upd('phone', e.target.value)}
              placeholder="+91…"
            />
          </div>
          <div>
            <label htmlFor="prof-dob" className={labelCls}>
              Date of birth
            </label>
            <input
              id="prof-dob"
              className={inputCls}
              type="date"
              value={p.dob ?? ''}
              onChange={e => upd('dob', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="prof-state" className={labelCls}>
              State
            </label>
            <select
              id="prof-state"
              className={inputCls}
              value={p.state ?? ''}
              onChange={e => upd('state', e.target.value)}
            >
              <option value="">Select…</option>
              {STATES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prof-district" className={labelCls}>
              District
            </label>
            <input
              id="prof-district"
              className={inputCls}
              value={p.district ?? ''}
              onChange={e => upd('district', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="prof-loctype" className={labelCls}>
              Location type
            </label>
            <select
              id="prof-loctype"
              className={inputCls}
              value={p.locationType ?? ''}
              onChange={e => upd('locationType', e.target.value)}
            >
              <option value="">Select…</option>
              {LOC_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t border-[var(--na-border)] pt-4">
          <button
            type="button"
            className={primaryBtnCls}
            onClick={saveBasic}
            disabled={saving === 'basic'}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{saving === 'basic' ? 'Saving…' : 'Save details'}</span>
          </button>
        </div>
      </section>

      {/* 2. Academic enrollment declaration (Gate 2) */}
      <section
        id="academic-section"
        aria-label="Academic enrollment declaration"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
              Academic enrollment declaration
            </h2>
            <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              Declare your institution, degree program, and academic year. Verified final-year standing is granted by an administrator after reviewing your NOC.
            </p>
          </div>
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
          >
            {formatEnumLabel(academic?.finalYearStatus ?? 'UNVERIFIED')}
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          {academicErr && <Callout tone="danger">{academicErr}</Callout>}
          {academicMsg && <Callout tone="success">{academicMsg}</Callout>}

          {academicConflict && (
            <div className="rounded-[var(--na-radius-md)] border border-[var(--na-status-warning-border)] bg-[var(--na-status-warning-bg)] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--na-status-warning-text)]"
                  aria-hidden="true"
                />
                <div className="space-y-2">
                  <div className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-status-warning-text)]">
                    Academic Concurrency Conflict (HTTP 409)
                  </div>
                  <p className="text-[length:var(--na-text-caption)] text-[var(--na-ink-primary)]">
                    Your academic record was updated on the server since this page loaded. Refresh to view the latest record before making edits.
                  </p>
                  <button type="button" onClick={refreshAcademic} className={secondaryBtnCls}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    <span>Refresh latest record</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="acad-enrollment" className={labelCls}>
              Enrollment status
            </label>
            <select
              id="acad-enrollment"
              className={inputCls}
              value={acadDraft.enrollmentStatus}
              onChange={e => setAcadDraft(d => ({ ...d, enrollmentStatus: e.target.value }))}
            >
              {ENROLLMENT_OPTIONS.map(([val, lbl]) => (
                <option key={val} value={val}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="acad-institution" className={labelCls}>
              Institution name
            </label>
            <input
              id="acad-institution"
              className={inputCls}
              value={acadDraft.institutionName}
              onChange={e => setAcadDraft(d => ({ ...d, institutionName: e.target.value }))}
              placeholder="e.g. National Institute of Technology"
            />
          </div>
          <div>
            <label htmlFor="acad-aishe" className={labelCls}>
              Institution AISHE code
            </label>
            <input
              id="acad-aishe"
              className={inputCls}
              value={acadDraft.institutionAisheCode}
              onChange={e => setAcadDraft(d => ({ ...d, institutionAisheCode: e.target.value }))}
              placeholder="e.g. U-12345"
            />
          </div>
          <div>
            <label htmlFor="acad-degree" className={labelCls}>
              Degree program
            </label>
            <input
              id="acad-degree"
              className={inputCls}
              value={acadDraft.degreeProgram}
              onChange={e => setAcadDraft(d => ({ ...d, degreeProgram: e.target.value }))}
              placeholder="e.g. B.Tech Computer Science"
            />
          </div>
          <div>
            <label htmlFor="acad-year" className={labelCls}>
              Current academic year
            </label>
            <input
              id="acad-year"
              className={inputCls}
              type="number"
              min="1"
              max="10"
              value={acadDraft.currentAcademicYear}
              onChange={e => setAcadDraft(d => ({ ...d, currentAcademicYear: e.target.value }))}
              placeholder="e.g. 4"
            />
          </div>
          <div>
            <label htmlFor="acad-duration" className={labelCls}>
              Program duration (years)
            </label>
            <input
              id="acad-duration"
              className={inputCls}
              type="number"
              min="1"
              max="10"
              value={acadDraft.programDurationYears}
              onChange={e => setAcadDraft(d => ({ ...d, programDurationYears: e.target.value }))}
              placeholder="e.g. 4"
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="acad-completion" className={labelCls}>
              Expected completion date
            </label>
            <input
              id="acad-completion"
              className={`${inputCls} max-w-xs`}
              type="date"
              value={acadDraft.expectedCompletionDate}
              onChange={e =>
                setAcadDraft(d => ({ ...d, expectedCompletionDate: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--na-border)] pt-4">
          <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
            {academic ? `Record v${academic.version}. ` : ''}
            Editing institution, AISHE, year, or completion date requires re-verification.
          </span>
          <button
            type="button"
            className={primaryBtnCls}
            onClick={saveAcademic}
            disabled={savingAcademic}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{savingAcademic ? 'Saving…' : 'Save academic declaration'}</span>
          </button>
        </div>
      </section>

      {/* 3. Institutional NOC (Gate 3) */}
      <section
        id="noc-section"
        aria-label="Institutional No Objection Certificate"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
              Institutional No Objection Certificate (NOC)
            </h2>
            <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              Upload a signed certificate from your college authority confirming there is no conflict with classes or exams.
            </p>
          </div>
          {noc && (
            <Badge
              tone={
                noc.verificationStatus === 'VERIFIED'
                  ? 'green'
                  : noc.verificationStatus === 'REJECTED'
                    ? 'red'
                    : 'amber'
              }
            >
              {formatEnumLabel(noc.verificationStatus)}
            </Badge>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {nocErr && <Callout tone="danger">{nocErr}</Callout>}
          {nocMsg && <Callout tone="success">{nocMsg}</Callout>}
        </div>

        {noc ? (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 divide-y divide-[var(--na-border)] border-y border-[var(--na-border)] sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              <div className="py-3 lg:pr-4">
                <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  Issuing institution
                </div>
                <div className="mt-1 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                  {noc.issuingInstitution}
                </div>
              </div>
              <div className="py-3 lg:px-4">
                <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  Signatory authority
                </div>
                <div className="mt-1 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                  {noc.signatoryName} ({formatEnumLabel(noc.signatoryRole)})
                </div>
                <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  {noc.signatoryEmail}
                </div>
              </div>
              <div className="py-3 lg:px-4">
                <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  Validity period
                </div>
                <div className="mt-1 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] tabular-nums">
                  {noc.validFrom || '—'} to {noc.validUntil || '—'}
                </div>
              </div>
              <div className="py-3 lg:pl-4">
                <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  Conflict certification
                </div>
                <div
                  className="mt-1 text-[length:var(--na-text-body-sm)] font-medium"
                  style={{
                    color: noc.declaresNoAcademicConflict
                      ? 'var(--na-status-success-text)'
                      : 'var(--na-status-error-text)',
                  }}
                >
                  {noc.declaresNoAcademicConflict ? 'Certified no conflict' : 'Conflict declared'}
                </div>
              </div>
            </div>

            {noc.verificationStatus === 'REJECTED' && (
              <Callout tone="danger" title="Rejection feedback:">
                <span>
                  {noc.rejectionReasonCode || 'General rejection'}
                  {noc.rejectionNotes ? ` — ${noc.rejectionNotes}` : ''}
                </span>
              </Callout>
            )}

            {noc.verificationStatus === 'PENDING_ADDITIONAL_INFO' && (
              <Callout tone="warn" title="Clarification requested:">
                <span>
                  {noc.rejectionNotes ||
                    'Please upload an updated document clarifying dates or signatory authority.'}
                </span>
              </Callout>
            )}

            <Disclosure label="View submission metadata">
              <div className="space-y-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
                <div>
                  Evidence ID #{noc.id}, Version v{noc.version}
                </div>
                <div className="font-[family-name:var(--na-font-mono)]">
                  SHA-256: {noc.documentSha256 || '—'}
                </div>
              </div>
            </Disclosure>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--na-border)] pt-4">
              <button type="button" onClick={downloadMyNoc} className={secondaryBtnCls}>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download submitted PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNocModal(true)}
                className={primaryBtnCls}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>Replace NOC</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--na-radius-md)] bg-[var(--na-well)] px-6 py-8 text-center">
            <FileText
              className="mx-auto h-7 w-7 text-[var(--na-ink-tertiary)]"
              aria-hidden="true"
            />
            <div className="mt-2 text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
              No institutional NOC on file
            </div>
            <p className="mx-auto mt-1 max-w-md text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              Upload a signed PDF from your Dean, Principal, or Head of Department.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowNocModal(true)}
                className={primaryBtnCls}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>Upload NOC (PDF)</span>
              </button>
            </div>
          </div>
        )}

        <Modal
          open={showNocModal}
          onClose={() => setShowNocModal(false)}
          title="Upload institutional NOC"
        >
          <form onSubmit={submitNoc} className="space-y-4">
            <p className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              PDF format only, maximum file size 5.00 MB.
            </p>
            <div>
              <label htmlFor="noc-file" className={labelCls}>
                NOC document (PDF, max 5 MB)
              </label>
              <input
                id="noc-file"
                type="file"
                accept=".pdf,application/pdf"
                className={inputCls}
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 5 * 1024 * 1024) {
                    setNocErr(
                      `File exceeds limit: ${(f.size / (1024 * 1024)).toFixed(2)} MB exceeds 5 MB.`,
                    );
                    setNocFile(null);
                  } else {
                    setNocErr('');
                    setNocFile(f);
                  }
                }}
              />
              {nocFile && (
                <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-status-success-text)] tabular-nums">
                  Selected: {nocFile.name} ({(nocFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="noc-inst" className={labelCls}>
                  Issuing institution
                </label>
                <input
                  id="noc-inst"
                  className={inputCls}
                  value={nocIssuingInst}
                  onChange={e => setNocIssuingInst(e.target.value)}
                  placeholder="e.g. National Institute of Tech"
                  required
                />
              </div>
              <div>
                <label htmlFor="noc-role" className={labelCls}>
                  Signatory role
                </label>
                <select
                  id="noc-role"
                  className={inputCls}
                  value={nocSignatoryRole}
                  onChange={e => setNocSignatoryRole(e.target.value as SignatoryRole)}
                >
                  {SIGNATORY_ROLES.map(([val, lbl]) => (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="noc-sig-name" className={labelCls}>
                  Signatory authority name
                </label>
                <input
                  id="noc-sig-name"
                  className={inputCls}
                  value={nocSignatoryName}
                  onChange={e => setNocSignatoryName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  required
                />
              </div>
              <div>
                <label htmlFor="noc-sig-email" className={labelCls}>
                  Signatory official email
                </label>
                <input
                  id="noc-sig-email"
                  className={inputCls}
                  type="email"
                  value={nocSignatoryEmail}
                  onChange={e => setNocSignatoryEmail(e.target.value)}
                  placeholder="e.g. dean@college.edu.in"
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="noc-valid-from" className={labelCls}>
                  Validity start date
                </label>
                <input
                  id="noc-valid-from"
                  className={inputCls}
                  type="date"
                  value={nocValidFrom}
                  onChange={e => setNocValidFrom(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="noc-valid-until" className={labelCls}>
                  Validity end date
                </label>
                <input
                  id="noc-valid-until"
                  className={inputCls}
                  type="date"
                  value={nocValidUntil}
                  onChange={e => setNocValidUntil(e.target.value)}
                  required
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3 text-[length:var(--na-text-caption)] text-[var(--na-ink-primary)]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--na-accent)]"
                checked={nocNoConflict}
                onChange={e => setNocNoConflict(e.target.checked)}
                required
              />
              <span>
                <strong>No Academic Conflict Declaration:</strong> I certify that participation in
                this internship does not conflict with mandatory coursework or exams.
              </span>
            </label>

            <div className="flex justify-end gap-2 border-t border-[var(--na-border)] pt-4">
              <button
                type="button"
                onClick={() => setShowNocModal(false)}
                className={secondaryBtnCls}
                disabled={savingNoc}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={primaryBtnCls}
                disabled={savingNoc || !nocFile || !nocNoConflict}
              >
                {savingNoc ? 'Uploading…' : 'Submit certificate'}
              </button>
            </div>
          </form>
        </Modal>
      </section>

      {/* 4. Education & experience */}
      <section
        aria-label="Education and experience"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
          Education & experience
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="prof-qual" className={labelCls}>
              Highest qualification
            </label>
            <select
              id="prof-qual"
              className={inputCls}
              value={p.qualification ?? ''}
              onChange={e => upd('qualification', e.target.value)}
            >
              <option value="">Select…</option>
              {QUALS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prof-status" className={labelCls}>
              Current status
            </label>
            <select
              id="prof-status"
              className={inputCls}
              value={p.candidateStatus ?? ''}
              onChange={e => upd('candidateStatus', e.target.value)}
            >
              <option value="">Select…</option>
              {STATUSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prof-exp" className={labelCls}>
              Experience (years)
            </label>
            <input
              id="prof-exp"
              className={inputCls}
              type="number"
              min={0}
              max={40}
              step={0.5}
              value={p.experienceYears ?? 0}
              onChange={e => upd('experienceYears', e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="prof-bio" className={labelCls}>
              About you
            </label>
            <textarea
              id="prof-bio"
              className={`${inputCls} min-h-[80px]`}
              value={p.bio ?? ''}
              onChange={e => upd('bio', e.target.value)}
              placeholder="Your focus, projects, and what you are looking for."
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t border-[var(--na-border)] pt-4">
          <button
            type="button"
            className={primaryBtnCls}
            onClick={saveBasic}
            disabled={saving === 'basic'}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{saving === 'basic' ? 'Saving…' : 'Save details'}</span>
          </button>
        </div>
      </section>

      {/* 5. Skills & Related Concepts */}
      <section
        id="skills-section"
        aria-label="Skills and related frameworks"
        className="space-y-6 rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <div>
          <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
            Skills
          </h2>
          <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
            Recognised skills count toward eligibility and suitability scoring.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.map(s => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-[var(--na-radius-sm)] bg-[var(--na-well)] px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-primary)]"
              >
                <span>{s}</span>
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() => setSkills(x => x.filter(y => y !== s))}
                  className="rounded p-0.5 text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--na-accent)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            {skills.length === 0 && (
              <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                No skills added yet.
              </span>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              aria-label="Add skill"
              className={inputCls}
              list="skill-sugg"
              placeholder="Add a skill…"
              value={skillDraft}
              onChange={e => setSkillDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSkill()}
            />
            <datalist id="skill-sugg">
              {skillOptions.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button type="button" className={secondaryBtnCls} onClick={addSkill}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className={primaryBtnCls}
              onClick={saveSkills}
              disabled={saving === 'skills'}
            >
              <Wrench className="h-4 w-4" aria-hidden="true" />
              <span>{saving === 'skills' ? 'Saving…' : 'Save skills'}</span>
            </button>
          </div>
        </div>

        <hr className="na-divider" />

        <div>
          <h3 className="text-[length:var(--na-text-h4)] font-semibold text-[var(--na-ink-primary)]">
            Related concepts & frameworks
          </h3>
          <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
            Add specialized tools and frameworks (for example Spring Boot, PyTorch, Docker, FastAPI) validated against the NextAlloc taxonomy.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {relatedSkills.map((s, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-[var(--na-radius-sm)] bg-[var(--na-accent-subtle)] px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-accent-ink)]"
              >
                <span>{s.raw || s.rawLabel}</span>
                {s.relatedCanonical && (
                  <span className="inline-flex items-center gap-1 font-normal text-[var(--na-ink-secondary)]">
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    <span>
                      {s.relatedCanonical} ({s.relationshipType})
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${s.raw || s.rawLabel}`}
                  onClick={() => removeRelatedSkill(idx)}
                  className="rounded p-0.5 text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--na-accent)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            {relatedSkills.length === 0 && (
              <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                No related concepts recorded yet.
              </span>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              aria-label="Add related framework or tool"
              className={inputCls}
              list="related-skill-sugg"
              placeholder="Add related framework or tool…"
              value={relatedSkillDraft}
              onChange={e => setRelatedSkillDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRelatedSkill()}
            />
            <datalist id="related-skill-sugg">
              {RELATED_SKILL_SUGGESTIONS.filter(
                rs =>
                  !relatedSkills.some(
                    s => (s.raw || s.rawLabel || '').toLowerCase() === rs.toLowerCase(),
                  ),
              ).map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button type="button" className={secondaryBtnCls} onClick={addRelatedSkill}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className={primaryBtnCls}
              onClick={saveRelatedSkills}
              disabled={saving === 'relatedSkills'}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>
                {saving === 'relatedSkills' ? 'Saving…' : 'Save related concepts'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 6. Interests */}
      <section
        aria-label="Sector interests"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
          Sector interests
        </h2>
        <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
          Select sectors you are most interested in.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SECTOR_OPTIONS.map(([v, l]) => {
            const on = interests.includes(v);
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => setInterests(x => (on ? x.filter(y => y !== v) : [...x, v]))}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--na-radius-md)] border px-3 py-1.5 text-[length:var(--na-text-caption)] font-medium transition-colors duration-150 active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] ${
                  on
                    ? 'border-[var(--na-accent)] bg-[var(--na-accent-subtle)] text-[var(--na-accent-ink)]'
                    : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-stone)]'
                }`}
              >
                {on && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{l}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end border-t border-[var(--na-border)] pt-4">
          <button
            type="button"
            className={primaryBtnCls}
            onClick={saveInterests}
            disabled={saving === 'interests'}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{saving === 'interests' ? 'Saving…' : 'Save interests'}</span>
          </button>
        </div>
      </section>

      {/* 7. Opportunity preferences */}
      <section
        id="preferences-section"
        aria-label="Opportunity preferences"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
          Opportunity preferences
        </h2>
        <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
          Rank up to {MAX_PREFS} opportunities. Preferences inform matching alongside eligibility and seat capacity.
        </p>

        {prefs.length === 0 ? (
          <p className="mt-4 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
            No preferences added yet. Search below to rank opportunities.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--na-border)] border-y border-[var(--na-border)]">
            {prefs.map((x, i) => (
              <li key={x.opportunityId} className="flex items-center gap-3 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--na-radius-sm)] bg-[var(--na-anchor)] text-[length:var(--na-text-caption)] font-semibold text-[var(--na-anchor-ink)] tabular-nums">
                  {x.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                    {x.title}
                  </div>
                  <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                    {x.sector}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${x.title} up`}
                    onClick={() => movePref(i, -1)}
                    disabled={i === 0}
                    className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--na-radius-sm)] border border-[var(--na-border)] text-[var(--na-ink-primary)] hover:bg-[var(--na-stone)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--na-accent)]"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${x.title} down`}
                    onClick={() => movePref(i, 1)}
                    disabled={i === prefs.length - 1}
                    className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--na-radius-sm)] border border-[var(--na-border)] text-[var(--na-ink-primary)] hover:bg-[var(--na-stone)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--na-accent)]"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${x.title}`}
                    onClick={() => removePref(x.opportunityId)}
                    className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--na-radius-sm)] border border-[var(--na-border)] text-[var(--na-status-error-text)] hover:bg-[var(--na-status-error-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--na-accent)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <input
            aria-label="Search opportunities to rank"
            className={inputCls}
            placeholder="Search an opportunity to add as a preference…"
            value={oppSearch}
            onChange={e => searchOpps(e.target.value)}
          />
        </div>

        {oppSearch.trim() && oppResults.length === 0 && oppNoMatch !== '' && (
          <p className="mt-2 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
            {oppNoMatch === 'dups'
              ? 'All matching opportunities are already in your preference list.'
              : 'No matching opportunities found.'}
          </p>
        )}

        {oppResults.length > 0 && (
          <div className="mt-2 divide-y divide-[var(--na-border)] rounded-[var(--na-radius-md)] border border-[var(--na-border)] bg-[var(--na-surface)]">
            {oppResults.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => addPref(o.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--na-well)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--na-accent)]"
              >
                <span className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                  {o.title}
                </span>
                <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  {o.sector}, {o.state}
                </span>
              </button>
            ))}
          </div>
        )}

        {prefMsg && (
          <p className="mt-2 text-[length:var(--na-text-caption)] font-medium text-[var(--na-status-success-text)]">
            {prefMsg}
          </p>
        )}

        {prefs.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--na-border)] pt-4">
            <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
              {prefs.length} of {MAX_PREFS} preferences ranked
            </span>
            <button
              type="button"
              className={primaryBtnCls}
              onClick={savePrefs}
              disabled={saving === 'prefs'}
            >
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
              <span>{saving === 'prefs' ? 'Saving…' : 'Save preferences'}</span>
            </button>
          </div>
        )}
      </section>

      {/* 8. Resume & profile autofill */}
      <section
        id="resume-section"
        aria-label="Resume and profile autofill"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
          Resume & profile autofill
        </h2>
        <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
          Upload a PDF or Word resume. Review every extracted suggestion before saving.
        </p>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--na-radius-md)] border border-dashed border-[var(--na-border-strong)] bg-[var(--na-well)] py-7 transition-colors duration-150 hover:bg-[var(--na-stone)]">
          <Upload className="h-5 w-5 text-[var(--na-ink-secondary)]" aria-hidden="true" />
          <span className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
            {saving === 'resume' ? 'Uploading…' : 'Choose a file (PDF or DOCX, up to 5 MB)'}
          </span>
          <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
            Uploading replaces the previous resume.
          </span>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={e => onResume(e.target.files?.[0] ?? null)}
          />
        </label>

        {resume && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-well)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <FileText className="h-4 w-4 text-[var(--na-ink-secondary)]" aria-hidden="true" />
                <span className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                  {resume.originalName}
                </span>
                <Badge
                  tone={
                    resume.status === 'REVIEWED'
                      ? 'green'
                      : resume.status === 'PENDING_REVIEW'
                        ? 'amber'
                        : resume.status === 'FAILED'
                          ? 'red'
                          : 'navy'
                  }
                >
                  {resume.status.replace('_', ' ')}
                </Badge>
              </div>
              <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
                {fmtTime(resume.createdAt)}
              </span>
            </div>

            {resume.status === 'FAILED' && (
              <Callout tone="danger" title="Could not read this file">
                {resume.statusMessage || 'Please upload a text-based PDF or Word (.docx) resume.'}
              </Callout>
            )}

            {pendingReview && sugg && (
              <div className="space-y-5 border-t border-[var(--na-border)] pt-4">
                <Callout tone="info" title="Suggestions found in your resume:">
                  Blank fields are pre-selected. Existing profile fields require your confirmation.
                </Callout>

                {sugg.fields.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                      Profile fields
                    </h3>
                    <ul className="divide-y divide-[var(--na-border)] border-y border-[var(--na-border)]">
                      {sugg.fields.map(f => {
                        const cur = currentValue(p, f.field);
                        const isUpdate = cur !== '';
                        const isQual = f.field === 'qualification';
                        const isStatus = f.field === 'candidateStatus';
                        const shownValue = isQual
                          ? QUALS.find(([v]) => v === f.value)?.[1] ?? f.value
                          : isStatus
                            ? STATUSES.find(([v]) => v === f.value)?.[1] ?? f.value
                            : f.value;
                        return (
                          <li key={f.field} className="py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                                {FIELD_LABELS[f.field] ?? f.field}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge tone={f.confidence === 'High' ? 'green' : 'amber'}>
                                  {f.confidence} confidence
                                </Badge>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAcceptField(m => ({ ...m, [f.field]: !m[f.field] }))
                                  }
                                  className={secondaryBtnCls}
                                >
                                  {acceptField[f.field]
                                    ? isUpdate
                                      ? 'Selected'
                                      : 'Fill in'
                                    : 'Skip'}
                                </button>
                              </div>
                            </div>
                            <div className="mt-1 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-primary)]">
                              {isUpdate ? (
                                <span>
                                  Current: {cur}{' '}
                                  <ArrowRight className="mx-1 inline h-3.5 w-3.5" aria-hidden="true" />{' '}
                                  Suggested: <strong>{shownValue}</strong>
                                </span>
                              ) : (
                                shownValue
                              )}
                            </div>
                            <div className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                              Source: {f.evidence}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {sugg.skills.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                      Skills detected
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {sugg.skills.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setAcceptSkill(m => ({ ...m, [s]: m[s] === false ? true : false }))
                          }
                          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--na-radius-sm)] border px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--na-accent)] ${
                            skills.includes(s)
                              ? 'border-[var(--na-border)] bg-[var(--na-well)] text-[var(--na-ink-secondary)]'
                              : acceptSkill[s] !== false
                                ? 'border-[var(--na-status-success-border)] bg-[var(--na-status-success-bg)] text-[var(--na-status-success-text)]'
                                : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-secondary)]'
                          }`}
                        >
                          {skills.includes(s) ? `${s} (added)` : s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sugg.interests.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                      Interests detected
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {sugg.interests.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setAcceptInterest(m => ({ ...m, [s]: !m[s] }))}
                          className={`inline-flex min-h-[36px] items-center rounded-[var(--na-radius-sm)] border px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--na-accent)] ${
                            acceptInterest[s] !== false
                              ? 'border-[var(--na-accent)] bg-[var(--na-accent-subtle)] text-[var(--na-accent-ink)]'
                              : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-secondary)]'
                          }`}
                        >
                          {SECTOR_OPTIONS.find(([v]) => v === s)?.[1] ?? s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sugg.fields.length === 0 &&
                  sugg.skills.length === 0 &&
                  sugg.interests.length === 0 && (
                    <Callout tone="info">
                      No suggestions were found in this resume. Mark it as reviewed to continue.
                    </Callout>
                  )}

                <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--na-border)] pt-4">
                  <button
                    type="button"
                    className={secondaryBtnCls}
                    disabled={applying}
                    onClick={() => applySuggestions(true)}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Dismiss suggestions</span>
                  </button>
                  <button
                    type="button"
                    className={primaryBtnCls}
                    disabled={applying}
                    onClick={() => applySuggestions(false)}
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    <span>{applying ? 'Applying…' : 'Apply confirmed suggestions'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
