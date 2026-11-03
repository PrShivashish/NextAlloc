import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ChevronRight,
  Building2,
  MapPin
} from "lucide-react";
import { motion } from "framer-motion";

interface Application {
  id: number;
  role: string;
  company: string;
  location: string;
  status: "applied" | "shortlisted" | "interviewed" | "offered" | "joined" | "rejected";
  appliedDate: string;
  lastUpdate: string;
}

const STATUS_CONFIG = {
  applied: { label: "Applied", color: "bg-blue-500", icon: FileText, step: 1 },
  shortlisted: { label: "Shortlisted", color: "bg-yellow-500", icon: Clock, step: 2 },
  interviewed: { label: "Interviewed", color: "bg-purple-500", icon: CheckCircle2, step: 3 },
  offered: { label: "Offered", color: "bg-green-500", icon: CheckCircle2, step: 4 },
  joined: { label: "Joined", color: "bg-green-600", icon: CheckCircle2, step: 5 },
  rejected: { label: "Rejected", color: "bg-red-500", icon: XCircle, step: 0 },
};

export function ApplicationTracker() {
  // todo: remove mock functionality - replace with real application data
  const applications: Application[] = [
    {
      id: 1,
      role: "Software Developer Intern",
      company: "TechCorp India",
      location: "Bangalore",
      status: "offered",
      appliedDate: "2024-01-15",
      lastUpdate: "2024-01-28",
    },
    {
      id: 2,
      role: "Data Analyst Intern",
      company: "Analytics Pro",
      location: "Mumbai",
      status: "interviewed",
      appliedDate: "2024-01-18",
      lastUpdate: "2024-01-25",
    },
    {
      id: 3,
      role: "Product Management Intern",
      company: "StartupX",
      location: "Delhi NCR",
      status: "shortlisted",
      appliedDate: "2024-01-20",
      lastUpdate: "2024-01-22",
    },
    {
      id: 4,
      role: "Marketing Intern",
      company: "BrandFirst",
      location: "Pune",
      status: "applied",
      appliedDate: "2024-01-22",
      lastUpdate: "2024-01-22",
    },
  ];

  const conversionFunnel = {
    applied: applications.length,
    shortlisted: applications.filter(a => ["shortlisted", "interviewed", "offered", "joined"].includes(a.status)).length,
    interviewed: applications.filter(a => ["interviewed", "offered", "joined"].includes(a.status)).length,
    offered: applications.filter(a => ["offered", "joined"].includes(a.status)).length,
    joined: applications.filter(a => a.status === "joined").length,
  };

  const STAGES = ["Applied", "Shortlisted", "Interviewed", "Offered", "Joined"];

  return (
    <div className="space-y-6" data-testid="application-tracker">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Application Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {STAGES.map((stage, index) => {
              const count = conversionFunnel[stage.toLowerCase() as keyof typeof conversionFunnel];
              const prevCount = index > 0 ? conversionFunnel[STAGES[index - 1].toLowerCase() as keyof typeof conversionFunnel] : count;
              const percentage = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
              
              return (
                <div key={stage} className="flex items-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex flex-col items-center"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      count > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </div>
                    <span className="text-xs mt-2 text-center">{stage}</span>
                    {index > 0 && count > 0 && (
                      <span className="text-xs text-muted-foreground">{percentage}%</span>
                    )}
                  </motion.div>
                  {index < STAGES.length - 1 && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {applications.map((app, index) => {
            const config = STATUS_CONFIG[app.status];
            const StatusIcon = config.icon;
            
            return (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 border rounded-lg hover-elevate"
                data-testid={`application-${app.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{app.role}</h4>
                      <Badge 
                        variant={app.status === "rejected" ? "destructive" : "secondary"}
                        className="gap-1"
                      >
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {app.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {app.location}
                      </span>
                    </div>
                    {app.status !== "rejected" && (
                      <div className="mt-3">
                        <div className="flex gap-1">
                          {STAGES.map((_, i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full ${
                                i < config.step ? config.color : "bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" data-testid={`button-view-${app.id}`}>
                    View Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Applied: {new Date(app.appliedDate).toLocaleDateString()}</span>
                  <span>Last Update: {new Date(app.lastUpdate).toLocaleDateString()}</span>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
