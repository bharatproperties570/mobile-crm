import React, { useCallback, useEffect, useState, useRef, useMemo, memo, Fragment } from "react";
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView,
    RefreshControl, ActivityIndicator, Alert, Linking, Modal, Pressable, Animated,
    SafeAreaView, Dimensions, Vibration, Platform, UIManager
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { getDeals, type Deal, updateDeal } from "@/services/deals.service";
import { safeApiCall, safeApiCallSingle } from "@/services/api.helpers";
import api from "@/services/api";
import { useCallTracking } from "@/context/CallTrackingContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import FilterModal, { FilterField } from "@/components/FilterModal";
import { getDealScores } from "@/services/stageEngine.service";
import { formatSize, formatPrice, getSizeLabel } from "@/utils/format.utils";

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

const STAGE_COLORS_LIGHT: Record<string, string> = {
    open: "#6366F1",
    quote: "#8B5CF6",
    negotiation: "#F59E0B",
    booked: "#F97316",
    "closed won": "#10B981",
    "closed lost": "#EF4444",
    cancelled: "#64748B",
    dormant: "#64748B",
};

const STAGE_COLORS_DARK: Record<string, string> = {
    open: "#818CF8",
    quote: "#A78BFA",
    negotiation: "#FBBF24",
    booked: "#FB923C",
    "closed won": "#34D399",
    "closed lost": "#F87171",
    cancelled: "#94A3B8",
    dormant: "#94A3B8",
};

function resolveName(field: unknown, getLookupValue?: (type: string, val: any) => string, findUser?: (id: string) => any): string {
    if (!field) return "—";

    // Handle Array of objects/IDs
    if (Array.isArray(field)) {
        return field.map(item => resolveName(item, getLookupValue, findUser)).filter(name => name && name !== "—").join(", ") || "—";
    }

    if (typeof field === "object" && field !== null) {
        const obj = field as any;
        if (obj.lookup_value) return obj.lookup_value;
        if (obj.fullName) return obj.fullName;
        if (obj.name) return obj.name;
        if (obj.firstName) return [obj.firstName, obj.lastName].filter(Boolean).join(" ");
        if (obj._id && getLookupValue) {
            const resolved = getLookupValue("Any", obj._id);
            if (resolved && resolved !== obj._id) return resolved;
        }
    }

    // If it's a string ID (24-char hex)
    const str = String(field).trim();
    if (/^[a-f0-9]{24}$/i.test(str)) {
        // 1. Try Lookups
        if (getLookupValue) {
            const resolved = getLookupValue("Any", str);
            if (resolved && resolved !== str && resolved !== "—") return resolved;
        }
        // 2. Try Users
        if (findUser) {
            const user = findUser(str);
            if (user) return user.fullName || user.name || str;
        }
        // If still a hex ID and not resolved, return placeholder for professional look
        return "—";
    }

    return str;
}

function getDealTitle(deal: Deal, getLookupValue?: (type: string, val: any) => string, findUser?: (id: string) => any): string {
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
    const { theme, isDarkMode } = useTheme();
    const isDark = isDarkMode;
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const animatedValue = useRef(new Animated.Value(0)).current;

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(241, 245, 249, 1)',
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
            <Text style={{ fontSize: 9, fontWeight: '800', color: theme.text, position: 'absolute' }}>{score}</Text>
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
    dormant: "Dorm",
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
    const { theme, isDarkMode } = useTheme();
    const isDark = isDarkMode;
    const shortLabel = SHORT_NAMES[label.toLowerCase()] || label;
    const bgOpacity = isDark ? '25' : '15';

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[
                styles.chevronSegment,
                { backgroundColor: isSelected ? color : color + bgOpacity },
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
                <View style={[styles.chevronArrow, { borderLeftColor: isSelected ? color : color + bgOpacity }]} />
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
    const { theme, isDarkMode } = useTheme();
    const isDark = isDarkMode;
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
        <View style={[styles.horizontalPipelineWrapper, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
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
                        { backgroundColor: activeStage?.includes('closed') ? theme.success : theme.success + (isDark ? '25' : '15') },
                        { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderLeftWidth: 0 }
                    ]}
                >
                    <View style={styles.chevronContent}>
                        <Text style={[styles.chevronLabel, { color: activeStage?.includes('closed') ? '#fff' : theme.success }]}>Closed</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                            <Text style={[styles.chevronCount, { color: activeStage?.includes('closed') ? '#fff' : theme.success }]}>{closedTotal}</Text>
                            <Text style={[styles.chevronPercent, { color: activeStage?.includes('closed') ? '#ffffff90' : theme.success + '90' }]}>{closedPercent}%</Text>
                            <Ionicons
                                name={isClosedExpanded ? "chevron-up" : "chevron-down"}
                                size={10}
                                color={activeStage?.includes('closed') ? '#fff' : theme.success}
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
                                { backgroundColor: activeStage === s.label ? s.color : s.color + (theme.background === '#0F172A' ? '25' : '10') }
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
    return formatPrice(amount);
}

const DealCard = memo(({
    deal,
    idx,
    onPress,
    onLongPress,
    onCall,
    onWhatsApp,
    onSMS,
    onEmail,
    onMenuPress,
    getLookupValue,
    findUser,
    liveScore,
}: {
    deal: Deal;
    idx: number;
    onPress: () => void;
    onLongPress: () => void;
    onCall: () => void;
    onWhatsApp: () => void;
    onSMS: () => void;
    onEmail: () => void;
    onMenuPress: () => void;
    getLookupValue: (type: string, id: any) => string;
    findUser?: (id: string) => any;
    liveScore?: { score: number; color: string; label: string };
}) => {
    const { theme, isDarkMode } = useTheme();
    const isDark = isDarkMode;
    const stageStr = (resolveName(deal.stage, getLookupValue, findUser) || "open").toLowerCase();
    const stageColorMap = isDark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT;
    const color = stageColorMap[stageStr] ?? (isDark ? "#94A3B8" : "#6366F1");
    const amount = deal.price || deal.amount || 0;

    const renderRightActions = () => (
        <View style={styles.rightActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.primary }]} onPress={onCall}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.textSecondary }]} onPress={onSMS}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.leftActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.success }]} onPress={onWhatsApp}>
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: isDark ? '#818CF8' : '#6366F1' }]}
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

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions} friction={2}>
            <TouchableOpacity style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.9}>
                <View style={[styles.cardAccent, { backgroundColor: color }]} />
                <View style={styles.cardMain}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardIdentity}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 }}>
                                <Text style={[styles.dealUnitNumber, { color: theme.text }]}>{deal.unitNo || deal.unitNumber || (typeof deal.inventoryId === 'object' ? (deal.inventoryId?.unitNo || deal.inventoryId?.unitNumber) : "") || "N/A"}</Text>
                                <View style={[styles.typePill, { backgroundColor: color + (isDark ? '25' : '15') }]}>
                                    <Text style={[styles.typePillText, { color: color }]}>
                                        {[
                                            getLookupValue("UnitType", deal.unitType || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.unitType : "")),
                                            getLookupValue("SubCategory", deal.subCategory || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.subCategory : ""))
                                        ].filter(t => t && t !== "—").join(' · ') || "Property"}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.dealProjectContainer}>
                                <Text numberOfLines={1}>
                                    <Text style={[styles.dealProjectName, { color: theme.textSecondary }]}>{deal.projectName || (deal.projectId && typeof deal.projectId === 'object' ? (deal.projectId as any).name : "") || "Unnamed Project"}</Text>
                                    <Text style={[styles.dealBlockName, { color: theme.textLight }]}> • {deal.block || (typeof deal.inventoryId === 'object' ? deal.inventoryId?.block : "") || "No Block"}</Text>
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                {deal.isPublished && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: theme.success + '15', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                                        <Ionicons name="globe" size={10} color={theme.success} />
                                        <Text style={{ fontSize: 9, color: theme.success, fontWeight: '800' }}>LIVE</Text>
                                    </View>
                                )}
                                {(() => {
                                    const label = getSizeLabel(deal, getLookupValue);
                                    const hasSizeData = label && label !== "—";
                                    
                                    // Robust Fallback: Search in root deal fields if getSizeLabel failed 
                                    // (happens if inventoryId population is delayed or partial)
                                    let finalLabel = hasSizeData ? label : null;
                                    if (!finalLabel || finalLabel === "—") {
                                        if (deal.sizeLabel && deal.sizeLabel !== "—") finalLabel = deal.sizeLabel;
                                        else if (deal.size || deal.sizeUnit) finalLabel = `${deal.size?.value ?? deal.size ?? ""} ${deal.sizeUnit ?? deal.size?.unit ?? ""}`.trim();
                                    }

                                    if (!finalLabel || finalLabel === "—" || finalLabel.includes("[object Object]")) return null;

                                    return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                            <Ionicons name="expand-outline" size={10} color={theme.textMuted} />
                                            <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: '700' }} numberOfLines={1}>
                                                {finalLabel}
                                            </Text>
                                        </View>
                                    );
                                })()}
                            </View>
                        </View>
                        <View style={styles.headerRight}>
                             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <DealScoreRing score={liveScore ? liveScore.score : (deal.score || (deal as any).dealScore || 0)} color={liveScore?.color || color} size={32} />
                                <View style={[styles.stagePill, { backgroundColor: color + "15" }]}>
                                    <View style={[styles.stageDot, { backgroundColor: color }]} />
                                    <Text style={[styles.stageText, { color }]}>{resolveName(deal.stage, getLookupValue, findUser)}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.menuTrigger} onPress={onMenuPress}>
                                <Ionicons name="ellipsis-vertical" size={18} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={[styles.cardFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
                        {/* Owner/Associate Data - Row Based (Professional) */}
                        <View style={{ flex: 1, gap: 2 }}>
                             {/* Owner */}
                             <View style={styles.listMeta}>
                                <Ionicons name="home-outline" size={13} color={theme.success} />
                                <Text style={[styles.listMetaText, { color: theme.text }]} numberOfLines={1}>
                                    {(() => {
                                        const owner = resolveName(deal.owner, getLookupValue, findUser);
                                        return owner && owner !== "—" ? `Owner: ${owner}` : "No Owner";
                                    })()}
                                </Text>
                            </View>
                            {/* Associate */}
                            <View style={styles.listMeta}>
                                <Ionicons name="people-outline" size={13} color={isDark ? '#818CF8' : theme.primary} />
                                <Text style={[styles.listMetaText, { color: theme.text }]} numberOfLines={1}>
                                    {(() => {
                                        const associate = resolveName(deal.associatedContact, getLookupValue, findUser);
                                        return associate && associate !== "—" ? `Associate: ${associate}` : "No Associate";
                                    })()}
                                </Text>
                            </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <Text style={[styles.dealAmount, { color: color }]}>{formatAmount(amount)}</Text>
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
    const { theme, isDarkMode } = useTheme();
    const isDark = isDarkMode;
    const insets = useSafeAreaInsets();
    const { trackCall } = useCallTracking();
    const router = useRouter();
    const { getLookupValue } = useLookup();
    const { isAuthenticated } = useAuth();
    const { users, loading: loadingUsers, findUser } = useUsers();
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
    // const [users, setUsers] = useState<any[]>([]);
    const [newTag, setNewTag] = useState("");
    const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkAssignVisible, setBulkAssignVisible] = useState(false);
    const [dealScores, setDealScores] = useState<Record<string, { score: number; color: string; label: string }>>({});
    const [contactPickerVisible, setContactPickerVisible] = useState(false);
    const [availableContacts, setAvailableContacts] = useState<any[]>([]);
    const [pendingAction, setPendingAction] = useState<{ type: string; deal: Deal } | null>(null);
    const [activePipelineStage, setActivePipelineStage] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    const pipelineStats = useMemo(() => {
        const stats: Record<string, number> = {};
        const isDark = theme.background === '#0F172A';
        const stageColorMap = isDark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT;
        
        deals.forEach(d => {
            let stage = (resolveName(d.stage, getLookupValue) || "open").toLowerCase();
            if (stage === 'closed' || stage === 'closed won') stage = 'closed won';
            if (stage === 'closed lost') stage = 'closed lost';
            stats[stage] = (stats[stage] || 0) + 1;
        });

        // Logical pipeline sequence
        const order = ['open', 'quote', 'negotiation', 'booked', 'closed won', 'closed lost', 'dormant'];
        return order.map(s => ({
            label: s,
            count: stats[s] || 0,
            color: stageColorMap[s] || "#64748B"
        }));
    }, [deals, theme.background]);

    const lastFetchTime = useRef<number>(0);

    const fetchDeals = useCallback(async (pageNum = 1, shouldAppend = false) => {
        if (!isAuthenticated) return;
        // 1. Instant Cache Load (only on first page, non-append load)
        if (pageNum === 1 && !shouldAppend && deals.length === 0) {
            try {
                const cached = await AsyncStorage.getItem("@cache_deals_list");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setDeals(parsed);
                        setLoading(false); // Stop block loading spinner early!
                    }
                }
            } catch (e) { console.warn("[Deals] Cache read failed", e); }
        }

        // 2. Only show main spinner if we have NO deals at all
        if (deals.length === 0) setLoading(true);
        
        const result = await safeApiCall<any>(() => getDeals({ page: String(pageNum), limit: "50" }));

        if (result.error) {
            if (deals.length === 0) { // Only alert if we have nothing at all
                Alert.alert("Data Load Error", `Could not load deals:\n${result.error}`, [{ text: "Retry", onPress: () => fetchDeals(pageNum, shouldAppend) }]);
            }
        } else if (result.data) {
            const newDeals = result.data;
            
            setDeals(prev => {
                const combined = shouldAppend ? [...prev, ...newDeals] : newDeals;
                // Deduplicate by _id
                const seen = new Set();
                const filtered = combined.filter((d: any) => {
                    const id = d?._id || d?.id;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });

                // 3. Update Cache (only for first page)
                if (pageNum === 1 && !shouldAppend) {
                    AsyncStorage.setItem("@cache_deals_list", JSON.stringify(filtered.slice(0, 50))).catch(() => {});
                    lastFetchTime.current = Date.now();
                }
                
                return filtered;
            });
            
            setHasMore(newDeals.length === 50);
            setPage(pageNum);
            // Fetch live deal scores from Stage Engine (fire-and-forget)
            if (!shouldAppend) {
                getDealScores().then(scores => setDealScores(scores)).catch(() => { });
            }
        }
        setLoading(false);
        setRefreshing(false);
    }, [deals.length, isAuthenticated]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchDeals(1, false);
    }, [fetchDeals]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchDeals(page + 1, true);
        }
    }, [loading, hasMore, page, fetchDeals]);

    // Removed: Redundant, use `users` from `useUsers` context
    // const loadUsers = async () => {
    //     const res = await api.get("/users?limit=50");
    //     setUsers(res.data?.data || []);
    // };

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            // Only re-fetch if cache is stale (> 2 mins) or empty
            if (deals.length === 0 || (now - lastFetchTime.current > 120000)) {
                if (isAuthenticated) fetchDeals(1, false);
            }
        }, [fetchDeals, deals.length, isAuthenticated])
    );

    const filteredDeals = useMemo(() => {
        return deals.filter(deal => {
            // Search filter
            if (search && !getDealTitle(deal, getLookupValue, findUser).toLowerCase().includes(search.toLowerCase())) return false;
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
                let s = (resolveName(deal.stage, getLookupValue, findUser) || "open").toLowerCase();
                if (s === 'closed' || s === 'closed won') s = 'closed won';
                if (s === 'closed lost') s = 'closed lost';
                if (s !== activePipelineStage.toLowerCase()) return false;
            }

            return true;
        });
    }, [deals, search, filters, activePipelineStage, findUser]);

    const filtersCount = Object.keys(filters).filter(k => filters[k] && (Array.isArray(filters[k]) ? filters[k].length > 0 : true)).length;

    const handleSearch = (text: string) => {
        setSearch(text);
    };

    const renderHeader = () => (
        <View style={{ backgroundColor: theme.background, paddingTop: Math.max((insets?.top ?? 0) + 20, 55), paddingBottom: 16 }}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setActivePipelineStage(null)}
                >
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Deals</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textLight }]}>{filteredDeals.length} active opportunities</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.primary }]} onPress={() => router.push("/add-deal")}>
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

            <View style={[styles.commandBar, { backgroundColor: theme.border }]}>
                <Ionicons name="search" size={20} color={theme.textMuted} />
                <TextInput
                    style={[styles.commandInput, { color: theme.text }]}
                    placeholder="Search Deals or Properties..."
                    placeholderTextColor={theme.textMuted}
                    value={search}
                    onChangeText={handleSearch}
                />
                <TouchableOpacity onPress={() => setShowFilterModal(true)} style={[styles.filterBtn, filtersCount > 0 && { backgroundColor: theme.primary + '15' }]}>
                    <Ionicons name="filter" size={22} color={filtersCount > 0 ? theme.primary : theme.textLight} />
                    {filtersCount > 0 && <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}><Text style={styles.filterBadgeText}>{filtersCount}</Text></View>}
                </TouchableOpacity>
            </View>
        </View>
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
            toValue: Dimensions.get('window').height,
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
            addContact(resolveName(c, getLookupValue, findUser) || "Client", c.phone || c.mobile, c.email, 'Client');
        }

        // 2. Owner stakeholder
        if (deal.owner && typeof deal.owner === 'object') {
            const o = deal.owner as any;
            addContact(resolveName(o, getLookupValue, findUser) || "Owner", o.phone || o.mobile, o.email, 'Owner');
        }

        // 3. Party Structure
        if (deal.partyStructure) {
            const ps = deal.partyStructure;
            if (ps.buyer) addContact(resolveName(ps.buyer, getLookupValue, findUser) || "Buyer", ps.buyer.phone || ps.buyer.mobile, ps.buyer.email, 'Buyer');
            if (ps.owner) addContact(resolveName(ps.owner, getLookupValue, findUser) || "Seller", ps.owner.phone || ps.owner.mobile, ps.owner.email, 'Seller');
            if (ps.channelPartner) addContact(resolveName(ps.channelPartner, getLookupValue, findUser) || "CP", ps.channelPartner.phone || ps.channelPartner.mobile, ps.channelPartner.email, 'CP');
            if (ps.internalRM) addContact(resolveName(ps.internalRM, getLookupValue, findUser) || "RM", ps.internalRM.phone || ps.internalRM.mobile, ps.internalRM.email, 'Internal RM');
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
                trackCall(contact.phone, deal._id, "Deal", getDealTitle(deal, getLookupValue, findUser));
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

    const handleDeleteDeal = () => {
        if (!selectedDeal || !selectedDeal._id) return;
        
        Vibration.vibrate([0, 50, 20, 50]); // Distinguishable double pulse
        Alert.alert(
            "Delete Deal Permanently?",
            `Are you sure? This will remove the deal and all associated history. This action cannot be reversed.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Now",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            console.log(`[ACTION-DELETE] Triggering delete for deal: ${selectedDeal._id}`);
                            const res = await api.delete(`/deals/${selectedDeal._id}`);
                            
                            if (res.status >= 200 && res.status < 300) {
                                console.log('[ACTION-DELETE] Success on server');
                                Vibration.vibrate(100);
                                fetchDeals(); 
                                closeHub();
                                Alert.alert("Deleted Successfully", "The deal has been permanently removed.");
                            } else {
                                throw new Error(res.data?.message || "Server rejected the request");
                            }
                        } catch (err: any) {
                            console.error("[ACTION-DELETE-DEAL] Failed:", err);
                            const msg = err.response?.data?.message || err.message || "Network error";
                            Alert.alert("Delete Failed", msg);
                        }
                    }
                }
            ]
        );
    };

    const submitPublishData = async (dealToPublish: Deal, isPublished: boolean, shareUnitNumber: boolean, shareLocation: boolean) => {
        setIsPublishing(true);
        const payload = {
            isPublished,
            publishedAt: isPublished ? new Date().toISOString() : null,
            websiteMetadata: {
                ...(dealToPublish.websiteMetadata || {}),
                shareUnitNumber,
                shareLocation
            }
        };
        const res = await safeApiCall(() => updateDeal(dealToPublish._id, payload));
        if (!res.error) {
            setDeals(prev => prev.map(d => d._id === dealToPublish._id ? { ...d, ...payload } : d));
            Alert.alert("Success", isPublished ? "Listing published to Website!" : "Listing removed from Website");
        }
        setIsPublishing(false);
    };

    const askLocationShare = (dealToActOn: Deal, shareUnit: boolean) => {
        setTimeout(() => {
            Alert.alert(
                "Location Privacy",
                "Share the exact House/Plot Number and Street publicly?",
                [
                    { text: "No, Keep Confidential", onPress: () => submitPublishData(dealToActOn, true, shareUnit, false) },
                    { text: "Yes, Share", onPress: () => submitPublishData(dealToActOn, true, shareUnit, true) }
                ],
                { cancelable: true }
            );
        }, 300);
    };

    const handleTogglePublish = () => {
        if (!selectedDeal) return;
        
        const dealToActOn = selectedDeal;
        const newStatus = !dealToActOn.isPublished;
        
        closeHub();

        setTimeout(() => {
            if (newStatus) {
                Alert.alert(
                    "Unit Privacy",
                    "Share the Unit Number publicly on the website?",
                    [
                        { text: "No, Keep Confidential", onPress: () => askLocationShare(dealToActOn, false) },
                        { text: "Yes, Share Unit No", onPress: () => askLocationShare(dealToActOn, true) }
                    ],
                    { cancelable: true }
                );
            } else {
                Alert.alert(
                    "Unpublish",
                    "Remove this deal from the website?",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Unpublish", style: "destructive", onPress: () => submitPublishData(dealToActOn, false, false, false) }
                    ]
                );
            }
        }, 300); // Wait for modal to close
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
                    renderItem={({ item, index }) => (
                        <DealCard
                            deal={item}
                            idx={index}
                            onPress={() => router.push(`/deal-detail?id=${item._id}`)}
                            onLongPress={() => openHub(item)}
                            onCall={() => {
                                const contacts = getContactsForDeal(item);
                                if (contacts.length > 0) {
                                    trackCall(contacts[0].phone || "", item._id, "Deal", getDealTitle(item, getLookupValue, findUser));
                                } else {
                                    Alert.alert("No Contact", "No phone number linked to this deal.");
                                }
                            }}
                            onWhatsApp={() => handleWhatsApp(item)}
                            onSMS={() => handleSMS(item)}
                            onEmail={() => handleEmail(item)}
                            onMenuPress={() => openHub(item)}
                            getLookupValue={getLookupValue}
                            findUser={findUser}
                            liveScore={dealScores[item._id]}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    getItemLayout={(data, index) => ({
                        length: 100,
                        offset: 100 * index,
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
                    <Animated.View style={[styles.sheetContainer, { backgroundColor: isDark ? '#000000' : '#FFFFFF', transform: [{ translateY: slideAnim }] }]}>
                        <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
                        <View style={styles.sheetHandle} />
                        <ScrollView 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 60 }}
                        >
                            <View style={styles.sheetHeader}>
                                <Text style={styles.sheetTitle}>{selectedDeal ? getDealTitle(selectedDeal) : "Deal Actions"}</Text>
                                <Text style={styles.sheetSub}>{selectedDeal?.dealId || "Quick Actions"}</Text>
                            </View>

                            <View style={styles.actionGrid}>
                                <TouchableOpacity style={styles.actionItem} onPress={() => {
                                    router.push(`/add-deal?id=${selectedDeal?._id}`); closeHub();
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(100, 116, 139, 0.1)' : "#F1F5F9" }]}>
                                        <Ionicons name="create" size={24} color={isDark ? theme.textSecondary : "#64748B"} />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Edit</Text>
                                </TouchableOpacity >

                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/match-lead?dealId=${selectedDeal?._id}`); closeHub(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(219, 39, 119, 0.1)' : "#FDF2F8" }]}>
                                        <Ionicons name="git-compare" size={24} color="#DB2777" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Match</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-offer?dealId=${selectedDeal?._id}`); closeHub(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : "#FEF3C7" }]}>
                                        <Ionicons name="handshake" size={24} color="#F59E0B" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Offer</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-quote?dealId=${selectedDeal?._id}`); closeHub(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : "#ECFDF5" }]}>
                                        <Ionicons name="calculator" size={24} color="#10B981" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Quote</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/documents?dealId=${selectedDeal?._id}`); closeHub(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.1)' : "#F0F9FF" }]}>
                                        <Ionicons name="document-attach" size={24} color="#0EA5E9" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Doc</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-booking?dealId=${selectedDeal?._id}`); closeHub(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.1)' : "#FEF2F2" }]}>
                                        <Ionicons name="calendar" size={24} color="#DC2626" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Book</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { 
                                    const invId = selectedDeal?.inventoryId?._id || selectedDeal?.inventoryId;
                                    if (!invId || invId === "undefined") {
                                        Alert.alert("Missing Connection", "This deal is not linked to any inventory item. Media cannot be uploaded.");
                                        return;
                                    }
                                    router.push(`/upload-media?id=${invId}`); 
                                    closeHub(); 
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(22, 163, 74, 0.1)' : "#F0FDF4" }]}>
                                        <Ionicons name="cloud-upload" size={24} color="#16A34A" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Upload</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-activity?id=${selectedDeal?._id}&type=Deal`); closeHub(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.15)' : "#FFF7ED" }]}>
                                        <Ionicons name="add-circle" size={24} color={isDark ? '#FB923C' : "#EA580C"} />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Activity</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { setShowStagePicker(!showStagePicker); setShowReassign(false); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(219, 39, 119, 0.1)' : "#FDF2F8" }]}>
                                        <Ionicons name="git-network" size={24} color="#DB2777" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Stage</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { setShowReassign(!showReassign); setShowStagePicker(false); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : "#F5F3FF" }]}>
                                        <Ionicons name="person-add" size={24} color={isDark ? '#A78BFA' : "#7C3AED"} />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Assign</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { setShowTagEditor(!showTagEditor); setShowStagePicker(false); setShowReassign(false); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : "#EEF2FF" }]}>
                                        <Ionicons name="pricetags" size={24} color={isDark ? '#818CF8' : "#4F46E5"} />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Tag</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={handleQuickDormant}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.15)' : "#F1F5F9" }]}>
                                        <Ionicons name="moon" size={24} color={isDark ? '#94A3B8' : "#94A3B8"} />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Dormant</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.actionItem} 
                                    onPress={handleTogglePublish}
                                    disabled={isPublishing}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: selectedDeal?.isPublished ? (isDark ? 'rgba(16, 185, 129, 0.1)' : "#ECFDF5") : (isDark ? 'rgba(14, 165, 233, 0.1)' : "#F0F9FF") }]}>
                                        {isPublishing ? (
                                            <ActivityIndicator size="small" color={selectedDeal?.isPublished ? "#10B981" : "#0EA5E9"} />
                                        ) : (
                                            <Ionicons name={selectedDeal?.isPublished ? "globe" : "globe-outline"} size={24} color={selectedDeal?.isPublished ? "#10B981" : "#0EA5E9"} />
                                        )}
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>{selectedDeal?.isPublished ? 'Unpub.' : 'Publish'}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.dangerZone}>
                                <TouchableOpacity 
                                    style={[styles.dangerBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : "#FEF2F2" }]} 
                                    onPress={handleDeleteDeal}
                                >
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    <Text style={styles.dangerBtnText}>Delete Deal</Text>
                                </TouchableOpacity>
                            </View>

                            {showStagePicker && (
                                <View style={[styles.pickerView, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Change Stage</Text>
                                    <View style={styles.chipList}>
                                        {['open', 'quote', 'negotiation', 'booked', 'closed won', 'closed lost', 'cancelled', 'dormant'].map((s) => {
                                            const stageColorMap = isDark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT;
                                            const color = stageColorMap[s] || "#64748B";
                                            return (
                                                <TouchableOpacity
                                                    key={s}
                                                    style={[styles.actionChip, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : color, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff' }]}
                                                    onPress={() => handleStageUpdate(s)}
                                                >
                                                    <Text style={[styles.actionChipText, { color: color }]}>{s.toUpperCase()}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            {showReassign && (
                                <View style={[styles.pickerView, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Reassign Deal</Text>
                                    
                                    <TextInput
                                        style={[styles.tagInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border, marginBottom: 16, height: 80, textAlignVertical: 'top' }]}
                                        placeholder="Add transfer notes..."
                                        placeholderTextColor={theme.textMuted}
                                        multiline
                                        value={newTag} // Re-using state for note or add dedicated
                                        onChangeText={setNewTag}
                                    />

                                    <View style={styles.chipList}>
                                        {users.map((u) => (
                                            <TouchableOpacity
                                                key={u._id}
                                                style={[styles.actionChip, { borderColor: theme.border, backgroundColor: theme.card }]}
                                                onPress={async () => {
                                                    const res = await safeApiCall(() => updateDeal(selectedDeal!._id, { 
                                                        assignedTo: u._id, 
                                                        assignmentNote: newTag.trim() || 'Direct transfer' 
                                                    }));
                                                    if (!res.error) {
                                                        setNewTag("");
                                                        fetchDeals();
                                                        closeHub();
                                                        Alert.alert("Success", "Deal reassigned professionally.");
                                                    }
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary }}>{(u.fullName || u.name || "?")[0].toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={[styles.actionChipText, { color: theme.text }]}>{u.fullName || u.name}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {showTagEditor && (
                                <View style={[styles.pickerView, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Deal Tagging</Text>
                                    <View style={styles.tagInputRow}>
                                        <TextInput
                                            style={[styles.tagInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                                            placeholder="Add descriptive tag..."
                                            placeholderTextColor={theme.textMuted}
                                            value={newTag}
                                            onChangeText={setNewTag}
                                            onSubmitEditing={handleAddTag}
                                        />
                                        <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: theme.primary }]} onPress={handleAddTag}>
                                            <Ionicons name="add" size={20} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.chipList}>
                                        {(selectedDeal?.tags || []).map((t: string, idx: number) => (
                                            <View key={idx} style={[styles.tagChip, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '20' }]}>
                                                <Text style={[styles.tagChipText, { color: theme.primary }]}>{t}</Text>
                                                <TouchableOpacity onPress={() => handleRemoveTag(t)} style={{ marginLeft: 4 }}>
                                                    <Ionicons name="close-circle" size={16} color={theme.primary + '80'} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </Pressable>
                </Animated.View>
            </Pressable>
            </Modal>

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
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    headerTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 13, fontWeight: "600", marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

    headerCard: {
        marginHorizontal: 20, marginBottom: 16, borderRadius: 24,
        padding: 20, flexDirection: 'row', alignItems: 'center',
        shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }
    },
    summaryLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
    summaryValue: { color: "#fff", fontSize: 24, fontWeight: "900" },
    summaryDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 20 },
    summaryStats: { flex: 1 },
    statItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statLabel: { fontSize: 9, fontWeight: "900" },
    statValue: { fontSize: 13, fontWeight: "800" },

    commandBar: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 8,
        paddingHorizontal: 16, height: 48,
        borderRadius: 12, borderWidth: 1
    },
    commandInput: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: "600" },

    list: { paddingBottom: 100 },

    card: {
        flexDirection: "row", marginHorizontal: 16, marginBottom: 6,
        borderRadius: 14, overflow: "hidden", borderWidth: 1,
        elevation: 1, shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }
    },
    cardAccent: { width: 4 },
    cardMain: { flex: 1, paddingHorizontal: 10, paddingVertical: 4 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
    cardIdentity: { flex: 1 },
    dealUnitNumber: { fontSize: 17, fontWeight: "900" },
    typePill: { paddingHorizontal: 6, paddingVertical: 0, borderRadius: 6 },
    typePillText: { fontSize: 9, fontWeight: "900", textTransform: 'uppercase' },
    dealProjectContainer: { marginTop: 0 },
    dealProjectName: { fontSize: 14, fontWeight: "800" },
    dealBlockName: { fontSize: 10, fontWeight: "500" },
    dealAmount: { fontSize: 17, fontWeight: "900" },

    stagePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
    stageDot: { width: 6, height: 6, borderRadius: 3 },
    stageText: { fontSize: 11, fontWeight: "800", textTransform: 'uppercase' },

    headerRight: { alignItems: 'flex-end', gap: 10 },
    menuTrigger: { padding: 4, marginRight: -4 },

    cardFooter: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: 4, 
        paddingTop: 4, 
        borderTopWidth: StyleSheet.hairlineWidth
    },
    listMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    listMetaText: { fontSize: 12, fontWeight: "600" },
    dateText: { fontSize: 10, fontWeight: "700", opacity: 0.5 },

    pipelineWrapper: { marginBottom: 12 },
    pipelineScroll: { paddingHorizontal: 20, gap: 8 },
    pipelineChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
    pipelineChipActive: { },
    pipelineChipText: { fontSize: 11, fontWeight: '800' },
    pipelineChipTextActive: { },
    horizontalPipelineWrapper: { marginHorizontal: 16, marginBottom: 12 },
    chevronContainer: {
        flexDirection: 'row',
        height: 64,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1
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

    locationGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    locationText: { fontSize: 12, fontWeight: "600" },


    rightActions: { flexDirection: 'row', paddingLeft: 10 },
    leftActions: { flexDirection: 'row', paddingRight: 10 },
    swipeAction: { width: 70, justifyContent: 'center', alignItems: 'center', height: '100%' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
    sheetContainer: { 
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        paddingHorizontal: 20, 
        maxHeight: '85%',
        minHeight: 400 
    },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 },
    sheetHeader: { marginBottom: 24, alignItems: 'center' },
    sheetTitle: { fontSize: 20, fontWeight: "900" },
    sheetSub: { fontSize: 12, fontWeight: "700", textTransform: 'uppercase', marginTop: 4 },

    actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: 'center', gap: 12 },
    actionItem: { width: "22%", alignItems: "center", marginBottom: 16 },
    actionIcon: { width: 56, height: 56, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8, shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    actionLabel: { fontSize: 10, fontWeight: "800", textAlign: "center" },

    pickerView: { marginTop: 10, padding: 20, borderRadius: 20 },
    sectionTitle: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", marginBottom: 16 },
    chipList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    actionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    actionChipText: { fontSize: 12, fontWeight: "800" },

    tagInputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
    tagInput: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, fontWeight: "600" },
    addTagBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    tagChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
    tagChipText: { fontSize: 12, fontWeight: "800" },

    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 15, fontWeight: "700" },
    filterBtn: { padding: 8, marginLeft: 8 },
    filterBadge: { position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
    filterBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
    fab: {
        position: "absolute", bottom: 30, right: 20, width: 56, height: 56,
        borderRadius: 28, justifyContent: "center",
        alignItems: "center", elevation: 4,
        shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },

    contactPickerSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: 60, width: '100%' },
    contactItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
    contactInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    contactAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    contactName: { fontSize: 15, fontWeight: '800' },
    contactRole: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    dangerZone: {
        marginTop: 24,
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
        paddingBottom: 40
    },
    dangerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 14,
        width: '100%'
    },
    dangerBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#EF4444"
    },
});
