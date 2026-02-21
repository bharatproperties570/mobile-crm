import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Switch, Modal, FlatList, SafeAreaView
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getTeams, getTeamMembers } from "./services/teams.service";
import { getLeadById, addLead, updateLead, checkDuplicates } from "./services/leads.service";
import { getLookups } from "./services/lookups.service";
import { getProjects } from "./services/projects.service";
import api from "./services/api";

const LEAD_LOOKUP_TYPES = [
    "Requirement", "Property Type", "Sub Type", "Unit Type",
    "Budget", "Facing", "Direction", "Status", "Campaign",
    "Sub Campaign", "Source", "SubSource"
];

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
        requirement: "",
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
        projectName: [], // Multi

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
                        requirement: l.requirement?._id || l.requirement || "",
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
            const res = id ? await updateLead(id, formData) : await addLead(formData);
            if (res.success || res.status === 200 || res.data) {
                Alert.alert("Success", id ? "Lead updated successfully" : "Lead added successfully", [
                    { text: "OK", onPress: () => router.back() }
                ]);
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

        // Filter by parent IDs
        if (parentIds && parentIds.length > 0) {
            list = list.filter(item => parentIds.includes(item.parent_lookup_id) || parentIds.includes(item.parent_lookup_value));
        }

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
    }

    const renderStepContent = () => {
        switch (step) {
            case 0: // Requirement
                return (
                    <View style={styles.stepContainer}>
                        <SectionTitle title="Requirement Details" icon="📋" />

                        <FormLabel label="Requirement" required />
                        {renderSingleSelect("Requirement", "requirement")}

                        <FormLabel label="Category" />
                        {renderMultiSelect("Property Type", "propertyType")}

                        <FormLabel label="Sub Category" />
                        {renderDependentMultiSelect("Sub Type", "subType", formData.propertyType)}

                        <FormLabel label="Size Type" />
                        {renderMultiSelect("Unit Type", "unitType")}

                        <FormLabel label="Budget Range" />
                        {renderSingleSelect("Budget", "budget")}

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
                        <SectionTitle title="Location & Project" icon="📍" />

                        <FormLabel label="Search Location" />
                        <TextInput style={styles.input} placeholder="Area, sector or city..." value={formData.searchLocation} onChangeText={v => setFormData({ ...formData, searchLocation: v })} />

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

                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <FormLabel label="City" />
                                <TextInput style={styles.input} value={formData.locCity} onChangeText={v => setFormData({ ...formData, locCity: v })} />
                            </View>
                            <View style={{ width: 10 }} />
                            <View style={{ flex: 1 }}>
                                <FormLabel label="Area" />
                                <TextInput style={styles.input} value={formData.locArea} onChangeText={v => setFormData({ ...formData, locArea: v })} />
                            </View>
                        </View>
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
                    onPress={() => router.back()}
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
    projectScroll: { marginVertical: 8 },
    projectCard: { width: 130, padding: 10, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 10 },
    projectCardActive: { borderColor: "#1E3A8A", backgroundColor: "#EFF6FF" },
    projectText: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
    projectTextActive: { color: "#1E3A8A" },
    projectSub: { fontSize: 10, color: "#94A3B8", marginTop: 2 },
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
