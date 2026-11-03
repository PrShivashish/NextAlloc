import React, { useState, useEffect } from 'react';
import { useAuth } from "@/lib/AuthProvider";
import { Header } from "@/components/Header";
import { AuditPanel } from "@/components/AuditPanel";
import LogoutButton from "@/components/LogoutButton";
import { useToast } from "@/hooks/use-toast";
import {
    uploadStudentsCSV,
    uploadInternshipsCSV,
    trainModel,
    allocateInternships,
    getDashboardData,
    downloadFile,
    triggerDownload,
    type DashboardData
} from "@/lib/mlApi";
import {
    LayoutDashboard,
    Scale,
    Clock,
    Users,
    Tractor,
    Download,
    Loader2,
    TrendingUp,
    Percent,
    ChevronDown,
    ChevronUp,
    Shield,
    Search,
    Play,
    FileText,
    Check,
    X,
    Upload,
    Zap,
    ClipboardList,
    AlertTriangle,
    CheckCircle,
    XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

// Modal Dialog Component
const Dialog = ({ open, onOpenChange, children }: any) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => onOpenChange(false)}>
            <div className="bg-background rounded-lg shadow-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};

// --------------------------------------------------------------------------------
// --- DASHBOARD COMPONENTS ---
// --------------------------------------------------------------------------------

const StatCard = ({ title, value, change, icon: Icon, trend }: { title: string, value: string, change: string, icon: any, trend?: "up" | "down" | "neutral" }) => (
    <Card>
        <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <h3 className="text-2xl font-bold">{value}</h3>
                <p className="text-xs text-muted-foreground">{change}</p>
            </div>
            <div className={`p-3 rounded-full ${trend === 'up' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : trend === 'down' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-primary/10 text-primary'}`}>
                <Icon className="h-5 w-5" />
            </div>
        </CardContent>
    </Card>
);

const CSVUploadBox = ({ title, description, onFileSelect }: { title: string, description: string, onFileSelect: (file: File) => void }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.csv')) {
            setSelectedFile(files[0]);
            onFileSelect(files[0]);
        }
    };
    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.currentTarget.files;
        if (files && files.length > 0) {
            setSelectedFile(files[0]);
            onFileSelect(files[0]);
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/10 scale-105' : 'border-muted-foreground/30 bg-muted/5 hover:bg-muted/10'}`}
        >
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
            <div className="flex flex-col items-center justify-center gap-3">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    {selectedFile && <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">✓ {selectedFile.name}</p>}
                </div>
            </div>
        </div>
    );
};

const CategoryMiniTable = ({ dashboardData }: { dashboardData?: DashboardData | null }) => {
    const getCategoryData = () => {
        if (dashboardData?.fairness?.category_wise) {
            const categoryWise = dashboardData.fairness.category_wise;
            const overallRate = dashboardData.fairness.placement_rate || 0;
            return Object.entries(categoryWise).map(([category, stats]: [string, any]) => ({
                category,
                eligible: stats.eligible,
                placed: stats.placed,
                rate: stats.placement_rate * 100,
                delta: ((stats.placement_rate - overallRate) * 100)
            }));
        }
        return [];
    };

    const data = getCategoryData();
    const hasData = data.length > 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Placement Rate by Category</CardTitle>
                <CardDescription>
                    {hasData ? `Based on ${dashboardData?.fairness?.total_applicants?.toLocaleString() || 0} total applicants` : "Run allocation to see category breakdown"}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {hasData ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        {['Category', 'Eligible', 'Placed', 'Rate (%)', 'vs Overall'].map(header => (
                                            <th key={header} className="px-4 py-3 font-medium">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {data.map((item: any) => (
                                        <tr key={item.category} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3 font-medium">{item.category}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{(item.eligible || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{(item.placed || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 font-semibold">{(item.rate || 0).toFixed(1)}%</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={(item.delta || 0) > 0 ? "default" : (item.delta || 0) < 0 ? "destructive" : "secondary"} className="gap-1">
                                                    {(item.delta || 0) > 0 ? <ChevronUp className="h-3 w-3" /> : (item.delta || 0) < 0 ? <ChevronDown className="h-3 w-3" /> : null}
                                                    {item.delta > 0 ? "+" : ""}{item.delta.toFixed(1)}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 italic">
                            Overall placement rate: {((dashboardData?.fairness?.placement_rate || 0) * 100).toFixed(1)}%
                        </p>
                    </>
                ) : (
                    <div className="h-32 flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                        <p>No category data available. Upload CSV files and run allocation.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const TrainingDataModal = ({ open, onOpenChange, onFilesSelected }: { open: boolean, onOpenChange: (open: boolean) => void, onFilesSelected: (internship: File, candidate: File) => void }) => {
    const [internshipFile, setInternshipFile] = useState<File | null>(null);
    const [candidateFile, setCandidateFile] = useState<File | null>(null);

    const handleProceed = () => {
        if (internshipFile && candidateFile) {
            onFilesSelected(internshipFile, candidateFile);
            onOpenChange(false);
            setInternshipFile(null);
            setCandidateFile(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <CardHeader className="border-b">
                <CardTitle>Upload Training Data</CardTitle>
                <CardDescription>Upload CSV files to train the allocation model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Internship Training Data</label>
                    <CSVUploadBox title="Internship Dataset" description="Drag & drop or click to upload CSV" onFileSelect={setInternshipFile} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Candidate Training Data</label>
                    <CSVUploadBox title="Candidate Dataset" description="Drag & drop or click to upload CSV" onFileSelect={setCandidateFile} />
                </div>
                {(internshipFile || candidateFile) && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm text-green-700 dark:text-green-400">
                            {internshipFile && <span className="block">✓ Internship: {internshipFile.name}</span>}
                            {candidateFile && <span className="block">✓ Candidate: {candidateFile.name}</span>}
                        </p>
                    </div>
                )}
                <div className="flex gap-3 justify-end pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleProceed} disabled={!internshipFile || !candidateFile}>Proceed with Allocation</Button>
                </div>
            </CardContent>
        </Dialog>
    );
};

// --------------------------------------------------------------------------------
// --- ADMIN DASHBOARD ---
// --------------------------------------------------------------------------------

const AdminDashboard = ({
    isAllocating, onFilesSelected, onSyncFromDatabase, generateResults, dashboardData, allocationStep, uploadProgress
}: {
    isAllocating: boolean;
    onFilesSelected: (internship: File, candidate: File) => void;
    onSyncFromDatabase: () => void;
    generateResults: () => void;
    dashboardData: DashboardData | null;
    allocationStep: string;
    uploadProgress: { students: boolean; internships: boolean };
}) => {
    const [showTrainingModal, setShowTrainingModal] = useState(false);

    const totalApplicants = dashboardData?.students || dashboardData?.fairness?.total_applicants || "—";
    const totalPlaced = dashboardData?.allocations_count || dashboardData?.fairness?.total_placed || "—";
    const rawPlacementRate = dashboardData?.fairness?.placement_rate;
    const placementRate = rawPlacementRate ? `${(rawPlacementRate * 100).toFixed(1)}%` : "—";

    return (
        <div className="space-y-6">
            {/* Allocation Progress */}
            {isAllocating && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            <div>
                                <p className="font-semibold text-blue-700 dark:text-blue-400">Allocation in Progress</p>
                                <p className="text-sm text-blue-600 dark:text-blue-300">{allocationStep}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-4 text-sm">
                            <div className={`flex items-center gap-2 ${uploadProgress.students ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {uploadProgress.students ? <Check className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                                Students CSV
                            </div>
                            <div className={`flex items-center gap-2 ${uploadProgress.internships ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {uploadProgress.internships ? <Check className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                                Internships CSV
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard title="Total Applicants" value={String(totalApplicants)} change="Current Round" icon={Users} trend="neutral" />
                <StatCard title="Total Placed" value={String(totalPlaced)} change="Seats filled so far" icon={TrendingUp} trend="up" />
            </div>

            {/* Allocation Controls */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Zap className="h-5 w-5" /> Allocation Controls</CardTitle>
                    <CardDescription>Manage the automated allocation process and generate reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={onSyncFromDatabase} disabled={isAllocating} size="lg" className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                            {isAllocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                            Sync & Allocate from Database
                        </Button>
                        <Button onClick={() => setShowTrainingModal(true)} disabled={isAllocating} variant="outline" size="lg" className="flex-1 gap-2">
                            <Upload className="h-5 w-5" />
                            Upload Custom CSV Files
                        </Button>
                    </div>
                    <div className="flex">
                        <Button onClick={generateResults} disabled={isAllocating} variant="secondary" size="lg" className="flex-1 gap-2">
                            <FileText className="h-5 w-5" />
                            Download Allocations CSV
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        <strong>Sync from Database:</strong> Uses students and internships already in your database (recommended).
                        <br />
                        <strong>Custom CSV:</strong> Upload your own CSV files (requires specific column format).
                    </p>
                </CardContent>
            </Card>

            {/* Mini-Table Section */}
            <CategoryMiniTable dashboardData={dashboardData} />

            {/* Allocation Summary */}
            {dashboardData ? (
                <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/10 dark:to-blue-900/10">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Check className="h-5 w-5 text-green-600" /> Allocation Complete</CardTitle>
                        <CardDescription>Summary of the latest allocation run</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold">{dashboardData.students?.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Students</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold">{dashboardData.internships?.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Internships</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">{dashboardData.allocations_count?.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Allocations Made</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                    <div className="text-center">
                        <p>No allocation data available yet.</p>
                        <p className="text-sm">Upload training data and run allocation to see results.</p>
                    </div>
                </div>
            )}

            <TrainingDataModal open={showTrainingModal} onOpenChange={setShowTrainingModal} onFilesSelected={onFilesSelected} />
        </div>
    );
};

// --------------------------------------------------------------------------------
// --- FAIRNESS METRICS PANEL ---
// --------------------------------------------------------------------------------

const FairnessMetricsPanel = ({ dashboardData }: { dashboardData: DashboardData | null }) => {
    if (!dashboardData?.fairness) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Fairness & Model Health</CardTitle>
                    <CardDescription>Run allocation to view fairness metrics</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                        No fairness data available. Please run an allocation first.
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { fairness, boost_report } = dashboardData;
    const categories = Object.keys(fairness.category_wise || {});
    const categoryColors: Record<string, string> = { GEN: 'bg-blue-500', OBC: 'bg-green-500', SC: 'bg-yellow-500', ST: 'bg-purple-500' };

    // Calculate disparate impact ratio
    const genRate = fairness.category_wise?.GEN?.placement_rate || 0;
    const minorRates = categories.filter(c => c !== 'GEN').map(c => fairness.category_wise[c]?.placement_rate || 0);
    const disparateImpact = genRate > 0 ? Math.min(...minorRates) / genRate : 1;

    // Gender data normalization
    const genderData = fairness.gender_wise || {};
    const genderM = typeof genderData === 'object' && 'M' in genderData ? (genderData as any).M : (genderData as any).M?.placed || 0;
    const genderF = typeof genderData === 'object' && 'F' in genderData ? (genderData as any).F : (genderData as any).F?.placed || 0;
    const genderO = typeof genderData === 'object' && 'O' in genderData ? (genderData as any).O : (genderData as any).O?.placed || 0;
    const genderTotal = genderM + genderF + genderO;

    // Rural data
    const ruralData = fairness.rural || fairness.rural_wise || {};

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Fairness & Model Health</CardTitle>
                <CardDescription>Audit the allocation model's performance on protected groups.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-primary/5 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Total Applicants</p>
                        <p className="text-2xl font-bold">{fairness.total_applicants?.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Total Placed</p>
                        <p className="text-2xl font-bold text-green-600">{fairness.total_placed?.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Disparate Impact Ratio</p>
                        <p className={`text-2xl font-bold ${disparateImpact >= 0.8 ? 'text-green-600' : 'text-red-600'}`}>
                            {disparateImpact.toFixed(3)}
                        </p>
                    </div>
                </div>

                {/* Category-wise Placement Rates */}
                <div className="p-6 border rounded-lg">
                    <h3 className="font-semibold mb-4">Placement Rates by Category</h3>
                    <div className="space-y-4">
                        {categories.map(cat => {
                            const data = fairness.category_wise[cat];
                            const pctWidth = Math.min(data.placement_rate * 100 * 2, 100);
                            return (
                                <div key={cat} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{cat}</span>
                                        <span className="text-muted-foreground">
                                            {data.placed?.toLocaleString()} / {data.eligible?.toLocaleString()} ({(data.placement_rate * 100).toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full ${categoryColors[cat] || 'bg-primary'} transition-all duration-500`} style={{ width: `${pctWidth}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Gender Distribution */}
                    <div className="p-6 border rounded-lg">
                        <h3 className="font-semibold mb-4">Gender Distribution (Placed)</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full" />Male</span>
                                <span className="font-medium">{genderM.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-pink-500 rounded-full" />Female</span>
                                <span className="font-medium">{genderF.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500 rounded-full" />Other</span>
                                <span className="font-medium">{genderO.toLocaleString()}</span>
                            </div>
                        </div>
                        {genderTotal > 0 && (
                            <div className="mt-4 h-4 bg-muted rounded-full overflow-hidden flex">
                                <div className="bg-blue-500" style={{ width: `${(genderM / genderTotal) * 100}%` }} />
                                <div className="bg-pink-500" style={{ width: `${(genderF / genderTotal) * 100}%` }} />
                                <div className="bg-purple-500" style={{ width: `${(genderO / genderTotal) * 100}%` }} />
                            </div>
                        )}
                    </div>

                    {/* Rural/Urban Distribution */}
                    <div className="p-6 border rounded-lg">
                        <h3 className="font-semibold mb-4">Rural/Urban Statistics</h3>
                        {ruralData.eligible !== undefined ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span>Rural Eligible</span>
                                    <span className="font-medium">{ruralData.eligible?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Rural Placed</span>
                                    <span className="font-medium text-green-600">{ruralData.placed?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Rural Placement Rate</span>
                                    <span className="font-bold text-primary">{((ruralData.placement_rate || 0) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(ruralData).map(([key, val]: [string, any]) => (
                                    <div key={key} className="flex justify-between items-center">
                                        <span>{key === 'true' || key === 'Yes' ? 'Rural' : 'Urban'}</span>
                                        <span className="font-medium">{val.placed?.toLocaleString()} / {val.eligible?.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Boost Report Summary */}
                {boost_report && (
                    <div className="p-6 border rounded-lg bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/10 dark:to-yellow-900/10">
                        <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-orange-500" /> Boost Impact Report</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Boosted Students</p>
                                <p className="text-xl font-bold">{boost_report.boosted_students?.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Boosted & Selected</p>
                                <p className="text-xl font-bold text-green-600">{boost_report.boosted_selected?.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Uplift Success Rate</p>
                                <p className="text-xl font-bold text-orange-600">{((boost_report.uplift_success_rate || 0) * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Counterfactual Helped</p>
                                <p className="text-xl font-bold text-blue-600">{boost_report.counterfactual_helped_students?.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// --------------------------------------------------------------------------------
// --- ROUND LOGS PANEL ---
// --------------------------------------------------------------------------------

const RoundLogsPanel = ({ dashboardData }: { dashboardData: DashboardData | null }) => {
    if (!dashboardData?.fairness) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-green-500" /> Allocation Round Logs</CardTitle>
                    <CardDescription>Run allocation to view round logs</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                        No round logs available. Please run an allocation first.
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { fairness } = dashboardData;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-green-500" /> Allocation Round Logs</CardTitle>
                <CardDescription>Statistics from the allocation round ({fairness.total_applicants?.toLocaleString()} applicants)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Round Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Total Applicants</p>
                        <p className="text-2xl font-bold text-blue-600">{fairness.total_applicants?.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Total Placed</p>
                        <p className="text-2xl font-bold text-green-600">{fairness.total_placed?.toLocaleString()}</p>
                    </div>
                </div>

                {/* Category Stats Table */}
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                {['Category', 'Eligible', 'Placed', 'Placement Rate'].map(header => (
                                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {Object.entries(fairness.category_wise || {}).map(([cat, data]: [string, any]) => (
                                <tr key={cat} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-4 py-3 font-medium">{cat}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{data.eligible?.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{data.placed?.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={data.placement_rate >= 0.25 ? "default" : "secondary"}>
                                            {(data.placement_rate * 100).toFixed(1)}%
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

// --------------------------------------------------------------------------------
// --- PER STUDENT TABLE PANEL ---
// --------------------------------------------------------------------------------

const PerStudentTablePanel = ({ dashboardData }: { dashboardData: DashboardData | null }) => {
    const [selectedAllocation, setSelectedAllocation] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPref, setFilterPref] = useState<number | null>(null);

    if (!dashboardData?.allocations || dashboardData.allocations.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-orange-500" /> Allocation Records</CardTitle>
                    <CardDescription>Run allocation to view student placements</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                        No allocation data available. Please run an allocation first.
                    </div>
                </CardContent>
            </Card>
        );
    }

    const allocations = dashboardData.allocations;
    const filteredAllocations = allocations.filter(alloc => {
        const matchesSearch = alloc.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            alloc.internship_id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPref = filterPref === null || alloc.pref_rank === filterPref;
        return matchesSearch && matchesPref;
    });

    const prefRankCounts = allocations.reduce((acc: Record<number, number>, alloc) => {
        acc[alloc.pref_rank] = (acc[alloc.pref_rank] || 0) + 1;
        return acc;
    }, {});

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-orange-500" /> Allocation Records</CardTitle>
                <CardDescription>{dashboardData.allocations_count?.toLocaleString()} students allocated</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center cursor-pointer" onClick={() => setFilterPref(1)}>
                        <p className="text-xs text-muted-foreground">1st Preference</p>
                        <p className="text-xl font-bold text-green-600">{(prefRankCounts[1] || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center cursor-pointer" onClick={() => setFilterPref(2)}>
                        <p className="text-xs text-muted-foreground">2nd Preference</p>
                        <p className="text-xl font-bold text-blue-600">{(prefRankCounts[2] || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center cursor-pointer" onClick={() => setFilterPref(3)}>
                        <p className="text-xs text-muted-foreground">3rd Preference</p>
                        <p className="text-xl font-bold text-yellow-600">{(prefRankCounts[3] || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg text-center cursor-pointer" onClick={() => setFilterPref(null)}>
                        <p className="text-xs text-muted-foreground">All Preferences</p>
                        <p className="text-xl font-bold">{allocations.length.toLocaleString()}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by Student ID or Internship ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                                <tr>
                                    {['Student ID', 'Internship ID', 'Preference Rank'].map(header => (
                                        <th key={header} className="px-4 py-3 font-medium bg-muted/50">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredAllocations.slice(0, 100).map((alloc) => (
                                    <tr key={`${alloc.student_id}-${alloc.internship_id}`}
                                        className={`cursor-pointer transition-colors ${selectedAllocation?.student_id === alloc.student_id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                                        onClick={() => setSelectedAllocation(alloc)}>
                                        <td className="px-4 py-3 font-mono font-medium">{alloc.student_id}</td>
                                        <td className="px-4 py-3 font-mono text-muted-foreground">{alloc.internship_id}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant={alloc.pref_rank === 1 ? "default" : alloc.pref_rank === 2 ? "secondary" : "outline"}>
                                                #{alloc.pref_rank}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredAllocations.length > 100 && (
                        <div className="p-2 text-center text-sm text-muted-foreground bg-muted/30">
                            Showing 100 of {filteredAllocations.length.toLocaleString()} records
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

// --------------------------------------------------------------------------------
// --- OTHER PANELS ---
// --------------------------------------------------------------------------------

const ModelExplanationPanel = () => (
    <div className="space-y-6">
        {/* Hero Header */}
        <Card className="bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-indigo-950/30 border-0 shadow-lg">
            <CardContent className="p-8">
                <div className="flex items-start gap-6">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                        <Tractor className="h-10 w-10 text-white" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Internship Allocation Model
                        </h1>
                        <p className="text-lg text-muted-foreground mt-2 max-w-3xl">
                            A sophisticated matching algorithm designed for the PM Internship Scheme, ensuring fair, transparent, and optimal allocation of internships to eligible candidates.
                        </p>
                        <div className="flex items-center gap-4 mt-4">
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1">
                                <Check className="h-3 w-3 mr-1" /> Stable Matching
                            </Badge>
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1">
                                <Shield className="h-3 w-3 mr-1" /> Reservation Policy Compliant
                            </Badge>
                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-3 py-1">
                                <Zap className="h-3 w-3 mr-1" /> ML-Optimized
                            </Badge>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Algorithm Overview Section */}
        <div className="grid gap-6">
            <Card className="border-l-4 border-l-purple-500">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                        <Zap className="h-5 w-5" />
                        ML Enhancement Layer
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Traditional Gale-Shapley is enhanced with <strong className="text-foreground">Machine Learning-based scoring</strong> that considers multiple factors to predict optimal matches and improve outcomes.
                    </p>
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-purple-500" />
                            ML Features Used
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-1.5 ml-6">
                            <li className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                                <span>Academic performance (CGPA, marks)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                                <span>Skill-to-requirement matching scores</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                                <span>Geographic preference alignment</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                                <span>Historical placement success patterns</span>
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Process Flow Section */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-green-500" />
                    Allocation Process Flow
                </CardTitle>
                <CardDescription>Step-by-step breakdown of how allocations are determined</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-5 gap-4">
                    {[
                        { step: 1, title: "Data Collection", desc: "Student profiles, preferences, and internship requirements are gathered", icon: Users, color: "blue" },
                        { step: 2, title: "Score Calculation", desc: "ML model computes compatibility scores for each student-internship pair", icon: TrendingUp, color: "purple" },
                        { step: 3, title: "Preference Ranking", desc: "Students submit ranked preferences; companies define selection criteria", icon: Scale, color: "indigo" },
                        { step: 4, title: "Matching Rounds", desc: "Deferred acceptance algorithm runs iteratively until stable matching", icon: Zap, color: "orange" },
                        { step: 5, title: "Final Allocation", desc: "Verified results with fairness metrics and category-wise distribution", icon: Check, color: "green" },
                    ].map(({ step, title, desc, icon: Icon, color }) => (
                        <div key={step} className="relative">
                            <div className={`p-4 rounded-xl border-2 border-${color}-200 dark:border-${color}-800 bg-gradient-to-b from-${color}-50 to-white dark:from-${color}-950/20 dark:to-background h-full`}>
                                <div className={`w-10 h-10 rounded-full bg-${color}-500 text-white flex items-center justify-center font-bold text-lg mb-3 shadow-md`}>
                                    {step}
                                </div>
                                <h4 className="font-semibold text-sm mb-1">{title}</h4>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                            {step < 5 && (
                                <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 text-muted-foreground">
                                    →
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        {/* Technical Details Grid */}
        <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-0">
                <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                        <Check className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">100% Transparency</h3>
                    <p className="text-sm text-muted-foreground">
                        Every allocation decision is logged with full audit trail. No black-box decisions.
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-0">
                <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                        <Scale className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Fairness Verified</h3>
                    <p className="text-sm text-muted-foreground">
                        Statistical parity metrics ensure equal opportunity across demographics.
                    </p>
                </CardContent>
            </Card>
        </div>
    </div>
);

const ReportsExportsPanel = ({ toast }: { toast?: any }) => {
    const [downloading, setDownloading] = useState<string | null>(null);

    const handleMLDownload = async (filename: string, displayName: string) => {
        setDownloading(filename);
        try {
            if (toast) toast({ title: `Downloading ${displayName}...`, description: "Please wait" });
            const blob = await downloadFile(filename);
            triggerDownload(blob, filename);
            if (toast) toast({ title: `✓ ${displayName} downloaded!` });
        } catch (error: any) {
            console.error("Download failed:", error);
            if (toast) toast({ title: "Download Failed", description: error.message || `Could not download ${displayName}.`, variant: "destructive" });
        } finally {
            setDownloading(null);
        }
    };

    const handleDatabaseCSV = async (endpoint: string, filename: string, displayName: string) => {
        setDownloading(endpoint);
        try {
            if (toast) toast({ title: `Downloading ${displayName}...`, description: "Please wait" });
            const response = await fetch(endpoint, { credentials: "include" });
            if (!response.ok) throw new Error(`Failed to download ${displayName}`);
            const blob = await response.blob();
            triggerDownload(blob, filename);
            if (toast) toast({ title: `✓ ${displayName} downloaded!` });
        } catch (error: any) {
            console.error("Download failed:", error);
            if (toast) toast({ title: "Download Failed", description: error.message || `Could not download ${displayName}.`, variant: "destructive" });
        } finally {
            setDownloading(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-teal-500" /> Reports & Exports</CardTitle>
                <CardDescription>Download database records and ML-generated reports.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Database Tables Section */}
                <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Users className="h-4 w-4" /> Database Tables
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                            <CardContent className="p-6 space-y-4">
                                <h4 className="font-semibold">Students (Candidates)</h4>
                                <p className="text-sm text-muted-foreground">Download all registered students from the database.</p>
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                    onClick={() => handleDatabaseCSV("/api/admin/download/students.csv", "students.csv", "Students CSV")}
                                    disabled={downloading === "/api/admin/download/students.csv"}
                                >
                                    {downloading === "/api/admin/download/students.csv" ? (
                                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Downloading...</>
                                    ) : (
                                        <>Download Students CSV</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                        <Card className="bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
                            <CardContent className="p-6 space-y-4">
                                <h4 className="font-semibold">Internships</h4>
                                <p className="text-sm text-muted-foreground">Download all internship listings from the database.</p>
                                <Button
                                    className="w-full bg-purple-600 hover:bg-purple-700"
                                    onClick={() => handleDatabaseCSV("/api/admin/download/internships.csv", "internships.csv", "Internships CSV")}
                                    disabled={downloading === "/api/admin/download/internships.csv"}
                                >
                                    {downloading === "/api/admin/download/internships.csv" ? (
                                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Downloading...</>
                                    ) : (
                                        <>Download Internships CSV</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* ML Generated Reports Section */}
                <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> ML Generated Reports
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-teal-50/50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800">
                            <CardContent className="p-6 space-y-4">
                                <h4 className="font-semibold">Final Allocations</h4>
                                <p className="text-sm text-muted-foreground">Complete allocation results CSV.</p>
                                <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => handleMLDownload("final_allocations.csv", "Final Allocations")} disabled={downloading === "final_allocations.csv"}>
                                    {downloading === "final_allocations.csv" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Downloading...</> : <>Export Allocations</>}
                                </Button>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <h4 className="font-semibold text-primary">Fairness Report</h4>
                                <p className="text-sm text-muted-foreground">Fairness analysis across categories.</p>
                                <Button variant="outline" className="w-full" onClick={() => handleMLDownload("final_fairness_report.json", "Fairness Report")} disabled={downloading === "final_fairness_report.json"}>
                                    {downloading === "final_fairness_report.json" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Downloading...</> : <>Export Fairness</>}
                                </Button>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <h4 className="font-semibold text-primary">Boost Impact</h4>
                                <p className="text-sm text-muted-foreground">Analysis of boost effects.</p>
                                <Button variant="outline" className="w-full" onClick={() => handleMLDownload("student_boost_impact.json", "Boost Impact")} disabled={downloading === "student_boost_impact.json"}>
                                    {downloading === "student_boost_impact.json" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Downloading...</> : <>Export Boost Impact</>}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// --------------------------------------------------------------------------------
// --- VERIFICATION REQUESTS PANEL ---
// --------------------------------------------------------------------------------

interface ObjectionRequest {
    token: string;
    email: string;
    name: string;
    detectedWord: string;
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string;
}

const VerificationRequestsPanel = ({ toast }: { toast?: any }) => {
    const [objections, setObjections] = useState<ObjectionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    const fetchObjections = async () => {
        try {
            const response = await fetch('/api/admin/objections', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setObjections(data);
            }
        } catch (error) {
            console.error('Failed to fetch objections:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchObjections(); }, []);

    const handleAction = async (token: string, action: 'approve' | 'reject') => {
        setProcessing(token);
        try {
            const response = await fetch(`/api/admin/objection/${token}/${action}`, {
                method: 'POST',
                credentials: 'include',
            });
            if (response.ok) {
                toast?.({ title: `✓ Objection ${action}d` });
                fetchObjections();
            } else {
                toast?.({ title: 'Action failed', variant: 'destructive' });
            }
        } catch (error) {
            toast?.({ title: 'Action failed', variant: 'destructive' });
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Verification Requests
                </CardTitle>
                <CardDescription>
                    Review objections from users who believe their registration was incorrectly blocked.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {objections.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                        <div className="text-center">
                            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                            <p>No pending verification requests</p>
                            <p className="text-sm">All clear! No objections need review.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {objections.map((obj) => (
                            <Card key={obj.token} className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-medium">{obj.name}</p>
                                            <p className="text-sm text-muted-foreground">{obj.email}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-amber-100">
                                            Pending Review
                                        </Badge>
                                    </div>
                                    <div className="text-sm">
                                        <p className="text-muted-foreground">Detected word: <span className="font-mono bg-red-100 text-red-700 px-1 rounded">{obj.detectedWord}</span></p>
                                        <p className="text-muted-foreground">Submitted: {new Date(obj.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    {obj.reason && (
                                        <div className="p-3 bg-white dark:bg-background rounded border">
                                            <p className="text-sm font-medium">User's Reason:</p>
                                            <p className="text-sm text-muted-foreground">{obj.reason}</p>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => handleAction(obj.token, 'approve')}
                                            disabled={processing === obj.token}
                                        >
                                            {processing === obj.token ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleAction(obj.token, 'reject')}
                                            disabled={processing === obj.token}
                                        >
                                            {processing === obj.token ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                                            Reject
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


// --------------------------------------------------------------------------------
// --- MAIN ADMIN PORTAL ---
// --------------------------------------------------------------------------------

const tabData = [
    { value: "dashboard", icon: LayoutDashboard, label: "Dashboard", testId: "tab-admin-dashboard" },
    { value: "verification", icon: AlertTriangle, label: "Verify", testId: "tab-verification" },
    { value: "audit", icon: ClipboardList, label: "Audit", testId: "tab-audit" },
    { value: "fairness", icon: Scale, label: "Fairness", testId: "tab-fairness" },
    { value: "roundlogs", icon: Clock, label: "Round Logs", testId: "tab-round-logs" },
    { value: "perstudent", icon: Users, label: "Students", testId: "tab-per-student" },
    { value: "explanation", icon: Tractor, label: "Model", testId: "tab-explanation" },
    { value: "reports", icon: Download, label: "Reports", testId: "tab-reports" },
];

export default function AdminPortal() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isAllocating, setIsAllocating] = useState(false);
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [allocationStep, setAllocationStep] = useState("");
    const [uploadProgress, setUploadProgress] = useState({ students: false, internships: false });

    const fetchDashboard = async () => {
        try {
            const data = await getDashboardData();
            setDashboardData(data);
        } catch (error) {
            console.error("Failed to fetch dashboard:", error);
        }
    };

    useEffect(() => { fetchDashboard(); }, []);

    const startAllocation = async (studentsFile: File, internshipsFile: File) => {
        setIsAllocating(true);
        setUploadProgress({ students: false, internships: false });

        try {
            setAllocationStep("Uploading students data...");
            await uploadStudentsCSV(studentsFile);
            setUploadProgress(prev => ({ ...prev, students: true }));
            toast({ title: "✓ Students CSV uploaded" });

            setAllocationStep("Uploading internships data...");
            await uploadInternshipsCSV(internshipsFile);
            setUploadProgress(prev => ({ ...prev, internships: true }));
            toast({ title: "✓ Internships CSV uploaded" });

            setAllocationStep("Training ML model...");
            toast({ title: "Training model...", description: "This may take a few minutes" });
            await trainModel();
            toast({ title: "✓ Model training completed" });

            setAllocationStep("Starting allocation algorithm...");
            await allocateInternships((status, elapsed) => {
                setAllocationStep(`${status} (${elapsed}s elapsed)`);
            });
            toast({ title: "✓ Allocation completed!" });

            setAllocationStep("Loading results...");
            await fetchDashboard();
            toast({ title: "Allocation Complete!", description: "Results are now available." });
        } catch (error: any) {
            console.error("Allocation failed:", error);
            toast({ title: "Allocation Failed", description: error.message || "An error occurred.", variant: "destructive" });
        } finally {
            setIsAllocating(false);
            setAllocationStep("");
        }
    };

    const generateResults = async () => {
        try {
            toast({ title: "Downloading allocations...", description: "Please wait" });
            const blob = await downloadFile("final_allocations.csv");
            triggerDownload(blob, "final_allocations.csv");
            toast({ title: "✓ Download complete!" });
        } catch (error: any) {
            console.error("Download failed:", error);
            toast({ title: "Download Failed", description: error.message || "Could not download.", variant: "destructive" });
        }
    };

    const handleFilesSelected = (internship: File, candidate: File) => {
        startAllocation(candidate, internship);
    };

    const syncFromDatabase = async () => {
        setIsAllocating(true);
        setUploadProgress({ students: false, internships: false });

        try {
            setAllocationStep("Syncing data from database and uploading to ML...");
            toast({ title: "Syncing...", description: "Uploading database data to ML backend" });

            const syncResponse = await fetch("/api/admin/ml/sync", {
                method: "POST",
                credentials: "include",
            });

            if (!syncResponse.ok) {
                const errText = await syncResponse.text();
                throw new Error(`Sync failed: ${errText}`);
            }

            setUploadProgress({ students: true, internships: true });
            toast({ title: "✓ Data synced and model trained!" });

            setAllocationStep("Starting allocation algorithm...");
            await allocateInternships((status, elapsed) => {
                setAllocationStep(`${status} (${elapsed}s elapsed)`);
            });
            toast({ title: "✓ Allocation completed!" });

            setAllocationStep("Loading results...");
            await fetchDashboard();
            toast({ title: "Allocation Complete!", description: "Results are now available." });
        } catch (error: any) {
            console.error("Sync allocation failed:", error);
            toast({ title: "Allocation Failed", description: error.message || "An error occurred.", variant: "destructive" });
        } finally {
            setIsAllocating(false);
            setAllocationStep("");
        }
    };

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header showNav={false} />
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Portal Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-primary/10"><Shield className="h-8 w-8 text-primary" /></div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
                            <p className="text-muted-foreground">Central oversight dashboard for Allocation & Auditing</p>
                        </div>
                    </div>
                    <div className="mt-4 sm:mt-0"><LogoutButton /></div>
                </div>

                {/* Tabs Component */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <ScrollArea className="w-full pb-2">
                        <TabsList className="inline-flex h-auto p-1 w-full justify-start sm:justify-center">
                            {tabData.map(({ value, icon: Icon, label, testId }) => (
                                <TabsTrigger key={value} value={value} data-testid={testId} className="gap-2 py-2.5 px-4">
                                    <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </ScrollArea>

                    <div className="mt-6">
                        <TabsContent value="dashboard" className="m-0">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                <AdminDashboard isAllocating={isAllocating} onFilesSelected={handleFilesSelected} onSyncFromDatabase={syncFromDatabase} generateResults={generateResults} dashboardData={dashboardData} allocationStep={allocationStep} uploadProgress={uploadProgress} />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="verification" className="m-0">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                <VerificationRequestsPanel toast={toast} />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="fairness" className="m-0">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                <FairnessMetricsPanel dashboardData={dashboardData} />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="roundlogs" className="m-0">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                <RoundLogsPanel dashboardData={dashboardData} />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="perstudent" className="m-0">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                <PerStudentTablePanel dashboardData={dashboardData} />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="explanation" className="m-0">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                <ModelExplanationPanel />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="reports" className="m-0">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                <ReportsExportsPanel toast={toast} />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="audit" className="m-0">
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                <AuditPanel />
                            </motion.div>
                        </TabsContent>

                    </div>
                </Tabs>
            </div>
        </div>
    );
}