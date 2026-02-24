import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
    Platform, Animated, Pressable
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

function Input({
    value, onChangeText, placeholder, keyboardType, multiline, numberOfLines, editable = true, label, icon
}: {
    value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean; numberOfLines?: number; editable?: boolean; label?: string; icon?: string;
}) {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(labelAnim, {
            toValue: (isFocused || value) ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [isFocused, value]);

    const labelStyle = {
        position: 'absolute' as const,
        left: 16,
        top: labelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [18, -10],
        }),
        fontSize: labelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [15, 12],
        }),
        color: labelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.textMuted, theme.primary],
        }),
        backgroundColor: theme.cardBg,
        paddingHorizontal: 4,
        zIndex: 1,
    };

    return (
        <View style={[
            styles.inputWrapper,
            { backgroundColor: theme.inputBg, borderColor: theme.border },
            isFocused && { borderColor: theme.primary, backgroundColor: theme.cardBg },
            !editable && { opacity: 0.6, backgroundColor: theme.border },
            multiline && { height: 'auto', minHeight: 100 }
        ]}>
            {label && <Animated.Text style={labelStyle}>{label}</Animated.Text>}
            <View style={styles.inputInner}>
                {icon && <Ionicons name={icon as any} size={18} color={isFocused ? theme.primary : theme.textMuted} style={styles.inputIcon} />}
                <TextInput
                    style={[
                        styles.input,
                        { color: theme.textPrimary },
                        multiline && { height: 100, textAlignVertical: 'top', paddingTop: 16 }
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={isFocused ? "" : placeholder}
                    placeholderTextColor={theme.textMuted}
                    keyboardType={keyboardType}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                    editable={editable}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
            </View>
        </View>
    );
}

function PressableChip({
    label, isSelected, onSelect, icon
}: {
    label: string, isSelected: boolean, onSelect: () => void, icon?: string
}) {
    const { theme } = useTheme();
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    return (
        <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={onSelect}
        >
            <Animated.View style={[
                styles.selectableChip,
                { borderColor: theme.border, backgroundColor: theme.cardBg },
                isSelected && { backgroundColor: theme.primary + '08', borderColor: theme.primary },
                { transform: [{ scale }] }
            ]}>
                {icon && <Ionicons name={icon as any} size={16} color={isSelected ? theme.primary : theme.textSecondary} style={{ marginRight: 6 }} />}
                <Text style={[styles.selectableChipText, { color: theme.textSecondary }, isSelected && { color: theme.primary }]}>{label}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={{ marginLeft: 6 }} />}
            </Animated.View>
        </Pressable>
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
                <PressableChip
                    key={`${opt.value || idx}-${idx}`}
                    label={opt.label}
                    isSelected={value === opt.value}
                    onSelect={() => onSelect(opt.value === value ? "" : opt.value)}
                />
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
    const { theme } = useTheme();
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

                const configRes = await api.get('/system-settings/company_master_fields');
                if (configRes.data?.data?.value) {
                    const val = configRes.data.data.value;
                    if (val.companyTypes) setCompanyTypes(val.companyTypes.map((t: any) => ({ label: t.lookup_value || t.name || t, value: t._id || t.id || t })));
                    if (val.industries) setIndustries(val.industries.map((i: any) => ({ label: i.lookup_value || i.name || i, value: i._id || i.id || i })));
                }

                const teamsRes = await api.get('/teams');
                if (teamsRes.data?.data) {
                    setTeams(teamsRes.data.data.map((t: any) => ({ label: t.name, value: t._id })));
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
        setForm(prev => ({ ...prev, employees: [newEmployee, ...prev.employees] }));
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
            const getValidHexId = (val: string) => val?.length === 24 ? val : undefined;
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
            Alert.alert("✅ Success", "Company created successfully!", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to save company.";
            Alert.alert("Error", msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                        <Ionicons name="close" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Create Company</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Corporate Entity</Text>
                    </View>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <SectionHeader title="Basic Information" icon="🏢" subtitle="Primary organizational details" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field required>
                            <Input label="Company Name" value={form.name} onChangeText={set("name")} placeholder="Tech Innovators Inc." />
                        </Field>
                        <Field required>
                            <Input label="Primary Mobile" value={form.phone1} onChangeText={set("phone1")} placeholder="+91 98765 43210" keyboardType="phone-pad" icon="call-outline" />
                        </Field>
                        <Field>
                            <Input label="Alternate Mobile" value={form.phone2} onChangeText={set("phone2")} placeholder="Optional" keyboardType="phone-pad" icon="call-outline" />
                        </Field>
                        <Field>
                            <Input label="Primary Email" value={form.email1} onChangeText={set("email1")} placeholder="contact@company.com" keyboardType="email-address" icon="mail-outline" />
                        </Field>
                        <Field>
                            <Input label="Alternate Email" value={form.email2} onChangeText={set("email2")} placeholder="Optional" keyboardType="email-address" icon="mail-outline" />
                        </Field>
                        <Field>
                            <Input label="GST Number" value={form.gstNumber} onChangeText={set("gstNumber")} placeholder="Optional GSTIN" icon="document-text-outline" />
                        </Field>
                        <Field>
                            <Input label="Company Profile" value={form.description} onChangeText={set("description")} placeholder="Notes about this company..." multiline numberOfLines={3} />
                        </Field>
                        <Field label="Company Type">
                            <SelectButton value={form.companyType} options={companyTypes} onSelect={set("companyType")} />
                        </Field>
                        <Field label="Industry">
                            <SelectButton value={form.industry} options={industries} onSelect={set("industry")} />
                        </Field>
                    </View>

                    <SectionHeader title="Source Details" icon="📣" subtitle="Lead acquisition tracking" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Lead Source">
                            <SelectButton value={form.source} options={sources} onSelect={set("source")} />
                        </Field>
                        {form.source ? (
                            <Field label="Sub Source">
                                <SelectButton value={form.subSource} options={subSources.filter((s: any) => !form.source || s.parent === form.source)} onSelect={set("subSource")} />
                            </Field>
                        ) : null}
                    </View>

                    <SectionHeader title="Authorized Signatories" icon="👥" subtitle="Link contacts for legal signing" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field>
                            <Input label="Search Contacts" value={employeeSearch} onChangeText={setEmployeeSearch} placeholder="Type name or phone..." icon="search-outline" />
                            {searching && <ActivityIndicator style={{ marginTop: 12 }} size="small" color={theme.primary} />}
                        </Field>
                        {employeeSearch.length >= 2 && searchResults.length > 0 && !selectedContact && (
                            <View style={[styles.searchResultsContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                {searchResults.slice(0, 5).map(c => (
                                    <TouchableOpacity key={c._id} style={[styles.searchResultItem, { borderBottomColor: theme.border }]} onPress={() => setSelectedContact(c)}>
                                        <Text style={[styles.searchResultName, { color: theme.textPrimary }]}>{c.name}</Text>
                                        <Text style={[styles.searchResultPhone, { color: theme.textSecondary }]}>{c.mobile || c.phones?.[0]?.phoneNumber}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        {employeeSearch.length >= 2 && searchResults.length === 0 && !searching && !selectedContact && (
                            <Text style={[styles.hintText, { color: theme.textMuted }]}>No contacts found matching "{employeeSearch}"</Text>
                        )}
                        {selectedContact && (
                            <View style={[styles.selectedContactCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
                                    <View style={{ flex: 1 }}><Text style={[styles.selectedContactTitle, { color: theme.textPrimary }]}>Configure Link: {selectedContact.name}</Text></View>
                                    <TouchableOpacity onPress={() => setSelectedContact(null)}><Text style={[styles.cancelLinkText, { color: theme.error }]}>Cancel</Text></TouchableOpacity>
                                </View>
                                <Field label="Category" required><SelectButton value={linkData.category} options={profCategories} onSelect={(val) => setLinkData(p => ({ ...p, category: val }))} /></Field>
                                <Field label="Sub Category" required><SelectButton value={linkData.subCategory} options={profSubCategories} onSelect={(val) => setLinkData(p => ({ ...p, subCategory: val }))} /></Field>
                                <Field label="Designation" required><SelectButton value={linkData.designation} options={profDesignations} onSelect={(val) => setLinkData(p => ({ ...p, designation: val }))} /></Field>
                                <TouchableOpacity style={[styles.linkBtn, { backgroundColor: theme.primary }, (!linkData.category || !linkData.subCategory || !linkData.designation) && styles.saveBtnDisabled]} onPress={handleLinkEmployee}>
                                    <Text style={styles.linkBtnText}>+ Link Employee</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {form.employees.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Linked Employees ({form.employees.length})</Text>
                                {form.employees.map((emp, i) => (
                                    <View key={i} style={[styles.linkedEmployeeCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.linkedEmployeeName, { color: theme.textPrimary }]}>{emp.name}</Text>
                                            <Text style={[styles.linkedEmployeeSubtitle, { color: theme.textSecondary }]}>{emp.mobile || emp.phones?.[0]?.phoneNumber}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setForm(f => ({ ...f, employees: f.employees.filter((_, idx) => idx !== i) }))}>
                                            <Text style={{ color: theme.error, fontWeight: 'bold' }}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    <SectionHeader title="Registered Office" icon="📍" subtitle="Official communication address" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field><Input label="House / Flat / Office No" value={form.hNo} onChangeText={set("hNo")} placeholder="Office 204, Tower B" /></Field>
                        <Field><Input label="Street / Colony / Sector" value={form.street} onChangeText={set("street")} placeholder="Cyber City" /></Field>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><Field><Input label="City" value={form.city} onChangeText={set("city")} placeholder="Gurugram" /></Field></View>
                            <View style={{ flex: 1 }}><Field><Input label="State" value={form.state} onChangeText={set("state")} placeholder="Haryana" /></Field></View>
                        </View>
                        <Field><Input label="Pin Code" value={form.pinCode} onChangeText={set("pinCode")} placeholder="122002" keyboardType="number-pad" /></Field>
                    </View>

                    <SectionHeader title="System Assignment" icon="⚙️" subtitle="Internal routing & ownership" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Assigned Team"><SelectButton value={form.team} options={teams} onSelect={(val) => setForm(f => ({ ...f, team: val, owner: "" }))} /></Field>
                        <Field label="Owner">
                            <SelectButton value={form.owner} options={users.filter(u => !form.team || u.team === form.team).map(u => ({ label: u.name, value: u._id }))} onSelect={set("owner")} />
                        </Field>
                        <Field label="Data Visibility">
                            <SelectButton value={form.visibleTo} options={[{ label: "Everyone", value: "Everyone" }, { label: "Team", value: "Team" }, { label: "Private", value: "Private" }]} onSelect={set("visibleTo")} />
                        </Field>
                    </View>

                    <TouchableOpacity style={[styles.bottomSaveBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Ionicons name="business-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.bottomSaveBtnText}>Create Company Profile</Text>
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 60 : 20, zIndex: 1000 },
    backBtn: { padding: 4, zIndex: 10 },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
    scroll: { padding: SPACING.outer, paddingBottom: 60 },
    content: { flex: 1 },
    sectionHeader: { marginTop: 8, marginBottom: 20 },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    sectionIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    sectionIconText: { fontSize: 20 },
    sectionTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
    sectionSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
    sectionSeparator: { height: 1, marginTop: 16, opacity: 0.5 },
    card: { borderRadius: 24, padding: SPACING.card, marginBottom: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
    row: { flexDirection: "row", alignItems: "center", gap: 16 },
    field: { marginBottom: SPACING.field },
    fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginLeft: 4 },
    helperText: { fontSize: 12, marginTop: 6, marginLeft: 4 },
    inputWrapper: { position: 'relative', height: SPACING.inputHeight, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' },
    inputInner: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 16 },
    inputIcon: { marginRight: 12 },
    input: { fontSize: 16, height: '100%', fontWeight: '600', flex: 1 },
    chipRow: { flexDirection: "row", marginTop: 4 },
    chipRowContent: { paddingRight: 20 },
    selectableChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, marginRight: 10, flexDirection: 'row', alignItems: 'center' },
    selectableChipText: { fontSize: 14, fontWeight: "600" },
    bottomSaveBtn: { borderRadius: 18, padding: 18, alignItems: "center", flexDirection: 'row', justifyContent: 'center', marginTop: 12, marginBottom: 20, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
    bottomSaveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    saveBtnDisabled: { opacity: 0.6 },
    searchResultsContainer: { borderWidth: 1.5, borderRadius: 16, marginTop: 8, overflow: 'hidden' },
    searchResultItem: { padding: 16, borderBottomWidth: 1 },
    searchResultName: { fontSize: 15, fontWeight: "700" },
    searchResultPhone: { fontSize: 13, marginTop: 2 },
    hintText: { fontSize: 13, marginTop: 10, fontStyle: "italic", marginLeft: 4 },
    selectedContactCard: { marginTop: 16, padding: 16, borderRadius: 20, borderWidth: 1.5 },
    selectedContactTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
    cancelLinkText: { fontSize: 13, fontWeight: "700" },
    linkBtn: { borderRadius: 14, padding: 14, alignItems: "center", marginTop: 8 },
    linkBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    linkedEmployeeCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, borderWidth: 1, marginTop: 10 },
    linkedEmployeeName: { fontSize: 15, fontWeight: "700" },
    linkedEmployeeSubtitle: { fontSize: 12, marginTop: 2 },
});
