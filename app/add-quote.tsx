import React, { useState, useEffect, useMemo } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, SafeAreaView, Switch, Dimensions, Modal, Share, Linking
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

    const [showShareModal, setShowShareModal] = useState(false);
    const [generatedPdfUri, setGeneratedPdfUri] = useState("");
    const [generatedPdfUrl, setGeneratedPdfUrl] = useState("");

    const generateHTML = (data: any) => {
        const currency = (val: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const refNo = `BP/QTN/${new Date().getFullYear()}/${Math.floor(Math.random() * 900) + 100}`;
        const prospectName = selectedLead?.fullName || selectedLead?.name || 'Titled Client';
        const projectName = deal?.projectName || 'Premium Development';
        const unitNo = deal?.unitNo || 'Standard';

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; background: #fff; }
                        .branding-top { text-align: center; color: #dc2626; font-size: 11px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
                        .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                        .company-name { font-size: 34px; font-weight: bold; color: #1e293b; letter-spacing: -1.5px; margin-bottom: 4px; font-family: 'Times New Roman', serif; }
                        .company-info { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 2px; }
                        .quote-badge-container { display: flex; justify-content: center; margin-top: 20px; }
                        .quote-badge { background: #0f172a; color: #fff; padding: 6px 16px; font-size: 10px; font-weight: bold; border-radius: 4px; text-transform: uppercase; letter-spacing: 1.5px; }
                        
                        .meta-section { display: flex; justify-content: space-between; margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
                        .meta-col { flex: 1; }
                        .label { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
                        .value-main { font-size: 18px; font-weight: bold; color: #1e293b; }
                        .value-sub { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 500; }
                        
                        .section-title { font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 40px; margin-bottom: 15px; border-left: 4px solid #0f172a; padding-left: 12px; }
                        
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { text-align: left; font-size: 10px; color: #64748b; padding: 14px 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px; }
                        td { padding: 14px 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; }
                        .amount { text-align: right; font-weight: 700; color: #0f172a; }
                        
                        .total-card { margin-top: 40px; background: #f8fafc; border-left: 6px solid #2563eb; padding: 30px; border-radius: 0 12px 12px 0; display: flex; justify-content: space-between; align-items: center; }
                        .total-label-group { display: flex; flexDirection: column; }
                        .total-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                        .total-value { font-size: 32px; font-weight: 900; color: #2563eb; }
                        
                        .terms { margin-top: 50px; padding-top: 25px; border-top: 1px solid #f1f5f9; }
                        .terms-title { font-size: 11px; font-weight: 800; color: #1e293b; margin-bottom: 12px; text-transform: uppercase; }
                        .term-item { font-size: 10px; color: #94a3b8; margin-bottom: 6px; display: flex; gap: 10px; }
                        
                        .footer { margin-top: 60px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 20px; }
                        .motto { color: #1e293b; font-size: 13px; font-weight: 800; font-style: italic; letter-spacing: 1px; text-transform: uppercase; }
                    </style>
                </head>
                <body>
                    <div class="branding-top">Jai Mata Di</div>
                    <div class="header">
                        <div class="company-name">BHARAT PROPERTIES</div>
                        <div class="company-info">Mob: +91 99910 00570, 99913 33570 | bharatproperties570@gmail.com</div>
                        <div class="company-info">Office: 166, Sec 3, Huda Mkt., Kurukshetra, Haryana - 136118</div>
                        <div class="quote-badge-container">
                            <div class="quote-badge">Property Acquisition Quotation</div>
                        </div>
                    </div>
                    
                    <div class="meta-section">
                        <div class="meta-col">
                            <div class="label">Valued Prospect</div>
                            <div class="value-main">${prospectName}</div>
                            <div class="value-sub">Mobile: ${selectedLead?.mobile || 'Not Specified'}</div>
                        </div>
                        <div class="meta-col" style="text-align: right;">
                            <div class="label">Reference & Validity</div>
                            <div class="value-sub">Ref: ${refNo}</div>
                            <div class="value-sub">Date: ${dateStr}</div>
                        </div>
                    </div>

                    <div class="section-title">Investment Specifications</div>
                    <div class="meta-section" style="margin-top: 0; border: none; padding-top: 0;">
                        <div class="meta-col">
                            <div class="label">Project / Development</div>
                            <div class="value-main" style="color: #2563eb;">${projectName}</div>
                        </div>
                        <div class="meta-col" style="text-align: right;">
                            <div class="label">Unit Details</div>
                            <div class="value-main">Unit No: ${unitNo}</div>
                            <div class="value-sub">${deal?.category || 'Real Estate'} Property</div>
                        </div>
                    </div>

                    <div class="section-title">Financial Breakdown</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Basis of Calculation</th>
                                <th style="text-align: right;">Amount (INR)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Total Basic Sale Value</td>
                                <td>As per Negotiated Pricing</td>
                                <td class="amount">${currency(data.basePrice)}</td>
                            </tr>
                            <tr>
                                <td>Estimated Stamp Duty (${data.stampDutyPercent}%)</td>
                                <td>Statutory Regulatory Levy</td>
                                <td class="amount">${currency(data.stampDutyAmount)}</td>
                            </tr>
                            <tr>
                                <td>Government Registration Fees</td>
                                <td>Fixed Document Charges</td>
                                <td class="amount">${currency(data.registrationAmount)}</td>
                            </tr>
                            <tr>
                                <td>Legal & Admin Documentation</td>
                                <td>Standard Processing</td>
                                <td class="amount">${currency(data.legalFees)}</td>
                            </tr>
                            ${formData.includeGst ? `<tr><td>GST Compliance (18%)</td><td>Tax Liability</td><td class="amount">${currency(data.gstAmount)}</td></tr>` : ''}
                            ${formData.includeBrokerage ? `<tr><td>Professional Brokerage (${formData.brokeragePercent}%)</td><td>Service Facilitation</td><td class="amount">${currency(data.brokerageAmount)}</td></tr>` : ''}
                            ${formData.includeTds ? `<tr><td>TDS Deductible (1%)</td><td>IT Compliance</td><td class="amount">${currency(data.tdsAmount)}</td></tr>` : ''}
                        </tbody>
                    </table>

                    <div class="total-card">
                        <div class="total-label-group">
                            <div class="total-label">Net Landed Cost Estimate</div>
                            <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 5px;">Exclusive of maintenance & possession charges</div>
                        </div>
                        <div class="total-value">${currency(data.netPayable)}</div>
                    </div>

                    <div class="terms">
                        <div class="terms-title">Standard Terms & Compliance</div>
                        <div class="term-item"><span>•</span> <span>Quotation Validity: This estimate is valid for 7 business days from date of issue.</span></div>
                        <div class="term-item"><span>•</span> <span>Statutory Charges: Subject to government adjustments at time of actual registration.</span></div>
                        <div class="term-item"><span>•</span> <span>Verification: Buyers are requested to verify all property titles from physical records.</span></div>
                    </div>

                    <div class="footer">
                        <div class="motto">"HONEST & FAIR DEAL IS OUR MOTTO"</div>
                    </div>
                </body>
            </html>
        `;
    };

    const handleUploadToWeb = async (uri: string) => {
        try {
            // Check if URI is valid blob or file path
            if (!uri || uri.length < 5) return "";
            
            const fd = new FormData();
            if (Platform.OS === 'web') {
                // On web, uri might be a blob URL. We need the actual blob.
                const response = await fetch(uri);
                const blob = await response.blob();
                fd.append('file', blob, `Quotation_${dealId}.pdf`);
            } else {
                fd.append('file', {
                    uri,
                    type: 'application/pdf',
                    name: `Quotation_${dealId}.pdf`,
                } as any);
            }

            const uploadRes = await api.post('/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return uploadRes.data?.url || uploadRes.data?.data?.url || "";
        } catch (e) {
            console.warn("PDF Upload failed:", e);
            return "";
        }
    };

    const handleSave = async (generatePDF = true) => {
        if (!deal || !calcs) return;
        setSaving(true);
        try {
            let pdfUri = "";
            let publicUrl = "";

            if (generatePDF) {
                const html = generateHTML(calcs);
                console.log("[DEBUG] Generating Professional Quote HTML...");
                
                try {
                    // Expo Print Options
                    const printOptions = {
                        html,
                        base64: false,
                    };
                    
                    const result = await Print.printToFileAsync(printOptions);
                    
                    if (!result || !result.uri) {
                        // Fallback for Web if printToFileAsync is restricted
                        if (Platform.OS === 'web') {
                            console.warn("[DEBUG] PDF engine returned empty on Web. Attempting alternative...");
                            // On Web, we can still save the deal data and trigger a print dialog
                            // but we can't easily get a file for upload without a blob library.
                            // We'll proceed with saving data and warn the user.
                        } else {
                            throw new Error("PDF engine returned an empty result.");
                        }
                    } else {
                        pdfUri = result.uri;
                        console.log("[DEBUG] PDF Generated at:", pdfUri);
                        setGeneratedPdfUri(pdfUri);
                        publicUrl = await handleUploadToWeb(pdfUri);
                        setGeneratedPdfUrl(publicUrl);
                    }
                } catch (pdfError: any) {
                    console.error("[CRITICAL] PDF Generation Failed:", pdfError);
                    if (Platform.OS !== 'web') {
                        throw new Error(`PDF Engine Error: ${pdfError.message || "Failed to initialize native print renderer"}`);
                    }
                }
            }

            const payload = {
                associatedContact: selectedLead?._id || selectedLead?.id,
                quotePrice: calcs.basePrice,
                calculations: calcs,
                stage: 'Quote',
                quoteUrl: publicUrl || pdfUri || "Pending Sync",
                tags: Array.from(new Set([...(deal?.tags || []), 'Mobile Quote Generated']))
            };

            const res = await api.put(`/deals/${dealId}`, payload);
            if (res.data && (res.data.success || res.status === 200 || res.data._id)) {
                if (generatePDF && (publicUrl || pdfUri)) {
                    setShowShareModal(true);
                } else {
                    Alert.alert("Success", "Quotation data saved. " + (generatePDF ? "PDF generation is pending sync." : ""));
                    router.back();
                }
            } else {
                throw new Error(res.data?.error || "Failed to sync quotation data to server.");
            }
        } catch (error: any) {
            console.error("[CRITICAL] Quotation Save Failure:", error.message);
            Alert.alert("Save Failed", error.message || "Unknown error occurred while generating the quote.");
        } finally {
            setSaving(false);
        }
    };

    const handleShareWhatsApp = async () => {
        if (!selectedLead?.mobile) {
            Alert.alert("Error", "No mobile number for prospect.");
            return;
        }
        const message = `Halo ${selectedLead.name},\n\nPlease find your property quotation for ${deal?.projectName}.\n\nView Document: ${generatedPdfUrl || 'Generating...'}\n\nThank you,\nBharat Properties`;
        const phone = selectedLead.mobile.replace(/[^\d]/g, "");
        const url = `whatsapp://send?phone=${phone.length === 10 ? "91" + phone : phone}&text=${encodeURIComponent(message)}`;
        try {
            if (await Linking.canOpenURL(url)) await Linking.openURL(url);
            else await Share.share({ message });
        } catch (e) {
            await Share.share({ message });
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
                                    <Text style={[styles.leadResultName, { color: theme.text }]}>
                                        {l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim() || l.name || "Unknown Lead"}
                                    </Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>{l.mobile}</Text>
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
            <Modal visible={showShareModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={[styles.successBadge, { backgroundColor: theme.success + '15' }]}>
                            <Ionicons name="checkmark-done-circle" size={60} color={theme.success} />
                        </View>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Quotation Ready!</Text>
                        <Text style={[styles.modalSub, { color: theme.textSecondary }]}>The professional quotation has been generated and synced with the cloud.</Text>

                        <View style={styles.shareOptions}>
                            <TouchableOpacity style={styles.shareBtn} onPress={handleShareWhatsApp}>
                                <View style={[styles.shareIcon, { backgroundColor: '#25D366' }]}>
                                    <Ionicons name="logo-whatsapp" size={24} color="#fff" />
                                </View>
                                <Text style={[styles.shareBtnText, { color: theme.text }]}>WhatsApp</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ url: generatedPdfUrl || generatedPdfUri, message: `Quotation for ${deal?.projectName}: ${generatedPdfUrl || 'See attachment'}` })}>
                                <View style={[styles.shareIcon, { backgroundColor: theme.primary }]}>
                                    <Ionicons name="share-social" size={24} color="#fff" />
                                </View>
                                <Text style={[styles.shareBtnText, { color: theme.text }]}>Share / Email</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.shareBtn} onPress={() => { setShowShareModal(false); router.back(); }}>
                                <View style={[styles.shareIcon, { backgroundColor: theme.textLight }]}>
                                    <Ionicons name="checkmark" size={24} color="#fff" />
                                </View>
                                <Text style={[styles.shareBtnText, { color: theme.text }]}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    leadResultName: { fontSize: 17, fontWeight: '700' },

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
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', borderRadius: 32, padding: 30, alignItems: 'center' },
    successBadge: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 10 },
    modalSub: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 30, lineHeight: 20 },
    shareOptions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 15 },
    shareBtn: { flex: 1, alignItems: 'center', gap: 8 },
    shareIcon: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowOpacity: 0.2, shadowRadius: 5 },
    shareBtnText: { fontSize: 12, fontWeight: '700' }
});
