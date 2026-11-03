/**
 * ML API Client Library
 * Provides typed functions for interacting with the ML backend through our proxy
 */

// Types for ML API responses
export interface Allocation {
    student_id: string;
    internship_id: string;
    pref_rank: number;
}

export interface CategoryStats {
    eligible: number;
    placed: number;
    placement_rate: number;
}

export interface FairnessData {
    total_applicants: number;
    total_placed: number;
    placement_rate: number;
    category_wise: Record<string, CategoryStats>;
    gender_wise: { M: number; F: number; O: number } | Record<string, { eligible: number; placed: number; placement_rate: number }>;
    rural: { eligible: number; placed: number; placement_rate: number };
    rural_wise?: Record<string, { eligible: number; placed: number; placement_rate: number }>;
}

export interface BoostReport {
    boosted_students: number;
    boosted_selected: number;
    uplift_success_rate: number;
    counterfactual_helped_students: number;
}

export interface DashboardData {
    students: number;
    internships: number;
    allocations_count: number;
    allocations: Allocation[];
    fairness: FairnessData;
    boost_report?: BoostReport;
}

const ML_API_BASE = "/api/admin";

/**
 * Upload students CSV file to ML backend
 */
export async function uploadStudentsCSV(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${ML_API_BASE}/upload/students`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload students failed: ${error}`);
    }

    return response.json();
}

/**
 * Upload internships CSV file to ML backend
 */
export async function uploadInternshipsCSV(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${ML_API_BASE}/upload/internships`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload internships failed: ${error}`);
    }

    return response.json();
}

/**
 * Train the ML model
 */
export async function trainModel(): Promise<any> {
    const response = await fetch(`${ML_API_BASE}/train`, {
        method: "POST",
        credentials: "include",
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Training failed: ${error}`);
    }

    return response.json();
}

/**
 * Run the allocation algorithm (async job pattern)
 * Returns immediately with jobId, then polls until complete
 */
export async function allocateInternships(
  onProgress?: (status: string, elapsedSec: number) => void
): Promise<any> {
    // Start the job
    const startRes = await fetch(`${ML_API_BASE}/allocate`, {
        method: "POST",
        credentials: "include",
    });

    if (!startRes.ok) {
        const error = await startRes.text();
        throw new Error(`Failed to start allocation: ${error}`);
    }

    const { jobId } = await startRes.json();
    if (!jobId) throw new Error("No job ID returned from allocation start");

    // Poll until done or failed (max 130 seconds)
    const POLL_INTERVAL_MS = 3000;
    const MAX_POLLS = 45; // 45 * 3s = 135s max

    for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

        const pollRes = await fetch(`${ML_API_BASE}/allocation-status/${jobId}`, {
            credentials: "include",
        });

        if (!pollRes.ok) {
            throw new Error("Failed to poll allocation status");
        }

        const job = await pollRes.json();
        const elapsedSec = Math.round((job.elapsedMs || 0) / 1000);

        if (job.status === "done") {
            onProgress?.("Allocation complete!", elapsedSec);
            return job.result;
        }

        if (job.status === "failed") {
            throw new Error(`Allocation failed: ${job.error}`);
        }

        onProgress?.(`Running allocation... (${elapsedSec}s)`, elapsedSec);
    }

    throw new Error("Allocation timed out after 135 seconds. Please check the dashboard.");
}

/**
 * Get dashboard data with allocation results
 */
export async function getDashboardData(): Promise<DashboardData> {
    const response = await fetch(`${ML_API_BASE}/dashboard`, {
        credentials: "include",
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Dashboard fetch failed: ${error}`);
    }

    return response.json();
}

/**
 * Download a file from ML backend
 */
export async function downloadFile(filename: string): Promise<Blob> {
    const response = await fetch(`${ML_API_BASE}/ml/download/${filename}`, {
        credentials: "include",
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Download failed: ${error}`);
    }

    return response.blob();
}

/**
 * Trigger browser download for a blob
 */
export function triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/**
 * Get boost impact report (JSON file)
 */
export async function getBoostImpact(): Promise<any> {
    try {
        const response = await fetch(`${ML_API_BASE}/ml/download/student_boost_impact.json`, {
            credentials: "include",
        });
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

/**
 * Get fairness report (JSON file)
 */
export async function getFairnessReport(): Promise<any> {
    try {
        const response = await fetch(`${ML_API_BASE}/ml/download/final_fairness_report.json`, {
            credentials: "include",
        });
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}
