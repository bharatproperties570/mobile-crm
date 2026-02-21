import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Linking, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getLeads, getLeadById, type Lead, updateLead } from "./services/leads.service";
import { getDeals, type Deal } from "./services/deals.service";
import { safeApiCall, safeApiCallSingle, lookupVal } from "./services/api.helpers";
import api from "./services/api";

export default function MatchScreen() {
    const router = useRouter();
    const { id, dealId } = useLocalSearchParams<{ id: string; dealId: string }>();

    const [loading, setLoading] = useState(true);
    const [lead, setLead] = useState<Lead | null>(null);
    const [deal, setDeal] = useState<Deal | null>(null);
    const [matches, setMatches] = useState<any[]>([]); // Can be Deals or Leads
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (id || dealId) fetchMatches();
    }, [id, dealId]);

    const fetchMatches = async () => {
        setLoading(true);
        try {
            if (id) {
                // Lead -> Match Deals
                const leadRes = await safeApiCallSingle<Lead>(() => getLeadById(id!));
                if (leadRes.data) {
                    const l = leadRes.data;
                    setLead(l);
                    const dealsRes = await safeApiCall<Deal>(() => getDeals({ location: l.locCity || "" }));
                    if (dealsRes.data) {
                        const min = Number(l.budgetMin) || 0;
                        const max = Number(l.budgetMax) || Infinity;
                        setMatches(dealsRes.data.filter(d => {
                            const p = Number(d.price || d.amount) || 0;
                            return p >= min && p <= max;
                        }));
                    }
                }
            } else if (dealId) {
                // Deal -> Match Leads
                const dealRes = await api.get(`/deals/${dealId}`);
                if (dealRes.data) {
                    const d = dealRes.data.data || dealRes.data;
                    setDeal(d);
                    const leadsRes = await getLeads();
                    const allLeads = leadsRes.data || leadsRes || [];
                    const dPrice = Number(d.price || d.amount) || 0;
                    setMatches(allLeads.filter((l: any) => {
                        const min = Number(l.budgetMin) || 0;
                        const max = Number(l.budgetMax) || Infinity;
                        return dPrice >= min && dPrice <= (max || Infinity);
                    }));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSiteVisit = () => {
        if (selectedIds.size === 0) return;
        const selectedDeals = matches.filter(m => selectedIds.has(m._id));
        const names = selectedDeals.map(d => d.projectName || d.title).join(", ");
        router.push({
            pathname: "/add-activity",
            params: {
                id: lead?._id,
                actType: "Site Visit",
                subject: `Site Visit for ${names}`
            }
        });
    };

    const handleMarkInterest = async () => {
        if (selectedIds.size === 0 || !lead) return;
        const selectedDeals = matches.filter(m => selectedIds.has(m._id));
        const interestTag = `Interested: ${selectedDeals.map(d => d.projectName).join(", ")}`;

        const updatedTags = [...(lead.tags || []), interestTag].slice(-10); // Keep last 10 tags
        const res = await safeApiCall(() => updateLead(lead._id, { tags: updatedTags }));

        if (!res.error) {
            Alert.alert("Success", "Marked as interested and added to lead tags.");
            setSelectedIds(new Set());
        }
    };

    const handleSendDetails = async () => {
        if (selectedIds.size === 0 || !lead) return;
        const selectedDeals = matches.filter(m => selectedIds.has(m._id));

        let message = `Hi ${lead.firstName},\n\nI found some properties matching your requirements:\n`;
        selectedDeals.forEach(d => {
            message += `\n📍 ${d.projectName || d.title}\n💰 ₹${d.price || d.amount}\n🔗 View: https://bharatproperties.com/deal/${d._id}\n`;
        });
        message += `\nLet me know if you would like to visit!`;

        const cleanPhone = (lead.mobile || "").replace(/[^\d]/g, "");
        const url = `whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}&text=${encodeURIComponent(message)}`;

        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                await Share.share({ message });
            }
        } catch (e) {
            await Share.share({ message });
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const selected = selectedIds.has(item._id);
        const isLeadMatch = !!dealId; // If we have a dealId, we are matching Leads

        return (
            <TouchableOpacity
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => toggleSelection(item._id)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.projWrap}>
                        <Text style={styles.projName}>{isLeadMatch ? (item.firstName + " " + (item.lastName || "")) : (item.projectName || item.title)}</Text>
                        <Text style={styles.dealId}>{isLeadMatch ? item.mobile : (item.dealId || "ID-TBD")}</Text>
                    </View>
                    <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={24}
                        color={selected ? "#1E3A8A" : "#CBD5E1"}
                    />
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.price}>{isLeadMatch ? `Budget: ₹${(Number(item.budgetMax || 0) / 100000).toFixed(0)}L` : `₹${(Number(item.price || item.amount || 0) / 100000).toFixed(2)} L`}</Text>
                    <View style={styles.stageBadge}>
                        <Text style={styles.stageText}>{isLeadMatch ? (item.status?.lookup_value || item.status || "New") : (item.stage || "New")}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
                </TouchableOpacity>
                <View style={styles.titleWrap}>
                    <Text style={styles.headerTitle}>{dealId ? "Match Leads" : "Match Deals"}</Text>
                    <Text style={styles.headerSub}>
                        {dealId ? `Potential for ${deal?.projectName || "Property"}` : `Finding for ${lead?.firstName || "Lead"}`}
                    </Text>
                </View>
                <TouchableOpacity onPress={fetchMatches}>
                    <Ionicons name="refresh" size={22} color="#1E3A8A" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color="#1E3A8A" size="large" /></View>
            ) : (
                <FlatList
                    data={matches}
                    renderItem={renderItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="search-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No matching deals found</Text>
                        </View>
                    }
                />
            )}

            {selectedIds.size > 0 && (
                <View style={styles.actionBar}>
                    <Text style={styles.selectionCount}>{selectedIds.size} Selected</Text>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleMarkInterest}>
                            <Ionicons name="star" size={20} color="#1E3A8A" />
                            <Text style={styles.actionBtnText}>Interest</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleSiteVisit}>
                            <Ionicons name="calendar" size={20} color="#1E3A8A" />
                            <Text style={styles.actionBtnText}>Visit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={handleSendDetails}>
                            <Ionicons name="send" size={20} color="#fff" />
                            <Text style={styles.primaryBtnText}>Send</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff" },
    titleWrap: { flex: 1, marginLeft: 16 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E3A8A" },
    headerSub: { fontSize: 12, color: "#64748B", fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: 16, paddingBottom: 120 },
    card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0", elevation: 1 },
    cardSelected: { borderColor: "#1E3A8A", backgroundColor: "#F0F9FF" },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    projWrap: { flex: 1 },
    projName: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    dealId: { fontSize: 10, color: "#94A3B8", fontWeight: "700", marginTop: 2 },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    price: { fontSize: 18, fontWeight: "900", color: "#1E3A8A" },
    stageBadge: { backgroundColor: "#E0F2FE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    stageText: { fontSize: 10, fontWeight: "800", color: "#0369A1", textTransform: "uppercase" },
    locRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
    locText: { fontSize: 12, color: "#64748B", marginLeft: 4, fontWeight: "500" },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { fontSize: 16, color: "#94A3B8", fontWeight: "600", marginTop: 12 },

    actionBar: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: "#fff", padding: 16, paddingBottom: 34,
        borderTopWidth: 1, borderTopColor: "#E2E8F0",
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 10
    },
    selectionCount: { fontSize: 14, fontWeight: "800", color: "#1E3A8A" },
    actionButtons: { flexDirection: "row", gap: 10 },
    actionBtn: {
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
        backgroundColor: "#F1F5F9", flexDirection: "row", alignItems: "center", gap: 6
    },
    actionBtnText: { fontSize: 12, fontWeight: "700", color: "#1E3A8A" },
    primaryBtn: { backgroundColor: "#1E3A8A" },
    primaryBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" }
});
