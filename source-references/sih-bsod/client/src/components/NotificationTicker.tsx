import { motion } from "framer-motion";
import { Bell, CheckCircle, Users, Building2 } from "lucide-react";

interface Notification {
  id: number;
  icon: React.ReactNode;
  message: string;
  time: string;
}

export function NotificationTicker() {
  // todo: remove mock functionality - replace with real-time notifications
  const notifications: Notification[] = [
    { id: 1, icon: <CheckCircle className="h-4 w-4 text-green-500" />, message: "250 new internships added in Bangalore", time: "2 min ago" },
    { id: 2, icon: <Users className="h-4 w-4 text-blue-500" />, message: "1,500 students matched with companies today", time: "5 min ago" },
    { id: 3, icon: <Building2 className="h-4 w-4 text-purple-500" />, message: "Tata Consultancy Services posted 100 new positions", time: "8 min ago" },
    { id: 4, icon: <CheckCircle className="h-4 w-4 text-green-500" />, message: "Application deadline extended for Delhi region", time: "15 min ago" },
    { id: 5, icon: <Bell className="h-4 w-4 text-orange-500" />, message: "New policy update: Enhanced stipend for rural students", time: "20 min ago" },
  ];

  const duplicatedNotifications = [...notifications, ...notifications];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t overflow-hidden z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-10">
          <div className="flex items-center gap-2 pr-4 border-r shrink-0">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Live Updates</span>
          </div>
          <div className="overflow-hidden flex-1">
            <motion.div
              className="flex gap-8 whitespace-nowrap"
              animate={{ x: ["0%", "-50%"] }}
              transition={{
                duration: 30,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {duplicatedNotifications.map((notification, index) => (
                <div key={`${notification.id}-${index}`} className="flex items-center gap-2 shrink-0">
                  {notification.icon}
                  <span className="text-sm text-foreground">{notification.message}</span>
                  <span className="text-xs text-muted-foreground">• {notification.time}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
