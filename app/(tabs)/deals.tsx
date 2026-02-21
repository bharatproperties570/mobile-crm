import { useEffect, useState, useCallback, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
    RefreshControl, ActivityIndicator, Alert, Linking, Modal, Pressable, Animated
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { getDeals, type Deal, updateDeal } from "../services/deals.service";
import { safeApiCall, safeApiCallSingle } from "../services/api.helpers";
import api from "../services/api";
import { useCallTracking } from "../context/CallTrackingContext";

const STAGE_COLORS: Record<string, string> = {
    open: "#6366F1",
    quote: "#8B5CF6",
    negotiation: "#F59E0B",
    booked: "#F97316",
    closed: "#10B981",
    cancelled: "#EF4444",
};

function resolveName(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "object" && field !== null) {
        const obj = field as any;
        if (obj.lookup_value) return obj.lookup_value;
        if (obj.fullName) return obj.fullName;
        if (obj.name) return obj.name;
        if (obj.firstName) return [obj.firstName, obj.lastName].filter(Boolean).join(" ");
    }
    return String(field);
}

function getDealTitle(deal: Deal): string {
    const inv = typeof deal.inventoryId === 'object' ? deal.inventoryId : null;
    const project = deal.projectName || inv?.projectName || "Property";
    const block = deal.block || inv?.block;
    const unit = deal.unitNo || inv?.unitNumber;

    let titleParts = [project];
    if (block) titleParts.push(block);
    if (unit) titleParts.push(unit);

    return titleParts.join(" - ") || deal.dealId || deal.name || deal.title || "Untitled Deal";
}

function formatAmount(amount?: number): string {
    if (!amount || amount === 0) return "—";
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    return `₹${amount.toLocaleString("en-IN")}`;
}

function DealCard({
    deal,
    onPress,
    onLongPress,
    onCall,
    onWhatsApp,
    onSMS,
    onActivity
}: {
    deal: Deal;
    onPress: () => void;
    onLongPress: () => void;
    onCall: () => void;
    onWhatsApp: () => void;
    onSMS: () => void;
    onActivity: () => void;
}) {
    const stageStr = (resolveName(deal.stage) || "open").toLowerCase();
    const color = STAGE_COLORS[stageStr] ?? "#6366F1";
    const amount = deal.price || deal.amount || 0;

    const renderRightActions = () => (
        <View style={styles.rightActions}>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: '#3B82F6' }]}
                onPress={onCall}
            >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: '#64748B' }]}
                onPress={onSMS}
            >
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.leftActions}>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: '#25D366' }]}
                onPress={onWhatsApp}
            >
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: '#4F46E5' }]}
                onPress={() => {
                    const contact = deal.associatedContact as any;
                    if (contact?.email) Linking.openURL(`mailto:${contact.email}`);
                }}
            >
                <Ionicons name="mail" size={22} color="#fff" />
                <Text style={styles.swipeLabel}>Email</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Swipeable
            renderRightActions={renderRightActions}
            renderLeftActions={renderLeftActions}
            friction={2}
            rightThreshold={40}
            leftThreshold={40}
        >
            <TouchableOpacity
                style={styles.card}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.85}
            >
                <View style={[styles.cardAccent, { backgroundColor: color }]} />
                <View style={styles.cardContent}>
                    <View style={styles.cardTop}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.headerTitleRow}>
                                <Text style={styles.dealIdText}>{deal.dealId || `DEAL-${deal._id.slice(-6).toUpperCase()}`}</Text>
                                <TouchableOpacity onPress={onLongPress} style={styles.moreBtn}>
                                    <Ionicons name="ellipsis-vertical" size={20} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.cardTitle} numberOfLines={1}>{getDealTitle(deal)}</Text>
                        </View>
                        <Text style={[styles.amount, { color }]}>{formatAmount(amount)}</Text>
                    </View>

                    <View style={styles.cardMeta}>
                        <View style={[styles.stageBadge, { backgroundColor: color + "18" }]}>
                            <Text style={[styles.stageText, { color }]}>{resolveName(deal.stage)}</Text>
                        </View>
                        <Text style={styles.metaText} numberOfLines={1}>
                            👤 Client: {resolveName(deal.associatedContact || (deal as any).partyStructure?.buyer || deal.owner)}
                            {deal.assignedTo ? ` • RM: ${resolveName(deal.assignedTo)}` : ""}
                        </Text>
                    </View>

                    <View style={styles.cardBottom}>
                        <Text style={styles.locationText}>
                            📍 {deal.location || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.location : "") || deal.projectName || "Property"}
                        </Text>
                        {deal.date || deal.createdAt ? (
                            <Text style={styles.dateText}>📅 {new Date(deal.date || deal.createdAt!).toLocaleDateString("en-IN")}</Text>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
}

export default function DealsScreen() {
    const { trackCall } = useCallTracking();
    const router = useRouter();
    const [deals, setDeals] = useState<Deal[]>([]);
    const [filtered, setFiltered] = useState<Deal[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Action Hub State
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showStagePicker, setShowStagePicker] = useState(false);
    const [showTagEditor, setShowTagEditor] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [newTag, setNewTag] = useState("");
    const slideAnim = useRef(new Animated.Value(300)).current;

    const fetchDeals = useCallback(async () => {
        const result = await safeApiCall<Deal>(() => getDeals());
        if (result.error) {
            Alert.alert("Data Load Error", `Could not load deals:\n${result.error}`, [{ text: "Retry", onPress: fetchDeals }]);
        } else {
            setDeals(result.data);
            setFiltered(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    const loadUsers = async () => {
        const res = await api.get("/users?limit=50");
        setUsers(res.data?.data || []);
    };

    useFocusEffect(
        useCallback(() => {
            fetchDeals();
        }, [fetchDeals])
    );

    const handleSearch = (text: string) => {
        setSearch(text);
        const q = text.toLowerCase();
        setFiltered(deals.filter((d) => getDealTitle(d).toLowerCase().includes(q)));
    };

    const openHub = (deal: Deal) => {
        setSelectedDeal(deal);
        setHubVisible(true);
        setShowReassign(false);
        setShowStagePicker(false);
        setShowTagEditor(false);
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
            setSelectedDeal(null);
        });
    };

    // Communication Handlers
    const handleCall = (deal: Deal) => {
        const phone = (deal.associatedContact as any)?.phone || (deal.owner as any)?.phone || (deal.contact as any)?.phone;
        if (!phone) {
            Alert.alert("Error", "No phone number linked to this deal.");
            return;
        }
        trackCall(phone, deal._id, "Deal", getDealTitle(deal));
    };

    const handleWhatsApp = (deal: Deal) => {
        const phone = (deal.associatedContact as any)?.phone || (deal.owner as any)?.phone || (deal.contact as any)?.phone;
        if (!phone) return;
        const cleanPhone = phone.replace(/[^0-9]/g, "");
        Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
    };

    const handleSMS = (deal: Deal) => {
        const phone = (deal.associatedContact as any)?.phone || (deal.owner as any)?.phone || (deal.contact as any)?.phone;
        if (!phone) return;
        Linking.openURL(`sms:${phone}`);
    };

    // Action Grid Handlers
    const handleReassign = async (userId: string) => {
        if (!selectedDeal) return;
        const res = await safeApiCall(() => updateDeal(selectedDeal._id, { assignedTo: userId }));
        if (!res.error) {
            fetchDeals();
            closeHub();
            Alert.alert("Success", "Deal reassigned successfully");
        }
    };

    const handleStageUpdate = async (stage: string) => {
        if (!selectedDeal) return;
        const res = await safeApiCall(() => updateDeal(selectedDeal._id, { stage }));
        if (!res.error) {
            fetchDeals();
            closeHub();
            Alert.alert("Success", `Stage updated to ${stage}`);
        }
    };

    const handleQuickDormant = async () => {
        if (!selectedDeal) return;
        const res = await safeApiCall(() => updateDeal(selectedDeal._id, { status: "Dormant" }));
        if (!res.error) {
            fetchDeals();
            closeHub();
            Alert.alert("Success", "Deal marked as Dormant");
        }
    };

    const handleRemoveTag = async (tag: string) => {
        if (!selectedDeal) return;
        const tags = (selectedDeal.tags || []).filter((t: string) => t !== tag);
        const res = await safeApiCall(() => updateDeal(selectedDeal._id, { tags }));
        if (!res.error) {
            const updated = { ...selectedDeal, tags };
            setSelectedDeal(updated);
            setDeals(deals.map(d => d._id === selectedDeal._id ? updated : d));
            setFiltered(filtered.map(d => d._id === selectedDeal._id ? updated : d));
        }
    };

    const handleAddTag = async () => {
        if (!selectedDeal || !newTag.trim()) return;
        const tags = [...(selectedDeal.tags || []), newTag.trim()];
        const res = await safeApiCall(() => updateDeal(selectedDeal._id, { tags }));
        if (!res.error) {
            const updated = { ...selectedDeal, tags };
            setSelectedDeal(updated);
            setDeals(deals.map(d => d._id === selectedDeal._id ? updated : d));
            setFiltered(filtered.map(d => d._id === selectedDeal._id ? updated : d));
            setNewTag("");
        }
    };

    const totalValue = filtered.reduce((sum, d) => sum + (d.price || d.amount || 0), 0);

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Deals</Text>
                <Text style={styles.headerCount}>{filtered.length} deals</Text>
            </View>

            {!loading && filtered.length > 0 && (
                <View style={styles.totalBanner}>
                    <Text style={styles.totalLabel}>Pipeline Value</Text>
                    <Text style={styles.totalValue}>{formatAmount(totalValue)}</Text>
                </View>
            )}

            <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search deals..."
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
                    renderItem={({ item }) => (
                        <DealCard
                            deal={item}
                            onPress={() => router.push(`/deal-detail?id=${item._id}`)}
                            onLongPress={() => openHub(item)}
                            onCall={() => handleCall(item)}
                            onWhatsApp={() => handleWhatsApp(item)}
                            onSMS={() => handleSMS(item)}
                            onActivity={() => router.push(`/add-activity?id=${item._id}&type=Deal`)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDeals(); }} tintColor="#1E40AF" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>🤝</Text>
                            <Text style={styles.emptyText}>{search ? "No results found" : "No deals yet"}</Text>
                        </View>
                    }
                />
            )}

            {/* Action Hub Modal */}
            <Modal transparent visible={hubVisible} animationType="none" onRequestClose={closeHub}>
                <Pressable style={styles.modalOverlay} onPress={closeHub}>
                    <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{selectedDeal ? getDealTitle(selectedDeal) : "Deal Actions"}</Text>
                            <Text style={styles.sheetSub}>{selectedDeal?.dealId || "Quick Actions"}</Text>
                        </View>

                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-deal?id=${selectedDeal?._id}`); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color="#64748B" />
                                </View>
                                <Text style={styles.actionLabel}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/match-lead?dealId=${selectedDeal?._id}`); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
                                    <Ionicons name="git-compare" size={24} color="#DB2777" />
                                </View>
                                <Text style={styles.actionLabel}>Match</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/documents?dealId=${selectedDeal?._id}`); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F0F9FF" }]}>
                                    <Ionicons name="document-attach" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={styles.actionLabel}>Doc</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-booking?dealId=${selectedDeal?._id}`); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FEF2F2" }]}>
                                    <Ionicons name="calendar" size={24} color="#DC2626" />
                                </View>
                                <Text style={styles.actionLabel}>Book</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { Alert.alert("Upload", "Securely upload documents for this deal."); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
                                    <Ionicons name="cloud-upload" size={24} color="#16A34A" />
                                </View>
                                <Text style={styles.actionLabel}>Upload</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-activity?id=${selectedDeal?._id}&type=Deal`); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FFF7ED" }]}>
                                    <Ionicons name="add-circle" size={24} color="#EA580C" />
                                </View>
                                <Text style={styles.actionLabel}>Activity</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { setShowStagePicker(!showStagePicker); setShowReassign(false); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
                                    <Ionicons name="git-network" size={24} color="#DB2777" />
                                </View>
                                <Text style={styles.actionLabel}>Stage</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { setShowReassign(!showReassign); setShowStagePicker(false); loadUsers(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                    <Ionicons name="person-add" size={24} color="#7C3AED" />
                                </View>
                                <Text style={styles.actionLabel}>Assign</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { setShowTagEditor(!showTagEditor); setShowStagePicker(false); setShowReassign(false); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#EEF2FF" }]}>
                                    <Ionicons name="pricetags" size={24} color="#4F46E5" />
                                </View>
                                <Text style={styles.actionLabel}>Tag</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={handleQuickDormant}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="moon" size={24} color="#94A3B8" />
                                </View>
                                <Text style={styles.actionLabel}>Dormant</Text>
                            </TouchableOpacity>
                        </View>

                        {showStagePicker && (
                            <View style={styles.pickerView}>
                                <Text style={styles.sectionTitle}>Change Stage</Text>
                                <View style={styles.chipList}>
                                    {Object.keys(STAGE_COLORS).map((s) => (
                                        <TouchableOpacity
                                            key={s}
                                            style={[styles.actionChip, { borderColor: STAGE_COLORS[s] }]}
                                            onPress={() => handleStageUpdate(s)}
                                        >
                                            <Text style={[styles.actionChipText, { color: STAGE_COLORS[s] }]}>{s.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {showReassign && (
                            <View style={styles.pickerView}>
                                <Text style={styles.sectionTitle}>Reassign Deal</Text>
                                <View style={styles.chipList}>
                                    {users.map((u) => (
                                        <TouchableOpacity
                                            key={u._id}
                                            style={styles.actionChip}
                                            onPress={() => handleReassign(u._id)}
                                        >
                                            <Text style={styles.actionChipText}>{u.fullName || u.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                        {showTagEditor && (
                            <View style={styles.pickerView}>
                                <Text style={styles.sectionTitle}>Manage Tags</Text>
                                <View style={styles.tagInputRow}>
                                    <TextInput
                                        style={styles.tagInput}
                                        placeholder="Add new tag..."
                                        value={newTag}
                                        onChangeText={setNewTag}
                                        onSubmitEditing={handleAddTag}
                                    />
                                    <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                                        <Ionicons name="add" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.chipList}>
                                    {(selectedDeal?.tags || []).map((t: string, idx: number) => (
                                        <View key={idx} style={styles.tagChip}>
                                            <Text style={styles.tagChipText}>{t}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                                                <Ionicons name="close-circle" size={14} color="#94A3B8" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </Animated.View>
                </Pressable>
            </Modal>

            <TouchableOpacity style={styles.fab} onPress={() => router.push("/add-deal")}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
    headerTitle: { fontSize: 26, fontWeight: "800", color: "#1E293B" },
    headerCount: { fontSize: 13, color: "#64748B", fontWeight: "600" },
    totalBanner: {
        marginHorizontal: 20, marginBottom: 12, backgroundColor: "#1E293B",
        borderRadius: 14, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    },
    totalLabel: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
    totalValue: { color: "#fff", fontSize: 20, fontWeight: "800" },
    searchBox: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 14,
        backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    searchInput: { flex: 1, fontSize: 14, color: "#1E293B", marginLeft: 8 },
    list: { paddingHorizontal: 12, paddingBottom: 100 },
    card: {
        backgroundColor: "#fff", borderRadius: 16, marginBottom: 12, flexDirection: "row", overflow: "hidden",
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    cardAccent: { width: 4 },
    cardContent: { flex: 1, padding: 16 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flex: 1 },
    dealIdText: { fontSize: 10, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase", marginBottom: 2 },
    cardTitle: { fontSize: 15, fontWeight: "700", color: "#334155", flex: 1, marginRight: 8 },
    amount: { fontSize: 16, fontWeight: "800" },
    moreBtn: { padding: 4, marginRight: -8 },
    cardMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    stageBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    stageText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
    metaText: { fontSize: 12, color: "#64748B", flex: 1 },
    cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 10 },
    locationText: { fontSize: 11, color: "#94A3B8", flex: 1, marginRight: 10 },
    dateText: { fontSize: 11, color: "#94A3B8" },
    empty: { alignItems: "center", marginTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 16, color: "#94A3B8", fontWeight: "600" },

    // Swipe Styles
    rightActions: { flexDirection: 'row', width: 140 },
    leftActions: { flexDirection: 'row', width: 150 },
    swipeAction: { width: 75, justifyContent: 'center', alignItems: 'center', height: '100%' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },

    // Sheet Styles
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheetContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, minHeight: 300 },
    sheetHandle: { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 },
    sheetHeader: { marginBottom: 24 },
    sheetTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    sheetSub: { fontSize: 14, color: "#64748B", fontWeight: "600", marginTop: 2 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 12 },
    actionItem: { width: "22%", alignItems: "center", marginBottom: 16 },
    actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", marginBottom: 6 },
    actionLabel: { fontSize: 11, fontWeight: "700", color: "#475569", textAlign: "center" },
    pickerView: { marginTop: 10, paddingBottom: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 20 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase", marginBottom: 12 },
    chipList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    actionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
    actionChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
    tagInputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    tagInput: { flex: 1, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 8, fontSize: 14 },
    addTagBtn: { backgroundColor: "#1E3A8A", width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
    tagChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#E0E7FF" },
    tagChipText: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },
    fab: {
        position: "absolute", bottom: 30, right: 20, width: 56, height: 56,
        borderRadius: 28, backgroundColor: "#1E3A8A", justifyContent: "center",
        alignItems: "center", elevation: 4, shadowColor: "#000",
        shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },
});
