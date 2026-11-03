import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Send, CheckCircle2, Rocket, Gift, Loader2, Users, RefreshCw, Award } from "lucide-react";
import { motion } from "framer-motion";
import { useSelectedCandidates, SelectedEntry } from "@/components/SelectedCandidates";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Type for ML-allocated candidate
interface AllocatedCandidate {
  student_id: string;
  internship_id: string;
  pref_rank?: number;
  match_score?: number;
  studentDetails?: {
    name: string;
    email: string;
    skills: string;
    gpa: number;
    gender: string;
    reservation: string;
  };
}

export function OnboardingSection() {
  const { rounds, removeFromSelected } = useSelectedCandidates();

  // ML Allocations state
  const [allocatedCandidates, setAllocatedCandidates] = useState<AllocatedCandidate[]>([]);
  const [allocLoading, setAllocLoading] = useState(true);
  const [summary, setSummary] = useState<any>({});

  // Local state to track status changes (mocking backend)
  const [candidateStatuses, setCandidateStatuses] = useState<Record<string, string>>({});

  // Combine all selected entries across rounds (unique by candidate id)
  const allSelectedEntries: SelectedEntry[] = rounds.flatMap(r => r.selected || []);
  const map = new Map<number, SelectedEntry>();
  allSelectedEntries.forEach(e => map.set(e.candidate.id, e));
  const shortlistedEntries = Array.from(map.values()).sort((a, b) => b.candidate.matchScore - a.candidate.matchScore);

  // Fetch ML allocations on mount
  useEffect(() => {
    fetchAllocations();
  }, []);

  async function fetchAllocations() {
    try {
      setAllocLoading(true);
      const res = await fetch("/api/company/allocations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAllocatedCandidates(data.allocations || []);
        setSummary(data.summary || {});
      }
    } catch (e) {
      console.error("Error fetching allocations:", e);
    } finally {
      setAllocLoading(false);
    }
  }

  const offerTemplate = `Dear [Candidate Name],

We are pleased to offer you the position of [Role] at [Company Name].

Start Date: [Start Date]
Duration: 6 months
Stipend: ₹25,000/month

We were impressed by your skills in [Skills] and believe you will be a great asset to our team.

Please confirm your acceptance within 7 days.

Best regards,
HR Team
[Company Name]`;

  const welcomeKitTemplate = `Dear [Candidate Name],

Welcome to the team! We are thrilled to have you join us.

Here is your Welcome Kit information:
- Employee ID: [Employee ID]
- System Login: [Email]
- Mentor: [Mentor Name]

Please find attached the onboarding documents.

Best regards,
HR Team`;

  const getStatus = (id: string, defaultStatus?: string) => {
    return candidateStatuses[id] || defaultStatus || "allocated";
  };

  const updateStatus = (id: string, status: string) => {
    setCandidateStatuses(prev => ({ ...prev, [id]: status }));
  };

  const handleSendOffer = (id: string) => {
    setTimeout(() => {
      updateStatus(id, "offer_sent");
      // Auto-accept for demo purposes after 5 seconds
      setTimeout(() => updateStatus(id, "accepted"), 5000);
    }, 1000);
  };

  const handleSendWelcomeKit = (id: string) => {
    setTimeout(() => {
      updateStatus(id, "onboarded");
    }, 1000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "allocated": return <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white">ML Allocated</Badge>;
      case "offer_sent": return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Offer Sent</Badge>;
      case "accepted": return <Badge className="bg-green-500 hover:bg-green-600 text-white">Accepted</Badge>;
      case "onboarded": return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Onboarded</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge className="bg-indigo-500 text-white">Allocated</Badge>;
    }
  };

  // Stats counts
  const allocCount = allocatedCandidates.length;
  const offersSent = allocatedCandidates.filter(a => ["offer_sent", "accepted", "onboarded"].includes(getStatus(a.student_id))).length;
  const accepted = allocatedCandidates.filter(a => ["accepted", "onboarded"].includes(getStatus(a.student_id))).length;
  const shortlistedCount = shortlistedEntries.length;

  return (
    <div className="space-y-6" data-testid="onboarding-section">
      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-indigo-600">{allocCount}</div>
            <div className="text-sm text-indigo-700">ML Allocated</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{offersSent}</div>
            <div className="text-sm text-blue-700">Offers Sent</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{accepted}</div>
            <div className="text-sm text-green-700">Accepted</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{shortlistedCount}</div>
            <div className="text-sm text-amber-700">Shortlisted</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Allocated Candidates | Shortlisted */}
      <Tabs defaultValue="allocated" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="allocated" className="flex items-center gap-2">
            <Award className="h-4 w-4" /> Allocated Candidates
          </TabsTrigger>
          <TabsTrigger value="shortlisted" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Shortlisted
          </TabsTrigger>
        </TabsList>

        {/* Allocated Candidates Tab */}
        <TabsContent value="allocated">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-500" />
                ML Allocated Candidates ({allocatedCandidates.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={fetchAllocations} disabled={allocLoading}>
                <RefreshCw className={`h-4 w-4 ${allocLoading ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {allocLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading allocations...</span>
                </div>
              ) : allocatedCandidates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No candidates allocated yet</p>
                  <p className="text-sm mt-1">Allocations will appear here after the admin runs the ML allocation</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {allocatedCandidates.map((alloc) => {
                    const status = getStatus(alloc.student_id);
                    const details = alloc.studentDetails;
                    const skills = details?.skills?.split(";").filter(Boolean) || [];

                    return (
                      <motion.div
                        key={alloc.student_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-indigo-100 text-indigo-600 font-medium">
                              {details?.name?.split(" ").map(n => n[0]).join("") || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold truncate">{details?.name || alloc.student_id}</h4>
                              {getStatusBadge(status)}
                            </div>
                            <p className="text-xs text-muted-foreground">{details?.email || "N/A"}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              <Badge variant="outline" className="text-xs">{alloc.student_id}</Badge>
                              <Badge variant="outline" className="text-xs bg-blue-50">{alloc.internship_id}</Badge>
                              {alloc.pref_rank && (
                                <Badge variant="outline" className="text-xs bg-green-50">Pref #{alloc.pref_rank}</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Details Row */}
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div>GPA: <strong className="text-foreground">{details?.gpa?.toFixed(1) || "N/A"}</strong></div>
                          <div>{details?.gender || ""}</div>
                          <div>{details?.reservation || "General"}</div>
                        </div>

                        {/* Skills */}
                        {skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {skills.slice(0, 4).map(skill => (
                              <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                            ))}
                            {skills.length > 4 && (
                              <Badge variant="secondary" className="text-xs">+{skills.length - 4}</Badge>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-4 flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                className="flex-1"
                                variant={status === "allocated" ? "default" : "outline"}
                                disabled={status !== "allocated"}
                              >
                                <Rocket className="h-4 w-4 mr-1" />
                                {status === "allocated" ? "Send Offer" : "Offer Sent"}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Send Offer to {details?.name || alloc.student_id}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Input defaultValue="Intern" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Offer Letter Content</Label>
                                  <Textarea
                                    defaultValue={offerTemplate
                                      .replace("[Candidate Name]", details?.name || alloc.student_id)
                                      .replace("[Skills]", skills.join(", ") || "your skills")
                                    }
                                    className="min-h-[250px] font-mono text-sm"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline">Cancel</Button>
                                <Button onClick={() => handleSendOffer(alloc.student_id)}>
                                  <Rocket className="h-4 w-4 mr-2" /> Send Offer
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                className="flex-1"
                                variant="outline"
                                disabled={status !== "accepted"}
                              >
                                <Gift className="h-4 w-4 mr-1" />
                                Welcome Kit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Send Welcome Kit to {details?.name || alloc.student_id}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <Textarea
                                  defaultValue={welcomeKitTemplate
                                    .replace("[Candidate Name]", details?.name || alloc.student_id)
                                    .replace("[Email]", details?.email || "")
                                  }
                                  className="min-h-[250px] font-mono text-sm"
                                />
                              </div>
                              <DialogFooter>
                                <Button variant="outline">Cancel</Button>
                                <Button onClick={() => handleSendWelcomeKit(alloc.student_id)}>
                                  <Send className="h-4 w-4 mr-2" /> Send Kit
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shortlisted Tab (existing functionality) */}
        <TabsContent value="shortlisted">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-500" />
                Shortlisted Candidates ({shortlistedEntries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shortlistedEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No candidates shortlisted</p>
                  <p className="text-sm mt-1">Shortlist candidates from the Shortlist section</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {shortlistedEntries.map((entry) => {
                    const candidate = entry.candidate;
                    return (
                      <div key={candidate.id} className="p-4 border rounded-lg bg-card">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-amber-100 text-amber-600">
                              {candidate.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h4 className="font-medium">{candidate.name}</h4>
                            <p className="text-xs text-muted-foreground">{candidate.email}</p>
                            <div className="text-xs text-muted-foreground mt-1">Score: {candidate.matchScore}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
