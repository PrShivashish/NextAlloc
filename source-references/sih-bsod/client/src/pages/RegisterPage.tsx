// src/pages/RegisterPage.tsx
import React, { useState, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, User, Sparkles, Check, X, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { validateNameAndEmail } from "@/lib/profanityFilter";

// Password requirement check interface
interface PasswordCheck {
    label: string;
    passed: boolean;
}

// Email validation check interface
interface EmailCheck {
    label: string;
    passed: boolean;
    warning?: boolean; // For suggestions rather than hard errors
}

// Common email domains for typo detection
const COMMON_DOMAINS = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
    'aol.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
    'live.com', 'msn.com', 'rediffmail.com', 'yahoo.co.in', 'gmail.co.in'
];

// Common domain typos and their corrections
const DOMAIN_TYPO_MAP: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmail.om': 'gmail.com',
    'gnail.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yhoo.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com',
    'outloo.com': 'outlook.com',
    'outlok.com': 'outlook.com',
    'hotmal.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'iclou.com': 'icloud.com',
    'icoud.com': 'icloud.com',
};

// Helper function to get email validation results (simplified - only essential checks)
function getEmailChecks(email: string): { checks: EmailCheck[]; suggestion?: string } {
    const trimmedEmail = email.trim().toLowerCase();
    const checks: EmailCheck[] = [];
    let suggestion: string | undefined;

    // Overall format check using comprehensive regex
    const validFormat = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail);

    // Check 1: Valid email format (user@domain structure)
    const hasValidStructure = trimmedEmail.includes('@') && trimmedEmail.split('@').length === 2;
    const [localPart, domain] = hasValidStructure ? trimmedEmail.split('@') : ['', ''];
    checks.push({ label: "Valid email format (user@domain)", passed: hasValidStructure && localPart.length > 0 });

    // Check 2: Valid domain with extension (domain name must be 2+ chars, not single letter)
    const domainParts = domain ? domain.split('.') : [];
    const domainName = domainParts.length > 0 ? domainParts[0] : '';
    const hasValidDomain = domain && domain.includes('.') && !domain.includes('..') && !/^[.-]|[.-]$/.test(domain) && domainName.length >= 2;
    checks.push({ label: "Valid domain (2+ characters)", passed: Boolean(hasValidDomain) });

    // Check 3: Valid extension (2+ characters)
    const tld = domainParts.length > 0 ? domainParts[domainParts.length - 1] : '';
    checks.push({ label: "Valid extension (.com, .org, etc.)", passed: tld.length >= 2 });

    // Check for common domain typos
    if (domain && DOMAIN_TYPO_MAP[domain]) {
        suggestion = `Did you mean ${localPart}@${DOMAIN_TYPO_MAP[domain]}?`;
    }

    return { checks, suggestion };
}

// Helper function to get all password validation results
function getPasswordChecks(password: string): PasswordCheck[] {
    return [
        { label: "At least 8 characters", passed: password.length >= 8 },
        { label: "At least one uppercase letter", passed: /[A-Z]/.test(password) },
        { label: "At least one lowercase letter", passed: /[a-z]/.test(password) },
        { label: "At least one number", passed: /\d/.test(password) },
        { label: "At least one special character (!@#$%^&* etc.)", passed: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/`~]/.test(password) },
    ];
}

export default function RegisterPage(): JSX.Element {
    const { registerStudent } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
    const [showEmailValidation, setShowEmailValidation] = useState(false);

    // Compute password checks whenever password changes
    const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
    const allPasswordChecksPassed = passwordChecks.every(check => check.passed);

    // Compute email checks whenever email changes
    const emailValidation = useMemo(() => getEmailChecks(email), [email]);
    const allEmailChecksPassed = emailValidation.checks.every(check => check.passed);

    const validate = () => {
        if (!name.trim()) {
            setError("Please enter your name.");
            return false;
        }
        if (!email.trim()) {
            setError("Please enter your email.");
            return false;
        }

        // Check for explicit/vulgar content in name and email (warning only - server does final check)
        const contentCheck = validateNameAndEmail(name, email);
        if (!contentCheck.isValid) {
            // Show warning but don't block - server will do final validation
            console.warn('[Registration] Profanity warning:', contentCheck.message);
        }

        // Check all email requirements
        if (!allEmailChecksPassed) {
            const failedChecks = emailValidation.checks.filter(check => !check.passed);
            setError(`Email validation failed:\n${failedChecks.map(c => `• ${c.label}`).join('\n')}`);
            setShowEmailValidation(true);
            return false;
        }

        // Check all password requirements
        if (!allPasswordChecksPassed) {
            const failedChecks = passwordChecks.filter(check => !check.passed);
            setError(`Password requirements not met:\n${failedChecks.map(c => `• ${c.label}`).join('\n')}`);
            setShowPasswordRequirements(true);
            return false;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return false;
        }
        setError(null);
        return true;
    };

    const submit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!validate()) return;
        setLoading(true);
        setError(null);
        try {
            await registerStudent(name.trim(), email.trim(), password);
            // AuthProvider handles redirection to /student
        } catch (err: any) {
            console.warn("Registration error", err);
            setError(err.message || "Failed to register.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Beautiful Side Pattern - Left Column */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background">
                {/* Animated Background Pattern */}
                <div className="absolute inset-0">
                    {/* Gradient Orbs */}
                    <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

                    {/* Grid Pattern */}
                    <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>

                    {/* Floating Geometric Shapes */}
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-primary/20 rounded-lg rotate-12 animate-float" />
                    <div className="absolute top-1/2 right-1/3 w-24 h-24 border-2 border-accent/20 rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
                    <div className="absolute bottom-1/3 left-1/3 w-40 h-40 border-2 border-primary/15 rounded-lg -rotate-6 animate-float" style={{ animationDelay: '1.5s' }} />
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 flex flex-col justify-center items-center p-12 text-center">
                    <Sparkles className="h-16 w-16 text-primary mb-6 animate-pulse" />
                    <h1 className="text-4xl font-bold mb-4">Join the PM Internship Scheme</h1>
                    <p className="text-lg text-muted-foreground max-w-md">
                        Create your account to start your journey towards a successful career.
                    </p>
                </div>
            </div>

            {/* Register Form - Right Column */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background relative">
                <div className="w-full max-w-md">
                    <Card>
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl font-bold">Create Student Account</CardTitle>
                            <CardDescription>Enter your details to create your account</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="space-y-4">
                                {/* Name Field */}
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="name"
                                            placeholder="John Doe"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>

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
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                setShowEmailValidation(true);
                                            }}
                                            onFocus={() => setShowEmailValidation(true)}
                                            className="pl-10"
                                            required
                                        />
                                    </div>

                                    {/* Email Validation Checklist */}
                                    {showEmailValidation && email.length > 0 && (
                                        <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Email Validation:</p>
                                            <ul className="space-y-1">
                                                {emailValidation.checks.map((check, index) => (
                                                    <li
                                                        key={index}
                                                        className={`flex items-center gap-2 text-xs ${check.passed
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-destructive"
                                                            }`}
                                                    >
                                                        {check.passed ? (
                                                            <Check className="h-3 w-3 flex-shrink-0" />
                                                        ) : (
                                                            <X className="h-3 w-3 flex-shrink-0" />
                                                        )}
                                                        <span>{check.label}</span>
                                                    </li>
                                                ))}
                                            </ul>

                                            {/* Typo Suggestion */}
                                            {emailValidation.suggestion && (
                                                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                                    <span className="text-xs text-amber-600 dark:text-amber-400">
                                                        {emailValidation.suggestion}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
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
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                setShowPasswordRequirements(true);
                                            }}
                                            onFocus={() => setShowPasswordRequirements(true)}
                                            className="pl-10 pr-10"
                                            required
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>

                                    {/* Password Requirements Checklist */}
                                    {showPasswordRequirements && password.length > 0 && (
                                        <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">Password Requirements:</p>
                                            <ul className="space-y-1">
                                                {passwordChecks.map((check, index) => (
                                                    <li
                                                        key={index}
                                                        className={`flex items-center gap-2 text-xs ${check.passed
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-destructive"
                                                            }`}
                                                    >
                                                        {check.passed ? (
                                                            <Check className="h-3 w-3 flex-shrink-0" />
                                                        ) : (
                                                            <X className="h-3 w-3 flex-shrink-0" />
                                                        )}
                                                        <span>{check.label}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password Field */}
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="pl-10 pr-10"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                                        {error}
                                    </div>
                                )}

                                {/* Submit Button */}
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? "Creating Account..." : "Create Account"}
                                </Button>

                                {/* Link to Login */}
                                <div className="text-center text-sm">
                                    <span className="text-muted-foreground">Already have an account?</span>{" "}
                                    <Link href="/login">
                                        <span className="text-primary hover:underline font-medium cursor-pointer">Sign in</span>
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
                </div>
            </div>

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
