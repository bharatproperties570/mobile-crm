import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Switch, Modal, FlatList, SafeAreaView, Platform,
    Animated, Pressable
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import GooglePlacesAutocomplete from './components/GooglePlacesAutocompleteFixed';
import { getTeams, getTeamMembers } from "./services/teams.service";
import { getLeadById, addLead, updateLead, checkDuplicates } from "./services/leads.service";
import { getLookups } from "./services/lookups.service";
import { getProjects } from "./services/projects.service";
import api from "./services/api";

const LEAD_LOOKUP_TYPES = [
    "Requirement", "Category", "SubCategory", "PropertyType",
    "Budget", "Facing", "Direction", "Status", "Stage", "Campaign",
    "Sub Campaign", "Source", "SubSource"
];

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

const BUDGET_VALUES = [
    { value: 500000, label: "5 Lakh" },
    { value: 2500000, label: "25 Lakh" },
    { value: 5000000, label: "50 Lakh" },
    { value: 7500000, label: "75 Lakh" },
    { value: 10000000, label: "1 Crore" },
    { value: 15000000, label: "1.5 Crore" },
    { value: 20000000, label: "2 Crore" },
    { value: 25000000, label: "2.5 Crore" },
    { value: 30000000, label: "3 Crore" },
    { value: 35000000, label: "3.5 Crore" },
    { value: 40000000, label: "4 Crore" },
    { value: 45000000, label: "4.5 Crore" },
    { value: 50000000, label: "5 Crore" },
    { value: 55000000, label: "5.5 Crore" },
    { value: 60000000, label: "6 Crore" },
    { value: 70000000, label: "7 Crore" },
    { value: 80000000, label: "8 Crore" },
    { value: 90000000, label: "9 Crore" },
    { value: 100000000, label: "10 Crore" },
    { value: 200000000, label: "20 Crore" },
    { value: 300000000, label: "30 Crore" },
    { value: 500000000, label: "50 Crore" },
    { value: 750000000, label: "75 Crore" },
    { value: 1000000000, label: "100 Crore" }
];

const GOOGLE_API_KEY = "AIzaSyBd2gdMJVt5C_tgYqWoRbBiatzmevYdB9U";

// --- Constants & Helpers ---
const FORM_STEPS = ["Requirement", "Location", "Contact", "System"];

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
    value, onChangeText, placeholder, keyboardType, multiline, numberOfLines, editable = true, label, leftIcon, required, autoCapitalize
}: {
    value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean; numberOfLines?: number; editable?: boolean; label?: string; leftIcon?: React.ReactNode; required?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters";
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
            {label && (
                <Animated.Text style={labelStyle}>
                    {label}
                    {required && <Text style={{ color: COLORS.error }}> *</Text>}
                </Animated.Text>
            )}
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
                    autoCapitalize={autoCapitalize}
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
    if (options.length === 0) return <Text style={styles.placeholderText}>{placeholder || "No options available"}</Text>;

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

function MultiSelectButton({
    values, placeholder, options, onToggle,
}: {
    values: string[]; placeholder: string; options: { label: string, value: string }[]; onToggle: (v: string) => void;
}) {
    if (options.length === 0) return <Text style={styles.placeholderText}>{placeholder || "No options available"}</Text>;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {options.map((opt, idx) => (
                <PressableChip
                    key={`${opt.value || idx}-${idx}`}
                    opt={opt}
                    isSelected={values.includes(opt.value)}
                    onSelect={onToggle}
                />
            ))}
        </ScrollView>
    );
}

export default function AddLeadScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Animations
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const googlePlacesRef = useRef<any>(null);

    // Form State (Full parity with Web CRM)
    const [formData, setFormData] = useState<any>({
        // ... same state ...
        salutation: "Mr.",
        firstName: "",
        lastName: "",
        mobile: "",
        email: "",

        requirement: "Buy",
        purpose: "End Use",
        nri: false,
        propertyType: [],
        subType: [],
        unitType: [],
        budget: "",
        budgetMin: "",
        budgetMax: "",
        areaMin: "",
        areaMax: "",
        areaMetric: "Sq Yard",
        facing: [],
        roadWidth: [],
        direction: [],
        funding: "",
        timeline: "",
        furnishing: "",
        transactionType: "",

        searchLocation: "",
        locCity: "",
        locArea: "",
        locPinCode: "",
        locRange: 5,
        projectName: [],
        projectTowers: [],
        propertyNo: "",
        propertyNoEnd: "",
        unitSelectionMode: "Single",

        status: "",
        source: "",
        subSource: "",
        campaign: "",
        subCampaign: "",
        owner: "",
        team: "",
        visibleTo: "Everyone",
        stage: "",
        description: "",
        tags: [],
    });

    // Master Data
    const [lookups, setLookups] = useState<Record<string, any[]>>({});
    const [projects, setProjects] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [duplicates, setDuplicates] = useState<any[]>([]);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const results = await Promise.all([
                    ...LEAD_LOOKUP_TYPES.map(type => getLookups(type)),
                    getProjects(),
                    getTeams(),
                    api.get("/users"),
                    id ? getLeadById(id) : Promise.resolve(null),
                ]);

                const lookupMap: Record<string, any[]> = {};
                LEAD_LOOKUP_TYPES.forEach((type, i) => {
                    const res = results[i];
                    lookupMap[type] = res?.data || (Array.isArray(res) ? res : []);
                });

                setLookups(lookupMap);

                const projectsRes = results[LEAD_LOOKUP_TYPES.length];
                setProjects(projectsRes?.data || (Array.isArray(projectsRes) ? projectsRes : []));

                const teamsRes = results[LEAD_LOOKUP_TYPES.length + 1];
                setTeams(teamsRes?.data || (Array.isArray(teamsRes) ? teamsRes : []));

                const usersRes = results[LEAD_LOOKUP_TYPES.length + 2]?.data;
                const userList = usersRes?.records ?? usersRes?.data ?? (Array.isArray(usersRes) ? usersRes : []);
                setUsers(Array.isArray(userList) ? userList : []);

                const existingLead = results[LEAD_LOOKUP_TYPES.length + 3];
                if (existingLead) {
                    const l = existingLead.data || existingLead;
                    setFormData({
                        salutation: l.salutation || "Mr.",
                        firstName: l.firstName || "",
                        lastName: l.lastName || "",
                        mobile: l.mobile || "",
                        email: l.email || "",
                        requirement: l.requirement?.lookup_value || l.requirement || "Buy",
                        purpose: l.purpose || "End Use",
                        nri: !!l.nri,
                        propertyType: Array.isArray(l.propertyType) ? l.propertyType.map((v: any) => v._id || v) : (l.propertyType ? [l.propertyType._id || l.propertyType] : []),
                        subType: Array.isArray(l.subType) ? l.subType.map((v: any) => v._id || v) : (l.subType ? [l.subType._id || l.subType] : []),
                        unitType: Array.isArray(l.unitType) ? l.unitType.map((v: any) => v._id || v) : (l.unitType ? [l.unitType._id || l.unitType] : []),
                        budget: l.budget?._id || l.budget || "",
                        budgetMin: String(l.budgetMin || ""),
                        budgetMax: String(l.budgetMax || ""),
                        areaMin: String(l.areaMin || ""),
                        areaMax: String(l.areaMax || ""),
                        areaMetric: l.areaMetric || "Sq Yard",
                        facing: Array.isArray(l.facing) ? l.facing.map((v: any) => v._id || v) : (l.facing ? [l.facing._id || l.facing] : []),
                        roadWidth: Array.isArray(l.roadWidth) ? l.roadWidth.map((v: any) => v._id || v) : (l.roadWidth ? [l.roadWidth._id || l.roadWidth] : []),
                        direction: Array.isArray(l.direction) ? l.direction.map((v: any) => v._id || v) : (l.direction ? [l.direction._id || l.direction] : []),
                        funding: l.funding || "",
                        timeline: l.timeline || "",
                        furnishing: l.furnishing || "",
                        transactionType: l.transactionType || "",
                        searchLocation: l.searchLocation || "",
                        locCity: l.locCity || "",
                        locArea: l.locArea || "",
                        locPinCode: l.locPinCode || "",
                        projectName: Array.isArray(l.projectName) ? l.projectName : [],
                        status: l.status?._id || l.status || "",
                        stage: l.stage?._id || l.stage || "",
                        source: l.source?._id || l.source || "",
                        subSource: l.subSource?._id || l.subSource || "",
                        campaign: l.campaign?._id || l.campaign || "",
                        subCampaign: l.subCampaign?._id || l.subCampaign || "",
                        owner: l.owner?._id || l.owner || l.assignment?.assignedTo?._id || "",
                        team: l.assignment?.team?.[0] || l.team?._id || l.team || "",
                        visibleTo: l.assignment?.visibleTo || "Everyone",
                        description: l.description || "",
                        tags: Array.isArray(l.tags) ? l.tags : [],
                    });
                }
            } catch (error) {
                console.error("Failed to load form data", error);
                Alert.alert("Error", "Could not load form data.");
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id]);

    // Duplicate Check
    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (formData.firstName.length > 2 || formData.mobile.length > 5) {
                try {
                    const res = await checkDuplicates(formData);
                    if (res.success) {
                        setDuplicates(res.data || []);
                        setIsBlocked(res.blockAction === true);
                    }
                } catch (e) { }
            } else {
                setDuplicates([]);
                setIsBlocked(false);
            }
        }, 800);
        return () => clearTimeout(delayDebounce);
    }, [formData.firstName, formData.mobile]);

    const getLookupId = (type: string, value: string) => {
        const list = lookups[type];
        if (!Array.isArray(list)) return null;
        const item = list.find((l: any) => l.lookup_value === value);
        return item?._id || value;
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
        if (step === 2) { // Contact Step
            if (!formData.firstName || !formData.mobile) {
                triggerShake();
                Alert.alert("Missing Fields", "First Name and Mobile Number are required.");
                return;
            }
        }
        setStep(s => Math.min(s + 1, FORM_STEPS.length - 1));
    };

    const handleSave = async () => {
        if (!formData.firstName || !formData.mobile) {
            Alert.alert("Error", "First Name and Mobile Number are required");
            return;
        }
        if (isBlocked && !id) {
            Alert.alert("Critical", "A critical duplicate rule prevents saving this record.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                requirement: getLookupId("Requirement", formData.requirement),
                locBlock: formData.projectTowers,
                budgetMin: formData.budgetMin ? Number(formData.budgetMin) : undefined,
                budgetMax: formData.budgetMax ? Number(formData.budgetMax) : undefined,
                areaMin: formData.areaMin ? Number(formData.areaMin) : undefined,
                areaMax: formData.areaMax ? Number(formData.areaMax) : undefined,
                assignment: {
                    assignedTo: formData.owner || undefined,
                    team: formData.team ? [formData.team] : [],
                    visibleTo: formData.visibleTo || "Everyone"
                }
            };
            delete (payload as any).projectTowers;

            const res = id ? await updateLead(id, payload) : await addLead(payload);
            if (res.success || res.status === 200 || res.data) {
                router.replace("/(tabs)/leads");
            } else {
                throw new Error(res.message || "Failed to save lead");
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to save lead");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    const renderMultiSelect = (type: string, field: string) => {
        const list = lookups[type];
        const options = (list || []).map(l => ({ label: l.lookup_value, value: l._id }));
        return (
            <MultiSelectButton
                values={formData[field]}
                options={options}
                placeholder={`Select ${type}`}
                onToggle={(val) => {
                    const current = formData[field] || [];
                    const newList = current.includes(val) ? current.filter((i: string) => i !== val) : [...current, val];
                    setFormData({ ...formData, [field]: newList });
                }}
            />
        );
    };

    const renderSingleSelect = (type: string, field: string, parentId?: string) => {
        let list = lookups[type];
        if (!Array.isArray(list)) return null;
        if (parentId) {
            list = list.filter(item => item.parent_lookup_id === parentId || item.parent_lookup_value === parentId);
        }
        const options = list.map(l => ({ label: l.lookup_value, value: l._id }));
        return (
            <SelectButton
                value={formData[field]}
                options={options}
                placeholder={`Select ${type}`}
                onSelect={(val) => setFormData({ ...formData, [field]: val })}
            />
        );
    };

    const renderDependentMultiSelect = (type: string, field: string, parentIds: string[]) => {
        let list = lookups[type];
        if (!Array.isArray(list) || !parentIds || parentIds.length === 0) return <Text style={styles.hintText}>Select parent field first</Text>;

        const pIds = parentIds.map(id => String(id));
        const parentValues: string[] = [];
        Object.values(lookups).flat().forEach((l: any) => {
            if (pIds.includes(String(l._id))) parentValues.push(l.lookup_value);
        });

        const filtered = list.filter(item =>
            pIds.includes(String(item.parent_lookup_id)) ||
            pIds.includes(String(item.parent_lookup_value)) ||
            parentValues.includes(item.parent_lookup_value)
        );

        if (filtered.length === 0) return <Text style={styles.hintText}>No options found for selection</Text>;

        const options = filtered.map(l => ({ label: l.lookup_value, value: l._id }));
        return (
            <MultiSelectButton
                values={formData[field]}
                options={options}
                placeholder={`Select ${type}`}
                onToggle={(val) => {
                    const current = formData[field] || [];
                    const newList = current.includes(val) ? current.filter((i: string) => i !== val) : [...current, val];
                    setFormData({ ...formData, [field]: newList });
                }}
            />
        );
    };

    const renderStepContent = () => {
        switch (step) {
            case 0: // Requirement
                return (
                    <FadeInView key="step0">
                        <View style={styles.card}>
                            <SectionHeader title="Requirement" icon="📋" />

                            <Field label="Type" required>
                                <SelectButton
                                    value={formData.requirement}
                                    options={["Buy", "Rent", "Lease"].map(r => ({ label: r, value: r }))}
                                    onSelect={(v) => setFormData({ ...formData, requirement: v })}
                                    placeholder="Select Type"
                                />
                            </Field>

                            <Field label="Category">
                                {renderMultiSelect("Category", "propertyType")}
                            </Field>

                            <Field label="Sub Category">
                                {renderDependentMultiSelect("SubCategory", "subType", formData.propertyType)}
                            </Field>

                            <Field label="Size Type">
                                {renderDependentMultiSelect("PropertyType", "unitType", formData.subType)}
                            </Field>

                            <Field label="Budget (Min - Max)">
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.budgetScroll}>
                                            {BUDGET_VALUES.map((opt) => (
                                                <PressableChip
                                                    key={`min-${opt.value}`}
                                                    opt={{ label: opt.label, value: String(opt.value) }}
                                                    isSelected={formData.budgetMin === String(opt.value)}
                                                    onSelect={(v) => setFormData({ ...formData, budgetMin: v })}
                                                />
                                            ))}
                                        </ScrollView>
                                    </View>
                                </View>
                                <View style={{ marginTop: 12 }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.budgetScroll}>
                                        {BUDGET_VALUES
                                            .filter(opt => !formData.budgetMin || opt.value > Number(formData.budgetMin))
                                            .map((opt) => (
                                                <PressableChip
                                                    key={`max-${opt.value}`}
                                                    opt={{ label: opt.label, value: String(opt.value) }}
                                                    isSelected={formData.budgetMax === String(opt.value)}
                                                    onSelect={(v) => setFormData({ ...formData, budgetMax: v })}
                                                />
                                            ))}
                                    </ScrollView>
                                </View>
                            </Field>

                            <Field label="Area Range">
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <Input value={formData.areaMin} onChangeText={v => setFormData({ ...formData, areaMin: v })} placeholder="Min" keyboardType="numeric" />
                                    <Input value={formData.areaMax} onChangeText={v => setFormData({ ...formData, areaMax: v })} placeholder="Max" keyboardType="numeric" />
                                </View>
                            </Field>

                            <Field label="Facing">
                                {renderMultiSelect("Facing", "facing")}
                            </Field>

                            <Field label="Direction">
                                {renderMultiSelect("Direction", "direction")}
                            </Field>

                            <Field label="Purpose">
                                <SelectButton
                                    value={formData.purpose}
                                    options={["End Use", "Investment"].map(v => ({ label: v, value: v }))}
                                    onSelect={(v) => setFormData({ ...formData, purpose: v })}
                                    placeholder="Select Purpose"
                                />
                            </Field>

                            <View style={[styles.rowAlign, { marginTop: 12 }]}>
                                <Text style={styles.fieldLabel}>NRI Status</Text>
                                <Switch value={formData.nri} onValueChange={v => setFormData({ ...formData, nri: v })} trackColor={{ true: COLORS.primaryLight, false: COLORS.border }} thumbColor={formData.nri ? COLORS.primary : "#f4f3f4"} />
                            </View>
                        </View>
                    </FadeInView>
                );
            case 1: // Location
                return (
                    <FadeInView key="step1">
                        <View style={styles.card}>
                            <SectionHeader title="Location" icon="📍" />

                            <Field label="Search Location">
                                <View style={styles.googleSearchContainer}>
                                    <GooglePlacesAutocomplete
                                        ref={googlePlacesRef}
                                        placeholder="Area, sector or city..."
                                        onPress={(data: any, details: any = null) => {
                                            if (details) {
                                                const locObj = {
                                                    searchLocation: data.description,
                                                    locCity: details?.address_components?.find((c: any) => c.types.includes("locality"))?.long_name || "",
                                                    locArea: details?.address_components?.find((c: any) => c.types.includes("sublocality"))?.long_name || ""
                                                };
                                                setFormData((prev: any) => ({ ...prev, ...locObj }));
                                            }
                                        }}
                                        query={{ key: GOOGLE_API_KEY, language: "en", components: "country:in" }}
                                        styles={{
                                            textInput: styles.input,
                                            container: { flex: 0 },
                                            listView: { backgroundColor: "#ffffff", borderRadius: 10, marginTop: 5, elevation: 5, zIndex: 1000 }
                                        }}
                                        fetchDetails={true}
                                        enablePoweredByContainer={false}
                                        textInputProps={{
                                            placeholderTextColor: COLORS.textMuted,
                                        }}
                                    />
                                </View>
                            </Field>

                            <Field label={`Range (${formData.locRange} km)`}>
                                <SelectButton
                                    value={String(formData.locRange)}
                                    options={[1, 5, 10, 25, 50, 100].map(r => ({ label: `${r === 100 ? "100+" : r}km`, value: String(r) }))}
                                    onSelect={(v) => setFormData({ ...formData, locRange: Number(v) })}
                                    placeholder="Select Range"
                                />
                            </Field>

                            <SectionHeader title="Projects" icon="🏗️" />

                            <Field label="Select Projects">
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectScroll}>
                                    {Array.isArray(projects) && projects.map((p) => {
                                        const active = formData.projectName.includes(p.name);
                                        return (
                                            <TouchableOpacity key={p._id} style={[styles.projectCard, active && styles.projectCardActive]} onPress={() => {
                                                const newList = active ? formData.projectName.filter((n: string) => n !== p.name) : [...formData.projectName, p.name];
                                                setFormData({ ...formData, projectName: newList });
                                            }}>
                                                <Text style={[styles.projectText, active && styles.projectTextActive]}>{p.name}</Text>
                                                <Text style={styles.projectSub}>{p.address?.city || "Unknown City"}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </Field>

                            {formData.projectName.length > 0 && (
                                <View>
                                    <Field label="Blocks">
                                        <View style={styles.chipGroup}>
                                            {projects
                                                .filter(p => formData.projectName.includes(p.name))
                                                .flatMap(p => (p.blocks || []).map((b: any) => ({ projectId: p._id, projectName: p.name, block: typeof b === 'string' ? b : b.name })))
                                                .map((item, idx) => {
                                                    const key = `${item.projectName}-${item.block}`;
                                                    const active = formData.projectTowers.includes(key);
                                                    return (
                                                        <PressableChip
                                                            key={`${idx}-${item.block}`}
                                                            opt={{ label: `${item.block} (${item.projectName})`, value: key }}
                                                            isSelected={active}
                                                            onSelect={() => {
                                                                const newList = active ? formData.projectTowers.filter((t: string) => t !== key) : [...formData.projectTowers, key];
                                                                setFormData((prev: any) => ({ ...prev, projectTowers: newList }));
                                                            }}
                                                        />
                                                    );
                                                })
                                            }
                                        </View>
                                    </Field>

                                    <Field label="Selection Mode">
                                        <SelectButton
                                            value={formData.unitSelectionMode}
                                            options={["Single", "Multiple", "Range"].map(m => ({ label: m, value: m }))}
                                            onSelect={(v) => setFormData({ ...formData, unitSelectionMode: v })}
                                            placeholder="Select Mode"
                                        />
                                    </Field>

                                    <Field label="Unit Details">
                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            {formData.unitSelectionMode === "Range" ? (
                                                <>
                                                    <Input label="Start" value={formData.propertyNo} onChangeText={v => setFormData({ ...formData, propertyNo: v })} placeholder="e.g. 1" />
                                                    <Input label="End" value={formData.propertyNoEnd} onChangeText={v => setFormData({ ...formData, propertyNoEnd: v })} placeholder="e.g. 10" />
                                                </>
                                            ) : (
                                                <Input
                                                    label={formData.unitSelectionMode === "Multiple" ? "Unit Numbers (CSV)" : "Unit Number"}
                                                    value={formData.propertyNo}
                                                    onChangeText={v => setFormData({ ...formData, propertyNo: v })}
                                                    placeholder={formData.unitSelectionMode === "Multiple" ? "101, 102..." : "e.g. 101"}
                                                />
                                            )}
                                        </View>
                                    </Field>
                                </View>
                            )}
                        </View>
                    </FadeInView>
                );
            case 2: // Contact
                return (
                    <FadeInView key="step2">
                        <View style={styles.card}>
                            <SectionHeader title="Contact" icon="👤" />

                            {Array.isArray(duplicates) && duplicates.length > 0 && (
                                <View style={[styles.warningBox, isBlocked && styles.errorBox]}>
                                    <Text style={styles.warningTitle}>⚠️ {duplicates.length} Similar record(s) found</Text>
                                    {duplicates.map((d, i) => (
                                        <Text key={i} style={styles.dupItem}>{d.firstName} {d.lastName} ({d.mobile || (Array.isArray(d.phones) && d.phones[0]?.number)})</Text>
                                    ))}
                                </View>
                            )}

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ width: 100 }}>
                                    <Input label="Title" value={formData.salutation} onChangeText={v => setFormData({ ...formData, salutation: v })} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Input label="First Name" required value={formData.firstName} onChangeText={v => setFormData({ ...formData, firstName: v })} />
                                </View>
                            </View>

                            <Input label="Last Name" value={formData.lastName} onChangeText={v => setFormData({ ...formData, lastName: v })} />
                            <Input label="Mobile" required keyboardType="phone-pad" value={formData.mobile} onChangeText={v => setFormData({ ...formData, mobile: v })} />
                            <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={formData.email} onChangeText={v => setFormData({ ...formData, email: v })} />
                        </View>
                    </FadeInView>
                );
            case 3: // System
                return (
                    <FadeInView key="step3">
                        <View style={styles.card}>
                            <SectionHeader title="System" icon="⚙️" />

                            <Field label="Stage">
                                {renderSingleSelect("Stage", "stage")}
                            </Field>

                            <Field label="Campaign">
                                {renderSingleSelect("Campaign", "campaign")}
                            </Field>

                            {formData.campaign ? (
                                <Field label="Sub Campaign">
                                    {renderSingleSelect("Sub Campaign", "subCampaign", formData.campaign)}
                                </Field>
                            ) : null}

                            <Field label="Source">
                                {renderSingleSelect("Source", "source", formData.campaign)}
                            </Field>

                            {formData.source ? (
                                <Field label="Sub Source">
                                    {renderSingleSelect("SubSource", "subSource", formData.source)}
                                </Field>
                            ) : null}

                            <Field label="Assignment">
                                <Text style={styles.subLabel}>Team</Text>
                                <SelectButton
                                    value={formData.team}
                                    options={teams.map(t => ({ label: t.name, value: t._id }))}
                                    onSelect={(v) => setFormData({ ...formData, team: v, owner: "" })}
                                    placeholder="Select Team"
                                />
                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.subLabel}>User</Text>
                                    <SelectButton
                                        value={formData.owner}
                                        options={users.filter(u => !formData.team || u.team === formData.team).map(u => ({ label: u.fullName || u.name, value: u._id }))}
                                        onSelect={(v) => setFormData({ ...formData, owner: v })}
                                        placeholder="Select User"
                                    />
                                </View>
                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.subLabel}>Visibility</Text>
                                    <SelectButton
                                        value={formData.visibleTo}
                                        options={[
                                            { label: "Everyone", value: "Everyone" },
                                            { label: "Team", value: "Team" },
                                            { label: "Private", value: "Private" }
                                        ]}
                                        onSelect={(v) => setFormData({ ...formData, visibleTo: v })}
                                        placeholder="Select Visibility"
                                    />
                                </View>
                            </Field>

                            <Input label="Internal Notes" multiline numberOfLines={4} value={formData.description} onChangeText={v => setFormData({ ...formData, description: v })} />
                        </View>
                    </FadeInView>
                );
            default: return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/(tabs)/leads");
                        }
                    }}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{id ? "Edit Lead" : "Add Lead"}</Text>
                    <Text style={styles.headerSubtitle}>{FORM_STEPS[step]}</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            {/* Stepper */}
            <View style={styles.stepperContainer}>
                {FORM_STEPS.map((s, i) => (
                    <View key={s} style={styles.stepWrapper}>
                        <View style={[styles.stepDot, step >= i && styles.stepDotActive]}>
                            {step > i ? (
                                <Ionicons name="checkmark" size={12} color="#fff" />
                            ) : (
                                <Text style={[styles.stepNumber, step >= i && styles.stepNumberActive]}>{i + 1}</Text>
                            )}
                        </View>
                        <Text style={[styles.stepLabel, step >= i && styles.stepLabelActive]} numberOfLines={1}>{s}</Text>
                    </View>
                ))}
            </View>

            <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                    {renderStepContent()}
                </Animated.View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                {step > 0 && (
                    <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(s => s - 1)}>
                        <Text style={styles.prevBtnText}>Back</Text>
                    </TouchableOpacity>
                )}
                {step < FORM_STEPS.length - 1 ? (
                    <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                        <Text style={styles.nextBtnText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.saveBtn, (isSaving || (isBlocked && !id)) && styles.disabledBtn]} onPress={handleSave} disabled={isSaving || (isBlocked && !id)}>
                        {isSaving ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Text style={styles.saveBtnText}>{id ? "Update Lead" : "Create Lead"}</Text>
                                <Ionicons name="cloud-upload" size={18} color="#fff" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 10 : 40, paddingBottom: 16,
        backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.border,
        zIndex: 10,
    },
    closeBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bg,
        justifyContent: "center", alignItems: "center", zIndex: 11,
    },
    headerTitleContainer: { alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
    headerSubtitle: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600", marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },

    stepperContainer: {
        flexDirection: "row", justifyContent: "space-between", padding: 20,
        backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    stepWrapper: { alignItems: "center", flex: 1 },
    stepDot: {
        width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.inputBg,
        justifyContent: "center", alignItems: "center", marginBottom: 6,
    },
    stepDotActive: { backgroundColor: COLORS.primary },
    stepNumber: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
    stepNumberActive: { color: "#fff" },
    stepLabel: { fontSize: 10, fontWeight: "600", color: COLORS.textMuted },
    stepLabelActive: { color: COLORS.primary },

    mainScroll: { flex: 1 },
    scrollContent: { padding: SPACING.outer, paddingBottom: 120 },
    card: {
        backgroundColor: COLORS.cardBg, borderRadius: 20, padding: SPACING.card,
        borderWidth: 1, borderColor: COLORS.border,
        ...Platform.select({
            ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
            android: { elevation: 3 },
        }),
    },
    sectionHeader: { marginBottom: SPACING.section },
    sectionHeaderTop: { flexDirection: "row", alignItems: "center" },
    headerDivider: { height: 2, backgroundColor: COLORS.primaryLight, width: 40, marginTop: 8, borderRadius: 1 },
    sectionIcon: { fontSize: 22, marginRight: 12 },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },

    field: { marginBottom: SPACING.field },
    fieldLabel: { fontSize: 14, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 8, marginLeft: 4 },
    required: { color: COLORS.error },

    inputContainer: {
        height: SPACING.inputHeight, backgroundColor: COLORS.cardBg,
        borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
        justifyContent: "center", position: 'relative', marginVertical: 8,
    },
    inputContainerFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.cardBg },
    input: {
        height: "100%", paddingHorizontal: 16, fontSize: 15,
        color: COLORS.textPrimary, fontWeight: "500",
    },
    inputDisabled: { backgroundColor: COLORS.inputBg, color: COLORS.textMuted },

    chipRow: { marginBottom: 12 },
    chipRowContent: { paddingRight: 20 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
        backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border,
        marginRight: 8, marginBottom: 8,
    },
    chipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    chipText: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
    chipTextSelected: { color: COLORS.primary },
    chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    subLabel: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
    placeholderText: { fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic', padding: 10 },

    rowAlign: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    hintText: { fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", marginTop: 4 },

    budgetScroll: { paddingVertical: 4 },
    projectScroll: { marginBottom: 15 },
    projectCard: {
        padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
        marginRight: 12, width: 160, backgroundColor: COLORS.cardBg,
    },
    projectCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    projectText: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
    projectTextActive: { color: COLORS.primary },
    projectSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },

    googleSearchContainer: { zIndex: 100, marginBottom: 10 },

    footer: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: 20, backgroundColor: COLORS.cardBg,
        borderTopWidth: 1, borderTopColor: COLORS.border,
        flexDirection: "row", gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    nextBtn: {
        flex: 1, backgroundColor: COLORS.primary, height: 56,
        borderRadius: 16, justifyContent: "center", alignItems: "center",
        flexDirection: "row",
    },
    nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    prevBtn: {
        width: 100, backgroundColor: COLORS.inputBg, height: 56,
        borderRadius: 16, justifyContent: "center", alignItems: "center",
    },
    prevBtnText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: "700" },
    saveBtn: {
        flex: 1, backgroundColor: "#10B981", height: 56,
        borderRadius: 16, justifyContent: "center", alignItems: "center",
        flexDirection: "row",
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    disabledBtn: { backgroundColor: COLORS.textMuted },

    warningBox: {
        backgroundColor: "#FFFBEB", padding: 14, borderRadius: 12,
        borderLeftWidth: 4, borderLeftColor: "#F59E0B", marginBottom: 20,
    },
    errorBox: { backgroundColor: "#FEF2F2", borderLeftColor: COLORS.error },
    warningTitle: { fontSize: 14, fontWeight: "700", color: "#92400E", marginBottom: 8 },
    dupItem: { fontSize: 13, color: COLORS.textPrimary, marginBottom: 4 },
});
