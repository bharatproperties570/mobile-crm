import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, SafeAreaView, Switch, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/context/ThemeContext";
import { getInventoryById, updateInventory } from "@/services/inventory.service";
import { getSystemSettingsByKey } from "@/services/system-settings.service";
import { lookupVal } from "@/services/api.helpers";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY_PREFIX = "@cache_inv_feedback_";

export default function InventoryFeedbackScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [inventory, setInventory] = useState<any>(null);
    const [masterFields, setMasterFields] = useState<any>(null);

    const [formData, setFormData] = useState({
        selectedOwner: '',
        selectedOwnerRole: '',
        result: '',
        reason: '',
        feedback: '',
        nextActionType: 'Call Back',
        nextActionDate: '',
        nextActionTime: '10:00',
        markAsSold: false
    });

    const [scheduleFollowUp, setScheduleFollowUp] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            const cacheKey = `${CACHE_KEY_PREFIX}${id}`;
            const settingsCacheKey = `@cache_master_fields`;

            try {
                // Try load from cache first
                const [cachedInv, cachedSettings] = await Promise.all([
                    AsyncStorage.getItem(cacheKey),
                    AsyncStorage.getItem(settingsCacheKey)
                ]);

                if (cachedInv) setInventory(JSON.parse(cachedInv));
                if (cachedSettings) setMasterFields(JSON.parse(cachedSettings));
                if (cachedInv && cachedSettings) setLoading(false);

                // Fetch fresh data
                const [invRes, settingsRes] = await Promise.all([
                    getInventoryById(id as string),
                    getSystemSettingsByKey('master_fields')
                ]);

                const invData = invRes.records?.[0] || invRes.data || invRes;
                const fields = settingsRes.value || settingsRes.data?.value || settingsRes;

                setInventory(invData);
                setMasterFields(fields);

                // Background cache update
                AsyncStorage.setItem(cacheKey, JSON.stringify(invData)).catch(() => {});
                AsyncStorage.setItem(settingsCacheKey, JSON.stringify(fields)).catch(() => {});

                // Default Owner Logic (only if not already set or refreshing)
                let initialOwner = '', initialRole = '';
                if (invData.owners?.length > 0) {
                    initialOwner = invData.owners[0].name || invData.ownerName;
                    initialRole = 'Owner';
                } else if (invData.ownerName) {
                    initialOwner = invData.ownerName;
                    initialRole = 'Owner';
                }

                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const dateStr = tomorrow.toISOString().split('T')[0];

                setFormData(prev => ({
                    ...prev,
                    selectedOwner: prev.selectedOwner || initialOwner,
                    selectedOwnerRole: prev.selectedOwnerRole || initialRole,
                    nextActionDate: prev.nextActionDate || dateStr
                }));

            } catch (error) {
                console.warn("Error loading feedback data:", error);
                // If we have no cache and fetch failed, show alert
                if (!inventory) {
                    Alert.alert("Network Error", "Could not load required data. Please check your connection.");
                }
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    const ownersList = [];
    if (inventory) {
        if (inventory.ownerName) ownersList.push({ name: inventory.ownerName, role: 'Owner', label: `${inventory.ownerName} (Owner)` });
        if (inventory.owners) {
            inventory.owners.forEach((o: any) => {
                if (o.name && o.name !== inventory.ownerName) {
                    ownersList.push({ name: o.name, role: 'Owner', label: `${o.name} (Owner)` });
                }
            });
        }
    }

    const handleSave = async () => {
        if (!formData.result) {
            Alert.alert("Required", "Please select an outcome.");
            return;
        }

        const reasons = masterFields?.feedbackReasons?.[formData.result];
        if (reasons?.length > 0 && !formData.reason) {
            Alert.alert("Required", "Please select a specific reason.");
            return;
        }

        setSaving(true);
        try {
            const now = new Date();
            // Robust Date/Time formatting for both Web/Native
            const day = String(now.getDate()).padStart(2, '0');
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = monthNames[now.getMonth()];
            const year = now.getFullYear();
            const dateStr = now.toISOString(); // For backend history

            let hours = now.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const timeStr = `${hours}:${minutes} ${ampm}`;

            let newRemark = `${formData.result}`;
            if (formData.reason) newRemark += ` (${formData.reason})`;
            if (formData.feedback) newRemark += `: ${formData.feedback}`;
            if (scheduleFollowUp && formData.nextActionDate) {
                newRemark += ` | Next: ${formData.nextActionType} on ${formData.nextActionDate} @ ${formData.nextActionTime}`;
            }

            let newStatus = inventory.status;
            const rule = masterFields?.feedbackRules?.[formData.result]?.[formData.reason];
            if (rule?.inventoryStatus === 'InActive' && formData.markAsSold) {
                if (String(formData.reason).includes('Sold Out')) newStatus = 'Sold Out';
                else if (String(formData.reason).includes('Rented Out')) newStatus = 'Rented Out';
                else newStatus = 'Inactive';
            }

            const displayDate = `${day} ${month} ${year}`;
            const isoDate = now.toISOString();

            const interactionActor = formData.selectedOwner ? `${formData.selectedOwner} (${formData.selectedOwnerRole})` : 'Mobile User';
            
            const newInteraction = {
                id: Date.now(),
                date: isoDate,
                time: timeStr,
                actor: interactionActor,
                action: scheduleFollowUp ? formData.nextActionType : 'Interaction',
                result: formData.result,
                reason: formData.reason,
                note: newRemark
            };

            // Ensure status is just an ID string
            const statusId = (typeof newStatus === 'object' && newStatus !== null) ? (newStatus._id || newStatus.id) : newStatus;

            const updates: any = {
                remarks: newRemark,
                status: statusId,
                interactions: [newInteraction]
            };

            // Add last contact info if schema has these
            updates.lastContactDate = displayDate;
            updates.lastContactTime = timeStr;
            updates.lastContactUser = interactionActor;

            console.log(`[DEBUG] Attempting updateInventory for ID: ${id}`);
            const response = await updateInventory(id as string, updates);
            console.log(`[DEBUG] updateInventory Response:`, response);
            
            // Backend might return { success: true, data: {...} } or just the document
            const isSuccess = response?.success === true || response?._id || response?.id;

            if (isSuccess) {
                Alert.alert("Success", "Feedback recorded successfully", [
                    { text: "OK", onPress: () => router.canGoBack() ? router.back() : router.replace("/(tabs)/inventory") }
                ]);
                
                // Immediate fallback for Web/Hanging alerts
                setTimeout(() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace("/(tabs)/inventory");
                    }
                }, 1000);
            } else {
                throw new Error("Backend failed to confirm save.");
            }
        } catch (error: any) {
            console.error("[DEBUG] Error saving feedback:", error);
            const errorMsg = error.response?.data?.error || error.message || "Failed to save feedback.";
            Alert.alert("Save Error", errorMsg);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const outcomeOptions = masterFields?.propertyOwnerFeedback || [];
    const reasonOptions = masterFields?.feedbackReasons?.[formData.result] || [];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/inventory")} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Log Interaction</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.unitLabel, { color: theme.textLight }]}>PROPERTY INFO</Text>
                    <Text style={[styles.unitValue, { color: theme.text }]}>
                        Unit {inventory?.unitNumber || inventory?.unitNo || "N/A"} • {inventory?.projectName}
                    </Text>
                </View>

                {/* Contact Selection */}
                <Text style={[styles.sectionTitle, { color: theme.textLight }]}>CONTACT PERSON</Text>
                <View style={styles.pillsRow}>
                    {ownersList.map((o, idx) => (
                        <TouchableOpacity
                            key={idx}
                            onPress={() => setFormData({ ...formData, selectedOwner: o.name, selectedOwnerRole: o.role })}
                            style={[
                                styles.pill,
                                { backgroundColor: formData.selectedOwner === o.name ? theme.primary + '20' : theme.card, borderColor: formData.selectedOwner === o.name ? theme.primary : theme.border }
                            ]}
                        >
                            <Text style={[styles.pillText, { color: formData.selectedOwner === o.name ? theme.primary : theme.textLight }]}>
                                {o.name} ({o.role})
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Outcome */}
                <Text style={[styles.sectionTitle, { color: theme.textLight }]}>OUTCOME</Text>
                <View style={styles.pillsRow}>
                    {outcomeOptions.map((opt: string) => (
                        <TouchableOpacity
                            key={opt}
                            onPress={() => setFormData({ ...formData, result: opt, reason: '' })}
                            style={[
                                styles.pill,
                                { backgroundColor: formData.result === opt ? theme.primary + '20' : theme.card, borderColor: formData.result === opt ? theme.primary : theme.border }
                            ]}
                        >
                            <Text style={[styles.pillText, { color: formData.result === opt ? theme.primary : theme.textLight }]}>
                                {opt}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Specific Reason */}
                {reasonOptions.length > 0 && (
                    <View>
                        <Text style={[styles.sectionTitle, { color: theme.textLight }]}>SPECIFIC REASON</Text>
                        <View style={styles.pillsRow}>
                            {reasonOptions.map((opt: string) => (
                                <TouchableOpacity
                                    key={opt}
                                    onPress={() => {
                                        const rule = masterFields?.feedbackRules?.[formData.result]?.[opt];
                                        const isInactive = rule?.inventoryStatus === 'InActive';
                                        setFormData({ ...formData, reason: opt, markAsSold: isInactive });
                                    }}
                                    style={[
                                        styles.pillSmall,
                                        { backgroundColor: formData.reason === opt ? '#F59E0B20' : theme.card, borderColor: formData.reason === opt ? '#F59E0B' : theme.border }
                                    ]}
                                >
                                    <Text style={[styles.pillTextSmall, { color: formData.reason === opt ? '#F59E0B' : theme.textLight }]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Automation Info */}
                {formData.markAsSold && (
                    <View style={[styles.alertCard, { backgroundColor: '#F0F9FF', borderColor: '#BBF7D0' }]}>
                        <Ionicons name="information-circle" size={20} color="#0EA5E9" />
                        <Text style={styles.alertText}>
                            {formData.reason.includes('Sold') || formData.reason.includes('Rented')
                                ? `Setting status to ${formData.reason.includes('Sold') ? 'Sold Out' : 'Rented Out'} automatically.`
                                : `Marking property as InActive based on feedback outcome.`
                            }
                        </Text>
                    </View>
                )}

                {/* Notes */}
                <Text style={[styles.sectionTitle, { color: theme.textLight }]}>ADDITIONAL NOTES</Text>
                <TextInput
                    style={[styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    placeholder="Enter any details..."
                    placeholderTextColor={theme.textLight}
                    multiline
                    numberOfLines={4}
                    value={formData.feedback}
                    onChangeText={(text) => setFormData({ ...formData, feedback: text })}
                />

                {/* Follow-up */}
                <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>Schedule Follow-up?</Text>
                    <Switch
                        value={scheduleFollowUp}
                        onValueChange={setScheduleFollowUp}
                        trackColor={{ true: theme.primary }}
                    />
                </View>

                {scheduleFollowUp && (
                    <View style={[styles.followUpBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: theme.textLight }]}>ACTION TYPE</Text>
                            <View style={styles.pillsRow}>
                                {(masterFields?.followUpActions || ['Call Back', 'Meeting']).map((a: string) => (
                                    <TouchableOpacity
                                        key={a}
                                        onPress={() => setFormData({ ...formData, nextActionType: a })}
                                        style={[
                                            styles.pillSmall,
                                            { backgroundColor: formData.nextActionType === a ? theme.primary + '20' : theme.background, borderColor: formData.nextActionType === a ? theme.primary : theme.border }
                                        ]}
                                    >
                                        <Text style={[styles.pillTextSmall, { color: formData.nextActionType === a ? theme.primary : theme.textLight }]}>
                                            {a}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.dateTimeRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.inputLabel, { color: theme.textLight }]}>DATE</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                                    value={formData.nextActionDate}
                                    placeholder="YYYY-MM-DD"
                                    onChangeText={(text) => setFormData({ ...formData, nextActionDate: text })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.inputLabel, { color: theme.textLight }]}>TIME</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                                    value={formData.nextActionTime}
                                    placeholder="HH:MM"
                                    onChangeText={(text) => setFormData({ ...formData, nextActionTime: text })}
                                />
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
                <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveBtnText}>Save Update</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F1F1'
    },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 16, paddingBottom: 100 },
    infoCard: { padding: 16, borderRadius: 16, borderLeftWidth: 4, marginBottom: 24 },
    unitLabel: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
    unitValue: { fontSize: 16, fontWeight: '700' },
    sectionTitle: { fontSize: 11, fontWeight: '800', marginTop: 16, marginBottom: 12, letterSpacing: 1 },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
    pillSmall: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    pillText: { fontSize: 14, fontWeight: '700' },
    pillTextSmall: { fontSize: 12, fontWeight: '600' },
    textArea: { borderRadius: 16, borderWidth: 1, padding: 16, height: 100, fontSize: 15, textAlignVertical: 'top' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16 },
    switchLabel: { fontSize: 16, fontWeight: '700' },
    followUpBox: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 16 },
    inputGroup: { gap: 8 },
    inputLabel: { fontSize: 10, fontWeight: '800' },
    dateTimeRow: { flexDirection: 'row', gap: 12 },
    input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15 },
    alertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 12 },
    alertText: { fontSize: 13, color: '#0369A1', fontWeight: '600', flex: 1 },
    footer: { padding: 16, borderTopWidth: 1 },
    saveBtn: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});
