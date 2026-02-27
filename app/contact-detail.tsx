import { useCallback, useEffect, useState, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Linking, Alert, SafeAreaView, Animated, Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./context/ThemeContext";
import { useCallTracking } from "./context/CallTrackingContext";
import { getContactById } from "./services/contacts.service";
import { getActivities, getOrCreateCallActivity, getUnifiedTimeline } from "./services/activities.service";
import { getInventoryByContact } from "./services/inventory.service";
import { useLookup } from "./context/LookupContext";


const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS = ["Details", "Activities", "Inventory", "Documents"];

function lv(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value ?? "—";
        if ("fullName" in field) return (field as any).fullName ?? "—";
        if ("name" in field) return (field as any).name ?? "—";
    }
    return String(field) || "—";
}

function formatTimeAgo(dateString?: string) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSecs < 60) return "Just now";
    if (diffInSecs < 3600) return `${Math.floor(diffInSecs / 60)}m ago`;
    if (diffInSecs < 86400) return `${Math.floor(diffInSecs / 3600)}h ago`;
    return `${Math.floor(diffInSecs / 86400)}d ago`;
}

function getContactScore(contact: any, activities: any[]) {
    let score = 50;
    if (activities.length > 5) score += 20;
    if (contact.phones?.length > 1) score += 10;
    if (contact.emails?.length > 0) score += 10;

    score = Math.min(score, 100);
    const color = score > 80 ? "#10B981" : score > 50 ? "#F59E0B" : "#EF4444";
    return { val: score, color };
}

function getContactInsight(contact: any, activities: any[]) {
    if (activities.length === 0) return "First contact pending. Initiate a warm intro via WhatsApp.";
    const lastActivity = activities[0];
    const daysSince = Math.floor((Date.now() - new Date(lastActivity.dueDate).getTime()) / 86400000);
    if (daysSince > 30) return "Stale contact. Reach out to stay relevant.";
    if (contact.tags?.includes("Hot")) return "High value contact. Prioritize all interactions.";
    return "Consistently active contact. Maintain professional rapport.";
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

export default function ContactDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { trackCall } = useCallTracking();
    const { getLookupValue } = useLookup();
    const [contact, setContact] = useState<any>(null);

    const [activities, setActivities] = useState<any[]>([]);
    const [ownedInventory, setOwnedInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    const scrollX = useRef(new Animated.Value(0)).current;
    const tabScrollViewRef = useRef<ScrollView>(null);
    const contentScrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [contactRes, timelineRes] = await Promise.all([
                getContactById(id as string),
                getUnifiedTimeline("contact", id as string)
            ]);

            const currentContact = contactRes?.data ?? contactRes;
            setContact(currentContact);
            setActivities(Array.isArray(timelineRes?.data) ? timelineRes.data : (Array.isArray(timelineRes) ? timelineRes : []));

            const ownedRes = await getInventoryByContact(id);
            setOwnedInventory(Array.isArray(ownedRes?.data) ? ownedRes.data : (Array.isArray(ownedRes) ? ownedRes : []));

            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (error) {
            console.error(error);
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
    if (!contact) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={[styles.noData, { color: theme.textLight }]}>Contact not found</Text></View>;

    const firstName = contact.name ?? "";
    const lastName = contact.surname ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
    const initials = (firstName[0] ?? "") + (lastName[0] ?? firstName[1] ?? "");
    const phone = contact.phones?.[0]?.number ?? "";
    const email = contact.emails?.[0]?.address ?? "";
    const score = getContactScore(contact, activities);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Premium SaaS Header */}
            <SafeAreaView style={[styles.headerCard, { backgroundColor: theme.card }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCircle}>
                        <Ionicons name="chevron-back" size={22} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerNamePremium, { color: theme.text }]} numberOfLines={1}>{fullName}</Text>
                        <View style={styles.headerBadgeRow}>
                            <View style={[styles.miniBadge, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.miniBadgeText, { color: theme.primary }]}>{phone}</Text>
                            </View>
                            {email && (
                                <View style={[styles.miniBadge, { backgroundColor: theme.border + '40' }]}>
                                    <Text style={[styles.miniBadgeText, { color: theme.textLight }]}>{email}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.scoreContainer}>
                        <View style={[styles.scoreRing, { borderColor: score.color + '40' }]}>
                            <Text style={[styles.scoreValue, { color: score.color }]}>{score.val}</Text>
                            <Text style={[styles.scoreLabel, { color: theme.textLight }]}>INSIGHT</Text>
                        </View>
                    </View>
                </View>

                {/* Information Strategy Bar */}
                <View style={[styles.strategyBar, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
                    <View style={styles.strategyBlock}>
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>RELATION</Text>
                        <View style={styles.strategyValueRow}>
                            <Ionicons name="people-circle" size={14} color={theme.primary} />
                            <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                {lv(contact.status) || "Lead"}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.strategyDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.strategyBlock}>
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>TEAM</Text>
                        <View style={styles.strategyValueRow}>
                            <Ionicons name="people-outline" size={14} color="#6366F1" />
                            <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                {lv(contact.team)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Marketing & Acquisition Row */}
                <View style={styles.marketingRow}>
                    <View style={[styles.marketingPill, { backgroundColor: theme.primary + '10' }]}>
                        <Ionicons name="megaphone" size={12} color={theme.primary} />
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                            <Text style={[styles.marketingText, { color: theme.primary }]}>
                                {getLookupValue("Source", contact.source) || "Direct"}
                            </Text>
                            {(lv(contact.subSource) || lv(contact.contactDetails?.subSource)) && (
                                <Text style={[styles.marketingSubText, { color: theme.primary + '80' }]}>
                                    {` • ${lv(contact.subSource) || lv(contact.contactDetails?.subSource)}`}
                                </Text>
                            )}
                        </View>
                    </View>

                    {contact.tags && contact.tags.length > 0 && (
                        <View style={[styles.marketingPill, { backgroundColor: '#7C3AED' + '10' }]}>
                            <Ionicons name="pricetag" size={12} color="#7C3AED" />
                            <Text style={[styles.marketingText, { color: '#7C3AED' }]}>
                                {contact.tags[0]}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Professional Action Hub */}
                <View style={styles.modernActionHub}>
                    {[
                        { icon: 'call', color: theme.primary, onPress: () => trackCall(phone, id!, "Contact", fullName) },
                        { icon: 'chatbubble-ellipses', color: '#3B82F6', onPress: () => Linking.openURL(`sms:${phone.replace(/\D/g, "")}`) },
                        { icon: 'logo-whatsapp', color: '#128C7E', onPress: () => Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`) },
                        { icon: 'mail', color: '#EA4335', onPress: () => Linking.openURL(`mailto:${email}`) },
                        { icon: 'calendar', color: '#6366F1', onPress: () => router.push(`/add-activity?id=${id}&type=Contact`) },
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
                            <Text style={[styles.insightText, { color: theme.text }]}>{getContactInsight(contact, activities)}</Text>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Communication Details</Text>
                            {contact.phones?.map((p: any, i: number) => (
                                <InfoRow key={`p-${i}`} label={i === 0 ? "Primary Mobile" : `Phone ${i + 1}`} value={p.number} icon="call-outline" accent />
                            ))}
                            {contact.emails?.map((e: any, i: number) => (
                                <InfoRow key={`e-${i}`} label={i === 0 ? "Primary Email" : `Email ${i + 1}`} value={e.address} icon="mail-outline" />
                            ))}
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Professional Details</Text>
                            <InfoRow label="Company" value={contact.company} icon="business-outline" />
                            <InfoRow label="Work Office" value={contact.workOffice} icon="location-outline" />
                            <InfoRow label="Profession" value={getLookupValue("ProfessionalCategory", contact.professionCategory)} icon="briefcase-outline" />
                            <InfoRow label="Specialization" value={getLookupValue("ProfessionalSubCategory", contact.professionSubCategory)} icon="ribbon-outline" />
                            <InfoRow label="Designation" value={getLookupValue("ProfessionalDesignation", contact.designation)} icon="medal-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Personal & Management</Text>
                            <InfoRow label="Gender" value={contact.gender} icon="person-outline" />
                            <InfoRow label="Owner" value={getLookupValue("Owner", contact.owner)} icon="shield-checkmark-outline" />
                            <InfoRow label="Assigned To" value={lv(contact.assignment?.assignedTo) || lv(contact.assignedTo)} icon="person-circle-outline" />
                            <InfoRow label="Created On" value={new Date(contact.createdAt).toLocaleDateString()} icon="calendar-outline" />
                            {contact.tags && contact.tags.length > 0 && (
                                <View style={styles.tagRow}>
                                    {contact.tags.map((tag: any, i: number) => (
                                        <View key={i} style={[styles.tag, { backgroundColor: theme.primary + '15' }]}>
                                            <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 2. Activities */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Activity History</Text>
                                <TouchableOpacity onPress={() => router.push(`/add-activity?id=${id}&type=Contact`)}>
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Add</Text>
                                </TouchableOpacity>
                            </View>
                            {Array.isArray(activities) && activities.length === 0 ? (
                                <Text style={styles.emptyText}>No activities recorded yet.</Text>
                            ) : (
                                Array.isArray(activities) && activities.map((act, i) => {
                                    const isAudit = act.source === "audit";
                                    let icon: any = "time-outline";
                                    let color = theme.primary;

                                    if (isAudit) {
                                        icon = "history-outline";
                                        color = "#8B5CF6";
                                    } else if (act.type.toLowerCase().includes("call")) {
                                        icon = "call-outline";
                                        color = "#3B82F6";
                                    } else if (act.type.toLowerCase().includes("task")) {
                                        icon = "checkbox-outline";
                                        color = "#F59E0B";
                                    } else if (act.type.toLowerCase().includes("email")) {
                                        icon = "mail-outline";
                                        color = "#EF4444";
                                    }

                                    return (
                                        <View key={i} style={[styles.timelineItem, { borderLeftColor: theme.border }]}>
                                            <View style={[styles.timelineDot, { backgroundColor: color }]}>
                                                <Ionicons name={icon} size={8} color="#fff" />
                                            </View>
                                            <View style={[styles.timelineBody, isAudit && { borderLeftWidth: 3, borderLeftColor: color }]}>
                                                <View style={styles.timelineHeader}>
                                                    <Text style={[styles.timelineType, { color: color }]}>
                                                        {isAudit ? "AUDIT LOG" : act.type.toUpperCase()}
                                                    </Text>
                                                    <Text style={styles.timelineDate}>{new Date(act.timestamp || act.createdAt).toLocaleDateString()}</Text>
                                                </View>
                                                <Text style={[styles.timelineSubject, { color: theme.text }]}>{act.title || act.subject}</Text>
                                                {(act.description || act.details?.note) && (
                                                    <Text style={[styles.timelineNote, { color: theme.textLight }]}>
                                                        {act.description || act.details?.note}
                                                    </Text>
                                                )}
                                                {act.actor && <Text style={{ fontSize: 9, color: theme.textLight, marginTop: 4 }}>By {act.actor}</Text>}
                                                {!isAudit && act.status !== 'Completed' && (
                                                    <TouchableOpacity
                                                        onPress={() => router.push({
                                                            pathname: '/outcome',
                                                            params: {
                                                                id: act._id,
                                                                entityId: id,
                                                                entityType: 'Contact',
                                                                entityName: fullName,
                                                                actType: act.type
                                                            }
                                                        })}
                                                        style={{
                                                            marginTop: 10,
                                                            paddingVertical: 6,
                                                            paddingHorizontal: 12,
                                                            backgroundColor: color + '15',
                                                            borderRadius: 8,
                                                            alignSelf: 'flex-start',
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            borderWidth: 1,
                                                            borderColor: color + '30'
                                                        }}
                                                    >
                                                        <Ionicons name="checkmark-circle" size={14} color={color} />
                                                        <Text style={{ color: color, fontSize: 11, fontWeight: '700' }}>Complete</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 3. Inventory */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Owned / Associated Units</Text>
                            {Array.isArray(ownedInventory) && ownedInventory.length === 0 ? (
                                <Text style={styles.emptyText}>No inventory linked to this contact.</Text>
                            ) : (
                                Array.isArray(ownedInventory) && ownedInventory.map((inv, i) => (
                                    <TouchableOpacity key={i} style={[styles.matchItem, { borderBottomColor: theme.border }]} onPress={() => router.push(`/inventory-detail?id=${inv._id}`)}>
                                        <View style={styles.matchLeft}>
                                            <Text style={[styles.matchUnit, { color: theme.text }]}>{inv.unitNumber || inv.unitNo}</Text>
                                            <Text style={[styles.matchProject, { color: theme.textLight }]}>{inv.projectName} • {inv.block}</Text>
                                        </View>
                                        <View style={styles.matchRight}>
                                            <View style={[styles.relationBadge, { backgroundColor: theme.primary + '10' }]}>
                                                <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '700' }}>OWNER</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 4. Documents */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Contact Documents</Text>
                                <TouchableOpacity onPress={() => router.push(`/add-document?id=${id}&type=Contact`)}>
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Add</Text>
                                </TouchableOpacity>
                            </View>
                            {(() => {
                                // Aggregate Contact Docs + Inventory Docs
                                const contactDocs = Array.isArray(contact.documents) ? contact.documents : [];
                                const invDocs = ownedInventory.reduce((acc: any[], inv: any) => {
                                    const docs = (Array.isArray(inv.inventoryDocuments) ? inv.inventoryDocuments : []).map((d: any) => ({
                                        ...d,
                                        projectName: inv.projectName,
                                        block: inv.block,
                                        unitNumber: inv.unitNumber || inv.unitNo,
                                        isInventoryDoc: true
                                    }));
                                    return [...acc, ...docs];
                                }, []);

                                const allDocs = [...contactDocs, ...invDocs];

                                if (allDocs.length === 0) {
                                    return <Text style={styles.emptyText}>No documents uploaded for this contact or their properties.</Text>;
                                }

                                return allDocs.map((doc: any, i: number) => (
                                    <View key={i} style={[styles.docItem, { borderBottomColor: theme.border }]}>
                                        <View style={[styles.docIcon, { backgroundColor: doc.isInventoryDoc ? theme.primary + '15' : theme.primary + '10' }]}>
                                            <Ionicons name={doc.isInventoryDoc ? "business" : "document-text"} size={20} color={theme.primary} />
                                        </View>
                                        <View style={styles.docInfo}>
                                            <Text style={[styles.docName, { color: theme.text }]}>
                                                {lv(doc.documentType) || lv(doc.documentName) || "Unnamed Document"}
                                            </Text>
                                            <Text style={[styles.docMeta, { color: theme.textLight }]}>
                                                {doc.documentNo ? `No: ${doc.documentNo}` : ""}
                                                {doc.documentCategory ? ` • ${lv(doc.documentCategory)}` : ""}
                                                {doc.isInventoryDoc && <Text style={{ color: theme.primary, fontWeight: '700' }}> • Property Doc</Text>}
                                            </Text>
                                            {(doc.projectName || doc.block || doc.unitNumber) && (
                                                <Text style={[styles.docProject, { color: theme.textLight }]}>
                                                    {doc.projectName}{doc.block ? ` • ${doc.block}` : ""}{doc.unitNumber ? ` • ${doc.unitNumber}` : ""}
                                                </Text>
                                            )}
                                        </View>
                                        {(doc.documentPicture || doc.fileUrl || doc.file) && (
                                            <TouchableOpacity onPress={() => Linking.openURL(doc.documentPicture || doc.fileUrl || doc.file)}>
                                                <Ionicons name="eye-outline" size={20} color={theme.primary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ));
                            })()}
                        </View>
                    </ScrollView>
                </View>
            </ScrollView>

            {/* Edit FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                onPress={() => router.push(`/add-contact?id=${id}`)}
            >
                <Ionicons name="create" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, color: "#94A3B8" },

    headerCard: { borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 12, shadowOpacity: 0.1, shadowRadius: 15, paddingBottom: 8 },
    headerTop: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 15 },
    backBtnCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { flex: 1 },
    headerNamePremium: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    headerBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    miniBadgeText: { fontSize: 10, fontWeight: '700' },

    scoreContainer: { alignItems: 'center', justifyContent: 'center' },
    scoreRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    scoreValue: { fontSize: 18, fontWeight: '900' },
    scoreLabel: { fontSize: 7, fontWeight: '900', marginTop: -2 },

    strategyBar: { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, marginTop: 5 },
    strategyBlock: { flex: 1 },
    strategyLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
    strategyValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    strategyValue: { fontSize: 13, fontWeight: '800' },
    strategyDivider: { width: 1, height: '100%', marginHorizontal: 15 },

    marketingRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 10, flexWrap: 'wrap' },
    marketingPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    marketingText: { fontSize: 11, fontWeight: '800' },
    marketingSubText: { fontSize: 9, fontWeight: '600', marginLeft: 4 },

    modernActionHub: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 15 },
    modernHubBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowOpacity: 0.3, shadowRadius: 10 },

    tabsScroll: { paddingHorizontal: 16 },
    tabItem: { paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabLabel: { fontSize: 13, fontWeight: '700' },

    tabContent: { width: SCREEN_WIDTH, flex: 1 },
    innerScroll: { padding: 20 },
    card: { borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1 },
    cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },

    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 13, fontWeight: "600" },
    infoValue: { fontSize: 13, fontWeight: "700" },

    insightCard: { padding: 16, borderRadius: 18, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    insightIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    insightText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },

    emptyText: { textAlign: 'center', color: '#94A3B8', padding: 20, fontSize: 13 },

    timelineItem: { paddingLeft: 20, borderLeftWidth: 2, paddingBottom: 20 },
    timelineDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', left: -6, top: 4 },
    timelineBody: { backgroundColor: 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 12 },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    timelineType: { fontSize: 10, fontWeight: '900' },
    timelineDate: { fontSize: 10, color: '#94A3B8' },
    timelineSubject: { fontSize: 13, fontWeight: '700' },
    timelineNote: { fontSize: 11, marginTop: 4 },

    matchItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    matchLeft: { flex: 1 },
    matchUnit: { fontSize: 14, fontWeight: '800' },
    matchProject: { fontSize: 11 },
    matchRight: { alignItems: 'flex-end' },
    relationBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    tagText: { fontSize: 12, fontWeight: "700" },

    docItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    docInfo: { flex: 1 },
    docName: { fontSize: 14, fontWeight: '700' },
    docMeta: { fontSize: 11, marginTop: 2 },
    docProject: { fontSize: 10, marginTop: 2, opacity: 0.8 },
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
