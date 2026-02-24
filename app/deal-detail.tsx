import { useCallback, useEffect, useState, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, SafeAreaView, Animated, Linking, Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./context/ThemeContext";
import { useCallTracking } from "./context/CallTrackingContext";
import api from "./services/api";
import { getActivities } from "./services/activities.service";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function fmt(amount?: number): string {
    if (!amount) return "—";
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
}

function lv(field: unknown): string {
    if (field === null || field === undefined || field === "" || field === "null" || field === "undefined") return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field && field.lookup_value) return (field as any).lookup_value;
        if ("fullName" in field && field.fullName) return (field as any).fullName;
        if ("name" in field && field.name) return (field as any).name;
    }
    const str = String(field).trim();
    return str || "—";
}

function formatTimeAgo(dateString?: string) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSecs < 60) return "Just now";
    if (diffInSecs < 3600) return `${Math.floor(diffInSecs / 60)}m ago`;
    if (diffInSecs < 8400) return `${Math.floor(diffInSecs / 3600)}h ago`;
    return `${Math.floor(diffInSecs / 86400)}d ago`;
}

function getDealScore(deal: any) {
    let score = deal.dealProbability || 50;
    const stage = lv(deal.stage).toLowerCase();
    if (stage === "negotiation") score += 10;
    if (stage === "booked") score += 30;

    score = Math.min(score, 100);
    const color = score > 80 ? "#10B981" : score > 50 ? "#F59E0B" : "#EF4444";
    return { val: score, color };
}

function getDealInsight(deal: any, activities: any[]) {
    const stage = lv(deal.stage).toLowerCase();
    if (stage === "open") return "Quickly qualify the requirement to move to Quoting stage.";
    if (stage === "negotiation") return "Critical negotiation phase. Check if inventory block time is expiring.";
    if (deal.dealProbability > 70) return "High deal probability. Maintain frequent contact to close.";
    return "Ensure all property details are shared with the buyer for consideration.";
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

const STAGE_COLORS: Record<string, string> = {
    open: "#3B82F6", quote: "#8B5CF6", negotiation: "#F59E0B",
    booked: "#10B981", closed: "#059669", cancelled: "#EF4444",
};

export default function DealDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { trackCall } = useCallTracking();
    const [deal, setDeal] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollY = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [dealRes, actRes] = await Promise.all([
                api.get(`/deals/${id}`),
                getActivities({ entityId: id, limit: 10 })
            ]);
            const d = dealRes.data?.deal ?? dealRes.data?.data ?? dealRes.data;
            setDeal(d);
            setActivities(actRes?.data ?? actRes);
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!deal) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={[styles.noData, { color: theme.textLight }]}>Deal not found</Text></View>;

    const stageLabel = deal.stage ?? "Open";
    const stageColor = STAGE_COLORS[stageLabel.toLowerCase()] ?? theme.primary;
    const score = getDealScore(deal);
    const buyer = lv(deal.partyStructure?.buyer) !== "—" ? lv(deal.partyStructure?.buyer) : lv(deal.owner);
    const buyerPhone = deal.partyStructure?.buyer?.mobile || deal.owner?.mobile || "";
    const buyerEmail = deal.partyStructure?.buyer?.email || deal.owner?.email || "";

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <SafeAreaView style={{ backgroundColor: theme.card, zIndex: 10 }}>
                <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.navBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: theme.text }]}>Deal Command</Text>
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.background }]} onPress={() => router.push(`/add-deal?id=${id}`)}>
                        <Ionicons name="create-outline" size={22} color={theme.text} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
            >
                <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
                        <View style={styles.heroTopRow}>
                            <View style={[styles.avatarBox, { backgroundColor: theme.primary + '15' }]}>
                                <Text style={[styles.avatarText, { color: theme.primary }]}>{buyer.charAt(0)}</Text>
                            </View>
                            <View style={styles.nameSection}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={[styles.heroName, { color: theme.text }]}>{buyer}</Text>
                                    <View style={[styles.scoreBadge, { backgroundColor: score.color + '20' }]}>
                                        <Text style={[styles.scoreText, { color: score.color }]}>{score.val}%</Text>
                                    </View>
                                </View>
                                <View style={[styles.statusCapsule, { backgroundColor: stageColor + '15' }]}>
                                    <Text style={[styles.statusCapsuleText, { color: stageColor }]}>{stageLabel.toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>

                        {(() => {
                            const projectName = lv(deal.projectName) !== "—" ? lv(deal.projectName) : lv(deal.projectId);
                            const unitNo = lv(deal.unitNo || deal.unitNumber) !== "—" ? lv(deal.unitNo || deal.unitNumber) : lv(deal.inventoryId?.unitNumber || deal.inventoryId?.unitNo);
                            return (
                                <View style={[styles.heroSecondary, { backgroundColor: theme.background }]}>
                                    <View style={styles.chipRow}>
                                        <View style={[styles.chip, { backgroundColor: theme.card }]}>
                                            <Text style={[styles.chipText, { color: theme.textLight }]}>{projectName} • {unitNo}</Text>
                                        </View>
                                        <Text style={[styles.chipSeparator, { color: theme.border }]}>|</Text>
                                        <View style={[styles.chip, { backgroundColor: theme.card }]}>
                                            <Text style={[styles.chipText, { color: theme.textLight }]}>{fmt(deal.price)}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>

                    <View style={styles.quickActions}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => trackCall(buyerPhone, id!, "Deal", buyer)}>
                            <Ionicons name="call" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => Linking.openURL(`https://wa.me/${buyerPhone.replace(/\D/g, "")}`)}>
                            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => Linking.openURL(`mailto:${buyerEmail}`)}>
                            <Ionicons name="mail" size={20} color={theme.primary} />
                            <Text style={[styles.actionBtnText, { color: theme.text }]}>Email</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/add-activity?id=${id}&type=Deal`)}>
                            <Ionicons name="calendar-outline" size={20} color={theme.textLight} />
                            <Text style={[styles.actionBtnText, { color: theme.text }]}>Activity</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.snapshotBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>PROBABILITY</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{deal.dealProbability ?? 50}%</Text>
                        </View>
                        <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>QUOTED</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{fmt(deal.quotePrice)}</Text>
                        </View>
                        <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>AGING</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{formatTimeAgo(deal.createdAt)}</Text>
                        </View>
                    </View>

                    <View style={[styles.insightCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '20' }]}>
                        <View style={[styles.insightIconBox, { backgroundColor: theme.primary + '20' }]}>
                            <Ionicons name="bulb-outline" size={16} color={theme.primary} />
                        </View>
                        <Text style={[styles.insightText, { color: theme.text }]}>{getDealInsight(deal, activities)}</Text>
                    </View>

                    <View style={styles.mainGrid}>
                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Property Details</Text>
                            {(() => {
                                const projectName = lv(deal.projectName) !== "—" ? lv(deal.projectName) : lv(deal.projectId);
                                const unitNo = lv(deal.unitNo) !== "—" ? lv(deal.unitNo) : (lv(deal.unitNumber) !== "—" ? lv(deal.unitNumber) : lv(deal.inventoryId?.unitNo || deal.inventoryId?.unitNumber));
                                const block = lv(deal.block) !== "—" ? lv(deal.block) : lv(deal.inventoryId?.block);
                                const sizeVal = deal.size || deal.inventoryId?.size;
                                const sizeUnitVal = deal.sizeUnit || deal.inventoryId?.sizeUnit || "";
                                const size = sizeVal ? `${sizeVal} ${sizeUnitVal}`.trim() : "—";
                                const unitType = lv(deal.unitType) !== "—" ? lv(deal.unitType) : lv(deal.inventoryId?.unitType);
                                const location = lv(deal.location) !== "—" ? lv(deal.location) : lv(deal.inventoryId?.location);

                                return (
                                    <>
                                        <InfoRow label="Project" value={projectName} icon="business-outline" accent />
                                        <InfoRow label="Block/Unit" value={`${block} / ${unitNo}`} icon="grid-outline" />
                                        <InfoRow label="Unit Type" value={unitType} icon="home-outline" />
                                        <InfoRow label="Size" value={size} icon="resize-outline" />
                                        <InfoRow label="Location" value={location} icon="map-outline" />
                                    </>
                                );
                            })()}
                        </View>

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Financials</Text>
                            <InfoRow label="Listed Price" value={fmt(deal.price)} icon="cash-outline" accent />
                            <InfoRow label="Quote Price" value={fmt(deal.quotePrice)} icon="pricetag-outline" />
                            {deal.ratePrice && (
                                <InfoRow label="Rate Price" value={`${fmt(deal.ratePrice)} / unit`} icon="calculator-outline" />
                            )}
                            <InfoRow label="Negotiable" value={deal.pricingNature?.negotiable ? "Yes" : "No"} icon="chatbubbles-outline" />
                            <InfoRow label="Transaction" value={lv(deal.transactionType)} icon="repeat-outline" />
                        </View>

                        {deal.commission && (
                            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Commission</Text>
                                <InfoRow label="Expected" value={fmt(deal.commission.expectedAmount)} icon="wallet-outline" accent />
                                <InfoRow label="Brokerage" value={deal.commission.brokeragePercent ? `${deal.commission.brokeragePercent}%` : "—"} icon="calculator-outline" />
                            </View>
                        )}

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Assignment & System</Text>
                            <InfoRow label="Intent" value={lv(deal.intent)} icon="flag-outline" accent />
                            <InfoRow label="Status" value={lv(deal.status)} icon="stats-chart-outline" />
                            <InfoRow label="Assigned To" value={lv(deal.assignedTo)} icon="person-outline" />
                            <InfoRow label="Team" value={lv(deal.team)} icon="people-outline" />
                            <InfoRow label="Visible To" value={lv(deal.visibleTo)} icon="eye-outline" />
                        </View>

                        {deal.publishOn && Object.values(deal.publishOn).some(v => v) && (
                            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Published On</Text>
                                <View style={styles.chipRow}>
                                    {Object.entries(deal.publishOn).map(([key, val], i) => val ? (
                                        <View key={i} style={[styles.chip, { backgroundColor: theme.primary + '15' }]}>
                                            <Text style={[styles.chipText, { color: theme.primary }]}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                                        </View>
                                    ) : null)}
                                </View>
                            </View>
                        )}

                        {deal.remarks ? (
                            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Remarks</Text>
                                <Text style={[styles.remarksText, { color: theme.text }]}>{deal.remarks}</Text>
                            </View>
                        ) : null}

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activities</Text>
                            {activities.slice(0, 3).map((act, i) => (
                                <View key={i} style={[styles.actMiniRow, { borderBottomColor: theme.border }]}>
                                    <View style={[styles.actDot, { backgroundColor: theme.primary }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.actMiniSubject, { color: theme.text }]} numberOfLines={1}>{act.subject}</Text>
                                        <Text style={[styles.actMiniDate, { color: theme.textLight }]}>{new Date(act.dueDate).toLocaleDateString()}</Text>
                                    </View>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.viewMoreBtn} onPress={() => router.push(`/add-activity?id=${id}&type=Deal`)}>
                                <Text style={[styles.viewMoreText, { color: theme.primary }]}>+ Log Activity</Text>
                            </TouchableOpacity>
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
    noData: { fontSize: 16, fontWeight: "600" },
    navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    navBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    navTitle: { fontSize: 17, fontWeight: "800" },
    scrollContent: { paddingBottom: 100 },
    heroCard: { margin: 20, padding: 20, borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatarBox: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 24, fontWeight: "800" },
    nameSection: { flex: 1 },
    heroName: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
    scoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    scoreText: { fontSize: 13, fontWeight: "800" },
    statusCapsule: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    statusCapsuleText: { fontSize: 11, fontWeight: "800" },
    heroSecondary: { marginTop: 16, borderRadius: 16, padding: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    chipText: { fontSize: 13, fontWeight: "600" },
    chipSeparator: { fontSize: 14, opacity: 0.3 },
    quickActions: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    actionBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    actionBtnSoft: { borderWidth: 1 },
    actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    snapshotBar: { marginHorizontal: 20, padding: 16, borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    snapItem: { flex: 1, alignItems: 'center' },
    snapLabel: { fontSize: 9, fontWeight: "800", marginBottom: 4 },
    snapValue: { fontSize: 14, fontWeight: "800" },
    snapDivider: { width: 1, height: '60%', alignSelf: 'center' },
    insightCard: { marginHorizontal: 20, padding: 16, borderRadius: 18, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    insightIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    insightText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
    mainGrid: { paddingHorizontal: 20 },
    sectionCard: { padding: 20, borderRadius: 22, borderWidth: 1, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
    sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 14, fontWeight: "600" },
    infoValue: { fontSize: 14, fontWeight: "700" },
    remarksText: { fontSize: 14, color: "#475569", lineHeight: 20, marginTop: 4 },
    actMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
    actDot: { width: 6, height: 6, borderRadius: 3 },
    actMiniSubject: { fontSize: 14, fontWeight: "600" },
    actMiniDate: { fontSize: 12, fontWeight: "500", marginTop: 2 },
    viewMoreBtn: { marginTop: 12, padding: 4 },
    viewMoreText: { fontSize: 14, fontWeight: "700" },
});
