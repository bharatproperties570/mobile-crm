import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Dimensions, SafeAreaView, Alert, Linking, Animated, Modal, Pressable
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from 'react-native-gesture-handler';
import { getInventory, type Inventory } from "../services/inventory.service";
import { lookupVal, safeApiCall } from "../services/api.helpers";
import { useCallTracking } from "../context/CallTrackingContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_WIDTH = (SCREEN_WIDTH - 48) / 2;

const STATUS_COLORS: Record<string, string> = {
    'Available': '#10B981',
    'Sold': '#EF4444',
    'Reserved': '#F59E0B',
    'Blocked': '#64748B',
    'Hold': '#8B5CF6'
};

const TYPE_ICONS: Record<string, string> = {
    'Apartment': 'business',
    'Villa': 'home',
    'Plot': 'map',
    'Office': 'desktop',
    'Shop': 'cart'
};

const InventoryCard = memo(({ item, onPress, onCall, onWhatsApp, onSMS, onEmail, onMenuPress, viewMode }: {
    item: Inventory;
    onPress: () => void;
    onCall: () => void;
    onWhatsApp: () => void;
    onSMS: () => void;
    onEmail: () => void;
    onMenuPress: () => void;
    viewMode: 'list' | 'grid'
}) => {
    const status = lookupVal(item.status);
    const color = STATUS_COLORS[status] || '#64748B';
    const type = lookupVal(item.category);
    const subCat = lookupVal(item.subCategory);
    const unitType = lookupVal(item.unitType);
    const iconName = TYPE_ICONS[type] || 'cube';

    const displayType = [subCat, unitType].filter(v => v && v !== "—").join(' · ');

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
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: '#BBF7D0' }]} onPress={onEmail}>
                <Ionicons name="mail" size={22} color="#166534" />
                <Text style={[styles.swipeLabel, { color: '#166534' }]}>Email</Text>
            </TouchableOpacity>
        </View>
    );

    if (viewMode === 'grid') {
        return (
            <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.8}>
                <View style={[styles.gridMediaSlot, { backgroundColor: color + "10" }]}>
                    <Ionicons name={iconName as any} size={32} color={color} />
                    <View style={[styles.gridStatusDot, { backgroundColor: color }]} />
                    <TouchableOpacity style={styles.gridMenuTrigger} onPress={(e) => { e.stopPropagation(); onMenuPress(); }}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={color} />
                    </TouchableOpacity>
                </View>
                <View style={styles.gridInfo}>
                    <Text style={styles.gridProject} numberOfLines={1}>{item.projectName}</Text>
                    <Text style={styles.gridUnit}>{item.block} • {item.unitNumber || item.unitNo}</Text>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions} friction={2}>
            <TouchableOpacity style={styles.listCard} onPress={onPress} activeOpacity={0.8}>
                <View style={styles.listMain}>
                    <View style={styles.listHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.listUnitNumber}>{item.unitNumber || item.unitNo || "N/A"}</Text>
                            <View style={[styles.typePill, { backgroundColor: color + '10' }]}>
                                <Text style={[styles.typePillText, { color: color }]}>{displayType || "Property"}</Text>
                            </View>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: color + "10" }]}>
                            <Text style={[styles.statusPillText, { color: color }]}>{status}</Text>
                        </View>
                    </View>

                    <View style={styles.listProjectContainer}>
                        <Text numberOfLines={1}>
                            <Text style={styles.listProjectName}>{item.projectName || "N/A"}</Text>
                            <Text style={styles.listBlockName}> • {item.block || "No Block"}</Text>
                        </Text>
                    </View>

                    <View style={styles.listFooter}>
                        <View style={styles.listMetaContainer}>
                            <View style={styles.listMeta}>
                                <Ionicons name="expand" size={12} color="#94A3B8" />
                                <Text style={styles.listMetaText}>{item.size} {item.sizeUnit}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.menuTrigger} onPress={onMenuPress}>
                            <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable >
    );
});

export default function InventoryScreen() {
    const { trackCall } = useCallTracking();
    const router = useRouter();
    const [inventory, setInventory] = useState<Inventory[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    // Action Hub State
    const [selectedInv, setSelectedInv] = useState<Inventory | null>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(350)).current;

    const openHub = (item: Inventory) => {
        setSelectedInv(item);
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
            setSelectedInv(null);
        });
    };

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
            (i.unitNo || "").toLowerCase().includes(q) ||
            (i.block || "").toLowerCase().includes(q)
        );
    }, [inventory, search]);

    // Communication Handlers - Prioritize Owner for Swipe Actions
    const handleCall = (item: Inventory) => {
        const phone = item.owners?.[0]?.phones?.[0]?.phone || item.ownerPhone;
        if (!phone) {
            Alert.alert("No Contact", "No owner phone number linked.");
            return;
        }
        trackCall(phone, item._id, "Inventory", `${item.projectName} - ${item.unitNumber || item.unitNo}`);
    };

    const handleWhatsApp = (item: Inventory) => {
        const phone = item.owners?.[0]?.phones?.[0]?.phone || item.ownerPhone;
        if (!phone) return;
        const cleanPhone = phone.replace(/[^0-9]/g, "");
        Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
    };

    const handleSMS = (item: Inventory) => {
        const phone = item.owners?.[0]?.phones?.[0]?.phone || item.ownerPhone;
        if (!phone) return;
        Linking.openURL(`sms:${phone}`);
    };

    const handleEmail = (item: Inventory) => {
        const email = item.owners?.[0]?.email || (item as any).ownerEmail;
        if (!email) {
            Alert.alert("No Email", "No owner email linked.");
            return;
        }
        Linking.openURL(`mailto:${email}`);
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Inventory</Text>
                    <Text style={styles.headerSubtitle}>{filtered.length} total units available</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                    >
                        <Ionicons name={viewMode === 'list' ? "grid-outline" : "list-outline"} size={20} color="#1E293B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => router.push("/add-inventory")}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.commandBar}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput
                    style={styles.commandInput}
                    placeholder="Search Project or Unit..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch("")}>
                        <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>
            ) : (
                <FlatList
                    data={filtered}
                    key={viewMode}
                    keyExtractor={(item) => item._id}
                    numColumns={viewMode === 'grid' ? 2 : 1}
                    columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
                    renderItem={({ item }) => (
                        <InventoryCard
                            item={item}
                            viewMode={viewMode}
                            onPress={() => router.push(`/inventory-detail?id=${item._id}`)}
                            onCall={() => handleCall(item)}
                            onWhatsApp={() => handleWhatsApp(item)}
                            onSMS={() => handleSMS(item)}
                            onEmail={() => handleEmail(item)}
                            onMenuPress={() => openHub(item)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    ListHeaderComponent={renderHeader}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInventory(); }} tintColor="#2563EB" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="cube-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>{search ? "No matches found" : "Waiting for property records..."}</Text>
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
                            <Text style={styles.sheetTitle}>{selectedInv ? `Unit ${selectedInv.unitNumber || selectedInv.unitNo}` : "Unit Actions"}</Text>
                            <Text style={styles.sheetSub}>{selectedInv?.projectName || "Quick Actions"}</Text>
                        </View>

                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-inventory?id=${selectedInv?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color="#64748B" />
                                </View>
                                <Text style={styles.actionLabel}>Edit</Text>
                            </TouchableOpacity >

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/inventory-detail?id=${selectedInv?._id}`); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F0F9FF" }]}>
                                    <Ionicons name="eye" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={styles.actionLabel}>View</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-lead?refInvent=${selectedInv?._id}`); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
                                    <Ionicons name="person-add" size={24} color="#DB2777" />
                                </View>
                                <Text style={styles.actionLabel}>Add Lead</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { Alert.alert("Share", "Sharing unit details..."); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
                                    <Ionicons name="share-social" size={24} color="#16A34A" />
                                </View>
                                <Text style={styles.actionLabel}>Share</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { if (selectedInv) handleCall(selectedInv); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
                                    <Ionicons name="call" size={24} color="#3B82F6" />
                                </View>
                                <Text style={styles.actionLabel}>Call Owner</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { if (selectedInv) handleWhatsApp(selectedInv); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
                                    <Ionicons name="logo-whatsapp" size={24} color="#10B981" />
                                </View>
                                <Text style={styles.actionLabel}>WhatsApp</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                if (selectedInv) router.push(`/inventory-feedback?id=${selectedInv._id}`);
                                closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FFF7ED" }]}>
                                    <Ionicons name="chatbubble-ellipses" size={24} color="#F97316" />
                                </View>
                                <Text style={styles.actionLabel}>Feedback</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { if (selectedInv) handleSMS(selectedInv); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FFF7ED" }]}>
                                    <Ionicons name="chatbubble" size={24} color="#F97316" />
                                </View>
                                <Text style={styles.actionLabel}>SMS</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { if (selectedInv) handleEmail(selectedInv); closeHub(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#EEF2FF" }]}>
                                    <Ionicons name="mail" size={24} color="#6366F1" />
                                </View>
                                <Text style={styles.actionLabel}>Email</Text>
                            </TouchableOpacity>
                        </View >
                    </Animated.View >
                </Pressable >
            </Modal >
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    safeArea: { flex: 1, backgroundColor: "#fff" },
    headerContainer: { backgroundColor: "#F8FAFC", paddingBottom: 8 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16
    },
    headerTitle: { fontSize: 28, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 13, color: "#64748B", fontWeight: "600", marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F1F5F9", justifyContent: 'center', alignItems: 'center' },
    actionBtnPrimary: { backgroundColor: "#2563EB" },

    commandBar: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 16,
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F8FAFC",
        borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0"
    },
    commandInput: { flex: 1, marginLeft: 12, fontSize: 15, color: "#1E293B", fontWeight: "600" },

    list: { padding: 16, paddingBottom: 100 },
    gridRow: { justifyContent: 'space-between' },

    // List Card Styles
    listCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: "#fff",
        borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    listIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    listMain: { flex: 1 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    listProjectContainer: { marginBottom: 8 },
    listProjectName: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
    listBlockName: { fontSize: 10, fontWeight: "500", color: "#CBD5E1" },
    listUnitNumber: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
    typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    typePillText: { fontSize: 9, fontWeight: "800" },
    statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    statusPillText: { fontSize: 10, fontWeight: "800" },
    listUnit: { fontSize: 13, color: "#64748B", fontWeight: "600", marginBottom: 8 },
    listFooter: { flexDirection: 'row', gap: 16 },
    listMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    listPrice: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
    listMetaText: { fontSize: 12, color: "#64748B", fontWeight: "600" },

    // Grid Card Styles
    gridCard: {
        width: COLUMN_WIDTH, backgroundColor: "#fff", borderRadius: 24,
        padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    gridMediaSlot: { height: 100, borderRadius: 18, marginBottom: 12, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    gridStatusDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#fff' },
    gridInfo: { paddingHorizontal: 4 },
    gridProject: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 2 },
    gridUnit: { fontSize: 10, color: "#CBD5E1", fontWeight: "500", marginBottom: 8 },
    gridMenuTrigger: { position: 'absolute', top: 10, left: 10, padding: 4 },
    gridPrice: { fontSize: 14, fontWeight: "900", color: "#2563EB" },

    // Swipe Styles
    rightActions: { flexDirection: 'row', paddingLeft: 10 },
    leftActions: { flexDirection: 'row', paddingRight: 10 },
    swipeAction: { width: 70, justifyContent: 'center', alignItems: 'center', height: '100%' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },

    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 15, color: "#94A3B8", fontWeight: "600", textAlign: 'center' },

    // Shared Menu Styles (Aligned with Deals)
    menuTrigger: { padding: 4, marginLeft: 8 },
    cardQuickActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    quickActionBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#F8FAFC", justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: "#F1F5F9" },
    listMetaContainer: { flex: 1 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
    sheetContainer: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: 40, minHeight: 350 },
    sheetHandle: { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 },
    sheetHeader: { marginBottom: 24, alignItems: 'center' },
    sheetTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
    sheetSub: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: 'uppercase', marginTop: 4 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: 'center', gap: 12 },
    actionItem: { width: "22%", alignItems: "center", marginBottom: 16 },
    actionIcon: { width: 56, height: 56, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    actionLabel: { fontSize: 10, fontWeight: "800", color: "#475569", textAlign: "center" },
});
