import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, TextInput, Alert, Vibration, Linking
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import { getActivities, Activity, deleteActivity, updateActivity } from "@/services/activities.service";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useUsers } from "@/context/UserContext";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TYPE_META_LIGHT: Record<string, { color: string; icon: string; emoji: string }> = {
    "Call": { color: "#3B82F6", icon: "call", emoji: "📞" },
    "Meeting": { color: "#8B5CF6", icon: "people", emoji: "🤝" },
    "Site Visit": { color: "#10B981", icon: "map", emoji: "🏠" },
    "Task": { color: "#F59E0B", icon: "checkbox", emoji: "✅" },
    "Email": { color: "#64748B", icon: "mail", emoji: "📧" },
};

const TYPE_META_DARK: Record<string, { color: string; icon: string; emoji: string }> = {
    "Call": { color: "#60A5FA", icon: "call", emoji: "📞" },
    "Meeting": { color: "#A78BFA", icon: "people", emoji: "🤝" },
    "Site Visit": { color: "#34D399", icon: "map", emoji: "🏠" },
    "Task": { color: "#FBBF24", icon: "checkbox", emoji: "✅" },
    "Email": { color: "#94A3B8", icon: "mail", emoji: "📧" },
};

const STATUS_COLORS_LIGHT: Record<string, { bg: string; text: string }> = {
    "Pending": { bg: "#FEF3C7", text: "#92400E" },
    "In Progress": { bg: "#DBEAFE", text: "#1E40AF" },
    "Completed": { bg: "#D1FAE5", text: "#065F46" },
    "Deferred": { bg: "#F1F5F9", text: "#64748B" },
    "Overdue": { bg: "#FEE2E2", text: "#991B1B" },
};

const STATUS_COLORS_DARK: Record<string, { bg: string; text: string }> = {
    "Pending": { bg: "#92400E30", text: "#FBBF24" },
    "In Progress": { bg: "#1E40AF30", text: "#60A5FA" },
    "Completed": { bg: "#065F4630", text: "#34D399" },
    "Deferred": { bg: "#47556930", text: "#94A3B8" },
    "Overdue": { bg: "#991B1B30", text: "#F87171" },
};

const PRIORITY_ICONS: Record<string, string> = {
    "High": "🔴", "Normal": "🟡", "Low": "🟢"
};

const TYPE_TABS = ["All", "Call", "Meeting", "Site Visit", "Task", "Email"];
const STATUS_TABS = ["Pending", "Today", "Overdue", "Completed", "All"];

export default function ActivitiesScreen() {
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const { findUser } = useUsers();

    // Audio Playback State
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    const fetchActivities = async (isRefreshing = false) => {
        if (!isRefreshing) setLoading(true);
        console.log("[Activities] Fetching with type:", typeFilter, "status:", statusFilter);
        try {
            const params: any = { search, limit: 500 };
            if (typeFilter !== "All") params.type = typeFilter;

            // Only send actual statuses to backend
            if (["Pending", "Completed", "In Progress"].includes(statusFilter)) {
                params.status = statusFilter;
            } else if (statusFilter === "Today" || statusFilter === "Overdue" || statusFilter === "All") {
                // Backend returns all if status is not provided, 
                // client-side filteredActivities handles Today/Overdue
                delete params.status;
            }

            const res = await getActivities(params);
            const data = (res.data || res.records || (Array.isArray(res) ? res : [])) as Activity[];
            setActivities(data);
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

    const filteredActivities = useMemo(() => {
        return activities.filter(a => {
            if (statusFilter === "Pending") return ["Pending", "In Progress", "Overdue"].includes(a.status);
            if (statusFilter === "Completed") return a.status === "Completed";
            if (statusFilter === "Today") {
                if (!a.dueDate) return false;
                return new Date(a.dueDate).toDateString() === new Date().toDateString();
            }
            if (statusFilter === "Overdue") {
                if (!a.dueDate || a.status === "Completed") return false;
                return new Date(a.dueDate) < new Date();
            }
            return true; // All
        });
    }, [activities, statusFilter]);

    const handlePlayAudio = async (id: string, url: string) => {
        try {
            if (playingId === id) {
                if (sound) {
                    await sound.stopAsync();
                    await sound.unloadAsync();
                }
                setPlayingId(null);
                setSound(null);
                return;
            }

            if (sound) {
                await sound.unloadAsync();
            }

            setPlayingId(id);
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: true }
            );
            setSound(newSound);
            newSound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.didJustFinish) {
                    setPlayingId(null);
                }
            });
        } catch (e) {
            console.error("Playback error:", e);
            Alert.alert("Error", "Could not play audio");
            setPlayingId(null);
        }
    };

    const handleCall = (mobile: string) => {
        if (!mobile) return Alert.alert("Error", "No mobile number available");
        Linking.openURL(`tel:${mobile}`);
    };

    const handleWhatsApp = (mobile: string) => {
        if (!mobile) return Alert.alert("Error", "No mobile number available");
        const cleanMobile = mobile.replace(/\D/g, "");
        const url = `whatsapp://send?phone=${cleanMobile.startsWith("+") ? cleanMobile : "+" + (cleanMobile.length === 10 ? "91" + cleanMobile : cleanMobile)}`;
        Linking.openURL(url).catch(() => Alert.alert("Error", "WhatsApp is not installed"));
    };

    const ActivityCard = memo(({ item, onPress, onDelete, onEdit, onReschedule, onComplete, onPlayAudio, isPlaying, onCall, onWhatsApp, findUser }: {
        item: Activity;
        onPress: () => void;
        onDelete: (id: string) => void;
        onEdit: (id: string | undefined) => void;
        onReschedule: (item: Activity) => void;
        onComplete: (item: Activity) => void;
        onPlayAudio: (id: string, url: string) => void;
        isPlaying: boolean;
        onCall: (mobile: string) => void;
        onWhatsApp: (mobile: string) => void;
        findUser: (id: string) => any;
    }) => {
        const { theme } = useTheme();
        const isDark = theme.background === '#0F172A';
        const metaMap = isDark ? TYPE_META_DARK : TYPE_META_LIGHT;
        const meta = metaMap[item.type] || { color: isDark ? "#94A3B8" : "#64748B", icon: "list", emoji: "📌" };
        const statusStyle = isDark ? (STATUS_COLORS_DARK[item.status] || { bg: "#1E293B", text: "#94A3B8" }) : (STATUS_COLORS_LIGHT[item.status] || { bg: "#F1F5F9", text: "#64748B" });
        const dueDate = item.dueDate ? new Date(item.dueDate) : null;
        const isToday = dueDate?.toDateString() === new Date().toDateString();
        const isOverdue = dueDate && dueDate < new Date() && item.status !== "Completed";
        const related = (item as any).relatedTo?.[0];
        const relatedName = related?.name || (item as any).entityName || "";
        const relatedMobile = related?.mobile || "";

        const assignedName = useMemo(() => {
            // 1. Resolve Performed By (The ACTUAL Actor) - HIGHEST PRIORITY for professional oversight
            const performedBy = (item as any).performedBy;
            if (performedBy && typeof performedBy === 'string' && 
                performedBy !== "System" && 
                performedBy !== "Bharat Properties") { 
                return performedBy;
            }

            // 2. Resolve Assigned To (Object or ID) 
            const assigned = item.assignedTo;
            if (assigned) {
                if (typeof assigned === 'object' && assigned !== null) {
                    const name = (assigned as any).fullName || (assigned as any).name || (assigned as any).lookup_value;
                    if (name && name !== "Bharat Properties") return name;
                }
                const user = findUser(String(assigned));
                if (user && (user.fullName || user.name) && user.name !== "Bharat Properties") return user.fullName || user.name;
            }

            // 3. Resolve Creator (Fallback)
            const creator = (item as any).createdBy || (item as any).creator || (item as any).user || (item as any).author;
            if (creator) {
                if (typeof creator === 'object' && creator !== null) {
                    const name = (creator as any).fullName || (creator as any).name || (creator as any).lookup_value;
                    if (name && name !== "Bharat Properties") return name;
                }
                const user = findUser(String(creator));
                if (user && (user.fullName || user.name)) return user.fullName || user.name;
            }

            return "Unassigned";
        }, [item.assignedTo, (item as any).createdBy, (item as any).creator, (item as any).user, (item as any).author, (item as any).performedBy, findUser]);

        const renderLeftActions = () => (
            <View style={styles.leftActions}>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#1E40AF' : "#2563EB" }]} onPress={() => onEdit(item._id)}>
                    <Ionicons name="create" size={22} color="#fff" />
                    <Text style={styles.swipeLabel}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#991B1B' : "#EF4444" }]} onPress={() => onDelete(item._id!)}>
                    <Ionicons name="trash" size={22} color="#fff" />
                    <Text style={styles.swipeLabel}>Delete</Text>
                </TouchableOpacity>
            </View>
        );

        const renderRightActions = () => (
            <View style={styles.rightActions}>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#92400E' : "#F59E0B" }]} onPress={() => onReschedule(item)}>
                    <Ionicons name="calendar-outline" size={22} color="#fff" />
                    <Text style={styles.swipeLabel}>Reschedule</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#065F46' : "#10B981" }]} onPress={() => onComplete(item)}>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                    <Text style={styles.swipeLabel}>Complete</Text>
                </TouchableOpacity>
            </View>
        );

        return (
            <Swipeable renderLeftActions={renderLeftActions} renderRightActions={renderRightActions} overshootLeft={false} overshootRight={false}>
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isOverdue && styles.cardOverdue, isOverdue && isDark && { borderColor: '#EF444430', backgroundColor: '#EF444410' }]}
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

                        <Text style={[styles.subject, { color: theme.text }]} numberOfLines={2}>{item.subject}</Text>

                        {relatedName ? (
                            <View style={styles.clientRow}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                        <Ionicons name="person-circle-outline" size={14} color={theme.textLight} />
                                        <Text style={[styles.clientName, { color: theme.textSecondary }]}>{relatedName}</Text>
                                    </View>
                                    {relatedMobile ? (
                                        <Text style={[styles.clientMobile, { color: theme.textLight }]}>{relatedMobile}</Text>
                                    ) : null}
                                </View>

                                <View style={styles.actionGroup}>
                                    {relatedMobile ? (
                                        <>
                                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary + '15' }]} onPress={() => onCall(relatedMobile)}>
                                                <Ionicons name="call" size={16} color={theme.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? '#065F4630' : '#DCFCE7' }]} onPress={() => onWhatsApp(relatedMobile)}>
                                                <Ionicons name="logo-whatsapp" size={16} color={isDark ? '#34D399' : '#166534'} />
                                            </TouchableOpacity>
                                        </>
                                    ) : null}

                                            <TouchableOpacity
                                                style={[styles.playBadge, { backgroundColor: isPlaying ? theme.primary : theme.primary + '15' }]}
                                                onPress={() => onPlayAudio(item._id!, item.details.audioUrl)}
                                            >
                                                <Ionicons name={isPlaying ? "pause" : "play"} size={12} color={isPlaying ? "#fff" : theme.primary} />
                                                <Text style={[styles.playBadgeText, { color: isPlaying ? "#fff" : theme.primary }]}>
                                                    {isPlaying ? "PLAYING" : "VOICE"}
                                                </Text>
                                            </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}

                        <View style={styles.cardFooter}>
                            <View style={styles.metaGroup}>
                                <Ionicons name={isOverdue ? "alert-circle" : "calendar-outline"} size={13} color={isOverdue ? "#EF4444" : theme.textMuted} />
                                <Text style={[styles.metaText, { color: theme.textMuted }, isOverdue && { color: "#EF4444", fontWeight: "800" }]}>
                                    {isToday ? "Today" : dueDate?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    {item.dueTime ? ` @ ${item.dueTime}` : ""}
                                </Text>
                            </View>
                            <View style={styles.metaGroup}>
                                <Text style={styles.priorityEmoji}>{PRIORITY_ICONS[item.priority] || "🟡"}</Text>
                                <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.priority}</Text>
                            </View>
                            <View style={styles.assigneeContainer}>
                                <View style={[styles.assigneeTextContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderColor: theme.border }]}>
                                    <Text style={[styles.assigneeName, { color: theme.textSecondary }]} numberOfLines={1}>{assignedName}</Text>
                                    {item.assignedTo?.team && (
                                        <View style={[styles.teamBadge, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '25' }]}>
                                            <Text style={[styles.teamBadgeText, { color: theme.primary }]}>{item.assignedTo.team.substring(0, 3).toUpperCase()}</Text>
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
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { paddingTop: Math.max((insets?.top ?? 0) + 20, 55), paddingBottom: 16 }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Activities</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textLight }]}>{activities.length} scheduled interactions</Text>
                </View>
                <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.primary }]} onPress={() => router.push("/add-activity" as any)}>
                    <Ionicons name="add" size={26} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
                <View style={[styles.statTile, { backgroundColor: isDark ? '#9A341230' : "#FFF7ED" }]}>
                    <Text style={[styles.statValue, { color: isDark ? '#FB923C' : "#EA580C" }]}>{pendingCount}</Text>
                    <Text style={[styles.statLabel, { color: isDark ? '#FB923C' : "#64748B" }]}>PENDING</Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: isDark ? '#1E40AF30' : "#EFF6FF" }]}>
                    <Text style={[styles.statValue, { color: isDark ? '#60A5FA' : "#2563EB" }]}>{todayCount}</Text>
                    <Text style={[styles.statLabel, { color: isDark ? '#60A5FA' : "#64748B" }]}>TODAY</Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: isDark ? '#991B1B30' : "#FEF2F2" }]}>
                    <Text style={[styles.statValue, { color: isDark ? '#F87171' : "#DC2626" }]}>{overdueCount}</Text>
                    <Text style={[styles.statLabel, { color: isDark ? '#F87171' : "#64748B" }]}>OVERDUE</Text>
                </View>
            </View>

            <View style={[styles.commandBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="search" size={20} color={theme.textMuted} />
                <TextInput
                    style={[styles.commandInput, { color: theme.text }]}
                    placeholder="Search Client or Subject..."
                    placeholderTextColor={theme.textMuted}
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
                        const metaMap = isDark ? TYPE_META_DARK : TYPE_META_LIGHT;
                        const meta = metaMap[t];
                        return (
                            <TouchableOpacity
                                style={[styles.filterChip, { backgroundColor: theme.card, borderColor: theme.border }, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                onPress={() => setTypeFilter(t)}
                            >
                                {meta && <Text style={styles.chipEmoji}>{meta.emoji}</Text>}
                                <Text style={[styles.chipText, { color: theme.textLight }, active && { color: "#fff" }]}>{t}</Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            <View style={[styles.statusDock, { borderBottomColor: theme.border }]}>
                {STATUS_TABS.map(s => (
                    <TouchableOpacity
                        key={s}
                        style={[styles.dockItem, statusFilter === s && { borderBottomColor: theme.primary }]}
                        onPress={() => setStatusFilter(s)}
                    >
                        <Text style={[styles.dockText, { color: theme.textLight }, statusFilter === s && { color: theme.primary }]}>{s}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : (
                <FlatList
                    data={filteredActivities}
                    keyExtractor={item => item._id || Math.random().toString()}
                    renderItem={({ item }) => (
                        <ActivityCard
                            item={item}
                            onPress={() => {
                                if (item.entityId && item.entityType) {
                                    const type = item.entityType.toLowerCase();
                                    let route = `/${type}-detail` as any;
                                    
                                    // Map backend entity types to frontend file routes
                                    if (type === 'developer' || type === 'company') {
                                        route = '/company-detail';
                                    } else if (type === 'project') {
                                        route = '/project-detail';
                                    } else if (type === 'inventory') {
                                        route = '/inventory-detail';
                                    } else if (type === 'deal') {
                                        route = '/deal-detail';
                                    } else if (type === 'lead') {
                                        route = '/lead-detail';
                                    }
                                    
                                    router.push({ pathname: route, params: { id: item.entityId } });
                                }
                            }}
                            onPlayAudio={handlePlayAudio}
                            isPlaying={playingId === item._id}
                            onCall={handleCall}
                            onWhatsApp={handleWhatsApp}
                            findUser={findUser}
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
                            onComplete={(act) => {
                                console.log("[Activities] complete pressed for", act._id);
                                router.push(`/outcome?id=${act._id}` as any);
                            }}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    getItemLayout={(data, index) => ({
                        length: 135,
                        offset: 135 * index,
                        index,
                    })}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActivities(); }} tintColor={theme.primary} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="calendar-outline" size={64} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>No activities scheduled</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
    headerTitle: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
    headerSubtitle: { fontSize: 13, fontWeight: "600", marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

    statsGrid: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 16 },
    statTile: { flex: 1, padding: 16, borderRadius: 20, justifyContent: 'center' },
    statValue: { fontSize: 24, fontWeight: "900" },
    statLabel: { fontSize: 10, fontWeight: "800", marginTop: 2 },

    commandBar: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 16,
        paddingHorizontal: 16, paddingVertical: 12,
        borderRadius: 16, borderWidth: 1
    },
    commandInput: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: "600" },

    filterTray: { marginBottom: 16 },
    filterScroll: { paddingHorizontal: 20, gap: 10 },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 20, borderWidth: 1.5
    },
    chipEmoji: { fontSize: 14, marginRight: 6 },
    chipText: { fontSize: 13, fontWeight: "700" },

    statusDock: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, marginBottom: 12 },
    dockItem: { paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    dockText: { fontSize: 14, fontWeight: "700" },

    list: { paddingHorizontal: 20, paddingBottom: 100 },
    card: {
        flexDirection: "row", marginBottom: 12,
        borderRadius: 20, overflow: "hidden", borderWidth: 1,
        elevation: 2, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    cardOverdue: { borderColor: "#EF4444" },
    cardAccent: { width: 5 },
    cardMain: { flex: 1, padding: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

    typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 },
    typeEmoji: { fontSize: 11 },
    typeText: { fontSize: 9, fontWeight: "900" },

    statusBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
    statusBadgeText: { fontSize: 9, fontWeight: "800" },

    subject: { fontSize: 15, fontWeight: "800", lineHeight: 20, marginBottom: 4 },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    clientName: { fontSize: 12, fontWeight: "600" },

    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    metaGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, fontWeight: "600" },
    priorityEmoji: { fontSize: 12 },

    actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    clientMobile: { fontSize: 11, fontWeight: "600", marginLeft: 20 },

    empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: "700", textAlign: 'center' },

    leftActions: { flexDirection: 'row', marginBottom: 16 },
    rightActions: { flexDirection: 'row', marginBottom: 16 },
    swipeAction: { width: 80, height: '100%', justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },

    assigneeContainer: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    assigneeTextContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, gap: 6 },
    assigneeName: { fontSize: 11, fontWeight: '700', maxWidth: 80 },
    teamBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
    teamBadgeText: { fontSize: 8, fontWeight: '800' },

    playBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    playBadgeActive: { backgroundColor: '#2563EB' },
    playBadgeText: { fontSize: 9, fontWeight: '900', color: '#2563EB' },
});
