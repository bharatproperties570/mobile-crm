import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ActivityIndicator, Alert, ScrollView, SafeAreaView, Vibration
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getActivityById, updateActivity } from "./services/activities.service";
import { getSystemSettingsByKey } from "./services/system-settings.service";
import { safeApiCallSingle } from "./services/api.helpers";
import { computeLeadStage, updateLeadStage, syncDealStage } from "./services/stageEngine.service";

// Standard Outcome Data (Fallback)
const DEFAULT_OUTCOMES: any = {
    "Call": {
        "Answered / Connected": [{ label: "Interested" }, { label: "Not Interested" }, { label: "Follow-up Required" }, { label: "Call Back Requested" }],
        "No Answer": [{ label: "Left Voicemail" }, { label: "No response" }],
        "Busy": [{ label: "Call Back Later" }],
        "Wrong Number": [{ label: "Invalid Lead" }]
    },
    "Meeting": {
        "Conducted": [{ label: "Interested" }, { label: "Next Step Decided" }, { label: "Price Discussion" }, { label: "Closing Soon" }],
        "Rescheduled": [{ label: "Client Requested" }, { label: "Mutual" }],
        "Cancelled": [{ label: "Client Cancelled" }, { label: "No Show" }]
    },
    "Site Visit": {
        "Conducted": [{ label: "Liked Property" }, { label: "Location Issue" }, { label: "Price Issue" }, { label: "Wants More Options" }],
        "Rescheduled": [{ label: "Weather" }, { label: "Client Busy" }]
    }
};

export default function OutcomeScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activity, setActivity] = useState<any>(null);
    const [masterSettings, setMasterSettings] = useState<any>(null);

    const [outcomeStatus, setOutcomeStatus] = useState("");
    const [result, setResult] = useState("");
    const [feedback, setFeedback] = useState("");

    // Date/Time Selection State
    const [completionDate, setCompletionDate] = useState(new Date());
    const [completionTime, setCompletionTime] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        console.log("[OutcomeScreen] Mounted with id:", id);
        if (id) {
            loadInitialData();
        }
    }, [id]);

    const loadInitialData = async () => {
        try {
            const [actRes, setRes] = await Promise.all([
                safeApiCallSingle(() => getActivityById(id as string)),
                safeApiCallSingle(() => getSystemSettingsByKey("activity_master_fields"))
            ]);

            if (actRes?.data) {
                setActivity(actRes.data);
                if (actRes.data.type === "Call") setOutcomeStatus("Answered / Connected");
                else if (["Meeting", "Site Visit"].includes(actRes.data.type)) setOutcomeStatus("Conducted");
            }
            if (setRes?.data) setMasterSettings(setRes.data.value);
        } catch (e) {
            console.error("Load outcome data error:", e);
        } finally {
            setLoading(false);
        }
    };

    const getDynamicOutcomes = () => {
        if (!activity) return [];
        const typeSettings = masterSettings?.activities?.find((a: any) => a.name === activity.type);
        const purposeName = activity.details?.purpose || activity.subject;
        const purposeObj = typeSettings?.purposes?.find((p: any) => p.name === purposeName);
        if (purposeObj?.outcomes) return purposeObj.outcomes;
        return DEFAULT_OUTCOMES[activity.type]?.[outcomeStatus] || [];
    };

    const handleSave = async () => {
        if (!outcomeStatus) return Alert.alert("Required", "Please select a status");

        setSaving(true);
        Vibration.vibrate(50);
        try {
            const payload = {
                status: "Completed",
                completedAt: new Date(`${completionDate.toISOString().split('T')[0]}T${completionTime.toTimeString().slice(0, 5)}`),
                details: {
                    ...activity.details,
                    meetingOutcomeStatus: outcomeStatus,
                    completionResult: result,
                    clientFeedback: feedback,
                    completionDate: completionDate.toISOString().split('T')[0],
                    completionTime: completionTime.toTimeString().slice(0, 5)
                }
            };
            await updateActivity(id as string, payload);

            // ── Stage Engine: trigger lead stage update ──────────────────────────
            // Resolve the lead/deal linked to this activity
            const entityId = activity.entityId || activity.relatedTo?.[0]?.id;
            const entityType = (activity.entityType || activity.relatedTo?.[0]?.entityType || "Lead").toLowerCase();
            const dealId = activity.dealId || activity.relatedTo?.find((r: any) => r.entityType?.toLowerCase() === "deal")?.id;

            if (entityId && entityType === "lead") {
                const currentStage = (activity.leadStage as string) || "New";
                const newStage = computeLeadStage(currentStage, outcomeStatus, result);

                // Fire and forget — don't block the success alert
                updateLeadStage(entityId, newStage, {
                    activityType: activity.type,
                    outcome: result || outcomeStatus,
                    activityId: id as string,
                    reason: `${activity.type} outcome: ${outcomeStatus}${result ? ` — ${result}` : ""}`,
                }).then(stageRes => {
                    if (stageRes?.success) {
                        console.info(`[StageEngine] Lead ${entityId} → ${newStage}`);
                        // If there's a linked deal, sync it too
                        if (dealId) {
                            syncDealStage(dealId, [newStage], {
                                reason: `Lead stage updated to ${newStage} via ${activity.type} outcome`
                            });
                        }
                    }
                }).catch(e => console.warn("[StageEngine] stage update failed", e));
            }
            // ────────────────────────────────────────────────────────────────────

            Alert.alert("Success", "Outcome logged successfully", [
                { text: "Done", onPress: () => router.back() }
            ]);
        } catch (e) {
            Alert.alert("Error", "Failed to save outcome");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
    if (!activity) return <View style={styles.center}><Text>Activity not found</Text></View>;

    const outcomes = getDynamicOutcomes();
    const statusOptions = activity.type === "Call"
        ? ["Answered / Connected", "No Answer", "Busy", "Wrong Number", "Left Voicemail"]
        : activity.type === "Meeting"
            ? ["Conducted", "Rescheduled", "Cancelled", "No Show"]
            : activity.type === "Site Visit"
                ? ["Conducted", "Rescheduled", "Cancelled", "Did Not Visit"]
                : ["Completed", "Cancelled"];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Log Outcome</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.typeBadge}>
                        <Ionicons
                            name={activity.type === "Call" ? "call" : activity.type === "Meeting" ? "people" : "map"}
                            size={14} color="#2563EB"
                        />
                        <Text style={styles.typeText}>{activity.type.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.subject}>{activity.subject}</Text>
                    <Text style={styles.subInfo}>{(activity as any).relatedTo?.[0]?.name || "General Client"}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Outcome Status</Text>
                    <View style={styles.chipGrid}>
                        {statusOptions.map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[styles.chip, outcomeStatus === s && styles.chipActive]}
                                onPress={() => {
                                    setOutcomeStatus(s);
                                    setResult("");
                                }}
                            >
                                <Text style={[styles.chipText, outcomeStatus === s && styles.chipTextActive]}>{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {outcomes.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Result / Detail</Text>
                        <View style={styles.chipGrid}>
                            {outcomes.map((o: any) => (
                                <TouchableOpacity
                                    key={o.label}
                                    style={[styles.resultChip, result === o.label && styles.resultChipActive]}
                                    onPress={() => setResult(o.label)}
                                >
                                    <Text style={[styles.chipText, result === o.label && styles.chipTextActive]}>{o.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.label}>Completion Date & Time</Text>
                    <View style={styles.dateTimeRow}>
                        <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowDatePicker(true)}>
                            <Ionicons name="calendar-outline" size={18} color="#475569" />
                            <Text style={styles.dateTimeText}>{completionDate.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowTimePicker(true)}>
                            <Ionicons name="time-outline" size={18} color="#475569" />
                            <Text style={styles.dateTimeText}>{completionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        value={completionDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) setCompletionDate(selectedDate);
                        }}
                    />
                )}

                {showTimePicker && (
                    <DateTimePicker
                        value={completionTime}
                        mode="time"
                        display="default"
                        onChange={(event, selectedTime) => {
                            setShowTimePicker(false);
                            if (selectedTime) setCompletionTime(selectedTime);
                        }}
                    />
                )}

                <View style={styles.section}>
                    <Text style={styles.label}>Feedback / Notes</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Write a brief summary of the outcome..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={4}
                        value={feedback}
                        onChangeText={setFeedback}
                    />
                </View>

                <View style={styles.infoBanner}>
                    <Ionicons name="information-circle-outline" size={16} color="#64748B" />
                    <Text style={styles.infoText}>Submitting will mark this activity as completed.</Text>
                </View>

                <TouchableOpacity
                    style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Outcome</Text>}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    headerTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    saveBtn: { color: '#2563EB', fontWeight: '800', fontSize: 16 },

    content: { padding: 20 },
    card: { marginBottom: 24, backgroundColor: '#F8FAFC', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#DBEAFE', marginBottom: 12 },
    typeText: { fontSize: 10, fontWeight: "900", color: "#2563EB" },
    subject: { fontSize: 20, fontWeight: "900", color: "#0F172A", marginBottom: 6 },
    subInfo: { fontSize: 14, color: "#64748B", fontWeight: "700" },

    section: { marginBottom: 28 },
    label: { fontSize: 14, fontWeight: "800", color: "#64748B", marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
    chipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    resultChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
    resultChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    chipText: { fontSize: 14, fontWeight: "700", color: "#64748B" },
    chipTextActive: { color: "#fff" },

    input: { backgroundColor: '#F8FAFC', borderRadius: 20, padding: 20, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#F1F5F9', textAlignVertical: 'top', height: 120, fontWeight: '600' },

    dateTimeRow: { flexDirection: 'row', gap: 12 },
    dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    dateTimeText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

    infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, backgroundColor: '#F1F5F9', borderRadius: 12 },
    infoText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

    submitBtn: { backgroundColor: '#2563EB', borderRadius: 20, paddingVertical: 20, alignItems: 'center', marginTop: 24, shadowColor: "#2563EB", shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
    submitText: { color: '#fff', fontSize: 16, fontWeight: "900" },
});
