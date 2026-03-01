import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ActivityIndicator, Alert, ScrollView, SafeAreaView, Vibration,
    Platform
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Audio } from 'expo-av';
import api from "./services/api";
import { getActivityById, updateActivity } from "./services/activities.service";
import { getSystemSettingsByKey } from "./services/system-settings.service";
import { safeApiCallSingle } from "./services/api.helpers";
import { computeLeadStage, updateLeadStage, syncDealStage } from "./services/stageEngine.service";
import { getAuthorizedFolder, requestFolderPermission, findLatestRecording } from "./services/storage.service";

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
    const { id, entityId: pEntityId, entityType: pEntityType, entityName: pEntityName, actType: pActType, mobile: pMobile } = useLocalSearchParams();
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

    // Audio Recording State
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingInterval = useRef<any>(null);

    // Auto-Sync State
    const [folderUri, setFolderUri] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [autoFetched, setAutoFetched] = useState(false);

    useEffect(() => {
        console.log("[OutcomeScreen] Mounted with id:", id);
        if (id) {
            loadInitialData();
        }
    }, [id]);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const setRes = await safeApiCallSingle(() => getSystemSettingsByKey("activity_master_fields"));
            if ((setRes as any)?.data) setMasterSettings((setRes as any).data.value);

            if (id === 'new') {
                const now = new Date();
                const newAct = {
                    type: pActType || "Call",
                    subject: `${pActType || "Call"} with ${pEntityName || "Client"}`,
                    entityId: pEntityId,
                    entityType: pEntityType || "Lead",
                    relatedTo: pEntityId ? [{ id: pEntityId, name: pEntityName || "Client", model: pEntityType || "Lead" }] : [],
                    dueDate: now.toISOString().split('T')[0],
                    dueTime: now.toTimeString().slice(0, 5),
                    status: "Pending"
                };
                setActivity(newAct);
                if (newAct.type === "Call") {
                    setOutcomeStatus("Answered / Connected");
                    if (Platform.OS === 'android') checkAndScanRecording();
                } else if (["Meeting", "Site Visit"].includes(newAct.type)) {
                    setOutcomeStatus("Conducted");
                }
            } else {
                const actRes = await safeApiCallSingle(() => getActivityById(id as any));
                if ((actRes as any)?.data) {
                    const act = (actRes as any).data;
                    setActivity(act);
                    if (act.type === "Call") {
                        setOutcomeStatus("Answered / Connected");
                        if (Platform.OS === 'android') checkAndScanRecording();
                    } else if (["Meeting", "Site Visit"].includes(act.type)) {
                        setOutcomeStatus("Conducted");
                    }
                }
            }
        } catch (e) {
            console.error("Load outcome data error:", e);
        } finally {
            setLoading(false);
        }
    };

    const getDynamicOutcomes = () => {
        if (!activity) return [];
        const typeSettings = (masterSettings as any)?.activities?.find((a: any) => a.name === (activity as any).type);
        const purposeName = (activity as any).details?.purpose || (activity as any).subject;
        const purposeObj = typeSettings?.purposes?.find((p: any) => p.name === purposeName);
        if (purposeObj?.outcomes) return purposeObj.outcomes;
        return DEFAULT_OUTCOMES[(activity as any).type]?.[outcomeStatus] || [];
    };

    const checkAndScanRecording = async () => {
        const uri = await getAuthorizedFolder();
        setFolderUri(uri);
        if (uri) {
            setIsScanning(true);
            const searchStr = Array.isArray(pMobile) ? pMobile[0] : pMobile;
            const latest = await findLatestRecording(15, searchStr); // Look back 15 mins for safety
            if (latest) {
                setRecordingUri(latest.uri);
                setAutoFetched(true);
                if ((latest as any).exact) {
                    Vibration.vibrate([0, 100, 50, 100, 50, 100]); // Special vibration for exact match
                } else {
                    Vibration.vibrate([0, 100, 50, 100]);
                }
            }
            setIsScanning(false);
        }
    };

    const handleEnableAutoSync = async () => {
        const uri = await requestFolderPermission();
        if (uri) {
            setFolderUri(uri);
            checkAndScanRecording();
        }
    };

    // --- Audio Recording Logic ---
    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                return Alert.alert('Permission Required', 'Microphone access is needed for voice memos.');
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
            setRecordingDuration(0);
            recordingInterval.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            Vibration.vibrate(100);
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Could not start recording');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;
        setIsRecording(false);
        clearInterval(recordingInterval.current);
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecordingUri(uri || null);
            setRecording(null);
            Vibration.vibrate(50);
        } catch (err) {
            console.error('Failed to stop recording', err);
        }
    };

    const playRecording = async () => {
        if (!recordingUri) return;
        try {
            if (sound) {
                await sound.unloadAsync();
            }
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: recordingUri },
                { shouldPlay: true }
            );
            setSound(newSound);
            setIsPlaying(true);
            newSound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.didJustFinish) setIsPlaying(false);
            });
        } catch (err) {
            console.error('Failed to play sound', err);
        }
    };

    const deleteRecording = () => {
        setRecordingUri(null);
        setRecordingDuration(0);
        if (sound) {
            sound.unloadAsync();
            setSound(null);
        }
    };

    const uploadAudio = async (uri: string) => {
        const formData = new FormData() as any;
        const filename = uri.split('/').pop() || 'voice_memo.m4a';

        formData.append('file', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            name: filename,
            type: 'audio/m4a',
        });

        const response = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        return response.data?.url;
    };

    const handleSave = async () => {
        if (!outcomeStatus) return Alert.alert("Required", "Please select a status");

        setSaving(true);
        Vibration.vibrate(50);
        try {
            let audioUrl = null;
            if (recordingUri) {
                try {
                    audioUrl = await uploadAudio(recordingUri);
                } catch (err) {
                    console.error('Audio upload failed:', err);
                    // Continue without audio if upload fails? Or ask user?
                    // For now, continue but log error.
                }
            }

            const payload = {
                ...activity,
                status: "Completed",
                completedAt: new Date(`${completionDate.toISOString().split('T')[0]}T${completionTime.toTimeString().slice(0, 5)}`),
                details: {
                    ...activity.details,
                    meetingOutcomeStatus: outcomeStatus,
                    completionResult: result,
                    clientFeedback: feedback,
                    completionDate: completionDate.toISOString().split('T')[0],
                    completionTime: completionTime.toTimeString().slice(0, 5),
                    audioUrl: audioUrl
                }
            };

            let savedActivity;
            if (id === 'new') {
                const res = await api.post("/activities", payload);
                savedActivity = res.data?.data || res.data;
            } else {
                await updateActivity(id as any, payload);
                savedActivity = activity;
            }

            // ── Stage Engine: trigger lead stage update ──────────────────────────
            // Resolve the lead/deal linked to this activity
            const entityId = savedActivity.entityId || savedActivity.relatedTo?.[0]?.id;
            const entityType = (savedActivity.entityType || savedActivity.relatedTo?.[0]?.entityType || "Lead").toLowerCase();
            const dealId = savedActivity.dealId || savedActivity.relatedTo?.find((r: any) => r.entityType?.toLowerCase() === "deal")?.id;

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

                {/* Voice Memo Section */}
                {activity.type === "Call" && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.label}>Voice Memo / Call Recording</Text>
                            {Platform.OS === 'android' && (
                                <View style={styles.autoSyncRow}>
                                    <TouchableOpacity
                                        onPress={handleEnableAutoSync}
                                        style={[styles.autoSyncBadge, folderUri && styles.autoSyncBadgeActive]}
                                    >
                                        <Ionicons name={folderUri ? "sync-circle" : "sync-circle-outline"} size={14} color={folderUri ? "#22C55E" : "#64748B"} />
                                        <Text style={[styles.autoSyncBadgeText, folderUri && { color: "#22C55E" }]}>
                                            {folderUri ? "AUTO-SYNC ON" : "ENABLE AUTO-SYNC"}
                                        </Text>
                                    </TouchableOpacity>
                                    {folderUri && (
                                        <TouchableOpacity onPress={checkAndScanRecording} style={styles.rescanBtn}>
                                            <Ionicons name="refresh" size={12} color="#2563EB" />
                                            <Text style={styles.rescanText}>RE-SCAN</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                        <View style={styles.audioCard}>
                            {isScanning ? (
                                <View style={styles.scanningContainer}>
                                    <ActivityIndicator size="small" color="#2563EB" />
                                    <Text style={styles.scanningText}>Scanning for latest call recording...</Text>
                                </View>
                            ) : !recordingUri ? (
                                <View>
                                    <TouchableOpacity
                                        style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                                        onPress={isRecording ? stopRecording : startRecording}
                                    >
                                        <Ionicons name={isRecording ? "stop" : "mic"} size={28} color="#fff" />
                                        <View style={styles.recordTextContainer}>
                                            <Text style={styles.recordTitle}>{isRecording ? "Stop Recording" : "Tap to Record Summary"}</Text>
                                            <Text style={styles.recordTimer}>
                                                {isRecording ? `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')}` : "Maximum 2 minutes recommended"}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                    {Platform.OS === 'android' && !folderUri && (
                                        <Text style={styles.hintText}>
                                            Tip: Enable Auto-Sync to automatically fetch Samsung call recordings.
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    {autoFetched && (
                                        <View style={styles.autoFetchedTag}>
                                            <Ionicons name="sparkles" size={12} color="#7C3AED" />
                                            <Text style={styles.autoFetchedText}>NATIVE RECORDING DETECTED</Text>
                                        </View>
                                    )}
                                    <View style={styles.playbackContainer}>
                                        <TouchableOpacity style={styles.playBtn} onPress={playRecording}>
                                            <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#2563EB" />
                                        </TouchableOpacity>
                                        <View style={styles.waveformPlaceholder}>
                                            <View style={styles.audioProgressBase}>
                                                <View style={[styles.audioProgressFill, { width: '100%' }]} />
                                            </View>
                                            <Text style={styles.audioDurationText}>
                                                {autoFetched ? "Attached from Samsung Recordings" : "Recording Saved"}
                                            </Text>
                                        </View>
                                        <TouchableOpacity style={styles.deleteAudioBtn} onPress={() => { deleteRecording(); setAutoFetched(false); }}>
                                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}

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

    // Audio Styles
    audioCard: { backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    recordBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', padding: 16, borderRadius: 16, gap: 15 },
    recordBtnActive: { backgroundColor: '#EF4444' },
    recordTextContainer: { flex: 1 },
    recordTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
    recordTimer: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginTop: 2 },

    playbackContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
    waveformPlaceholder: { flex: 1 },
    audioProgressBase: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' },
    audioProgressFill: { height: '100%', backgroundColor: '#2563EB' },
    audioDurationText: { fontSize: 10, color: '#64748B', fontWeight: '700', marginTop: 4 },
    deleteAudioBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    autoSyncBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    autoSyncBadgeActive: { backgroundColor: '#DCFCE7' },
    autoSyncBadgeText: { fontSize: 9, fontWeight: '900', color: '#64748B' },
    autoSyncRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rescanBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
    rescanText: { fontSize: 9, fontWeight: '900', color: '#2563EB' },
    scanningContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    scanningText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    autoFetchedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, backgroundColor: '#DCFCE7', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    autoFetchedText: { fontSize: 9, fontWeight: '900', color: '#166534' },
    hintText: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 12, textAlign: 'center' },
});
