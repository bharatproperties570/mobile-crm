import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, SafeAreaView, Switch, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './context/ThemeContext';
import { getInventoryById, updateInventory } from './services/inventory.service';
import { getSystemSettingsByKey } from './services/system-settings.service';
import { lookupVal } from './services/api.helpers';

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
            try {
                const [invRes, settingsRes] = await Promise.all([
                    getInventoryById(id as string),
                    getSystemSettingsByKey('master_fields')
                ]);

                const invData = invRes.records?.[0] || invRes.data || invRes;
                setInventory(invData);

                const fields = settingsRes.value || settingsRes.data?.value || settingsRes;
                setMasterFields(fields);

                // Default Owner Logic
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
                    selectedOwner: initialOwner,
                    selectedOwnerRole: initialRole,
                    nextActionDate: dateStr
                }));

            } catch (error) {
                console.error("Error loading feedback data:", error);
                Alert.alert("Error", "Failed to load required data.");
            } finally {
                setLoading(false);
            }
        };

        if (id) loadData();
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
            const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            let newRemark = `${formData.result}`;
            if (formData.reason) newRemark += ` (${formData.reason})`;
            if (formData.feedback) newRemark += `: ${formData.feedback}`;
            if (scheduleFollowUp && formData.nextActionDate) {
                newRemark += ` | Next: ${formData.nextActionType} on ${formData.nextActionDate} @ ${formData.nextActionTime}`;
            }

            let newStatus = inventory.status;
            if (formData.markAsSold && formData.reason) {
                if (String(formData.reason).includes('Sold Out')) newStatus = 'Sold Out';
                else if (String(formData.reason).includes('Rented Out')) newStatus = 'Rented Out';
                else newStatus = 'Inactive';
            }

            const newInteraction = {
                id: Date.now(),
                date: dateStr,
                time: timeStr,
                user: 'Mobile User',
                action: scheduleFollowUp ? formData.nextActionType : 'Call',
                result: formData.result,
                reason: formData.reason,
                note: newRemark
            };

            const updates = {
                lastContactDate: dateStr,
                lastContactTime: timeStr,
                lastContactUser: 'Mobile User',
                remarks: newRemark,
                status: newStatus,
                history: [newInteraction, ...(inventory.history || [])]
            };

            await updateInventory(id as string, updates);
            Alert.alert("Success", "Feedback recorded successfully", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error("Error saving feedback:", error);
            Alert.alert("Error", "Failed to save feedback.");
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
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
                                        const isSold = ['Sold Out', 'Rented Out'].some(k => opt.includes(k));
                                        setFormData({ ...formData, reason: opt, markAsSold: isSold });
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
                            Setting status to {formData.reason.includes('Sold') ? 'Sold Out' : 'Rented Out'} automatically.
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
