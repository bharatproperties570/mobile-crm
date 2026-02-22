import { useEffect, useState, useCallback, useMemo } from "react";
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    RefreshControl, ActivityIndicator, Dimensions
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDepartment } from "../context/DepartmentContext";
import api from "../services/api";
import { getActivities } from "../services/activities.service";
import { getDashboardStats, DashboardStats } from "../services/dashboard.service";
import { extractTotal } from "../services/api.helpers";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function KPICard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
    return (
        <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: color + "15" }]}>
                <Ionicons name={icon as any} size={24} color={color} />
            </View>
            <View>
                <Text style={styles.kpiValue}>{value}</Text>
                <Text style={styles.kpiLabel}>{label}</Text>
            </View>
        </View>
    );
}

export default function MissionControlScreen() {
    const { currentDept, config } = useDepartment();
    const router = useRouter();
    const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
    const [stats, setStats] = useState<any>({});
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [l, d, p, i, co, b, a, ds] = await Promise.allSettled([
                api.get("/leads"),
                api.get("/deals"),
                api.get("/projects"),
                api.get("/inventory"),
                api.get("/companies"),
                api.get("/bookings"),
                getActivities({ status: 'Pending', limit: 3 }),
                getDashboardStats()
            ]);

            const getCount = (res: PromiseSettledResult<any>) => (res.status === "fulfilled" ? extractTotal(res.value) : 0);

            setStats({
                leads: getCount(l),
                deals: getCount(d),
                projects: getCount(p),
                inventory: getCount(i),
                companies: getCount(co),
                bookings: getCount(b),
            });

            if (a.status === "fulfilled") {
                const actData = a.value?.data ?? a.value?.records ?? [];
                setActivities(Array.isArray(actData) ? actData : []);
            }

            if (ds.status === "fulfilled" && ds.value.data) {
                setDashboardData(ds.value.data);
            }
        } catch (e) {
            console.error("Mission Control fetch error:", e);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const renderSalesDashboard = () => (
        <View>
            {/* Activity Monitor */}
            <View style={styles.monitorContainer}>
                <Text style={styles.sectionHeader}>Activity Monitor</Text>
                <View style={styles.monitorGrid}>
                    <TouchableOpacity style={[styles.monitorTile, { borderColor: "#FEE2E2" }]} onPress={() => router.push({ pathname: "/(tabs)/activities", params: { filter: "Overdue" } })}>
                        <Text style={[styles.monitorValue, { color: "#EF4444" }]}>{dashboardData?.activities?.overdue || 0}</Text>
                        <Text style={styles.monitorLabel}>Overdue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.monitorTile, { borderColor: "#FEF3C7" }]} onPress={() => router.push({ pathname: "/(tabs)/activities", params: { filter: "Today" } })}>
                        <Text style={[styles.monitorValue, { color: "#F59E0B" }]}>{dashboardData?.activities?.today || 0}</Text>
                        <Text style={styles.monitorLabel}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.monitorTile, { borderColor: "#E0E7FF" }]} onPress={() => router.push({ pathname: "/(tabs)/activities", params: { filter: "Upcoming" } })}>
                        <Text style={[styles.monitorValue, { color: "#6366F1" }]}>{dashboardData?.activities?.upcoming || 0}</Text>
                        <Text style={styles.monitorLabel}>Upcoming</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Pipeline Stages */}
            <View style={styles.pipelineContainer}>
                <View style={styles.pipeHeaderRow}>
                    <Text style={styles.sectionHeader}>Lead Pipeline</Text>
                    <Text style={styles.pipeTotal}>Total: {stats.leads || 0}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pipeScroll}>
                    {dashboardData?.leads?.map((item, idx) => (
                        <View key={idx} style={styles.pipeStage}>
                            <Text style={styles.pipeVal}>{item.count}</Text>
                            <Text style={styles.pipeLab}>{item.status}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.pipelineContainer}>
                <View style={styles.pipeHeaderRow}>
                    <Text style={styles.sectionHeader}>Deal Funnel</Text>
                    <Text style={styles.pipeTotal}>Active: {stats.deals || 0}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pipeScroll}>
                    {dashboardData?.deals?.map((item, idx) => (
                        <View key={idx} style={[styles.pipeStage, { backgroundColor: "#ECFDF5" }]}>
                            <Text style={[styles.pipeVal, { color: "#059669" }]}>{item.count}</Text>
                            <Text style={styles.pipeLab}>{item.stage}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#2563EB" }]} onPress={() => router.push("/add-lead")}>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>New Lead Entry</Text>
            </TouchableOpacity>
        </View>
    );

    const renderInventoryDashboard = () => (
        <View>
            <View style={styles.grid}>
                <KPICard label="Total Units" value={stats.inventory || 0} icon="cube" color="#3B82F6" />
                <KPICard label="Partners" value={stats.companies || 0} icon="people" color="#10B981" />
                <KPICard label="Bookings" value={stats.bookings || 0} icon="document-text" color="#F59E0B" />
                <KPICard label="Available" value="85%" icon="checkmark-circle" color="#8B5CF6" />
            </View>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#F59E0B" }]} onPress={() => router.push("/add-project")}>
                <Ionicons name="business" size={24} color="#fff" />
                <Text style={styles.actionBtnText}>Add New Project</Text>
            </TouchableOpacity>
        </View>
    );

    const renderPostSalesDashboard = () => (
        <View>
            <View style={styles.grid}>
                <KPICard label="Bookings" value={stats.bookings || 0} icon="document-text" color="#10B981" />
                <KPICard label="Total Value" value="₹12.5Cr" icon="wallet" color="#8B5CF6" />
                <KPICard label="Pending Reg." value="12" icon="time" color="#F59E0B" />
                <KPICard label="Agreements" value="45" icon="create" color="#3B82F6" />
            </View>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#10B981" }]} onPress={() => router.push("/bookings")}>
                <Ionicons name="receipt" size={24} color="#fff" />
                <Text style={styles.actionBtnText}>Manage Financials</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={config.color} />}
        >
            {/* Mission Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.missionLabel}>Mission Control</Text>
                    <Text style={styles.deptName}>{currentDept} Personality</Text>
                </View>
                <View style={[styles.statusPulse, { backgroundColor: config.color }]} />
            </View>

            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color={config.color} style={{ marginTop: 60 }} />
                ) : (
                    <>
                        {currentDept === 'Sales' && renderSalesDashboard()}
                        {currentDept === 'Inventory' && renderInventoryDashboard()}
                        {currentDept === 'Post-Sales' && renderPostSalesDashboard()}
                    </>
                )}

                {/* Shared Activities */}
                <View style={styles.activityBox}>
                    <Text style={styles.sectionTitle}>Command Log (Recent Events)</Text>
                    {activities.length > 0 ? (
                        activities.map((act) => (
                            <TouchableOpacity key={act._id} style={styles.logRow} onPress={() => router.push(`/activity/${act._id}`)}>
                                <View style={[styles.logIndicator, { backgroundColor: config.color }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.logSubject} numberOfLines={1}>{act.subject}</Text>
                                    <Text style={styles.logTime}>{act.dueTime} • {new Date(act.dueDate).toLocaleDateString()}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>Standing by... No logs reported.</Text>
                    )}
                </View>

                {/* System Message */}
                <View style={styles.systemNote}>
                    <Text style={styles.systemNoteText}>
                        💡 System morphing active. Current terminal optimized for {currentDept} workflow.
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24,
        backgroundColor: "#fff", flexDirection: "row", justifyContent: "space-between", alignItems: "center"
    },
    missionLabel: { fontSize: 11, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2 },
    deptName: { fontSize: 24, fontWeight: "900", color: "#1E293B", letterSpacing: -1 },
    statusPulse: { width: 12, height: 12, borderRadius: 6, shadowOpacity: 0.5, shadowRadius: 5 },
    content: { padding: 16 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
    kpiCard: {
        width: (SCREEN_WIDTH - 44) / 2, backgroundColor: "#fff", padding: 16, borderRadius: 24,
        flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    kpiIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    kpiValue: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    kpiLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginTop: 1 },
    actionBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        padding: 20, borderRadius: 24, marginBottom: 30,
        shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 10 }
    },
    actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.5 },
    activityBox: { backgroundColor: "#fff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#F1F5F9" },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: "#94A3B8", marginBottom: 16, textTransform: "uppercase" },
    logRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F8FAFC", gap: 12 },
    logIndicator: { width: 4, height: 20, borderRadius: 2 },
    logSubject: { fontSize: 14, fontWeight: "700", color: "#334155" },
    logTime: { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
    emptyText: { textAlign: "center", color: "#CBD5E1", fontSize: 13, marginVertical: 20 },
    systemNote: { marginTop: 30, padding: 20, backgroundColor: "#EEF2FF", borderRadius: 16 },
    systemNoteText: { fontSize: 12, color: "#4F46E5", fontWeight: "600", textAlign: "center", lineHeight: 18 },

    // New Dashboard 2.0 Styles
    monitorContainer: { marginBottom: 20 },
    sectionHeader: { fontSize: 13, fontWeight: "900", color: "#64748B", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
    monitorGrid: { flexDirection: "row", gap: 10 },
    monitorTile: {
        flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: 16, borderLeftWidth: 4,
        shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }
    },
    monitorValue: { fontSize: 20, fontWeight: "900", marginBottom: 2 },
    monitorLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
    pipelineContainer: { marginBottom: 24, backgroundColor: "#fff", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9" },
    pipeHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    pipeTotal: { fontSize: 12, fontWeight: "700", color: "#64748B" },
    pipeScroll: { gap: 12, paddingRight: 10 },
    pipeStage: {
        backgroundColor: "#F0F9FF", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
        minWidth: 90, alignItems: "center"
    },
    pipeVal: { fontSize: 18, fontWeight: "900", color: "#0284C7" },
    pipeLab: { fontSize: 10, fontWeight: "700", color: "#64748B", marginTop: 2 },
});
