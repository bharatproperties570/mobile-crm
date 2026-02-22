import React, { useState, useEffect } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
    Modal
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
    value: string; placeholder: string; options: { label: string, value: string }[]; onSelect: (v: string) => void;
}) {
    if (options.length === 0) return <Text style={{ color: '#9CA3AF', fontSize: 13, padding: 8 }}>No options available</Text>;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {options.map((opt, idx) => (
                <TouchableOpacity
                    key={`${opt.value || idx}-${idx}`}
                    style={[styles.chip, value === opt.value && styles.chipSelected]}
                    onPress={() => onSelect(opt.value === value ? "" : opt.value)}
                >
                    <Text style={[styles.chipText, value === opt.value && styles.chipTextSelected]}>{opt.label}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

interface CompanyForm {
    name: string;
    phone1: string;
    phone2: string;
    email1: string;
    email2: string;
    companyType: string;
    industry: string;
    description: string;
    gstNumber: string;

    source: string;
    subSource: string;

    hNo: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;

    employees: any[];

    team: string;
    owner: string;
    visibleTo: string;
}

const INITIAL: CompanyForm = {
    name: "", phone1: "", phone2: "", email1: "", email2: "",
    companyType: "", industry: "", description: "", gstNumber: "",
    source: "", subSource: "",
    hNo: "", street: "", city: "", state: "", pinCode: "",
    employees: [],
    team: "", owner: "", visibleTo: "Everyone",
};

export default function AddCompanyScreen() {
    const router = useRouter();
    const [form, setForm] = useState<CompanyForm>(INITIAL);
    const [saving, setSaving] = useState(false);

    // Lookups & System Data
    const [sources, setSources] = useState<{ label: string, value: string }[]>([]);
    const [subSources, setSubSources] = useState<{ label: string, value: string }[]>([]);
    const [companyTypes, setCompanyTypes] = useState<{ label: string, value: string }[]>([]);
    const [industries, setIndustries] = useState<{ label: string, value: string }[]>([]);
    const [profCategories, setProfCategories] = useState<{ label: string, value: string }[]>([]);
    const [profSubCategories, setProfSubCategories] = useState<{ label: string, value: string }[]>([]);
    const [profDesignations, setProfDesignations] = useState<{ label: string, value: string }[]>([]);

    const [teams, setTeams] = useState<{ label: string, value: string }[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Employee Search State
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedContact, setSelectedContact] = useState<any>(null);
    const [linkData, setLinkData] = useState({ category: "", subCategory: "", designation: "" });

    const set = (key: keyof CompanyForm) => (val: any) =>
        setForm((f) => ({ ...f, [key]: val }));

    useEffect(() => {
        const fetchSystemData = async () => {
            try {
                // Lookups
                const fetchLookup = async (type: string) => {
                    const res = await api.get('/lookups', { params: { lookup_type: type, limit: 1000 } });
                    return res.data?.data?.map((l: any) => ({ label: l.lookup_value, value: l._id })) || [];
                };

                const [src, subSrc, pCat, pSubCat, pDesig] = await Promise.all([
                    fetchLookup('Source'),
                    fetchLookup('SubSource'),
                    fetchLookup('ProfessionalCategory'),
                    fetchLookup('ProfessionalSubCategory'),
                    fetchLookup('ProfessionalDesignation')
                ]);

                setSources(src);
                setSubSources(subSrc);
                setProfCategories(pCat);
                setProfSubCategories(pSubCat);
                setProfDesignations(pDesig);

                // Master Fields (Company Types & Industries)
                const configRes = await api.get('/system-settings/company_master_fields');
                if (configRes.data?.data?.value) {
                    const val = configRes.data.data.value;
                    if (val.companyTypes) setCompanyTypes(val.companyTypes.map((t: any) => typeof t === 'object' ? { label: t.lookup_value || t.name, value: t._id || t.id } : { label: t, value: t }));
                    if (val.industries) setIndustries(val.industries.map((i: any) => typeof i === 'object' ? { label: i.lookup_value || i.name, value: i._id || i.id } : { label: i, value: i }));
                }

                // Teams and Users
                const teamsRes = await api.get('/teams');
                if (teamsRes.data?.data) {
                    setTeams(teamsRes.data.data.map((t: any) => ({ label: t.name, value: t._id })));
                    // Default to Sales if available
                    const sales = teamsRes.data.data.find((t: any) => t.name === 'Sales');
                    if (sales) setForm(f => ({ ...f, team: sales._id }));
                }

                const usersRes = await api.get('/users', { params: { limit: 100 } });
                if (usersRes.data?.data) {
                    setUsers(Array.isArray(usersRes.data.data) ? usersRes.data.data : []);
                }

            } catch (err) {
                console.error("Failed to load company system data:", err);
            }
        };

        fetchSystemData();
    }, []);

    // Employee Search Effect
    useEffect(() => {
        const searchContacts = async () => {
            if (employeeSearch.length < 2) {
                setSearchResults([]);
                return;
            }

            setSearching(true);
            try {
                const res = await api.get('/contacts/search/duplicates', {
                    params: { name: employeeSearch, phone: employeeSearch }
                });

                if (res.data?.success) {
                    const results = res.data.data.filter((c: any) =>
                        !form.employees.some(emp => (emp._id || emp.id) === (c._id || c.id))
                    );
                    setSearchResults(results);
                }
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setSearching(false);
            }
        };

        const timer = setTimeout(searchContacts, 300);
        return () => clearTimeout(timer);
    }, [employeeSearch, form.employees]);

    const handleLinkEmployee = () => {
        if (!selectedContact || !linkData.designation || !linkData.subCategory) {
            Alert.alert("Required", "Please select Designation and Sub-Category");
            return;
        }

        const newEmployee = {
            ...selectedContact,
            category: linkData.category,
            designation: linkData.designation,
            professionSubCategory: linkData.subCategory,
            isNew: true
        };

        setForm(prev => ({
            ...prev,
            employees: [newEmployee, ...prev.employees]
        }));

        setSelectedContact(null);
        setLinkData({ designation: "", category: "", subCategory: "" });
        setEmployeeSearch("");
        setSearchResults([]);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            Alert.alert("Required", "Please enter the company name.");
            return;
        }

        setSaving(true);
        try {
            const getValidHexId = (val: string) => val?.length === 24 && /^[0-9a-fA-F]{24}$/.test(val) ? val : undefined;

            // Mapping Flat Form to deeply nested Backend schema
            const payload = {
                name: form.name.trim(),
                phones: [
                    ...(form.phone1 ? [{ phoneCode: "+91", phoneNumber: form.phone1, type: "Work" }] : []),
                    ...(form.phone2 ? [{ phoneCode: "+91", phoneNumber: form.phone2, type: "Work" }] : []),
                ],
                emails: [
                    ...(form.email1 ? [{ address: form.email1, type: "Work" }] : []),
                    ...(form.email2 ? [{ address: form.email2, type: "Work" }] : []),
                ],
                description: form.description || undefined,
                companyType: getValidHexId(form.companyType),
                industry: getValidHexId(form.industry),
                gstNumber: form.gstNumber || undefined,

                source: getValidHexId(form.source),
                subSource: getValidHexId(form.subSource),

                addresses: {
                    registeredOffice: {
                        hNo: form.hNo || undefined,
                        street: form.street || undefined,
                        city: getValidHexId(form.city),
                        state: getValidHexId(form.state),
                        pinCode: form.pinCode || undefined,
                    }
                },

                employees: form.employees.map(emp => emp._id || emp.id).filter(Boolean),

                team: form.team || undefined,
                owner: form.owner || undefined,
                visibleTo: form.visibleTo || "Everyone"
            };

            await api.post("/companies", payload);
            if (Platform.OS === 'web') {
                window.alert("✅ Company created successfully!");
                router.back();
            } else {
                Alert.alert("✅ Success", "Company created successfully!", [
                    { text: "OK", onPress: () => router.back() },
                ]);
            }
        } catch (err: any) {
            console.error("Save error:", err);
            const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to save company.";
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
                    <Text style={styles.headerTitle}>Create Company</Text>
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
                    <SectionHeader title="Basic Information" icon="🏢" />
                    <View style={styles.card}>
                        <Field label="Company Name" required>
                            <Input value={form.name} onChangeText={set("name")} placeholder="Tech Innovators Inc." />
                        </Field>

                        <Field label="Primary Mobile" required>
                            <Input value={form.phone1} onChangeText={set("phone1")} placeholder="+91 98765 43210" keyboardType="phone-pad" />
                        </Field>

                        <Field label="Alternate Mobile">
                            <Input value={form.phone2} onChangeText={set("phone2")} placeholder="Optional" keyboardType="phone-pad" />
                        </Field>

                        <Field label="Primary Email">
                            <Input value={form.email1} onChangeText={set("email1")} placeholder="contact@company.com" keyboardType="email-address" />
                        </Field>

                        <Field label="Alternate Email">
                            <Input value={form.email2} onChangeText={set("email2")} placeholder="Optional" keyboardType="email-address" />
                        </Field>

                        <Field label="GST Number">
                            <Input value={form.gstNumber} onChangeText={set("gstNumber")} placeholder="Optional GSTIN" />
                        </Field>

                        <Field label="Company Profile (Description)">
                            <Input value={form.description} onChangeText={set("description")} placeholder="Notes about this company..." multiline numberOfLines={3} />
                        </Field>

                        <Field label="Company Type">
                            <SelectButton
                                value={form.companyType}
                                placeholder="Select type"
                                options={companyTypes}
                                onSelect={set("companyType")}
                            />
                        </Field>

                        <Field label="Industry">
                            <SelectButton
                                value={form.industry}
                                placeholder="Select industry"
                                options={industries}
                                onSelect={set("industry")}
                            />
                        </Field>
                    </View>

                    {/* ── Source ── */}
                    <SectionHeader title="Source Details" icon="📣" />
                    <View style={styles.card}>
                        <Field label="Lead Source">
                            <SelectButton
                                value={form.source}
                                placeholder="Select source"
                                options={sources}
                                onSelect={set("source")}
                            />
                        </Field>
                        {form.source ? (
                            <Field label="Sub Source">
                                <SelectButton
                                    value={form.subSource}
                                    placeholder="Select sub-source"
                                    options={subSources.filter((s: any) => s.parent === form.source || true)} // If parent linkage isn't perfect, show all
                                    onSelect={set("subSource")}
                                />
                            </Field>
                        ) : null}
                    </View>

                    {/* ── Employees (Signatories) ── */}
                    <SectionHeader title="Authorized Signatories" icon="👥" />
                    <View style={styles.card}>
                        <Field label="Search Contacts">
                            <Input
                                value={employeeSearch}
                                onChangeText={setEmployeeSearch}
                                placeholder="Type name or phone to find contacts..."
                            />
                            {searching && <ActivityIndicator style={{ marginTop: 8 }} size="small" color="#1E40AF" />}
                        </Field>

                        {/* Search Results */}
                        {employeeSearch.length >= 2 && searchResults.length > 0 && !selectedContact && (
                            <View style={styles.searchResultsContainer}>
                                {searchResults.slice(0, 5).map(c => (
                                    <TouchableOpacity
                                        key={c._id}
                                        style={styles.searchResultItem}
                                        onPress={() => setSelectedContact(c)}
                                    >
                                        <Text style={styles.searchResultName}>{c.name}</Text>
                                        <Text style={styles.searchResultPhone}>{c.mobile || c.phones?.[0]?.phoneNumber}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {employeeSearch.length >= 2 && searchResults.length === 0 && !searching && !selectedContact && (
                            <Text style={styles.hintText}>No contacts found.</Text>
                        )}

                        {/* Selected Contact Configuration */}
                        {selectedContact && (
                            <View style={styles.selectedContactCard}>
                                <View style={styles.row}>
                                    <Text style={styles.selectedContactTitle}>Link: {selectedContact.name}</Text>
                                    <TouchableOpacity onPress={() => setSelectedContact(null)}>
                                        <Text style={styles.cancelLinkText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>

                                <Field label="Category" required>
                                    <SelectButton value={linkData.category} placeholder="Select" options={profCategories} onSelect={(val) => setLinkData(p => ({ ...p, category: val }))} />
                                </Field>
                                <Field label="Sub Category" required>
                                    <SelectButton value={linkData.subCategory} placeholder="Select" options={profSubCategories} onSelect={(val) => setLinkData(p => ({ ...p, subCategory: val }))} />
                                </Field>
                                <Field label="Designation" required>
                                    <SelectButton value={linkData.designation} placeholder="Select" options={profDesignations} onSelect={(val) => setLinkData(p => ({ ...p, designation: val }))} />
                                </Field>

                                <TouchableOpacity
                                    style={[styles.linkBtn, (!linkData.category || !linkData.subCategory || !linkData.designation) && styles.saveBtnDisabled]}
                                    onPress={handleLinkEmployee}
                                >
                                    <Text style={styles.linkBtnText}>+ Link Employee</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Employee List */}
                        {form.employees.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                <Text style={styles.fieldLabel}>Linked Employees ({form.employees.length})</Text>
                                {form.employees.map((emp, i) => (
                                    <View key={i} style={styles.linkedEmployeeCard}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.linkedEmployeeName}>{emp.name}</Text>
                                            <Text style={styles.linkedEmployeeSubtitle}>{emp.mobile || emp.phones?.[0]?.phoneNumber}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setForm(f => ({ ...f, employees: f.employees.filter((_, idx) => idx !== i) }))}>
                                            <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ── Registered Office Address ── */}
                    <SectionHeader title="Registered Office" icon="📍" />
                    <View style={styles.card}>
                        <Field label="House / Flat / Office No.">
                            <Input value={form.hNo} onChangeText={set("hNo")} placeholder="Office 204, Tower B" />
                        </Field>
                        <Field label="Street / Colony / Sector">
                            <Input value={form.street} onChangeText={set("street")} placeholder="Cyber City" />
                        </Field>
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Field label="City">
                                    <Input value={form.city} onChangeText={set("city")} placeholder="Gurugram" />
                                </Field>
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Field label="State">
                                    <Input value={form.state} onChangeText={set("state")} placeholder="Haryana" />
                                </Field>
                            </View>
                        </View>
                        <Field label="Pin Code">
                            <Input value={form.pinCode} onChangeText={set("pinCode")} placeholder="122002" keyboardType="number-pad" />
                        </Field>
                    </View>

                    {/* ── System Assignment ── */}
                    <SectionHeader title="System Assignment" icon="⚙️" />
                    <View style={styles.card}>
                        <Field label="Team">
                            <SelectButton
                                value={form.team}
                                placeholder="Select team"
                                options={teams}
                                onSelect={(val) => setForm(f => ({ ...f, team: val, owner: "" }))}
                            />
                        </Field>

                        <Field label="Assign Owner To">
                            <SelectButton
                                value={form.owner}
                                placeholder="Select owner"
                                options={users.filter(u => !form.team || u.team === form.team).map(u => ({ label: u.name, value: u._id }))}
                                onSelect={set("owner")}
                            />
                        </Field>

                        <Field label="Visibility">
                            <SelectButton
                                value={form.visibleTo}
                                placeholder="Visibility"
                                options={[{ label: "Everyone", value: "Everyone" }, { label: "Team", value: "Team" }, { label: "Private", value: "Private" }]}
                                onSelect={set("visibleTo")}
                            />
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
                            : <Text style={styles.bottomSaveBtnText}>✓ Create Company</Text>}
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
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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

    // Search Results UI
    searchResultsContainer: {
        backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10,
        marginTop: 4, padding: 4,
    },
    searchResultItem: {
        padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
    },
    searchResultName: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
    searchResultPhone: { fontSize: 12, color: "#64748B", marginTop: 2 },
    hintText: { fontSize: 13, color: "#9CA3AF", marginTop: 8, fontStyle: "italic" },

    // Link Employee UI
    selectedContactCard: {
        backgroundColor: "#F0FDF4", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#10B981", marginTop: 12,
    },
    selectedContactTitle: { fontSize: 15, fontWeight: "700", color: "#065F46", marginBottom: 12 },
    cancelLinkText: { color: "#EF4444", fontWeight: "600", fontSize: 13 },
    linkBtn: {
        backgroundColor: "#10B981", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 8
    },
    linkBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
    linkedEmployeeCard: {
        flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#F8FAFC",
        borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, marginBottom: 8
    },
    linkedEmployeeName: { fontSize: 14, fontWeight: "bold", color: "#1E293B" },
    linkedEmployeeSubtitle: { fontSize: 12, color: "#64748B" }
});
