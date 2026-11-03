// src/pages/ObjectionPage.tsx
import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, XCircle, Clock, Send } from "lucide-react";

interface ObjectionData {
    token: string;
    email: string;
    name: string;
    detectedWord: string;
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
}

export default function ObjectionPage(): JSX.Element {
    const [, params] = useRoute("/objection/:token");
    const token = params?.token || "";

    const [objectionData, setObjectionData] = useState<ObjectionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!token) {
            setError("Invalid objection link");
            setLoading(false);
            return;
        }

        // Fetch objection data
        fetch(`/api/objection/${token}`)
            .then(res => {
                if (!res.ok) throw new Error("Objection not found or expired");
                return res.json();
            })
            .then(data => {
                setObjectionData(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError("Please provide a reason for your objection");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/objection/${token}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() }),
            });

            if (!res.ok) throw new Error("Failed to submit objection");
            setSubmitted(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
                <Card className="w-full max-w-md">
                    <CardContent className="p-8 text-center">
                        <Clock className="h-12 w-12 mx-auto mb-4 text-amber-500 animate-spin" />
                        <p>Loading objection details...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error && !objectionData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
                <Card className="w-full max-w-md border-red-200">
                    <CardContent className="p-8 text-center">
                        <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                        <h2 className="text-xl font-bold text-red-700 mb-2">Error</h2>
                        <p className="text-red-600">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
                <Card className="w-full max-w-md border-green-200">
                    <CardContent className="p-8 text-center">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <h2 className="text-xl font-bold text-green-700 mb-2">Objection Submitted!</h2>
                        <p className="text-green-600 mb-4">
                            Your objection has been sent to our admin team for manual review.
                        </p>
                        <p className="text-sm text-gray-500">
                            You will receive an email notification once your objection has been reviewed.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (objectionData?.status !== 'pending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <Card className="w-full max-w-md">
                    <CardContent className="p-8 text-center">
                        {objectionData?.status === 'approved' ? (
                            <>
                                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                                <h2 className="text-xl font-bold text-green-700 mb-2">Objection Approved</h2>
                                <p className="text-gray-600">Your objection was reviewed and approved. You can now register with your original username.</p>
                            </>
                        ) : (
                            <>
                                <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                                <h2 className="text-xl font-bold text-red-700 mb-2">Objection Rejected</h2>
                                <p className="text-gray-600">Your objection was reviewed and rejected. Please choose a different username.</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
            <Card className="w-full max-w-lg border-amber-200">
                <CardHeader className="bg-amber-500 text-white rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-8 w-8" />
                        <div>
                            <CardTitle>Content Objection Form</CardTitle>
                            <CardDescription className="text-amber-100">
                                Submit your objection for manual review
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                            <strong>Your registration was flagged</strong> because our system detected
                            content that may violate our community guidelines. If you believe this
                            was a mistake (e.g., it's your real name), please explain below.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="reason">Why should this be allowed?</Label>
                            <Textarea
                                id="reason"
                                placeholder="Please explain why your username should be approved. For example: 'This is my legal name' or 'This is an abbreviation for...'"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={5}
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-amber-500 hover:bg-amber-600"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Submit Objection for Review
                                </>
                            )}
                        </Button>
                    </form>

                    <p className="text-xs text-center text-gray-500 mt-4">
                        Objection ID: {token.substring(0, 8)}...
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
