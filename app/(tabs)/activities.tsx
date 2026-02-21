import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, TextInput, Alert
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getActivities, Activity, deleteActivity } from "../services/activities.service";
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    const handleDelete = (id: string) => {
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

    const renderCard = ({ item }: { item: Activity }) => {
        const meta = TYPE_META[item.type] || { color: "#64748B", icon: "list", emoji: "📌" };
        const statusStyle = STATUS_COLORS[item.status] || { bg: "#F1F5F9", text: "#64748B" };
        const dueDate = item.dueDate ? new Date(item.dueDate) : null;
        const isToday = dueDate?.toDateString() === new Date().toDateString();
        const isOverdue = dueDate && dueDate < new Date() && item.status !== "Completed";
        const relatedName = (item as any).relatedTo?.[0]?.name || (item as any).entityName || "";

        return (
            <TouchableOpacity
                style={[styles.card, isOverdue && styles.cardOverdue]}
                activeOpacity={0.7}
                onPress={() => router.push(`/activity/${item._id}` as any)}
            >
                {/* Left accent */}
                <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />

                <View style={{ flex: 1, paddingLeft: 14 }}>
                    {/* Top Row */}
                    <View style={styles.cardTopRow}>
                        <View style={[styles.typeBadge, { backgroundColor: meta.color + "15" }]}>
                            <Text style={{ fontSize: 11 }}>{meta.emoji}</Text>
                            <Text style={[styles.typeBadgeText, { color: meta.color }]}>{item.type}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{item.status}</Text>
                        </View>
                    </View>

                    {/* Subject */}
                    <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>

                    {/* Related To */}
                    {relatedName ? (
                        <View style={styles.relatedRow}>
                            <Ionicons name="person-outline" size={12} color="#94A3B8" />
                            <Text style={styles.relatedText}>{relatedName}</Text>
                        </View>
                    ) : null}

                    {/* Bottom Meta Row */}
                    <View style={styles.cardBottomRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name={isOverdue ? "alert-circle" : "calendar-outline"} size={13} color={isOverdue ? "#EF4444" : "#94A3B8"} />
                            <Text style={[styles.metaText, isOverdue && { color: "#EF4444", fontWeight: "700" }]}>
                                {isToday ? "Today" : dueDate?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) || "-"}
                                {item.dueTime ? ` · ${item.dueTime}` : ""}
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={{ fontSize: 11 }}>{PRIORITY_ICONS[item.priority] || "🟡"}</Text>
                            <Text style={styles.metaText}>{item.priority}</Text>
                        </View>
                        <View style={{ flex: 1 }} />
                        {/* Actions */}
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => router.push({ pathname: "/add-activity", params: { id: item._id } } as any)}
                        >
                            <Ionicons name="create-outline" size={16} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { marginLeft: 4 }]} onPress={() => handleDelete(item._id!)}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Activities</Text>
                    <Text style={styles.headerSub}>{activities.length} total scheduled</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/add-activity" as any)}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: "#F59E0B" }]}>
                    <Text style={[styles.statNum, { color: "#F59E0B" }]}>{pendingCount}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: "#3B82F6" }]}>
                    <Text style={[styles.statNum, { color: "#3B82F6" }]}>{todayCount}</Text>
                    <Text style={styles.statLabel}>Today</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: "#EF4444" }]}>
                    <Text style={[styles.statNum, { color: "#EF4444" }]}>{overdueCount}</Text>
                    <Text style={styles.statLabel}>Overdue</Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by subject, client..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch("")}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Type Filter Tabs */}
            <View style={styles.filterScrollWrap}>
                {TYPE_TABS.map(t => {
                    const meta = TYPE_META[t];
                    const active = typeFilter === t;
                    return (
                        <TouchableOpacity
                            key={t}
                            style={[styles.typeTab, active && { backgroundColor: meta?.color || "#1E40AF", borderColor: meta?.color || "#1E40AF" }]}
                            onPress={() => setTypeFilter(t)}
                        >
                            {meta && <Text style={{ fontSize: 12 }}>{meta.emoji}</Text>}
                            <Text style={[styles.typeTabText, active && { color: "#fff" }]}>{t}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Status Tabs */}
            <View style={styles.statusTabRow}>
                {STATUS_TABS.map(s => (
                    <TouchableOpacity key={s} style={[styles.statusTab, statusFilter === s && styles.statusTabActive]} onPress={() => setStatusFilter(s)}>
                        <Text style={[styles.statusTabText, statusFilter === s && styles.statusTabTextActive]}>{s}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>
            ) : (
                <FlatList
                    data={activities}
                    keyExtractor={item => item._id || Math.random().toString()}
                    renderItem={renderCard}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActivities(); }} tintColor="#1E40AF" />}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Text style={{ fontSize: 48, marginBottom: 12 }}>📅</Text>
                            <Text style={styles.emptyTitle}>No Activities Found</Text>
                            <Text style={styles.emptyText}>Schedule a call, meeting, or site visit to get started.</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/add-activity" as any)}>
                                <Ionicons name="add-circle" size={20} color="#fff" />
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Schedule Activity</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F1F5F9" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    // Header
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    headerTitle: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
    headerSub: { fontSize: 13, color: "#94A3B8", marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1E40AF", justifyContent: "center", alignItems: "center", shadowColor: "#1E40AF", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

    // Stats
    statsRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 14, gap: 10 },
    statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, borderLeftWidth: 3, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    statNum: { fontSize: 24, fontWeight: "900" },
    statLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginTop: 2 },

    // Search
    searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 14, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, height: 48, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    searchInput: { flex: 1, fontSize: 15, color: "#1E293B" },

    // Type Tabs
    filterScrollWrap: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8, flexWrap: "nowrap" },
    typeTab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
    typeTabText: { fontSize: 12, fontWeight: "700", color: "#64748B" },

    // Status Tabs
    statusTabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 10, gap: 0, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#fff", marginTop: 8 },
    statusTab: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
    statusTabActive: { borderBottomColor: "#1E40AF" },
    statusTabText: { fontSize: 13, fontWeight: "600", color: "#94A3B8" },
    statusTabTextActive: { color: "#1E40AF" },

    // Cards
    list: { padding: 16, paddingBottom: 100 },
    card: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 10, overflow: "hidden", flexDirection: "row", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    cardOverdue: { borderWidth: 1, borderColor: "#FCA5A5" },
    cardAccent: { width: 4 },
    cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingTop: 14 },
    typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    typeBadgeText: { fontSize: 11, fontWeight: "800" },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    statusBadgeText: { fontSize: 11, fontWeight: "700" },
    subject: { fontSize: 15, fontWeight: "700", color: "#0F172A", lineHeight: 21, marginBottom: 6 },
    relatedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
    relatedText: { fontSize: 12, color: "#64748B" },
    cardBottomRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
    actionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },

    // Empty
    emptyWrap: { flex: 1, alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B", marginBottom: 8 },
    emptyText: { fontSize: 14, color: "#94A3B8", textAlign: "center", lineHeight: 20 },
    emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1E40AF", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, marginTop: 24 },
});
