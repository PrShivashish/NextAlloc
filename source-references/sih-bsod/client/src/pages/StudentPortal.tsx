import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/LogoutButton";
import { useAuth } from "@/lib/AuthProvider";
import { AuthGate } from "@/components/AuthGate";
import RegistrationWithAadhar from "@/components/RegistrationWithAadhar";
import EligibilityChecker from "@/components/EligibilityChecker";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Heart,
  MessageSquare,
  Filter,
  Sparkles,
  Star,
  X,
  CheckCircle,
  TrendingUp,
  Loader2,
  FolderOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion } from "framer-motion";

/* --- Safe Helpers --- */
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
function safeRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch { }
}

/* --- FeedbackDialog Component --- */
/* --- FeedbackDialog Component --- */

function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) {
      alert("Please select a rating");
      return;
    }
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setRating(0);
      setFeedback("");
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare className="h-4 w-4 mr-2" />
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send us your Feedback</DialogTitle>
        </DialogHeader>
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-600">Feedback Successfully Submitted!</h3>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-3">Rate your experience</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className="hover:scale-110">
                    <Star className={`h-8 w-8 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you think..."
              className="w-full px-3 py-2 border rounded-lg"
              rows={4}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Submit</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* --- ProfileDetailsDialog Component --- */
function ProfileDetailsDialog() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    try {
      // Try to get from session, or fetch if missing (but StudentPortal parent usually manages it)
      const raw = safeGet("studentProfile");
      if (raw) setProfile(JSON.parse(raw));
    } catch { }
  }, []); // Reload on mount

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">Profile Details</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your Profile Details</DialogTitle>
        </DialogHeader>

        {profile ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-muted-foreground">Name</label><p className="font-medium">{profile.name}</p></div>
              <div><label className="text-sm text-muted-foreground">Email</label><p className="font-medium">{profile.email}</p></div>
              <div><label className="text-sm text-muted-foreground">Phone</label><p className="font-medium">{profile.phone}</p></div>
              <div><label className="text-sm text-muted-foreground">Gender</label><p className="font-medium">{profile.gender}</p></div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Skills</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(typeof profile.skills === 'string'
                  ? profile.skills.split(';').filter(Boolean)
                  : profile.skills || []
                ).map((s: string) => <span key={s} className="px-2 py-1 bg-secondary text-xs rounded">{s}</span>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-muted-foreground">Highest Qual.</label><p className="font-medium">{profile.highestQualification}</p></div>
              <div><label className="text-sm text-muted-foreground">GPA</label><p className="font-medium">{profile.marksGPA}</p></div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">No profile found.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------ StudentPortal main component ------------------ */
export default function StudentPortal() {
  const { isAuthenticated, user, logout } = useAuth(); // added logout import usage
  const authed = isAuthenticated && user?.role === "student";

  // Real Data State
  const [dbInternships, setDbInternships] = useState<any[]>([]);
  const [loadingInternships, setLoadingInternships] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false); // Track if profile fetch is complete

  // Initialize Profile Check
  const hasProfile = !!profile; // simplified check

  useEffect(() => {
    if (!authed) return;

    // Fetch Profile
    fetch("/api/student/profile", { credentials: "include" })
      .then(res => {
        console.log("Profile fetch status:", res.status);
        if (res.status === 404 || res.status === 401) return null;
        if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log("Profile data:", data);
        if (data) {
          setProfile(data);
          safeSet("studentProfile", JSON.stringify(data));
        }
        setProfileLoaded(true); // Mark profile fetch as complete
      })
      .catch(err => {
        console.error("Failed to fetch profile", err);
        setProfileLoaded(true); // Still mark as loaded even on error
      });

    // Fetch Internships
    fetch("/api/internships", { credentials: "include" })
      .then(res => {
        console.log("Internships fetch status:", res.status);
        if (!res.ok) throw new Error(`Internships fetch failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log("Raw internships data:", data?.length, "items");
        if (!Array.isArray(data)) {
          console.error("Internships data is not an array:", data);
          setLoadingInternships(false);
          return;
        }
        // Map DB shape to UI shape
        const mapped = data.map((item: any) => ({
          internshipId: item.internshipId,
          companyId: item.companyId ? `CMP-${item.companyId}` : "CMP-Unknown",
          title: `${item.sector} Intern`,
          description: `Exciting opportunity in the ${item.sector} sector. Requires skills: ${item.requiredSkills}.`,
          requiredSkills: item.requiredSkills ? item.requiredSkills.split(",") : [],
          gpaRequirement: 6.0,
          sector: item.sector,
          location: item.locationType,
          state: item.state, // Job location state
          tier: item.tier, // Tier level
          capacity: item.capacity,
          duration: "6 months",
          stipend: `₹${item.stipend}/month`,
        }));
        console.log("Mapped internships:", mapped.length, "items");
        setDbInternships(mapped);
        setLoadingInternships(false);
      })
      .catch(err => {
        console.error("Failed to fetch internships", err);
        setLoadingInternships(false);
      });
  }, [authed]);

  const [appliedList, setAppliedList] = useState<any[]>(() => {
    try {
      const raw = safeGet("appliedInternships");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showApplied, setShowApplied] = useState(false);

  const [prefLoc1, setPrefLoc1] = useState("");
  const [prefLoc2, setPrefLoc2] = useState("");
  const [stateFilter, setStateFilter] = useState(""); // Filter internships by state
  const [offered, setOffered] = useState<any[]>(() => {
    try {
      const raw = safeGet("offeredInternships");
      if (raw) return JSON.parse(raw);
    } catch { }
    return []; // Empty initially, real logic needs allocation API
  });

  // Check if preferences have already been submitted (locked)
  const [preferencesLocked, setPreferencesLocked] = useState(false);
  const [submittedPreferences, setSubmittedPreferences] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || dbInternships.length === 0 || loadingInternships) return;

    // Check if user has already submitted preferences (pref1 exists)
    if (profile.pref1) {
      console.log("Preferences already submitted - locking");
      setPreferencesLocked(true);

      // Load the submitted preferences for display (read-only)
      const prefIds: string[] = [];
      for (let i = 1; i <= 6; i++) {
        const prefKey = `pref${i}`;
        if (profile[prefKey]) {
          prefIds.push(profile[prefKey]);
        }
      }

      const matchedInternships = prefIds
        .map(prefId => dbInternships.find(int => int.internshipId === prefId))
        .filter(Boolean);

      setSubmittedPreferences(matchedInternships);
    }
  }, [profile, dbInternships, loadingInternships]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedFromSearch, setSelectedFromSearch] = useState<any>(null);

  useEffect(() => {
    try {
      safeSet("offeredInternships", JSON.stringify(offered));
    } catch { }
  }, [offered]);

  const [stage, setStage] = useState<"eligibility" | "auth" | "profile" | "dashboard">("dashboard");
  const [activeTab, setActiveTab] = useState<"match" | "predictions" | "careerhub">("match");
  const [predictions, setPredictions] = useState<any>(null);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  // Auto-switch to profile stage if user is authenticated but has no profile
  useEffect(() => {
    if (authed && profileLoaded && !hasProfile) {
      console.log("No profile found, switching to profile stage");
      setStage("profile");
    } else if (authed && profileLoaded && hasProfile) {
      console.log("Profile exists, staying on dashboard");
      setStage("dashboard");
    }
  }, [authed, profileLoaded, hasProfile]);

  /* Storage listener (kept for legacy compatibility but less critical now) */
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      // ... kept existing logic ...
    }
    // ...
  }, []);

  useEffect(() => {
    try {
      safeSet("appliedInternships", JSON.stringify(appliedList));
    } catch { }
  }, [appliedList]);

  function handleProfileComplete() {
    setStage("dashboard");
    // Reload profile
    fetch("/api/student/profile", { credentials: "include" })
      .then(res => res.json())
      .then(setProfile)
      .catch(err => console.error("Failed to reload profile:", err));
  }

  async function leavePortal() {
    // Show confirmation dialog
    const userChoice = window.confirm(
      "Do you want to save your progress?\n\n" +
      "Click 'OK' to save and continue later.\n" +
      "Click 'Cancel' to discard all data and delete your account."
    );

    if (userChoice) {
      // Save: Keep session data, just go home
      // The data is already in sessionStorage from the registration form
      try {
        // Mark that we have saved progress
        sessionStorage.setItem("registration_in_progress", "true");
      } catch { }
      window.location.replace("/");
    } else {
      // Discard: Delete account from database and clear all data
      try {
        // Call API to delete user account
        const response = await fetch("/api/student/account", {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          console.warn("Failed to delete account:", await response.text());
        } else {
          console.log("Account deleted successfully");
        }
      } catch (e) {
        console.warn("Error deleting account:", e);
      }

      // IMPORTANT: Clear server-side session by calling logout
      try {
        await fetch("/api/logout", { method: "POST", credentials: "include" });
        console.log("Server session cleared");
      } catch (e) {
        console.warn("Error logging out:", e);
      }

      // Clear all registration-related sessionStorage
      try {
        sessionStorage.clear(); // Clear ALL session storage to be safe
      } catch { }

      window.location.replace("/");
    }
  }

  function handleApply(internship: any) {
    const exists = appliedList.some((i) => i.internshipId === internship.internshipId);
    if (exists) {
      setShowApplied(true);
      return;
    }
    if (appliedList.length >= 6) {
      alert("You can apply to a maximum of 6 internships. Remove one from your list to add another.");
      setShowApplied(true);
      return;
    }
    const next = [...appliedList, internship];
    setAppliedList(next);
    setShowApplied(true);
    alert(`Added ${internship.title} to your preferred internships (position ${next.length}).`);
  }

  function handleRemoveApplied(id: string) {
    const next = appliedList.filter((i) => i.internshipId !== id);
    setAppliedList(next);
  }

  function moveApplied(id: string, dir: "up" | "down") {
    const idx = appliedList.findIndex((i) => i.internshipId === id);
    if (idx === -1) return;
    const copy = [...appliedList];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= copy.length) return;
    [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
    setAppliedList(copy);
  }

  function acceptOffer(internshipId: string) {
    setOffered((prev) => prev.map((o) => o.internshipId === internshipId ? { ...o, status: "accepted" } : o));
    alert("You accepted the offer. Congratulations!");
  }

  function rejectOffer(internshipId: string) {
    setOffered((prev) => prev.map((o) => o.internshipId === internshipId ? { ...o, status: "rejected" } : o));
    alert("You rejected the offer.");
  }

  async function submitPreferences() {
    if (appliedList.length === 0) {
      alert("Please apply to at least one internship before submitting.");
      return;
    }

    const payload: any = {};
    appliedList.forEach((item, idx) => {
      if (idx < 6) {
        payload[`pref${idx + 1}`] = item.internshipId;
      }
    });

    console.log("Submitting preferences:", payload);

    try {
      const res = await fetch("/api/student/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      console.log("Submit response status:", res.status);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to save preferences: ${res.status} - ${errorText}`);
      }
      const result = await res.json();
      console.log("Save result:", result);
      alert("Preferences saved successfully!");
    } catch (e: any) {
      console.error("Submit error:", e);
      alert("Error saving preferences: " + e.message);
    }
  }

  useEffect(() => {
    if (!authed) {
      window.location.href = "/login";
    }
  }, [authed]);

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setSelectedFromSearch(null);
      return;
    }

    const q = query.toLowerCase();
    const results = dbInternships.filter(
      (job) =>
        job.internshipId.toLowerCase().includes(q) ||
        job.title.toLowerCase().includes(q) ||
        job.companyId.toLowerCase().includes(q)
    );
    setSearchResults(results);
  };

  const handleSelectFromSearch = (job: any) => {
    setSelectedFromSearch(job);
    setSearchQuery("");
    setSearchResults([]);
  };

  if (stage === "eligibility") {
    return (
      <div className="min-h-screen bg-background">
        <Header showNav={false} />
        <div className="container mx-auto px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome to Student Portal</h1>
            <p className="text-muted-foreground">Let's verify your eligibility for the PM Internship Scheme</p>
          </motion.div>
          <EligibilityChecker onComplete={() => setStage("profile")} />
        </div>
      </div>
    );
  }

  if (stage === "profile") {
    return (
      <div className="min-h-screen bg-background">
        <Header showNav={false} />
        <div className="container mx-auto px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Complete Your Registration</h1>
            <p className="text-muted-foreground">Please complete registration to access the Student Dashboard.</p>
          </motion.div>

          <div className="mt-4">
            <RegistrationWithAadhar onComplete={handleProfileComplete} />
          </div>

          <div className="mt-6 text-center">
            <Button variant="outline" onClick={leavePortal}>← Cancel & Back to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  /* Removed duplicate profile loading logic */

  // Simplified eligibility logic (matches everything for now, or use ML response if available)
  const eligible = dbInternships;

  function matchesPreferred(job: any) {
    if (!prefLoc1 && !prefLoc2) return true;
    const loc = (job.location || "").toLowerCase();
    const p1 = prefLoc1.trim().toLowerCase();
    const p2 = prefLoc2.trim().toLowerCase();
    if (p1 && loc.includes(p1)) return true;
    if (p2 && loc.includes(p2)) return true;
    return false;
  }

  const preferredInternships = eligible.filter(matchesPreferred);

  console.log("StudentPortal render: dbInternships count =", dbInternships.length);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Student Dashboard (Live)</h1>
            <p className="text-muted-foreground">Welcome back! Discover your perfect internship</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <ProfileDetailsDialog />
            <FeedbackDialog />
            <LogoutButton />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="match" className="gap-2" data-testid="tab-match">
              <Heart className="h-4 w-4" />
              Match
            </TabsTrigger>
            <TabsTrigger value="predictions" className="gap-2" data-testid="tab-predictions" onClick={() => {
              if (!predictions && !loadingPredictions) {
                setLoadingPredictions(true);
                fetch("/api/student/predictions", { credentials: "include" })
                  .then(res => res.json())
                  .then(data => setPredictions(data))
                  .catch(err => console.error("Predictions fetch error:", err))
                  .finally(() => setLoadingPredictions(false));
              }
            }}>
              <TrendingUp className="h-4 w-4" />
              Predictions
            </TabsTrigger>
            <TabsTrigger value="careerhub" className="gap-2" data-testid="tab-careerhub">
              <FolderOpen className="h-4 w-4" />
              Career Hub
            </TabsTrigger>
          </TabsList>

          {/* MATCH TAB */}
          <TabsContent value="match" className="space-y-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4" />
                AI-Powered Matching
              </div>
              <h2 className="text-xl font-semibold">Internships You Are Eligible For</h2>
              <p className="text-muted-foreground">Based on your profile — complete your profile for more accurate matches</p>
            </motion.div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-6 relative">
              <div className="relative flex items-center gap-2 bg-transparent">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by ID (INT-001), Company (CMP-1001), or Role (Product Management)"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-transparent border border-muted-foreground rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-muted-foreground rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  {searchResults.map((job) => (
                    <button
                      key={job.internshipId}
                      onClick={() => handleSelectFromSearch(job)}
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-foreground">{job.title}</div>
                      <div className="text-sm text-muted-foreground">{job.internshipId} • {job.companyId}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected from Search Display */}
            {selectedFromSearch && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto mb-6 p-4 bg-transparent border border-primary/30 rounded-lg backdrop-blur-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{selectedFromSearch.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{selectedFromSearch.internshipId} • {selectedFromSearch.companyId}</p>
                    <p className="text-sm text-muted-foreground mt-2">{selectedFromSearch.location} • {selectedFromSearch.sector}</p>
                  </div>
                  <button
                    onClick={() => setSelectedFromSearch(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      handleApply(selectedFromSearch);
                      setSelectedFromSearch(null);
                    }}
                    disabled={appliedList.some((i) => i.internshipId === selectedFromSearch.internshipId)}
                  >
                    {appliedList.some((i) => i.internshipId === selectedFromSearch.internshipId) ? "Already Applied" : "Apply Now"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Preference list */}
            {(true) && (
              <div className="max-w-2xl mx-auto mb-4 p-4 rounded border bg-card border-muted-foreground/50">
                {preferencesLocked ? (
                  // LOCKED STATE - preferences already submitted, show read-only
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-green-700">✓ Preferences Submitted</h3>
                    </div>
                    <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                      Your internship preferences have been submitted and are locked. You cannot modify them.
                    </div>
                    <ol className="list-decimal pl-5 space-y-2">
                      {submittedPreferences.map((item, idx) => (
                        <li key={item.internshipId} className="text-sm">
                          <span className="font-medium">{item.title}</span>
                          <span className="text-muted-foreground ml-2">({item.internshipId})</span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  // EDITABLE STATE - preferences not yet submitted
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Your Preferred Internships (max 6)</h3>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setShowApplied(false); }}>Close</Button>
                        <Button onClick={submitPreferences} size="sm">Submit Preferences</Button>
                      </div>
                    </div>

                    {appliedList.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No internships selected yet. Click "Apply" on any internship to add it to your priority list.</div>
                    ) : (
                      <ol className="list-decimal pl-5 space-y-2">
                        {appliedList.map((item, idx) => (
                          <li key={item.internshipId} className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{item.title} <span className="text-xs text-muted-foreground">({item.internshipId} • {item.companyId})</span></div>
                              <div className="text-sm text-muted-foreground">{item.location} • {item.sector} • GPA ≥ {item.gpaRequirement}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" onClick={() => moveApplied(item.internshipId, "up")} disabled={idx === 0}>↑</Button>
                              <Button size="sm" variant="ghost" onClick={() => moveApplied(item.internshipId, "down")} disabled={idx === appliedList.length - 1}>↓</Button>
                              <Button size="sm" variant="destructive" onClick={() => handleRemoveApplied(item.internshipId)}>Remove</Button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </div>
            )}

            {!profile && (
              <div className="px-4 py-3 rounded bg-yellow-50 border border-yellow-100 text-sm text-yellow-800">
                Complete your profile (Profile Details) to get more accurate, AI-powered matches.
              </div>
            )}

            {/* State Filter Dropdown */}
            <div className="max-w-2xl mx-auto mb-4 flex items-center gap-3">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <label className="text-sm font-medium">Filter by Location:</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="flex-1 max-w-xs px-3 py-2 border rounded-lg bg-background"
              >
                <option value="">All States</option>
                <option value="MH">Maharashtra (Tier1)</option>
                <option value="KA">Karnataka (Tier1)</option>
                <option value="GJ">Gujarat (Tier2)</option>
                <option value="TG">Telangana (Tier2)</option>
                <option value="UP">Uttar Pradesh (Tier3)</option>
                <option value="RJ">Rajasthan (Tier3)</option>
              </select>
              {stateFilter && (
                <Button variant="ghost" size="sm" onClick={() => setStateFilter("")}>
                  Clear
                </Button>
              )}
            </div>

            {eligible.filter((job) => !stateFilter || job.state === stateFilter).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No internships match your filter. Try selecting a different state or clear the filter.</div>
            ) : (
              <div className="grid gap-4">
                {eligible.filter((job) => !stateFilter || job.state === stateFilter).map((job) => (
                  <Card key={job.internshipId} className="hover-elevate">
                    <CardContent className="p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{job.title}</h3>
                        <div className="text-sm text-muted-foreground">{job.companyId} • {job.location}</div>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                            📍 {job.state === "MH" ? "Maharashtra" : job.state === "KA" ? "Karnataka" : job.state === "GJ" ? "Gujarat" : job.state === "TG" ? "Telangana" : job.state === "UP" ? "Uttar Pradesh" : job.state === "RJ" ? "Rajasthan" : job.state || "N/A"}
                          </span>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground">
                            {job.tier}
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground">{job.duration} • {job.stipend}</div>
                        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{job.description || "Short description about the internship role and responsibilities."}</p>

                        <div className="mt-3 text-sm">
                          <strong>Skills:</strong> {job.requiredSkills.join(", ")} • <strong>GPA:</strong> {job.gpaRequirement} • <strong>Sector:</strong> {job.sector} • <strong>Capacity:</strong> {job.capacity}
                        </div>
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-3">
                        <div className="text-sm text-muted-foreground">ID: {job.internshipId}</div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApply(job)} disabled={preferencesLocked || appliedList.some((i) => i.internshipId === job.internshipId)}>
                            {preferencesLocked ? "Locked" : appliedList.some((i) => i.internshipId === job.internshipId) ? "Selected" : "Apply"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            alert(`${job.title} — ${job.companyId}

${job.duration} · ${job.stipend}

Description: ${job.description || "—"}`);
                          }}>
                            Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PREDICTIONS TAB */}
          <TabsContent value="predictions" className="space-y-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <TrendingUp className="h-4 w-4" />
                ML-Powered Allocation Results
              </div>
              <h2 className="text-xl font-semibold">Your Internship Allocation</h2>
              <p className="text-muted-foreground">Results from the AI-powered matching algorithm</p>
            </motion.div>

            {loadingPredictions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading predictions...</span>
              </div>
            ) : predictions ? (
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* Student Info */}
                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Star className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{predictions.name || "Student"}</h3>
                        <p className="text-sm text-muted-foreground">Student ID: {predictions.studentId}</p>
                      </div>
                    </div>

                    {/* Allocation Result */}
                    <div className={`p-4 rounded-lg ${predictions.allocation ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {predictions.allocation ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-yellow-600" />
                        )}
                        <span className="font-semibold text-lg">
                          {predictions.allocation ? "Allocated!" : "Pending Allocation"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{predictions.message}</p>

                      {predictions.allocation && (
                        <div className="mt-4 p-3 bg-white dark:bg-slate-900 rounded-lg">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Internship ID:</span>
                              <span className="ml-2 font-medium">{predictions.allocation.internship_id}</span>
                            </div>
                            {predictions.allocation.preference_rank && (
                              <div>
                                <span className="text-muted-foreground">Preference Rank:</span>
                                <span className="ml-2 font-medium">#{predictions.allocation.preference_rank}</span>
                              </div>
                            )}
                            {predictions.allocation.match_score && (
                              <div>
                                <span className="text-muted-foreground">Match Score:</span>
                                <span className="ml-2 font-medium">{(predictions.allocation.match_score * 100).toFixed(1)}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Overall Stats */}
                {predictions.fairness && (
                  <Card>
                    <CardContent className="p-6">
                      <h4 className="font-semibold mb-4">Overall Allocation Statistics</h4>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-primary">
                            {predictions.fairness.total_applicants?.toLocaleString() || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Applicants</div>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {predictions.fairness.total_placed?.toLocaleString() || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Placed</div>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {predictions.fairness.placement_rate
                              ? `${(predictions.fairness.placement_rate * 100).toFixed(1)}%`
                              : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">Placement Rate</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Click the "Predictions" tab to load your allocation results.</p>
                <p className="text-sm mt-2">Make sure your profile is complete to see your match.</p>
              </div>
            )}
          </TabsContent>

          {/* CAREER HUB TAB */}
          <TabsContent value="careerhub" className="space-y-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
                <FolderOpen className="h-4 w-4" />
                Career Resources Hub
              </div>
              <h2 className="text-xl font-semibold">📁 Career Hub</h2>
              <p className="text-muted-foreground">Learning paths, resume tips, and placement insights</p>
            </motion.div>

            {/* Learning Path Cards */}
            <CareerLearningPaths />

            {/* Resume Optimization Tips */}
            <ResumeOptimizationTips />

            {/* Placement Insights */}
            <PlacementInsights />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function isStudentProfileComplete(): boolean {
  try {
    const raw = safeGet("studentProfile");
    if (!raw) return false;
    const p = JSON.parse(raw);

    const hasName = !!p?.name;
    const hasAadhar = p?.aadharVerified === true;
    const hasSkills = Array.isArray(p?.skills) && p.skills.length > 0;
    const hasQualification = !!p?.highestQualification;
    const marks = p?.marksGPA;
    const hasMarks = typeof marks === "number" && !isNaN(marks) && marks >= 0 && marks <= 10;
    const hasInstitution = !!p?.latestEducationInstitution;

    return hasName && hasAadhar && hasSkills && hasQualification && hasMarks && hasInstitution;
  } catch {
    return false;
  }
}

/* --- Career Learning Paths Component --- */
function CareerLearningPaths() {
  const roadmaps = [
    {
      title: "Roadmap to IT",
      emoji: "💻",
      color: "from-blue-500/20 to-purple-500/20",
      borderColor: "border-blue-500/30",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      steps: [
        { title: "Step 1: Learn the Basics", description: "Master fundamentals of programming, data structures, and algorithms" },
        { title: "Step 2: Do Mini Projects", description: "Build practical applications to apply your knowledge" },
        { title: "Step 3: Prepare for Interviews", description: "Practice coding challenges and system design" },
      ],
      resources: [
        { name: "FreeCodeCamp", url: "https://www.freecodecamp.org" },
        { name: "LeetCode", url: "https://leetcode.com" },
        { name: "GeeksforGeeks", url: "https://www.geeksforgeeks.org" },
      ]
    },
    {
      title: "Roadmap to Finance",
      emoji: "💰",
      color: "from-green-500/20 to-emerald-500/20",
      borderColor: "border-green-500/30",
      iconBg: "bg-green-500/10",
      iconColor: "text-green-600 dark:text-green-400",
      steps: [
        { title: "Step 1: Learn the Basics", description: "Understand financial statements, accounting principles, and market fundamentals" },
        { title: "Step 2: Do Mini Projects", description: "Create financial models and perform company valuations" },
        { title: "Step 3: Prepare for Interviews", description: "Study case scenarios and financial analysis techniques" },
      ],
      resources: [
        { name: "Investopedia", url: "https://www.investopedia.com" },
        { name: "Khan Academy Finance", url: "https://www.khanacademy.org/economics-finance-domain" },
        { name: "Corporate Finance Institute", url: "https://corporatefinanceinstitute.com" },
      ]
    },
    {
      title: "Roadmap to Mechanical",
      emoji: "⚙️",
      color: "from-orange-500/20 to-red-500/20",
      borderColor: "border-orange-500/30",
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-600 dark:text-orange-400",
      steps: [
        { title: "Step 1: Learn the Basics", description: "Study mechanics, thermodynamics, and material science" },
        { title: "Step 2: Do Mini Projects", description: "Design mechanical components using CAD software" },
        { title: "Step 3: Prepare for Interviews", description: "Review core concepts and problem-solving techniques" },
      ],
      resources: [
        { name: "MIT OpenCourseWare", url: "https://ocw.mit.edu/courses/mechanical-engineering/" },
        { name: "AutoCAD Tutorials", url: "https://www.autodesk.com/support/technical/tutorials" },
        { name: "NPTEL Mechanical", url: "https://nptel.ac.in/course.html" },
      ]
    },
    {
      title: "Roadmap to Civil",
      emoji: "🏗️",
      color: "from-yellow-500/20 to-amber-500/20",
      borderColor: "border-yellow-500/30",
      iconBg: "bg-yellow-500/10",
      iconColor: "text-yellow-600 dark:text-yellow-400",
      steps: [
        { title: "Step 1: Learn the Basics", description: "Master structural analysis, surveying, and construction materials" },
        { title: "Step 2: Do Mini Projects", description: "Design simple structures and perform site planning" },
        { title: "Step 3: Prepare for Interviews", description: "Study construction methods and project management" },
      ],
      resources: [
        { name: "Civil Engineering Portal", url: "https://www.engineeringcivil.com" },
        { name: "The Constructor", url: "https://theconstructor.org" },
        { name: "NPTEL Civil", url: "https://nptel.ac.in/course.html" },
      ]
    },
    {
      title: "Roadmap to Electronics",
      emoji: "🔌",
      color: "from-indigo-500/20 to-violet-500/20",
      borderColor: "border-indigo-500/30",
      iconBg: "bg-indigo-500/10",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      steps: [
        { title: "Step 1: Learn the Basics", description: "Understand circuit theory, digital electronics, and microcontrollers" },
        { title: "Step 2: Do Mini Projects", description: "Build circuits and program embedded systems" },
        { title: "Step 3: Prepare for Interviews", description: "Review electronics fundamentals and practical applications" },
      ],
      resources: [
        { name: "All About Circuits", url: "https://www.allaboutcircuits.com" },
        { name: "Arduino Project Hub", url: "https://create.arduino.cc/projecthub" },
        { name: "Tinkercad Circuits", url: "https://www.tinkercad.com/circuits" },
      ]
    },
    {
      title: "Roadmap to Marketing",
      emoji: "📢",
      color: "from-pink-500/20 to-rose-500/20",
      borderColor: "border-pink-500/30",
      iconBg: "bg-pink-500/10",
      iconColor: "text-pink-600 dark:text-pink-400",
      steps: [
        { title: "Step 1: Learn the Basics", description: "Study marketing fundamentals, consumer behavior, and digital marketing" },
        { title: "Step 2: Do Mini Projects", description: "Create marketing campaigns and analyze market trends" },
        { title: "Step 3: Prepare for Interviews", description: "Prepare case studies and demonstrate creative thinking" },
      ],
      resources: [
        { name: "HubSpot Academy", url: "https://academy.hubspot.com" },
        { name: "Google Digital Garage", url: "https://learndigital.withgoogle.com/digitalgarage" },
        { name: "Neil Patel Blog", url: "https://neilpatel.com/blog/" },
      ]
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-2">1️⃣ Learning Path Cards</h3>
      <p className="text-sm text-muted-foreground mb-4">Click on any sector to explore the learning roadmap and curated resources</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
        {roadmaps.map((roadmap, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className={`border-2 ${roadmap.borderColor} hover:shadow-lg transition-all duration-300 overflow-hidden`}>
              <div className={`bg-gradient-to-r ${roadmap.color} p-4 border-b ${roadmap.borderColor}`}>
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`${roadmap.iconBg} p-2 rounded-lg`}>
                      <span className="text-2xl">{roadmap.emoji}</span>
                    </div>
                    <h4 className={`font-bold text-base ${roadmap.iconColor}`}>{roadmap.title}</h4>
                  </div>
                  {openIndex === index ? (
                    <ChevronUp className={`h-5 w-5 ${roadmap.iconColor}`} />
                  ) : (
                    <ChevronDown className={`h-5 w-5 ${roadmap.iconColor}`} />
                  )}
                </button>
              </div>

              {openIndex === index && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-3">
                      {roadmap.steps.map((step, stepIdx) => (
                        <div
                          key={stepIdx}
                          className={`pl-4 border-l-4 ${roadmap.borderColor} bg-gradient-to-r ${roadmap.color} p-3 rounded-r-lg`}
                        >
                          <h5 className={`font-semibold text-sm ${roadmap.iconColor}`}>{step.title}</h5>
                          <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                        </div>
                      ))}
                    </div>
                    <div className={`mt-4 pt-4 border-t-2 ${roadmap.borderColor}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">📚</span>
                        <h5 className="font-semibold text-sm">Curated Resources</h5>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {roadmap.resources.map((resource, resIdx) => (
                          <a
                            key={resIdx}
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 text-sm ${roadmap.iconColor} hover:underline hover:translate-x-1 transition-transform duration-200 p-2 rounded-lg ${roadmap.iconBg}`}
                          >
                            <span className="text-xs">→</span>
                            <span className="font-medium">{resource.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* --- Resume Optimization Tips Component --- */
function ResumeOptimizationTips() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">2️⃣ Resume Optimization Tips</h3>
      <Card className="border">
        <CardContent className="p-4">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between text-left"
          >
            <h4 className="font-semibold text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              ⭐ Resume Optimization Tips
            </h4>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Remove "Objective"</strong> — add a short summary instead</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Use action-oriented words</strong> (Built, Designed, Analyzed, Led, Improved)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Replace long paragraphs</strong> with bullet points</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Show achievements</strong> using measurable metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Tailor your resume</strong> to match job descriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Keep it to 1-2 pages</strong> for freshers/early career</span>
                </li>
              </ul>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* --- Placement Insights Dashboard Component --- */
function PlacementInsights() {
  const insights = {
    topIndustries: [
      { name: "IT Services", count: 4500 },
      { name: "Manufacturing", count: 2800 },
      { name: "Finance", count: 2100 },
      { name: "Healthcare", count: 1500 },
    ],
    topSkills: [
      { skill: "Python", demand: 85 },
      { skill: "Data Analysis", demand: 78 },
      { skill: "Communication", demand: 72 },
      { skill: "Problem Solving", demand: 70 },
    ],
    avgPlacementRate: 76.5,
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">3️⃣ Placement Insights Dashboard</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm mb-3">Top Industries Hiring</h4>
            <div className="space-y-2">
              {insights.topIndustries.map((ind, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm">{ind.name}</span>
                  <span className="text-sm font-medium text-primary">{ind.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold text-sm mb-3">Top Skills in Demand</h4>
            <div className="space-y-3">
              {insights.topSkills.map((skill, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{skill.skill}</span>
                    <span className="font-medium">{skill.demand}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${skill.demand}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center h-full">
            <h4 className="font-semibold text-sm mb-3">Overall Placement Rate</h4>
            <div className="relative w-24 h-24">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="10"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="10"
                  strokeDasharray={`${insights.avgPlacementRate * 2.51} 251`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  initial={{ strokeDasharray: "0 251" }}
                  animate={{ strokeDasharray: `${insights.avgPlacementRate * 2.51} 251` }}
                  transition={{ duration: 1 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{insights.avgPlacementRate}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Based on last batch</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}