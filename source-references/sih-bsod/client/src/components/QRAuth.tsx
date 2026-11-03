import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, CheckCircle2, RefreshCw, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface QRAuthProps {
  onAuthenticated?: () => void;
}

export function QRAuth({ onAuthenticated }: QRAuthProps) {
  const [status, setStatus] = useState<"waiting" | "scanning" | "authenticated">("waiting");
  const [countdown, setCountdown] = useState(120);

  useEffect(() => {
    if (status === "waiting" && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, countdown]);

  const simulateScan = () => {
    setStatus("scanning");
    setTimeout(() => {
      setStatus("authenticated");
      setTimeout(() => {
        onAuthenticated?.();
      }, 1500);
    }, 2000);
  };

  const refreshQR = () => {
    setCountdown(120);
    setStatus("waiting");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-md mx-auto" data-testid="qr-auth">
      <CardHeader className="text-center">
        <CardTitle>Government ID Verification</CardTitle>
        <CardDescription>
          Scan the QR code with your DigiLocker app to verify your identity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnimatePresence mode="wait">
          {status === "waiting" && (
            <motion.div
              key="qr"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div 
                className="relative aspect-square max-w-64 mx-auto bg-white p-4 rounded-xl cursor-pointer"
                onClick={simulateScan}
                data-testid="button-simulate-scan"
              >
                <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <QrCode className="h-32 w-32 text-foreground/80" />
                  <motion.div
                    className="absolute inset-0 bg-primary/20"
                    animate={{ 
                      opacity: [0, 0.3, 0],
                      scale: [0.8, 1.2, 0.8]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                  Click to simulate scan
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Expires in {formatTime(countdown)}</span>
                <Button variant="ghost" size="icon" onClick={refreshQR} data-testid="button-refresh-qr">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <Smartphone className="h-8 w-8 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">Open DigiLocker App</p>
                  <p className="text-muted-foreground">Scan this QR to verify your Aadhaar</p>
                </div>
              </div>
            </motion.div>
          )}

          {status === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="inline-block"
              >
                <RefreshCw className="h-16 w-16 text-primary" />
              </motion.div>
              <p className="mt-4 font-medium">Verifying your identity...</p>
              <p className="text-sm text-muted-foreground">Please wait</p>
            </motion.div>
          )}

          {status === "authenticated" && (
            <motion.div
              key="authenticated"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
              >
                <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
              </motion.div>
              <p className="mt-4 font-semibold text-green-600 dark:text-green-400">
                Identity Verified!
              </p>
              <p className="text-sm text-muted-foreground">
                Welcome, proceeding to profile setup...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
