import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getLeadById, type Lead } from "./services/leads.service";
import { safeApiCallSingle } from "./services/api.helpers";

export default function SequencesScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [loading, setLoading] = useState(true);
    const [lead, setLead] = useState<Lead | null>(null);

    const [sequences, setSequences] = useState([
        { id: "1", name: "Hot Lead Follow-up", description: "3 calls in 3 days, then weekly SMS", icon: "flame", color: "#EF4444" },
        { id: "2", name: "New Inquiry Nurture", description: "Intro email, WhatsApp brochure, 24h follow-up", icon: "mail", color: "#3B82F6" },
        { id: "3", name: "Dormant Reactivation", description: "Monthly check-in for 6 months", icon: "refresh", color: "#10B981" },
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

    const handleApply = (name: string) => {
        Alert.alert(
            "Apply Sequence",
            `Confirm applying "${name}" to ${lead?.firstName || "this lead"}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Apply", onPress: () => Alert.alert("Success", `Sequence applied to ${lead?.firstName || "Lead"}`) }
            ]
        );
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity style={styles.seqCard} onPress={() => handleApply(item.name)}>
            <View style={[styles.seqIcon, { backgroundColor: item.color + "15" }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
            </View>
            <View style={styles.seqInfo}>
                <Text style={styles.seqName}>{item.name}</Text>
                <Text style={styles.seqDesc}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#E2E8F0" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>Sequences</Text>
                    {lead && <Text style={styles.headerSub}>{lead.firstName} {lead.lastName}</Text>}
                </View>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.subheader}>
                <Text style={styles.subtext}>Select a workflow sequence to automate follow-ups</Text>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color="#1E3A8A" size="large" /></View>
            ) : (
                <FlatList
                    data={sequences}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
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
    subheader: { padding: 16, backgroundColor: "#F5F3FF" },
    subtext: { fontSize: 12, color: "#7C3AED", fontWeight: "700" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: 16 },
    seqCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F1F5F9" },
    seqIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
    seqInfo: { flex: 1 },
    seqName: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
    seqDesc: { fontSize: 12, color: "#64748B", marginTop: 4 },
});
