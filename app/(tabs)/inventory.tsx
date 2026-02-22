import { useEffect, useState, useCallback, useMemo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getInventory, type Inventory } from "../services/inventory.service";
import { lookupVal, safeApiCall } from "../services/api.helpers";

const STATUS_COLORS: Record<string, string> = {
    'Available': '#10B981',
    'Sold': '#EF4444',
    'Reserved': '#F59E0B',
    'Blocked': '#64748B',
    'Hold': '#8B5CF6'
};

function InventoryCard({ item, onPress }: { item: Inventory; onPress: () => void }) {
    const status = lookupVal(item.status);
    const color = STATUS_COLORS[status] || '#64748B';
    const price = item.price ? `₹${item.price}` : "Price N/A";

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.cardTop}>
                <View>
                    <Text style={styles.projectName}>{item.projectName || "N/A"}</Text>
                    <Text style={styles.unitInfo}>{item.block || "No Block"} • Unit {item.unitNumber || "N/A"}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: color + "15" }]}>
                    <Text style={[styles.statusText, { color: color }]}>{status}</Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardBottom}>
                <View style={styles.metaRow}>
                    <Ionicons name="pricetag-outline" size={14} color="#94A3B8" />
                    <Text style={styles.priceText}>{price}</Text>
                </View>
                <View style={[styles.metaRow, { marginLeft: 16 }]}>
                    <Ionicons name="expand-outline" size={14} color="#94A3B8" />
                    <Text style={styles.metaText}>{item.size} {item.sizeUnit}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <View style={styles.intentBadge}>
                    <Text style={styles.intentText}>{lookupVal(item.intent)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

export default function InventoryScreen() {
    const router = useRouter();
    const [inventory, setInventory] = useState<Inventory[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchInventory = useCallback(async () => {
        const result = await safeApiCall<Inventory>(() => getInventory());
        if (!result.error) {
            setInventory(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchInventory();
        }, [fetchInventory])
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return inventory.filter(i =>
            (i.projectName || "").toLowerCase().includes(q) ||
            (i.unitNumber || "").toLowerCase().includes(q) ||
            (i.block || "").toLowerCase().includes(q)
        );
    }, [inventory, search]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.title}>Inventory</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by project, unit, block..."
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <InventoryCard
                            item={item}
                            onPress={() => router.push(`/inventory-detail?id=${item._id}`)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInventory(); }} tintColor="#1E3A8A" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="cube-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>{search ? "No units found" : "No inventory records yet"}</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push("/add-inventory")}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: "#fff"
    },
    backBtn: { padding: 8 },
    title: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    searchBar: {
        flexDirection: "row", alignItems: "center", margin: 16, paddingHorizontal: 16,
        paddingVertical: 10, backgroundColor: "#fff", borderRadius: 14,
        borderWidth: 1, borderColor: "#E2E8F0"
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: "#1E293B" },
    list: { padding: 16, paddingBottom: 100 },
    card: {
        backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    projectName: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    unitInfo: { fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: "600" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    divider: { height: 1, backgroundColor: "#F8FAFC", marginBottom: 12 },
    cardBottom: { flexDirection: "row", alignItems: "center" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    priceText: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
    metaText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
    intentBadge: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    intentText: { fontSize: 10, fontWeight: "700", color: "#475569" },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: "#94A3B8", fontWeight: "600" },
    fab: {
        position: 'absolute', right: 20, bottom: 20,
        backgroundColor: '#1E40AF', width: 60, height: 60,
        borderRadius: 30, justifyContent: 'center', alignItems: 'center',
        shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
    }
});
