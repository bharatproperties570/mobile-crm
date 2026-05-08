import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Linking, Animated, Modal, Pressable, Alert, Dimensions, ScrollView
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { getCompanies, type Company } from "@/services/companies.service";
import { lookupVal, safeApiCall, safeApiCallSingle, extractList } from "@/services/api.helpers";
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useCallTracking } from "@/context/CallTrackingContext";
import { useUsers } from "@/context/UserContext";
import { Vibration } from "react-native";
import { updateCompany } from "@/services/companies.service";
import FilterModal, { FilterField } from "@/components/FilterModal";
import { getCompanyGroups, CompanyGroup, bulkAssignCompanies, createCompanyGroup, deleteCompanyGroup } from "@/services/companyGroups.service";
import api from "@/services/api";

const COMPANY_FILTER_FIELDS: FilterField[] = [
    { key: "relationshipType", label: "Relationship Type", type: "lookup", lookupType: "RelationshipType" },
    { key: "industry", label: "Industry", type: "lookup", lookupType: "Industry" },
    { key: "category", label: "Category", type: "lookup", lookupType: "Category" },
    { key: "source", label: "Source", type: "lookup", lookupType: "Source" },
];

const RELATIONSHIP_COLORS_LIGHT: Record<string, string> = {
    'Developer': '#3B82F6',
    'Channel Partner': '#10B981',
    'Vendor': '#F59E0B',
    'Land Owner': '#8B5CF6',
    'Institutional Owner': '#6366F1',
    'Other': '#64748B'
};

const RELATIONSHIP_COLORS_DARK: Record<string, string> = {
    'Developer': '#60A5FA',
    'Channel Partner': '#34D399',
    'Vendor': '#FBBF24',
    'Land Owner': '#A78BFA',
    'Institutional Owner': '#818CF8',
    'Other': '#94A3B8'
};

const CompanyCard = ({ company, onPress, onMenuPress, idx, groups = [] }: { company: Company, onPress: () => void, onMenuPress: () => void, idx: number, groups?: CompanyGroup[] }) => {
    if (!company) return null;
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const { trackCall } = useCallTracking();
    const color = (isDark ? RELATIONSHIP_COLORS_DARK : RELATIONSHIP_COLORS_LIGHT)[lookupVal(company.relationshipType)] || '#64748B';

    const phone = company.phones?.[0]?.phoneNumber;
    const email = company.emails?.[0]?.address;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const animatePress = (toValue: number) => {
        Animated.spring(scaleAnim, {
            toValue,
            useNativeDriver: true,
            tension: 100,
            friction: 5
        }).start();
    };

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            delay: idx * 30,
            useNativeDriver: true,
        }).start();
    }, [idx]);

    const openWhatsApp = () => {
        if (!phone) return;
        const cleanPhone = phone.replace(/[^0-9]/g, "");
        Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
    };

    const renderRightActions = () => (
        <View style={styles.rightActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#1E40AF' : "#2563EB" }]} onPress={() => trackCall(phone || "", company._id, "Company", company.name)}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#92400E' : "#F59E0B" }]} onPress={() => phone && Linking.openURL(`sms:${phone}`)}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.leftActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#065F46' : "#10B981" }]} onPress={openWhatsApp}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#3730A3' : "#6366F1" }]} onPress={() => email && Linking.openURL(`mailto:${email}`)}>
                <Ionicons name="mail" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Email</Text>
            </TouchableOpacity>
        </View>
    );

    const companyGroups = useMemo(() => {
        const groupIds = (company as any).groups || [];
        return groups.filter(g => groupIds.includes(g._id));
    }, [company, groups]);

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <Pressable 
                onPressIn={() => animatePress(0.97)}
                onPressOut={() => animatePress(1)}
                onPress={onPress}
            >
                <Animated.View style={[
                    { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }
                ]}>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.companyName, { color: theme.text }]} numberOfLines={1}>{company.name}</Text>
                            {company?.isVerifiedBroker && (
                                <Ionicons name="checkmark-seal" size={16} color="#3B82F6" />
                            )}
                        </View>
                        <TouchableOpacity style={styles.menuTrigger} onPress={(e) => { e.stopPropagation(); onMenuPress(); }}>
                            <Ionicons name="ellipsis-vertical" size={18} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    {companyGroups.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {companyGroups.map(g => (
                                <View key={g._id} style={{ backgroundColor: g.color + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderSize: 1, borderColor: g.color + '30' }}>
                                    <Text style={{ fontSize: 9, fontWeight: '800', color: g.color }}>{g.name.toUpperCase()}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {(phone || email) ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, marginTop: -2 }}>
                            {phone ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="call-outline" size={12} color={theme.textLight} />
                                    <Text style={{ fontSize: 12, color: theme.textLight, fontWeight: '600' }}>{phone}</Text>
                                </View>
                            ) : null}
                            {email ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                                    <Ionicons name="mail-outline" size={12} color={theme.textLight} />
                                    <Text style={{ fontSize: 12, color: theme.textLight, fontWeight: '600' }} numberOfLines={1}>{email}</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            {(company as any).addresses?.registeredOffice && (
                                <View style={styles.locationRow}>
                                    <Ionicons name="location-outline" size={14} color={theme.primary} />
                                    <Text style={[styles.locationText, { color: theme.textLight }]} numberOfLines={1}>
                                        {lookupVal((company as any).addresses.registeredOffice.city)}, {lookupVal((company as any).addresses.registeredOffice.state)}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={{ alignItems: 'flex-end', maxWidth: '55%' }}>
                            {(() => {
                                const typeName = lookupVal((company as any).companyType) || lookupVal((company as any).category);
                                const indName = lookupVal(company.industry);
                                const isAgent = (typeName?.toLowerCase() === 'real estate agent' || indName?.toLowerCase() === 'real estate agent' || typeName?.toLowerCase() === 'channel partner');

                                const textColor = isAgent ? (isDark ? '#FB923C' : '#EA580C') : theme.textLight;
                                const bgColor = isAgent ? (isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9');

                                if (typeName || indName) {
                                    return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bgColor, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 }}>
                                            <Ionicons name="briefcase" size={10} color={textColor} />
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: textColor, textTransform: 'uppercase' }} numberOfLines={1} ellipsizeMode="tail">
                                                {[typeName, indName].filter(Boolean).join(' • ')}
                                            </Text>
                                        </View>
                                    );
                                }
                                return null;
                            })()}
                        </View>
                    </View>
                    </View>
                </Animated.View>
            </Pressable>
        </Swipeable>
    );
};

export default function CompaniesScreen() {
    const { theme, isDarkMode } = useTheme();
    const isDark = isDarkMode;
    const router = useRouter();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState<any>({});
    const [sortVisible, setSortVisible] = useState(false);
    const [sortConfig, setSortConfig] = useState({ label: 'Newest First', by: 'createdAt', order: -1, icon: 'time-outline' });

    // Action Hub State
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    const [groups, setGroups] = useState<CompanyGroup[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupColor, setNewGroupColor] = useState("#6366F1");
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [showGlobalGroups, setShowGlobalGroups] = useState(false);
    
    const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
    const { users } = useUsers();

    const fetchGroups = async () => {
        setLoadingGroups(true);
        try {
            const res = await safeApiCall(getCompanyGroups);
            if (!res.error) {
                // safeApiCall already returns the list in .data
                setGroups(res.data);
            } else {
                console.warn("[Groups] Fetch failed:", res.error);
            }
        } catch (err) {
            console.error("[Groups] Critical fetch error:", err);
        } finally {
            setLoadingGroups(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        setCreatingGroup(true);
        try {
            const res = await safeApiCallSingle(() => createCompanyGroup({
                name: newGroupName,
                color: newGroupColor,
                category: 'Broker'
            }));

            if (!res.error) {
                // Refetch to ensure state is perfectly in sync with server
                await fetchGroups();
                
                setNewGroupName("");
                setIsCreatingGroup(false); 
                Vibration.vibrate(10);
                
                if (showGlobalGroups) {
                    Alert.alert("Success", "Group created and added to list.");
                } else {
                    setShowGroupPicker(false);
                    closeHub();
                    Alert.alert("Success", "New broker group created!");
                }
            } else {
                const errorMsg = res.error || "Failed to create group. The name might already exist.";
                Alert.alert("Creation Failed", errorMsg);
            }
        } catch (err) {
            console.error("[Groups] Create handler error:", err);
            Alert.alert("Error", "An unexpected error occurred while updating the UI.");
        } finally {
            setCreatingGroup(false);
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        Alert.alert(
            "Delete Group",
            "Are you sure? This will remove this group from all companies.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        const res = await safeApiCallSingle(() => deleteCompanyGroup(groupId));
                        if (!res.error) {
                            setGroups(prev => prev.filter(g => g._id !== groupId));
                            Vibration.vibrate(20);
                        } else {
                            Alert.alert("Delete Failed", res.error);
                        }
                    }
                }
            ]
        );
    };

    const openHub = (company: Company) => {
        setSelectedCompany(company);
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
            setSelectedCompany(null);
            setShowReassign(false);
        });
    };

    const fetchCompanies = useCallback(async (pageNum = 1, shouldAppend = false) => {
        setLoading(true);
        const result = await safeApiCall<any>(() => getCompanies({ 
            page: String(pageNum), 
            limit: "50",
            sortBy: sortConfig.by,
            sortOrder: String(sortConfig.order)
        }));

        if (!result.error && result.data) {
            const newRecords = extractList(result.data);
            
            setCompanies(prev => {
                const combined = shouldAppend ? [...prev, ...newRecords] : newRecords;
                const seen = new Set();
                return combined.filter((c: any) => {
                    const id = c?._id || c?.id;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
            });
            
            setHasMore(newRecords.length === 50);
            setPage(pageNum);
        }
        setLoading(false);
        setRefreshing(false);
    }, [sortConfig.by, sortConfig.order, safeApiCall]);

    useFocusEffect(
        useCallback(() => {
            fetchCompanies(1, false);
        }, [fetchCompanies, sortConfig])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchCompanies(1, false);
    }, [fetchCompanies]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchCompanies(page + 1, true);
        }
    }, [loading, hasMore, page, fetchCompanies]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return companies.filter(c => {
            // Search match
            const matchesSearch = c.name.toLowerCase().includes(q) ||
                (c.relationshipType || "").toLowerCase().includes(q) ||
                lookupVal(c.industry).toLowerCase().includes(q);
            if (!matchesSearch) return false;

            // Filter matches
            if (filters.relationshipType?.length > 0 && !filters.relationshipType.includes(c.relationshipType)) return false;
            if (filters.industry?.length > 0 && !filters.industry.includes(c.industry)) return false;
            if (filters.category?.length > 0 && !filters.category.includes(c.category)) return false;
            if (filters.source?.length > 0 && !filters.source.includes(c.source)) return false;

            return true;
        });
    }, [companies, search, filters]);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card }]}>
                <View>
                    <Text style={[styles.title, { color: theme.text }]}>Companies</Text>
                    <Text style={[styles.subtitle, { color: theme.textLight }]}>{companies.length} industry partners</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        style={[styles.addBtnHeader, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}
                        onPress={() => setShowGlobalGroups(true)}
                    >
                        <Ionicons name="pricetags" size={22} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.addBtnHeader, { backgroundColor: theme.primary }]}
                        onPress={() => router.push("/add-company")}
                    >
                        <Ionicons name="add" size={26} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.searchBar, { backgroundColor: (theme as any).inputBg || theme.card, borderColor: theme.border }]}>
                <Ionicons name="search" size={18} color={theme.textLight} />
                <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search Partners, Industries, Types..."
                    placeholderTextColor={theme.textLight + "80"}
                    value={search}
                    onChangeText={setSearch}
                />
                <TouchableOpacity onPress={() => setSortVisible(true)} style={styles.sortBtn}>
                    <Ionicons name="swap-vertical" size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowFilterModal(true)} style={styles.filterBtn}>
                    <Ionicons name="filter" size={20} color={Object.keys(filters).length > 0 ? theme.primary : theme.textLight} />
                </TouchableOpacity>
            </View>

            {loading && page === 1 ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item, index: idx }) => (
                        <CompanyCard
                            company={item}
                            idx={idx}
                            groups={groups}
                            onPress={() => router.push(`/company-detail?id=${item._id}`)}
                            onMenuPress={() => openHub(item)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                    ListFooterComponent={loading && page > 1 ? <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="business-outline" size={64} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>{search ? "No partners found" : "Database is empty"}</Text>
                        </View>
                    }
                />
            )}

            {/* Sort Modal */}
            <Modal visible={sortVisible} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setSortVisible(false)}>
                    <View style={[styles.sheetContainer, { backgroundColor: theme.card }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: theme.text, textAlign: 'center', flex: 1 }]}>SORT COMPANIES</Text>
                        </View>
                        <View style={{ padding: 20, gap: 10 }}>
                            {[
                                { label: 'Newest First', by: 'createdAt', order: -1, icon: 'time-outline' },
                                { label: 'Oldest First', by: 'createdAt', order: 1, icon: 'hourglass-outline' },
                                { label: 'Name (A-Z)', by: 'name', order: 1, icon: 'text-outline' },
                            ].map((opt: any) => (
                                <TouchableOpacity 
                                    key={opt.label}
                                    onPress={() => {
                                        setSortConfig(opt);
                                        setSortVisible(false);
                                    }}
                                    style={[
                                        styles.sortItem, 
                                        sortConfig.label === opt.label && { backgroundColor: theme.primary + '15', borderColor: theme.primary }
                                    ]}
                                >
                                    <Ionicons name={opt.icon as any} size={20} color={sortConfig.label === opt.label ? theme.primary : theme.textMuted} />
                                    <Text style={{ flex: 1, color: sortConfig.label === opt.label ? theme.primary : theme.text, fontWeight: '700' }}>{opt.label}</Text>
                                    {sortConfig.label === opt.label && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* Action Hub Modal */}
            <Modal transparent visible={hubVisible} animationType="none" onRequestClose={closeHub}>
                <Pressable style={[styles.modalOverlay, { backgroundColor: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(15, 23, 42, 0.4)" }]} onPress={closeHub}>
                    {selectedCompany && (
                        <Animated.View style={[styles.sheetContainer, { backgroundColor: theme.card, transform: [{ translateY: slideAnim }] }]}>
                        <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: theme.text }]}>{selectedCompany ? selectedCompany.name : "Company Actions"}</Text>
                            <Text style={[styles.sheetSub, { color: theme.textLight }]}>{selectedCompany?.relationshipType || "Industry Partner"}</Text>
                        </View>

                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-company?id=${selectedCompany?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color={isDark ? theme.textLight : "#64748B"} />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textLight }]}>Edit</Text>
                            </TouchableOpacity >

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-employee?companyId=${selectedCompany?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : "#F5F3FF" }]}>
                                    <Ionicons name="person-add" size={24} color={isDark ? '#A78BFA' : "#7C3AED"} />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textLight }]}>Add Employee</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => setShowReassign(!showReassign)}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : "#F5F3FF" }]}>
                                    <Ionicons name="person-add" size={24} color={isDark ? '#A78BFA' : "#7C3AED"} />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textLight }]}>Assign</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-activity?id=${selectedCompany?._id}&type=Company`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : "#F0F9FF" }]}>
                                    <Ionicons name="add-circle" size={24} color={isDark ? '#38BDF8' : "#0EA5E9"} />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textLight }]}>Activity</Text>
                            </TouchableOpacity>


                            <TouchableOpacity style={styles.actionItem} onPress={async () => {
                                const newStatus = !selectedCompany?.isVerifiedBroker;
                                const res = await safeApiCall(() => updateCompany(selectedCompany!._id, { isVerifiedBroker: newStatus }));
                                if (!res.error) {
                                    setCompanies(prev => prev.map(c => c._id === selectedCompany!._id ? { ...c, isVerifiedBroker: newStatus } : c));
                                    Vibration.vibrate(50);
                                    closeHub();
                                }
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: selectedCompany?.isVerifiedBroker ? 'rgba(59, 130, 246, 0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9') }]}>
                                    <Ionicons name="checkmark-seal" size={24} color={selectedCompany?.isVerifiedBroker ? '#3B82F6' : (isDark ? theme.textLight : "#64748B")} />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textLight }]}>{selectedCompany?.isVerifiedBroker ? "Verified" : "Verify"}</Text>
                            </TouchableOpacity>
                            </View >

                            {showGroupPicker && (
                                <View style={{ backgroundColor: isDark ? 'rgba(219, 39, 119, 0.05)' : '#FDF2F8', padding: 20, marginTop: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#DB2777' }}>ASSIGN TO GROUPS</Text>
                                        <TouchableOpacity onPress={() => setShowGroupPicker(false)}>
                                            <Ionicons name="close" size={20} color={theme.textLight} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {groups.map((g) => {
                                            const isSelected = selectedCompany?.groups?.includes(g._id);
                                            return (
                                                <TouchableOpacity
                                                    key={g._id}
                                                    style={{ 
                                                        backgroundColor: isSelected ? g.color : g.color + '15',
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 6,
                                                        borderRadius: 8,
                                                        borderWidth: 1,
                                                        borderColor: g.color + '30',
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 6
                                                    }}
                                                    onPress={async () => {
                                                        const action = isSelected ? 'remove' : 'add';
                                                        const res = await safeApiCall(() => bulkAssignCompanies([selectedCompany!._id], [g._id], action));
                                                        if (!res.error) {
                                                            setCompanies(prev => prev.map(c => {
                                                                if (c._id === selectedCompany!._id) {
                                                                    const currentGroups = (c as any).groups || [];
                                                                    const updatedGroups = isSelected 
                                                                        ? currentGroups.filter((id: string) => id !== g._id)
                                                                        : [...currentGroups, g._id];
                                                                    return { ...c, groups: updatedGroups };
                                                                }
                                                                return c;
                                                            }));
                                                            Vibration.vibrate(10);
                                                        }
                                                    }}
                                                >
                                                    <Text style={{ color: isSelected ? '#fff' : g.color, fontWeight: '800', fontSize: 11 }}>{g.name.toUpperCase()}</Text>
                                                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                </TouchableOpacity>
                                            );
                                        })}
                                        <TouchableOpacity 
                                            style={{ backgroundColor: theme.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderStyle: 'dashed', borderWidth: 1 }}
                                            onPress={() => setIsCreatingGroup(true)}
                                        >
                                            <Text style={{ color: theme.textLight, fontWeight: '700', fontSize: 11 }}>+ NEW GROUP</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {isCreatingGroup && (
                                        <View style={{ marginTop: 15, padding: 12, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.primary + '30' }}>
                                            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text, marginBottom: 8 }}>NEW GROUP NAME</Text>
                                            <TextInput 
                                                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', padding: 10, borderRadius: 8, color: theme.text, fontSize: 14, fontWeight: '600' }}
                                                placeholder="e.g. DLF Specialists"
                                                placeholderTextColor={theme.textLight + '60'}
                                                value={newGroupName}
                                                onChangeText={setNewGroupName}
                                                autoFocus
                                            />
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899'].map(c => (
                                                        <TouchableOpacity 
                                                            key={c} 
                                                            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c, borderWidth: newGroupColor === c ? 2 : 0, borderColor: theme.text }}
                                                            onPress={() => setNewGroupColor(c)}
                                                        />
                                                    ))}
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                                    <TouchableOpacity onPress={() => setIsCreatingGroup(false)}>
                                                        <Text style={{ color: theme.textLight, fontWeight: '700' }}>Cancel</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        onPress={handleCreateGroup} 
                                                        style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, minWidth: 80, alignItems: 'center' }}
                                                        disabled={creatingGroup}
                                                    >
                                                        {creatingGroup ? (
                                                            <ActivityIndicator size="small" color="#fff" />
                                                        ) : (
                                                            <Text style={{ color: '#fff', fontWeight: '800' }}>Create</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

                            {showReassign && (
                                <View style={{ backgroundColor: isDark ? 'rgba(124, 58, 237, 0.05)' : '#F5F3FF', padding: 20, marginTop: 10 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#7C3AED', marginBottom: 12 }}>ASSIGN TO RM</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                        {users.map((u) => {
                                            const isAssigned = selectedCompany?.owner === u._id || (typeof selectedCompany?.owner === 'object' && selectedCompany?.owner?._id === u._id);
                                            return (
                                                <TouchableOpacity
                                                    key={u._id}
                                                    style={{ 
                                                        borderColor: isAssigned ? '#7C3AED' : theme.border, 
                                                        backgroundColor: isAssigned ? '#7C3AED10' : theme.card,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 8,
                                                        borderRadius: 12,
                                                        borderWidth: 1
                                                    }}
                                                    onPress={async () => {
                                                        const res = await safeApiCall(() => updateCompany(selectedCompany!._id, { owner: u._id }));
                                                        if (!res.error) {
                                                            setCompanies(prev => prev.map(c => 
                                                                c._id === selectedCompany!._id ? { ...c, owner: u._id } : c
                                                            ));
                                                            closeHub();
                                                            Vibration.vibrate(20);
                                                            Alert.alert("Success", "Company assigned successfully.");
                                                        }
                                                    }}
                                                >
                                                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary }}>{(u.fullName || u.name || "?")[0].toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={{ color: isAssigned ? '#7C3AED' : theme.text, fontWeight: '600' }}>{u.fullName || u.name}</Text>
                                                    {isAssigned && <Ionicons name="checkmark-circle" size={16} color="#7C3AED" />}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}
                        </Animated.View >
                    )}
                </Pressable >
            </Modal >

            {/* Global Group Manager Modal */}
            <Modal visible={showGlobalGroups} transparent animationType="slide">
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.sheetContainer, { backgroundColor: theme.card, height: '70%' }]}>
                        <View style={styles.sheetHandle} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={[styles.sheetTitle, { color: theme.text }]}>MANAGE GROUPS</Text>
                                <TouchableOpacity onPress={fetchGroups} style={{ padding: 4 }}>
                                    {loadingGroups ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="refresh-circle" size={24} color={theme.primary} />}
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => setShowGlobalGroups(false)}>
                                <Ionicons name="close-circle" size={28} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
                            <TouchableOpacity 
                                style={{ marginTop: 10, padding: 16, borderRadius: 16, backgroundColor: theme.primary + '10', borderStyle: 'dashed', borderWidth: 1, borderColor: theme.primary, alignItems: 'center' }}
                                onPress={() => setIsCreatingGroup(true)}
                            >
                                <Text style={{ color: theme.primary, fontWeight: '800' }}>+ CREATE NEW GROUP</Text>
                            </TouchableOpacity>

                            {isCreatingGroup && (
                                <View style={{ marginTop: 15, padding: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: theme.border }}>
                                    <TextInput 
                                        style={{ backgroundColor: theme.card, padding: 12, borderRadius: 12, color: theme.text, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: theme.border }}
                                        placeholder="Group Name..."
                                        placeholderTextColor={theme.textLight}
                                        value={newGroupName}
                                        onChangeText={setNewGroupName}
                                    />
                                    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 15, justifyContent: 'center' }}>
                                        {['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'].map(c => (
                                            <TouchableOpacity 
                                                key={c} 
                                                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: newGroupColor === c ? 3 : 0, borderColor: theme.text }}
                                                onPress={() => setNewGroupColor(c)}
                                            />
                                        ))}
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity style={{ flex: 1, padding: 12, alignItems: 'center' }} onPress={() => setIsCreatingGroup(false)}>
                                            <Text style={{ color: theme.textLight, fontWeight: '700' }}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={{ flex: 1, backgroundColor: theme.primary, padding: 12, borderRadius: 12, alignItems: 'center' }}
                                            onPress={handleCreateGroup}
                                        >
                                            {creatingGroup ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Create</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            <View style={{ marginTop: 20 }}>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: theme.textLight, marginBottom: 15, letterSpacing: 1 }}>EXISTING GROUPS</Text>
                                {groups.map(g => (
                                    <View key={g._id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: g.color }} />
                                            <View>
                                                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 14 }}>{g.name}</Text>
                                                <Text style={{ color: theme.textLight, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>{g.category}</Text>
                                            </View>
                                        </View>
                                        {!g.isSystem && (
                                            <TouchableOpacity onPress={() => handleDeleteGroup(g._id)} style={{ padding: 8 }}>
                                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <FilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={setFilters}
                initialFilters={filters}
                fields={COMPANY_FILTER_FIELDS}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20
    },
    title: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
    subtitle: { fontSize: 13, fontWeight: "600", marginTop: 2 },
    addBtnHeader: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    searchBar: {
        flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 16,
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1
    },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: "600" },
    filterBtn: { padding: 4, marginLeft: 8 },
    list: { paddingBottom: 100 },
    card: {
        marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 16,
        borderWidth: 1
    },
    cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 2, justifyContent: 'space-between' },
    companyName: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
    typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
    typeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 12, fontWeight: '600' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locationText: { fontSize: 12, fontWeight: '600', flex: 1 },
    empty: { alignItems: "center", marginTop: 120, paddingHorizontal: 40 },
    emptyText: { textAlign: 'center', marginTop: 100, fontSize: 16 },

    rightActions: { flexDirection: 'row', width: 140 },
    leftActions: { flexDirection: 'row', width: 140 },
    swipeAction: { flex: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 4 },

    // Action Hub Styles
    menuTrigger: { padding: 8, marginRight: -8 },
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
    sortBtn: { padding: 4, marginLeft: 8 },
    sortItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
});
