import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
    Animated, Pressable, Modal, FlatList
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/services/api";
import { useTheme, SPACING } from "@/context/ThemeContext";
import { MultiSearchableDropdown } from "@/components/MultiSearchableDropdown";
import { getTeams } from "@/services/teams.service";

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

import { useLookup } from "@/context/LookupContext";

// ─── Main Form ────────────────────────────────────────────────────────────────

interface ContactForm {
    salutation: string;
    firstName: string;
    lastName: string;
    fatherName: string;
    phones: { number: string; type: string }[];
    emails: { address: string; type: string }[];
    description: string;
    category: string;
    subCategory: string;
    designation: string;
    company: string;
    source: string;
    subSource: string;
    tags: string[];
    // System
    team: string;
    teams: string[];
    owner: string;
    visibleTo: string;
    // Addresses
    personalAddress: { hNo: string; street: string; city: string; state: string; pinCode: string; country: string };
    correspondenceAddress: { hNo: string; street: string; city: string; state: string; pinCode: string; country: string };
    // Personal
    gender: string;
    maritalStatus: string;
    birthDate: string;
    anniversaryDate: string;
}

const INITIAL: ContactForm = {
    salutation: "Mr.", firstName: "", lastName: "", fatherName: "",
    phones: [{ number: "", type: "Mobile" }],
    emails: [{ address: "", type: "Personal" }],
    description: "",
    category: "", subCategory: "", designation: "", company: "",
    source: "", subSource: "", tags: [],
    team: "", teams: [], owner: "", visibleTo: "Everyone",
    personalAddress: { hNo: "", street: "", city: "", state: "", pinCode: "", country: "India" },
    correspondenceAddress: { hNo: "", street: "", city: "", state: "", pinCode: "", country: "India" },
    gender: "", maritalStatus: "", birthDate: "", anniversaryDate: "",
};

function ModernPicker({
    label, value, options, onSelect, placeholder = "Select..."
}: {
    label: string; value: string; options: { label: string, value: string }[]; onSelect: (v: string) => void; placeholder?: string;
}) {
    const { theme } = useTheme();
    const [visible, setVisible] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <>
            <TouchableOpacity
                style={[styles.pickerTrigger, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                onPress={() => setVisible(true)}
            >
                <Text style={[styles.fieldLabel, { marginBottom: 0, color: theme.textMuted, fontSize: 12 }]}>{label}</Text>
                <View style={styles.pickerValueRow}>
                    <Text style={[styles.pickerValue, { color: value ? theme.textPrimary : theme.textMuted }]}>{selectedLabel}</Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
                </View>
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{label}</Text>
                            <TouchableOpacity onPress={() => setVisible(false)}><Ionicons name="close" size={24} color={theme.textPrimary} /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={options}
                            keyExtractor={item => item.value}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.optionItem, { borderBottomColor: theme.border + '50' }]}
                                    onPress={() => { onSelect(item.value); setVisible(false); }}
                                >
                                    <Text style={[styles.optionLabel, { color: theme.textPrimary }, value === item.value && { color: theme.primary, fontWeight: '700' }]}>{item.label}</Text>
                                    {value === item.value && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </>
    );
}

export default function AddContactScreen() {
    const { id, companyId } = useLocalSearchParams<{ id?: string, companyId?: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { getLookupsByType, loading: loadingLookups } = useLookup();
    
    const [saving, setSaving] = useState(false);
    const [loadingContact, setLoadingContact] = useState(false);
    const [form, setForm] = useState<ContactForm>(INITIAL);
    const [teams, setTeams] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            const fetchContact = async () => {
                setLoadingContact(true);
                try {
                    const [res, teamsRes, usersRes] = await Promise.all([
                        api.get(`/contacts/${id}`),
                        getTeams(),
                        api.get("/users?limit=1000")
                    ]);
                    
                    const c = res.data?.data || res.data;
                    setTeams(teamsRes.data || []);
                    setUsers(usersRes.data?.data || []);

                    if (c) {
                        setForm({
                            ...INITIAL,
                            salutation: typeof c.title === 'object' ? c.title?.lookup_value : c.title || "Mr.",
                            firstName: c.firstName || c.name?.split(' ')[0] || "",
                            lastName: c.lastName || c.name?.split(' ').slice(1).join(' ') || "",
                            fatherName: c.fatherName || "",
                            phones: Array.isArray(c.phones) && c.phones.length > 0 ? c.phones : [{ number: "", type: "Mobile" }],
                            emails: Array.isArray(c.emails) && c.emails.length > 0 ? c.emails : [{ address: "", type: "Personal" }],
                            description: c.description || "",
                            category: typeof c.category === 'object' ? c.category?._id : c.category || "",
                            subCategory: typeof c.subCategory === 'object' ? c.subCategory?._id : c.subCategory || "",
                            designation: typeof c.designation === 'object' ? c.designation?._id : c.designation || "",
                            company: typeof c.company === 'object' ? (c.company?._id || c.company?.id) : c.company || "",
                            source: typeof c.source === 'object' ? c.source?._id : c.source || "",
                            subSource: typeof c.subSource === 'object' ? c.subSource?._id : c.subSource || "",
                            tags: Array.isArray(c.tags) ? c.tags : [],
                            team: typeof c.team === 'object' ? c.team?._id : c.team || "",
                            teams: Array.isArray(c.teams) ? c.teams.map((t: any) => t._id || t) : (c.team ? [c.team._id || c.team] : []),
                            owner: typeof c.owner === 'object' ? c.owner?._id : c.owner || "",
                            visibleTo: c.visibleTo || "Everyone",
                            personalAddress: c.addresses?.personal || INITIAL.personalAddress,
                            correspondenceAddress: c.addresses?.correspondence || INITIAL.correspondenceAddress,
                            gender: c.gender || "",
                            maritalStatus: c.maritalStatus || "",
                            birthDate: c.birthDate || "",
                            anniversaryDate: c.anniversaryDate || "",
                        });
                    }
                } catch (e) {
                    console.error("[ContactUI] Fetch contact failed", e);
                    Alert.alert("Error", "Failed to load contact details");
                } finally {
                    setLoadingContact(false);
                }
            };
            fetchContact();
        }
    }, [id]);

    useEffect(() => {
        if (!id) {
            const loadLookups = async () => {
                const [teamsRes, usersRes] = await Promise.all([
                    getTeams(),
                    api.get("/users?limit=1000")
                ]);
                setTeams(teamsRes.data || []);
                setUsers(usersRes.data?.data || []);
            };
            loadLookups();
        }
    }, [id]);

    const resolveId = (type: string, value: string) => {
        if (!value) return null;
        const list = getLookupsByType(type);
        const match = list.find(l =>
            l.lookup_value?.toLowerCase() === value.toLowerCase()
        );
        return match ? match._id : value;
    };

    const set = (key: keyof ContactForm) => (val: string) => {
        setForm((f) => ({ ...f, [key]: val }));
    };

    const handleSave = async () => {
        if (!form.firstName.trim() || form.phones.length === 0 || !form.phones[0].number) {
            Alert.alert("Required", "Please enter the first name and primary mobile number.");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: resolveId('Title', form.salutation),
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                name: `${form.firstName} ${form.lastName}`.trim(),
                fatherName: form.fatherName.trim(),
                phones: form.phones.filter(p => p.number),
                emails: form.emails.filter(e => e.address),
                description: form.description || undefined,
                category: form.category || undefined,
                subCategory: form.subCategory || undefined,
                designation: form.designation || undefined,
                company: form.company || companyId || undefined,
                source: form.source || undefined,
                subSource: form.subSource || undefined,
                tags: form.tags.length > 0 ? form.tags : undefined,
                team: form.teams[0] || form.team || undefined,
                teams: form.teams.length > 0 ? form.teams : (form.team ? [form.team] : []),
                owner: form.owner || undefined,
                visibleTo: form.visibleTo || "Everyone",
                addresses: {
                    personal: form.personalAddress,
                    correspondence: form.correspondenceAddress
                },
                gender: form.gender || undefined,
                maritalStatus: form.maritalStatus || undefined,
                birthDate: form.birthDate || undefined,
                anniversaryDate: form.anniversaryDate || undefined,
            };

            const res = id ? await api.put(`/contacts/${id}`, payload) : await api.post("/contacts", payload);

            if (res.data?.success || res.status === 201 || res.status === 200) {
                // Link to deal if dealId is provided
                if (dealId && !id) {
                    const contactId = res.data?.data?._id;
                    if (contactId) {
                        try {
                            await api.put(`/deals/${dealId}`, {
                                associatedContact: contactId,
                                isAssociateSelected: true
                            });
                        } catch (linkErr) {
                            console.error("[ContactUI] Linking to deal failed", linkErr);
                        }
                    }
                }

                Alert.alert("✅ Success", "Contact saved successfully!", [
                    { text: "OK", onPress: () => router.canGoBack() ? router.back() : router.replace("/(tabs)/contacts") },
                ]);
            } else {
                throw new Error("Failed to save contact.");
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.response?.data?.message || "Failed to save contact.";
            Alert.alert("Error", msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <TouchableOpacity
                        onPress={() => {
                            const isDirty = JSON.stringify(form) !== JSON.stringify(INITIAL);
                            if (isDirty) {
                                Alert.alert("Discard Changes?", "You have unsaved changes. Are you sure you want to go back?", [
                                    { text: "Keep Editing", style: "cancel" },
                                    { text: "Discard", style: "destructive", onPress: () => router.canGoBack() ? router.back() : router.replace("/(tabs)/contacts") }
                                ]);
                            } else {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace("/(tabs)/contacts");
                                }
                            }
                        }}
                        style={styles.backBtn}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <Ionicons name="close" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{id ? "Edit Contact" : "Create Contact"}</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Individual Person</Text>
                    </View>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <SectionHeader title="Basic Details" icon="👤" subtitle="Primary identity information" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <View style={styles.row}>
                            <View style={{ width: 100 }}>
                                <Field label="Title" required>
                                    <SelectButton 
                                        value={form.salutation} 
                                        options={getLookupsByType('Title').map(l => ({ label: l.lookup_value, value: l.lookup_value }))} 
                                        onSelect={set("salutation")} 
                                    />
                                </Field>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Field label="First Name" required>
                                    <Input value={form.firstName} onChangeText={set("firstName")} placeholder="John" />
                                </Field>
                            </View>
                        </View>
                        <Input label="Last Name" value={form.lastName} onChangeText={set("lastName")} placeholder="Doe" />
                        <Input label="Father's Name" value={form.fatherName} onChangeText={set("fatherName")} placeholder="Father's Name" />
                        
                        <Field label="Phone Numbers" required>
                            {form.phones.map((p, idx) => (
                                <View key={idx} style={{ marginBottom: 12 }}>
                                    <Input 
                                        value={p.number} 
                                        onChangeText={(v) => {
                                            const newPhones = [...form.phones];
                                            newPhones[idx].number = v;
                                            setForm(f => ({ ...f, phones: newPhones }));
                                        }} 
                                        placeholder={`Phone ${idx + 1}`} 
                                        keyboardType="phone-pad" 
                                        icon="call-outline" 
                                    />
                                </View>
                            ))}
                            <TouchableOpacity onPress={() => setForm(f => ({ ...f, phones: [...f.phones, { number: "", type: "Mobile" }] }))}>
                                <Text style={{ color: theme.primary, fontWeight: '700', marginLeft: 4 }}>+ Add Another Phone</Text>
                            </TouchableOpacity>
                        </Field>

                        <Field label="Email Addresses">
                            {form.emails.map((e, idx) => (
                                <View key={idx} style={{ marginBottom: 12 }}>
                                    <Input 
                                        value={e.address} 
                                        onChangeText={(v) => {
                                            const newEmails = [...form.emails];
                                            newEmails[idx].address = v;
                                            setForm(f => ({ ...f, emails: newEmails }));
                                        }} 
                                        placeholder={`Email ${idx + 1}`} 
                                        keyboardType="email-address" 
                                        icon="mail-outline" 
                                    />
                                </View>
                            ))}
                            <TouchableOpacity onPress={() => setForm(f => ({ ...f, emails: [...f.emails, { address: "", type: "Personal" }] }))}>
                                <Text style={{ color: theme.primary, fontWeight: '700', marginLeft: 4 }}>+ Add Another Email</Text>
                            </TouchableOpacity>
                        </Field>

                        <Field>
                            <Input label="Notes" value={form.description} onChangeText={set("description")} placeholder="Personal profile notes..." multiline numberOfLines={3} />
                        </Field>
                    </View>

                    <SectionHeader title="Professional Info" icon="💼" subtitle="Work and industry details" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Category">
                            <SelectButton value={form.category} options={getLookupsByType('ProfessionalCategory').map(l => ({ label: l.lookup_value, value: l._id }))} onSelect={set("category")} />
                        </Field>
                        <Field label="Sub-Category">
                            <SelectButton value={form.subCategory} options={getLookupsByType('ProfessionalSubCategory').map(l => ({ label: l.lookup_value, value: l._id }))} onSelect={set("subCategory")} />
                        </Field>
                        <Field label="Designation">
                            <SelectButton value={form.designation} options={getLookupsByType('ProfessionalDesignation').map(l => ({ label: l.lookup_value, value: l._id }))} onSelect={set("designation")} />
                        </Field>
                        <Input label="Company" value={form.company} onChangeText={set("company")} placeholder="e.g. Google" icon="business-outline" />
                    </View>

                    <SectionHeader title="Address Details" icon="📍" subtitle="Residential & Correspondence" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Text style={[styles.subSectionTitle, { color: theme.textPrimary }]}>Personal Address</Text>
                        <Input label="House No" value={form.personalAddress.hNo} onChangeText={v => setForm(f => ({ ...f, personalAddress: { ...f.personalAddress, hNo: v } }))} />
                        <Input label="Street" value={form.personalAddress.street} onChangeText={v => setForm(f => ({ ...f, personalAddress: { ...f.personalAddress, street: v } }))} />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><Input label="City" value={form.personalAddress.city} onChangeText={v => setForm(f => ({ ...f, personalAddress: { ...f.personalAddress, city: v } }))} /></View>
                            <View style={{ flex: 1 }}><Input label="Pin" value={form.personalAddress.pinCode} onChangeText={v => setForm(f => ({ ...f, personalAddress: { ...f.personalAddress, pinCode: v } }))} /></View>
                        </View>

                        <View style={{ height: 24 }} />
                        <Text style={[styles.subSectionTitle, { color: theme.textPrimary }]}>Correspondence Address</Text>
                        <Input label="House No" value={form.correspondenceAddress.hNo} onChangeText={v => setForm(f => ({ ...f, correspondenceAddress: { ...f.correspondenceAddress, hNo: v } }))} />
                        <Input label="Street" value={form.correspondenceAddress.street} onChangeText={v => setForm(f => ({ ...f, correspondenceAddress: { ...f.correspondenceAddress, street: v } }))} />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><Input label="City" value={form.correspondenceAddress.city} onChangeText={v => setForm(f => ({ ...f, correspondenceAddress: { ...f.correspondenceAddress, city: v } }))} /></View>
                            <View style={{ flex: 1 }}><Input label="Pin" value={form.correspondenceAddress.pinCode} onChangeText={v => setForm(f => ({ ...f, correspondenceAddress: { ...f.correspondenceAddress, pinCode: v } }))} /></View>
                        </View>
                    </View>

                    <SectionHeader title="Personal & System" icon="🛡️" subtitle="Internal system details" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Gender">
                            <SelectButton value={form.gender} options={[{ label: "Male", value: "Male" }, { label: "Female", value: "Female" }, { label: "Other", value: "Other" }]} onSelect={set("gender")} />
                        </Field>
                        <Field label="Marital Status">
                            <SelectButton value={form.maritalStatus} options={[{ label: "Single", value: "Single" }, { label: "Married", value: "Married" }]} onSelect={set("maritalStatus")} />
                        </Field>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><Input label="DOB" value={form.birthDate} onChangeText={set("birthDate")} placeholder="YYYY-MM-DD" /></View>
                            <View style={{ flex: 1 }}><Input label="Anniversary" value={form.anniversaryDate} onChangeText={set("anniversaryDate")} placeholder="YYYY-MM-DD" /></View>
                        </View>

                        <Field label="Team Assignment">
                            <TouchableOpacity
                                style={[styles.pickerTrigger, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                                onPress={() => setActiveDropdown('teams')}
                            >
                                <Text style={[styles.fieldLabel, { marginBottom: 0, color: theme.textMuted, fontSize: 12 }]}>Assigned Teams</Text>
                                <View style={styles.pickerValueRow}>
                                    <Text style={[styles.pickerValue, { color: form.teams.length ? theme.textPrimary : theme.textMuted }]} numberOfLines={1}>
                                        {form.teams.length ? `${form.teams.length} Teams Selected` : "Select Teams..."}
                                    </Text>
                                    <Ionicons name="people" size={18} color={theme.textMuted} />
                                </View>
                            </TouchableOpacity>
                        </Field>

                        <Field label="Assigned Manager">
                            <ModernPicker
                                label="Primary Owner"
                                value={form.owner}
                                options={users.filter(u => !form.teams.length || form.teams.includes(u.team?._id || u.team)).map(u => ({ label: u.fullName || u.name, value: u._id }))}
                                onSelect={set("owner")}
                            />
                        </Field>

                        <Field label="Visibility">
                            <SelectButton value={form.visibleTo} options={[{ label: "Everyone", value: "Everyone" }, { label: "Team", value: "Team" }, { label: "Owner Only", value: "Owner Only" }]} onSelect={set("visibleTo")} />
                        </Field>
                        
                        <Field label="Priority Tags">
                            <MultiSelectButton values={form.tags} options={[{ label: "High Priority", value: "High Priority" }, { label: "Medium", value: "Medium" }, { label: "Standard", value: "Standard" }]} onToggle={(v) => {
                                const newTags = form.tags.includes(v) ? form.tags.filter(t => t !== v) : [...form.tags, v];
                                setForm(f => ({ ...f, tags: newTags }));
                            }} />
                        </Field>
                    </View>

                    <TouchableOpacity
                        style={[styles.bottomSaveBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }, saving && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name={id ? "save-outline" : "person-add-outline"} size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.bottomSaveBtnText}>{id ? "Update Contact Profile" : "Create Contact Profile"}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>

                <MultiSearchableDropdown
                    visible={activeDropdown === 'teams'}
                    onClose={() => setActiveDropdown(null)}
                    options={teams.map(t => ({ label: t.name, value: t._id }))}
                    selectedValues={form.teams}
                    onToggle={(tid) => {
                        const current = form.teams || [];
                        const newList = current.includes(tid) ? current.filter((i: string) => i !== tid) : [...current, tid];
                        setForm(f => ({ ...f, teams: newList, owner: "" }));
                    }}
                    placeholder="Select Assigned Teams"
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
        zIndex: 1000,
    },
    backBtn: { padding: 4, zIndex: 10 },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
    content: { flex: 1 },
    scroll: { padding: SPACING.outer, paddingBottom: 40 },
    sectionHeader: { marginTop: 8, marginBottom: 20 },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    sectionIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    sectionIconText: { fontSize: 20 },
    sectionTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
    sectionSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
    sectionSeparator: { height: 1, marginTop: 16, opacity: 0.5 },
    card: {
        borderRadius: 24,
        padding: SPACING.card,
        marginBottom: 24,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
    },
    field: { marginBottom: SPACING.field },
    fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginLeft: 4 },
    helperText: { fontSize: 12, marginTop: 6, marginLeft: 4 },
    inputWrapper: {
        position: 'relative',
        height: SPACING.inputHeight,
        borderRadius: 16,
        borderWidth: 1.5,
        justifyContent: 'center',
    },
    inputInner: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 16 },
    inputIcon: { marginRight: 12 },
    input: {
        fontSize: 16,
        height: '100%',
        fontWeight: '600',
        flex: 1,
    },
    chipRow: { flexDirection: "row", marginTop: 4 },
    chipRowContent: { paddingRight: 20 },
    selectableChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        marginRight: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectableChipText: { fontSize: 14, fontWeight: "600" },
    bottomSaveBtn: {
        borderRadius: 18,
        padding: 18,
        alignItems: "center",
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
        marginBottom: 20,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 6,
    },
    bottomSaveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    saveBtnDisabled: { opacity: 0.6 },
    subSectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 16, marginLeft: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },

    pickerTrigger: { height: 56, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 12 },
    pickerValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
    pickerValue: { fontSize: 15, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    optionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
    optionLabel: { fontSize: 16, fontWeight: '600' },
});

function MultiSelectButton({
    values, options, onToggle,
}: {
    values: string[]; options: { label: string, value: string }[]; onToggle: (v: string) => void;
}) {
    const { theme } = useTheme();
    if (options.length === 0) return <Text style={{ color: theme.textSecondary, fontSize: 13, padding: 8 }}>No options available</Text>;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {options.map((opt, idx) => (
                <PressableChip
                    key={`${opt.value || idx}-${idx}`}
                    label={opt.label}
                    isSelected={values.includes(opt.value)}
                    onSelect={() => onToggle(opt.value)}
                />
            ))}
        </ScrollView>
    );
}
