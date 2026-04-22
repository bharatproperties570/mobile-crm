import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    Animated, ActivityIndicator, RefreshControl, TextInput,
    Dimensions, Modal, Pressable, Alert, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { getMessagingStream, sendReply } from '@/services/activities.service';
import { getEmails, getAiConversations, updateAiConversationStatus, getOAuthUrl } from '@/services/communication.service';
import { safeApiCall } from '@/services/api.helpers';
import * as Linking from 'expo-linking';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CHANNELS = [
    { id: 'all', label: 'All', icon: 'globe-outline', color: '#6366f1' },
    { id: 'AI', label: 'AI Bot', icon: 'chatbox-ellipses-outline', color: '#8b5cf6' },
    { id: 'Voice', label: 'Voice', icon: 'call-outline', color: '#ec4899' },
    { id: 'WhatsApp', label: 'WhatsApp', icon: 'logo-whatsapp', color: '#22c55e' },
    { id: 'SMS', label: 'SMS', icon: 'phone-portrait-outline', color: '#f59e0b' },
    { id: 'Email', label: 'Email', icon: 'mail-outline', color: '#0ea5e9' },
];

const OUTCOME_COLOR: any = { Read: '#059669', Sent: '#0284c7', Delivered: '#0284c7', Failed: '#ef4444', Received: '#059669' };

function formatTimeAgo(d: string) {
    if (!d) return '—';
    const ms = Date.now() - new Date(d).getTime();
    if (isNaN(ms)) return '—';
    if (ms < 60000) return 'Just now';
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getInitials(n = '') {
    return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

export default function CommunicationHub() {
    const { theme, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const isDark = isDarkMode;
    
    const [channel, setChannel] = useState('all');
    const [subTab, setSubTab] = useState('all'); // all | matched | unmatched
    const [activities, setActivities] = useState<any[]>([]);
    const [emails, setEmails] = useState<any[]>([]);
    const [aiConvos, setAiConvos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchAll = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        else setRefreshing(true);

        try {
            const [msgRes, aiRes] = await Promise.all([
                safeApiCall(() => getMessagingStream()),
                safeApiCall(() => getAiConversations())
            ]);

            if (msgRes.data) {
                const mapped = msgRes.data.map((act: any) => ({
                    id: act._id,
                    participant: act.participant || act.details?.senderName || act.details?.from || 'Unknown',
                    via: act.via || (act.platform === 'whatsapp' ? 'WhatsApp' : (act.type === 'Call' ? 'Voice' : 'SMS')),
                    type: act.type || 'Messaging',
                    subject: act.subject || act.details?.message || act.description || '',
                    outcome: act.outcome || act.status || 'Delivered',
                    date: act.date || act.timestamp || act.createdAt,
                    isMatched: !!(act.entityId || act.relatedTo?.length),
                    phone: act.phone || act.phoneNumber || act.details?.from,
                    thread: act.thread || []
                }));
                setActivities(mapped);
            }

            if (aiRes.data) {
                const mappedAI = aiRes.data.map((conv: any) => ({
                    id: conv._id,
                    participant: conv.lead ? `${conv.lead.firstName} ${conv.lead.lastName}` : (conv.contact ? `${conv.contact.firstName} ${conv.contact.lastName}` : 'Unmatched'),
                    via: 'AI',
                    subject: conv.messages?.[conv.messages.length - 1]?.content || 'AI Session Active',
                    date: conv.updatedAt,
                    isMatched: !!(conv.lead || conv.contact),
                    status: conv.status,
                    messages: conv.messages
                }));
                setAiConvos(mappedAI);
            }

            // Force fetch emails if manually refreshing or channel is selected or first load
            if (isRefresh || channel === 'Email' || emails.length === 0) {
                const emailRes = await safeApiCall(() => getEmails({ limit: 20 }));
                const rawEmails = Array.isArray(emailRes.data) ? emailRes.data : (emailRes.data?.emails || []);

                if (Array.isArray(rawEmails)) {
                    const mappedEmails = rawEmails.map((e: any) => ({
                        id: e.id || e.uid,
                        participant: e.fromName || e.from || 'Unknown',
                        via: 'Email',
                        subject: e.subject || '(no subject)',
                        date: e.date,
                        isMatched: !!e.associated,
                        outcome: 'Received',
                        snippet: e.snippet
                    }));
                    setEmails(mappedEmails);
                    setEmailError(null);
                } else if (emailRes.error) {
                    setEmailError('oauth');
                }
            }

        } catch (e) {
            console.error("[CommHub] Fetch error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }
    }, [channel, emails.length]);

    useEffect(() => {
        fetchAll();
    }, []);

    const filteredItems = useMemo(() => {
        let base: any[] = [];
        if (channel === 'all') base = [...activities, ...emails, ...aiConvos];
        else if (channel === 'AI') base = aiConvos;
        else if (channel === 'Email') base = emails;
        else base = activities.filter(a => a.via === channel);

        // Sorting by date
        base.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Sub-tabs
        if (subTab === 'matched') base = base.filter(i => i.isMatched);
        else if (subTab === 'unmatched') base = base.filter(i => !i.isMatched);

        // Search
        if (searchQ.trim()) {
            const q = searchQ.toLowerCase();
            base = base.filter(i => 
                (i.participant || '').toLowerCase().includes(q) || 
                (i.subject || '').toLowerCase().includes(q)
            );
        }

        // Deduplicate using a Set to prevent FlatList key errors
        const seen = new Set();
        return base.filter(i => {
            const uniqueId = `${i.id}_${i.via}`;
            if (seen.has(uniqueId)) return false;
            seen.add(uniqueId);
            return true;
        });
    }, [channel, subTab, activities, emails, aiConvos, searchQ]);

    const kpis = useMemo(() => ({
        total: activities.length + emails.length + aiConvos.length,
        matched: [
            ...activities.filter(a => a.isMatched),
            ...emails.filter(e => e.isMatched),
            ...aiConvos.filter(c => c.isMatched)
        ].length,
        ai: aiConvos.length,
        failed: activities.filter(a => a.outcome === 'Failed').length
    }), [activities, emails, aiConvos]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Professional Header */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border, paddingTop: Math.max((insets?.top ?? 0) + 15, 45) }]}>
                <View style={styles.topRow}>
                    <View>
                        <Text style={[styles.title, { color: theme.text }]}>Communication Hub</Text>
                        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Unified Enterprise Stream</Text>
                    </View>
                    <TouchableOpacity onPress={() => fetchAll(true)} style={[styles.refreshBtn, { backgroundColor: theme.primary + '15' }]}>
                        <Ionicons name="refresh" size={18} color={theme.primary} />
                    </TouchableOpacity>
                </View>

                {/* KPI Bar */}
                <View style={styles.kpiRow}>
                    <KPIItem label="Total" value={kpis.total} color={theme.primary} icon="globe" theme={theme} />
                    <KPIItem label="Matched" value={kpis.matched} color="#10B981" icon="link" theme={theme} />
                    <KPIItem label="AI" value={kpis.ai} color="#8B5CF6" icon="airplane" theme={theme} />
                    <KPIItem label="Failed" value={kpis.failed} color="#EF4444" icon="alert-circle" theme={theme} />
                </View>

                {/* Channel Switcher */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelScroll}>
                    {CHANNELS.map(ch => (
                        <TouchableOpacity 
                            key={ch.id} 
                            onPress={() => setChannel(ch.id)}
                            style={[
                                styles.channelTab, 
                                channel === ch.id ? { backgroundColor: ch.color, borderColor: ch.color } : { backgroundColor: theme.background, borderColor: theme.border }
                            ]}
                        >
                            <Ionicons name={ch.icon as any} size={16} color={channel === ch.id ? '#fff' : theme.textMuted} />
                            <Text style={[styles.channelText, { color: channel === ch.id ? '#fff' : theme.textSecondary }]}>{ch.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Sub-Tabs and Search */}
                <View style={styles.filterRow}>
                    <View style={styles.subTabs}>
                        <SubTab label="All" active={subTab === 'all'} onPress={() => setSubTab('all')} theme={theme} />
                        <SubTab label="Matched" active={subTab === 'matched'} onPress={() => setSubTab('matched')} theme={theme} />
                        <SubTab label="Unmatched" active={subTab === 'unmatched'} onPress={() => setSubTab('unmatched')} theme={theme} />
                    </View>
                    <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Ionicons name="search" size={14} color={theme.textMuted} />
                        <TextInput 
                            value={searchQ}
                            onChangeText={setSearchQ}
                            placeholder="Filter..."
                            placeholderTextColor={theme.textMuted}
                            style={[styles.searchInput, { color: theme.text }]}
                        />
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Syncing Omnichannel Stream...</Text>
                </View>
            ) : (
                <FlatList 
                    data={filteredItems}
                    keyExtractor={item => `${item.id}_${item.via}`}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={theme.primary} />}
                    renderItem={({ item }) => (
                                <InboxRow 
                                    item={item} 
                                    theme={theme} 
                                    isDark={isDark} 
                                    onPress={() => setSelectedItem(item)}
                                />
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={64} color={theme.primary + '20'} />
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Conversations</Text>
                            <Text style={[styles.emptySub, { color: theme.textMuted }]}>This channel is currently silent.</Text>
                            <TouchableOpacity onPress={() => fetchAll(true)} style={[styles.refreshEmptyBtn, { backgroundColor: theme.primary }]}>
                                <Text style={{ color: '#fff', fontWeight: '800' }}>Refresh Stream</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
            
            {/* Quick Action Modal */}
            <Modal
                visible={!!selectedItem}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedItem(null)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setSelectedItem(null)}>
                    <View style={[styles.actionSheet, { backgroundColor: theme.card }]}>
                        <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
                            <View style={[styles.sheetIndicator, { backgroundColor: theme.border }]} />
                            <Text style={[styles.sheetTitle, { color: theme.text }]}>{selectedItem?.participant}</Text>
                            <Text style={[styles.sheetSub, { color: theme.textMuted }]}>{selectedItem?.via} • {selectedItem?.phone || 'No Phone'}</Text>
                        </View>

                        <View style={styles.sheetBody}>
                            {selectedItem?.isMatched ? (
                                <ActionBtn 
                                    icon="eye-outline" 
                                    label="View Details in CRM" 
                                    onPress={() => {
                                        setSelectedItem(null);
                                        // Logic to navigate based on type
                                        Alert.alert("Navigation", "Navigating to linked record...");
                                    }} 
                                    theme={theme} 
                                />
                            ) : (
                                <>
                                    <ActionBtn 
                                        icon="person-add-outline" 
                                        label="Create New Lead" 
                                        color="#6366f1"
                                        onPress={() => {
                                            const item = selectedItem;
                                            setSelectedItem(null);
                                            router.push({
                                                pathname: "/add-lead",
                                                params: { 
                                                    mobile: item.phone || '', 
                                                    firstName: item.participant !== 'Unknown' ? item.participant.split(' ')[0] : '',
                                                    lastName: item.participant.split(' ').slice(1).join(' ') || ''
                                                }
                                            });
                                        }} 
                                        theme={theme} 
                                    />
                                    <ActionBtn 
                                        icon="business-outline" 
                                        label="Add as Inventory Owner" 
                                        color="#ec4899"
                                        onPress={() => {
                                            const item = selectedItem;
                                            setSelectedItem(null);
                                            router.push({
                                                pathname: "/add-contact",
                                                params: { 
                                                    mobile: item.phone || '',
                                                    name: item.participant 
                                                }
                                            });
                                        }} 
                                        theme={theme} 
                                    />
                                    <ActionBtn 
                                        icon="rocket-outline" 
                                        label="Open New Deal" 
                                        color="#f59e0b"
                                        onPress={() => {
                                            const item = selectedItem;
                                            setSelectedItem(null);
                                            router.push({
                                                pathname: "/add-deal",
                                                params: { 
                                                    partyName: item.participant,
                                                    partyPhone: item.phone || ''
                                                }
                                            });
                                        }} 
                                        theme={theme} 
                                    />
                                </>
                            )}
                            
                            {selectedItem?.via === 'AI' && (
                                <ActionBtn 
                                    icon="hand-right-outline" 
                                    label="AI Takeover" 
                                    color="#8b5cf6"
                                    onPress={() => {
                                        setSelectedItem(null);
                                        Alert.alert("AI Takeover", "Transferring conversation to manual mode...");
                                    }} 
                                    theme={theme} 
                                />
                            )}

                            <ActionBtn 
                                icon="close-outline" 
                                label="Cancel" 
                                isCancel
                                onPress={() => setSelectedItem(null)} 
                                theme={theme} 
                            />
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

function KPIItem({ label, value, color, icon, theme }: any) {
    return (
        <View style={[styles.kpiItem, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={[styles.kpiIcon, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={14} color={color} />
            </View>
            <View>
                <Text style={[styles.kpiValue, { color }]}>{value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>{label}</Text>
            </View>
        </View>
    );
}

function SubTab({ label, active, onPress, theme }: any) {
    return (
        <TouchableOpacity 
            onPress={onPress}
            style={[styles.subTab, active && { borderBottomColor: theme.primary }]}
        >
            <Text style={[styles.subTabText, { color: active ? theme.primary : theme.textMuted }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function ActionBtn({ icon, label, onPress, theme, color, isCancel }: any) {
    return (
        <TouchableOpacity 
            onPress={onPress} 
            style={[
                styles.actionBtn, 
                { backgroundColor: theme.background, borderColor: theme.border },
                isCancel && { marginTop: 10, backgroundColor: '#EF444410', borderColor: '#EF4444' }
            ]}
        >
            <Ionicons name={icon} size={20} color={color || (isCancel ? '#EF4444' : theme.text)} />
            <Text style={[styles.actionLabel, { color: isCancel ? '#EF4444' : theme.text }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function InboxRow({ item, theme, isDark, onPress }: any) {
    const ch = CHANNELS.find(c => c.id === item.via) || CHANNELS[0];
    const outcomeColor = OUTCOME_COLOR[item.outcome] || theme.textMuted;

    return (
        <TouchableOpacity 
            onPress={onPress}
            style={[styles.inboxRow, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
            <View style={[styles.avatar, { backgroundColor: ch.color + '15', borderColor: ch.color + '30' }]}>
                <Text style={[styles.avatarText, { color: ch.color }]}>{getInitials(item.participant)}</Text>
                <View style={[styles.channelIconSmall, { backgroundColor: ch.color }]}>
                    <Ionicons name={ch.icon as any} size={8} color="#fff" />
                </View>
            </View>

            <View style={styles.rowContent}>
                <View style={styles.rowTop}>
                    <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.participant}</Text>
                    <Text style={[styles.rowTime, { color: theme.textMuted }]}>{formatTimeAgo(item.date)}</Text>
                </View>
                <Text style={[styles.rowSubject, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.subject || '(No message content)'}
                </Text>
                <View style={styles.rowMeta}>
                    {item.isMatched && (
                        <View style={[styles.matchedBadge, { backgroundColor: '#22C55E15' }]}>
                            <Ionicons name="link" size={10} color="#22C55E" />
                            <Text style={styles.matchedText}>CRM</Text>
                        </View>
                    )}
                    <View style={[styles.outcomeBadge, { backgroundColor: outcomeColor + '10' }]}>
                        <Text style={[styles.outcomeText, { color: outcomeColor }]}>{item.outcome}</Text>
                    </View>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.textMuted} style={styles.chevron} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    header: { padding: 18, borderBottomWidth: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    refreshBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    
    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    kpiItem: { flex: 1, padding: 8, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    kpiIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    kpiValue: { fontSize: 14, fontWeight: '800' },
    kpiLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },

    channelScroll: { gap: 10, paddingRight: 20, marginBottom: 15 },
    channelTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 6 },
    channelText: { fontSize: 12, fontWeight: '800' },

    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    subTabs: { flexDirection: 'row', gap: 12, flex: 1 },
    subTab: { paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    subTabText: { fontSize: 13, fontWeight: '700' },
    searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 32, borderRadius: 10, borderWidth: 1, width: 120 },
    searchInput: { flex: 1, fontSize: 12, fontWeight: '600', padding: 0, marginLeft: 6 },

    listContent: { padding: 18, paddingBottom: 100 },
    inboxRow: { flexDirection: 'row', padding: 15, borderRadius: 20, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
    avatar: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 18, fontWeight: '800' },
    channelIconSmall: { position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    rowContent: { flex: 1, marginLeft: 15 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    rowName: { fontSize: 15, fontWeight: '800' },
    rowTime: { fontSize: 11, fontWeight: '600' },
    rowSubject: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
    rowMeta: { flexDirection: 'row', gap: 8 },
    matchedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    matchedText: { fontSize: 9, fontWeight: '800', color: '#22C55E' },
    outcomeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    outcomeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
    chevron: { marginLeft: 10 },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, fontSize: 14, fontWeight: '700' },
    
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 20 },
    emptySub: { fontSize: 14, fontWeight: '600', marginTop: 10, textAlign: 'center' },
    refreshEmptyBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    actionSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40 },
    sheetHeader: { alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    sheetIndicator: { width: 40, height: 4, borderRadius: 2, marginBottom: 15 },
    sheetTitle: { fontSize: 20, fontWeight: '800' },
    sheetSub: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    sheetBody: { padding: 20, gap: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
    actionLabel: { fontSize: 15, fontWeight: '800' },
});
