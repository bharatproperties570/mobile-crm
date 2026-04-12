import { useCallback, useEffect, useState, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Animated, Linking, Dimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useCallTracking } from "@/context/CallTrackingContext";
import api from "@/services/api";
import { getActivities } from "@/services/activities.service";
import { getMatchingLeads } from "@/services/leads.service";
import { getDealById, type Deal } from "@/services/deals.service";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import { getDealHealth } from "@/services/stageEngine.service";
import { formatSize, getSizeLabel } from "@/utils/format.utils";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CACHE_KEY_PREFIX = "@cache_deal_detail_";

const TABS = ["Analysis", "Financial", "Technical", "Geography", "Parties", "Matches", "Timeline", "Vault", "History"];

function fmt(amount?: number): string {
    if (!amount) return "—";
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
}

function lv(field: unknown, getLookupValue?: (type: string, val: any) => string, users?: any[]): string {
    if (field === null || field === undefined || field === "" || field === "null" || field === "undefined") return "—";

    // Handle Array
    if (Array.isArray(field)) {
        return field.map(f => lv(f, getLookupValue, users)).filter(v => v && v !== "—").join(", ") || "—";
    }

    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field && field.lookup_value) return (field as any).lookup_value;
        if ("fullName" in field && field.fullName) return (field as any).fullName;
        if ("name" in field && field.name) return (field as any).name;
        if ((field as any)._id && getLookupValue) {
            const resolved = getLookupValue("Any", (field as any)._id);
            if (resolved && resolved !== (field as any)._id) return resolved;
        }
    }

    // Handle ID string
    const str = String(field).trim();
    if (/^[a-f0-9]{24}$/i.test(str)) {
        // 1. Try Lookups
        if (getLookupValue) {
            const resolved = getLookupValue("Any", str);
            if (resolved && resolved !== str && resolved !== "—") return resolved;
        }
        // 2. Try Users
        if (users) {
            const user = users.find(u => u._id === str || u.id === str);
            if (user) return user.fullName || user.name || str;
        }
        // If still a hex ID and not resolved, return placeholder for professional look
        return "—";
    }

    return str || "—";
}

function formatTimeAgo(dateString?: string) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSecs < 60) return "Just now";
    if (diffInSecs < 3600) return `${Math.floor(diffInSecs / 60)}m ago`;
    if (diffInSecs < 8400) return `${Math.floor(diffInSecs / 3600)}h ago`;
    return `${Math.floor(diffInSecs / 86400)}d ago`;
}

function getDealScore(deal: any, isDark = false) {
    let score = deal.dealProbability || 50;
    const stage = lv(deal.stage).toLowerCase();
    if (stage === "negotiation") score += 10;
    if (stage === "booked") score += 30;

    score = Math.min(score, 100);
    const color = score > 80 ? "#10B981" : score > 50 ? "#F59E0B" : "#EF4444";
    const bgOpacity = isDark ? '20' : '15';
    return { val: score, color, bg: color + bgOpacity };
}

function getDealInsight(deal: any, activities: any[]) {
    const stage = lv(deal.stage).toLowerCase();
    if (stage === "open") return "Quickly qualify the requirement to move to Quoting stage.";
    if (stage === "negotiation") return "Critical negotiation phase. Check if inventory block time is expiring.";
    if (deal.dealProbability > 70) return "High deal probability. Maintain frequent contact to close.";
    return "Ensure all property details are shared with the buyer for consideration.";
}

function InfoRow({ label, value, accent, icon }: { label: string; value: string; accent?: boolean; icon?: any }) {
    const { theme } = useTheme();
    if (!value || value === "—") return null;
    return (
        <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {icon && <Ionicons name={icon} size={14} color={theme.textLight} />}
                <Text style={[styles.infoLabel, { color: theme.textLight }]}>{label}</Text>
            </View>
            <Text style={[styles.infoValue, { color: theme.text }, accent && { color: theme.primary }]}>{value}</Text>
        </View>
    );
}

const STAGE_COLORS_LIGHT: Record<string, string> = {
    open: "#3B82F6",
    quote: "#8B5CF6",
    negotiation: "#F59E0B",
    booked: "#10B981",
    closed: "#059669",
    cancelled: "#EF4444",
    dormant: "#64748B",
};

const STAGE_COLORS_DARK: Record<string, string> = {
    open: "#60A5FA",
    quote: "#A78BFA",
    negotiation: "#FBBF24",
    booked: "#34D399",
    closed: "#10B981",
    cancelled: "#F87171",
    dormant: "#94A3B8",
};

export default function DealDetailScreen() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { trackCall } = useCallTracking();
    const { getLookupValue } = useLookup();
    const { users } = useUsers();
    const [deal, setDeal] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [matchingLeads, setMatchingLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const [dealHealth, setDealHealth] = useState<{ score: number; label: string; color: string } | null>(null);
    const [valuation, setValuation] = useState<any>(null);
    const [showCostSheet, setShowCostSheet] = useState(false);
    const lastFetchRef = useRef<number>(0);

    const scrollX = useRef(new Animated.Value(0)).current;
    const tabScrollViewRef = useRef<ScrollView>(null);
    const contentScrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!id) return;
        const cacheKey = `${CACHE_KEY_PREFIX}${id}`;
        const now = Date.now();
        if (!isRefresh && lastFetchRef.current && (now - lastFetchRef.current < 120000)) return;

        try {
            if (loading) {
                const cachedData = await AsyncStorage.getItem(cacheKey);
                if (cachedData) {
                    const parsed = JSON.parse(cachedData);
                    setDeal(parsed.deal);
                    setActivities(parsed.activities);
                    setMatchingLeads(parsed.matchingLeads);
                    setDealHealth(parsed.dealHealth);
                    setLoading(false);
                    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
                }
            }

            const [dealRes, actRes, matchRes, healthRes, valuationRes] = await Promise.all([
                getDealById(id as string).catch(e => { console.warn("Deal Fetch Error:", e); return null; }),
                getActivities({ entityId: id, limit: 20 }).catch(e => { console.warn("Activities Fetch Error:", e); return null; }),
                getMatchingLeads(id as string).catch(e => { console.warn("Match Fetch Error:", e); return null; }),
                getDealHealth(id as string).catch(e => { console.warn("Health Fetch Error:", e); return null; }),
                api.post('/valuation/calculate', { dealId: id, buyerGender: 'male' }).catch(e => { console.warn("Valuation Error:", e); return null; })
            ]);

            const currentDeal = dealRes?.data ?? dealRes?.deal ?? dealRes;
            const currentActivities = Array.isArray(actRes?.data) ? actRes.data : (Array.isArray(actRes) ? actRes : []);
            const currentMatchingLeads = Array.isArray(matchRes?.data) ? matchRes.data : (Array.isArray(matchRes) ? matchRes : []);
            const currentHealth = healthRes?.score !== undefined ? healthRes : null;
            const currentValuation = valuationRes?.data?.data || null;

            setDeal(currentDeal);
            setActivities(currentActivities);
            setMatchingLeads(currentMatchingLeads);
            setDealHealth(currentHealth);
            setValuation(currentValuation);
            lastFetchRef.current = Date.now();

            AsyncStorage.setItem(cacheKey, JSON.stringify({
                deal: currentDeal,
                activities: currentActivities,
                matchingLeads: currentMatchingLeads,
                dealHealth: currentHealth,
                valuation: currentValuation,
                timestamp: Date.now()
            })).catch(e => console.warn("Cache save error:", e));

            if (loading) {
                Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
            }
        } catch (error) {
            console.error("Deal Detail Fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [id, loading, fadeAnim]);

    const onTabPress = (index: number) => {
        setActiveTab(index);
        contentScrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    };

    const onScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SCREEN_WIDTH);
        if (index !== activeTab) {
            setActiveTab(index);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!deal) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={[styles.noData, { color: theme.textLight }]}>Deal not found</Text></View>;

    const isDark = theme.background === '#0F172A';
    const stageLabel = deal.stage ?? "Open";
    const stageColorMap = isDark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT;
    const stageColor = stageColorMap[stageLabel.toLowerCase()] ?? theme.primary;
    const score = getDealScore(deal, isDark);

    // Header Data
    const projectName = lv(deal.projectName, getLookupValue, users) !== "—" ? lv(deal.projectName, getLookupValue, users) : lv(deal.projectId, getLookupValue, users);
    const unitNo = lv(deal.unitNo || deal.unitNumber, getLookupValue, users) !== "—" ? lv(deal.unitNo || deal.unitNumber, getLookupValue, users) : lv(deal.inventoryId?.unitNumber || deal.inventoryId?.unitNo, getLookupValue, users);
    const unitType = lv(deal.unitType, getLookupValue, users) !== "—" ? lv(deal.unitType, getLookupValue, users) : lv(deal.inventoryId?.unitType, getLookupValue, users);
    const block = lv(deal.block, getLookupValue, users) !== "—" ? lv(deal.block, getLookupValue, users) : lv(deal.inventoryId?.block, getLookupValue, users);
    const assignedTo = lv(deal.assignedTo, getLookupValue, users);
    const intent = lv(deal.intent, getLookupValue, users);

    const buyer = resolveNameFromObject(deal.partyStructure?.buyer, deal.owner, getLookupValue, users);
    const buyerPhone = deal.partyStructure?.buyer?.mobile || deal.owner?.mobile || "";
    const buyerEmail = deal.partyStructure?.buyer?.email || deal.owner?.email || "";

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Premium SaaS Header */}
            <SafeAreaView style={[styles.headerCard, { backgroundColor: theme.card }]} edges={['top', 'left', 'right']}>
                <View style={[styles.headerTop, { backgroundColor: isDark ? theme.glassBg : theme.card }]}>
                    <TouchableOpacity
                        onPress={() => router.canGoBack() ? router.back() : router.push("/(tabs)/deals")}
                        style={[styles.backBtnCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }]}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons name="chevron-back" size={22} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                            <Text style={[styles.headerNamePremium, { color: theme.text }]} numberOfLines={1}>{unitNo}</Text>
                            {unitType !== "—" && (
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6366F1', marginBottom: 3 }}>
                                    {unitType}
                                </Text>
                            )}
                        </View>
                        <View style={styles.headerBadgeRow}>
                            <View style={[styles.miniBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.primary + '20' }]}>
                                <Text style={[styles.miniBadgeText, { color: isDark ? theme.textSecondary : theme.primary }]}>{projectName}</Text>
                            </View>
                            {block !== "—" && (
                                <View style={[styles.miniBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.border + '40' }]}>
                                    <Text style={[styles.miniBadgeText, { color: theme.textLight }]}>Block {block}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    {/* Health + Confidence Scores */}
                    <View style={{ alignItems: 'center', gap: 6 }}>
                        {/* Deal Health from Stage Engine */}
                        {dealHealth ? (
                            <View style={[styles.scoreRing, { borderColor: dealHealth.color + '50', borderWidth: 3 }]}>
                                <Text style={[styles.scoreValue, { color: dealHealth.color, fontSize: 14 }]}>{dealHealth.score}</Text>
                                <Text style={[styles.scoreLabel, { color: dealHealth.color }]}>{dealHealth.label.toUpperCase().slice(0, 6)}</Text>
                            </View>
                        ) : (
                            <View style={[styles.scoreRing, { borderColor: score.color + '40' }]}>
                                <Text style={[styles.scoreValue, { color: score.color }]}>{score.val}</Text>
                                <Text style={[styles.scoreLabel, { color: theme.textLight }]}>CONF.</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Information Strategy Bar */}
                <View style={[styles.strategyBar, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
                    <View style={styles.strategyBlock}>
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>ASSIGNED TO</Text>
                        <View style={styles.strategyValueRow}>
                            <Ionicons name="person-circle" size={14} color={theme.primary} />
                            <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                {assignedTo}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.strategyDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.strategyBlock}>
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>TEAM(S)</Text>
                        <View style={[styles.strategyValueRow, { flexWrap: 'wrap', gap: 4 }]}>
                            {Array.isArray(deal.teams) && deal.teams.length > 0 ? (
                                deal.teams.map((t: any, i: number) => (
                                    <View key={i} style={{ backgroundColor: isDark ? 'rgba(129, 140, 248, 0.15)' : '#6366F110', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? '#C7D2FE' : '#6366F1' }}>{lv(t, getLookupValue, users).toUpperCase()}</Text>
                                    </View>
                                ))
                            ) : (
                                <>
                                    <Ionicons name="people-outline" size={12} color={isDark ? '#818CF8' : "#6366F1"} />
                                    <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                        {lv(deal.team, getLookupValue, users)}
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                {/* Marketing & Acquisition Row */}
                <View style={styles.marketingRow}>
                    <View style={[styles.marketingPill, { backgroundColor: stageColor + '10' }]}>
                        <Ionicons name="stats-chart" size={12} color={stageColor} />
                        <Text style={[styles.marketingText, { color: stageColor }]}>
                            {stageLabel.toUpperCase()}
                        </Text>
                    </View>

                    {intent !== "—" && (
                        <View style={[styles.marketingPill, { backgroundColor: '#7C3AED' + '10' }]}>
                            <Ionicons name="flag" size={12} color="#7C3AED" />
                            <Text style={[styles.marketingText, { color: '#7C3AED' }]}>
                                {intent.toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Professional Action Hub */}
                <View style={styles.modernActionHub}>
                    {[
                        { icon: 'call', label: 'Call', color: theme.primary, onPress: () => buyerPhone ? trackCall(buyerPhone, id!, "Deal", buyer) : Alert.alert("No Phone", "Contact number not available") },
                        { icon: 'logo-whatsapp', label: 'WhatsApp', color: '#128C7E', onPress: () => buyerPhone ? Linking.openURL(`https://wa.me/${buyerPhone.replace(/\D/g, "")}`) : Alert.alert("No Phone", "Contact number not available") },
                        { icon: 'people', label: 'Matches', color: isDark ? '#818CF8' : '#6366F1', onPress: () => router.push(`/match-lead?dealId=${id}`) },
                        { icon: 'handshake-outline', label: 'Offer', color: '#F59E0B', onPress: () => router.push(`/add-offer?dealId=${id}`) },
                        { icon: 'calculator-outline', label: 'Quote', color: '#10B981', onPress: () => router.push(`/add-quote?dealId=${id}`) },
                        { icon: 'share-social', label: 'Share', color: isDark ? '#94A3B8' : '#94A3B8', onPress: () => Alert.alert("Share Wall", `Sharing details for Deal ${unitNo} at ${projectName}`) },
                    ].map((action, i) => (
                        <View key={i} style={styles.modernHubItem}>
                            <TouchableOpacity style={[styles.modernHubBtn, { backgroundColor: action.color }]} onPress={action.onPress}>
                                <Ionicons name={action.icon as any} size={20} color="#fff" />
                            </TouchableOpacity>
                            <Text style={[styles.modernHubLabel, { color: theme.textSecondary }]}>{action.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Swipeable Tabs Navigation */}
                <View>
                    <ScrollView
                        ref={tabScrollViewRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabsScroll}
                    >
                        {TABS.map((tab, i) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => onTabPress(i)}
                                style={[styles.tabItem, activeTab === i && { borderBottomColor: theme.primary }]}
                            >
                                <Text style={[styles.tabLabel, { color: activeTab === i ? theme.primary : theme.textLight }]}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </SafeAreaView>

            {/* Horizontal Swipeable Content */}
            <ScrollView
                ref={contentScrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScroll}
                style={{ flex: 1 }}
            >
                {/* 1. Analysis */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        {/* Pipeline Visualization */}
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Deal Lifecycle</Text>
                            <View style={styles.pipelineContainer}>
                                {["Open", "Quote", "Negotiation", "Booked"].map((stage, idx) => {
                                    const isActive = stageLabel.toLowerCase() === stage.toLowerCase();
                                    const isDone = ["open", "quote", "negotiation", "booked", "closed"].indexOf(stageLabel.toLowerCase()) > idx;
                                    return (
                                        <View key={stage} style={styles.pipelineStep}>
                                            <View style={[styles.pipelineCircle, (isActive || isDone) ? { backgroundColor: stageColor } : { backgroundColor: theme.border }]}>
                                                {isDone ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={styles.pipelineNumber}>{idx + 1}</Text>}
                                            </View>
                                            <Text style={[styles.pipelineLabel, { color: isActive ? theme.text : theme.textLight }]}>{stage}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Deal Intelligence */}
                        <View style={[styles.insightCard, { backgroundColor: score.bg, borderColor: score.color + '40' }]}>
                            <View style={[styles.insightIconBox, { backgroundColor: score.color + '20' }]}>
                                <Ionicons name="analytics" size={16} color={score.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.insightTitle, { color: score.color }]}>{score.val}% Confidence Score</Text>
                                <Text style={[styles.insightText, { color: theme.text }]}>{getDealInsight(deal, activities)}</Text>
                            </View>
                        </View>

                        {/* Health Metrics */}
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Command Center Analysis</Text>
                            <InfoRow label="Probability" value={`${deal.dealProbability || 50}%`} icon="trending-up-outline" accent />
                            <InfoRow label="Stage Duration" value={`${formatTimeAgo(deal.stageChangedAt || deal.createdAt)} in ${stageLabel}`} icon="time-outline" />
                            <InfoRow label="Last Engagement" value={formatTimeAgo(activities[0]?.createdAt)} icon="chatbubble-ellipses-outline" />
                            <InfoRow label="Forecast Category" value={deal.forecastCategory || "Pipeline"} icon="cloud-outline" />
                        </View>
                    </ScrollView>
                </View>

                {/* 2. Financial */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        {/* Financial Fast-Actions */}
                        <View style={styles.fastActionRow}>
                            <TouchableOpacity style={[styles.fastActionBtn, { borderColor: '#F59E0B' }]} onPress={() => router.push(`/add-offer?dealId=${id}`)}>
                                <Ionicons name="handshake-outline" size={18} color="#F59E0B" />
                                <Text style={[styles.fastActionText, { color: '#F59E0B' }]}>Record Offer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.fastActionBtn, { borderColor: '#10B981' }]} onPress={() => router.push(`/add-quote?dealId=${id}`)}>
                                <Ionicons name="calculator-outline" size={18} color="#10B981" />
                                <Text style={[styles.fastActionText, { color: '#10B981' }]}>Create Quotation</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Pricing Architecture</Text>
                            <InfoRow label="Estimated Value" value={fmt(deal.price)} icon="cash-outline" accent />
                            <InfoRow label="Quoted Amount" value={fmt(deal.quotePrice)} icon="pricetag-outline" />
                            <InfoRow label="Transaction Flow" value={lv(deal.transactionType, getLookupValue, users)} icon="swap-horizontal-outline" />
                            <InfoRow label="Flexible Portion" value={deal.flexiblePercentage ? `${deal.flexiblePercentage}%` : "—"} icon="pie-chart-outline" />
                        </View>

                        {/* Collapsible Net Landed Cost Sheet */}
                        <TouchableOpacity 
                            style={[styles.costSheetHeader, { backgroundColor: theme.card, borderColor: theme.border }]}
                            onPress={() => setShowCostSheet(!showCostSheet)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Net Landed Cost Sheet</Text>
                            </View>
                            <Ionicons name={showCostSheet ? "chevron-up" : "chevron-down"} size={20} color={theme.textLight} />
                        </TouchableOpacity>

                        {showCostSheet && (
                            <View style={[styles.costSheetContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <InfoRow label="Collector Value" value={fmt(valuation?.collectorValue)} />
                                <InfoRow label="Stamp Duty" value={fmt(valuation?.stampDutyAmount)} />
                                <InfoRow label="Registration" value={fmt(valuation?.registrationAmount)} />
                                <InfoRow label="Transfer Fees" value={fmt(valuation?.valuationData?.transferFees)} />
                                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                <InfoRow label="NET LANDED COST" value={fmt(valuation?.grandTotal || (deal.price + (valuation?.totalGovtCharges || 0)))} accent />
                            </View>
                        )}

                        {/* Recent Negotiation Rounds */}
                        {Array.isArray(deal.negotiationRounds) && deal.negotiationRounds.length > 0 && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 16 }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Negotiation Timeline</Text>
                                {deal.negotiationRounds.map((round: any, idx: number) => (
                                    <View key={idx} style={styles.offerRound}>
                                        <View style={styles.offerHeader}>
                                            <Text style={[styles.offerRoundLabel, { color: theme.primary }]}>ROUND {round.round}</Text>
                                            <Text style={styles.offerDate}>{new Date(round.date).toLocaleDateString()}</Text>
                                        </View>
                                        <View style={styles.offerDataRow}>
                                            <View>
                                                <Text style={styles.offerLabel}>Buyer Offer</Text>
                                                <Text style={[styles.offerValue, { color: theme.text }]}>{fmt(round.buyerOffer)}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.offerLabel}>Counter</Text>
                                                <Text style={[styles.offerValue, { color: theme.text }]}>{fmt(round.ownerCounter)}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    {/* 3. Technical */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Property Configuration</Text>
                            <InfoRow label="Category" value={lv(deal.category || deal.inventoryId?.category, getLookupValue, users)} icon="list-outline" />
                            <InfoRow label="Sub-Category" value={lv(deal.subCategory || deal.inventoryId?.subCategory, getLookupValue, users)} icon="layers-outline" />
                            <InfoRow label="Direction" value={lv(deal.direction || deal.inventoryId?.direction, getLookupValue, users)} icon="compass-outline" />
                            <InfoRow label="Facing" value={lv(deal.facing || deal.inventoryId?.facing, getLookupValue, users)} icon="navigate-outline" />
                            <InfoRow label="Road Width" value={lv(deal.roadWidth || deal.inventoryId?.roadWidth, getLookupValue, users)} icon="trail-sign-outline" />
                            <InfoRow label="Ownership" value={lv(deal.ownership || deal.inventoryId?.ownership, getLookupValue, users)} icon="document-text-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Size & Dimensions</Text>
                            <InfoRow label="Total Area" value={getSizeLabel(deal, getLookupValue) || "—"} icon="cube-outline" accent />
                            <InfoRow label="Dimensions" value={deal.inventoryId?.dimensions || `${lv(deal.width)} x ${lv(deal.length)}`} icon="resize-outline" />
                        </View>

                        {(deal.inventoryId?.builtupDetails || []).length > 0 && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Built-up Hierarchy</Text>
                                {deal.inventoryId.builtupDetails.map((item: any, idx: number) => (
                                    <View key={idx} style={[styles.infoRow, { borderBottomColor: theme.border }]}>
                                        <View>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{item.floor || `Floor ${idx}`}</Text>
                                            <Text style={{ fontSize: 11, color: theme.textLight }}>{item.width} x {item.length}</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, fontWeight: '800', color: theme.primary }}>{item.totalArea} {deal.inventoryId?.sizeUnit || 'SqFt'}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Furnishing & Status</Text>
                            <InfoRow label="Furnish Type" value={lv(deal.furnishType || deal.inventoryId?.furnishType, getLookupValue, users)} icon="bed-outline" />
                            <InfoRow label="Possession" value={lv(deal.possessionStatus || deal.inventoryId?.possessionStatus, getLookupValue, users)} icon="key-outline" />
                        </View>
                    </ScrollView>
                </View>

                {/* 4. Geography */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Regional Geography</Text>
                            <InfoRow label="City" value={lv(deal.city || deal.inventoryId?.city, getLookupValue, users)} icon="business-outline" />
                            <InfoRow label="Sector/Locality" value={lv(deal.sector || deal.inventoryId?.sector, getLookupValue, users)} icon="map-outline" />
                            <InfoRow label="Tehsil" value={lv(deal.inventoryId?.address?.tehsil, getLookupValue, users)} icon="navigate-circle-outline" />
                            <InfoRow label="ZIP Code" value={lv(deal.inventoryId?.address?.pinCode, getLookupValue, users)} icon="mail-unread-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Digital Signature (GPS)</Text>
                            <InfoRow label="Lat/Long" value={`${deal.inventoryId?.address?.lat || '—'} , ${deal.inventoryId?.address?.lng || '—'}`} icon="location-outline" />
                            
                            <TouchableOpacity
                                style={[styles.googleMapsBtn, { backgroundColor: theme.primary }]}
                                onPress={() => {
                                    const lat = deal.inventoryId?.address?.lat;
                                    const lng = deal.inventoryId?.address?.lng;
                                    if (!lat || !lng) return Alert.alert("No Location", "GPS coordinates are not available for this deal.");
                                    const url = `geo:${lat},${lng}?q=${lat},${lng}(${unitNo})`;
                                    Linking.openURL(url);
                                }}
                            >
                                <Ionicons name="map" size={18} color="#fff" />
                                <Text style={styles.googleMapsBtnText}>Navigate with Maps</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>

                {/* 5. Parties */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Ownership Group</Text>
                                <TouchableOpacity onPress={() => setIsOwnerModalOpen(true)}>
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>Manage</Text>
                                </TouchableOpacity>
                            </View>
                            {(!deal.inventoryId?.owners || deal.inventoryId.owners.length === 0) ? (
                                <Text style={styles.emptyText}>No owners linked to this property.</Text>
                            ) : (
                                deal.inventoryId.owners.map((owner: any, idx: number) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[styles.partyCard, { backgroundColor: theme.background, marginBottom: 10 }]}
                                        onPress={() => owner._id && router.push(`/contact-detail?id=${owner._id}`)}
                                    >
                                        <View style={styles.matchLeft}>
                                            <Text style={[styles.matchUnit, { color: theme.text }]}>{lv(owner, getLookupValue, users)}</Text>
                                            <Text style={[styles.matchProject, { color: theme.textLight }]}>{owner.mobile || "N/A"}</Text>
                                        </View>
                                        <View style={[styles.relationBadge, { backgroundColor: '#10B981' + '10' }]}>
                                            <Text style={{ fontSize: 9, color: '#10B981', fontWeight: '800' }}>OWNER</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Associates & Partners</Text>
                            {(!deal.inventoryId?.associates || deal.inventoryId.associates.length === 0) ? (
                                <Text style={styles.emptyText}>No associates linked.</Text>
                            ) : (
                                deal.inventoryId.associates.map((assoc: any, idx: number) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[styles.partyCard, { backgroundColor: theme.background, marginBottom: 10 }]}
                                        onPress={() => assoc.contact?._id && router.push(`/contact-detail?id=${assoc.contact._id}`)}
                                    >
                                        <View style={styles.matchLeft}>
                                            <Text style={[styles.matchUnit, { color: theme.text }]}>{lv(assoc.contact || assoc, getLookupValue, users)}</Text>
                                            <Text style={[styles.matchProject, { color: theme.textLight }]}>{assoc.relationship || "Associate"}</Text>
                                        </View>
                                        <View style={[styles.relationBadge, { backgroundColor: theme.primary + '10' }]}>
                                            <Text style={{ fontSize: 9, color: theme.primary, fontWeight: '800' }}>PARTNER</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 6. Matches */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Precision Matching Leads</Text>
                            {matchingLeads.length === 0 ? (
                                <Text style={styles.emptyText}>No matching leads found for this configuration.</Text>
                            ) : (
                                matchingLeads.map((lead: any, i: number) => {
                                    const score = lead.score || 0;
                                    const scoreColor = score > 80 ? "#10B981" : score > 50 ? "#F59E0B" : "#EF4444";
                                    return (
                                        <TouchableOpacity key={i} style={[styles.matchItem, { borderBottomColor: theme.border }]} onPress={() => router.push(`/lead-detail?id=${lead._id || lead._}`)}>
                                            <View style={styles.matchLeft}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                    <View style={[styles.scorePill, { backgroundColor: scoreColor + '15', borderColor: scoreColor + '30' }]}>
                                                        <Text style={[styles.scorePillText, { color: scoreColor }]}>{score}% Match</Text>
                                                    </View>
                                                    <Text style={[styles.matchUnit, { color: theme.text }]}>{lead.firstName} {lead.lastName || ""}</Text>
                                                </View>
                                                <Text style={[styles.matchProject, { color: theme.textLight }]}>
                                                    {lv(lead.requirement, getLookupValue, users)} • Budget: {lv(lead.budget, getLookupValue, users)}
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 7. Timeline */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Activity Timeline</Text>
                                <TouchableOpacity onPress={() => router.push(`/add-activity?id=${id}&type=Deal`)}>
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Add</Text>
                                </TouchableOpacity>
                            </View>
                            {activities.length === 0 ? (
                                <Text style={styles.emptyText}>No activities recorded yet.</Text>
                            ) : (
                                activities.map((act, i) => (
                                    <View key={i} style={[styles.timelineItem, { borderLeftColor: theme.border }]}>
                                        <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                                        <View style={styles.timelineBody}>
                                            <View style={styles.timelineHeader}>
                                                <Text style={[styles.timelineType, { color: theme.primary }]}>{act.type?.toUpperCase() || "ACTIVITY"}</Text>
                                                <Text style={styles.timelineDate}>{new Date(act.createdAt).toLocaleDateString()}</Text>
                                            </View>
                                            <Text style={[styles.timelineSubject, { color: theme.text }]}>{act.subject}</Text>
                                            {(act.performedBy || act.assignedTo) && (
                                                <Text style={{ fontSize: 9, color: theme.textLight, marginTop: 4, fontWeight: '600' }}>
                                                    By {act.performedBy || lv(act.assignedTo, getLookupValue, users)}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 8. Vault */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Media Vault</Text>
                                <TouchableOpacity onPress={() => router.push(`/upload-media?entityId=${deal.inventoryId?._id}&entityType=Inventory`)}>
                                    <Ionicons name="cloud-upload-outline" size={20} color={theme.primary} />
                                </TouchableOpacity>
                            </View>
                            {(deal.inventoryId?.media?.length || 0) === 0 ? (
                                <Text style={styles.emptyText}>No media files in vault.</Text>
                            ) : (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                    {deal.inventoryId.media.map((m: any, idx: number) => (
                                        <TouchableOpacity key={idx} style={styles.vaultItem}>
                                            <View style={{ width: (SCREEN_WIDTH - 80) / 3, height: 80, backgroundColor: theme.background, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name="image-outline" size={32} color={theme.textLight} />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Documents</Text>
                            {(deal.inventoryId?.documents?.length || 0) === 0 ? (
                                <Text style={styles.emptyText}>No documents uploaded.</Text>
                            ) : (
                                deal.inventoryId.documents.map((doc: any, idx: number) => (
                                    <View key={idx} style={styles.docRow}>
                                        <Ionicons name="document-text" size={20} color={theme.primary} />
                                        <Text style={[styles.docName, { color: theme.text }]}>{doc.name || "Untitled Document"}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 9. History */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        {/* Chain of Title */}
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Chain of Title History</Text>
                            {(!deal.inventoryId?.ownerHistory || deal.inventoryId.ownerHistory.length === 0) ? (
                                <Text style={styles.emptyText}>No title history recorded.</Text>
                            ) : (
                                deal.inventoryId.ownerHistory.reverse().map((h: any, idx: number) => (
                                    <View key={idx} style={[styles.timelineItem, { borderLeftColor: theme.border }]}>
                                        <View style={[styles.timelineDot, { backgroundColor: '#10b981' }]} />
                                        <View style={styles.timelineBody}>
                                            <Text style={[styles.timelineSubject, { color: theme.text }]}>{h.contactName}</Text>
                                            <Text style={styles.timelineDate}>{new Date(h.date).toLocaleDateString()}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Lifecycle Metrics */}
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Inventory Lifecycle</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={[styles.lifecycleBox, { backgroundColor: theme.background }]}>
                                    <Text style={styles.lifecycleLabel}>Created</Text>
                                    <Text style={[styles.lifecycleValue, { color: theme.text }]}>{deal.inventoryId?.createdAt ? new Date(deal.inventoryId.createdAt).toLocaleDateString() : '—'}</Text>
                                </View>
                                <View style={[styles.lifecycleBox, { backgroundColor: theme.background }]}>
                                    <Text style={styles.lifecycleLabel}>Last Updated</Text>
                                    <Text style={[styles.lifecycleValue, { color: theme.text }]}>{deal.inventoryId?.updatedAt ? new Date(deal.inventoryId.updatedAt).toLocaleDateString() : '—'}</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </View>
    </ScrollView>
                </View>
            </ScrollView>

            {/* Action Center Modal */}
            <Modal
                visible={isActionModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsActionModalVisible(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setIsActionModalVisible(false)}
                >
                    <View style={[styles.actionModal, { backgroundColor: theme.card }]}>
                        <View style={styles.actionModalHeader}>
                            <View style={styles.actionHeaderLine} />
                            <Text style={[styles.actionModalTitle, { color: theme.text }]}>Command Center Actions</Text>
                        </View>

                        <View style={styles.actionGrid}>
                            <ActionItem 
                                icon="handshake-outline" 
                                label="Record Offer" 
                                color="#F59E0B" 
                                onPress={() => { setIsActionModalVisible(false); router.push(`/add-offer?dealId=${id}`); }} 
                            />
                            <ActionItem 
                                icon="calculator-outline" 
                                label="Quotation" 
                                color="#10B981" 
                                onPress={() => { setIsActionModalVisible(false); router.push(`/add-quote?dealId=${id}`); }} 
                            />
                            <ActionItem 
                                icon="cloud-upload-outline" 
                                label="Media Vault" 
                                color="#3B82F6" 
                                onPress={() => { setIsActionModalVisible(false); router.push(`/upload-media?dealId=${id}`); }} 
                            />
                            <ActionItem 
                                icon="person-add-outline" 
                                label="Add Party" 
                                color="#8B5CF6" 
                                onPress={() => { setIsActionModalVisible(false); router.push(`/add-contact?dealId=${id}`); }} 
                            />
                            <ActionItem 
                                icon="navigate-outline" 
                                label="Location" 
                                color="#EF4444" 
                                onPress={() => {
                                    setIsActionModalVisible(false);
                                    if (deal?.location?.coordinates) {
                                        const [lat, lng] = deal.location.coordinates || [];
                                        const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                                        Linking.openURL(url);
                                    } else {
                                        Alert.alert("No Location", "This deal does not have coordinates mapped yet.");
                                    }
                                }} 
                            />
                            <ActionItem 
                                icon="create-outline" 
                                label="Edit Deal" 
                                color="#64748B" 
                                onPress={() => { setIsActionModalVisible(false); router.push(`/add-deal?id=${id}`); }} 
                            />
                        </View>
                        
                        <TouchableOpacity 
                            style={[styles.closeActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}
                            onPress={() => setIsActionModalVisible(false)}
                        >
                            <Text style={[styles.closeActionText, { color: theme.textSecondary }]}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Main Action FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                onPress={() => setIsActionModalVisible(true)}
            >
                <Ionicons name="flash" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const ActionItem = ({ icon, label, color, onPress }: any) => {
    const { theme } = useTheme();
    return (
        <TouchableOpacity style={styles.actionItem} onPress={onPress}>
            <View style={[styles.actionIconBox, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, fontWeight: "700" },

    // Header Styles
    headerCard: { paddingBottom: 10, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5, zIndex: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 15 },
    backBtnCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitleContainer: { flex: 1 },
    headerNamePremium: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    headerBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    miniBadgeText: { fontSize: 10, fontWeight: '800' },

    // Score/Insight Ring
    scoreContainer: { width: 90, alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    scoreRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    scoreValue: { fontSize: 16, fontWeight: '900' },
    scoreLabel: { fontSize: 7, fontWeight: '800', marginTop: -2 },
    smallHeaderShare: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' },

    // Strategy Bar
    strategyBar: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12, marginHorizontal: 20 },
    strategyBlock: { flex: 1, paddingHorizontal: 5 },
    strategyLabel: { fontSize: 8, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
    strategyValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    strategyValue: { fontSize: 12, fontWeight: '700' },
    strategyDivider: { width: 1, height: '70%', alignSelf: 'center', opacity: 0.5 },

    // Marketing Pills
    marketingRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 10, flexWrap: 'wrap' },
    marketingPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    marketingText: { fontSize: 11, fontWeight: '800' },

    // Modern Action Hub
    modernActionHub: { flexDirection: 'row', justifyContent: 'center', gap: 15, paddingVertical: 18, flexWrap: 'wrap', paddingHorizontal: 15 },
    modernHubItem: { alignItems: 'center', gap: 6, width: (SCREEN_WIDTH - 80) / 3 },
    modernHubBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowOpacity: 0.2, shadowRadius: 5 },
    modernHubLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

    fastActionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    fastActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed' },
    fastActionText: { fontSize: 13, fontWeight: '800' },

    // Tabs
    tabsScroll: { paddingHorizontal: 20, gap: 30 },
    tabItem: { paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', minWidth: 80, alignItems: 'center' },
    tabLabel: { fontSize: 13, fontWeight: '800' },

    // Content Tabs
    tabContent: { width: SCREEN_WIDTH },
    innerScroll: { padding: 20, paddingBottom: 120 },
    card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 16, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 13, fontWeight: '600' },
    infoValue: { fontSize: 14, fontWeight: '700' },
    emptyText: { textAlign: 'center', padding: 20, fontSize: 14, opacity: 0.5, fontWeight: '600' },

    // Insight
    insightCard: { padding: 16, borderRadius: 18, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    insightIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    insightText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

    // Timeline
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    timelineItem: { borderLeftWidth: 2, marginLeft: 10, paddingLeft: 20, paddingBottom: 25 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', left: -7, top: 0 },
    timelineBody: { marginTop: -4 },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    timelineType: { fontSize: 10, fontWeight: '800' },
    timelineDate: { fontSize: 10, fontWeight: '600' },
    timelineSubject: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    timelineNote: { fontSize: 12, lineHeight: 18 },

    // Pipeline
    pipelineContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    pipelineStep: { alignItems: 'center', gap: 8, flex: 1 },
    pipelineCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    pipelineNumber: { color: '#fff', fontSize: 12, fontWeight: '800' },
    pipelineLabel: { fontSize: 9, fontWeight: '700' },

    // Insight
    insightTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },

    // Financial
    costSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1 },
    costSheetContent: { padding: 20, borderRadius: 24, borderWidth: 1, borderTopWidth: 0, marginTop: -20, paddingTop: 30, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
    divider: { height: 1, marginVertical: 12 },
    offerRound: { paddingVertical: 12, borderBottomWidth: 1 },
    offerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    offerRoundLabel: { fontSize: 10, fontWeight: '900' },
    offerDate: { fontSize: 10 },
    offerDataRow: { flexDirection: 'row', justifyContent: 'space-between' },
    offerLabel: { fontSize: 8, textTransform: 'uppercase', marginBottom: 2 },
    offerValue: { fontSize: 14, fontWeight: '800' },

    // Vault & History
    vaultItem: { marginBottom: 10 },
    docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
    docName: { fontSize: 13, fontWeight: '600', flex: 1 },
    lifecycleBox: { flex: 1, padding: 15, borderRadius: 16, alignItems: 'center', gap: 5 },
    lifecycleLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
    lifecycleValue: { fontSize: 13, fontWeight: '800' },

    // Match / Party Items
    matchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    partyCard: { padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center' },
    matchLeft: { flex: 1 },
    matchUnit: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
    matchProject: { fontSize: 12, fontWeight: '600' },
    matchRight: { alignItems: 'flex-end' },
    relationBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    scorePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    scorePillText: { fontSize: 10, fontWeight: '900' },
    matchDetailTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    matchDetailTagText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
    googleMapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, marginTop: 15 },
    googleMapsBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
    },

    // Action Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    actionModal: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    actionModalHeader: { alignItems: 'center', marginBottom: 24 },
    actionHeaderLine: { width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
    actionModalTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
    actionItem: { width: (SCREEN_WIDTH - 64) / 3, alignItems: 'center', gap: 8, marginBottom: 20 },
    actionIconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
    closeActionBtn: { marginTop: 10, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
    closeActionText: { fontSize: 14, fontWeight: '800' },
});

function resolveNameFromObject(obj: any, fallback?: any, getLookupValue?: (type: string, val: any) => string, users?: any[]): string {
    if (obj) {
        if (obj.fullName) return obj.fullName;
        if (obj.name) return obj.name;
        if (obj.firstName) return [obj.firstName, obj.lastName].filter(Boolean).join(" ");
    }
    return lv(fallback, getLookupValue, users);
}
