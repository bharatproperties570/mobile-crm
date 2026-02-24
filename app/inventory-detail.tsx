import { useEffect, useState, useRef, useCallback } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Animated, Linking, Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./context/ThemeContext";
import api from "./services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");


function lv(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value ?? "—";
        if ("fullName" in field) return (field as any).fullName ?? "—";
        if ("name" in field) return (field as any).name ?? "—";
    }
    return String(field) || "—";
}

function InfoRow({ label, value, accent, icon }: { label: string; value: string; accent?: boolean; icon?: any }) {
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

const STATUS_COLORS: Record<string, string> = {
    available: "#10B981", sold: "#EF4444", "under offer": "#F59E0B",
    reserved: "#8B5CF6", blocked: "#F97316", rented: "#3B82F6",
};

export default function InventoryDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const [inv, setInv] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!id) return;
        api.get(`/inventory/${id}`)
            .then((res) => {
                setInv(res.data?.data ?? res.data);
                Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
            })
            .catch(() => Alert.alert("Error", "Could not load inventory"))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!inv) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={[styles.noData, { color: theme.textLight }]}>Unit not found</Text></View>;

    const statusLabel = lv(inv.status);
    const statusColor = STATUS_COLORS[statusLabel.toLowerCase()] ?? theme.primary;
    const unitTitle = `Unit ${inv.unitNumber || inv.unitNo || "N/A"} · ${inv.block || "Block A"}`;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <SafeAreaView style={{ backgroundColor: theme.card, zIndex: 10 }}>
                <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.navBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: theme.text }]}>Unit Command</Text>
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.background }]} onPress={() => router.push(`/add-inventory?id=${id}`)}>
                        <Ionicons name="create-outline" size={22} color={theme.text} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
                        <View style={styles.heroTopRow}>
                            <View style={[styles.avatarBox, { backgroundColor: theme.primary + '15' }]}>
                                <Ionicons name="home" size={32} color={theme.primary} />
                            </View>
                            <View style={styles.nameSection}>
                                <Text style={[styles.heroName, { color: theme.text }]}>{unitTitle}</Text>
                                <View style={[styles.statusCapsule, { backgroundColor: statusColor + '15' }]}>
                                    <Text style={[styles.statusCapsuleText, { color: statusColor }]}>{statusLabel.toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>

                        <Text style={[styles.subtitle, { color: theme.textLight }]}>
                            {inv.projectName || "Project Independent"} • {lv(inv.category)}
                        </Text>

                    </View>

                    <View style={styles.quickActions}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => Alert.alert("Share", "Sharing inventory specifications...")}>
                            <Ionicons name="share-social" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Share Specs</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => Linking.openURL(`https://wa.me/?text=Check out Unit ${inv.unitNumber} at ${inv.projectName}`)}>
                            <Ionicons name="logo-whatsapp" size={20} color="#10B981" />
                            <Text style={[styles.actionBtnText, { color: theme.text }]}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/add-lead?refInvent=${id}`)}>
                            <Ionicons name="person-add-outline" size={20} color={theme.textLight} />
                            <Text style={[styles.actionBtnText, { color: theme.text }]}>Add Lead</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.snapshotBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>UNIT TYPE</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{lv(inv.unitType)}</Text>
                        </View>
                        <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>SIZE</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{inv.size || "—"} {inv.sizeUnit || ""}</Text>
                        </View>
                        <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>FACING</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{lv(inv.facing)}</Text>
                        </View>
                    </View>

                    <View style={styles.mainGrid}>
                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Pricing & Commercials</Text>
                            <InfoRow label="Demand" value={inv.demand ? `₹${inv.demand.toLocaleString("en-IN")}` : "—"} icon="cash-outline" accent />
                            <InfoRow label="Maintenance" value={inv.maintenance} icon="construct-outline" />
                            <InfoRow label="Pricing Type" value={lv(inv.pricingType)} icon="pricetag-outline" />
                        </View>

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Unit Specifications</Text>
                            <InfoRow label="Unit Number" value={inv.unitNumber || inv.unitNo} icon="business-outline" />
                            <InfoRow label="Floor" value={inv.floor?.toString()} icon="layers-outline" />
                            <InfoRow label="Unit Type" value={lv(inv.unitType)} icon="home-outline" />
                            <InfoRow label="Property Type" value={lv(inv.propertyType)} icon="business-outline" />
                            <InfoRow label="Facing" value={lv(inv.facing)} icon="compass-outline" />
                            <InfoRow label="Road Width" value={inv.roadWidth} icon="git-merge-outline" />
                        </View>

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Area Breakdown</Text>
                            <InfoRow label="Total Area" value={inv.size ? `${inv.size} ${inv.sizeUnit}` : "—"} icon="resize-outline" accent />
                            <InfoRow label="Built Up Area" value={inv.builtUpArea?.toString()} icon="cube-outline" />
                            <InfoRow label="Carpet Area" value={inv.carpetArea?.toString()} icon="grid-outline" />
                        </View>

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Status & Condition</Text>
                            <InfoRow label="Construction" value={lv(inv.constructionStatus)} icon="construct-outline" />
                            <InfoRow label="Possession" value={inv.possession} icon="key-outline" />
                            <InfoRow label="Furnishing" value={lv(inv.furnishing)} icon="bed-outline" />
                            <InfoRow label="Age of Property" value={inv.ageOfProperty} icon="calendar-outline" />
                            <InfoRow label="Renovated" value={inv.renovated ? "Yes" : "No"} icon="refresh-outline" />
                        </View>

                        {inv.amenities && Object.keys(inv.amenities).length > 0 && (
                            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Amenities</Text>
                                <View style={styles.chipRow}>
                                    {Object.entries(inv.amenities).map(([key, val], i) => val ? (
                                        <View key={i} style={[styles.chip, { backgroundColor: theme.primary + '15' }]}>
                                            <Text style={[styles.chipText, { color: theme.primary }]}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                                        </View>
                                    ) : null)}
                                </View>
                            </View>
                        )}

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Assignment</Text>
                            <InfoRow label="Assigned To" value={lv(inv.assignedTo)} icon="person-outline" />
                            <InfoRow label="Visible To" value={lv(inv.visibleTo)} icon="eye-outline" />
                        </View>

                        {inv.remarks ? (
                            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Internal Remarks</Text>
                                <Text style={[styles.remarksText, { color: theme.text }]}>{inv.remarks}</Text>
                            </View>
                        ) : null}
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
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
    avatarBox: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    nameSection: { flex: 1 },
    heroName: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
    statusCapsule: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    statusCapsuleText: { fontSize: 11, fontWeight: "800" },
    subtitle: { fontSize: 13, fontWeight: "600", marginBottom: 20 },
    priceStrip: { flexDirection: 'row', padding: 16, borderRadius: 20, justifyContent: 'space-between' },
    priceStripItem: { flex: 1, alignItems: 'center' },
    priceStripLabel: { fontSize: 9, fontWeight: "800", marginBottom: 4 },
    priceStripValue: { fontSize: 15, fontWeight: "800" },
    priceDivider: { width: 1, height: '60%', alignSelf: 'center' },
    quickActions: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    actionBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    actionBtnSoft: { borderWidth: 1 },
    actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    snapshotBar: { marginHorizontal: 20, padding: 16, borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    snapItem: { flex: 1, alignItems: 'center' },
    snapLabel: { fontSize: 9, fontWeight: "800", marginBottom: 4 },
    snapValue: { fontSize: 13, fontWeight: "800" },
    snapDivider: { width: 1, height: '60%', alignSelf: 'center' },
    mainGrid: { paddingHorizontal: 20 },
    sectionCard: { padding: 20, borderRadius: 22, borderWidth: 1, marginBottom: 20 },
    sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 14, fontWeight: "600" },
    infoValue: { fontSize: 14, fontWeight: "700" },
    remarksText: { fontSize: 14, color: "#475569", lineHeight: 20 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    chipText: { fontSize: 11, fontWeight: '600' },
});
