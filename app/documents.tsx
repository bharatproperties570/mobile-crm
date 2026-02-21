import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getLeadById, type Lead } from "./services/leads.service";
import { safeApiCallSingle } from "./services/api.helpers";

export default function DocumentsScreen() {
    const router = useRouter();
    const { id, type = "Lead" } = useLocalSearchParams<{ id: string; type: string }>();
    const [loading, setLoading] = useState(true);
    const [lead, setLead] = useState<Lead | null>(null);

    // Dummy docs for demonstration
    const [docs, setDocs] = useState([
        { id: "1", name: "Aadhar_Card.pdf", date: "2024-02-15", size: "1.2 MB", type: "pdf" },
        { id: "2", name: "PAN_Card.jpg", date: "2024-02-16", size: "0.8 MB", type: "image" },
    ]);

    useEffect(() => {
        if (id) fetchLead();
    }, [id]);

    const fetchLead = async () => {
        setLoading(true);
        const res = await safeApiCallSingle<Lead>(() => getLeadById(id!));
        if (res.data) setLead(res.data);
        setLoading(false);
    };

    const handleUpload = () => {
        Alert.alert("Upload Document", `File picker integration for ${lead?.firstName || "Lead"} is coming soon.`);
    };

    const renderItem = ({ item }: any) => (
        <View style={styles.docItem}>
            <View style={[styles.docIcon, { backgroundColor: item.type === "pdf" ? "#FEE2E2" : "#EFF6FF" }]}>
                <Ionicons
                    name={item.type === "pdf" ? "document-text" : "image"}
                    size={24}
                    color={item.type === "pdf" ? "#EF4444" : "#1E3A8A"}
                />
            </View>
            <View style={styles.docInfo}>
                <Text style={styles.docName}>{item.name}</Text>
                <Text style={styles.docMeta}>{item.date} • {item.size}</Text>
            </View>
            <TouchableOpacity onPress={() => Alert.alert("Actions", "Download/View options coming soon.")}>
                <Ionicons name="ellipsis-vertical" size={20} color="#94A3B8" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>Documents</Text>
                    {lead && <Text style={styles.headerSub}>{lead.firstName} {lead.lastName}</Text>}
                </View>
                <TouchableOpacity onPress={handleUpload}>
                    <Ionicons name="add-circle" size={28} color="#1E3A8A" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color="#1E3A8A" size="large" /></View>
            ) : (
                <FlatList
                    data={docs}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="cloud-upload-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No documents uploaded yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff" },
    headerTitleWrap: { flex: 1, marginLeft: 16 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E3A8A" },
    headerSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: 16 },
    docItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F1F5F9" },
    docIcon: { width: 44, height: 44, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 12 },
    docInfo: { flex: 1 },
    docName: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
    docMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { fontSize: 16, color: "#94A3B8", fontWeight: "600", marginTop: 12 },
});
