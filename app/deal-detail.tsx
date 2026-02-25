import { useCallback, useEffect, useState, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, SafeAreaView, Animated, Linking, Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./context/ThemeContext";
import { useCallTracking } from "./context/CallTrackingContext";
import api from "./services/api";
import { getActivities } from "./services/activities.service";
import { getMatchingLeads } from "./services/leads.service";
import { getDealById, type Deal } from "./services/deals.service";
import { useLookup } from "./context/LookupContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS = ["Details", "Financial", "Activities", "Match", "Owner"];

function fmt(amount?: number): string {
    if (!amount) return "—";
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
}

function lv(field: unknown): string {
    if (field === null || field === undefined || field === "" || field === "null" || field === "undefined") return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field && field.lookup_value) return (field as any).lookup_value;
        if ("fullName" in field && field.fullName) return (field as any).fullName;
        if ("name" in field && field.name) return (field as any).name;
    }
    const str = String(field).trim();
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

function getDealScore(deal: any) {
    let score = deal.dealProbability || 50;
    const stage = lv(deal.stage).toLowerCase();
    if (stage === "negotiation") score += 10;
    if (stage === "booked") score += 30;

    score = Math.min(score, 100);
    const color = score > 80 ? "#10B981" : score > 50 ? "#F59E0B" : "#EF4444";
    return { val: score, color };
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

const STAGE_COLORS: Record<string, string> = {
    open: "#3B82F6", quote: "#8B5CF6", negotiation: "#F59E0B",
    booked: "#10B981", closed: "#059669", cancelled: "#EF4444",
};

export default function DealDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { trackCall } = useCallTracking();
    const [deal, setDeal] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [matchingLeads, setMatchingLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    const scrollX = useRef(new Animated.Value(0)).current;
    const tabScrollViewRef = useRef<ScrollView>(null);
    const contentScrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [dealRes, actRes, matchRes] = await Promise.all([
                getDealById(id as string),
                getActivities({ entityId: id, limit: 20 }),
                getMatchingLeads(id as string)
            ]);

            const currentDeal = dealRes?.data?.deal || dealRes?.data || dealRes;
            setDeal(currentDeal);
            setActivities(Array.isArray(actRes?.data) ? actRes.data : (Array.isArray(actRes) ? actRes : []));
            setMatchingLeads(Array.isArray(matchRes?.data) ? matchRes.data : (Array.isArray(matchRes) ? matchRes : []));

            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

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

    const stageLabel = deal.stage ?? "Open";
    const stageColor = STAGE_COLORS[stageLabel.toLowerCase()] ?? theme.primary;
    const score = getDealScore(deal);

    // Header Data
    const projectName = lv(deal.projectName) !== "—" ? lv(deal.projectName) : lv(deal.projectId);
    const unitNo = lv(deal.unitNo || deal.unitNumber) !== "—" ? lv(deal.unitNo || deal.unitNumber) : lv(deal.inventoryId?.unitNumber || deal.inventoryId?.unitNo);
    const unitType = lv(deal.unitType) !== "—" ? lv(deal.unitType) : lv(deal.inventoryId?.unitType);
    const block = lv(deal.block) !== "—" ? lv(deal.block) : lv(deal.inventoryId?.block);
    const assignedTo = lv(deal.assignedTo);
    const intent = lv(deal.intent);

    const buyer = lv(deal.partyStructure?.buyer) !== "—" ? lv(deal.partyStructure?.buyer) : lv(deal.owner);
    const buyerPhone = deal.partyStructure?.buyer?.mobile || deal.owner?.mobile || "";
    const buyerEmail = deal.partyStructure?.buyer?.email || deal.owner?.email || "";

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Premium SaaS Header */}
            <SafeAreaView style={[styles.headerCard, { backgroundColor: theme.card }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCircle}>
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
                            <View style={[styles.miniBadge, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.miniBadgeText, { color: theme.primary }]}>{projectName}</Text>
                            </View>
                            {block !== "—" && (
                                <View style={[styles.miniBadge, { backgroundColor: theme.border + '40' }]}>
                                    <Text style={[styles.miniBadgeText, { color: theme.textLight }]}>Block {block}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.scoreContainer}>
                        <View style={[styles.scoreRing, { borderColor: score.color + '40' }]}>
                            <Text style={[styles.scoreValue, { color: score.color }]}>{score.val}</Text>
                            <Text style={[styles.scoreLabel, { color: theme.textLight }]}>CONF.</Text>
                        </View>
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
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>TEAM</Text>
                        <View style={styles.strategyValueRow}>
                            <Ionicons name="people-outline" size={14} color="#6366F1" />
                            <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                {lv(deal.team)}
                            </Text>
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
                        { icon: 'call', color: theme.primary, onPress: () => trackCall(buyerPhone, id!, "Deal", buyer) },
                        { icon: 'chatbubble-ellipses', color: '#3B82F6', onPress: () => Linking.openURL(`sms:${buyerPhone.replace(/\D/g, "")}`) },
                        { icon: 'logo-whatsapp', color: '#128C7E', onPress: () => Linking.openURL(`https://wa.me/${buyerPhone.replace(/\D/g, "")}`) },
                        { icon: 'mail', color: '#EA4335', onPress: () => Linking.openURL(`mailto:${buyerEmail}`) },
                        { icon: 'calendar', color: '#6366F1', onPress: () => router.push(`/add-activity?id=${id}&type=Deal`) },
                    ].map((action, i) => (
                        <TouchableOpacity key={i} style={[styles.modernHubBtn, { backgroundColor: action.color }]} onPress={action.onPress}>
                            <Ionicons name={action.icon as any} size={20} color="#fff" />
                        </TouchableOpacity>
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
                {/* 1. Details */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        {/* AI Insight Card */}
                        <View style={[styles.insightCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '20' }]}>
                            <View style={[styles.insightIconBox, { backgroundColor: theme.primary + '20' }]}>
                                <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
                            </View>
                            <Text style={[styles.insightText, { color: theme.text }]}>{getDealInsight(deal, activities)}</Text>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Property Configuration</Text>
                            <InfoRow label="Category" value={lv(deal.category || deal.inventoryId?.category)} icon="list-outline" />
                            <InfoRow label="Sub-Category" value={lv(deal.subCategory || deal.inventoryId?.subCategory)} icon="layers-outline" />
                            <InfoRow label="Orientation" value={lv(deal.orientation || deal.inventoryId?.orientation)} icon="compass-outline" />
                            <InfoRow label="Built-up Details" value={lv(deal.builtupDetails || deal.inventoryId?.builtupDetails)} icon="construct-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Property Size</Text>
                            <InfoRow label="Length" value={lv(deal.length || deal.inventoryId?.length)} icon="resize-outline" />
                            <InfoRow label="Width" value={lv(deal.width || deal.inventoryId?.width)} icon="resize-outline" />
                            <InfoRow label="Total Size" value={deal.size || deal.inventoryId?.size ? `${deal.size || deal.inventoryId?.size} ${deal.sizeUnit || deal.inventoryId?.sizeUnit || ""}` : "—"} icon="cube-outline" accent />
                        </View>
                    </ScrollView>
                </View>

                {/* 2. Financial */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Pricing Details</Text>
                            <InfoRow label="Expected Price" value={fmt(deal.price)} icon="cash-outline" accent />
                            <InfoRow label="Quote Price" value={fmt(deal.quotePrice)} icon="pricetag-outline" />
                            <InfoRow
                                label={`Price per ${lv(deal.sizeUnit || deal.inventoryId?.sizeUnit) || "Unit"}`}
                                value={deal.ratePrice ? `${fmt(deal.ratePrice)}` : "—"}
                                icon="calculator-outline"
                            />
                            <InfoRow label="Pricing Nature" value={deal.pricingNature?.negotiable ? "Negotiable" : "Fixed"} icon="chatbubbles-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Deal Summary</Text>
                            <InfoRow label="Transaction Type" value={lv(deal.transactionType)} icon="repeat-outline" />
                            <InfoRow label="Deal Type" value={lv(deal.dealType)} icon="briefcase-outline" />
                            <InfoRow label="Deal Source" value={lv(deal.source)} icon="compass-outline" />
                            {deal.commission && (
                                <InfoRow label="Expected Commission" value={fmt(deal.commission.expectedAmount)} icon="wallet-outline" accent />
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 3. Activities */}
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
                                            {act.details?.note && <Text style={[styles.timelineNote, { color: theme.textLight }]}>{act.details.note}</Text>}
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 4. Match */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Matching Leads</Text>
                            {matchingLeads.length === 0 ? (
                                <Text style={styles.emptyText}>No matching leads found for this configuration.</Text>
                            ) : (
                                matchingLeads.map((lead, i) => (
                                    <TouchableOpacity key={i} style={[styles.matchItem, { borderBottomColor: theme.border }]} onPress={() => router.push(`/lead-detail?id=${lead._._id || lead._id}`)}>
                                        <View style={styles.matchLeft}>
                                            <Text style={[styles.matchUnit, { color: theme.text }]}>{lead.firstName} {lead.lastName}</Text>
                                            <Text style={[styles.matchProject, { color: theme.textLight }]}>{lv(lead.requirement)} • Budget: {lv(lead.budget)}</Text>
                                        </View>
                                        <View style={styles.matchRight}>
                                            <View style={[styles.relationBadge, { backgroundColor: theme.primary + '10' }]}>
                                                <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '700' }}>{lead.score ? `${lead.score}% MATCH` : "MATCH"}</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 5. Owner */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Associated Parties</Text>
                            {/* Buyer Party */}
                            <TouchableOpacity style={[styles.partyCard, { backgroundColor: theme.background }]} onPress={() => {
                                const buyerId = deal.partyStructure?.buyer?._id || deal.owner?._id;
                                if (buyerId) router.push(`/contact-detail?id=${buyerId}`);
                            }}>
                                <View style={styles.matchLeft}>
                                    <Text style={[styles.matchUnit, { color: theme.text }]}>{buyer}</Text>
                                    <Text style={[styles.matchProject, { color: theme.textLight }]}>Buyer / Primary Contact</Text>
                                </View>
                                <View style={[styles.relationBadge, { backgroundColor: '#10B981' + '10' }]}>
                                    <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '700' }}>BUYER</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Associate RM */}
                            <View style={[styles.partyCard, { backgroundColor: theme.background, marginTop: 12 }]}>
                                <View style={styles.matchLeft}>
                                    <Text style={[styles.matchUnit, { color: theme.text }]}>{lv(deal.assignedTo?.name || deal.assignedTo?.fullName || deal.assignedTo)}</Text>
                                    <Text style={[styles.matchProject, { color: theme.textLight }]}>Assigned Relationship Manager</Text>
                                </View>
                                <View style={[styles.relationBadge, { backgroundColor: theme.primary + '10' }]}>
                                    <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '700' }}>RM</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>System Info</Text>
                            <InfoRow label="Deal ID" value={deal.dealId} icon="finger-print-outline" />
                            <InfoRow label="Created By" value={lv(deal.owner?.name || deal.owner)} icon="shield-checkmark-outline" />
                            <InfoRow label="Visible To" value={lv(deal.visibleTo)} icon="eye-outline" />
                            <InfoRow label="Created On" value={new Date(deal.createdAt).toLocaleDateString()} icon="calendar-outline" />
                        </View>
                    </ScrollView>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, fontWeight: "600" },

    // Header Styles
    headerCard: { paddingBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 5, zIndex: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 15 },
    backBtnCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
    headerTitleContainer: { flex: 1 },
    headerNamePremium: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    headerBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    miniBadgeText: { fontSize: 10, fontWeight: '800' },

    // Score/Insight Ring
    scoreContainer: { width: 50, height: 50 },
    scoreRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    scoreValue: { fontSize: 16, fontWeight: '900' },
    scoreLabel: { fontSize: 7, fontWeight: '800', marginTop: -2 },

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
    modernActionHub: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, paddingVertical: 15 },
    modernHubBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },

    // Tabs
    tabsScroll: { paddingHorizontal: 20, gap: 25 },
    tabItem: { paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabLabel: { fontSize: 14, fontWeight: '800' },

    // Content
    tabContent: { width: SCREEN_WIDTH },
    innerScroll: { padding: 20, paddingBottom: 100 },
    card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
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
    timelineDate: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
    timelineSubject: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    timelineNote: { fontSize: 12, lineHeight: 18 },

    // Match / Party Items
    matchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    partyCard: { padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center' },
    matchLeft: { flex: 1 },
    matchUnit: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
    matchProject: { fontSize: 12, fontWeight: '600' },
    matchRight: { alignItems: 'flex-end' },
    relationBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
});
