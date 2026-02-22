import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";

const formatCurrency = (value: number) => {
    if (!value) return "₹0";
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
};

const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
};

export default function CompanyDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState<any>(null);
    const [stats, setStats] = useState({ projects: 0, inventory: 0, deals: 0, revenue: 0 });

    // Associated Data
    const [projects, setProjects] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);

    const [activeTab, setActiveTab] = useState("overview");

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/companies/${id}`);
            if (res.data?.success) {
                const compData = res.data.data;
                setCompany(compData);
                await fetchAssociatedData(compData._id);
            }
        } catch (error) {
            console.error("Failed to load company:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchAssociatedData = async (compId: string) => {
        try {
            // Projects
            const projRes = await api.get(`/projects`, { params: { developerId: compId } });
            const projs = projRes.data?.data || [];
            setProjects(projs);

            // Deals & Inventory
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

            setStats({
                projects: projs.length,
                inventory: fetchedInv.length,
                deals: fetchedDeals.length,
                revenue: rev
            });
        } catch (err) {
            console.error("Error fetching associated data:", err);
        }
    };

    useEffect(() => {
        if (id) fetchDetails();
    }, [id, fetchDetails]);

    if (loading) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Syncing Enterprise Profile...</Text>
            </SafeAreaView>
        );
    }

    if (!company) {
        return (
            <SafeAreaView style={styles.center}>
                <Text style={styles.errorText}>Company not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <TouchableOpacity
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/(tabs)/companies");
                        }
                    }}
                    style={styles.iconBtn}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    <Ionicons name="arrow-back" size={24} color="#64748b" />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.title} numberOfLines={1}>{company.name}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{company.companyType?.name || company.companyType?.lookup_value || "Company"}</Text>
                    </View>
                </View>
            </View>
            <Text style={styles.subtitle}>
                {company.industry?.lookup_value || "Industry"} • GST: {company.gstNumber || "N/A"}
            </Text>

            {/* Stats Row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Projects</Text>
                    <Text style={styles.statValue}>{stats.projects}</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Inventory</Text>
                    <Text style={styles.statValue}>{stats.inventory}</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Deals</Text>
                    <Text style={styles.statValue}>{stats.deals}</Text>
                </View>
                <View style={[styles.statBox, { borderRightWidth: 0 }]}>
                    <Text style={styles.statLabel}>Revenue</Text>
                    <Text style={[styles.statValue, { color: "#10b981" }]}>{formatCurrency(stats.revenue)}</Text>
                </View>
            </ScrollView>
        </View>
    );

    const renderTabs = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
            {["overview", "deals", "projects", "inventory", "employees"].map((tab) => (
                <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab)}
                >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderOverview = () => (
        <View style={styles.content}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Company Overview</Text>
                <View style={styles.grid}>
                    <DetailItem label="Primary Phone" value={company.phones?.[0] ? `${company.phones[0].phoneCode} ${company.phones[0].phoneNumber}` : "N/A"} />
                    <DetailItem label="Primary Email" value={company.emails?.[0]?.address || "N/A"} />
                    <DetailItem label="Industry" value={company.industry?.lookup_value || "N/A"} />
                    <DetailItem label="Source" value={company.source?.lookup_value || "N/A"} />
                    <DetailItem label="Assigned To" value={company.owner?.fullName || company.owner?.name || "Unassigned"} />
                    <DetailItem label="Team" value={company.team || "Sales"} />
                </View>
                <View style={styles.fullWidthItem}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{company.description || "No description provided."}</Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Primary Address</Text>
                <View style={styles.grid}>
                    <DetailItem label="Address" value={`${company.addresses?.registeredOffice?.hNo || ""} ${company.addresses?.registeredOffice?.street || ""}`.trim() || 'N/A'} />
                    <DetailItem label="City" value={company.addresses?.registeredOffice?.city?.lookup_value || "N/A"} />
                    <DetailItem label="State" value={company.addresses?.registeredOffice?.state?.lookup_value || "N/A"} />
                    <DetailItem label="Pin Code" value={company.addresses?.registeredOffice?.pinCode || "N/A"} />
                </View>
            </View>

            {/* Other Offices */}
            {company.addresses?.branchOffice?.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Branch Offices</Text>
                    {company.addresses.branchOffice.map((addr: any, idx: number) => (
                        <View key={idx} style={[styles.grid, { marginTop: idx > 0 ? 12 : 0, paddingTop: idx > 0 ? 12 : 0, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: "#e2e8f0" }]}>
                            <DetailItem label="Address" value={`${addr.hNo || ""} ${addr.street || ""}`.trim() || 'N/A'} />
                            <DetailItem label="City" value={addr.city?.lookup_value || "N/A"} />
                        </View>
                    ))}
                </View>
            )}

            {company.addresses?.siteOffice?.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Site Offices</Text>
                    {company.addresses.siteOffice.map((addr: any, idx: number) => (
                        <View key={idx} style={[styles.grid, { marginTop: idx > 0 ? 12 : 0, paddingTop: idx > 0 ? 12 : 0, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: "#e2e8f0" }]}>
                            <DetailItem label="Address" value={`${addr.hNo || ""} ${addr.street || ""}`.trim() || 'N/A'} />
                            <DetailItem label="City" value={addr.city?.lookup_value || "N/A"} />
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Relationship & Commission</Text>
                <View style={styles.grid}>
                    <DetailItem label="Relationship Type" value={company.relationshipType || "Other"} color="#3b82f6" />
                    <DetailItem label="Commission Agreement" value={company.commissionAgreementStatus || "Draft"} />
                    <DetailItem label="Preferred Partner" value={company.isPreferredPartner ? "Yes" : "No"} />
                    <DetailItem label="Outstanding" value={formatCurrency(company.outstandingAmount)} color="#ef4444" />
                </View>
            </View>
        </View>
    );

    const renderDeals = () => (
        <View style={styles.content}>
            <Text style={styles.sectionHeading}>Deal Performance</Text>
            {deals.map((d, i) => (
                <View key={i} style={styles.listCard}>
                    <View style={styles.listCardRow}>
                        <Text style={styles.listCardTitle}>Deal #{d._id?.substring(d._id.length - 6).toUpperCase()}</Text>
                        <Text style={[styles.listCardBadge, { backgroundColor: d.stage === 'Closed' ? '#dcfce7' : '#e0e7ff', color: d.stage === 'Closed' ? '#166534' : '#3730a3' }]}>{d.stage}</Text>
                    </View>
                    <Text style={styles.listCardSubtitle}>{d.projectName?.name || "Project"}</Text>
                    <Text style={styles.listCardPrice}>{formatCurrency(d.price)}</Text>
                </View>
            ))}
            {deals.length === 0 && <Text style={styles.emptyText}>No deals linked.</Text>}
        </View>
    );

    const renderProjects = () => (
        <View style={styles.content}>
            <Text style={styles.sectionHeading}>Linked Projects</Text>
            {projects.map((p, i) => (
                <View key={i} style={styles.listCard}>
                    <View style={styles.listCardRow}>
                        <Text style={styles.listCardTitle}>{p.name}</Text>
                        <Text style={[styles.listCardBadge, { backgroundColor: '#ecfdf5', color: '#065f46' }]}>{p.status || 'Active'}</Text>
                    </View>
                    <Text style={styles.listCardSubtitle}>{p.address?.locality || p.address?.area || 'Location N/A'}</Text>
                </View>
            ))}
            {projects.length === 0 && <Text style={styles.emptyText}>No projects linked.</Text>}
        </View>
    );

    const renderInventory = () => (
        <View style={styles.content}>
            <Text style={styles.sectionHeading}>Linked Inventory</Text>
            {inventory.map((inv, i) => (
                <View key={i} style={styles.listCard}>
                    <View style={styles.listCardRow}>
                        <Text style={styles.listCardTitle}>Unit {inv.unitNo || inv.unitNumber}</Text>
                        <Text style={[styles.listCardBadge, { backgroundColor: inv.status === 'Available' ? '#dcfce7' : '#fee2e2', color: inv.status === 'Available' ? '#166534' : '#991b1b' }]}>{inv.status}</Text>
                    </View>
                    <Text style={styles.listCardSubtitle}>{inv.projectName}</Text>
                    <Text style={styles.listCardPrice}>{formatCurrency(inv.price)}</Text>
                </View>
            ))}
            {inventory.length === 0 && <Text style={styles.emptyText}>No inventory linked.</Text>}
        </View>
    );

    const renderEmployees = () => (
        <View style={styles.content}>
            <Text style={styles.sectionHeading}>Employees & Signatories</Text>
            {company.employees?.map((emp: any, i: number) => (
                <View key={i} style={styles.employeeCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(emp.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.employeeName}>{emp.name} {emp.surname}</Text>
                        <Text style={styles.employeeRole}>{emp.designation || 'Contact Person'}</Text>
                        <Text style={styles.employeePhone}>{emp.phones?.[0]?.phoneNumber || 'No Phone'}</Text>
                    </View>
                </View>
            ))}
            {(!company.employees || company.employees.length === 0) && <Text style={styles.emptyText}>No employees linked.</Text>}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {renderHeader()}
            {renderTabs()}
            <ScrollView style={{ flex: 1 }}>
                {activeTab === "overview" && renderOverview()}
                {activeTab === "deals" && renderDeals()}
                {activeTab === "projects" && renderProjects()}
                {activeTab === "inventory" && renderInventory()}
                {activeTab === "employees" && renderEmployees()}
            </ScrollView>
        </SafeAreaView>
    );
}

const DetailItem = ({ label, value, color }: { label: string, value: any, color?: string }) => (
    <View style={styles.detailItem}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, color ? { color } : null]} numberOfLines={2}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f8fafc" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
    loadingText: { marginTop: 12, fontSize: 16, fontWeight: "600", color: "#64748b" },
    errorText: { fontSize: 16, color: "#ef4444", marginBottom: 16 },
    backBtnWrapper: { padding: 12, backgroundColor: "#e2e8f0", borderRadius: 8 },
    backBtnText: { color: "#334155", fontWeight: "600" },

    header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 16, paddingTop: Platform.OS === 'android' ? 40 : 0 },
    headerTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
    iconBtn: { width: 40, height: 40, justifyContent: "center" },
    iconText: { fontSize: 24, color: "#64748b" },
    headerTitleWrap: { flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 8 },
    title: { fontSize: 20, fontWeight: "bold", color: "#0f172a", marginRight: 8, flexShrink: 1 },
    badge: { backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    badgeText: { fontSize: 10, fontWeight: "bold", color: "#475569", textTransform: "uppercase" },
    subtitle: { paddingHorizontal: 24, paddingLeft: 64, fontSize: 13, color: "#64748b", marginTop: -4 },

    statsScroll: { marginTop: 20, paddingHorizontal: 16 },
    statBox: { paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: "#e2e8f0", minWidth: 90 },
    statLabel: { fontSize: 10, fontWeight: "bold", color: "#64748b", textTransform: "uppercase", marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: "bold", color: "#0f172a" },

    tabsContainer: { backgroundColor: "#fff", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", maxHeight: 48 },
    tab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabActive: { borderBottomColor: "#3b82f6" },
    tabText: { fontSize: 14, fontWeight: "bold", color: "#64748b" },
    tabTextActive: { color: "#3b82f6" },

    content: { padding: 16, paddingBottom: 80 },
    card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
    cardTitle: { fontSize: 14, fontWeight: "bold", color: "#1e293b", marginBottom: 16, textTransform: "uppercase" },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

    detailItem: { width: "48%", marginBottom: 16 },
    fullWidthItem: { width: "100%", marginTop: 8 },
    detailLabel: { fontSize: 11, fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 },
    detailValue: { fontSize: 14, fontWeight: "600", color: "#1e293b" },

    sectionHeading: { fontSize: 14, fontWeight: "bold", color: "#1e293b", marginBottom: 12, textTransform: "uppercase", paddingLeft: 4 },
    listCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
    listCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    listCardTitle: { fontSize: 15, fontWeight: "bold", color: "#1e293b" },
    listCardSubtitle: { fontSize: 13, color: "#64748b", marginBottom: 4 },
    listCardPrice: { fontSize: 14, fontWeight: "bold", color: "#0f172a", marginTop: 4 },
    listCardBadge: { fontSize: 10, fontWeight: "bold", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },

    employeeCard: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginRight: 12 },
    avatarText: { fontSize: 14, fontWeight: "bold", color: "#475569" },
    employeeName: { fontSize: 15, fontWeight: "bold", color: "#1e293b" },
    employeeRole: { fontSize: 12, color: "#64748b", marginTop: 2 },
    employeePhone: { fontSize: 13, color: "#3b82f6", fontWeight: "600", marginTop: 4 },

    emptyText: { textAlign: "center", color: "#94a3b8", padding: 32, fontSize: 14 }
});
