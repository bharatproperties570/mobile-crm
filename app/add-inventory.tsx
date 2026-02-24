import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
    Modal, FlatList, Animated, Pressable, Switch
} from "react-native";
import { useRouter } from "expo-router";
import api from "./services/api";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme, SPACING } from "./context/ThemeContext";

const FORM_STEPS = ["Basic Info", "Builtup & Furnishing", "Location", "Owner & Assignment"];

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
                            <Ionicons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={[styles.modalSearchInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border, borderWidth: 1 }]}
                        placeholder="Search..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor={theme.textMuted}
                    />
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, idx) => `${item.value}-${idx}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={[styles.modalListItem, { borderBottomColor: theme.border + '50' }]} onPress={() => { onSelect(item.value); onClose(); }}>
                                <Text style={[styles.modalListItemText, { color: theme.textPrimary }]}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <Ionicons name="search-outline" size={48} color={theme.border} />
                                <Text style={[styles.modalEmptyText, { color: theme.textSecondary }]}>No matching results found</Text>
                            </View>
                        }
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            </View>
        </Modal>
    );
}

function ContactSearchModal({
    visible, onClose, onSelect
}: {
    visible: boolean; onClose: () => void; onSelect: (c: any) => void;
}) {
    const { theme } = useTheme();
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible) { setSearch(""); setResults([]); return; }
    }, [visible]);

    useEffect(() => {
        const delay = setTimeout(async () => {
            if (search.length > 2) {
                setLoading(true);
                try {
                    const res = await api.get("/contacts", { params: { search, limit: 15 } });
                    setResults((res.data?.records || res.data?.data || []).map((c: any) => ({
                        id: c._id,
                        name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || "Unnamed",
                        mobile: c.mobile || (c.phones?.[0]?.number) || "No Mobile"
                    })));
                } catch (e) {
                    console.error("Modal search failed", e);
                } finally {
                    setLoading(false);
                }
            } else { setResults([]); }
        }, 500);
        return () => clearTimeout(delay);
    }, [search]);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { height: '90%', backgroundColor: theme.cardBg }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Contact</Text>
                        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={theme.textPrimary} /></TouchableOpacity>
                    </View>
                    <View style={{ position: 'relative' }}>
                        <TextInput
                            style={[styles.modalSearchInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border, borderWidth: 1 }]}
                            placeholder="Search by name or mobile..."
                            value={search}
                            onChangeText={setSearch}
                            autoFocus
                            placeholderTextColor={theme.textMuted}
                        />
                        {loading && <ActivityIndicator style={{ position: 'absolute', right: 16, top: 16 }} color={theme.primary} />}
                    </View>
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={[styles.modalListItem, { flexDirection: 'row', alignItems: 'center', borderBottomColor: theme.border + '50' }]} onPress={() => { onSelect(item); onClose(); }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                                    <Text style={{ fontWeight: '700', color: theme.primary, fontSize: 16 }}>{item.name.charAt(0).toUpperCase()}</Text>
                                </View>
                                <View>
                                    <Text style={[styles.modalListItemText, { fontWeight: '700', color: theme.textPrimary }]}>{item.name}</Text>
                                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>{item.mobile}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 100 }}>
                                <Ionicons name={search.length > 2 ? "person-remove-outline" : "search-outline"} size={64} color={theme.border} />
                                <Text style={[styles.modalEmptyText, { color: theme.textSecondary, marginTop: 16 }]}>{search.length > 2 ? "No contacts found" : "Type 3+ characters to search"}</Text>
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

interface BuiltupRow { floor: string; cluster: string; length: string; width: string; totalArea: string; }
interface OwnerLink { id: string; name: string; mobile: string; role: string; relationship: string; }
interface InventoryForm {
    category: string; subCategory: string; unitNo: string; unitType: string; unitConfig: string; projectName: string; projectId: string; block: string; size: string;
    direction: string; facing: string; roadWidth: string; ownership: string; builtupDetail: string; builtupType: string; builtupDetails: BuiltupRow[];
    occupationDate: string; ageOfConstruction: string; possessionStatus: string; furnishType: string; furnishedItems: string; locationSearch: string;
    address: { country: string; state: string; city: string; location: string; tehsil: string; postOffice: string; pinCode: string; hNo: string; street: string; area: string; };
    owners: OwnerLink[]; userId?: string; assignment?: string; assignedTo: string; team: string; status: string; intent: string; visibleTo: string;
}

const INITIAL: InventoryForm = {
    category: "Residential", subCategory: "", unitNo: "", unitType: "", unitConfig: "",
    projectName: "", projectId: "", block: "", size: "",
    direction: "", facing: "", roadWidth: "", ownership: "",
    builtupDetail: "", builtupType: "",
    builtupDetails: [{ floor: "Ground Floor", cluster: "", length: "", width: "", totalArea: "" }],
    occupationDate: "", ageOfConstruction: "", possessionStatus: "", furnishType: "", furnishedItems: "",
    locationSearch: "",
    address: { country: "", state: "", city: "", location: "", tehsil: "", postOffice: "", pinCode: "", hNo: "", street: "", area: "" },
    owners: [],
    assignedTo: "", team: "", status: "Available", intent: "Sell", visibleTo: "Everyone",
};

export default function AddInventoryScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const [form, setForm] = useState<InventoryForm>(INITIAL);
    const [saving, setSaving] = useState(false);
    const [projectModalVisible, setProjectModalVisible] = useState(false);
    const [selectedSizeId, setSelectedSizeId] = useState("");
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

    const [propertyConfig, setPropertyConfig] = useState<any>({});
    const [masterFields, setMasterFields] = useState<any>({});
    const [lookups, setLookups] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [propertySizes, setPropertySizes] = useState<any[]>([]);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState<any>(null);
    const [linkData, setLinkData] = useState({ role: "Property Owner", relationship: "" });
    const [countries, setCountries] = useState<any[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [tehsils, setTehsils] = useState<any[]>([]);
    const [postOffices, setPostOffices] = useState<any[]>([]);
    const [activeLocDropdown, setActiveLocDropdown] = useState<'country' | 'state' | 'city' | 'location' | 'team' | 'assignedTo' | null>(null);

    const set = (key: keyof InventoryForm) => (val: any) => setForm((f) => ({ ...f, [key]: val }));
    const handleSizeChange = (sizeId: string) => {
        const sizeConfig = propertySizes.find(s => s.id === sizeId || s._id === sizeId);
        if (!sizeConfig) {
            setSelectedSizeId("");
            return;
        }

        setSelectedSizeId(sizeId);
        setForm(f => ({
            ...f,
            category: sizeConfig.category || f.category,
            subCategory: sizeConfig.subCategory || f.subCategory,
            unitConfig: sizeConfig.unitType || sizeConfig.unitConfig || sizeConfig.type || f.unitConfig, // Configuration (e.g. 3 BHK / 10 Marla)
            size: sizeConfig.area || sizeConfig.saleableArea || sizeConfig.totalArea || f.size,
            builtupType: "" // Reset builtupType to force refresh based on new hierarchy
        }));
    };
    const setAddress = (key: keyof InventoryForm['address']) => (val: string) => {
        setForm(f => {
            const newAddr = { ...f.address, [key]: val };
            if (key === 'country') { newAddr.state = ""; newAddr.city = ""; newAddr.location = ""; newAddr.tehsil = ""; newAddr.postOffice = ""; newAddr.pinCode = ""; }
            if (key === 'state') { newAddr.city = ""; newAddr.location = ""; newAddr.tehsil = ""; newAddr.postOffice = ""; newAddr.pinCode = ""; }
            if (key === 'city') { newAddr.location = ""; newAddr.tehsil = ""; newAddr.postOffice = ""; newAddr.pinCode = ""; }
            if (key === 'location') { newAddr.postOffice = ""; newAddr.pinCode = ""; }
            return { ...f, address: newAddr };
        });
    };

    const fetchLocLookup = async (lookup_type: string, parent_id: string | null = null) => {
        try {
            const params: any = { lookup_type, limit: 1000 };
            if (parent_id) params.parent_lookup_id = parent_id;
            const res = await api.get("/lookups", { params });
            return res.data?.data || [];
        } catch (error) { return []; }
    };

    useEffect(() => { fetchLocLookup("Country").then(setCountries); }, []);
    useEffect(() => { if (!form.address.country) { setStates([]); return; } fetchLocLookup("State", form.address.country).then(setStates); }, [form.address.country]);
    useEffect(() => { if (!form.address.state) { setCities([]); return; } fetchLocLookup("City", form.address.state).then(setCities); }, [form.address.state]);
    useEffect(() => { if (!form.address.city) { setLocations([]); setTehsils([]); return; } fetchLocLookup("Location", form.address.city).then(setLocations); fetchLocLookup("Tehsil", form.address.city).then(setTehsils); }, [form.address.city]);
    useEffect(() => { if (!form.address.location) { setPostOffices([]); return; } fetchLocLookup("PostOffice", form.address.location).then(setPostOffices); }, [form.address.location]);
    useEffect(() => { if (!form.address.postOffice) return; fetchLocLookup("Pincode", form.address.postOffice).then(data => { if (data.length === 1) setAddress('pinCode')(data[0].lookup_value); }); }, [form.address.postOffice]);

    useEffect(() => {
        // Form field reset logic on category / subCategory changes
    }, [form.category, form.subCategory]);

    const handleLinkOwner = () => {
        if (!selectedOwner) return;
        const newLink: OwnerLink = { id: selectedOwner.id, name: selectedOwner.name, mobile: selectedOwner.mobile, role: linkData.role, relationship: linkData.role === 'Property Owner' ? 'Owner' : (linkData.relationship || 'Associate') };
        if (form.owners.some(o => o.id === newLink.id)) { Alert.alert("Already Linked", `${newLink.name} is already added.`); return; }
        setForm(f => ({ ...f, owners: [newLink, ...f.owners] }));
        setSelectedOwner(null);
        setLinkData({ role: "Property Owner", relationship: "" });
    };

    useEffect(() => {
        const fetchSystemData = async () => {
            const load = async (url: string, setter: (d: any) => void, transform?: (d: any) => any) => {
                try {
                    const res = await api.get(url);
                    const data = res.data?.data || res.data?.records || res.data || [];
                    setter(transform ? transform(data) : data);
                } catch (e) { }
            };
            await Promise.all([
                load("/system-settings/property_config", (data) => setPropertyConfig(data.value || data)),
                load("/system-settings/master_fields", (data) => setMasterFields(data.value || data)),
                load("/projects?limit=100", setProjects),
                load("/teams?limit=100", (data) => setTeams(data.map((t: any) => ({ label: t.name, value: t._id })))),
                load("/users?limit=1000", (data) => setUsers(data.map((u: any) => ({ label: u.name || u.fullName, value: u._id, team: u.team })))),
                load("/lookups?limit=2500", setLookups),
                load("/lookups?lookup_type=size&limit=1000", (data) => {
                    const normalized = data.map((sz: any) => ({
                        id: sz._id,
                        name: sz.lookup_value,
                        ...(sz.metadata || {})
                    }));
                    setPropertySizes(normalized);
                }),
            ]);
        };
        fetchSystemData();
    }, []);

    const handleNext = () => {
        if (step === 0 && (!form.projectName || !form.unitNo || !form.subCategory || !form.size)) {
            triggerShake();
            Alert.alert("Missing Fields", "Please select a Project, enter Unit No, and choose a Size configuration.");
            return;
        }
        if (step === 1 && (form.builtupDetails.some(d => !d.floor) || !form.possessionStatus || !form.furnishType)) { triggerShake(); Alert.alert("Missing Fields", "Please ensure Floor dimensions are set, and choose Possession/Furnish status."); return; }
        if (step === 2 && (!form.address.city || !form.address.location)) { triggerShake(); Alert.alert("Missing Location", "Please select both City and Location."); return; }
        setStep(s => Math.min(s + 1, FORM_STEPS.length - 1));
    };

    const handleSave = async () => {
        if (!form.projectName || !form.unitNo || !form.address.city || !form.address.location) { Alert.alert("Incomplete Form", "Base details (Project, Unit No) and Location (City, Location) are required."); return; }
        setSaving(true);
        try {
            const resolveId = (type: string, value: string) => {
                if (!value) return null;
                const match = lookups.find(l => l.lookup_type?.toLowerCase() === type.toLowerCase() && l.lookup_value?.toLowerCase() === value.toLowerCase());
                return match ? match._id : value;
            };
            const payload = {
                ...form, unitNumber: form.unitNo, unitNo: form.unitNo, category: resolveId('Category', form.category), subCategory: resolveId('SubCategory', form.subCategory), status: resolveId('Status', form.status), intent: resolveId('Intent', form.intent), facing: resolveId('Facing', form.facing),
                projectId: form.projectId, projectName: form.projectName, builtupDetails: form.builtupDetails.map(d => ({ ...d, floor: d.floor, length: Number(d.length) || 0, width: Number(d.width) || 0, totalArea: Number(d.totalArea) || 0 })),
                address: { ...form.address, city: form.address.city, location: form.address.location, area: form.address.area },
                owners: form.owners.filter(o => o.role === 'Property Owner').map(o => o.id), associates: form.owners.filter(o => o.role === 'Associate').map(o => ({ contact: o.id, relationship: o.relationship })),
            };
            const finalPayload: any = { ...payload }; delete finalPayload.locationSearch;
            const res = await api.post("/inventory", finalPayload);
            if (res.data?.success || res.status === 201 || res.status === 200) {
                Alert.alert(
                    "Success 🎉",
                    "Inventory has been saved successfully.",
                    [{ text: "OK", onPress: () => router.replace("/(tabs)/inventory") }],
                    { cancelable: false }
                );
            }
            else { throw new Error(res.data?.error || "Failed to save inventory."); }
        } catch (e: any) { Alert.alert("Save Failed", e.response?.data?.error || e.message || "Failed to save. Check your connection."); }
        finally { setSaving(false); }
    };

    const renderStepContent = () => {
        switch (step) {
            case 0: return (
                <FadeInView key="step0">
                    <SectionHeader title="Basic Unit Details" icon="🏢" subtitle="Category and reference info" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Category" required><SelectButton value={form.category} options={['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Institutional'].map(c => ({ label: c, value: c }))} onSelect={(val) => setForm(f => ({ ...f, category: val, subCategory: "", unitType: "", builtupDetail: "", builtupType: "" }))} /></Field>
                        <Field label="Sub Category" required><SelectButton value={form.subCategory} options={(propertyConfig[form.category]?.subCategories || []).map((sc: any) => ({ label: sc.name, value: sc.name }))} onSelect={(val) => setForm(f => ({ ...f, subCategory: val, unitType: "", builtupDetail: "", builtupType: "" }))} /></Field>
                        <Field label="Project Name" required>
                            <TouchableOpacity activeOpacity={0.7} style={[styles.selector, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => setProjectModalVisible(true)}>
                                <Text style={[styles.selectorText, { color: theme.textPrimary }, !form.projectName && { color: theme.textMuted }]}>{form.projectName || "Select Project"}</Text>
                                <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </Field>
                        <Field label="Block"><SelectButton value={form.block} options={(projects.find(p => p.name === form.projectName)?.blocks || []).map((b: any) => ({ label: b.name, value: b.name }))} onSelect={(val) => setForm(f => ({ ...f, block: val, unitType: "", builtupType: "" }))} /></Field>
                        <Field label="Unit Number" required>
                            <Input
                                label="Unit No"
                                value={form.unitNo}
                                onChangeText={set("unitNo")}
                                placeholder="e.g. 101, A-502"
                                icon="business-outline"
                            />
                        </Field>
                        <Field label="Configuration (Size)" required>
                            <SelectButton
                                value={selectedSizeId}
                                options={propertySizes
                                    .filter(s => s.project === form.projectName && (!form.block || s.block === form.block))
                                    .map(s => ({
                                        label: `${s.name} (${s.area || s.saleableArea || s.totalArea} ${s.areaMetrics || 'SqFt'})`,
                                        value: s.id || s._id
                                    }))
                                }
                                onSelect={handleSizeChange}
                            />
                        </Field>
                        <Field label="Unit Type (Orientation)" required>
                            <SelectButton
                                value={form.unitType}
                                options={lookups
                                    .filter(l => l.lookup_type === 'UnitType')
                                    .map(l => ({ label: l.lookup_value, value: l.lookup_value }))}
                                onSelect={(val) => setForm(f => ({ ...f, unitType: val }))}
                            />
                        </Field>
                    </View>
                    <SectionHeader title="Orientation & Specs" icon="🧭" subtitle="Direction and road access" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Direction">
                            <SelectButton
                                value={form.direction}
                                options={lookups
                                    .filter(l => l.lookup_type === 'Direction')
                                    .map(l => ({ label: l.lookup_value, value: l.lookup_value }))}
                                onSelect={set("direction")}
                            />
                        </Field>
                        <Field label="Facing">
                            <SelectButton
                                value={form.facing}
                                options={lookups
                                    .filter(l => l.lookup_type === 'Facing')
                                    .map(l => ({ label: l.lookup_value, value: l.lookup_value }))}
                                onSelect={set("facing")}
                            />
                        </Field>
                        <Field label="Road Width">
                            <SelectButton
                                value={form.roadWidth}
                                options={lookups
                                    .filter(l => l.lookup_type === 'RoadWidth')
                                    .map(l => ({ label: l.lookup_value, value: l.lookup_value }))}
                                onSelect={set("roadWidth")}
                            />
                        </Field>
                    </View>
                </FadeInView>
            );
            case 1: return (
                <FadeInView key="step1">
                    <SectionHeader title="Builtup Details" icon="📐" subtitle="Floor plans and area" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Built-up Type">
                            <SelectButton
                                value={form.builtupType}
                                options={(() => {
                                    if (!form.category || !form.subCategory) return [];
                                    const catConfig = propertyConfig[form.category];
                                    if (!catConfig) return [];
                                    const subCat = (catConfig.subCategories || []).find((s: any) => s.name === form.subCategory);
                                    if (!subCat) return [];

                                    // Aggregate all unique builtupTypes from all types in this subcategory
                                    const allTypes = subCat.types || [];
                                    const aggregateTypes = new Set<string>();
                                    allTypes.forEach((t: any) => {
                                        if (Array.isArray(t.builtupTypes)) {
                                            t.builtupTypes.forEach((bt: string) => aggregateTypes.add(bt));
                                        }
                                    });
                                    return Array.from(aggregateTypes).map(bt => ({ label: bt, value: bt }));
                                })()}
                                onSelect={set("builtupType")}
                            />
                        </Field>
                        <View style={{ marginTop: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dimensions Grid</Text>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }} onPress={() => setForm(f => ({ ...f, builtupDetails: [...f.builtupDetails, { floor: "", cluster: "", length: "", width: "", totalArea: "" }] }))}>
                                    <Ionicons name="add" size={18} color={theme.primary} /><Text style={{ color: theme.primary, fontWeight: '800', marginLeft: 2, fontSize: 12 }}>ADD NEW</Text>
                                </TouchableOpacity>
                            </View>
                            {form.builtupDetails.map((row, idx) => (
                                <View key={idx} style={[styles.dimensionRow, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                                    <View style={styles.row}>
                                        <View style={{ flex: 1.2 }}><Input label="Floor" value={row.floor} onChangeText={(val) => { const newRows = [...form.builtupDetails]; newRows[idx].floor = val; setForm(f => ({ ...f, builtupDetails: newRows })); }} /></View>
                                        <View style={{ flex: 1 }}><Input label="Type" value={row.cluster} onChangeText={(val) => { const newRows = [...form.builtupDetails]; newRows[idx].cluster = val; setForm(f => ({ ...f, builtupDetails: newRows })); }} /></View>
                                    </View>
                                    <View style={[styles.dimGrid, { marginTop: 12 }]}>
                                        <View style={{ flex: 1 }}><Input label="Width" value={row.width} keyboardType="numeric" onChangeText={(val) => { const clean = val.replace(/[^0-9.]/g, ''); const newRows = [...form.builtupDetails]; newRows[idx].width = clean; const area = parseFloat(clean || '0') * parseFloat(newRows[idx].length || '0'); newRows[idx].totalArea = isNaN(area) ? '0' : area.toFixed(2).replace(/\.00$/, ''); setForm(f => ({ ...f, builtupDetails: newRows })); }} /></View>
                                        <Text style={{ color: theme.textMuted, fontWeight: '800', fontSize: 16 }}>×</Text>
                                        <View style={{ flex: 1 }}><Input label="Length" value={row.length} keyboardType="numeric" onChangeText={(val) => { const clean = val.replace(/[^0-9.]/g, ''); const newRows = [...form.builtupDetails]; newRows[idx].length = clean; const area = parseFloat(clean || '0') * parseFloat(newRows[idx].width || '0'); newRows[idx].totalArea = isNaN(area) ? '0' : area.toFixed(2).replace(/\.00$/, ''); setForm(f => ({ ...f, builtupDetails: newRows })); }} /></View>
                                        <View style={[styles.dimAreaBox, { backgroundColor: theme.primary + '10' }]}><Text style={[styles.dimAreaText, { color: theme.primary }]}>{row.totalArea || '0'} SqFt</Text></View>
                                        <TouchableOpacity onPress={() => setForm(f => ({ ...f, builtupDetails: f.builtupDetails.filter((_, i) => i !== idx) }))} style={{ padding: 8 }}><Ionicons name="trash-outline" size={20} color={theme.error} /></TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                    <SectionHeader title="Status & Furnishing" icon="🛋️" subtitle="Possession and interior setup" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Occupation Date">
                            <TouchableOpacity style={[styles.selector, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => setShowDatePicker(true)}>
                                <Text style={[styles.selectorText, { color: theme.textPrimary }, !form.occupationDate && { color: theme.textMuted }]}>{form.occupationDate || "Select Date"}</Text>
                                <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                            {showDatePicker && (<DateTimePicker value={form.occupationDate ? new Date(form.occupationDate) : new Date()} mode="date" display="default" onChange={(event, selectedDate) => { setShowDatePicker(false); if (selectedDate) setForm(f => ({ ...f, occupationDate: selectedDate.toISOString().split('T')[0] })); }} />)}
                        </Field>
                        <Field label="Age of Construction"><Input label="Age" value={form.ageOfConstruction} onChangeText={set("ageOfConstruction")} placeholder="e.g. 5 Years" icon="calendar-outline" /></Field>
                        <Field label="Possession Status"><SelectButton value={form.possessionStatus} options={['Ready to Move', 'Under Construction'].map(v => ({ label: v, value: v }))} onSelect={set("possessionStatus")} /></Field>
                        <Field label="Furnish Status"><SelectButton value={form.furnishType} options={['Fully Furnished', 'Semi Furnished', 'Unfurnished'].map(v => ({ label: v, value: v }))} onSelect={set("furnishType")} /></Field>
                        {form.furnishType !== 'Unfurnished' && <Field label="Furnished Items"><Input label="Items" value={form.furnishedItems} onChangeText={set("furnishedItems")} placeholder="AC, Sofa, etc." multiline icon="list-outline" /></Field>}
                    </View>
                </FadeInView>
            );
            case 2: return (
                <FadeInView key="step2">
                    <SectionHeader title="Locality Details" icon="📍" subtitle="Geographic location markers" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Country">
                            <TouchableOpacity activeOpacity={0.7} style={[styles.selector, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => setActiveLocDropdown('country')}>
                                <Text style={[styles.selectorText, { color: theme.textPrimary }, !form.address.country && { color: theme.textMuted }]}>{countries.find(c => c._id === form.address.country)?.lookup_value || "Select Country"}</Text>
                                <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </Field>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><Field label="State"><TouchableOpacity activeOpacity={0.7} style={[styles.selector, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => form.address.country && setActiveLocDropdown('state')}><Text style={[styles.selectorText, { color: theme.textPrimary }, !form.address.state && { color: theme.textMuted }]}>{states.find(s => s._id === form.address.state)?.lookup_value || "Select State"}</Text><Ionicons name="chevron-down" size={16} color={theme.textSecondary} /></TouchableOpacity></Field></View>
                            <View style={{ flex: 1 }}><Field label="City"><TouchableOpacity activeOpacity={0.7} style={[styles.selector, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => form.address.state && setActiveLocDropdown('city')}><Text style={[styles.selectorText, { color: theme.textPrimary }, !form.address.city && { color: theme.textMuted }]}>{cities.find(c => c._id === form.address.city)?.lookup_value || "Select City"}</Text><Ionicons name="chevron-down" size={16} color={theme.textSecondary} /></TouchableOpacity></Field></View>
                        </View>
                        <Field label="Location"><TouchableOpacity activeOpacity={0.7} style={[styles.selector, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => form.address.city && setActiveLocDropdown('location')}><Text style={[styles.selectorText, { color: theme.textPrimary }, !form.address.location && { color: theme.textMuted }]}>{locations.find(l => l._id === form.address.location)?.lookup_value || "Select Location"}</Text><Ionicons name="chevron-down" size={18} color={theme.textSecondary} /></TouchableOpacity></Field>
                        <Field label="House / Plot No."><Input label="House No." value={form.address.hNo} onChangeText={setAddress("hNo")} placeholder="e.g. 12-A" icon="home-outline" /></Field>
                        <Field label="Area / Sector"><Input label="Area" value={form.address.area} onChangeText={setAddress("area")} placeholder="e.g. Sector 82" icon="map-outline" /></Field>
                    </View>
                </FadeInView>
            );
            case 3: return (
                <FadeInView key="step3">
                    <SectionHeader title="Ownership" icon="👥" subtitle="Linked contacts and roles" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        {!selectedOwner ? (
                            <TouchableOpacity style={[styles.selector, { backgroundColor: theme.primary + '08', borderStyle: 'dashed', borderWidth: 1.5, borderColor: theme.primary }]} onPress={() => setIsContactModalOpen(true)}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="person-add" size={20} color={theme.primary} style={{ marginRight: 10 }} /><Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Select Contact to Link</Text></View>
                                <Ionicons name="search" size={20} color={theme.primary} />
                            </TouchableOpacity>
                        ) : (
                            <View style={{ backgroundColor: theme.inputBg, padding: 16, borderRadius: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}><Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{selectedOwner.name.charAt(0).toUpperCase()}</Text></View>
                                    <View style={{ flex: 1 }}><Text style={{ fontSize: 17, fontWeight: '800', color: theme.textPrimary }}>{selectedOwner.name}</Text><Text style={{ fontSize: 14, color: theme.textSecondary }}>{selectedOwner.mobile}</Text></View>
                                    <TouchableOpacity onPress={() => setSelectedOwner(null)}><Ionicons name="close-circle" size={28} color={theme.error} /></TouchableOpacity>
                                </View>
                                <Field label="Role"><SelectButton value={linkData.role} options={['Property Owner', 'Associate'].map(v => ({ label: v, value: v }))} onSelect={(v) => setLinkData(d => ({ ...d, role: v }))} /></Field>
                                {linkData.role === 'Associate' && <Field label="Relationship"><SelectButton value={linkData.relationship} options={['Husband', 'Wife', 'Father', 'Mother', 'Brother', 'Sister', 'Son', 'Daughter', 'Partner', 'Broker', 'Other'].map(v => ({ label: v, value: v }))} onSelect={(v) => setLinkData(d => ({ ...d, relationship: v }))} /></Field>}
                                <TouchableOpacity style={{ backgroundColor: theme.primary, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 }} onPress={handleLinkOwner}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Confirm Link</Text></TouchableOpacity>
                            </View>
                        )}
                        {form.owners.length > 0 && (
                            <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 20 }}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textSecondary, marginBottom: 16, textTransform: 'uppercase' }}>Linked Portfolio ({form.owners.length})</Text>
                                {form.owners.map((owner, idx) => (
                                    <View key={`${owner.id}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, padding: 14, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
                                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: owner.role === 'Property Owner' ? theme.primary + '15' : theme.textSecondary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}><Ionicons name={owner.role === 'Property Owner' ? "business" : "person"} size={22} color={owner.role === 'Property Owner' ? theme.primary : theme.textSecondary} /></View>
                                        <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', fontSize: 16, color: theme.textPrimary }}>{owner.name}</Text><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}><View style={{ backgroundColor: owner.role === 'Property Owner' ? theme.primary + '20' : theme.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 }}><Text style={{ fontSize: 10, fontWeight: '800', color: owner.role === 'Property Owner' ? theme.primary : theme.textSecondary, textTransform: 'uppercase' }}>{owner.role}</Text></View>{owner.relationship && <Text style={{ fontSize: 12, color: theme.textSecondary }}>• {owner.relationship}</Text>}</View></View>
                                        <TouchableOpacity onPress={() => setForm(f => ({ ...f, owners: f.owners.filter((_, i) => i !== idx) }))} style={{ padding: 8 }}><Ionicons name="trash-outline" size={20} color={theme.error} /></TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    <SectionHeader title="System & Assignment" icon="⚙️" subtitle="Lead routing and visibility" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Field label="Team"><TouchableOpacity activeOpacity={0.7} style={[styles.selector, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => setActiveLocDropdown('team')}><Text style={[styles.selectorText, { color: theme.textPrimary }, !form.team && { color: theme.textMuted }]}>{teams.find(t => t.value === form.team)?.label || "Select Team"}</Text><Ionicons name="chevron-down" size={18} color={theme.textSecondary} /></TouchableOpacity></Field>
                        <Field label="Assigned To"><TouchableOpacity activeOpacity={0.7} style={[styles.selector, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => setActiveLocDropdown('assignedTo')}><Text style={[styles.selectorText, { color: theme.textPrimary }, !form.assignedTo && { color: theme.textMuted }]}>{users.find(u => u.value === form.assignedTo)?.label || "Select User"}</Text><Ionicons name="chevron-down" size={18} color={theme.textSecondary} /></TouchableOpacity></Field>
                        <Field label="Visible To"><SelectButton value={form.visibleTo} options={[{ label: 'Everyone', value: 'Everyone' }, { label: 'Team Only', value: 'Team Only' }, { label: 'Me Only', value: 'Me Only' }]} onSelect={set("visibleTo")} /></Field>
                    </View>
                </FadeInView>
            );
            default: return null;
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <View style={[styles.header, { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                    <TouchableOpacity
                        onPress={() => {
                            if (step > 0) {
                                setStep(step - 1);
                            } else {
                                // Try to go back, with a fallback to the inventory list
                                try {
                                    router.back();
                                } catch (e) {
                                    router.replace("/(tabs)/inventory");
                                }
                            }
                        }}
                        style={[styles.closeBtn, { backgroundColor: theme.inputBg }]}
                    >
                        <Ionicons name={step > 0 ? "arrow-back" : "close"} size={26} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{FORM_STEPS[step]}</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Step {step + 1} of {FORM_STEPS.length}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.replace("/(tabs)/inventory")}
                        style={[styles.closeBtn, { backgroundColor: 'transparent' }]}
                    >
                        {step > 0 && <Ionicons name="close" size={24} color={theme.textSecondary} />}
                    </TouchableOpacity>
                </View>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${((step + 1) / FORM_STEPS.length) * 100}%` }]} />
                    </View>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {renderStepContent()}
                    <View style={{ height: 120 }} />
                </ScrollView>

                <View style={[styles.stickyFooter, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
                    {step > 0 && <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setStep(step - 1)}><Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Back</Text></TouchableOpacity>}
                    <Animated.View style={{ flex: 1, transform: [{ translateX: shakeAnim }] }}>
                        {step < FORM_STEPS.length - 1 ? (
                            <Pressable onPress={handleNext} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
                                <Text style={styles.saveBtnText}>Next Step</Text><Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                            </Pressable>
                        ) : (
                            <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.success }, saving && { opacity: 0.6 }]}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Inventory</Text>}
                            </Pressable>
                        )}
                    </Animated.View>
                </View>

                {/* Modals for Searchable Dropdowns */}
                <SearchableDropdown visible={projectModalVisible} onClose={() => setProjectModalVisible(false)} options={projects.map(p => ({ label: p.name, value: p.name }))} placeholder="Search Project" onSelect={(val) => setForm(f => ({ ...f, projectName: val, projectId: projects.find(p => p.name === val)?._id || "", block: "", size: "" }))} />
                <SearchableDropdown visible={activeLocDropdown === 'country'} onClose={() => setActiveLocDropdown(null)} options={countries.map(c => ({ label: c.lookup_value, value: c._id }))} placeholder="Search Country" onSelect={setAddress('country')} />
                <SearchableDropdown visible={activeLocDropdown === 'state'} onClose={() => setActiveLocDropdown(null)} options={states.map(s => ({ label: s.lookup_value, value: s._id }))} placeholder="Search State" onSelect={setAddress('state')} />
                <SearchableDropdown visible={activeLocDropdown === 'city'} onClose={() => setActiveLocDropdown(null)} options={cities.map(c => ({ label: c.lookup_value, value: c._id }))} placeholder="Search City" onSelect={setAddress('city')} />
                <SearchableDropdown visible={activeLocDropdown === 'location'} onClose={() => setActiveLocDropdown(null)} options={locations.map(l => ({ label: l.lookup_value, value: l._id }))} placeholder="Search Location" onSelect={setAddress('location')} />
                <SearchableDropdown visible={activeLocDropdown === 'team'} onClose={() => setActiveLocDropdown(null)} options={teams} placeholder="Search Team" onSelect={(val) => setForm(f => ({ ...f, team: val, assignedTo: "" }))} />
                <SearchableDropdown visible={activeLocDropdown === 'assignedTo'} onClose={() => setActiveLocDropdown(null)} options={users.filter(u => !form.team || u.team === form.team)} placeholder="Search User" onSelect={(val) => setForm(f => ({ ...f, assignedTo: val }))} />
                <ContactSearchModal visible={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} onSelect={(c) => setSelectedOwner(c)} />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: Platform.OS === 'ios' ? 10 : 40, zIndex: 1000 },
    closeBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: "800" },
    headerSubtitle: { fontSize: 11, marginTop: 2, fontWeight: '700', textTransform: 'uppercase' },
    progressContainer: { paddingHorizontal: 20, marginBottom: 12, marginTop: 8 },
    progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    content: { flex: 1, paddingHorizontal: SPACING.outer },
    card: { borderRadius: 24, padding: SPACING.card, marginBottom: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
    sectionHeader: { marginTop: 4, marginBottom: 20 },
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
    chipRow: { flexDirection: "row", marginBottom: 4 },
    chipRowContent: { paddingRight: 20 },
    selectableChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, marginRight: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    selectableChipText: { fontSize: 14, fontWeight: "600" },
    selector: { height: SPACING.inputHeight, borderRadius: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5 },
    selectorText: { fontSize: 16, fontWeight: '600' },
    stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, flexDirection: 'row', gap: 12, borderTopWidth: 1 },
    saveBtn: { flex: 1, height: 56, borderRadius: 18, flexDirection: 'row', justifyContent: "center", alignItems: "center", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    cancelBtn: { paddingHorizontal: 20, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
    cancelBtnText: { fontSize: 16, fontWeight: "700" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)" },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, height: "85%", padding: 24, marginTop: "auto" },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
    modalSearchInput: { height: 54, borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, fontSize: 16, fontWeight: '600' },
    modalListItem: { paddingVertical: 18, borderBottomWidth: 1 },
    modalListItemText: { fontSize: 16, fontWeight: '600' },
    modalEmptyText: { textAlign: "center", marginTop: 20, fontSize: 15, fontWeight: '500' },
    dimensionRow: { padding: 16, borderRadius: 20, marginBottom: 18, borderWidth: 1.5 },
    dimGrid: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    dimAreaBox: { flex: 1.4, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    dimAreaText: { fontSize: 13, fontWeight: '800' },
    row: { flexDirection: "row", alignItems: "center", gap: 16 },
    helperText: { fontSize: 12, marginTop: 6, marginLeft: 4 },
});
