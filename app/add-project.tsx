import { useState, useCallback, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, Switch, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { createProject, type Project, type ProjectBlock } from "./services/projects.service";
import { getLookups, type Lookup } from "./services/lookups.service";
import { safeApiCall } from "./services/api.helpers";

const STEPS = ["Basic", "Location", "Blocks", "Amenities"];

export default function AddProjectScreen() {
    const router = useRouter();
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
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={prevStep}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <Ionicons name={step === 0 ? "close" : "arrow-back"} size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleGroup}>
                        <Text style={styles.headerTitle}>Add Project</Text>
                        <Text style={styles.headerSub}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Text>
                    </View>
                    {loading ? <ActivityIndicator size="small" color="#1E3A8A" /> : <View style={{ width: 24 }} />}
                </View>

                <View style={styles.stepIndicator}>
                    {STEPS.map((s, i) => (
                        <View
                            key={i}
                            style={[
                                styles.indicatorBar,
                                i <= step && styles.indicatorBarActive,
                                i === step && styles.indicatorBarCurrent
                            ]}
                        />
                    ))}
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {renderStepContent()}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.btnSecondary}
                        onPress={prevStep}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.btnTextSecondary}>{step === 0 ? "Cancel" : "Back"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.btnPrimary}
                        onPress={nextStep}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.btnTextPrimary}>{step === STEPS.length - 1 ? "Finish" : "Next"}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function BasicStep({ data, update, lookups }: { data: Partial<Project>; update: any; lookups: any }) {
    return (
        <View style={styles.formSection}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Project Name *</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Green Valley"
                    value={data.name}
                    onChangeText={txt => update({ ...data, name: txt })}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>RERA Number</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. PBRERA-123"
                    value={data.reraNumber}
                    onChangeText={txt => update({ ...data, reraNumber: txt })}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.chipList}>
                    {lookups["ProjectStatus"]?.map((s: Lookup) => (
                        <TouchableOpacity
                            key={s._id}
                            style={[styles.chip, data.status === s._id && styles.chipActive]}
                            onPress={() => update({ ...data, status: s._id })}
                        >
                            <Text style={[styles.chipText, data.status === s._id && styles.chipTextActive]}>{s.lookup_value}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.grid}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>Land Area</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="e.g. 10"
                        value={data.landArea}
                        onChangeText={txt => update({ ...data, landArea: txt })}
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 0.8 }]}>
                    <Text style={styles.label}>Unit</Text>
                    <View style={styles.chipList}>
                        {["Acres", "Gaj"].map(u => (
                            <TouchableOpacity
                                key={u}
                                style={[styles.chip, data.landAreaUnit === u && styles.chipActive]}
                                onPress={() => update({ ...data, landAreaUnit: u })}
                            >
                                <Text style={[styles.chipText, data.landAreaUnit === u && styles.chipTextActive]}>{u}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

function LocationStep({ data, update }: { data: Partial<Project>; update: any }) {
    return (
        <View style={styles.formSection}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Mohali"
                    value={data.address?.city}
                    onChangeText={txt => update({ ...data, address: { ...data.address, city: txt } })}
                />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Area / Sector</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Sector 82"
                    value={data.address?.location}
                    onChangeText={txt => update({ ...data, address: { ...data.address, location: txt } })}
                />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Address / Landmark</Text>
                <TextInput
                    style={[styles.input, { height: 80 }]}
                    multiline
                    placeholder="e.g. Near Airport Road"
                    value={data.locationSearch}
                    onChangeText={txt => update({ ...data, locationSearch: txt })}
                />
            </View>
        </View>
    );
}

function BlocksStep({ data, update }: { data: Partial<Project>; update: any }) {
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
        <View style={styles.formSection}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Add Block / Phase</Text>
                <View style={styles.grid}>
                    <TextInput
                        style={[styles.input, { flex: 1, marginRight: 8 }]}
                        placeholder="Block A, Phase 1..."
                        value={newBlock}
                        onChangeText={setNewBlock}
                    />
                    <TouchableOpacity style={styles.btnAdd} onPress={addBlock}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.blockList}>
                {data.blocks?.map((b: ProjectBlock, i: number) => (
                    <View key={i} style={styles.blockItem}>
                        <Text style={styles.blockItemText}>{b.name}</Text>
                        <TouchableOpacity onPress={() => removeBlock(i)}>
                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </View>
    );
}

function AmenitiesStep({ data, update }: { data: Partial<Project>; update: any }) {
    const AMENITIES = ["Clubhouse", "Gym", "Swimming Pool", "Gated Community", "Power Backup", "Parks", "Jogging Track"];

    const toggle = (name: string) => {
        update({
            ...data,
            amenities: { ...data.amenities, [name]: !data.amenities?.[name] }
        });
    };

    return (
        <View style={styles.formSection}>
            <Text style={styles.label}>Amenities</Text>
            {AMENITIES.map(a => (
                <View key={a} style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{a}</Text>
                    <Switch
                        value={!!data.amenities?.[a]}
                        onValueChange={() => toggle(a)}
                        trackColor={{ true: "#1E3A8A", false: "#E2E8F0" }}
                    />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: {
        flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
        paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9"
    },
    headerTitleGroup: { flex: 1, marginLeft: 16 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    headerSub: { fontSize: 11, color: "#64748B", fontWeight: "600", marginTop: 2 },
    stepIndicator: { flexDirection: "row", height: 3, backgroundColor: "#F1F5F9" },
    indicatorBar: { flex: 1 },
    indicatorBarActive: { backgroundColor: "#EEF2FF" },
    indicatorBarCurrent: { backgroundColor: "#1E3A8A" },
    scroll: { padding: 20 },
    formSection: { gap: 16 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
    input: {
        backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
        borderRadius: 12, padding: 12, fontSize: 15, color: "#1E293B"
    },
    chipList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0"
    },
    chipActive: { backgroundColor: "#1E3A8A", borderColor: "#1E3A8A" },
    chipText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
    chipTextActive: { color: "#fff" },
    grid: { flexDirection: "row", alignItems: "center" },
    btnAdd: {
        width: 48, height: 48, borderRadius: 12, backgroundColor: "#1E3A8A",
        justifyContent: "center", alignItems: "center"
    },
    blockList: { marginTop: 12, gap: 8 },
    blockItem: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0"
    },
    blockItemText: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
    switchRow: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F8FAFC"
    },
    switchLabel: { fontSize: 15, color: "#475569", fontWeight: "500" },
    footer: {
        flexDirection: "row", padding: 20, borderTopWidth: 1,
        borderTopColor: "#F1F5F9", backgroundColor: "#fff", gap: 12
    },
    btnSecondary: {
        flex: 1, paddingVertical: 14, borderRadius: 12,
        backgroundColor: "#F8FAFC", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0"
    },
    btnPrimary: {
        flex: 2, paddingVertical: 14, borderRadius: 12,
        backgroundColor: "#1E3A8A", alignItems: "center"
    },
    btnTextSecondary: { fontSize: 15, fontWeight: "700", color: "#64748B" },
    btnTextPrimary: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
