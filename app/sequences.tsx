import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    ActivityIndicator, Alert, RefreshControl, Animated,
    ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getLeadById, type Lead, leadName } from "@/services/leads.service";
import {
    getLeadSequences, getLeadEnrollments, checkEnrollmentStatus,
    enrollLeadInSequence, unenrollLeadFromSequence,
    type Sequence, type SequenceEnrollment
} from "@/services/sequences.service";
import { safeApiCallSingle } from "@/services/api.helpers";

// ── Type Icons ──────────────────────────────────────────────────────────────
const STEP_ICONS: Record<string, { icon: string; color: string }> = {
    "Call":           { icon: "call",             color: "#3B82F6" },
    "WhatsApp":       { icon: "logo-whatsapp",    color: "#22C55E" },
    "Site Visit":     { icon: "location",          color: "#F59E0B" },
    "Email":          { icon: "mail",              color: "#6366F1" },
    "Property Match": { icon: "home",              color: "#8B5CF6" },
    "Reminder":       { icon: "notifications",    color: "#EC4899" },
};

// ── Source Labels ───────────────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    trigger:         { label: "Auto: Trigger",      icon: "flash",   color: "#6366F1" },
    sequence_engine: { label: "Auto: Rules Engine", icon: "cog",     color: "#8B5CF6" },
    manual:          { label: "Manual (Web CRM)",   icon: "person",  color: "#3B82F6" },
    mobile_agent:    { label: "Mobile Agent",       icon: "phone-portrait", color: "#10B981" },
    system:          { label: "System",             icon: "server",  color: "#64748B" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    active:    { bg: "#DCFCE7", text: "#166534", label: "Active" },
    paused:    { bg: "#FEF3C7", text: "#92400E", label: "Paused" },
    completed: { bg: "#E0F2FE", text: "#0369A1", label: "Completed" },
    stopped:   { bg: "#FEE2E2", text: "#991B1B",  label: "Stopped" },
};

export default function SequencesScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [lead, setLead] = useState<Lead | null>(null);
    const [sequences, setSequences] = useState<Sequence[]>([]);
    const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [enrolling, setEnrolling] = useState<string | null>(null); // sequenceId being processed
    const [expandedSeq, setExpandedSeq] = useState<string | null>(null);

    // ── Animations ─────────────────────────────────────────────────────────
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const loadData = useCallback(async (isRefresh = false) => {
        if (!id) return;
        if (!isRefresh) setLoading(true);

        const [leadRes, seqData, enrollData] = await Promise.all([
            safeApiCallSingle<Lead>(() => getLeadById(id!)),
            getLeadSequences(),
            getLeadEnrollments(id!),
        ]);

        if (leadRes.data) setLead(leadRes.data);
        setSequences(seqData);
        setEnrollments(enrollData);

        if (!isRefresh) {
            setLoading(false);
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        }
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData(true);
        setRefreshing(false);
    };

    // ── Per-sequence enrollment check ───────────────────────────────────────
    const getEnrollmentForSeq = (seqId: string): SequenceEnrollment | null => {
        return enrollments.find(
            e => e.sequenceId === seqId && (e.status === "active" || e.status === "paused")
        ) ?? null;
    };

    // ── Enroll Handler ──────────────────────────────────────────────────────
    const handleEnroll = async (seq: Sequence) => {
        if (!id || enrolling) return;

        // Idempotency UI check before API call
        const existing = getEnrollmentForSeq(seq.id);
        if (existing) {
            const statusLabel = STATUS_STYLES[existing.status]?.label ?? existing.status;
            Alert.alert(
                "Already Enrolled",
                `${lead ? leadName(lead) : "Lead"} is already ${statusLabel} in "${seq.name}".\n\n` +
                (existing.status === "paused"
                    ? "The sequence is paused (lead responded). Resume it from Web CRM."
                    : "Lead is actively progressing. Re-enrollment is not allowed."),
                [{ text: "OK" }]
            );
            return;
        }

        Alert.alert(
            "Confirm Enrollment",
            `Enroll ${lead ? leadName(lead) : "this lead"} in\n"${seq.name}"?\n\n${seq.steps.length} steps will be scheduled starting today.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Enroll",
                    onPress: async () => {
                        setEnrolling(seq.id);
                        const result = await enrollLeadInSequence(id!, seq.id);
                        setEnrolling(null);

                        if (result.success) {
                            // Optimistically update local enrollment state
                            const optimisticEnrollment: SequenceEnrollment = {
                                id: `mobile_${Date.now()}`,
                                entityId: id!,
                                sequenceId: seq.id,
                                sequenceName: seq.name,
                                status: "active",
                                enrolledBy: "mobile_agent",
                                enrolledAt: new Date().toISOString(),
                                currentStep: 0,
                            };
                            setEnrollments(prev => [...prev, optimisticEnrollment]);

                            Alert.alert(
                                "✅ Enrolled",
                                `${seq.name} sequence has been activated for ${lead ? leadName(lead) : "this lead"}.\n\nStep 1 will be scheduled at ${seq.steps[0]?.time ?? "09:00"} today.`,
                                [{ text: "Done" }]
                            );
                        } else {
                            Alert.alert("Enrollment Failed", result.error || "Please try again.", [{ text: "OK" }]);
                        }
                    },
                },
            ]
        );
    };

    // ── Stop Handler ────────────────────────────────────────────────────────
    const handleStop = async (seq: Sequence, enrollment: SequenceEnrollment) => {
        Alert.alert(
            "Stop Sequence",
            `Stop "${seq.name}" for ${lead ? leadName(lead) : "this lead"}?\n\nRemaining steps will be cancelled.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Stop",
                    style: "destructive",
                    onPress: async () => {
                        setEnrolling(seq.id);
                        const result = await unenrollLeadFromSequence(id!, seq.id);
                        setEnrolling(null);

                        if (result.success) {
                            setEnrollments(prev =>
                                prev.map(e =>
                                    e.id === enrollment.id ? { ...e, status: "stopped" } : e
                                )
                            );
                        } else {
                            // Even if API fails — update UI optimistically for offline UX
                            setEnrollments(prev =>
                                prev.map(e =>
                                    e.id === enrollment.id ? { ...e, status: "stopped" } : e
                                )
                            );
                            Alert.alert("Note", "Sequence stopped locally. Will sync when online.", [{ text: "OK" }]);
                        }
                    },
                },
            ]
        );
    };

    // ── Sequence Card ───────────────────────────────────────────────────────
    const renderSequenceCard = ({ item: seq }: { item: Sequence }) => {
        const enrollment = getEnrollmentForSeq(seq.id);
        const isEnrolled = !!enrollment;
        const isExpanded = expandedSeq === seq.id;
        const isProcessing = enrolling === seq.id;
        const statusStyle = enrollment ? STATUS_STYLES[enrollment.status] : null;
        const sourceInfo = enrollment ? SOURCE_LABELS[enrollment.enrolledBy] ?? SOURCE_LABELS.system : null;

        return (
            <View style={styles.card}>
                {/* Card Header */}
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedSeq(isExpanded ? null : seq.id)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.seqIconWrap, { backgroundColor: isEnrolled ? "#DCFCE7" : "#EFF6FF" }]}>
                        <Ionicons
                            name={isEnrolled ? "checkmark-circle" : "list"}
                            size={22}
                            color={isEnrolled ? "#16A34A" : "#3B82F6"}
                        />
                    </View>

                    <View style={styles.cardInfo}>
                        <Text style={styles.seqName}>{seq.name}</Text>
                        <Text style={styles.seqDesc} numberOfLines={1}>
                            {seq.steps.length} steps · {seq.purpose ?? seq.module}
                        </Text>
                        {isEnrolled && statusStyle && (
                            <View style={styles.statusRow}>
                                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                        {statusStyle.label}
                                    </Text>
                                </View>
                                {sourceInfo && (
                                    <View style={styles.sourceRow}>
                                        <Ionicons name={sourceInfo.icon as any} size={10} color={sourceInfo.color} />
                                        <Text style={[styles.sourceLabel, { color: sourceInfo.color }]}>
                                            {sourceInfo.label}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#94A3B8"
                    />
                </TouchableOpacity>

                {/* Expanded Steps Preview */}
                {isExpanded && (
                    <View style={styles.stepsContainer}>
                        {seq.steps.map((step, idx) => {
                            const stepIcon = STEP_ICONS[step.type] ?? { icon: "ellipse", color: "#64748B" };
                            return (
                                <View key={step.id} style={styles.stepRow}>
                                    <View style={[styles.stepDot, { backgroundColor: stepIcon.color + "20" }]}>
                                        <Ionicons name={stepIcon.icon as any} size={13} color={stepIcon.color} />
                                    </View>
                                    <View style={styles.stepInfo}>
                                        <Text style={styles.stepType}>{step.type}</Text>
                                        <Text style={styles.stepInstruction} numberOfLines={2}>{step.instruction}</Text>
                                    </View>
                                    <Text style={styles.stepDay}>Day {step.day}</Text>
                                    {idx < seq.steps.length - 1 && <View style={styles.stepLine} />}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Action Footer */}
                <View style={styles.cardFooter}>
                    {isEnrolled && enrollment ? (
                        enrollment.status === "active" ? (
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.stopBtn]}
                                onPress={() => handleStop(seq, enrollment)}
                                disabled={isProcessing}
                            >
                                {isProcessing
                                    ? <ActivityIndicator size="small" color="#DC2626" />
                                    : <><Ionicons name="stop-circle-outline" size={15} color="#DC2626" />
                                       <Text style={styles.stopBtnText}>Stop Sequence</Text></>}
                            </TouchableOpacity>
                        ) : enrollment.status === "paused" ? (
                            <View style={styles.pausedNote}>
                                <Ionicons name="pause-circle-outline" size={15} color="#D97706" />
                                <Text style={styles.pausedNoteText}>Paused · Resume via Web CRM</Text>
                            </View>
                        ) : null
                    ) : (
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.enrollBtn]}
                            onPress={() => handleEnroll(seq)}
                            disabled={!!enrolling}
                        >
                            {isProcessing
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <><Ionicons name="play-circle-outline" size={15} color="#fff" />
                                   <Text style={styles.enrollBtnText}>Enroll Lead</Text></>}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    // ── Active Enrollments Summary Header ───────────────────────────────────
    const activeEnrollments = enrollments.filter(e => e.status === "active" || e.status === "paused");

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator color="#1E3A8A" size="large" />
                    <Text style={styles.loadingText}>Loading Sequences…</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1E3A8A" />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>Sequences</Text>
                    {lead && (
                        <Text style={styles.headerSub} numberOfLines={1}>
                            {leadName(lead)}
                        </Text>
                    )}
                </View>
                <TouchableOpacity onPress={onRefresh} style={styles.backBtn}>
                    <Ionicons name="refresh" size={20} color="#1E3A8A" />
                </TouchableOpacity>
            </View>

            {/* Active Enrollments Banner */}
            {activeEnrollments.length > 0 && (
                <Animated.View style={[styles.activeBanner, { opacity: fadeAnim }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.activeBannerText}>
                        {activeEnrollments.length} active sequence{activeEnrollments.length > 1 ? "s" : ""}
                        {" "}running for this lead
                    </Text>
                </Animated.View>
            )}

            {/* Arch Info Banner */}
            <Animated.View style={[styles.infoBanner, { opacity: fadeAnim }]}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#7C3AED" />
                <Text style={styles.infoBannerText}>
                    Enrollment is idempotency-safe. A lead cannot be enrolled in the same sequence twice.
                </Text>
            </Animated.View>

            {/* Sequence List */}
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <FlatList
                    data={sequences.filter(s => s.active)}
                    renderItem={renderSequenceCard}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A8A" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="list-outline" size={36} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No active sequences available</Text>
                        </View>
                    }
                />
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container:         { flex: 1, backgroundColor: "#F8FAFC" },
    center:            { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    loadingText:       { color: "#64748B", fontSize: 14, fontWeight: "600" },

    // Header
    header:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backBtn:           { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
    headerTitleWrap:   { flex: 1, marginHorizontal: 12 },
    headerTitle:       { fontSize: 17, fontWeight: "800", color: "#1E3A8A" },
    headerSub:         { fontSize: 12, color: "#64748B", fontWeight: "600", marginTop: 2 },

    // Banners
    activeBanner:      { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginHorizontal: 16, marginTop: 12, backgroundColor: "#DCFCE7", borderRadius: 10, borderWidth: 1, borderColor: "#BBF7D0" },
    activeBannerText:  { fontSize: 12, color: "#166534", fontWeight: "700", flex: 1 },
    infoBanner:        { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: "#F5F3FF", borderRadius: 10 },
    infoBannerText:    { fontSize: 11, color: "#7C3AED", fontWeight: "600", flex: 1, lineHeight: 16 },

    // List
    list:              { padding: 16, gap: 12 },
    emptyBox:          { alignItems: "center", marginTop: 60, gap: 12 },
    emptyText:         { fontSize: 14, color: "#94A3B8", fontWeight: "600" },

    // Card
    card:              { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#F1F5F9", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    cardHeader:        { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 },
    seqIconWrap:       { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    cardInfo:          { flex: 1 },
    seqName:           { fontSize: 15, fontWeight: "800", color: "#1E293B", marginBottom: 2 },
    seqDesc:           { fontSize: 12, color: "#64748B", fontWeight: "500", marginBottom: 4 },

    // Status & Source
    statusRow:         { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    statusBadge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    statusText:        { fontSize: 10, fontWeight: "800" },
    sourceRow:         { flexDirection: "row", alignItems: "center", gap: 3 },
    sourceLabel:       { fontSize: 10, fontWeight: "700" },

    // Steps
    stepsContainer:    { paddingHorizontal: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
    stepRow:           { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, gap: 10, position: "relative" },
    stepDot:           { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 2 },
    stepInfo:          { flex: 1 },
    stepType:          { fontSize: 12, fontWeight: "700", color: "#1E293B" },
    stepInstruction:   { fontSize: 11, color: "#64748B", marginTop: 2, lineHeight: 16 },
    stepDay:           { fontSize: 10, fontWeight: "800", color: "#3B82F6", marginTop: 6 },
    stepLine:          { position: "absolute", left: 15, top: 40, width: 1, height: "100%", backgroundColor: "#E2E8F0" },

    // Footer actions
    cardFooter:        { padding: 12, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
    actionBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
    enrollBtn:         { backgroundColor: "#1E3A8A" },
    enrollBtnText:     { color: "#fff", fontWeight: "700", fontSize: 14 },
    stopBtn:           { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
    stopBtnText:       { color: "#DC2626", fontWeight: "700", fontSize: 14 },
    pausedNote:        { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
    pausedNoteText:    { fontSize: 12, color: "#D97706", fontWeight: "600" },
});
