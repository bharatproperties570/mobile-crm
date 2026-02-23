import { useEffect, useState, useCallback, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, ActivityIndicator, Animated, Modal, Pressable, Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { safeApiCall } from "../services/api.helpers";

function LedgerCard({ item, onMenuPress }: { item: any; onMenuPress: () => void }) {
    const { theme } = useTheme();
    const isCredit = item.type === 'Credit';
    return (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardInfo}>
                <Text style={[styles.clientName, { color: theme.text }]}>{item.clientName || "General Payment"}</Text>
                <Text style={[styles.itemName, { color: theme.textLight }]}>{item.reference || "Transaction"}</Text>
                <Text style={[styles.itemDate, { color: theme.border }]}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.cardRight}>
                <View style={styles.amountWrap}>
                    <Text style={[styles.amount, { color: isCredit ? '#10B981' : '#EF4444' }]}>
                        {isCredit ? '+' : '-'} ₹{item.amount?.toLocaleString("en-IN")}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: isCredit ? '#10B98115' : '#EF444415' }]}>
                        <Text style={[styles.badgeText, { color: isCredit ? '#10B981' : '#EF4444' }]}>
                            {item.status?.toUpperCase() || "COMPLETED"}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.menuTrigger} onPress={onMenuPress}>
                    <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function AccountsScreen() {
    const { theme } = useTheme();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Action Hub State
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(350)).current;

    const openHub = (item: any) => {
        setSelectedItem(item);
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
            setSelectedItem(null);
        });
    };

    const fetchLedger = useCallback(async () => {
        const result = await safeApiCall<any>(() => api.get("/bookings"));
        if (!result.error) {
            const data = result.data as any;
            const bookings = data?.records || data || [];
            const lines = bookings.flatMap((b: any) => [
                { _id: b._id + '_token', clientName: b.lead?.name, reference: b.applicationNo, date: b.bookingDate, amount: b.tokenAmount, type: 'Credit', status: 'Token' },
                b.agreementAmount ? { _id: b._id + '_aggr', clientName: b.lead?.name, reference: b.applicationNo, date: b.agreementDate, amount: b.agreementAmount, type: 'Credit', status: 'Agreement' } : null
            ]).filter(Boolean);
            setTransactions(lines);
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchLedger(); }, []);

    const totalIn = transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card }]}>
                <Text style={[styles.title, { color: theme.text }]}>Accounts Ledger</Text>
                <View style={[styles.summaryCard, { backgroundColor: theme.primary }]}>
                    <View>
                        <Text style={styles.sumLabel}>Total Collected</Text>
                        <Text style={styles.sumValue}>₹{totalIn.toLocaleString("en-IN")}</Text>
                    </View>
                    <Ionicons name="wallet-outline" size={32} color="#fff" />
                    <View style={styles.glowEffect} />
                </View>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : (
                <Animated.FlatList
                    data={transactions}
                    keyExtractor={(item) => item._id}
                    style={{ opacity: fadeAnim }}
                    renderItem={({ item }) => (
                        <LedgerCard
                            item={item}
                            onMenuPress={() => openHub(item)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLedger(); }} tintColor={theme.primary} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="receipt-outline" size={60} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>No financial records found</Text>
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
                            <Text style={actionHubStyles.sheetTitle}>Payment Actions</Text>
                            <Text style={actionHubStyles.sheetSub}>{selectedItem?.clientName || "General Transaction"}</Text>
                        </View>

                        <View style={actionHubStyles.actionGrid}>
                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Receipt", "Generating receipt PDF..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="document-text" size={24} color="#64748B" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>View Receipt</Text>
                            </TouchableOpacity >

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Share", "Sharing payment confirmation..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
                                    <Ionicons name="share-social" size={24} color="#3B82F6" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Share</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Activity", "Recording payment follow-up..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#F0F9FF" }]}>
                                    <Ionicons name="add-circle" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Activity</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Edit", "Redirecting to entry correction..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
                                    <Ionicons name="create" size={24} color="#DB2777" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Edit</Text>
                            </TouchableOpacity>
                        </View >
                    </Animated.View >
                </Pressable >
            </Modal >
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, paddingTop: 56, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
    title: { fontSize: 24, fontWeight: "800", marginBottom: 20 },
    summaryCard: { borderRadius: 24, padding: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center", position: 'relative', overflow: 'hidden' },
    sumLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
    sumValue: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 4 },
    glowEffect: { position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.1)' },
    list: { padding: 20, paddingBottom: 100 },
    card: { borderRadius: 20, padding: 18, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
    cardInfo: { flex: 1 },
    clientName: { fontSize: 16, fontWeight: "800" },
    itemName: { fontSize: 13, marginTop: 4, fontWeight: "700" },
    itemDate: { fontSize: 11, marginTop: 6, fontWeight: "600" },
    amountWrap: { alignItems: "flex-end" },
    amount: { fontSize: 18, fontWeight: "800" },
    badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 8 },
    badgeText: { fontSize: 10, fontWeight: "800" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: "600" },
    cardRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
