import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Modal, Pressable, Alert } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

export default function MarketingScreen() {
    const { theme } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const campaigns = [
        { id: '1', name: "Diwali Special Offer", reach: "12k", conversion: "2.4%", status: 'Active' },
        { id: '2', name: "New Launch Mohali", reach: "8k", conversion: "1.8%", status: 'Completed' },
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

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <ScrollView style={[styles.container]} contentContainerStyle={styles.content}>
                <Animated.View style={{ opacity: fadeAnim }}>
                    <Text style={[styles.title, { color: theme.text }]}>Marketing Hub</Text>

                    <View style={styles.statsRow}>
                        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.statVal, { color: theme.primary }]}>2</Text>
                            <Text style={[styles.statLabel, { color: theme.textLight }]}>ACTIVE CAMPAIGNS</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.statVal, { color: theme.primary }]}>20k</Text>
                            <Text style={[styles.statLabel, { color: theme.textLight }]}>TOTAL REACH</Text>
                        </View>
                    </View>

                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Campaign Performance</Text>
                    {campaigns.map(c => (
                        <View key={c.id} style={[styles.campaignCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={styles.row}>
                                <Text style={[styles.campName, { color: theme.text }]}>{c.name}</Text>
                                <View style={styles.campRight}>
                                    <View style={[styles.statusBadge, { backgroundColor: c.status === 'Active' ? '#10B98115' : theme.background }]}>
                                        <Text style={[styles.statusText, { color: c.status === 'Active' ? '#10B981' : theme.textLight }]}>{c.status.toUpperCase()}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.menuTrigger} onPress={() => openHub(c)}>
                                        <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={styles.metrics}>
                                <View style={styles.metricItem}>
                                    <Text style={[styles.metricLabel, { color: theme.textLight }]}>REACH</Text>
                                    <Text style={[styles.metricVal, { color: theme.text }]}>{c.reach}</Text>
                                    <View style={[styles.progressTiny, { backgroundColor: theme.background }]}>
                                        <View style={[styles.progressFillTiny, { width: '60%', backgroundColor: theme.primary }]} />
                                    </View>
                                </View>
                                <View style={styles.metricItem}>
                                    <Text style={[styles.metricLabel, { color: theme.textLight }]}>CONVERSION</Text>
                                    <Text style={[styles.metricVal, { color: theme.text }]}>{c.conversion}</Text>
                                    <View style={[styles.progressTiny, { backgroundColor: theme.background }]}>
                                        <View style={[styles.progressFillTiny, { width: '40%', backgroundColor: '#F59E0B' }]} />
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.primary }]}>
                        <Ionicons name="megaphone-outline" size={24} color="#fff" />
                        <Text style={styles.addBtnText}>Create New Campaign</Text>
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
    title: { fontSize: 26, fontWeight: "900", marginBottom: 24, letterSpacing: -0.5 },
    statsRow: { flexDirection: "row", gap: 16, marginBottom: 30 },
    statCard: { flex: 1, padding: 20, borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
    statVal: { fontSize: 28, fontWeight: "900" },
    statLabel: { fontSize: 9, fontWeight: "800", marginTop: 6, letterSpacing: 1 },
    sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
    campaignCard: { borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    campName: { fontSize: 16, fontWeight: "800", flex: 1, marginRight: 10 },
    campRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    statusText: { fontSize: 9, fontWeight: "800" },
    metrics: { flexDirection: "row", gap: 24, marginTop: 20 },
    metricItem: { flex: 1 },
    metricLabel: { fontSize: 9, fontWeight: "800", marginBottom: 6, letterSpacing: 0.5 },
    metricVal: { fontSize: 16, fontWeight: "800" },
    progressTiny: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
    progressFillTiny: { height: '100%', borderRadius: 2 },
    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 18, borderRadius: 20, marginTop: 32, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    addBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    menuTrigger: { padding: 4 },
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
