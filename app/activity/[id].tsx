import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Linking
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getActivityById, updateActivity, deleteActivity, Activity } from "../services/activities.service";

const TYPE_COLORS: Record<string, string> = {
    "Call": "#3B82F6",
    "Meeting": "#8B5CF6",
    "Site Visit": "#10B981",
    "Task": "#F59E0B",
    "Email": "#64748B"
};

export default function ActivityDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [activity, setActivity] = useState<Activity | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const fetchActivity = async () => {
        try {
            const res = await getActivityById(id as string);
            const data = res.data ?? res;
            if (data) {
                setActivity(data);
            } else {
                Alert.alert("Error", "Activity not found");
                router.back();
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to fetch activity");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivity();
    }, [id]);

    const handleCall = () => {
        if (!activity) return;
        const related = (activity as any).relatedTo?.[0];
        const mobile = related?.mobile || (activity as any).mobile;
        if (!mobile) return Alert.alert("Error", "No mobile number available");
        Linking.openURL(`tel:${mobile}`);
    };

    const handleWhatsApp = () => {
        if (!activity) return;
        const related = (activity as any).relatedTo?.[0];
        const mobile = related?.mobile || (activity as any).mobile;
        if (!mobile) return Alert.alert("Error", "No mobile number available");
        const cleanMobile = mobile.replace(/\D/g, "");
        const url = `whatsapp://send?phone=${cleanMobile.startsWith("+") ? cleanMobile : "+" + (cleanMobile.length === 10 ? "91" + cleanMobile : cleanMobile)}`;
        Linking.openURL(url).catch(() => Alert.alert("Error", "WhatsApp is not installed"));
    };

    const handleToggleStatus = async () => {
        if (!activity) return;
        setUpdating(true);
        try {
            const newStatus = activity.status === "Completed" ? "Pending" : "Completed";
            await updateActivity(activity._id!, { status: newStatus });
            setActivity({ ...activity, status: newStatus });
        } catch (e) {
            Alert.alert("Error", "Failed to update status");
        } finally {
            setUpdating(false);
        }
    };

    const handleDelete = async () => {
        Alert.alert("Delete", "Are you sure you want to delete this activity?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteActivity(id as string);
                        router.back();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete activity");
                    }
                }
            }
        ]);
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>;
    }

    if (!activity) return null;

    const color = TYPE_COLORS[activity.type] || "#64748B";

    return (
        <View style={styles.container}>
            <View style={[styles.header, { backgroundColor: color }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={() => router.push({ pathname: "/add-activity", params: { id: activity._id } })}>
                            <Ionicons name="create-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDelete} style={{ marginLeft: 20 }}>
                            <Ionicons name="trash-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.headerContent}>
                    <Text style={styles.typeLabel}>{activity.type}</Text>
                    <Text style={styles.subject}>{activity.subject}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusBadge, activity.status === 'Completed' ? styles.statusCompleted : styles.statusPending]}>
                            <Text style={styles.statusText}>{activity.status}</Text>
                        </View>
                        <Text style={styles.priorityText}>• {activity.priority} Priority</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>When & Where</Text>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={20} color="#64748B" />
                        <Text style={styles.infoText}>{new Date(activity.dueDate).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={20} color="#64748B" />
                        <Text style={styles.infoText}>{activity.dueTime}</Text>
                    </View>
                    {activity.details?.meetingLocation && (
                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={20} color="#64748B" />
                            <Text style={styles.infoText}>{activity.details.meetingLocation}</Text>
                        </View>
                    )}
                </View>

                {activity.description && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notes</Text>
                        <Text style={styles.descriptionText}>{activity.description}</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Related To</Text>
                    <View style={styles.relateCard}>
                        <View style={styles.relateIcon}>
                            <Ionicons name={activity.entityType === "Lead" ? "person-add" : "person"} size={24} color="#1E40AF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.relateName}>
                                {(activity as any).relatedTo?.[0]?.name || activity.entityType + " Detail"}
                            </Text>
                            {(activity as any).relatedTo?.[0]?.mobile ? (
                                <Text style={styles.relateSub}>{(activity as any).relatedTo[0].mobile}</Text>
                            ) : (
                                <Text style={styles.relateSub}>Tap to view related hub</Text>
                            )}
                        </View>

                        {(activity as any).relatedTo?.[0]?.mobile && (
                            <View style={styles.relateActions}>
                                <TouchableOpacity style={styles.miniActionBtn} onPress={handleCall}>
                                    <Ionicons name="call" size={18} color="#2563EB" />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.miniActionBtn, { backgroundColor: '#DCFCE7' }]} onPress={handleWhatsApp}>
                                    <Ionicons name="logo-whatsapp" size={18} color="#166534" />
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={() => {
                                const type = activity.entityType.toLowerCase();
                                const route = `/${type}-detail` as any;
                                router.push({ pathname: route, params: { id: activity.entityId } });
                            }}
                            style={{ marginLeft: 10 }}
                        >
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.mainBtn, activity.status === 'Completed' ? styles.btnPending : styles.btnCompleted]}
                    onPress={handleToggleStatus}
                    disabled={updating}
                >
                    {updating ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name={activity.status === 'Completed' ? "refresh" : "checkmark-circle"} size={20} color="#fff" />
                            <Text style={styles.btnText}>
                                {activity.status === 'Completed' ? "Mark as Pending" : "Complete Activity"}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
    headerActions: { flexDirection: "row", alignItems: "center" },
    headerContent: {},
    typeLabel: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 1 },
    subject: { fontSize: 28, fontWeight: "800", color: "#fff", marginTop: 4 },
    statusRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: 10 },
    statusPending: { backgroundColor: "rgba(255,255,255,0.2)" },
    statusCompleted: { backgroundColor: "#ECFDF5" },
    statusText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    priorityText: { fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
    content: { flex: 1, padding: 20 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 16 },
    infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
    infoText: { fontSize: 15, color: "#475569", fontWeight: "500" },
    descriptionText: { fontSize: 15, color: "#475569", lineHeight: 22 },
    relateCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
    relateIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginRight: 16 },
    relateName: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
    relateSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    mainBtn: { height: 56, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
    btnCompleted: { backgroundColor: "#10B981" },
    btnPending: { backgroundColor: "#F59E0B" },
    btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    relateActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    miniActionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" }
});
