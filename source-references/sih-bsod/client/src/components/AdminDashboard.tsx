import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Building2, 
  Briefcase, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3
} from "lucide-react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { useState } from "react";

export function AdminDashboard() {
  const [policySettings, setPolicySettings] = useState({
    ruralQuota: 30,
    womenQuota: 33,
    pwdQuota: 5,
    minStipend: 15000,
  });

  // todo: remove mock functionality - replace with real metrics data
  const stats = [
    { icon: Users, label: "Total Students", value: "1,25,000", change: "+12%", color: "text-blue-500" },
    { icon: Building2, label: "Registered Companies", value: "2,500", change: "+8%", color: "text-purple-500" },
    { icon: Briefcase, label: "Active Internships", value: "45,000", change: "+15%", color: "text-green-500" },
    { icon: TrendingUp, label: "Placement Rate", value: "94%", change: "+3%", color: "text-orange-500" },
  ];

  const dailyMetrics = [
    { date: "Jan 24", applications: 1200, matches: 890, placements: 320 },
    { date: "Jan 25", applications: 1350, matches: 920, placements: 380 },
    { date: "Jan 26", applications: 980, matches: 750, placements: 290 },
    { date: "Jan 27", applications: 1500, matches: 1100, placements: 420 },
    { date: "Jan 28", applications: 1650, matches: 1250, placements: 480 },
    { date: "Jan 29", applications: 1400, matches: 1050, placements: 410 },
    { date: "Jan 30", applications: 1800, matches: 1400, placements: 550 },
  ];

  const alerts = [
    { id: 1, type: "warning", message: "15 companies pending verification for >7 days", time: "2 hours ago" },
    { id: 2, type: "info", message: "New policy circular ready for distribution", time: "5 hours ago" },
    { id: 3, type: "success", message: "Monthly target of 5000 placements achieved", time: "1 day ago" },
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "warning": return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "info": return <Clock className="h-5 w-5 text-blue-500" />;
      case "success": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                    {stat.change}
                  </Badge>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Daily Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyMetrics}>
                  <defs>
                    <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area type="monotone" dataKey="applications" stroke="hsl(var(--chart-1))" fill="url(#colorApplications)" />
                  <Area type="monotone" dataKey="matches" stroke="hsl(var(--chart-2))" fill="url(#colorMatches)" />
                  <Line type="monotone" dataKey="placements" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-1" />
                <span className="text-sm text-muted-foreground">Applications</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <span className="text-sm text-muted-foreground">Matches</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <span className="text-sm text-muted-foreground">Placements</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Policy Sliders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Rural Quota</Label>
                  <span className="text-sm font-medium">{policySettings.ruralQuota}%</span>
                </div>
                <Slider
                  value={[policySettings.ruralQuota]}
                  onValueChange={([value]) => setPolicySettings(prev => ({ ...prev, ruralQuota: value }))}
                  max={50}
                  step={1}
                  data-testid="slider-rural-quota"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Women Quota</Label>
                  <span className="text-sm font-medium">{policySettings.womenQuota}%</span>
                </div>
                <Slider
                  value={[policySettings.womenQuota]}
                  onValueChange={([value]) => setPolicySettings(prev => ({ ...prev, womenQuota: value }))}
                  max={50}
                  step={1}
                  data-testid="slider-women-quota"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>PwD Quota</Label>
                  <span className="text-sm font-medium">{policySettings.pwdQuota}%</span>
                </div>
                <Slider
                  value={[policySettings.pwdQuota]}
                  onValueChange={([value]) => setPolicySettings(prev => ({ ...prev, pwdQuota: value }))}
                  max={10}
                  step={1}
                  data-testid="slider-pwd-quota"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Min Stipend</Label>
                  <span className="text-sm font-medium">₹{policySettings.minStipend.toLocaleString()}</span>
                </div>
                <Slider
                  value={[policySettings.minStipend]}
                  onValueChange={([value]) => setPolicySettings(prev => ({ ...prev, minStipend: value }))}
                  min={5000}
                  max={30000}
                  step={1000}
                  data-testid="slider-min-stipend"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`alert-${alert.id}`}>
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
