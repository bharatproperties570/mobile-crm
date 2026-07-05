import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, ActivityIndicator, Alert, Dimensions, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { marketingService } from "@/services/marketing.service";
import { getLookups } from "@/services/lookups.service";
import { getProjects } from "@/services/projects.service";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MarketingScreen() {
    const { theme, isDarkMode } = useTheme();
    
    // 🧠 SENIOR PROFESSIONAL: Universal Alert for Web & Native
    const universalAlert = (title: string, message: string) => {
        if (Platform.OS === 'web') {
            alert(`${title}\n\n${message}`);
        } else {
            Alert.alert(title, message);
        }
    };
    const isDark = isDarkMode;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [reports, setReports] = useState<any>(null);
    const [scheduled, setScheduled] = useState<any>({ delayed: [], repeatable: [] });
    const [smsStatus, setSmsStatus] = useState<any>({ connected: false, balance: "0", provider: "SMS" });

    // Filter Data (Lookups)
    const [lookups, setLookups] = useState<any>({
        leadStatus: [],
        leadSource: [],
        dealStage: [],
        professions: [],
        inventoryStatus: []
    });
    const [projects, setProjects] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [audienceCount, setAudienceCount] = useState(0);
    const [isCounting, setIsCounting] = useState(false);
    const [activeFilterModal, setActiveFilterModal] = useState<string | null>(null);
    const [importHeaders, setImportHeaders] = useState<string[]>([]);

    const [form, setForm] = useState<any>({
        name: '',
        channel: 'WhatsApp',
        source: 'Lead',
        filters: {
            status: 'all',
            project: 'all',
            source: 'all',
            recency: 'all',
            city: 'all',
            profession: 'all',
            stage: 'all',
            partyType: 'all',
            minPrice: '',
            maxPrice: '',
            category: 'all',
            subCategory: 'all'
        },
        subject: '',
        content: '',
        templateId: '',
        isScheduled: false,
        scheduledAt: new Date(),
        repeatMode: 'none',
        // Import specific metadata
        fileName: '',
        tempCount: 0,
        mapping: { name: '', mobile: '', email: '' }
    });

    // 🧠 SENIOR PROFESSIONAL: Decouple heavy arrays from form state to prevent re-render jank
    const [tempRecipients, setTempRecipients] = useState<any[]>([]);

    const [showDatePicker, setShowDatePicker] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [statsRes, reportsRes, smsRes, scheduledRes, projectsRes, lStatusRes, lSourceRes, dStageRes, profRes, iStatusRes] = await Promise.allSettled([
                marketingService.getStats(),
                marketingService.getCampaignReports(),
                marketingService.getSmsStatus(),
                marketingService.getScheduledCampaigns(),
                getProjects(),
                getLookups('Status'),
                getLookups('Source'),
                getLookups('Deal-Stage'),
                getLookups('Profession'),
                getLookups('InventoryStatus')
            ]);

            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data || statsRes.value);
            if (reportsRes.status === 'fulfilled') setReports(reportsRes.value.data || reportsRes.value);
            if (smsRes.status === 'fulfilled' && smsRes.value.success) setSmsStatus(smsRes.value);
            if (scheduledRes.status === 'fulfilled') setScheduled(scheduledRes.value.data || scheduledRes.value);
            if (projectsRes.status === 'fulfilled') setProjects(projectsRes.value.data || []);
            
            const newLookups: any = {};
            if (lStatusRes.status === 'fulfilled') newLookups.leadStatus = lStatusRes.value.data || [];
            if (lSourceRes.status === 'fulfilled') newLookups.leadSource = lSourceRes.value.data || [];
            if (dStageRes.status === 'fulfilled') newLookups.dealStage = dStageRes.value.data || [];
            if (profRes.status === 'fulfilled') newLookups.professions = profRes.value.data || [];
            if (iStatusRes.status === 'fulfilled') newLookups.inventoryStatus = iStatusRes.value.data || [];
            setLookups(newLookups);

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

    const fetchTemplates = useCallback(async () => {
        if (!showForm) return;
        setIsLoadingTemplates(true);
        try {
            const res = await marketingService.getTemplates(form.channel);
            // 🧠 SENIOR PROFESSIONAL: Handle diverse backend response shapes
            const list = res.data?.templates || res.templates || res.data || [];
            setTemplates(Array.isArray(list) ? list : []);
        } catch (error) {
            console.error("Failed to fetch templates:", error);
            setTemplates([]);
        } finally {
            setIsLoadingTemplates(false);
        }
    }, [form.channel, showForm]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // Audience Count Sync (Backend Driven)
    useEffect(() => {
        const fetchCount = async () => {
            if (!showForm) return;
            if (form.source === 'Excel') {
                setAudienceCount(form.tempCount || 0);
                return;
            }
            setIsCounting(true);
            try {
                // 🧠 SENIOR PROFESSIONAL: Use the real filter-aware count API
                const res = await marketingService.getAudienceCount(form);
                setAudienceCount(res?.count || 0); 
            } catch (e) {
                console.error("[Marketing] Audience Count Failed:", e);
                setAudienceCount(0);
            } finally {
                setIsCounting(false);
            }
        };
        const timer = setTimeout(fetchCount, 600);
        return () => clearTimeout(timer);
    }, [form.source, form.filters, showForm, form.tempCount]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const [isImporting, setIsImporting] = useState(false);

    const handleFileUpload = async () => {
        // Immediate UI feedback
        setForm((prev: any) => ({ ...prev, source: 'Excel' }));

        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                    'text/csv', 
                    'application/vnd.ms-excel',
                    'application/octet-stream',
                    'text/comma-separated-values'
                ],
                copyToCacheDirectory: true
            });

            if (res.canceled) return;
            setIsImporting(true);

            const file = res.assets[0];
            console.log("[MARKETING] DocumentPicker file:", file);
            const formData = new FormData();
            
            if (Platform.OS === 'web') {
                // On Web, expo-document-picker provides the native File object in the 'file' property
                const webFile = (file as any).file;
                console.log("[MARKETING] Web File Object:", webFile);
                if (webFile) {
                    formData.append('file', webFile);
                } else {
                    // Fallback: try to fetch blob from URI if 'file' property is missing
                    try {
                        const blobRes = await fetch(file.uri);
                        const blob = await blobRes.blob();
                        formData.append('file', blob, file.name);
                    } catch (err) {
                        console.error("[MARKETING] Failed to create blob from URI:", err);
                        formData.append('file', file as any); // Last resort
                    }
                }
            } else {
                // Standardize file attachment for React Native (iOS/Android)
                const fileToUpload = {
                    uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
                    name: file.name || (file.uri.split('/').pop()) || 'import.xlsx',
                    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                };
                
                // Re-add file:// prefix for Android if missing
                if (Platform.OS === 'android' && !fileToUpload.uri.startsWith('file://') && !fileToUpload.uri.startsWith('content://')) {
                    fileToUpload.uri = `file://${fileToUpload.uri}`;
                }
                formData.append('file', fileToUpload as any);
            }

            const result = await marketingService.importAudience(formData);
            
            if (result.success) {
                if (result.recipients && result.recipients.length > 0) {
                    const firstRow = result.recipients[0].context || {};
                    setImportHeaders(Object.keys(firstRow).filter(k => k !== 'originalType'));
                }
                setTempRecipients(result.recipients || []);
                setForm((prev: any) => ({
                    ...prev,
                    source: 'Excel',
                    fileName: file.name,
                    tempCount: result.count
                }));
                universalAlert("Import Success", `Found ${result.count} valid contacts.`);
            } else {
                universalAlert("Import Failed", result.error || "Could not parse the selected file.");
            }
        } catch (error) {
            console.error("FileUpload Error:", error);
            universalAlert("System Error", "Failed to process the selected file.");
        } finally {
            setIsImporting(false);
        }
    };

    const handleLaunchCampaign = async () => {
        console.log("[Marketing] Initiating Launch:", { name: form.name, channel: form.channel, audience: audienceCount });

        if (!form.name || (!form.content && !form.templateId)) {
            universalAlert("Incomplete Data", "Campaign name and content/template are required.");
            return;
        }

        if (audienceCount === 0) {
            universalAlert("Zero Audience", "Your current filters result in 0 recipients. Please adjust filters or check your audience source before launching.");
            return;
        }

        setIsSending(true);
        try {
            // Resolve template metadata for the backend
            const selectedTemplate = templates.find(t => (t.id || t.name) === form.templateId);
            console.log("[Marketing] Selected Template:", selectedTemplate?.name);

            const payload = {
                name: form.name,
                channel: form.channel,
                audienceConfig: { 
                    source: form.source, 
                    filters: form.filters,
                    tempRecipients: tempRecipients,
                    tempCount: form.tempCount,
                    mapping: form.mapping
                },
                subject: form.subject,
                content: form.content,
                templateId: form.templateId,
                templateName: selectedTemplate?.name,
                isScheduled: form.isScheduled,
                scheduledAt: form.isScheduled ? form.scheduledAt.toISOString() : undefined,
                repeatMode: form.repeatMode
            };

            const res = await marketingService.sendCampaign(payload);
            console.log("[Marketing] Dispatch Response:", res);

            if (res.success) {
                universalAlert("Campaign Dispatched", `Successfully orchestrated ${res.leadCount || audienceCount} communications via ${form.channel}.`);
                setShowForm(false);
                setTempRecipients([]);
                setForm({ 
                    name: '', channel: 'WhatsApp', source: 'Lead', 
                    filters: { status: 'all', project: 'all', recency: '' }, 
                    subject: '', content: '', templateId: '', 
                    isScheduled: false, scheduledAt: new Date(), repeatMode: 'none',
                    fileName: '', tempCount: 0, mapping: { name: '', mobile: '', email: '' }
                });
                fetchData();
            } else {
                universalAlert("Launch Failed", res.error || "System error during orchestration.");
            }
        } catch (error: any) {
            console.error("[Marketing] Launch Exception:", error);
            universalAlert("System Error", `Failed to reach the Marketing Engine: ${error.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const kpis = useMemo(() => {
        if (stats?.kpiCards) {
            const icons: any = { 'TOTAL PIPELINE': 'cash', 'ENGAGEMENT': 'flash', 'CONVERSIONS': 'git-network', 'ACTIVITY': 'trending-up' };
            const colors: any = { 'TOTAL PIPELINE': '#3B82F6', 'ENGAGEMENT': '#1DB954', 'CONVERSIONS': '#F59E0B', 'ACTIVITY': '#8B5CF6' };
            
            return stats.kpiCards.map((k: any) => ({
                label: k.label,
                val: k.val,
                sub: k.sub,
                icon: icons[k.label] || 'analytics',
                color: colors[k.label] || theme.primary
            }));
        }
        return [
            { label: 'EFFICIENCY', val: '—', sub: 'Syncing...', icon: 'flash', color: '#1DB954' },
            { label: 'MATCH RATE', val: '—', sub: 'Syncing...', icon: 'git-network', color: theme.primary },
            { label: 'COST / LEAD', val: '—', sub: 'Syncing...', icon: 'cash', color: '#F59E0B' },
            { label: 'ROI INDEX', val: '—', sub: 'Syncing...', icon: 'trending-up', color: '#8B5CF6' }
        ];
    }, [stats, theme.primary]);

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: theme.card }}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <View>
                        <Text style={[styles.title, { color: theme.text }]}>Marketing OS</Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Real-time AI Command Center</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setShowForm(true)}
                        style={[styles.neuralPulse, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    >
                        <Ionicons name="rocket" size={20} color="#fff" />
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
                        {kpis.map((kpi: any, i: number) => (
                            <View key={i} style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={[styles.kpiIconBox, { backgroundColor: kpi.color + '15' }]}>
                                    <Ionicons name={kpi.icon as any} size={14} color={kpi.color} />
                                </View>
                                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{kpi.label}</Text>
                                <Text style={[styles.kpiVal, { color: theme.text }]}>{kpi.val}</Text>
                                <Text style={[styles.kpiSub, { color: kpi.color }]}>{kpi.sub}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Quick Launch CTA */}
                    <TouchableOpacity 
                        style={[styles.launchBanner, { backgroundColor: theme.primary }]}
                        onPress={() => setShowForm(true)}
                    >
                        <View style={styles.launchInfo}>
                            <Text style={styles.launchTitle}>LAUNCH NEW CAMPAIGN</Text>
                            <Text style={styles.launchSub}>Target leads via SMS, WhatsApp & Email</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </TouchableOpacity>

                    {/* Auto-Pilot Signal */}
                    <View style={[styles.signalBar, { backgroundColor: isDark ? 'rgba(29, 185, 84, 0.05)' : '#ECFDF5', borderColor: '#1DB95430' }]}>
                        <View style={styles.pulseDot} />
                        <Text style={[styles.signalText, { color: '#1DB954' }]}>AI AUTO-PILOT IS ORCHESTRATING CAMPAIGNS</Text>
                    </View>

                    {/* Omnichannel Command Center */}
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>OMNICHANNEL COMMAND</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.channelRow}>
                            {[
                                { n: 'WhatsApp', i: 'logo-whatsapp', c: '#1DB954', s: stats?.waMetrics ? `${((stats.waMetrics.read / (stats.waMetrics.sent || 1)) * 100).toFixed(0)}% Read` : 'Connected' },
                                { n: 'SMS (DLT)', i: 'chatbubble-ellipses', c: '#3B82F6', s: smsStatus.balance || 'Connected' },
                                { n: 'Email', i: 'mail', c: '#F59E0B', s: 'SMTP Active' },
                                { n: 'RCS', i: 'flash', c: '#8B5CF6', s: 'Sandboxed' }
                            ].map((ch, i) => (
                                <View key={i} style={styles.channelItem}>
                                    <View style={[styles.channelIcon, { backgroundColor: ch.c + '10' }]}>
                                        <Ionicons name={ch.i as any} size={20} color={ch.c} />
                                    </View>
                                    <Text style={[styles.channelName, { color: theme.text }]}>{ch.n}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ch.c }} />
                                        <Text style={[styles.channelStatus, { color: theme.textSecondary }]}>{ch.s}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Campaign Performance Reports */}
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>RECENT CAMPAIGN PERFORMANCE</Text>
                    {reports?.data?.map((camp: any) => {
                        const unread = Math.max(0, (camp.delivered || 0) - (camp.read || 0));
                        const readRate = camp.sent > 0 ? Math.round((camp.read / camp.sent) * 100) : 0;
                        
                        return (
                            <TouchableOpacity key={camp.id} style={[styles.campCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={styles.campHeader}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={[styles.campName, { color: theme.text }]} numberOfLines={1}>{camp.name}</Text>
                                            <View style={[styles.statusBadge, { backgroundColor: camp.status === 'Completed' ? '#1DB95420' : theme.border + '50' }]}>
                                                <Text style={[styles.statusText, { color: camp.status === 'Completed' ? '#1DB954' : theme.textSecondary }]}>{camp.status?.toUpperCase()}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.campMeta, { color: theme.textSecondary }]}>
                                            Sent: {camp.sent} • Del: {camp.delivered} • <Text style={{ color: theme.primary }}>Read: {camp.read}</Text> • <Text style={{ color: '#EF4444' }}>Unread: {unread}</Text>
                                        </Text>
                                    </View>
                                    <View style={styles.convBox}>
                                        <Text style={[styles.convVal, { color: theme.primary }]}>{readRate}%</Text>
                                        <Text style={[styles.convLabel, { color: theme.textSecondary }]}>READ RATE</Text>
                                    </View>
                                </View>
                                <View style={[styles.progressBarBg, { backgroundColor: theme.border + '50' }]}>
                                    <View style={[styles.progressBar, { width: `${readRate}%`, backgroundColor: theme.primary }]} />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    {(!reports?.data || reports.data.length === 0) && (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Ionicons name="document-text-outline" size={40} color={theme.textSecondary + '40'} />
                            <Text style={{ color: theme.textSecondary, marginTop: 10, fontSize: 13 }}>No campaign history found.</Text>
                        </View>
                    )}

                    {/* Scheduled Orchestrations */}
                    {(scheduled?.delayed?.length > 0 || scheduled?.repeatable?.length > 0) && (
                        <>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>SCHEDULED ORCHESTRATIONS</Text>
                            {[...(scheduled.delayed || []), ...(scheduled.repeatable || [])].map((s: any) => (
                                <View key={s.id} style={[styles.scheduleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <View style={styles.scheduleInfo}>
                                        <Text style={[styles.scheduleName, { color: theme.text }]}>{s.name}</Text>
                                        <Text style={[styles.scheduleMeta, { color: theme.textSecondary }]}>
                                            {s.type === 'repeatable' ? `Cron: ${s.cron}` : `Time: ${new Date(s.scheduledAt).toLocaleString()}`}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: '#8B5CF620' }]}>
                                        <Text style={[styles.statusText, { color: '#8B5CF6' }]}>{s.type === 'repeatable' ? 'RECURRING' : 'PENDING'}</Text>
                                    </View>
                                </View>
                            ))}
                        </>
                    )}

                    <View style={{ height: 100 }} />
                </Animated.View>
            </ScrollView>

            {/* SENIOR PROFESSIONAL CAMPAIGN ORCHESTRATION FORM */}
            <Modal
                visible={showForm}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowForm(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setShowForm(false)}>
                        <Pressable style={[styles.formSheet, { backgroundColor: theme.card }]}>
                            <View style={styles.sheetHeader}>
                                <View style={styles.sheetIndicatorRow}>
                                    <View style={[styles.sheetIndicator, { backgroundColor: theme.border }]} />
                                    <TouchableOpacity 
                                        onPress={() => setShowForm(false)}
                                        style={styles.closeBtn}
                                    >
                                        <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={[styles.sheetTitle, { color: theme.text }]}>Campaign Engine v4.0</Text>
                                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>360° CRM Orchestration • Meta Verified Ready</Text>
                            </View>

                            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                                {/* Step 1: Identity */}
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>CAMPAIGN IDENTITY</Text>
                                <TextInput 
                                    style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                    placeholder="e.g. Sector 7 Plot Blast"
                                    placeholderTextColor={theme.textSecondary + '80'}
                                    value={form.name}
                                    onChangeText={(t) => setForm({...form, name: t})}
                                />

                                {/* Step 2: Audience Source */}
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SMART AUDIENCE SOURCE</Text>
                                <View style={styles.formGrid}>
                                    {[
                                        { id: 'Lead', n: 'Leads', i: '🎯' },
                                        { id: 'Contact', n: 'Contacts', i: '👤' },
                                        { id: 'Deal', n: 'Deals', i: '🤝' },
                                        { id: 'Inventory', n: 'Inventory', i: '🏢' },
                                        { id: 'Excel', n: 'Import', i: '📤' }
                                    ].map(s => (
                                        <TouchableOpacity 
                                            key={s.id}
                                            style={[
                                                styles.sourceChip, 
                                                { backgroundColor: theme.background, borderColor: theme.border },
                                                form.source === s.id && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                                            ]}
                                            onPress={() => s.id === 'Excel' ? handleFileUpload() : setForm({...form, source: s.id})}
                                        >
                                            <Text style={{ fontSize: 20 }}>{s.i}</Text>
                                            <Text style={[styles.typeChipText, { color: form.source === s.id ? theme.primary : theme.text }]}>{s.n}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Step 3: Contextual Filters */}
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>AUDIENCE FILTERS & CONTROL</Text>
                                <View style={[styles.filterContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                    {form.source === 'Lead' && (
                                        <View style={styles.filterGrid}>
                                            <TouchableOpacity style={styles.filterPill} onPress={() => setActiveFilterModal('leadStatus')}>
                                                <Text style={[styles.filterPillText, { color: theme.textSecondary }]}>Stage: </Text>
                                                <Text style={[styles.filterPillVal, { color: theme.text }]}>{form.filters.status === 'all' ? 'All' : 'Selected'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.filterPill} onPress={() => setActiveFilterModal('projects')}>
                                                <Text style={[styles.filterPillText, { color: theme.textSecondary }]}>Project: </Text>
                                                <Text style={[styles.filterPillVal, { color: theme.text }]}>{form.filters.project === 'all' ? 'All' : 'Selected'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.filterPill} onPress={() => setActiveFilterModal('leadSource')}>
                                                <Text style={[styles.filterPillText, { color: theme.textSecondary }]}>Source: </Text>
                                                <Text style={[styles.filterPillVal, { color: theme.text }]}>{form.filters.source === 'all' ? 'All' : 'Selected'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.filterPill}>
                                                <Text style={[styles.filterPillText, { color: theme.textSecondary }]}>Recency: </Text>
                                                <Text style={[styles.filterPillVal, { color: theme.text }]}>Any</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {form.source === 'Deal' && (
                                        <View style={styles.filterGrid}>
                                            <TouchableOpacity style={styles.filterPill} onPress={() => setActiveFilterModal('dealStage')}>
                                                <Text style={[styles.filterPillText, { color: theme.textSecondary }]}>Stage: </Text>
                                                <Text style={[styles.filterPillVal, { color: theme.text }]}>{form.filters.stage === 'all' ? 'All' : 'Selected'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.filterPill}>
                                                <Text style={[styles.filterPillText, { color: theme.textSecondary }]}>Party: </Text>
                                                <Text style={[styles.filterPillVal, { color: theme.text }]}>All</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {form.source === 'Inventory' && (
                                        <View style={styles.filterGrid}>
                                            <TouchableOpacity style={styles.filterPill} onPress={() => setActiveFilterModal('categories')}>
                                                <Text style={[styles.filterPillText, { color: theme.textSecondary }]}>Category: </Text>
                                                <Text style={[styles.filterPillVal, { color: theme.text }]}>{form.filters.category === 'all' ? 'All' : 'Selected'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.filterPill} onPress={() => setActiveFilterModal('subCategories')}>
                                                <Text style={[styles.filterPillText, { color: theme.textSecondary }]}>Sub: </Text>
                                                <Text style={[styles.filterPillVal, { color: theme.text }]}>{form.filters.subCategory === 'all' ? 'All' : 'Selected'}</Text>
                                            </TouchableOpacity>
                                            <View style={{ width: '100%', flexDirection: 'row', gap: 10, marginTop: 5 }}>
                                                <TextInput 
                                                    style={[styles.miniInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                                                    placeholder="Min Price"
                                                    placeholderTextColor={theme.textSecondary + '80'}
                                                    keyboardType="numeric"
                                                    value={form.filters.minPrice}
                                                    onChangeText={(t) => setForm({...form, filters: {...form.filters, minPrice: t}})}
                                                />
                                                <TextInput 
                                                    style={[styles.miniInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                                                    placeholder="Max Price"
                                                    placeholderTextColor={theme.textSecondary + '80'}
                                                    keyboardType="numeric"
                                                    value={form.filters.maxPrice}
                                                    onChangeText={(t) => setForm({...form, filters: {...form.filters, maxPrice: t}})}
                                                />
                                            </View>
                                        </View>
                                    )}

                                    {form.source === 'Excel' && (
                                        <View style={{ gap: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '08', padding: 15, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.primary + '40' }}>
                                                <Ionicons name="document-attach" size={24} color={theme.primary} style={{ marginRight: 12 }} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 13 }}>{form.fileName || 'Select External Dataset'}</Text>
                                                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>
                                                        {form.tempCount ? `${form.tempCount} contacts identified` : 'Supports .csv, .xlsx, .xls'}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity 
                                                    onPress={handleFileUpload} 
                                                    style={{ backgroundColor: theme.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 }}
                                                    disabled={isImporting}
                                                >
                                                    {isImporting ? (
                                                        <ActivityIndicator size="small" color="#fff" />
                                                    ) : (
                                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{form.fileName ? 'CHANGE' : 'BROWSE'}</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>

                                            {importHeaders.length > 0 && form.tempCount > 0 && (
                                                <View style={{ backgroundColor: theme.card, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: theme.border }}>
                                                    <Text style={{ color: theme.text, fontSize: 10, fontWeight: '900', marginBottom: 12, opacity: 0.7 }}>⚙️ COLUMN MAPPING (MANUAL OVERRIDE)</Text>
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        {['name', 'mobile', 'email'].map((key) => (
                                                            <View key={key} style={{ flex: 1 }}>
                                                                <Text style={{ color: theme.textSecondary, fontSize: 9, fontWeight: '800', marginBottom: 5 }}>{key.toUpperCase()}</Text>
                                                                <View style={{ backgroundColor: theme.background, borderRadius: 8, borderWidth: 1, borderColor: theme.border, height: 36, justifyContent: 'center' }}>
                                                                    <TextInput 
                                                                        style={{ color: theme.text, fontSize: 10, paddingHorizontal: 8, fontWeight: '700' }}
                                                                        placeholder="Auto"
                                                                        placeholderTextColor={theme.textSecondary + '60'}
                                                                        value={form.mapping[key]}
                                                                        onChangeText={(v) => setForm({...form, mapping: {...form.mapping, [key]: v}})}
                                                                    />
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </View>
                                                    <Text style={{ color: theme.textSecondary, fontSize: 9, marginTop: 10, fontStyle: 'italic' }}>Tip: Enter the exact column name from your file to override auto-matching.</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    <View style={[styles.audiencePill, { backgroundColor: '#35b97a20', borderColor: '#35b97a40', marginTop: 10 }]}>
                                        <Ionicons name="people" size={14} color="#35b97a" style={{ marginRight: 6 }} />
                                        <Text style={{ color: '#35b97a', fontSize: 11, fontWeight: '900' }}>
                                            {isCounting ? 'SYNCING...' : `${audienceCount.toLocaleString()} TARGET RECIPIENTS`}
                                        </Text>
                                    </View>
                                </View>

                                {/* Step 4: Channel Selector */}
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>ORCHESTRATION CHANNEL</Text>
                                <View style={styles.formGrid}>
                                    {['WhatsApp', 'SMS', 'Email'].map(ch => (
                                        <TouchableOpacity 
                                            key={ch}
                                            style={[
                                                styles.typeChip, 
                                                { backgroundColor: theme.background, borderColor: theme.border },
                                                form.channel === ch && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                                            ]}
                                            onPress={() => setForm({...form, channel: ch})}
                                        >
                                            <Ionicons 
                                                name={ch === 'WhatsApp' ? 'logo-whatsapp' : (ch === 'SMS' ? 'chatbubble-ellipses' : 'mail')} 
                                                size={16} 
                                                color={form.channel === ch ? theme.primary : theme.textSecondary} 
                                            />
                                            <Text style={[styles.typeChipText, { color: form.channel === ch ? theme.primary : theme.textSecondary }]}>{ch}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Step 5: Templates / Content */}
                                {(form.channel === 'WhatsApp' || form.channel === 'SMS' || form.channel === 'Email') && (
                                    <>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{form.channel.toUpperCase() === 'WHATSAPP' ? 'META VERIFIED' : 'DLT'} TEMPLATE</Text>
                                            <TouchableOpacity onPress={fetchTemplates} style={{ marginTop: 10 }}>
                                                <Ionicons name="refresh" size={14} color={theme.primary} />
                                            </TouchableOpacity>
                                        </View>
                                        {isLoadingTemplates ? (
                                            <ActivityIndicator color={theme.primary} style={{ marginVertical: 10 }} />
                                        ) : (
                                            <ScrollView 
                                                horizontal 
                                                showsHorizontalScrollIndicator={false} 
                                                style={{ marginBottom: 10 }}
                                                contentContainerStyle={{ paddingRight: 20 }}
                                            >
                                                {templates.map((t, i) => (
                                                    <TouchableOpacity 
                                                        key={i}
                                                        style={[
                                                            styles.templateChip,
                                                            { backgroundColor: theme.background, borderColor: theme.border },
                                                            form.templateId === (t.id || t.name) && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }
                                                        ]}
                                                        onPress={() => {
                                                            const bodyContent = t.body || t.content || t.message || '';
                                                            setForm({
                                                                ...form, 
                                                                templateId: t.id || t.name,
                                                                content: bodyContent
                                                            });
                                                        }}
                                                    >
                                                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{t.name}</Text>
                                                        <Text numberOfLines={2} style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4 }}>{t.body || t.content || t.message || 'Template message content...'}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                {templates.length === 0 && <Text style={{ color: theme.textSecondary, fontSize: 12, marginVertical: 10 }}>No templates found. Click refresh.</Text>}
                                            </ScrollView>
                                        )}
                                    </>
                                )}

                                {form.channel === 'Email' && (
                                    <>
                                        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EMAIL SUBJECT</Text>
                                        <TextInput 
                                            style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                            placeholder="Catchy subject line..."
                                            placeholderTextColor={theme.textSecondary + '80'}
                                            value={form.subject}
                                            onChangeText={(t) => setForm({...form, subject: t})}
                                        />
                                    </>
                                )}

                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>MESSAGE CONTENT</Text>
                                <TextInput 
                                    style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, height: 100, textAlignVertical: 'top' }]}
                                    placeholder="Write your campaign message here..."
                                    placeholderTextColor={theme.textSecondary + '80'}
                                    multiline
                                    value={form.content}
                                    onChangeText={(t) => setForm({...form, content: t})}
                                />

                                {/* Step 6: Scheduling */}
                                <View style={[styles.scheduleContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Ionicons name="calendar-outline" size={18} color={form.isScheduled ? theme.primary : theme.textSecondary} />
                                            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Schedule Campaign</Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => setForm({...form, isScheduled: !form.isScheduled})}
                                            style={[styles.toggle, { backgroundColor: form.isScheduled ? theme.primary : theme.border }]}
                                        >
                                            <View style={[styles.toggleDot, { transform: [{ translateX: form.isScheduled ? 18 : 0 }] }]} />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    {form.isScheduled && (
                                        <View style={{ marginTop: 15, flexDirection: 'row', gap: 10 }}>
                                            <TouchableOpacity 
                                                onPress={() => setShowDatePicker(true)}
                                                style={[styles.datePickerBtn, { borderColor: theme.border }]}
                                            >
                                                <Text style={{ color: theme.text, fontSize: 12 }}>{form.scheduledAt.toLocaleString()}</Text>
                                            </TouchableOpacity>
                                            <View style={[styles.datePickerBtn, { borderColor: theme.border, flex: 0.5 }]}>
                                                <Text style={{ color: theme.text, fontSize: 12 }}>{form.repeatMode.toUpperCase()}</Text>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                {showDatePicker && (
                                    <DateTimePicker
                                        value={form.scheduledAt}
                                        mode="datetime"
                                        display="default"
                                        onChange={(e, date) => {
                                            setShowDatePicker(false);
                                            if (date) setForm({...form, scheduledAt: date});
                                        }}
                                    />
                                )}

                                <TouchableOpacity 
                                    style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                                    onPress={handleLaunchCampaign}
                                    disabled={isSending}
                                >
                                    {isSending ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="paper-plane" size={20} color="#fff" />
                                            <Text style={styles.submitBtnText}>LAUNCH ORCHESTRATION</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <View style={{ height: 50 }} />
                            </ScrollView>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {/* FILTER SELECTION MODAL */}
            <Modal
                visible={!!activeFilterModal}
                transparent={true}
                animationType="fade"
            >
                <Pressable style={styles.filterModalOverlay} onPress={() => setActiveFilterModal(null)}>
                    <View style={[styles.filterListSheet, { backgroundColor: theme.card }]}>
                        <Text style={[styles.filterSheetTitle, { color: theme.text }]}>Select {activeFilterModal?.replace('lead', 'Lead ')}</Text>
                        <ScrollView>
                            <TouchableOpacity 
                                style={styles.filterItem} 
                                onPress={() => {
                                    const mapping: any = { 
                                        leadStatus: 'status', projects: 'project', leadSource: 'source', 
                                        dealStage: 'stage', categories: 'category', subCategories: 'subCategory' 
                                    };
                                    const key = mapping[activeFilterModal || ''];
                                    if (key) setForm({...form, filters: {...form.filters, [key]: 'all'}});
                                    setActiveFilterModal(null);
                                }}
                            >
                                <Text style={{ color: theme.text }}>🎯 All Options</Text>
                            </TouchableOpacity>
                            {(activeFilterModal === 'leadStatus' ? lookups.leadStatus : 
                              activeFilterModal === 'projects' ? projects : 
                              activeFilterModal === 'leadSource' ? lookups.leadSource :
                              activeFilterModal === 'dealStage' ? lookups.dealStage :
                              activeFilterModal === 'categories' ? (lookups.categories || []) :
                              (lookups.subCategories || [])).map((item: any) => (
                                <TouchableOpacity 
                                    key={item._id || item.id} 
                                    style={styles.filterItem}
                                    onPress={() => {
                                        const mapping: any = { 
                                            leadStatus: 'status', projects: 'project', leadSource: 'source', 
                                            dealStage: 'stage', categories: 'category', subCategories: 'subCategory' 
                                        };
                                        const key = mapping[activeFilterModal || ''];
                                        if (key) setForm({...form, filters: {...form.filters, [key]: item._id || item.id}});
                                        setActiveFilterModal(null);
                                    }}
                                >
                                    <Text style={{ color: theme.text }}>{item.lookup_value || item.name || item.projectName}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
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
    title: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
    subtitle: { fontSize: 13, fontWeight: '700' },
    neuralPulse: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    kpiCard: { width: (SCREEN_WIDTH - 50) / 2, padding: 15, borderRadius: 24, borderWidth: 1 },
    kpiIconBox: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    kpiLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
    kpiVal: { fontSize: 24, fontWeight: '900', marginBottom: 2 },
    kpiSub: { fontSize: 10, fontWeight: '700' },

    launchBanner: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: 20, 
        borderRadius: 24, 
        marginBottom: 25,
        shadowColor: '#1DB954',
        shadowOpacity: 0.3,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 }
    },
    launchInfo: { flex: 1 },
    launchTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
    launchSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginTop: 4 },

    signalBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 10, marginBottom: 25 },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1DB954' },
    signalText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

    sectionTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
    card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 25 },
    channelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    channelItem: { alignItems: 'center', flex: 1 },
    channelIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    channelName: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
    channelStatus: { fontSize: 10, fontWeight: '700' },

    campCard: { padding: 18, borderRadius: 24, borderWidth: 1, marginBottom: 12 },
    campHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    campName: { fontSize: 16, fontWeight: '800' },
    campMeta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    convBox: { alignItems: 'flex-end' },
    convVal: { fontSize: 18, fontWeight: '900' },
    convLabel: { fontSize: 10, fontWeight: '900' },
    progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 4 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '900' },

    scheduleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 10 },
    scheduleInfo: { flex: 1 },
    scheduleName: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
    scheduleMeta: { fontSize: 11, fontWeight: '600' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    formSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '95%' },
    sheetHeader: { alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    sheetIndicatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 10 },
    sheetIndicator: { width: 40, height: 4, borderRadius: 2 },
    closeBtn: { position: 'absolute', right: 0 },
    sheetTitle: { fontSize: 22, fontWeight: '900' },
    sheetSub: { fontSize: 11, fontWeight: '700', marginTop: 4 },

    inputLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
    textInput: { borderRadius: 16, borderWidth: 1, padding: 16, fontSize: 15, fontWeight: '600' },
    formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 5 },
    typeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
    sourceChip: { padding: 12, borderRadius: 16, borderWidth: 1, width: (SCREEN_WIDTH - 70) / 5, alignItems: 'center', gap: 4 },
    typeChipText: { fontSize: 10, fontWeight: '800' },
    miniInput: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 8, fontSize: 12, fontWeight: '600' },
    
    filterContainer: { padding: 15, borderRadius: 20, borderWidth: 1 },
    filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterPill: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    filterPillText: { fontSize: 10, fontWeight: '700' },
    filterPillVal: { fontSize: 10, fontWeight: '900' },
    audiencePill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
    
    templateChip: { padding: 12, borderRadius: 14, borderWidth: 1, width: 160, marginRight: 10 },
    
    scheduleContainer: { padding: 16, borderRadius: 20, borderWidth: 1, marginTop: 20 },
    toggle: { width: 36, height: 18, borderRadius: 10, padding: 2 },
    toggleDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },
    datePickerBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },

    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18, borderRadius: 20, marginTop: 30 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

    filterModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 30 },
    filterListSheet: { width: '100%', maxHeight: '70%', borderRadius: 24, padding: 20 },
    filterSheetTitle: { fontSize: 18, fontWeight: '900', marginBottom: 20 },
    filterItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }
});
