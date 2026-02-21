import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Alert, Linking,
    Modal, Animated, Dimensions, Pressable
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { getLeads, leadName, updateLead, deleteLead, type Lead } from "../services/leads.service";
import { getLookups, type Lookup } from "../services/lookups.service";
import { safeApiCall, lookupVal } from "../services/api.helpers";
import api from "../services/api";
import { useCallTracking } from "../context/CallTrackingContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const STATUS_COLORS: Record<string, string> = {
    active: "#10B981", new: "#3B82F6", contacted: "#8B5CF6",
    qualified: "#10B981", proposal: "#F59E0B", negotiation: "#EF4444",
    won: "#059669", lost: "#6B7280", closed: "#6B7280",
    hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6",
};

const REQ_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    buy: { icon: "cart", color: "#6366F1", label: "BUY" },
    rent: { icon: "key", color: "#F59E0B", label: "RENT" },
    lease: { icon: "business", color: "#8B5CF6", label: "LEASE" },
    default: { icon: "home", color: "#94A3B8", label: "REQ" }
};

function formatTimeAgo(dateString?: string) {
    if (!dateString) return "—";
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function ActionSheet({ visible, onClose, lead, onUpdate }: {
    visible: boolean;
    onClose: () => void;
    lead: Lead | null;
    onUpdate: () => void;
}) {
    const router = useRouter();
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [statuses, setStatuses] = useState<Lookup[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showTagEditor, setShowTagEditor] = useState(false);
    const [newTag, setNewTag] = useState("");

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 10
            }).start();
            loadStatuses();
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true
            }).start();
        }
    }, [visible]);

    const loadStatuses = async () => {
        const res = await safeApiCall<Lookup>(() => getLookups("Status"));
        if (!res.error) setStatuses(res.data);
    };

    const loadUsers = async () => {
        if (users.length > 0) return;
        try {
            const res = await api.get("/users");
            const userList = res.data?.records ?? res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
            setUsers(Array.isArray(userList) ? userList : []);
        } catch (e) { console.error("Failed to load users", e); }
    };

    const handleUpdateStatus = async (statusId: string) => {
        if (!lead) return;
        const res = await safeApiCall(() => updateLead(lead._id, { status: statusId }));
        if (!res.error) {
            onUpdate();
            onClose();
        } else {
            Alert.alert("Error", "Failed to update status");
        }
    };

    const handleQuickDormant = async () => {
        if (!lead) return;
        const dormantStatus = statuses.find(s => s.lookup_value.toLowerCase() === "dormant");
        if (!dormantStatus) {
            Alert.alert("Error", "Dormant status lookup not found.");
            return;
        }
        await handleUpdateStatus(dormantStatus._id);
    };

    const handleReassign = async (userId: string) => {
        if (!lead) return;
        const res = await safeApiCall(() => updateLead(lead._id, { owner: userId }));
        if (!res.error) {
            onUpdate();
            onClose();
        } else {
            Alert.alert("Error", "Failed to reassign lead");
        }
    };

    const handleAddTag = async () => {
        if (!lead || !newTag.trim()) return;
        const updatedTags = [...(lead.tags || []), newTag.trim()];
        const res = await safeApiCall(() => updateLead(lead._id, { tags: updatedTags }));
        if (!res.error) {
            setNewTag("");
            onUpdate();
        }
    };

    const handleRemoveTag = async (tag: string) => {
        if (!lead) return;
        const updatedTags = (lead.tags || []).filter((t: string) => t !== tag);
        const res = await safeApiCall(() => updateLead(lead._id, { tags: updatedTags }));
        if (!res.error) {
            onUpdate();
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Lead",
            "Are you sure you want to delete this lead?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!lead) return;
                        const res = await safeApiCall(() => deleteLead(lead._id));
                        if (!res.error) {
                            onUpdate();
                            onClose();
                        }
                    }
                }
            ]
        );
    };

    const handleEmail = () => {
        if (!lead?.email) {
            Alert.alert("Error", "No email address found for this lead.");
            return;
        }
        Linking.openURL(`mailto:${lead.email}`);
    };

    const handleSMS = () => {
        if (!lead?.mobile) return;
        Linking.openURL(`sms:${lead.mobile}`);
    };

    const handleWhatsApp = () => {
        if (!lead?.mobile) return;
        const cleanPhone = (lead.mobile || "").replace(/[^0-9]/g, "");
        Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
    };

    if (!lead) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.sheetContainer,
                        { transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <View style={styles.sheetHandle} />

                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle}>{leadName(lead)}</Text>
                        <Text style={styles.sheetSub}>{lead.mobile}</Text>
                    </View>

                    <View style={styles.actionGrid}>
                        <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-lead?id=${lead._id}`); onClose(); }}>
                            <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                <Ionicons name="create" size={24} color="#64748B" />
                            </View>
                            <Text style={styles.actionLabel}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/match-lead?id=${lead._id}`); onClose(); }}>
                            <View style={[styles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
                                <Ionicons name="git-compare" size={24} color="#DB2777" />
                            </View>
                            <Text style={styles.actionLabel}>Match</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/documents?id=${lead._id}`); onClose(); }}>
                            <View style={[styles.actionIcon, { backgroundColor: "#F0F9FF" }]}>
                                <Ionicons name="document-attach" size={24} color="#0EA5E9" />
                            </View>
                            <Text style={styles.actionLabel}>Doc</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/sequences?id=${lead._id}`); onClose(); }}>
                            <View style={[styles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                <Ionicons name="repeat" size={24} color="#8B5CF6" />
                            </View>
                            <Text style={styles.actionLabel}>Seq</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-activity?id=${lead._id}`); onClose(); }}>
                            <View style={[styles.actionIcon, { backgroundColor: "#FFF7ED" }]}>
                                <Ionicons name="add-circle" size={24} color="#EA580C" />
                            </View>
                            <Text style={styles.actionLabel}>Activity</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={() => { setShowReassign(!showReassign); setShowStatusPicker(false); setShowTagEditor(false); loadUsers(); }}>
                            <View style={[styles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                <Ionicons name="person-add" size={24} color="#7C3AED" />
                            </View>
                            <Text style={styles.actionLabel}>Assign</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={() => { setShowTagEditor(!showTagEditor); setShowStatusPicker(false); setShowReassign(false); }}>
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

                    {showReassign && (
                        <View style={styles.pickerView}>
                            <Text style={styles.sectionTitle}>Reassign To</Text>
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
                                {(lead.tags || []).map((t: string, idx: number) => (
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

                    <View style={styles.dangerZone}>
                        <TouchableOpacity style={styles.dangerBtn} onPress={handleDelete}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            <Text style={styles.dangerBtnText}>Delete Lead</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

function LeadCard({ lead, onPress, onMore }: { lead: Lead; onPress: () => void; onMore: () => void }) {
    const { trackCall } = useCallTracking();
    const name = leadName(lead);
    const initials = name.replace(/[^A-Za-z ]/g, "").split(" ").map(w => w[0] ?? "").join("").substring(0, 2).toUpperCase() || "?";
    const statusLabel = lookupVal(lead.status);
    const color = STATUS_COLORS[statusLabel.toLowerCase()] ?? "#6366F1";

    const budgetText = lead.budgetMin || lead.budgetMax
        ? `₹${lead.budgetMin || 0} - ${lead.budgetMax || "Any"}`
        : lookupVal(lead.budget);

    const projects = Array.isArray(lead.projectName) && lead.projectName.length > 0
        ? lead.projectName.join(", ")
        : (lead as any).project ? lookupVal((lead as any).project) : null;

    const requirementRaw = lookupVal(lead.requirement).toLowerCase();
    const reqKey = REQ_CONFIG[requirementRaw] ? requirementRaw : "default";
    const req = REQ_CONFIG[reqKey];

    const subReq = lookupVal(lead.subRequirement);
    const subTyp = lookupVal(lead.subType);
    const subCatLabel = subReq !== "—" ? subReq : subTyp;

    const unitTypeLabel = lookupVal(lead.unitType);

    const renderRightActions = () => (
        <View style={styles.rightActions}>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: "#2563EB" }]}
                onPress={() => trackCall(lead.mobile, lead._id, "Lead", name)}
            >
                <Ionicons name="call" size={22} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: "#D97706" }]}
                onPress={() => Linking.openURL(`sms:${lead.mobile}`)}
            >
                <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.leftActions}>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: "#059669" }]}
                onPress={() => {
                    const cleanPhone = (lead.mobile || "").replace(/[^0-9]/g, "");
                    Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
                }}
            >
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: "#4F46E5" }]}
                onPress={() => lead.email && Linking.openURL(`mailto:${lead.email}`)}
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
            <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
                <View style={[styles.sticker, { backgroundColor: req.color }]}>
                    <Ionicons name={req.icon} size={10} color="#fff" />
                    <Text style={styles.stickerText}>{req.label}</Text>
                </View>

                <View style={[styles.avatar, { backgroundColor: color + "15" }]}>
                    <Text style={[styles.avatarText, { color }]}>{initials}</Text>
                </View>
                <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
                            {lead.mobile && (
                                <Text style={styles.headerPhone}> • {lead.mobile}</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={onMore} style={styles.moreBtn}>
                            <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.cardRow, { marginTop: 0 }]}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            {subCatLabel !== "—" && (
                                <Text style={styles.subCatText}>{subCatLabel}</Text>
                            )}
                            {unitTypeLabel !== "—" && (
                                <Text style={styles.unitTypeText}>
                                    {subCatLabel !== "—" ? " • " : ""}{unitTypeLabel}
                                </Text>
                            )}
                        </View>
                        <View style={[styles.badge, { backgroundColor: color + "15" }]}>
                            <Text style={[styles.badgeText, { color }]}>{statusLabel}</Text>
                        </View>
                    </View>

                    {budgetText !== "—" && (
                        <Text style={styles.budgetText}><Ionicons name="wallet-outline" size={12} /> {budgetText}</Text>
                    )}

                    <View style={[styles.cardRow, { marginTop: 4, alignItems: 'center' }]}>
                        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                            {lead.locCity ? (
                                <Text style={styles.metaText}>📍 {lead.locCity}</Text>
                            ) : projects ? (
                                <Text style={styles.metaText} numberOfLines={1}>🏢 {projects}</Text>
                            ) : null}
                        </View>
                        <Text style={styles.timeLabel}>{formatTimeAgo(lead.createdAt)}</Text>
                    </View>

                    {projects && !lead.locCity ? null : projects && (
                        <Text style={[styles.cardSub, { marginTop: 4 }]} numberOfLines={1}>🏢 {projects}</Text>
                    )}
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
}

export default function LeadsScreen() {
    const router = useRouter();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);

    const fetchLeads = useCallback(async () => {
        const result = await safeApiCall<Lead>(() => getLeads());
        if (!result.error) {
            setLeads(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchLeads();
        }, [fetchLeads])
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return leads.filter((l) => {
            const name = leadName(l).toLowerCase();
            const mobile = (l.mobile ?? "").toLowerCase();
            const req = lookupVal(l.requirement).toLowerCase();
            const loc = (l.locCity || lookupVal(l.location)).toLowerCase();
            return name.includes(q) || mobile.includes(q) || req.includes(q) || loc.includes(q);
        });
    }, [leads, search]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Leads</Text>
                <Text style={styles.headerCount}>{filtered.length} records</Text>
            </View>

            <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search leads..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator color="#1E3A8A" size="large" style={{ marginTop: 60 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <LeadCard
                            lead={item}
                            onPress={() => router.push(`/lead-detail?id=${item._id}`)}
                            onMore={() => {
                                setSelectedLead(item);
                                setSheetVisible(true);
                            }}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={< RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(); }} tintColor="#1E3A8A" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="people-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>{search ? "No results found" : "No leads yet"}</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity style={styles.fab} onPress={() => router.push("/add-lead")}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            <ActionSheet
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                lead={selectedLead}
                onUpdate={fetchLeads}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
    headerTitle: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
    headerCount: { fontSize: 12, color: "#64748B", fontWeight: "600" },
    searchBox: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12,
        backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: "#E2E8F0",
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#1E293B" },
    list: { paddingHorizontal: 12, paddingBottom: 100 },
    card: {
        backgroundColor: "#fff", padding: 12,
        flexDirection: "row", alignItems: "center",
        borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
        overflow: 'hidden',
    },
    rightActions: { flexDirection: 'row', width: 140 },
    leftActions: { flexDirection: 'row', width: 210 },
    swipeAction: {
        width: 70, justifyContent: 'center', alignItems: 'center', height: '100%',
    },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },
    sticker: {
        position: 'absolute', top: 0, left: 0, paddingHorizontal: 6, paddingVertical: 2,
        borderBottomRightRadius: 8, flexDirection: 'row', alignItems: 'center', zIndex: 1,
    },
    stickerText: { fontSize: 8, fontWeight: "900", color: "#fff", marginLeft: 3 },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 12, marginTop: 10 },
    avatarText: { fontSize: 15, fontWeight: "800" },
    cardBody: { flex: 1, marginTop: 8 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
    cardName: { fontSize: 16, fontWeight: "800", color: "#1E293B", maxWidth: '55%' },
    headerPhone: { fontSize: 12, color: "#64748B", fontWeight: "600" },
    moreBtn: { padding: 4, marginRight: -8 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
    cardSub: { fontSize: 12, color: "#64748B" },
    timeLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "600" },
    subCatText: { fontSize: 12, color: "#475569", fontWeight: "700" },
    unitTypeText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
    budgetText: { fontSize: 13, color: "#1E3A8A", fontWeight: "700", marginTop: 2 },
    metaText: { fontSize: 12, color: "#64748B", fontWeight: "500" },
    empty: { alignItems: "center", marginTop: 80 },
    emptyText: { fontSize: 16, color: "#94A3B8", fontWeight: "600", marginTop: 12 },
    fab: {
        position: "absolute", bottom: 30, right: 20, width: 56, height: 56,
        borderRadius: 28, backgroundColor: "#1E3A8A", justifyContent: "center",
        alignItems: "center", elevation: 4, shadowColor: "#000",
        shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },
    // Sheet Styles
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheetContainer: {
        backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingBottom: 40, minHeight: 300
    },
    sheetHandle: {
        width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2,
        alignSelf: "center", marginTop: 12, marginBottom: 20
    },
    sheetHeader: { marginBottom: 24 },
    sheetTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    sheetSub: { fontSize: 14, color: "#64748B", fontWeight: "600", marginTop: 2 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 8 },
    actionItem: { width: "23%", alignItems: "center", marginBottom: 16 },
    actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", marginBottom: 6 },
    actionLabel: { fontSize: 11, fontWeight: "700", color: "#475569" },
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
    dangerZone: { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 20, marginTop: 10 },
    dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: "#FEF2F2" },
    dangerBtnText: { marginLeft: 8, fontSize: 14, fontWeight: "700", color: "#EF4444" },
});
