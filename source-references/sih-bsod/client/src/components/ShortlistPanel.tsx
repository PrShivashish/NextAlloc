import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface AllocationData {
  allocations: any[];
  internships: any[];
  summary: {
    totalInternships: number;
    totalCapacity: number;
    allocatedStudents: number;
  };
}

interface CandidateApplicant {
  studentId: string;
  name: string | null;
  gpa: number;
  skills: string;
  reservation: string;
  gender: string;
  preferenceRank: number;
  status: "allocated" | "pending" | "rejected";
  internshipId?: string;
}

export function ShortlistPanel() {
  const [data, setData] = useState<AllocationData | null>(null);
  const [candidates, setCandidates] = useState<CandidateApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeInternship, setActiveInternship] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRound, setExpandedRound] = useState<number | null>(1);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch allocations for this company
        const allocRes = await fetch("/api/company/allocations", { credentials: "include" });
        const contentType = allocRes.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("Server returned HTML. Please restart the server.");
        }
        if (!allocRes.ok) throw new Error(`Allocations API error: ${allocRes.status}`);
        const allocData = await allocRes.json();
        setData(allocData);

        // Set first internship as active by default
        if (allocData.internships?.length > 0 && !activeInternship) {
          setActiveInternship(allocData.internships[0].internshipId);
        }

        // Fetch all candidates who have preferences for this company's internships
        // For now, we'll simulate this with the allocated students plus some pending
        const allCandidates: CandidateApplicant[] = [];

        // Add allocated students
        (allocData.allocations || []).forEach((alloc: any) => {
          allCandidates.push({
            studentId: alloc.student_id,
            name: alloc.studentDetails?.name || null,
            gpa: alloc.studentDetails?.gpa || 0,
            skills: alloc.studentDetails?.skills || "",
            reservation: alloc.studentDetails?.reservation || "GEN",
            gender: alloc.studentDetails?.gender || "M",
            preferenceRank: alloc.pref_rank || 1,
            status: "allocated",
            internshipId: alloc.internship_id,
          });
        });

        setCandidates(allCandidates);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const refreshData = () => {
    setLoading(true);
    setError(null);
    // Re-trigger useEffect
    window.location.reload();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading shortlist data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-8 text-center">
          <XCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium">Error loading shortlist</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <Button onClick={refreshData} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { internships = [], allocations = [], summary = {} } = data || {};

  // Group candidates by preference round
  const roundData = [1, 2, 3, 4, 5, 6].map(round => {
    const roundCandidates = candidates.filter(c =>
      c.preferenceRank === round &&
      (!activeInternship || c.internshipId === activeInternship)
    );
    return {
      round,
      candidates: roundCandidates,
      allocated: roundCandidates.filter(c => c.status === "allocated").length,
      total: roundCandidates.length,
    };
  });

  // Get candidates for active internship
  const activeCandidates = candidates.filter(c =>
    !activeInternship || c.internshipId === activeInternship
  );

  const filteredCandidates = statusFilter === "all"
    ? activeCandidates
    : activeCandidates.filter(c => c.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Applicants</p>
            <p className="text-2xl font-bold text-primary">{candidates.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Allocated</p>
            <p className="text-2xl font-bold text-green-600">
              {candidates.filter(c => c.status === "allocated").length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">1st Preference</p>
            <p className="text-2xl font-bold text-yellow-600">
              {candidates.filter(c => c.preferenceRank === 1).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Fill Rate</p>
            <p className="text-2xl font-bold text-blue-600">
              {(data?.summary?.totalCapacity ?? 0) > 0
                ? `${Math.round(((data?.summary?.allocatedStudents ?? 0) / (data?.summary?.totalCapacity ?? 1)) * 100)}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Internship Selector */}
      {internships.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select Internship</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeInternship === null ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveInternship(null)}
              >
                All Internships
              </Button>
              {internships.map((int: any) => (
                <Button
                  key={int.internshipId}
                  variant={activeInternship === int.internshipId ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveInternship(int.internshipId)}
                >
                  {int.internshipId} ({int.sector})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Round-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Round-wise Allocation Details
          </CardTitle>
          <CardDescription>
            How candidates were processed through preference rounds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roundData.map(({ round, candidates: roundCandidates, allocated, total }) => (
              <div key={round} className="border rounded-lg overflow-hidden">
                {/* Round Header */}
                <div
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${expandedRound === round ? 'bg-primary/10' : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  onClick={() => setExpandedRound(expandedRound === round ? null : round)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${allocated > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                      total > 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                      {round}
                    </div>
                    <div>
                      <h4 className="font-semibold">Preference Round {round}</h4>
                      <p className="text-sm text-muted-foreground">
                        {total > 0
                          ? `${allocated} allocated out of ${total} applicants`
                          : "No applicants in this round"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {total > 0 && (
                      <div className="flex gap-2">
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" /> {allocated}
                        </Badge>
                        {total - allocated > 0 && (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" /> {total - allocated}
                          </Badge>
                        )}
                      </div>
                    )}
                    {expandedRound === round ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Round Details (Expanded) */}
                {expandedRound === round && total > 0 && (
                  <div className="border-t bg-background">
                    <ScrollArea className="max-h-[300px]">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Student ID</th>
                            <th className="px-4 py-2 text-left font-medium">Name</th>
                            <th className="px-4 py-2 text-left font-medium">GPA</th>
                            <th className="px-4 py-2 text-left font-medium">Skills</th>
                            <th className="px-4 py-2 text-left font-medium">Category</th>
                            <th className="px-4 py-2 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {roundCandidates.map((candidate) => (
                            <tr key={candidate.studentId} className="hover:bg-muted/30">
                              <td className="px-4 py-3 font-mono">{candidate.studentId}</td>
                              <td className="px-4 py-3">{candidate.name || "—"}</td>
                              <td className="px-4 py-3">{candidate.gpa?.toFixed(1) || "—"}</td>
                              <td className="px-4 py-3 max-w-[200px] truncate">
                                {candidate.skills || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">{candidate.reservation}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                {candidate.status === "allocated" ? (
                                  <Badge className="bg-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" /> Allocated
                                  </Badge>
                                ) : candidate.status === "rejected" ? (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 mr-1" /> Rejected
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    <Clock className="h-3 w-3 mr-1" /> Pending
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}

                {/* Empty state for round */}
                {expandedRound === round && total === 0 && (
                  <div className="border-t p-8 text-center text-muted-foreground bg-background">
                    <Users className="h-8 w-8 mx-auto opacity-30 mb-2" />
                    <p>No candidates had this internship as preference #{round}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Category-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category-wise Allocation</CardTitle>
          <CardDescription>Distribution of allocated candidates by reservation category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["GEN", "OBC", "SC", "ST"].map(category => {
              const catCandidates = candidates.filter(c => c.reservation === category);
              const catAllocated = catCandidates.filter(c => c.status === "allocated").length;
              return (
                <div key={category} className="p-4 border rounded-lg text-center">
                  <h4 className="font-semibold text-lg">{category}</h4>
                  <p className="text-2xl font-bold text-primary">{catAllocated}</p>
                  <p className="text-xs text-muted-foreground">of {catCandidates.length} applicants</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* All Candidates List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Candidates</CardTitle>
              <CardDescription>Complete list of candidates for your internships</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All ({activeCandidates.length})
              </Button>
              <Button
                variant={statusFilter === "allocated" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("allocated")}
              >
                Allocated ({activeCandidates.filter(c => c.status === "allocated").length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCandidates.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-left font-medium">Internship</th>
                    <th className="px-4 py-3 text-left font-medium">Pref #</th>
                    <th className="px-4 py-3 text-left font-medium">GPA</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Gender</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCandidates.map((c) => (
                    <tr key={c.studentId} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{c.name || c.studentId}</p>
                          <p className="text-xs text-muted-foreground font-mono">{c.studentId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">{c.internshipId || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.preferenceRank === 1 ? "default" : "secondary"}>
                          #{c.preferenceRank}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{c.gpa?.toFixed(1) || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{c.reservation}</Badge>
                      </td>
                      <td className="px-4 py-3">{c.gender}</td>
                      <td className="px-4 py-3">
                        {c.status === "allocated" ? (
                          <Badge className="bg-green-600">Allocated</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg">
              <Users className="h-12 w-12 opacity-30 mb-4" />
              <p className="font-medium">No Candidates Found</p>
              <p className="text-sm">
                {internships.length === 0
                  ? "Post internships to receive candidate applications"
                  : "No allocations have been made yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
