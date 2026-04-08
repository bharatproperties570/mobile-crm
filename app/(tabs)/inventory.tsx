import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
    TextInput, RefreshControl, ActivityIndicator, Dimensions, SafeAreaView, Alert, Linking, Animated, Modal, Pressable
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from 'react-native-gesture-handler';
import { getInventory, type Inventory } from "@/services/inventory.service";
import { lookupVal, safeApiCall } from "@/services/api.helpers";
import { useCallTracking } from "@/context/CallTrackingContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import api from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FilterModal, { FilterField } from "@/components/FilterModal";
import { formatSize, getSizeLabel } from "@/utils/format.utils";

const INVENTORY_FILTER_FIELDS: FilterField[] = [
    { key: "status", label: "Status", type: "lookup", lookupType: "InventoryStatus" },
    { key: "category", label: "Category", type: "lookup", lookupType: "Category" },
    { key: "subCategory", label: "Sub Category", type: "lookup", lookupType: "SubCategory" },
    { key: "unitType", label: "Unit Type", type: "lookup", lookupType: "UnitType" },
];

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
        // 1. Try Lookups (O(1) in new LookupContext)
        if (getLookupValue) {
            const resolved = getLookupValue("Any", str);
            if (resolved && resolved !== str && resolved !== "—") return resolved;
        }
        // 2. Try Users (O(1) in new UserContext)
        if (findUser) {
            const user = findUser(str);
            if (user) return user.fullName || user.name || str;
        }
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_WIDTH = (SCREEN_WIDTH - 48) / 2;

const STATUS_COLORS: Record<string, string> = {
    'Available': '#10B981',
    'Sold': '#EF4444',
    'Reserved': '#F59E0B',
    'Blocked': '#64748B',
    'Hold': '#8B5CF6'
};

const ACTIVE_STATUSES = ['Available', 'Active', 'Interested / Warm', 'Interested / Hot', 'Request Call Back', 'Busy / Driving', 'Market Feedback', 'General Inquiry', 'Blocked', 'Booked', 'Interested'];
const INACTIVE_STATUSES = ['Sold Out', 'Rented Out', 'Not Interested', 'Inactive', 'Wrong Number / Invalid', 'Switch Off / Unreachable'];

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
    viewMode: 'list' | 'grid';
}) => {
    const { getLookupValue } = useLookup();
    const { findUser } = useUsers();

    const statusInfo = useMemo(() => {
        const status = getLookupValue("Status", item.status);
        const isActive = !INACTIVE_STATUSES.some(s => s.toLowerCase() === status.toLowerCase());
        return {
            status,
            label: isActive ? "Active" : "InActive",
            color: isActive ? '#10B981' : '#F59E0B'
        };
    }, [item.status, getLookupValue]);

    const displayInfo = useMemo(() => {
        const type = getLookupValue("Category", item.category);
        const subCat = getLookupValue("SubCategory", item.subCategory);
        const unitType = getLookupValue("UnitType", item.unitType);
        return {
            type,
            icon: TYPE_ICONS[type] || 'cube',
            typeLabel: [subCat, unitType].filter(v => v && v !== "—").join(' · '),
            sizeLabel: getSizeLabel(item, getLookupValue)
        };
    }, [item.category, item.subCategory, item.unitType, item.size, item.sizeUnit, item.sizeConfig, item.sizeLabel, getLookupValue]);

    const assignedName = useMemo(() => {
        if (!item.assignedTo) return "—";
        if (typeof item.assignedTo === 'object') return item.assignedTo.fullName || item.assignedTo.name || "—";
        return findUser(item.assignedTo)?.fullName || "—";
    }, [item.assignedTo, findUser]);

    const statusColor = statusInfo.color;
    const statusLabel = statusInfo.label;
    const iconName = displayInfo.icon;
    const displayType = displayInfo.typeLabel;

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
                <View style={[styles.gridMediaSlot, { backgroundColor: statusColor + "10" }]}>
                    <Ionicons name={iconName as any} size={32} color={statusColor} />
                    <View style={[styles.gridStatusDot, { backgroundColor: statusColor }]} />
                    <TouchableOpacity style={styles.gridMenuTrigger} onPress={(e) => { e.stopPropagation(); onMenuPress(); }}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={statusColor} />
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
                <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />
                <View style={styles.listMain}>
                    <View style={styles.listHeader}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <Text style={styles.listUnitNumber}>{item.unitNumber || item.unitNo || "N/A"}</Text>
                                {displayType ? (
                                    <View style={[styles.typePill, { backgroundColor: statusColor + '10' }]}>
                                        <Text style={[styles.typePillText, { color: statusColor }]}>{displayType}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text numberOfLines={1} style={styles.listProjectContainer}>
                                <Text style={styles.listProjectName}>{item.projectName || "N/A"}</Text>
                                <Text style={styles.listBlockName}> • {item.block || "No Block"}</Text>
                            </Text>
                            {/* Size shown below project name */}
                            {(item.size || item.sizeUnit || item.sizeConfig || item.sizeLabel) ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                    <Ionicons name="expand-outline" size={11} color="#94A3B8" />
                                    <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>
                                        {displayInfo.sizeLabel}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <View style={[styles.statusPill, { backgroundColor: statusColor + "10", flexDirection: 'column', alignItems: 'flex-end', gap: 2, paddingVertical: 6 }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                    <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                                </View>
                                 {/* Removed redundant subtext to prevent double "Active" display */}
                            </View>
                            <TouchableOpacity style={styles.menuTrigger} onPress={onMenuPress}>
                                <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Footer: Owner + Associate with phone */}
                    <View style={[styles.listFooter, { flexDirection: 'column', gap: 6 }]}>
                        {/* Owner */}
                        {(item.owners?.[0]?.name || item.ownerName) ? (
                            <View style={styles.listMeta}>
                                <Ionicons name="home-outline" size={13} color="#10B981" />
                                <Text style={[styles.listMetaText, { color: '#0F172A' }]} numberOfLines={1}>
                                    {resolveNameFromObject(item.owners?.[0], item.ownerName, getLookupValue, findUser)}
                                </Text>
                                {(item.owners?.[0]?.phones?.[0]?.number || item.owners?.[0]?.phone || item.ownerPhone) ? (
                                    <Text style={[styles.listMetaText, { color: '#64748B' }]}>
                                        • {item.owners?.[0]?.phones?.[0]?.number || item.owners?.[0]?.phone || item.ownerPhone}
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}
                        {/* Associate */}
                        {(item.associates?.[0]?.name || item.associatedContact) ? (
                            <View style={styles.listMeta}>
                                <Ionicons name="people-outline" size={13} color="#6366F1" />
                                <Text style={[styles.listMetaText, { color: '#0F172A' }]} numberOfLines={1}>
                                    {resolveNameFromObject(item.associates?.[0], item.associatedContact, getLookupValue, findUser)}
                                </Text>
                                {(item.associates?.[0]?.phones?.[0]?.number || item.associates?.[0]?.phone || item.associatedPhone) ? (
                                    <Text style={[styles.listMetaText, { color: '#64748B' }]}>
                                        • {item.associates?.[0]?.phones?.[0]?.number || item.associates?.[0]?.phone || item.associatedPhone}
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}
                        {/* If neither owner nor associate, show a subtle placeholder */}
                        {(!item.owners?.[0]?.name && !item.ownerName && !item.associates?.[0]?.name && !item.associatedContact) ? (
                            <View style={styles.listMeta}>
                                <Ionicons name="person-outline" size={13} color="#CBD5E1" />
                                <Text style={[styles.listMetaText, { color: '#CBD5E1' }]}>No contact info</Text>
                            </View>
                        ) : null}
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
    const [filters, setFilters] = useState<any>({});
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [activeCount, setActiveCount] = useState(0);
    const [inactiveCount, setInactiveCount] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastFetchTime = useRef<number>(0);
    const [activeQuickFilter, setActiveQuickFilter] = useState<'active' | 'inactive' | null>(null);
    const { getLookupsByType, getLookupValue } = useLookup();

    // Action Hub State
    const [selectedInv, setSelectedInv] = useState<Inventory | null>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

    // Contact Picker State
    const [contactPickerVisible, setContactPickerVisible] = useState(false);
    const [availableContacts, setAvailableContacts] = useState<any[]>([]);
    const [pendingAction, setPendingAction] = useState<{ type: string; item: Inventory } | null>(null);

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
            toValue: Dimensions.get('window').height,
            duration: 200,
            useNativeDriver: true
        }).start(() => {
            setHubVisible(false);
            setSelectedInv(null);
        });
    };

    const fetchInventory = useCallback(async (pageNum = 1, shouldAppend = false) => {
        // 1. Instant Cache Load (only on first page, non-append load)
        if (pageNum === 1 && !shouldAppend && inventory.length === 0) {
            try {
                const cached = await AsyncStorage.getItem("@cache_inventory_list");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setInventory(parsed);
                        setLoading(false); // Stop block loading spinner early!
                    }
                }
            } catch (e) { console.warn("[Inventory] Cache read failed", e); }
        }

        if (pageNum > 1) setLoadingMore(true);
        else if (inventory.length === 0) setLoading(true);

        // Normalize filters: Convert arrays to comma-separated strings for the backend
        const apiFilters: any = { ...filters };
        Object.keys(apiFilters).forEach(key => {
            if (Array.isArray(apiFilters[key])) {
                apiFilters[key] = apiFilters[key].join(',');
            }
        });

        console.log("[Frontend] Fetching Inventory with params:", JSON.stringify({ ...apiFilters, page: pageNum }, null, 2));

        const result = await safeApiCall<any>(() => getInventory({ 
            ...apiFilters, 
            page: String(pageNum), 
            limit: "50" 
        }));

        if (!result.error && result.data) {
            const newItems = result.data;
            
            setInventory(prev => {
                const combined = shouldAppend ? [...prev, ...newItems] : newItems;
                // Deduplicate
                const seen = new Set();
                const filtered = combined.filter((i: any) => {
                    const id = i?._id || i?.id;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });

                // 2. Update Cache (only for first page)
                if (pageNum === 1 && !shouldAppend) {
                    AsyncStorage.setItem("@cache_inventory_list", JSON.stringify(filtered.slice(0, 50))).catch(() => {});
                    lastFetchTime.current = Date.now();
                }
                
                return filtered;
            });
            
            setActiveCount(result.activeCount || 0);
            setInactiveCount(result.inactiveCount || 0);
            setHasMore(newItems.length === 50);
            setPage(pageNum);
        }
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
    }, [filters]); // Removed inventory.length to prevent redundant fetches

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchInventory(1, false);
    }, [fetchInventory]);

    const loadMore = useCallback(() => {
        if (!loading && !loadingMore && hasMore) {
            fetchInventory(page + 1, true);
        }
    }, [loading, loadingMore, hasMore, page, fetchInventory]);

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            // Only re-fetch if cache is stale (> 2 mins) or empty
            if (inventory.length === 0 || (now - lastFetchTime.current > 120000)) {
                fetchInventory(1, false);
            }
        }, [fetchInventory, inventory.length])
    );

    // FIX: Refetch when filters change!
    useEffect(() => {
        fetchInventory(1, false);
    }, [filters]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return inventory.filter(i => {
            const matchesSearch = (i.projectName || "").toLowerCase().includes(q) ||
                (i.unitNumber || "").toLowerCase().includes(q) ||
                (i.unitNo || "").toLowerCase().includes(q) ||
                (i.block || "").toLowerCase().includes(q);

            if (!matchesSearch) return false;

            // Apply Status Filters (Real IDs)
            if (filters.status?.length > 0 && !filters.status.includes('active') && !filters.status.includes('inactive')) {
                const itemStatusId = (typeof i.status === 'object' && i.status !== null) ? (i.status as any)._id : i.status;
                if (!filters.status.includes(itemStatusId)) return false;
            }
            
            // Quick status filters (Active/Inactive) - Instant Local Filter
            if (activeQuickFilter) {
                const statusStr = getLookupValue("Status", i.status);
                const isItemInactive = INACTIVE_STATUSES.some(s => s.toLowerCase() === statusStr.toLowerCase());
                if (activeQuickFilter === 'inactive' && !isItemInactive) return false;
                if (activeQuickFilter === 'active' && isItemInactive) return false;
            }

            if (filters.category?.length > 0) {
                const itemCategoryId = (typeof i.category === 'object' && i.category !== null) ? (i.category as any)._id : i.category;
                if (!filters.category.includes(itemCategoryId)) return false;
            }
            if (filters.subCategory?.length > 0) {
                const itemSubCategoryId = (typeof i.subCategory === 'object' && i.subCategory !== null) ? (i.subCategory as any)._id : i.subCategory;
                if (!filters.subCategory.includes(itemSubCategoryId)) return false;
            }
            
            return true;
        });
    }, [inventory, search, filters, activeQuickFilter]);

    // Communication Logic with Multi-Contact Support
    const getContactsForInventory = (item: Inventory) => {
        const contacts: any[] = [];

        if (item.owners && item.owners.length > 0) {
            item.owners.forEach(owner => {
                if (typeof owner === 'string') {
                    // Handle raw ID or string if population failed
                    return;
                }
                const name = owner.name || "Owner";
                if (owner.phones && owner.phones.length > 0) {
                    owner.phones.forEach((p: any) => {
                        contacts.push({ name, phone: p.number || p.phone, type: 'Owner', email: owner.email });
                    });
                } else if (owner.phone || owner.number) {
                     contacts.push({ name, phone: owner.phone || owner.number, type: 'Owner', email: owner.email });
                }
            });
        }

        // Fallback to top-level owner fields if owners array is empty or lacks data
        if (contacts.length === 0) {
            if (item.ownerPhone) {
                contacts.push({ name: item.ownerName || "Owner", phone: item.ownerPhone, type: 'Owner' });
            } else if (item.associatedPhone) {
                contacts.push({ name: item.associatedContact || "Associate", phone: item.associatedPhone, type: 'Associate' });
            }
        }

        // Extract from Associates
        if (item.associates && item.associates.length > 0) {
            item.associates.forEach(assoc => {
                const name = assoc.name || "Associate";
                if (assoc.phone || assoc.number) {
                    contacts.push({ name, phone: assoc.phone || assoc.number, type: 'Associate', email: assoc.email });
                }
            });
        }

        return contacts;
    };

    const handleCommunicationAction = (item: Inventory, actionType: string) => {
        const contacts = getContactsForInventory(item);

        if (contacts.length === 0) {
            Alert.alert("No Contact", "No phone number or email linked to this property.");
            return;
        }

        if (contacts.length === 1) {
            executeAction(contacts[0], actionType, item);
        } else {
            setAvailableContacts(contacts);
            setPendingAction({ type: actionType, item });
            setContactPickerVisible(true);
        }
    };

    const executeAction = (contact: any, type: string, item: Inventory) => {
        const phone = contact.phone?.replace(/[^0-9]/g, "");
        const email = contact.email;

        switch (type) {
            case 'CALL':
                if (!phone) {
                    Alert.alert("Error", "No valid phone number for this contact.");
                    return;
                }
                // Track with original display number, dial with cleaned number
                trackCall(phone, item._id, "Inventory", `${item.projectName} - ${item.unitNumber || item.unitNo}`);
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

    const handleQuickFilter = (type: 'active' | 'inactive') => {
        if (activeQuickFilter === type) {
            setActiveQuickFilter(null);
            setFilters((prev: any) => ({ ...prev, status: [] }));
            return;
        }

        console.log(`[Frontend] Applying Quick Filter: ${type}`);

        setActiveQuickFilter(type);
        setFilters((prev: any) => ({ ...prev, status: [type] }));
    };

    const handleCall = (item: Inventory) => handleCommunicationAction(item, 'CALL');
    const handleWhatsApp = (item: Inventory) => handleCommunicationAction(item, 'WHATSAPP');
    const handleSMS = (item: Inventory) => handleCommunicationAction(item, 'SMS');
    const handleEmail = (item: Inventory) => handleCommunicationAction(item, 'EMAIL');

    const renderHeader = () => {
        const total = activeCount + inactiveCount;
        const activePct = total > 0 ? Math.round((activeCount / total) * 100) : 0;
        const inactivePct = total > 0 ? Math.round((inactiveCount / total) * 100) : 0;

        return (
            <View style={styles.headerContainer}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Inventory</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => router.push("/add-inventory")}>
                            <Ionicons name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.metricsFlowContainer}>
                    {/* Inactive Segment (Left) */}
                    <TouchableOpacity 
                        style={[
                            styles.flowSegment, 
                            styles.inactiveSegment,
                            activeQuickFilter === 'inactive' && styles.inactiveSelected
                        ]}
                        onPress={() => handleQuickFilter('inactive')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.flowInfo}>
                            <Text style={styles.flowLabel}>INACTIVE</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                <Text style={styles.flowValue}>{inactiveCount.toLocaleString()}</Text>
                                <Text style={styles.flowPercent}>{inactivePct}%</Text>
                            </View>
                        </View>
                        <Ionicons name="archive-outline" size={24} color="#64748B20" style={styles.flowIcon} />
                        <View style={[styles.chevronPoint, activeQuickFilter === 'inactive' && { backgroundColor: '#E2E8F0' }]} />
                    </TouchableOpacity>

                    {/* Active Segment (Right) */}
                    <TouchableOpacity 
                        style={[
                            styles.flowSegment, 
                            styles.activeSegment,
                            activeQuickFilter === 'active' && styles.activeSelected
                        ]}
                        onPress={() => handleQuickFilter('active')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.flowInfo, { paddingLeft: 24 }]}>
                            <Text style={styles.flowLabelActive}>ACTIVE</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                <Text style={styles.flowValueActive}>{activeCount.toLocaleString()}</Text>
                                <Text style={styles.flowPercentActive}>{activePct}%</Text>
                            </View>
                        </View>
                        <Ionicons name="trending-up" size={24} color="#16A34A20" style={styles.flowIcon} />
                    </TouchableOpacity>
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
                    <TouchableOpacity onPress={() => setShowFilterModal(true)} style={styles.filterBtn}>
                        <Ionicons name="filter" size={20} color={Object.keys(filters).length > 0 ? "#2563EB" : "#94A3B8"} />
                        {Object.keys(filters).length > 0 && <View style={styles.filterBadge} />}
                    </TouchableOpacity>
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch("")} style={{ marginLeft: 8 }}>
                            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

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
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    removeClippedSubviews={true}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 10 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="cube-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>{search ? "No matches found" : "Waiting for property records..."}</Text>
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
                                        executeAction(contact, pendingAction!.type, pendingAction!.item);
                                        setContactPickerVisible(false);
                                    }}
                                >
                                    <View style={styles.contactInfo}>
                                        <View style={[styles.contactAvatar, { backgroundColor: contact.type === 'Owner' ? '#DB277720' : '#3B82F620' }]}>
                                            <Ionicons
                                                name={contact.type === 'Owner' ? "person" : "people"}
                                                size={18}
                                                color={contact.type === 'Owner' ? "#DB2777" : "#3B82F6"}
                                            />
                                        </View>
                                        <View>
                                            <Text style={styles.contactName}>{contact.name}</Text>
                                            <Text style={styles.contactRole}>{contact.type} • {contact.phone || contact.email}</Text>
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
                        <ScrollView 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 60 }}
                        >
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

                                <TouchableOpacity style={styles.actionItem} onPress={() => {
                                    if (selectedInv) router.push(`/add-activity?id=${selectedInv._id}&type=Inventory`);
                                    closeHub();
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: "#E0F2FE" }]}>
                                        <Ionicons name="calendar" size={24} color="#0EA5E9" />
                                    </View>
                                    <Text style={styles.actionLabel}>Activities</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => {
                                    if (selectedInv) {
                                        const params = new URLSearchParams();
                                        params.append('inventoryId', selectedInv._id);
                                        params.append('projectName', selectedInv.projectName || "");
                                        params.append('block', selectedInv.block || "");
                                        params.append('unitNo', selectedInv.unitNumber || selectedInv.unitNo || "");
                                        params.append('prefill', 'true');
                                        router.push(`/add-deal?${params.toString()}`);
                                    }
                                    closeHub();
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: "#DCFCE7" }]}>
                                        <Ionicons name="briefcase" size={24} color="#22C55E" />
                                    </View>
                                    <Text style={styles.actionLabel}>Create Deal</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => {
                                    if (selectedInv) router.push(`/manage-owners?id=${selectedInv._id}`);
                                    closeHub();
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: "#FEF9C3" }]}>
                                        <Ionicons name="person-add" size={24} color="#A16207" />
                                    </View>
                                    <Text style={styles.actionLabel}>Add Owner</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => {
                                    if (selectedInv) router.push(`/manage-tags?id=${selectedInv._id}`);
                                    closeHub();
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: "#F3E8FF" }]}>
                                        <Ionicons name="pricetag" size={24} color="#9333EA" />
                                    </View>
                                    <Text style={styles.actionLabel}>Tag</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => {
                                    if (selectedInv) router.push(`/upload-media?id=${selectedInv._id}`);
                                    closeHub();
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: "#FFEDD5" }]}>
                                        <Ionicons name="images" size={24} color="#F97316" />
                                    </View>
                                    <Text style={styles.actionLabel}>Upload</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => {
                                    if (selectedInv) router.push(`/add-document?id=${selectedInv._id}&type=Inventory`);
                                    closeHub();
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: "#FFE4E6" }]}>
                                        <Ionicons name="document-attach" size={24} color="#E11D48" />
                                    </View>
                                    <Text style={styles.actionLabel}>Document</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => {
                                    if (selectedInv) router.push(`/inventory-feedback?id=${selectedInv._id}`);
                                    closeHub();
                                }}>
                                    <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                        <Ionicons name="chatbubble-ellipses" size={24} color="#64748B" />
                                    </View>
                                    <Text style={styles.actionLabel}>Feedback</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionItem} onPress={() => { Alert.alert("Share", "Sharing unit details..."); closeHub(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                        <Ionicons name="share-social" size={24} color="#64748B" />
                                    </View>
                                    <Text style={styles.actionLabel}>Share</Text>
                                </TouchableOpacity>
                            </View >
                        </ScrollView>
                    </Animated.View >
                </Pressable >
            </Modal >

            <FilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={setFilters}
                initialFilters={filters}
                fields={INVENTORY_FILTER_FIELDS}
            />
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
    metricsFlowContainer: {
        flexDirection: 'row',
        height: 85,
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 20,
        backgroundColor: '#fff',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    flowSegment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        position: 'relative',
    },
    inactiveSegment: {
        backgroundColor: '#F1F5F9', // Slate 100
        zIndex: 2,
    },
    activeSegment: {
        backgroundColor: '#DCFCE7', // Green 100
        zIndex: 1,
    },
    chevronPoint: {
        position: 'absolute',
        right: -15, // Half of height/width to center the point
        top: 27.5, // (85 - 30) / 2
        width: 30,
        height: 30,
        backgroundColor: '#F1F5F9',
        transform: [{ rotate: '45deg' }],
        zIndex: 3,
        borderRadius: 4,
    },
    flowInfo: {
        justifyContent: 'center',
    },
    flowLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 2,
    },
    flowLabelActive: {
        fontSize: 10,
        fontWeight: '900',
        color: '#16A34A',
        letterSpacing: 1,
        marginBottom: 2,
    },
    flowValue: { fontSize: 22, fontWeight: "900", color: "#475569" },
    flowPercent: { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
    flowValueActive: { fontSize: 22, fontWeight: "900", color: "#16A34A" },
    flowPercentActive: { fontSize: 12, fontWeight: "700", color: "#16A34A80" },
    flowIcon: {
        opacity: 0.8,
    },
    headerActions: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F1F5F9", justifyContent: 'center', alignItems: 'center' },
    actionBtnPrimary: { backgroundColor: "#2563EB" },

    commandBar: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 16,
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F8FAFC",
        borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0"
    },
    commandInput: { flex: 1, marginLeft: 12, fontSize: 15, color: "#1E293B", fontWeight: "600" },
    filterBtn: { padding: 4, marginLeft: 8, position: 'relative' },
    filterBadge: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', borderWidth: 1.5, borderColor: '#fff' },

    list: { padding: 16, paddingBottom: 100 },
    gridRow: { justifyContent: 'space-between' },

    // List Card Styles
    listCard: {
        flexDirection: 'row', backgroundColor: "#fff",
        borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: "#F1F5F9",
        overflow: 'hidden', shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }
    },
    cardAccent: { width: 4 },
    listIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    listMain: { flex: 1, padding: 12 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    listProjectContainer: { marginTop: 2 },
    listProjectName: { fontSize: 13, fontWeight: "700", color: "#64748B" },
    listBlockName: { fontSize: 13, fontWeight: "600", color: "#94A3B8" },
    listUnitNumber: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
    typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    typePillText: { fontSize: 10, fontWeight: "800", textTransform: 'uppercase' },
    statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusPillText: { fontSize: 10, fontWeight: "800", textTransform: 'uppercase' },
    statusSubText: { fontSize: 6, fontWeight: "700", textTransform: 'uppercase', opacity: 0.8 },
    listUnit: { fontSize: 13, color: "#64748B", fontWeight: "600", marginBottom: 8 },
    listFooter: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
    listMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    listPrice: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
    listMetaText: { fontSize: 12, color: "#475569", fontWeight: "700" },

    // Grid Card Styles
    inactiveSelected: {
        backgroundColor: '#E2E8F0', // Slate 200
        borderWidth: 2,
        borderColor: '#94A3B8',
    },
    activeSelected: {
        backgroundColor: '#BBF7D0', // Green 200
        borderWidth: 2,
        borderColor: '#22C55E',
    },
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
    sheetContainer: { 
        backgroundColor: "#fff", 
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        paddingHorizontal: 20, 
        maxHeight: '85%',
        minHeight: 350 
    },
    sheetHandle: { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 },
    sheetHeader: { marginBottom: 24, alignItems: 'center' },
    sheetTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
    sheetSub: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: 'uppercase', marginTop: 4 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: 'center', gap: 12 },
    actionItem: { width: "22%", alignItems: "center", marginBottom: 16 },
    actionIcon: { width: 56, height: 56, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    actionLabel: { fontSize: 10, fontWeight: "800", color: "#475569", textAlign: "center" },

    // Contact Picker
    contactPickerSheet: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: 60, width: '100%' },
    contactItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    contactInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    contactAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    contactName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    contactRole: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
});
