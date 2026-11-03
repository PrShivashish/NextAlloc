import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { 
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Building2,
  Calendar,
  Filter
} from "lucide-react";
import { motion } from "framer-motion";

interface Document {
  id: number;
  companyName: string;
  documentType: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
}

export function VerificationPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // todo: remove mock functionality - replace with real document data
  const [documents, setDocuments] = useState<Document[]>([
    { id: 1, companyName: "TechCorp India", documentType: "GST Certificate", submittedDate: "2024-01-28", status: "pending" },
    { id: 2, companyName: "Analytics Pro", documentType: "Company Registration", submittedDate: "2024-01-27", status: "pending" },
    { id: 3, companyName: "StartupX", documentType: "PAN Card", submittedDate: "2024-01-26", status: "approved" },
    { id: 4, companyName: "BrandFirst", documentType: "GST Certificate", submittedDate: "2024-01-25", status: "rejected", notes: "Invalid document format" },
    { id: 5, companyName: "DataDriven Co.", documentType: "Bank Details", submittedDate: "2024-01-24", status: "pending" },
  ]);

  const handleApprove = (id: number) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, status: "approved" as const } : doc
    ));
  };

  const handleReject = (id: number, notes: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, status: "rejected" as const, notes } : doc
    ));
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.documentType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || doc.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500 text-white gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return null;
    }
  };

  const pendingCount = documents.filter(d => d.status === "pending").length;

  return (
    <div className="space-y-6" data-testid="verification-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Document Verification</h2>
          <p className="text-muted-foreground">Review and verify company documents</p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {pendingCount} pending review
        </Badge>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company or document type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-documents"
          />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(status)}
              data-testid={`filter-${status}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredDocuments.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                data-testid={`document-${doc.id}`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{doc.companyName}</h4>
                    {getStatusBadge(doc.status)}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {doc.documentType}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(doc.submittedDate).toLocaleDateString()}
                    </span>
                  </div>
                  {doc.notes && (
                    <p className="text-sm text-red-500 mt-1">{doc.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" data-testid={`button-view-doc-${doc.id}`}>
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {doc.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(doc.id)}
                        data-testid={`button-approve-${doc.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid={`button-reject-${doc.id}`}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reject Document</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p className="text-muted-foreground">
                              Please provide a reason for rejecting this document from {doc.companyName}.
                            </p>
                            <Textarea
                              placeholder="Enter rejection reason..."
                              id={`reject-notes-${doc.id}`}
                              data-testid={`textarea-reject-notes-${doc.id}`}
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                const notes = (document.getElementById(`reject-notes-${doc.id}`) as HTMLTextAreaElement)?.value;
                                handleReject(doc.id, notes || "Document rejected");
                              }}
                              data-testid={`button-confirm-reject-${doc.id}`}
                            >
                              Confirm Rejection
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
            {filteredDocuments.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No documents found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
