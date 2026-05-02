import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, StatusBar
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { getLeadById, updateLead } from "@/services/leads.service";
import { addActivity } from "@/services/activities.service";
import { updateLeadStage } from "@/services/stageEngine.service";

export default function ReviveLeadScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams();
    const id = params.id as string;
    const { theme } = useTheme();
    const { propertyConfig, getLookupsByType } = useLookup();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState(1);
    const [lead, setLead] = useState<any>(null);

    const [formData, setFormData] = useState({
        description: "",
        requirement: "Buy",
        propertyType: [] as string[],
        subType: [] as string[],
        unitType: [] as string[],
        budgetMin: "",
        budgetMax: "",
        locCity: "",
        locArea: "",
        projectName: [] as string[],
        facing: [] as string[],
        direction: [] as string[]
    });

    const requirements = getLookupsByType("Requirement");
    const categories = getLookupsByType("Category");
    const subCategories = getLookupsByType("SubCategory");
    const unitTypes = getLookupsByType("UnitType");
    const facings = getLookupsByType("Facing");
    const directions = getLookupsByType("Direction");

    useEffect(() => {
        if (id) fetchLead();
    }, [id]);

    const fetchLead = async () => {
        try {
            const res = await getLeadById(id);
            const data = res?.data ?? res;
            setLead(data);
            
            const rid = data.requirement?._id || data.requirement || "";
            const pts = Array.isArray(data.propertyType) ? data.propertyType.map((x: any) => x?._id || x) : [];
            const sts = Array.isArray(data.subType) ? data.subType.map((x: any) => x?._id || x) : [];
            const uts = Array.isArray(data.unitType) ? data.unitType.map((x: any) => x?._id || x) : [];
            const fcs = Array.isArray(data.facing) ? data.facing.map((x: any) => x?._id || x) : [];
            const drs = Array.isArray(data.direction) ? data.direction.map((x: any) => x?._id || x) : [];

            setFormData(prev => ({
                ...prev,
                requirement: rid || "Buy",
                budgetMin: data.budgetMin ? String(data.budgetMin) : "",
                budgetMax: data.budgetMax ? String(data.budgetMax) : "",
                locCity: data.locCity || "",
                locArea: data.locArea || "",
                propertyType: pts,
                subType: sts,
                unitType: uts,
                projectName: Array.isArray(data.projectName) ? data.projectName : [],
                facing: fcs,
                direction: drs,
            }));
        } catch (error) {
            Alert.alert("Error", "Failed to load lead data");
        } finally {
            setLoading(false);
        }
    };

    const handleRevive = async () => {
        if (!formData.description) {
            Alert.alert("Required", "Please provide revival notes.");
            return;
        }
        setSaving(true);
        try {
            await updateLead(id, { ...formData });
            const activityPayload = {
                type: "Call",
                subject: "Lead Revival Call",
                entityId: id,
                entityType: "Lead",
                dueDate: new Date().toISOString().split('T')[0],
                dueTime: new Date().toTimeString().slice(0, 5),
                priority: "High",
                status: "Completed",
                description: `[Mobile Revival] ${formData.description}`,
                details: {
                    purpose: "Revival / Re-engagement",
                    callOutcome: "Connected",
                    direction: "Outgoing Call",
                }
            };
            await addActivity(activityPayload);
            await updateLeadStage(id, "Prospect", {
                activityType: "Call",
                outcome: "Interested",
                reason: formData.description,
                triggeredBy: "activity"
            });
            Alert.alert("Success", "Lead revived!", [{ text: "OK", onPress: () => router.push(`/lead-detail?id=${id}`) }]);
        } catch (error) {
            Alert.alert("Error", "Revival failed");
        } finally {
            setSaving(false);
        }
    };

    const renderStepContent = () => {
        if (step === 1) {
            return (
                <View style={styles.section}>
                    <View style={[styles.infoBox, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                        <Ionicons name="information-circle" size={20} color={theme.primary} />
                        <Text style={[styles.infoText, { color: theme.text }]}>Summarize the re-engagement call to proceed.</Text>
                    </View>
                    <Text style={[styles.label, { color: theme.text }]}>Notes</Text>
                    <TextInput
                        style={[styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                        multiline
                        placeholder="Call summary..."
                        placeholderTextColor={theme.textLight}
                        value={formData.description}
                        onChangeText={(val) => setFormData(p => ({ ...p, description: val }))}
                    />
                </View>
            );
        }

        return (
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Update Requirements</Text>
                <Text style={[styles.label, { color: theme.text }]}>Intent</Text>
                <View style={styles.chipRow}>
                    {requirements.map(it => (
                        <TouchableOpacity 
                            key={it._id} 
                            style={[styles.chip, { backgroundColor: formData.requirement === it._id ? theme.primary : theme.card, borderColor: theme.border }]}
                            onPress={() => setFormData(p => ({ ...p, requirement: it._id }))}
                        >
                            <Text style={[styles.chipText, { color: formData.requirement === it._id ? "#fff" : theme.text }]}>{it.lookup_value}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {/* Simplified for robustness */}
                <View style={styles.row}>
                    <View style={styles.flex1}>
                        <Text style={[styles.label, { color: theme.text }]}>Min Budget</Text>
                        <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]} keyboardType="numeric" value={formData.budgetMin} onChangeText={v => setFormData(p => ({ ...p, budgetMin: v }))} />
                    </View>
                    <View style={[styles.flex1, { marginLeft: 10 }]}>
                        <Text style={[styles.label, { color: theme.text }]}>Max Budget</Text>
                        <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]} keyboardType="numeric" value={formData.budgetMax} onChangeText={v => setFormData(p => ({ ...p, budgetMax: v }))} />
                    </View>
                </View>
            </View>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;

    const isDark = theme.background === '#0F172A' || theme.background === '#121212';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Revive Lead</Text>
                    <Text style={[styles.headerSub, { color: theme.textLight }]}>Step {step} of 2</Text>
                </View>
                <TouchableOpacity onPress={() => step === 1 ? setStep(2) : handleRevive()} disabled={saving}>
                    <Text style={[styles.nextBtn, { color: theme.primary }]}>{step === 1 ? "Next" : "Finish"}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {renderStepContent()}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitleContainer: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '900' },
    headerSub: { fontSize: 12, fontWeight: '600' },
    nextBtn: { fontSize: 16, fontWeight: '800' },
    scrollContent: { padding: 20 },
    section: { gap: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
    infoBox: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12, marginBottom: 8 },
    infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
    textArea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, height: 120, textAlignVertical: 'top' },
    input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, height: 48 },
    row: { flexDirection: 'row' },
    flex1: { flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    chipText: { fontSize: 13, fontWeight: '700' },
});
