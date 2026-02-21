import { useEffect, useState, useCallback } from "react";
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
    RefreshControl, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { getInventory, type InventoryUnit } from "../services/inventory.service";

const STATUS_COLORS: Record<string, string> = {
    available: "#10B981", sold: "#EF4444", booked: "#F59E0B", "under construction": "#6366F1",
};

function resolveName(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "object" && field !== null && "name" in field) return (field as any).name ?? "—";
    return String(field);
}

function formatPrice(price?: number): string {
    if (!price) return "Price N/A";
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price.toLocaleString("en-IN")}`;
}

function UnitCard({ unit, onPress }: { unit: InventoryUnit; onPress: () => void }) {
    const statusStr = resolveName(unit.status).toLowerCase();
    const color = STATUS_COLORS[statusStr] ?? "#6366F1";

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.cardLeft}>
                <View style={[styles.unitNumBox, { borderColor: color }]}>
                    <Text style={[styles.unitNum, { color }]}>{unit.unitNumber ?? "N/A"}</Text>
                </View>
            </View>
            <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                    <Text style={styles.projectName} numberOfLines={1}>{resolveName(unit.project)}</Text>
                    <View style={[styles.badge, { backgroundColor: color + "18" }]}>
                        <Text style={[styles.badgeText, { color }]}>{resolveName(unit.status)}</Text>
                    </View>
                </View>
                <Text style={styles.blockText}>Block: {resolveName(unit.block)} {unit.floor != null ? `· Floor ${unit.floor}` : ""}</Text>
                <View style={styles.statsRow}>
                    {unit.size ? <Text style={styles.stat}>📐 {unit.size} sq.ft</Text> : null}
                    {unit.unitType ? <Text style={styles.stat}>🏠 {resolveName(unit.unitType)}</Text> : null}
                </View>
                <Text style={styles.price}>{formatPrice(unit.price)}</Text>
            </View>
        </TouchableOpacity>
    );
}

export default function MoreScreen() {
    const router = useRouter();
    const [inventory, setInventory] = useState<InventoryUnit[]>([]);
    const [filtered, setFiltered] = useState<InventoryUnit[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchInventory = useCallback(async () => {
        try {
            const res = await getInventory();
            const list: InventoryUnit[] = Array.isArray(res) ? res : (res?.records ?? res?.data ?? []);
            setInventory(list);
            setFiltered(list);
        } catch (e) {
            console.error("fetchInventory error", e);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchInventory(); }, []);

    const handleSearch = (text: string) => {
        setSearch(text);
        const q = text.toLowerCase();
        setFiltered(inventory.filter((u) =>
            (u.unitNumber ?? "").toLowerCase().includes(q) ||
            resolveName(u.project).toLowerCase().includes(q) ||
            resolveName(u.block).toLowerCase().includes(q)
        ));
    };

    const available = filtered.filter((u) => resolveName(u.status).toLowerCase() === "available").length;
    const sold = filtered.filter((u) => resolveName(u.status).toLowerCase() === "sold").length;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Inventory</Text>
                <Text style={styles.headerCount}>{filtered.length} units</Text>
            </View>

            {!loading && (
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: "#ECFDF5" }]}>
                        <Text style={styles.summaryNum}>{available}</Text>
                        <Text style={[styles.summaryLabel, { color: "#10B981" }]}>Available</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: "#FEF2F2" }]}>
                        <Text style={styles.summaryNum}>{sold}</Text>
                        <Text style={[styles.summaryLabel, { color: "#EF4444" }]}>Sold</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: "#FFFBEB" }]}>
                        <Text style={styles.summaryNum}>{filtered.length - available - sold}</Text>
                        <Text style={[styles.summaryLabel, { color: "#F59E0B" }]}>Others</Text>
                    </View>
                </View>
            )}

            <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search unit, project, block..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={handleSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator color="#1E40AF" size="large" style={{ marginTop: 60 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => <UnitCard unit={item} onPress={() => router.push(`/inventory-detail?id=${item._id}`)} />}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInventory(); }} tintColor="#1E40AF" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>🏢</Text>
                            <Text style={styles.emptyText}>{search ? "No units found" : "No inventory yet"}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F0F4FF" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
    headerTitle: { fontSize: 26, fontWeight: "800", color: "#1E293B" },
    headerCount: { fontSize: 13, color: "#64748B", fontWeight: "600" },
    summaryRow: { flexDirection: "row", gap: 10, marginHorizontal: 20, marginBottom: 14 },
    summaryCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
    summaryNum: { fontSize: 22, fontWeight: "800", color: "#1E293B" },
    summaryLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },
    searchBox: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 14,
        backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: "#1E293B" },
    list: { paddingHorizontal: 20, paddingBottom: 100 },
    card: {
        backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12,
        flexDirection: "row", alignItems: "center",
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    cardLeft: { marginRight: 14 },
    unitNumBox: { borderWidth: 2, borderRadius: 10, padding: 8, minWidth: 50, alignItems: "center" },
    unitNum: { fontSize: 16, fontWeight: "800" },
    cardBody: { flex: 1 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    projectName: { fontSize: 14, fontWeight: "700", color: "#1E293B", flex: 1, marginRight: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
    blockText: { fontSize: 12, color: "#64748B", marginBottom: 4 },
    statsRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
    stat: { fontSize: 11, color: "#94A3B8" },
    price: { fontSize: 14, fontWeight: "700", color: "#1E40AF" },
    empty: { alignItems: "center", marginTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 16, color: "#94A3B8", fontWeight: "600" },
});
