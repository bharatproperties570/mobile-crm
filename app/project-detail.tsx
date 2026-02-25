import { useEffect, useState, useCallback, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Linking, Alert, Animated, SafeAreaView, Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./context/ThemeContext";
import { getProjectById, deleteProject, type Project } from "./services/projects.service";
import { lookupVal, safeApiCall } from "./services/api.helpers";
import { getActivities } from "./services/activities.service";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TABS = ["Overview", "Activities"];

function lv(field: unknown): string {
    if (!field) return "—";
    if (Array.isArray(field)) {
        return field.map(item => lv(item)).filter(v => v !== "—").join(", ") || "—";
    }
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value ?? "—";
        if ("fullName" in field) return (field as any).fullName ?? "—";
        if ("name" in field) return (field as any).name ?? "—";
    }
    return String(field) || "—";
}

function InfoRow({ label, value, accent, icon }: { label: string; value: string | undefined | null; accent?: boolean; icon?: any }) {
    const { theme } = useTheme();
    if (!value || value === "—") return null;
    return (
        <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {icon && <Ionicons name={icon} size={14} color={theme.textLight} />}
                <Text style={[styles.infoLabel, { color: theme.textLight }]}>{label}</Text>
            </View>
            <Text style={[styles.infoValue, { color: theme.text }, accent && { color: theme.primary }]}>{value}</Text>
        </View>
    );
}

export default function ProjectDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme } = useTheme();
    const [project, setProject] = useState<Project | null>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const tabScrollViewRef = useRef<ScrollView>(null);
    const contentScrollViewRef = useRef<ScrollView>(null);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [projRes, actRes] = await Promise.all([
                getProjectById(id as string),
                getActivities({ entityId: id as string, limit: 50 })
            ]);

            const found = projRes.data || projRes.record || projRes;
            setProject(found || null);
            setActivities(Array.isArray(actRes?.data) ? actRes.data : (Array.isArray(actRes) ? actRes : []));

            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [id]);

    const onTabPress = (index: number) => {
        setActiveTab(index);
        contentScrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    };

    const onScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SCREEN_WIDTH);
        if (index !== activeTab) {
            setActiveTab(index);
        }
    };

    const handleDelete = () => {
        Alert.alert("Delete Project", "Permanently remove this project?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    const res = await safeApiCall(() => deleteProject(id as string));
                    if (!res.error) router.back();
                }
            }
        ]);
    };

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!project) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={[styles.noData, { color: theme.textLight }]}>Project not found</Text></View>;

    const statusLabel = lookupVal(project.status);
    const location = project.locationSearch || project.address?.location || project.address?.city || "No Location Specified";

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <SafeAreaView style={[styles.headerCard, { backgroundColor: theme.card }]}>
                <View style={styles.navBar}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.navBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: theme.text }]}>Project Command</Text>
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.background }]} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>

                {/* Hero Summary */}
                <View style={styles.heroSummary}>
                    <View style={[styles.avatarBox, { backgroundColor: theme.primary + '15' }]}>
                        <Ionicons name="business" size={28} color={theme.primary} />
                    </View>
                    <View style={styles.heroText}>
                        <Text style={[styles.heroName, { color: theme.text }]} numberOfLines={1}>{project.name}</Text>
                        <View style={[styles.statusCapsule, { backgroundColor: theme.primary + '15' }]}>
                            <Text style={[styles.statusCapsuleText, { color: theme.primary }]}>{statusLabel.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                {/* Tab Navigation */}
                <View>
                    <ScrollView
                        ref={tabScrollViewRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabsScroll}
                    >
                        {TABS.map((tab, i) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => onTabPress(i)}
                                style={[styles.tabItem, activeTab === i && { borderBottomColor: theme.primary }]}
                            >
                                <Text style={[styles.tabLabel, { color: activeTab === i ? theme.primary : theme.textLight }]}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </SafeAreaView>

            <ScrollView
                ref={contentScrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScroll}
                style={{ flex: 1 }}
            >
                {/* 1. Overview */}
                <View style={styles.tabContent}>
                    <ScrollView
                        contentContainerStyle={styles.innerScroll}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={theme.primary} />}
                    >
                        <Animated.View style={{ opacity: fadeAnim }}>
                            <View style={styles.quickActions}>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`)}>
                                    <Ionicons name="map" size={20} color="#fff" />
                                    <Text style={styles.actionBtnText}>Open Maps</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => Alert.alert("Share", "Sharing project link...")}>
                                    <Ionicons name="share-outline" size={20} color={theme.primary} />
                                    <Text style={[styles.actionBtnText, { color: theme.text }]}>Share</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/add-activity?id=${id}&type=Project`)}>
                                    <Ionicons name="calendar-outline" size={20} color={theme.textLight} />
                                    <Text style={[styles.actionBtnText, { color: theme.text }]}>Log Task</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.snapshotBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={styles.snapItem}>
                                    <Text style={[styles.snapLabel, { color: theme.textLight }]}>CATEGORY</Text>
                                    <Text style={[styles.snapValue, { color: theme.text }]}>{lookupVal(project.category)}</Text>
                                </View>
                                <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                                <View style={styles.snapItem}>
                                    <Text style={[styles.snapLabel, { color: theme.textLight }]}>AREA</Text>
                                    <Text style={[styles.snapValue, { color: theme.text }]}>{project.landArea || "—"}</Text>
                                </View>
                                <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                                <View style={styles.snapItem}>
                                    <Text style={[styles.snapLabel, { color: theme.textLight }]}>BLOCKS</Text>
                                    <Text style={[styles.snapValue, { color: theme.text }]}>{project.blocks?.length || 0}</Text>
                                </View>
                            </View>

                            <View style={styles.mainGrid}>
                                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Technical Details</Text>
                                    <InfoRow label="RERA Number" value={project.reraNumber} icon="document-text-outline" accent />
                                    <InfoRow label="Sub-Category" value={lookupVal(project.subCategory)} icon="list-outline" />
                                    <InfoRow label="Land Area" value={project.landArea ? `${project.landArea} ${project.landAreaUnit}` : "—"} icon="resize-outline" />
                                    <InfoRow label="City" value={project.address?.city} icon="location-outline" />
                                    <InfoRow label="Team" value={lv(project.team)} icon="people-outline" />
                                </View>

                                {project.blocks && project.blocks.length > 0 && (
                                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Blocks / Phases</Text>
                                        <View style={styles.blockGrid}>
                                            {project.blocks.map((b: any, i: number) => (
                                                <View key={i} style={[styles.blockChip, { backgroundColor: theme.background }]}>
                                                    <Ionicons name="cube-outline" size={14} color={theme.primary} />
                                                    <Text style={[styles.blockText, { color: theme.text }]}>{typeof b === 'string' ? b : b.name}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Location Summary</Text>
                                    <Text style={[styles.locAddress, { color: theme.text }]}>{location}</Text>
                                    <TouchableOpacity style={[styles.mapLink, { backgroundColor: theme.primary + '10' }]} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`)}>
                                        <Text style={[styles.mapLinkText, { color: theme.primary }]}>Detailed View on Maps</Text>
                                        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
                                    </TouchableOpacity>
                                </View>

                                {project.amenities && (
                                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Amenities</Text>
                                        <View style={styles.amenityBox}>
                                            {Object.entries(project.amenities).map(([name, active]) => active && (
                                                <View key={name} style={[styles.amenityChip, { backgroundColor: theme.background }]}>
                                                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                                    <Text style={[styles.amenityText, { color: theme.text }]}>{name}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </Animated.View>
                    </ScrollView>
                </View>

                {/* 2. Activities */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll} showsVerticalScrollIndicator={false}>
                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Activity Timeline</Text>
                                <TouchableOpacity onPress={() => router.push(`/add-activity?id=${id}&type=Project`)}>
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Add</Text>
                                </TouchableOpacity>
                            </View>
                            {activities.length === 0 ? (
                                <Text style={styles.emptyText}>No activities recorded yet.</Text>
                            ) : (
                                activities.map((act, i) => (
                                    <View key={i} style={[styles.timelineItem, { borderLeftColor: theme.border }]}>
                                        <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                                        <View style={styles.timelineBody}>
                                            <View style={styles.timelineHeader}>
                                                <Text style={[styles.timelineType, { color: theme.primary }]}>{act.type?.toUpperCase() || "ACTIVITY"}</Text>
                                                <Text style={styles.timelineDate}>{new Date(act.createdAt).toLocaleDateString()}</Text>
                                            </View>
                                            <Text style={[styles.timelineSubject, { color: theme.text }]}>{act.subject}</Text>
                                            {(act.description || act.details?.note) && <Text style={[styles.timelineNote, { color: theme.textLight }]}>{act.description || act.details.note}</Text>}
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, fontWeight: "600" },
    headerCard: { paddingBottom: 0, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 5, zIndex: 10 },
    navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    navBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    navTitle: { fontSize: 17, fontWeight: "800" },

    heroSummary: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, gap: 15 },
    avatarBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    heroText: { flex: 1 },
    heroName: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
    statusCapsule: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
    statusCapsuleText: { fontSize: 10, fontWeight: "800" },

    tabsScroll: { paddingHorizontal: 20, gap: 25 },
    tabItem: { paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabLabel: { fontSize: 14, fontWeight: '800' },

    tabContent: { width: SCREEN_WIDTH, flex: 1 },
    innerScroll: { padding: 20, paddingBottom: 100 },

    quickActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    actionBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    actionBtnSoft: { borderWidth: 1 },
    actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

    snapshotBar: { padding: 16, borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    snapItem: { flex: 1, alignItems: 'center' },
    snapLabel: { fontSize: 9, fontWeight: "800", marginBottom: 4 },
    snapValue: { fontSize: 14, fontWeight: "800" },
    snapDivider: { width: 1, height: '60%', alignSelf: 'center' },

    mainGrid: {},
    sectionCard: { padding: 20, borderRadius: 22, borderWidth: 1, marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },

    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 14, fontWeight: "600" },
    infoValue: { fontSize: 14, fontWeight: "700" },

    locAddress: { fontSize: 14, fontWeight: "600", lineHeight: 22, marginBottom: 16 },
    mapLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12 },
    mapLinkText: { fontSize: 13, fontWeight: "800" },

    amenityBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
    amenityText: { fontSize: 12, fontWeight: "700" },

    blockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    blockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    blockText: { fontSize: 12, fontWeight: "700" },

    emptyText: { textAlign: 'center', padding: 20, fontSize: 14, opacity: 0.5, fontWeight: '600' },

    timelineItem: { borderLeftWidth: 2, marginLeft: 10, paddingLeft: 20, paddingBottom: 25 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', left: -7, top: 0 },
    timelineBody: { marginTop: -4 },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    timelineType: { fontSize: 10, fontWeight: '800' },
    timelineDate: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
    timelineSubject: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    timelineNote: { fontSize: 12, lineHeight: 18 },
});
