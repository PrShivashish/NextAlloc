// src/pages/AdminLoginPage.tsx
import React, { useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, AlertTriangle, Lock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function AdminLoginPage(): JSX.Element {
    const { loginAdmin } = useAuth();
    const [step, setStep] = useState<"warning" | "login">("warning");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (username !== "admin") {
            setError("Invalid username");
            return;
        }
        try {
            await loginAdmin(password);
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (step === "warning") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
                {/* Background Elements */}
                <div className="absolute inset-0 bg-destructive/5" />
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-destructive/10 rounded-full blur-3xl animate-pulse" />

                <Card className="w-full max-w-md border-destructive/20 shadow-2xl relative z-10">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto bg-destructive/10 p-4 rounded-full w-fit mb-4">
                            <AlertTriangle className="h-10 w-10 text-destructive" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-destructive">Restricted Access</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-6">
                        <p className="text-muted-foreground">
                            You are attempting to access the Administrative Portal. This area is strictly for authorized personnel only.
                            Unauthorized access is prohibited and monitored.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Link href="/">
                                <Button variant="outline">Cancel</Button>
                            </Link>
                            <Button
                                variant="destructive"
                                onClick={() => setStep("login")}
                            >
                                I am an Admin
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Aesthetic Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-10 left-10 w-32 h-32 bg-primary/10 rounded-full blur-xl animate-float" />
                <div className="absolute bottom-10 right-10 w-40 h-40 bg-accent/10 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }} />
                {/* Floating Images/Icons */}
                <Shield className="absolute top-1/4 right-1/4 h-12 w-12 text-primary/20 animate-float" style={{ animationDelay: '1s' }} />
                <Lock className="absolute bottom-1/3 left-1/4 h-8 w-8 text-primary/20 animate-float" style={{ animationDelay: '3s' }} />
            </div>

            <Card className="w-full max-w-md shadow-xl border-primary/10 relative z-10 backdrop-blur-sm bg-card/90">
                <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="icon" onClick={() => setStep("warning")} className="-ml-2">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Username</Label>
                            <Input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                            />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <Button type="submit" className="w-full">Access Dashboard</Button>
                    </form>
                </CardContent>
            </Card>

            <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
}
