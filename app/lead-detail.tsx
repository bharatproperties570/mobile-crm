import { useCallback, useEffect, useState } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Linking, Alert, SafeAreaView
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { getLeadById, leadName } from "./services/leads.service";
import { getActivities } from "./services/activities.service";
import { useCallTracking } from "./context/CallTrackingContext";

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

function Section({ title, icon, children, color }: { title: string; icon: string; children: React.ReactNode; color?: string }) {
    return (
        <View style={styles.section}>
            <View style={[styles.sectionHead, color ? { borderLeftWidth: 4, borderLeftColor: color } : {}]}>
                <Text style={styles.sectionIcon}>{icon}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

const STAGE_COLORS: Record<string, string> = {
    active: "#10B981", new: "#3B82F6", contacted: "#8B5CF6",
    qualified: "#10B981", proposal: "#F59E0B", negotiation: "#EF4444",
    won: "#059669", lost: "#6B7280",
};

export default function LeadDetailScreen() {
    const { trackCall } = useCallTracking();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [lead, setLead] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [leadRes, actRes] = await Promise.all([
                getLeadById(id as string),
                getActivities({ entityId: id, limit: 10 })
            ]);
            setLead(leadRes?.data ?? leadRes);
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
    if (!lead) return <View style={styles.center}><Text style={styles.noData}>Lead not found</Text></View>;

    const name = leadName(lead);
    const statusLabel = lv(lead.status);
    const color = STAGE_COLORS[statusLabel.toLowerCase()] ?? "#6366F1";
    const phone = lead.mobile ?? "";
    const email = lead.email ?? "";

    return (
        <SafeAreaView style={styles.container}>
            {/* Hero */}
            <View style={[styles.heroHeader, { backgroundColor: color }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>

                <View style={styles.heroTop}>
                    <View style={styles.heroAvatar}>
                        <Text style={styles.heroInitials}>{name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.heroName}>{name}</Text>
                        <View style={[styles.stagePill, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                            <Text style={styles.stagePillText}>{statusLabel}</Text>
                        </View>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{lv(lead.source)}</Text>
                        <Text style={styles.statLabel}>Source</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{lv(lead.requirement)}</Text>
                        <Text style={styles.statLabel}>Requirement</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{lv(lead.budget)}</Text>
                        <Text style={styles.statLabel}>Budget</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    {phone ? (
                        <TouchableOpacity style={styles.qaBtn} onPress={() => trackCall(phone, id!, "Lead", name)}>
                            <Text style={styles.qaBtnIcon}>📞</Text>
                            <Text style={styles.qaBtnText}>Call</Text>
                        </TouchableOpacity>
                    ) : null}
                    {phone ? (
                        <TouchableOpacity style={[styles.qaBtn, { backgroundColor: "#25D366" }]} onPress={() => Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}>
                            <Text style={styles.qaBtnIcon}>💬</Text>
                            <Text style={styles.qaBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                    ) : null}
                    {email ? (
                        <TouchableOpacity style={[styles.qaBtn, { backgroundColor: "#3B82F6" }]} onPress={() => Linking.openURL(`mailto:${email}`)}>
                            <Text style={styles.qaBtnIcon}>✉️</Text>
                            <Text style={styles.qaBtnText}>Email</Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={[styles.qaBtn, { backgroundColor: "#EA580C" }]} onPress={() => router.push(`/add-activity?id=${id}`)}>
                        <Text style={styles.qaBtnIcon}>➕</Text>
                        <Text style={styles.qaBtnText}>Activity</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Contact Details */}
                <Section title="Contact Details" icon="📱" color={color}>
                    <InfoRow label="Mobile" value={phone} accent />
                    <InfoRow label="Email" value={email} accent />
                    <InfoRow label="Salutation" value={lead.salutation ?? "—"} />
                </Section>

                {/* Requirement */}
                <Section title="Property Requirement" icon="🏡" color="#F59E0B">
                    <InfoRow label="Requirement" value={lv(lead.requirement)} />
                    <InfoRow label="Budget" value={lv(lead.budget)} />
                    <InfoRow label="Location" value={lv(lead.location)} />
                    {lead.budgetMin || lead.budgetMax ? (
                        <InfoRow label="Budget Range" value={`₹${(lead.budgetMin ?? 0).toLocaleString("en-IN")} – ₹${(lead.budgetMax ?? 0).toLocaleString("en-IN")}`} />
                    ) : null}
                    {lead.areaMin || lead.areaMax ? (
                        <InfoRow label="Area Range" value={`${lead.areaMin ?? 0} – ${lead.areaMax ?? 0} ${lead.areaMetric ?? "Sq Yard"}`} />
                    ) : null}
                    {lead.propertyType && Array.isArray(lead.propertyType) && lead.propertyType.length > 0 ? (
                        <InfoRow label="Property Type" value={lead.propertyType.map(lv).join(", ")} />
                    ) : null}
                </Section>

                {/* Assignment */}
                <Section title="Assignment" icon="👤" color="#8B5CF6">
                    <InfoRow label="Assigned To" value={lv(lead.assignment?.assignedTo) !== "—" ? lv(lead.assignment?.assignedTo) : lv(lead.owner)} />
                    <InfoRow label="Source" value={lv(lead.source)} />
                    <InfoRow label="Stage" value={statusLabel} />
                    <InfoRow label="Purpose" value={lead.purpose ?? "—"} />
                    <InfoRow label="Timeline" value={lead.timeline ?? "—"} />
                    <InfoRow label="Funding" value={lead.funding ?? "—"} />
                </Section>

                {/* Location */}
                {lead.locCity || lead.locArea ? (
                    <Section title="Location Details" icon="📍" color="#10B981">
                        <InfoRow label="City" value={lead.locCity ?? "—"} />
                        <InfoRow label="Area" value={lead.locArea ?? "—"} />
                        <InfoRow label="State" value={lead.locState ?? "—"} />
                        <InfoRow label="Pin Code" value={lead.locPinCode ?? "—"} />
                    </Section>
                ) : null}

                {/* Tags */}
                {lead.tags?.length > 0 ? (
                    <Section title="Tags" icon="🏷️">
                        <View style={styles.tagRow}>
                            {lead.tags.map((tag: string, i: number) => (
                                <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    </Section>
                ) : null}

                {/* Notes */}
                {lead.notes || lead.description ? (
                    <Section title="Notes" icon="📝">
                        <Text style={styles.notes}>{lead.notes ?? lead.description}</Text>
                    </Section>
                ) : null}

                {/* Meta */}
                <Section title="Record Info" icon="ℹ️">
                    <InfoRow label="Created" value={lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-IN") : "—"} />
                    <InfoRow label="Visible To" value={lead.visibleTo ?? "—"} />
                </Section>

                {/* Activities Section */}
                <Section title="Recent Activities" icon="🕒" color="#DB2777">
                    {activities && activities.length > 0 ? (
                        activities.map((act, i) => (
                            <View key={i} style={styles.activityItem}>
                                <View style={styles.activityHeader}>
                                    <Text style={styles.activityType}>{act.type}</Text>
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
                        style={styles.addActInline}
                        onPress={() => router.push(`/add-activity?id=${id}&type=Lead`)}
                    >
                        <Text style={styles.addActInlineText}>+ Log New Activity</Text>
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
    backBtn: { position: "absolute", top: 12, left: 16, padding: 8 },
    backIcon: { fontSize: 22, color: "#fff", fontWeight: "700" },
    heroTop: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
    heroAvatar: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center",
        borderWidth: 2, borderColor: "rgba(255,255,255,0.5)",
    },
    heroInitials: { fontSize: 22, fontWeight: "800", color: "#fff" },
    heroName: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 6 },
    stagePill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    stagePillText: { fontSize: 11, fontWeight: "700", color: "#fff", textTransform: "capitalize" },
    statsRow: {
        flexDirection: "row", backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 14,
        padding: 12, marginBottom: 14,
    },
    statItem: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 13, fontWeight: "800", color: "#fff" },
    statLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2, textTransform: "uppercase" },
    statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 4 },
    quickActions: { flexDirection: "row", gap: 10 },
    qaBtn: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
        backgroundColor: "rgba(255,255,255,0.2)", paddingVertical: 9, borderRadius: 24,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    },
    qaBtnIcon: { fontSize: 15 },
    qaBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
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
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tag: { backgroundColor: "#EEF2FF", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
    tagText: { fontSize: 12, color: "#4338CA", fontWeight: "600" },
    notes: { fontSize: 14, color: "#475569", lineHeight: 22 },
    activityItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    activityHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    activityType: { fontSize: 11, fontWeight: "800", color: "#DB2777" },
    activityDate: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
    activitySubject: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
    activityStatus: { fontSize: 12, color: "#64748B" },
    resultBadge: { backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" },
    resultText: { fontSize: 11, color: "#059669", fontWeight: "700" },
    emptyText: { textAlign: "center", color: "#94A3B8", marginVertical: 10, fontSize: 13 },
    addActInline: { marginTop: 12, paddingVertical: 10, alignItems: "center", backgroundColor: "#FDF2F8", borderRadius: 12, borderWidth: 1, borderColor: "#FCE7F3", borderStyle: "dashed" },
    addActInlineText: { color: "#DB2777", fontWeight: "700", fontSize: 13 },
});
