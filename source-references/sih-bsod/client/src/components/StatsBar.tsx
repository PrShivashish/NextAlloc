import { useEffect, useState } from "react";
import { Users, Building2, Briefcase, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  suffix?: string;
}

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="text-2xl md:text-3xl font-bold text-foreground">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

function StatItem({ icon, value, label, suffix }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-2 px-4 md:px-8 py-4"
    >
      <div className="p-3 rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <AnimatedCounter value={value} suffix={suffix} />
      <span className="text-sm text-muted-foreground text-center">{label}</span>
    </motion.div>
  );
}

export function StatsBar() {
  // todo: remove mock functionality - replace with real API data
  const stats = [
    { icon: <Users className="h-6 w-6" />, value: 125000, label: "Active Students", suffix: "+" },
    { icon: <Building2 className="h-6 w-6" />, value: 2500, label: "Partner Companies", suffix: "+" },
    { icon: <Briefcase className="h-6 w-6" />, value: 45000, label: "Internships Available", suffix: "+" },
    { icon: <TrendingUp className="h-6 w-6" />, value: 94, label: "Success Rate", suffix: "%" },
  ];

  return (
    <div className="w-full bg-card border-y">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {stats.map((stat, index) => (
            <StatItem key={index} {...stat} />
          ))}
        </div>
      </div>
    </div>
  );
}
