import React, { useCallback, useEffect, useState } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Linking, Alert, SafeAreaView
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { getContactById } from "./services/contacts.service";
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

export default function ContactDetailScreen() {
    const { trackCall } = useCallTracking();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [contact, setContact] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [contactRes, actRes] = await Promise.all([
                getContactById(id as string),
                getActivities({ entityId: id, limit: 10 })
            ]);
            setContact(contactRes?.data ?? contactRes);
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

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#1E40AF" />
            </View>
        );
    }

    if (!contact) {
        return (
            <View style={styles.center}>
                <Text style={styles.noData}>Contact not found</Text>
            </View>
        );
    }

    const firstName = contact.name ?? "";
    const lastName = contact.surname ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
    const initials = (firstName[0] ?? "") + (lastName[0] ?? firstName[1] ?? "");
    const phone = contact.phones?.[0]?.number ?? "";
    const phone2 = contact.phones?.[1]?.number ?? "";
    const email = contact.emails?.[0]?.address ?? "";
    const email2 = contact.emails?.[1]?.address ?? "";

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.heroHeader}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <View style={styles.heroAvatar}>
                    <Text style={styles.heroInitials}>{initials.toUpperCase() || "?"}</Text>
                </View>
                <Text style={styles.heroName}>{fullName}</Text>
                {contact.company ? <Text style={styles.heroSub}>🏢 {contact.company}</Text> : null}

                {/* Quick Action Buttons */}
                <View style={styles.quickActions}>
                    {phone ? (
                        <TouchableOpacity style={[styles.qaBtn, { backgroundColor: "#10B981" }]} onPress={() => trackCall(phone, id!, "Contact", fullName)}>
                            <Text style={styles.qaBtnIcon}>📞</Text>
                            <Text style={styles.qaBtnText}>Call</Text>
                        </TouchableOpacity>
                    ) : null}
                    {email ? (
                        <TouchableOpacity style={[styles.qaBtn, { backgroundColor: "#3B82F6" }]} onPress={() => Linking.openURL(`mailto:${email}`)}>
                            <Text style={styles.qaBtnIcon}>✉️</Text>
                            <Text style={styles.qaBtnText}>Email</Text>
                        </TouchableOpacity>
                    ) : null}
                    {phone ? (
                        <TouchableOpacity style={[styles.qaBtn, { backgroundColor: "#25D366" }]} onPress={() => Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}>
                            <Text style={styles.qaBtnIcon}>💬</Text>
                            <Text style={styles.qaBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Contact Info */}
                <Section title="Contact Info" icon="📱">
                    <InfoRow label="Primary Phone" value={phone} accent />
                    {phone2 ? <InfoRow label="Secondary Phone" value={phone2} /> : null}
                    <InfoRow label="Primary Email" value={email} accent />
                    {email2 ? <InfoRow label="Secondary Email" value={email2} /> : null}
                    <InfoRow label="Father's Name" value={contact.fatherName ?? "—"} />
                </Section>

                {/* Professional */}
                <Section title="Professional Details" icon="💼">
                    <InfoRow label="Company" value={contact.company ?? "—"} />
                    <InfoRow label="Work Office" value={contact.workOffice ?? "—"} />
                    <InfoRow label="Designation" value={lv(contact.designation)} />
                    <InfoRow label="Profession" value={lv(contact.professionCategory)} />
                </Section>

                {/* Personal */}
                <Section title="Personal Details" icon="🪪">
                    <InfoRow label="Gender" value={contact.gender ?? "—"} />
                    <InfoRow label="Marital Status" value={contact.maritalStatus ?? "—"} />
                    {contact.birthDate ? (
                        <InfoRow label="Date of Birth" value={new Date(contact.birthDate).toLocaleDateString("en-IN")} />
                    ) : null}
                    {contact.anniversaryDate ? (
                        <InfoRow label="Anniversary" value={new Date(contact.anniversaryDate).toLocaleDateString("en-IN")} />
                    ) : null}
                </Section>

                {/* Source */}
                <Section title="Source & Campaign" icon="📣">
                    <InfoRow label="Source" value={lv(contact.source)} />
                    <InfoRow label="Sub Source" value={lv(contact.subSource)} />
                    <InfoRow label="Campaign" value={lv(contact.campaign)} />
                    <InfoRow label="Status" value={contact.status ?? "—"} />
                    <InfoRow label="Stage" value={contact.stage ?? "—"} />
                </Section>

                {/* Address */}
                {contact.personalAddress ? (
                    <Section title="Address" icon="📍">
                        <InfoRow label="House / Flat" value={contact.personalAddress.hNo ?? "—"} />
                        <InfoRow label="Street" value={contact.personalAddress.street ?? "—"} />
                        <InfoRow label="Area" value={contact.personalAddress.area ?? "—"} />
                        <InfoRow label="City" value={lv(contact.personalAddress.city)} />
                        <InfoRow label="State" value={lv(contact.personalAddress.state)} />
                        <InfoRow label="Pin Code" value={contact.personalAddress.pinCode ?? "—"} />
                    </Section>
                ) : null}

                {/* Tags */}
                {contact.tags && contact.tags.length > 0 ? (
                    <Section title="Tags" icon="🏷️">
                        <View style={styles.tagRow}>
                            {contact.tags.map((tag: string, i: number) => (
                                <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    </Section>
                ) : null}

                {/* Description */}
                {contact.description ? (
                    <Section title="Notes" icon="📝">
                        <Text style={styles.notes}>{contact.description}</Text>
                    </Section>
                ) : null}

                {/* Meta */}
                <Section title="Record Info" icon="ℹ️">
                    <InfoRow label="Created" value={contact.createdAt ? new Date(contact.createdAt).toLocaleDateString("en-IN") : "—"} />
                    <InfoRow label="Owner" value={lv(contact.owner)} />
                </Section>

                {/* Activities Section */}
                <Section title="Recent Activities" icon="🕒">
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
                        onPress={() => router.push(`/add-activity?id=${id}&type=Contact`)}
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
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F0F4FF" },
    noData: { fontSize: 16, color: "#94A3B8" },
    heroHeader: {
        backgroundColor: "#1E40AF", paddingTop: 12, paddingBottom: 28, paddingHorizontal: 20, alignItems: "center",
    },
    backBtn: { position: "absolute", top: 12, left: 16, padding: 8 },
    backIcon: { fontSize: 22, color: "#fff", fontWeight: "700" },
    heroAvatar: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center",
        marginBottom: 12, borderWidth: 3, borderColor: "rgba(255,255,255,0.4)",
    },
    heroInitials: { fontSize: 28, fontWeight: "800", color: "#fff" },
    heroName: { fontSize: 22, fontWeight: "800", color: "#fff", textAlign: "center" },
    heroSub: { fontSize: 13, color: "#BFDBFE", marginTop: 4, textAlign: "center" },
    quickActions: { flexDirection: "row", gap: 12, marginTop: 20 },
    qaBtn: {
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    qaBtnIcon: { fontSize: 16 },
    qaBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
    activityType: { fontSize: 11, fontWeight: "800", color: "#1E40AF" },
    activityDate: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
    activitySubject: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
    activityStatus: { fontSize: 12, color: "#64748B" },
    resultBadge: { backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" },
    resultText: { fontSize: 11, color: "#059669", fontWeight: "700" },
    emptyText: { textAlign: "center", color: "#94A3B8", marginVertical: 10, fontSize: 13 },
    addActInline: { marginTop: 12, paddingVertical: 10, alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 12, borderWidth: 1, borderColor: "#DBEAFE", borderStyle: "dashed" },
    addActInlineText: { color: "#1E40AF", fontWeight: "700", fontSize: 13 },
});
