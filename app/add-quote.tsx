import React, { useState, useEffect, useMemo } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, SafeAreaView, Switch, Dimensions
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/services/api";
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AddQuote() {
    const { theme, isDark } = useTheme();
    const router = useRouter();
    const { dealId } = useLocalSearchParams<{ dealId: string }>();
    const { getLookupValue } = useLookup();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deal, setDeal] = useState<any>(null);
    const [collectorRates, setCollectorRates] = useState<any[]>([]);
    const [revenueRules, setRevenueRules] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [leadSearch, setLeadSearch] = useState("");
    const [isSearchingLeads, setIsSearchingLeads] = useState(false);
    const [selectedLead, setSelectedLead] = useState<any>(null);

    const [formData, setFormData] = useState({
        buyerType: 'Male', // Male, Female, Joint
        collectorRateId: '',
        revenueRuleId: '',
        customPrice: '',
        gstPercent: '18',
        includeGst: true,
        tdsPercent: '1',
        includeTds: true,
        includeBrokerage: true,
        brokeragePercent: '1'
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!dealId) return;
            try {
                const [dealRes, ratesRes, rulesRes] = await Promise.all([
                    api.get(`/deals/${dealId}`),
                    api.get(`/collector-rates?limit=100`),
                    api.get('/system-settings?category=govt_charges_config')
                ]);

                if (dealRes.data) {
                    const dealData = dealRes.data.data || dealRes.data;
                    setDeal(dealData);
                    setFormData(prev => ({
                        ...prev,
                        customPrice: String(dealData.price || '')
                    }));
                    if (dealData.associatedContact) {
                        setSelectedLead(dealData.associatedContact);
                    }
                }

                if (ratesRes.data?.status === 'success') {
                    const rates = ratesRes.data.data.docs || [];
                    setCollectorRates(rates);
                    if (rates.length > 0) {
                        setFormData(prev => ({ ...prev, collectorRateId: rates[0]._id }));
                    }
                }

                if (rulesRes.data?.status === 'success') {
                    const rules = Array.isArray(rulesRes.data.data) ? rulesRes.data.data : (rulesRes.data.data.docs || []);
                    setRevenueRules(rules);
                    if (rules.length > 0) {
                        setFormData(prev => ({ ...prev, revenueRuleId: rules[0]._id }));
                    }
                }
            } catch (error) {
                console.error("Error fetching quote requirements:", error);
                Alert.alert("Error", "Failed to load quotation settings");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dealId]);

    // Lead Search Logic
    useEffect(() => {
        if (leadSearch.length < 3) {
            setLeads([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingLeads(true);
            try {
                const res = await api.get('/leads', { params: { search: leadSearch, limit: 10 } });
                if (res.data?.success) {
                    setLeads(res.data.records || []);
                }
            } catch (err) {
                console.error("Lead search failed:", err);
            } finally {
                setIsSearchingLeads(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [leadSearch]);

    const selectedCollectorRate = useMemo(() =>
        collectorRates.find(r => r._id === formData.collectorRateId),
        [collectorRates, formData.collectorRateId]);

    const selectedRevenueRule = useMemo(() =>
        revenueRules.find(r => r._id === formData.revenueRuleId)?.value,
        [revenueRules, formData.revenueRuleId]);

    const calcs = useMemo(() => {
        if (!deal) return null;

        const basePrice = parseFloat(formData.customPrice) || 0;
        let collectorValue = 0;
        let stampDutyPercent = 7;
        let registrationPercent = 1;
        let legalFees = 15000;

        if (selectedRevenueRule) {
            if (formData.buyerType === 'Female') stampDutyPercent = selectedRevenueRule.stampDutyFemale || 5;
            else if (formData.buyerType === 'Joint') stampDutyPercent = selectedRevenueRule.stampDutyJoint || 6;
            else stampDutyPercent = selectedRevenueRule.stampDutyMale || 7;

            registrationPercent = selectedRevenueRule.registrationPercent || 1;
            legalFees = selectedRevenueRule.legalFees || 15000;
        }

        if (selectedCollectorRate) {
            const inventoryArea = deal.inventoryId?.totalArea || deal.inventoryId?.area || deal.size || 0;
            const area = Number(inventoryArea) || 0;
            collectorValue = (selectedCollectorRate.rate || 0) * area;
        }

        const applicableValue = Math.max(basePrice, collectorValue);
        const stampDutyAmount = applicableValue * (stampDutyPercent / 100);
        const registrationAmount = applicableValue * (registrationPercent / 100);
        const gstAmount = formData.includeGst ? (basePrice * (parseFloat(formData.gstPercent) / 100)) : 0;
        const tdsAmount = formData.includeTds ? (basePrice * (parseFloat(formData.tdsPercent) / 100)) : 0;
        const brokerageAmount = formData.includeBrokerage ? (basePrice * (parseFloat(formData.brokeragePercent) / 100)) : 0;

        const totalGovtCharges = stampDutyAmount + registrationAmount + legalFees;
        const netPayable = basePrice + totalGovtCharges + gstAmount + brokerageAmount - tdsAmount;

        return {
            basePrice,
            collectorValue,
            stampDutyAmount,
            registrationAmount,
            gstAmount,
            tdsAmount,
            brokerageAmount,
            totalGovtCharges,
            netPayable,
            legalFees,
            stampDutyPercent
        };
    }, [deal, formData, selectedCollectorRate, selectedRevenueRule]);

    const generateHTML = (data: any) => {
        const currency = (val: number) => `₹${val.toLocaleString('en-IN')}`;
        return `
            <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1e293b; }
                        .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                        .company-name { font-size: 28px; font-weight: bold; color: #0f172a; margin-bottom: 5px; }
                        .company-info { font-size: 12px; color: #64748b; margin-bottom: 2px; }
                        .title { font-size: 18px; font-weight: bold; color: #334155; margin-top: 20px; text-transform: uppercase; }
                        .section { margin-top: 30px; }
                        .section-title { font-size: 14px; font-weight: bold; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { text-align: left; font-size: 12px; color: #64748b; padding: 10px; background: #f8fafc; }
                        td { padding: 12px 10px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
                        .total-box { margin-top: 40px; background: #f8fafc; padding: 20px; border-left: 5px solid #2563eb; }
                        .total-label { font-size: 14px; font-weight: bold; color: #64748b; }
                        .total-value { font-size: 24px; font-weight: bold; color: #2563eb; margin-top: 5px; }
                        .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; font-style: italic; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-name">BHARAT PROPERTIES</div>
                        <div class="company-info">Mob: +91 99910 00570 | Email: bharatproperties570@gmail.com</div>
                        <div class="company-info">Office: 166, Sec 3, Huda Mkt., Kurukshetra, Haryana</div>
                    </div>

                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <div class="section-title">VALUED PROSPECT</div>
                            <div style="font-size: 16px; font-weight: bold;">${selectedLead?.fullName || 'Titled Client'}</div>
                            <div style="font-size: 12px; color: #64748b;">Client Type: Individual (${formData.buyerType})</div>
                        </div>
                        <div style="text-align: right;">
                            <div class="section-title">INVENTORY</div>
                            <div style="font-size: 16px; font-weight: bold;">${deal?.projectName || 'Premium Development'}</div>
                            <div style="font-size: 12px; color: #64748b;">Unit: ${deal?.unitNo || 'Standard'} | ${deal?.category || ''}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">INVESTMENT DETAILS & REGULATORY CHARGES</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Computation Basis</th>
                                    <th style="text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Total Basic Sale Value</td>
                                    <td>As per Master Pricing</td>
                                    <td style="text-align: right; font-weight: bold;">${currency(data.basePrice)}</td>
                                </tr>
                                <tr>
                                    <td>Estimated Stamp Duty (${data.stampDutyPercent}%)</td>
                                    <td>Statutory Regulatory Levy</td>
                                    <td style="text-align: right; font-weight: bold;">${currency(data.stampDutyAmount)}</td>
                                </tr>
                                <tr>
                                    <td>Government Registration Fees</td>
                                    <td>Fixed Document Charges</td>
                                    <td style="text-align: right; font-weight: bold;">${currency(data.registrationAmount)}</td>
                                </tr>
                                <tr>
                                    <td>Legal & Admin Documentation</td>
                                    <td>Standard Processing</td>
                                    <td style="text-align: right; font-weight: bold;">${currency(data.legalFees)}</td>
                                </tr>
                                ${formData.includeGst ? `
                                <tr>
                                    <td>GST Compliance (${formData.gstPercent}%)</td>
                                    <td>Input Tax Liability</td>
                                    <td style="text-align: right; font-weight: bold;">${currency(data.gstAmount)}</td>
                                </tr>
                                ` : ''}
                                ${formData.includeBrokerage ? `
                                <tr>
                                    <td>Professional Brokerage (${formData.brokeragePercent}%)</td>
                                    <td>Service Facilitation</td>
                                    <td style="text-align: right; font-weight: bold;">${currency(data.brokerageAmount)}</td>
                                </tr>
                                ` : ''}
                                ${formData.includeTds ? `
                                <tr>
                                    <td>TDS Deductible (${formData.tdsPercent}%)</td>
                                    <td>Income Tax Compliance</td>
                                    <td style="text-align: right; font-weight: bold;">-${currency(data.tdsAmount)}</td>
                                </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>

                    <div class="total-box">
                        <div class="total-label">NET LANDED COST ESTIMATE (NET PAYABLE)</div>
                        <div class="total-value">${currency(data.netPayable)}</div>
                    </div>

                    <div class="footer">
                        "HONEST & FAIR DEAL IS OUR MOTTO"
                    </div>
                </body>
            </html>
        `;
    };

    const handleSave = async (generatePDF = true) => {
        if (!calcs) return;
        setSaving(true);
        try {
            let pdfUrl = '';

            if (generatePDF) {
                const html = generateHTML(calcs);
                const { uri } = await Print.printToFileAsync({ html });
                
                const shareAvailable = await Sharing.isAvailableAsync();
                if (shareAvailable) {
                    await Sharing.shareAsync(uri);
                } else {
                    Alert.alert("PDF Generated", "PDF saved to temporary storage.");
                }
                pdfUrl = uri; 
            }

            const payload = {
                associatedContact: selectedLead?._id || selectedLead?.id,
                quotePrice: calcs.basePrice,
                calculations: calcs,
                stage: 'Quote',
                quoteUrl: pdfUrl,
                tags: [...(deal.tags || []), 'Quote Generated']
            };

            await api.put(`/deals/${dealId}`, payload);
            Alert.alert("Success", "Quotation saved and deal state updated to [QUOTE].");
            router.back();
        } catch (error) {
            console.error("Quotation error:", error);
            Alert.alert("Error", "Failed to generate or save quotation");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Professional Quote</Text>
                <TouchableOpacity onPress={() => handleSave(true)} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.saveText, { color: theme.primary }]}>SAVE</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 1. Buyer & Pricing */}
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>BUYER & PRICING</Text>
                    
                    {!selectedLead ? (
                        <View style={{ marginBottom: 20 }}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Search Prospect</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                                value={leadSearch}
                                onChangeText={setLeadSearch}
                                placeholder="Name or Mobile..."
                                placeholderTextColor={theme.textLight}
                            />
                            {isSearchingLeads && <ActivityIndicator size="small" style={{ marginTop: 10 }} />}
                            {leads.map(l => (
                                <TouchableOpacity key={l._id} style={styles.leadResult} onPress={() => setSelectedLead(l)}>
                                    <Text style={[styles.leadResultName, { color: theme.text }]}>{l.fullName}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 10 }}>{l.mobile}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.selectedLead}>
                            <Ionicons name="person-circle-outline" size={24} color={theme.primary} />
                            <Text style={[styles.selectedLeadName, { color: theme.text }]}>{selectedLead.fullName || selectedLead.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedLead(null)}><Ionicons name="close-circle" size={20} color={theme.textLight} /></TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.field}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Negotiated Price (₹)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, fontSize: 18, fontWeight: '800' }]}
                            value={formData.customPrice}
                            onChangeText={(v) => setFormData({ ...formData, customPrice: v })}
                            keyboardType="numeric"
                        />
                    </View>

                    <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>Buyer Category</Text>
                    <View style={styles.tabRow}>
                        {['Male', 'Female', 'Joint'].map(type => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.tab, { borderColor: theme.border }, formData.buyerType === type && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                onPress={() => setFormData({ ...formData, buyerType: type })}
                            >
                                <Text style={[styles.tabText, formData.buyerType === type && { color: '#fff' }]}>{type}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 2. Valuation Logic */}
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>VALUATION LOGIC</Text>
                    
                    <View style={styles.field}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Collector Rate (Area-Based)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 5 }}>
                            {collectorRates.map(r => (
                                <TouchableOpacity 
                                    key={r._id} 
                                    style={[styles.rateTag, { borderColor: theme.border }, formData.collectorRateId === r._id && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                    onPress={() => setFormData(prev => ({ ...prev, collectorRateId: r._id }))}
                                >
                                    <Text style={[styles.rateTagText, formData.collectorRateId === r._id && { color: '#fff' }]}>{r.name} (₹{r.rate})</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={[styles.field, { marginTop: 15 }]}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Revenue Configuration</Text>
                        <View style={{ gap: 8, marginTop: 5 }}>
                            {revenueRules.map(rule => (
                                <TouchableOpacity 
                                    key={rule._id} 
                                    style={[styles.ruleCard, { borderColor: theme.border }, formData.revenueRuleId === rule._id && { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}
                                    onPress={() => setFormData(prev => ({ ...prev, revenueRuleId: rule._id }))}
                                >
                                    <Text style={[styles.ruleName, { color: theme.text }]}>{rule.name}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 10 }}>SD: {rule.value?.stampDutyMale}% (M) | {rule.value?.stampDutyFemale}% (F)</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* 3. Taxes & Duties */}
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>TAXES & COMPLIANCE</Text>
                    
                    <View style={styles.switchRow}>
                        <View>
                            <Text style={[styles.switchLabel, { color: theme.text }]}>Include GST ({formData.gstPercent}%)</Text>
                            <Text style={[styles.switchSub, { color: theme.textSecondary }]}>Calculated on Negotiated Price</Text>
                        </View>
                        <Switch
                            value={formData.includeGst}
                            onValueChange={(v) => setFormData({ ...formData, includeGst: v })}
                            trackColor={{ false: "#767577", true: theme.primary + '80' }}
                            thumbColor={formData.includeGst ? theme.primary : "#f4f3f4"}
                        />
                    </View>

                    <View style={styles.switchRow}>
                        <View>
                            <Text style={[styles.switchLabel, { color: theme.text }]}>Professional Brokerage ({formData.brokeragePercent}%)</Text>
                        </View>
                        <Switch
                            value={formData.includeBrokerage}
                            onValueChange={(v) => setFormData({ ...formData, includeBrokerage: v })}
                            trackColor={{ false: "#767577", true: theme.primary + '80' }}
                            thumbColor={formData.includeBrokerage ? theme.primary : "#f4f3f4"}
                        />
                    </View>
                </View>

                {/* 4. Total Calculation Summary */}
                <View style={[styles.summaryCard, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: theme.primary + '30' }]}>
                    <View style={styles.summaryHeader}>
                        <Ionicons name="receipt-outline" size={24} color={theme.primary} />
                        <Text style={[styles.summaryTitle, { color: theme.text }]}>Net Landed Cost</Text>
                    </View>

                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Negotiated Price</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>₹{calcs?.basePrice.toLocaleString('en-IN')}</Text>
                    </View>

                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Stamp Duty ({calcs?.stampDutyPercent}%)</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>₹{calcs?.stampDutyAmount.toLocaleString('en-IN')}</Text>
                    </View>

                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Govt Reg. & Legal</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>₹{((calcs?.registrationAmount || 0) + (calcs?.legalFees || 0)).toLocaleString('en-IN')}</Text>
                    </View>

                    <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>TOTAL PAYABLE</Text>
                        <Text style={[styles.totalValue, { color: theme.primary }]}>₹{calcs?.netPayable.toLocaleString('en-IN')}</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: theme.primary }]} 
                onPress={() => handleSave(true)}
                disabled={saving || !selectedLead}
            >
                {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                        <Ionicons name="document-text-outline" size={20} color="#fff" />
                        <Text style={styles.saveBtnText}>Save & Generate PDF</Text>
                    </>
                )}
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1 },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
    saveText: { fontSize: 14, fontWeight: '800' },
    scrollContent: { padding: 20 },
    
    sectionCard: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 16 },
    cardTitle: { fontSize: 10, fontWeight: '800', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
    
    field: {},
    label: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
    input: { height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
    
    selectedLead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: 'rgba(37, 99, 235, 0.05)', marginBottom: 20 },
    selectedLeadName: { flex: 1, fontSize: 14, fontWeight: '700' },
    leadResult: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    leadResultName: { fontSize: 14, fontWeight: '600' },

    tabRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    tab: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    tabText: { fontSize: 13, fontWeight: '800' },

    rateTag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginRight: 10 },
    rateTagText: { fontSize: 11, fontWeight: '700' },
    ruleCard: { padding: 12, borderRadius: 12, borderWidth: 1 },
    ruleName: { fontSize: 13, fontWeight: '700' },

    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    switchLabel: { fontSize: 14, fontWeight: '700' },
    switchSub: { fontSize: 11, fontWeight: '500' },

    summaryCard: { padding: 24, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    summaryTitle: { fontSize: 18, fontWeight: '900' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    summaryLabel: { fontSize: 14, fontWeight: '600' },
    summaryValue: { fontSize: 14, fontWeight: '800' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderStyle: 'dashed' },
    totalLabel: { fontSize: 15, fontWeight: '800' },
    totalValue: { fontSize: 20, fontWeight: '900' },

    saveBtn: { position: 'absolute', bottom: 30, left: 20, right: 20, height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 8, shadowOpacity: 0.3, shadowRadius: 10 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});
