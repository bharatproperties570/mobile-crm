import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Linking, Share, Modal, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getLeadById, type Lead, updateLead } from "@/services/leads.service";
import { safeApiCall, safeApiCallSingle } from "@/services/api.helpers";
import api from "@/services/api";

export default function MatchScreen() {
    const router = useRouter();
    const { id, dealId } = useLocalSearchParams<{ id: string; dealId: string }>();

    const [loading, setLoading] = useState(true);
    const [lead, setLead] = useState<Lead | null>(null);
    const [deal, setDeal] = useState<any | null>(null);
    const [matches, setMatches] = useState<any[]>([]); 
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // --- PROFESSIONAL MATCH CONTROLS ---
    const [showSettings, setShowSettings] = useState(false);
    const [budgetFlexibility, setBudgetFlexibility] = useState(10);
    const [sizeFlexibility, setSizeFlexibility] = useState(10);
    const [weights, setWeights] = useState({
        location: 30,
        type: 20,
        budget: 25,
        size: 25
    });

    const fetchMatches = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                leadId: id,
                dealId: dealId,
                budgetFlexibility,
                sizeFlexibility,
                weights: JSON.stringify(weights)
            };

            if (id) {
                const leadRes = await safeApiCallSingle<Lead>(() => getLeadById(id!));
                if (leadRes.data) setLead(leadRes.data);
                
                const matchRes = await api.get(`/deals/match`, { params });
                if (matchRes.data && matchRes.data.success) {
                    setMatches(matchRes.data.data || []);
                }
            } else if (dealId) {
                const dealRes = await api.get(`/deals/${dealId}`);
                if (dealRes.data) setDeal(dealRes.data.data || dealRes.data);
                
                const matchRes = await api.get(`/leads/match`, { params });
                if (matchRes.data && matchRes.data.success) {
                    setMatches(matchRes.data.data || []);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [id, dealId, budgetFlexibility, sizeFlexibility, weights]);

    useEffect(() => {
        if (id || dealId) fetchMatches();
    }, [id, dealId, budgetFlexibility, sizeFlexibility, weights, fetchMatches]);

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSiteVisit = () => {
        if (selectedIds.size === 0) return;
        const selectedDeals = matches.filter(m => selectedIds.has(m._id));
        const names = selectedDeals.map(d => d.projectName || d.title || d.unitNo).join(", ");
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
        const interestTag = `Interested: ${selectedDeals.map(d => d.projectName || d.unitNo).join(", ")}`;

        const updatedTags = [...(lead.tags || []), interestTag].slice(-10);
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
            message += `\n📍 ${d.projectName || d.unitNo}\n💰 ₹${d.price || d.amount}\n🔗 View: https://bharatproperties.com/p/${d._id}\n`;
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

    const StepperControl = ({ label, value, onChange, min = 0, max = 100, step = 5 }: any) => (
        <View style={styles.stepperContainer}>
            <Text style={styles.stepperLabel}>{label}</Text>
            <View style={styles.stepperRow}>
                <TouchableOpacity 
                    onPress={() => onChange(Math.max(min, value - step))}
                    style={styles.stepBtn}
                >
                    <Ionicons name="remove" size={20} color="#1E3A8A" />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{value}%</Text>
                <TouchableOpacity 
                    onPress={() => onChange(Math.min(max, value + step))}
                    style={styles.stepBtn}
                >
                    <Ionicons name="add" size={20} color="#1E3A8A" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderItem = ({ item }: { item: any }) => {
        const selected = selectedIds.has(item._id);
        const isLeadMatch = !!dealId;

        return (
            <TouchableOpacity
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => toggleSelection(item._id)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.projWrap}>
                        <Text style={styles.projName}>{isLeadMatch ? (item.firstName + " " + (item.lastName || "")) : (item.projectName || item.unitNo || item.title)}</Text>
                        <Text style={styles.dealId}>{isLeadMatch ? item.mobile : (item.unitNo || item.dealId || "ID-TBD")}</Text>
                    </View>
                    <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={24}
                        color={selected ? "#1E3A8A" : "#CBD5E1"}
                    />
                </View>

                <View style={styles.cardFooter}>
                    <View>
                        <Text style={styles.price}>{isLeadMatch ? `Budget: ₹${(Number(item.budgetMax || 0) / 100000).toFixed(0)}L` : `₹${(Number(item.price || item.amount || 0) / 100000).toFixed(2)} L`}</Text>
                        <View style={styles.matchDetailContainer}>
                            {item.matchDetails?.slice(0, 3).map((tag: string, idx: number) => {
                                let tagBg = "#F1F5F9";
                                let tagText = "#64748B";
                                if (tag.includes("Intent") || tag.includes("Type")) { tagBg = "#E0F2FE"; tagText = "#0369A1"; }
                                if (tag.includes("Budget")) { tagBg = "#DCFCE7"; tagText = "#15803D"; }
                                if (tag.includes("Orientation")) { tagBg = "#FEF3C7"; tagText = "#92400E"; }
                                
                                return (
                                    <View key={idx} style={[styles.matchChip, { backgroundColor: tagBg }]}>
                                        <Text style={[styles.matchChipText, { color: tagText }]}>{tag}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {item.score && (
                            <View style={[styles.scoreBadge, { backgroundColor: item.score > 70 ? "#10B981" : "#F59E0B" }]}>
                                <Text style={styles.scoreText}>{item.score}% Match</Text>
                            </View>
                        )}
                        <View style={styles.stageBadge}>
                            <Text style={styles.stageText}>{isLeadMatch ? (item.stage?.lookup_value || item.status?.lookup_value || item.status || "New") : (item.stage || "New")}</Text>
                        </View>
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
                <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
                    <Ionicons name="options-outline" size={24} color="#1E3A8A" />
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
                            <TouchableOpacity 
                                style={styles.adjustBtn}
                                onPress={() => setShowSettings(true)}
                            >
                                <Text style={styles.adjustBtnText}>Adjust Match Filters</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* --- MATCH SETTINGS MODAL --- */}
            <Modal visible={showSettings} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Match Algorithm Controls</Text>
                            <TouchableOpacity onPress={() => setShowSettings(false)}>
                                <Ionicons name="close-circle" size={28} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.sectionTitle}>Flexibility Controls</Text>
                            <StepperControl 
                                label="Budget Flexibility" 
                                value={budgetFlexibility} 
                                onChange={setBudgetFlexibility} 
                                max={50}
                            />
                            <StepperControl 
                                label="Size Flexibility" 
                                value={sizeFlexibility} 
                                onChange={setSizeFlexibility} 
                                max={50}
                            />

                            <View style={styles.divider} />
                            
                            <Text style={styles.sectionTitle}>Engine Weighting</Text>
                            <StepperControl 
                                label="📍 Location Match" 
                                value={weights.location} 
                                onChange={(v: number) => setWeights({ ...weights, location: v })} 
                            />
                            <StepperControl 
                                label="🏢 Type Symmetry" 
                                value={weights.type} 
                                onChange={(v: number) => setWeights({ ...weights, type: v })} 
                            />
                            <StepperControl 
                                label="💰 Price Accuracy" 
                                value={weights.budget} 
                                onChange={(v: number) => setWeights({ ...weights, budget: v })} 
                            />
                            <StepperControl 
                                label="📐 Size Match" 
                                value={weights.size} 
                                onChange={(v: number) => setWeights({ ...weights, size: v })} 
                            />
                            
                            <View style={{ height: 40 }} />
                        </ScrollView>
                        
                        <TouchableOpacity 
                            style={styles.applyBtn}
                            onPress={() => setShowSettings(false)}
                        >
                            <Text style={styles.applyBtnText}>Apply & Re-Sync Engine</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {selectedIds.size > 0 && !showSettings && (
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
    settingsBtn: { padding: 8, backgroundColor: "#F1F5F9", borderRadius: 10 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: 16, paddingBottom: 120 },
    card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0" },
    cardSelected: { borderColor: "#1E3A8A", backgroundColor: "#F0F9FF" },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    projWrap: { flex: 1 },
    projName: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    dealId: { fontSize: 10, color: "#94A3B8", fontWeight: "700", marginTop: 2 },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    price: { fontSize: 18, fontWeight: "900", color: "#1E3A8A" },
    stageBadge: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    stageText: { fontSize: 10, fontWeight: "800", color: "#64748B", textTransform: "uppercase" },
    scoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    scoreText: { color: "#fff", fontSize: 10, fontWeight: "900" },
    matchDetailContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, maxWidth: 220 },
    matchChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    matchChipText: { fontSize: 8, fontWeight: "800", textTransform: 'uppercase' },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { fontSize: 16, color: "#94A3B8", fontWeight: "600", marginTop: 12 },
    adjustBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#eff6ff", borderRadius: 12 },
    adjustBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
    modalBody: { marginBottom: 20 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 },
    divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 20 },
    stepperContainer: { marginBottom: 16 },
    stepperLabel: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
    stepperRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    stepBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
    stepValue: { fontSize: 16, fontWeight: "900", color: "#1E3A8A", minWidth: 40, textAlign: "center" },
    applyBtn: { backgroundColor: "#1E3A8A", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
    applyBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

    actionBar: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: "#fff", padding: 16, paddingBottom: 34,
        borderTopWidth: 1, borderTopColor: "#E2E8F0",
        flexDirection: "row", alignItems: "center", justifyContent: "space-between"
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
