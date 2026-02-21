import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function MarketingScreen() {
    const campaigns = [
        { id: '1', name: "Diwali Special Offer", reach: "12k", conversion: "2.4%", status: 'Active' },
        { id: '2', name: "New Launch Mohali", reach: "8k", conversion: "1.8%", status: 'Completed' },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Marketing Hub</Text>

            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statVal}>2</Text>
                    <Text style={styles.statLabel}>Active Campaigns</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statVal}>20k</Text>
                    <Text style={styles.statLabel}>Total Reach</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Campaign Performance</Text>
            {campaigns.map(c => (
                <View key={c.id} style={styles.campaignCard}>
                    <View style={styles.row}>
                        <Text style={styles.campName}>{c.name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: c.status === 'Active' ? '#ECFDF5' : '#F1F5F9' }]}>
                            <Text style={[styles.statusText, { color: c.status === 'Active' ? '#10B981' : '#64748B' }]}>{c.status}</Text>
                        </View>
                    </View>
                    <View style={styles.metrics}>
                        <View>
                            <Text style={styles.metricLabel}>Reach</Text>
                            <Text style={styles.metricVal}>{c.reach}</Text>
                        </View>
                        <View>
                            <Text style={styles.metricLabel}>Conversion</Text>
                            <Text style={styles.metricVal}>{c.conversion}</Text>
                        </View>
                    </View>
                </View>
            ))}

            <TouchableOpacity style={styles.addBtn}>
                <Ionicons name="megaphone-outline" size={24} color="#fff" />
                <Text style={styles.addBtnText}>Create New Campaign</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    content: { padding: 20, paddingTop: 60, paddingBottom: 100 },
    title: { fontSize: 22, fontWeight: "800", color: "#1E293B", marginBottom: 24 },
    statsRow: { flexDirection: "row", gap: 15, marginBottom: 30 },
    statCard: { flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9" },
    statVal: { fontSize: 24, fontWeight: "800", color: "#3B82F6" },
    statLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginTop: 4 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 16 },
    campaignCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#F1F5F9" },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    campName: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
    metrics: { flexDirection: "row", gap: 30, marginTop: 16 },
    metricLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "600" },
    metricVal: { fontSize: 14, fontWeight: "800", color: "#475569", marginTop: 2 },
    addBtn: {
        backgroundColor: "#6366F1", flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 10, padding: 16, borderRadius: 16, marginTop: 40
    },
    addBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 }
});
