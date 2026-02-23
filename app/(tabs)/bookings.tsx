import { useEffect, useState, useCallback, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Animated
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { safeApiCall } from "../services/api.helpers";

const STATUS_COLORS: Record<string, string> = {
    'Booked': '#10B981',
    'Agreement': '#3B82F6',
    'Registry': '#8B5CF6',
    'Pending': '#F59E0B',
    'Cancelled': '#EF4444'
};

function BookingCard({ booking, onPress }: { booking: any; onPress: () => void }) {
    const { theme } = useTheme();
    const status = booking.status || 'Pending';
    const color = STATUS_COLORS[status] || theme.primary;
    const amount = booking.totalDealAmount ? `₹${booking.totalDealAmount.toLocaleString("en-IN")}` : "N/A";

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.cardTop}>
                <View>
                    <Text style={[styles.appNo, { color: theme.text }]}>{booking.applicationNo || "Draft"}</Text>
                    <Text style={[styles.bookingDate, { color: theme.textLight }]}>{new Date(booking.bookingDate).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: color + "15" }]}>
                    <Text style={[styles.statusText, { color: color }]}>{status.toUpperCase()}</Text>
                </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.background }]} />

            <View style={styles.cardBottom}>
                <View style={styles.metaRow}>
                    <Ionicons name="cash-outline" size={14} color={theme.textLight} />
                    <Text style={[styles.priceText, { color: theme.text }]}>{amount}</Text>
                </View>
                <View style={[styles.metaRow, { marginLeft: 16 }]}>
                    <Ionicons name="person-outline" size={14} color={theme.textLight} />
                    <Text style={[styles.metaText, { color: theme.textLight }]} numberOfLines={1}>{booking.lead?.name || "Client"}</Text>
                </View>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: theme.background }]}>
                <View style={[styles.progressFill, { width: status === 'Registry' ? '100%' : status === 'Agreement' ? '70%' : '30%', backgroundColor: color }]} />
            </View>
        </TouchableOpacity>
    );
}

export default function BookingsScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const [bookings, setBookings] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchBookings = useCallback(async () => {
        const result = await safeApiCall<any>(() => api.get("/bookings"));
        if (!result.error) {
            const data = result.data as any;
            setBookings(data?.records || data || []);
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchBookings(); }, []);

    const filtered = bookings.filter(b =>
        (b.applicationNo?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (b.lead?.name?.toLowerCase() || "").includes(search.toLowerCase())
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <Text style={[styles.title, { color: theme.text }]}>Bookings Hub</Text>
            </View>

            <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="search" size={18} color={theme.textLight} />
                <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search ID or client..."
                    placeholderTextColor={theme.textLight}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : (
                <Animated.FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    style={{ opacity: fadeAnim }}
                    renderItem={({ item }) => (
                        <BookingCard
                            booking={item}
                            onPress={() => { }}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} tintColor={theme.primary} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="document-text-outline" size={60} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>No bookings found</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20, borderBottomWidth: 1 },
    title: { fontSize: 24, fontWeight: "800" },
    searchBar: { flexDirection: "row", alignItems: "center", margin: 20, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: "600" },
    list: { paddingHorizontal: 20, paddingBottom: 100 },
    card: { padding: 16, borderRadius: 24, marginBottom: 16, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    appNo: { fontSize: 16, fontWeight: "800" },
    bookingDate: { fontSize: 12, marginTop: 2, fontWeight: "600" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    statusText: { fontSize: 10, fontWeight: "800" },
    divider: { height: 1, marginBottom: 12 },
    cardBottom: { flexDirection: "row", alignItems: "center" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    priceText: { fontSize: 15, fontWeight: "800" },
    metaText: { fontSize: 14, fontWeight: "600" },
    progressTrack: { height: 6, borderRadius: 3, marginTop: 16, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: "600" }
});
