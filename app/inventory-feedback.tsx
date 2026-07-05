import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, SafeAreaView, Switch, Platform, KeyboardAvoidingView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/context/ThemeContext";
import { getInventoryById, updateInventory } from "@/services/inventory.service";
import { getSystemSettingsByKey } from "@/services/system-settings.service";
import { addActivity } from "@/services/activities.service";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY_PREFIX = "@cache_inv_feedback_";

export default function InventoryFeedbackScreen() {
    const { id, initialIntent } = useLocalSearchParams<{ id: string, initialIntent?: string }>();
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
        nextActionType: 'Call',
        nextActionDate: '',
        nextActionTime: '10:00',
        markAsSold: false
    });

    const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
    const [activeTriggers, setActiveTriggers] = useState({ whatsapp: false, sms: false, email: false });
    const [channelMessages, setChannelMessages] = useState({ whatsapp: '', sms: '', email: '' });
    const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            const cacheKey = `${CACHE_KEY_PREFIX}${id}`;
            const settingsCacheKey = `@cache_master_fields`;

            try {
                const [cachedInv, cachedSettings] = await Promise.all([
                    AsyncStorage.getItem(cacheKey),
                    AsyncStorage.getItem(settingsCacheKey)
                ]);

                if (cachedInv) setInventory(JSON.parse(cachedInv));
                if (cachedSettings) setMasterFields(JSON.parse(cachedSettings));
                if (cachedInv && cachedSettings) setLoading(false);

                const [invRes, settingsRes] = await Promise.all([
                    getInventoryById(id as string),
                    getSystemSettingsByKey('masterFields')
                ]);

                const invData = invRes.records?.[0] || invRes.data || invRes;
                const fields = settingsRes.value || settingsRes.data?.value || settingsRes;

                setInventory(invData);
                setMasterFields(fields);

                AsyncStorage.setItem(cacheKey, JSON.stringify(invData)).catch(() => {});
                AsyncStorage.setItem(settingsCacheKey, JSON.stringify(fields)).catch(() => {});

                // Global Triggers
                const globalTriggers = fields?.triggers?.['Feedback Received'] || { whatsapp: true, sms: true, email: false };
                setActiveTriggers(globalTriggers);

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

                let initialResult = '', initialReason = '';
                if (initialIntent) {
                    initialResult = 'Interested / Warm';
                    if (initialIntent === 'Sell') initialReason = 'For Sale';
                    else if (initialIntent === 'Rent') initialReason = 'For Rent';
                    else if (initialIntent === 'Lease') initialReason = 'For Lease';
                }

                setFormData(prev => ({
                    ...prev,
                    selectedOwner: prev.selectedOwner || initialOwner,
                    selectedOwnerRole: prev.selectedOwnerRole || initialRole,
                    result: prev.result || initialResult,
                    reason: prev.reason || initialReason,
                    nextActionDate: prev.nextActionDate || dateStr
                }));

            } catch (error) {
                console.warn("Error loading feedback data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    useEffect(() => {
        if (formData.result && inventory && masterFields) {
            const rule = masterFields.feedbackRules?.[formData.result]?.[formData.reason] || {};

            if (rule.sendWhatsapp !== undefined || rule.sendSms !== undefined || rule.sendEmail !== undefined) {
                setActiveTriggers(prev => ({
                    ...prev,
                    whatsapp: rule.sendWhatsapp ?? prev.whatsapp,
                    sms: rule.sendSms ?? prev.sms,
                    email: rule.sendEmail ?? prev.email
                }));
            } else if (rule.sendMsg === false) {
                setActiveTriggers({ whatsapp: false, sms: false, email: false });
            }

            const ownerName = formData.selectedOwner || "Sir/Ma'am";
            const unitInfo = `Unit ${inventory.unitNo || inventory.unitNumber || 'N/A'}`;
            const time = formData.nextActionTime ? `${formData.nextActionTime} on ${formData.nextActionDate}` : 'later';
            const reason = formData.reason || 'Discussed';

            const processTemplate = (text: string) => {
                if (!text) return '';
                return text.replace(/{owner}/g, ownerName)
                    .replace(/{unit}/g, unitInfo)
                    .replace(/{time}/g, time)
                    .replace(/{reason}/g, reason);
            };

            const resultStr = formData.result;
            const dbTemplate = masterFields.responseTemplates?.[resultStr] || {};
            
            // Fallbacks if not in DB
            const waFallbacks: Record<string, string> = {
                'Interested / Hot': 'Hi {owner}, great speaking with you regarding {unit}. We will follow up {time}.',
                'Interested / Warm': 'Hi {owner}, thanks for your interest in {unit}. We will connect {time}.',
                'Request Call Back': 'Hi {owner}, as requested, I will call you back {time} to discuss {unit}.',
                'Not Interested': 'Hi {owner}, we noted your feedback regarding {unit}. Thank you.'
            };
            const smsFallbacks: Record<string, string> = { ...waFallbacks };

            setChannelMessages({
                whatsapp: processTemplate(dbTemplate.whatsapp || waFallbacks[resultStr] || `Update regarding ${unitInfo}`),
                sms: processTemplate(dbTemplate.sms || smsFallbacks[resultStr] || `Update regarding ${unitInfo}`),
                email: processTemplate(dbTemplate.email || `Update regarding ${unitInfo}`)
            });

            if (rule.inventoryStatus === 'InActive') {
                setFormData(prev => ({ ...prev, markAsSold: true }));
            } else if (rule.inventoryStatus === 'Active') {
                setFormData(prev => ({ ...prev, markAsSold: false }));
            }

            if (activeTriggers.whatsapp) setPreviewChannel('whatsapp');
            else if (activeTriggers.sms) setPreviewChannel('sms');
            else if (activeTriggers.email) setPreviewChannel('email');
            
            // Auto Follow-up Logic
            const followUpOutcomes = ['Interested / Warm', 'Interested / Hot', 'Request Call Back', 'Busy / Driving', 'Call Later', 'Busy', 'Interested'];
            if (rule.actionType === 'None') {
                setScheduleFollowUp(false);
            } else if (rule.actionType) {
                setScheduleFollowUp(true);
                setFormData(prev => ({ ...prev, nextActionType: rule.actionType }));
            } else if (followUpOutcomes.includes(formData.result) || (formData.result === 'Not Interested' && formData.reason === 'Not Selling but Buying')) {
                setScheduleFollowUp(true);
            } else {
                setScheduleFollowUp(false);
            }
        }
    }, [formData.result, formData.reason, formData.selectedOwner, formData.nextActionDate, formData.nextActionTime, inventory, masterFields]);

    const ownersList: any[] = [];
    const addUniqueEntry = (name: string, role: string, mobile?: string) => {
        if (!name || name === 'undefined' || name === 'null') return;
        if (!ownersList.some(o => o.name === name)) {
            ownersList.push({ name, role, label: `${name} (${role})`, mobile });
        }
    };

    if (inventory) {
        if (inventory.owners && Array.isArray(inventory.owners)) {
            inventory.owners.forEach((o: any) => addUniqueEntry(o.name || o.fullName, o.role || 'Owner', o.phones?.[0]?.number || o.phone || o.mobile));
        }
        addUniqueEntry(inventory.ownerName, 'Owner', inventory.ownerPhone);
        
        if (inventory.associates && Array.isArray(inventory.associates)) {
            inventory.associates.forEach((a: any) => addUniqueEntry(a.name || a.contact?.name || a.fullName, a.relationship || a.role || 'Associate', a.mobile || a.phone || a.contact?.mobile));
        }
        addUniqueEntry(inventory.associatedContact, 'Associate', inventory.associatedPhone);
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
            const dateStr = now.toISOString();
            
            let hours = now.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const timeStr = `${hours}:${minutes} ${ampm}`;

            let newRemark = `${formData.result}`;
            if (formData.reason) newRemark += ` (${formData.reason})`;
            if (formData.feedback) newRemark += `: ${formData.feedback}`;

            let newStatus = inventory.status;
            if (formData.markAsSold) {
                if (String(formData.reason).toLowerCase().includes('sold')) newStatus = 'Sold Out';
                else if (String(formData.reason).toLowerCase().includes('rent')) newStatus = 'Rented Out';
                else newStatus = 'Inactive';
            } else {
                newStatus = 'Active';
            }

            const interactionActor = formData.selectedOwner ? `${formData.selectedOwner} (${formData.selectedOwnerRole})` : 'Mobile User';
            
            const newInteraction = {
                note: `${formData.result}${formData.reason ? ` (${formData.reason})` : ''} - ${formData.feedback || 'No additional notes'}`,
                actor: formData.selectedOwner || 'Mobile User',
                details: { 
                    result: formData.result, 
                    reason: formData.reason,
                    feedback: formData.feedback,
                    owner: formData.selectedOwner,
                    ownerRole: formData.selectedOwnerRole
                }
            };

            const statusId = (typeof newStatus === 'object' && newStatus !== null) ? (newStatus as any)._id : newStatus;

            const updates: any = {
                remarks: `${formData.result}${formData.reason ? ` (${formData.reason})` : ''}: ${formData.feedback || ''}`,
                status: statusId,
                interactions: [newInteraction],
                lastContactedAt: new Date().toISOString(),
                lastContactDate: new Date().toLocaleDateString('en-GB'),
                lastContactUser: 'You'
            };

            if (initialIntent && (formData.result.includes('Interested') || formData.result === 'Interested')) {
                let newIntents = [...(inventory.intent || [])].map((i: any) => (i && typeof i === 'object' ? i.lookup_value : i));
                if (!newIntents.includes(initialIntent)) {
                    newIntents.push(initialIntent);
                    updates.intent = newIntents;
                }
            }
            
            if (scheduleFollowUp && formData.nextActionDate) {
                updates.followUpDate = `${formData.nextActionDate}T${formData.nextActionTime || '10:00'}:00`;
            }

            const response = await updateInventory(id as string, updates);
            const isSuccess = response?.success === true || response?._id || response?.id;

            if (isSuccess) {
                // Log and Dispatch communication activities
                const activeChannels = Object.entries(activeTriggers).filter(([_, active]) => active).map(([key]) => key);
                
                // Try to find the correct phone number
                let recipientPhone = inventory.ownerPhone || inventory.associatedPhone || '';
                const matchedOwner = ownersList.find(o => o.name === formData.selectedOwner);
                if (matchedOwner && matchedOwner.mobile) {
                    recipientPhone = matchedOwner.mobile;
                }

                for (const channel of activeChannels) {
                    const activityType = channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'Email';
                    const messageContent = channelMessages[channel as keyof typeof channelMessages];
                    
                    let dispatchSuccess = false;
                    let errorMsg = '';

                    // Attempt actual physical dispatch for WA and SMS
                    if ((channel === 'whatsapp' || channel === 'sms') && recipientPhone) {
                        try {
                            const { sendReply } = await import('@/services/activities.service');
                            await sendReply({
                                phoneNumber: recipientPhone,
                                message: messageContent,
                                channel: channel,
                                entityId: id as string,
                                entityType: 'Inventory'
                            });
                            dispatchSuccess = true;
                        } catch (e: any) {
                            console.warn(`Physical dispatch failed for ${channel}:`, e);
                            errorMsg = e.message || 'Dispatch Failed';
                        }
                    } else if (channel === 'email') {
                        dispatchSuccess = true; 
                    }

                    await addActivity({
                        type: activityType,
                        subject: `${dispatchSuccess ? '✅' : '❌'} ${activityType} ${dispatchSuccess ? 'Sent' : 'Failed'}: ${formData.result}`,
                        status: dispatchSuccess ? 'Completed' : 'Pending',
                        priority: 'Normal',
                        entityType: 'Inventory',
                        entityId: id,
                        dueDate: new Date().toISOString().split('T')[0],
                        relatedTo: [{ id: inventory._id, name: inventory.unitNo, model: 'Inventory' }],
                        participants: [{ name: formData.selectedOwner, mobile: recipientPhone }],
                        description: dispatchSuccess 
                            ? `Auto ${activityType} dispatched to ${formData.selectedOwner}: ${messageContent}` 
                            : `${activityType} dispatch failed: ${errorMsg}`,
                        details: { feedback: formData.result, message: messageContent, formSource: 'InventoryFeedbackForm', dispatchSuccess }
                    }).catch(e => console.warn("Failed to log activity", e));
                }

                // Log Follow-up activity
                if (scheduleFollowUp) {
                    await addActivity({
                        type: formData.nextActionType || 'Call',
                        subject: `Follow-up: ${formData.nextActionType || 'Call'} for Unit ${inventory.unitNo}`,
                        status: 'Pending',
                        priority: 'High',
                        entityType: 'Inventory',
                        entityId: id,
                        dueDate: formData.nextActionDate,
                        dueTime: formData.nextActionTime,
                        relatedTo: [{ id: inventory._id, name: inventory.unitNo, model: 'Inventory' }],
                        participants: [{ name: formData.selectedOwner }],
                        description: `Follow up with ${formData.selectedOwner} regarding Unit ${inventory.unitNo}`,
                        details: { agenda: `${formData.nextActionType} to discuss ${formData.result}`, formSource: 'InventoryFeedbackForm' }
                    }).catch(e => console.warn("Failed to log follow-up", e));
                }

                Alert.alert("Success", "Feedback and automated activities recorded", [
                    { text: "OK", onPress: () => router.canGoBack() ? router.back() : router.replace("/(tabs)/inventory") }
                ]);
            } else {
                throw new Error("Backend failed to confirm save.");
            }
        } catch (error: any) {
            console.error("Error saving feedback:", error);
            Alert.alert("Save Error", error.response?.data?.error || error.message || "Failed to save feedback.");
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
    
    const showDealButton = (formData.result.includes('Interested') || formData.result === 'Interested') &&
        ['For Sale', 'For Rent', 'For Lease', 'Sell & Buy (Re-invest)', 'Ready to Sell Now', 'High Intent (Urgent)', 'Wants to Buy (Invest)'].includes(formData.reason);

    const showLeadButton = ((formData.result.includes('Interested') || formData.result === 'Interested') && ['Wants to Buy (Invest)', 'Sell & Buy (Re-invest)'].includes(formData.reason)) ||
        (formData.result === 'Not Interested' && formData.reason === 'Not Selling but Buying');

    // Target Status UI
    const rule = masterFields?.feedbackRules?.[formData.result]?.[formData.reason] || {};
    const isInactiveManual = formData.markAsSold;
    const isInactiveResult = ['Not Interested', 'Wrong Number / Invalid'].includes(formData.result);
    const isInactive = rule.inventoryStatus === 'InActive' || isInactiveManual || isInactiveResult;
    const targetStatusLabel = isInactive ? 'Inactive' : 'Active';
    const targetStatusColor = isInactive ? '#64748B' : '#10B981';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/inventory")} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Log Interaction</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => Alert.alert('Call', `Initiating call to ${formData.selectedOwner}`)} style={styles.quickBtn}>
                        <Ionicons name="call" size={18} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTriggers(p => ({...p, whatsapp: !p.whatsapp}))} style={[styles.quickBtn, activeTriggers.whatsapp && { backgroundColor: '#25D366' }]}>
                        <Ionicons name="logo-whatsapp" size={18} color={activeTriggers.whatsapp ? "#fff" : "#64748B"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTriggers(p => ({...p, sms: !p.sms}))} style={[styles.quickBtn, activeTriggers.sms && { backgroundColor: '#3B82F6' }]}>
                        <Ionicons name="chatbubble" size={18} color={activeTriggers.sms ? "#fff" : "#64748B"} />
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {/* Action Buttons dynamically showing based on intent */}
                    {(showDealButton || showLeadButton) && (
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                            {showDealButton && (
                                <TouchableOpacity onPress={() => Alert.alert("Create Deal", "Navigating to Deal form with context...")} style={[styles.actionBadge, { backgroundColor: '#4F46E5' }]}>
                                    <Ionicons name="hand-right" size={16} color="#fff" />
                                    <Text style={styles.actionBadgeText}>Create Deal</Text>
                                </TouchableOpacity>
                            )}
                            {showLeadButton && (
                                <TouchableOpacity onPress={() => Alert.alert("Create Lead", "Navigating to Lead form with context...")} style={[styles.actionBadge, { backgroundColor: '#059669' }]}>
                                    <Ionicons name="person-add" size={16} color="#fff" />
                                    <Text style={styles.actionBadgeText}>Create Lead</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={[styles.unitLabel, { color: theme.textLight }]}>PROPERTY INFO</Text>
                                <Text style={[styles.unitValue, { color: theme.text }]}>Unit {inventory?.unitNumber || inventory?.unitNo || "N/A"} - {inventory?.projectName || inventory?.area || "Unknown Project"}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.unitLabel, { color: theme.textLight }]}>TARGET STATUS</Text>
                                <View style={[styles.statusBadge, { borderColor: targetStatusColor, backgroundColor: targetStatusColor + '20' }]}>
                                    <View style={[styles.statusDot, { backgroundColor: targetStatusColor }]} />
                                    <Text style={{ color: targetStatusColor, fontSize: 12, fontWeight: '700' }}>{targetStatusLabel}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Contact Selection */}
                    <Text style={[styles.sectionTitle, { color: theme.textLight }]}>CONTACT PERSON</Text>
                    <View style={styles.pillsRow}>
                        {ownersList.map((o, idx) => (
                            <TouchableOpacity key={idx} onPress={() => setFormData({ ...formData, selectedOwner: o.name, selectedOwnerRole: o.role })}
                                style={[styles.pill, { backgroundColor: formData.selectedOwner === o.name ? theme.primary + '20' : theme.card, borderColor: formData.selectedOwner === o.name ? theme.primary : theme.border }]}>
                                <Text style={[styles.pillText, { color: formData.selectedOwner === o.name ? theme.primary : theme.textLight }]}>{o.name} ({o.role})</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Outcome */}
                    <Text style={[styles.sectionTitle, { color: theme.textLight }]}>OUTCOME</Text>
                    <View style={styles.pillsRow}>
                        {outcomeOptions.map((opt: string) => (
                            <TouchableOpacity key={opt} onPress={() => setFormData({ ...formData, result: opt, reason: '' })}
                                style={[styles.pill, { backgroundColor: formData.result === opt ? theme.primary + '20' : theme.card, borderColor: formData.result === opt ? theme.primary : theme.border }]}>
                                <Text style={[styles.pillText, { color: formData.result === opt ? theme.primary : theme.textLight }]}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Specific Reason */}
                    {reasonOptions.length > 0 && (
                        <View>
                            <Text style={[styles.sectionTitle, { color: theme.textLight }]}>SPECIFIC REASON</Text>
                            <View style={styles.pillsRow}>
                                {reasonOptions.map((opt: string) => (
                                    <TouchableOpacity key={opt} onPress={() => {
                                            const isInactive = masterFields?.feedbackRules?.[formData.result]?.[opt]?.inventoryStatus === 'InActive';
                                            setFormData({ ...formData, reason: opt, markAsSold: isInactive });
                                        }}
                                        style={[styles.pillSmall, { backgroundColor: formData.reason === opt ? '#F59E0B20' : theme.card, borderColor: formData.reason === opt ? '#F59E0B' : theme.border }]}>
                                        <Text style={[styles.pillTextSmall, { color: formData.reason === opt ? '#F59E0B' : theme.textLight }]}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {formData.markAsSold && (
                        <View style={[styles.alertCard, { backgroundColor: '#F0F9FF', borderColor: '#BBF7D0' }]}>
                            <Ionicons name="information-circle" size={20} color="#0EA5E9" />
                            <Text style={styles.alertText}>
                                {String(formData.reason).toLowerCase().includes('sold') || String(formData.reason).toLowerCase().includes('rent')
                                    ? `Setting status to ${String(formData.reason).toLowerCase().includes('sold') ? 'Sold Out' : 'Rented Out'} automatically.`
                                    : `Marking property as InActive based on feedback outcome.`}
                            </Text>
                        </View>
                    )}

                    {/* Automation Preview */}
                    {(activeTriggers.whatsapp || activeTriggers.sms || activeTriggers.email) && (
                        <View style={{ marginTop: 24 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={[styles.sectionTitle, { marginTop: 0 }]}>AUTOMATION PREVIEW</Text>
                                <View style={{ flexDirection: 'row', gap: 4, backgroundColor: theme.card, padding: 4, borderRadius: 16 }}>
                                    {activeTriggers.whatsapp && <TouchableOpacity onPress={() => setPreviewChannel('whatsapp')} style={[styles.previewTab, previewChannel === 'whatsapp' && { backgroundColor: theme.background }]}><Ionicons name="logo-whatsapp" size={14} color={previewChannel === 'whatsapp' ? '#25D366' : theme.textLight} /></TouchableOpacity>}
                                    {activeTriggers.sms && <TouchableOpacity onPress={() => setPreviewChannel('sms')} style={[styles.previewTab, previewChannel === 'sms' && { backgroundColor: theme.background }]}><Ionicons name="chatbubble" size={14} color={previewChannel === 'sms' ? '#3B82F6' : theme.textLight} /></TouchableOpacity>}
                                    {activeTriggers.email && <TouchableOpacity onPress={() => setPreviewChannel('email')} style={[styles.previewTab, previewChannel === 'email' && { backgroundColor: theme.background }]}><Ionicons name="mail" size={14} color={previewChannel === 'email' ? '#F97316' : theme.textLight} /></TouchableOpacity>}
                                </View>
                            </View>
                            <TextInput
                                style={[styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text, height: 80, fontSize: 13 }]}
                                multiline
                                value={channelMessages[previewChannel]}
                                onChangeText={(t) => setChannelMessages(p => ({ ...p, [previewChannel]: t }))}
                            />
                            <Text style={{ fontSize: 10, color: theme.textLight, marginTop: 4 }}>This message will be dispatched automatically on save.</Text>
                        </View>
                    )}

                    {/* Notes */}
                    <Text style={[styles.sectionTitle, { color: theme.textLight }]}>ADDITIONAL NOTES</Text>
                    <TextInput
                        style={[styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                        placeholder="Enter any internal notes..."
                        placeholderTextColor={theme.textLight}
                        multiline
                        numberOfLines={4}
                        value={formData.feedback}
                        onChangeText={(text) => setFormData({ ...formData, feedback: text })}
                    />

                    {/* Follow-up */}
                    <View style={styles.switchRow}>
                        <Text style={[styles.switchLabel, { color: theme.text }]}>Schedule Follow-up?</Text>
                        <Switch value={scheduleFollowUp} onValueChange={setScheduleFollowUp} trackColor={{ true: theme.primary }} />
                    </View>

                    {scheduleFollowUp && (
                        <View style={[styles.followUpBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.unitLabel, { color: theme.textLight }]}>ACTION TYPE</Text>
                            <View style={styles.pillsRow}>
                                {['Call Back', 'Meeting', 'Site Visit'].map((a: string) => (
                                    <TouchableOpacity key={a} onPress={() => setFormData({ ...formData, nextActionType: a })}
                                        style={[styles.pillSmall, { backgroundColor: formData.nextActionType === a ? theme.primary + '20' : theme.background, borderColor: formData.nextActionType === a ? theme.primary : theme.border }]}>
                                        <Text style={[styles.pillTextSmall, { color: formData.nextActionType === a ? theme.primary : theme.textLight }]}>{a}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.dateTimeRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.unitLabel, { color: theme.textLight }]}>DATE</Text>
                                    <TextInput style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} value={formData.nextActionDate} onChangeText={(text) => setFormData({ ...formData, nextActionDate: text })} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.unitLabel, { color: theme.textLight }]}>TIME</Text>
                                    <TextInput style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} value={formData.nextActionTime} onChangeText={(text) => setFormData({ ...formData, nextActionTime: text })} />
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Update</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F1F1' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    quickBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 16, paddingBottom: 100 },
    infoCard: { padding: 16, borderRadius: 16, borderLeftWidth: 4, marginBottom: 24 },
    unitLabel: { fontSize: 10, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
    unitValue: { fontSize: 16, fontWeight: '700' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
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
    dateTimeRow: { flexDirection: 'row', gap: 12 },
    input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15 },
    alertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 12 },
    alertText: { fontSize: 13, color: '#0369A1', fontWeight: '600', flex: 1 },
    footer: { padding: 16, borderTopWidth: 1 },
    saveBtn: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    actionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    actionBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    previewTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }
});
