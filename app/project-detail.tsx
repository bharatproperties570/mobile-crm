import { useEffect, useState, useCallback } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Linking, Dimensions, Alert
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getProjectById, updateProject, deleteProject, type Project } from "./services/projects.service";
import { lookupVal, safeApiCall } from "./services/api.helpers";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ProjectDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProject = useCallback(async () => {
        if (!id) return;
        try {
            const res = await getProjectById(id as string);
            // Handle different response shapes from backend
            const found = res.data || res.record || res;
            setProject(found || null);
        } catch (err) {
            console.error("Fetch project detail error:", err);
            setProject(null);
        }
        setLoading(false);
        setRefreshing(false);
    }, [id]);

    useEffect(() => { fetchProject(); }, [id]);

    const handleDelete = () => {
        Alert.alert(
            "Delete Project",
            "Are you sure you want to delete this project?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!id) return;
                        const res = await safeApiCall(() => deleteProject(id as string));
                        if (!res.error) {
                            Alert.alert("Deleted", "Project removed successfully.");
                            router.back();
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    if (!project) {
        return (
            <View style={styles.centered}>
                <Ionicons name="alert-circle-outline" size={60} color="#E2E8F0" />
                <Text style={styles.errorText}>Project not found</Text>
                <TouchableOpacity style={styles.btnBack} onPress={() => router.back()}>
                    <Text style={styles.btnBackText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const location = project.locationSearch || project.address?.location || project.address?.city || "No Location Specified";
    const statusLabel = lookupVal(project.status);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProject(); }} tintColor="#1E3A8A" />}
            >
                {/* Hero Section */}
                <View style={styles.hero}>
                    <View style={styles.heroThumb}>
                        <Ionicons name="business" size={40} color="#3B82F6" />
                    </View>
                    <Text style={styles.heroTitle}>{project.name}</Text>
                    <View style={styles.heroRow}>
                        <Text style={styles.heroId}>ID: PRJ-{project._id.substring(0, 8).toUpperCase()}</Text>
                        <Text style={styles.heroDot}>•</Text>
                        <Text style={styles.heroStatus}>{statusLabel}</Text>
                    </View>
                </View>

                {/* Info Grid */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>CATEGORY</Text>
                        <Text style={styles.infoValue}>{lookupVal(project.category)}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>RERA NO</Text>
                        <Text style={styles.infoValue}>{project.reraNumber || "N/A"}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>AREA</Text>
                        <Text style={styles.infoValue}>{project.landArea ? `${project.landArea} ${project.landAreaUnit}` : "N/A"}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>BLOCKS</Text>
                        <Text style={styles.infoValue}>{project.blocks?.length || 0} Phases</Text>
                    </View>
                </View>

                {/* Location Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>LOCATION DETAILS</Text>
                    <View style={styles.locationCard}>
                        <View style={styles.locHeader}>
                            <Ionicons name="location-sharp" size={20} color="#EF4444" />
                            <Text style={styles.cityName}>{project.address?.city || "City Unknown"}</Text>
                        </View>
                        <Text style={styles.fullAddress}>{location}</Text>
                        <TouchableOpacity style={styles.btnMap} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`)}>
                            <Text style={styles.btnMapText}>View on Google Maps</Text>
                            <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Blocks Section */}
                {project.blocks && project.blocks.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>PROJECT BLOCKS / PHASES</Text>
                        {project.blocks.map((block, i) => (
                            <View key={i} style={styles.blockRow}>
                                <View style={styles.blockDot} />
                                <Text style={styles.blockName}>{block.name}</Text>
                                <View style={styles.blockBadge}>
                                    <Text style={styles.blockBadgeText}>{block.status || "Planned"}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Amenities Section */}
                {project.amenities && Object.keys(project.amenities).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>AMENITIES</Text>
                        <View style={styles.amenityWrap}>
                            {Object.entries(project.amenities).map(([name, active]) => active && (
                                <View key={name} style={styles.amenityChip}>
                                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                    <Text style={styles.amenityText}>{name}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
    errorText: { fontSize: 16, fontWeight: "600", color: "#64748B", marginTop: 12 },
    btnBack: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#EEF2FF", borderRadius: 8 },
    btnBackText: { color: "#1E40AF", fontWeight: "700" },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: "#fff"
    },
    backBtn: { padding: 4 },
    headerActions: { flexDirection: "row", gap: 16 },
    actionIconBtn: { padding: 4 },
    scroll: { paddingBottom: 40 },
    hero: { backgroundColor: "#fff", padding: 24, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    heroThumb: {
        width: 80, height: 80, borderRadius: 20, backgroundColor: "#EFF6FF",
        justifyContent: "center", alignItems: "center", marginBottom: 16
    },
    heroTitle: { fontSize: 22, fontWeight: "800", color: "#1E293B", textAlign: "center" },
    heroRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    heroId: { fontSize: 12, color: "#94A3B8", fontWeight: "700" },
    heroDot: { color: "#CBD5E1" },
    heroStatus: { fontSize: 13, color: "#1E3A8A", fontWeight: "800" },
    infoGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 12 },
    infoCard: {
        width: (SCREEN_WIDTH - 36) / 2, backgroundColor: "#fff", padding: 16,
        borderRadius: 16, borderWidth: 1, borderColor: "#F1F5F9"
    },
    infoLabel: { fontSize: 10, fontWeight: "800", color: "#94A3B8", letterSpacing: 1, marginBottom: 4 },
    infoValue: { fontSize: 14, fontWeight: "700", color: "#334155" },
    section: { padding: 16, marginTop: 8 },
    sectionTitle: { fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 1, marginBottom: 16 },
    locationCard: { backgroundColor: "#fff", padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "#F1F5F9" },
    locHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    cityName: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    fullAddress: { fontSize: 14, color: "#64748B", lineHeight: 20, marginBottom: 16 },
    btnMap: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F8FAFC"
    },
    btnMapText: { fontSize: 14, fontWeight: "700", color: "#3B82F6" },
    blockRow: {
        flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#fff",
        borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F1F5F9"
    },
    blockDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3B82F6", marginRight: 12 },
    blockName: { flex: 1, fontSize: 15, fontWeight: "700", color: "#334155" },
    blockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#F1F5F9" },
    blockBadgeText: { fontSize: 10, fontWeight: "800", color: "#64748B" },
    amenityWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    amenityChip: {
        flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12,
        paddingVertical: 8, backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9"
    },
    amenityText: { fontSize: 13, color: "#475569", fontWeight: "600" },
});
