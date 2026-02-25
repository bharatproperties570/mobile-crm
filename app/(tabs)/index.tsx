import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    RefreshControl, ActivityIndicator, Dimensions, Animated
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDepartment } from "../context/DepartmentContext";
import api from "../services/api";
import { getActivities } from "../services/activities.service";
import { getDashboardStats, DashboardStats } from "../services/dashboard.service";
import { extractTotal, lookupVal, extractList } from "../services/api.helpers";
import { useTheme, Colors } from "../context/ThemeContext";

function Counter({ value, style, prefix = "", suffix = "" }: { value: number; style?: any; prefix?: string; suffix?: string }) {
    const [displayValue, setDisplayValue] = useState(0);
    useEffect(() => {
        let start = 0;
        const end = value;
        if (start === end) return;
        let totalMilisecInterval = 1000;
        let stepTime = Math.abs(Math.floor(totalMilisecInterval / end));
        let timer = setInterval(() => {
            start += 1;
            setDisplayValue(start);
            if (start === end) clearInterval(timer);
        }, stepTime);
        return () => clearInterval(timer);
    }, [value]);
    return <Text style={style}>{prefix}{displayValue}{suffix}</Text>;
}

function ProgressRing({ progress, size = 80, strokeWidth = 8, color = "#2563EB" }: { progress: number; size?: number; strokeWidth?: number; color?: string }) {
    const { theme } = useTheme();
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth, borderColor: 'rgba(241, 245, 249, 0.5)',
                position: 'absolute'
            }} />
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: color,
                borderLeftColor: progress > 75 ? color : 'transparent',
                borderBottomColor: progress > 50 ? color : 'transparent',
                borderRightColor: progress > 25 ? color : 'transparent',
                borderTopColor: color,
                transform: [{ rotate: '-45deg' }]
            }} />
            <View style={[styles.ringInner, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.ringVal, { color: theme.text }]}>{Math.round(progress)}%</Text>
            </View>
        </View>
    );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PulseTile = memo(({ count, label, icon, color, bgColor, filter, router }: any) => {
    const { theme } = useTheme();
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (count > 0 && label === 'Overdue') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
                ])
            ).start();
        }
    }, [count, label]);

    return (
        <Animated.View style={{ flex: 1, transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
                style={[styles.monitorTile, { borderLeftColor: color, backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => router.push({ pathname: "/(tabs)/activities", params: { filter } })}
            >
                <View style={styles.monitorIconBoxCompact}>
                    <View style={[styles.monitorIconBox, { backgroundColor: theme.background === '#0F172A' ? color + '20' : bgColor }]}>
                        <Ionicons name={icon} size={14} color={color} />
                    </View>
                    <Counter value={count} style={[styles.monitorValueSmall, { color: theme.text }]} />
                </View>
                <Text style={[styles.monitorLabelCompact, { color: theme.textMuted }]}>{label}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
});

const CommandLogItem = memo(({ act, idx, config, router }: any) => {
    const { theme } = useTheme();
    const itemFade = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(itemFade, {
            toValue: 1,
            duration: 400,
            delay: idx * 100,
            useNativeDriver: true
        }).start();
    }, [idx]);

    return (
        <Animated.View style={{ opacity: itemFade, transform: [{ translateY: itemFade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <TouchableOpacity style={[styles.logRow, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/activity/${act._id}`)}>
                <View style={[styles.logIndicator, { backgroundColor: config.color, zIndex: 10 }]}>
                    <View style={styles.timelineDot} />
                </View>
                <View style={styles.timelineContent}>
                    <Text style={[styles.logSubject, { color: theme.text }]} numberOfLines={1}>{act.subject}</Text>
                    <Text style={[styles.logTime, { color: theme.textMuted }]}>{act.dueTime} • {new Date(act.dueDate).toLocaleDateString()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.textLight} />
            </TouchableOpacity>
        </Animated.View>
    );
});

const MiniDonut = memo(({ value, total, color = "#2563EB", size = 50 }: { value: number; total: number; color?: string; size?: number }) => {
    const { theme } = useTheme();
    const progress = (value / (total || 1)) * 100;
    const strokeWidth = 5;
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth, borderColor: 'rgba(241, 245, 249, 0.4)',
                position: 'absolute'
            }} />
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: color,
                borderLeftColor: progress > 75 ? color : 'transparent',
                borderBottomColor: progress > 50 ? color : 'transparent',
                borderRightColor: progress > 25 ? color : 'transparent',
                borderTopColor: color,
                transform: [{ rotate: '-45deg' }]
            }} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: theme.text, position: 'absolute' }}>{Math.round(progress)}%</Text>
        </View>
    );
});

function KPIItem({ label, value, icon, color, delay = 0, trend }: { label: string; value: number; icon: string; color: string; delay?: number; trend?: string }) {
    const { theme } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, delay, useNativeDriver: true })
        ]).start();
    }, []);

    return (
        <Animated.View style={[styles.kpiItem, { opacity: fadeAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.kpiCircle, { backgroundColor: color + "10" }]}>
                <Ionicons name={icon as any} size={18} color={color} />
            </View>
            <Counter value={value} style={[styles.kpiItemValue, { color: theme.text }]} />
            <Text style={[styles.kpiItemLabel, { color: theme.textMuted }]}>{label}</Text>
        </Animated.View>
    );
}

export default function MissionControlScreen() {
    const { currentDept, config } = useDepartment();
    const router = useRouter();
    const { theme } = useTheme();
    const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
    const [stats, setStats] = useState<any>({});
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lookups, setLookups] = useState<any[]>([]);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const rotateAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        try {
            const [l, d, p, i, co, b, a, ds, lu] = await Promise.allSettled([
                api.get("/leads"),
                api.get("/deals"),
                api.get("/projects"),
                api.get("/inventory"),
                api.get("/companies"),
                api.get("/bookings"),
                getActivities({ status: 'Pending', limit: 3 }),
                getDashboardStats(),
                api.get("/lookups")
            ]);

            const getCount = (res: PromiseSettledResult<any>) => (res.status === "fulfilled" ? extractTotal(res.value) : 0);
            const getRecords = (res: PromiseSettledResult<any>) => (res.status === "fulfilled" ? extractList(res.value) : []);

            if (lu.status === "fulfilled") {
                setLookups(extractList(lu.value));
            }

            setStats({
                leads: getCount(l),
                deals: getCount(d),
                projects: getCount(p),
                inventory: getCount(i),
                companies: getCount(co),
                bookings: getCount(b),
                rawProjects: getRecords(p),
                rawInventory: getRecords(i)
            });

            if (a.status === "fulfilled") {
                const actData = a.value?.data ?? a.value?.records ?? [];
                setActivities(Array.isArray(actData) ? actData : []);
            }

            if (ds.status === "fulfilled" && ds.value.data) {
                setDashboardData(ds.value.data);
            }

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true
            }).start();
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
            {/* 3. Activity Monitor (Urgency Based) */}
            <View style={styles.monitorContainer}>
                <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Activity Monitor</Text>
                <View style={styles.monitorGrid}>
                    <PulseTile count={dashboardData?.activities?.overdue || 0} label="Overdue" icon="time" color="#EF4444" bgColor="#FEE2E2" filter="Overdue" />
                    <PulseTile count={dashboardData?.activities?.today || 0} label="Today" icon="today" color="#F59E0B" bgColor="#FEF3C7" filter="Today" />
                    <PulseTile count={dashboardData?.activities?.upcoming || 0} label="Upcoming" icon="calendar" color="#6366F1" bgColor="#E0E7FF" filter="Upcoming" />
                </View>
            </View>

            {/* 4. Lead Pipeline Section (Visual) */}
            <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.pipeHeaderRow}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Lead Pipeline</Text>
                    <View style={[styles.pipeBadge, { backgroundColor: theme.background }]}><Text style={[styles.pipeBadgeText, { color: theme.textMuted }]}>{stats.leads || 0}</Text></View>
                </View>
                <View style={styles.segmentedPipeline}>
                    {(dashboardData?.leads || []).slice(0, 4).map((item, idx) => {
                        const total = stats.leads || 1;
                        const percent = (item.count / total) * 100;
                        const colors = ["#2563EB", "#3B82F6", "#60A5FA", "#10B981"];
                        return (
                            <View key={idx} style={{ flex: item.count || 1, minWidth: 20 }}>
                                <View style={styles.segHeader}>
                                    <Text style={[styles.segCount, { color: theme.text }]}>{item.count}</Text>
                                    <Text style={[styles.segLabel, { color: theme.textMuted }]} numberOfLines={1}>{item.status[0]}</Text>
                                </View>
                                <View style={[styles.segBar, { backgroundColor: colors[idx % colors.length] }]} />
                            </View>
                        );
                    })}
                </View>
                <View style={styles.segLabelsRow}>
                    {['New', 'Contacted', 'Qualified', 'Won'].map((s, i) => (
                        <Text key={i} style={[styles.segLabelMuted, { color: theme.textMuted }]}>{s}</Text>
                    ))}
                </View>
            </View>

            {/* 5. Deal Funnel Section */}
            <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.pipeHeaderRow}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Deal Funnel</Text>
                    <View style={[styles.pipeBadge, { backgroundColor: theme.background }]}><Text style={[styles.pipeBadgeText, { color: theme.textMuted }]}>Active</Text></View>
                </View>
                <View style={styles.funnelRow}>
                    <View style={styles.funnelChart}>
                        <MiniDonut value={dashboardData?.performance?.achieved || 0} total={dashboardData?.performance?.target || 1} color="#10B981" size={70} />
                    </View>
                    <View style={styles.funnelData}>
                        <View style={styles.funnelStats}>
                            <View style={styles.funnelItem}>
                                <Text style={[styles.funnelVal, { color: theme.text }]}>{stats.deals || 0}</Text>
                                <Text style={[styles.funnelLab, { color: theme.textMuted }]}>Active Deals</Text>
                            </View>
                            <View style={[styles.funnelDivider, { backgroundColor: theme.border }]} />
                            <View style={styles.funnelItem}>
                                <Text style={[styles.funnelVal, { color: "#10B981" }]}>₹{((dashboardData?.performance?.achieved || 0) / 10000000).toFixed(1)}Cr</Text>
                                <Text style={[styles.funnelLab, { color: theme.textMuted }]}>Won Value</Text>
                            </View>
                        </View>
                        <View style={[styles.funnelFooter, { borderTopColor: theme.border }]}>
                            <View style={styles.funnelSub}>
                                <Ionicons name="trending-up" size={14} color="#10B981" />
                                <Text style={[styles.funnelSubText, { color: theme.textMuted }]}>Won: {dashboardData?.deals?.find(d => d.stage.toLowerCase().includes('closed') || d.stage.toLowerCase().includes('booked'))?.count || 0}</Text>
                            </View>
                            <View style={styles.funnelSub}>
                                <Ionicons name="trending-down" size={14} color="#EF4444" />
                                <Text style={[styles.funnelSubText, { color: theme.textMuted }]}>Lost: {dashboardData?.deals?.find(d => d.stage.toLowerCase().includes('cancelled'))?.count || 0}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

        </View>
    );

    const renderInventoryDashboard = () => {
        const total = stats.inventory || 0;
        const available = dashboardData?.inventoryHealth?.find(i => i.status === 'Available')?.count || 0;
        const blocked = dashboardData?.inventoryHealth?.find(i => i.status === 'Blocked')?.count || 0;
        const sold = dashboardData?.inventoryHealth?.find(i => i.status === 'Sold')?.count || 0;

        const lookupMap = lookups.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.lookup_value }), {} as any);

        const projectTotal = stats.projects || 0;
        const activeProjects = stats.rawProjects?.filter((p: any) => p.status === 'Active' || (lookupMap && lookupMap[p.status] === 'Active')).length || projectTotal;

        return (
            <View>
                {/* 6. Project Overview Widget */}
                <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Project Overview</Text>
                    <View style={styles.projGrid}>
                        <View style={styles.projStat}>
                            <Text style={[styles.projVal, { color: theme.text }]}>{projectTotal}</Text>
                            <Text style={[styles.projLab, { color: theme.textMuted }]}>Total Projects</Text>
                        </View>
                        <View style={styles.projStat}>
                            <Text style={[styles.projVal, { color: "#10B981" }]}>{activeProjects}</Text>
                            <Text style={[styles.projLab, { color: theme.textMuted }]}>Active</Text>
                        </View>
                    </View>
                    <View style={[styles.stackedBar, { backgroundColor: theme.border }]} >
                        <View style={[styles.stackFill, { flex: sold || 1, backgroundColor: "#10B981" }]} />
                        <View style={[styles.stackFill, { flex: available || 1, backgroundColor: "#3B82F6" }]} />
                    </View>
                    <View style={styles.stackLabelRow}>
                        <Text style={[styles.stackLabText, { color: theme.textMuted }]}>Units Sold ({Math.round((sold / (total || 1)) * 100)}%)</Text>
                        <Text style={[styles.stackLabText, { color: theme.textMuted }]}>Available ({Math.round((available / (total || 1)) * 100)}%)</Text>
                    </View>
                </View>

                {/* 7. Inventory Health Snapshot */}
                <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Inventory Health</Text>
                    <View style={styles.healthBars}>
                        {[
                            { label: 'Available', val: available, color: '#3B82F6' },
                            { label: 'Blocked', val: blocked, color: '#F59E0B' },
                            { label: 'Sold', val: sold, color: '#10B981' }
                        ].map((item, idx) => (
                            <View key={idx} style={styles.healthItem}>
                                <View style={styles.healthTextRow}>
                                    <Text style={[styles.healthLab, { color: theme.text }]}>{item.label}</Text>
                                    <Text style={[styles.healthCount, { color: theme.textMuted }]}>{item.val}</Text>
                                </View>
                                <View style={[styles.healthBarBase, { backgroundColor: theme.border }]}>
                                    <View style={[styles.healthBarFill, { width: `${(item.val / (total || 1)) * 100}%`, backgroundColor: item.color }]} />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#F59E0B" }]} onPress={() => router.push("/add-project")}>
                    <Ionicons name="business" size={24} color="#fff" />
                    <Text style={styles.actionBtnText}>Add New Project</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderPostSalesDashboard = () => (
        <View>
            <View style={styles.grid}>
                <KPIItem label="Bookings Today" value={stats.bookings || 0} icon="document-text" color="#10B981" delay={0} />
                <KPIItem label="Total Volume" value={Math.round((dashboardData?.performance?.achieved || 0) / 100000)} icon="wallet" color="#8B5CF6" delay={100} />
                <KPIItem label="Upcoming Acts" value={dashboardData?.activities?.upcoming || 0} icon="time" color="#F59E0B" delay={200} />
                <KPIItem label="Open Deals" value={stats.deals || 0} icon="create" color="#3B82F6" delay={300} />
            </View>

            <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Agreement Pipeline</Text>
                <View style={styles.healthBars}>
                    {[
                        { label: 'Drafting', val: 12, color: '#3B82F6' },
                        { label: 'Signing', val: 8, color: '#F59E0B' },
                        { label: 'Registered', val: 25, color: '#10B981' }
                    ].map((item, idx) => (
                        <View key={idx} style={styles.healthItem}>
                            <View style={styles.healthTextRow}>
                                <Text style={[styles.healthLab, { color: theme.text }]}>{item.label}</Text>
                                <Text style={[styles.healthCount, { color: theme.textMuted }]}>{item.val}</Text>
                            </View>
                            <View style={[styles.healthBarBase, { backgroundColor: theme.border }]}>
                                <View style={[styles.healthBarFill, { width: `${(item.val / 45) * 100}%`, backgroundColor: item.color }]} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#10B981" }]} onPress={() => router.push("/bookings")}>
                <Ionicons name="receipt" size={24} color="#fff" />
                <Text style={styles.actionBtnText}>Manage Financials</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={config.color} />}
        >
            <Animated.View style={{ opacity: fadeAnim }}>
                {/* 1. Header Section – Mission Control */}
                <View style={[styles.header, { backgroundColor: theme.card }]}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={[styles.greetText, { color: theme.text }]}>Good Morning, Bharat</Text>
                            <Text style={[styles.subGreet, { color: theme.textMuted }]}>Sales Command Center</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.notifBtn, { backgroundColor: theme.background }]} onPress={() => router.push("/search")}>
                                <Ionicons name="search-outline" size={22} color={theme.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.notifBtn, { backgroundColor: theme.background }]}>
                                <Ionicons name="notifications-outline" size={22} color={theme.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.notifBtn, { backgroundColor: theme.background }]}
                                onPress={() => {
                                    Animated.timing(rotateAnim, {
                                        toValue: 1,
                                        duration: 600,
                                        useNativeDriver: true,
                                    }).start(() => {
                                        rotateAnim.setValue(0);
                                        router.push("/settings");
                                    });
                                }}
                            >
                                <Animated.View style={{
                                    transform: [{
                                        rotate: rotateAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0deg', '360deg']
                                        })
                                    }]
                                }}>
                                    <Ionicons name="settings-outline" size={22} color={theme.textMuted} />
                                </Animated.View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={[styles.performanceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.perfInfo}>
                            <View style={styles.perfHeaderRow}>
                                <Text style={[styles.perfTitle, { color: theme.textMuted }]}>Performance Index</Text>
                                <View style={styles.trendIndicator}>
                                    <Ionicons name={dashboardData?.performance?.trend && dashboardData.performance.trend >= 0 ? "caret-up" : "caret-down"} size={12} color={dashboardData?.performance?.trend && dashboardData.performance.trend >= 0 ? "#10B981" : "#EF4444"} />
                                    <Text style={styles.trendText}>{dashboardData?.performance?.trend || 0}%</Text>
                                </View>
                            </View>
                            <View style={styles.targetGrid}>
                                <View style={styles.targetCell}>
                                    <Text style={[styles.targetValSmall, { color: theme.text }]}>₹{(dashboardData?.performance?.target || 0) / 100000}L</Text>
                                    <Text style={[styles.targetLabelSmall, { color: theme.textMuted }]}>Target</Text>
                                </View>
                                <View style={styles.targetCell}>
                                    <Text style={[styles.targetValSmall, { color: "#10B981" }]}>₹{(dashboardData?.performance?.achieved || 0) / 100000}L</Text>
                                    <Text style={[styles.targetLabelSmall, { color: theme.textMuted }]}>Achieved</Text>
                                </View>
                                <View style={styles.targetCell}>
                                    <Text style={[styles.targetValSmall, { color: "#F59E0B" }]}>₹{(dashboardData?.performance?.remaining || 0) / 100000}L</Text>
                                    <Text style={styles.targetLabelSmall}>Rem.</Text>
                                </View>
                                <View style={styles.targetCell}>
                                    <Text style={[styles.targetValSmall, { color: "#3B82F6" }]}>{Math.round(dashboardData?.performance?.conversion || 0)}%</Text>
                                    <Text style={styles.targetLabelSmall}>Conv.</Text>
                                </View>
                            </View>
                        </View>
                        <ProgressRing progress={dashboardData?.performance?.conversion || 0} size={84} strokeWidth={9} color="#2563EB" />
                    </View>
                </View>

                {/* 2. Smart KPI Horizontal Scroll Row */}
                <View style={styles.kpiContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiScroll}>
                        <KPIItem label="Total Leads" value={stats.leads || 0} icon="people" color="#3B82F6" delay={0} />
                        <KPIItem label="Hot Leads" value={dashboardData?.leads?.find(l => l.status.toLowerCase().includes('hot'))?.count || 0} icon="flame" color="#EF4444" delay={100} trend="up" />
                        <KPIItem label="Active Deals" value={stats.deals || 0} icon="briefcase" color="#F59E0B" delay={200} />
                        <KPIItem label="Revenue" value={Math.round((dashboardData?.performance?.revenue || 0) / 1000)} icon="wallet" color="#10B981" delay={300} trend="up" />
                        <KPIItem label="Inventory" value={stats.inventory || 0} icon="cube" color="#8B5CF6" delay={400} />
                        <KPIItem label="Projects" value={stats.projects || 0} icon="business" color="#4F46E5" delay={500} />
                    </ScrollView>
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

                    {/* 8. Smart Insight Card */}
                    <View style={styles.insightCard}>
                        <View style={styles.insightHeader}>
                            <View style={styles.insightIconCircle}>
                                <Ionicons name="bulb" size={16} color="#4F46E5" />
                            </View>
                            <Text style={styles.insightTitle}>Smart Insight</Text>
                        </View>
                        <Text style={styles.insightText}>
                            {dashboardData?.performance?.conversion && dashboardData.performance.conversion > 30
                                ? "Excellent conversion rate! High probability of reaching monthly target early."
                                : dashboardData?.activities?.overdue && dashboardData.activities.overdue > 0
                                    ? `You have ${dashboardData.activities.overdue} overdue tasks. Clearing these could boost won value by ₹5L.`
                                    : "Consistency is key. Focus on 'Qualified' leads to maintain a healthy deal funnel."}
                        </Text>
                    </View>

                    {/* 9. Command Log (Timeline View) */}
                    <View style={[styles.activityBox, { paddingBottom: 10 }]}>
                        <Text style={styles.sectionTitle}>Command Log (Recent Events)</Text>
                        {activities.length > 0 ? (
                            <View style={styles.timelineContainer}>
                                <View style={styles.timelineLine} />
                                {activities.map((act, idx) => (
                                    <CommandLogItem key={act._id} act={act} idx={idx} config={config} router={router} />
                                ))}
                            </View>
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
            </Animated.View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { padding: 20, paddingTop: 60, backgroundColor: "#fff", borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    greetText: { fontSize: 22, fontWeight: "800", color: "#1E293B" },
    subGreet: { fontSize: 13, color: "#94A3B8", fontWeight: "600" },
    notifBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F8FAFC", justifyContent: 'center', alignItems: 'center' },

    performanceCard: {
        backgroundColor: "#fff", borderRadius: 24, padding: 20,
        flexDirection: 'row', alignItems: 'center',
        elevation: 8, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
        borderWidth: 1, borderColor: "rgba(226, 232, 240, 0.4)"
    },
    perfInfo: { flex: 1 },
    perfTitle: { fontSize: 14, fontWeight: "700", color: "#64748B", marginBottom: 12 },
    targetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    targetVal: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    targetLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
    targetDivider: { width: 1, height: 24, backgroundColor: "#F1F5F9", marginHorizontal: 15 },
    motiveText: { fontSize: 12, color: "#64748B", fontStyle: 'italic' },

    kpiContainer: { marginVertical: 24 },
    kpiScroll: { paddingHorizontal: 20, gap: 12 },
    kpiItem: {
        backgroundColor: "#fff", padding: 16, borderRadius: 20, minWidth: 110,
        alignItems: 'center', elevation: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    kpiCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    kpiItemValue: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    kpiItemLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "700", marginTop: 4 },

    content: { paddingHorizontal: 20 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },

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
    monitorContainer: { marginBottom: 24 },
    sectionHeader: { fontSize: 13, fontWeight: "800", color: "#94A3B8", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 },
    monitorGrid: { flexDirection: "row", gap: 10 },
    monitorTile: {
        flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 20, borderLeftWidth: 4,
        elevation: 3, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
        flexDirection: 'row', alignItems: 'center'
    },
    monitorValue: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
    monitorLabel: { fontSize: 11, fontWeight: "700", color: "#94A3B8", marginTop: 4 },
    pipelineContainer: { marginBottom: 24, backgroundColor: "#fff", padding: 18, borderRadius: 24, borderWidth: 0, elevation: 2, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    pipeHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    pipeTotal: { fontSize: 12, fontWeight: "700", color: "#64748B" },
    pipeScroll: { gap: 10, paddingRight: 10 },
    pipeStage: {
        backgroundColor: "#F8FAFC", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16,
        minWidth: 100, alignItems: "center"
    },
    pipeVal: { fontSize: 18, fontWeight: "800", color: "#2563EB" },
    pipeLab: { fontSize: 11, fontWeight: "700", color: "#64748B", marginTop: 4 },

    monitorInner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    monitorIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    pipeBadge: { backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    pipeBadgeText: { fontSize: 12, fontWeight: "800", color: "#64748B" },
    pipelineSteps: { gap: 16 },
    pipelineStep: { width: '100%' },
    stepInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    stepLabel: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
    stepCount: { fontSize: 13, fontWeight: "800", color: "#2563EB" },
    stepBarBase: { width: '100%', height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: 'hidden' },
    stepBarFill: { height: '100%', borderRadius: 3 },

    funnelStats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    funnelItem: { flex: 1, alignItems: 'center' },
    funnelVal: { fontSize: 22, fontWeight: "800", color: "#1E293B" },
    funnelLab: { fontSize: 11, fontWeight: "700", color: "#94A3B8", marginTop: 4 },
    funnelDivider: { width: 1, height: 30, backgroundColor: "#F1F5F9" },
    funnelFooter: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    funnelSub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    funnelSubText: { fontSize: 12, fontWeight: "700", color: "#64748B" },

    projGrid: { flexDirection: 'row', gap: 24, marginBottom: 20 },
    projStat: { flex: 1 },
    projVal: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
    projLab: { fontSize: 12, fontWeight: "700", color: "#94A3B8", marginTop: 4 },
    stackedBar: { height: 10, backgroundColor: "#F1F5F9", borderRadius: 5, flexDirection: 'row', overflow: 'hidden', marginVertical: 12 },
    stackFill: { height: '100%' },
    stackLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    stackLabText: { fontSize: 11, fontWeight: "700", color: "#94A3B8" },

    healthBars: { gap: 16 },
    healthItem: {},
    healthTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    healthLab: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
    healthCount: { fontSize: 13, fontWeight: "800", color: "#64748B" },
    healthBarBase: { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: 'hidden' },
    healthBarFill: { height: '100%', borderRadius: 3 },

    insightCard: { backgroundColor: "#EEF2FF", borderRadius: 24, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: "rgba(79, 70, 229, 0.1)" },
    insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    insightIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", justifyContent: 'center', alignItems: 'center', elevation: 2 },
    insightTitle: { fontSize: 14, fontWeight: "800", color: "#4F46E5" },
    insightText: { fontSize: 13, color: "#4F46E5", fontWeight: "600", lineHeight: 20 },

    timelineContainer: { marginTop: 10 },
    timelineLine: { position: 'absolute', left: 18, top: 0, bottom: 0, width: 2, backgroundColor: "#F1F5F9", marginLeft: -1 },
    timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
    timelineContent: { flex: 1, marginLeft: 10 },

    // Dashboard 3.0 Refinement Styles
    ringInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    ringVal: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    kpiLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    trendTag: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: '#ECFDF5' },
    monitorIconBoxCompact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    monitorValueSmall: { fontSize: 22, fontWeight: "800", color: "#1E293B" },
    monitorLabelCompact: { fontSize: 11, fontWeight: "700", color: "#94A3B8", marginTop: 6 },
    segmentedPipeline: { flexDirection: 'row', height: 40, alignItems: 'flex-end', gap: 4, marginVertical: 12 },
    segHeader: { alignItems: 'center', marginBottom: 4 },
    segCount: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
    segLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
    segBar: { height: 8, borderRadius: 4 },
    segLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    segLabelMuted: { fontSize: 10, fontWeight: '600', color: '#CBD5E1' },
    funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    funnelChart: { width: 70, height: 70 },
    funnelData: { flex: 1 },
    perfHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    trendIndicator: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    trendText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
    targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    targetCell: { minWidth: '45%', paddingVertical: 4 },
    targetValSmall: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    targetLabelSmall: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
});
