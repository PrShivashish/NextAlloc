import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Bell, 
  Send, 
  Plus,
  Clock,
  Users,
  Building2,
  Eye
} from "lucide-react";
import { motion } from "framer-motion";

interface Circular {
  id: number;
  title: string;
  category: string;
  publishedDate: string;
  targetAudience: string[];
  status: "draft" | "published";
}

interface Notification {
  id: number;
  title: string;
  message: string;
  sentTo: string;
  sentDate: string;
  readRate: number;
}

export function OperationsCenter() {
  const [newCircular, setNewCircular] = useState({
    title: "",
    content: "",
    category: "",
    audience: [] as string[],
  });

  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    target: "",
  });

  // todo: remove mock functionality - replace with real data
  const circulars: Circular[] = [
    { id: 1, title: "Updated Stipend Guidelines 2024", category: "Policy", publishedDate: "2024-01-28", targetAudience: ["companies", "students"], status: "published" },
    { id: 2, title: "New Registration Requirements", category: "Compliance", publishedDate: "2024-01-25", targetAudience: ["companies"], status: "published" },
    { id: 3, title: "Holiday Schedule Q1 2024", category: "General", publishedDate: "2024-01-20", targetAudience: ["students", "companies"], status: "published" },
  ];

  const notifications: Notification[] = [
    { id: 1, title: "Application Deadline Reminder", message: "Last date to apply for Feb batch", sentTo: "All Students", sentDate: "2024-01-28", readRate: 78 },
    { id: 2, title: "Profile Update Required", message: "Please update your company details", sentTo: "Companies with incomplete profiles", sentDate: "2024-01-27", readRate: 45 },
    { id: 3, title: "New Opportunities Available", message: "500 new internships added in IT sector", sentTo: "Students in IT stream", sentDate: "2024-01-26", readRate: 92 },
  ];

  const toggleAudience = (audience: string) => {
    setNewCircular(prev => ({
      ...prev,
      audience: prev.audience.includes(audience)
        ? prev.audience.filter(a => a !== audience)
        : [...prev.audience, audience]
    }));
  };

  const handlePublishCircular = () => {
    console.log("Publishing circular:", newCircular);
    setNewCircular({ title: "", content: "", category: "", audience: [] });
  };

  const handleSendNotification = () => {
    console.log("Sending notification:", newNotification);
    setNewNotification({ title: "", message: "", target: "" });
  };

  return (
    <div className="space-y-6" data-testid="operations-center">
      <div>
        <h2 className="text-2xl font-bold">Operations Center</h2>
        <p className="text-muted-foreground">Manage circulars and broadcast notifications</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Create Circular
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="circular-title">Title</Label>
              <Input
                id="circular-title"
                placeholder="Circular title..."
                value={newCircular.title}
                onChange={(e) => setNewCircular(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-circular-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="circular-category">Category</Label>
              <Select
                value={newCircular.category}
                onValueChange={(value) => setNewCircular(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger data-testid="select-circular-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="circular-content">Content</Label>
              <Textarea
                id="circular-content"
                placeholder="Circular content..."
                className="min-h-[150px]"
                value={newCircular.content}
                onChange={(e) => setNewCircular(prev => ({ ...prev, content: e.target.value }))}
                data-testid="textarea-circular-content"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="students"
                    checked={newCircular.audience.includes("students")}
                    onCheckedChange={() => toggleAudience("students")}
                    data-testid="checkbox-students"
                  />
                  <label htmlFor="students" className="text-sm flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Students
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="companies"
                    checked={newCircular.audience.includes("companies")}
                    onCheckedChange={() => toggleAudience("companies")}
                    data-testid="checkbox-companies"
                  />
                  <label htmlFor="companies" className="text-sm flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    Companies
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" data-testid="button-save-draft">
                Save as Draft
              </Button>
              <Button className="flex-1" onClick={handlePublishCircular} data-testid="button-publish-circular">
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Send Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notification-title">Title</Label>
              <Input
                id="notification-title"
                placeholder="Notification title..."
                value={newNotification.title}
                onChange={(e) => setNewNotification(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-notification-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notification-message">Message</Label>
              <Textarea
                id="notification-message"
                placeholder="Notification message..."
                value={newNotification.message}
                onChange={(e) => setNewNotification(prev => ({ ...prev, message: e.target.value }))}
                data-testid="textarea-notification-message"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select
                value={newNotification.target}
                onValueChange={(value) => setNewNotification(prev => ({ ...prev, target: value }))}
              >
                <SelectTrigger data-testid="select-notification-target">
                  <SelectValue placeholder="Select target audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-students">All Students</SelectItem>
                  <SelectItem value="all-companies">All Companies</SelectItem>
                  <SelectItem value="pending-applications">Students with Pending Applications</SelectItem>
                  <SelectItem value="incomplete-profiles">Incomplete Profiles</SelectItem>
                  <SelectItem value="selected-candidates">Selected Candidates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSendNotification} data-testid="button-send-notification">
              <Send className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Recent Circulars</CardTitle>
            <Button variant="outline" size="sm" data-testid="button-view-all-circulars">
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {circulars.map((circular, index) => (
              <motion.div
                key={circular.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-3 border rounded-lg hover-elevate"
                data-testid={`circular-${circular.id}`}
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{circular.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{circular.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(circular.publishedDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" data-testid={`view-circular-${circular.id}`}>
                  <Eye className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Sent Notifications</CardTitle>
            <Button variant="outline" size="sm" data-testid="button-view-all-notifications">
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 border rounded-lg"
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {notification.readRate}% read
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(notification.sentDate).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{notification.sentTo}</span>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
