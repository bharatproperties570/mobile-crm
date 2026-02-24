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
import { getActivities } from "./services/activities.service";
import { useLookup } from "./context/LookupContext";


const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
    const [loading, setLoading] = useState(true);
    const scrollY = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            const [contactRes, actRes] = await Promise.all([
                getContactById(id as string),
                getActivities({ entityId: id, limit: 10 })
            ]);
            setContact(contactRes?.data ?? contactRes);
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
            <SafeAreaView style={{ backgroundColor: theme.card, zIndex: 10 }}>
                <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.navBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: theme.text }]}>Contact Hub</Text>
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.background }]} onPress={() => router.push(`/add-contact?id=${id}`)}>
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
                                <Text style={[styles.avatarText, { color: theme.primary }]}>{initials.toUpperCase()}</Text>
                            </View>
                            <View style={styles.nameSection}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={[styles.heroName, { color: theme.text }]}>{fullName}</Text>
                                    <View style={[styles.scoreBadge, { backgroundColor: score.color + '20' }]}>
                                        <Text style={[styles.scoreText, { color: score.color }]}>{score.val}%</Text>
                                    </View>
                                </View>
                                <View style={[styles.statusCapsule, { backgroundColor: theme.primary + '15' }]}>
                                    <Text style={[styles.statusCapsuleText, { color: theme.primary }]}>{getLookupValue("ProfessionalCategory", contact.professionCategory).toUpperCase()}</Text>
                                </View>

                            </View>
                        </View>
                    </View>

                    <View style={styles.quickActions}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => trackCall(phone, id!, "Contact", fullName)}>
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
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/add-activity?id=${id}&type=Contact`)}>
                            <Ionicons name="calendar-outline" size={20} color={theme.textLight} />
                            <Text style={[styles.actionBtnText, { color: theme.text }]}>Activity</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.snapshotBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>RELATION</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{lv(contact.status)}</Text>
                        </View>
                        <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>ACTIVITIES</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{activities.length}</Text>
                        </View>
                        <View style={[styles.snapDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.snapItem}>
                            <Text style={[styles.snapLabel, { color: theme.textLight }]}>LAST CONV</Text>
                            <Text style={[styles.snapValue, { color: theme.text }]}>{formatTimeAgo(activities[0]?.dueDate)}</Text>
                        </View>
                    </View>

                    <View style={[styles.insightCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '20' }]}>
                        <View style={[styles.insightIconBox, { backgroundColor: theme.primary + '20' }]}>
                            <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
                        </View>
                        <Text style={[styles.insightText, { color: theme.text }]}>{getContactInsight(contact, activities)}</Text>
                    </View>

                    <View style={styles.mainGrid}>
                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Communication Details</Text>
                            {contact.phones?.map((p: any, i: number) => (
                                <InfoRow key={`p-${i}`} label={i === 0 ? "Primary Mobile" : `Phone ${i + 1}`} value={p.number} icon="call-outline" accent />
                            ))}
                            {contact.emails?.map((e: any, i: number) => (
                                <InfoRow key={`e-${i}`} label={i === 0 ? "Primary Email" : `Email ${i + 1}`} value={e.address} icon="mail-outline" />
                            ))}
                        </View>

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Professional Details</Text>
                            <InfoRow label="Company" value={contact.company} icon="business-outline" />
                            <InfoRow label="Work Office" value={contact.workOffice} icon="location-outline" />
                            <InfoRow label="Profession" value={getLookupValue("ProfessionalCategory", contact.professionCategory)} icon="briefcase-outline" />
                            <InfoRow label="Specialization" value={getLookupValue("ProfessionalSubCategory", contact.professionSubCategory)} icon="ribbon-outline" />
                            <InfoRow label="Designation" value={getLookupValue("ProfessionalDesignation", contact.designation)} icon="medal-outline" />
                        </View>

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal & Tags</Text>
                            <InfoRow label="Gender" value={contact.gender} icon="person-outline" />
                            <InfoRow label="Source" value={getLookupValue("Source", contact.source)} icon="share-social-outline" />
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

                        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Record Management</Text>
                            <InfoRow label="Owner" value={getLookupValue("Owner", contact.owner)} icon="shield-checkmark-outline" />
                            <InfoRow label="Created On" value={new Date(contact.createdAt).toLocaleDateString()} icon="calendar-outline" />
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
    avatarBox: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 24, fontWeight: "800" },
    nameSection: { flex: 1 },
    heroName: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
    scoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    scoreText: { fontSize: 13, fontWeight: "800" },
    statusCapsule: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    statusCapsuleText: { fontSize: 11, fontWeight: "800" },
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
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    tagText: { fontSize: 12, fontWeight: "700" },
});
