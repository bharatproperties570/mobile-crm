import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Linking, Animated, Modal, Pressable, Alert
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { getCompanies, type Company } from "../services/companies.service";
import { lookupVal, safeApiCall } from "../services/api.helpers";
import { useTheme } from "../context/ThemeContext";
import { useCallTracking } from "../context/CallTrackingContext";

const RELATIONSHIP_COLORS: Record<string, string> = {
    'Developer': '#3B82F6',
    'Channel Partner': '#10B981',
    'Vendor': '#F59E0B',
    'Land Owner': '#8B5CF6',
    'Institutional Owner': '#6366F1',
    'Other': '#64748B'
};

const CompanyCard = ({ company, onPress, onMenuPress, idx }: { company: Company, onPress: () => void, onMenuPress: () => void, idx: number }) => {
    const { theme } = useTheme();
    const { trackCall } = useCallTracking();
    const color = RELATIONSHIP_COLORS[lookupVal(company.relationshipType)] || '#64748B';

    const phone = company.phones?.[0]?.phoneNumber;
    const email = company.emails?.[0]?.address;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleValue = useRef(new Animated.Value(1)).current;

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
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#2563EB" }]} onPress={() => trackCall(phone || "", company._id, "Company", company.name)}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#F59E0B" }]} onPress={() => phone && Linking.openURL(`sms:${phone}`)}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.leftActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#10B981" }]} onPress={openWhatsApp}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#6366F1" }]} onPress={() => email && Linking.openURL(`mailto:${email}`)}>
                <Ionicons name="mail" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Email</Text>
            </TouchableOpacity>
        </View>
    );

    const onPressIn = () => Animated.spring(scaleValue, { toValue: 0.98, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }).start();

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleValue }, { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                <TouchableOpacity activeOpacity={1} onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.typeBadge, { backgroundColor: color + '15' }]}>
                            <Text style={[styles.typeText, { color }]}>{lookupVal(company.relationshipType)?.toUpperCase()}</Text>
                        </View>
                        <TouchableOpacity style={styles.menuTrigger} onPress={(e) => { e.stopPropagation(); onMenuPress(); }}>
                            <Ionicons name="ellipsis-vertical" size={18} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.companyName, { color: theme.text }]} numberOfLines={1}>{company.name}</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Ionicons name="people-outline" size={14} color={theme.textLight} />
                            <Text style={[styles.statText, { color: theme.textLight }]}>{(company as any).employeeCount || 0} Employees</Text>
                        </View>
                        <View style={styles.stat}>
                            <Ionicons name="business-outline" size={14} color={theme.textLight} />
                            <Text style={[styles.statText, { color: theme.textLight }]}>{lookupVal((company as any).category)}</Text>
                        </View>
                    </View>

                    {(company as any).addresses && (company as any).addresses.registeredOffice && (
                        <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={14} color={theme.primary} />
                            <Text style={[styles.locationText, { color: theme.textLight }]} numberOfLines={1}>
                                {lookupVal((company as any).addresses.registeredOffice.city)}, {lookupVal((company as any).addresses.registeredOffice.state)}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>
        </Swipeable>
    );
};

export default function CompaniesScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Action Hub State
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(350)).current;

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
            toValue: 350,
            duration: 200,
            useNativeDriver: true
        }).start(() => {
            setHubVisible(false);
            setSelectedCompany(null);
        });
    };

    const fetchCompanies = useCallback(async (pageNum = 1, shouldAppend = false) => {
        if (!shouldAppend) setLoading(true);
        const result = await safeApiCall<any>(() => getCompanies({ page: String(pageNum), limit: "50" }));

        if (!result.error && result.data) {
            const dataObj = result.data as any;
            const newRecords = dataObj.data || dataObj.records || (Array.isArray(dataObj) ? dataObj : []);
            setCompanies(prev => shouldAppend ? [...prev, ...newRecords] : newRecords);
            setHasMore(newRecords.length === 50);
            setPage(pageNum);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchCompanies(1, false); }, [fetchCompanies]);

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
        return companies.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.relationshipType || "").toLowerCase().includes(q) ||
            lookupVal(c.industry).toLowerCase().includes(q)
        );
    }, [companies, search]);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card }]}>
                <View>
                    <Text style={[styles.title, { color: theme.text }]}>Companies</Text>
                    <Text style={[styles.subtitle, { color: theme.textLight }]}>{companies.length} industry partners</Text>
                </View>
                <TouchableOpacity
                    style={[styles.addBtnHeader, { backgroundColor: theme.primary }]}
                    onPress={() => router.push("/add-company")}
                >
                    <Ionicons name="add" size={26} color="#fff" />
                </TouchableOpacity>
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
                            onPress={() => router.push(`/company/${item._id}`)}
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

            {/* Action Hub Modal */}
            <Modal transparent visible={hubVisible} animationType="none" onRequestClose={closeHub}>
                <Pressable style={styles.modalOverlay} onPress={closeHub}>
                    <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{selectedCompany ? selectedCompany.name : "Company Actions"}</Text>
                            <Text style={styles.sheetSub}>{selectedCompany?.relationshipType || "Industry Partner"}</Text>
                        </View>

                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-company?id=${selectedCompany?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color="#64748B" />
                                </View>
                                <Text style={styles.actionLabel}>Edit</Text>
                            </TouchableOpacity >

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-employee?companyId=${selectedCompany?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                    <Ionicons name="person-add" size={24} color="#7C3AED" />
                                </View>
                                <Text style={styles.actionLabel}>Add Employee</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                Alert.alert("Assign", "Assigning company..."); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                    <Ionicons name="person-add" size={24} color="#7C3AED" />
                                </View>
                                <Text style={styles.actionLabel}>Assign</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-activity?id=${selectedCompany?._id}&type=Company`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F0F9FF" }]}>
                                    <Ionicons name="add-circle" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={styles.actionLabel}>Activity</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                Alert.alert("Tag", "Managing tags..."); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
                                    <Ionicons name="pricetags" size={24} color="#DB2777" />
                                </View>
                                <Text style={styles.actionLabel}>Tag</Text>
                            </TouchableOpacity>
                        </View >
                    </Animated.View >
                </Pressable >
            </Modal >
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
    list: { paddingBottom: 100 },
    card: {
        marginHorizontal: 16, marginBottom: 14, padding: 16, borderRadius: 24,
        borderWidth: 1
    },
    cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14, justifyContent: 'space-between' },
    companyName: { fontSize: 17, fontWeight: "800", marginBottom: 10 },
    typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
    typeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
});
