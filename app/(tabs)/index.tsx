import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    RefreshControl, ActivityIndicator, Dimensions, Animated, Image
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDepartment } from "@/context/DepartmentContext";
import api from "@/services/api";
import { getActivities } from "@/services/activities.service";
import { getDashboardStats, DashboardStats } from "@/services/dashboard.service";
import { extractTotal, lookupVal, extractList } from "@/services/api.helpers";
import { useTheme, Colors } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useCallTracking } from "@/context/CallTrackingContext";
import { useUsers } from "@/context/UserContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal } from "react-native";
import { useAuth } from "@/context/AuthContext";

const CACHE_KEY_DASHBOARD = "@cache_dashboard_stats";

const STAGE_COLORS_LIGHT: Record<string, string> = {
    incoming: "#6366F1",
    prospect: "#8B5CF6",
    opportunity: "#F59E0B",
    negotiation: "#F97316",
    closed: "#10B981",
};

const STAGE_COLORS_DARK: Record<string, string> = {
    incoming: "#818CF8",
    prospect: "#A78BFA",
    opportunity: "#FBBF24",
    negotiation: "#FB923C",
    closed: "#34D399",
};

const SHORT_NAMES: Record<string, string> = {
    incoming: "New",
    prospect: "Pros",
    opportunity: "Oppr",
    negotiation: "Nego",
    closed: "Won",
};

const ChevronSegment = memo(({
    label,
    count,
    percentage,
    color,
    isFirst = false,
    isLast = false
}: {
    label: string;
    count: number;
    percentage: number;
    color: string;
    isFirst?: boolean;
    isLast?: boolean;
}) => {
    const { theme } = useTheme();
    const shortLabel = SHORT_NAMES[label.toLowerCase()] || label;
    const isDark = theme.background === '#0F172A';

    return (
        <View style={[
            styles.dashChevronSegment,
            { backgroundColor: isDark ? color + '25' : color + '15' },
            isFirst && { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
            isLast && { borderTopRightRadius: 10, borderBottomRightRadius: 10 }
        ]}>
            <View style={styles.chevronContentCompact}>
                <Text style={[styles.dashChevronLabel, { color: color }]}>{shortLabel}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                    <Text style={[styles.dashChevronCount, { color: color }]}>{count}</Text>
                    <Text style={[styles.dashChevronPercent, { color: color + '90' }]}>{percentage}%</Text>
                </View>
            </View>
            {!isLast && (
                <View style={[styles.dashChevronArrow, { borderLeftColor: isDark ? theme.background : '#fff' }]} />
            )}
        </View>
    );
});

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

function ProgressRing({ progress, size = 80, strokeWidth = 8, color }: { progress: number; size?: number; strokeWidth?: number; color?: string }) {
    const { theme } = useTheme();
    const ringColor = color || theme.primary;
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth, borderColor: theme.border,
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
            }}></View>
            <View style={[styles.ringInner, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.ringVal, { color: theme.text }]}>{Math.round(progress)}%</Text>
            </View>
        </View>
    );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PulseTile = memo(({ count, label, icon, color, bgColor, filter, router }: any) => {
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
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
                    <View style={[styles.monitorIconBox, { backgroundColor: isDark ? color + '20' : bgColor }]}>
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
            <TouchableOpacity
                style={[styles.logRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => {
                    if (act.entityId && act.entityType) {
                        const type = act.entityType.toLowerCase();
                        const route = `/${type}-detail` as any;
                        router.push({ pathname: route, params: { id: act.entityId } });
                    }
                }}
            >
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

const MiniDonut = memo(({ value, total, color, size = 50 }: { value: number; total: number; color?: string; size?: number }) => {
    const { theme } = useTheme();
    const ringColor = color || theme.primary;
    const progress = (value / (total || 1)) * 100;
    const strokeWidth = 5;
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth, borderColor: theme.border,
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
            }}></View>
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

const IntelligenceTile = memo(({ count, label, icon, color, delay = 0 }: any) => {
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const slideAnim = useRef(new Animated.Value(20)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: 0, duration: 600, delay, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 600, delay, useNativeDriver: true })
        ]).start();
    }, []);

    return (
        <Animated.View style={[styles.intelTile, { opacity: opacityAnim, transform: [{ translateY: slideAnim }], backgroundColor: theme.card, borderColor: isDark ? color + '40' : color + '20' }]}>
            <View style={[styles.intelIconBox, { backgroundColor: color + '10' }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <View>
                <Counter value={count} style={[styles.intelValue, { color: theme.text }]} />
                <Text style={[styles.intelLabel, { color: theme.textMuted }]}>{label}</Text>
            </View>
        </Animated.View>
    );
});

const IntelligencePulse = memo(({ revived, nfa }: { revived: number; nfa: number }) => {
    const { theme } = useTheme();
    return (
        <View style={styles.intelContainer}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Intelligence Pulse</Text>
                <View style={[styles.aiBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.aiBadgeText}>AI ENGINE</Text>
                </View>
            </View>
            <View style={styles.intelGrid}>
                <IntelligenceTile count={revived} label="Revived Leads" icon="refresh-circle" color="#10B981" delay={0} />
                <IntelligenceTile count={nfa} label="NFA Alerts" icon="alert-circle" color="#EF4444" delay={100} />
            </View>
        </View>
    );
});

const ActivityTypeGrid = memo(({ data, theme }: { data: any[]; theme: any }) => {
    if (!data || data.length === 0) return null;
    const icons: any = { Call: 'call', WhatsApp: 'logo-whatsapp', Meeting: 'people', Note: 'document-text', Email: 'mail', Task: 'checkbox' };
    const colors: any = { Call: '#10B981', WhatsApp: '#25D366', Meeting: '#4F46E5', Note: '#F59E0B', Email: '#3B82F6', Task: '#EF4444' };

    return (
        <View style={styles.activityBreakdownRow}>
            {data.slice(0, 4).map((item, idx) => (
                <View key={idx} style={[styles.activityTypeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={[styles.activityTypeIcon, { backgroundColor: (colors[item._id] || '#64748B') + (theme.background === '#0F172A' ? '30' : '15') }]}>
                        <Ionicons name={icons[item._id] || 'apps'} size={14} color={theme.background === '#0F172A' ? Colors.dark.textSecondary : (colors[item._id] || '#64748B')} />
                    </View>
                    <Text style={[styles.activityTypeCount, { color: theme.text }]}>{item.count}</Text>
                    <Text style={[styles.activityTypeLabel, { color: theme.textMuted }]}>{item._id}</Text>
                </View>
            ))}
        </View>
    );
});

const LeadSourceList = memo(({ data, theme }: { data: any[]; theme: any }) => {
    if (!data || data.length === 0) return null;
    return (
        <View style={styles.sourceList}>
            {data.slice(0, 3).map((item, idx) => (
                <View key={idx} style={styles.sourceItem}>
                    <View style={styles.sourceHeader}>
                        <Text style={[styles.sourceName, { color: theme.text }]}>{item.source}</Text>
                        <Text style={[styles.sourceCount, { color: theme.text }]}>{item.count} leads</Text>
                    </View>
                    <View style={[styles.sourceBarBase, { backgroundColor: theme.border }]}>
                        <View style={[styles.sourceBarFill, { width: `${(item.count / (data[0].count || 1)) * 100}%`, backgroundColor: theme.primary }]} />
                    </View>
                </View>
            ))}
        </View>
    );
});

const AIRecommendationsList = memo(({ suggestions, theme }: { suggestions: any; theme: any }) => {
    const isDark = theme.background === '#0F172A';
    const suggestionsList = useMemo(() => [
        ...(suggestions?.leads || []),
        ...(suggestions?.performance || []),
        ...(suggestions?.pipeline || []),
        ...(suggestions?.strategy || [])
    ], [suggestions]);

    if (suggestionsList.length === 0) return (
        <View style={[styles.insightCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.insightHeader}>
                <View style={[styles.insightIconCircle, { backgroundColor: theme.primary + '15' }]}><Ionicons name="bulb" size={16} color={theme.primary} /></View>
                <Text style={[styles.insightTitle, { color: theme.text }]}>Smart Insight</Text>
            </View>
            <Text style={[styles.insightText, { color: theme.textSecondary }]}>Consistency is key. Focus on 'Qualified' leads to maintain a healthy deal funnel.</Text>
        </View>
    );

    return (
        <View style={[styles.recommendationsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>AI Recommendations</Text>
            {suggestionsList.slice(0, 3).map((s: any, i: number) => {
                const glyphs: any = { optimization: '⚡', training: '📚', growth: '🚀', strategy: '🎯' };
                return (
                    <View key={i} style={[styles.recommendationItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.background }]}>
                        <Text style={styles.recommendationGlyph}>{glyphs[s.type] || '💡'}</Text>
                        <Text style={[styles.recommendationText, { color: theme.text }]}>{s.text}</Text>
                    </View>
                );
            })}
        </View>
    );
});


const ProjectQuickList = memo(({ data, theme, router }: { data: any[]; theme: any; router: any }) => {
    if (!data || data.length === 0) return null;
    return (
        <View style={styles.projectListContainer}>
            {data.slice(0, 3).map((proj, idx) => (
                <TouchableOpacity
                    key={idx}
                    style={[styles.miniProjCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => router.push({ pathname: "/project-detail", params: { id: proj._id } })}
                >
                    <View style={styles.miniProjInfo}>
                        <Text style={[styles.miniProjName, { color: theme.text }]} numberOfLines={1}>{proj.name}</Text>
                        <Text style={[styles.miniProjLoc, { color: theme.textMuted }]}>{proj.location || 'Primary'}</Text>
                    </View>
                    <View style={styles.miniProjStats}>
                        <View style={styles.miniProjBadge}>
                            <Text style={styles.miniProjBadgeText}>{proj.units?.available || 0} Avail</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={theme.textLight} />
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
});

export default function MissionControlScreen() {
    const { currentDept, config } = useDepartment();
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const { getLookupValue } = useLookup();
    const { simulateIncomingCall } = useCallTracking();
    const { isAuthenticated } = useAuth();
    const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
    const [stats, setStats] = useState<any>({});
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { users, teams, loading: usersLoading } = useUsers();
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const rotateAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        try {
            // 1. Try Cache First for Instant Load
            const cached = await AsyncStorage.getItem(CACHE_KEY_DASHBOARD);
            if (cached) {
                const parsed = JSON.parse(cached);
                setDashboardData(parsed);
                setStats({
                    leads: (parsed.leads || []).reduce((s: number, l: any) => s + l.count, 0),
                    deals: (parsed.deals || []).reduce((s: number, d: any) => s + d.count, 0),
                    inventory: (parsed.inventoryHealth || []).reduce((s: number, i: any) => s + i.count, 0),
                    projects: parsed.projects || 0,
                    rawProjects: [],
                    rawInventory: []
                });
                setLoading(false);
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            }

            const params: any = {};
            if (selectedFilter !== 'all') {
                const isTeam = teams?.some(t => t.id === selectedFilter || t._id === selectedFilter);
                if (isTeam) params.teamId = selectedFilter;
                else params.userId = selectedFilter;
            }

            // 2. Parallel Fetching for Fresh Data
            const [actvRes, dsRes] = await Promise.all([
                getActivities({ status: 'Pending', limit: 5 }).catch(() => null),
                getDashboardStats(params).catch(() => null)
            ]);

            if (actvRes) {
                const actData = actvRes?.data ?? actvRes?.records ?? [];
                setActivities(Array.isArray(actData) ? actData : []);
            }

            if (dsRes && dsRes.data && (dsRes.data as any).success !== false) {
                const data = dsRes.data;
                setDashboardData(data);

                // Update Cache
                AsyncStorage.setItem(CACHE_KEY_DASHBOARD, JSON.stringify(data)).catch(() => { });

                setStats({
                    leads: (data.leads || []).reduce((s: number, l: any) => s + l.count, 0),
                    deals: (data.deals || []).reduce((s: number, d: any) => s + d.count, 0),
                    inventory: (data.inventoryHealth || []).reduce((s: number, i: any) => s + i.count, 0),
                    projects: data.projects || 0,
                    rawProjects: [],
                    rawInventory: []
                });
            } else if (dsRes && (dsRes.data as any).success === false) {
                console.warn("[Mission Control] Backend returned success:false", (dsRes.data as any).error);
            }

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true
            }).start();
        } catch (e) {
            console.warn("Mission Control fetch error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fadeAnim]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData, selectedFilter, isAuthenticated])
    );

    const getFilterLabel = () => {
        if (selectedFilter === 'all') return "Enterprise Analytics";
        const team = teams.find(t => t._id === selectedFilter || t.id === selectedFilter);
        if (team) return `Team: ${team.name}`;
        const user = users.find(u => u._id === selectedFilter || u.id === selectedFilter);
        if (user) return `Me: ${user.fullName}`;
        return "Custom Scope";
    };

    const renderSalesDashboard = () => (
        <View>
            {/* 0. Intelligence Pulse (AI Insights) */}
            <IntelligencePulse 
                revived={dashboardData?.reengagedCount || 0} 
                nfa={dashboardData?.nfaCount || 0} 
            />

            {/* 3. Activity Monitor (Urgency Based) */}
            <View style={styles.monitorContainer}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Activity Monitor</Text>
                    <View style={styles.liveIndicator}>
                        <View style={styles.dot} />
                        <Text style={styles.liveText}>LIVE</Text>
                    </View>
                </View>
                <View style={styles.monitorGrid}>
                    <PulseTile count={dashboardData?.activities?.overdue || 0} label="Overdue" icon="time" color="#EF4444" bgColor="#FEE2E2" filter="Overdue" router={router} />
                    <PulseTile count={dashboardData?.activities?.today || 0} label="Today" icon="today" color="#F59E0B" bgColor="#FEF3C7" filter="Today" router={router} />
                    <PulseTile count={dashboardData?.activities?.upcoming || 0} label="Upcoming" icon="calendar" color="#6366F1" bgColor="#E0E7FF" filter="Upcoming" router={router} />
                </View>
            </View>

            {/* AI Alert Hub Section */}
            {dashboardData?.aiAlertHub && (
                <View style={styles.alertHubContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {dashboardData.aiAlertHub?.followupFailure && dashboardData.aiAlertHub.followupFailure.length > 0 && dashboardData.aiAlertHub.followupFailure.map((alert: any) => (
                            <TouchableOpacity key={alert.id} style={[styles.alertCard, { borderColor: theme.error, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.05)' : '#FEE2E2' }]}>
                                <View style={[styles.alertIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                                    <Ionicons name="warning" size={16} color={theme.error} />
                                </View>
                                <View>
                                    <Text style={[styles.alertTitle, { color: theme.text }]}>{alert.title}</Text>
                                    <Text style={[styles.alertMsg, { color: theme.textSecondary }]} numberOfLines={1}>{alert.message}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                        {dashboardData.aiAlertHub?.hotLeads && dashboardData.aiAlertHub.hotLeads.length > 0 && dashboardData.aiAlertHub.hotLeads.map((alert: any) => (
                            <TouchableOpacity key={alert.id} style={[styles.alertCard, { borderColor: '#F59E0B', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.05)' : '#FEF3C7' }]}>
                                <View style={[styles.alertIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                                    <Ionicons name="flame" size={16} color="#F59E0B" />
                                </View>
                                <View>
                                    <Text style={[styles.alertTitle, { color: theme.text }]}>{alert.title}</Text>
                                    <Text style={[styles.alertMsg, { color: theme.textSecondary }]} numberOfLines={1}>{alert.message}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Activity Type Breakdown */}
            {dashboardData?.activityTypeBreakdown && dashboardData.activityTypeBreakdown.length > 0 && (
                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Weekly Activity Mix</Text>
                    <ActivityTypeGrid data={dashboardData.activityTypeBreakdown} theme={theme} />
                </View>
            )}

            {/* Lead Source Breakdown */}
            {dashboardData?.leadSourceStats && dashboardData.leadSourceStats.length > 0 && (
                <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Top Lead Sources</Text>
                    <LeadSourceList data={dashboardData.leadSourceStats} theme={theme} />
                </View>
            )}

            {/* 4. Lead Pipeline Section (Visual) */}
            <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.pipeHeaderRow}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Lead Pipeline</Text>
                    <View style={[styles.pipeBadge, { backgroundColor: theme.background }]}><Text style={[styles.pipeBadgeText, { color: theme.textMuted }]}>{stats.leads || 0}</Text></View>
                </View>
                <View style={styles.segmentedPipeline}>
                    {['INCOMING', 'PROSPECT', 'OPPORTUNITY', 'NEGOTIATION', 'CLOSED'].map((cat, idx) => {
                        const item = (dashboardData?.leads || []).find(l => l.status.toUpperCase() === cat.toUpperCase()) || { count: 0 };
                        const colors = ["#2563EB", "#3B82F6", "#60A5FA", "#8B5CF6", "#10B981"];
                        return (
                            <View key={idx} style={{ flex: Math.max(item.count, 0.5), minWidth: 20 }}>
                                <View style={styles.segHeader}>
                                    <Text style={[styles.segCount, { color: theme.text }]}>{item.count}</Text>
                                    <Text style={[styles.segLabel, { color: theme.textMuted }]} numberOfLines={1}>{cat[0]}</Text>
                                </View>
                                <View style={[styles.segBar, { backgroundColor: colors[idx % colors.length] }]} />
                            </View>
                        );
                    })}
                </View>
                <View style={styles.segLabelsRow}>
                    {['Inc.', 'Pros.', 'Opp.', 'Neg.', 'Won'].map((s, i) => (
                        <Text key={i} style={[styles.segLabelMuted, { color: theme.textMuted }]}>{s}</Text>
                    ))}
                </View>
            </View>

            {/* 5. Deal Pipeline Section (Arrow Redesign) */}
            <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.pipeHeaderRow}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Deal Pipeline</Text>
                    <TouchableOpacity onPress={() => router.push("/(tabs)/deals")}>
                        <Text style={[styles.pipeTotal, { color: theme.primary, fontWeight: '800' }]}>View All</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.dashboardChevronContainer}>
                    {['INCOMING', 'PROSPECT', 'OPPORTUNITY', 'NEGOTIATION', 'CLOSED'].map((cat, idx) => {
                        const item = (dashboardData?.deals || []).find(d => d.stage.toLowerCase() === cat.toLowerCase()) || { count: 0 };
                        const total = dashboardData?.deals?.reduce((acc: number, d: any) => acc + d.count, 0) || 1;
                        const colors = isDark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT;
                        return (
                            <ChevronSegment
                                key={idx}
                                label={cat}
                                count={item.count}
                                percentage={Math.round((item.count / total) * 100)}
                                color={colors[cat.toLowerCase()] || '#6366F1'}
                                isFirst={idx === 0}
                                isLast={idx === 4}
                            />
                        );
                    })}
                </View>

                <View style={styles.funnelFooterRow}>
                    <View style={styles.funnelStatItem}>
                        <Text style={[styles.funnelStatVal, { color: theme.text }]}>₹{((dashboardData?.performance?.achieved || 0) / 10000000).toFixed(1)}Cr</Text>
                        <Text style={styles.funnelStatLab}>Won Value</Text>
                    </View>
                    <View style={styles.funnelStatDivider} />
                    <View style={styles.funnelStatItem}>
                        <Text style={[styles.funnelStatVal, { color: theme.text }]}>{dashboardData?.performance?.conversion || 0}%</Text>
                        <Text style={styles.funnelStatLab}>Win Rate</Text>
                    </View>
                </View>
            </View>

            {/* High-Value Agenda Section */}
            {dashboardData?.agenda && (dashboardData.agenda.tasks?.length > 0 || dashboardData.agenda.siteVisits?.length > 0) && (
                <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>High-Value Agenda</Text>
                    {dashboardData.agenda.siteVisits?.map((sv: any) => (
                        <View key={sv.id} style={styles.agendaItem}>
                            <View style={[styles.agendaIcon, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4' }]}>
                                <Ionicons name="navigate" size={16} color={isDark ? '#34D399' : "#10B981"} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.agendaTitle, { color: theme.text }]}>{sv.target}</Text>
                                <Text style={[styles.agendaSub, { color: theme.textSecondary }]}>{sv.client} • {sv.time}</Text>
                            </View>
                            <View style={[styles.activeTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#10B981' }]}><Text style={[styles.activeTagText, { color: isDark ? '#34D399' : '#fff' }]}>VISIT</Text></View>
                        </View>
                    ))}
                    {dashboardData.agenda.tasks?.map((t: any) => (
                        <View key={t.id} style={styles.agendaItem}>
                            <View style={[styles.agendaIcon, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#F0F9FF' }]}>
                                <Ionicons name="call" size={16} color={isDark ? '#60A5FA' : "#3B82F6"} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.agendaTitle, { color: theme.text }]}>{t.title}</Text>
                                <Text style={[styles.agendaSub, { color: theme.textSecondary }]}>{t.target} • {t.time}</Text>
                            </View>
                            <View style={[styles.statusTag, { backgroundColor: t.status === 'overdue' ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2') : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9') }]}>
                                <Text style={[styles.statusTagText, { color: t.status === 'overdue' ? (isDark ? '#F87171' : '#EF4444') : theme.textMuted }]}>{t.status.toUpperCase()}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

        </View>
    );

    const renderInventoryDashboard = () => {
        const total = stats.inventory || 0;
        const available = dashboardData?.inventoryHealth?.find(i => i.status === 'Available')?.count || 0;
        const blocked = dashboardData?.inventoryHealth?.find(i => i.status === 'Blocked')?.count || 0;
        const sold = dashboardData?.inventoryHealth?.find(i => i.status === 'Sold')?.count || 0;

        const projectTotal = stats.projects || 0;
        const activeProjects = stats.rawProjects?.filter((p: any) => p.status === 'Active' || (getLookupValue("Status", p.status) === 'Active')).length || projectTotal;

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

                {/* Project Quick List */}
                {dashboardData?.projectList && dashboardData.projectList.length > 0 && (
                    <View style={[styles.pipelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.pipeHeaderRow}>
                            <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Recent Projects</Text>
                            <TouchableOpacity onPress={() => router.push("/(tabs)/projects")}>
                                <Text style={[styles.pipeTotal, { color: theme.primary, fontWeight: '800' }]}>View All</Text>
                            </TouchableOpacity>
                        </View>
                        <ProjectQuickList data={dashboardData.projectList} theme={theme} router={router} />
                    </View>
                )}

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
                <View style={[styles.header, { backgroundColor: theme.glassBg, borderBottomColor: theme.glassBorder, borderBottomWidth: 1 }]}>
                    <View style={styles.headerTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Image 
                                source={theme.background === '#0F172A' ? require("../../assets/images/logo_dark.png") : require("../../assets/images/logo.png")} 
                                resizeMode="contain"
                                style={styles.headerLogo} 
                            />
                            <View>
                                <Text style={[styles.greetText, { color: theme.text }]}>Morning, Bharat</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                    <View style={[styles.versionBadge, { backgroundColor: theme.primary + '20' }]}>
                                        <Text style={[styles.versionText, { color: theme.primary }]}>v3.0 PREMIUM</Text>
                                    </View>
                                    <View style={[styles.autoPilotBadge, { backgroundColor: 'rgba(53, 185, 122, 0.1)' }]}>
                                        <Text style={[styles.autoPilotText, { color: '#35B97A' }]}>⚡ AUTO-PILOT</Text>
                                    </View>
                                </View>
                                <TouchableOpacity 
                                    style={[styles.filterSelector, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                                    onPress={() => setIsFilterModalOpen(true)}
                                >
                                    <Ionicons name="filter" size={10} color={theme.primary} />
                                    <Text style={[styles.filterLabelText, { color: theme.textSecondary }]}>{getFilterLabel()}</Text>
                                    <Ionicons name="chevron-down" size={10} color={theme.textLight} />
                                </TouchableOpacity>
                            </View>
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
                            {/* Simulation Button for Testing */}
                            <TouchableOpacity
                                style={[styles.notifBtn, { backgroundColor: theme.primary + '15' }]}
                                onPress={() => simulateIncomingCall('9416031737')}
                            >
                                <Ionicons name="flask" size={22} color={theme.primary} />
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
                                    <Text style={[styles.targetValSmall, { color: isDark ? '#34D399' : "#10B981" }]}>₹{(dashboardData?.performance?.achieved || 0) / 100000}L</Text>
                                    <Text style={[styles.targetLabelSmall, { color: theme.textMuted }]}>Achieved</Text>
                                </View>
                                <View style={styles.targetCell}>
                                    <Text style={[styles.targetValSmall, { color: isDark ? '#FBBF24' : "#F59E0B" }]}>₹{(dashboardData?.performance?.remaining || 0) / 100000}L</Text>
                                    <Text style={styles.targetLabelSmall}>Rem.</Text>
                                </View>
                                <View style={styles.targetCell}>
                                    <Text style={[styles.targetValSmall, { color: isDark ? '#60A5FA' : "#3B82F6" }]}>{Math.round(dashboardData?.performance?.conversion || 0)}%</Text>
                                    <Text style={styles.targetLabelSmall}>Conv.</Text>
                                </View>
                            </View>
                        </View>
                        <ProgressRing progress={dashboardData?.performance?.conversion || 0} size={84} strokeWidth={9} color={theme.primary} />
                    </View>
                </View>

                {/* 2. Smart KPI Horizontal Scroll Row */}
                <View style={styles.kpiContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiScroll}>
                        <KPIItem label="Total Leads" value={stats.leads || 0} icon="people" color="#3B82F6" delay={0} />
                        <KPIItem label="Active Deals" value={stats.deals || 0} icon="briefcase" color="#F59E0B" delay={100} />
                        <KPIItem label="Revenue" value={Math.round((dashboardData?.performance?.revenue || 0) / 1000)} icon="wallet" color="#10B981" delay={200} trend="up" />
                        <KPIItem label="Inventory" value={stats.inventory || 0} icon="cube" color="#8B5CF6" delay={300} />
                        <KPIItem label="Projects" value={dashboardData?.projects || 0} icon="business" color="#4F46E5" delay={400} />
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
                    <AIRecommendationsList suggestions={dashboardData?.autoSuggestions} theme={theme} />

                    {/* 9. Command Log (Timeline View) */}
                    <View style={[styles.activityBox, { paddingBottom: 10, marginBottom: 30 }]}>
                        <Text style={styles.sectionTitle}>Command Log (Recent Events)</Text>
                        {dashboardData?.recentActivityFeed?.length ? (
                            <View style={styles.timelineContainer}>
                                <View style={styles.timelineLine} />
                                {dashboardData.recentActivityFeed.slice(0, 6).map((act, idx) => {
                                    const aIcon: any = { Call: 'call', WhatsApp: 'logo-whatsapp', Meeting: 'people', Note: 'document-text', Email: 'mail', Site_Visit: 'pin' };
                                    const aColor: any = { Call: '#10B981', WhatsApp: '#25D366', Meeting: '#4F46E5', Note: '#F59E0B', Email: '#3B82F6', Site_Visit: '#8B5CF6' };
                                    const config = { color: aColor[act.type] || theme.primary };
                                    return <CommandLogItem key={idx} act={act} idx={idx} config={config} router={router} />;
                                })}
                            </View>
                        ) : activities.length > 0 ? (
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
                {/* Filter Selection Modal */}
                <Modal
                    visible={isFilterModalOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIsFilterModalOpen(false)}
                >
                    <TouchableOpacity 
                        style={styles.modalOverlay} 
                        activeOpacity={1} 
                        onPress={() => setIsFilterModalOpen(false)}
                    >
                        <View style={[styles.filterModal, { backgroundColor: theme.glassBg, borderColor: theme.glassBorder, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1 }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>Visibility Center</Text>
                                <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                                    <Ionicons name="close" size={24} color={theme.textLight} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: SCREEN_WIDTH * 1.2 }}>
                                <TouchableOpacity 
                                    style={[styles.filterOption, selectedFilter === 'all' && { backgroundColor: theme.primary + '10' }]} 
                                    onPress={() => { setSelectedFilter('all'); setIsFilterModalOpen(false); }}
                                >
                                    <Ionicons name="globe-outline" size={20} color={selectedFilter === 'all' ? theme.primary : theme.textLight} />
                                    <Text style={[styles.filterOptionText, { color: selectedFilter === 'all' ? theme.primary : theme.text }]}>Enterprise (All)</Text>
                                </TouchableOpacity>

                                {teams.length > 0 && (
                                    <>
                                        <Text style={styles.modalSectionLabel}>TEAMS</Text>
                                        {teams.map(t => (
                                            <TouchableOpacity 
                                                key={t._id} 
                                                style={[styles.filterOption, selectedFilter === t._id && { backgroundColor: theme.primary + '10' }]}
                                                onPress={() => { setSelectedFilter(t._id); setIsFilterModalOpen(false); }}
                                            >
                                                <Ionicons name="people-outline" size={20} color={selectedFilter === t._id ? theme.primary : theme.textLight} />
                                                <Text style={[styles.filterOptionText, { color: selectedFilter === t._id ? theme.primary : theme.text }]}>{t.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </>
                                )}

                                {users.length > 0 && (
                                    <>
                                        <Text style={styles.modalSectionLabel}>OPERATORS</Text>
                                        {users.slice(0, 10).map(u => (
                                            <TouchableOpacity 
                                                key={u._id} 
                                                style={[styles.filterOption, selectedFilter === (u._id || u.id) && { backgroundColor: theme.primary + '10' }]}
                                                onPress={() => { setSelectedFilter(u._id || u.id); setIsFilterModalOpen(false); }}
                                            >
                                                <Ionicons name="person-outline" size={20} color={selectedFilter === (u._id || u.id) ? theme.primary : theme.textLight} />
                                                <Text style={[styles.filterOptionText, { color: selectedFilter === (u._id || u.id) ? theme.primary : theme.text }]}>{u.fullName}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </>
                                )}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>
            </Animated.View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    greetText: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
    subGreet: { fontSize: 12, fontWeight: "600" },
    versionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    versionText: { fontSize: 8, fontWeight: '800' },
    autoPilotBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    autoPilotText: { fontSize: 8, fontWeight: '900' },
    headerLogo: { width: 44, height: 44, borderRadius: 10 },
    notifBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

    performanceCard: {
        borderRadius: 24, padding: 20,
        flexDirection: 'row', alignItems: 'center',
        elevation: 8, shadowOpacity: 0.06, shadowRadius: 16, borderLeftWidth: 4,
        borderWidth: 1
    },
    perfInfo: { flex: 1 },
    perfTitle: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
    targetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    targetVal: { fontSize: 18, fontWeight: "800" },
    targetLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
    targetDivider: { width: 1, height: 24, marginHorizontal: 15 },
    motiveText: { fontSize: 12, fontStyle: 'italic' },

    kpiContainer: { marginVertical: 24 },
    kpiScroll: { paddingHorizontal: 20, gap: 12 },
    kpiItem: {
        padding: 16, borderRadius: 20, minWidth: 110,
        alignItems: 'center', elevation: 4, shadowOpacity: 0.04, shadowRadius: 10
    },
    kpiCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    kpiItemValue: { fontSize: 20, fontWeight: "800" },
    kpiItemLabel: { fontSize: 11, fontWeight: "700", marginTop: 4 },

    content: { paddingHorizontal: 20 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },

    actionBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        padding: 20, borderRadius: 24, marginBottom: 30,
        shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 10 }
    },
    actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.5 },
    activityBox: { borderRadius: 24, padding: 20, borderWidth: 1 },
    sectionTitle: { fontSize: 13, fontWeight: "800", marginBottom: 16, textTransform: "uppercase" },
    logRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    logIndicator: { width: 4, height: 20, borderRadius: 2 },
    logSubject: { fontSize: 14, fontWeight: "700" },
    logTime: { fontSize: 11, fontWeight: "600", marginTop: 2 },
    emptyText: { textAlign: "center", fontSize: 13, marginVertical: 20 },

    alertHubContainer: { marginBottom: 24 },
    alertCard: {
        width: 200, padding: 12, borderRadius: 16, borderLeftWidth: 4,
        flexDirection: 'row', alignItems: 'center', gap: 10,
        elevation: 2, shadowOpacity: 0.03, shadowRadius: 8
    },
    alertIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    alertTitle: { fontSize: 12, fontWeight: '800' },
    alertMsg: { fontSize: 10, fontWeight: '600', marginTop: 2 },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    dot: { width: 4, height: 4, borderRadius: 2 },
    liveText: { fontSize: 8, fontWeight: '900' },
    agendaItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
    agendaIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    agendaTitle: { fontSize: 14, fontWeight: '700' },
    agendaSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusTagText: { fontSize: 8, fontWeight: '900' },
    activeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    activeTagText: { fontSize: 8, fontWeight: '900' },

    monitorContainer: { marginBottom: 24 },
    sectionHeader: { fontSize: 13, fontWeight: "800", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 },
    monitorGrid: { flexDirection: "row", gap: 10 },
    monitorTile: {
        flex: 1, padding: 16, borderRadius: 20, borderLeftWidth: 4,
        elevation: 3, shadowOpacity: 0.03, shadowRadius: 8,
        flexDirection: 'row', alignItems: 'center'
    },
    monitorValue: { fontSize: 24, fontWeight: "800" },
    monitorLabel: { fontSize: 11, fontWeight: "700", marginTop: 4 },
    pipelineContainer: { marginBottom: 24, padding: 18, borderRadius: 24, borderWidth: 1, elevation: 2, shadowOpacity: 0.03, shadowRadius: 12 },
    pipeHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    pipeTotal: { fontSize: 12, fontWeight: "700" },
    pipeScroll: { gap: 10, paddingRight: 10 },
    pipeStage: {
        paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16,
        minWidth: 100, alignItems: "center"
    },
    pipeVal: { fontSize: 18, fontWeight: "800" },
    pipeLab: { fontSize: 11, fontWeight: "700", marginTop: 4 },

    monitorInner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    monitorIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    pipeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    pipeBadgeText: { fontSize: 12, fontWeight: "800" },
    pipelineSteps: { gap: 16 },
    pipelineStep: { width: '100%' },
    stepInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    stepLabel: { fontSize: 13, fontWeight: "700" },
    stepCount: { fontSize: 13, fontWeight: "800" },
    stepBarBase: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
    stepBarFill: { height: '100%', borderRadius: 3 },

    funnelStats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    funnelItem: { flex: 1, alignItems: 'center' },
    funnelVal: { fontSize: 22, fontWeight: "800" },
    funnelLab: { fontSize: 11, fontWeight: "700", marginTop: 4 },
    funnelDivider: { width: 1, height: 30 },
    funnelFooter: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
    funnelSub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    funnelSubText: { fontSize: 12, fontWeight: "700" },

    projGrid: { flexDirection: 'row', gap: 24, marginBottom: 20 },
    projStat: { flex: 1 },
    projVal: { fontSize: 24, fontWeight: '800' },
    projLab: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    stackedBar: { height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden', marginVertical: 12 },
    stackFill: { height: '100%' },
    stackLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    stackLabText: { fontSize: 11, fontWeight: '700' },

    healthBars: { gap: 16 },
    healthItem: {},
    healthTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    healthLab: { fontSize: 13, fontWeight: '700' },
    healthCount: { fontSize: 13, fontWeight: '800' },
    healthBarBase: { height: 6, borderRadius: 3, overflow: 'hidden' },
    healthBarFill: { height: '100%', borderRadius: 3 },

    insightCard: { borderRadius: 24, padding: 20, marginBottom: 30, borderWidth: 1 },
    insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    insightIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    insightTitle: { fontSize: 14, fontWeight: '800' },
    insightText: { fontSize: 13, fontWeight: '600', lineHeight: 20 },

    timelineContainer: { marginTop: 10 },
    timelineLine: { position: 'absolute', left: 18, top: 0, bottom: 0, width: 2, marginLeft: -1 },
    timelineDot: { width: 8, height: 8, borderRadius: 4 },
    timelineContent: { flex: 1, marginLeft: 10 },

    ringInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    ringVal: { fontSize: 16, fontWeight: '800' },
    kpiLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    trendTag: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
    monitorIconBoxCompact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    monitorValueSmall: { fontSize: 22, fontWeight: '800' },
    monitorLabelCompact: { fontSize: 11, fontWeight: '700', marginTop: 6 },
    segmentedPipeline: { flexDirection: 'row', height: 40, alignItems: 'flex-end', gap: 4, marginVertical: 12 },
    segHeader: { alignItems: 'center', marginBottom: 4 },
    segCount: { fontSize: 12, fontWeight: '800' },
    segLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    segBar: { height: 8, borderRadius: 4 },
    segLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    segLabelMuted: { fontSize: 10, fontWeight: '600' },
    funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    funnelChart: { width: 70, height: 70 },
    funnelData: { flex: 1 },
    perfHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    trendIndicator: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    trendText: { fontSize: 11, fontWeight: '700' },
    targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    targetCell: { minWidth: '45%', paddingVertical: 4 },
    targetValSmall: { fontSize: 13, fontWeight: '800' },
    targetLabelSmall: { fontSize: 10, fontWeight: '700' },

    dashboardChevronContainer: { flexDirection: 'row', width: '100%', height: 54, marginBottom: 20 },
    dashChevronSegment: { flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    chevronContentCompact: { alignItems: 'center' },
    dashChevronLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
    dashChevronCount: { fontSize: 14, fontWeight: '900' },
    dashChevronPercent: { fontSize: 9, fontWeight: '700', opacity: 0.8 },
    dashChevronArrow: {
        position: 'absolute', right: -8, width: 16, height: 16,
        transform: [{ rotate: '45deg' }], zIndex: 10,
        borderTopWidth: 2, borderRightWidth: 2, borderRadius: 2
    },
    funnelFooterRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, borderTopWidth: 1 },
    funnelStatItem: { flex: 1, alignItems: 'center' },
    funnelStatVal: { fontSize: 16, fontWeight: '800' },
    funnelStatLab: { fontSize: 10, fontWeight: '700', marginTop: 2 },
    funnelStatDivider: { width: 1, height: 20 },
    systemNote: { marginTop: 20, padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 40 },
    systemNoteText: { fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 18 },

    sectionContainer: { marginBottom: 24 },
    activityBreakdownRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    activityTypeCard: { flex: 1, minWidth: '45%', padding: 12, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
    activityTypeIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    activityTypeCount: { fontSize: 16, fontWeight: '800' },
    activityTypeLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
    
    intelContainer: { marginBottom: 24 },
    intelGrid: { flexDirection: 'row', gap: 12 },
    intelTile: { 
        flex: 1, padding: 16, borderRadius: 24, borderWidth: 1.5,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        elevation: 4, shadowOpacity: 0.05, shadowRadius: 10
    },
    intelIconBox: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    intelValue: { fontSize: 24, fontWeight: '900' },
    intelLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    aiBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    aiBadgeText: { fontSize: 8, fontWeight: '900' },

    sourceList: { gap: 12 },
    sourceItem: {},
    sourceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    sourceName: { fontSize: 12, fontWeight: '700' },
    sourceCount: { fontSize: 11, fontWeight: '800', opacity: 0.6 },
    sourceBarBase: { height: 6, borderRadius: 3, overflow: 'hidden' },
    sourceBarFill: { height: '100%', borderRadius: 3 },

    recommendationsContainer: { marginBottom: 30, padding: 18, borderRadius: 24, borderWidth: 1 },
    recommendationItem: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, marginBottom: 8, alignItems: 'center' },
    recommendationGlyph: { fontSize: 16 },
    recommendationText: { fontSize: 12, fontWeight: '700', flex: 1 },

    projectListContainer: { gap: 10 },
    miniProjCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderLeftWidth: 3, gap: 12 },
    miniProjInfo: { flex: 1 },
    miniProjName: { fontSize: 14, fontWeight: '800' },
    miniProjLoc: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    miniProjStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    miniProjBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    miniProjBadgeText: { fontSize: 10, fontWeight: '800' },

    filterSelector: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
    filterLabelText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.2 },

    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    filterModal: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 18, fontWeight: '900' },
    modalSectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 20, marginBottom: 12 },
    filterOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, marginBottom: 6 },
    filterOptionText: { fontSize: 14, fontWeight: '700' },
});
