// client/src/components/EligibilityChecker.tsx
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CheckItem {
  id: string;
  label: string;
  status: "pending" | "checking" | "passed" | "failed";
}

interface EligibilityCheckerProps {
  onComplete?: () => void;
  /**
   * Optionally override the verification endpoint URL.
   * Default: /api/verify-aadhar
   */
  verifyEndpoint?: string;
  /**
   * Upload / verification timeout in milliseconds
   */
  timeoutMs?: number;
}

export function EligibilityChecker({
  onComplete,
  verifyEndpoint = "/api/verify-aadhar",
  timeoutMs = 30000,
}: EligibilityCheckerProps) {
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [verified, setVerified] = useState<boolean>(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  const [showChecks, setShowChecks] = useState(false);
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: "age", label: "Age Verification (18-25 years)", status: "pending" },
    { id: "education", label: "Educational Qualification", status: "pending" },
    { id: "residence", label: "Indian Citizenship", status: "pending" },
    { id: "income", label: "Family Income Criteria", status: "pending" },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // ------------------------------
  // File handling
  // ------------------------------
  const handleFileSelect = (file: File | null) => {
    setUploadError(null);
    setVerified(false);
    setVerificationMessage(null);
    setUploadProgress(0);

    if (!file) {
      setAadharFile(null);
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only JPG, PNG, or PDF files are accepted.");
      setAadharFile(null);
      return;
    }

    setAadharFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] || null;
    handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // ------------------------------
  // Upload + backend verification (using XHR for progress)
  // ------------------------------
  const startUploadAndVerify = () => {
    if (!aadharFile) {
      setUploadError("Please upload Aadhar file first.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);
    setVerificationMessage(null);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    const form = new FormData();
    form.append("aadhar", aadharFile);
    // if you need other fields, append them here (e.g., userId)

    xhr.open("POST", verifyEndpoint, true);

    // Attach auth header if token exists in localStorage
    try {
      const token = localStorage.getItem("authToken");
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
    } catch (e) {
      // ignore localStorage read errors
    }

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      xhr.abort();
      setIsUploading(false);
      setUploadError("Verification timed out. Please try again.");
    }, timeoutMs);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        setUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      clearTimeout(timeoutId);
      setIsUploading(false);
      if (timedOut) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          // Expecting: { success: boolean, message?: string }
          if (json?.success === true) {
            setVerified(true);
            setVerificationMessage(json?.message ?? "Aadhar verified.");
            // start the animated checks after a small pause
            setTimeout(() => {
              setShowChecks(true);
            }, 600);
          } else {
            setVerified(false);
            setVerificationMessage(json?.message ?? "Aadhar verification failed.");
            setUploadError(json?.message ?? "Verification failed. Please upload a clearer copy.");
          }
        } catch (err) {
          setUploadError("Unexpected server response. Try again.");
        }
      } else {
        setUploadError(`Server error: ${xhr.status}. Please try again.`);
      }
    };

    xhr.onerror = () => {
      clearTimeout(timeoutId);
      setIsUploading(false);
      if (!timedOut) {
        setUploadError("Network error during upload. Please check your connection and try again.");
      }
    };

    xhr.onabort = () => {
      clearTimeout(timeoutId);
      setIsUploading(false);
      if (!timedOut) {
        setUploadError("Upload cancelled.");
      }
    };

    xhr.send(form);
  };

  const cancelUpload = () => {
    try {
      xhrRef.current?.abort();
    } catch {}
    setIsUploading(false);
  };

  // ------------------------------
  // Existing eligibility checks flow (unchanged, starts after verification)
  // ------------------------------
  useEffect(() => {
    if (!showChecks) return;

    if (currentIndex < checks.length) {
      setChecks((prev) =>
        prev.map((check, i) => (i === currentIndex ? { ...check, status: "checking" } : check))
      );

      const timer = setTimeout(() => {
        setChecks((prev) => prev.map((check, i) => (i === currentIndex ? { ...check, status: "passed" } : check)));
        setCurrentIndex((prev) => prev + 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (currentIndex === checks.length && !isComplete) {
      setIsComplete(true);
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    }
  }, [showChecks, currentIndex, checks.length, isComplete, onComplete]);

  const progress = showChecks ? (checks.filter((c) => c.status === "passed").length / checks.length) * 100 : 0;

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <Card className="w-full max-w-md mx-auto" data-testid="eligibility-checker">
      <CardHeader>
        <CardTitle className="text-center">{showChecks ? "Checking Eligibility" : "Upload Aadhar Card"}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {!showChecks && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-muted rounded-md p-6 text-center cursor-pointer"
              aria-label="Aadhar upload dropzone"
            >
              {!aadharFile ? (
                <>
                  <p className="text-muted-foreground mb-3">Drag & drop your Aadhar card here, or</p>
                  <label className="px-4 py-2 bg-primary/10 text-primary rounded cursor-pointer inline-block">
                    Browse Files
                    <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={handleFileInput} />
                  </label>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p className="font-medium">{aadharFile.name}</p>
                  <div className="text-xs text-muted-foreground">{(aadharFile.size / 1024).toFixed(1)} KB</div>
                </div>
              )}
            </div>

            {uploadError && <p className="text-sm text-red-500 text-center">{uploadError}</p>}

            {!isUploading ? (
              <div className="flex gap-2">
                <button
                  onClick={startUploadAndVerify}
                  disabled={!aadharFile}
                  className={`flex-1 py-2 rounded ${aadharFile ? "bg-primary text-white" : "opacity-50 bg-muted cursor-not-allowed"}`}
                >
                  Upload & Verify
                </button>

                <button
                  onClick={() => {
                    setAadharFile(null);
                    setUploadError(null);
                  }}
                  className="px-4 py-2 rounded border"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin" />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Uploading & verifying</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={cancelUpload} className="px-4 py-2 rounded border">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showChecks && (
          <>
            <Progress value={progress} className="h-2" />

            <div className="space-y-3">
              {checks.map((check) => (
                <motion.div
                  key={check.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  {check.status === "pending" && <Circle className="h-5 w-5 text-muted-foreground" />}
                  {check.status === "checking" && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                  {check.status === "passed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  <span className={`text-sm ${check.status === "passed" ? "text-foreground" : "text-muted-foreground"}`}>
                    {check.label}
                  </span>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {isComplete && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-4 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-600 dark:text-green-400">You are eligible!</p>
                  <p className="text-sm text-muted-foreground">Proceeding to authentication...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Show verification message when available */}
        {verificationMessage && !showChecks && (
          <div className="text-sm text-center text-muted-foreground">{verificationMessage}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default EligibilityChecker;
