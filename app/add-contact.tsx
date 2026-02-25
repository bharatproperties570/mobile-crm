import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
    Animated, Pressable, Modal, FlatList
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

interface ContactForm {
    title: string;
    name: string;
    phone1: string;
    phone2: string;
    email1: string;
    email2: string;
    description: string;
    source: string;
    tags: string;
}

const INITIAL: ContactForm = {
    title: "", name: "", phone1: "", phone2: "",
    email1: "", email2: "", description: "",
    source: "", tags: "",
};

export default function AddContactScreen() {
    const { id, companyId } = useLocalSearchParams<{ id?: string, companyId?: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<ContactForm>(INITIAL);

    // Lookups
    const [titles, setTitles] = useState<any[]>([]);
    const [sources, setSources] = useState<any[]>([]);
    const [lookups, setLookups] = useState<any[]>([]);

    useEffect(() => {
        const loadInitial = async () => {
            try {
                const res = await api.get("/lookups", { params: { limit: 2000 } });
                const allLookups = res.data?.data || [];
                setLookups(allLookups);

                setTitles(allLookups.filter((l: any) => l.lookup_type === 'Title').map((l: any) => ({ label: l.lookup_value, value: l.lookup_value })));
                setSources(allLookups.filter((l: any) => l.lookup_type === 'Source').map((l: any) => ({ label: l.lookup_value, value: l.lookup_value })));
            } catch (e) {
                console.error("[ContactUI] Initial load failed", e);
            }
        };
        loadInitial();
    }, []);

    const resolveId = (type: string, value: string) => {
        if (!value) return null;
        const match = lookups.find(l =>
            l.lookup_type?.toLowerCase() === type.toLowerCase() &&
            l.lookup_value?.toLowerCase() === value.toLowerCase()
        );
        return match ? match._id : value;
    };

    const set = (key: keyof ContactForm) => (val: string) => {
        setForm((f) => ({ ...f, [key]: val }));
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.phone1.trim()) {
            Alert.alert("Required", "Please enter the contact's name and primary mobile number.");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: resolveId('Title', form.title),
                name: form.name.trim(),
                phones: [
                    ...(form.phone1 ? [{ number: form.phone1, type: "Primary" }] : []),
                    ...(form.phone2 ? [{ number: form.phone2, type: "Alternate" }] : []),
                ],
                emails: [
                    ...(form.email1 ? [{ address: form.email1, type: "Primary" }] : []),
                    ...(form.email2 ? [{ address: form.email2, type: "Alternate" }] : []),
                ],
                description: form.description || undefined,
                source: resolveId('Source', form.source),
                tags: form.tags ? [form.tags] : undefined,
                company: companyId || undefined,
            };

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
                                    { text: "Discard", style: "destructive", onPress: () => router.back() }
                                ]);
                            } else {
                                router.back();
                            }
                        }}
                        style={styles.backBtn}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <Ionicons name="close" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Create Contact</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Individual Person</Text>
                    </View>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <SectionHeader title="Basic Details" icon="👤" subtitle="Primary identity information" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Title" required>
                            <SelectButton value={form.title} options={titles} onSelect={set("title")} />
                        </Field>
                        <Field required>
                            <Input label="Full Name" value={form.name} onChangeText={set("name")} placeholder="John Doe" />
                        </Field>
                        <Field required>
                            <Input label="Primary Mobile" value={form.phone1} onChangeText={set("phone1")} placeholder="+91 98765 43210" keyboardType="phone-pad" icon="call-outline" />
                        </Field>
                        <Field>
                            <Input label="Alternate Mobile" value={form.phone2} onChangeText={set("phone2")} placeholder="Optional" keyboardType="phone-pad" icon="call-outline" />
                        </Field>
                        <Field>
                            <Input label="Primary Email" value={form.email1} onChangeText={set("email1")} placeholder="john@example.com" keyboardType="email-address" icon="mail-outline" />
                        </Field>
                        <Field>
                            <Input label="Alternate Email" value={form.email2} onChangeText={set("email2")} placeholder="Optional" keyboardType="email-address" icon="mail-outline" />
                        </Field>
                        <Field>
                            <Input label="Personal Profile" value={form.description} onChangeText={set("description")} placeholder="Notes about this contact..." multiline numberOfLines={3} />
                        </Field>
                    </View>

                    <SectionHeader title="Source Details" icon="📣" subtitle="Lead acquisition tracking" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Contact Source">
                            <SelectButton value={form.source} options={sources} onSelect={set("source")} />
                        </Field>
                        <Field label="Contact Tags">
                            <SelectButton value={form.tags} options={[{ label: "Hot", value: "Hot" }, { label: "Warm", value: "Warm" }, { label: "Cold", value: "Cold" }]} onSelect={set("tags")} />
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
                                <Ionicons name="person-add-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.bottomSaveBtnText}>Create Contact Profile</Text>
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
});
