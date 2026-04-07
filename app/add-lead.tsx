import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Switch, Modal, FlatList, SafeAreaView, Platform,
    Animated, Pressable
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import GooglePlacesAutocomplete from "@/components/GooglePlacesAutocompleteFixed";
import { getTeams, getTeamMembers } from "@/services/teams.service";
import { getContactById } from "@/services/contacts.service";
import { getLeadById, addLead, updateLead, checkDuplicates } from "@/services/leads.service";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import { useProjects } from "@/context/ProjectContext";
import { useTheme, SPACING } from "@/context/ThemeContext";

const LEAD_LOOKUP_TYPES = [
    "Requirement", "Category", "SubCategory", "UnitType",
    "Budget", "Facing", "Direction", "Status", "Stage", "Campaign",
    "Sub Campaign", "Source", "SubSource", "Title"
];

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
const FORM_STEPS = ["Requirement", "Location", "Contact", "System"];

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
    value, onChangeText, placeholder, keyboardType, multiline, numberOfLines, editable = true, label, icon, required, autoCapitalize
}: {
    value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean; numberOfLines?: number; editable?: boolean; label?: string; icon?: string; required?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters";
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
            {label && (
                <Animated.Text style={labelStyle}>
                    {label}{required && <Text style={{ color: theme.error }}> *</Text>}
                </Animated.Text>
            )}
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
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, delay, useNativeDriver: true }),
        ]).start();
    }, [delay]);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {children}
        </Animated.View>
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

export default function AddLead() {
    const { theme } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { getLookupValue, getLookupsByType, propertyConfig, leadMasterFields, refreshLookups, loading: loadingLookups } = useLookup();
    const { users, teams, loading: loadingUsers, findUser } = useUsers();
    const { projects, loading: loadingProjects } = useProjects();

    const { 
        id, refContact, prefill, 
        location: pfLocation, price: pfPrice, size: pfSize, 
        unitNo: pfUnitNo, mobile: pfMobile, name: pfName, type: pfType 
    } = params as any; // Cast params to any to match previous usage

    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const shakeAnim = useRef(new Animated.Value(0)).current;
    const googlePlacesRef = useRef<any>(null);

    const [formData, setFormData] = useState<any>({
        salutation: "Mr.", firstName: "", lastName: "", mobile: "", email: "",
        requirement: "Buy", purpose: "End Use", nri: false,
        propertyType: [], subType: [], unitType: [],
        budget: "", budgetMin: "", budgetMax: "", areaMin: "", areaMax: "", areaMetric: "Sq Yard",
        facing: [], roadWidth: [], direction: [],
        funding: "", timeline: "", furnishing: "", transactionType: "",
        searchLocation: "", locCity: "", locArea: "", locPinCode: "", locRange: 5,
        projectName: [], projectTowers: [], propertyNo: "", propertyNoEnd: "", unitSelectionMode: "Single",
        sizeLabel: "", inventoryId: "",
        status: "", source: "", subSource: "", campaign: "", subCampaign: "",
        owner: "", team: "", visibleTo: "Everyone", stage: "", description: "", tags: [],
    });

    const [units, setUnits] = useState<any[]>([]);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<'unit' | null>(null);

    const allowedSubCategoryNames = useMemo(() => {
        if (!propertyConfig || formData.propertyType.length === 0) return [];
        const selectedCategoryNames = formData.propertyType.map((id: string) => getLookupValue("Category", id));
        let names: string[] = [];
        selectedCategoryNames.forEach((catName: string) => {
            const catKey = Object.keys(propertyConfig).find(k => k === catName || catName.includes(k) || k.includes(catName));
            const catConfig = propertyConfig[catKey || catName];
            if (catConfig?.subCategories) {
                catConfig.subCategories.forEach((sc: any) => names.push(sc.name));
            }
        });
        return names;
    }, [propertyConfig, formData.propertyType]);

function SearchableDropdown({
    visible, onClose, options, onSelect, placeholder
}: {
    visible: boolean; onClose: () => void; options: { label: string, value: string }[]; onSelect: (v: string) => void; placeholder: string;
}) {
    const { theme } = useTheme();
    const [search, setSearch] = useState("");
    const filtered = (options || []).filter(o =>
        o?.label?.toString().toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{placeholder}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={26} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={[styles.modalSearchInput, { backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                        placeholder="Search units..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor={theme.textMuted}
                    />
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, idx) => `${item.value}-${idx}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={[styles.modalListItem, { borderBottomColor: theme.border }]} onPress={() => { onSelect(item.value); onClose(); }}>
                                <Text style={[styles.modalListItemText, { color: theme.textPrimary }]}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            </View>
        </Modal>
    );
}

    // ─── Inventory Logic (Senior Professional) ──────────────────────────────────
    useEffect(() => {
        const fetchUnits = async () => {
            // Only fetch if exactly one project is selected for clarity
            if (formData.projectName.length !== 1) {
                setUnits([]);
                return;
            }
            
            setIsLoadingUnits(true);
            try {
                const projName = formData.projectName[0];
                const params = new URLSearchParams();
                params.append('area', projName);
                
                // If specific tower/block is selected
                if (formData.projectTowers.length > 0) {
                    const blockKey = formData.projectTowers[0]; // Take first selected block for unit lookup
                    const blockName = blockKey.split('-').pop(); // Handle "Project-Block" format
                    if (blockName) params.append('location', blockName);
                }

                const response = await api.get(`/inventory?${params.toString()}`);
                if (response.data && response.data.success) {
                    setUnits(response.data.records || response.data.data || []);
                }
            } catch (error) {
                console.error("Error fetching units for Lead:", error);
            } finally {
                setIsLoadingUnits(false);
            }
        };
        fetchUnits();
    }, [formData.projectName, formData.projectTowers]);

    const handleUnitSelect = (unit: any) => {
        setFormData({
            ...formData,
            propertyNo: unit.unitNo || unit.unitNumber,
            inventoryId: unit._id,
            sizeLabel: unit.sizeLabel || `${unit.size} ${unit.sizeUnit}`,
            // Auto-fill requirement area if it's empty
            areaMin: formData.areaMin || String(unit.size || ""),
            areaMax: formData.areaMax || String(unit.size || ""),
            areaMetric: unit.sizeUnit || formData.areaMetric
        });
    };

    const allowedUnitTypeNames = useMemo(() => {
        if (!propertyConfig || formData.subType.length === 0) return [];
        const selectedSubCategoryNames = formData.subType.map((id: string) => getLookupValue("SubCategory", id));
        let names: string[] = [];
        Object.values(propertyConfig).forEach((catConfig: any) => {
            if (catConfig?.subCategories) {
                catConfig.subCategories.forEach((sc: any) => {
                    const isMatch = selectedSubCategoryNames.some((sn: string) => 
                        sn === sc.name || 
                        sn.startsWith(sc.name + " ") || 
                        sn.includes(sc.name) // fallback for messy data
                    );
                    if (isMatch && sc.types) {
                        sc.types.forEach((t: any) => names.push(t.name));
                    }
                });
            }
        });
        return [...new Set(names)];
    }, [propertyConfig, formData.subType, getLookupValue]);

    // Helper to resolve any value (ID or Name) to a name for UI consistency
    const resolveToName = useCallback((type: string, val: any) => {
        if (!val) return "";
        return getLookupValue(type, val);
    }, [getLookupValue]);

    const [duplicates, setDuplicates] = useState<any[]>([]);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const results = await Promise.all([
                    id ? getLeadById(id) : Promise.resolve(null),
                    refContact ? getContactById(refContact) : Promise.resolve(null),
                ]);

                const existingLead = results[0]?.data || results[0];
                const existingContact = results[1]?.data || results[1];

                if (existingLead) {
                    const l = existingLead;
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
                        locRange: l.locRange || 5,
                        projectName: Array.isArray(l.projectName) ? l.projectName.map((v: any) => v._id || v) : (l.projectName ? [l.projectName._id || l.projectName] : []),
                        projectTowers: l.locBlock || [],
                        propertyNo: l.propertyNo || "",
                        propertyNoEnd: l.propertyNoEnd || "",
                        unitSelectionMode: l.unitSelectionMode || "Single",
                        status: l.status?.lookup_value || l.status || "",
                        source: l.source?.lookup_value || l.source || "",
                        subSource: l.subSource?.lookup_value || l.subSource || "",
                        campaign: l.campaign?.lookup_value || l.campaign || "",
                        subCampaign: l.subCampaign?.lookup_value || l.subCampaign || "",
                        owner: l.assignment?.assignedTo?._id || l.assignment?.assignedTo || "",
                        team: l.assignment?.team?.[0] || "",
                        visibleTo: l.assignment?.visibleTo || "Everyone",
                        stage: l.stage?.lookup_value || l.stage || "",
                        description: l.description || "",
                        tags: l.tags || [],
                    });
                } else if (existingContact) {
                    const c = existingContact;
                    setFormData((prev: any) => ({
                        ...prev,
                        firstName: c.firstName || "",
                        lastName: c.lastName || "",
                        mobile: (c.phones && c.phones[0]?.number) || c.mobile || "",
                        email: (c.emails && c.emails[0]?.address) || c.email || "",
                    }));
                }

                if (!id && prefill === 'true') {
                    setFormData((prev: any) => ({
                        ...prev,
                        firstName: pfName ? pfName.split(' ')[0] : prev.firstName,
                        lastName: pfName ? pfName.split(' ').slice(1).join(' ') : prev.lastName,
                        mobile: pfMobile || prev.mobile,
                        searchLocation: pfLocation || prev.searchLocation,
                        propertyNo: pfUnitNo || prev.propertyNo,
                        areaMin: pfSize || prev.areaMin,
                        budgetMin: pfPrice || prev.budgetMin,
                        requirement: pfType === 'Rent' ? 'Rent' : (pfType === 'Lease' ? 'Lease' : 'Buy'),
                        description: `Intake From Web: ${pfName || 'Unknown'} - ${pfMobile || ''}`
                    }));
                }
            } catch (error) {
                console.error("Failed to load initial data:", error);
                Alert.alert("Error", "Failed to load some form data. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [id, refContact, prefill]);

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

    const triggerShake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    const handleNext = () => {
        if (step === 2 && (!formData.firstName || !formData.mobile)) {
            triggerShake();
            Alert.alert("Required Fields", "First Name and Mobile are mandatory.");
            return;
        }
        setStep(s => Math.min(s + 1, FORM_STEPS.length - 1));
    };

    const handleSave = async () => {
        if (!formData.firstName || !formData.mobile) {
            Alert.alert("Required", "First Name and Mobile are mandatory.");
            return;
        }
        if (isBlocked && !id) {
            Alert.alert("Duplicate Blocked", "This record matches an existing entry and cannot be saved.");
            return;
        }

        setIsSaving(true);
        try {
            const getLookupId = (type: string, val: string) => {
                const list = getLookupsByType(type);
                if (!Array.isArray(list)) return val;
                return list.find((l: any) => l.lookup_value === val)?._id || val;
            };

            const payload = {
                ...formData,
                requirement: getLookupId("Requirement", formData.requirement),
                status: getLookupId("LeadStatus", formData.status),
                stage: getLookupId("LeadStage", formData.stage),
                source: getLookupId("Source", formData.source),
                subSource: getLookupId("SubSource", formData.subSource),
                campaign: getLookupId("Campaign", formData.campaign),
                subCampaign: getLookupId("SubCampaign", formData.subCampaign),
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
                throw new Error(res.message || "Save failed");
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to save lead.");
        } finally {
            setIsSaving(false);
        }
    };

    const renderMultiSelect = (type: string, field: string, allowedNames?: string[]) => {
        let options: { label: string, value: string }[] = [];
        if (type === "UnitType" && allowedNames && allowedNames.length > 0) {
            // Special handling for UnitType to match what's in Settings > Configuration exactly
            options = allowedNames.map(name => ({ label: name, value: name }));
        } else {
            const list = getLookupsByType(type);
            options = (list || []).map(l => ({ label: l.lookup_value, value: l._id }));
            
            if (allowedNames && allowedNames.length > 0) {
                options = options.filter(opt => 
                    allowedNames.some(name => 
                        opt.label === name || 
                        opt.label.startsWith(name + " ") || 
                        opt.label.startsWith(name + "(")
                    )
                );
            }
        }

        // For UnitType, we need to ensure values in formData (which might be IDs) 
        // match the labels in options (which are clean names from config)
        const currentValues = (formData[field] || []).map((val: any) => 
            type === "UnitType" ? resolveToName(type, val) : val
        );

        return (
            <MultiSelectButton
                values={currentValues}
                options={options}
                onToggle={(val) => {
                    const current = currentValues;
                    const newList = current.includes(val) ? current.filter((i: string) => i !== val) : [...current, val];
                    
                    // Note: Since we are using names as values for UnitType, the newList array 
                    // will contain strings like ["1 Kanal"]. The backend resolveLeadLookup handles these.
                    
                    let nextFormData = { ...formData, [field]: newList };
                    
                    if (field === 'propertyType') {
                        const nextAllowedSub: string[] = newList.length === 0 ? [] : newList.flatMap((id: string) => {
                            const catName = getLookupValue("Category", id);
                            const catKey = Object.keys(propertyConfig || {}).find(k => k === catName || catName.includes(k) || k.includes(catName));
                            return (propertyConfig?.[catKey || catName]?.subCategories || []).map((sc: any) => sc.name);
                        });
                        nextFormData.subType = nextFormData.subType.filter((id: string) => 
                            nextAllowedSub.some(asn => {
                                const val = getLookupValue("SubCategory", id);
                                return val === asn || val.startsWith(asn + " ") || val.includes(asn);
                            })
                        );
                        
                        // Also trigger unitType reset based on the new subType
                        const nextAllowedUnit: string[] = nextFormData.subType.length === 0 ? [] : nextFormData.subType.flatMap((id: string) => {
                            const subName = getLookupValue("SubCategory", id);
                            let names: string[] = [];
                            Object.values(propertyConfig || {}).forEach((catConfig: any) => {
                                (catConfig?.subCategories || []).forEach((sc: any) => {
                                    if (sc.name === subName || subName.startsWith(sc.name + " ") || subName.includes(sc.name)) {
                                        (sc.types || []).forEach((t: any) => names.push(t.name));
                                    }
                                });
                            });
                            return names;
                        });
                        nextFormData.unitType = nextFormData.unitType.filter((id: string) => 
                            nextAllowedUnit.some(aun => {
                                const val = getLookupValue("UnitType", id);
                                return val === aun || val.startsWith(aun + " ") || val.includes(aun);
                            })
                        );
                    } else if (field === 'subType') {
                        const nextAllowedUnit: string[] = newList.length === 0 ? [] : newList.flatMap((id: string) => {
                            const subName = getLookupValue("SubCategory", id);
                            let names: string[] = [];
                            Object.values(propertyConfig || {}).forEach((catConfig: any) => {
                                (catConfig?.subCategories || []).forEach((sc: any) => {
                                    if (sc.name === subName || subName.startsWith(sc.name + " ") || subName.includes(sc.name)) {
                                        (sc.types || []).forEach((t: any) => names.push(t.name));
                                    }
                                });
                            });
                            return names;
                        });
                        nextFormData.unitType = nextFormData.unitType.filter((id: string) => 
                            nextAllowedUnit.some(aun => {
                                const val = getLookupValue("UnitType", id);
                                return val === aun || val.startsWith(aun + " ") || val.includes(aun);
                            })
                        );
                    }

                    setFormData(nextFormData);
                }}
            />
        );
    };

    const renderSingleSelect = (lookupType: string, field: keyof typeof formData, parentId?: string) => {
        const options = getLookupsByType(lookupType)
            .filter(l => !parentId || l.parent_id === parentId || (l as any).parent_lookup_id === parentId)
            .map(l => ({ label: l.lookup_value, value: l._id }));
        return <SelectButton value={formData[field]} options={options} onSelect={(val) => setFormData({ ...formData, [field]: val })} />;
    };

    const renderLeadMasterSelect = (masterKey: string, field: keyof typeof formData) => {
        if (!leadMasterFields || !leadMasterFields[masterKey]) return renderSingleSelect(masterKey.slice(0, -1), field);
        const options = leadMasterFields[masterKey].map((val: string) => ({ label: val, value: val }));
        return <SelectButton value={formData[field]} options={options} onSelect={(val) => setFormData({ ...formData, [field]: val })} />;
    };

    const renderDependentMultiSelect = (type: string, field: string, parentIds: string[]) => {
        let list = getLookupsByType(type);
        if (!Array.isArray(list) || !parentIds || parentIds.length === 0) return <Text style={{ color: theme.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 }}>Select parent field first</Text>;
        
        const pIds = parentIds.map(id => String(id));
        const filtered = list.filter(item => pIds.includes(String(item.parent_id)));
        
        if (filtered.length === 0) return <Text style={{ color: theme.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 }}>No options available</Text>;
        const options = filtered.map(l => ({ label: l.lookup_value, value: l._id }));
        return (
            <MultiSelectButton
                values={formData[field]}
                options={options}
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
                        <SectionHeader title="Requirement" icon="📋" subtitle="Property needs and budget" />
                        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            <Field label="Type" required>
                                <SelectButton value={formData.requirement} options={["Buy", "Rent", "Lease"].map(r => ({ label: r, value: r }))} onSelect={(v) => setFormData({ ...formData, requirement: v })} />
                            </Field>
                            <Field label="Category">{renderMultiSelect("Category", "propertyType")}</Field>
                            <Field label="Sub Category">
                                {formData.propertyType.length > 0 
                                    ? renderMultiSelect("SubCategory", "subType", allowedSubCategoryNames)
                                    : <Text style={{ color: theme.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 }}>Select Category first</Text>
                                }
                            </Field>
                            <Field label="Size Type">
                                {formData.subType.length > 0
                                    ? renderMultiSelect("UnitType", "unitType", allowedUnitTypeNames)
                                    : <Text style={{ color: theme.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 }}>Select Sub Category first</Text>
                                }
                            </Field>
                            <Field label="Budget Range (Min - Max)">
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.budgetScroll}>
                                    {BUDGET_VALUES.map((opt) => (
                                        <PressableChip key={`min-${opt.value}`} label={opt.label} isSelected={formData.budgetMin === String(opt.value)} onSelect={() => setFormData({ ...formData, budgetMin: String(opt.value) })} />
                                    ))}
                                </ScrollView>
                                <View style={{ marginTop: 12 }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.budgetScroll}>
                                        {BUDGET_VALUES.filter(opt => !formData.budgetMin || opt.value > Number(formData.budgetMin)).map((opt) => (
                                            <PressableChip key={`max-${opt.value}`} label={opt.label} isSelected={formData.budgetMax === String(opt.value)} onSelect={() => setFormData({ ...formData, budgetMax: String(opt.value) })} />
                                        ))}
                                    </ScrollView>
                                </View>
                            </Field>
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}><Field label="Min Area"><Input value={formData.areaMin} onChangeText={v => setFormData({ ...formData, areaMin: v })} placeholder="Min" keyboardType="numeric" /></Field></View>
                                <View style={{ flex: 1 }}><Field label="Max Area"><Input value={formData.areaMax} onChangeText={v => setFormData({ ...formData, areaMax: v })} placeholder="Max" keyboardType="numeric" /></Field></View>
                            </View>
                            <Field label="Funding">
                                <SelectButton value={formData.funding} options={(leadMasterFields?.fundingTypes || ["Home Loan", "Self Funding"]).map((v: string) => ({ label: v, value: v }))} onSelect={(v) => setFormData({ ...formData, funding: v })} />
                            </Field>
                            <Field label="Timeline">
                                <SelectButton value={formData.timeline} options={(leadMasterFields?.timelines || ["Immediate", "3 Months"]).map((v: string) => ({ label: v, value: v }))} onSelect={(v) => setFormData({ ...formData, timeline: v })} />
                            </Field>
                            <Field label="Furnishing">
                                <SelectButton value={formData.furnishing} options={(leadMasterFields?.furnishingStatuses || ["Unfurnished", "Semi-Furnished"]).map((v: string) => ({ label: v, value: v }))} onSelect={(v) => setFormData({ ...formData, furnishing: v })} />
                            </Field>
                            <Field label="Transaction Type">
                                <SelectButton value={formData.transactionType} options={(leadMasterFields?.transactionTypes || ["Collector Rate", "Full White"]).map((v: string) => ({ label: v, value: v }))} onSelect={(v) => setFormData({ ...formData, transactionType: v })} />
                            </Field>
                            <Field label="Facing">{renderMultiSelect("Facing", "facing")}</Field>
                            <Field label="Direction">{renderMultiSelect("Direction", "direction")}</Field>
                            <Field label="Purpose"><SelectButton value={formData.purpose} options={["End Use", "Investment"].map(v => ({ label: v, value: v }))} onSelect={(v) => setFormData({ ...formData, purpose: v })} /></Field>
                            <View style={[styles.rowAlign, { paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 10 }]}>
                                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 0 }]}>NRI Status</Text>
                                <Switch value={formData.nri} onValueChange={v => setFormData({ ...formData, nri: v })} trackColor={{ true: theme.primary + '40', false: theme.border }} thumbColor={formData.nri ? theme.primary : theme.textMuted} />
                            </View>
                        </View>
                    </FadeInView>
                );
            case 1: // Location
                return (
                    <FadeInView key="step1">
                        <SectionHeader title="Location & Project" icon="📍" subtitle="Preferred areas and developments" />
                        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            <Field label="Search Location">
                                <View style={styles.googleSearchContainer}>
                                    <GooglePlacesAutocomplete
                                        ref={googlePlacesRef}
                                        placeholder="Area, sector or city..."
                                        minLength={2}
                                        debounce={400}
                                        disableScroll={true}
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
                                        onFail={(error: any) => console.error("GooglePlaces Error:", error)}
                                        query={{ 
                                            key: GOOGLE_API_KEY, 
                                            language: "en", 
                                            components: "country:in",
                                            types: "geocode" 
                                        }}
                                        styles={{
                                            textInput: [styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg, borderRadius: 12, borderWidth: 1, borderColor: theme.border }],
                                            container: { flex: 0 },
                                            listView: { 
                                                position: 'absolute', 
                                                top: 50, 
                                                left: 0, 
                                                right: 0, 
                                                backgroundColor: theme.cardBg, 
                                                borderRadius: 12, 
                                                marginTop: 5, 
                                                elevation: 5, 
                                                zIndex: 1000, 
                                                borderWidth: 1, 
                                                borderColor: theme.border 
                                            }
                                        }}
                                        fetchDetails={true}
                                        enablePoweredByContainer={false}
                                        textInputProps={{ placeholderTextColor: theme.textMuted }}
                                    />
                                </View>
                            </Field>
                            <Field label={`Range (${formData.locRange} km)`}>
                                <SelectButton value={String(formData.locRange)} options={[1, 5, 10, 25, 50, 100].map(r => ({ label: `${r === 100 ? "100+" : r}km`, value: String(r) }))} onSelect={(v) => setFormData({ ...formData, locRange: Number(v) })} />
                            </Field>
                            <Field label="Shortlisted Projects">
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectScroll}>
                                    {Array.isArray(projects) && projects.map((p) => {
                                        const active = formData.projectName.includes(p.name);
                                        return (
                                            <TouchableOpacity key={p._id} style={[styles.projectCard, { borderColor: theme.border, backgroundColor: theme.cardBg }, active && { borderColor: theme.primary, backgroundColor: theme.primary + '08' }]} onPress={() => {
                                                const newList = active ? formData.projectName.filter((n: string) => n !== p.name) : [...formData.projectName, p.name];
                                                setFormData({ ...formData, projectName: newList });
                                            }}>
                                                <Text style={[styles.projectText, { color: theme.textPrimary }, active && { color: theme.primary }]}>{p.name}</Text>
                                                <Text style={[styles.projectSub, { color: theme.textSecondary }]}>{p.address?.city || "Unknown City"}</Text>
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
                                                .flatMap(p => (p.blocks || []).map((b: any) => ({ projectName: p.name, block: typeof b === 'string' ? b : b.name })))
                                                .map((item, idx) => {
                                                    const key = `${item.projectName}-${item.block}`;
                                                    const active = formData.projectTowers.includes(key);
                                                    return <PressableChip key={`${idx}-${item.block}`} label={`${item.block} (${item.projectName})`} isSelected={active} onSelect={() => setFormData({ ...formData, projectTowers: active ? formData.projectTowers.filter((t: string) => t !== key) : [...formData.projectTowers, key] })} />;
                                                })
                                            }
                                        </View>
                                    </Field>
                                    <Field label="Selection Mode"><SelectButton value={formData.unitSelectionMode} options={["Single", "Multiple", "Range"].map(m => ({ label: m, value: m }))} onSelect={(v) => setFormData({ ...formData, unitSelectionMode: v })} /></Field>
                                    
                                    <Field label="Unit Details">
                                        <View style={styles.row}>
                                            {formData.unitSelectionMode === "Range" ? (
                                                <>
                                                    <View style={{ flex: 1 }}><Input label="Start" value={formData.propertyNo} onChangeText={v => setFormData({ ...formData, propertyNo: v })} placeholder="e.g. 1" /></View>
                                                    <View style={{ flex: 1 }}><Input label="End" value={formData.propertyNoEnd} onChangeText={v => setFormData({ ...formData, propertyNoEnd: v })} placeholder="e.g. 10" /></View>
                                                </>
                                            ) : (
                                                formData.unitSelectionMode === "Single" ? (
                                                    <TouchableOpacity 
                                                        style={[styles.inputWrapper, { flex: 1, backgroundColor: theme.inputBg, borderColor: theme.border, paddingHorizontal: 16, justifyContent: 'center' }]} 
                                                        onPress={() => setActiveDropdown('unit')}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Text style={{ color: formData.propertyNo ? theme.textPrimary : theme.textMuted, fontSize: 16, fontWeight: '600' }}>
                                                                {formData.propertyNo || "Select Unit"}
                                                            </Text>
                                                            <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                                                        </View>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <View style={{ flex: 1 }}><Input label={formData.unitSelectionMode === "Multiple" ? "Unit Nos (CSV)" : "Unit Number"} value={formData.propertyNo} onChangeText={v => setFormData({ ...formData, propertyNo: v })} placeholder={formData.unitSelectionMode === "Multiple" ? "101, 102..." : "e.g. 101"} /></View>
                                                )
                                            )}
                                        </View>
                                    </Field>

                                    {formData.sizeLabel ? (
                                        <FadeInView delay={100}>
                                            <View style={[styles.tagBox, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '30', borderStyle: 'dashed' }]}>
                                                <View style={styles.rowAlign}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <View style={[styles.smallIcon, { backgroundColor: theme.primary }]}>
                                                            <Ionicons name="expand" size={14} color="#fff" />
                                                        </View>
                                                        <View>
                                                            <Text style={[styles.tagLabel, { color: theme.textSecondary }]}>Inventory Size</Text>
                                                            <Text style={[styles.tagValue, { color: theme.primary }]}>{formData.sizeLabel}</Text>
                                                        </View>
                                                    </View>
                                                    {formData.unitSelectionMode === "Single" && (
                                                        <TouchableOpacity onPress={() => setFormData({ ...formData, propertyNo: "", sizeLabel: "", inventoryId: "" })}>
                                                            <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        </FadeInView>
                                    ) : (
                                        formData.unitSelectionMode === "Single" && (
                                            <Text style={{ fontSize: 12, color: theme.textMuted, marginLeft: 4, marginTop: -8, fontStyle: 'italic' }}>
                                                Select a unit to auto-fill requirement size
                                            </Text>
                                        )
                                    )}

                                    <SearchableDropdown
                                        visible={activeDropdown === 'unit'}
                                        onClose={() => setActiveDropdown(null)}
                                        placeholder="Select Unit Number"
                                        options={units.map(u => ({ 
                                            label: `${u.unitNo || u.unitNumber} (${u.sizeLabel || (u.size + ' ' + u.sizeUnit)})`, 
                                            value: u._id 
                                        }))}
                                        onSelect={(val) => {
                                            const unit = units.find(u => u._id === val);
                                            if (unit) handleUnitSelect(unit);
                                        }}
                                    />
                                </View>
                            )}
                        </View>
                    </FadeInView>
                );
            case 2: // Contact
                return (
                    <FadeInView key="step2">
                        <SectionHeader title="Contact Info" icon="👤" subtitle="Lead identity and communication" />
                        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            {Array.isArray(duplicates) && duplicates.length > 0 && (
                                <View style={[styles.warningBox, { backgroundColor: theme.primary + '08', borderLeftColor: theme.primary }, isBlocked && { backgroundColor: theme.error + '08', borderLeftColor: theme.error }]}>
                                    <Text style={[styles.warningTitle, { color: isBlocked ? theme.error : theme.primary }]}>⚠️ {duplicates.length} Similar record(s) found</Text>
                                    {duplicates.map((d, i) => (
                                        <Text key={i} style={[styles.dupItem, { color: theme.textPrimary }]}>{d.firstName} {d.lastName} ({d.mobile || (Array.isArray(d.phones) && d.phones[0]?.number)})</Text>
                                    ))}
                                </View>
                            )}
                            <View style={styles.row}>
                                <View style={{ width: 100 }}><Input label="Title" value={formData.salutation} onChangeText={v => setFormData({ ...formData, salutation: v })} /></View>
                                <View style={{ flex: 1 }}><Input label="First Name" required value={formData.firstName} onChangeText={v => setFormData({ ...formData, firstName: v })} /></View>
                            </View>
                            <Input label="Last Name" value={formData.lastName} onChangeText={v => setFormData({ ...formData, lastName: v })} />
                            <Input label="Mobile" required keyboardType="phone-pad" icon="call-outline" value={formData.mobile} onChangeText={v => setFormData({ ...formData, mobile: v })} />
                            <Input label="Email" autoCapitalize="none" keyboardType="email-address" icon="mail-outline" value={formData.email} onChangeText={v => setFormData({ ...formData, email: v })} />
                        </View>
                    </FadeInView>
                );
            case 3: // System
                return (
                    <FadeInView key="step3">
                        <SectionHeader title="System & Assignment" icon="⚙️" subtitle="Back-office routing and status" />
                        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>

                            <Field label="Campaign">
                                {leadMasterFields?.campaigns ? (
                                    <SelectButton
                                        value={formData.campaign}
                                        options={leadMasterFields.campaigns.map((c: any) => ({ label: c.name, value: c.name }))}
                                        onSelect={(val) => setFormData({ ...formData, campaign: val, source: "", subSource: "" })}
                                    />
                                ) : renderSingleSelect("Campaign", "campaign")}
                            </Field>

                            <Field label="Source">
                                {leadMasterFields?.campaigns && formData.campaign ? (
                                    <SelectButton
                                        value={formData.source}
                                        options={(leadMasterFields.campaigns.find((c: any) => c.name === formData.campaign)?.sources || []).map((s: any) => ({ label: s.name, value: s.name }))}
                                        onSelect={(val) => setFormData({ ...formData, source: val, subSource: "" })}
                                    />
                                ) : renderSingleSelect("Source", "source", formData.campaign)}
                            </Field>

                            <Field label="Sub Source">
                                {leadMasterFields?.campaigns && formData.campaign && formData.source ? (
                                    <SelectButton
                                        value={formData.subSource}
                                        options={(leadMasterFields.campaigns.find((c: any) => c.name === formData.campaign)?.sources.find((s: any) => s.name === formData.source)?.mediums || []).map((m: any) => ({ label: m, value: m }))}
                                        onSelect={(val) => setFormData({ ...formData, subSource: val })}
                                    />
                                ) : (formData.source ? renderSingleSelect("SubSource", "subSource", formData.source) : null)}
                            </Field>
                            <Field label="Assignment">
                                <Text style={[styles.subLabel, { color: theme.textSecondary }]}>Team</Text>
                                <SelectButton value={formData.team} options={teams.map(t => ({ label: t.name, value: t._id }))} onSelect={(v) => setFormData({ ...formData, team: v, owner: "" })} />
                                <Text style={[styles.subLabel, { color: theme.textSecondary, marginTop: 16 }]}>User</Text>
                                <SelectButton value={formData.owner} options={users.filter(u => !formData.team || u.team === formData.team).map(u => ({ label: u.fullName || u.name, value: u._id }))} onSelect={(v) => setFormData({ ...formData, owner: v })} />
                                <Text style={[styles.subLabel, { color: theme.textSecondary, marginTop: 16 }]}>Visibility</Text>
                                <SelectButton value={formData.visibleTo} options={[{ label: "Everyone", value: "Everyone" }, { label: "Team", value: "Team" }, { label: "Private", value: "Private" }]} onSelect={(v) => setFormData({ ...formData, visibleTo: v })} />
                            </Field>
                            <Input label="Internal Notes" multiline numberOfLines={4} value={formData.description} onChangeText={v => setFormData({ ...formData, description: v })} icon="create-outline" />
                        </View>
                    </FadeInView>
                );
            default: return null;
        }
    };

    // Remove blocking spinner for "Instant Open" experience

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/leads")} style={[styles.closeBtn, { backgroundColor: theme.inputBg }]} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                    <Ionicons name="close" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{id ? "Edit Lead" : "Add Lead"}</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{FORM_STEPS[step]}</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <View style={[styles.stepperContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
                {FORM_STEPS.map((s, i) => (
                    <View key={s} style={styles.stepWrapper}>
                        <View style={[styles.stepDot, { backgroundColor: theme.inputBg }, step >= i && { backgroundColor: theme.primary }]}>
                            {step > i ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={[styles.stepNumber, { color: theme.textSecondary }, step >= i && { color: "#fff" }]}>{i + 1}</Text>}
                        </View>
                        <Text style={[styles.stepLabel, { color: theme.textMuted }, step >= i && { color: theme.primary }]} numberOfLines={1}>{s}</Text>
                    </View>
                ))}
            </View>

            <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                    {renderStepContent()}
                </Animated.View>
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
                {step > 0 && <TouchableOpacity style={[styles.prevBtn, { backgroundColor: theme.inputBg }]} onPress={() => setStep(s => s - 1)}><Text style={[styles.prevBtnText, { color: theme.textSecondary }]}>Back</Text></TouchableOpacity>}
                {step < FORM_STEPS.length - 1 ? (
                    <TouchableOpacity style={[styles.nextBtn, { backgroundColor: theme.primary }]} onPress={handleNext}><Text style={styles.nextBtnText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} /></TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.success }, (isSaving || (isBlocked && !id)) && styles.disabledBtn]} onPress={handleSave} disabled={isSaving || (isBlocked && !id)}>
                        {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <><Text style={styles.saveBtnText}>{id ? "Update Lead" : "Create Lead"}</Text><Ionicons name="cloud-upload" size={18} color="#fff" style={{ marginLeft: 8 }} /></>}
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 10 : 40, paddingBottom: 16, borderBottomWidth: 1, zIndex: 10 },
    closeBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
    headerTitleContainer: { alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "800" },
    headerSubtitle: { fontSize: 11, fontWeight: "700", marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
    stepperContainer: { flexDirection: "row", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
    stepWrapper: { alignItems: "center", flex: 1 },
    stepDot: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", marginBottom: 6 },
    stepNumber: { fontSize: 13, fontWeight: "800" },
    stepLabel: { fontSize: 10, fontWeight: "700" },
    mainScroll: { flex: 1 },
    scrollContent: { padding: SPACING.outer, paddingBottom: 120 },
    card: { borderRadius: 24, padding: SPACING.card, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
    sectionHeader: { marginBottom: 20, marginTop: 10 },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    sectionIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    sectionIconText: { fontSize: 20 },
    sectionTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
    sectionSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
    sectionSeparator: { height: 1, marginTop: 16, opacity: 0.5 },
    field: { marginBottom: SPACING.field },
    fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginLeft: 4 },
    inputWrapper: { position: 'relative', height: SPACING.inputHeight, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' },
    inputInner: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 16 },
    inputIcon: { marginRight: 12 },
    input: { fontSize: 16, height: '100%', fontWeight: '600', flex: 1 },
    chipRow: { marginBottom: 12 },
    chipRowContent: { paddingRight: 20 },
    selectableChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, marginRight: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    selectableChipText: { fontSize: 14, fontWeight: "600" },
    chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    subLabel: { fontSize: 12, fontWeight: "700", marginLeft: 4 },
    row: { flexDirection: "row", alignItems: "center", gap: 16 },
    rowAlign: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    budgetScroll: { paddingVertical: 4 },
    projectScroll: { marginBottom: 15 },
    projectCard: { padding: 16, borderRadius: 20, borderWidth: 1.5, marginRight: 12, width: 170 },
    projectText: { fontSize: 15, fontWeight: "800" },
    projectSub: { fontSize: 12, marginTop: 4, fontWeight: '500' },
    googleSearchContainer: { zIndex: 100, marginBottom: 10 },
    footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, borderTopWidth: 1, flexDirection: "row", gap: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
    nextBtn: { flex: 1, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center", flexDirection: "row", elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    prevBtn: { width: 100, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: 'transparent' },
    prevBtnText: { fontSize: 16, fontWeight: "700" },
    saveBtn: { flex: 1, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center", flexDirection: "row", elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    disabledBtn: { opacity: 0.6 },
    warningBox: { padding: 16, borderRadius: 16, borderLeftWidth: 5, marginBottom: 20 },
    warningTitle: { fontSize: 15, fontWeight: "800", marginBottom: 8 },
    dupItem: { fontSize: 13, marginBottom: 4, fontWeight: '500' },
    helperText: { fontSize: 11, marginTop: 4, marginLeft: 4 },
    textMuted: { opacity: 0.6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '75%', padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
    modalSearchInput: { borderRadius: 16, padding: 16, fontSize: 16, fontWeight: '600', marginBottom: 16 },
    modalListItem: { paddingVertical: 18, borderBottomWidth: 1 },
    modalListItemText: { fontSize: 17, fontWeight: '600' },
    tagBox: { padding: 16, borderRadius: 20, borderWidth: 1, marginTop: 12 },
    tagLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    tagValue: { fontSize: 15, fontWeight: '800' },
    smallIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
