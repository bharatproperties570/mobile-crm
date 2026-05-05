import api from "./api";

/**
 * SequencesService — Mobile CRM
 *
 * Enterprise Design:
 *   - Source stamp: all mobile enrollments are tagged source: 'mobile_agent'
 *   - Idempotency: enrollment status is checked before each enroll attempt
 *   - Graceful degradation: returns fallback data if backend feature is offline
 */

export interface Sequence {
    id: string;
    _id?: string;
    name: string;
    description?: string;
    module: string;
    purpose?: string;
    trigger?: { type: string; minScore?: number; maxScore?: number };
    active: boolean;
    steps: SequenceStep[];
    exitConditions?: { onDealCreated?: boolean; onLost?: boolean };
    createdAt?: string;
}

export interface SequenceStep {
    id: number;
    day: number;
    time: string;
    type: "Call" | "WhatsApp" | "Site Visit" | "Reminder" | "Email" | "Property Match";
    instruction: string;
}

export interface SequenceEnrollment {
    id: string;
    entityId: string;
    sequenceId: string;
    sequenceName?: string;
    status: "active" | "paused" | "completed" | "stopped";
    enrolledBy: "trigger" | "sequence_engine" | "manual" | "mobile_agent" | "system";
    enrolledAt: string;
    currentStep?: number;
    nextStepAt?: string;
}

export interface EnrollmentCheckResult {
    enrolled: boolean;
    status: SequenceEnrollment["status"] | null;
    enrolledBy: SequenceEnrollment["enrolledBy"] | null;
    enrollment?: SequenceEnrollment;
}

// ── Fallback sequence catalog (used when backend sequence API unavailable) ────
const FALLBACK_SEQUENCES: Sequence[] = [
    {
        id: "seq1",
        name: "New Lead Follow-up",
        description: "5-step intro → qualification → inventory match workflow",
        module: "leads",
        purpose: "New Lead",
        active: true,
        steps: [
            { id: 1, day: 0,  time: "09:00", type: "Call",           instruction: "Initial Intro Call" },
            { id: 2, day: 1,  time: "10:00", type: "WhatsApp",       instruction: "Send Introduction PDF" },
            { id: 3, day: 3,  time: "11:00", type: "Call",           instruction: "Follow-up on Interest" },
            { id: 4, day: 5,  time: "09:00", type: "Property Match", instruction: "Send Top 3 Inventory Matches" },
            { id: 5, day: 7,  time: "10:00", type: "Reminder",       instruction: "Check-in Call" },
        ],
        exitConditions: { onDealCreated: true, onLost: true },
    },
    {
        id: "seq2",
        name: "Hot Lead Fast-Track",
        description: "Immediate connection + same-day site visit scheduling",
        module: "leads",
        purpose: "Follow-up",
        active: true,
        steps: [
            { id: 1, day: 0, time: "09:00", type: "Call",       instruction: "Immediate Connection" },
            { id: 2, day: 1, time: "09:30", type: "Site Visit", instruction: "Schedule Property Visit" },
        ],
        exitConditions: { onDealCreated: true },
    },
    {
        id: "seq3",
        name: "Dormant Lead Reactivation",
        description: "Monthly check-in sequence for cold leads over 6 months",
        module: "leads",
        purpose: "Reactivation",
        active: true,
        steps: [
            { id: 1, day: 0,   time: "10:00", type: "WhatsApp", instruction: "Re-engagement message with new listings" },
            { id: 2, day: 7,   time: "11:00", type: "Call",     instruction: "Reactivation call" },
            { id: 3, day: 30,  time: "10:00", type: "WhatsApp", instruction: "Monthly check-in" },
            { id: 4, day: 60,  time: "10:00", type: "WhatsApp", instruction: "Second monthly check-in" },
            { id: 5, day: 90,  time: "10:00", type: "Call",     instruction: "Quarterly follow-up call" },
            { id: 6, day: 180, time: "10:00", type: "Reminder", instruction: "Six-month review" },
        ],
        exitConditions: { onDealCreated: true },
    },
];

/**
 * Fetch all active sequences for leads module.
 * Falls back to local catalog if backend unavailable.
 */
export const getLeadSequences = async (): Promise<Sequence[]> => {
    try {
        const { data } = await api.get("/marketing/sequences", { params: { module: "leads", active: true } });
        if (data?.success && Array.isArray(data.data) && data.data.length > 0) {
            return data.data;
        }
        return FALLBACK_SEQUENCES;
    } catch {
        // Backend sequence listing not yet implemented — use local catalog
        return FALLBACK_SEQUENCES;
    }
};

/**
 * Check if a lead is currently enrolled in a specific sequence.
 * Returns enrollment status for idempotency guard in UI.
 */
export const checkEnrollmentStatus = async (
    leadId: string,
    sequenceId: string
): Promise<EnrollmentCheckResult> => {
    try {
        const { data } = await api.get(`/marketing/sequences/enrollment-status`, {
            params: { entityId: leadId, sequenceId },
        });
        if (data?.success) {
            return {
                enrolled: data.enrolled ?? false,
                status: data.status ?? null,
                enrolledBy: data.enrolledBy ?? null,
                enrollment: data.enrollment,
            };
        }
        return { enrolled: false, status: null, enrolledBy: null };
    } catch {
        // Endpoint may not exist yet — default to not enrolled (safe for UX)
        return { enrolled: false, status: null, enrolledBy: null };
    }
};

/**
 * Get all active/paused enrollments for a given lead.
 * Used to show current nurture state on the sequences screen.
 */
export const getLeadEnrollments = async (leadId: string): Promise<SequenceEnrollment[]> => {
    try {
        const { data } = await api.get(`/marketing/sequences/enrollments`, {
            params: { entityId: leadId, status: "active,paused" },
        });
        if (data?.success && Array.isArray(data.data)) {
            return data.data;
        }
        return [];
    } catch {
        return [];
    }
};

/**
 * Enroll a lead in a sequence via the backend drip queue.
 *
 * Enterprise:
 *   - source: 'mobile_agent' stamps the audit trail
 *   - Backend handles BullMQ scheduling
 *   - Graceful fallback if Redis/Queue is offline
 */
export const enrollLeadInSequence = async (
    leadId: string,
    sequenceId: string
): Promise<{ success: boolean; jobId?: string; message?: string; error?: string }> => {
    try {
        const { data } = await api.post("/marketing/activate-drip", {
            leadId,
            sequenceId,
            delayMs: 0,
            source: "mobile_agent", // Enterprise audit stamp
        });

        if (data?.success) {
            return { success: true, jobId: data.jobId, message: "Sequence enrolled successfully" };
        }
        return { success: false, error: data?.error || "Enrollment failed" };
    } catch (err: any) {
        const errMsg = err?.response?.data?.error || err?.message || "Network error";
        console.error("[SequencesService] enrollLeadInSequence failed:", errMsg);
        return { success: false, error: errMsg };
    }
};

/**
 * Stop/unenroll a lead from an active sequence.
 */
export const unenrollLeadFromSequence = async (
    leadId: string,
    sequenceId: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data } = await api.post("/marketing/sequences/unenroll", {
            leadId,
            sequenceId,
            source: "mobile_agent",
        });
        return { success: data?.success ?? false, error: data?.error };
    } catch (err: any) {
        return { success: false, error: err?.response?.data?.error || "Stop failed" };
    }
};
