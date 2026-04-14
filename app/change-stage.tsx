import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ActivityIndicator, Alert, ScrollView, Vibration,
    Dimensions, Animated
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { updateLeadStage, updateDealStage, STAGE_COLORS } from "@/services/stageEngine.service";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChangeStageScreen() {
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const params = useLocalSearchParams();
    const router = useRouter();

    const leadId = params.leadId as string;
    const dealId = params.dealId as string;
    const currentStage = params.currentStage as string;

    const [selectedStage, setSelectedStage] = useState(currentStage || "");
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const fadeAnim = useState(new Animated.Value(0))[0];

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true
        }).start();
    }, []);

    const handleSave = async () => {
        if (!selectedStage) return Alert.alert("Required", "Please select a new stage.");
        if (selectedStage.toLowerCase() === (currentStage || "").toLowerCase()) {
            return Alert.alert("No Change", "Please select a different stage than the current one.");
        }
        if (!reason.trim()) return Alert.alert("Audit Required", "Please provide a reason for this stage transition.");

        setSaving(true);
        Vibration.vibrate(50);

        try {
            let res;
            if (dealId) {
                res = await updateDealStage(dealId, selectedStage, { reason: reason.trim(), triggeredBy: "manual" });
            } else if (leadId) {
                res = await updateLeadStage(leadId, selectedStage, { reason: reason.trim(), triggeredBy: "manual" });
            }

            if (res?.success) {
                Vibration.vibrate([0, 100, 50, 100]);
                Alert.alert("Success", "Stage updated successfully.", [
                    { text: "Done", onPress: () => router.back() }
                ]);
            } else {
                Alert.alert("Update Failed", res?.error || "Could not persist stage change.");
            }
        } catch (e) {
            Alert.alert("Error", "A technical error occurred during transition.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Transition Lifecycle</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={[styles.saveBtn, { opacity: saving ? 0.5 : 1 }]}>Confirm</Text>
                </TouchableOpacity>
            </View>

            <Animated.ScrollView 
                style={{ opacity: fadeAnim }}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.contextCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: theme.border }]}>
                    <View style={styles.contextHeader}>
                        <Ionicons name={dealId ? "briefcase" : "person"} size={16} color={theme.primary} />
                        <Text style={[styles.contextType, { color: theme.primary }]}>{dealId ? "DEAL LIFECYCLE" : "LEAD LIFECYCLE"}</Text>
                    </View>
                    <Text style={[styles.contextId, { color: theme.text }]}>ID: {dealId || leadId || "N/A"}</Text>
                    <View style={styles.currentStageRow}>
                        <Text style={[styles.currentLabel, { color: theme.textLight }]}>From:</Text>
                        <View style={[styles.stageBadge, { backgroundColor: (STAGE_COLORS[currentStage] || theme.primary) + '20' }]}>
                            <Text style={[styles.stageBadgeText, { color: STAGE_COLORS[currentStage] || theme.primary }]}>{currentStage?.toUpperCase() || "NEW"}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>Select Destination Stage</Text>
                    <View style={styles.stageGrid}>
                        {Object.keys(STAGE_COLORS).map((stage) => {
                            const color = STAGE_COLORS[stage];
                            const isSelected = selectedStage === stage;
                            return (
                                <TouchableOpacity
                                    key={stage}
                                    style={[
                                        styles.stageChip,
                                        { borderColor: color + '40', backgroundColor: isSelected ? color : 'transparent' }
                                    ]}
                                    onPress={() => setSelectedStage(stage)}
                                >
                                    <View style={[styles.dot, { backgroundColor: isSelected ? '#fff' : color }]} />
                                    <Text style={[styles.stageText, { color: isSelected ? '#fff' : theme.text }]}>{stage}</Text>
                                    {isSelected && <Ionicons name="checkmark-circle" size={14} color="#fff" style={{ marginLeft: 6 }} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>Reason for Transition (Mandatory)</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC', color: theme.text, borderColor: theme.border }]}
                        placeholder="e.g., Client confirmed budget, Moving to negotiation after site visit..."
                        placeholderTextColor={theme.textMuted}
                        multiline
                        numberOfLines={4}
                        value={reason}
                        onChangeText={setReason}
                    />
                </View>

                <View style={[styles.infoBox, { backgroundColor: theme.primary + '10' }]}>
                    <Ionicons name="information-circle" size={18} color={theme.primary} />
                    <Text style={[styles.infoText, { color: theme.text }]}>
                        Stage changes are audited. This transition will be saved to the entity's history log.
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Transition</Text>}
                </TouchableOpacity>
            </Animated.ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: "900" },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    saveBtn: { color: '#2563EB', fontWeight: '800', fontSize: 16 },

    content: { padding: 20 },
    contextCard: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 28 },
    contextHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    contextType: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    contextId: { fontSize: 13, fontWeight: "700", opacity: 0.6, marginBottom: 16 },
    currentStageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    currentLabel: { fontSize: 12, fontWeight: "700" },
    stageBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    stageBadgeText: { fontSize: 11, fontWeight: "900" },

    section: { marginBottom: 32 },
    label: { fontSize: 12, fontWeight: "800", marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    stageChip: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 14, 
        paddingVertical: 10, 
        borderRadius: 16, 
        borderWidth: 1.5,
        minWidth: (SCREEN_WIDTH - 60) / 2
    },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    stageText: { fontSize: 13, fontWeight: "700" },

    input: { borderRadius: 20, padding: 20, fontSize: 15, borderWidth: 1, textAlignVertical: 'top', height: 120, fontWeight: '600' },

    infoBox: { flexDirection: 'row', padding: 16, borderRadius: 16, gap: 12, alignItems: 'center', marginBottom: 24 },
    infoText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18, opacity: 0.8 },

    submitBtn: { borderRadius: 20, paddingVertical: 20, alignItems: 'center', shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
    submitText: { color: '#fff', fontSize: 16, fontWeight: "900" },
});
