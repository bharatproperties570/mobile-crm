import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, TextInput, Alert
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getActivities, Activity, deleteActivity, updateActivity } from "../services/activities.service";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Swipeable from "react-native-gesture-handler/Swipeable";

const TYPE_META: Record<string, { color: string; icon: string; emoji: string }> = {
    "Call": { color: "#3B82F6", icon: "call", emoji: "📞" },
    "Meeting": { color: "#8B5CF6", icon: "people", emoji: "🤝" },
    "Site Visit": { color: "#10B981", icon: "map", emoji: "🏠" },
    "Task": { color: "#F59E0B", icon: "checkbox", emoji: "✅" },
    "Email": { color: "#64748B", icon: "mail", emoji: "📧" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    "Pending": { bg: "#FEF3C7", text: "#92400E" },
    "In Progress": { bg: "#DBEAFE", text: "#1E40AF" },
    "Completed": { bg: "#D1FAE5", text: "#065F46" },
    "Deferred": { bg: "#F1F5F9", text: "#64748B" },
    "Overdue": { bg: "#FEE2E2", text: "#991B1B" },
};

const PRIORITY_ICONS: Record<string, string> = {
    "High": "🔴", "Normal": "🟡", "Low": "🟢"
};

const TYPE_TABS = ["All", "Call", "Meeting", "Site Visit", "Task", "Email"];
const STATUS_TABS = ["All", "Pending", "Completed", "Overdue"];

export default function ActivitiesScreen() {
    const router = useRouter();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    const fetchActivities = async (isRefreshing = false) => {
        if (!isRefreshing) setLoading(true);
        try {
            const params: any = { search, limit: 200 };
            if (typeFilter !== "All") params.type = typeFilter;
            if (statusFilter !== "All") params.status = statusFilter;

            const res = await getActivities(params);
            if (res.data) {
                setActivities(res.data);
            }
        } catch (error) {
            console.error("Fetch activities error:", error);
            Alert.alert("Error", "Could not synchronize activities with backend");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchActivities();
        }, [search, typeFilter, statusFilter])
    );

    const handleReschedule = async (item: Activity, timeframe: 'tomorrow' | 'nextWeek') => {
        try {
            const nextDate = new Date();
            if (timeframe === 'tomorrow') nextDate.setDate(nextDate.getDate() + 1);
            else nextDate.setDate(nextDate.getDate() + 7);

            await updateActivity(item._id!, {
                dueDate: nextDate.toISOString(),
                status: 'Pending'
            });
            fetchActivities(true);
            Vibration.vibrate(15);
        } catch (e) {
            Alert.alert("Error", "Failed to reschedule activity");
        }
    };

    // Stats
    const pendingCount = activities.filter(a => a.status === "Pending").length;
    const todayCount = activities.filter(a => {
        if (!a.dueDate) return false;
        return new Date(a.dueDate).toDateString() === new Date().toDateString();
    }).length;
    const overdueCount = activities.filter(a => {
        if (!a.dueDate || a.status === "Completed") return false;
        return new Date(a.dueDate) < new Date();
    }).length;

    const ActivityCard = memo(({ item, onPress, onDelete, onEdit, onReschedule }: {
        item: Activity;
        onPress: () => void;
        onDelete: (id: string) => void;
        onEdit: (id: string | undefined) => void;
        onReschedule: (item: Activity) => void;
    }) => {
        const meta = TYPE_META[item.type] || { color: "#64748B", icon: "list", emoji: "📌" };
        const statusStyle = STATUS_COLORS[item.status] || { bg: "#F1F5F9", text: "#64748B" };
        const dueDate = item.dueDate ? new Date(item.dueDate) : null;
        const isToday = dueDate?.toDateString() === new Date().toDateString();
        const isOverdue = dueDate && dueDate < new Date() && item.status !== "Completed";
        const relatedName = (item as any).relatedTo?.[0]?.name || (item as any).entityName || "";

        const renderLeftActions = () => (
            <View style={styles.leftActions}>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#2563EB" }]} onPress={() => onEdit(item._id)}>
                    <Ionicons name="create" size={22} color="#fff" />
                    <Text style={styles.swipeLabel}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#EF4444" }]} onPress={() => onDelete(item._id!)}>
                    <Ionicons name="trash" size={22} color="#fff" />
                    <Text style={styles.swipeLabel}>Delete</Text>
                </TouchableOpacity>
            </View>
        );

        const renderRightActions = () => (
            <View style={styles.rightActions}>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#F59E0B" }]} onPress={() => onReschedule(item)}>
                    <Ionicons name="calendar" size={22} color="#fff" />
                    <Text style={styles.swipeLabel}>Reschedule</Text>
                </TouchableOpacity>
            </View>
        );

        return (
            <Swipeable renderLeftActions={renderLeftActions} renderRightActions={renderRightActions} overshootLeft={false} overshootRight={false}>
                <TouchableOpacity
                    style={[styles.card, isOverdue && styles.cardOverdue]}
                    activeOpacity={0.9}
                    onPress={onPress}
                >
                    <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
                    <View style={styles.cardMain}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.typeBadge, { backgroundColor: meta.color + "15" }]}>
                                <Text style={styles.typeEmoji}>{meta.emoji}</Text>
                                <Text style={[styles.typeText, { color: meta.color }]}>{item.type.toUpperCase()}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{item.status}</Text>
                            </View>
                        </View>

                        <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>

                        {relatedName ? (
                            <View style={styles.clientRow}>
                                <Ionicons name="person-circle-outline" size={14} color="#64748B" />
                                <Text style={styles.clientName}>{relatedName}</Text>
                            </View>
                        ) : null}

                        <View style={styles.cardFooter}>
                            <View style={styles.metaGroup}>
                                <Ionicons name={isOverdue ? "alert-circle" : "calendar-outline"} size={13} color={isOverdue ? "#EF4444" : "#94A3B8"} />
                                <Text style={[styles.metaText, isOverdue && { color: "#EF4444", fontWeight: "800" }]}>
                                    {isToday ? "Today" : dueDate?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    {item.dueTime ? ` @ ${item.dueTime}` : ""}
                                </Text>
                            </View>
                            <View style={styles.metaGroup}>
                                <Text style={styles.priorityEmoji}>{PRIORITY_ICONS[item.priority] || "🟡"}</Text>
                                <Text style={styles.metaText}>{item.priority}</Text>
                            </View>
                            <View style={styles.assigneeContainer}>
                                <View style={styles.assigneeTextContent}>
                                    <Text style={styles.assigneeName} numberOfLines={1}>{item.assignedTo?.name || "Unassigned"}</Text>
                                    {item.assignedTo?.team && (
                                        <View style={styles.teamBadge}>
                                            <Text style={styles.teamBadgeText}>{item.assignedTo.team.substring(0, 3).toUpperCase()}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Activities</Text>
                    <Text style={styles.headerSubtitle}>{activities.length} scheduled interactions</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/add-activity" as any)}>
                    <Ionicons name="add" size={26} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
                <View style={[styles.statTile, { backgroundColor: "#FFF7ED" }]}>
                    <Text style={[styles.statValue, { color: "#EA580C" }]}>{pendingCount}</Text>
                    <Text style={styles.statLabel}>PENDING</Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: "#EFF6FF" }]}>
                    <Text style={[styles.statValue, { color: "#2563EB" }]}>{todayCount}</Text>
                    <Text style={styles.statLabel}>TODAY</Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: "#FEF2F2" }]}>
                    <Text style={[styles.statValue, { color: "#DC2626" }]}>{overdueCount}</Text>
                    <Text style={styles.statLabel}>OVERDUE</Text>
                </View>
            </View>

            <View style={styles.commandBar}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput
                    style={styles.commandInput}
                    placeholder="Search Client or Subject..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <View style={styles.filterTray}>
                <FlatList
                    horizontal
                    data={TYPE_TABS}
                    keyExtractor={t => t}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScroll}
                    renderItem={({ item: t }) => {
                        const active = typeFilter === t;
                        const meta = TYPE_META[t];
                        return (
                            <TouchableOpacity
                                style={[styles.filterChip, active && { backgroundColor: "#0F172A", borderColor: "#0F172A" }]}
                                onPress={() => setTypeFilter(t)}
                            >
                                {meta && <Text style={styles.chipEmoji}>{meta.emoji}</Text>}
                                <Text style={[styles.chipText, active && { color: "#fff" }]}>{t}</Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            <View style={styles.statusDock}>
                {STATUS_TABS.map(s => (
                    <TouchableOpacity
                        key={s}
                        style={[styles.dockItem, statusFilter === s && styles.dockItemActive]}
                        onPress={() => setStatusFilter(s)}
                    >
                        <Text style={[styles.dockText, statusFilter === s && styles.dockTextActive]}>{s}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>
            ) : (
                <FlatList
                    data={activities}
                    keyExtractor={item => item._id || Math.random().toString()}
                    renderItem={({ item }) => (
                        <ActivityCard
                            item={item}
                            onPress={() => router.push(`/activity/${item._id}` as any)}
                            onDelete={(id) => {
                                Alert.alert("Delete Activity", "Are you sure? This cannot be undone.", [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Delete", style: "destructive", onPress: async () => {
                                            try {
                                                await deleteActivity(id);
                                                setActivities(prev => prev.filter(a => a._id !== id));
                                            } catch (e) { Alert.alert("Error", "Failed to delete"); }
                                        }
                                    }
                                ]);
                            }}
                            onEdit={(id) => router.push({ pathname: "/add-activity", params: { id } } as any)}
                            onReschedule={(act) => {
                                Alert.alert("Reschedule", "When would you like to move this to?", [
                                    { text: "Tomorrow", onPress: () => handleReschedule(act, 'tomorrow') },
                                    { text: "Next Week", onPress: () => handleReschedule(act, 'nextWeek') },
                                    { text: "Custom", onPress: () => router.push({ pathname: "/add-activity", params: { id: act._id } } as any) },
                                    { text: "Cancel", style: "cancel" }
                                ]);
                            }}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    getItemLayout={(data, index) => ({
                        length: 160,
                        offset: 160 * index,
                        index,
                    })}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActivities(); }} tintColor="#2563EB" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="calendar-outline" size={64} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No activities scheduled</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
    headerTitle: { fontSize: 32, fontWeight: "900", color: "#0F172A", letterSpacing: -1 },
    headerSubtitle: { fontSize: 13, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#2563EB", justifyContent: 'center', alignItems: 'center' },

    statsGrid: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 16 },
    statTile: { flex: 1, padding: 16, borderRadius: 20, justifyContent: 'center' },
    statValue: { fontSize: 24, fontWeight: "900" },
    statLabel: { fontSize: 10, fontWeight: "800", color: "#64748B", marginTop: 2 },

    commandBar: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 16,
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F8FAFC",
        borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0"
    },
    commandInput: { flex: 1, marginLeft: 12, fontSize: 15, color: "#1E293B", fontWeight: "600" },

    filterTray: { marginBottom: 16 },
    filterScroll: { paddingHorizontal: 20, gap: 10 },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#F1F5F9"
    },
    chipEmoji: { fontSize: 14, marginRight: 6 },
    chipText: { fontSize: 13, fontWeight: "700", color: "#64748B" },

    statusDock: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", marginBottom: 12 },
    dockItem: { paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    dockItemActive: { borderBottomColor: "#2563EB" },
    dockText: { fontSize: 14, fontWeight: "700", color: "#94A3B8" },
    dockTextActive: { color: "#2563EB" },

    list: { paddingHorizontal: 20, paddingBottom: 100 },
    card: {
        flexDirection: "row", backgroundColor: "#fff", marginBottom: 16,
        borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    cardOverdue: { borderColor: "#FECACA", backgroundColor: "#FFF5F5" },
    cardAccent: { width: 6 },
    cardMain: { flex: 1, padding: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

    typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 6 },
    typeEmoji: { fontSize: 12 },
    typeText: { fontSize: 10, fontWeight: "900" },

    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusBadgeText: { fontSize: 10, fontWeight: "800" },

    subject: { fontSize: 16, fontWeight: "800", color: "#1E293B", lineHeight: 22, marginBottom: 8 },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    clientName: { fontSize: 13, color: "#64748B", fontWeight: "600" },

    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    metaGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
    priorityEmoji: { fontSize: 12 },

    actionGroup: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    iconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F8FAFC", justifyContent: 'center', alignItems: 'center' },

    empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
    emptyText: { marginTop: 16, fontSize: 16, color: "#94A3B8", fontWeight: "700", textAlign: 'center' },

    leftActions: { flexDirection: 'row', marginBottom: 16 },
    rightActions: { flexDirection: 'row', marginBottom: 16 },
    swipeAction: { width: 80, height: '100%', justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },

    assigneeContainer: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    assigneeTextContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', gap: 6 },
    assigneeName: { fontSize: 11, fontWeight: '700', color: '#475569', maxWidth: 80 },
    teamBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#E0E7FF' },
    teamBadgeText: { fontSize: 8, fontWeight: '800', color: '#4F46E5' },
});
