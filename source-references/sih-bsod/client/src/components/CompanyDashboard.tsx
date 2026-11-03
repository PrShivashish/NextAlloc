// client/src/components/CompanyDashboard.tsx
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle2,
  ChevronRight,
  Plus,
  TrendingUp,
  Loader2,
  RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";

import AddRoleDialog from "@/components/AddRoleDialog";

/**
 * Dashboard Role shape (updated with description, companyId and gpaRequirement)
 */
interface Role {
  id: number;
  internshipId: string;
  sector: string;
  tier: "Tier1" | "Tier2" | "Tier3" | "";
  state: string;
  capacity: number;
  req_skills: string[];
  location_type: string;
  title: string;
  description: string;
  companyId?: string | number;
  gpaRequirement?: number | null;
  filled: number;
  applications: number;
  deadline?: string;
}

// State code to full name mapping
const STATE_NAMES: Record<string, string> = {
  'MH': 'Maharashtra',
  'KA': 'Karnataka',
  'GJ': 'Gujarat',
  'TG': 'Telangana',
  'UP': 'Uttar Pradesh',
  'RJ': 'Rajasthan'
};

export function CompanyDashboard() {
  // State for roles fetched from API
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allocationsData, setAllocationsData] = useState<any>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedRoleId, setExpandedRoleId] = useState<number | null>(null);

  // Fetch company's internships and allocations on mount
  useEffect(() => {
    fetchInternshipsAndAllocations();
  }, []);

  async function fetchInternshipsAndAllocations() {
    try {
      setLoading(true);

      // Fetch both internships and allocations in parallel
      const [intRes, allocRes] = await Promise.all([
        fetch("/api/company/internships", { credentials: "include" }),
        fetch("/api/company/allocations", { credentials: "include" })
      ]);

      if (!intRes.ok) {
        throw new Error("Failed to fetch internships");
      }

      const intData = await intRes.json();
      let allocData = { allocations: [], summary: {} };

      if (allocRes.ok) {
        allocData = await allocRes.json();
        setAllocationsData(allocData);
      }

      // Map API data to Role format with filled count from allocations
      const mappedRoles: Role[] = intData.map((int: any, idx: number) => {
        // Calculate filled count from ML allocations
        const filled = allocData.allocations?.filter(
          (a: any) => a.internship_id === int.internshipId
        ).length || 0;

        return {
          id: idx + 1,
          internshipId: int.internshipId,
          sector: int.sector,
          tier: int.tier || "",
          state: int.state || "",
          capacity: int.capacity,
          req_skills: typeof int.requiredSkills === 'string'
            ? int.requiredSkills.split(';').filter(Boolean)
            : int.requiredSkills || [],
          location_type: int.locationType,
          title: `${int.sector} Intern`,
          description: "",
          companyId: int.companyId,
          gpaRequirement: null,
          filled: filled, // Now calculated from ML allocations
          applications: 0,
          deadline: undefined,
        };
      });

      setRoles(mappedRoles);
      setError(null);
    } catch (e: any) {
      console.error("Error fetching internships:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const totalFilled = roles.reduce((s, r) => s + r.filled, 0);
  const totalCapacity = roles.reduce((s, r) => s + r.capacity, 0);
  const fillRate = totalCapacity > 0 ? Math.round((totalFilled / totalCapacity) * 100) : 0;

  const stats = [
    { icon: Briefcase, label: "Active Roles", value: roles.length, color: "text-blue-500" },
    { icon: Users, label: "Total Capacity", value: totalCapacity, color: "text-green-500" },
    { icon: CheckCircle2, label: "Allocated", value: totalFilled, color: "text-purple-500" },
    { icon: TrendingUp, label: "Fill Rate", value: `${fillRate}%`, color: "text-amber-500" },
  ];

  // Handle adding a new role - save to API
  const handleAddRole = async (data: any) => {
    try {
      // Debug: log received data
      console.log("AddRole received data:", data);

      const payload = {
        sector: data?.sector ?? data?.sectorCategory ?? "General",
        tier: data?.tier ?? "Tier2",
        state: data?.state ?? data?.jobState ?? null, // Check both property names
        capacity: parseInt(data?.capacity) || 1,
        requiredSkills: Array.isArray(data?.req_skills)
          ? data.req_skills
          : Array.isArray(data?.requiredSkills)
            ? data.requiredSkills
            : typeof data?.req_skills === 'string'
              ? data.req_skills.split(',').map((s: string) => s.trim())
              : [],
        stipend: parseInt(data?.stipend) || 0,
        locationType: data?.locationType ?? data?.location ?? "Office", // Check both property names
      };

      // Debug: log payload being sent
      console.log("Sending payload to API:", payload);

      const res = await fetch("/api/company/internships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const newInternship = await res.json();
      console.log("Created internship:", newInternship);

      // Refresh the list
      await fetchInternshipsAndAllocations();
      alert("Role created successfully!");
    } catch (e: any) {
      console.error("Error creating internship:", e);
      alert("Error creating role: " + e.message);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedRoleId((cur) => (cur === id ? null : id));
  };

  return (
    <div className="space-y-6" data-testid="company-dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Active Roles</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fetchInternshipsAndAllocations()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="sm" data-testid="button-add-role" onClick={() => setIsAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Role
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : roles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Briefcase className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">No internships created yet</p>
                <p className="text-xs mt-1">Click "Add Role" to create your first internship</p>
              </div>
            ) : (
              roles.map((role) => {
                const progress = role.capacity > 0 ? (role.filled / role.capacity) * 100 : 0;
                const isExpanded = expandedRoleId === role.id;

                return (
                  <motion.div
                    key={role.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="p-3 border rounded-lg hover-elevate cursor-pointer"
                    data-testid={`role-${role.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div onClick={() => toggleExpand(role.id)} className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{role.title}</h4>
                        <p className="text-xs text-muted-foreground truncate">{role.sector} • {role.location_type}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary">{role.applications} apps</Badge>
                        <div className="text-xs text-muted-foreground">{role.capacity} slots</div>
                        <div className="text-xs text-muted-foreground">{Math.round(progress)}%</div>
                      </div>
                    </div>

                    <div className="mt-2">
                      <Progress value={progress} className="h-1.5" />
                    </div>

                    {/* Expandable details */}
                    {isExpanded && (
                      <div className="mt-3 border-l-2 border-muted/40 pl-3 space-y-2">
                        <div className="text-xs">
                          <strong>Internship ID:</strong> <span className="text-muted-foreground">{role.internshipId}</span>
                        </div>
                        <div className="text-xs">
                          <strong>Company ID:</strong> <span className="text-muted-foreground">{role.companyId ?? "—"}</span>
                        </div>
                        <div className="text-xs">
                          <strong>Sector:</strong> <span className="text-muted-foreground">{role.sector}</span>
                        </div>
                        <div className="text-xs">
                          <strong>Location:</strong> <span className="text-muted-foreground">📍 {STATE_NAMES[role.state] || role.state || "—"}</span>
                        </div>
                        <div className="text-xs">
                          <strong>Location type:</strong> <span className="text-muted-foreground">{role.location_type}</span>
                        </div>
                        <div className="text-xs">
                          <strong>Slots (capacity):</strong> <span className="text-muted-foreground">{role.capacity}</span>
                        </div>
                        <div className="text-xs flex flex-wrap gap-2 items-center">
                          <strong>Skills:</strong>
                          <div className="flex flex-wrap gap-2">
                            {role.req_skills.map((s, idx) => (
                              <span key={idx} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="text-xs">
                          <strong>Description:</strong>
                          <div className="text-muted-foreground">{role.description || "No description provided."}</div>
                        </div>

                        <div className="text-xs">
                          <strong>GPA Requirement:</strong> <span className="text-muted-foreground">{role.gpaRequirement !== null && role.gpaRequirement !== undefined ? role.gpaRequirement : "—"}</span>
                        </div>

                        <div className="text-xs">
                          <strong>Applications:</strong> <span className="text-muted-foreground">{role.applications}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Pending Applications</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">No applications yet</p>
              <p className="text-xs mt-1">Applications will appear here when students apply to your internships</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Role Dialog (new fields) */}
      <AddRoleDialog open={isAddOpen} onOpenChange={setIsAddOpen} onSubmit={handleAddRole} />
    </div>
  );
}
