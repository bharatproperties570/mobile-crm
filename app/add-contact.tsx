import React, { useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView
} from "react-native";
import { useRouter } from "expo-router";
import api from "./services/api";

// ─── Reusable Components ──────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: string }) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>{icon}</Text>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>
                {label}
                {required && <Text style={styles.required}> *</Text>}
            </Text>
            {children}
        </View>
    );
}

function Input({
    value, onChangeText, placeholder, keyboardType, multiline, numberOfLines, editable = true,
}: {
    value: string; onChangeText: (t: string) => void; placeholder?: string;
    keyboardType?: any; multiline?: boolean; numberOfLines?: number; editable?: boolean;
}) {
    return (
        <TextInput
            style={[styles.input, multiline && { height: 80, textAlignVertical: "top" }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder ?? ""}
            placeholderTextColor="#9CA3AF"
            keyboardType={keyboardType ?? "default"}
            multiline={multiline}
            numberOfLines={numberOfLines}
            editable={editable}
        />
    );
}

function SelectButton({
    value, placeholder, options, onSelect,
}: {
    value: string; placeholder: string; options: string[]; onSelect: (v: string) => void;
}) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {options.map((opt) => (
                <TouchableOpacity
                    key={opt}
                    style={[styles.chip, value === opt && styles.chipSelected]}
                    onPress={() => onSelect(opt === value ? "" : opt)}
                >
                    <Text style={[styles.chipText, value === opt && styles.chipTextSelected]}>{opt}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

interface ContactForm {
    // Basic
    name: string;
    surname: string;
    fatherName: string;
    phone: string;
    phone2: string;
    email: string;
    email2: string;
    description: string;
    // Professional
    company: string;
    workOffice: string;
    designation: string;
    // Personal
    gender: string;
    maritalStatus: string;
    birthDate: string;
    anniversaryDate: string;
    // Source
    source: string;
    campaign: string;
    // Address
    hNo: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
}

const INITIAL: ContactForm = {
    name: "", surname: "", fatherName: "", phone: "", phone2: "",
    email: "", email2: "", description: "",
    company: "", workOffice: "", designation: "",
    gender: "", maritalStatus: "", birthDate: "", anniversaryDate: "",
    source: "", campaign: "",
    hNo: "", street: "", city: "", state: "", pinCode: "",
};

export default function AddContactScreen() {
    const router = useRouter();
    const [form, setForm] = useState<ContactForm>(INITIAL);
    const [saving, setSaving] = useState(false);

    const set = (key: keyof ContactForm) => (val: string) =>
        setForm((f) => ({ ...f, [key]: val }));

    const handleSave = async () => {
        if (!form.name.trim()) {
            Alert.alert("Required", "Please enter the contact's first name.");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                surname: form.surname.trim() || undefined,
                fatherName: form.fatherName.trim() || undefined,
                phones: [
                    ...(form.phone ? [{ number: form.phone, type: "Personal" }] : []),
                    ...(form.phone2 ? [{ number: form.phone2, type: "Work" }] : []),
                ],
                emails: [
                    ...(form.email ? [{ address: form.email, type: "Personal" }] : []),
                    ...(form.email2 ? [{ address: form.email2, type: "Work" }] : []),
                ],
                description: form.description || undefined,
                company: form.company || undefined,
                workOffice: form.workOffice || undefined,
                gender: form.gender || undefined,
                maritalStatus: form.maritalStatus || undefined,
                personalAddress: {
                    hNo: form.hNo || undefined,
                    street: form.street || undefined,
                    pinCode: form.pinCode || undefined,
                },
            };
            await api.post("/contacts", payload);
            Alert.alert("✅ Success", "Contact saved successfully!", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Failed to save contact.";
            Alert.alert("Error", msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtn}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Add Contact</Text>
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        {saving
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

                    {/* ── Basic Information ── */}
                    <SectionHeader title="Basic Information" icon="👤" />
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Field label="First Name" required>
                                    <Input value={form.name} onChangeText={set("name")} placeholder="Amit" />
                                </Field>
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Field label="Last Name">
                                    <Input value={form.surname} onChangeText={set("surname")} placeholder="Sharma" />
                                </Field>
                            </View>
                        </View>

                        <Field label="Father's Name">
                            <Input value={form.fatherName} onChangeText={set("fatherName")} placeholder="Raj Sharma" />
                        </Field>

                        <Field label="Mobile Number" required>
                            <Input value={form.phone} onChangeText={set("phone")} placeholder="+91 98765 43210" keyboardType="phone-pad" />
                        </Field>

                        <Field label="Mobile Number 2">
                            <Input value={form.phone2} onChangeText={set("phone2")} placeholder="Work / Alternate" keyboardType="phone-pad" />
                        </Field>

                        <Field label="Email Address">
                            <Input value={form.email} onChangeText={set("email")} placeholder="amit@example.com" keyboardType="email-address" />
                        </Field>

                        <Field label="Email 2">
                            <Input value={form.email2} onChangeText={set("email2")} placeholder="Work email" keyboardType="email-address" />
                        </Field>

                        <Field label="Description / Notes">
                            <Input value={form.description} onChangeText={set("description")} placeholder="Any notes about this contact..." multiline numberOfLines={3} />
                        </Field>
                    </View>

                    {/* ── Professional Details ── */}
                    <SectionHeader title="Professional Details" icon="💼" />
                    <View style={styles.card}>
                        <Field label="Company Name">
                            <Input value={form.company} onChangeText={set("company")} placeholder="ABC Enterprises" />
                        </Field>
                        <Field label="Work Office / Branch">
                            <Input value={form.workOffice} onChangeText={set("workOffice")} placeholder="Head Office, Delhi" />
                        </Field>
                        <Field label="Designation">
                            <Input value={form.designation} onChangeText={set("designation")} placeholder="Manager" />
                        </Field>
                    </View>

                    {/* ── Personal Details ── */}
                    <SectionHeader title="Personal Details" icon="🪪" />
                    <View style={styles.card}>
                        <Field label="Gender">
                            <SelectButton
                                value={form.gender}
                                placeholder="Select gender"
                                options={["Male", "Female", "Other"]}
                                onSelect={set("gender")}
                            />
                        </Field>
                        <Field label="Marital Status">
                            <SelectButton
                                value={form.maritalStatus}
                                placeholder="Select status"
                                options={["Single", "Married", "Divorced", "Widowed"]}
                                onSelect={set("maritalStatus")}
                            />
                        </Field>
                        <Field label="Date of Birth">
                            <Input value={form.birthDate} onChangeText={set("birthDate")} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
                        </Field>
                        <Field label="Anniversary Date">
                            <Input value={form.anniversaryDate} onChangeText={set("anniversaryDate")} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
                        </Field>
                    </View>

                    {/* ── Source & Campaign ── */}
                    <SectionHeader title="Source & Campaign" icon="📣" />
                    <View style={styles.card}>
                        <Field label="Lead Source">
                            <SelectButton
                                value={form.source}
                                placeholder="Select source"
                                options={["Walk-in", "Reference", "Online", "Cold Call", "Social Media", "Builder", "Channel Partner", "Other"]}
                                onSelect={set("source")}
                            />
                        </Field>
                        <Field label="Campaign">
                            <Input value={form.campaign} onChangeText={set("campaign")} placeholder="Campaign name" />
                        </Field>
                    </View>

                    {/* ── Address ── */}
                    <SectionHeader title="Address" icon="📍" />
                    <View style={styles.card}>
                        <Field label="House / Flat No.">
                            <Input value={form.hNo} onChangeText={set("hNo")} placeholder="A-12, Sector 5" />
                        </Field>
                        <Field label="Street / Colony">
                            <Input value={form.street} onChangeText={set("street")} placeholder="MG Road" />
                        </Field>
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Field label="City">
                                    <Input value={form.city} onChangeText={set("city")} placeholder="Delhi" />
                                </Field>
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Field label="State">
                                    <Input value={form.state} onChangeText={set("state")} placeholder="Delhi" />
                                </Field>
                            </View>
                        </View>
                        <Field label="Pin Code">
                            <Input value={form.pinCode} onChangeText={set("pinCode")} placeholder="110001" keyboardType="number-pad" />
                        </Field>
                    </View>

                    {/* Bottom Save Button */}
                    <TouchableOpacity
                        style={[styles.bottomSaveBtn, saving && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.bottomSaveBtnText}>✓ Save Contact</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#fff", paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    backBtn: { padding: 6 },
    backIcon: { fontSize: 22, color: "#1E40AF", fontWeight: "700" },
    headerTitle: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
    saveBtn: {
        backgroundColor: "#1E40AF", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
        minWidth: 60, alignItems: "center",
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    scroll: { padding: 16, paddingBottom: 40, backgroundColor: "#F0F4FF" },
    sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 10, marginLeft: 4 },
    sectionIcon: { fontSize: 18, marginRight: 8 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5 },
    card: {
        backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 4,
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    row: { flexDirection: "row" },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
    required: { color: "#EF4444" },
    input: {
        borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: "#1E293B", backgroundColor: "#F8FAFC",
    },
    chipRow: { flexDirection: "row" },
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
        borderColor: "#E2E8F0", marginRight: 8, backgroundColor: "#F8FAFC",
    },
    chipSelected: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
    chipText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
    chipTextSelected: { color: "#fff" },
    bottomSaveBtn: {
        backgroundColor: "#1E40AF", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 24, marginBottom: 8,
        shadowColor: "#1E40AF", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5,
    },
    bottomSaveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
