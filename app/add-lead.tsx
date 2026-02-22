import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Switch, Modal, FlatList, SafeAreaView, Platform
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { getTeams, getTeamMembers } from "./services/teams.service";
import { getLeadById, addLead, updateLead, checkDuplicates } from "./services/leads.service";
import { getLookups } from "./services/lookups.service";
import { getProjects } from "./services/projects.service";
import api from "./services/api";

const LEAD_LOOKUP_TYPES = [
    "Requirement", "Category", "SubCategory", "PropertyType",
    "Budget", "Facing", "Direction", "Status", "Campaign",
    "Sub Campaign", "Source", "SubSource"
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

// --- Constants & Helpers ---
const FORM_STEPS = ["Requirement", "Location", "Contact", "System"];

function FormLabel({ label, required }: { label: string; required?: boolean }) {
    return (
        <View style={styles.labelContainer}>
            <Text style={styles.label}>{label}</Text>
            {required && <Text style={styles.required}>*</Text>}
        </View>
    );
}

function SectionTitle({ title, icon }: { title: string; icon: string }) {
    return (
        <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionIcon}>{icon}</Text>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    );
}

export default function AddLeadScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form State (Full parity with Web CRM)
    const [formData, setFormData] = useState<any>({
        // Identity
        salutation: "Mr.",
        firstName: "",
        lastName: "",
        mobile: "",
        email: "",

        // Requirement
        requirement: "Buy",
        purpose: "End Use",
        nri: false,
        propertyType: [], // Category
        subType: [], // Sub Category
        unitType: [], // Size Type
        budget: "",
        budgetMin: "",
        budgetMax: "",
        areaMin: "",
        areaMax: "",
        areaMetric: "Sq Yard",
        facing: [], // Multi
        roadWidth: [], // Multi
        direction: [], // Multi
        funding: "",
        timeline: "",
        furnishing: "",
        transactionType: "",

        // Location
        searchLocation: "",
        locCity: "",
        locArea: "",
        locPinCode: "",
        locRange: 5, // km
        projectName: [], // Multi
        projectTowers: [], // Specific towers
        propertyNo: "", // Single/Start
        propertyNoEnd: "", // End for range
        unitSelectionMode: "Single", // Single, Multiple, Range

        // System / Assignment
        status: "",
        source: "",
        subSource: "",
        campaign: "",
        subCampaign: "",
        owner: "",
        team: "",
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
                        source: l.source?._id || l.source || "",
                        subSource: l.subSource?._id || l.subSource || "",
                        campaign: l.campaign?._id || l.campaign || "",
                        subCampaign: l.subCampaign?._id || l.subCampaign || "",
                        owner: l.owner?._id || l.owner || l.assignment?.assignedTo?._id || "",
                        team: l.team?._id || l.team || "",
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
                // Map projectTowers to locBlock for backend schema alignment
                locBlock: formData.projectTowers,
                budgetMin: formData.budgetMin ? Number(formData.budgetMin) : undefined,
                budgetMax: formData.budgetMax ? Number(formData.budgetMax) : undefined,
                areaMin: formData.areaMin ? Number(formData.areaMin) : undefined,
                areaMax: formData.areaMax ? Number(formData.areaMax) : undefined,
            };

            // Remove mobile-only ui state
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

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E3A8A" /></View>;

    const renderMultiSelect = (type: string, field: string) => {
        const list = lookups[type];
        if (!Array.isArray(list)) return null;
        return (
            <View style={styles.chipGroup}>
                {list.map((item) => {
                    const active = formData[field]?.includes(item._id);
                    return (
                        <TouchableOpacity
                            key={item._id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => {
                                const newList = active
                                    ? formData[field].filter((id: string) => id !== item._id)
                                    : [...formData[field], item._id];
                                setFormData({ ...formData, [field]: newList });
                            }}
                        >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.lookup_value}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderSingleSelect = (type: string, field: string, parentId?: string) => {
        let list = lookups[type];
        if (!Array.isArray(list)) return null;

        // Apply filtering if parentId is provided
        if (parentId) {
            list = list.filter(item => item.parent_lookup_id === parentId || item.parent_lookup_value === parentId);
        }

        return (
            <View style={styles.chipGroup}>
                {list.map((item) => (
                    <TouchableOpacity
                        key={item._id}
                        style={[styles.chip, formData[field] === item._id && styles.chipActive]}
                        onPress={() => setFormData({ ...formData, [field]: item._id })}
                    >
                        <Text style={[styles.chipText, formData[field] === item._id && styles.chipTextActive]}>{item.lookup_value}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderDependentMultiSelect = (type: string, field: string, parentIds: string[]) => {
        let list = lookups[type];
        if (!Array.isArray(list)) return null;

        if (parentIds && parentIds.length > 0) {
            const pIds = parentIds.map(id => String(id));

            // Find names of parents for hierarchy fallback
            const parentValues: string[] = [];
            Object.values(lookups).flat().forEach((l: any) => {
                if (pIds.includes(String(l._id))) {
                    parentValues.push(l.lookup_value);
                }
            });

            list = list.filter(item => {
                // Backend relationship match
                return (
                    pIds.includes(String(item.parent_lookup_id)) ||
                    pIds.includes(String(item.parent_lookup_value)) ||
                    parentValues.includes(item.parent_lookup_value)
                );
            });
        } else {
            return <Text style={styles.hintText}>Select parent field first</Text>;
        }

        if (list.length === 0) return <Text style={styles.hintText}>No options found for selection</Text>;

        return (
            <View style={styles.chipGroup}>
                {list.map((item) => {
                    const active = formData[field]?.includes(item._id);
                    return (
                        <TouchableOpacity
                            key={item._id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => {
                                const newList = active
                                    ? formData[field].filter((id: string) => id !== item._id)
                                    : [...formData[field], item._id];
                                setFormData({ ...formData, [field]: newList });
                            }}
                        >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.lookup_value}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderStepContent = () => {
        switch (step) {
            case 0: // Requirement
                return (
                    <View style={styles.stepContainer}>
                        <SectionTitle title="Requirement Details" icon="📋" />

                        <FormLabel label="Requirement" required />
                        <View style={styles.chipRow}>
                            {["Buy", "Rent", "Lease"].map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.chip, formData.requirement === r && styles.chipActive]}
                                    onPress={() => setFormData({ ...formData, requirement: r })}
                                >
                                    <Text style={[styles.chipText, formData.requirement === r && styles.chipTextActive]}>{r}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <FormLabel label="Category" />
                        {renderMultiSelect("Category", "propertyType")}

                        <FormLabel label="Sub Category" />
                        {renderDependentMultiSelect("SubCategory", "subType", formData.propertyType)}

                        <FormLabel label="Size Type" />
                        {renderDependentMultiSelect("PropertyType", "unitType", formData.subType)}

                        <FormLabel label="Budget Range" />
                        <View style={styles.budgetRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subLabel}>Min Budget</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.budgetScroll}>
                                    {BUDGET_VALUES.map((opt) => (
                                        <TouchableOpacity
                                            key={`min-${opt.value}`}
                                            style={[styles.budgetChip, formData.budgetMin === String(opt.value) && styles.chipActive]}
                                            onPress={() => setFormData({ ...formData, budgetMin: String(opt.value) })}
                                        >
                                            <Text style={[styles.budgetChipText, formData.budgetMin === String(opt.value) && styles.chipTextActive]}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>
                        <View style={[styles.budgetRow, { marginTop: 10 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subLabel}>Max Budget</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.budgetScroll}>
                                    {BUDGET_VALUES
                                        .filter(opt => !formData.budgetMin || opt.value > Number(formData.budgetMin))
                                        .map((opt) => (
                                            <TouchableOpacity
                                                key={`max-${opt.value}`}
                                                style={[styles.budgetChip, formData.budgetMax === String(opt.value) && styles.chipActive]}
                                                onPress={() => setFormData({ ...formData, budgetMax: String(opt.value) })}
                                            >
                                                <Text style={[styles.budgetChipText, formData.budgetMax === String(opt.value) && styles.chipTextActive]}>{opt.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                </ScrollView>
                            </View>
                        </View>

                        <FormLabel label="Area Range" />
                        <View style={styles.row}>
                            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Min Area" keyboardType="numeric" value={formData.areaMin} onChangeText={v => setFormData({ ...formData, areaMin: v })} />
                            <View style={{ width: 10 }} />
                            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Max Area" keyboardType="numeric" value={formData.areaMax} onChangeText={v => setFormData({ ...formData, areaMax: v })} />
                        </View>

                        <FormLabel label="Facing" />
                        {renderMultiSelect("Facing", "facing")}

                        <FormLabel label="Direction" />
                        {renderMultiSelect("Direction", "direction")}

                        <FormLabel label="Purpose" />
                        <View style={styles.row}>
                            {["End Use", "Investment"].map(v => (
                                <TouchableOpacity key={v} style={[styles.chip, formData.purpose === v && styles.chipActive, { marginRight: 8 }]} onPress={() => setFormData({ ...formData, purpose: v })}>
                                    <Text style={[styles.chipText, formData.purpose === v && styles.chipTextActive]}>{v}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.rowAlign}>
                            <Text style={styles.label}>NRI Status</Text>
                            <Switch value={formData.nri} onValueChange={v => setFormData({ ...formData, nri: v })} />
                        </View>
                    </View>
                );
            case 1: // Location
                return (
                    <View style={styles.stepContainer}>
                        <SectionTitle title="Location & Range" icon="📍" />

                        <FormLabel label="Search Location" />
                        <View style={styles.googleSearchContainer}>
                            <GooglePlacesAutocomplete
                                placeholder="Area, sector or city..."
                                onPress={(data, details) => {
                                    if (details) {
                                        const locObj = {
                                            searchLocation: data.description,
                                            locCity: details?.address_components?.find((c: any) => c.types.includes("locality"))?.long_name || "",
                                            locArea: details?.address_components?.find((c: any) => c.types.includes("sublocality"))?.long_name || ""
                                        };
                                        setFormData((prev: any) => ({ ...prev, ...locObj }));
                                    }
                                }}
                                query={{
                                    key: GOOGLE_API_KEY,
                                    language: "en",
                                    components: "country:in",
                                }}
                                styles={{
                                    textInput: styles.input,
                                    container: { flex: 0 },
                                    listView: { backgroundColor: "#ffffff", borderRadius: 10, marginTop: 5, elevation: 5, zIndex: 1000 }
                                }}
                                fetchDetails={true}
                                enablePoweredByContainer={false}
                                textInputProps={{
                                    value: formData.searchLocation,
                                    onChangeText: (v: string) => setFormData((prev: any) => ({ ...prev, searchLocation: v }))
                                }}
                            />
                        </View>

                        <View style={styles.rangeBox}>
                            <View style={styles.rowAlign}>
                                <Text style={styles.label}>Location Range ({formData.locRange} km)</Text>
                                <Text style={styles.rangeValue}>{formData.locRange === 100 ? "100+ km" : `${formData.locRange} km`}</Text>
                            </View>
                            {/* Simple alternative to Slider if not installed: custom numeric buttons or text input */}
                            <View style={styles.chipRow}>
                                {[1, 5, 10, 25, 50, 100].map(r => (
                                    <TouchableOpacity
                                        key={r}
                                        style={[styles.chip, formData.locRange === r && styles.chipActive]}
                                        onPress={() => setFormData({ ...formData, locRange: r })}
                                    >
                                        <Text style={[styles.chipText, formData.locRange === r && styles.chipTextActive]}>{r === 100 ? "100+" : r}km</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <SectionTitle title="Project & Unit Selection" icon="🏗️" />

                        <FormLabel label="Select Projects" />
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

                        {formData.projectName.length > 0 && (
                            <View>
                                <FormLabel label="Select Towers/Blocks" />
                                <View style={styles.chipGroup}>
                                    {projects
                                        .filter(p => formData.projectName.includes(p.name))
                                        .flatMap(p => (p.blocks || []).map((b: any) => ({ projectId: p._id, projectName: p.name, block: typeof b === 'string' ? b : b.name })))
                                        .map((item, idx) => {
                                            const key = `${item.projectName}-${item.block}`;
                                            const active = formData.projectTowers.includes(key);
                                            return (
                                                <TouchableOpacity
                                                    key={`${idx}-${item.block}`}
                                                    style={[styles.chip, active && styles.chipActive]}
                                                    onPress={() => {
                                                        const newList = active
                                                            ? formData.projectTowers.filter((t: string) => t !== key)
                                                            : [...formData.projectTowers, key];
                                                        setFormData((prev: any) => ({ ...prev, projectTowers: newList }));
                                                    }}
                                                >
                                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.block} ({item.projectName})</Text>
                                                </TouchableOpacity>
                                            );
                                        })
                                    }
                                </View>

                                <FormLabel label="Unit Selection Mode" />
                                <View style={styles.selectionModeRow}>
                                    {["Single", "Multiple", "Range"].map(mode => (
                                        <TouchableOpacity
                                            key={mode}
                                            style={[styles.modeBtn, formData.unitSelectionMode === mode && styles.modeBtnActive]}
                                            onPress={() => setFormData({ ...formData, unitSelectionMode: mode })}
                                        >
                                            <Text style={[styles.modeBtnText, formData.unitSelectionMode === mode && styles.modeBtnTextActive]}>{mode}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {formData.unitSelectionMode === "Single" && (
                                    <View>
                                        <FormLabel label="Unit Number" />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. 101"
                                            value={formData.propertyNo}
                                            onChangeText={v => setFormData({ ...formData, propertyNo: v })}
                                        />
                                    </View>
                                )}

                                {formData.unitSelectionMode === "Multiple" && (
                                    <View>
                                        <FormLabel label="Unit Numbers (Comma separated)" />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. 101, 102, 205"
                                            value={formData.propertyNo}
                                            onChangeText={v => setFormData({ ...formData, propertyNo: v })}
                                        />
                                    </View>
                                )}

                                {formData.unitSelectionMode === "Range" && (
                                    <View style={styles.row}>
                                        <View style={{ flex: 1 }}>
                                            <FormLabel label="Start Unit" />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="e.g. 1"
                                                value={formData.propertyNo}
                                                onChangeText={v => setFormData({ ...formData, propertyNo: v })}
                                            />
                                        </View>
                                        <View style={{ width: 10 }} />
                                        <View style={{ flex: 1 }}>
                                            <FormLabel label="End Unit" />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="e.g. 10"
                                                value={formData.propertyNoEnd}
                                                onChangeText={v => setFormData({ ...formData, propertyNoEnd: v })}
                                            />
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );
            case 2: // Contact
                return (
                    <View style={styles.stepContainer}>
                        <SectionTitle title="Identity & Contact" icon="👤" />

                        {Array.isArray(duplicates) && duplicates.length > 0 && (
                            <View style={[styles.warningBox, isBlocked && styles.errorBox]}>
                                <Text style={styles.warningTitle}>⚠️ {duplicates.length} Similar record(s) found</Text>
                                {duplicates.map((d, i) => (
                                    <Text key={i} style={styles.dupItem}>{d.firstName} {d.lastName} ({d.mobile || (Array.isArray(d.phones) && d.phones[0]?.number)})</Text>
                                ))}
                            </View>
                        )}

                        <View style={styles.row}>
                            <View style={{ width: 80 }}><FormLabel label="Title" /><TextInput style={styles.input} value={formData.salutation} onChangeText={v => setFormData({ ...formData, salutation: v })} /></View>
                            <View style={{ width: 10 }} />
                            <View style={{ flex: 1 }}><FormLabel label="First Name" required /><TextInput style={styles.input} value={formData.firstName} onChangeText={v => setFormData({ ...formData, firstName: v })} /></View>
                        </View>
                        <FormLabel label="Last Name" /><TextInput style={styles.input} value={formData.lastName} onChangeText={v => setFormData({ ...formData, lastName: v })} />

                        <FormLabel label="Mobile Number" required />
                        <TextInput style={styles.input} keyboardType="phone-pad" value={formData.mobile} onChangeText={v => setFormData({ ...formData, mobile: v })} />

                        <FormLabel label="Email" />
                        <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={formData.email} onChangeText={v => setFormData({ ...formData, email: v })} />
                    </View>
                );
            case 3: // System
                return (
                    <View style={styles.stepContainer}>
                        <SectionTitle title="System & Assignment" icon="🏷️" />

                        <FormLabel label="Status" />
                        {renderSingleSelect("Status", "status")}

                        <FormLabel label="Campaign" />
                        {renderSingleSelect("Campaign", "campaign")}

                        <FormLabel label="Sub Campaign" />
                        {renderSingleSelect("Sub Campaign", "subCampaign", formData.campaign)}

                        <FormLabel label="Source" />
                        {renderSingleSelect("Source", "source")}

                        <FormLabel label="Sub Source" />
                        {renderSingleSelect("SubSource", "subSource", formData.source)}

                        <FormLabel label="Team" />
                        <View style={styles.chipGroup}>
                            {teams.map((t) => (
                                <TouchableOpacity key={t._id} style={[styles.chip, formData.team === t._id && styles.chipActive]} onPress={() => setFormData({ ...formData, team: t._id, owner: "" })}>
                                    <Text style={[styles.chipText, formData.team === t._id && styles.chipTextActive]}>{t.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <FormLabel label="Assigned To" />
                        <View style={styles.chipGroup}>
                            {users.filter(u => !formData.team || u.team === formData.team).map((u) => (
                                <TouchableOpacity key={u._id} style={[styles.chip, formData.owner === u._id && styles.chipActive]} onPress={() => setFormData({ ...formData, owner: u._id })}>
                                    <Text style={[styles.chipText, formData.owner === u._id && styles.chipTextActive]}>{u.fullName || u.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <FormLabel label="Notes" />
                        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={formData.description} onChangeText={v => setFormData({ ...formData, description: v })} />
                    </View>
                );
            default: return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/(tabs)/leads");
                        }
                    }}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{id ? "Edit Lead" : "Add Lead"}</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.stepper}>
                {FORM_STEPS.map((s, i) => (
                    <View key={i} style={styles.stepItem}>
                        <View style={[styles.stepCircle, step >= i && styles.stepCircleActive]}><Text style={[styles.stepNum, step >= i && styles.stepNumActive]}>{i + 1}</Text></View>
                        <Text style={[styles.stepLabel, step >= i && styles.stepLabelActive]}>{s}</Text>
                    </View>
                ))}
            </View>

            <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
                {renderStepContent()}
            </ScrollView>

            <View style={styles.footer}>
                {step > 0 && (
                    <TouchableOpacity
                        style={styles.prevBtn}
                        onPress={() => setStep(step - 1)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.prevBtnText}>Back</Text>
                    </TouchableOpacity>
                )}
                {step < FORM_STEPS.length - 1 ? (
                    <TouchableOpacity
                        style={styles.nextBtn}
                        onPress={() => setStep(step + 1)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.nextBtnText}>Next</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.saveBtn, isBlocked && !id && styles.disabledBtn]}
                        onPress={handleSave}
                        disabled={isSaving || (isBlocked && !id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{id ? "Update Lead" : "Save Lead"}</Text>}
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, backgroundColor: "#fff" },
    headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E3A8A" },
    stepper: { flexDirection: "row", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    stepItem: { alignItems: "center", flex: 1 },
    stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center", marginBottom: 4 },
    stepCircleActive: { backgroundColor: "#1E3A8A" },
    stepNum: { fontSize: 11, fontWeight: "700", color: "#64748B" },
    stepNumActive: { color: "#fff" },
    stepLabel: { fontSize: 9, fontWeight: "600", color: "#94A3B8" },
    stepLabelActive: { color: "#1E3A8A" },
    mainScroll: { flex: 1, padding: 20 },
    stepContainer: { paddingBottom: 120 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    sectionIcon: { fontSize: 22, marginRight: 8 },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1E3A8A" },
    labelContainer: { flexDirection: "row", marginBottom: 6, marginTop: 14 },
    label: { fontSize: 13, fontWeight: "600", color: "#475569" },
    required: { color: "#EF4444", marginLeft: 2 },
    input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, fontSize: 15, color: "#1E293B" },
    rowAlign: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
    chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
    chipActive: { backgroundColor: "#1E3A8A", borderColor: "#1E3A8A" },
    chipText: { fontSize: 12, color: "#64748B", fontWeight: "600" },
    chipTextActive: { color: "#fff" },
    row: { flexDirection: "row" },
    projectScroll: { marginBottom: 15 },
    projectCard: {
        padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0",
        marginRight: 10, width: 140, backgroundColor: "#fff"
    },
    projectCardActive: { borderColor: "#1E3A8A", backgroundColor: "#EFF6FF" },
    projectText: { fontWeight: "700", color: "#1E293B", fontSize: 13 },
    projectTextActive: { color: "#1E3A8A" },
    projectSub: { fontSize: 11, color: "#64748B", marginTop: 2 },
    budgetRow: { marginBottom: 10 },
    subLabel: { fontSize: 12, color: "#64748B", marginBottom: 5, fontWeight: "600" },
    budgetScroll: { paddingVertical: 5 },
    budgetChip: {
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
        backgroundColor: "#F1F5F9", marginRight: 8, borderWidth: 1, borderColor: "#E2E8F0"
    },
    budgetChipText: { fontSize: 12, color: "#475569", fontWeight: "600" },
    googleSearchContainer: { zIndex: 10, marginBottom: 15 },
    rangeBox: {
        backgroundColor: "#F8FAFC", padding: 15, borderRadius: 12,
        borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 20
    },
    rangeValue: { fontSize: 14, fontWeight: "700", color: "#1E3A8A" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    selectionModeRow: { flexDirection: "row", gap: 10, marginBottom: 15 },
    modeBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
        borderColor: "#E2E8F0", backgroundColor: "#fff", alignItems: "center"
    },
    modeBtnActive: { borderColor: "#1E3A8A", backgroundColor: "#EFF6FF" },
    modeBtnText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
    modeBtnTextActive: { color: "#1E3A8A" },
    hintText: { fontSize: 12, color: "#94A3B8", fontStyle: "italic", marginBottom: 10 },
    footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F1F5F9", flexDirection: "row", gap: 10 },
    nextBtn: { flex: 1, backgroundColor: "#1E3A8A", height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    prevBtn: { width: 100, backgroundColor: "#F1F5F9", height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    prevBtnText: { color: "#475569", fontSize: 16, fontWeight: "700" },
    saveBtn: { flex: 1, backgroundColor: "#10B981", height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    disabledBtn: { backgroundColor: "#94A3B8" },
    warningBox: { backgroundColor: "#FFFBEB", padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: "#F59E0B", marginBottom: 16 },
    errorBox: { backgroundColor: "#FEF2F2", borderLeftColor: "#EF4444" },
    warningTitle: { fontSize: 13, fontWeight: "700", color: "#92400E", marginBottom: 6 },
    dupItem: { fontSize: 12, color: "#1E293B", marginBottom: 2 },
});
