import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, ActivityIndicator, Alert, Platform, SafeAreaView
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { updateActivity, getActivityById } from "./services/activities.service";
import { safeApiCall, safeApiCallSingle } from "./services/api.helpers";

const CALL_OUTCOMES = ["Connected", "No Answer", "Busy", "Wrong Number", "Left Voicemail"];
const MEETING_OUTCOMES = ["Conducted", "Rescheduled", "Cancelled", "No Show"];
const SITE_VISIT_OUTCOMES = ["Conducted", "Rescheduled", "Postponed", "Cancelled", "Did Not Visit"];
const MAIL_STATUSES = ["Sent", "Delivered", "Read", "Replied", "Bounced", "Undelivered", "Clicked", "Opened", "Ignored"];

export default function CompleteActivityScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        id: string;
        actType: string;
        entityName?: string;
    }>();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<any>({
        status: "Completed",
        completionDate: new Date().toISOString().split("T")[0],
        completionTime: new Date().toTimeString().slice(0, 5),
        direction: "Outgoing",
        callOutcome: "",
        completionResult: "",
        clientFeedback: "",
        meetingOutcomeStatus: "",
        visitedProperties: [] as any[]
    });

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());

    useEffect(() => {
        loadActivity();
    }, []);

    const loadActivity = async () => {
        if (!params.id) return;
        setLoading(true);
        const res = await safeApiCallSingle<any>(() => getActivityById(params.id));
        if (!res.error && res.data) {
            setFormData(prev => ({
                ...prev,
                ...res.data,
                status: "Completed", // Force status to completed for this screen
                details: res.data.details || {}
            }));
            if (res.data.details?.visitedProperties) {
                setFormData(prev => ({
                    ...prev,
                    visitedProperties: res.data.details.visitedProperties.map((p: any) => ({ ...p, result: p.result || "", feedback: p.feedback || "" }))
                }));
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        console.log("[CompleteActivity] handleSave pressed");
        setSaving(true);
        const payload = {
            ...formData,
            details: {
                ...formData.details,
                callOutcome: formData.callOutcome,
                completionResult: formData.completionResult,
                completionResultNote: formData.clientFeedback,
                meetingOutcomeStatus: formData.meetingOutcomeStatus,
                visitedProperties: formData.visitedProperties
            }
        };

        const res = await safeApiCall(() => updateActivity(params.id, payload));
        setSaving(false);

        if (!res.error) {
            Alert.alert("Success", "Outcome logged successfully", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } else {
            Alert.alert("Error", res.error || "Failed to log outcome");
        }
    };

    const getFormTitle = () => {
        switch (params.actType) {
            case "Call": return "Call Outcome";
            case "Meeting": return "Meeting Completion";
            case "Site Visit": return "Site Visit Completion";
            case "Email": return "Email Completion";
            case "Task": return "Task Completion";
            default: return "Complete Activity";
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        console.log("[CompleteActivity] Close pressed");
                        router.back();
                    }}
                    style={styles.iconBtn}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Ionicons name="close" size={24} color="#334155" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{getFormTitle()}</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    {saving ? <ActivityIndicator size="small" color="#2563EB" /> : <Text style={styles.saveBtn}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.entitySub}>Logged for: {params.entityName || "Related Entity"}</Text>

                {/* Call Form */}
                {params.actType === "Call" && (
                    <Section title="Connectivity Outcome" color="#10B981">
                        <Text style={styles.label}>Direction</Text>
                        <View style={styles.toggleRow}>
                            {["Incoming", "Outgoing"].map(d => (
                                <TouchableOpacity
                                    key={d}
                                    style={[styles.toggleBtn, formData.direction === d && styles.activeToggle]}
                                    onPress={() => setFormData(p => ({ ...p, direction: d }))}
                                >
                                    <Text style={[styles.toggleText, formData.direction === d && styles.activeToggleText]}>{d}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { marginTop: 16 }]}>Call Status</Text>
                        <View style={styles.chipGrid}>
                            {CALL_OUTCOMES.map(co => (
                                <TouchableOpacity
                                    key={co}
                                    style={[styles.chip, formData.callOutcome === co && styles.activeChip]}
                                    onPress={() => setFormData(p => ({ ...p, callOutcome: co }))}
                                >
                                    <Text style={[styles.chipText, formData.callOutcome === co && styles.activeChipText]}>{co}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { marginTop: 16 }]}>Outcome Remarks</Text>
                        <TextInput
                            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                            multiline
                            value={formData.clientFeedback}
                            onChangeText={t => setFormData(p => ({ ...p, clientFeedback: t }))}
                            placeholder="Brief notes about the call..."
                        />
                    </Section>
                )}

                {/* Meeting Form */}
                {params.actType === "Meeting" && (
                    <Section title="Meeting Results" color="#A21CAF">
                        <Text style={styles.label}>Status</Text>
                        <View style={styles.chipGrid}>
                            {MEETING_OUTCOMES.map(mo => (
                                <TouchableOpacity
                                    key={mo}
                                    style={[styles.chip, formData.meetingOutcomeStatus === mo && styles.activeChip]}
                                    onPress={() => setFormData(p => ({ ...p, meetingOutcomeStatus: mo }))}
                                >
                                    <Text style={[styles.chipText, formData.meetingOutcomeStatus === mo && styles.activeChipText]}>{mo}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.label}>Conducted Date</Text>
                                <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)}>
                                    <Text style={styles.dateText}>{formData.completionDate}</Text>
                                    <Ionicons name="calendar-outline" size={18} color="#A21CAF" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.label}>Conducted Time</Text>
                                <TouchableOpacity style={styles.datePicker} onPress={() => setShowTimePicker(true)}>
                                    <Text style={styles.dateText}>{formData.completionTime}</Text>
                                    <Ionicons name="time-outline" size={18} color="#A21CAF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={[styles.label, { marginTop: 16 }]}>Meeting Summary</Text>
                        <TextInput
                            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                            multiline
                            value={formData.clientFeedback}
                            onChangeText={t => setFormData(p => ({ ...p, clientFeedback: t }))}
                            placeholder="Summarize the client reaction..."
                        />
                    </Section>
                )}

                {/* Site Visit Form */}
                {params.actType === "Site Visit" && (
                    <Section title="Visit Log" color="#166534">
                        <Text style={styles.label}>Log Status</Text>
                        <View style={styles.chipGrid}>
                            {SITE_VISIT_OUTCOMES.map(so => (
                                <TouchableOpacity
                                    key={so}
                                    style={[styles.chip, formData.meetingOutcomeStatus === so && styles.activeChip]}
                                    onPress={() => setFormData(p => ({ ...p, meetingOutcomeStatus: so }))}
                                >
                                    <Text style={[styles.chipText, formData.meetingOutcomeStatus === so && styles.activeChipText]}>{so}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {formData.meetingOutcomeStatus === "Conducted" && formData.visitedProperties?.map((prop: any, idx: number) => (
                            <View key={idx} style={styles.propLogCard}>
                                <Text style={styles.propTitle}>🏢 {prop.project} {prop.unitNo ? `- ${prop.unitNo}` : ""}</Text>
                                <TextInput
                                    style={[styles.input, { height: 60, marginTop: 8 }]}
                                    multiline
                                    value={prop.feedback}
                                    onChangeText={t => {
                                        const n = [...formData.visitedProperties];
                                        n[idx].feedback = t;
                                        setFormData(p => ({ ...p, visitedProperties: n }));
                                    }}
                                    placeholder="Property specific feedback..."
                                />
                            </View>
                        ))}
                    </Section>
                )}

                {/* Task Form */}
                {params.actType === "Task" && (
                    <Section title="Execution Report" color="#5B21B6">
                        <Text style={styles.label}>Completion Date</Text>
                        <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)}>
                            <Text style={styles.dateText}>{formData.completionDate}</Text>
                            <Ionicons name="calendar-outline" size={18} color="#5B21B6" />
                        </TouchableOpacity>

                        <Text style={[styles.label, { marginTop: 16 }]}>Execution Remarks</Text>
                        <TextInput
                            style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                            multiline
                            value={formData.clientFeedback}
                            onChangeText={t => setFormData(p => ({ ...p, clientFeedback: t }))}
                            placeholder="What exactly was completed?"
                        />
                    </Section>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {showDatePicker && (
                <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    onChange={(e, d) => {
                        setShowDatePicker(false);
                        if (d) setFormData(p => ({ ...p, completionDate: d.toISOString().split("T")[0] }));
                    }}
                />
            )}

            {showTimePicker && (
                <DateTimePicker
                    value={pickerDate}
                    mode="time"
                    display="default"
                    onChange={(e, d) => {
                        setShowTimePicker(false);
                        if (d) setFormData(p => ({ ...p, completionTime: d.toTimeString().slice(0, 5) }));
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const Section = ({ title, children, color = "#2563EB" }: { title: string; children: React.ReactNode; color?: string }) => (
    <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color }]}>{title}</Text>
        <View style={styles.sectionCard}>{children}</View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
        backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9"
    },
    headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
    saveBtn: { color: "#2563EB", fontWeight: "800", fontSize: 16 },
    iconBtn: { padding: 4 },
    content: { flex: 1, padding: 16 },
    entitySub: { fontSize: 14, color: "#64748B", fontWeight: "600", marginBottom: 20, textAlign: 'center' },
    section: { marginBottom: 24 },
    sectionLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, paddingLeft: 4 },
    sectionCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#F1F5F9" },
    label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
    input: {
        backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
        borderRadius: 16, padding: 14, fontSize: 15, color: "#1E293B"
    },
    toggleRow: { flexDirection: "row", gap: 12 },
    toggleBtn: {
        flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0",
        backgroundColor: "#fff", alignItems: "center", justifyContent: "center"
    },
    activeToggle: { backgroundColor: "#EFF6FF", borderColor: "#2563EB" },
    toggleText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
    activeToggleText: { color: "#2563EB" },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff"
    },
    activeChip: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    chipText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
    activeChipText: { color: "#fff" },
    row: { flexDirection: "row", marginTop: 16 },
    datePicker: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
        borderRadius: 12, padding: 12
    },
    dateText: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
    propLogCard: {
        marginTop: 12, padding: 12, borderRadius: 12,
        backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#DCFCE7"
    },
    propTitle: { fontSize: 13, fontWeight: "700", color: "#166534" }
});
