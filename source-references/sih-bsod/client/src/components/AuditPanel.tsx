import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Users,
    Shield,
    Zap,
    UserPlus,
    UserMinus,
    Activity,
    RefreshCw,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';

// Types for audit data
interface AuditSession {
    id: number;
    userId: number | null;
    username: string;
    role: string;
    loginAt: string;
    logoutAt: string | null;
    isActive: boolean;
}

interface AuditUserEvent {
    id: number;
    eventType: 'created' | 'deleted';
    userId: number | null;
    username: string;
    role: string;
    performedBy: number | null;
    performedByUsername: string | null;
    eventAt: string;
}

interface AuditAllocationRun {
    id: number;
    runNumber: number;
    runBy: number | null;
    runByUsername: string | null;
    runAt: string;
    completedAt: string | null;
    status: 'started' | 'completed' | 'failed';
    studentsProcessed: number | null;
    allocationsCreated: number | null;
    durationMs: number | null;
    errorMessage: string | null;
}

interface AuditSummary {
    totalSessions: number;
    activeSessions: number;
    totalUserEvents: number;
    totalAllocationRuns: number;
    lastAllocationRun: AuditAllocationRun | null;
}

// Helper function to format dates
function formatDate(dateString: string | null): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Helper to format duration
function formatDuration(ms: number | null): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function AuditPanel() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<AuditSummary | null>(null);
    const [sessions, setSessions] = useState<AuditSession[]>([]);
    const [activeSessions, setActiveSessions] = useState<AuditSession[]>([]);
    const [adminSessions, setAdminSessions] = useState<AuditSession[]>([]);
    const [userEvents, setUserEvents] = useState<AuditUserEvent[]>([]);
    const [allocationRuns, setAllocationRuns] = useState<AuditAllocationRun[]>([]);
    const [allocationCount, setAllocationCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAuditData = async () => {
        try {
            console.log('[AuditPanel] Fetching audit data...');

            const [summaryRes, sessionsRes, activeRes, adminRes, eventsRes, allocRes] = await Promise.all([
                fetch('/api/admin/audit/summary', { credentials: 'include' }),
                fetch('/api/admin/audit/sessions?limit=50', { credentials: 'include' }),
                fetch('/api/admin/audit/sessions/active', { credentials: 'include' }),
                fetch('/api/admin/audit/sessions/admin?limit=30', { credentials: 'include' }),
                fetch('/api/admin/audit/user-events?limit=50', { credentials: 'include' }),
                fetch('/api/admin/audit/allocations?limit=30', { credentials: 'include' }),
            ]);

            console.log('[AuditPanel] Response statuses:', {
                summary: summaryRes.status,
                sessions: sessionsRes.status,
                active: activeRes.status,
                admin: adminRes.status,
                events: eventsRes.status,
                alloc: allocRes.status
            });

            if (summaryRes.ok) {
                const data = await summaryRes.json();
                console.log('[AuditPanel] Summary:', data);
                setSummary(data);
            } else {
                console.error('[AuditPanel] Summary error:', await summaryRes.text());
            }

            if (sessionsRes.ok) {
                const data = await sessionsRes.json();
                console.log('[AuditPanel] Sessions:', data);
                setSessions(data);
            } else {
                console.error('[AuditPanel] Sessions error:', await sessionsRes.text());
            }

            if (activeRes.ok) {
                const data = await activeRes.json();
                console.log('[AuditPanel] Active sessions:', data);
                setActiveSessions(data);
            }

            if (adminRes.ok) {
                const data = await adminRes.json();
                console.log('[AuditPanel] Admin sessions:', data);
                setAdminSessions(data);
            }

            if (eventsRes.ok) {
                const data = await eventsRes.json();
                console.log('[AuditPanel] User events:', data);
                setUserEvents(data);
            }

            if (allocRes.ok) {
                const allocData = await allocRes.json();
                console.log('[AuditPanel] Allocation runs:', allocData);
                setAllocationRuns(allocData.runs || []);
                setAllocationCount(allocData.totalCount || 0);
            }
        } catch (err) {
            console.error('[AuditPanel] Failed to fetch audit data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAuditData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchAuditData, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAuditData();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{summary?.activeSessions || 0}</p>
                                <p className="text-xs text-muted-foreground">Active Sessions</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{allocationCount}</p>
                                <p className="text-xs text-muted-foreground">Allocation Runs</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Refresh Button */}
            <div className="flex justify-end">
                <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="active" className="space-y-4">
                <TabsList className="grid grid-cols-4 w-full max-w-xl">
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="all-sessions">All Sessions</TabsTrigger>
                    <TabsTrigger value="admin-sessions">Admin Logins</TabsTrigger>
                    <TabsTrigger value="allocations">Allocations</TabsTrigger>
                </TabsList>

                {/* Active Sessions Tab */}
                <TabsContent value="active">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-green-500" />
                                Active User Sessions
                            </CardTitle>
                            <CardDescription>Currently logged-in users</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {activeSessions.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No active sessions</p>
                            ) : (
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-2">
                                        {activeSessions.map((session) => (
                                            <div key={session.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                    <div>
                                                        <p className="font-medium">{session.username}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Logged in {formatDate(session.loginAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant={session.role === 'admin' ? 'default' : 'secondary'}>
                                                    {session.role}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* All Sessions Tab */}
                <TabsContent value="all-sessions">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-blue-500" />
                                Session History
                            </CardTitle>
                            <CardDescription>All user login sessions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left p-3">Username</th>
                                            <th className="text-left p-3">Role</th>
                                            <th className="text-left p-3">Login Time</th>
                                            <th className="text-left p-3">Logout Time</th>
                                            <th className="text-left p-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {sessions.map((session) => (
                                            <tr key={session.id} className="hover:bg-muted/30">
                                                <td className="p-3 font-medium">{session.username}</td>
                                                <td className="p-3">
                                                    <Badge variant="outline">{session.role}</Badge>
                                                </td>
                                                <td className="p-3 text-muted-foreground">{formatDate(session.loginAt)}</td>
                                                <td className="p-3 text-muted-foreground">{formatDate(session.logoutAt)}</td>
                                                <td className="p-3">
                                                    {session.isActive ? (
                                                        <Badge variant="default" className="bg-green-600">Active</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Ended</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Admin Sessions Tab */}
                <TabsContent value="admin-sessions">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-yellow-500" />
                                Admin Login Sessions
                            </CardTitle>
                            <CardDescription>Admin user login history</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {adminSessions.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No admin sessions recorded</p>
                            ) : (
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-2">
                                        {adminSessions.map((session) => (
                                            <div key={session.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                                <div className="flex items-center gap-3">
                                                    <Shield className="h-5 w-5 text-yellow-600" />
                                                    <div>
                                                        <p className="font-semibold">{session.username}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatDate(session.loginAt)}
                                                            {session.logoutAt && ` — ${formatDate(session.logoutAt)}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                {session.isActive ? (
                                                    <Badge className="bg-green-600">Active Now</Badge>
                                                ) : (
                                                    <Badge variant="outline">Session Ended</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Allocation Runs Tab */}
                <TabsContent value="allocations">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-purple-500" />
                                Allocation Run History
                                <Badge variant="secondary" className="ml-2">
                                    {allocationCount} total
                                </Badge>
                            </CardTitle>
                            <CardDescription>History of allocation process executions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {allocationRuns.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No allocations have been run yet</p>
                            ) : (
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-3">
                                        {allocationRuns.map((run) => (
                                            <div key={run.id} className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg font-bold text-purple-600">#{run.runNumber}</span>
                                                        {run.status === 'completed' && (
                                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                        )}
                                                        {run.status === 'failed' && (
                                                            <XCircle className="h-5 w-5 text-red-500" />
                                                        )}
                                                        {run.status === 'started' && (
                                                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                                        )}
                                                    </div>
                                                    <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                                                        {run.status}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                                    <div>
                                                        <p className="text-muted-foreground">Run By</p>
                                                        <p className="font-medium">{run.runByUsername || 'System'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Started</p>
                                                        <p className="font-medium">{formatDate(run.runAt)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Students</p>
                                                        <p className="font-medium">{run.studentsProcessed?.toLocaleString() || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Allocations</p>
                                                        <p className="font-medium text-green-600">{run.allocationsCreated?.toLocaleString() || '—'}</p>
                                                    </div>
                                                </div>
                                                {run.durationMs && (
                                                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        Duration: {formatDuration(run.durationMs)}
                                                    </div>
                                                )}
                                                {run.errorMessage && (
                                                    <p className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                                        Error: {run.errorMessage}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
