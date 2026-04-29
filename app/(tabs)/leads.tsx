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
        return String(getLookupValue("Any", field) || "-");
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
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: theme.border, position: 'absolute' }} />
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color, borderLeftColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: '45deg' }] }} />
            <Text style={{ fontSize: 10, fontWeight: '900', color: theme.text }}>{String(score)}</Text>
        </View>
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

    const reqText = [
        getLookupValue("Category", lead.propertyType),
        getLookupValue("UnitType", lead.unitType)
    ].filter(v => v && v !== "-").join(" • ");

    const budgetText = (lead.budgetMin || lead.budgetMax) ? `₹${formatAmount(lead.budgetMin)} - ₹${formatAmount(lead.budgetMax)}` : null;

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
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: "#25D366" }]} onPress={() => Linking.openURL(`whatsapp://send?phone=${lead.mobile}`)}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isSelected && styles.cardSelected]}
            >
                <View style={styles.cardInner}>
                    <LeadScoreRing score={scoreVal} color={scoreColor} />
                    <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                            <TouchableOpacity onPress={onMore} style={styles.moreBtn}><Ionicons name="ellipsis-vertical" size={18} color={theme.textMuted} /></TouchableOpacity>
                        </View>
                        <View style={styles.metaRow}>
                            <Ionicons name="call-outline" size={12} color={theme.textMuted} />
                            <Text style={[styles.metaText, { color: theme.textSecondary }]}>{String(lead.mobile)}</Text>
                            <Text style={{ color: theme.textMuted, marginHorizontal: 4 }}>|</Text>
                            <Text style={[styles.metaText, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>{reqText || "No Requirement"}</Text>
                        </View>
                        {budgetText && (
                            <View style={styles.budgetBadge}>
                                <Text style={styles.budgetText}>{budgetText}</Text>
                            </View>
                        )}
                        <View style={styles.footerRow}>
                            <View style={[styles.ownerBadge, { backgroundColor: theme.border }]}>
                                <Text style={[styles.ownerText, { color: theme.textSecondary }]}>{resolveName(lead.owner, getLookupValue, findUser)}</Text>
                            </View>
                            <Text style={[styles.timeText, { color: theme.textMuted }]}>{formatTimeAgo(lead.createdAt)}</Text>
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
    const { theme, isDarkMode } = useTheme();
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();
    const { getLookupsByType } = useLookup();
    
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stats, setStats] = useState<any>({ total: 0, hot: 0, today: 0, fresh: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [liveScores, setLiveScores] = useState<any>({});

    const fetchLeads = useCallback(async (q = "") => {
        if (!isAuthenticated) return;
        setLoading(true);
        const params: any = { limit: "50" };
        if (q) params.q = q;
        if (activeTab !== "all") params.status = activeTab;

        const result = await safeApiCall<Lead>(() => getLeads(params));
        if (!result.error && result.data) {
            setLeads(result.data);
            if (result.stats) setStats(result.stats);
            getLeadScores().then(scores => setLiveScores(scores)).catch(() => {});
        }
        setLoading(false);
        setRefreshing(false);
    }, [isAuthenticated, activeTab]);

    useFocusEffect(useCallback(() => { fetchLeads(search); }, [fetchLeads, search]));

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 50), backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={styles.headerTop}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>SALES PIPELINE</Text>
                    <Text style={[styles.headerSub, { color: theme.textMuted }]}>{String(stats.total)} Total Leads</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/add-lead")}><Ionicons name="add-circle" size={32} color={theme.primary} /></TouchableOpacity>
            </View>
            
            <View style={styles.kpiRow}>
                <KPIItem label="Hot" value={stats.hot} color="#EF4444" icon="flame" theme={theme} />
                <KPIItem label="Today" value={stats.today} color="#10B981" icon="calendar" theme={theme} />
                <KPIItem label="Fresh" value={stats.fresh} color="#8B5CF6" icon="leaf" theme={theme} />
            </View>

            <View style={styles.searchBarRow}>
                <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Ionicons name="search" size={18} color={theme.textMuted} />
                    <TextInput 
                        style={[styles.searchInput, { color: theme.text }]} 
                        placeholder="Search leads..." 
                        placeholderTextColor={theme.textMuted} 
                        value={search} 
                        onChangeText={setSearch} 
                    />
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                {['all', 'incoming', 'prospect', 'opportunity', 'won'].map(tab => (
                    <TouchableOpacity 
                        key={tab} 
                        onPress={() => setActiveTab(tab)}
                        style={[styles.tab, activeTab === tab ? { backgroundColor: theme.primary, borderColor: theme.primary } : { backgroundColor: theme.background, borderColor: theme.border }]}
                    >
                        <Text style={[styles.tabText, { color: activeTab === tab ? "#fff" : theme.textSecondary }]}>{tab.toUpperCase()}</Text>
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
                        <LeadCard 
                            lead={item} 
                            index={index} 
                            liveScore={liveScores[item._id]}
                            onPress={() => router.push(`/lead-detail?id=${item._id}`)}
                            onMore={() => Alert.alert("Options", "Coming soon...")}
                        />
                    </View>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(search); }} tintColor={theme.primary} />}
                ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="clipboard-outline" size={64} color={theme.border} /><Text style={[styles.emptyText, { color: theme.textLight }]}>No leads found</Text></View> : null}
            />
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
    budgetBadge: { alignSelf: 'flex-start', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
    budgetText: { fontSize: 10, color: '#10B981', fontWeight: '800' },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    ownerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    ownerText: { fontSize: 10, fontWeight: '700' },
    timeText: { fontSize: 10, fontWeight: '600' },
    swipeActions: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 12 },
    swipeBtn: { width: 60, height: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 15, fontWeight: '600', marginTop: 12 }
});
