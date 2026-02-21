import { useEffect, useState, useCallback } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";
import { safeApiCall } from "../services/api.helpers";

function LedgerCard({ item }: { item: any }) {
    const isCredit = item.type === 'Credit';
    return (
        <View style={styles.card}>
            <View style={styles.cardInfo}>
                <Text style={styles.clientName}>{item.clientName || "General Payment"}</Text>
                <Text style={styles.itemName}>{item.reference || "Transaction"}</Text>
                <Text style={styles.itemDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.amountWrap}>
                <Text style={[styles.amount, { color: isCredit ? '#10B981' : '#EF4444' }]}>
                    {isCredit ? '+' : '-'} ₹{item.amount?.toLocaleString()}
                </Text>
                <View style={[styles.badge, { backgroundColor: isCredit ? '#ECFDF5' : '#FEF2F2' }]}>
                    <Text style={[styles.badgeText, { color: isCredit ? '#10B981' : '#EF4444' }]}>
                        {item.status || "Completed"}
                    </Text>
                </View>
            </View>
        </View>
    );
}

export default function AccountsScreen() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchLedger = useCallback(async () => {
        // Mocking ledger data since there's no direct ledger endpoint yet, or fetch from bookings
        const result = await safeApiCall<any>(() => api.get("/bookings"));
        if (!result.error) {
            const data = result.data as any;
            const bookings = data?.records || data || [];
            // Transform bookings into transaction lines for the ledger
            const lines = bookings.flatMap((b: any) => [
                { _id: b._id + '_token', clientName: b.lead?.name, reference: b.applicationNo, date: b.bookingDate, amount: b.tokenAmount, type: 'Credit', status: 'Token' },
                b.agreementAmount ? { _id: b._id + '_aggr', clientName: b.lead?.name, reference: b.applicationNo, date: b.agreementDate, amount: b.agreementAmount, type: 'Credit', status: 'Agreement' } : null
            ]).filter(Boolean);
            setTransactions(lines);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchLedger(); }, []);

    const totalIn = transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Accounts Ledger</Text>
                <View style={styles.summaryCard}>
                    <View>
                        <Text style={styles.sumLabel}>Total Collected</Text>
                        <Text style={styles.sumValue}>₹{totalIn.toLocaleString()}</Text>
                    </View>
                    <Ionicons name="wallet-outline" size={32} color="#fff" />
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={transactions}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => <LedgerCard item={item} />}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLedger(); }} tintColor="#10B981" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="receipt-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No financial records found</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { padding: 20, paddingTop: 56, backgroundColor: "#fff" },
    title: { fontSize: 22, fontWeight: "800", color: "#1E293B", marginBottom: 20 },
    summaryCard: {
        backgroundColor: "#10B981", borderRadius: 20, padding: 20,
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        shadowColor: "#10B981", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    sumLabel: { color: "#D1FAE5", fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
    sumValue: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 4 },
    list: { padding: 16, paddingBottom: 100 },
    card: {
        backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12,
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        borderWidth: 1, borderColor: "#F1F5F9"
    },
    cardInfo: { flex: 1 },
    clientName: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
    itemName: { fontSize: 12, color: "#94A3B8", marginTop: 2, fontWeight: "700" },
    itemDate: { fontSize: 11, color: "#CBD5E1", marginTop: 4, fontWeight: "600" },
    amountWrap: { alignItems: "flex-end" },
    amount: { fontSize: 16, fontWeight: "800" },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6 },
    badgeText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: "#94A3B8", fontWeight: "600" }
});
