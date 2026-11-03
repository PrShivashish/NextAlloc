import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Building2, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  ChevronRight,
  Flag
} from "lucide-react";
import { motion } from "framer-motion";

interface Company {
  id: number;
  name: string;
  industry: string;
  size: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected";
}

interface Grievance {
  id: number;
  type: string;
  submittedBy: string;
  subject: string;
  description: string;
  submittedDate: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
}

export function ModerationPanel() {
  // todo: remove mock functionality - replace with real data
  const [companies, setCompanies] = useState<Company[]>([
    { id: 1, name: "TechCorp India", industry: "Information Technology", size: "1000+ employees", submittedDate: "2024-01-28", status: "pending" },
    { id: 2, name: "Analytics Pro", industry: "Data Analytics", size: "100-500 employees", submittedDate: "2024-01-27", status: "pending" },
    { id: 3, name: "GreenEnergy Ltd", industry: "Renewable Energy", size: "50-100 employees", submittedDate: "2024-01-26", status: "approved" },
  ]);

  const [grievances, setGrievances] = useState<Grievance[]>([
    { id: 1, type: "Student", submittedBy: "Aarav Sharma", subject: "Application Status Delay", description: "My application has been pending for 3 weeks with no update", submittedDate: "2024-01-28", status: "open", priority: "high" },
    { id: 2, type: "Company", submittedBy: "TechCorp HR", subject: "Candidate No-Show", description: "Selected intern did not report on joining date", submittedDate: "2024-01-27", status: "in_progress", priority: "medium" },
    { id: 3, type: "Student", submittedBy: "Priya Patel", subject: "Stipend Issue", description: "Haven't received stipend for last month", submittedDate: "2024-01-25", status: "resolved", priority: "high" },
  ]);

  const handleApproveCompany = (id: number) => {
    setCompanies(prev => prev.map(c => 
      c.id === id ? { ...c, status: "approved" as const } : c
    ));
  };

  const handleRejectCompany = (id: number) => {
    setCompanies(prev => prev.map(c => 
      c.id === id ? { ...c, status: "rejected" as const } : c
    ));
  };

  const updateGrievanceStatus = (id: number, status: Grievance["status"]) => {
    setGrievances(prev => prev.map(g => 
      g.id === id ? { ...g, status } : g
    ));
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: "default" | "secondary" | "destructive"; className?: string }> = {
      pending: { variant: "secondary" },
      approved: { variant: "default", className: "bg-green-500 text-white" },
      rejected: { variant: "destructive" },
      open: { variant: "secondary" },
      in_progress: { variant: "default", className: "bg-blue-500 text-white" },
      resolved: { variant: "default", className: "bg-green-500 text-white" },
      closed: { variant: "secondary" },
    };
    const config = configs[status] || { variant: "secondary" as const };
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500 text-white">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="moderation-panel">
      <div>
        <h2 className="text-2xl font-bold">Moderation</h2>
        <p className="text-muted-foreground">Manage company approvals and grievances</p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            Company Approvals
            <Badge variant="secondary">{companies.filter(c => c.status === "pending").length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="grievances" className="gap-2">
            <Flag className="h-4 w-4" />
            Grievances
            <Badge variant="secondary">{grievances.filter(g => g.status === "open").length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-4">
          <Card>
            <CardContent className="p-0 divide-y">
              {companies.map((company, index) => (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4"
                  data-testid={`company-${company.id}`}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {company.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{company.name}</h4>
                      {getStatusBadge(company.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{company.industry}</span>
                      <span>{company.size}</span>
                    </div>
                  </div>
                  {company.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApproveCompany(company.id)} data-testid={`approve-company-${company.id}`}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleRejectCompany(company.id)} data-testid={`reject-company-${company.id}`}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                  {company.status !== "pending" && (
                    <Button variant="ghost" size="sm">
                      View Details
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grievances" className="mt-4">
          <Card>
            <CardContent className="p-0 divide-y">
              {grievances.map((grievance, index) => (
                <motion.div
                  key={grievance.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4"
                  data-testid={`grievance-${grievance.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${grievance.priority === "high" ? "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{grievance.subject}</h4>
                        {getStatusBadge(grievance.status)}
                        {getPriorityBadge(grievance.priority)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{grievance.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>From: {grievance.submittedBy} ({grievance.type})</span>
                        <span>{new Date(grievance.submittedDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid={`respond-grievance-${grievance.id}`}>
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Respond
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Respond to Grievance</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="p-4 bg-muted rounded-lg">
                            <h4 className="font-medium">{grievance.subject}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{grievance.description}</p>
                          </div>
                          <Textarea placeholder="Type your response..." data-testid={`textarea-response-${grievance.id}`} />
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => updateGrievanceStatus(grievance.id, "in_progress")} className="flex-1">
                              Mark In Progress
                            </Button>
                            <Button onClick={() => updateGrievanceStatus(grievance.id, "resolved")} className="flex-1">
                              Mark Resolved
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
