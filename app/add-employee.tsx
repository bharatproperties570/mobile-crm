import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
    Animated, Pressable, FlatList
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "./services/api";
import { useTheme, SPACING } from "./context/ThemeContext";

// ─── Reusable Components ──────────────────────────────────────────────────────

function SectionHeader({ title, icon, subtitle }: { title: string; icon: string; subtitle?: string }) {
    const { theme } = useTheme();
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: theme.primary + '10' }]}>
                    <Text style={styles.sectionIconText}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{title}</Text>
                    {subtitle && <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
                </View>
            </View>
            <View style={[styles.sectionSeparator, { backgroundColor: theme.border }]} />
        </View>
    );
}

function Field({ label, required, children, helperText }: { label?: string; required?: boolean; children: React.ReactNode; helperText?: string }) {
    const { theme } = useTheme();
    return (
        <View style={styles.field}>
            {label && (
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    {label}
                    {required && <Text style={{ color: theme.error }}> *</Text>}
                </Text>
            )}
            {children}
            {helperText && <Text style={[styles.helperText, { color: theme.textMuted }]}>{helperText}</Text>}
        </View>
    );
}

function SelectButton({
    value, options, onSelect,
}: {
    value: string; options: { label: string, value: string }[]; onSelect: (v: string) => void;
}) {
    const { theme } = useTheme();
    if (options.length === 0) return <Text style={{ color: theme.textSecondary, fontSize: 13, padding: 8 }}>No options available</Text>;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {options.map((opt, idx) => (
                <TouchableOpacity
                    key={`${opt.value || idx}-${idx}`}
                    onPress={() => onSelect(opt.value === value ? "" : opt.value)}
                    style={[
                        styles.selectableChip,
                        { borderColor: theme.border, backgroundColor: theme.cardBg },
                        value === opt.value && { backgroundColor: theme.primary + '08', borderColor: theme.primary },
                    ]}
                >
                    <Text style={[styles.selectableChipText, { color: theme.textSecondary }, value === opt.value && { color: theme.primary }]}>{opt.label}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddEmployeeScreen() {
    const { companyId } = useLocalSearchParams<{ companyId: string }>();
    const router = useRouter();
    const { theme } = useTheme();

    const [saving, setSaving] = useState(false);
    const [searching, setSearching] = useState(false);
    const [contactSearch, setContactSearch] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedContact, setSelectedContact] = useState<any>(null);

    // Professional Details
    const [lookups, setLookups] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [subCategories, setSubCategories] = useState<any[]>([]);
    const [designations, setDesignations] = useState<any[]>([]);

    const [form, setForm] = useState({
        professionCategory: "",
        professionSubCategory: "",
        designation: ""
    });

    useEffect(() => {
        const loadLookups = async () => {
            try {
                const res = await api.get("/lookups", { params: { limit: 2000 } });
                const all = res.data?.data || [];
                setLookups(all);

                setCategories(all.filter((l: any) => l.lookup_type === 'ProfessionalCategory').map((l: any) => ({ label: l.lookup_value, value: l._id })));
                setDesignations(all.filter((l: any) => l.lookup_type === 'ProfessionalDesignation').map((l: any) => ({ label: l.lookup_value, value: l._id })));
            } catch (e) {
                console.error("[AddEmployee] Lookup load failed", e);
            }
        };
        loadLookups();
    }, []);

    useEffect(() => {
        if (form.professionCategory) {
            const filtered = lookups
                .filter((l: any) => l.lookup_type === 'ProfessionalSubCategory' && l.parent_lookup_id === form.professionCategory)
                .map((l: any) => ({ label: l.lookup_value, value: l._id }));
            setSubCategories(filtered);
        } else {
            setSubCategories([]);
        }
    }, [form.professionCategory, lookups]);

    const handleSearch = useCallback(async (text: string) => {
        setContactSearch(text);
        if (text.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const res = await api.get("/contacts", { params: { search: text, limit: 10 } });
            setSearchResults(res.data?.records || []);
        } catch (e) {
            console.error("[AddEmployee] Search failed", e);
        } finally {
            setSearching(false);
        }
    }, []);

    const handleLink = async () => {
        if (!selectedContact) {
            Alert.alert("Required", "Please select a contact to link as an employee.");
            return;
        }

        setSaving(true);
        try {
            // 1. Update Contact with Professional Details
            await api.put(`/contacts/${selectedContact._id}`, {
                ...form,
                workOffice: "Main Office" // Default or can be made configurable
            });

            // 2. Link Contact to Company
            const companyRes = await api.get(`/companies/${companyId}`);
            const company = companyRes.data?.data;
            if (company) {
                const currentEmployees = company.employees || [];
                if (!currentEmployees.includes(selectedContact._id)) {
                    await api.put(`/companies/${companyId}`, {
                        employees: [...currentEmployees, selectedContact._id]
                    });
                }
            }

            Alert.alert("✅ Success", "Employee linked successfully!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.error || "Failed to link employee.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Add Employee</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Link existing contact to company</Text>
                    </View>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">
                    <SectionHeader title="Search Contact" icon="🔍" subtitle="Find person from backend" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <View style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <Ionicons name="search" size={20} color={theme.textMuted} />
                            <TextInput
                                style={[styles.searchInput, { color: theme.textPrimary }]}
                                placeholder="Search by name, phone or email..."
                                placeholderTextColor={theme.textMuted}
                                value={contactSearch}
                                onChangeText={handleSearch}
                            />
                            {searching && <ActivityIndicator size="small" color={theme.primary} />}
                        </View>

                        {selectedContact ? (
                            <View style={[styles.selectedContactCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.contactName, { color: theme.textPrimary }]}>{selectedContact.name}</Text>
                                    <Text style={[styles.contactInfo, { color: theme.textSecondary }]}>
                                        {selectedContact.phones?.[0]?.number || "No Phone"} • {selectedContact.emails?.[0]?.address || "No Email"}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => { setSelectedContact(null); setContactSearch(""); }}>
                                    <Ionicons name="close-circle" size={24} color={theme.error} />
                                </TouchableOpacity>
                            </View>
                        ) : searchResults.length > 0 ? (
                            <View style={styles.resultsContainer}>
                                {searchResults.map((contact) => (
                                    <TouchableOpacity
                                        key={contact._id}
                                        style={[styles.resultItem, { borderBottomColor: theme.border }]}
                                        onPress={() => {
                                            setSelectedContact(contact);
                                            setSearchResults([]);
                                            setContactSearch("");
                                        }}
                                    >
                                        <Text style={[styles.resultName, { color: theme.textPrimary }]}>{contact.name}</Text>
                                        <Text style={[styles.resultInfo, { color: theme.textSecondary }]}>
                                            {contact.phones?.[0]?.number || "No Mobile"}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : contactSearch.length >= 2 && !searching && (
                            <Text style={[styles.emptySearch, { color: theme.textMuted }]}>No contacts found.</Text>
                        )}
                    </View>

                    <SectionHeader title="Professional Assignment" icon="💼" subtitle="Role and category within company" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Profession Category" required>
                            <SelectButton
                                value={form.professionCategory}
                                options={categories}
                                onSelect={(v) => setForm(f => ({ ...f, professionCategory: v, professionSubCategory: "" }))}
                            />
                        </Field>

                        {form.professionCategory !== "" && (
                            <Field label="Sub Category" required>
                                <SelectButton
                                    value={form.professionSubCategory}
                                    options={subCategories}
                                    onSelect={(v) => setForm(f => ({ ...f, professionSubCategory: v }))}
                                />
                            </Field>
                        )}

                        <Field label="Designation" required>
                            <SelectButton
                                value={form.designation}
                                options={designations}
                                onSelect={(v) => setForm(f => ({ ...f, designation: v }))}
                            />
                        </Field>
                    </View>

                    <TouchableOpacity
                        style={[styles.linkBtn, { backgroundColor: theme.primary }, (!selectedContact || saving) && styles.btnDisabled]}
                        onPress={handleLink}
                        disabled={!selectedContact || saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="link-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.linkBtnText}>Link as Employee</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 20, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 60 : 20,
    },
    backBtn: { padding: 4 },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
    content: { flex: 1 },
    scroll: { padding: 20, paddingBottom: 40 },
    sectionHeader: { marginTop: 8, marginBottom: 20 },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    sectionIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    sectionIconText: { fontSize: 20 },
    sectionTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
    sectionSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
    sectionSeparator: { height: 1, marginTop: 16, opacity: 0.5 },
    card: {
        borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1,
        shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2,
    },
    field: { marginBottom: 20 },
    fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginLeft: 4 },
    helperText: { fontSize: 12, marginTop: 6, marginLeft: 4 },
    searchBox: {
        flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16,
    },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600' },
    selectedContactCard: {
        flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1.5,
    },
    contactName: { fontSize: 16, fontWeight: '700' },
    contactInfo: { fontSize: 12, marginTop: 2 },
    resultsContainer: { marginTop: 8 },
    resultItem: { paddingVertical: 12, borderBottomWidth: 1 },
    resultName: { fontSize: 15, fontWeight: '600' },
    resultInfo: { fontSize: 12, marginTop: 2 },
    emptySearch: { textAlign: 'center', marginTop: 16, fontSize: 14 },
    chipRow: { flexDirection: "row", marginTop: 4 },
    chipRowContent: { paddingRight: 20 },
    selectableChip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, marginRight: 10,
    },
    selectableChipText: { fontSize: 14, fontWeight: "600" },
    linkBtn: {
        borderRadius: 18, padding: 18, alignItems: "center", flexDirection: 'row', justifyContent: 'center',
        marginTop: 12, marginBottom: 20, elevation: 6,
    },
    linkBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    btnDisabled: { opacity: 0.6 },
});
