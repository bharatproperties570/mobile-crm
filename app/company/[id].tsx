import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Platform, Animated, Dimensions, Alert, Linking } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS = ["Overview", "Address", "Employees", "Deals", "Inventory", "Projects"];

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
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState<any>(null);
    const [stats, setStats] = useState({ projects: 0, inventory: 0, deals: 0, revenue: 0 });
    const [activeTab, setActiveTab] = useState(0);

    const [projects, setProjects] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);

    const scrollX = useRef(new Animated.Value(0)).current;
    const tabScrollViewRef = useRef<ScrollView>(null);
    const contentScrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchAssociatedData = async (comp: any) => {
        try {
            const compId = comp._id;
            // 1. Use explicitly linked employees from company data
            const emps = comp.employees || [];
            setEmployees(emps);

            // 2. Fetch Projects developed by this company
            const projRes = await api.get(`/projects`, { params: { developerId: compId } });
            const projs = projRes.data?.data || [];
            setProjects(projs);

            // 3. Aggregate Deal & Inventory data
            // We search for items where ANY of these IDs are listed as owners/associates:
            // [companyId, employeeId1, employeeId2, ...]
            const allLinkIds = emps.map((e: any) => e._id);
            const linkIdStr = allLinkIds.join(',');

            if (allLinkIds.length === 0) {
                setDeals([]);
                setInventory([]);
                setStats({ projects: projs.length, inventory: 0, deals: 0, revenue: 0 });
                return;
            }

            // Fetch deals and inventory using these IDs
            // Note: The backend search param for owners/associates might vary, but usually 'ownerId' or similar
            // For now, we fetch by projecting project IDs if any, OR by searching company/employee links directly if supported.
            // Since the user specificied aggregation based on "add owner form" selection:
            const [dRes, iRes] = await Promise.all([
                api.get(`/deals`, { params: { contactId: linkIdStr, limit: '200' } }),
                api.get(`/inventory`, { params: { contactId: linkIdStr, limit: '200' } })
            ]);

            const fetchedDeals = dRes.data?.records || [];
            const fetchedInv = iRes.data?.records || iRes.data?.data || [];

            setDeals(fetchedDeals);
            setInventory(fetchedInv);

            const rev = fetchedDeals.filter((d: any) => d.stage === 'Closed').reduce((acc: number, curr: any) => acc + (curr.price || curr.amount || 0), 0);
            setStats({ projects: projs.length, inventory: fetchedInv.length, deals: fetchedDeals.length, revenue: rev });
        } catch (err) {
            console.error("Aggregation error:", err);
        }
    };

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await api.get(`/companies/${id}`);
            if (res.data?.success) {
                const compData = res.data.data;
                setCompany(compData);
                await fetchAssociatedData(compData);
                Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
            }
        } catch (error) {
            console.error("Failed to load company:", error);
            Alert.alert("Error", "Could not load company details");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

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

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!company) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={[styles.noData, { color: theme.textLight }]}>Company not found</Text></View>;

    const primaryPhone = company.phones?.[0]?.phoneNumber || company.authorizedSignatory?.mobile;
    const primaryEmail = company.emails?.[0]?.address || company.authorizedSignatory?.email;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <SafeAreaView style={[styles.headerCard, { backgroundColor: theme.card }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCircle}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerNamePremium, { color: theme.text }]} numberOfLines={1}>{company.name}</Text>
                        <View style={styles.headerBadgeRow}>
                            <View style={[styles.miniBadge, { backgroundColor: theme.primary + '15' }]}>
                                <Text style={[styles.miniBadgeText, { color: theme.primary }]}>{lv(company.companyType).toUpperCase()}</Text>
                            </View>
                            <View style={[styles.miniBadge, { backgroundColor: theme.success + '15' }]}>
                                <Text style={[styles.miniBadgeText, { color: theme.success }]}>{lv(company.industry).toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Professional Action Hub */}
                <View style={styles.modernActionHub}>
                    {[
                        { icon: 'call', color: theme.primary, onPress: () => primaryPhone ? Linking.openURL(`tel:${primaryPhone}`) : Alert.alert("No Phone", "No contact number available") },
                        { icon: 'chatbox-ellipses', color: '#8B5CF6', onPress: () => primaryPhone ? Linking.openURL(`sms:${primaryPhone}`) : Alert.alert("No Phone", "No contact number available") },
                        { icon: 'logo-whatsapp', color: '#10B981', onPress: () => primaryPhone ? Linking.openURL(`https://wa.me/${primaryPhone.replace(/\D/g, '')}`) : Alert.alert("No WhatsApp", "No mobile number available") },
                        { icon: 'mail', color: '#F59E0B', onPress: () => primaryEmail ? Linking.openURL(`mailto:${primaryEmail}`) : Alert.alert("No Email", "No email address available") },
                        { icon: 'calendar', color: '#EC4899', onPress: () => router.push(`/add-activity?id=${id}&type=Company`) },
                    ].map((action, i) => (
                        <TouchableOpacity key={i} style={[styles.modernHubBtn, { backgroundColor: action.color }]} onPress={action.onPress}>
                            <Ionicons name={action.icon as any} size={20} color={"#fff"} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Information Strategy Bar */}
                <View style={[styles.strategyBar, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
                    <View style={styles.strategyBlock}>
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>ASSIGNED TO</Text>
                        <View style={styles.strategyValueRow}>
                            <Ionicons name="person-circle" size={14} color={theme.primary} />
                            <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                {lv(company.owner)}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.strategyDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.strategyBlock}>
                        <Text style={[styles.strategyLabel, { color: theme.textLight }]}>TEAM</Text>
                        <View style={styles.strategyValueRow}>
                            <Ionicons name="people-circle" size={14} color="#6366F1" />
                            <Text style={[styles.strategyValue, { color: theme.text }]} numberOfLines={1}>
                                {lv(company.team)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Tabs Selector */}
                <View style={styles.tabsContainer}>
                    <ScrollView
                        ref={tabScrollViewRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabsScroll}
                    >
                        {TABS.map((tab, index) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabItem, activeTab === index && { borderBottomColor: theme.primary }]}
                                onPress={() => onTabPress(index)}
                            >
                                <Text style={[styles.tabLabel, { color: activeTab === index ? theme.text : theme.textLight }]}>{tab.toUpperCase()}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </SafeAreaView>

            <Animated.ScrollView
                ref={contentScrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                style={{ flex: 1 }}
            >
                {/* 1. Overview */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        {/* Stats Summary */}
                        <View style={[styles.statsSummaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.statSummaryItem}>
                                <Text style={[styles.statSummaryValue, { color: theme.text }]}>{stats.projects}</Text>
                                <Text style={[styles.statSummaryLabel, { color: theme.textLight }]}>PROJECTS</Text>
                            </View>
                            <View style={[styles.vDivider, { backgroundColor: theme.border }]} />
                            <View style={styles.statSummaryItem}>
                                <Text style={[styles.statSummaryValue, { color: theme.success }]}>{formatCurrency(stats.revenue)}</Text>
                                <Text style={[styles.statSummaryLabel, { color: theme.textLight }]}>REVENUE</Text>
                            </View>
                            <View style={[styles.vDivider, { backgroundColor: theme.border }]} />
                            <View style={styles.statSummaryItem}>
                                <Text style={[styles.statSummaryValue, { color: theme.text }]}>{stats.deals}</Text>
                                <Text style={[styles.statSummaryLabel, { color: theme.textLight }]}>DEALS</Text>
                            </View>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Corporate Identity</Text>
                            <InfoRow label="Industry" value={lv(company.industry)} icon="business-outline" />
                            <InfoRow label="Sub-Category" value={lv(company.companySubCategory)} icon="list-outline" />
                            <InfoRow label="Primary Phone" value={company.phones?.[0]?.phoneNumber} icon="call-outline" accent />
                            <InfoRow label="Primary Email" value={company.emails?.[0]?.address} icon="mail-outline" />
                            <InfoRow label="PAN Number" value={company.panNumber} icon="card-outline" />
                            <InfoRow label="GST Number" value={company.gstNumber} icon="receipt-outline" />
                            <InfoRow label="CIN Number" value={company.cinNumber} icon="finger-print-outline" />
                            <InfoRow label="Website" value={company.website} icon="globe-outline" />
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Relationship Overview</Text>
                            <InfoRow label="Source" value={lv(company.source)} icon="share-social-outline" />
                            <InfoRow label="Preferred Partner" value={company.isPreferredPartner ? "Yes" : "No"} icon="star-outline" />
                        </View>

                        {company.authorizedSignatory && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Authorized Signatory</Text>
                                <InfoRow label="Name" value={company.authorizedSignatory.name} icon="person-circle-outline" accent />
                                <InfoRow label="Mobile" value={company.authorizedSignatory.mobile} icon="call-outline" />
                                <InfoRow label="Email" value={company.authorizedSignatory.email} icon="mail-outline" />
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* 2. Address */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Registered Office</Text>
                            <View style={styles.addressContainer}>
                                <Ionicons name="location-outline" size={20} color={theme.primary} />
                                <Text style={[styles.addressText, { color: theme.text }]}>
                                    {company.addresses?.registeredOffice?.hNo} {company.addresses?.registeredOffice?.street}
                                    {company.addresses?.registeredOffice?.area ? `, ${company.addresses?.registeredOffice?.area}` : ""}
                                    {"\n"}{lv(company.addresses?.registeredOffice?.city)}, {lv(company.addresses?.registeredOffice?.state)}
                                    {company.addresses?.registeredOffice?.pincode ? ` - ${company.addresses?.registeredOffice?.pincode}` : ""}
                                    {company.addresses?.registeredOffice?.country ? `\n${lv(company.addresses?.registeredOffice?.country)}` : ""}
                                </Text>
                            </View>
                        </View>
                        {company.addresses?.branchOffice && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Branch Office</Text>
                                <View style={styles.addressContainer}>
                                    <Ionicons name="location-outline" size={20} color={theme.primary} />
                                    <Text style={[styles.addressText, { color: theme.text }]}>
                                        {company.addresses?.branchOffice?.hNo} {company.addresses?.branchOffice?.street}
                                        {company.addresses?.branchOffice?.area ? `, ${company.addresses?.branchOffice?.area}` : ""}
                                        {"\n"}{lv(company.addresses?.branchOffice?.city)}, {lv(company.addresses?.branchOffice?.state)}
                                        {company.addresses?.branchOffice?.pincode ? ` - ${company.addresses?.branchOffice?.pincode}` : ""}
                                        {company.addresses?.branchOffice?.country ? `\n${lv(company.addresses?.branchOffice?.country)}` : ""}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* 3. Employees */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Employees / Key Contacts</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={[styles.miniBadge, { backgroundColor: theme.primary + '15' }]}>
                                        <Text style={[styles.miniBadgeText, { color: theme.primary }]}>{employees.length}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={{ backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                                        onPress={() => router.push(`/add-employee?companyId=${id}`)}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>ADD EMPLOYEE</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {employees.length === 0 ? (
                                <Text style={[styles.emptyText, { fontSize: 13, marginTop: 10 }]}>No employees linked to this company.</Text>
                            ) : (
                                <View style={{ marginTop: 15 }}>
                                    {employees.map((emp, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[styles.partyCard, { backgroundColor: theme.background }]}
                                            onPress={() => router.push(`/contact-detail?id=${emp._id}`)}
                                        >
                                            <View style={styles.matchLeft}>
                                                <View style={[styles.avatarMini, { backgroundColor: theme.primary + '10' }]}>
                                                    <Text style={[styles.avatarMiniText, { color: theme.primary }]}>{getInitials(emp.name || emp.fullName)}</Text>
                                                </View>
                                                <View>
                                                    <Text style={[styles.matchUnit, { color: theme.text }]}>{emp.name || emp.fullName}</Text>
                                                    <Text style={[styles.matchProject, { color: theme.textLight }]}>
                                                        {lv(emp.designation) !== "—" ? lv(emp.designation) : "Employee"}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* 4. Deals */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        {deals.length === 0 ? (
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>No deals found for this developer.</Text>
                        ) : (
                            deals.map((d, i) => (
                                <View key={i} style={[styles.listItemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <View style={styles.listItemHeader}>
                                        <Text style={[styles.listItemTitle, { color: theme.text }]}>Deal #{d._id?.substring(d._id.length - 6).toUpperCase()}</Text>
                                        <View style={[styles.miniBadge, { backgroundColor: d.stage === 'Closed' ? theme.success + '20' : theme.primary + '20' }]}>
                                            <Text style={[styles.miniBadgeText, { color: d.stage === 'Closed' ? theme.success : theme.primary }]}>{(d.stage || 'Pending').toUpperCase()}</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.listItemSub, { color: theme.textLight }]}>{d.projectName?.name || "Project"}</Text>
                                    <Text style={[styles.listItemPrice, { color: theme.primary }]}>{formatCurrency(d.price)}</Text>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>

                {/* 5. Inventory */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        {inventory.length === 0 ? (
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>No inventory recorded.</Text>
                        ) : (
                            inventory.map((inv, i) => (
                                <View key={i} style={[styles.listItemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <View style={styles.listItemHeader}>
                                        <Text style={[styles.listItemTitle, { color: theme.text }]}>Unit {inv.unitNo || inv.unitNumber}</Text>
                                        <View style={[styles.miniBadge, { backgroundColor: inv.status === 'Available' ? theme.success + '20' : theme.danger + '20' }]}>
                                            <Text style={[styles.miniBadgeText, { color: inv.status === 'Available' ? theme.success : theme.danger }]}>{(inv.status || 'Available').toUpperCase()}</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.listItemSub, { color: theme.textLight }]}>{inv.projectName}</Text>
                                    <Text style={[styles.listItemPrice, { color: theme.primary }]}>{formatCurrency(inv.price)}</Text>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>

                {/* 6. Projects */}
                <View style={styles.tabContent}>
                    <ScrollView contentContainerStyle={styles.innerScroll}>
                        {projects.length === 0 ? (
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>No projects listed.</Text>
                        ) : (
                            projects.map((p, i) => (
                                <TouchableOpacity key={i} style={[styles.listItemCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/project-detail?id=${p._id}`)}>
                                    <View style={styles.listItemHeader}>
                                        <Text style={[styles.listItemTitle, { color: theme.text }]}>{p.name}</Text>
                                        <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
                                    </View>
                                    <Text style={[styles.listItemSub, { color: theme.textLight }]}>{lv(p.category)}</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                </View>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    headerCard: { paddingBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 5, zIndex: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 15 },
    backBtnCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
    headerTitleContainer: { flex: 1 },
    headerNamePremium: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    headerBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    miniBadgeText: { fontSize: 10, fontWeight: '800' },
    modernActionHub: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 15 },
    modernHubBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowOpacity: 0.3, shadowRadius: 10 },
    tabsContainer: { marginTop: 10 },
    tabsScroll: { paddingHorizontal: 20, gap: 25 },
    tabItem: { paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabLabel: { fontSize: 13, fontWeight: '800' },
    tabContent: { width: SCREEN_WIDTH },
    innerScroll: { padding: 20, paddingBottom: 100 },
    card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    infoLabel: { fontSize: 13, fontWeight: '600' },
    infoValue: { fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 10 },
    statsSummaryCard: { flexDirection: 'row', padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20, justifyContent: 'space-between', alignItems: 'center' },
    statSummaryItem: { flex: 1, alignItems: 'center' },
    statSummaryValue: { fontSize: 18, fontWeight: '900' },
    statSummaryLabel: { fontSize: 9, fontWeight: '800', marginTop: 4 },
    vDivider: { width: 1, height: '60%' },
    addressContainer: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 8 },
    addressText: { fontSize: 14, fontWeight: '600', lineHeight: 22, flex: 1 },
    listItemCard: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 12 },
    listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    listItemTitle: { fontSize: 15, fontWeight: '800' },
    listItemSub: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
    listItemPrice: { fontSize: 14, fontWeight: '800' },
    emptyText: { textAlign: 'center', padding: 30, fontSize: 14, fontWeight: '600', opacity: 0.6 },
    noData: { fontSize: 16, fontWeight: "600" },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    partyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 16, marginBottom: 8 },
    matchLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarMini: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    avatarMiniText: { fontSize: 12, fontWeight: '800' },
    matchUnit: { fontSize: 14, fontWeight: '800' },
    matchProject: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    strategyBar: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12, marginHorizontal: 20, marginBottom: 5 },
    strategyBlock: { flex: 1, paddingHorizontal: 10 },
    strategyDivider: { width: 1, height: '100%', opacity: 0.3 },
    strategyLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
    strategyValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    strategyValue: { fontSize: 13, fontWeight: '700' },
});
