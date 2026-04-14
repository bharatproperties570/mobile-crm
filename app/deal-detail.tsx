import { useCallback, useEffect, useState, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Animated, Linking, Dimensions, Modal
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useCallTracking } from "@/context/CallTrackingContext";
import api from "@/services/api";
import { getUnifiedTimeline } from "@/services/activities.service";
import { getMatchingLeads } from "@/services/leads.service";
import { getDealById, type Deal } from "@/services/deals.service";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import { getDealHealth } from "@/services/stageEngine.service";
import { formatSize, getSizeLabel } from "@/utils/format.utils";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CACHE_KEY_PREFIX = "@cache_deal_detail_";

const TABS = ["Analysis", "Financial", "Details", "Location", "Activities", "Match", "Owner", "History"];

function fmt(amount?: number): string {
    if (!amount) return "—";
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
}

function lv(field: unknown, getLookupValue?: (type: string, val: any) => string, findUser?: (id: string) => any): string {
    if (field === null || field === undefined || field === "" || field === "null" || field === "undefined") return "—";

    // Handle Array
    if (Array.isArray(field)) {
        return field.map(f => lv(f, getLookupValue, findUser)).filter(v => v && v !== "—").join(", ") || "—";
    }

    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field && (field as any).lookup_value) return (field as any).lookup_value;
        if ("fullName" in field && (field as any).fullName) return (field as any).fullName;
        if ("name" in field && (field as any).name) return (field as any).name;
    }

    // Handle ID string
    const str = String(field).trim();
    if (/^[a-f0-9]{24}$/i.test(str)) {
        // 1. Try Lookups
        if (getLookupValue) {
            const resolved = getLookupValue("Any", str);
            if (resolved && resolved !== str && resolved !== "—") return resolved;
        }
        // 2. Try Users (if provider function is available)
        if (typeof findUser === 'function') {
            const user = findUser(str);
            if (user) return user.fullName || user.name || str;
        }
        // If still a hex ID and not resolved, return placeholder for professional look
        return "—";
    }

    return str || "—";
}

function resolveNameFromObject(obj: any, fallback?: any, getLookupValue?: (type: string, val: any) => string, findUser?: (id: string) => any): string {
    if (obj) {
        if (obj.fullName) return obj.fullName;
        if (obj.name) return obj.name;
        if (obj.firstName) return [obj.firstName, obj.lastName].filter(Boolean).join(" ");
    }
    return lv(fallback, getLookupValue, findUser);
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

function getDealScore(deal: any, health: any, isDark = false) {
    // 1. Prioritize Real Backend Health Score (High Fidelity)
    if (health && typeof health.score === 'number') {
        const color = health.score > 80 ? "#10B981" : health.score > 50 ? "#F59E0B" : "#EF4444";
        const bgOpacity = isDark ? '20' : '15';
        return { val: health.score, color, bg: color + bgOpacity };
    }

    // 2. Fallback to Proprietary Probability Engine
    let score = deal.dealProbability || 50;
    const stage = lv(deal.stage).toLowerCase();
    if (stage === "negotiation") score += 10;
    if (stage === "booked") score += 30;

    score = Math.min(score, 100);
    const color = score > 80 ? "#10B981" : score > 50 ? "#F59E0B" : "#EF4444";
    const bgOpacity = isDark ? '20' : '15';
    return { val: score, color, bg: color + bgOpacity };
}

function getDealInsight(deal: any, activities: any[], health: any) {
    const stage = lv(deal.stage).toLowerCase();
    
    // Check for stagnation (Engagement Gap)
    const lastActivity = activities?.[0];
    if (lastActivity) {
        const lastInMs = new Date(lastActivity.timestamp || lastActivity.createdAt).getTime();
        const daysSince = Math.floor((Date.now() - lastInMs) / (1000 * 60 * 60 * 24));
        if (daysSince > 7) return `Engagement Gap Detected (${daysSince} days). High risk of deal stagnation. Immediate follow-up required.`;
    }

    // Check for Stage Velocity
    if (deal.stageChangedAt) {
        const stageDays = Math.floor((Date.now() - new Date(deal.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24));
        if (stageDays > 14 && stage !== "booked") return `Pipeline Friction: Deal has been in '${stage.toUpperCase()}' for ${stageDays} days. Consider re-evaluating terms.`;
    }

    // Contextual Insights
    if (health?.insights?.length > 0) return health.insights[0];
    if (stage === "open") return "Intelligence suggests qualifying the requirement to accelerate to the Quoting phase.";
    if (stage === "negotiation") return "Strategic negotiation phase. Monitor document flow and price caps closely.";
    if (deal.dealProbability > 70) return "Executive Confidence is High. Ensure all compliance documents are staged for closing.";
    
    return "Intelligence is monitoring engagement. Ensure all property collateral has been dispatched.";
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

const RibbonButton = ({ icon, color, onPress }: { icon: any; color: string; onPress: () => void }) => {
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    return (
        <TouchableOpacity 
            style={[styles.ribbonBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border, borderWidth: 1 }]} 
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Ionicons name={icon} size={20} color={color} />
        </TouchableOpacity>
    );
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
    const isDark = theme.background === '#0F172A';
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const [dealHealth, setDealHealth] = useState<{ score: number; label: string; color: string } | null>(null);
    const [valuation, setValuation] = useState<any>(null);
    const [showCostSheet, setShowCostSheet] = useState(false);
    const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
    const lastFetchRef = useRef<number>(0);

    const scrollX = useRef(new Animated.Value(0)).current;
    const tabScrollViewRef = useRef<ScrollView>(null);
    const contentScrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [stageHistory, setStageHistory] = useState<any[]>([]);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!id) return;
        const cacheKey = `${CACHE_KEY_PREFIX}${id}`;
        const now = Date.now();
        if (!isRefresh && lastFetchRef.current && (now - lastFetchRef.current < 120000)) return;

        try {
            if (loading) {
                const cacheData = await AsyncStorage.getItem(cacheKey);
                if (cacheData) {
                    const parsed = JSON.parse(cacheData);
                    if (parsed.deal) setDeal(parsed.deal);
                    if (parsed.activities) setActivities(parsed.activities);
                    if (parsed.matchingLeads) setMatchingLeads(parsed.matchingLeads);
                    if (parsed.dealHealth) setDealHealth(parsed.dealHealth);
                    setLoading(false);
                    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
                }
            }

            const [dealRes, timelineRes, matchRes, healthRes, valuationRes, historyRes] = await Promise.all([
                getDealById(id as string).catch(e => { console.warn("Deal Fetch Error:", e); return null; }),
                getUnifiedTimeline("deal", id as string).catch(e => { console.warn("Timeline Fetch Error:", e); return null; }),
                getMatchingLeads(id as string).catch(e => { console.warn("Match Fetch Error:", e); return null; }),
                getDealHealth(id as string).catch(e => { console.warn("Health Fetch Error:", e); return null; }),
                api.post('/valuation/calculate', { dealId: id, buyerGender: 'male' }).catch(e => { console.warn("Valuation Error:", e); return null; }),
                api.get(`/stage-engine/deals/${id}/history`).catch(e => { console.warn("History Fetch Error:", e); return null; })
            ]);

            const currentDeal = dealRes?.data ?? dealRes?.deal ?? dealRes;
            const currentActivities = Array.isArray(timelineRes?.data) ? timelineRes.data : (Array.isArray(timelineRes) ? timelineRes : []);
            const currentMatchingLeads = Array.isArray(matchRes?.data) ? matchRes.data : (Array.isArray(matchRes) ? matchRes : []);
            const currentHealth = healthRes?.score !== undefined ? healthRes : null;
            const currentValuation = valuationRes?.data?.data || null;
            const currentHistory = historyRes?.data?.stageHistory || [];

            setDeal(currentDeal);
            setActivities(currentActivities);
            setMatchingLeads(currentMatchingLeads);
            setDealHealth(currentHealth);
            setValuation(currentValuation);
            setStageHistory(currentHistory);
            lastFetchRef.current = Date.now();

            if (currentDeal) {
                AsyncStorage.setItem(cacheKey, JSON.stringify({
                    deal: currentDeal,
                    activities: currentActivities,
                    matchingLeads: currentMatchingLeads,
                    dealHealth: currentHealth,
                    valuation: currentValuation,
                    stageHistory: currentHistory,
                    timestamp: Date.now()
                })).catch(e => console.warn("Cache save error:", e));
            }

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

    const stageLabel = lv(deal.stage, getLookupValue, users) || "Open"; // Safe string resolution
    const stageColorMap = isDark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT;
    const stageColor = stageColorMap[stageLabel.toLowerCase()] ?? theme.primary;
    const score = getDealScore(deal, dealHealth, isDark);
    const insight = getDealInsight(deal, activities, dealHealth);

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

                {/* Senior Professional Action Ribbon - Icons Only */}
                <View style={[styles.actionRibbonContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderColor: theme.border }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRibbonScroll}>
                        <RibbonButton 
                            icon="call" 
                            color={theme.primary} 
                            onPress={() => buyerPhone ? trackCall(buyerPhone, id!, "Deal", buyer) : Alert.alert("No Phone", "Contact number not available")} 
                        />
                        <RibbonButton 
                            icon="logo-whatsapp" 
                            color="#128C7E" 
                            onPress={() => buyerPhone ? Linking.openURL(`https://wa.me/${buyerPhone.replace(/\D/g, "")}`) : Alert.alert("No Phone", "Contact number not available")} 
                        />
                        <RibbonButton 
                            icon="chatbubble-ellipses" 
                            color="#3B82F6" 
                            onPress={() => buyerPhone ? Linking.openURL(`sms:${buyerPhone}`) : Alert.alert("No Phone", "Contact number not available")} 
                        />
                        <RibbonButton 
                            icon="mail" 
                            color="#8B5CF6" 
                            onPress={() => buyerEmail ? Linking.openURL(`mailto:${buyerEmail}`) : Alert.alert("No Email", "Email address not available")} 
                        />
                        <RibbonButton 
                            icon="people" 
                            color={isDark ? '#818CF8' : '#6366F1'} 
                            onPress={() => router.push(`/match-lead?dealId=${id}`)} 
                        />
                        <RibbonButton 
                            icon="share-social" 
                            color="#64748B" 
                            onPress={() => Alert.alert("Share", `Sharing ${unitNo} details...`)} 
                        />
                    </ScrollView>
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
                <View style={[styles.tabContent, { width: SCREEN_WIDTH }]}>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        {/* Enterprise Lifecycle Visualizer */}
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Deal Journey Intel</Text>
                                <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary }}>ACTIVE JOURNEY</Text>
                                </View>
                            </View>
                            
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                {[
                                    { id: 'open', label: 'Open', color: '#6366F1', icon: 'flag-outline' },
                                    { id: 'quote', label: 'Quote', color: '#8B5CF6', icon: 'calculator-outline' },
                                    { id: 'negotiation', label: 'Nego', color: '#F59E0B', icon: 'handshake-outline' },
                                    { id: 'booked', label: 'Booked', color: '#F97316', icon: 'home-outline' },
                                    { id: 'closed', label: 'Closed', color: '#10B981', icon: 'checkmark-circle-outline' }
                                ].map((step) => {
                                    const currentStage = (lv(deal?.stage) || 'open').toLowerCase();
                                    const isCurrent = currentStage.includes(step.id);
                                    
                                    // Aggregate activity and duration
                                    const stageActivities = Array.isArray(activities) ? activities.filter(a => {
                                        const t = new Date(a.timestamp || a.createdAt);
                                        const hist = Array.isArray(stageHistory) ? stageHistory.find(h => (h.stage || "").toLowerCase().includes(step.id)) : null;
                                        if (!hist) return false;
                                        return new Date(hist.enteredAt) <= t && (!hist.exitedAt || t <= new Date(hist.exitedAt));
                                    }) : [];

                                    const histItem = Array.isArray(stageHistory) ? stageHistory.find(h => (h.stage || "").toLowerCase().includes(step.id)) : null;
                                    const days = histItem ? Math.ceil(Math.abs((histItem.exitedAt ? new Date(histItem.exitedAt).getTime() : Date.now()) - new Date(histItem.enteredAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                    const isStuck = isCurrent && days > 14;

                                    return (
                                        <TouchableOpacity 
                                            key={step.id} 
                                            onPress={() => router.push(`/change-stage?dealId=${id}&currentStage=${(lv(deal?.stage) || "open").toLowerCase()}`)}
                                            style={[
                                                styles.enterpriseArrow, 
                                                { backgroundColor: isCurrent ? step.color + '15' : 'transparent', borderColor: isCurrent ? step.color : theme.border },
                                                isCurrent && { borderLeftWidth: 4, borderLeftColor: step.color },
                                                isStuck && { borderColor: '#EF4444', backgroundColor: '#EF444410' }
                                            ]}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '900', color: isCurrent ? (isStuck ? '#EF4444' : step.color) : theme.text }}>{step.label.toUpperCase()}</Text>
                                                <Ionicons name={step.icon as any} size={15} color={isCurrent ? step.color : theme.textLight} />
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Ionicons name="time-outline" size={11} color={theme.textLight} />
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textLight }}>{days}d</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Ionicons name="flash-outline" size={11} color={theme.textLight} />
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textLight }}>{stageActivities.length}</Text>
                                                </View>
                                            </View>
                                            {isCurrent && <View style={[styles.pulseDot, { backgroundColor: isStuck ? '#EF4444' : step.color }]} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Deal Intelligence */}
                        <View style={[styles.insightCard, { backgroundColor: score.bg, borderColor: score.color + '40' }]}>
                            <View style={[styles.insightIconBox, { backgroundColor: score.color + '20' }]}>
                                <Ionicons name="analytics" size={16} color={score.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.insightTitle, { color: score.color }]}>{score.val}% Confidence Score</Text>
                                <Text style={[styles.insightText, { color: theme.text }]}>{insight}</Text>
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

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Pricing Architecture</Text>
                            <InfoRow label="Estimated Value" value={fmt(deal.price)} icon="cash-outline" accent />
                            <InfoRow label="Quoted Amount" value={fmt(deal.quotePrice)} icon="pricetag-outline" />
                            <InfoRow label="Transaction Flow" value={lv(deal.transactionType, getLookupValue, users)} icon="swap-horizontal-outline" />
                            <InfoRow label="Flexible Portion" value={deal.flexiblePercentage ? `${deal.flexiblePercentage}%` : "—"} icon="pie-chart-outline" />
                        </View>

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
                    </ScrollView>
                </View>

                {/* 3. Details */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Property Configuration</Text>
                            <InfoRow label="Category" value={lv(deal.category || deal.inventoryId?.category, getLookupValue, users)} icon="list-outline" />
                            <InfoRow label="Sub-Category" value={lv(deal.subCategory || deal.inventoryId?.subCategory, getLookupValue, users)} icon="layers-outline" />
                            <InfoRow label="Direction" value={lv(deal.direction || deal.inventoryId?.direction, getLookupValue, users)} icon="compass-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Size & Dimensions</Text>
                            <InfoRow label="Total Area" value={getSizeLabel(deal, getLookupValue) || "—"} icon="cube-outline" accent />
                            <InfoRow label="Dimensions" value={deal.inventoryId?.dimensions || `${lv(deal.width)} x ${lv(deal.length)}`} icon="resize-outline" />
                        </View>
                    </ScrollView>
                </View>

                {/* 4. Location */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Regional Geography</Text>
                            <InfoRow label="City" value={lv(deal.city || deal.inventoryId?.city, getLookupValue, users)} icon="business-outline" />
                            <InfoRow label="Sector/Locality" value={lv(deal.sector || deal.inventoryId?.sector, getLookupValue, users)} icon="map-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Digital Signature (GPS)</Text>
                            <InfoRow label="Lat/Long" value={`${deal.inventoryId?.address?.lat || '—'} , ${deal.inventoryId?.address?.lng || '—'}`} icon="location-outline" />
                            <TouchableOpacity
                                style={[styles.googleMapsBtn, { backgroundColor: theme.primary }]}
                                onPress={() => {
                                    const lat = deal.inventoryId?.address?.lat;
                                    const lng = deal.inventoryId?.address?.lng;
                                    if (!lat || !lng) return Alert.alert("No Location", "GPS coordinates are not available.");
                                    const url = `geo:${lat},${lng}?q=${lat},${lng}`;
                                    Linking.openURL(url);
                                }}
                            >
                                <Ionicons name="map" size={18} color="#fff" />
                                <Text style={styles.googleMapsBtnText}>Navigate with Maps</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>

                {/* 5. Activities */}
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
                                <Text style={styles.emptyText}>No activities recorded.</Text>
                            ) : (
                                activities.map((act, i) => (
                                    <View key={i} style={[styles.timelineItem, { borderLeftColor: theme.border }]}>
                                        <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                                        <View style={styles.timelineBody}>
                                            <View style={styles.timelineHeader}>
                                                <Text style={[styles.timelineType, { color: theme.primary }]}>{act.type?.toUpperCase()}</Text>
                                                <Text style={styles.timelineDate}>{new Date(act.createdAt).toLocaleDateString()}</Text>
                                            </View>
                                            <Text style={[styles.timelineSubject, { color: theme.text }]}>{act.subject}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 6. Match */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Matched Leads</Text>
                            {matchingLeads.length === 0 ? (
                                <Text style={styles.emptyText}>No matches found.</Text>
                            ) : (
                                matchingLeads.map((lead: any, i: number) => (
                                    <TouchableOpacity key={i} style={[styles.matchItem, { borderBottomColor: theme.border }]} onPress={() => router.push(`/lead-detail?id=${lead._id}`)}>
                                        <Text style={[styles.matchUnit, { color: theme.text }]}>{lead.firstName} {lead.lastName}</Text>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 7. Owner */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Ownership Group</Text>
                            {(!deal.inventoryId?.owners || deal.inventoryId.owners.length === 0) ? (
                                <Text style={styles.emptyText}>No owners linked.</Text>
                            ) : (
                                deal.inventoryId.owners.map((owner: any, idx: number) => (
                                    <View key={idx} style={[styles.partyCard, { backgroundColor: theme.background, marginBottom: 10 }]}>
                                        <Text style={[styles.matchUnit, { color: theme.text }]}>{lv(owner, getLookupValue, users)}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 8. History */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Title History</Text>
                            {(!deal.inventoryId?.ownerHistory || deal.inventoryId.ownerHistory.length === 0) ? (
                                <Text style={styles.emptyText}>No history recorded.</Text>
                            ) : (
                                deal.inventoryId.ownerHistory.map((h: any, idx: number) => (
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
                                icon="cloud-upload-outline" 
                                label="Media Vault" 
                                color="#3B82F6" 
                                onPress={() => { setIsActionModalVisible(false); router.push(`/upload-media?id=${deal?.inventoryId?._id || deal?.inventoryId}`); }} 
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
                                onPress={() => { setIsActionModalVisible(false); router.push(`/geography?dealId=${id}`); }} 
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

    // Action Ribbon
    actionRibbonContainer: { 
        marginHorizontal: 20, 
        marginTop: 15, 
        borderRadius: 22, 
        borderWidth: 1, 
        overflow: 'hidden',
        paddingVertical: 14,
        paddingHorizontal: 10
    },
    enterpriseArrow: { 
        width: 135, 
        padding: 14, 
        borderRadius: 18, 
        borderWidth: 1, 
        position: 'relative',
        overflow: 'hidden'
    },
    pulseDot: { 
        position: 'absolute', 
        top: 8, 
        right: 8, 
        width: 6, 
        height: 6, 
        borderRadius: 3, 
        opacity: 0.8
    },
    actionRibbonScroll: { 
        flexGrow: 1,
        justifyContent: 'center', 
        gap: 24, 
        paddingHorizontal: 15 
    },
    ribbonBtn: { 
        width: 44,
        height: 44,
        justifyContent: 'center', 
        alignItems: 'center', 
        borderRadius: 22,
        elevation: 3,
        shadowOpacity: 0.15,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 }
    },
    ribbonLabel: { display: 'none' },

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

    // Arrow Pipeline
    arrowPipelineScroll: { gap: 12, paddingVertical: 10 },
    arrowStep: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 12, 
        paddingVertical: 10, 
        borderRadius: 14, 
        borderWidth: 1.5,
        backgroundColor: 'rgba(0,0,0,0.02)'
    },
    arrowStepActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        shadowOpacity: 0.05,
        shadowRadius: 10
    },
    arrowIconBox: { width: 26, height: 26, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    arrowLabel: { fontSize: 10, fontWeight: '900', marginLeft: 8, letterSpacing: 0.5 },
    livePulse: {
        width: 8,
        height: 8,
        borderRadius: 4,
        position: 'absolute',
        top: -4,
        right: -4,
        borderWidth: 2,
        borderColor: '#fff'
    },

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
    actionRibbonContainer: { 
        marginHorizontal: 15, 
        marginTop: 15, 
        borderRadius: 22, 
        borderWidth: 1, 
        overflow: 'hidden',
        paddingVertical: 14,
        paddingHorizontal: 10
    },
    actionRibbonScroll: { 
        flexGrow: 1,
        justifyContent: 'center', 
        gap: 20, 
        paddingHorizontal: 15 
    },
    ribbonBtn: { 
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }
    },
    enterpriseArrow: {
        padding: 15,
        borderRadius: 18,
        borderWidth: 1,
        width: 130,
        position: 'relative',
        overflow: 'hidden'
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        position: 'absolute',
        top: 10,
        right: 10,
    }
});
