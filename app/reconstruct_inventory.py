
import os

filepath = "/Applications/Bharat Properties/mobile-app/app/add-inventory.tsx"

code = """import React, { useState, useEffect } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
    Modal, FlatList
} from "react-native";
import { useRouter } from "expo-router";
import api from "./services/api";
import { Ionicons } from "@expo/vector-icons";

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
            style={[styles.input, multiline && { height: 80, textAlignVertical: "top" }, !editable && { backgroundColor: "#F1F5F9", color: "#94A3B8" }]}
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
    if (options.length === 0) return <Text style={{ color: '#9CA3AF', fontSize: 13, padding: 8 }}>{placeholder}</Text>;

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
                        ListEmptyComponent={<Text style={styles.modalEmptyText}>No results found</Text>}
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

    // Master Data States
    const [propertyConfig, setPropertyConfig] = useState<any>({});
    const [masterFields, setMasterFields] = useState<any>({});
    const [projects, setProjects] = useState<any[]>([]);
    const [sizes, setSizes] = useState<any[]>([]);

    const [facingLookups, setFacingLookups] = useState<any[]>([]);

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
        const fetchSystemData = async () => {
            try {
                const [pc, mf, pj, sz, tm, ur] = await Promise.all([
                    api.get("/system-settings/property_config"),
                    api.get("/system-settings/master_fields"),
                    api.get("/projects?limit=100"),
                    api.get("/projects/sizes/all?limit=1000"), // Assuming this endpoint exists based on AddSizeModal
                    api.get("/lookups?lookup_type=Team&limit=100"),
                    api.get("/users?limit=1000"),
                ]);
                setPropertyConfig(pc.data?.data || {});
                setMasterFields(mf.data?.data || {});
                setProjects(pj.data?.data || []);
                setSizes(sz.data?.data || []);
                setTeams((tm.data?.data || []).map((t: any) => ({ label: t.lookup_value, value: t._id })));
                setUsers((ur.data?.records || ur.data?.data || []).map((u: any) => ({ label: u.name || u.fullName, value: u._id, team: u.team })));
            } catch (e) { console.error("System data fetch failed", e); }
        };
        fetchSystemData();
    }, []);

    const handleSave = async () => {
        if (!form.projectName || !form.unitNo || !form.subCategory) {
            Alert.alert("Missing Fields", "Please fill in Project, Unit No, and Sub Category.");
            return;
        }
        setSaving(true);
        try {
            // Helper to get ID for lookup values
            const findId = (items: any[], val: string) => items.find(i => i.lookup_value === val)?._id || val;

            const payload = {
                ...form,
                category: findId(masterFields.categories || [], form.category),
                subCategory: findId(masterFields.subCategories || [], form.subCategory),
                // etc. (Add all mapping as per web)
            };

            const res = await api.post("/inventory", payload);
            if (res.data?.success) {
                Alert.alert("Success", "Inventory saved successfully.");
                router.replace("/(tabs)/inventory");
            } else {
                throw new Error(res.data?.message || "Failed to save");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to save inventory.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <View style={styles.header}>
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
                    >
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Add Inventory</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color="#2563EB" /> : <Text style={styles.saveHeader}>Save</Text>}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                            <TouchableOpacity style={styles.selector} onPress={() => setProjectModalVisible(true)}>
                                <Text style={[styles.selectorText, !form.projectName && { color: "#9CA3AF" }]}>
                                    {form.projectName || "Select Project"}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </Field>

                        <Field label="Block" required>
                            <SelectButton value={form.block} placeholder="Select Project first"
                                options={(projects.find(p => p.name === form.projectName)?.blocks || []).map((b: any) => ({ label: typeof b === 'string' ? b : b.name, value: typeof b === 'string' ? b : b.name }))}
                                onSelect={set("block")} />
                        </Field>

                        <Field label="Unit No." required>
                            <Input value={form.unitNo} onChangeText={set("unitNo")} placeholder="e.g. 101" />
                        </Field>
                    </View>

                    <SectionHeader title="Builtup Details" icon="📐" />
                    <View style={styles.card}>
                        <Field label="Built-up Detail" required>
                            <SelectButton value={form.builtupDetail} placeholder="Select Sub Category first" options={builtupDetailLookups}
                                onSelect={(val) => setForm(f => ({ ...f, builtupDetail: val, builtupType: "" }))} />
                        </Field>

                        <Field label="Built-up Type">
                            <SelectButton value={form.builtupType} placeholder="Select Built-up Detail first" options={btLookups} onSelect={set("builtupType")} />
                        </Field>
                    </View>

                    {/* Additional sections would go here... */}

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Inventory</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>

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
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
    saveHeader: { fontSize: 16, fontWeight: "600", color: "#2563EB" },
    content: { flex: 1, padding: 16 },
    sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 24, marginBottom: 12 },
    sectionIcon: { fontSize: 20, marginRight: 8 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
    card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
    field: { marginBottom: 16 },
    fieldLabel: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 8 },
    required: { color: "#EF4444" },
    input: { height: 44, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 12, fontSize: 15, color: "#1E293B" },
    selector: { height: 44, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    selectorText: { fontSize: 15, color: "#1E293B" },
    chipRow: { flexDirection: "row" },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9", marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
    chipSelected: { backgroundColor: "#EFF6FF", borderColor: "#3B82F6" },
    chipText: { fontSize: 13, fontWeight: "500", color: "#64748B" },
    chipTextSelected: { color: "#2563EB" },
    footer: { marginTop: 32, marginBottom: 64 },
    saveBtn: { backgroundColor: "#2563EB", height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "80%", padding: 20 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
    modalSearchInput: { height: 44, backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 16, marginBottom: 16 },
    modalListItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    modalListItemText: { fontSize: 16, color: "#1E293B" },
    modalEmptyText: { textAlign: "center", color: "#64748B", marginTop: 40 },
});
\"\"\"

with open(filepath, "w") as f:
    f.write(code)
print("Successfully reconstructed the file.")
"""

with open(filepath, "w") as f:
    f.write(code)
