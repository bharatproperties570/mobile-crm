import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, ActivityIndicator, Alert, Dimensions, RefreshControl } from "react-native";
import { useEffect, useRef, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { marketingService } from "@/services/marketing.service";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MarketingScreen() {
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [reports, setReports] = useState<any>(null);
    const [smsStatus, setSmsStatus] = useState<any>({ connected: true, balance: "2,845", provider: "SMSGatewayHub" });
    const [isAutoPilotActive, setIsAutoPilotActive] = useState(true);
    const [generatedVisual, setGeneratedVisual] = useState<string | null>("https://i.ibb.co/Vmm45Cq/ai-render-preview.jpg");
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [statsRes, reportsRes, smsRes] = await Promise.allSettled([
                marketingService.getStats(),
                marketingService.getCampaignReports(),
                marketingService.getSmsStatus()
            ]);

            if (statsRes.status === 'fulfilled') setStats(statsRes.value);
            if (reportsRes.status === 'fulfilled') setReports(reportsRes.value);
            if (smsRes.status === 'fulfilled' && smsRes.value.success) setSmsStatus(smsRes.value);

            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (error) {
            console.error("Marketing Fetch Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fadeAnim]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleDesignerGen = async () => {
        setIsGenerating(true);
        setTimeout(() => {
            setIsGenerating(false);
            Alert.alert("AI Marketing OS", "High-Fidelity Media Render Complete (Reel 9:16)");
        }, 3500);
    };

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    const kpis = [
        { label: 'EFFICIENCY', val: reports?.kpis?.efficiency || '94%', sub: '↑ 2.1% AI Yield', icon: 'flash', color: '#10B981' },
        { label: 'MATCH RATE', val: reports?.kpis?.matchRate || '68%', sub: 'Nurture velocity', icon: 'git-network', color: theme.primary },
        { label: 'COST / LEAD', val: reports?.kpis?.costPerLead || '₹420', sub: 'Targeting optimal', icon: 'cash', color: '#F59E0B' },
        { label: 'ROI INDEX', val: reports?.kpis?.roiIndex || '4.8x', sub: 'Projected yield', icon: 'trending-up', color: '#8B5CF6' }
    ];

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: theme.card }}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <View>
                        <Text style={[styles.title, { color: theme.text }]}>Marketing OS</Text>
                        <Text style={[styles.subtitle, { color: theme.textLight }]}>Real-time AI Command Center</Text>
                    </View>
                    <TouchableOpacity style={[styles.neuralPulse, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                        <Ionicons name="sparkles" size={18} color={theme.primary} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView 
                style={styles.container} 
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                <Animated.View style={{ opacity: fadeAnim }}>
                    {/* Top Stats Ribbon */}
                    <View style={styles.kpiGrid}>
                        {kpis.map((kpi, i) => (
                            <View key={i} style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={[styles.kpiIconBox, { backgroundColor: kpi.color + '10' }]}>
                                    <Ionicons name={kpi.icon as any} size={14} color={kpi.color} />
                                </View>
                                <Text style={[styles.kpiLabel, { color: theme.textLight }]}>{kpi.label}</Text>
                                <Text style={[styles.kpiVal, { color: theme.text }]}>{kpi.val}</Text>
                                <Text style={[styles.kpiSub, { color: kpi.color }]}>{kpi.sub}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Auto-Pilot Signal */}
                    <View style={[styles.signalBar, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : '#ECFDF5', borderColor: '#10B98130' }]}>
                        <View style={styles.pulseDot} />
                        <Text style={[styles.signalText, { color: '#059669' }]}>AI AUTO-PILOT IS ORCHESTRATING CAMPAIGNS IN BACKEND</Text>
                    </View>

                    {/* Omnichannel Command Center */}
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>OMNICHANNEL COMMAND</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.channelRow}>
                            {[
                                { n: 'WhatsApp', i: 'logo-whatsapp', c: '#128C7E', s: '85%' },
                                { n: 'SMS (DLT)', i: 'chatbubble-ellipses', c: '#3B82F6', s: 'Connected' },
                                { n: 'Email', i: 'mail', c: '#F59E0B', s: 'SMTP Active' },
                                { n: 'RCS', i: 'flash', c: '#8B5CF6', s: 'In Sandbox' }
                            ].map((ch, i) => (
                                <View key={i} style={styles.channelItem}>
                                    <View style={[styles.channelIcon, { backgroundColor: ch.c + '10' }]}>
                                        <Ionicons name={ch.i as any} size={20} color={ch.c} />
                                    </View>
                                    <Text style={[styles.channelName, { color: theme.text }]}>{ch.n}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ch.c }} />
                                        <Text style={[styles.channelStatus, { color: theme.textLight }]}>{ch.s}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Campaign Performance Reports */}
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>CAMPAIGN PERFORMANCE</Text>
                    {reports?.campaigns?.map((camp: any) => (
                        <TouchableOpacity key={camp.id} style={[styles.campCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.campHeader}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={[styles.campName, { color: theme.text }]}>{camp.name}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: camp.status === 'Active' ? '#10B98120' : theme.border + '50' }]}>
                                            <Text style={[styles.statusText, { color: camp.status === 'Active' ? '#10B981' : theme.textLight }]}>{camp.status.toUpperCase()}</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.campMeta, { color: theme.textLight }]}>Reach: {camp.reach} • ROI: {camp.roi}</Text>
                                </View>
                                <View style={styles.convBox}>
                                    <Text style={[styles.convVal, { color: theme.primary }]}>{camp.conversion}</Text>
                                    <Text style={[styles.convLabel, { color: theme.textMuted }]}>CONV.</Text>
                                </View>
                            </View>
                            <View style={[styles.progressBarBg, { backgroundColor: theme.border + '50' }]}>
                                <View style={[styles.progressBar, { width: camp.conversion, backgroundColor: theme.primary }]} />
                            </View>
                        </TouchableOpacity>
                    ))}

                    {/* Designer Studio */}
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>DESIGNER STUDIO — AI RENDER</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.renderPreview}>
                            <View style={[styles.renderMetadata, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                                <Text style={styles.renderMetaText}>Reel 9:16 · 4K · Kurukshetra S7</Text>
                            </View>
                            <View style={[styles.renderBox, { backgroundColor: theme.background }]}>
                                <Ionicons name="sparkles" size={40} color={theme.primary + '40'} />
                                {isGenerating && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />}
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                            onPress={handleDesignerGen}
                        >
                            <Ionicons name="cog" size={18} color="#fff" />
                            <Text style={styles.actionBtnText}>{isGenerating ? 'AI RENDERING...' : 'TRIGGER DESIGNER AGENT'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 40 }} />
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { 
        paddingHorizontal: 20, 
        paddingVertical: 15, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottomWidth: 1
    },
    title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    neuralPulse: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    kpiCard: { width: (SCREEN_WIDTH - 50) / 2, padding: 15, borderRadius: 20, borderWidth: 1 },
    kpiIconBox: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    kpiLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
    kpiVal: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
    kpiSub: { fontSize: 10, fontWeight: '700' },

    signalBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 10, marginBottom: 25 },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
    signalText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

    sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
    card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 25 },
    channelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    channelItem: { alignItems: 'center', flex: 1 },
    channelIcon: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    channelName: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
    channelStatus: { fontSize: 9, fontWeight: '700' },

    campCard: { padding: 15, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
    campHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    campName: { fontSize: 15, fontWeight: '800' },
    campMeta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    convBox: { alignItems: 'flex-end' },
    convVal: { fontSize: 16, fontWeight: '900' },
    convLabel: { fontSize: 9, fontWeight: '900' },
    progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 3 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    statusText: { fontSize: 9, fontWeight: '900' },

    renderPreview: { height: 200, borderRadius: 20, overflow: 'hidden', marginBottom: 15 },
    renderMetadata: { position: 'absolute', top: 12, left: 12, zIndex: 2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    renderMetaText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    renderBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 18 },
    actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' }
});
