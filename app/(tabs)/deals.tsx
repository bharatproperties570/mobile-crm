import React, { useCallback, useEffect, useState, useRef, useMemo, memo, Fragment } from "react";
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView,
    RefreshControl, ActivityIndicator, Alert, Linking, Modal, Pressable, Animated,
    SafeAreaView, Dimensions, Vibration, Platform, UIManager
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { getDeals, type Deal, updateDeal } from "../services/deals.service";
import { safeApiCall, safeApiCallSingle } from "../services/api.helpers";
import api from "../services/api";
import { useCallTracking } from "../context/CallTrackingContext";
import { useLookup } from "../context/LookupContext";
import { useTheme } from "../context/ThemeContext";
import FilterModal, { FilterField } from "../components/FilterModal";
import { getDealScores } from "../services/stageEngine.service";

if (Platform.OS === 'android' && UIManager?.setLayoutAnimationEnabledExperimental) {
    try { UIManager.setLayoutAnimationEnabledExperimental(true); } catch (e) { }
}

const DEAL_FILTER_FIELDS: FilterField[] = [
    { key: "stage", label: "Stage", type: "lookup", lookupType: "Stage" },
    { key: "propertyType", label: "Property Type", type: "lookup", lookupType: "PropertyType" },
    { key: "category", label: "Category", type: "lookup", lookupType: "Category" },
    { key: "transactionType", label: "Transaction Type", type: "lookup", lookupType: "TransactionType" },
    { key: "price", label: "Price Range", type: "range" },
];

const STAGE_COLORS: Record<string, string> = {
    open: "#6366F1",
    quote: "#8B5CF6",
    negotiation: "#F59E0B",
    booked: "#F97316",
    "closed won": "#10B981",
    "closed lost": "#EF4444",
    cancelled: "#64748B",
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
    const unit = deal.unitNo || deal.unitNumber || inv?.unitNo || inv?.unitNumber;

    let titleParts = [project];
    if (block) titleParts.push(block);
    if (unit) titleParts.push(unit);

    return titleParts.join(" - ") || deal.dealId || deal.name || deal.title || "Untitled Deal";
}

const DealScoreRing = memo(({ score, color = "#2563EB", size = 44 }: { score: number; color?: string; size?: number }) => {
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const toVal = (Number(score) || 0) / 100;
        Animated.timing(animatedValue, {
            toValue: isFinite(toVal) ? toVal : 0,
            duration: 1000,
            useNativeDriver: true,
        }).start();
    }, [score]);

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth, borderColor: 'rgba(241, 245, 249, 1)',
                position: 'absolute'
            }} />
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: color,
                borderLeftColor: score > 75 ? color : 'transparent',
                borderBottomColor: score > 50 ? color : 'transparent',
                borderRightColor: score > 25 ? color : 'transparent',
                borderTopColor: color,
                transform: [{ rotate: '-45deg' }]
            }} />
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#1E293B', position: 'absolute' }}>{score}</Text>
        </View>
    );
});

const SHORT_NAMES: Record<string, string> = {
    open: "Open",
    quote: "Quote",
    negotiation: "Nego",
    booked: "Book",
    "closed won": "Won",
    "closed lost": "Lost",
};

const ChevronSegment = memo(({
    label,
    count,
    percentage,
    color,
    isSelected,
    isFirst = false,
    isLast = false,
    onPress
}: {
    label: string;
    count: number;
    percentage: number;
    color: string;
    isSelected: boolean;
    isFirst?: boolean;
    isLast?: boolean;
    onPress: () => void;
}) => {
    const shortLabel = SHORT_NAMES[label.toLowerCase()] || label;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[
                styles.chevronSegment,
                { backgroundColor: isSelected ? color : color + '15' },
                isFirst && { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
                isLast && { borderTopRightRadius: 8, borderBottomRightRadius: 8 }
            ]}
        >
            <View style={styles.chevronContent}>
                <Text style={[styles.chevronLabel, { color: isSelected ? '#fff' : color }]}>{shortLabel}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                    <Text style={[styles.chevronCount, { color: isSelected ? '#fff' : color }]}>{count}</Text>
                    <Text style={[styles.chevronPercent, { color: isSelected ? '#ffffff90' : color + '90' }]}>{percentage}%</Text>
                </View>
            </View>
            {!isLast && (
                <View style={[styles.chevronArrow, { borderLeftColor: isSelected ? color : color + '15' }]} />
            )}
        </TouchableOpacity>
    );
});

const DealPipelineHorizontal = memo(({
    stages,
    activeStage,
    onStagePress
}: {
    stages: any[];
    activeStage: string | null;
    onStagePress: (label: string | null) => void;
}) => {
    const [isClosedExpanded, setIsClosedExpanded] = useState(false);

    const toggleClosed = () => {
        setIsClosedExpanded(!isClosedExpanded);
    };

    const primaryStages = stages.filter(s => !['closed won', 'closed lost'].includes(s.label));
    const closedSubStages = stages.filter(s => ['closed won', 'closed lost'].includes(s.label));

    // Aggregated Closed Data
    const closedTotal = closedSubStages.reduce((sum, s) => sum + s.count, 0);
    const totalCount = stages.reduce((sum, s) => sum + s.count, 0) || 1;
    const closedPercent = Math.round((closedTotal / totalCount) * 100);

    return (
        <View style={styles.horizontalPipelineWrapper}>
            <View style={styles.chevronContainer}>
                {primaryStages.map((s, idx) => (
                    <ChevronSegment
                        key={idx}
                        label={s.label}
                        count={s.count}
                        percentage={Math.round((s.count / totalCount) * 100)}
                        color={s.color}
                        isSelected={activeStage === s.label}
                        isFirst={idx === 0}
                        onPress={() => onStagePress(s.label)}
                    />
                ))}

                <TouchableOpacity
                    onPress={toggleClosed}
                    activeOpacity={0.9}
                    style={[
                        styles.chevronSegment,
                        { backgroundColor: activeStage?.includes('closed') ? '#10B981' : '#10B98115' },
                        { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderLeftWidth: 0 }
                    ]}
                >
                    <View style={styles.chevronContent}>
                        <Text style={[styles.chevronLabel, { color: activeStage?.includes('closed') ? '#fff' : '#10B981' }]}>Closed</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                            <Text style={[styles.chevronCount, { color: activeStage?.includes('closed') ? '#fff' : '#10B981' }]}>{closedTotal}</Text>
                            <Text style={[styles.chevronPercent, { color: activeStage?.includes('closed') ? '#ffffff90' : '#10B98190' }]}>{closedPercent}%</Text>
                            <Ionicons
                                name={isClosedExpanded ? "chevron-up" : "chevron-down"}
                                size={10}
                                color={activeStage?.includes('closed') ? '#fff' : '#10B981'}
                                style={{ marginLeft: 2 }}
                            />
                        </View>
                    </View>
                </TouchableOpacity>
            </View>

            {isClosedExpanded && (
                <View style={styles.compactSubRow}>
                    {closedSubStages.map((s, idx) => (
                        <TouchableOpacity
                            key={idx}
                            onPress={() => onStagePress(s.label)}
                            style={[
                                styles.subStageChip,
                                { backgroundColor: activeStage === s.label ? s.color : s.color + '15' }
                            ]}
                        >
                            <Text style={[styles.subStageText, { color: activeStage === s.label ? '#fff' : s.color }]}>
                                {SHORT_NAMES[s.label] || s.label}: {s.count}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
});

function formatAmount(amount?: any): string {
    const val = Number(amount) || 0;
    if (val === 0) return "—";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${val.toLocaleString("en-IN")}`;
}

const DealCard = memo(({
    deal,
    onPress,
    onLongPress,
    onCall,
    onWhatsApp,
    onSMS,
    onEmail,
    onMenuPress,
    getLookupValue,
    liveScore,
}: {
    deal: Deal;
    onPress: () => void;
    onLongPress: () => void;
    onCall: () => void;
    onWhatsApp: () => void;
    onSMS: () => void;
    onEmail: () => void;
    onMenuPress: () => void;
    getLookupValue: (type: string, id: any) => string;
    liveScore?: { score: number; color: string; label: string };
}) => {
    const { theme } = useTheme();
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
    // Live backend score wins; fallback to deal.score (usually 0) if not yet loaded
    const rawScore = liveScore ? liveScore.score : (deal.score || (deal as any).dealScore || 0);
    let typeColor = liveScore ? liveScore.color : "#64748B"; // cold
    if (!liveScore) {
        if (rawScore >= 81) typeColor = "#7C3AED";
        else if (rawScore >= 61) typeColor = "#EF4444";
        else if (rawScore >= 31) typeColor = "#F59E0B";
    }

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions} friction={2}>
            <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.9}>
                <View style={[styles.cardAccent, { backgroundColor: typeColor }]} />
                <View style={styles.cardMain}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardIdentity}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.dealUnitNumber}>{deal.unitNo || deal.unitNumber || (typeof deal.inventoryId === 'object' ? (deal.inventoryId?.unitNo || deal.inventoryId?.unitNumber) : "") || "N/A"}</Text>
                                <View style={[styles.typePill, { backgroundColor: color + '15' }]}>
                                    <Text style={[styles.typePillText, { color: color }]}>
                                        {[
                                            getLookupValue("Unit Type", deal.unitType || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.unitType : "")),
                                            getLookupValue("Property Type", deal.subCategory || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.subCategory : ""))
                                        ].filter(t => t && t !== "—").join(' · ') || "Property"}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.dealProjectContainer}>
                                <Text numberOfLines={1}>
                                    <Text style={styles.dealProjectName}>{deal.projectName || (deal.projectId && typeof deal.projectId === 'object' ? (deal.projectId as any).name : "") || "Unnamed Project"}</Text>
                                    <Text style={styles.dealBlockName}> • {deal.block || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.block : "") || "No Block"}</Text>
                                </Text>
                            </View>
                            {/* Size label below Project Name */}
                            {(deal.size || deal.sizeUnit || (typeof deal.inventoryId === 'object' && (deal.inventoryId?.size || deal.inventoryId?.sizeUnit))) && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                    <Ionicons name="expand-outline" size={10} color={theme.textLight} />
                                    <Text style={{ fontSize: 10, color: theme.textLight, fontWeight: '600' }}>
                                        {deal.size || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.size : "")} {deal.sizeUnit || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.sizeUnit : "")}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.headerRight}>
                            <View style={styles.qualityBox}>
                                <DealScoreRing score={rawScore} color={typeColor} size={32} />
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                <Text style={[styles.dealAmount, { color: color, fontSize: 14 }]}>{formatAmount(amount)}</Text>
                                <TouchableOpacity style={styles.menuTrigger} onPress={onMenuPress}>
                                    <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View style={styles.cardFooter}>
                        {/* Owner/Associate Data (Marquee) */}
                        <View style={{ flex: 1, overflow: 'hidden', marginRight: 12 }}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ alignItems: 'center' }}
                            >
                                <Ionicons name="people-outline" size={12} color="#94A3B8" />
                                <Text style={[styles.locationText, { marginLeft: 4 }]} numberOfLines={1}>
                                    {(() => {
                                        const owner = resolveName(deal.owner);
                                        const associate = resolveName(deal.associatedContact);
                                        const parts = [];
                                        if (owner && owner !== "—") parts.push(`Owner: ${owner}`);
                                        if (associate && associate !== "—") parts.push(`Associate: ${associate}`);
                                        return parts.join(" | ") || "No Owner/Associate";
                                    })()}
                                </Text>
                            </ScrollView>
                        </View>

                        {/* Stage + Date Stack on the Right */}
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <View style={[styles.stagePill, { backgroundColor: color + "15", paddingVertical: 2, paddingHorizontal: 6 }]}>
                                <View style={[styles.stageDot, { backgroundColor: color, width: 4, height: 4 }]} />
                                <Text style={[styles.stageText, { color, fontSize: 9 }]}>{resolveName(deal.stage)}</Text>
                            </View>
                            {deal.createdAt && (
                                <Text style={styles.dateText}>{new Date(deal.createdAt).toLocaleDateString("en-IN")}</Text>
                            )}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
});

export default function DealsScreen() {
    const { trackCall } = useCallTracking();
    const router = useRouter();
    const { getLookupValue } = useLookup();
    const [deals, setDeals] = useState<Deal[]>([]);
    const [search, setSearch] = useState("");
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState<any>({});
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

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkAssignVisible, setBulkAssignVisible] = useState(false);
    const [dealScores, setDealScores] = useState<Record<string, { score: number; color: string; label: string }>>({});
    const [contactPickerVisible, setContactPickerVisible] = useState(false);
    const [availableContacts, setAvailableContacts] = useState<any[]>([]);
    const [pendingAction, setPendingAction] = useState<{ type: string; deal: Deal } | null>(null);
    const [activePipelineStage, setActivePipelineStage] = useState<string | null>(null);

    const pipelineStats = useMemo(() => {
        const stats: Record<string, number> = {};
        deals.forEach(d => {
            let stage = (resolveName(d.stage) || "open").toLowerCase();
            if (stage === 'closed' || stage === 'closed won') stage = 'closed won';
            if (stage === 'closed lost') stage = 'closed lost';
            stats[stage] = (stats[stage] || 0) + 1;
        });

        // Logical pipeline sequence
        const order = ['open', 'quote', 'negotiation', 'booked', 'closed won', 'closed lost'];
        return order.map(s => ({
            label: s,
            count: stats[s] || 0,
            color: STAGE_COLORS[s] || "#64748B"
        }));
    }, [deals]);

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
            // Fetch live deal scores from Stage Engine (fire-and-forget)
            if (!shouldAppend) {
                getDealScores().then(scores => setDealScores(scores)).catch(() => { });
            }
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

    const filteredDeals = useMemo(() => {
        return deals.filter(deal => {
            // Search filter
            if (search && !getDealTitle(deal).toLowerCase().includes(search.toLowerCase())) return false;
            // Stage filter
            if (filters.stage?.length > 0 && !filters.stage.includes(deal.stage)) return false;
            // Range filters
            if (filters.priceMin && (deal.price || 0) < Number(filters.priceMin)) return false;
            if (filters.priceMax && (deal.price || 0) > Number(filters.priceMax)) return false;
            // Lookup filters (category, etc)
            if (filters.category?.length > 0 && !filters.category.includes(deal.category)) return false;
            if (filters.propertyType?.length > 0 && !filters.propertyType.includes(deal.propertyType)) return false;
            if (filters.transactionType?.length > 0 && !filters.transactionType.includes(deal.transactionType)) return false;

            // Pipeline stage filter
            if (activePipelineStage) {
                let s = (resolveName(deal.stage) || "open").toLowerCase();
                if (s === 'closed' || s === 'closed won') s = 'closed won';
                if (s === 'closed lost') s = 'closed lost';
                if (s !== activePipelineStage.toLowerCase()) return false;
            }

            return true;
        });
    }, [deals, search, filters, activePipelineStage]);

    const filtersCount = Object.keys(filters).filter(k => filters[k] && (Array.isArray(filters[k]) ? filters[k].length > 0 : true)).length;

    const handleSearch = (text: string) => {
        setSearch(text);
    };

    const renderHeader = () => (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setActivePipelineStage(null)}
                >
                    <Text style={styles.headerTitle}>Deals</Text>
                    <Text style={styles.headerSubtitle}>{filteredDeals.length} active opportunities</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/add-deal")}>
                    <Ionicons name="add" size={26} color="#fff" />
                </TouchableOpacity>
            </View>

            {pipelineStats.length > 0 && (
                <DealPipelineHorizontal
                    stages={pipelineStats}
                    activeStage={activePipelineStage}
                    onStagePress={setActivePipelineStage}
                />
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
                <TouchableOpacity onPress={() => setShowFilterModal(true)} style={[styles.filterBtn, filtersCount > 0 && { backgroundColor: '#2563EB15' }]}>
                    <Ionicons name="filter" size={22} color={filtersCount > 0 ? "#2563EB" : "#94A3B8"} />
                    {filtersCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{filtersCount}</Text></View>}
                </TouchableOpacity>
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

    // Communication Logic with Multi-Contact Support for Deals
    const getContactsForDeal = (deal: Deal) => {
        const contacts: any[] = [];
        const seen = new Set();

        const addContact = (name: string, phone: string | undefined, email: string | undefined, type: string) => {
            const key = `${name}-${phone}-${email}`;
            if (!seen.has(key) && (phone || email)) {
                contacts.push({ name, phone, email, type });
                seen.add(key);
            }
        };

        // 1. Associated Contact
        if (deal.associatedContact && typeof deal.associatedContact === 'object') {
            const c = deal.associatedContact as any;
            addContact(resolveName(c) || "Client", c.phone || c.mobile, c.email, 'Client');
        }

        // 2. Owner stakeholder
        if (deal.owner && typeof deal.owner === 'object') {
            const o = deal.owner as any;
            addContact(resolveName(o) || "Owner", o.phone || o.mobile, o.email, 'Owner');
        }

        // 3. Party Structure
        if (deal.partyStructure) {
            const ps = deal.partyStructure;
            if (ps.buyer) addContact(resolveName(ps.buyer) || "Buyer", ps.buyer.phone || ps.buyer.mobile, ps.buyer.email, 'Buyer');
            if (ps.owner) addContact(resolveName(ps.owner) || "Seller", ps.owner.phone || ps.owner.mobile, ps.owner.email, 'Seller');
            if (ps.channelPartner) addContact(resolveName(ps.channelPartner) || "CP", ps.channelPartner.phone || ps.channelPartner.mobile, ps.channelPartner.email, 'CP');
            if (ps.internalRM) addContact(resolveName(ps.internalRM) || "RM", ps.internalRM.phone || ps.internalRM.mobile, ps.internalRM.email, 'Internal RM');
        }

        return contacts;
    };

    const handleCommunicationAction = (deal: Deal, actionType: string) => {
        const contacts = getContactsForDeal(deal);

        if (contacts.length === 0) {
            Alert.alert("No Contact", "No phone number or email linked to this deal.");
            return;
        }

        if (contacts.length === 1) {
            executeAction(contacts[0], actionType, deal);
        } else {
            setAvailableContacts(contacts);
            setPendingAction({ type: actionType, deal });
            setContactPickerVisible(true);
        }
    };

    const executeAction = (contact: any, type: string, deal: Deal) => {
        const phone = contact.phone?.replace(/[^0-9]/g, "");
        const email = contact.email;

        switch (type) {
            case 'CALL':
                if (!contact.phone) {
                    Alert.alert("Error", "No phone number for this contact.");
                    return;
                }
                trackCall(contact.phone, deal._id, "Deal", getDealTitle(deal));
                break;
            case 'WHATSAPP':
                if (!phone) return;
                Linking.openURL(`whatsapp://send?phone=${phone.length === 10 ? "91" + phone : phone}`);
                break;
            case 'SMS':
                if (!contact.phone) return;
                Linking.openURL(`sms:${contact.phone}`);
                break;
            case 'EMAIL':
                if (!email) {
                    Alert.alert("No Email", "No email linked to this contact.");
                    return;
                }
                Linking.openURL(`mailto:${email}`);
                break;
        }
    };

    const handleCall = (deal: Deal) => handleCommunicationAction(deal, 'CALL');
    const handleWhatsApp = (deal: Deal) => handleCommunicationAction(deal, 'WHATSAPP');
    const handleSMS = (deal: Deal) => handleCommunicationAction(deal, 'SMS');
    const handleEmail = (deal: Deal) => handleCommunicationAction(deal, 'EMAIL');

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
                    data={filteredDeals}
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
                            onEmail={() => handleEmail(item)}
                            onMenuPress={() => openHub(item)}
                            getLookupValue={getLookupValue}
                            liveScore={dealScores[item._id]}
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

            {/* Contact Picker Modal */}
            <Modal transparent visible={contactPickerVisible} animationType="fade" onRequestClose={() => setContactPickerVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setContactPickerVisible(false)}>
                    <View style={styles.contactPickerSheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Select Contact</Text>
                        <Text style={styles.sheetSub}>Choose who to {pendingAction?.type.toLowerCase()}</Text>

                        <View style={{ marginTop: 10 }}>
                            {availableContacts.map((contact, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.contactItem}
                                    onPress={() => {
                                        executeAction(contact, pendingAction!.type, pendingAction!.deal);
                                        setContactPickerVisible(false);
                                    }}
                                >
                                    <View style={styles.contactInfo}>
                                        <View style={[styles.contactAvatar, { backgroundColor: '#6366F120' }]}>
                                            <Ionicons
                                                name={contact.type === 'Internal RM' ? "business" : "person"}
                                                size={18}
                                                color="#6366F1"
                                            />
                                        </View>
                                        <View>
                                            <Text style={styles.contactName}>{contact.name}</Text>
                                            <Text style={styles.contactRole}>{contact.type} • {contact.phone || contact.email || "No Details"}</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Pressable>
            </Modal>

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

            <FilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={setFilters}
                initialFilters={filters}
                fields={DEAL_FILTER_FIELDS}
            />
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
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 8,
        paddingHorizontal: 16, height: 48, backgroundColor: "#F8FAFC",
        borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0"
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
    cardMain: { flex: 1, padding: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    cardIdentity: { flex: 1 },
    dealId: { fontSize: 10, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", marginBottom: 2 },
    dealProjectContainer: { marginTop: 2 },
    dealProjectName: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
    dealBlockName: { fontSize: 10, fontWeight: "500", color: "#CBD5E1" },
    dealUnitNumber: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
    typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    typePillText: { fontSize: 9, fontWeight: "800" },
    dealTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    dealAmount: { fontSize: 16, fontWeight: "900" },

    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    stagePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 6 },
    stageDot: { width: 6, height: 6, borderRadius: 3 },
    stageText: { fontSize: 11, fontWeight: "800", textTransform: 'uppercase' },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginLeft: 12 },
    clientName: { fontSize: 13, color: "#64748B", fontWeight: "700" },

    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    menuTrigger: { padding: 4, marginRight: -4 },
    qualityBox: { marginRight: 4 },
    cardQuickActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    quickActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F8FAFC", justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: "#F1F5F9" },

    // Pipeline Styles
    pipelineWrapper: { marginBottom: 12 },
    pipelineScroll: { paddingHorizontal: 20, gap: 8 },
    pipelineChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    pipelineChipActive: { backgroundColor: '#2563EB15', borderColor: '#2563EB' },
    pipelineChipText: { fontSize: 11, fontWeight: '800', color: '#64748B' },
    pipelineChipTextActive: { color: '#2563EB' },
    // Compact Arrow Pipeline Styles
    horizontalPipelineWrapper: { marginHorizontal: 16, marginBottom: 12 },
    chevronContainer: {
        flexDirection: 'row',
        height: 64,
        backgroundColor: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    chevronSegment: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 4,
        position: 'relative',
        zIndex: 1
    },
    chevronContent: {
        alignItems: 'center',
        justifyContent: 'center'
    },
    chevronLabel: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: -0.2
    },
    chevronCount: {
        fontSize: 12,
        fontWeight: '900',
    },
    chevronPercent: {
        fontSize: 8,
        fontWeight: '700',
    },
    chevronArrow: {
        position: 'absolute',
        right: -10,
        width: 20,
        height: '100%',
        backgroundColor: 'transparent',
        borderLeftWidth: 10,
        borderTopWidth: 32,
        borderBottomWidth: 32,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        zIndex: 2
    },
    compactSubRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8
    },
    subStageChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    subStageText: {
        fontSize: 10,
        fontWeight: '800'
    },

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
    filterBtn: { padding: 8, marginLeft: 8 },
    filterBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#2563EB', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
    filterBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
    fab: {
        position: "absolute", bottom: 30, right: 20, width: 56, height: 56,
        borderRadius: 28, backgroundColor: "#2563EB", justifyContent: "center",
        alignItems: "center", elevation: 4, shadowColor: "#000",
        shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },

    // Contact Picker (Synced with Inventory)
    contactPickerSheet: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: 60, width: '100%' },
    contactItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    contactInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    contactAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    contactName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    contactRole: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
});
