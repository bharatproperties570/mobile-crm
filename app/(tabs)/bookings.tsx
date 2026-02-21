import { useEffect, useState, useCallback } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";
import { safeApiCall, lookupVal } from "../services/api.helpers";

const STATUS_COLORS: Record<string, string> = {
    'Booked': '#10B981',
    'Agreement': '#3B82F6',
    'Registry': '#8B5CF6',
    'Pending': '#F59E0B',
    'Cancelled': '#EF4444'
};

function BookingCard({ booking, onPress }: { booking: any; onPress: () => void }) {
    const status = booking.status || 'Pending';
    const color = STATUS_COLORS[status] || '#64748B';
    const amount = booking.totalDealAmount ? `₹${booking.totalDealAmount.toLocaleString()}` : "N/A";

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.cardTop}>
                <View>
                    <Text style={styles.appNo}>{booking.applicationNo || "Draft"}</Text>
                    <Text style={styles.bookingDate}>{new Date(booking.bookingDate).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: color + "15" }]}>
                    <Text style={[styles.statusText, { color: color }]}>{status}</Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardBottom}>
                <View style={styles.metaRow}>
                    <Ionicons name="cash-outline" size={14} color="#94A3B8" />
                    <Text style={styles.priceText}>{amount}</Text>
                </View>
                <View style={[styles.metaRow, { marginLeft: 16 }]}>
                    <Ionicons name="person-outline" size={14} color="#94A3B8" />
                    <Text style={styles.metaText} numberOfLines={1}>{booking.lead?.name || "Client"}</Text>
                </View>
            </View>

            {/* Progress indicator */}
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: status === 'Registry' ? '100%' : status === 'Agreement' ? '70%' : '30%', backgroundColor: color }]} />
            </View>
        </TouchableOpacity>
    );
}

export default function BookingsScreen() {
    const router = useRouter();
    const [bookings, setBookings] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchBookings = useCallback(async () => {
        const result = await safeApiCall<any>(() => api.get("/bookings"));
        if (!result.error) {
            const data = result.data as any;
            setBookings(data?.records || data || []);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchBookings(); }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Bookings</Text>
            </View>

            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by ID, client or property..."
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={bookings}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <BookingCard
                            booking={item}
                            onPress={() => { }}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} tintColor="#10B981" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="document-text-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No bookings found</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: "#fff"
    },
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
    appNo: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
    bookingDate: { fontSize: 12, color: "#94A3B8", marginTop: 2, fontWeight: "600" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    divider: { height: 1, backgroundColor: "#F8FAFC", marginBottom: 12 },
    cardBottom: { flexDirection: "row", alignItems: "center" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    priceText: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
    metaText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
    progressTrack: { height: 4, backgroundColor: "#F1F5F9", borderRadius: 2, marginTop: 16 },
    progressFill: { height: '100%', borderRadius: 2 },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: "#94A3B8", fontWeight: "600" }
});
