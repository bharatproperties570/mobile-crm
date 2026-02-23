import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
    Animated, Pressable, Modal, FlatList
} from "react-native";
import { useRouter } from "expo-router";
import api from "./services/api";
import { Ionicons } from "@expo/vector-icons";

// ─── Design Tokens ──────────────────────────────────────────────────────────
const COLORS = {
    primary: "#2563EB",
    primaryLight: "#DBEAFE",
    bg: "#F8FAFC",
    cardBg: "#FFFFFF",
    border: "#E2E8F0",
    textPrimary: "#1E293B",
    textSecondary: "#64748B",
    textMuted: "#94A3B8",
    error: "#EF4444",
    errorLight: "#FEE2E2",
    inputBg: "#F1F5F9",
};

const SPACING = {
    outer: 20,
    card: 20,
    section: 24,
    field: 18,
    inputHeight: 52,
};

const FORM_STEPS = ["Basic Info", "Professional", "Personal", "Source & Address"];

// ─── Reusable Components ──────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: string }) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderTop}>
                <Text style={styles.sectionIcon}>{icon}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.headerDivider} />
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
    value, onChangeText, placeholder, keyboardType, multiline, numberOfLines, editable = true, label, leftIcon
}: {
    value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean; numberOfLines?: number; editable?: boolean; label?: string; leftIcon?: React.ReactNode;
}) {
    const [isFocused, setIsFocused] = useState(false);
    const animatedIsFocused = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(animatedIsFocused, {
            toValue: (isFocused || value) ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [isFocused, value]);

    const labelStyle = {
        position: 'absolute' as const,
        left: leftIcon ? 44 : 16,
        top: animatedIsFocused.interpolate({
            inputRange: [0, 1],
            outputRange: [14, -10],
        }),
        fontSize: animatedIsFocused.interpolate({
            inputRange: [0, 1],
            outputRange: [15, 12],
        }),
        color: animatedIsFocused.interpolate({
            inputRange: [0, 1],
            outputRange: [COLORS.textMuted, COLORS.primary],
        }),
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 4,
        zIndex: 1,
    };

    return (
        <View style={[styles.inputContainer, multiline && { height: 'auto' }, isFocused && styles.inputContainerFocused]}>
            {label && <Animated.Text style={labelStyle}>{label}</Animated.Text>}
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {leftIcon && <View style={{ marginLeft: 16, marginRight: -8 }}>{leftIcon}</View>}
                <TextInput
                    style={[
                        styles.input,
                        multiline && { height: 100, textAlignVertical: "top", paddingTop: 12 },
                        !editable && styles.inputDisabled,
                        { flex: 1 }
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={isFocused ? "" : placeholder}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType={keyboardType ?? "default"}
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

function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 7,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, [delay]);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {children}
        </Animated.View>
    );
}

function PressableChip({
    opt, isSelected, onSelect
}: {
    opt: { label: string, value: string }, isSelected: boolean, onSelect: (v: string) => void
}) {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const opacityValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacityValue, {
            toValue: isSelected ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [isSelected]);

    const onPressIn = () => {
        Animated.spring(scaleValue, {
            toValue: 0.96,
            useNativeDriver: true,
        }).start();
    };

    const onPressOut = () => {
        Animated.spring(scaleValue, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={() => onSelect(opt.value)}
        >
            <Animated.View style={[
                styles.chip,
                isSelected && styles.chipSelected,
                { transform: [{ scale: scaleValue }], flexDirection: 'row', alignItems: 'center' }
            ]}>
                <Animated.View style={{ opacity: opacityValue, width: isSelected ? 'auto' : 0, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                </Animated.View>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
            </Animated.View>
        </Pressable>
    );
}

function SelectButton({
    value, placeholder, options, onSelect,
}: {
    value: string; placeholder: string; options: { label: string, value: string }[]; onSelect: (v: string) => void;
}) {
    if (options.length === 0) return <Text style={styles.placeholderText}>{placeholder}</Text>;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {options.map((opt, idx) => (
                <PressableChip
                    key={`${opt.value || idx}-${idx}`}
                    opt={opt}
                    isSelected={value === opt.value}
                    onSelect={(v) => onSelect(v === value ? "" : v)}
                />
            ))}
        </ScrollView>
    );
}

function SearchableDropdown({
    visible, onClose, options, onSelect, placeholder
}: {
    visible: boolean; onClose: () => void; options: { label: string, value: string }[]; onSelect: (v: string) => void; placeholder: string;
}) {
    const [search, setSearch] = useState("");
    const filtered = (options || []).filter(o =>
        o?.label?.toString().toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{placeholder}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.modalSearchInput}
                        placeholder="Search..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#9ca3af"
                    />
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, idx) => `${item.value}-${idx}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.modalListItem} onPress={() => { onSelect(item.value); onClose(); }}>
                                <Text style={styles.modalListItemText}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <Ionicons name="search-outline" size={48} color={COLORS.border} />
                                <Text style={styles.modalEmptyText}>No matching results found</Text>
                                <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }}>Try adjusting your search terms</Text>
                            </View>
                        }
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            </View>
        </Modal>
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
    country: string;
    state: string;
    city: string;
    hNo: string;
    street: string;
    pinCode: string;
}

const INITIAL: ContactForm = {
    name: "", surname: "", fatherName: "", phone: "", phone2: "",
    email: "", email2: "", description: "",
    company: "", workOffice: "", designation: "",
    gender: "", maritalStatus: "", birthDate: "", anniversaryDate: "",
    source: "", campaign: "",
    country: "India", state: "", city: "",
    hNo: "", street: "", pinCode: "",
};

export default function AddContactScreen() {
    const router = useRouter();
    const [form, setForm] = useState<ContactForm>(INITIAL);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState(0);
    const shakeAnim = useRef(new Animated.Value(0)).current;

    // Master Data
    const [lookups, setLookups] = useState<any[]>([]);
    const [countries, setCountries] = useState<any[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);
    const [activeDropdown, setActiveDropdown] = useState<'country' | 'state' | 'city' | null>(null);

    useEffect(() => {
        const loadInitial = async () => {
            try {
                const [lRes, cRes] = await Promise.all([
                    api.get("/lookups", { params: { limit: 2000 } }),
                    api.get("/lookups", { params: { lookup_type: "Country", limit: 100 } })
                ]);
                setLookups(lRes.data?.data || []);
                setCountries((cRes.data?.data || []).map((l: any) => ({ label: l.lookup_value, value: l.lookup_value, _id: l._id })));
            } catch (e) {
                console.error("[ContactUI] Initial load failed", e);
            }
        };
        loadInitial();
    }, []);

    const fetchChildLookups = async (type: string, parentVal: string) => {
        try {
            const parent = lookups.find(l => l.lookup_value === parentVal);
            if (!parent) return [];
            const res = await api.get("/lookups", { params: { lookup_type: type, parent_lookup_id: parent._id, limit: 500 } });
            return (res.data?.data || []).map((l: any) => ({ label: l.lookup_value, value: l.lookup_value, _id: l._id }));
        } catch (e) {
            return [];
        }
    };

    useEffect(() => {
        if (form.country) fetchChildLookups("State", form.country).then(setStates);
    }, [form.country, lookups]);

    useEffect(() => {
        if (form.state) fetchChildLookups("City", form.state).then(setCities);
    }, [form.state, lookups]);

    const resolveId = (type: string, value: string) => {
        if (!value) return null;
        const match = lookups.find(l =>
            l.lookup_type?.toLowerCase() === type.toLowerCase() &&
            l.lookup_value?.toLowerCase() === value.toLowerCase()
        );
        return match ? match._id : value;
    };

    const set = (key: keyof ContactForm) => (val: string) => {
        setForm((f) => {
            const newForm = { ...f, [key]: val };
            if (key === 'country') { newForm.state = ""; newForm.city = ""; }
            if (key === 'state') { newForm.city = ""; }
            return newForm;
        });
    };

    const triggerShake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    const handleNext = () => {
        if (step === 0) {
            if (!form.name || !form.phone) {
                triggerShake();
                Alert.alert("Missing Fields", "Please enter at least a First Name and Mobile Number.");
                return;
            }
        }
        setStep(s => Math.min(s + 1, FORM_STEPS.length - 1));
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.phone.trim()) {
            Alert.alert("Required", "Please enter the contact's name and mobile number.");
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
                designation: resolveId('Designation', form.designation),
                gender: form.gender || undefined,
                maritalStatus: form.maritalStatus || undefined,
                personalAddress: {
                    country: resolveId('Country', form.country),
                    state: resolveId('State', form.state),
                    city: resolveId('City', form.city),
                    hNo: form.hNo || undefined,
                    street: form.street || undefined,
                    pinCode: form.pinCode || undefined,
                },
                source: resolveId('Source', form.source),
                campaign: resolveId('Campaign', form.campaign),
            };

            console.log("[ContactSave] Submitting Payload:", JSON.stringify(payload, null, 2));
            const res = await api.post("/contacts", payload);

            if (res.data?.success || res.status === 201 || res.status === 200) {
                Alert.alert("✅ Success", "Contact saved successfully!", [
                    { text: "OK", onPress: () => router.back() },
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

    const renderStepContent = () => {
        switch (step) {
            case 0: // Basic Info
                return (
                    <FadeInView key="step0" delay={100}>
                        <SectionHeader title="Basic Information" icon="👤" />
                        <View style={styles.card}>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Field label="First Name" required>
                                        <Input value={form.name} onChangeText={set("name")} placeholder="Amit" label="First Name" />
                                    </Field>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Field label="Last Name">
                                        <Input value={form.surname} onChangeText={set("surname")} placeholder="Sharma" label="Last Name" />
                                    </Field>
                                </View>
                            </View>

                            <Field label="Father's Name">
                                <Input value={form.fatherName} onChangeText={set("fatherName")} placeholder="Raj Sharma" label="Father's Name" />
                            </Field>

                            <Field label="Mobile Number" required>
                                <Input value={form.phone} onChangeText={set("phone")} placeholder="+91 98765 43210" keyboardType="phone-pad" label="Primary Mobile" />
                            </Field>

                            <Field label="Mobile Number 2">
                                <Input value={form.phone2} onChangeText={set("phone2")} placeholder="Alternate / Work" keyboardType="phone-pad" label="Secondary Mobile" />
                            </Field>

                            <Field label="Email Address">
                                <Input value={form.email} onChangeText={set("email")} placeholder="amit@example.com" keyboardType="email-address" label="Primary Email" />
                            </Field>

                            <Field label="Description">
                                <Input value={form.description} onChangeText={set("description")} placeholder="Add notes about this contact..." multiline numberOfLines={3} label="Notes" />
                            </Field>
                        </View>
                    </FadeInView>
                );
            case 1: // Professional
                return (
                    <FadeInView key="step1" delay={100}>
                        <SectionHeader title="Professional Details" icon="💼" />
                        <View style={styles.card}>
                            <Field label="Company Name">
                                <Input value={form.company} onChangeText={set("company")} placeholder="ABC Enterprises" label="Company" />
                            </Field>
                            <Field label="Work Office / Branch">
                                <Input value={form.workOffice} onChangeText={set("workOffice")} placeholder="Head Office, Delhi" label="Office Location" />
                            </Field>
                            <Field label="Designation">
                                <SelectButton value={form.designation} placeholder="Select Designation"
                                    options={lookups.filter(l => l.lookup_type === 'Designation').map(l => ({ label: l.lookup_value, value: l.lookup_value }))}
                                    onSelect={set("designation")} />
                            </Field>
                        </View>
                    </FadeInView>
                );
            case 2: // Personal
                return (
                    <FadeInView key="step2" delay={100}>
                        <SectionHeader title="Personal Attributes" icon="🪪" />
                        <View style={styles.card}>
                            <Field label="Gender">
                                <SelectButton value={form.gender} placeholder="Select Gender"
                                    options={["Male", "Female", "Other"].map(v => ({ label: v, value: v }))}
                                    onSelect={set("gender")} />
                            </Field>
                            <Field label="Marital Status">
                                <SelectButton value={form.maritalStatus} placeholder="Select Status"
                                    options={["Single", "Married", "Divorced", "Widowed"].map(v => ({ label: v, value: v }))}
                                    onSelect={set("maritalStatus")} />
                            </Field>
                            <Field label="Date of Birth">
                                <Input value={form.birthDate} onChangeText={set("birthDate")} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" label="Birthday" />
                            </Field>
                            <Field label="Anniversary Date">
                                <Input value={form.anniversaryDate} onChangeText={set("anniversaryDate")} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" label="Anniversary" />
                            </Field>
                        </View>
                    </FadeInView>
                );
            case 3: // Source & Address
                return (
                    <FadeInView key="step3" delay={100}>
                        <SectionHeader title="Source & Acquisition" icon="📣" />
                        <View style={styles.card}>
                            <Field label="Lead Source">
                                <SelectButton value={form.source} placeholder="Select Source"
                                    options={lookups.filter(l => l.lookup_type === 'Source').map(l => ({ label: l.lookup_value, value: l.lookup_value }))}
                                    onSelect={set("source")} />
                            </Field>
                            <Field label="Campaign">
                                <SelectButton value={form.campaign} placeholder="Select Campaign"
                                    options={lookups.filter(l => l.lookup_type === 'Campaign').map(l => ({ label: l.lookup_value, value: l.lookup_value }))}
                                    onSelect={set("campaign")} />
                            </Field>
                        </View>

                        <SectionHeader title="Physical Address" icon="📍" />
                        <View style={styles.card}>
                            <Field label="Country">
                                <TouchableOpacity style={styles.inputContainer} onPress={() => setActiveDropdown('country')}>
                                    <Text style={[styles.input, { lineHeight: 52 }, !form.country && { color: COLORS.textMuted }]}>
                                        {form.country || "Select Country"}
                                    </Text>
                                    <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} style={{ position: 'absolute', right: 16 }} />
                                </TouchableOpacity>
                            </Field>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Field label="State">
                                        <TouchableOpacity style={[styles.inputContainer, !form.country && styles.inputDisabled]} onPress={() => form.country && setActiveDropdown('state')}>
                                            <Text style={[styles.input, { lineHeight: 52 }, !form.state && { color: COLORS.textMuted }]}>
                                                {form.state || "State"}
                                            </Text>
                                        </TouchableOpacity>
                                    </Field>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Field label="City">
                                        <TouchableOpacity style={[styles.inputContainer, !form.state && styles.inputDisabled]} onPress={() => form.state && setActiveDropdown('city')}>
                                            <Text style={[styles.input, { lineHeight: 52 }, !form.city && { color: COLORS.textMuted }]}>
                                                {form.city || "City"}
                                            </Text>
                                        </TouchableOpacity>
                                    </Field>
                                </View>
                            </View>

                            <Field label="House / Flat No.">
                                <Input value={form.hNo} onChangeText={set("hNo")} placeholder="A-12, Sector 5" label="Unit / House No" />
                            </Field>
                            <Field label="Street / Colony">
                                <Input value={form.street} onChangeText={set("street")} placeholder="MG Road" label="Street Name" />
                            </Field>
                            <Field label="Pin Code">
                                <Input value={form.pinCode} onChangeText={set("pinCode")} placeholder="110001" keyboardType="number-pad" label="Pincode" />
                            </Field>
                        </View>

                        {/* Modals */}
                        <SearchableDropdown visible={activeDropdown === 'country'} onClose={() => setActiveDropdown(null)} options={countries} onSelect={set("country")} placeholder="Select Country" />
                        <SearchableDropdown visible={activeDropdown === 'state'} onClose={() => setActiveDropdown(null)} options={states} onSelect={set("state")} placeholder="Select State" />
                        <SearchableDropdown visible={activeDropdown === 'city'} onClose={() => setActiveDropdown(null)} options={cities} onSelect={set("city")} placeholder="Select City" />
                    </FadeInView>
                );
            default: return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        onPress={() => {
                            if (step > 0) {
                                setStep(step - 1);
                            } else {
                                const isDirty = JSON.stringify(form) !== JSON.stringify(INITIAL);
                                if (isDirty) {
                                    Alert.alert("Discard Changes?", "You have unsaved changes. Are you sure you want to go back?", [
                                        { text: "Keep Editing", style: "cancel" },
                                        { text: "Discard", style: "destructive", onPress: () => router.back() }
                                    ]);
                                } else {
                                    router.back();
                                }
                            }
                        }}
                        style={{ padding: 4, zIndex: 10 }}
                    >
                        <Ionicons name={step > 0 ? "arrow-back" : "close"} size={28} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{FORM_STEPS[step]}</Text>
                        <Text style={styles.headerSubtitle}>Step {step + 1} of {FORM_STEPS.length}</Text>
                    </View>
                    <View style={{ width: 28 }} />
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressTrack}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                { width: `${((step + 1) / FORM_STEPS.length) * 100}%` }
                            ]}
                        />
                    </View>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {renderStepContent()}
                    <View style={{ height: 100 }} />
                </ScrollView>

                <View style={styles.stickyFooter}>
                    {step > 0 && (
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep(step - 1)}>
                            <Text style={styles.cancelBtnText}>Back</Text>
                        </TouchableOpacity>
                    )}
                    <Animated.View style={{ flex: 1, transform: [{ translateX: shakeAnim }] }}>
                        {step < FORM_STEPS.length - 1 ? (
                            <Pressable
                                onPress={handleNext}
                                style={({ pressed }) => [
                                    styles.saveBtn,
                                    { transform: [{ scale: pressed ? 0.98 : 1 }] }
                                ]}
                            >
                                {({ pressed }) => (
                                    <>
                                        <Text style={styles.saveBtnText}>Next Step</Text>
                                        <Animated.View style={{ transform: [{ translateX: pressed ? 2 : 0 }] }}>
                                            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                                        </Animated.View>
                                    </>
                                )}
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={handleSave}
                                disabled={saving}
                                style={({ pressed }) => [
                                    styles.saveBtn,
                                    saving && styles.saveBtnDisabled,
                                    { transform: [{ scale: pressed && !saving ? 0.98 : 1 }] }
                                ]}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Contact</Text>
                                )}
                            </Pressable>
                        )}
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: COLORS.bg,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        zIndex: 1000,
        elevation: 10,
    },
    headerTitleContainer: { flex: 1, alignItems: 'center', paddingRight: 40 },
    headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary },
    headerSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
    progressContainer: { paddingHorizontal: 20, marginBottom: 12 },
    progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
    content: { flex: 1, paddingHorizontal: SPACING.outer },
    card: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 18,
        padding: SPACING.card,
        marginBottom: 24,
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.05,
                shadowRadius: 24,
            },
            android: { elevation: 3 },
        }),
    },
    sectionHeader: { marginTop: 4, marginBottom: 16 },
    sectionHeaderTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    sectionIcon: { fontSize: 18, marginRight: 10 },
    sectionTitle: { fontSize: 20, fontWeight: "600", color: COLORS.textPrimary },
    headerDivider: { height: 1, backgroundColor: COLORS.border, width: '100%', opacity: 0.5 },
    field: { marginBottom: SPACING.field },
    fieldLabel: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
    required: { color: COLORS.error },
    inputContainer: {
        position: 'relative',
        height: SPACING.inputHeight,
        marginBottom: 18,
        backgroundColor: COLORS.inputBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        justifyContent: 'center',
    },
    inputContainerFocused: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.cardBg,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    input: {
        fontSize: 16,
        color: COLORS.textPrimary,
        paddingHorizontal: 16,
        height: '100%',
        fontWeight: '500',
    },
    inputDisabled: {
        opacity: 0.6,
        backgroundColor: COLORS.border,
    },
    chipRow: { flexDirection: "row" },
    chipRowContent: { paddingRight: 20 },
    chip: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        marginRight: 10,
        backgroundColor: COLORS.cardBg,
    },
    chipSelected: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
    },
    chipText: { fontSize: 14, fontWeight: "500", color: COLORS.textSecondary },
    chipTextSelected: { color: COLORS.primary, fontWeight: "600" },
    placeholderText: { color: COLORS.textSecondary, fontSize: 13, padding: 8 },
    stickyFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.96)',
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        flexDirection: 'row',
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: "center",
        alignItems: "center",
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    cancelBtn: {
        paddingHorizontal: 20,
        height: 54,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelBtnText: { color: COLORS.textSecondary, fontWeight: "600" },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '80%',
        paddingTop: 20
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    modalSearchInput: {
        backgroundColor: COLORS.inputBg,
        marginHorizontal: 20,
        height: 50,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: COLORS.textPrimary,
        marginBottom: 16
    },
    modalListItem: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
    },
    modalListItemText: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
    modalEmptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12 },
});

