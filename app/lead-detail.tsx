import { useCallback, useEffect, useState, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Linking, Alert, SafeAreaView, Dimensions,
    Animated
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getLeadById, leadName, updateLead, type Lead } from "./services/leads.service";
import { getActivities } from "./services/activities.service";
import { useCallTracking } from "./context/CallTrackingContext";
import { useTheme } from "./context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const STAGE_ORDER = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won"];

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

function getLeadScore(lead: any) {
    // Simple heuristic for Lead Score 3.0
    let score = 50;
    const stage = lv(lead.status).toLowerCase();
    if (stage === "qualified" || stage === "proposal") score += 20;
    if (stage === "negotiation" || stage === "won") score += 30;
    if (lead.mobile && lead.email) score += 10;
    if (lead.lastContactedAt) {
        const days = (new Date().getTime() - new Date(lead.lastContactedAt).getTime()) / (1000 * 3600 * 24);
        if (days < 2) score += 10;
    }

    score = Math.min(score, 100);
    const color = score > 80 ? "#10B981" : score > 50 ? "#F59E0B" : "#EF4444";
    return { val: score, color };
}

function getSmartInsight(lead: any, activities: any[]) {
    const stage = lv(lead.status).toLowerCase();
    if (stage === "negotiation") return "Closing opportunity: Prepare finalized quotation and check payment terms.";
    if (stage === "proposal") return "Proposal sent: Follow up to address any technical or pricing concerns.";

    const lastAct = activities[0];
    if (lastAct && lastAct.type === "Call") {
        const days = (new Date().getTime() - new Date(lastAct.createdAt).getTime()) / (1000 * 3600 * 24);
        if (days > 3) return "Lead not contacted in 3 days. Re-engagement recommended.";
    }

    if (lead.budget && lead.propertyType) return `Lead matches premium ${lv(lead.propertyType)} assets in ${lv(lead.location) || 'current region'}.`;

    return "High conversion probability based on profile density and engagement.";
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

function RequirementTile({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
    const { theme } = useTheme();
    return (
        <View style={[styles.reqTile, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.reqTileIcon, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={14} color={color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.reqTileLabel, { color: theme.textLight }]}>{label}</Text>
                <Text style={[styles.reqTileValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
            </View>
        </View>
    );
}


const STAGE_COLORS: Record<string, string> = {
    active: "#10B981", new: "#3B82F6", contacted: "#8B5CF6",
    qualified: "#10B981", proposal: "#F59E0B", negotiation: "#EF4444",
    won: "#059669", lost: "#6B7280",
};

function LeadProgression({ currentStage }: { currentStage: string }) {
    const currentIndex = STAGE_ORDER.findIndex(s => s.toLowerCase() === currentStage.toLowerCase());
    const progress = Math.max(0, (currentIndex + 1) / STAGE_ORDER.length);

    return (
        <View style={styles.progressionContainer}>
            <View style={styles.progressionTrack}>
                <View style={[styles.progressionFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.progressionSteps}>
                {STAGE_ORDER.map((stage, i) => {
                    const isActive = i <= currentIndex;
                    const isCurrent = i === currentIndex;
                    return (
                        <View key={stage} style={styles.stepWrapper}>
                            <View style={[styles.stepDot, isActive && styles.stepDotActive, isCurrent && styles.stepDotCurrent]} />
                            <Text style={[styles.stepText, isActive && styles.stepTextActive]} numberOfLines={1}>{stage}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

function ActivityTimelineItem({ act, isLast }: { act: any; isLast: boolean }) {
    const typeColor = act.type === "Call" ? "#3B82F6" : act.type === "Note" ? "#F59E0B" : "#DB2777";
    const date = new Date(act.dueDate || act.createdAt);
    const timeLabel = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    return (
        <View style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: typeColor }]} />
                {!isLast && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineRight}>
                <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                        <Text style={[styles.timelineType, { color: typeColor }]}>{act.type.toUpperCase()}</Text>
                        <Text style={styles.timelineDate}>{timeLabel}</Text>
                    </View>
                    <Text style={styles.timelineSubject}>{act.subject}</Text>
                    {act.details?.completionResult && (
                        <View style={styles.resultPill}>
                            <Ionicons name="checkmark-circle" size={12} color="#059669" />
                            <Text style={styles.resultPillText}>{act.details.completionResult}</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

export default function LeadDetailScreen() {
    const { trackCall } = useCallTracking();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const [lead, setLead] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRecordInfo, setShowRecordInfo] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scrollY = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [leadRes, actRes] = await Promise.all([
                getLeadById(id as string),
                getActivities({ entityId: id, limit: 10 })
            ]);
            setLead(leadRes?.data ?? leadRes);
            setActivities(actRes?.data ?? actRes);
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (error) {
            Alert.alert("Error", "Could not refresh data");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>;
    if (!lead) return <View style={styles.center}><Text style={styles.noData}>Lead not found</Text></View>;

    const name = leadName(lead);
    const statusLabel = lv(lead.status);
    const color = STAGE_COLORS[statusLabel.toLowerCase()] ?? "#6366F1";
    const phone = lead.mobile ?? "";
    const email = lead.email ?? "";

    const score = getLeadScore(lead);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* 1. Header Navigation */}
            <SafeAreaView style={{ backgroundColor: theme.card, zIndex: 10 }}>
                <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.navBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: theme.text }]}>Lead Command</Text>
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.background }]} onPress={() => Alert.alert("Options", "Coming soon")}>
                        <Ionicons name="ellipsis-horizontal" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
            >
                <Animated.View style={{ opacity: fadeAnim }}>
                    {/* 2. Hero Section */}
                    <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
                        <View style={styles.heroTopRow}>
                            <View style={[styles.avatarBox, { backgroundColor: theme.primary + '15' }]}>
                                <Text style={[styles.avatarText, { color: theme.primary }]}>{name.charAt(0)}</Text>
                            </View>
                            <View style={styles.nameSection}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={[styles.heroName, { color: theme.text }]}>{name}</Text>
                                    <View style={[
                                        styles.scoreBadge,
                                        { backgroundColor: score.color + '20' },
                                        score.val > 80 && { shadowColor: score.color, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 }
                                    ]}>
                                        <Text style={[styles.scoreText, { color: score.color }]}>{score.val}</Text>
                                    </View>
                                </View>
                                <View style={[styles.statusCapsule, { backgroundColor: color + '15' }]}>
                                    <Text style={[styles.statusCapsuleText, { color }]}>{statusLabel.toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.heroSecondary, { backgroundColor: theme.background }]}>
                            <View style={styles.chipRow}>
                                <View style={[styles.chip, { backgroundColor: theme.card }]}>
                                    <Text style={[styles.chipText, { color: theme.textLight }]}>{lv(lead.requirement)} • {lv(lead.propertyType)}</Text>
                                </View>
                                <Text style={[styles.chipSeparator, { color: theme.border }]}>|</Text>
                                <View style={[styles.chip, { backgroundColor: theme.card }]}>
                                    <Text style={[styles.chipText, { color: theme.textLight }]}>{lv(lead.budget)}</Text>
                                </View>
                                <Text style={[styles.chipSeparator, { color: theme.border }]}>|</Text>
                                <View style={[styles.chip, { backgroundColor: theme.card }]}>
                                    <Text style={[styles.chipText, { color: theme.textLight }]}>{lv(lead.source)}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* 3. Quick Action Row */}
                    <View style={styles.quickActions}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => trackCall(phone, id!, "Lead", name)}>
                            <Ionicons name="call" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}>
                            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => Linking.openURL(`mailto:${email}`)}>
                            <Ionicons name="mail" size={20} color={theme.primary} />
                            <Text style={[styles.actionBtnText, { color: theme.text }]}>Email</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/add-activity?id=${id}&type=Lead`)}>
                            <Ionicons name="calendar-outline" size={20} color={theme.textLight} />
                            <Text style={[styles.actionBtnText, { color: theme.text }]}>Activity</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 4. Lead Snapshot Bar */}
                    <View style={[styles.snapshotBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>LAST CONTACT</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{formatTimeAgo(lead.lastContactedAt)}</Text>
                        </View>
                        <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>ACTIVITIES</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{activities.length}</Text>
                        </View>
                        <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>FOLLOW-UP</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>Tomorrow</Text>
                        </View>
                    </View>

                    {/* 5. Smart Insight Card */}
                    <View style={[styles.insightCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '20' }]}>
                        <View style={[styles.insightIconBox, { backgroundColor: theme.primary + '20' }]}>
                            <Ionicons name="bulb-outline" size={16} color={theme.primary} />
                        </View>
                        <Text style={[styles.insightText, { color: theme.text }]}>
                            {getSmartInsight(lead, activities)}
                        </Text>
                    </View>

                    <LeadProgression currentStage={statusLabel} />

                    {/* 6. Contact Information Card */}
                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Details</Text>
                        <InfoRow label="Mobile" value={phone} icon="call-outline" accent />
                        <InfoRow label="Email" value={email} icon="mail-outline" accent />
                        <InfoRow label="Salutation" value={lead.salutation ?? "—"} icon="person-outline" />
                        <InfoRow label="Current City" value={lead.locCity ?? "—"} icon="location-outline" />
                    </View>

                    {/* 7. Property Requirement Grid */}
                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Property Requirement</Text>
                        <View style={styles.reqGrid}>
                            <RequirementTile label="Requirement" value={lv(lead.requirement)} icon="cart-outline" color="#3B82F6" />
                            <RequirementTile label="Budget" value={lv(lead.budget)} icon="wallet-outline" color="#10B981" />
                            <RequirementTile label="Property Type" value={lv(lead.propertyType)} icon="business-outline" color="#8B5CF6" />
                            <RequirementTile label="Location" value={lv(lead.location)} icon="map-outline" color="#F43F5E" />
                        </View>
                    </View>

                    {/* 8. Assignment & Source */}
                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Assignment & Source</Text>
                        <View style={styles.assignmentRow}>
                            <View style={[styles.assignAvatar, { backgroundColor: theme.primary + '15' }]}>
                                <Ionicons name="person" size={18} color={theme.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.assignLabel, { color: theme.textLight }]}>Assigned To</Text>
                                <Text style={[styles.assignValue, { color: theme.text }]}>{lv(lead.assignment?.assignedTo) !== "—" ? lv(lead.assignment?.assignedTo) : lv(lead.owner)}</Text>
                            </View>
                            <View style={[styles.stageBadge, { backgroundColor: color + '15' }]}>
                                <View style={[styles.stageDot, { backgroundColor: color }]} />
                                <Text style={[styles.stageText, { color }]}>{statusLabel}</Text>
                            </View>
                        </View>
                        <View style={[styles.sourceRow, { borderTopColor: theme.border }]}>
                            <View style={styles.sourceItem}>
                                <Text style={[styles.sourceLabel, { color: theme.textLight }]}>Source</Text>
                                <Text style={[styles.sourceValue, { color: theme.text }]}>{lv(lead.source)}</Text>
                            </View>
                            <View style={styles.sourceItem}>
                                <Text style={[styles.sourceLabel, { color: theme.textLight }]}>Purpose</Text>
                                <Text style={[styles.sourceValue, { color: theme.text }]}>{lead.purpose ?? "—"}</Text>
                            </View>
                        </View>
                    </View>

                    {/* 9. Record Info (Collapsible) */}
                    <TouchableOpacity
                        style={[styles.collapsibleHeader, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => setShowRecordInfo(!showRecordInfo)}
                    >
                        <Text style={[styles.collapsibleTitle, { color: theme.textLight }]}>Record Information</Text>
                        <Ionicons name={showRecordInfo ? "chevron-up" : "chevron-down"} size={16} color={theme.textLight} />
                    </TouchableOpacity>
                    {showRecordInfo && (
                        <View style={[styles.collapsibleContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <InfoRow label="Lead ID" value={id?.slice(-8).toUpperCase() ?? "—"} />
                            <InfoRow label="Created On" value={lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-IN") : "—"} />
                            <InfoRow label="Created By" value={lv(lead.owner)} />
                        </View>
                    )}

                    {/* 10. Timeline */}
                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 10 }]}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Communication Timeline</Text>
                            <TouchableOpacity onPress={() => router.push(`/add-activity?id=${id}&type=Lead`)}>
                                <Text style={[styles.addLink, { color: theme.primary }]}>+ Add</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.timelineContainer}>
                            {activities.length > 0 ? (
                                activities.map((act, i) => (
                                    <ActivityTimelineItem key={i} act={act} isLast={i === activities.length - 1} />
                                ))
                            ) : (
                                <View style={styles.emptyTimeline}>
                                    <Ionicons name="time-outline" size={32} color={theme.border} />
                                    <Text style={[styles.emptyTimelineText, { color: theme.textLight }]}>No interaction logs yet.</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, color: "#94A3B8" },

    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60, borderBottomWidth: 1 },
    navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 14 },
    navTitle: { fontSize: 16, fontWeight: "800" },

    scrollContent: { padding: 20, paddingBottom: 100 },

    heroCard: { borderRadius: 24, padding: 20, marginBottom: 20 },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatarBox: { width: 64, height: 64, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 28, fontWeight: '900' },
    nameSection: { flex: 1 },
    heroName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    scoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    scoreText: { fontSize: 12, fontWeight: '800' },
    statusCapsule: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusCapsuleText: { fontSize: 10, fontWeight: '800' },

    heroSecondary: { marginTop: 16, padding: 12, borderRadius: 16 },
    chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    chipText: { fontSize: 11, fontWeight: '600' },
    chipSeparator: { fontSize: 14 },

    quickActions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    actionBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
    actionBtnSoft: { borderWidth: 1 },
    actionBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

    snapshotBar: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
    snapItem: { flex: 1, alignItems: 'center' },
    snapLabel: { fontSize: 9, fontWeight: '700', marginBottom: 4 },
    snapValue: { fontSize: 13, fontWeight: '800' },
    snapDivider: { width: 1, height: 24 },

    insightCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 24, gap: 12 },
    insightIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    insightText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },

    progressionContainer: { marginBottom: 30 },
    progressionTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
    progressionFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },
    progressionSteps: { flexDirection: 'row', justifyContent: 'space-between' },
    stepWrapper: { alignItems: 'center', width: 60 },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.1)', marginBottom: 6 },
    stepDotActive: { backgroundColor: '#2563EB' },
    stepDotCurrent: { transform: [{ scale: 1.5 }], borderWidth: 2, borderColor: '#fff' },
    stepText: { fontSize: 8, fontWeight: "700", color: 'rgba(0,0,0,0.3)', textAlign: 'center' },
    stepTextActive: { color: '#2563EB' },

    sectionCard: { padding: 20, borderRadius: 22, borderWidth: 1, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
    sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 16 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    addLink: { fontSize: 13, fontWeight: "700" },

    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 13, fontWeight: "600" },
    infoValue: { fontSize: 13, fontWeight: "700" },

    reqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    reqTile: { width: (SCREEN_WIDTH - 60) / 2, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    reqTileIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    reqTileLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
    reqTileValue: { fontSize: 13, fontWeight: '700' },

    assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    assignAvatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    assignLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
    assignValue: { fontSize: 14, fontWeight: '700' },
    stageBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    stageDot: { width: 6, height: 6, borderRadius: 3 },
    stageText: { fontSize: 11, fontWeight: '800' },

    sourceRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 16, gap: 20 },
    sourceItem: { flex: 1 },
    sourceLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    sourceValue: { fontSize: 13, fontWeight: '700' },

    collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
    collapsibleTitle: { fontSize: 13, fontWeight: '700' },
    collapsibleContent: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 20 },

    timelineContainer: { marginTop: 10 },
    timelineItem: { flexDirection: 'row' },
    timelineLeft: { width: 30, alignItems: 'center' },
    timelineDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1, marginTop: 4 },
    timelineLine: { width: 2, flex: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 4 },
    timelineRight: { flex: 1, paddingBottom: 24 },
    timelineCard: { padding: 12, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.02)' },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    timelineType: { fontSize: 10, fontWeight: "900" },
    timelineDate: { fontSize: 10, fontWeight: "700" },
    timelineSubject: { fontSize: 13, fontWeight: "700", color: "#334155" },
    resultPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
    resultPillText: { fontSize: 10, fontWeight: "700", color: "#059669" },

    emptyTimeline: { alignItems: 'center', paddingVertical: 20 },
    emptyTimelineText: { fontSize: 13, marginTop: 8, fontWeight: "600" },
});
