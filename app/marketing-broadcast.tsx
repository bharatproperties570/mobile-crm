import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Animated, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import api from '@/services/api';
import { getDealById } from '@/services/deals.service';
import { getCompanyGroups, type CompanyGroup } from '@/services/companyGroups.service';
import * as Haptics from 'expo-haptics';

export default function MarketingBroadcastScreen() {
    const { dealId } = useLocalSearchParams<{ dealId: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [deal, setDeal] = useState<any>(null);
    const [groups, setGroups] = useState<CompanyGroup[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [registry, setRegistry] = useState<any>({});
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [channels, setChannels] = useState({ whatsapp: true, email: false });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [dealRes, groupsRes, templatesRes, registryRes] = await Promise.all([
                    getDealById(dealId as string),
                    getCompanyGroups(),
                    api.get('/marketing/whatsapp/templates'),
                    api.get('/marketing/whatsapp/variable-registry').catch(() => ({ data: { data: { "1": "customer_name", "2": "property_list_default" } } }))
                ]);
                
                setDeal(dealRes.data.data || dealRes.data || dealRes);
                setGroups(groupsRes.data.data || []);
                
                const approved = (templatesRes.data.templates || []).filter((t: any) => t.status === 'APPROVED');
                setTemplates(approved);
                setRegistry(registryRes.data?.data || {});
            } catch (error) {
                console.error("Fetch error:", error);
                Alert.alert("Error", "Could not load broadcast details.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dealId]);

    const toggleGroup = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedGroups(prev => 
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const handleLaunch = async () => {
        if (selectedGroups.length === 0) {
            Alert.alert("Target Missing", "Please select at least one broker group.");
            return;
        }

        const selectedChannels = Object.entries(channels)
            .filter(([_, val]) => val)
            .map(([key]) => key);

        if (selectedChannels.length === 0) {
            Alert.alert("Channel Missing", "Please select at least one channel (WhatsApp/Email).");
            return;
        }

        setSending(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            const res = await api.post('/marketing/broadcast/bna', {
                dealId,
                groupIds: selectedGroups,
                channels: selectedChannels,
                templateId: selectedTemplate?.name,
                language: selectedTemplate?.language
            });

            if (res.data.success) {
                Alert.alert(
                    "Success", 
                    `Broadcast launched successfully to ${res.data.dispatchCount} brokers.`,
                    [{ text: "Great", onPress: () => router.back() }]
                );
            }
        } catch (error: any) {
            Alert.alert("Broadcast Failed", error.response?.data?.error || "System error during distribution.");
        } finally {
            setSending(false);
        }
    };

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    const meta = deal?.broadcastMetadata;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Broadcast Deal</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Deal Summary Card */}
                <View style={[styles.dealCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.dealTitle, { color: theme.text }]}>{meta?.title || deal?.unitNo}</Text>
                    <Text style={[styles.dealPrice, { color: theme.primary }]}>{meta?.price || 'Price TBA'}</Text>
                    <View style={styles.locRow}>
                        <Ionicons name="location" size={14} color={theme.textLight} />
                        <Text style={[styles.locText, { color: theme.textLight }]}>{meta?.location}</Text>
                    </View>
                </View>

                {/* Group Selector */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.textLight }]}>SELECT BROKER GROUPS</Text>
                    {groups.length === 0 ? (
                        <Text style={{ color: theme.textLight, fontStyle: 'italic' }}>No groups found. Create one in Companies tab.</Text>
                    ) : (
                        <View style={styles.groupsContainer}>
                            {groups.map(group => (
                                <TouchableOpacity 
                                    key={group._id}
                                    style={[
                                        styles.groupBtn, 
                                        { backgroundColor: selectedGroups.includes(group._id) ? theme.primary : (isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc') },
                                        { borderColor: selectedGroups.includes(group._id) ? theme.primary : theme.border }
                                    ]}
                                    onPress={() => toggleGroup(group._id)}
                                >
                                    <Ionicons 
                                        name={selectedGroups.includes(group._id) ? "checkbox" : "square-outline"} 
                                        size={20} 
                                        color={selectedGroups.includes(group._id) ? "#fff" : theme.textLight} 
                                    />
                                    <Text style={[styles.groupName, { color: selectedGroups.includes(group._id) ? "#fff" : theme.text }]}>{group.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Channel Selector */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.textLight }]}>DISTRIBUTION CHANNELS</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.channelRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Ionicons name="logo-whatsapp" size={24} color="#128C7E" />
                                <Text style={[styles.channelLabel, { color: theme.text }]}>WhatsApp Business</Text>
                            </View>
                            <Switch 
                                value={channels.whatsapp} 
                                onValueChange={(val) => setChannels({ ...channels, whatsapp: val })}
                                trackColor={{ false: "#767577", true: theme.primary }}
                            />
                        </View>
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <View style={styles.channelRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Ionicons name="mail" size={24} color="#EF4444" />
                                <Text style={[styles.channelLabel, { color: theme.text }]}>Professional Email</Text>
                            </View>
                            <Switch 
                                value={channels.email} 
                                onValueChange={(val) => setChannels({ ...channels, email: val })}
                                trackColor={{ false: "#767577", true: theme.primary }}
                            />
                        </View>
                    </View>
                </View>

                {/* Template Selection */}
                {channels.whatsapp && templates.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.textLight }]}>WHATSAPP TEMPLATE</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
                            {templates.map(t => (
                                <TouchableOpacity 
                                    key={t.id}
                                    style={[
                                        styles.templateTab,
                                        { backgroundColor: selectedTemplate?.id === t.id ? theme.primary : (isDark ? 'rgba(255,255,255,0.05)' : '#fff') },
                                        { borderColor: selectedTemplate?.id === t.id ? theme.primary : theme.border }
                                    ]}
                                    onPress={() => setSelectedTemplate(t)}
                                >
                                    <Text style={[styles.templateTabText, { color: selectedTemplate?.id === t.id ? '#fff' : theme.text }]}>
                                        {t.name.replace(/_/g, ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Message Preview */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.textLight }]}>LIVE PREVIEW</Text>
                    <View style={[styles.previewBox, { backgroundColor: isDark ? '#1E293B' : '#DCF8C6', borderLeftWidth: 4, borderLeftColor: '#25D366' }]}>
                        <Text style={[styles.previewText, { color: isDark ? '#CBD5E1' : '#075E54' }]}>
                            {selectedTemplate ? (
                                (() => {
                                    const body = selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text || '';
                                    const resolveSource = (source: string) => {
                                        switch(source) {
                                            case 'customer_name': return '[Broker Company Name]';
                                            case 'property_list_default':
                                            case 'matchListDefault':
                                                return `1️⃣ 🏢 ${meta?.title || 'Project'} | 📐 ${meta?.features?.[0] || 'Size'} | 💰 ${meta?.price || 'Price'}`;
                                            default: return `[${source}]`;
                                        }
                                    };
                                    let preview = body;
                                    const varMatches = preview.match(/{{(\d+)}}/g) || [];
                                    varMatches.forEach((m: string) => {
                                        const idx = m.replace(/[{}]/g, '');
                                        const config = registry[idx];
                                        const source = typeof config === 'object' ? config.source : config;
                                        preview = preview.replace(m, resolveSource(source));
                                    });
                                    return preview;
                                })()
                            ) : (
                                `🏢 BROKER UPDATE: ${meta?.title}\n\n💰 Price: ${meta?.price}\n📍 Location: ${meta?.location}\n📐 Specs: ${meta?.features?.join(' | ')}\n\nRef: ${deal?.shareableId}`
                            )}
                        </Text>
                        {selectedTemplate && (
                            <View style={styles.previewFooter}>
                                <Ionicons name="time-outline" size={10} color={isDark ? '#94A3B8' : '#128C7E'} />
                                <Text style={[styles.previewTime, { color: isDark ? '#94A3B8' : '#128C7E' }]}>Just now</Text>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
                <TouchableOpacity 
                    style={[styles.launchBtn, { backgroundColor: theme.primary }]}
                    onPress={handleLaunch}
                    disabled={sending}
                >
                    {sending ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="rocket" size={20} color="#fff" />
                            <Text style={styles.launchBtnText}>Launch Broadcast</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    scroll: { padding: 20 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    dealCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
    dealTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    dealPrice: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locText: { fontSize: 14, fontWeight: '600' },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 11, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
    groupsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    groupBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    groupName: { fontSize: 14, fontWeight: '700' },
    card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    channelLabel: { fontSize: 15, fontWeight: '700' },
    divider: { height: 1 },
    templatesScroll: { marginBottom: 10 },
    templateTab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginRight: 10 },
    templateTabText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
    previewBox: { padding: 16, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    previewText: { fontSize: 13, lineHeight: 20 },
    previewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8 },
    previewTime: { fontSize: 10, fontWeight: '600' },
    footer: { padding: 20, borderTopWidth: 1 },
    launchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 18, borderRadius: 16 },
    launchBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});
