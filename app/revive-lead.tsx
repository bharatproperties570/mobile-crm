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
    const { id } = useLocalSearchParams<{ id: string }>();
    const { theme } = useTheme();
    const { propertyConfig } = useLookup();

    const PROPERTY_TYPES = (propertyConfig?.categories || []).map((cat: any) => cat.label);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState(1);
    const [lead, setLead] = useState<any>(null);

    const [formData, setFormData] = useState({
        // Activity
        description: "",
        
        // Requirements
        budgetMin: "",
        budgetMax: "",
        locCity: "",
        locArea: "",
        propertyType: [] as string[]
    });

    useEffect(() => {
        if (id) {
            fetchLead();
        }
    }, [id]);

    const fetchLead = async () => {
        try {
            const res = await getLeadById(id as string);
            const data = res?.data ?? res;
            setLead(data);
            setFormData(prev => ({
                ...prev,
                budgetMin: data.budgetMin ? String(data.budgetMin) : "",
                budgetMax: data.budgetMax ? String(data.budgetMax) : "",
                locCity: data.locCity || "",
                locArea: data.locArea || "",
                propertyType: Array.isArray(data.propertyType) ? data.propertyType : []
            }));
        } catch (error) {
            Alert.alert("Error", "Failed to load lead data");
        } finally {
            setLoading(false);
        }
    };

    const handleRevive = async () => {
        if (!formData.description) {
            Alert.alert("Required", "Please provide a reason or summary for revival.");
            return;
        }

        setSaving(true);
        try {
            // 1. Update Lead Requirements
            await updateLead(id as string, {
                budgetMin: formData.budgetMin,
                budgetMax: formData.budgetMax,
                locCity: formData.locCity,
                locArea: formData.locArea,
                propertyType: formData.propertyType,
            });

            // 2. Add Activity and Trigger Stage Change
            // Note: The backend Activity controller handles stage mapping rules
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
                clientFeedback: formData.description,
                details: {
                    purpose: "Revival / Re-engagement",
                    callOutcome: "Connected",
                    completionResult: "Re-qualified / Interested",
                    direction: "Outgoing Call",
                    completionDate: new Date().toISOString().split('T')[0],
                    completionTime: new Date().toTimeString().slice(0, 5),
                }
            };

            const actRes = await addActivity(activityPayload);
            
            // 3. Explicitly trigger stage update just in case rule didn't fire or for immediate feedback
            await updateLeadStage(id as string, "Prospect", {
                activityType: "Call",
                outcome: "Re-qualified / Interested",
                reason: formData.description,
                triggeredBy: "activity"
            });

            Alert.alert("Success", "Lead has been revived back to Prospect stage", [
                { text: "OK", onPress: () => router.push(`/lead-detail?id=${id}`) }
            ]);
        } catch (error) {
            Alert.alert("Error", "Failed to revive lead. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;

    const isDark = theme.background === '#0F172A';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Revive Lead</Text>
                    <Text style={[styles.headerSub, { color: theme.textLight }]}>Step {step} of 2</Text>
                </View>
                {step === 1 ? (
                    <TouchableOpacity onPress={() => setStep(2)} disabled={!formData.description}>
                        <Text style={[styles.nextBtn, { color: !formData.description ? theme.textLight : theme.primary }]}>Next</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={handleRevive} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.nextBtn, { color: theme.primary }]}>Revive</Text>}
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {step === 1 ? (
                    <View style={styles.section}>
                        <View style={[styles.infoBox, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                            <Ionicons name="information-circle" size={20} color={theme.primary} />
                            <Text style={[styles.infoText, { color: theme.text }]}>
                                You are reviving this lead from <Text style={{ fontWeight: '800' }}>Dormant</Text> stage. Please summarize the re-engagement call.
                            </Text>
                        </View>

                        <Text style={[styles.label, { color: theme.text }]}>Re-engagement Notes</Text>
                        <TextInput
                            style={[styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                            multiline
                            numberOfLines={6}
                            placeholder="Enter summary of the conversation..."
                            placeholderTextColor={theme.textLight}
                            value={formData.description}
                            onChangeText={(val) => setFormData(p => ({ ...p, description: val }))}
                        />

                        <View style={styles.fixedFields}>
                            <View style={styles.fieldRow}>
                                <Text style={[styles.fieldLabel, { color: theme.textLight }]}>Purpose:</Text>
                                <Text style={[styles.fieldValue, { color: theme.text }]}>Revival / Re-engagement</Text>
                            </View>
                            <View style={styles.fieldRow}>
                                <Text style={[styles.fieldLabel, { color: theme.textLight }]}>Outcome:</Text>
                                <Text style={[styles.fieldValue, { color: theme.text }]}>Re-qualified / Interested</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Refresh Requirements</Text>
                        
                        <View style={styles.row}>
                            <View style={styles.flex1}>
                                <Text style={[styles.label, { color: theme.text }]}>Budget Min</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                                    keyboardType="numeric"
                                    value={formData.budgetMin}
                                    onChangeText={(val) => setFormData(p => ({ ...p, budgetMin: val }))}
                                />
                            </View>
                            <View style={[styles.flex1, { marginLeft: 16 }]}>
                                <Text style={[styles.label, { color: theme.text }]}>Budget Max</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                                    keyboardType="numeric"
                                    value={formData.budgetMax}
                                    onChangeText={(val) => setFormData(p => ({ ...p, budgetMax: val }))}
                                />
                            </View>
                        </View>

                        <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>City</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                            value={formData.locCity}
                            onChangeText={(val) => setFormData(p => ({ ...p, locCity: val }))}
                        />

                        <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>Preferred Area</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                            value={formData.locArea}
                            onChangeText={(val) => setFormData(p => ({ ...p, locArea: val }))}
                        />

                        <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>Property Types</Text>
                        <View style={styles.chipRow}>
                            {PROPERTY_TYPES.map(type => {
                                const isSelected = formData.propertyType.includes(type);
                                return (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.chip,
                                            { borderColor: theme.border, backgroundColor: isSelected ? theme.primary : theme.card }
                                        ]}
                                        onPress={() => {
                                            const next = isSelected 
                                                ? formData.propertyType.filter(t => t !== type)
                                                : [...formData.propertyType, type];
                                            setFormData(p => ({ ...p, propertyType: next }));
                                        }}
                                    >
                                        <Text style={[styles.chipText, { color: isSelected ? "#fff" : theme.text }]}>{type}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
            </ScrollView>

            {step === 2 && (
                <View style={[styles.footer, { borderTopColor: theme.border }]}>
                    <TouchableOpacity style={[styles.backBtnSecondary, { borderColor: theme.border }]} onPress={() => setStep(1)}>
                        <Text style={{ color: theme.text, fontWeight: '700' }}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.primary }]} onPress={handleRevive} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Complete Revival</Text>}
                    </TouchableOpacity>
                </View>
            )}
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
    itemSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12, height: 48 },
    fixedFields: { marginTop: 8, gap: 8 },
    fieldRow: { flexDirection: 'row', justifyContent: 'space-between' },
    fieldLabel: { fontSize: 13, fontWeight: '600' },
    fieldValue: { fontSize: 13, fontWeight: '700' },
    row: { flexDirection: 'row' },
    flex1: { flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    chipText: { fontSize: 13, fontWeight: '700' },
    footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, gap: 12 },
    backBtnSecondary: { flex: 1, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    submitBtn: { flex: 2, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowOpacity: 0.2, shadowRadius: 8 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
