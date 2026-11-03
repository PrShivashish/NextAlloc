// client/src/pages/CompanyPortal.tsx
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { CompanyDashboard } from "@/components/CompanyDashboard";
import { ShortlistPanel } from "@/components/ShortlistPanel";
import { OnboardingSection } from "@/components/OnboardingSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LogoutButton from "@/components/LogoutButton";
import { LayoutDashboard, Users, FileText, Settings as SettingsIcon, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { CompanyRegistration, CompanyRegistrationShape } from "@/components/CompanyRegistration";
import { Button } from "@/components/ui/button";
import { useSelectedCandidates } from "@/components/SelectedCandidates";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#f43f5e", "#10b981", "#a78bfa", "#f59e0b"];

/* --- AllocationsTab Component --- */
function AllocationsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllocations() {
      try {
        const res = await fetch("/api/company/allocations", { credentials: "include" });

        // Check if we got HTML instead of JSON (usually means server needs restart)
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("Server returned HTML instead of JSON. Please restart the server to load new routes.");
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`API error ${res.status}: ${errText}`);
        }

        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAllocations();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading allocations...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium">Error loading allocations</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const { allocations = [], internships = [], summary = {} } = data || {};

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Your Internships</p>
            <p className="text-3xl font-bold text-primary">{summary.totalInternships || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Total Capacity</p>
            <p className="text-3xl font-bold text-blue-600">{summary.totalCapacity || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Students Allocated</p>
            <p className="text-3xl font-bold text-green-600">{summary.allocatedStudents || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Allocated Students Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Allocated Candidates
          </CardTitle>
          <CardDescription>
            Students matched to your internships by the ML allocation system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allocations.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student ID</th>
                    <th className="px-4 py-3 font-medium">Internship</th>
                    <th className="px-4 py-3 font-medium">Pref Rank</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">GPA</th>
                    <th className="px-4 py-3 font-medium">Skills</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allocations.map((alloc: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">{alloc.student_id}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{alloc.internship_id}</td>
                      <td className="px-4 py-3">
                        <Badge variant={alloc.pref_rank === 1 ? "default" : "secondary"}>
                          #{alloc.pref_rank || "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{alloc.studentDetails?.name || "—"}</td>
                      <td className="px-4 py-3">{alloc.studentDetails?.gpa?.toFixed(1) || "—"}</td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        {alloc.studentDetails?.skills || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{alloc.studentDetails?.reservation || "GEN"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/10">
              <Users className="h-12 w-12 opacity-30 mb-4" />
              <p className="font-medium">No Allocations Yet</p>
              <p className="text-sm mt-1">
                {internships.length > 0
                  ? "The allocation round hasn't run yet, or no students matched your internships."
                  : "You haven't posted any internships yet."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Internships Overview */}
      {internships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Internships</CardTitle>
            <CardDescription>Quick overview of your posted internship positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {internships.map((int: any, idx: number) => {
                const allocated = allocations.filter((a: any) => a.internship_id === int.internshipId).length;
                return (
                  <div key={idx} className="p-4 border rounded-lg bg-muted/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-medium">{int.internshipId}</span>
                      <Badge variant={allocated > 0 ? "default" : "secondary"}>
                        {allocated} / {int.capacity} filled
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{int.sector} • {int.locationType}</p>
                    <p className="text-sm mt-1">₹{int.stipend}/month</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CompanyPortal() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // registration state
  const [registration, setRegistration] = useState<CompanyRegistrationShape | null>(null);
  const [loadingRegistration, setLoadingRegistration] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        // Fetch from API - this is the source of truth
        const res = await fetch("/api/company/profile", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            // Map API response to CompanyRegistrationShape
            const profile: CompanyRegistrationShape = {
              companyName: data.name,
              industrySector: data.description as any || "IT Services",
              hqLocation: data.website || "Unknown",
              registeredAt: new Date().toISOString(),
            };
            setRegistration(profile);
            // Also update localStorage for consistency
            localStorage.setItem("companyRegistration", JSON.stringify(profile));
            return;
          } else {
            // API returned null - company has NOT completed registration
            // Clear any stale localStorage data from previous sessions/companies
            localStorage.removeItem("companyRegistration");
            setRegistration(null);
            return;
          }
        }

        // API call failed with non-OK status - don't use localStorage fallback
        // as it might contain data from a different company
        console.warn("Failed to fetch company profile, status:", res.status);
        localStorage.removeItem("companyRegistration");
        setRegistration(null);
      } catch (e) {
        console.warn("Failed to fetch company profile:", e);
        // Network error - still don't use localStorage as it might be stale
        // Better to show registration form again than show wrong company
        localStorage.removeItem("companyRegistration");
        setRegistration(null);
      } finally {
        setLoadingRegistration(false);
      }
    }

    fetchProfile();
  }, []);

  const handleRegistered = (data: CompanyRegistrationShape) => {
    setRegistration(data);
  };

  if (loadingRegistration) return null;

  if (!registration) {
    return (
      <div className="min-h-screen bg-background">
        <Header showNav={false} />
        <div className="container mx-auto px-4 py-8">
          <CompanyRegistration onComplete={handleRegistered} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header showNav={false} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{registration.companyName} — Company Portal</h1>
            <p className="text-muted-foreground">{registration.industrySector} • {registration.hqLocation}</p>
          </div>

          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-5">
            <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-company-dashboard">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="allocations" className="gap-2" data-testid="tab-allocations">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Allocations</span>
            </TabsTrigger>
            <TabsTrigger value="shortlist" className="gap-2" data-testid="tab-shortlist">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Shortlist</span>
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="gap-2" data-testid="tab-onboarding">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Onboarding</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <CompanyDashboard />
          </TabsContent>

          <TabsContent value="allocations">
            <AllocationsTab />
          </TabsContent>

          <TabsContent value="shortlist">
            <ShortlistPanel />
          </TabsContent>

          <TabsContent value="onboarding">
            <OnboardingSection />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileTab registration={registration} onEdit={() => { localStorage.removeItem("companyRegistration"); setRegistration(null); }} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * ProfileTab component:
 * - shows company profile (ID, Name, Sector, HQ)
 * - KPI cards (offers, acceptances, acceptance rate) computed from selected entries in context
 * - Top skill tags mini-bar (BarChart)
 * - Small time-series chart for weekly/monthly offers (LineChart)
 */
function ProfileTab({ registration, onEdit }: { registration: CompanyRegistrationShape; onEdit: () => void; }) {
  const { rounds } = useSelectedCandidates();

  // Flatten selected entries to one list
  const selectedEntries = useMemo(() => rounds.flatMap(r => r.selected || []), [rounds]);

  // Helper: compute offers & acceptances using candidate.status
  const { offersMade, acceptances } = useMemo(() => {
    let offers = 0;
    let accepts = 0;
    for (const entry of selectedEntries) {
      // treat selected -> an offer made; if explicit status exists, use it
      // we consider statuses 'offer_sent' or 'accepted' as offers made
      const s = entry.candidate.status;
      if (s === "offer_sent" || s === "accepted" || s === "pending" || s === undefined) {
        offers += 1;
      }
      if (s === "accepted") accepts += 1;
    }
    return { offersMade: offers, acceptances: accepts };
  }, [selectedEntries]);

  const acceptanceRate = offersMade === 0 ? 0 : Math.round((acceptances / offersMade) * 100);

  // Top skills aggregation
  const topSkills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of selectedEntries) {
      const skills = entry.candidate.skills || [];
      for (const skill of skills) {
        counts.set(skill, (counts.get(skill) || 0) + 1);
      }
    }
    const arr = Array.from(counts.entries()).map(([skill, count]) => ({ skill, count }));
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, 6);
  }, [selectedEntries]);

  // Time-series generation (deterministic fallback):
  // If candidate has an 'offerDate' field (ISO string), use it; otherwise generate a date based on candidate id
  const getEntryDate = (entry: any) => {
    if (entry.candidate.offerDate) return new Date(entry.candidate.offerDate);
    // deterministic fallback: today - (id % 30) days
    const days = (entry.candidate.id % 30);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  // weekly data: last 8 weeks buckets
  const weeklyData = useMemo(() => {
    const now = new Date();
    // create 8 week buckets labeled "W-7" ... "W-0" or Week start date
    const buckets: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7);
      const label = `${start.getMonth() + 1}/${start.getDate()}`; // mm/dd
      buckets.push({ label, count: 0 });
    }

    for (const entry of selectedEntries) {
      const d = getEntryDate(entry);
      // compute difference in weeks
      const diffDays = Math.floor((+new Date() - +d) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);
      if (weekIndex >= 0 && weekIndex <= 7) {
        const idx = 7 - weekIndex; // mapping so most recent is last bucket
        if (buckets[idx]) buckets[idx].count += 1;
      }
    }

    // ensure labels are from older -> newer
    return buckets;
  }, [selectedEntries]);

  // monthly data: last 6 months
  const monthlyData = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = dt.toLocaleString(undefined, { month: "short", year: "numeric" }); // e.g. "Jun 2025"
      buckets.push({ label, count: 0 });
    }

    for (const entry of selectedEntries) {
      const d = getEntryDate(entry);
      const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthsDiff >= 0 && monthsDiff <= 5) {
        const idx = 5 - monthsDiff;
        if (buckets[idx]) buckets[idx].count += 1;
      }
    }

    return buckets;
  }, [selectedEntries]);

  // UI state: weekly or monthly
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><strong>Company Name:</strong> {registration.companyName}</div>
              <div><strong>Sector:</strong> {registration.industrySector}</div>
              <div><strong>HQ:</strong> {registration.hqLocation}</div>
              <div className="text-sm text-muted-foreground mt-2">Registered on {new Date(registration.registeredAt || "").toLocaleString()}</div>
              <div className="mt-4 flex gap-2">
                <Button onClick={onEdit}>Edit Registration</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KPI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-4 bg-card rounded">
                <div className="text-sm text-muted-foreground">Offers Made</div>
                <div className="text-2xl font-semibold">{offersMade}</div>
              </div>

              <div className="p-4 bg-card rounded">
                <div className="text-sm text-muted-foreground">Acceptances</div>
                <div className="text-2xl font-semibold">{acceptances}</div>
              </div>

              <div className="p-4 bg-card rounded">
                <div className="text-sm text-muted-foreground">Acceptance Rate</div>
                <div className="text-2xl font-semibold">{acceptanceRate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Skills (Selected)</CardTitle>
          </CardHeader>
          <CardContent>
            {topSkills.length === 0 ? (
              <div className="text-muted-foreground text-sm">No skills yet — select candidates in Shortlist.</div>
            ) : (
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSkills.map((t, i) => ({ name: t.skill, value: t.count }))} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill={COLORS[0]}>
                      {topSkills.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Offers Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">Toggle period</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setPeriod("weekly")} variant={period === "weekly" ? undefined : "ghost"}>Weekly</Button>
                <Button size="sm" onClick={() => setPeriod("monthly")} variant={period === "monthly" ? undefined : "ghost"}>Monthly</Button>
              </div>
            </div>

            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                {period === "weekly" ? (
                  <LineChart data={weeklyData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke={COLORS[0]} strokeWidth={2} dot />
                  </LineChart>
                ) : (
                  <LineChart data={monthlyData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke={COLORS[1]} strokeWidth={2} dot />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills Share</CardTitle>
          </CardHeader>
          <CardContent>
            {topSkills.length === 0 ? (
              <div className="text-muted-foreground text-sm">No skills to display.</div>
            ) : (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={topSkills.map(t => ({ name: t.skill, value: t.count }))} dataKey="value" nameKey="name" outerRadius={90} label>
                      {topSkills.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
