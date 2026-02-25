import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import {
    View, Text, StyleSheet, SectionList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Dimensions, Animated, Modal, Pressable, Alert
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getProjects, type Project } from "../services/projects.service";
import { lookupVal } from "../services/api.helpers";
import { safeApiCall } from "../services/api.helpers";
import { useTheme } from "../context/ThemeContext";
import { useLookup } from "../context/LookupContext";
import FilterModal, { FilterField } from "../components/FilterModal";

const PROJECT_FILTER_FIELDS: FilterField[] = [
    { key: "status", label: "Status", type: "lookup", lookupType: "ProjectStatus" },
    { key: "category", label: "Category", type: "lookup", lookupType: "Category" },
    { key: "city", label: "City", type: "lookup", lookupType: "City" },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getStatusProgress(status: string) {
    const s = status.toLowerCase();
    if (s.includes("ready") || s.includes("completed")) return { percent: 1, color: "#10B981", label: "COMPLETED" };
    if (s.includes("construction") || s.includes("building")) return { percent: 0.65, color: "#F59E0B", label: "65% BUILT" };
    return { percent: 0.2, color: "#6366F1", label: "PLANNED" };
}

const ProjectCard = memo(({ project, onPress, onMenuPress }: { project: Project; onPress: () => void; onMenuPress: () => void }) => {
    const { theme } = useTheme();
    const { getLookupValue } = useLookup();
    const statusLabel = getLookupValue('ProjectStatus', project.status);
    const progress = getStatusProgress(statusLabel);
    const categories = getLookupValue('Category', project.category);
    const location = project.locationSearch || project.address?.location || project.address?.city || "No Location";

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View style={[styles.cardAccent, { backgroundColor: progress.color }]} />
            <View style={styles.cardMain}>
                <View style={styles.cardHeader}>
                    <View style={styles.identityGroup}>
                        <Text style={styles.projectId}>PRJ-{project._id.substring(0, 6).toUpperCase()}</Text>
                        <Text style={[styles.projectName, { color: theme.text }]} numberOfLines={1}>{project.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.statusPill, { backgroundColor: progress.color + "15" }]}>
                            <View style={[styles.statusDot, { backgroundColor: progress.color }]} />
                            <Text style={[styles.statusText, { color: progress.color }]}>{statusLabel}</Text>
                        </View>
                        <TouchableOpacity style={styles.menuTrigger} onPress={(e) => { e.stopPropagation(); onMenuPress(); }}>
                            <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.locationRow}>
                    <Ionicons name="location-sharp" size={14} color={theme.textLight} />
                    <Text style={[styles.locationText, { color: theme.textLight }]} numberOfLines={1}>{location}</Text>
                </View>

                <View style={[styles.progressSection, { backgroundColor: theme.background }]}>
                    <View style={styles.progressInfo}>
                        <Text style={[styles.progressLabel, { color: theme.text }]}>{progress.label}</Text>
                        <Text style={styles.categoryText}>{categories.split(", ")[0]}</Text>
                    </View>
                    <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                        <View style={[styles.progressBarFill, { width: `${progress.percent * 100}%`, backgroundColor: progress.color }]} />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
});

export default function ProjectsScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [filters, setFilters] = useState<any>({});
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Action Hub State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(350)).current;

    const openHub = (project: Project) => {
        setSelectedProject(project);
        setHubVisible(true);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start();
    };

    const closeHub = () => {
        Animated.timing(slideAnim, {
            toValue: 350,
            duration: 200,
            useNativeDriver: true
        }).start(() => {
            setHubVisible(false);
            setSelectedProject(null);
        });
    };

    const fetchProjects = useCallback(async (pageNum = 1, shouldAppend = false) => {
        if (!shouldAppend) setLoading(true);
        const result = await safeApiCall<any>(() => getProjects({ page: String(pageNum), limit: "50" }));

        if (!result.error && result.data) {
            const dataObj = result.data as any;
            const newRecords = dataObj.data || dataObj.records || (Array.isArray(dataObj) ? dataObj : []);
            setProjects(prev => shouldAppend ? [...prev, ...newRecords] : newRecords);
            setHasMore(newRecords.length === 50);
            setPage(pageNum);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchProjects(1, false); }, [fetchProjects]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchProjects(1, false);
    }, [fetchProjects]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchProjects(page + 1, true);
        }
    }, [loading, hasMore, page, fetchProjects]);

    const sections = useMemo(() => {
        const filtered = projects.filter(p => {
            const q = search.toLowerCase();
            const matchesSearch = p.name.toLowerCase().includes(q) ||
                (p.locationSearch || "").toLowerCase().includes(q) ||
                (p.address?.city || "").toLowerCase().includes(q);

            if (!matchesSearch) return false;

            // Apply Filters
            if (filters.status?.length > 0 && !filters.status.includes(p.status)) return false;
            if (filters.category?.length > 0) {
                const pCats = Array.isArray(p.category) ? p.category : [p.category];
                if (!filters.category.some((c: string) => pCats.includes(c))) return false;
            }
            if (filters.city?.length > 0 && !filters.city.includes(p.address?.city)) return false;

            return true;
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
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Projects</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textLight }]}>{projects.length} development sites</Text>
                </View>
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: theme.primary }]}
                    onPress={() => router.push("/add-project")}
                >
                    <Ionicons name="add" size={26} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={[styles.commandBar, { backgroundColor: (theme as any).inputBg || theme.card, borderColor: theme.border }]}>
                <Ionicons name="search" size={20} color={theme.textLight} />
                <TextInput
                    style={[styles.commandInput, { color: theme.text }]}
                    placeholder="Search Infrastructure or City..."
                    placeholderTextColor={theme.textLight + "80"}
                    value={search}
                    onChangeText={setSearch}
                />
                <TouchableOpacity onPress={() => setShowFilterModal(true)} style={styles.filterBtn}>
                    <Ionicons name="filter" size={20} color={Object.keys(filters).length > 0 ? theme.primary : theme.textLight} />
                    {Object.keys(filters).length > 0 && <View style={styles.filterBadge} />}
                </TouchableOpacity>
            </View>

            {loading && page === 1 ? (
                <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <ProjectCard
                            project={item}
                            onPress={() => router.push(`/project-detail?id=${item._id}`)}
                            onMenuPress={() => openHub(item)}
                        />
                    )}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
                            <Text style={[styles.sectionTitle, { color: theme.textLight }]}>{title.toUpperCase()}</Text>
                        </View>
                    )}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    contentContainerStyle={styles.list}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                    ListFooterComponent={loading && page > 1 ? <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="business-outline" size={64} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>{search ? "No project matches" : "Database is empty"}</Text>
                        </View>
                    }
                />
            )}

            {/* Action Hub Modal */}
            <Modal transparent visible={hubVisible} animationType="none" onRequestClose={closeHub}>
                <Pressable style={actionHubStyles.modalOverlay} onPress={closeHub}>
                    <Animated.View style={[actionHubStyles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
                        <View style={actionHubStyles.sheetHandle} />
                        <View style={actionHubStyles.sheetHeader}>
                            <Text style={actionHubStyles.sheetTitle}>{selectedProject ? selectedProject.name : "Project Actions"}</Text>
                            <Text style={actionHubStyles.sheetSub}>PRJ-{selectedProject?._id?.substring(0, 6).toUpperCase()}</Text>
                        </View>

                        <View style={actionHubStyles.actionGrid}>
                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                router.push(`/add-project?id=${selectedProject?._id}`); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color="#64748B" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Edit</Text>
                            </TouchableOpacity >

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Add Price", "Navigating to Pricing form..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
                                    <Ionicons name="cash" size={24} color="#DB2777" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Add Price</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                router.push(`/match-lead?projectId=${selectedProject?._id}`); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                    <Ionicons name="git-compare" size={24} color="#7C3AED" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Match Leads</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                router.push(`/documents?projectId=${selectedProject?._id}`); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#F0F9FF" }]}>
                                    <Ionicons name="document-attach" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Documents</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Upload", "Securely upload unit layouts/brochures."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
                                    <Ionicons name="cloud-upload" size={24} color="#16A34A" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Upload</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Share", "Sharing project microsite..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
                                    <Ionicons name="share-social" size={24} color="#3B82F6" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Share</Text>
                            </TouchableOpacity>
                        </View >
                    </Animated.View >
                </Pressable >
            </Modal >

            <FilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={setFilters}
                initialFilters={filters}
                fields={PROJECT_FILTER_FIELDS}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
    headerTitle: { fontSize: 32, fontWeight: "900", color: "#0F172A", letterSpacing: -1 },
    headerSubtitle: { fontSize: 13, color: "#64748B", fontWeight: "600", marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#2563EB", justifyContent: 'center', alignItems: 'center' },

    commandBar: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 12,
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F8FAFC",
        borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0"
    },
    commandInput: { flex: 1, marginLeft: 12, fontSize: 15, color: "#1E293B", fontWeight: "600" },
    filterBtn: { padding: 4, marginLeft: 8, position: 'relative' },
    filterBadge: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', borderWidth: 1.5, borderColor: '#fff' },

    list: { paddingBottom: 100 },
    sectionHeader: { backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 12 },
    sectionTitle: { fontSize: 11, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.5 },

    // Modern Project Card
    card: {
        flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12,
        borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    cardAccent: { width: 6 },
    cardMain: { flex: 1, padding: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    identityGroup: { flex: 1 },
    projectId: { fontSize: 10, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", marginBottom: 2 },
    projectName: { fontSize: 18, fontWeight: "800", color: "#1E293B" },

    statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: "800" },

    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    locationText: { fontSize: 13, color: "#64748B", fontWeight: "600", flex: 1 },

    progressSection: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 12 },
    progressInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    progressLabel: { fontSize: 11, fontWeight: "900", color: "#475569" },
    categoryText: { fontSize: 10, fontWeight: "800", color: "#94A3B8", textTransform: 'uppercase' },
    progressBarBg: { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
    progressBarFill: { height: "100%", borderRadius: 3 },

    empty: { alignItems: "center", marginTop: 100, paddingHorizontal: 40 },
    emptyText: { marginTop: 16, fontSize: 16, color: "#94A3B8", fontWeight: "700", textAlign: 'center' },
    fab: {
        position: "absolute", bottom: 30, right: 20, width: 56, height: 56,
        borderRadius: 28, backgroundColor: "#2563EB", justifyContent: "center",
        alignItems: "center", elevation: 4, shadowColor: "#000",
        shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },
    menuTrigger: { padding: 8, marginRight: -8 },
});

const actionHubStyles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
    sheetContainer: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: 40, minHeight: 400 },
    sheetHandle: { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 },
    sheetHeader: { marginBottom: 24, alignItems: 'center' },
    sheetTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
    sheetSub: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: 'uppercase', marginTop: 4 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: 'center', gap: 12 },
    actionItem: { width: "22%", alignItems: "center", marginBottom: 16 },
    actionIcon: { width: 56, height: 56, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    actionLabel: { fontSize: 10, fontWeight: "800", color: "#475569", textAlign: "center" },
});
