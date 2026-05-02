import React, { useState, useEffect, useMemo } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Switch, Platform, StatusBar
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// [SENIOR] High-stability imports using relative paths
import api from "../services/api";
import { getBookingById, addBooking, updateBooking } from "../services/bookings.service";
import { leadName } from "../services/leads.service";
import { extractList } from "../services/api.helpers";
import { useProjects } from "../context/ProjectContext";
import { useUsers } from "../context/UserContext";
import { useTheme } from "../context/ThemeContext";

const FORM_STEPS = ["Client", "Property", "Financials", "Brokerage", "Team", "Confirm"];

export default function AddBookingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { theme } = useTheme();
    
    // Casting params for safety
    const id = params.id as string;
    const leadId = params.leadId as string;
    const dealId = params.dealId as string;

    const { projects, loading: projectsLoading } = useProjects();
    const { users, loading: usersLoading } = useUsers();

    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState<any>({
        type: "Sale",
        applicationNo: "",
        bookingDate: new Date().toISOString().split('T')[0],
        status: "Pending",
        lead: leadId || "",
        deal: dealId || "",
        project: "",
        property: "",
        unitNumber: "",
        totalDealAmount: "",
        tokenAmount: "",
        agreementAmount: "",
        agreementDate: "",
        isPartPaymentEnabled: false,
        partPayments: [{ amount: "", date: "" }],
        salesAgent: "",
        executiveIncentivePercent: "",
        executiveIncentiveAmount: 0,
        isChannelPartnerEnabled: false,
        channelPartner: "",
        partnerSide: "Buyer Side",
        sellerBrokeragePercent: "",
        buyerBrokeragePercent: "",
        remarks: "",
    });

    const [leads, setLeads] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);

    useEffect(() => {
        const init = async () => {
            try {
                const [lRes, dRes, cRes, bRes] = await Promise.all([
                    api.get('/leads?limit=200').catch(() => ({ data: [] })),
                    api.get('/deals?limit=100').catch(() => ({ data: [] })),
                    api.get('/contacts?limit=200').catch(() => ({ data: [] })),
                    id ? getBookingById(id).catch(() => null) : Promise.resolve(null),
                ]);

                setLeads(extractList(lRes));
                setDeals(extractList(dRes));
                setContacts(extractList(cRes));

                if (bRes) {
                    const b = bRes.data || bRes;
                    setFormData((prev: any) => ({
                        ...prev,
                        ...b,
                        partPayments: Array.isArray(b.partPayments) ? b.partPayments : [{ amount: "", date: "" }],
                        totalDealAmount: String(b.totalDealAmount || ""),
                        tokenAmount: String(b.tokenAmount || ""),
                        agreementAmount: String(b.agreementAmount || ""),
                        sellerBrokeragePercent: String(b.sellerBrokeragePercent || ""),
                        buyerBrokeragePercent: String(b.buyerBrokeragePercent || ""),
                        executiveIncentivePercent: String(b.executiveIncentivePercent || ""),
                    }));
                } else if (dealId) {
                    const d = extractList(dRes).find((x: any) => x._id === dealId);
                    if (d) {
                        setFormData((prev: any) => ({
                            ...prev,
                            deal: d._id,
                            project: d.projectId?._id || d.projectId || "",
                            property: d.inventoryId?._id || d.inventoryId || "",
                            lead: d.partyStructure?.buyer?._id || d.partyStructure?.buyer || prev.lead,
                            totalDealAmount: String(d.price || d.amount || ""),
                        }));
                    }
                }
            } catch (e) {
                console.warn("Init load failed", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [id, dealId]);

    useEffect(() => {
        if (!formData.project) return;
        const fetchUnits = async () => {
            try {
                const p = projects.find(x => x._id === formData.project);
                if (p) {
                    const res = await api.get(`/inventory?project=${encodeURIComponent(p.name)}&limit=500`);
                    setUnits(extractList(res));
                }
            } catch (e) {}
        };
        fetchUnits();
    }, [formData.project, projects]);

    const comms = useMemo(() => {
        const total = parseFloat(formData.totalDealAmount) || 0;
        const sP = parseFloat(formData.sellerBrokeragePercent) || 0;
        const bP = parseFloat(formData.buyerBrokeragePercent) || 0;
        const sAmt = (total * sP) / 100;
        const bAmt = (total * bP) / 100;
        return { sAmt, bAmt, total: sAmt + bAmt };
    }, [formData.totalDealAmount, formData.sellerBrokeragePercent, formData.buyerBrokeragePercent]);

    const handleSave = async () => {
        if (!formData.lead || !formData.project) {
            Alert.alert("Error", "Client and Project are required.");
            return;
        }
        setIsSaving(true);
        try {
            const payload = { ...formData, sellerBrokerageAmount: comms.sAmt, buyerBrokerageAmount: comms.bAmt };
            const res = id ? await updateBooking(id, payload) : await addBooking(payload);
            if (res) {
                Alert.alert("Success", "Booking synchronized.");
                router.back();
            }
        } catch (e) {
            Alert.alert("Error", "Synchronization failed.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading || projectsLoading || usersLoading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingTxt, { color: theme.textSecondary }]}>SYNCING ENTERPRISE CORE...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={theme.background === '#121212' ? 'light-content' : 'dark-content'} />
            
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{id ? "EDIT BOOKING" : "NEW BOOKING"}</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.saveBtn, { color: theme.primary }]}>SAVE</Text>}
                </TouchableOpacity>
            </View>

            {/* Step Indicator */}
            <View style={[styles.stepBar, { backgroundColor: theme.card }]}>
                {FORM_STEPS.map((s, i) => (
                    <View key={i} style={styles.stepItem}>
                        <View style={[styles.stepDot, step >= i && { backgroundColor: theme.primary }]} />
                        <Text style={[styles.stepLabel, { color: step === i ? theme.primary : theme.textMuted }]}>{s}</Text>
                    </View>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {step === 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.primary }]}>CLIENT CONTEXT</Text>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>SELECT CLIENT (LEAD)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {leads.slice(0, 15).map(l => (
                                <TouchableOpacity key={l._id} style={[styles.chip, formData.lead === l._id && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setFormData({ ...formData, lead: l._id })}>
                                    <Text style={[styles.chipTxt, { color: formData.lead === l._id ? "#fff" : theme.textSecondary }]}>{leadName(l)}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 20 }]}>BOOKING TYPE</Text>
                        <View style={styles.tabRow}>
                            {["Sale", "Rent", "Lease"].map(t => (
                                <TouchableOpacity key={t} style={[styles.tab, formData.type === t && { backgroundColor: theme.primary }]} onPress={() => setFormData({ ...formData, type: t })}>
                                    <Text style={[styles.tabTxt, { color: formData.type === t ? "#fff" : theme.textSecondary }]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {step === 1 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.primary }]}>PROPERTY SELECTION</Text>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>SELECT PROJECT</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {projects.map(p => (
                                <TouchableOpacity key={p._id} style={[styles.chip, formData.project === p._id && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setFormData({ ...formData, project: p._id, property: "" })}>
                                    <Text style={[styles.chipTxt, { color: formData.project === p._id ? "#fff" : theme.textSecondary }]}>{p.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 20 }]}>SELECT UNIT</Text>
                        {units.length === 0 ? <Text style={{ color: theme.textMuted, fontStyle: 'italic' }}>Select project first...</Text> : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                                {units.slice(0, 20).map(u => (
                                    <TouchableOpacity key={u._id} style={[styles.chip, formData.property === u._id && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setFormData({ ...formData, property: u._id, unitNumber: u.unitNo || u.unitNumber })}>
                                        <Text style={[styles.chipTxt, { color: formData.property === u._id ? "#fff" : theme.textSecondary }]}>{u.unitNo || u.unitNumber}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {step === 2 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.primary }]}>FINANCIALS</Text>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>TOTAL DEAL VALUE</Text>
                        <TextInput style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} keyboardType="numeric" value={formData.totalDealAmount} onChangeText={t => setFormData({ ...formData, totalDealAmount: t })} placeholder="₹ 0.00" placeholderTextColor={theme.textMuted} />
                        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 20 }]}>TOKEN AMOUNT</Text>
                        <TextInput style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} keyboardType="numeric" value={formData.tokenAmount} onChangeText={t => setFormData({ ...formData, tokenAmount: t })} placeholder="₹ 0.00" placeholderTextColor={theme.textMuted} />
                    </View>
                )}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
                {step > 0 && (
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setStep(step - 1)}>
                        <Text style={[styles.navBtnTxt, { color: theme.textSecondary }]}>BACK</Text>
                    </TouchableOpacity>
                )}
                {step < 5 ? (
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.primary, flex: 1, marginLeft: 10 }]} onPress={() => setStep(step + 1)}>
                        <Text style={[styles.navBtnTxt, { color: "#fff" }]}>CONTINUE</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.success, flex: 1, marginLeft: 10 }]} onPress={handleSave}>
                        <Text style={[styles.navBtnTxt, { color: "#fff" }]}>FINALIZE BOOKING</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 30 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingTxt: { marginTop: 15, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1 },
    headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
    backBtn: { padding: 5 },
    saveBtn: { fontWeight: "900" },
    stepBar: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 10, justifyContent: "space-between" },
    stepItem: { alignItems: "center", flex: 1 },
    stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#eee", marginBottom: 4 },
    stepLabel: { fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
    scroll: { padding: 20, paddingBottom: 100 },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 1, marginBottom: 20 },
    label: { fontSize: 10, fontWeight: "800", marginBottom: 10, textTransform: "uppercase" },
    input: { padding: 15, borderRadius: 12, borderWidth: 1, fontSize: 15, fontWeight: "700" },
    chipRow: { flexDirection: "row", marginBottom: 10 },
    chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8, borderColor: "#eee" },
    chipTxt: { fontSize: 12, fontWeight: "700" },
    tabRow: { flexDirection: "row", gap: 10 },
    tab: { flex: 1, padding: 12, backgroundColor: "#eee", borderRadius: 10, alignItems: "center" },
    tabTxt: { fontWeight: "800", fontSize: 12 },
    footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, flexDirection: "row", borderTopWidth: 1, backgroundColor: 'transparent' },
    navBtn: { paddingVertical: 15, paddingHorizontal: 25, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    navBtnTxt: { fontWeight: "900", fontSize: 14 }
});
