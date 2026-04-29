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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function resolveName(field: unknown, getLookupValue?: (type: string, val: any) => string, findUser?: (id: string) => any): string {
    if (!field) return "-";
    if (Array.isArray(field)) {
        return field.map(item => resolveName(item, getLookupValue, findUser)).filter(name => name && name !== "-").join(", ") || "-";
    }
    if (typeof field === "object" && field !== null) {
        const obj = field as any;
        if (obj.lookup_value) return obj.lookup_value;
        if (obj.fullName) return obj.fullName;
        if (obj.name) return obj.name;
    }
    const str = String(field).trim();
    if (/^[a-f0-9]{24}$/i.test(str)) {
        if (getLookupValue) {
            const resolved = getLookupValue("Any", str);
            if (resolved && resolved !== str && resolved !== "-") return resolved;
        }
        if (findUser) {
            const user = findUser(str);
            if (user) return user.fullName || user.name || str;
        }
        return "-";
    }
    return str;
}

function formatAmount(amount?: any): string {
    if (amount === undefined || amount === null) return "-";
    const val = Number(amount);
    if (isNaN(val)) return String(amount);
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)} K`;
    return val.toString();
}

function formatTimeAgo(dateString?: string) {
    if (!dateString) return "-";
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

function getLeadScore(lead: Lead, isDark = false) {
    if (lead.intent_index !== undefined && lead.intent_index !== null) {
        const scoreVal = lead.intent_index || 0;
        let color = "#3B82F6"; 
        if (scoreVal >= 81) color = "#8B5CF6"; 
        else if (scoreVal >= 61) color = "#EF4444"; 
        else if (scoreVal >= 31) color = "#F59E0B"; 
        return { val: scoreVal, color };
    }
    return { val: 30, color: "#3B82F6" };
}

const LeadScoreRing = memo(({ score, color, isDark }: any) => {
    const { theme } = useTheme();
    return (
        <View style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, borderWidth: 3, borderColor: color }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: theme.text }}>{score}</Text>
        </View>
    );
});

const LeadCard = memo(({ lead, index, onPress, onMore, isSelected, onLongPress, liveScore }: any) => {
    const { theme, isDarkMode } = useTheme();
    const { trackCall } = useCallTracking();
    const { getLookupValue } = useLookup();
    const { findUser } = useUsers();
    const name = leadName(lead);
    const isDark = isDarkMode;
    const score = liveScore ? { val: liveScore.score, color: liveScore.color } : getLeadScore(lead, isDark);
    
    const intent = getLookupValue("Requirement", lead.requirement).toLowerCase();
    const intentConfig: any = {
        buy: { bg: isDark ? 'rgba(34,197,94,0.1)' : '#DCFCE7', text: '#15803D' },
        rent: { bg: isDark ? 'rgba(245,158,11,0.1)' : '#FFEDD5', text: '#C2410C' },
        lease: { bg: isDark ? 'rgba(59,130,246,0.1)' : '#E0F2FE', text: '#0369A1' }
    };
    const currentIntent = intentConfig[intent] || null;

    const requirementText = [
        getLookupValue("Category", lead.propertyType) || getLookupValue("Requirement", lead.requirement),
        getLookupValue("SubCategory", lead.subType) || getLookupValue("SubRequirement", lead.subRequirement)
    ].filter(v => v && v !== "-").join(" - ");

    return (<TouchableOpacity activeOpacity={0.9} onPress={onPress} onLongPress={onLongPress} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isSelected && styles.cardSelected]}><View style={styles.cardInner}><LeadScoreRing score={score.val} color={score.color} isDark={isDark} /><View style={styles.rowContent}><View style={styles.rowTop}><Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{name}</Text><TouchableOpacity onPress={onMore} style={styles.menuTouch}><Ionicons name="ellipsis-vertical" size={20} color={theme.textMuted} /></TouchableOpacity></View><View style={styles.contactRow}><Ionicons name="call-outline" size={12} color={theme.textMuted} /><Text style={[styles.contactText, { color: theme.textSecondary }]}>{lead.mobile}</Text>{lead.email && (<View style={styles.emailRow}><Text style={{ color: theme.textMuted, marginHorizontal: 4 }}>-</Text><Ionicons name="mail-outline" size={12} color={theme.textMuted} /><Text style={[styles.contactText, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>{lead.email}</Text></View>)}</View><Text style={[styles.requirementText, { color: theme.textSecondary }]} numberOfLines={1}>{requirementText}</Text><View style={styles.rowMeta}><View style={[styles.badge, { backgroundColor: theme.border }]}><Text style={[styles.badgeText, { color: theme.textSecondary }]}>{resolveName(lead.assignment?.assignedTo || lead.owner, getLookupValue, findUser)}</Text></View>{currentIntent && (<View style={[styles.badge, { backgroundColor: currentIntent.bg }]}><Text style={[styles.badgeText, { color: currentIntent.text }]}>{intent.toUpperCase()}</Text></View>)}</View></View></View></TouchableOpacity>);
});

export default function LeadsScreen() {
    const router = useRouter();
    const { theme, isDarkMode } = useTheme();
    const { isAuthenticated } = useAuth();
    const isDark = isDarkMode;
    const { getLookupValue, getLookupsByType, refreshLookups } = useLookup();
    const { users } = useUsers();
    
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [liveScores, setLiveScores] = useState<any>({});
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);

    const fetchLeads = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        const result = await safeApiCall<Lead>(() => getLeads({ q: search, limit: "50" }));
        if (!result.error && result.data) {
            setLeads(result.data);
            getLeadScores().then(scores => setLiveScores(scores)).catch(() => {});
        }
        setLoading(false);
        setRefreshing(false);
    }, [search, isAuthenticated]);

    useFocusEffect(useCallback(() => { fetchLeads(); }, [fetchLeads]));

    const onRefresh = () => { setRefreshing(true); refreshLookups(); fetchLeads(); };
    const toggleSelection = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        Vibration.vibrate(10);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <Text style={[styles.title, { color: theme.text }]}>LEADS</Text>
                <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Ionicons name="search" size={18} color={theme.textMuted} />
                    <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="Search..." placeholderTextColor={theme.textMuted} value={search} onChangeText={setSearch} />
                </View>
            </View>
            {loading ? <ActivityIndicator color={theme.primary} size="large" style={{ marginTop: 50 }} /> : (
                <FlatList
                    data={leads}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                    renderItem={({ item, index }) => (
                        <LeadCard
                            lead={item} index={index} isSelected={selectedIds.includes(item._id)}
                            onLongPress={() => toggleSelection(item._id)}
                            liveScore={liveScores[item._id]}
                            onPress={() => selectedIds.length > 0 ? toggleSelection(item._id) : router.push(`/lead-detail?id=${item._id}`)}
                            onMore={() => { setSelectedLead(item); setSheetVisible(true); }}
                        />
                    )}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 16, paddingTop: 60, borderBottomWidth: 1 },
    title: { fontSize: 20, fontWeight: "900", marginBottom: 12 },
    searchBar: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
    card: { padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    cardSelected: { borderWidth: 2, borderColor: '#3B82F6' },
    cardInner: { flexDirection: 'row', alignItems: 'center' },
    rowContent: { flex: 1, marginLeft: 12 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowName: { fontSize: 15, fontWeight: '800', flex: 1 },
    menuTouch: { padding: 4 },
    contactRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    contactText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
    emailRow: { flexDirection: 'row', alignItems: 'center' },
    requirementText: { fontSize: 13, fontWeight: '600' },
    rowMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
});
