import { useCallback, useEffect, useState, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Linking, Alert, SafeAreaView, Dimensions,
    Animated, FlatList
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getLeadById, leadName, getMatchingInventory, type Lead } from "./services/leads.service";
import { getActivities } from "./services/activities.service";
import { getInventoryByContact } from "./services/inventory.service";
import { getMatchingDeals } from "./services/deals.service";
import { useCallTracking } from "./context/CallTrackingContext";
import { useTheme } from "./context/ThemeContext";
import { useLookup } from "./context/LookupContext";


const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS = ["Requirement", "Details", "Activities", "Match", "Inventory"];

function lv(field: unknown): string {
    if (!field) return "";
    if (Array.isArray(field)) {
        return field.map(item => lv(item)).filter(Boolean).join(", ");
    }
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value || "";
        if ("fullName" in field) return (field as any).fullName || "";
        if ("name" in field) return (field as any).name || "";
    }
    const val = String(field).trim();
    if (val === "—" || val === "undefined" || val === "null" || val === "None") return "";
    return val;
}

function getLeadScore(lead: any) {
    if (lead.intent_index !== undefined && lead.intent_index !== null) {
        const scoreVal = lead.intent_index || 0;
        let color = "#64748B";
        if (scoreVal >= 81) color = "#7C3AED";
        else if (scoreVal >= 61) color = "#EF4444";
        else if (scoreVal >= 31) color = "#F59E0B";
        return { val: scoreVal, color };
    }
    return { val: 50, color: "#F59E0B" };
}

function InfoRow({ label, value, accent, icon }: { label: string; value: string; accent?: boolean; icon?: any }) {
    const { theme } = useTheme();
    if (!value || value === "—" || value === "") return null;
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

export default function LeadDetailScreen() {
    const { trackCall } = useCallTracking();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { getLookupValue } = useLookup();


    const [lead, setLead] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [matchingDeals, setMatchingDeals] = useState<any[]>([]);
    const [ownedInventory, setOwnedInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    const scrollX = useRef(new Animated.Value(0)).current;
    const tabScrollViewRef = useRef<ScrollView>(null);
    const contentScrollViewRef = useRef<ScrollView>(null);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const leadRes = await getLeadById(id as string);
            const currentLead = leadRes?.data ?? leadRes;
            setLead(currentLead);

            const [actRes, matchRes] = await Promise.all([
                getActivities({ entityId: id, limit: 20 }),
                getMatchingDeals(id as string)
            ]);

            setActivities(Array.isArray(actRes?.data) ? actRes.data : (Array.isArray(actRes) ? actRes : []));
            setMatchingDeals(Array.isArray(matchRes?.data) ? matchRes.data : (Array.isArray(matchRes) ? matchRes : []));

            if (currentLead.contactDetails?._id) {
                const ownedRes = await getInventoryByContact(currentLead.contactDetails._id);
                setOwnedInventory(Array.isArray(ownedRes?.data) ? ownedRes.data : (Array.isArray(ownedRes) ? ownedRes : []));
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

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

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!lead) return <View style={styles.center}><Text style={styles.noData}>Lead not found</Text></View>;

    const score = getLeadScore(lead);
    const name = leadName(lead);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Premium SaaS Header */}
            <SafeAreaView style={[styles.headerCard, { backgroundColor: theme.card }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCircle}>
                        <Ionicons name="chevron-back" size={22} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerNamePremium, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                        <View style={styles.headerBadgeRow}>
                            <View style={[styles.miniBadge, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.miniBadgeText, { color: theme.primary }]}>{lead.mobile}</Text>
                            </View>
                            {lead.email && (
                                <View style={[styles.miniBadge, { backgroundColor: theme.border + '40' }]}>
                                    <Text style={[styles.miniBadgeText, { color: theme.textLight }]}>{lead.email}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.scoreContainer}>
                        <View style={[styles.scoreRing, { borderColor: score.color + '40' }]}>
                            <Text style={[styles.scoreValue, { color: score.color }]}>{score.val}</Text>
                            <Text style={[styles.scoreLabel, { color: theme.textLight }]}>INTENT</Text>
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
                                {lv(lead.assignment?.assignedTo) || lv(lead.owner) || "Unassigned"}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.strategyDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.strategyBlock}>
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>TEAM</Text>
                        <View style={styles.strategyValueRow}>
                            <Ionicons name="people-outline" size={14} color="#6366F1" />
                            <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                {lv(lead.assignment?.team) || "General"}
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
                                {lv(lead.source) || lv(lead.contactDetails?.source) || "Direct"}
                            </Text>
                            {(lv(lead.subSource) || lv(lead.contactDetails?.subSource)) && (
                                <Text style={[styles.marketingSubText, { color: theme.primary + '80' }]}>
                                    {` • ${lv(lead.subSource) || lv(lead.contactDetails?.subSource)}`}
                                </Text>
                            )}
                        </View>
                    </View>

                    {(lv(lead.campaign) || lv(lead.contactDetails?.campaign)) && (
                        <View style={[styles.marketingPill, { backgroundColor: '#7C3AED' + '10' }]}>
                            <Ionicons name="flag" size={12} color="#7C3AED" />
                            <Text style={[styles.marketingText, { color: '#7C3AED' }]}>
                                {lv(lead.campaign) || lv(lead.contactDetails?.campaign)}
                            </Text>
                        </View>
                    )}
                </View>




                {/* Professional Action Hub */}
                <View style={styles.modernActionHub}>
                    {[
                        { icon: 'call', color: theme.primary, onPress: () => trackCall(lead.mobile, id!, "Lead", name) },
                        { icon: 'chatbubble-ellipses', color: '#3B82F6', onPress: () => Linking.openURL(`sms:${lead.mobile.replace(/\D/g, "")}`) },
                        { icon: 'logo-whatsapp', color: '#128C7E', onPress: () => Linking.openURL(`https://wa.me/${lead.mobile.replace(/\D/g, "")}`) },
                        { icon: 'mail', color: '#EA4335', onPress: () => Linking.openURL(`mailto:${lead.email}`) },
                        { icon: 'calendar', color: '#6366F1', onPress: () => router.push(`/add-activity?id=${id}&type=Lead`) },
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
                {/* 1. Requirement */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Core Requirements</Text>
                            <InfoRow label="Main Need" value={getLookupValue("Requirement", lead.requirement)} icon="cart-outline" accent />
                            <InfoRow label="Sub Category" value={getLookupValue("Sub Requirement", lead.subRequirement)} icon="list-outline" />
                            <InfoRow label="Project" value={lv(lead.project)} icon="business-outline" />
                            <InfoRow label="Property Category" value={Array.isArray(lead.propertyType) ? lead.propertyType.map((t: any) => getLookupValue("Property Type", t) !== "—" ? getLookupValue("Property Type", t) : lv(t)).join(", ") : getLookupValue("Property Type", lead.propertyType)} icon="grid-outline" />
                            <InfoRow label="Sub Types" value={Array.isArray(lead.subType) ? lead.subType.map((t: any) => getLookupValue("SubCategory", t) !== "—" ? getLookupValue("SubCategory", t) : lv(t)).join(", ") : getLookupValue("SubCategory", lead.subType)} icon="layers-outline" />
                            <InfoRow label="Budget" value={getLookupValue("Budget", lead.budget)} icon="wallet-outline" accent />
                            <InfoRow label="Min - Max" value={(lead.budgetMin || lead.budgetMax) ? `₹${lead.budgetMin || 0} - ₹${lead.budgetMax || 0}` : ""} icon="cash-outline" />
                            <InfoRow label="Location Pref" value={getLookupValue("Project Location", lead.location)} icon="map-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Specifications</Text>
                            <InfoRow label="Unit Type" value={Array.isArray(lead.unitType) ? lead.unitType.map((t: any) => getLookupValue("Unit Type", t) !== "—" ? getLookupValue("Unit Type", t) : lv(t)).join(", ") : getLookupValue("Unit Type", lead.unitType)} icon="cube-outline" />
                            <InfoRow label="Facing" value={Array.isArray(lead.facing) ? lead.facing.map((t: any) => getLookupValue("Facing", t) !== "—" ? getLookupValue("Facing", t) : lv(t)).join(", ") : getLookupValue("Facing", lead.facing)} icon="compass-outline" />
                            <InfoRow label="Direction" value={Array.isArray(lead.direction) ? lead.direction.map((t: any) => getLookupValue("Direction", t) !== "—" ? getLookupValue("Direction", t) : lv(t)).join(", ") : getLookupValue("Direction", lead.direction)} icon="navigate-outline" />
                            <InfoRow label="Road Width" value={Array.isArray(lead.roadWidth) ? lead.roadWidth.map((t: any) => getLookupValue("RoadWidth", t) !== "—" ? getLookupValue("RoadWidth", t) : lv(t)).join(", ") : getLookupValue("RoadWidth", lead.roadWidth)} icon="swap-horizontal-outline" />

                            <InfoRow label="Area Range" value={(lead.areaMin || lead.areaMax) ? `${lead.areaMin || 0} - ${lead.areaMax || 0} ${lead.areaMetric || ''}` : ""} icon="resize-outline" />
                            <InfoRow label="Purpose" value={lead.purpose} icon="bulb-outline" />
                            <InfoRow label="Timeline" value={lead.timeline} icon="time-outline" />
                            <InfoRow label="Furnishing" value={lead.furnishing} icon="bed-outline" />
                            <InfoRow label="Funding" value={lead.funding} icon="analytics-outline" />
                        </View>
                    </ScrollView>
                </View>

                {/* 2. Details */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Lead Information</Text>
                            <InfoRow label="First Name" value={lead.firstName} icon="person-outline" />
                            <InfoRow label="Last Name" value={lead.lastName} icon="person-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Personal & Address</Text>
                            <InfoRow label="Title" value={getLookupValue("Title", lead.contactDetails?.title)} icon="person-circle-outline" />
                            <InfoRow label="Father's Name" value={lead.contactDetails?.fatherName} icon="people-outline" />
                            <InfoRow label="Gender" value={lead.contactDetails?.gender} icon="transgender-outline" />
                            <InfoRow label="Date of Birth" value={lead.contactDetails?.birthDate ? new Date(lead.contactDetails.birthDate).toLocaleDateString() : ""} icon="calendar-outline" />

                            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Ionicons name="location-outline" size={14} color={theme.textLight} />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textLight }}>Complete Address</Text>
                                </View>
                                <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
                                    {[
                                        lead.contactDetails?.personalAddress?.hNo || "",
                                        lead.contactDetails?.personalAddress?.street || "",
                                        lead.contactDetails?.personalAddress?.area || "",
                                        lv(lead.contactDetails?.personalAddress?.location) || "",
                                        lv(lead.contactDetails?.personalAddress?.city) || "",
                                        lv(lead.contactDetails?.personalAddress?.state) || "",
                                        lead.contactDetails?.personalAddress?.pinCode || ""
                                    ].filter(Boolean).join(", ") || "No address provided"}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 12 }]}>Professional Profile</Text>
                            {(lv(lead.contactDetails?.designation) || lead.contactDetails?.company) ? (
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.primary }}>
                                        {getLookupValue("ProfessionalDesignation", lead.contactDetails?.designation) !== "—" ? getLookupValue("ProfessionalDesignation", lead.contactDetails?.designation) : "Professionals"}
                                    </Text>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                        <Ionicons name="business-outline" size={14} color={theme.textLight} />
                                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                                            {lead.contactDetails?.company || "Organization"}
                                        </Text>
                                    </View>
                                </View>
                            ) : null}

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                {getLookupValue("ProfessionalCategory", lead.contactDetails?.professionCategory) !== "—" && (
                                    <View style={{ backgroundColor: theme.border + '30', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textLight }}>{getLookupValue("ProfessionalCategory", lead.contactDetails?.professionCategory).toUpperCase()}</Text>
                                    </View>
                                )}
                                {getLookupValue("ProfessionalSubCategory", lead.contactDetails?.professionSubCategory) !== "—" && (
                                    <View style={{ backgroundColor: theme.primary + '10', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>{getLookupValue("ProfessionalSubCategory", lead.contactDetails?.professionSubCategory)}</Text>
                                    </View>
                                )}
                            </View>


                            <View style={{ marginTop: 12 }}>
                                <InfoRow label="Work Office" value={lead.contactDetails?.workOffice} icon="location-outline" />
                            </View>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Bio & Personal Status</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                                <InfoRow label="Gender" value={lead.contactDetails?.gender} icon="transgender-outline" />
                                <InfoRow label="Marital Status" value={lead.contactDetails?.maritalStatus} icon="heart-outline" />
                            </View>
                            <View style={{ borderTopWidth: 1, borderTopColor: theme.border + '50', paddingTop: 8 }}>
                                <InfoRow label="Date of Birth" value={lead.contactDetails?.birthDate ? new Date(lead.contactDetails.birthDate).toLocaleDateString() : ""} icon="calendar-outline" />
                                <InfoRow label="Anniversary" value={lead.contactDetails?.anniversaryDate ? new Date(lead.contactDetails.anniversaryDate).toLocaleDateString() : ""} icon="heart-circle-outline" />
                            </View>
                            {lead.contactDetails?.description ? (
                                <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: theme.border + '20', borderLeftWidth: 3, borderLeftColor: theme.primary }}>
                                    <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20, fontStyle: 'italic' }}>{lead.contactDetails.description}</Text>
                                </View>
                            ) : null}
                        </View>

                        {lead.contactDetails?.educations?.length > 0 && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Education</Text>
                                {lead.contactDetails.educations.map((ed: any, i: number) => (
                                    <View key={i} style={{ marginBottom: i < lead.contactDetails.educations.length - 1 ? 12 : 0 }}>
                                        <InfoRow label="Education" value={lv(ed.education)} icon="school-outline" />
                                        <InfoRow label="Degree" value={lv(ed.degree)} icon="ribbon-outline" />
                                        <InfoRow label="School" value={ed.school} icon="location-outline" />
                                    </View>
                                ))}
                            </View>
                        )}

                        {(lead.contactDetails?.loans?.length > 0 || lead.contactDetails?.incomes?.length > 0) && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Financial Details</Text>
                                {lead.contactDetails.loans?.map((ln: any, i: number) => (
                                    <InfoRow key={`loan-${i}`} label={`${lv(ln.loanType)} Loan`} value={`₹${ln.loanAmount} (${lv(ln.bank)})`} icon="cash-outline" />
                                ))}
                                {lead.contactDetails.incomes?.map((inc: any, i: number) => (
                                    <InfoRow key={`inc-${i}`} label={lv(inc.incomeType)} value={`₹${inc.amount}`} icon="wallet-outline" />
                                ))}
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
                                <TouchableOpacity onPress={() => router.push(`/add-activity?id=${id}&type=Lead`)}>
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Add</Text>
                                </TouchableOpacity>
                            </View>
                            {Array.isArray(activities) && activities.length === 0 ? (
                                <Text style={styles.emptyText}>No activities recorded yet.</Text>
                            ) : (
                                Array.isArray(activities) && activities.map((act, i) => (
                                    <View key={i} style={[styles.timelineItem, { borderLeftColor: theme.border }]}>
                                        <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                                        <View style={styles.timelineBody}>
                                            <View style={styles.timelineHeader}>
                                                <Text style={[styles.timelineType, { color: theme.primary }]}>{act.type.toUpperCase()}</Text>
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

                {/* 4. Match */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Matching Deals</Text>
                                <View style={{ backgroundColor: theme.primary + '20', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                                    <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>{matchingDeals.length} Found</Text>
                                </View>
                            </View>
                            {Array.isArray(matchingDeals) && matchingDeals.length === 0 ? (
                                <Text style={styles.emptyText}>No matching deals found for this requirement.</Text>
                            ) : (
                                Array.isArray(matchingDeals) && matchingDeals.map((deal: any, i: number) => (
                                    <TouchableOpacity key={i} style={[styles.matchItem, { borderBottomColor: theme.border }]} onPress={() => router.push(`/deal-detail?id=${deal._id}`)}>
                                        <View style={styles.matchLeft}>
                                            <Text style={[styles.matchUnit, { color: theme.text }]}>Deal #{deal.dealId || deal._id.slice(-6).toUpperCase()}</Text>
                                            <Text style={[styles.matchProject, { color: theme.textLight }]}>{deal.projectName || (typeof deal.projectId === 'object' ? deal.projectId?.name : lv(deal.projectId))}</Text>
                                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                                <View style={[styles.relationBadge, { backgroundColor: theme.border + '40' }]}>
                                                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textLight }}>{lv(deal.category)}</Text>
                                                </View>
                                                <View style={[styles.relationBadge, { backgroundColor: theme.primary + '15' }]}>
                                                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.primary }}>{lv(deal.status)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.matchRight}>
                                            <Text style={[styles.matchPrice, { color: theme.primary }]}>₹{deal.price || 0}</Text>
                                            <Text style={[styles.matchStatus, { color: '#10B981' }]}>{deal.stage || 'Open'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 5. Inventory */}
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

            </ScrollView>

            {/* Edit FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                onPress={() => router.push(`/add-lead?id=${id}`)}
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

    fullAddressText: { fontSize: 12, fontStyle: 'italic', marginTop: 12, lineHeight: 18 },
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
    matchPrice: { fontSize: 13, fontWeight: '700' },
    matchStatus: { fontSize: 10, fontWeight: '800', marginTop: 2 },
    relationBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
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
