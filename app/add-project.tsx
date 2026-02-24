import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, Switch, ActivityIndicator, KeyboardAvoidingView,
    Platform, SafeAreaView, Animated, Pressable
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { createProject, type Project, type ProjectBlock } from "./services/projects.service";
import { getLookups, type Lookup } from "./services/lookups.service";
import { safeApiCall } from "./services/api.helpers";
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

const STEPS = ["Basic", "Location", "Blocks", "Amenities"];

export default function AddProjectScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Project>>({
        name: "",
        reraNumber: "",
        category: [],
        subCategory: [],
        status: "",
        landArea: "",
        landAreaUnit: "Acres",
        address: { city: "", location: "", state: "Punjab", country: "India" },
        blocks: [],
        amenities: {}
    });

    // Lookup Data
    const [lookups, setLookups] = useState<Record<string, Lookup[]>>({});

    useEffect(() => {
        const loadLookups = async () => {
            const types = ["Category", "SubCategory", "ProjectStatus"];
            const results: Record<string, Lookup[]> = {};
            for (const type of types) {
                const res = await safeApiCall<Lookup>(() => getLookups(type));
                if (!res.error) results[type] = res.data;
            }
            setLookups(results);
        };
        loadLookups();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        const res = await safeApiCall(() => createProject(formData));
        setLoading(false);
        if (!res.error) {
            Alert.alert("Success", "Project created successfully!");
            router.back();
        } else {
            Alert.alert("Error", res.error);
        }
    };

    const nextStep = () => {
        if (step < STEPS.length - 1) setStep(step + 1);
        else handleSave();
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
        else router.back();
    };

    const renderStepContent = () => {
        switch (step) {
            case 0: return <BasicStep data={formData} update={setFormData} lookups={lookups} />;
            case 1: return <LocationStep data={formData} update={setFormData} />;
            case 2: return <BlocksStep data={formData} update={setFormData} />;
            case 3: return <AmenitiesStep data={formData} update={setFormData} />;
            default: return null;
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <TouchableOpacity
                        onPress={prevStep}
                        style={styles.backBtn}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <Ionicons name={step === 0 ? "close" : "arrow-back"} size={26} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Add Project</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Text>
                    </View>
                    <View style={{ width: 28 }} />
                </View>

                <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}>
                    {STEPS.map((s, i) => (
                        <View
                            key={i}
                            style={[
                                styles.progressBar,
                                i < step && { backgroundColor: theme.primary + '40' },
                                i === step && { backgroundColor: theme.primary }
                            ]}
                        />
                    ))}
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {renderStepContent()}
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
                    <TouchableOpacity
                        style={[styles.footerBtnSecondary, { backgroundColor: theme.background, borderColor: theme.border }]}
                        onPress={prevStep}
                    >
                        <Text style={[styles.footerBtnTextSecondary, { color: theme.textSecondary }]}>{step === 0 ? "Cancel" : "Previous"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.footerBtnPrimary, { backgroundColor: theme.primary, shadowColor: theme.primary }, loading && { opacity: 0.7 }]}
                        onPress={nextStep}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.footerBtnTextPrimary}>{step === STEPS.length - 1 ? "Complete Setup" : "Continue"}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function BasicStep({ data, update, lookups }: { data: Partial<Project>; update: any; lookups: any }) {
    const { theme } = useTheme();
    return (
        <View style={styles.stepContainer}>
            <SectionHeader title="Basic Details" icon="🏠" subtitle="Key identity and status" />
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Field required>
                    <Input
                        label="Project Name"
                        placeholder="e.g. Green Valley"
                        value={data.name || ""}
                        onChangeText={txt => update({ ...data, name: txt })}
                    />
                </Field>

                <Field>
                    <Input
                        label="RERA Number"
                        placeholder="e.g. PBRERA-123"
                        value={data.reraNumber || ""}
                        onChangeText={txt => update({ ...data, reraNumber: txt })}
                        icon="document-text-outline"
                    />
                </Field>

                <Field label="Project Status">
                    <SelectButton
                        value={data.status || ""}
                        options={lookups["ProjectStatus"]?.map((s: Lookup) => ({ label: s.lookup_value, value: s._id })) || []}
                        onSelect={val => update({ ...data, status: val })}
                    />
                </Field>

                <View style={styles.row}>
                    <View style={{ flex: 1.2 }}>
                        <Field>
                            <Input
                                label="Land Area"
                                keyboardType="numeric"
                                placeholder="e.g. 10"
                                value={data.landArea || ""}
                                onChangeText={txt => update({ ...data, landArea: txt })}
                            />
                        </Field>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Field label="Unit">
                            <SelectButton
                                value={data.landAreaUnit || "Acres"}
                                options={["Acres", "Gaj"].map(u => ({ label: u, value: u }))}
                                onSelect={val => update({ ...data, landAreaUnit: val })}
                            />
                        </Field>
                    </View>
                </View>
            </View>
        </View>
    );
}

function LocationStep({ data, update }: { data: Partial<Project>; update: any }) {
    const { theme } = useTheme();
    return (
        <View style={styles.stepContainer}>
            <SectionHeader title="Location Details" icon="📍" subtitle="Project site and accessible markers" />
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Field required>
                    <Input
                        label="City"
                        placeholder="e.g. Mohali"
                        value={data.address?.city || ""}
                        onChangeText={txt => update({ ...data, address: { ...data.address, city: txt } })}
                    />
                </Field>
                <Field>
                    <Input
                        label="Area / Sector"
                        placeholder="e.g. Sector 82"
                        value={data.address?.location || ""}
                        onChangeText={txt => update({ ...data, address: { ...data.address, location: txt } })}
                    />
                </Field>
                <Field>
                    <Input
                        label="Full Address / Landmark"
                        placeholder="e.g. Near Airport Road"
                        value={data.locationSearch || ""}
                        onChangeText={txt => update({ ...data, locationSearch: txt })}
                        multiline
                        numberOfLines={3}
                    />
                </Field>
            </View>
        </View>
    );
}

function BlocksStep({ data, update }: { data: Partial<Project>; update: any }) {
    const { theme } = useTheme();
    const [newBlock, setNewBlock] = useState("");

    const addBlock = () => {
        if (!newBlock) return;
        update({ ...data, blocks: [...(data.blocks || []), { name: newBlock }] });
        setNewBlock("");
    };

    const removeBlock = (index: number) => {
        const nb = [...(data.blocks || [])];
        nb.splice(index, 1);
        update({ ...data, blocks: nb });
    };

    return (
        <View style={styles.stepContainer}>
            <SectionHeader title="Project Blocks" icon="🏗️" subtitle="Phases and sectoral partitions" />
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Field label="Add Block / Phase">
                    <View style={styles.addBlockRow}>
                        <View style={{ flex: 1 }}>
                            <Input
                                value={newBlock}
                                onChangeText={setNewBlock}
                                placeholder="Block A, Phase 1..."
                            />
                        </View>
                        <TouchableOpacity style={[styles.btnAddBlock, { backgroundColor: theme.primary, shadowColor: theme.primary }]} onPress={addBlock}>
                            <Ionicons name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </Field>

                <View style={styles.blockList}>
                    {data.blocks?.map((b: ProjectBlock, i: number) => (
                        <View key={i} style={[styles.blockItem, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <View style={[styles.blockIcon, { backgroundColor: theme.primary + '10' }]}>
                                <Ionicons name="business" size={18} color={theme.primary} />
                            </View>
                            <Text style={[styles.blockItemText, { color: theme.textPrimary }]}>{b.name}</Text>
                            <TouchableOpacity onPress={() => removeBlock(i)} style={styles.blockDeleteBtn}>
                                <Ionicons name="trash-outline" size={18} color={theme.error} />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {(!data.blocks || data.blocks.length === 0) && (
                        <Text style={[styles.hintText, { color: theme.textMuted }]}>No blocks added yet.</Text>
                    )}
                </View>
            </View>
        </View>
    );
}

function AmenitiesStep({ data, update }: { data: Partial<Project>; update: any }) {
    const { theme } = useTheme();
    const AMENITIES = [
        { name: "Clubhouse", icon: "business" },
        { name: "Gym", icon: "fitness" },
        { name: "Swimming Pool", icon: "water" },
        { name: "Gated Community", icon: "shield-checkmark" },
        { name: "Power Backup", icon: "flash" },
        { name: "Parks", icon: "leaf" },
        { name: "Jogging Track", icon: "walk" }
    ];

    const toggle = (name: string) => {
        update({
            ...data,
            amenities: { ...data.amenities, [name]: !data.amenities?.[name] }
        });
    };

    return (
        <View style={styles.stepContainer}>
            <SectionHeader title="Amenities" icon="✨" subtitle="Premium features and facilities" />
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                {AMENITIES.map(a => (
                    <TouchableOpacity
                        key={a.name}
                        style={[styles.amenityRow, { borderBottomColor: theme.border + '50' }]}
                        onPress={() => toggle(a.name)}
                    >
                        <View style={[styles.amenityIconContainer, { backgroundColor: theme.background }]}>
                            <Ionicons name={a.icon as any} size={20} color={data.amenities?.[a.name] ? theme.primary : theme.textMuted} />
                        </View>
                        <Text style={[styles.amenityLabel, { color: theme.textSecondary }, data.amenities?.[a.name] && { color: theme.textPrimary, fontWeight: '700' }]}>{a.name}</Text>
                        <Switch
                            value={!!data.amenities?.[a.name]}
                            onValueChange={() => toggle(a.name)}
                            trackColor={{ true: theme.primary + '40', false: theme.border }}
                            thumbColor={data.amenities?.[a.name] ? theme.primary : theme.textMuted}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
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
    progressBarContainer: { flexDirection: "row", height: 3, overflow: 'hidden' },
    progressBar: { flex: 1, height: '100%' },
    content: { flex: 1 },
    scroll: { padding: SPACING.outer, paddingBottom: 40 },
    stepContainer: { gap: 16 },
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
    row: { flexDirection: "row", alignItems: "center", gap: 16 },
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
    addBlockRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    btnAddBlock: {
        width: SPACING.inputHeight,
        height: SPACING.inputHeight,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    blockList: { marginTop: 16, gap: 12 },
    blockItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
    },
    blockIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    blockItemText: { flex: 1, fontSize: 15, fontWeight: '700' },
    blockDeleteBtn: { padding: 6 },
    hintText: { fontSize: 13, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
    amenityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    amenityIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    amenityLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
    footer: {
        flexDirection: "row",
        padding: 20,
        borderTopWidth: 1,
        gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    footerBtnSecondary: {
        flex: 1,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    footerBtnPrimary: {
        flex: 2,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    footerBtnTextSecondary: { fontSize: 15, fontWeight: "700" },
    footerBtnTextPrimary: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
