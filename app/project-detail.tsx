import { useEffect, useState, useCallback, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Linking, Alert, Animated, SafeAreaView
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./context/ThemeContext";
import { getProjectById, deleteProject, type Project } from "./services/projects.service";
import { lookupVal, safeApiCall } from "./services/api.helpers";

function lv(field: unknown): string {
    if (!field) return "—";
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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchProject = useCallback(async () => {
        if (!id) return;
        try {
            const res = await getProjectById(id as string);
            const found = res.data || res.record || res;
            setProject(found || null);
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { fetchProject(); }, [id]);

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
            <SafeAreaView style={{ backgroundColor: theme.card, zIndex: 10 }}>
                <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.navBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: theme.text }]}>Project Command</Text>
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.background }]} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProject(); }} tintColor={theme.primary} />}
            >
                <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
                        <View style={styles.heroTopRow}>
                            <View style={[styles.avatarBox, { backgroundColor: theme.primary + '15' }]}>
                                <Ionicons name="business" size={32} color={theme.primary} />
                            </View>
                            <View style={styles.nameSection}>
                                <Text style={[styles.heroName, { color: theme.text }]}>{project.name}</Text>
                                <View style={[styles.statusCapsule, { backgroundColor: theme.primary + '15' }]}>
                                    <Text style={[styles.statusCapsuleText, { color: theme.primary }]}>{statusLabel.toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.heroSecondary, { backgroundColor: theme.background }]}>
                            <Text style={[styles.heroId, { color: theme.textLight }]}>ID: PRJ-{project._id.substring(0, 8).toUpperCase()}</Text>
                        </View>
                    </View>

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
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, fontWeight: "600" },
    navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    navBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    navTitle: { fontSize: 17, fontWeight: "800" },
    scrollContent: { paddingBottom: 100 },
    heroCard: { margin: 20, padding: 20, borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatarBox: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    nameSection: { flex: 1 },
    heroName: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
    statusCapsule: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    statusCapsuleText: { fontSize: 11, fontWeight: "800" },
    heroSecondary: { marginTop: 16, borderRadius: 16, padding: 12 },
    heroId: { fontSize: 12, fontWeight: "700" },
    quickActions: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    actionBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    actionBtnSoft: { borderWidth: 1 },
    actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    snapshotBar: { marginHorizontal: 20, padding: 16, borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    snapItem: { flex: 1, alignItems: 'center' },
    snapLabel: { fontSize: 9, fontWeight: "800", marginBottom: 4 },
    snapValue: { fontSize: 14, fontWeight: "800" },
    snapDivider: { width: 1, height: '60%', alignSelf: 'center' },
    mainGrid: { paddingHorizontal: 20 },
    sectionCard: { padding: 20, borderRadius: 22, borderWidth: 1, marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 14, fontWeight: "600" },
    infoValue: { fontSize: 14, fontWeight: "700" },
    locAddress: { fontSize: 14, fontWeight: "600", lineHeight: 22, marginBottom: 16 },
    mapLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12 },
    mapLinkText: { fontSize: 13, fontWeight: "800" },
    amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
    amenityText: { fontSize: 12, fontWeight: "700" },
    blockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    blockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    blockText: { fontSize: 12, fontWeight: "700" },
});
