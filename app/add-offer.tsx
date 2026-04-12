import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, SafeAreaView, Platform, Dimensions
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/services/api";
import { useTheme, SPACING, Colors } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AddOffer() {
    const { theme, isDark } = useTheme();
    const router = useRouter();
    const { dealId } = useLocalSearchParams<{ dealId: string }>();
    const { getLookupValue } = useLookup();
    const { users } = useUsers();

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

    useEffect(() => {
        const fetchData = async () => {
            if (!dealId) return;
            try {
                const [dealRes, matchRes] = await Promise.all([
                    api.get(`/deals/${dealId}`),
                    api.get(`/leads/match`, { params: { dealId } })
                ]);

                if (dealRes.data) {
                    const d = dealRes.data.data || dealRes.data;
                    setDeal(d);
                    // Pre-select if there is an associated contact
                    if (d.associatedContact) {
                        setFormData(prev => ({ 
                            ...prev, 
                            leadId: d.associatedContact._id || d.associatedContact.id,
                            leadName: d.associatedContact.fullName || d.associatedContact.name
                        }));
                    }
                }
                if (matchRes.data && matchRes.data.success) {
                    setMatchingLeads(matchRes.data.data || []);
                }
            } catch (error) {
                console.error("Error fetching offer context:", error);
                Alert.alert("Error", "Failed to load deal or matching leads");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dealId]);

    const handleSave = async () => {
        if (!formData.leadId || !formData.amount) {
            Alert.alert("Required", "Please select a lead and enter an offer amount.");
            return;
        }

        setSaving(true);
        try {
            const offerData = {
                round: (deal.negotiationRounds || []).length + 1,
                date: new Date().toISOString(),
                offerBy: formData.leadName,
                buyerOffer: Number(formData.amount),
                ownerCounter: formData.counterAmount ? Number(formData.counterAmount) : 0,
                status: formData.status,
                notes: formData.conditions
            };

            const payload = {
                negotiationRounds: [
                    ...(deal.negotiationRounds || []),
                    offerData
                ],
                // Update stage to Negotiation if it's not already
                stage: deal.stage === 'Closed' || deal.stage === 'Lost' ? deal.stage : 'Negotiation'
            };

            const res = await api.patch(`/deals/${dealId}`, payload);
            if (res.data && (res.data.success || res.status === 200)) {
                Alert.alert("Success", "Offer recorded successfully");
                router.back();
            } else {
                throw new Error(res.data?.message || "Failed to save offer");
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to save offer");
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
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SELECT PROSPECT</Text>
                    <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                </View>

                <View style={styles.leadsGrid}>
                    {matchingLeads.length === 0 && !formData.leadId ? (
                        <View style={[styles.emptyBox, { borderColor: theme.border, borderStyle: 'dotted' }]}>
                            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>No matched leads found. Please attach a lead to this deal first.</Text>
                        </View>
                    ) : matchingLeads.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                            {matchingLeads.map((m: any) => (
                                <TouchableOpacity
                                    key={m._id}
                                    style={[
                                        styles.leadCard,
                                        { backgroundColor: theme.card, borderColor: theme.border },
                                        formData.leadId === m._id && { borderColor: theme.primary, backgroundColor: theme.primary + '05' }
                                    ]}
                                    onPress={() => setFormData({ ...formData, leadId: m._id, leadName: m.fullName || m.name || `${m.firstName} ${m.lastName || ""}` })}
                                >
                                    <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                                        <Text style={[styles.avatarText, { color: theme.primary }]}>{(m.firstName?.[0] || m.fullName?.[0] || 'U').toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.leadLabel, { color: theme.text }]} numberOfLines={1}>{m.firstName || m.fullName}</Text>
                                    <View style={[styles.scoreTag, { backgroundColor: m.score > 80 ? '#def7ec' : '#fef3c7' }]}>
                                        <Text style={[styles.scoreText, { color: m.score > 80 ? '#03543f' : '#92400e' }]}>{m.score}%</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    ) : (
                        formData.leadId && (
                            <View style={[styles.selectedLeadBar, { backgroundColor: theme.card, borderColor: theme.primary }]}>
                                <Ionicons name="person-circle" size={24} color={theme.primary} />
                                <Text style={[styles.selectedLeadName, { color: theme.text }]}>{formData.leadName}</Text>
                                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                            </View>
                        )
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

                <View style={{ height: 100 }} />
            </ScrollView>

            <TouchableOpacity 
                style={[styles.footerBtn, { backgroundColor: theme.primary }]} 
                onPress={handleSave}
                disabled={saving}
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

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 10 },
    sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

    leadsGrid: { marginBottom: 24 },
    leadCard: { width: 100, padding: 12, borderRadius: 20, borderWidth: 1, alignItems: 'center', gap: 6 },
    avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 16, fontWeight: '900' },
    leadLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
    scoreTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    scoreText: { fontSize: 8, fontWeight: '900' },
    emptyBox: { padding: 20, borderRadius: 20, borderWidth: 1 },
    selectedLeadBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 16, borderWidth: 1 },
    selectedLeadName: { flex: 1, fontSize: 14, fontWeight: '700' },

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
