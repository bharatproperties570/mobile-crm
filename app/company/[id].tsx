import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Platform, Animated, Dimensions, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const formatCurrency = (value: number) => {
    if (!value) return "₹0";
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString("en-IN")}`;
};

const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
};

function lv(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value ?? "—";
        if ("fullName" in field) return (field as any).fullName ?? "—";
        if ("name" in field) return (field as any).name ?? "—";
    }
    return String(field) || "—";
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

export default function CompanyDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState<any>(null);
    const [stats, setStats] = useState({ projects: 0, inventory: 0, deals: 0, revenue: 0 });
    const [activeTab, setActiveTab] = useState("overview");

    const [projects, setProjects] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/companies/${id}`);
            if (res.data?.success) {
                const compData = res.data.data;
                setCompany(compData);
                await fetchAssociatedData(compData._id);
                Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
            }
        } catch (error) {
            console.error("Failed to load company:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchAssociatedData = async (compId: string) => {
        try {
            const projRes = await api.get(`/projects`, { params: { developerId: compId } });
            const projs = projRes.data?.data || [];
            setProjects(projs);

            let fetchedDeals: any[] = [];
            let fetchedInv: any[] = [];

            if (projs.length > 0) {
                const pIds = projs.map((p: any) => p._id).join(',');
                const [dRes, iRes] = await Promise.all([
                    api.get(`/deals`, { params: { projectIds: pIds } }),
                    api.get(`/inventory`, { params: { projectIds: pIds } })
                ]);
                fetchedDeals = dRes.data?.records || [];
                fetchedInv = iRes.data?.data || [];
            }

            setDeals(fetchedDeals);
            setInventory(fetchedInv);

            const rev = fetchedDeals.filter(d => d.stage === 'Closed').reduce((acc, curr) => acc + (curr.price || 0), 0);
            setStats({ projects: projs.length, inventory: fetchedInv.length, deals: fetchedDeals.length, revenue: rev });
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (id) fetchDetails();
    }, [id, fetchDetails]);

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!company) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={[styles.noData, { color: theme.textLight }]}>Company not found</Text></View>;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <SafeAreaView style={{ backgroundColor: theme.card, zIndex: 10 }}>
                <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity
                        onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/companies")}
                        style={[styles.navBtn, { backgroundColor: theme.background }]}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: theme.text }]}>Enterprise Command</Text>
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.background }]} onPress={() => Alert.alert("Options", "Coming soon")}>
                        <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={{ opacity: fadeAnim }}>
                    {/* Hero Section */}
                    <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
                        <View style={styles.heroTopRow}>
                            <View style={[styles.avatarBox, { backgroundColor: theme.primary + '15' }]}>
                                <Text style={[styles.avatarText, { color: theme.primary }]}>{getInitials(company.name)}</Text>
                            </View>
                            <View style={styles.nameSection}>
                                <Text style={[styles.heroName, { color: theme.text }]}>{company.name}</Text>
                                <View style={[styles.statusCapsule, { backgroundColor: theme.primary + '15' }]}>
                                    <Text style={[styles.statusCapsuleText, { color: theme.primary }]}>{lv(company.companyType).toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>

                        <Text style={[styles.subtitle, { color: theme.textLight }]}>
                            {lv(company.industry)} • GST: {company.gstNumber || "N/A"}
                        </Text>

                        <View style={[styles.statsRow, { backgroundColor: theme.background }]}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statLabel, { color: theme.textLight }]}>PROJECTS</Text>
                                <Text style={[styles.statValue, { color: theme.text }]}>{stats.projects}</Text>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statLabel, { color: theme.textLight }]}>REVENUE</Text>
                                <Text style={[styles.statValue, { color: '#10B981' }]}>{formatCurrency(stats.revenue)}</Text>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statLabel, { color: theme.textLight }]}>DEALS</Text>
                                <Text style={[styles.statValue, { color: theme.text }]}>{stats.deals}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Tabs */}
                    <View style={[styles.tabsRow, { borderBottomColor: theme.border }]}>
                        {["overview", "deals", "projects", "inventory"].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabBtn, activeTab === tab && { borderBottomColor: theme.primary }]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text style={[styles.tabText, { color: activeTab === tab ? theme.primary : theme.textLight }]}>
                                    {(tab || "").toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.mainGrid}>
                        {activeTab === "overview" && (
                            <>
                                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Corporate Identity</Text>
                                    <InfoRow label="Industry" value={lv(company.industry)} icon="business-outline" />
                                    <InfoRow label="Sub-Category" value={lv(company.companySubCategory)} icon="list-outline" />
                                    <InfoRow label="PAN Number" value={company.panNumber} icon="card-outline" />
                                    <InfoRow label="GST Number" value={company.gstNumber} icon="receipt-outline" />
                                    <InfoRow label="CIN Number" value={company.cinNumber} icon="finger-print-outline" />
                                    <InfoRow label="TAN Number" value={company.tanNumber} icon="wallet-outline" />
                                    <InfoRow label="Website" value={company.website} icon="globe-outline" />
                                </View>

                                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Relationship Management</Text>
                                    <InfoRow label="Source" value={lv(company.source)} icon="share-social-outline" />
                                    <InfoRow label="Assigned To" value={lv(company.owner)} icon="person-outline" />
                                    <InfoRow label="Team" value={lv(company.team)} icon="people-outline" />
                                </View>

                                {company.authorizedSignatory && (
                                    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Authorized Signatory</Text>
                                        <InfoRow label="Name" value={company.authorizedSignatory.name} icon="person-circle-outline" accent />
                                        <InfoRow label="Mobile" value={company.authorizedSignatory.mobile} icon="call-outline" />
                                        <InfoRow label="Email" value={company.authorizedSignatory.email} icon="mail-outline" />
                                    </View>
                                )}
                                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact & Address</Text>
                                    <InfoRow label="Phone" value={company.phones?.[0]?.phoneNumber} icon="call-outline" accent />
                                    <InfoRow label="Email" value={company.emails?.[0]?.address} icon="mail-outline" />
                                    <View style={[styles.addressBox, { backgroundColor: theme.background }]}>
                                        <Text style={[styles.addressLabel, { color: theme.textLight }]}>REGISTERED OFFICE</Text>
                                        <Text style={[styles.addressValue, { color: theme.text }]}>
                                            {company.addresses?.registeredOffice?.hNo} {company.addresses?.registeredOffice?.street}
                                            {company.addresses?.registeredOffice?.area ? `, ${company.addresses?.registeredOffice?.area}` : ""}
                                            {"\n"}{lv(company.addresses?.registeredOffice?.city)}, {lv(company.addresses?.registeredOffice?.state)}
                                            {company.addresses?.registeredOffice?.pincode ? ` - ${company.addresses?.registeredOffice?.pincode}` : ""}
                                            {company.addresses?.registeredOffice?.country ? `\n${lv(company.addresses?.registeredOffice?.country)}` : ""}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {activeTab === "deals" && deals.map((d, i) => (
                            <View key={i} style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={styles.listCardTop}>
                                    <Text style={[styles.listCardTitle, { color: theme.text }]}>Deal #{d._id?.substring(d._id.length - 6).toUpperCase()}</Text>
                                    <View style={[styles.miniBadge, { backgroundColor: d.stage === 'Closed' ? '#10B98120' : theme.primary + '20' }]}>
                                        <Text style={[styles.miniBadgeText, { color: d.stage === 'Closed' ? '#10B981' : theme.primary }]}>{(d.stage || 'Pending').toUpperCase()}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.listCardSub, { color: theme.textLight }]}>{d.projectName?.name || "Project"}</Text>
                                <Text style={[styles.listCardPrice, { color: theme.text }]}>{formatCurrency(d.price)}</Text>
                            </View>
                        ))}

                        {activeTab === "projects" && projects.map((p, i) => (
                            <TouchableOpacity key={i} style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/project-detail?id=${p._id}`)}>
                                <View style={styles.listCardTop}>
                                    <Text style={[styles.listCardTitle, { color: theme.text }]}>{p.name}</Text>
                                    <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
                                </View>
                                <Text style={[styles.listCardSub, { color: theme.textLight }]}>{lv(p.category)}</Text>
                            </TouchableOpacity>
                        ))}

                        {activeTab === "inventory" && inventory.map((inv, i) => (
                            <View key={i} style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={styles.listCardTop}>
                                    <Text style={[styles.listCardTitle, { color: theme.text }]}>Unit {inv.unitNo || inv.unitNumber}</Text>
                                    <View style={[styles.miniBadge, { backgroundColor: inv.status === 'Available' ? '#10B98120' : '#EF444420' }]}>
                                        <Text style={[styles.miniBadgeText, { color: inv.status === 'Available' ? '#10B981' : '#EF4444' }]}>{(inv.status || 'Available').toUpperCase()}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.listCardSub, { color: theme.textLight }]}>{inv.projectName}</Text>
                                <Text style={[styles.listCardPrice, { color: theme.text }]}>{formatCurrency(inv.price)}</Text>
                            </View>
                        ))}
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
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
    avatarBox: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 22, fontWeight: "800" },
    nameSection: { flex: 1 },
    heroName: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
    statusCapsule: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    statusCapsuleText: { fontSize: 11, fontWeight: "800" },
    subtitle: { fontSize: 13, fontWeight: "600", marginBottom: 20 },
    statsRow: { flexDirection: 'row', padding: 16, borderRadius: 20, justifyContent: 'space-between' },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { fontSize: 9, fontWeight: "800", marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: "800" },
    statDivider: { width: 1, height: '60%', alignSelf: 'center' },
    tabsRow: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, marginBottom: 20 },
    tabBtn: { paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontSize: 12, fontWeight: "800" },
    mainGrid: { paddingHorizontal: 20 },
    sectionCard: { padding: 20, borderRadius: 22, borderWidth: 1, marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 14, fontWeight: "600" },
    infoValue: { fontSize: 14, fontWeight: "700" },
    addressBox: { marginTop: 16, padding: 16, borderRadius: 16 },
    addressLabel: { fontSize: 10, fontWeight: "800", marginBottom: 8 },
    addressValue: { fontSize: 13, fontWeight: "600", lineHeight: 20 },
    listCard: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 12 },
    listCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    listCardTitle: { fontSize: 15, fontWeight: "800" },
    listCardSub: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
    listCardPrice: { fontSize: 14, fontWeight: "800" },
    miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    miniBadgeText: { fontSize: 10, fontWeight: "800" },
});
