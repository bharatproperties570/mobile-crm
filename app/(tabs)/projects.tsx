import { useEffect, useState, useCallback, useMemo } from "react";
import {
    View, Text, StyleSheet, SectionList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Dimensions
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getProjects, type Project } from "../services/projects.service";
import { lookupVal } from "../services/api.helpers";
import { safeApiCall } from "../services/api.helpers";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getStatusProgress(status: string) {
    const s = status.toLowerCase();
    if (s.includes("ready") || s.includes("completed")) return { percent: 1, color: "#10B981", label: "100%" };
    if (s.includes("construction") || s.includes("building")) return { percent: 0.65, color: "#F59E0B", label: "65%" };
    return { percent: 0.2, color: "#6366F1", label: "Planned" };
}

function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
    const statusLabel = lookupVal(project.status);
    const progress = getStatusProgress(statusLabel);
    const categories = lookupVal(project.category);
    const location = project.locationSearch || project.address?.location || project.address?.city || "No Location";

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.cardHeader}>
                <View style={styles.thumb}>
                    <Ionicons name="business" size={24} color="#94A3B8" />
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
                    <Text style={styles.projectId}>ID: PRJ-{project._id.substring(0, 6).toUpperCase()}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: progress.color + "15" }]}>
                    <Text style={[styles.badgeText, { color: progress.color }]}>{statusLabel}</Text>
                </View>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.metaRow}>
                    <Ionicons name="location-sharp" size={14} color="#EF4444" />
                    <Text style={styles.metaText} numberOfLines={1}>{location}</Text>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${progress.percent * 100}%`, backgroundColor: progress.color }]} />
                        </View>
                        <Text style={styles.progressLabel}>{progress.label}</Text>
                    </View>
                    <View style={styles.tagList}>
                        {categories.split(", ").slice(0, 2).map((cat, i) => (
                            <View key={i} style={styles.tag}>
                                <Text style={styles.tagText}>{cat}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

export default function ProjectsScreen() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProjects = useCallback(async () => {
        const result = await safeApiCall<Project>(() => getProjects());
        if (!result.error) {
            setProjects(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchProjects(); }, []);

    const sections = useMemo(() => {
        const filtered = projects.filter(p => {
            const q = search.toLowerCase();
            return p.name.toLowerCase().includes(q) ||
                (p.locationSearch || "").toLowerCase().includes(q) ||
                (p.address?.city || "").toLowerCase().includes(q);
        });

        const groups: Record<string, Project[]> = {};
        filtered.forEach(p => {
            const city = p.address?.city || "Other Locations";
            if (!groups[city]) groups[city] = [];
            groups[city].push(p);
        });

        return Object.keys(groups).sort().map(city => ({
            title: city,
            data: groups[city]
        }));
    }, [projects, search]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Projects</Text>
                <Text style={styles.headerCount}>{projects.length} records</Text>
            </View>

            <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search project, city..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator color="#1E3A8A" size="large" style={{ marginTop: 60 }} />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <ProjectCard
                            project={item}
                            onPress={() => router.push(`/project-detail?id=${item._id}`)}
                        />
                    )}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{title.toUpperCase()} PROJECTS</Text>
                            <View style={styles.titleLine} />
                        </View>
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={< RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProjects(); }} tintColor="#1E3A8A" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="business-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>{search ? "No matches found" : "No projects yet"}</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity style={styles.fab} onPress={() => router.push("/add-project")}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
    headerTitle: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
    headerCount: { fontSize: 12, color: "#64748B", fontWeight: "600" },
    searchBox: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12,
        backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: "#E2E8F0",
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#1E293B" },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    sectionHeader: {
        flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 12, gap: 10
    },
    sectionTitle: { fontSize: 11, fontWeight: "700", color: "#64748B", letterSpacing: 1 },
    titleLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
    card: {
        backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }
    },
    cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    thumb: {
        width: 48, height: 48, borderRadius: 12, backgroundColor: "#F8FAFC",
        justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F1F5F9"
    },
    headerInfo: { flex: 1, marginLeft: 12 },
    projectName: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    projectId: { fontSize: 10, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    cardBody: {},
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    metaText: { fontSize: 13, color: "#475569", fontWeight: "500" },
    cardFooter: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        borderTopWidth: 1, borderTopColor: "#F8FAFC", paddingTop: 12
    },
    progressContainer: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    progressBarBg: { flex: 1, height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
    progressBarFill: { height: "100%", borderRadius: 3 },
    progressLabel: { fontSize: 10, fontWeight: "700", color: "#64748B", minWidth: 40 },
    tagList: { flexDirection: "row", gap: 6 },
    tag: {
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
        backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#E0E7FF"
    },
    tagText: { fontSize: 10, fontWeight: "700", color: "#1E40AF" },
    empty: { alignItems: "center", marginTop: 80 },
    emptyText: { fontSize: 16, color: "#94A3B8", fontWeight: "600", marginTop: 12 },
    fab: {
        position: "absolute", bottom: 30, right: 20, width: 56, height: 56,
        borderRadius: 28, backgroundColor: "#1E3A8A", justifyContent: "center",
        alignItems: "center", elevation: 4, shadowColor: "#000",
        shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },
});
