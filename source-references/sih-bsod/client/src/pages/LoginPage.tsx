import React, { useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, Sparkles, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReCAPTCHA from "react-google-recaptcha";
import { useRecaptcha } from "@/hooks/useRecaptcha";

/* --- small safe session helpers --- */
function safeGet(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch { }
}

/* --- LoginPromptDialog Component --- */
function LoginPromptDialog({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<"initial" | "phone" | "registration-choice">(
    "initial"
  );
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const handleContinueToPortal = () => {
    setStage("phone");
    setVerificationError(null);
  };

  const handleNoRegistration = () => {
    setStage("registration-choice");
  };

  const handlePhoneSubmit = () => {
    if (!phone.trim()) {
      setVerificationError("Please enter your phone number");
      return;
    }

    // Validate phone number (basic validation)
    if (!/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
      setVerificationError("Please enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    setVerificationError(null);

    // Simulate API call to verify phone and fetch student data
    setTimeout(() => {
      try {
        // Save phone number
        safeSet("studentPhone", phone);

        // Check if student profile exists with this phone number
        // For demo: we'll assume profile exists and fetch it
        const studentProfiles = JSON.parse(
          sessionStorage.getItem("allStudentProfiles") || "[]"
        );

        const studentProfile = studentProfiles.find(
          (p: any) => p.phone === phone
        );

        if (!studentProfile) {
          setVerificationError(
            "No profile found with this phone number. Please complete registration first."
          );
          setLoading(false);
          return;
        }

        // Store the retrieved profile
        safeSet("studentProfile", JSON.stringify(studentProfile));
        safeSet("portalAuth", "student");

        alert("Phone verified! Proceeding to Student Portal...");
        window.location.href = "/student-portal";
      } catch (err) {
        setVerificationError("An error occurred. Please try again.");
        console.error(err);
      }
      setLoading(false);
    }, 1000);
  };

  const handleProceedRegistration = () => {
    safeSet("portalAuth", "student");
    safeSet("registrationFlow", "fresh");
    window.location.href = "/student-portal?stage=eligibility";
    onClose();
  };

  const handleLater = () => {
    window.location.href = "/";
    onClose();
  };

  // STAGE 1: Initial Choice
  if (stage === "initial") {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Student Portal Access</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-6">
            <div className="text-center">
              <p className="text-base text-foreground mb-6">
                Have you already completed your registration with us?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleContinueToPortal}
                size="lg"
                className="w-full"
              >
                Yes, I have completed registration
              </Button>
              <Button
                onClick={handleNoRegistration}
                variant="outline"
                size="lg"
                className="w-full"
              >
                No, I need to complete registration
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="lg"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // STAGE 2: Phone Verification
  if (stage === "phone") {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Verify Your Identity</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-6">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground mb-4">
                Enter the phone number you used during registration to continue
                to your Student Portal.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+91 XXXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-muted-foreground rounded-lg bg-transparent text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enter your 10-digit mobile number
              </p>
            </div>

            {/* Error Message */}
            {verificationError && (
              <div className="flex gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{verificationError}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={handlePhoneSubmit}
                disabled={loading}
                size="lg"
                className="w-full"
              >
                {loading ? "Verifying..." : "Continue to Portal"}
              </Button>
              <Button
                onClick={() => setStage("initial")}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // STAGE 3: Registration Choice
  if (stage === "registration-choice") {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Complete Your Registration</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-6">
            <div className="text-center mb-4">
              <p className="text-base text-foreground mb-2">
                You haven't completed your registration yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Complete your registration to access the student portal and
                explore internship opportunities.
              </p>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  Registration includes profile completion, Aadhar verification,
                  and skill assessment.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleProceedRegistration}
                size="lg"
                className="w-full"
              >
                Proceed with Registration
              </Button>
              <Button
                onClick={handleLater}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

export default function LoginPage(): JSX.Element {
  const { isAuthenticated, loginStudent, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Lockout state
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [isLockedOut, setIsLockedOut] = useState(false);

  // CAPTCHA hook
  const { validateCaptcha, resetCaptcha, recaptchaProps } = useRecaptcha();

  // Countdown timer effect
  React.useEffect(() => {
    if (lockoutSeconds <= 0) {
      setIsLockedOut(false);
      return;
    }

    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          setIsLockedOut(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Format seconds as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validate = () => {
    if (!email.trim()) {
      setError("Please enter your email.");
      return false;
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email.trim())) {
      setError("Enter a valid email.");
      return false;
    }
    if (!password) {
      setError("Please enter your password.");
      return false;
    }
    setError(null);
    return true;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLockedOut) return;
    if (!validate()) return;

    // CAPTCHA validation disabled - API key no longer valid
    // const captchaError = validateCaptcha();
    // if (captchaError) {
    //   setError(captchaError);
    //   return;
    // }

    setLoading(true);
    setError(null);
    try {
      await loginStudent(email.trim(), password);
    } catch (err: any) {
      console.warn("Login error", err);
      // resetCaptcha(); // Reset CAPTCHA on failed login
      // Check if this is a lockout error
      if (err.locked && err.remainingSeconds) {
        setIsLockedOut(true);
        setLockoutSeconds(err.remainingSeconds);
        setError(null);
      } else {
        setError(err.message || "Failed to login.");
      }
    } finally {
      setLoading(false);
    }
  };

  const continueToPortal = () => {
    setShowLoginPrompt(true);
  };

  return (
    <div className="min-h-screen flex">
      {showLoginPrompt && (
        <LoginPromptDialog onClose={() => setShowLoginPrompt(false)} />
      )}

      {/* Beautiful Side Pattern - Left Column */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0">
          {/* Gradient Orbs */}
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-20 right-20 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />

          {/* Grid Pattern */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.03]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-primary"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Floating Geometric Shapes */}
          <div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-primary/20 rounded-lg rotate-12 animate-float" />
          <div
            className="absolute top-1/2 right-1/3 w-24 h-24 border-2 border-accent/20 rounded-full animate-float"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute bottom-1/3 left-1/3 w-40 h-40 border-2 border-primary/15 rounded-lg -rotate-6 animate-float"
            style={{ animationDelay: "1.5s" }}
          />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-center">
          <Sparkles className="h-16 w-16 text-primary mb-6 animate-pulse" />
          <h1 className="text-4xl font-bold mb-4">Student Portal</h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Launch your career with the Prime Minister's Internship Scheme.
          </p>
          <div className="mt-8 flex gap-4">
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold text-primary">50K+</div>
              <div className="text-sm text-muted-foreground">Students</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold text-primary">95%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Form - Right Column */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative">
        <div className="w-full max-w-md">
          {/* Already Authenticated */}
          {isAuthenticated && (
            <div className="mb-6 flex gap-3">
              <Button onClick={continueToPortal} className="flex-1">
                Continue to Student Portal
              </Button>
              <Button
                onClick={() => {
                  logout && logout();
                }}
                variant="destructive"
              >
                Logout
              </Button>
            </div>
          )}

          {!isAuthenticated && (
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold">
                  Student Login
                </CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Lockout Timer */}
                  {isLockedOut && (
                    <div className="text-sm bg-amber-500/10 border border-amber-500/30 p-4 rounded-md">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium mb-2">
                        <Lock className="h-4 w-4" />
                        Too many failed attempts
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                          {formatTime(lockoutSeconds)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Please wait before trying again
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CAPTCHA - Disabled (API key no longer valid)
                  <div className="flex justify-center my-4 p-2 border border-dashed border-gray-300 rounded min-h-[78px]">
                    <ReCAPTCHA
                      ref={recaptchaProps.ref}
                      sitekey={recaptchaProps.sitekey}
                      onChange={recaptchaProps.onChange}
                      onExpired={recaptchaProps.onExpired}
                      onErrored={recaptchaProps.onErrored}
                    />
                  </div>
                  */}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || isLockedOut}
                  >
                    {isLockedOut
                      ? `Try again in ${formatTime(lockoutSeconds)}`
                      : loading
                        ? "Please wait..."
                        : "Sign In"}
                  </Button>

                  {/* Link to Register */}
                  <div className="text-center text-sm">
                    <span className="text-muted-foreground">
                      Don't have an account?
                    </span>{" "}
                    <Link href="/register">
                      <span className="text-primary hover:underline font-medium cursor-pointer">
                        Register
                      </span>
                    </Link>
                  </div>

                  {/* Back to Home */}
                  <div className="text-center">
                    <Link href="/">
                      <Button variant="ghost" size="sm" type="button">
                        ← Back to Home
                      </Button>
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Floating Animation Styles */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
