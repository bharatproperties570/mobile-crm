import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Modal, Pressable, Alert } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

export default function MarketingScreen() {
    const { theme } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const campaigns = [
        { id: '1', name: "Diwali Special Offer", reach: "12k", conversion: "2.4%", status: 'Active' },
        { id: '2', name: "New Launch Mohali", reach: "8k", conversion: "1.8%", status: 'Completed' },
    ];

    const intelligenceProspects = [
        { id: '101', name: 'Raj Kumar', classification: 'Serious Buyer', intentIndex: 92, tags: ['Ready Cash', 'ROI Focus'], campaign: 'Google Plot Campaign' },
        { id: '102', name: 'Amit Shah', classification: 'Investor', intentIndex: 88, tags: ['Plot Expert', 'Multiple Units'], campaign: 'Facebook Flat Campaign' },
    ];

    // Action Hub State
    const [selectedCamp, setSelectedCamp] = useState<any>(null);
    const [hubVisible, setHubVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(350)).current;

    const openHub = (camp: any) => {
        setSelectedCamp(camp);
        setHubVisible(true);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start();
    };

    const closeHub = () => {
        Animated.timing(slideAnim, {
            toValue: 350,
            duration: 200,
            useNativeDriver: true
        }).start(() => {
            setHubVisible(false);
            setSelectedCamp(null);
        });
    };

    const engagementStats = [
        { type: "Project Reels", value: "8.4%", color: "#35B97A" },
        { type: "CRM Posts", value: "7.6%", color: "#C9921A" },
        { type: "Carousels", value: "6.2%", color: "#4A9FD4" },
        { type: "Educational", value: "4.8%", color: "#8B7DD8" },
    ];

    const activeQueue = [
        { id: 'q1', task: 'AI Video Gen (Project #102)', progress: 0.65, status: 'Processing' },
        { id: 'q2', task: 'Instagram Auto-Schedule', progress: 1.0, status: 'Scheduled' },
    ];

    const activityLog = [
        { id: 'l1', time: '10:45 AM', event: 'REEL GENERATED', details: 'Project Pearl #102 - 4K High Res', icon: 'videocam' },
        { id: 'l2', time: '09:30 AM', event: 'LEAD INGESTED', details: 'Source: Instagram - Campaign Diwali', icon: 'person-add' },
        { id: 'l3', time: 'Yesterday', event: 'CAMPAIGN LAUNCH', details: 'New Launch Mohali - Multi-channel', icon: 'rocket' },
    ];

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <ScrollView style={[styles.container]} contentContainerStyle={styles.content}>
                <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={styles.headerRow}>
                        <Text style={[styles.title, { color: theme.text }]}>Marketing OS</Text>
                        <View style={[styles.versionBadge, { backgroundColor: theme.primary + '20' }]}>
                            <Text style={[styles.versionText, { color: theme.primary }]}>v2.5 LIVE</Text>
                        </View>
                    </View>

                    {/* Engagement Breakdown */}
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Engagement by type</Text>
                    <View style={styles.engagementGrid}>
                        {engagementStats.map((stat, idx) => (
                            <View key={idx} style={[styles.engagementCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.engagementVal, { color: stat.color }]}>{stat.value}</Text>
                                <Text style={[styles.engagementType, { color: theme.textSecondary }]}>{stat.type}</Text>
                                <View style={[styles.miniProgress, { backgroundColor: theme.background }]}>
                                    <View style={[styles.miniFill, { width: stat.value as any, backgroundColor: stat.color }]} />
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Command Center: Queue Manager */}
                    <View style={[styles.commandCenter, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.commandHeader}>
                            <Ionicons name="terminal-outline" size={18} color={theme.primary} />
                            <Text style={[styles.commandTitle, { color: theme.text }]}>COMMAND CENTER</Text>
                        </View>
                        
                        <Text style={[styles.subSectionTitle, { color: theme.textSecondary }]}>QUEUE MANAGER</Text>
                        {activeQueue.map(item => (
                            <View key={item.id} style={styles.queueItem}>
                                <View style={styles.queueTextRow}>
                                    <Text style={[styles.queueTask, { color: theme.text }]} numberOfLines={1}>{item.task}</Text>
                                    <Text style={[styles.queuePerc, { color: theme.primary }]}>{Math.round(item.progress * 100)}%</Text>
                                </View>
                                <View style={[styles.queueProgress, { backgroundColor: theme.background }]}>
                                    <View style={[styles.queueFill, { width: `${item.progress * 100}%`, backgroundColor: theme.primary }]} />
                                </View>
                            </View>
                        ))}

                        <View style={styles.divider} />

                        <Text style={[styles.subSectionTitle, { color: theme.textSecondary, marginTop: 10 }]}>LIVE ACTIVITY LOG</Text>
                        {activityLog.map(log => (
                            <View key={log.id} style={styles.logItem}>
                                <View style={[styles.logIconBox, { backgroundColor: theme.background }]}>
                                    <Ionicons name={log.icon as any} size={14} color={theme.primary} />
                                </View>
                                <View style={styles.logText}>
                                    <View style={styles.logHeader}>
                                        <Text style={[styles.logEvent, { color: theme.text }]}>{log.event}</Text>
                                        <Text style={[styles.logTime, { color: theme.textMuted }]}>{log.time}</Text>
                                    </View>
                                    <Text style={[styles.logDetails, { color: theme.textSecondary }]}>{log.details}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 10 }]}>Intelligence Hub</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 30, marginHorizontal: -20, paddingHorizontal: 20 }}>
                        {intelligenceProspects.map((prospect) => (
                            <View key={prospect.id} style={[styles.prospectCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={styles.prospectHeader}>
                                    <View style={[styles.prospectAvatar, { backgroundColor: theme.primary + '15' }]}>
                                        <Text style={[styles.prospectAvatarText, { color: theme.primary }]}>{prospect.name.charAt(0)}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.prospectName, { color: theme.text }]} numberOfLines={1}>{prospect.name}</Text>
                                        <Text style={[styles.prospectCamp, { color: theme.textSecondary }]}>{prospect.campaign}</Text>
                                    </View>
                                    <View style={[styles.prospectScore, { backgroundColor: '#7C3AED' }]}>
                                        <Text style={styles.prospectScoreText}>{prospect.intentIndex}</Text>
                                    </View>
                                </View>
                                <View style={styles.prospectBadges}>
                                    <View style={[styles.classificationBadge, { backgroundColor: theme.warning + '20' }]}>
                                        <Text style={[styles.classificationText, { color: theme.warning }]}>{prospect.classification.toUpperCase()}</Text>
                                    </View>
                                </View>
                                <View style={styles.prospectTags}>
                                    {prospect.tags.map((tag, idx) => (
                                        <View key={idx} style={[styles.tagPill, { backgroundColor: theme.primary + '10' }]}>
                                            <Text style={[styles.tagText, { color: theme.primary }]}>#{tag.toUpperCase()}</Text>
                                        </View>
                                    ))}
                                </View>
                                <TouchableOpacity style={[styles.prospectAction, { backgroundColor: theme.primary }]} onPress={() => Alert.alert("Intelligence", `Opening profile for ${prospect.name}...`)}>
                                    <Text style={styles.prospectActionText}>View Profile</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>

                    <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.primary }]}>
                        <Ionicons name="megaphone-outline" size={24} color="#fff" />
                        <Text style={styles.addBtnText}>Launch Marketing Agent</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>

            {/* Action Hub Modal */}
            <Modal transparent visible={hubVisible} animationType="none" onRequestClose={closeHub}>
                <Pressable style={actionHubStyles.modalOverlay} onPress={closeHub}>
                    <Animated.View style={[actionHubStyles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
                        <View style={actionHubStyles.sheetHandle} />
                        <View style={actionHubStyles.sheetHeader}>
                            <Text style={actionHubStyles.sheetTitle}>Campaign Actions</Text>
                            <Text style={actionHubStyles.sheetSub}>{selectedCamp?.name || "Marketing Effort"}</Text>
                        </View>

                        <View style={actionHubStyles.actionGrid}>
                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Edit", "Editing campaign settings..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color="#64748B" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Edit</Text>
                            </TouchableOpacity >

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Leads", "Viewing leads from this campaign..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#F5F3FF" }]}>
                                    <Ionicons name="people" size={24} color="#7C3AED" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Leads</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Pause", "Status updated successfully."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#FFF7ED" }]}>
                                    <Ionicons name="pause" size={24} color="#EA580C" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Pause</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Analytics", "Opening performance dashboard..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#ECFDF5" }]}>
                                    <Ionicons name="stats-chart" size={24} color="#059669" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Analytics</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={actionHubStyles.actionItem} onPress={() => {
                                Alert.alert("Share", "Sharing campaign details..."); closeHub();
                            }}>
                                <View style={[actionHubStyles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
                                    <Ionicons name="share-social" size={24} color="#3B82F6" />
                                </View>
                                <Text style={actionHubStyles.actionLabel}>Share</Text>
                            </TouchableOpacity>
                        </View >
                    </Animated.View >
                </Pressable >
            </Modal >
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingTop: 60, paddingBottom: 100 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
    versionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    versionText: { fontSize: 10, fontWeight: '800' },
    
    sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
    subSectionTitle: { fontSize: 10, fontWeight: "800", marginBottom: 12, letterSpacing: 1 },
    
    // Engagement Grid
    engagementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    engagementCard: { width: '48%', padding: 16, borderRadius: 20, borderWidth: 1 },
    engagementVal: { fontSize: 20, fontWeight: '900' },
    engagementType: { fontSize: 10, fontWeight: '700', marginTop: 4, marginBottom: 8 },
    miniProgress: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
    miniFill: { height: '100%', borderRadius: 1.5 },

    // Command Center
    commandCenter: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 24 },
    commandHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
    commandTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    divider: { height: 1, backgroundColor: 'rgba(201, 146, 26, 0.1)', marginVertical: 15 },

    // Queue Manager
    queueItem: { marginBottom: 12 },
    queueTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    queueTask: { fontSize: 12, fontWeight: '700', flex: 1 },
    queuePerc: { fontSize: 12, fontWeight: '800' },
    queueProgress: { height: 6, borderRadius: 3, overflow: 'hidden' },
    queueFill: { height: '100%', borderRadius: 3 },

    // Activity Log
    logItem: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    logIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    logText: { flex: 1 },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    logEvent: { fontSize: 11, fontWeight: '800' },
    logTime: { fontSize: 10, fontWeight: '600' },
    logDetails: { fontSize: 11, fontWeight: '500' },

    // Intelligence Hub Styles
    prospectCard: { width: 280, borderRadius: 24, padding: 16, borderWidth: 1, marginRight: 15, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    prospectHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    prospectAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    prospectAvatarText: { fontSize: 18, fontWeight: '800' },
    prospectName: { fontSize: 15, fontWeight: '800' },
    prospectCamp: { fontSize: 10, fontWeight: '600' },
    prospectScore: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    prospectScoreText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    prospectBadges: { flexDirection: 'row', marginBottom: 10 },
    classificationBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    classificationText: { fontSize: 9, fontWeight: '800' },
    prospectTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
    tagPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    tagText: { fontSize: 9, fontWeight: '700' },
    prospectAction: { paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    prospectActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },

    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 18, borderRadius: 20, marginTop: 10, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    addBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

const actionHubStyles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
    sheetContainer: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: 40, minHeight: 350 },
    sheetHandle: { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 },
    sheetHeader: { marginBottom: 24, alignItems: 'center' },
    sheetTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
    sheetSub: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: 'uppercase', marginTop: 4 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: 'center', gap: 12 },
    actionItem: { width: "22%", alignItems: "center", marginBottom: 16 },
    actionIcon: { width: 56, height: 56, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    actionLabel: { fontSize: 10, fontWeight: "800", color: "#475569", textAlign: "center" },
});
