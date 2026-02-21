import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Modal, FlatList, Switch
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getBookingById, addBooking, updateBooking, type Booking } from "./services/bookings.service";
import { getLeads, leadName } from "./services/leads.service";
import { getDeals } from "./services/deals.service";
import { getProjects } from "./services/projects.service";
import api from "./services/api";

const FORM_STEPS = ["Client", "Property", "Financials", "Submit"];

function FormLabel({ label, required }: { label: string; required?: boolean }) {
    return (
        <View style={styles.labelContainer}>
            <Text style={styles.label}>{label}</Text>
            {required && <Text style={styles.required}>*</Text>}
        </View>
    );
}

export default function AddBookingScreen() {
    const router = useRouter();
    const { id, leadId, dealId } = useLocalSearchParams<{ id: string; leadId: string; dealId: string }>();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState<any>({
        applicationNo: "",
        bookingDate: new Date().toISOString().split('T')[0],
        status: "Pending",
        lead: leadId || "",
        deal: dealId || "",
        inventory: "",
        totalDealAmount: "",
        tokenAmount: "",
        remarks: "",
    });

    const [leads, setLeads] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const results = await Promise.all([
                    getLeads(),
                    getDeals(),
                    id ? getBookingById(id) : Promise.resolve(null),
                ]);

                setLeads(results[0]?.data || results[0] || []);
                setDeals(results[1]?.data || results[1] || []);

                const existing = results[2];
                if (existing) {
                    const b = existing.data || existing;
                    setFormData((prev: any) => ({
                        ...prev,
                        ...b,
                        totalDealAmount: String(b.totalDealAmount || ""),
                        tokenAmount: String(b.tokenAmount || ""),
                    }));
                } else if (dealId) {
                    const d = results[1].find((x: any) => x._id === dealId);
                    if (d) {
                        setFormData((prev: any) => ({
                            ...prev,
                            deal: d._id,
                            lead: d.lead?._id || d.lead || prev.lead,
                            totalDealAmount: String(d.price || d.amount || ""),
                        }));
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id]);

    const handleSave = async () => {
        if (!formData.lead || !formData.tokenAmount) {
            Alert.alert("Missing Info", "Client and Token Amount are required.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                totalDealAmount: Number(formData.totalDealAmount),
                tokenAmount: Number(formData.tokenAmount),
            };
            const res = id ? await updateBooking(id, payload) : await addBooking(payload);
            if (res) {
                Alert.alert("Success", `Booking ${id ? "updated" : "created"} successfully!`);
                router.back();
            }
        } catch (e) {
            Alert.alert("Error", "Failed to save booking.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{id ? "Edit Booking" : "New Booking"}</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator size="small" color="#10B981" /> : <Text style={styles.saveBtn}>Save</Text>}
                </TouchableOpacity>
            </View>

            {/* Step Indicators */}
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
                        <Text style={styles.sectionTitle}>Client Assignment</Text>
                        <FormLabel label="Client (Lead)" required />
                        <View style={styles.chipList}>
                            {leads.map(l => (
                                <TouchableOpacity
                                    key={l._id}
                                    style={[styles.chip, formData.lead === l._id && styles.chipActive]}
                                    onPress={() => setFormData({ ...formData, lead: l._id })}
                                >
                                    <Text style={[styles.chipText, formData.lead === l._id && styles.chipTextActive]}>{leadName(l)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <FormLabel label="Application Number" />
                        <TextInput style={styles.input} value={formData.applicationNo} onChangeText={t => setFormData({ ...formData, applicationNo: t })} placeholder="e.g. BP/2026/001" />

                        <FormLabel label="Booking Date" />
                        <TextInput style={styles.input} value={formData.bookingDate} onChangeText={t => setFormData({ ...formData, bookingDate: t })} placeholder="YYYY-MM-DD" />
                    </View>
                )}

                {step === 1 && (
                    <View>
                        <Text style={styles.sectionTitle}>Property & Deal</Text>
                        <FormLabel label="Associate Deal" />
                        <View style={styles.chipList}>
                            {deals.map(d => (
                                <TouchableOpacity
                                    key={d._id}
                                    style={[styles.chip, formData.deal === d._id && styles.chipActive]}
                                    onPress={() => setFormData({ ...formData, deal: d._id })}
                                >
                                    <Text style={[styles.chipText, formData.deal === d._id && styles.chipTextActive]}>{d.dealId || d.projectName}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <FormLabel label="Unit Details (Optional)" />
                        <TextInput style={styles.input} value={formData.inventory} onChangeText={t => setFormData({ ...formData, inventory: t })} placeholder="Inventory ID or Description" />
                    </View>
                )}

                {step === 2 && (
                    <View>
                        <Text style={styles.sectionTitle}>Financial Summary</Text>
                        <FormLabel label="Total Deal Amount" />
                        <TextInput style={styles.input} value={formData.totalDealAmount} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, totalDealAmount: t })} placeholder="₹" />

                        <FormLabel label="Token Amount" required />
                        <TextInput style={styles.input} value={formData.tokenAmount} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, tokenAmount: t })} placeholder="₹" />

                        <FormLabel label="Remarks" />
                        <TextInput style={[styles.input, { height: 100 }]} multiline value={formData.remarks} onChangeText={t => setFormData({ ...formData, remarks: t })} placeholder="Additional notes..." />
                    </View>
                )}

                {step === 3 && (
                    <View style={styles.center}>
                        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                        <Text style={styles.finalTitle}>Ready to Book</Text>
                        <Text style={styles.finalSub}>Review details and click save to finalize the booking.</Text>

                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryText}>Client: {leads.find(l => l._id === formData.lead)?.firstName || "Selected"}</Text>
                            <Text style={styles.summaryText}>Token: ₹{formData.tokenAmount}</Text>
                            <Text style={styles.summaryText}>Date: {formData.bookingDate}</Text>
                        </View>
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
                        <Text style={styles.navBtnTextPrimary}>Confirm Booking</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    saveBtn: { fontSize: 16, fontWeight: "700", color: "#10B981" },
    stepsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 16, backgroundColor: "#F8FAFC" },
    stepItem: { alignItems: "center", flex: 1 },
    stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center", marginBottom: 4 },
    stepCircleActive: { backgroundColor: "#10B981" },
    stepNumber: { fontSize: 12, fontWeight: "800", color: "#64748B" },
    stepNumberActive: { color: "#fff" },
    stepLabel: { fontSize: 10, fontWeight: "600", color: "#94A3B8" },
    stepLabelActive: { color: "#10B981", fontWeight: "800" },
    scroll: { padding: 20 },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: "#1E3A8A", textTransform: "uppercase", marginBottom: 16, letterSpacing: 0.5 },
    labelContainer: { flexDirection: "row", marginBottom: 6, marginTop: 12 },
    label: { fontSize: 13, fontWeight: "700", color: "#475569" },
    required: { color: "#EF4444", marginLeft: 2 },
    input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, fontSize: 15, color: "#1E293B" },
    chipList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
    chipActive: { backgroundColor: "#ECFDF5", borderColor: "#10B981" },
    chipText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
    chipTextActive: { color: "#059669" },
    footer: { flexDirection: "row", padding: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9", gap: 12 },
    navBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
    navBtnPrimary: { backgroundColor: "#1E293B" },
    navBtnText: { fontSize: 15, fontWeight: "700", color: "#64748B" },
    navBtnTextPrimary: { fontSize: 15, fontWeight: "700", color: "#fff" },
    finalTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B", marginTop: 16 },
    finalSub: { fontSize: 14, color: "#64748B", textAlign: "center", marginTop: 8 },
    summaryCard: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 16, marginTop: 24, width: "100%", borderWidth: 1, borderColor: "#E2E8F0" },
    summaryText: { fontSize: 15, fontWeight: "600", color: "#475569", marginBottom: 8 },
});
