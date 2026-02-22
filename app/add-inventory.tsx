import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
    Modal, FlatList, Animated, Pressable
} from "react-native";
import { useRouter } from "expo-router";
import api from "./services/api";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

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

const FORM_STEPS = ["Basic Info", "Builtup & Specs", "Status & Furnishing", "Location & Ownership"];

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
    value, onChangeText, placeholder, keyboardType, multiline, numberOfLines, editable = true, label,
}: {
    value: string; onChangeText: (t: string) => void; placeholder?: string;
    keyboardType?: any; multiline?: boolean; numberOfLines?: number; editable?: boolean; label?: string;
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
        left: 16,
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
        <View style={[styles.inputContainer, multiline && { height: 'auto' }]}>
            {label && <Animated.Text style={labelStyle}>{label}</Animated.Text>}
            <TextInput
                style={[
                    styles.input,
                    multiline && { height: 100, textAlignVertical: "top", paddingTop: 12 },
                    isFocused && styles.inputFocused,
                    !editable && styles.inputDisabled
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

function SelectButton({
    value, placeholder, options, onSelect,
}: {
    value: string; placeholder: string; options: { label: string, value: string }[]; onSelect: (v: string) => void;
}) {
    if (options.length === 0) return <Text style={styles.placeholderText}>{placeholder}</Text>;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {options.map((opt, idx) => {
                const isSelected = value === opt.value;
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
                        key={`${opt.value || idx}-${idx}`}
                        onPressIn={onPressIn}
                        onPressOut={onPressOut}
                        onPress={() => onSelect(opt.value === value ? "" : opt.value)}
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
            })}
        </ScrollView>
    );
}

// ─── Searchable Dropdown ──────────────────────────────────────────────────────

function SearchableDropdown({
    visible, onClose, options, onSelect, placeholder
}: {
    visible: boolean; onClose: () => void; options: { label: string, value: string }[]; onSelect: (v: string) => void; placeholder: string;
}) {
    const [search, setSearch] = useState("");
    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

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

interface BuiltupRow {
    floor: string;
    cluster: string;
    length: string;
    width: string;
    totalArea: string;
}

interface OwnerLink {
    id: string;
    name: string;
    mobile: string;
    role: string;
    relationship: string;
}

interface InventoryForm {
    // Basic Unit Details
    category: string;
    subCategory: string;
    unitNo: string;
    unitType: string;
    projectName: string;
    projectId: string;
    block: string;
    size: string;
    direction: string;
    facing: string;
    roadWidth: string;
    ownership: string;

    // Builtup Details
    builtupDetail: string;
    builtupType: string;
    builtupDetails: BuiltupRow[];

    // Furnishing & Dates
    occupationDate: string;
    ageOfConstruction: string;
    possessionStatus: string;
    furnishType: string;
    furnishedItems: string;

    // Location
    locationSearch: string;
    address: {
        country: string;
        state: string;
        city: string;
        location: string;
        tehsil: string;
        postOffice: string;
        pinCode: string;
        hNo: string;
        street: string;
        area: string;
    };

    // Owners
    owners: OwnerLink[];
    userId?: string;
    assignment?: string;

    // System Assignment
    assignedTo: string;
    team: string;
    status: string;
    intent: string;
    visibleTo: string;
}

const INITIAL: InventoryForm = {
    category: "Residential", subCategory: "", unitNo: "", unitType: "",
    projectName: "", projectId: "", block: "", size: "",
    direction: "", facing: "", roadWidth: "", ownership: "",
    builtupDetail: "", builtupType: "",
    builtupDetails: [{ floor: "Ground Floor", cluster: "", length: "", width: "", totalArea: "" }],
    occupationDate: "", ageOfConstruction: "", possessionStatus: "", furnishType: "", furnishedItems: "",
    locationSearch: "",
    address: { country: "", state: "", city: "", location: "", tehsil: "", postOffice: "", pinCode: "", hNo: "", street: "", area: "" },
    owners: [],
    assignedTo: "", team: "", status: "Active", intent: "Sell", visibleTo: "Everyone",
};

export default function AddInventoryScreen() {
    const router = useRouter();
    const [form, setForm] = useState<InventoryForm>(INITIAL);
    const [saving, setSaving] = useState(false);
    const [projectModalVisible, setProjectModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [step, setStep] = useState(0);
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const triggerShake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    // Master Data States
    const [propertyConfig, setPropertyConfig] = useState<any>({});
    const [masterFields, setMasterFields] = useState<any>({});
    const [projects, setProjects] = useState<any[]>([]);

    const [teams, setTeams] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Owner Search State
    const [ownerSearch, setOwnerSearch] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState<any>(null);
    const [linkData, setLinkData] = useState({ role: "Property Owner", relationship: "" });

    // Location Lookup States
    const [countries, setCountries] = useState<any[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [tehsils, setTehsils] = useState<any[]>([]);
    const [postOffices, setPostOffices] = useState<any[]>([]);

    const [activeLocDropdown, setActiveLocDropdown] = useState<string | null>(null);
    const [builtupDetailLookups, setBuiltupDetailLookups] = useState<any[]>([]);
    const [btLookups, setBtLookups] = useState<any[]>([]);

    const set = (key: keyof InventoryForm) => (val: any) =>
        setForm((f) => ({ ...f, [key]: val }));

    const setAddress = (key: keyof InventoryForm['address']) => (val: string) => {
        setForm(f => {
            const newAddr = { ...f.address, [key]: val };
            // Cascading resets
            if (key === 'country') { newAddr.state = ""; newAddr.city = ""; newAddr.location = ""; newAddr.tehsil = ""; newAddr.postOffice = ""; newAddr.pinCode = ""; }
            if (key === 'state') { newAddr.city = ""; newAddr.location = ""; newAddr.tehsil = ""; newAddr.postOffice = ""; newAddr.pinCode = ""; }
            if (key === 'city') { newAddr.location = ""; newAddr.tehsil = ""; newAddr.postOffice = ""; newAddr.pinCode = ""; }
            if (key === 'location') { newAddr.postOffice = ""; newAddr.pinCode = ""; }
            return { ...f, address: newAddr };
        });
    };

    // ─── Location Data Fetching Effects ──────────────────────────────────────────
    const fetchLocLookup = async (lookup_type: string, parent_id: string | null = null) => {
        try {
            const params: any = { lookup_type, limit: 1000 };
            if (parent_id) params.parent_lookup_id = parent_id;

            const res = await api.get("/lookups", { params });
            return res.data?.data || [];
        } catch (error) {
            console.error(`Fetch error for ${lookup_type}:`, error);
            return [];
        }
    };

    useEffect(() => { fetchLocLookup("Country").then(setCountries); }, []);

    useEffect(() => {
        if (!form.address.country) { setStates([]); return; }
        fetchLocLookup("State", form.address.country).then(setStates);
    }, [form.address.country]);

    useEffect(() => {
        if (!form.address.state) { setCities([]); return; }
        fetchLocLookup("City", form.address.state).then(setCities);
    }, [form.address.state]);

    useEffect(() => {
        if (!form.address.city) { setLocations([]); setTehsils([]); return; }
        fetchLocLookup("Location", form.address.city).then(setLocations);
        fetchLocLookup("Tehsil", form.address.city).then(setTehsils);
    }, [form.address.city]);

    useEffect(() => {
        if (!form.address.location) { setPostOffices([]); return; }
        fetchLocLookup("PostOffice", form.address.location).then(setPostOffices);
    }, [form.address.location]);

    useEffect(() => {
        if (!form.address.postOffice) return;
        fetchLocLookup("Pincode", form.address.postOffice).then(data => {
            if (data.length === 1) setAddress('pinCode')(data[0].lookup_value);
        });
    }, [form.address.postOffice]);

    // ─── Builtup Detail/Type Fetching effects ───────────────────────────────────
    useEffect(() => {
        const fetchBuiltupDetail = async () => {
            if (!form.subCategory) { setBuiltupDetailLookups([]); return; }
            try {
                const scRes = await api.get("/lookups", { params: { lookup_type: 'SubCategory', lookup_value: form.subCategory } });
                const scId = scRes.data?.data?.[0]?._id;
                if (!scId) { setBuiltupDetailLookups([]); return; }
                const ptRes = await api.get("/lookups", { params: { lookup_type: 'PropertyType', parent_lookup_id: scId } });
                setBuiltupDetailLookups((ptRes.data?.data || []).map((pt: any) => ({ label: pt.lookup_value, value: pt.lookup_value, _id: pt._id })));
            } catch (e) { console.error("Builtup Detail fetch failed", e); }
        };
        fetchBuiltupDetail();
    }, [form.subCategory]);

    useEffect(() => {
        const fetchBT = async () => {
            if (!form.builtupDetail) { setBtLookups([]); return; }
            try {
                const pt = builtupDetailLookups.find(opt => opt.value === form.builtupDetail);
                if (!pt?._id) { setBtLookups([]); return; }
                const btRes = await api.get("/lookups", { params: { lookup_type: 'BuiltupType', parent_lookup_id: pt._id, limit: 1000 } });
                setBtLookups((btRes.data?.data || []).map((bt: any) => ({ label: bt.lookup_value, value: bt.lookup_value })));
            } catch (e) { console.error("BT fetch failed", e); }
        };
        fetchBT();
    }, [form.builtupDetail, builtupDetailLookups]);


    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (ownerSearch.length > 2) {
                setSearching(true);
                try {
                    const res = await api.get("/contacts", { params: { search: ownerSearch, limit: 10 } });
                    setSearchResults((res.data?.data || []).map((c: any) => ({
                        id: c._id,
                        name: c.name || `${c.firstName} ${c.lastName}`,
                        mobile: c.mobile || (c.phones?.[0]?.number) || "N/A"
                    })));
                } catch (e) { console.error("Owner search failed", e); }
                finally { setSearching(false); }
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(delayDebounce);
    }, [ownerSearch]);

    const handleLinkOwner = () => {
        if (!selectedOwner) return;
        const newLink: OwnerLink = {
            id: selectedOwner.id,
            name: selectedOwner.name,
            mobile: selectedOwner.mobile,
            role: linkData.role,
            relationship: linkData.role === 'Property Owner' ? 'Owner' : linkData.relationship
        };
        setForm(f => ({ ...f, owners: [newLink, ...f.owners] }));
        setSelectedOwner(null);
        setOwnerSearch("");
        setLinkData({ role: "Property Owner", relationship: "" });
    };

    useEffect(() => {
        const fetchSystemData = async () => {
            // Helper to fetch and set state independently
            const load = async (url: string, setter: (d: any) => void, transform?: (d: any) => any) => {
                try {
                    const res = await api.get(url);
                    const data = res.data?.data || res.data?.records || res.data || [];
                    setter(transform ? transform(data) : data);
                } catch (e) {
                    console.error(`Fetch failed for ${url}:`, e);
                }
            };

            await Promise.all([
                load("/system-settings/property_config", (data) => setPropertyConfig(data.value || data)),
                load("/system-settings/master_fields", (data) => setMasterFields(data.value || data)),
                load("/projects?limit=100", setProjects),
                load("/lookups?lookup_type=Team&limit=100", (data) =>
                    setTeams(data.map((t: any) => ({ label: t.lookup_value, value: t._id })))
                ),
                load("/users?limit=1000", (data) =>
                    setUsers(data.map((u: any) => ({ label: u.name || u.fullName, value: u._id, team: u.team })))
                ),
            ]);
        };
        fetchSystemData();
    }, []);


    const handleNext = () => {
        if (step === 0) {
            if (!form.projectName || !form.unitNo || !form.subCategory) {
                triggerShake();
                Alert.alert("Missing Fields", "Please select a Project, enter Unit No, and choose a Sub Category.");
                return;
            }
        } else if (step === 1) {
            if (!form.builtupDetail) {
                triggerShake();
                Alert.alert("Missing Fields", "Please select a Built-up Detail (e.g., Flat, Villa, Plot).");
                return;
            }
            if (form.builtupDetails.some(d => !d.floor)) {
                triggerShake();
                Alert.alert("Missing Fields", "Please specify the floor for all rows in the dimensions section.");
                return;
            }
        } else if (step === 2) {
            if (!form.possessionStatus || !form.furnishType) {
                triggerShake();
                Alert.alert("Missing Fields", "Please select Possession Status and Furnish Type.");
                return;
            }
        }
        setStep(s => Math.min(s + 1, FORM_STEPS.length - 1));
    };

    const handleSave = async () => {
        // Validation for Step 3 (Final Check)
        if (!form.address.city || !form.address.location) {
            Alert.alert("Missing Location", "Please select both City and Location in the address section.");
            return;
        }

        setSaving(true);
        try {
            const findId = (items: any[], val: string) => items.find(i => i.lookup_value === val)?._id || val;

            // Transform categories/subCategories to IDs
            const catId = INITIAL.category === form.category ? "" : findId(masterFields.categories || [], form.category);
            const subCatId = findId(masterFields.subCategories || [], form.subCategory);

            const payload = {
                ...form,
                category: catId || form.category,
                subCategory: subCatId || form.subCategory,
                status: "Active",
                intent: "Sell",

                // Calculated builtup details
                builtupDetails: form.builtupDetails.map(d => ({
                    ...d,
                    length: Number(d.length) || 0,
                    width: Number(d.width) || 0,
                    totalArea: Number(d.totalArea) || 0
                })),

                address: {
                    ...form.address,
                    // Sending IDs where possible
                    country: form.address.country,
                    state: form.address.state,
                    city: form.address.city,
                    location: form.address.location,
                },

                owners: form.owners.map(o => o.id).filter(Boolean),
            };

            const finalPayload: any = { ...payload };
            delete finalPayload.locationSearch;
            delete finalPayload.projectName; // projectId is used

            const res = await api.post("/inventory", finalPayload);
            if (res.data?.success) {
                Alert.alert("Success", "Inventory saved successfully.");
                router.replace("/(tabs)/inventory");
            } else {
                throw new Error(res.data?.error || res.data?.message || "Failed to save");
            }
        } catch (e: any) {
            console.error("Save Error:", e.response?.data || e.message);
            Alert.alert("Error", e.response?.data?.error || e.message || "Failed to save inventory.");
        } finally {
            setSaving(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 0: // Basic Info
                return (
                    <FadeInView key="step0" delay={100}>
                        <SectionHeader title="Basic Unit Details" icon="🏢" />
                        <View style={styles.card}>
                            <Field label="Category" required>
                                <SelectButton value={form.category} placeholder="Select Category"
                                    options={['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Institutional'].map(c => ({ label: c, value: c }))}
                                    onSelect={(val) => setForm(f => ({ ...f, category: val, subCategory: "", builtupDetail: "", builtupType: "" }))} />
                            </Field>

                            <Field label="Sub Category" required>
                                <SelectButton value={form.subCategory} placeholder="Select Category first"
                                    options={(propertyConfig[form.category]?.subCategories || []).map((sc: any) => ({ label: sc.name, value: sc.name }))}
                                    onSelect={(val) => setForm(f => ({ ...f, subCategory: val, builtupDetail: "", builtupType: "" }))} />
                            </Field>

                            <Field label="Project Name" required>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={styles.selector}
                                    onPress={() => setProjectModalVisible(true)}
                                >
                                    <Text style={[styles.selectorText, !form.projectName && { color: COLORS.textMuted }]}>
                                        {form.projectName || "Select Project"}
                                    </Text>
                                    <View style={{ transform: [{ rotate: projectModalVisible ? '180deg' : '0deg' }] }}>
                                        <Ionicons name="chevron-down-outline" size={18} color={COLORS.textSecondary} />
                                    </View>
                                </TouchableOpacity>
                            </Field>

                            <Field label="Block">
                                <SelectButton value={form.block} placeholder="Select Project first"
                                    options={(projects.find(p => p.name === form.projectName)?.blocks || []).map((b: any) => ({ label: b.name, value: b.name }))}
                                    onSelect={set("block")} />
                            </Field>

                            <Field label="Unit No." required>
                                <Input label="Unit Number" value={form.unitNo} onChangeText={set("unitNo")} placeholder="e.g. 101" />
                            </Field>
                        </View>
                    </FadeInView>
                );
            case 1: // Builtup & Specs
                return (
                    <FadeInView key="step1" delay={100}>
                        <SectionHeader title="Builtup Details" icon="📐" />
                        <View style={styles.card}>
                            <Field label="Built-up Detail" required>
                                <SelectButton value={form.builtupDetail} placeholder="Select Sub Category first" options={builtupDetailLookups}
                                    onSelect={(val) => setForm(f => ({ ...f, builtupDetail: val, builtupType: "" }))} />
                            </Field>

                            <Field label="Built-up Type">
                                <SelectButton value={form.builtupType} placeholder="Select Built-up Detail first" options={btLookups} onSelect={set("builtupType")} />
                            </Field>

                            <View style={{ marginTop: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textSecondary }}>Dimensions</Text>
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                        onPress={() => setForm(f => ({ ...f, builtupDetails: [...f.builtupDetails, { floor: "", cluster: "", length: "", width: "", totalArea: "" }] }))}
                                    >
                                        <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                                        <Text style={{ color: COLORS.primary, fontWeight: '600', marginLeft: 4 }}>Add Row</Text>
                                    </TouchableOpacity>
                                </View>

                                {form.builtupDetails.map((row, idx) => (
                                    <View key={idx} style={styles.dimensionRow}>
                                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                                            <View style={{ flex: 1 }}>
                                                <Input label="Floor" value={row.floor} onChangeText={(val) => {
                                                    const newRows = [...form.builtupDetails];
                                                    newRows[idx].floor = val;
                                                    setForm(f => ({ ...f, builtupDetails: newRows }));
                                                }} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Input label="Plan/Type" value={row.cluster} onChangeText={(val) => {
                                                    const newRows = [...form.builtupDetails];
                                                    newRows[idx].cluster = val;
                                                    setForm(f => ({ ...f, builtupDetails: newRows }));
                                                }} />
                                            </View>
                                        </View>
                                        <View style={styles.dimGrid}>
                                            <View style={styles.dimInputWrap}>
                                                <Input label="Width" value={row.width} keyboardType="numeric" onChangeText={(val) => {
                                                    const clean = val.replace(/[^0-9.]/g, '');
                                                    const newRows = [...form.builtupDetails];
                                                    newRows[idx].width = clean;
                                                    const area = parseFloat(clean || '0') * parseFloat(newRows[idx].length || '0');
                                                    newRows[idx].totalArea = isNaN(area) ? '0' : area.toFixed(2).replace(/\.00$/, '');
                                                    setForm(f => ({ ...f, builtupDetails: newRows }));
                                                }} />
                                            </View>
                                            <Text style={{ color: COLORS.textSecondary }}>×</Text>
                                            <View style={styles.dimInputWrap}>
                                                <Input label="Length" value={row.length} keyboardType="numeric" onChangeText={(val) => {
                                                    const clean = val.replace(/[^0-9.]/g, '');
                                                    const newRows = [...form.builtupDetails];
                                                    newRows[idx].length = clean;
                                                    const area = parseFloat(clean || '0') * parseFloat(newRows[idx].width || '0');
                                                    newRows[idx].totalArea = isNaN(area) ? '0' : area.toFixed(2).replace(/\.00$/, '');
                                                    setForm(f => ({ ...f, builtupDetails: newRows }));
                                                }} />
                                            </View>
                                            <View style={styles.dimAreaBox}>
                                                <Text style={styles.dimAreaText}>{row.totalArea || '0'} SqFt</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => setForm(f => ({ ...f, builtupDetails: f.builtupDetails.filter((_, i) => i !== idx) }))}
                                                style={{ padding: 8 }}
                                            >
                                                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <SectionHeader title="Orientation & Features" icon="🧭" />
                        <View style={styles.card}>
                            <Field label="Direction">
                                <SelectButton value={form.direction} placeholder="Select Direction"
                                    options={(masterFields.directions || []).map((v: string) => ({ label: v, value: v }))}
                                    onSelect={set("direction")} />
                            </Field>

                            <Field label="Facing">
                                <SelectButton value={form.facing} placeholder="Select Facing"
                                    options={(masterFields.facings || []).map((v: string) => ({ label: v, value: v }))}
                                    onSelect={set("facing")} />
                            </Field>

                            <Field label="Road Width">
                                <SelectButton value={form.roadWidth} placeholder="Select Road Width"
                                    options={(masterFields.roadWidths || []).map((v: string) => ({ label: v, value: v }))}
                                    onSelect={set("roadWidth")} />
                            </Field>
                        </View>
                    </FadeInView>
                );
            case 2: // Status & Furnishing
                return (
                    <FadeInView key="step2" delay={100}>
                        <SectionHeader title="Furnishing & Dates" icon="🛋️" />
                        <View style={styles.card}>
                            <Field label="Occupation Date">
                                <TouchableOpacity
                                    style={styles.selector}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Text style={[styles.selectorText, !form.occupationDate && { color: COLORS.textSecondary }]}>
                                        {form.occupationDate || "Select Date"}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={form.occupationDate ? new Date(form.occupationDate) : new Date()}
                                        mode="date"
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(false);
                                            if (selectedDate) {
                                                setForm(f => ({ ...f, occupationDate: selectedDate.toISOString().split('T')[0] }));
                                            }
                                        }}
                                    />
                                )}
                            </Field>

                            <Field label="Age of Construction">
                                <Input label="Age of Construction" value={form.ageOfConstruction} onChangeText={set("ageOfConstruction")} placeholder="e.g. 5 Years" />
                            </Field>

                            <Field label="Possession Status">
                                <SelectButton value={form.possessionStatus} placeholder="Select Status"
                                    options={['Ready to Move', 'Under Construction'].map(v => ({ label: v, value: v }))}
                                    onSelect={set("possessionStatus")} />
                            </Field>

                            <Field label="Furnish Status">
                                <SelectButton value={form.furnishType} placeholder="Select Furnishing"
                                    options={['Fully Furnished', 'Semi Furnished', 'Unfurnished'].map(v => ({ label: v, value: v }))}
                                    onSelect={set("furnishType")} />
                            </Field>

                            {form.furnishType !== 'Unfurnished' && (
                                <Field label="Furnished Items">
                                    <Input label="Furnished Items" value={form.furnishedItems} onChangeText={set("furnishedItems")} placeholder="e.g. AC, Bed, Sofa..." multiline />
                                </Field>
                            )}
                        </View>
                    </FadeInView>
                );
            case 3: // Location & Ownership
                return (
                    <FadeInView key="step3" delay={100}>
                        <SectionHeader title="Location" icon="📍" />
                        <View style={styles.card}>
                            <Field label="Country">
                                <SelectButton value={form.address.country} placeholder="Select Country"
                                    options={countries.map(c => ({ label: c.lookup_value, value: c._id }))}
                                    onSelect={setAddress("country")} />
                            </Field>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Field label="State">
                                        <SelectButton value={form.address.state} placeholder="Select State"
                                            options={states.map(s => ({ label: s.lookup_value, value: s._id }))}
                                            onSelect={setAddress("state")} />
                                    </Field>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Field label="City">
                                        <SelectButton value={form.address.city} placeholder="Select City"
                                            options={cities.map(c => ({ label: c.lookup_value, value: c._id }))}
                                            onSelect={setAddress("city")} />
                                    </Field>
                                </View>
                            </View>

                            <Field label="Location">
                                <SelectButton value={form.address.location} placeholder="Select Location"
                                    options={locations.map(l => ({ label: l.lookup_value, value: l._id }))}
                                    onSelect={setAddress("location")} />
                            </Field>

                            <Field label="House No.">
                                <Input label="House/Plot No." value={form.address.hNo} onChangeText={setAddress("hNo")} />
                            </Field>

                            <Field label="Area">
                                <Input label="Area/Sector" value={form.address.area} onChangeText={setAddress("area")} />
                            </Field>
                        </View>

                        <SectionHeader title="Owner Assignment" icon="👤" />
                        <View style={styles.card}>
                            {!selectedOwner ? (
                                <View>
                                    <Input
                                        label="Search Owner"
                                        value={ownerSearch}
                                        onChangeText={setOwnerSearch}
                                        placeholder="Search by name or mobile..."
                                    />
                                    {searching && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 10 }} />}
                                    {searchResults.length > 0 && (
                                        <View style={styles.searchResults}>
                                            {searchResults.map((item: any) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={styles.searchResultItem}
                                                    onPress={() => {
                                                        setSelectedOwner(item);
                                                        setSearchResults([]);
                                                        setOwnerSearch("");
                                                    }}
                                                >
                                                    <Text style={styles.searchResultName}>{item.name}</Text>
                                                    <Text style={styles.searchResultMobile}>{item.mobile}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.linkContainer}>
                                    <View style={styles.selectedOwnerInfo}>
                                        <Text style={styles.linkName}>{selectedOwner.name}</Text>
                                        <Text style={styles.linkMobile}>{selectedOwner.mobile}</Text>
                                    </View>

                                    <View style={{ marginTop: 16 }}>
                                        <Field label="Role">
                                            <SelectButton value={linkData.role} placeholder="Select Role"
                                                options={['Property Owner', 'Associate'].map(v => ({ label: v, value: v }))}
                                                onSelect={(v) => setLinkData(d => ({ ...d, role: v }))} />
                                        </Field>

                                        {linkData.role === 'Associate' && (
                                            <Field label="Relationship">
                                                <SelectButton value={linkData.relationship} placeholder="Select Relationship"
                                                    options={['Husband', 'Wife', 'Father', 'Mother', 'Brother', 'Sister', 'Son', 'Daughter', 'Partner', 'Broker', 'Other'].map(v => ({ label: v, value: v }))}
                                                    onSelect={(v) => setLinkData(d => ({ ...d, relationship: v }))} />
                                            </Field>
                                        )}

                                        <TouchableOpacity style={styles.linkBtn} onPress={handleLinkOwner}>
                                            <Text style={styles.linkBtnText}>Link Person</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={{ marginTop: 12, alignItems: 'center' }}
                                            onPress={() => setSelectedOwner(null)}
                                        >
                                            <Text style={{ color: COLORS.error, fontWeight: '600' }}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {form.owners.length > 0 && (
                                <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 16 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 12 }}>Linked People</Text>
                                    {form.owners.map((owner, idx) => (
                                        <View key={`${owner.id}-${idx}`} style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: COLORS.bg,
                                            padding: 12,
                                            borderRadius: 12,
                                            marginBottom: 8
                                        }}>
                                            <View>
                                                <Text style={{ fontWeight: '600', color: COLORS.textPrimary }}>{owner.name}</Text>
                                                <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{owner.role} {owner.relationship ? `(${owner.relationship})` : ''}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => setForm(f => ({ ...f, owners: f.owners.filter((_, i) => i !== idx) }))}>
                                                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
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
                    >
                        <Ionicons name={step > 0 ? "arrow-back" : "close"} size={24} color={COLORS.textPrimary} style={styles.headerIcon} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{FORM_STEPS[step]}</Text>
                        <Text style={styles.headerSubtitle}>Step {step + 1} of {FORM_STEPS.length}</Text>
                    </View>
                    <View style={{ width: 24 }} />
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

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                                    <Text style={styles.saveBtnText}>Save Inventory</Text>
                                )}
                            </Pressable>
                        )}
                    </Animated.View>
                </View>

                <SearchableDropdown
                    visible={projectModalVisible}
                    onClose={() => setProjectModalVisible(false)}
                    options={projects.map(p => ({ label: p.name, value: p.name }))}
                    placeholder="Search Project"
                    onSelect={(val) => setForm(f => ({ ...f, projectName: val, projectId: projects.find(p => p.name === val)?._id || "", block: "", size: "" }))}
                />
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
    },
    headerIcon: { fontWeight: '300' },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: "600", color: COLORS.textPrimary },
    headerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
    progressContainer: { paddingHorizontal: 20, marginBottom: 12 },
    progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
    content: { flex: 1, paddingHorizontal: SPACING.outer },

    // --- Card Styles ---
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

    // --- Section Header ---
    sectionHeader: { marginTop: 4, marginBottom: 16 },
    sectionHeaderTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    sectionIcon: { fontSize: 18, marginRight: 10 },
    sectionTitle: { fontSize: 20, fontWeight: "600", color: COLORS.textPrimary },
    headerDivider: { height: 1, backgroundColor: COLORS.border, width: '100%', opacity: 0.5 },

    // --- Field & Input ---
    field: { marginBottom: SPACING.field },
    fieldLabel: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
    required: { color: COLORS.error },
    inputContainer: { marginBottom: 20, marginTop: 10 },
    input: {
        height: SPACING.inputHeight,
        backgroundColor: COLORS.inputBg,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: "transparent",
    },
    inputFocused: {
        backgroundColor: COLORS.cardBg,
        borderColor: COLORS.primary,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12
            },
            android: { elevation: 4 },
        }),
    },
    inputDisabled: { opacity: 0.5, backgroundColor: "#F1F5F9" },

    // --- Premium Pills (Chips) ---
    chipRow: { flexDirection: "row", marginBottom: 4 },
    chipRowContent: { paddingRight: 20 },
    chip: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: COLORS.inputBg,
        marginRight: 10,
        borderWidth: 1,
        borderColor: "transparent",
    },
    chipSelected: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 8
            },
            android: { elevation: 3 },
        }),
    },
    chipText: { fontSize: 14, fontWeight: "500", color: COLORS.textSecondary },
    chipTextSelected: { color: COLORS.primary, fontWeight: "600" },
    placeholderText: { color: COLORS.textSecondary, fontSize: 13, padding: 8 },

    // --- Dropdown/Selector ---
    selector: {
        height: SPACING.inputHeight,
        backgroundColor: COLORS.inputBg,
        borderRadius: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    selectorText: { fontSize: 16, color: COLORS.textPrimary },

    // --- Footer & Sticky Bar ---
    footer: { marginTop: 12, marginBottom: 100 },
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
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: 0.05,
                shadowRadius: 15,
            },
            android: { elevation: 10 },
        }),
    },
    saveBtn: {
        flex: 1,
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: "center",
        alignItems: "center",
        ...Platform.select({
            ios: {
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.24,
                shadowRadius: 12
            },
            android: { elevation: 6 },
        }),
    },
    saveBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    cancelBtn: {
        paddingHorizontal: 20,
        height: 54,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
    },
    cancelBtnText: { color: COLORS.textSecondary, fontWeight: "600" },

    // --- Searchable Dropdown Modal ---
    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)" },
    modalContent: {
        backgroundColor: COLORS.cardBg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: "85%",
        padding: 24,
        marginTop: "auto",
    },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary },
    modalSearchInput: {
        height: 52,
        backgroundColor: COLORS.inputBg,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 20,
        fontSize: 16,
    },
    modalListItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.bg },
    modalListItemText: { fontSize: 16, color: COLORS.textPrimary },
    modalEmptyText: { textAlign: "center", color: COLORS.textSecondary, marginTop: 40, fontSize: 15 },

    // --- Dimensions Grid ---
    dimensionRow: {
        backgroundColor: COLORS.bg,
        padding: 16,
        borderRadius: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    dimGrid: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    dimInputWrap: { flex: 1 },
    dimAreaBox: {
        flex: 1.2,
        backgroundColor: COLORS.border,
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dimAreaText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },

    // --- Owner Section ---
    searchResults: {
        marginTop: 8,
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        maxHeight: 200,
        overflow: 'hidden',
    },
    searchResultItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.bg },
    searchResultName: { fontSize: 16, fontWeight: "600", color: COLORS.textPrimary },
    searchResultMobile: { fontSize: 14, color: COLORS.textSecondary },
    linkContainer: { backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 16, marginBottom: 20 },
    selectedOwnerInfo: { marginBottom: 16 },
    linkName: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
    linkMobile: { fontSize: 15, color: COLORS.textSecondary },
    linkBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
    linkBtnText: { color: "#fff", fontWeight: "600" },
    ownerList: { marginTop: 24, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 20 },
    subListTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 12 },
    ownerItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: COLORS.cardBg,
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    ownerName: { fontSize: 16, fontWeight: "600", color: COLORS.textPrimary },
    ownerRole: { fontSize: 14, color: COLORS.textSecondary },

    // --- Stepper ---
    stepper: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 16,
        backgroundColor: COLORS.cardBg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    },
    stepItem: { alignItems: "center", flex: 1 },
    stepCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.border,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 6,
    },
    stepCircleActive: { backgroundColor: COLORS.primary },
    stepNum: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary },
    stepNumActive: { color: "#fff" },
    stepLabel: { fontSize: 10, fontWeight: "600", color: COLORS.textSecondary, textAlign: 'center' },
    stepLabelActive: { color: COLORS.primary },

    cancelLink: { marginTop: 8 },
    cancelLinkText: { color: COLORS.error, fontWeight: '600' },
});
