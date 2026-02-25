import { useEffect, useState, useRef, useCallback } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Animated, Linking, Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./context/ThemeContext";
import api from "./services/api";
import { getActivities } from "./services/activities.service";
import { useLookup } from "./context/LookupContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS = ["Details", "Location", "Activities", "Owner", "Document", "History"];

function lv(field: unknown): string {
    if (field === null || field === undefined || field === "" || field === "null" || field === "undefined") return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field && (field as any).lookup_value) return (field as any).lookup_value;
        if ("fullName" in field && (field as any).fullName) return (field as any).fullName;
        if ("name" in field && (field as any).name) return (field as any).name;
    }
    const str = String(field).trim();
    return str || "—";
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

const STATUS_COLORS: Record<string, string> = {
    available: "#10B981", sold: "#EF4444", "under offer": "#F59E0B",
    reserved: "#8B5CF6", blocked: "#F97316", rented: "#3B82F6",
};

export default function InventoryDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { getLookupValue } = useLookup();
    const [inv, setInv] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    const tabScrollViewRef = useRef<ScrollView>(null);
    const contentScrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [invRes, actRes] = await Promise.all([
                api.get(`/inventory/${id}`),
                getActivities({ entityId: id, limit: 20 })
            ]);

            const currentInv = invRes.data?.data ?? invRes.data;
            setInv(currentInv);
            setActivities(Array.isArray(actRes?.data) ? actRes.data : (Array.isArray(actRes) ? actRes : []));

            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (error) {
            console.error("Fetch error:", error);
            Alert.alert("Error", "Could not load inventory details");
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
    if (!inv) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={[styles.noData, { color: theme.textLight }]}>Unit not found</Text></View>;

    const statusLabel = lv(inv.status);
    const statusColor = STATUS_COLORS[statusLabel.toLowerCase()] ?? theme.primary;
    const unitNo = inv.unitNumber || inv.unitNo || "N/A";
    const unitType = lv(inv.unitType);
    const projectName = inv.projectName || "Unknown Project";
    const block = inv.block || "—";

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
                    <View style={styles.statusContainer}>
                        <View style={[styles.statusRing, { borderColor: statusColor + '40' }]}>
                            <Ionicons name="home" size={20} color={statusColor} />
                            <Text style={[styles.statusLabel, { color: theme.textLight }]}>{statusLabel.toUpperCase()}</Text>
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
                                {lv(inv.assignedTo)}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.strategyDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.strategyBlock}>
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>TEAM</Text>
                        <View style={styles.strategyValueRow}>
                            <Ionicons name="people-outline" size={14} color="#6366F1" />
                            <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                {lv(inv.team)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Marketing & Acquisition Row */}
                <View style={styles.marketingRow}>
                    <View style={[styles.marketingPill, { backgroundColor: statusColor + '10' }]}>
                        <Ionicons name="stats-chart" size={12} color={statusColor} />
                        <Text style={[styles.marketingText, { color: statusColor }]}>
                            {statusLabel.toUpperCase()}
                        </Text>
                    </View>

                    {inv.intent && (
                        <View style={[styles.marketingPill, { backgroundColor: '#7C3AED' + '10' }]}>
                            <Ionicons name="flag" size={12} color="#7C3AED" />
                            <Text style={[styles.marketingText, { color: '#7C3AED' }]}>
                                {lv(inv.intent).toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Professional Action Hub */}
                <View style={styles.modernActionHub}>
                    {(() => {
                        const primaryOwner = inv.owners?.[0];
                        const ownerName = lv(primaryOwner);
                        const ownerPhone = primaryOwner?.phones?.[0]?.number || "";
                        const ownerEmail = primaryOwner?.emails?.[0]?.address || "";
                        const cleanPhone = ownerPhone.replace(/\D/g, "");

                        return [
                            { icon: 'call', color: theme.primary, onPress: () => ownerPhone ? Linking.openURL(`tel:${cleanPhone}`) : Alert.alert("No Phone", "Owner contact number not available") },
                            { icon: 'chatbubble-ellipses', color: '#3B82F6', onPress: () => ownerPhone ? Linking.openURL(`sms:${cleanPhone}`) : Alert.alert("No Phone", "Owner contact number not available") },
                            { icon: 'logo-whatsapp', color: '#128C7E', onPress: () => ownerPhone ? Linking.openURL(`https://wa.me/${cleanPhone}`) : Alert.alert("No Phone", "Owner contact number not available") },
                            { icon: 'mail', color: '#EA4335', onPress: () => ownerEmail ? Linking.openURL(`mailto:${ownerEmail}`) : Alert.alert("No Email", "Owner email address not available") },
                            { icon: 'share-social', color: '#6366F1', onPress: () => Alert.alert("Share Wall", `Sharing details for Unit ${unitNo} at ${projectName}`) },
                        ].map((action, i) => (
                            <TouchableOpacity key={i} style={[styles.modernHubBtn, { backgroundColor: action.color }]} onPress={action.onPress}>
                                <Ionicons name={action.icon as any} size={20} color="#fff" />
                            </TouchableOpacity>
                        ));
                    })()}
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
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Pricing & Commercials</Text>
                            <InfoRow label="Demand" value={inv.price ? `₹${inv.price.toLocaleString("en-IN")}` : "—"} icon="cash-outline" accent />
                            <InfoRow label="Maintenance" value={inv.maintenance} icon="construct-outline" />
                            <InfoRow label="Ownership" value={lv(inv.ownership)} icon="document-text-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Unit Configuration</Text>
                            <InfoRow label="Category" value={lv(inv.category)} icon="list-outline" />
                            <InfoRow label="Sub-Category" value={lv(inv.subCategory)} icon="layers-outline" />
                            <InfoRow label="Size" value={inv.size ? `${inv.size} ${inv.sizeUnit || ""}` : "—"} icon="cube-outline" accent />
                            <InfoRow label="Facing" value={lv(inv.facing)} icon="compass-outline" />
                            <InfoRow label="Floor" value={inv.floor} icon="layers-outline" />
                            <InfoRow label="Road Width" value={inv.roadWidth} icon="trail-sign-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Area Breakdown</Text>
                            <InfoRow label="Built-up Area" value={inv.builtUpArea} icon="business-outline" />
                            <InfoRow label="Carpet Area" value={inv.carpetArea} icon="grid-outline" />
                        </View>

                        {inv.amenities && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Amenities</Text>
                                <View style={styles.chipRow}>
                                    {Object.entries(inv.amenities).map(([key, val], i) => val ? (
                                        <View key={i} style={[styles.chip, { backgroundColor: theme.primary + '15' }]}>
                                            <Text style={[styles.chipText, { color: theme.primary }]}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                                        </View>
                                    ) : null)}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* 2. Location */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Property Location</Text>
                            <InfoRow label="City" value={inv.city || inv.address?.city} icon="business-outline" />
                            <InfoRow label="Sector/Locality" value={inv.sector || inv.address?.locality} icon="map-outline" />
                            <InfoRow label="Address" value={inv.address?.street || inv.address?.hNo} icon="location-outline" />
                        </View>

                        {(inv.latitude || inv.address?.lat) && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Map Integration</Text>
                                <TouchableOpacity
                                    style={[styles.googleMapsBtn, { backgroundColor: theme.primary }]}
                                    onPress={() => {
                                        const lat = inv.latitude || inv.address?.lat;
                                        const lng = inv.longitude || inv.address?.lng;
                                        const label = `${unitNo}, ${projectName}`;
                                        Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}(${label})`);
                                    }}
                                >
                                    <Ionicons name="map" size={18} color="#fff" />
                                    <Text style={styles.googleMapsBtnText}>Open in Google Maps</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* 3. Activities */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Activity History</Text>
                                <TouchableOpacity onPress={() => router.push(`/add-activity?id=${id}&type=Inventory`)}>
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
                                                <Text style={[styles.timelineType, { color: theme.primary }]}>{act.type?.toUpperCase() || "ACTIVITY"}</Text>
                                                <Text style={styles.timelineDate}>{new Date(act.createdAt).toLocaleDateString()}</Text>
                                            </View>
                                            <Text style={[styles.timelineSubject, { color: theme.text }]}>{act.subject}</Text>
                                            {(act.description || act.details?.note) && <Text style={[styles.timelineNote, { color: theme.textLight }]}>{act.description || act.details.note}</Text>}
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 4. Owner */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Current Owners</Text>
                                <TouchableOpacity
                                    onPress={() => router.push(`/manage-owners?id=${id}`)}
                                    style={{ backgroundColor: theme.primary + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>+ ADD</Text>
                                </TouchableOpacity>
                            </View>
                            {(!inv.owners || inv.owners.length === 0) ? (
                                <Text style={styles.emptyText}>No owners assigned.</Text>
                            ) : (
                                inv.owners.map((owner: any, idx: number) => (
                                    <TouchableOpacity key={idx} style={[styles.partyCard, { backgroundColor: theme.background }]} onPress={() => owner._id && router.push(`/contact-detail?id=${owner._id}`)}>
                                        <View style={styles.matchLeft}>
                                            <Text style={[styles.matchUnit, { color: theme.text }]}>{lv(owner)}</Text>
                                            <Text style={[styles.matchProject, { color: theme.textLight }]}>{owner.phones?.[0]?.number || "No Phone"}</Text>
                                        </View>
                                        <View style={[styles.relationBadge, { backgroundColor: '#10B981' + '10' }]}>
                                            <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '700' }}>OWNER</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>

                        {inv.associates?.length > 0 && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={styles.sectionHeader}>
                                    <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Associates</Text>
                                    <TouchableOpacity
                                        onPress={() => router.push(`/manage-owners?id=${id}`)}
                                        style={{ backgroundColor: theme.primary + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>+ MANAGE</Text>
                                    </TouchableOpacity>
                                </View>
                                {inv.associates.map((assoc: any, idx: number) => (
                                    <TouchableOpacity key={idx} style={[styles.partyCard, { backgroundColor: theme.background }]} onPress={() => assoc._id && router.push(`/contact-detail?id=${assoc._id}`)}>
                                        <View style={styles.matchLeft}>
                                            <Text style={[styles.matchUnit, { color: theme.text }]}>{lv(assoc)}</Text>
                                            <Text style={[styles.matchProject, { color: theme.textLight }]}>{assoc.phones?.[0]?.number || "No Phone"}</Text>
                                        </View>
                                        <View style={[styles.relationBadge, { backgroundColor: theme.primary + '10' }]}>
                                            <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '700' }}>ASSOCIATE</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* 5. Document */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Inventory Documents</Text>
                                <TouchableOpacity onPress={() => router.push(`/add-document?id=${id}&type=Inventory`)}>
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Add</Text>
                                </TouchableOpacity>
                            </View>
                            {(!inv.inventoryDocuments || inv.inventoryDocuments.length === 0) ? (
                                <Text style={styles.emptyText}>No documents recorded.</Text>
                            ) : (
                                inv.inventoryDocuments.map((doc: any, i: number) => (
                                    <View key={i} style={[styles.docItem, { borderBottomColor: theme.border }]}>
                                        <View style={[styles.docIcon, { backgroundColor: theme.primary + '10' }]}>
                                            <Ionicons name="document-text" size={20} color={theme.primary} />
                                        </View>
                                        <View style={styles.docInfo}>
                                            <Text style={[styles.docName, { color: theme.text }]}>
                                                {doc.documentType || doc.documentName || "Document"}
                                            </Text>
                                            {(() => {
                                                const linkedId = doc.linkedContactId;
                                                const contact = [...(inv.owners || []), ...(inv.associates || [])].find(c => (c._id || c) === linkedId);
                                                const contactName = typeof contact === 'object' ? contact.name : null;

                                                return (
                                                    <Text style={[styles.docMeta, { color: theme.textLight }]}>
                                                        {doc.documentNo ? `No: ${doc.documentNo}` : ""}
                                                        {contactName ? ` • Linked: ${contactName}` : (doc.linkedContactMobile ? ` • Ref: ${doc.linkedContactMobile}` : "")}
                                                    </Text>
                                                );
                                            })()}
                                        </View>
                                        {doc.file && (
                                            <TouchableOpacity onPress={() => Linking.openURL(doc.file)}>
                                                <Ionicons name="eye-outline" size={20} color={theme.primary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 6. History */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Ownership History</Text>
                            <Text style={styles.emptyText}>History tracking is currently active. Changes to owners and associates will appear here.</Text>
                        </View>
                    </ScrollView>
                </View>
            </ScrollView>

            {/* Edit FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                onPress={() => router.push(`/add-inventory?id=${id}`)}
            >
                <Ionicons name="create" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, fontWeight: "600" },

    headerCard: { paddingBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 5, zIndex: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 15 },
    backBtnCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
    headerTitleContainer: { flex: 1 },
    headerNamePremium: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    headerBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    miniBadgeText: { fontSize: 10, fontWeight: '800' },

    statusContainer: { width: 70, alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    statusRing: { alignItems: 'center', justifyContent: 'center' },
    statusLabel: { fontSize: 8, fontWeight: '900', marginTop: 2 },
    smallHeaderShare: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' },

    strategyBar: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12, marginHorizontal: 20 },
    strategyBlock: { flex: 1, paddingHorizontal: 5 },
    strategyLabel: { fontSize: 8, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
    strategyValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    strategyValue: { fontSize: 12, fontWeight: '700' },
    strategyDivider: { width: 1, height: '70%', alignSelf: 'center', opacity: 0.5 },

    marketingRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 10, flexWrap: 'wrap' },
    marketingPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    marketingText: { fontSize: 11, fontWeight: '800' },

    modernActionHub: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 15 },
    modernHubBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowOpacity: 0.3, shadowRadius: 10 },

    tabsScroll: { paddingHorizontal: 20, gap: 25 },
    tabItem: { paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabLabel: { fontSize: 14, fontWeight: '800' },

    tabContent: { width: SCREEN_WIDTH },
    innerScroll: { padding: 20, paddingBottom: 100 },
    card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 13, fontWeight: '600' },
    infoValue: { fontSize: 14, fontWeight: '700' },
    emptyText: { textAlign: 'center', padding: 20, fontSize: 13, opacity: 0.5, lineHeight: 18 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    chipText: { fontSize: 11, fontWeight: '600' },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    timelineItem: { borderLeftWidth: 2, marginLeft: 10, paddingLeft: 20, paddingBottom: 25 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', left: -7, top: 0 },
    timelineBody: { marginTop: -4 },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    timelineType: { fontSize: 10, fontWeight: '800' },
    timelineDate: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
    timelineSubject: { fontSize: 14, fontWeight: '700', marginBottom: 4 },

    partyCard: { padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    matchLeft: { flex: 1 },
    matchUnit: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
    matchProject: { fontSize: 12, fontWeight: '600' },
    relationBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

    docItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    docInfo: { flex: 1 },
    docName: { fontSize: 14, fontWeight: '700' },
    docMeta: { fontSize: 11, marginTop: 2 },

    googleMapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, marginTop: 10 },
    googleMapsBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    timelineNote: { fontSize: 12, lineHeight: 18 },
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
});
