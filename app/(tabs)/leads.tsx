import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Alert, Linking,
    Modal, Animated, Dimensions, Pressable, ScrollView, Vibration
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { getLeads, leadName, updateLead, deleteLead, type Lead } from "@/services/leads.service";
import { getLookups, type Lookup } from "@/services/lookups.service";
import { safeApiCall, lookupVal } from "@/services/api.helpers";
import { getLeadScores } from "@/services/stageEngine.service";
import { useCallTracking } from "@/context/CallTrackingContext";
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// --- STAGE CONFIG ---
const STAGE_CONFIG: Record<string, { color: string; icon: any }> = {
    "New": { color: "#94A3B8", icon: "star" },
    "Prospect": { color: "#3B82F6", icon: "person" },
    "Qualified": { color: "#8B5CF6", icon: "checkmark-circle" },
    "Opportunity": { color: "#F59E0B", icon: "flame" },
    "Negotiation": { color: "#F97316", icon: "chatbubbles" },
    "Booked": { color: "#10B981", icon: "calendar" },
    "Closed Won": { color: "#10B981", icon: "trophy" },
    "Closed Lost": { color: "#EF4444", icon: "close-circle" },
    "default": { color: "#94A3B8", icon: "help-circle" }
};

// --- UTILS ---
const formatAmount = (amount?: any) => {
    if (amount == null) return "-";
    const val = Number(amount);
    if (isNaN(val)) return String(amount);
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)} K`;
    return String(val);
};

const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return "-";
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
};

function resolveName(field: any, getLookupValue: any, findUser: any) {
    if (!field) return "-";
    if (typeof field === 'string' && /^[a-f0-9]{24}$/i.test(field)) {
        const user = findUser(field);
        if (user) return String(user.fullName || user.name);
        const lVal = getLookupValue("Any", field);
        return lVal && lVal !== field ? String(lVal) : "-";
    }
    if (typeof field === 'object') return String(field.fullName || field.name || field.lookup_value || "-");
    return String(field);
}

// --- COMPONENTS ---
const KPIItem = memo(({ label, value, color, icon, theme }: any) => (
    <View style={[styles.kpiItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.kpiIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={14} color={color} />
        </View>
        <View>
            <Text style={[styles.kpiValue, { color }]}>{String(value || 0)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>{String(label)}</Text>
        </View>
    </View>
));

const LeadScoreRing = memo(({ score, color, size = 44 }: any) => {
    const { theme } = useTheme();
    const s = Number(score) || 0;
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: theme.border, position: 'absolute' }} />
            <View style={{ 
                width: size, height: size, borderRadius: size / 2, borderWidth: 3, 
                borderColor: color, 
                borderLeftColor: s > 75 ? color : 'transparent',
                borderBottomColor: s > 50 ? color : 'transparent',
                borderRightColor: s > 25 ? color : 'transparent',
                transform: [{ rotate: '-45deg' }],
                position: 'absolute'
            }} />
            <View style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, backgroundColor: color + '10', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: theme.text }}>{String(Math.round(s))}</Text>
            </View>
        </View>
    );
});

const ActionSheet = memo(({ visible, onClose, lead, onUpdate, statuses, users }: any) => {
    const router = useRouter();
    const { theme, isDarkMode } = useTheme();
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [newTag, setNewTag] = useState("");
    const [updating, setUpdating] = useState(false);

    if (!lead || !visible) return null;

    const handleAction = async (updateData: any) => {
        setUpdating(true);
        const res = await safeApiCall(() => updateLead(lead._id, updateData));
        setUpdating(false);
        if (!res.error) {
            Vibration.vibrate(20);
            onUpdate();
            onClose();
        } else {
            Alert.alert("Error", "Failed to update lead");
        }
    };

    const handleAddTag = async () => {
        if (!newTag.trim()) return;
        const currentTags = lead.tags || [];
        if (currentTags.includes(newTag.trim())) return;
        handleAction({ tags: [...currentTags, newTag.trim()] });
    };

    const markDormant = () => {
        const dStatus = statuses.find((s: any) => s.lookup_value.toLowerCase() === "dormant");
        if (dStatus) handleAction({ stage: dStatus._id });
        else Alert.alert("Error", "Dormant status not found in lookups");
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <View style={[styles.sheetContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.sheetHandle} />
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={[styles.sheetTitle, { color: theme.text }]}>{String(leadName(lead))}</Text>
                        
                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-lead?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: theme.primary + '15' }]}><Ionicons name="create" size={24} color={theme.primary} /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/match-lead?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#DB277715' }]}><Ionicons name="git-compare" size={24} color="#DB2777" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Match</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-document?id=${lead._id}&type=Lead`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#0EA5E915' }]}><Ionicons name="document-attach" size={24} color="#0EA5E9" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Doc</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-activity?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#EA580C15' }]}><Ionicons name="add-circle" size={24} color="#EA580C" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Outcome</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => setActiveSection(activeSection === 'assign' ? null : 'assign')}>
                                <View style={[styles.actionIcon, { backgroundColor: '#7C3AED15' }]}><Ionicons name="person-add" size={24} color="#7C3AED" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Assign</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => setActiveSection(activeSection === 'tag' ? null : 'tag')}>
                                <View style={[styles.actionIcon, { backgroundColor: '#4F46E515' }]}><Ionicons name="pricetags" size={24} color="#4F46E5" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Tag</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={markDormant}>
                                <View style={[styles.actionIcon, { backgroundColor: '#94A3B815' }]}><Ionicons name="moon" size={24} color="#94A3B8" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Dormant</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                Alert.alert("Delete?", "Remove lead permanently?", [
                                    { text: "Cancel" },
                                    { text: "Delete", style: "destructive", onPress: async () => { await deleteLead(lead._id); onUpdate(); onClose(); } }
                                ]);
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#EF444415' }]}><Ionicons name="trash" size={24} color="#EF4444" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>

                        {activeSection === 'assign' && (
                            <View style={[styles.subSection, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }]}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Assign to Team Member</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                    {users.map((u: any) => (
                                        <TouchableOpacity key={u._id} style={styles.userChip} onPress={() => handleAction({ owner: u._id })}>
                                            <View style={[styles.userAvatar, { backgroundColor: theme.primary + '15' }]}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>{String((u.fullName || u.name || "?")[0])}</Text></View>
                                            <Text style={[styles.userChipText, { color: theme.textSecondary }]}>{String(u.fullName || u.name)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {activeSection === 'tag' && (
                            <View style={[styles.subSection, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }]}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Manage Tags</Text>
                                <View style={styles.tagInputRow}>
                                    <TextInput style={[styles.tagInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]} placeholder="New tag..." placeholderTextColor={theme.textMuted} value={newTag} onChangeText={setNewTag} />
                                    <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: theme.primary }]} onPress={handleAddTag} disabled={updating}>
                                        {updating ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="add" size={24} color="#fff" />}
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.tagList}>
                                    {(lead.tags || []).map((t: string, i: number) => (
                                        <View key={i} style={[styles.tagBadge, { backgroundColor: theme.primary + '10' }]}>
                                            <Text style={[styles.tagText, { color: theme.primary }]}>{String(t)}</Text>
                                            <TouchableOpacity onPress={() => handleAction({ tags: (lead.tags || []).filter((tag: string) => tag !== t) })}><Ionicons name="close-circle" size={14} color={theme.primary} /></TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </Pressable>
        </Modal>
    );
});

const LeadCard = memo(({ lead, index, onPress, onMore, isSelected, liveScore }: any) => {
    const { theme, isDarkMode } = useTheme();
    const { getLookupValue } = useLookup();
    const { findUser } = useUsers();
    const { trackCall } = useCallTracking();
    const name = String(leadName(lead) || "Unnamed");
    const scoreVal = liveScore?.score || lead.intent_index || 30;
    const scoreColor = liveScore?.color || (scoreVal > 70 ? "#10B981" : scoreVal > 40 ? "#F59E0B" : "#3B82F6");

    const stageLabel = String(getLookupValue("Stage", lead.stage) || "New");
    const stageCfg = STAGE_CONFIG[stageLabel] || STAGE_CONFIG.default;

    const reqText = [
        getLookupValue("Category", lead.propertyType),
        getLookupValue("SubCategory", lead.subType),
        getLookupValue("UnitType", lead.unitType)
    ].filter(v => v && v !== "-").join(" • ");

    const budgetText = (lead.budgetMin || lead.budgetMax) ? `₹${formatAmount(lead.budgetMin)} - ₹${formatAmount(lead.budgetMax)}` : null;
    const areaText = (lead.areaMin || lead.areaMax) ? `${lead.areaMin || ""}-${lead.areaMax || ""} ${lead.areaMetric || ""}`.trim() : null;

    const renderRightActions = () => (
        <View style={styles.swipeActions}>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: theme.primary }]} onPress={() => trackCall(lead.mobile || "", lead._id, "Lead", name)}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.swipeActions}>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: "#25D366" }]} onPress={() => {
                const phone = String(lead.mobile || "").replace(/[^0-9]/g, "");
                Linking.openURL(`whatsapp://send?phone=${phone.length === 10 ? '91'+phone : phone}`);
            }}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isSelected && styles.cardSelected]}>
                <View style={styles.cardInner}>
                    <LeadScoreRing score={scoreVal} color={scoreColor} />
                    <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                            <TouchableOpacity onPress={onMore} style={styles.moreBtn}><Ionicons name="ellipsis-vertical" size={18} color={theme.textMuted} /></TouchableOpacity>
                        </View>
                        <View style={styles.metaRow}>
                            <Ionicons name="call-outline" size={12} color={theme.textMuted} />
                            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginLeft: 4 }}>{String(lead.mobile)}</Text>
                            <Text style={{ color: theme.textMuted, marginHorizontal: 4 }}>|</Text>
                            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', flex: 1 }} numberOfLines={1}>{reqText || "No Requirement"}</Text>
                        </View>
                        {(budgetText || areaText) && (
                            <View style={styles.detailRow}>
                                {budgetText && <View style={[styles.outcomeBadge, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.1)' : '#ECFDF5' }]}><Text style={styles.outcomeText}>{budgetText}</Text></View>}
                                {areaText && <View style={[styles.outcomeBadge, { backgroundColor: isDarkMode ? 'rgba(99,102,241,0.1)' : '#EEF2FF' }]}><Text style={[styles.outcomeText, { color: '#6366F1' }]}>{areaText}</Text></View>}
                            </View>
                        )}
                        <View style={styles.footerRow}>
                            <View style={[styles.ownerBadge, { backgroundColor: stageCfg.color + '15', flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name={stageCfg.icon} size={10} color={stageCfg.color} style={{ marginRight: 4 }} />
                                <Text style={[styles.ownerText, { color: stageCfg.color }]}>{stageLabel.toUpperCase()}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.ownerText, { color: theme.textMuted, marginRight: 8 }]}>{resolveName(lead.owner, getLookupValue, findUser)}</Text>
                                <Text style={[styles.timeText, { color: theme.textMuted }]}>{formatTimeAgo(lead.createdAt)}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
});

// --- MAIN SCREEN ---
export default function LeadsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();
    const { getLookupsByType } = useLookup();
    const { users } = useUsers();
    
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stats, setStats] = useState<any>({ total: 0, hot: 0, today: 0, fresh: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [liveScores, setLiveScores] = useState<any>({});
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);

    const fetchLeads = useCallback(async (pageNum = 1, shouldAppend = false) => {
        if (!isAuthenticated) return;
        if (!shouldAppend) setLoading(true);
        const params: any = { page: String(pageNum), limit: "50" };
        if (search) params.q = search;
        if (activeTab !== "all") params.status = activeTab;

        const result = await safeApiCall<Lead>(() => getLeads(params));
        if (!result.error && result.data) {
            setLeads(prev => shouldAppend ? [...prev, ...result.data] : result.data);
            setHasMore(result.data.length === 50);
            setPage(pageNum);
            if (result.stats) setStats(result.stats);
            if (!shouldAppend) getLeadScores().then(scores => setLiveScores(scores)).catch(() => {});
        }
        setLoading(false);
        setRefreshing(false);
    }, [isAuthenticated, activeTab, search]);

    useEffect(() => {
        const timer = setTimeout(() => fetchLeads(1, false), 300);
        return () => clearTimeout(timer);
    }, [search, activeTab]);

    useFocusEffect(useCallback(() => { fetchLeads(1, false); }, []));

    const loadMore = () => { if (!loading && hasMore) fetchLeads(page + 1, true); };

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 50), backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={styles.headerTop}>
                <View><Text style={[styles.headerTitle, { color: theme.text }]}>SALES PIPELINE</Text><Text style={[styles.headerSub, { color: theme.textMuted }]}>{String(stats.total)} Total Records</Text></View>
                <TouchableOpacity onPress={() => router.push("/add-lead")}><Ionicons name="add-circle" size={32} color={theme.primary} /></TouchableOpacity>
            </View>
            <View style={styles.kpiRow}>
                <KPIItem label="Hot" value={stats.hot} color="#EF4444" icon="flame" theme={theme} />
                <KPIItem label="Today" value={stats.today} color="#10B981" icon="calendar" theme={theme} />
                <KPIItem label="Fresh" value={stats.fresh} color="#8B5CF6" icon="leaf" theme={theme} />
            </View>
            <View style={styles.searchBarRow}>
                <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Ionicons name="search" size={18} color={theme.textMuted} /><TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="Search leads..." placeholderTextColor={theme.textMuted} value={search} onChangeText={setSearch} />
                </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                {[
                    { key: "all", label: "ALL" },
                    { key: "incoming", label: "NEW" },
                    { key: "prospect", label: "PROSPECT" },
                    { key: "opportunity", label: "OPPORTUNITY" },
                    { key: "won", label: "WON" }
                ].map(tab => (
                    <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tab, activeTab === tab.key ? { backgroundColor: theme.primary, borderColor: theme.primary } : { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Text style={[styles.tabText, { color: activeTab === tab.key ? "#fff" : theme.textSecondary }]}>{tab.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <FlatList
                data={leads}
                keyExtractor={(item) => String(item._id)}
                ListHeaderComponent={renderHeader()}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item, index }) => (
                    <View style={{ paddingHorizontal: 12, marginTop: index === 0 ? 12 : 0 }}>
                        <LeadCard lead={item} index={index} liveScore={liveScores[item._id]} onPress={() => router.push(`/lead-detail?id=${item._id}`)} onMore={() => { setSelectedLead(item); setSheetVisible(true); }} />
                    </View>
                )}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(1, false); }} tintColor={theme.primary} />}
                ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="clipboard-outline" size={64} color={theme.border} /><Text style={[styles.emptyText, { color: theme.textLight }]}>No leads matching filters</Text></View> : null}
            />
            <ActionSheet visible={sheetVisible} onClose={() => { setSheetVisible(false); setSelectedLead(null); }} lead={selectedLead} onUpdate={() => fetchLeads(1, false)} statuses={getLookupsByType("Stage")} users={users} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 16, borderBottomWidth: 1, paddingBottom: 12 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    headerSub: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    kpiItem: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    kpiIcon: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    kpiValue: { fontSize: 16, fontWeight: '800' },
    kpiLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
    searchBarRow: { marginBottom: 12 },
    searchBar: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
    tabsScroll: { gap: 8 },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    tabText: { fontSize: 11, fontWeight: '800' },
    card: { padding: 12, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
    cardSelected: { borderWidth: 2, borderColor: '#3B82F6' },
    cardInner: { flexDirection: 'row', alignItems: 'center' },
    cardContent: { flex: 1, marginLeft: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '800', flex: 1 },
    moreBtn: { padding: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    metaText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
    detailRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
    outcomeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    outcomeText: { fontSize: 10, color: '#10B981', fontWeight: '800' },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    ownerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    ownerText: { fontSize: 10, fontWeight: '700' },
    timeText: { fontSize: 10, fontWeight: '600' },
    swipeActions: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 12 },
    swipeBtn: { width: 60, height: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheetContainer: { padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40, maxHeight: '85%' },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20 },
    sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 24, textAlign: 'center' },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 24 },
    actionItem: { width: '21%', alignItems: 'center', gap: 8 },
    actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 11, fontWeight: '700' },
    subSection: { padding: 16, borderRadius: 20, marginBottom: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12 },
    userChip: { alignItems: 'center', gap: 6, width: 70 },
    userAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    userChipText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
    tagInputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    tagInput: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, fontSize: 14 },
    addTagBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    tagText: { fontSize: 12, fontWeight: '700' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 15, fontWeight: '600', marginTop: 12 }
});
