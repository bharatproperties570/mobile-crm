import React, { useCallback, useEffect, useState } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "./services/api";
import { getActivities } from "./services/activities.service";

function fmt(amount?: number): string {
    if (!amount) return "—";
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
}

function lv(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value ?? "—";
        if ("fullName" in field) return (field as any).fullName ?? "—";
        if ("name" in field) return (field as any).name ?? "—";
    }
    return String(field) || "—";
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    if (!value || value === "—") return null;
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={[styles.infoValue, accent && styles.infoValueAccent]}>{value}</Text>
        </View>
    );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Text style={styles.sectionIcon}>{icon}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.sectionBody}>{children}</View>
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
    const [deal, setDeal] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [dealRes, actRes] = await Promise.all([
                api.get(`/deals/${id}`),
                getActivities({ entityId: id, limit: 10 })
            ]);
            setDeal(dealRes.data?.data ?? dealRes.data);
            setActivities(actRes?.data ?? actRes);
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
    if (!deal) return <View style={styles.center}><Text style={styles.noData}>Deal not found</Text></View>;

    const stageLabel = deal.stage ?? "Open";
    const stageColor = STAGE_COLORS[stageLabel.toLowerCase()] ?? "#6366F1";
    const inv = typeof deal.inventoryId === 'object' ? deal.inventoryId : null;
    const dealTitle = deal.dealId ?? [
        deal.projectName || inv?.projectName,
        deal.block || inv?.block,
        deal.unitNo || inv?.unitNumber
    ].filter(Boolean).join(" › ") ?? "Untitled Deal";

    return (
        <SafeAreaView style={styles.container}>
            {/* Hero */}
            <View style={[styles.heroHeader, { backgroundColor: stageColor }]}>
                <View style={styles.headerTopActions}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtn}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => router.push(`/add-deal?id=${id}`)}
                        style={styles.editBtn}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <Ionicons name="create-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.dealIdRow}>
                    <Text style={styles.dealId}>{deal.dealId ?? "Deal"}</Text>
                    <View style={styles.stagePill}>
                        <Text style={styles.stagePillText}>{stageLabel}</Text>
                    </View>
                </View>

                <Text style={styles.dealTitle} numberOfLines={2}>{dealTitle}</Text>

                {/* Price Panel */}
                <View style={styles.pricePanel}>
                    <View style={styles.priceItem}>
                        <Text style={styles.priceLabel}>Listed Price</Text>
                        <Text style={styles.priceValue}>{fmt(deal.price)}</Text>
                    </View>
                    {deal.quotePrice ? (
                        <View style={[styles.priceItem, { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.3)" }]}>
                            <Text style={styles.priceLabel}>Quote Price</Text>
                            <Text style={styles.priceValue}>{fmt(deal.quotePrice)}</Text>
                        </View>
                    ) : null}
                    <View style={[styles.priceItem, { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.3)" }]}>
                        <Text style={styles.priceLabel}>Probability</Text>
                        <Text style={styles.priceValue}>{deal.dealProbability ?? 50}%</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Property */}
                <Section title="Property Details" icon="🏢">
                    <InfoRow label="Project" value={deal.projectName ?? "—"} accent />
                    <InfoRow label="Block" value={deal.block ?? "—"} />
                    <InfoRow label="Unit No." value={deal.unitNo ?? "—"} />
                    <InfoRow label="Unit Type" value={deal.unitType ?? "—"} />
                    <InfoRow label="Property Type" value={deal.propertyType ?? "—"} />
                    <InfoRow label="Size" value={deal.size ? `${deal.size} ${deal.sizeUnit ?? ""}`.trim() : "—"} />
                    <InfoRow label="Floor" value={deal.floor?.toString() ?? "—"} />
                    <InfoRow label="Corner" value={deal.corner ?? "—"} />
                    <InfoRow label="Location" value={deal.location ?? "—"} />
                    <InfoRow label="Intent" value={deal.intent ?? "—"} />
                </Section>

                {/* Pricing */}
                <Section title="Pricing & Financials" icon="💰">
                    <InfoRow label="Listed Price" value={fmt(deal.price)} accent />
                    <InfoRow label="Quote Price" value={fmt(deal.quotePrice)} />
                    <InfoRow label="Rate Price" value={deal.ratePrice ? `₹${deal.ratePrice?.toLocaleString("en-IN")} / ${deal.sizeUnit ?? "sq ft"}` : "—"} />
                    <InfoRow label="Pricing Mode" value={deal.pricingMode ?? "—"} />
                    <InfoRow label="Price in Words" value={deal.priceInWords ?? "—"} />
                    <InfoRow label="Negotiable" value={deal.pricingNature?.negotiable ? "✅ Yes" : "❌ No"} />
                    <InfoRow label="Fixed" value={deal.pricingNature?.fixed ? "✅ Yes" : "❌ No"} />
                    <InfoRow label="Transaction Type" value={deal.transactionType ?? "—"} />
                    <InfoRow label="Deal Type" value={deal.dealType ?? "—"} />
                </Section>

                {/* Commission */}
                {deal.commission ? (
                    <Section title="Commission" icon="💼">
                        <InfoRow label="Brokerage %" value={deal.commission.brokeragePercent ? `${deal.commission.brokeragePercent}%` : "—"} />
                        <InfoRow label="Expected Amount" value={fmt(deal.commission.expectedAmount)} accent />
                        <InfoRow label="Actual Amount" value={fmt(deal.commission.actualAmount)} />
                        <InfoRow label="Listing RM" value={deal.commission.internalSplit?.listingRM ? `₹${deal.commission.internalSplit.listingRM?.toLocaleString("en-IN")}` : "—"} />
                        <InfoRow label="Closing RM" value={deal.commission.internalSplit?.closingRM ? `₹${deal.commission.internalSplit.closingRM?.toLocaleString("en-IN")}` : "—"} />
                        <InfoRow label="Channel Partner Share" value={deal.commission.channelPartnerShare ? `₹${deal.commission.channelPartnerShare?.toLocaleString("en-IN")}` : "—"} />
                    </Section>
                ) : null}

                {/* Parties */}
                <Section title="Parties Involved" icon="👥">
                    <InfoRow label="Buyer" value={lv(deal.partyStructure?.buyer) !== "—" ? lv(deal.partyStructure?.buyer) : lv(deal.owner)} />
                    <InfoRow label="Owner / Seller" value={lv(deal.partyStructure?.owner)} />
                    <InfoRow label="Channel Partner" value={lv(deal.partyStructure?.channelPartner)} />
                    <InfoRow label="Internal RM" value={lv(deal.partyStructure?.internalRM)} />
                    <InfoRow label="Assigned To" value={lv(deal.assignedTo)} />
                    <InfoRow label="Source" value={deal.source ?? "—"} />
                    <InfoRow label="Team" value={deal.team ?? "—"} />
                </Section>

                {/* Financial Milestones */}
                {deal.financialDetails ? (
                    <Section title="Financial Milestones" icon="📅">
                        {deal.financialDetails.token?.amount ? (
                            <InfoRow label="Token Amount" value={fmt(deal.financialDetails.token.amount)} />
                        ) : null}
                        {deal.financialDetails.agreement?.amount ? (
                            <InfoRow label="Agreement Amount" value={fmt(deal.financialDetails.agreement.amount)} />
                        ) : null}
                        {deal.financialDetails.registry?.amount ? (
                            <InfoRow label="Registry Amount" value={fmt(deal.financialDetails.registry.amount)} />
                        ) : null}
                        {deal.financialDetails.monthlyRent ? (
                            <InfoRow label="Monthly Rent" value={fmt(deal.financialDetails.monthlyRent)} />
                        ) : null}
                        {deal.financialDetails.securityDeposit ? (
                            <InfoRow label="Security Deposit" value={fmt(deal.financialDetails.securityDeposit)} />
                        ) : null}
                    </Section>
                ) : null}

                {/* Closing */}
                <Section title="Status & Closing" icon="✅">
                    <InfoRow label="Stage" value={stageLabel} />
                    <InfoRow label="Probability" value={`${deal.dealProbability ?? 50}%`} />
                    <InfoRow label="Visible To" value={deal.visibleTo ?? "—"} />
                    {deal.closingDetails?.closingDate ? (
                        <InfoRow label="Closing Date" value={new Date(deal.closingDetails.closingDate).toLocaleDateString("en-IN")} />
                    ) : null}
                </Section>

                {/* Remarks */}
                {deal.remarks ? (
                    <Section title="Remarks" icon="📝">
                        <Text style={styles.notes}>{deal.remarks}</Text>
                    </Section>
                ) : null}

                <Section title="Record Info" icon="ℹ️">
                    <InfoRow label="Created" value={deal.createdAt ? new Date(deal.createdAt).toLocaleDateString("en-IN") : "—"} />
                    <InfoRow label="Date" value={deal.date ? new Date(deal.date).toLocaleDateString("en-IN") : "—"} />
                </Section>

                {/* Activities Section */}
                <Section title="Recent Activities" icon="🕒">
                    {activities && activities.length > 0 ? (
                        activities.map((act, i) => (
                            <View key={i} style={styles.activityItem}>
                                <View style={styles.activityHeader}>
                                    <Text style={[styles.activityType, { color: STAGE_COLORS[deal.stage?.toLowerCase()] || "#6366F1" }]}>{act.type}</Text>
                                    <Text style={styles.activityDate}>{new Date(act.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                                </View>
                                <Text style={styles.activitySubject}>{act.subject}</Text>
                                {act.details?.completionResult ? (
                                    <View style={styles.resultBadge}>
                                        <Text style={styles.resultText}>Result: {act.details.completionResult}</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.activityStatus}>Status: {act.status}</Text>
                                )}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No activities logged yet.</Text>
                    )}
                    <TouchableOpacity
                        style={[styles.addActInline, { borderColor: stageColor, backgroundColor: `${stageColor}10` }]}
                        onPress={() => router.push(`/add-activity?id=${id}&type=Deal`)}
                    >
                        <Text style={[styles.addActInlineText, { color: stageColor }]}>+ Log New Activity</Text>
                    </TouchableOpacity>
                </Section>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F0F4FF" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, color: "#94A3B8" },
    heroHeader: { paddingTop: 12, paddingBottom: 20, paddingHorizontal: 20 },
    headerTopActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", position: "absolute", top: 12, left: 16, right: 16, zIndex: 10 },
    backBtn: { padding: 8 },
    editBtn: { padding: 8 },
    dealIdRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
    dealId: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
    stagePill: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    stagePillText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    dealTitle: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 14 },
    pricePanel: {
        flexDirection: "row", backgroundColor: "rgba(0,0,0,0.15)",
        borderRadius: 14, padding: 14, gap: 0,
    },
    priceItem: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
    priceLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
    priceValue: { fontSize: 16, fontWeight: "800", color: "#fff" },
    scroll: { padding: 16, paddingBottom: 80 },
    section: {
        backgroundColor: "#fff", borderRadius: 18, marginBottom: 14,
        shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
        overflow: "hidden",
    },
    sectionHead: {
        flexDirection: "row", alignItems: "center", padding: 14,
        borderBottomWidth: 1, borderBottomColor: "#F1F5F9", backgroundColor: "#FAFBFF",
    },
    sectionIcon: { fontSize: 18, marginRight: 8 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: "#1E3A8A", textTransform: "uppercase", letterSpacing: 0.5 },
    sectionBody: { padding: 14 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
    infoLabel: { fontSize: 13, color: "#64748B", fontWeight: "500", flex: 1 },
    infoValue: { fontSize: 13, color: "#1E293B", fontWeight: "600", flex: 2, textAlign: "right" },
    infoValueAccent: { color: "#1E40AF", fontWeight: "700" },
    notes: { fontSize: 14, color: "#475569", lineHeight: 22 },
    activityItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    activityHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    activityType: { fontSize: 11, fontWeight: "800" },
    activityDate: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
    activitySubject: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
    activityStatus: { fontSize: 12, color: "#64748B" },
    resultBadge: { backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" },
    resultText: { fontSize: 11, color: "#059669", fontWeight: "700" },
    emptyText: { textAlign: "center", color: "#94A3B8", marginVertical: 10, fontSize: 13 },
    addActInline: { marginTop: 12, paddingVertical: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
    addActInlineText: { fontWeight: "700", fontSize: 13 },
});
