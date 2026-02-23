import { useCallback, useEffect, useState, useRef, useMemo, memo } from "react";
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
    RefreshControl, ActivityIndicator, Alert, Linking, Modal, Pressable, Animated,
    SafeAreaView, Dimensions, Vibration
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

const DealCard = memo(({
    deal,
    onPress,
    onLongPress,
    onCall,
    onWhatsApp,
    onSMS,
    onMenuPress,
}: {
    deal: Deal;
    onPress: () => void;
    onLongPress: () => void;
    onCall: () => void;
    onWhatsApp: () => void;
    onSMS: () => void;
    onMenuPress: () => void;
}) => {
    const stageStr = (resolveName(deal.stage) || "open").toLowerCase();
    const color = STAGE_COLORS[stageStr] ?? "#6366F1";
    const amount = deal.price || deal.amount || 0;

    const renderRightActions = () => (
        <View style={styles.rightActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: '#3B82F6' }]} onPress={onCall}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: '#64748B' }]} onPress={onSMS}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.leftActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: '#25D366' }]} onPress={onWhatsApp}>
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: '#6366F1' }]}
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

    const dealTypeStr = resolveName(deal.intent || deal.dealType || deal.transactionType || "Sell").toUpperCase();
    const score = deal.score || (deal as any).dealScore || 0;
    let typeColor = "#64748B"; // cold (0-30)
    if (score >= 81) typeColor = "#7C3AED"; // superHot
    else if (score >= 61) typeColor = "#EF4444"; // hot
    else if (score >= 31) typeColor = "#F59E0B"; // warm

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions} friction={2}>
            <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.9}>
                <View style={[styles.cardAccent, { backgroundColor: typeColor }]} />
                <View style={styles.cardMain}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardIdentity}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.dealUnitNumber}>{deal.unitNo || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.unitNumber : "") || "N/A"}</Text>
                                <View style={[styles.typePill, { backgroundColor: color + '15' }]}>
                                    <Text style={[styles.typePillText, { color: color }]}>
                                        {[
                                            resolveName(deal.unitType || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.unitType : "")),
                                            resolveName(deal.subCategory || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.subCategory : ""))
                                        ].filter(t => t && t !== "—").join(' · ') || "Property"}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.dealProjectContainer}>
                                <Text numberOfLines={1}>
                                    <Text style={styles.dealProjectName}>{deal.projectName || "Unnamed Project"}</Text>
                                    <Text style={styles.dealBlockName}> • {deal.block || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.block : "") || "No Block"}</Text>
                                </Text>
                            </View>
                        </View>
                        <View style={styles.headerRight}>
                            <Text style={[styles.dealAmount, { color: color }]}>{formatAmount(amount)}</Text>
                            <TouchableOpacity style={styles.menuTrigger} onPress={onMenuPress}>
                                <Ionicons name="ellipsis-vertical" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.cardBody}>
                        <View style={[styles.stagePill, { backgroundColor: color + "15" }]}>
                            <View style={[styles.stageDot, { backgroundColor: color }]} />
                            <Text style={[styles.stageText, { color }]}>{resolveName(deal.stage)}</Text>
                        </View>
                        <View style={styles.clientRow}>
                            <Ionicons name="person-circle-outline" size={14} color="#64748B" />
                            <Text style={styles.clientName} numberOfLines={1}>
                                {resolveName(deal.associatedContact || (deal as any).partyStructure?.buyer || deal.owner)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.cardFooter}>
                        <View style={styles.locationGroup}>
                            <Ionicons name="location-outline" size={12} color="#94A3B8" />
                            <Text style={styles.locationText} numberOfLines={1}>
                                {deal.location || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.location : "") || deal.projectName || "Property"}
                            </Text>
                        </View>
                        {deal.createdAt && (
                            <Text style={styles.dateText}>{new Date(deal.createdAt).toLocaleDateString("en-IN")}</Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
});

export default function DealsScreen() {
    const { trackCall } = useCallTracking();
    const router = useRouter();
    const [deals, setDeals] = useState<Deal[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Action Hub State
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showStagePicker, setShowStagePicker] = useState(false);
    const [showTagEditor, setShowTagEditor] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [newTag, setNewTag] = useState("");
    const slideAnim = useRef(new Animated.Value(350)).current;

    const fetchDeals = useCallback(async (pageNum = 1, shouldAppend = false) => {
        if (!shouldAppend) setLoading(true);
        const result = await safeApiCall<any>(() => getDeals({ page: String(pageNum), limit: "50" }));

        if (result.error) {
            Alert.alert("Data Load Error", `Could not load deals:\n${result.error}`, [{ text: "Retry", onPress: () => fetchDeals(pageNum, shouldAppend) }]);
        } else if (result.data) {
            const dataObj = result.data as any;
            const newDeals = dataObj.data || dataObj.records || (Array.isArray(dataObj) ? dataObj : []);
            setDeals(prev => shouldAppend ? [...prev, ...newDeals] : newDeals);
            setHasMore(newDeals.length === 50);
            setPage(pageNum);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchDeals(1, false);
    }, [fetchDeals]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchDeals(page + 1, true);
        }
    }, [loading, hasMore, page, fetchDeals]);

    const loadUsers = async () => {
        const res = await api.get("/users?limit=50");
        setUsers(res.data?.data || []);
    };

    useFocusEffect(
        useCallback(() => {
            fetchDeals(1, false);
        }, [fetchDeals])
    );

    const filtered = useMemo(() => {
        if (!search) return deals;
        const q = search.toLowerCase();
        return deals.filter((d) => getDealTitle(d).toLowerCase().includes(q));
    }, [deals, search]);

    const handleSearch = (text: string) => {
        setSearch(text);
    };

    const renderHeader = () => (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Deals</Text>
                    <Text style={styles.headerSubtitle}>{filtered.length} active opportunities</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/add-deal")}>
                    <Ionicons name="add" size={26} color="#fff" />
                </TouchableOpacity>
            </View>

            {filtered.length > 0 && (
                <View style={styles.headerCard}>
                    <View>
                        <Text style={styles.summaryLabel}>PIPELINE VALUE</Text>
                        <Text style={styles.summaryValue}>{formatAmount(totalValue)}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryStats}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>AVG</Text>
                            <Text style={styles.statValue}>{formatAmount(totalValue / filtered.length)}</Text>
                        </View>
                    </View>
                </View>
            )}

            <View style={styles.commandBar}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput
                    style={styles.commandInput}
                    placeholder="Search Deals or Properties..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={handleSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch("")}>
                        <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );

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
            setNewTag("");
        }
    };

    const totalValue = deals.reduce((sum: number, d: Deal) => sum + (Number(d.price) || Number(d.amount) || 0), 0);

    return (
        <GestureHandlerRootView style={styles.container}>
            {loading && page === 1 ? (
                <View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    ListHeaderComponent={renderHeader}
                    renderItem={({ item }) => (
                        <DealCard
                            deal={item}
                            onPress={() => router.push(`/deal-detail?id=${item._id}`)}
                            onLongPress={() => openHub(item)}
                            onCall={() => handleCall(item)}
                            onWhatsApp={() => handleWhatsApp(item)}
                            onSMS={() => handleSMS(item)}
                            onMenuPress={() => openHub(item)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    getItemLayout={(data, index) => ({
                        length: 120,
                        offset: 120 * index,
                        index,
                    })}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
                    ListFooterComponent={loading && page > 1 ? <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} /> : null}
                    ListHeaderComponentStyle={{ marginBottom: 12 }}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="briefcase-outline" size={64} color="#E2E8F0" />
                            <Text style={styles.emptyText}>{search ? "No matches found" : "Your pipeline is empty"}</Text>
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
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-deal?id=${selectedDeal?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color="#64748B" />
                                </View>
                                <Text style={styles.actionLabel}>Edit</Text>
                            </TouchableOpacity >

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
                        </View >

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

                        {
                            showReassign && (
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
                            )
                        }
                        {
                            showTagEditor && (
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
                            )
                        }
                    </Animated.View >
                </Pressable >
            </Modal >

            <TouchableOpacity style={styles.fab} onPress={() => router.push("/add-deal")}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
        </GestureHandlerRootView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    safeArea: { backgroundColor: "#fff" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    headerTitle: { fontSize: 28, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 13, color: "#64748B", fontWeight: "600", marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#2563EB", justifyContent: 'center', alignItems: 'center' },

    headerCard: {
        marginHorizontal: 20, marginBottom: 16, backgroundColor: "#0F172A", borderRadius: 24,
        padding: 20, flexDirection: 'row', alignItems: 'center',
        shadowColor: "#2563EB", shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }
    },
    summaryLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
    summaryValue: { color: "#fff", fontSize: 24, fontWeight: "900" },
    summaryDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 20 },
    summaryStats: { flex: 1 },
    statItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statLabel: { color: "#64748B", fontSize: 9, fontWeight: "900" },
    statValue: { color: "#10B981", fontSize: 13, fontWeight: "800" },

    commandBar: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 4,
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F8FAFC",
        borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0"
    },
    commandInput: { flex: 1, marginLeft: 12, fontSize: 15, color: "#1E293B", fontWeight: "600" },

    list: { paddingBottom: 100 },

    // Modern Deal Card
    card: {
        flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12,
        borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }
    },
    cardAccent: { width: 6 },
    cardMain: { flex: 1, padding: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardIdentity: { flex: 1 },
    dealId: { fontSize: 10, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", marginBottom: 2 },
    dealProjectContainer: { marginTop: 2 },
    dealProjectName: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
    dealBlockName: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
    dealUnitNumber: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
    typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    typePillText: { fontSize: 9, fontWeight: "800" },
    dealTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    dealAmount: { fontSize: 16, fontWeight: "900" },

    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    stagePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 6 },
    stageDot: { width: 6, height: 6, borderRadius: 3 },
    stageText: { fontSize: 11, fontWeight: "800", textTransform: 'uppercase' },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginLeft: 12 },
    clientName: { fontSize: 13, color: "#64748B", fontWeight: "700" },

    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    menuTrigger: { padding: 4, marginRight: -4 },
    cardQuickActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    quickActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F8FAFC", justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: "#F1F5F9" },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
    locationGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    locationText: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
    dateText: { fontSize: 11, color: "#94A3B8", fontWeight: "700" },

    // Swipe Styles
    rightActions: { flexDirection: 'row', paddingLeft: 10 },
    leftActions: { flexDirection: 'row', paddingRight: 10 },
    swipeAction: { width: 70, justifyContent: 'center', alignItems: 'center', height: '100%' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },

    // Sheet Styles
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

    pickerView: { marginTop: 10, padding: 20, backgroundColor: "#F8FAFC", borderRadius: 20 },
    sectionTitle: { fontSize: 12, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", marginBottom: 16 },
    chipList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    actionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
    actionChipText: { fontSize: 12, fontWeight: "800", color: "#475569" },

    tagInputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
    tagInput: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: "600" },
    addTagBtn: { backgroundColor: "#2563EB", width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    tagChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#DBEAFE" },
    tagChipText: { fontSize: 12, fontWeight: "800", color: "#2563EB" },

    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 15, color: "#94A3B8", fontWeight: "700" },
    fab: {
        position: "absolute", bottom: 30, right: 20, width: 56, height: 56,
        borderRadius: 28, backgroundColor: "#2563EB", justifyContent: "center",
        alignItems: "center", elevation: 4, shadowColor: "#000",
        shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },
});
