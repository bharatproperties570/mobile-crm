import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Modal, FlatList, Switch
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getDealById, addDeal, updateDeal, type Deal } from "./services/deals.service";
import { getLookups } from "./services/lookups.service";
import { getProjects } from "./services/projects.service";
import api from "./services/api";

const DEAL_LOOKUP_TYPES = [
    "Property Type", "Unit Type", "Pricing Mode", "Transaction Type",
    "Deal Type", "Source", "Team", "Stage"
];

const FORM_STEPS = ["Property", "Financials", "Parties", "System"];

function FormLabel({ label, required }: { label: string; required?: boolean }) {
    return (
        <View style={styles.labelContainer}>
            <Text style={styles.label}>{label}</Text>
            {required && <Text style={styles.required}>*</Text>}
        </View>
    );
}

function SectionTitle({ title, icon }: { title: string; icon: string }) {
    return (
        <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionIcon}>{icon}</Text>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    );
}

export default function AddDealScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState<any>({
        // Property
        projectName: "",
        block: "",
        unitNo: "",
        unitType: "",
        propertyType: "",
        size: "",
        sizeUnit: "Sq Ft",
        floor: "",
        location: "",

        // Financials
        price: "",
        quotePrice: "",
        ratePrice: "",
        pricingMode: "",
        dealProbability: "50",
        pricingNature: { negotiable: false, fixed: false },
        transactionType: "Fresh",
        dealType: "Sale",

        // Commission
        commission: {
            brokeragePercent: "",
            expectedAmount: "",
            actualAmount: "",
        },

        // Parties
        associatedContact: "", // Buyer
        owner: "", // Seller
        source: "",
        team: "",
        assignedTo: "",
        remarks: "",
        stage: "open",
    });

    const [lookups, setLookups] = useState<Record<string, any[]>>({});
    const [projects, setProjects] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const results = await Promise.all([
                    ...DEAL_LOOKUP_TYPES.map(t => getLookups(t)),
                    getProjects(),
                    api.get("/users?limit=50"),
                    id ? getDealById(id) : Promise.resolve(null)
                ]);

                const lMap: Record<string, any[]> = {};
                DEAL_LOOKUP_TYPES.forEach((t, i) => {
                    lMap[t] = results[i]?.data || results[i] || [];
                });
                setLookups(lMap);

                setProjects(results[DEAL_LOOKUP_TYPES.length]?.data || results[DEAL_LOOKUP_TYPES.length] || []);

                const uRes = results[DEAL_LOOKUP_TYPES.length + 1];
                setUsers(uRes?.data?.data || uRes?.records || []);

                const existing = results[DEAL_LOOKUP_TYPES.length + 2];
                if (existing) {
                    const d = existing.data || existing;
                    setFormData({
                        ...formData,
                        ...d,
                        price: String(d.price || ""),
                        quotePrice: String(d.quotePrice || ""),
                        ratePrice: String(d.ratePrice || ""),
                        dealProbability: String(d.dealProbability || "50"),
                        projectName: d.projectName || "",
                        stage: d.stage || "open",
                    });
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    const handleSave = async () => {
        if (!formData.projectName || !formData.associatedContact) {
            Alert.alert("Missing Info", "Project and Buyer are required.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = { ...formData };
            const res = id ? await updateDeal(id, payload) : await addDeal(payload);
            if (res) {
                Alert.alert("Success", `Deal ${id ? "updated" : "created"} successfully!`);
                router.back();
            }
        } catch (e) {
            Alert.alert("Error", "Failed to save deal.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E3A8A" /></View>;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{id ? "Edit Deal" : "New Deal"}</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator size="small" color="#1E3A8A" /> : <Text style={styles.saveBtn}>Save</Text>}
                </TouchableOpacity>
            </View>

            {/* Steps */}
            <View style={styles.stepsRow}>
                {FORM_STEPS.map((s, i) => (
                    <View key={s} style={styles.stepItem}>
                        <View style={[styles.stepCircle, step >= i && styles.stepCircleActive]}>
                            <Text style={[styles.stepNumber, step >= i && styles.stepNumberActive]}>{i + 1}</Text>
                        </View>
                        <Text style={[styles.stepLabel, step === i && styles.stepLabelActive]}>{s}</Text>
                    </View>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {step === 0 && (
                    <View>
                        <SectionTitle title="Property Details" icon="🏢" />
                        <FormLabel label="Project Name" required />
                        <TextInput style={styles.input} value={formData.projectName} onChangeText={t => setFormData({ ...formData, projectName: t })} placeholder="e.g. Omaxe City" />

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <FormLabel label="Block" />
                                <TextInput style={styles.input} value={formData.block} onChangeText={t => setFormData({ ...formData, block: t })} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <FormLabel label="Unit No." />
                                <TextInput style={styles.input} value={formData.unitNo} onChangeText={t => setFormData({ ...formData, unitNo: t })} />
                            </View>
                        </View>

                        <FormLabel label="Unit Type" />
                        <TextInput style={styles.input} value={formData.unitType} onChangeText={t => setFormData({ ...formData, unitType: t })} placeholder="e.g. 3BHK" />

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <FormLabel label="Size" />
                                <TextInput style={styles.input} value={formData.size} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, size: t })} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <FormLabel label="Unit" />
                                <TextInput style={styles.input} value={formData.sizeUnit} onChangeText={t => setFormData({ ...formData, sizeUnit: t })} />
                            </View>
                        </View>

                        <FormLabel label="Location" />
                        <TextInput style={[styles.input, { height: 80 }]} multiline value={formData.location} onChangeText={t => setFormData({ ...formData, location: t })} />
                    </View>
                )}

                {step === 1 && (
                    <View>
                        <SectionTitle title="Financials & Pricing" icon="💰" />
                        <FormLabel label="Listed Price" />
                        <TextInput style={styles.input} value={formData.price} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, price: t })} />

                        <FormLabel label="Quote Price" />
                        <TextInput style={styles.input} value={formData.quotePrice} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, quotePrice: t })} />

                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleLabel}>Negotiable</Text>
                            <Switch value={formData.pricingNature.negotiable} onValueChange={v => setFormData({ ...formData, pricingNature: { ...formData.pricingNature, negotiable: v } })} />
                        </View>

                        <FormLabel label="Deal Probability (%)" />
                        <TextInput style={styles.input} value={formData.dealProbability} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, dealProbability: t })} />

                        <FormLabel label="Pricing Mode" />
                        <TextInput style={styles.input} value={formData.pricingMode} onChangeText={t => setFormData({ ...formData, pricingMode: t })} />
                    </View>
                )}

                {step === 2 && (
                    <View>
                        <SectionTitle title="Parties Involved" icon="👥" />
                        <FormLabel label="Buyer (Contact ID/Name)" required />
                        <TextInput style={styles.input} value={formData.associatedContact} onChangeText={t => setFormData({ ...formData, associatedContact: t })} placeholder="Associate with contact" />

                        <FormLabel label="Owner / Seller" />
                        <TextInput style={styles.input} value={formData.owner} onChangeText={t => setFormData({ ...formData, owner: t })} />

                        <SectionTitle title="Commission" icon="💼" />
                        <FormLabel label="Brokerage %" />
                        <TextInput style={styles.input} value={formData.commission.brokeragePercent} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, commission: { ...formData.commission, brokeragePercent: t } })} />

                        <FormLabel label="Expected Amount" />
                        <TextInput style={styles.input} value={formData.commission.expectedAmount} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, commission: { ...formData.commission, expectedAmount: t } })} />
                    </View>
                )}

                {step === 3 && (
                    <View>
                        <SectionTitle title="System & Assignment" icon="⚙️" />
                        <FormLabel label="Assigned RM" />
                        <TextInput style={styles.input} value={formData.assignedTo} onChangeText={t => setFormData({ ...formData, assignedTo: t })} placeholder="User ID or Name" />

                        <FormLabel label="Source" />
                        <TextInput style={styles.input} value={formData.source} onChangeText={t => setFormData({ ...formData, source: t })} />

                        <FormLabel label="Current Stage" />
                        <View style={styles.chipRow}>
                            {["open", "quote", "negotiation", "booked"].map(s => (
                                <TouchableOpacity key={s} style={[styles.chip, formData.stage === s && styles.chipActive]} onPress={() => setFormData({ ...formData, stage: s })}>
                                    <Text style={[styles.chipText, formData.stage === s && styles.chipTextActive]}>{s.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <FormLabel label="Remarks / Notes" />
                        <TextInput style={[styles.input, { height: 120 }]} multiline value={formData.remarks} onChangeText={t => setFormData({ ...formData, remarks: t })} />
                    </View>
                )}
            </ScrollView>

            {/* Footer Navigation */}
            <View style={styles.footer}>
                {step > 0 ? (
                    <TouchableOpacity style={styles.navBtn} onPress={() => setStep(step - 1)}>
                        <Text style={styles.navBtnText}>Previous</Text>
                    </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}

                {step < FORM_STEPS.length - 1 ? (
                    <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={() => setStep(step + 1)}>
                        <Text style={styles.navBtnTextPrimary}>Next Step</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: "#10B981" }]} onPress={handleSave}>
                        <Text style={styles.navBtnTextPrimary}>Finish & Save</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    saveBtn: { fontSize: 16, fontWeight: "700", color: "#1E3A8A" },
    stepsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 16, backgroundColor: "#F8FAFC" },
    stepItem: { alignItems: "center", flex: 1 },
    stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center", marginBottom: 4 },
    stepCircleActive: { backgroundColor: "#1E3A8A" },
    stepNumber: { fontSize: 12, fontWeight: "800", color: "#64748B" },
    stepNumberActive: { color: "#fff" },
    stepLabel: { fontSize: 10, fontWeight: "600", color: "#94A3B8" },
    stepLabelActive: { color: "#1E3A8A", fontWeight: "800" },
    scroll: { padding: 20 },
    labelContainer: { flexDirection: "row", marginBottom: 6, marginTop: 12 },
    label: { fontSize: 13, fontWeight: "700", color: "#475569" },
    required: { color: "#EF4444", marginLeft: 2 },
    input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, fontSize: 15, color: "#1E293B" },
    row: { flexDirection: "row" },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, marginTop: 8 },
    sectionIcon: { fontSize: 20, marginRight: 8 },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: "#1E3A8A", textTransform: "uppercase", letterSpacing: 0.5 },
    toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 12, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12 },
    toggleLabel: { fontSize: 14, fontWeight: "600", color: "#475569" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
    chipActive: { backgroundColor: "#EEF2FF", borderColor: "#6366F1" },
    chipText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
    chipTextActive: { color: "#6366F1" },
    footer: { flexDirection: "row", padding: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9", gap: 12 },
    navBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
    navBtnPrimary: { backgroundColor: "#1E3A8A" },
    navBtnText: { fontSize: 15, fontWeight: "700", color: "#64748B" },
    navBtnTextPrimary: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
