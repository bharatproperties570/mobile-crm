import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, StyleSheet, SectionList, TextInput,
    RefreshControl, ActivityIndicator, Linking, TouchableOpacity, Alert,
    Animated, Dimensions, Vibration, ScrollView, SafeAreaView, Modal, Pressable
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/Swipeable";
import {
    getContacts, contactFullName, contactPhone, contactEmail,
    lookupVal, type Contact,
} from "../services/contacts.service";
import { safeApiCall } from "../services/api.helpers";
import { useCallTracking } from "../context/CallTrackingContext";
import { useLookup } from "../context/LookupContext";
import FilterModal, { FilterField } from "../components/FilterModal";

const CONTACT_FILTER_FIELDS: FilterField[] = [
    { key: "stage", label: "Stage", type: "lookup", lookupType: "Stage" },
    { key: "source", label: "Source", type: "lookup", lookupType: "Source" },
];

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const AVATAR_COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"];

const STAGE_COLORS: Record<string, string> = {
    new: "#6366F1",
    warm: "#F59E0B",
    hot: "#EF4444",
    cold: "#94A3B8",
    active: "#10B981",
};

function getInitials(c: Contact): string {
    if (c.fullName) {
        const parts = c.fullName.split(" ").filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    const n = (c.name || "").trim();
    const s = (c.surname || "").trim();
    if (n && s) return (n[0] + s[0]).toUpperCase();
    if (n) return n.slice(0, 2).toUpperCase();
    return "?";
}

const ContactCard = memo(({ contact, idx, onPress, onMenuPress }: { contact: Contact; idx: number; onPress: () => void; onMenuPress: () => void }) => {
    const { trackCall } = useCallTracking();
    const { getLookupValue } = useLookup();
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];

    const name = contactFullName(contact);
    const phone = contactPhone(contact);
    const email = contactEmail(contact);
    const stage = (contact.stage || "new").toLowerCase();
    const stageColor = STAGE_COLORS[stage] ?? "#94A3B8";

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
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#2563EB" }]} onPress={() => trackCall(phone || "", contact._id, "Contact", name)}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: "#F59E0B" }]} onPress={() => Linking.openURL(`sms:${phone}`)}>
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
                <TouchableOpacity
                    activeOpacity={1}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    onPress={onPress}
                    style={styles.card}
                >
                    <View style={[styles.avatar, { backgroundColor: color + "15" }]}>
                        <Text style={[styles.avatarText, { color }]}>{getInitials(contact)}</Text>
                    </View>
                    <View style={styles.cardContent}>
                        <View style={styles.cardMain}>
                            <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
                            <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
                        </View>
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                            {(getLookupValue("ProfessionalDesignation", contact.designation) !== "—" && getLookupValue("ProfessionalDesignation", contact.designation) !== "")
                                ? `${getLookupValue("ProfessionalDesignation", contact.designation)} • `
                                : ""}
                            {contact.company || (phone ? phone : "Individual")}
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.menuTrigger} onPress={(e) => { e.stopPropagation(); onMenuPress(); }}>
                        <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Animated.View>
        </Swipeable>
    );
});

export default function ContactsScreen() {
    const { trackCall } = useCallTracking();
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState<any>({});

    // Action Hub State
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(350)).current;

    const openHub = (contact: Contact) => {
        setSelectedContact(contact);
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
            setSelectedContact(null);
        });
    };

    const fetchContacts = useCallback(async (pageNum = 1, shouldAppend = false) => {
        if (!shouldAppend) setLoading(true);
        const result = await safeApiCall<any>(() => getContacts({ page: String(pageNum), limit: "50" }));

        if (!result.error && result.data) {
            const dataObj = result.data as any;
            const newContacts = dataObj.data || dataObj.records || (Array.isArray(dataObj) ? dataObj : []);
            setContacts(prev => shouldAppend ? [...prev, ...newContacts] : newContacts);
            setHasMore(newContacts.length === 50);
            setPage(pageNum);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchContacts(1, false);
    }, [fetchContacts]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchContacts(page + 1, true);
        }
    }, [loading, hasMore, page, fetchContacts]);

    useFocusEffect(
        useCallback(() => {
            fetchContacts(1, false);
        }, [fetchContacts])
    );

    const sections = useMemo(() => {
        const q = search.toLowerCase();
        let filtered = contacts.filter((c) => {
            const name = contactFullName(c).toLowerCase();
            const phone = contactPhone(c);
            const comp = (c.company || "").toLowerCase();
            const tags = (c.tags || []).join(" ").toLowerCase();

            // Search match
            const matchesSearch = name.includes(q) || phone.includes(q) || comp.includes(q) || tags.includes(q);
            if (!matchesSearch) return false;

            // Filter matches
            if (activeFilter === "business" && !(c.company && c.company.trim().length > 0)) return false;
            if (activeFilter === "individual" && (c.company && c.company.trim().length > 0)) return false;

            if (filters.stage?.length > 0 && !filters.stage.includes(c.stage)) return false;
            if (filters.source?.length > 0 && !filters.source.includes(c.source)) return false;

            return true;
        });

        const groups: Record<string, Contact[]> = {};
        filtered.forEach(c => {
            const firstLetter = contactFullName(c)[0]?.toUpperCase() || "#";
            const key = /[A-Z]/.test(firstLetter) ? firstLetter : "#";
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });

        return Object.keys(groups)
            .sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
            .map(key => ({
                title: key,
                data: groups[key].sort((a, b) => contactFullName(a).localeCompare(contactFullName(b)))
            }));
    }, [contacts, search, activeFilter, filters]);

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <View>
                    <Text style={styles.headerTitle}>Phonebook</Text>
                    <Text style={styles.headerCount}>{contacts.length} CRM Relationships</Text>
                </View>
                <TouchableOpacity
                    style={[styles.headerActionBtn, { backgroundColor: "#2563EB" }]}
                    onPress={() => router.push("/add-contact")}
                >
                    <Ionicons name="person-add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.commandBar}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search relationships..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                    <TouchableOpacity onPress={() => setShowFilterModal(true)} style={styles.filterBtn}>
                        <Ionicons name="filter" size={20} color={Object.keys(filters).length > 0 ? "#2563EB" : "#94A3B8"} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.segmentContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentScroll}>
                    {['All', 'Individual', 'Business'].map((filter) => {
                        const isActive = activeFilter === filter.toLowerCase();
                        return (
                            <TouchableOpacity
                                key={filter}
                                style={[styles.segmentItem, isActive && styles.segmentItemActive]}
                                onPress={() => {
                                    Vibration.vibrate(10);
                                    setActiveFilter(filter.toLowerCase());
                                }}
                            >
                                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{filter}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {loading ? (
                    <ActivityIndicator color="#2563EB" size="large" style={{ marginTop: 100 }} />
                ) : (
                    <SectionList
                        sections={sections}
                        keyExtractor={(item) => item._id}
                        ListHeaderComponent={renderHeader}
                        renderItem={({ item, index }) => (
                            <ContactCard
                                contact={item}
                                idx={index}
                                onPress={() => router.push(`/contact-detail?id=${item._id}`)}
                                onMenuPress={() => openHub(item)}
                            />
                        )}
                        renderSectionHeader={({ section: { title } }) => (
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>{title}</Text>
                            </View>
                        )}
                        initialNumToRender={15}
                        maxToRenderPerBatch={20}
                        windowSize={10}
                        removeClippedSubviews={true}
                        stickySectionHeadersEnabled={true}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
                        ListFooterComponent={loading && page > 1 ? <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} /> : null}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Ionicons name="people-outline" size={64} color="#CBD5E1" />
                                <Text style={styles.emptyText}>{search ? "No results found." : "Quiet here. No contacts found."}</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            {/* Action Hub Modal */}
            <Modal transparent visible={hubVisible} animationType="none" onRequestClose={closeHub}>
                <Pressable style={styles.modalOverlay} onPress={closeHub}>
                    <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{selectedContact ? contactFullName(selectedContact) : "Contact Actions"}</Text>
                            <Text style={styles.sheetSub}>{selectedContact?.company || "Professional Contact"}</Text>
                        </View>

                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-contact?id=${selectedContact?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color="#64748B" />
                                </View>
                                <Text style={styles.actionLabel}>Edit</Text>
                            </TouchableOpacity >

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-document?id=${selectedContact?._id}&type=Contact`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F0F9FF" }]}>
                                    <Ionicons name="document-attach" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={styles.actionLabel}>Document</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/sequences?id=${selectedContact?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                    <Ionicons name="repeat" size={24} color="#8B5CF6" />
                                </View>
                                <Text style={styles.actionLabel}>Sequence</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-lead?refContact=${selectedContact?._id}`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
                                    <Ionicons name="person-add" size={24} color="#DB2777" />
                                </View>
                                <Text style={styles.actionLabel}>Lead</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                router.push(`/add-activity?id=${selectedContact?._id}&type=Contact`); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F0F9FF" }]}>
                                    <Ionicons name="add-circle" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={styles.actionLabel}>Activity</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                Alert.alert("Assign", "Assigning contact..."); closeHub();
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                    <Ionicons name="people" size={24} color="#7C3AED" />
                                </View>
                                <Text style={styles.actionLabel}>Assign</Text>
                            </TouchableOpacity>
                        </View >
                    </Animated.View >
                </Pressable >
            </Modal >

            <FilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={setFilters}
                initialFilters={filters}
                fields={CONTACT_FILTER_FIELDS}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    safeArea: { flex: 1, backgroundColor: "#fff" },
    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, backgroundColor: "#fff" },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 32, fontWeight: "900", color: "#0F172A", letterSpacing: -1 },
    headerCount: { fontSize: 13, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
    headerActionBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
    commandBar: { marginBottom: 16 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 12, height: 48 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: "#1E293B", fontWeight: "500" },
    filterBtn: { padding: 4, marginLeft: 8 },

    segmentContainer: { marginTop: 4 },
    segmentScroll: { gap: 8 },
    segmentItem: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#F1F5F9" },
    segmentItemActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    segmentText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
    segmentTextActive: { color: "#fff" },

    list: { paddingBottom: 120 },
    sectionHeader: { backgroundColor: "#F8FAFC", paddingHorizontal: 20, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: "#2563EB" },

    card: {
        flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10,
        backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9"
    },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 16 },
    avatarText: { fontSize: 16, fontWeight: "800" },
    cardContent: { flex: 1 },
    cardMain: { flexDirection: "row", alignItems: "center" },
    cardName: { fontSize: 16, fontWeight: "700", color: "#334155", marginRight: 8 },
    stageDot: { width: 8, height: 8, borderRadius: 4 },
    cardSubtitle: { fontSize: 13, color: "#94A3B8", marginTop: 2, fontWeight: "500" },

    rightActions: { flexDirection: 'row', gap: 0, paddingLeft: 10 },
    leftActions: { flexDirection: 'row', gap: 0, paddingRight: 10 },
    swipeAction: { width: 70, height: '100%', justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },

    empty: { alignItems: 'center', marginTop: 100, gap: 12 },
    emptyText: { fontSize: 15, color: "#94A3B8", fontWeight: "600" },

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
