import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, SafeAreaView, Platform, Dimensions
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/services/api";
import { useTheme } from "@/context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AddOffer() {
    const { theme, isDarkMode: isDark } = useTheme();
    const router = useRouter();
    const { dealId } = useLocalSearchParams<{ dealId: string }>();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deal, setDeal] = useState<any>(null);
    const [matchingLeads, setMatchingLeads] = useState<any[]>([]);
    
    const [formData, setFormData] = useState({
        leadId: "",
        leadName: "",
        amount: "",
        counterAmount: "",
        status: "Active",
        conditions: ""
    });

    const [searchText, setSearchText] = useState("");
    const [allLeads, setAllLeads] = useState<any[]>([]);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!dealId) {
                setLoading(false);
                return;
            }
            try {
                const [dealRes, matchRes] = await Promise.all([
                    api.get(`/deals/${dealId}`),
                    api.get(`/leads/match`, { params: { dealId } })
                ]);

                if (dealRes.data) {
                    const d = dealRes.data.data || dealRes.data;
                    setDeal(d);
                    
                    // Pre-select Associated Contact
                    const contact = d.associatedContact || d.partyStructure?.buyer;
                    if (contact) {
                        setFormData(prev => ({ 
                            ...prev, 
                            leadId: contact._id || contact.id,
                            leadName: contact.fullName || contact.name || "Associated Party"
                        }));
                    }
                }
                
                if (matchRes.data && matchRes.data.success) {
                    setMatchingLeads(matchRes.data.data || []);
                }
            } catch (error) {
                console.error("Error fetching offer context:", error);
                // Silence alert to avoid blocking splash screen if this is called early
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dealId]);

    const handleSearchLeads = async () => {
        if (searchText.length < 3) {
            Alert.alert("Input Needed", "Please enter at least 3 characters to search.");
            return;
        }
        setLoading(true);
        try {
            const res = await api.get("/leads", { params: { search: searchText, limit: 10 } });
            const data = res.data.records || res.data.data?.records || res.data.data || [];
            setAllLeads(Array.isArray(data) ? data : []);
            setShowAll(true);
        } catch (e) {
            Alert.alert("Search Error", "Could not fetch leads list.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.leadId || !formData.amount) {
            Alert.alert("Required", "Please select a prospect and enter an offer amount.");
            return;
        }

        if (!deal) {
            Alert.alert("Error", "Deal data not fully loaded yet.");
            return;
        }

        setSaving(true);
        try {
            const offerBy = formData.leadName || "Prospect";
            const offerData = {
                round: (deal.negotiationRounds || []).length + 1,
                date: new Date().toISOString(),
                offerBy,
                buyerOffer: Number(formData.amount),
                ownerCounter: formData.counterAmount ? Number(formData.counterAmount) : 0,
                status: formData.status,
                notes: formData.conditions
            };

            const payload: any = {
                negotiationRounds: [
                    ...(deal.negotiationRounds || []),
                    offerData
                ],
                associatedContact: formData.leadId,
                stage: deal.stage === 'Closed' || deal.stage === 'Lost' ? deal.stage : 'Negotiation'
            };

            const res = await api.patch(`/deals/${dealId}`, payload);
            
            if (res.data && (res.data.success || res.status === 200)) {
                Alert.alert("Success", "Offer recorded and deal updated.");
                router.back();
            } else {
                throw new Error(res.data?.error || "Failed to save");
            }
        } catch (error: any) {
            console.error("[CRITICAL] Offer Save Error:", error.response?.data || error.message);
            const serverError = error.response?.data?.error || error.response?.data?.message || error.message;
            Alert.alert("Save Failed", serverError);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const displayLeads = showAll ? allLeads : matchingLeads;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Register Offer</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.saveText, { color: theme.primary }]}>SAVE</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Visual Header */}
                <View style={[styles.dealBranding, { backgroundColor: theme.card }]}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                        <Ionicons name="handshake" size={24} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.dealName, { color: theme.text }]}>{deal?.unitNo || "Unit"} • {deal?.projectName || "Direct Deal"}</Text>
                        <Text style={[styles.dealBudget, { color: theme.textSecondary }]}>Expectation: ₹{Number(deal?.price || 0).toLocaleString('en-IN')}</Text>
                    </View>
                </View>

                {/* Lead Selection */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{showAll ? "SEARCH RESULTS" : "BEST MATCHES"}</Text>
                    {!!(!showAll && matchingLeads.length > 0) && <Ionicons name="sparkles" size={14} color="#FBBF24" />}
                </View>

                {/* Unified Search Bar */}
                <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <TextInput
                        placeholder="Search another prospect..."
                        placeholderTextColor={theme.textLight}
                        style={[styles.searchInput, { color: theme.text }]}
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={handleSearchLeads}
                    />
                    <TouchableOpacity onPress={handleSearchLeads}>
                        <Ionicons name="search" size={20} color={theme.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.leadsGrid}>
                    {displayLeads.length === 0 && !formData.leadId ? (
                        <View style={[styles.emptyBox, { borderColor: theme.border, borderStyle: 'dotted' }]}>
                            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                                {showAll ? "No results found for search." : "No automatic matches found. Use search to find a prospect."}
                            </Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
                            {displayLeads.map((m: any) => (
                                <TouchableOpacity
                                    key={m._id}
                                    style={[
                                        styles.leadCard,
                                        { backgroundColor: theme.card, borderColor: theme.border },
                                        formData.leadId === m._id && { borderColor: theme.primary, backgroundColor: theme.primary + '05' }
                                    ]}
                                    onPress={() => setFormData({ 
                                        ...formData, 
                                        leadId: m._id, 
                                        leadName: m.fullName || m.name || `${m.firstName || m.name} ${m.lastName || ""}` 
                                    })}
                                >
                                    <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                                        <Text style={[styles.avatarText, { color: theme.primary }]}>{(m.firstName?.[0] || m.fullName?.[0] || m.name?.[0] || 'U').toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.leadLabel, { color: theme.text }]} numberOfLines={1}>
                                         {m.fullName || `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.name || "Lead"}
                                    </Text>
                                    <View style={[styles.scoreTag, { backgroundColor: m.score > 80 ? '#def7ec' : '#fef3c7' }]}>
                                        <Text style={[styles.scoreText, { color: m.score > 80 ? '#03543f' : '#92400e' }]}>{m.score || 0}%</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                    
                    {!!formData.leadId && (
                         <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                             <Text style={styles.selectedIndicatorText}>Selected: {formData.leadName}</Text>
                             <TouchableOpacity onPress={() => setFormData({...formData, leadId: "", leadName: ""})}>
                                 <Ionicons name="close-circle" size={18} color="#fff" />
                             </TouchableOpacity>
                         </View>
                    )}
                </View>

                {/* Financials */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>FINANCIAL TERMS</Text>
                    <Ionicons name="cash-outline" size={14} color={theme.textSecondary} />
                </View>

                <View style={styles.inputContainer}>
                    <View style={styles.inputBox}>
                        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Buyer Offer (₹)</Text>
                        <TextInput
                            style={[styles.premiumInput, { color: theme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}
                            value={formData.amount}
                            onChangeText={(v) => setFormData({ ...formData, amount: v })}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor={theme.textLight}
                        />
                    </View>

                    <View style={styles.inputBox}>
                        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Counter Expectation (₹)</Text>
                        <TextInput
                            style={[styles.premiumInput, { color: theme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}
                            value={formData.counterAmount}
                            onChangeText={(v) => setFormData({ ...formData, counterAmount: v })}
                            keyboardType="numeric"
                            placeholder="Optional"
                            placeholderTextColor={theme.textLight}
                        />
                    </View>
                </View>

                {/* Status Selection */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>OFFER DISPOSITION</Text>
                </View>
                <View style={styles.chipsRow}>
                    {["Active", "Pending", "Accepted", "Rejected"].map(s => (
                        <TouchableOpacity 
                            key={s} 
                            onPress={() => setFormData({ ...formData, status: s })}
                            style={[
                                styles.chip, 
                                { backgroundColor: theme.card, borderColor: theme.border },
                                formData.status === s && { backgroundColor: theme.primary, borderColor: theme.primary }
                            ]}
                        >
                            <Text style={[styles.chipText, { color: theme.textSecondary }, formData.status === s && { color: '#fff' }]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Notes */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>NEGOTIATION NOTES</Text>
                </View>
                <TextInput
                    style={[styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                    value={formData.conditions}
                    onChangeText={(v) => setFormData({ ...formData, conditions: v })}
                    multiline
                    placeholder="Describe contingencies, payment terms, or reasons for counter..."
                    placeholderTextColor={theme.textLight}
                />

                <View style={{ height: 120 }} />
            </ScrollView>

            <TouchableOpacity 
                style={[styles.footerBtn, { backgroundColor: theme.primary }]} 
                onPress={handleSave}
                disabled={saving || !formData.leadId}
            >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.footerBtnText}>Confirm Negotiated Offer</Text>}
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1 },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
    saveText: { fontSize: 14, fontWeight: '800' },
    scrollContent: { padding: 20 },
    
    dealBranding: { padding: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 24 },
    iconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    dealName: { fontSize: 16, fontWeight: '800' },
    dealBudget: { fontSize: 12, fontWeight: '600', marginTop: 2 },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 15 },
    sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

    searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 48, borderRadius: 14, borderWidth: 1, marginBottom: 15 },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '600' },

    leadsGrid: { marginBottom: 24 },
    leadCard: { width: 100, padding: 12, borderRadius: 20, borderWidth: 1, alignItems: 'center', gap: 6 },
    avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 16, fontWeight: '900' },
    leadLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
    scoreTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    scoreText: { fontSize: 10, fontWeight: '900' },
    emptyBox: { padding: 20, borderRadius: 20, borderWidth: 1 },
    
    selectedIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 12, marginTop: 10 },
    selectedIndicatorText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    inputContainer: { gap: 15, marginBottom: 24 },
    inputBox: { gap: 6 },
    inputLabel: { fontSize: 12, fontWeight: '700' },
    premiumInput: { height: 56, borderRadius: 18, paddingHorizontal: 20, fontSize: 18, fontWeight: '800' },

    chipsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
    chipText: { fontSize: 13, fontWeight: '800' },

    textArea: { padding: 18, borderRadius: 20, borderWidth: 1, height: 120, textAlignVertical: 'top', fontSize: 14, fontWeight: '600' },

    footerBtn: { position: 'absolute', bottom: 30, left: 20, right: 20, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
    footerBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});
