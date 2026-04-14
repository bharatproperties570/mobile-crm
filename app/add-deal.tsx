import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Modal, FlatList, Switch
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getDealById, addDeal, updateDeal, type Deal } from "@/services/deals.service";
import { useTheme, SPACING } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import { useProjects } from "@/context/ProjectContext";
import { extractList } from "@/services/api.helpers";
import api from "@/services/api";
import { MultiSearchableDropdown } from "@/components/MultiSearchableDropdown";

const DEAL_LOOKUP_TYPES = [
    "Property Type", "Unit Type", "Pricing Mode", "Transaction Type",
    "Deal Type", "Source", "Team", "Stage", "Intent", "Status"
];

const FORM_STEPS = ["Property", "Financials", "Details", "System"];

// ─── Reusable Components ──────────────────────────────────────────────────────

function SectionTitle({ title, icon }: { title: string; icon: string }) {
    return (
        <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionIcon}>{icon}</Text>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    );
}

function FormLabel({ label, required }: { label: string; required?: boolean }) {
    return (
        <View style={styles.labelContainer}>
            <Text style={styles.label}>{label}</Text>
            {required && <Text style={styles.required}>*</Text>}
        </View>
    );
}

function SelectButton({
    value, placeholder, options, onSelect,
}: {
    value: string; placeholder: string; options: { label: string, value: string }[]; onSelect: (v: string) => void;
}) {
    if (options.length === 0) return <Text style={{ color: '#9CA3AF', fontSize: 13, padding: 8 }}>{placeholder}</Text>;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: 20 }}>
            {options.map((opt, idx) => (
                <TouchableOpacity
                    key={`${opt.value || idx}-${idx}`}
                    style={[styles.chip, value === opt.value && styles.chipActive]}
                    onPress={() => onSelect(opt.value === value ? "" : opt.value)}
                >
                    <Text style={[styles.chipText, value === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

function SearchableDropdown({
    visible, onClose, options, onSelect, placeholder
}: {
    visible: boolean; onClose: () => void; options: { label: string, value: string }[]; onSelect: (v: string) => void; placeholder: string;
}) {
    const [search, setSearch] = useState("");
    const filtered = (options || []).filter(o =>
        o?.label?.toString().toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{placeholder}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={26} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.modalSearchInput}
                        placeholder="Search..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#9ca3af"
                    />
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, idx) => `${item.value}-${idx}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.modalListItem} onPress={() => { onSelect(item.value); onClose(); }}>
                                <Text style={styles.modalListItemText}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            </View>
        </Modal>
    );
}

export default function AddDealScreen() {
    const router = useRouter();
    const { id, prefill, location: pfLocation, price: pfPrice, size: pfSize, unitNo: pfUnitNo, mobile: pfMobile, name: pfName, type: pfType } = useLocalSearchParams<any>();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { getLookupValue, getLookupsByType, lookups, loading: loadingLookups } = useLookup();
    const { users, teams, loading: loadingUsers } = useUsers();
    const { projects, loading: loadingProjects } = useProjects();
    const { theme } = useTheme();


    const [formData, setFormData] = useState<any>({
        // Property & Intent
        intent: "Sell", // Sell, Rent, Lease
        projectName: "",
        block: "",
        unitNo: "",
        unitType: "Ordinary",
        propertyType: "Plot(Residential)",
        category: "",
        subCategory: "",
        size: "",
        sizeUnit: "Sq Ft",
        location: "",

        // Financials & Pricing
        pricingMode: "Total", // Total, Rate
        price: "",
        quotePrice: "",
        ratePrice: "",
        quoteRatePrice: "",
        priceInWords: "",
        quotePriceInWords: "",
        pricingNature: { negotiable: false, fixed: false },
        dealProbability: "50",

        // Commission (for backward compatibility if needed)
        commission: {
            brokeragePercent: "",
            expectedAmount: "",
            actualAmount: "",
        },

        // Deal Details & Categorization
        status: "Open", // Open, Quote, Negotiation, Booked, Won, Lost
        dealType: "Registry case",
        transactionType: "Full White",
        flexiblePercentage: 50,
        source: "Walk-in",

        // Parties 
        owner: "",
        associatedContact: "",
        isOwnerSelected: false,
        isAssociateSelected: false,

        // System & Preferences
        publishOn: {
            website: false,
            facebook: false,
            instagram: false,
            whatsapp: false,
            linkedin: false,
            x: false
        },
        sendMatchedDeal: {
            sms: false,
            whatsapp: false,
            email: false,
            rcs: false
        },
        teams: [],
        team: "",
        assignedTo: "",
        visibleTo: "Everyone",
        remarks: "",
        stage: "Open",

        // Rent/Lease specific fields
        expectedRent: "",
        securityDeposit: "",
        leaseTermMonths: "",
        lockInMonths: "",
    });

    const [activeDropdown, setActiveDropdown] = useState<'project' | 'block' | 'unit' | 'status' | 'dealType' | 'transactionType' | 'source' | 'teams' | 'agent' | 'visibility' | null>(null);

    const [units, setUnits] = useState<any[]>([]);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);


    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Load existing deal if ID is present
                if (id) {
                    const existing = await getDealById(id);
                    if (existing) {
                        const d = existing.data || existing;
                        setFormData((prev: any) => ({
                            ...prev,
                            ...d,
                            price: String(d.price || ""),
                            quotePrice: String(d.quotePrice || ""),
                            ratePrice: String(d.ratePrice || ""),
                            dealProbability: String(d.dealProbability || "50"),
                            projectName: d.projectName || "",
                            stage: d.stage || "Open"
                        }));
                    }
                } 
                // 2. Handle Prefill from Inventory/URL
                else if (prefill === "true") {
                    const updates: any = {};
                    if (pfName) updates.projectName = pfName;
                    if (pfUnitNo) updates.unitNo = pfUnitNo;
                    if (pfLocation) updates.block = pfLocation; // Using location param for block
                    
                    // If we have an inventoryId, we should try to fetch the precise unit
                    // so that handleUnitChange can populate ALL details (size, owners, etc.)
                    if (useLocalSearchParams<{ inventoryId: string }>().inventoryId) {
                        const invId = useLocalSearchParams<{ inventoryId: string }>().inventoryId;
                        try {
                            const res = await api.get(`/inventory/${invId}`);
                            if (res.data?.success && res.data.data) {
                                const inv = res.data.data;
                                updates.projectName = inv.projectName || pfName;
                                updates.block = inv.block || pfLocation;
                                updates.unitNo = inv.unitNumber || inv.unitNo || pfUnitNo;
                                updates.inventoryId = invId;
                            }
                        } catch (e) { console.warn("Prefill fetch failed", e); }
                    }

                    setFormData((prev: any) => ({ ...prev, ...updates }));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id, prefill]);

    useEffect(() => {
        const fetchUnits = async () => {
            if (!formData.projectName) {
                setUnits([]);
                return;
            }
            setIsLoadingUnits(true);
            try {
                const params = new URLSearchParams();
                params.append('area', formData.projectName);
                if (formData.block) {
                    params.append('location', formData.block);
                }
                const response = await api.get(`/inventory?${params.toString()}`);
                if (response.data && (response.data.success || response.status === 200)) {
                    setUnits(extractList(response.data));
                }
            } catch (error) {
                console.error("Error fetching units:", error);
            } finally {
                setIsLoadingUnits(false);
            }
        };
        fetchUnits();
    }, [formData.projectName, formData.block]);

    const handleProjectChange = (projectName: string) => {
        const project = projects.find(p => p.name === projectName);
        const availableBlocks = project ? (project.blocks || []).map((b: any) => typeof b === 'string' ? b : b.name) : [];
        const defaultBlock = availableBlocks.length === 1 ? availableBlocks[0] : '';
        setFormData({
            ...formData,
            projectName,
            block: defaultBlock,
            unitNo: "", propertyType: "", size: ""
        });
    };

    const handleUnitChange = (unitNo: string) => {
        const unit = units.find(i => (i.unitNo === unitNo || i.unitNumber === unitNo));
        if (unit) {
            setFormData({
                ...formData,
                unitNo,
                inventoryId: unit._id,
                propertyType: unit.type || unit.category || formData.propertyType,
                category: unit.category || "",
                subCategory: unit.subCategory || "",
                size: unit.size ? String(unit.size) : formData.size,
                sizeUnit: unit.sizeUnit || formData.sizeUnit,
                location: unit.location || unit.address?.city || formData.location,

                // Detailed Data Inheritance
                unitSpecification: {
                    facing: unit.facing,
                    direction: unit.direction,
                    orientation: unit.orientation,
                    roadWidth: unit.roadWidth,
                    builtupType: unit.builtupType,
                    ownership: unit.ownership,
                    length: unit.length,
                    width: unit.width,
                    sizeLabel: unit.sizeLabel,
                    totalSaleableArea: unit.totalSaleableArea,
                    builtUpArea: unit.builtUpArea,
                    carpetArea: unit.carpetArea
                },
                locationDetails: unit.address || {},
                builtupDetails: unit.builtupDetails || [],
                furnishing: {
                    furnishType: unit.furnishType,
                    furnishedItems: unit.furnishedItems,
                    possessionStatus: unit.possessionStatus,
                    constructionAge: unit.constructionAge || unit.ageOfConstruction
                },
                documents: unit.inventoryDocuments || [],

                // Contacts
                unitOwners: unit.owners || [],
                unitAssociates: unit.associates || [],
                
                // Defaults for saving (first ones)
                owner: unit.owners?.[0] || null,
                associatedContact: unit.associates?.[0] || null,
                isOwnerSelected: !!unit.owners?.[0],
                isAssociateSelected: !!unit.associates?.[0]
            });
        } else {
            setFormData({ ...formData, unitNo });
        }
    };

    const handlePriceChange = (field: string, value: string) => {
        const sizeVal = parseFloat(formData.size?.toString().replace(/[^0-9.]/g, '') || '0');
        const numValue = parseFloat(value || '0');
        let updates: any = { [field]: value };

        const isRateMode = formData.pricingMode === 'Rate';
        const isQuote = field === 'quotePrice' || field === 'quoteRatePrice';

        if (isRateMode) {
            if (!isNaN(sizeVal) && sizeVal > 0 && !isNaN(numValue)) {
                const total = Math.round(sizeVal * numValue);
                updates[isQuote ? 'quotePrice' : 'price'] = total.toString();
            } else {
                updates[isQuote ? 'quotePrice' : 'price'] = '';
            }
        } else {
            if (!isNaN(sizeVal) && sizeVal > 0 && !isNaN(numValue)) {
                const rate = Math.round(numValue / sizeVal);
                updates[isQuote ? 'quoteRatePrice' : 'ratePrice'] = rate.toString();
            } else {
                updates[isQuote ? 'quoteRatePrice' : 'ratePrice'] = '';
            }
        }
        setFormData({ ...formData, ...updates });
    };

    const handleSave = async () => {
        if (!formData.projectName || (!formData.intent && !formData.stage)) {
            Alert.alert("Missing Info", "Project is required.");
            return;
        }

        setIsSaving(true);
        try {
            const payload: any = { ...formData };

            // Clean specific numeric fields to avoid MongoDB cast errors from empty strings
            const numFields = [
                'price', 'quotePrice', 'ratePrice', 'quoteRatePrice',
                'size', 'dealProbability', 'flexiblePercentage',
                'expectedRent', 'securityDeposit', 'leaseTermMonths', 'lockInMonths'
            ];
            numFields.forEach((f: string) => {
                if (payload[f] === "" || payload[f] === null || payload[f] === undefined) {
                    delete payload[f]; 
                } else if (typeof payload[f] === 'string') {
                    const trimmed = payload[f].trim();
                    if (trimmed === "") {
                        delete payload[f];
                    } else if (!isNaN(Number(trimmed))) {
                        payload[f] = Number(trimmed);
                    }
                }
            });

            // Map projectName back to projectId
            const selectedProj = projects.find(p => p.name === formData.projectName);
            if (selectedProj) {
                payload.projectId = selectedProj._id || selectedProj.id;
            }

            // Map Lookup String Values to their ObjectId references for specific fields only
            // Following Web CRM logic: Property Type, Unit Type, Source, Category, SubCategory are IDs
            // Status, Deal Type, Transaction Type, Intent are Strings
            const referenceLookupFields = ['Unit Type', 'Property Type', 'Source'];
            const enumStringFields = ['Status', 'Deal Type', 'Transaction Type', 'Intent'];

            const lookupMeta: Record<string, string> = {
                'Unit Type': 'unitType', 'Property Type': 'propertyType', 'Status': 'status',
                'Deal Type': 'dealType', 'Transaction Type': 'transactionType', 'Source': 'source',
                'Intent': 'intent'
            };

            referenceLookupFields.forEach(lookupKey => {
                const fieldKey = lookupMeta[lookupKey];
                if (fieldKey && payload[fieldKey] && typeof payload[fieldKey] === 'string') {
                    const lookupsForType = getLookupsByType(lookupKey);
                    const foundId = lookupsForType.find((l: any) => l.lookup_value === payload[fieldKey])?._id;
                    if (foundId) payload[fieldKey] = foundId;
                }
            });

            // Ensure enumStringFields remain as strings (labels)
            // No transformation needed as they are already labels in payload from formData

            // Cast numerical fields
            if (payload.price) payload.price = parseFloat(String(payload.price).replace(/[^0-9.]/g, '')) || 0;
            if (payload.size) payload.size = parseFloat(String(payload.size).replace(/[^0-9.]/g, '')) || 0;
            if (payload.quotePrice) payload.quotePrice = parseFloat(String(payload.quotePrice).replace(/[^0-9.]/g, '')) || 0;
            if (payload.ratePrice) payload.ratePrice = parseFloat(String(payload.ratePrice).replace(/[^0-9.]/g, '')) || 0;


            // Strip nested objects to strictly send IDs strings for party/lookup fields
            if (formData.isOwnerSelected && formData.owner) {
                payload.owner = typeof formData.owner === 'object' ? formData.owner._id || formData.owner.id : formData.owner;
            } else {
                payload.owner = null;
            }
            if (formData.isAssociateSelected && formData.associatedContact) {
                payload.associatedContact = typeof formData.associatedContact === 'object' ? formData.associatedContact._id || formData.associatedContact.id : formData.associatedContact;
            } else {
                payload.associatedContact = null;
            }

            // Other populated drop downs
            payload.teams = formData.teams.length > 0 ? formData.teams : (formData.team ? [formData.team] : []);
            if (payload.assignedTo && typeof payload.assignedTo === 'object') payload.assignedTo = payload.assignedTo._id || payload.assignedTo.id;

            // Optional: If units is loaded, set inventoryId to sync inventory status
            const selectedUnit = units.find(u => (u.unitNo === formData.unitNo || u.unitNumber === formData.unitNo));
            if (selectedUnit && selectedUnit._id) {
                payload.inventoryId = selectedUnit._id;
            }

            // ━━ DEBUG LOGGING (Senior Professional) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            console.log('[DEBUG-DEAL] Starting Save Workflow...');
            console.log('[DEBUG-DEAL] Payload:', JSON.stringify(payload, null, 2));

            const res = id ? await api.put(`/deals/${id}`, payload) : await api.post('/deals', payload);
            
            console.log('[DEBUG-DEAL] API Response Status:', res.status);
            console.log('[DEBUG-DEAL] API Response Data:', JSON.stringify(res.data, null, 2));

            if (res.data && (res.data.success || res.status === 200 || res.status === 201)) {
                router.dismissAll();
                router.replace("/(tabs)/deals");
            } else {
                const errorMsg = res.data?.error || res.data?.message || "Server returned failure without an error message.";
                console.error("Deal save logic failure:", res.data);
                Alert.alert("Failed to Save", errorMsg);
            }
        } catch (e: any) {
            console.error("Deal save network/runtime error:", e?.response?.data || e);
            const errMsg = e?.response?.data?.error || e?.response?.data?.message || e.message || "An unexpected error occurred while saving.";
            Alert.alert("Save Error", errMsg);
        } finally {
            setIsSaving(false);
        }
    };

    // Remove blocking spinner for "Instant Open" experience

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/deals")} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{id ? "Edit Deal" : "New Deal"}</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator size="small" color="#1E3A8A" /> : <Text style={styles.saveBtn}>Save</Text>}
                </TouchableOpacity>
            </View>

            {/* Steps */}
            <View style={styles.stepsRow}>
                {FORM_STEPS.map((s, i) => (
                    <View key={s} style={styles.stepItem}>
                        <View style={[styles.stepCircle, step >= i && styles.stepCircleActive]}>
                            <Text style={[styles.stepNumber, step >= i && styles.stepNumberActive]}>{i + 1}</Text>
                        </View>
                        <Text style={[styles.stepLabel, step === i && styles.stepLabelActive]}>{s}</Text>
                    </View>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {step === 0 && (
                    <View>
                        <SectionTitle title="Intent" icon="🎯" />
                        <View style={styles.intentRow}>
                            {["Sell", "Rent", "Lease"].map(opt => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[styles.intentBtn, formData.intent === opt && styles.intentBtnActive]}
                                    onPress={() => setFormData({ ...formData, intent: opt })}
                                >
                                    <Text style={[styles.intentText, formData.intent === opt && styles.intentTextActive]}>{opt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <SectionTitle title="Property Details" icon="🏢" />
                        <FormLabel label="Project Name" required />
                        <TouchableOpacity style={styles.pickerContainer} onPress={() => setActiveDropdown('project')}>
                            <Text style={[styles.nativeSelect, !formData.projectName && { color: '#94A3B8' }]}>
                                {formData.projectName || "Select Project"}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color="#64748B" style={{ position: 'absolute', right: 12 }} />
                        </TouchableOpacity>

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <FormLabel label="Block" />
                                <TouchableOpacity
                                    style={[styles.pickerContainer, !formData.projectName && { opacity: 0.6 }]}
                                    onPress={() => formData.projectName && setActiveDropdown('block')}
                                >
                                    <Text style={[styles.nativeSelect, !formData.block && { color: '#94A3B8' }]}>
                                        {formData.block || "Select Block"}
                                    </Text>
                                    <Ionicons name="chevron-down" size={18} color="#64748B" style={{ position: 'absolute', right: 12 }} />
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1 }}>
                                <FormLabel label="Unit No." />
                                <TouchableOpacity
                                    style={[styles.pickerContainer, (!formData.block || isLoadingUnits) && { opacity: 0.6 }]}
                                    onPress={() => formData.block && !isLoadingUnits && setActiveDropdown('unit')}
                                >
                                    <Text style={[styles.nativeSelect, !formData.unitNo && { color: '#94A3B8' }]}>
                                        {isLoadingUnits ? "Loading..." : (formData.unitNo || "Select Unit")}
                                    </Text>
                                    <Ionicons name="chevron-down" size={18} color="#64748B" style={{ position: 'absolute', right: 12 }} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {formData.unitNo && (formData.unitOwners?.length > 0 || formData.unitAssociates?.length > 0) ? (
                            <View style={[styles.partyBox, { marginTop: 12 }]}>
                                <Text style={styles.partyBoxTitle}>Unit Contacts</Text>
                                
                                {formData.unitOwners?.map((owner: any, idx: number) => (
                                    <View key={`owner-${idx}`} style={[styles.partyItem, idx === formData.unitOwners.length - 1 && !formData.unitAssociates?.length && { borderBottomWidth: 0 }]}>
                                        <View style={styles.partyAvatar}>
                                            <Ionicons name="person" size={14} color="#1E3A8A" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.partyLabel}>Owner {formData.unitOwners.length > 1 ? idx + 1 : ''}</Text>
                                            <Text style={styles.partyText}>{owner.name || owner.fullName || "—"}</Text>
                                            {(owner.phone || owner.mobile) && <Text style={styles.partySubText}>{owner.phone || owner.mobile}</Text>}
                                        </View>
                                    </View>
                                ))}

                                {formData.unitAssociates?.map((assoc: any, idx: number) => (
                                    <View key={`assoc-${idx}`} style={[styles.partyItem, idx === formData.unitAssociates.length - 1 && { borderBottomWidth: 0 }]}>
                                        <View style={[styles.partyAvatar, { backgroundColor: '#EEF2FF' }]}>
                                            <Ionicons name="people" size={14} color="#6366F1" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[styles.partyLabel, { color: '#6366F1' }]}>Agent/Associate {formData.unitAssociates.length > 1 ? idx + 1 : ''}</Text>
                                            <Text style={styles.partyText}>{assoc.name || assoc.fullName || "—"}</Text>
                                            {(assoc.phone || assoc.mobile) && <Text style={styles.partySubText}>{assoc.phone || assoc.mobile}</Text>}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                    </View>
                )}

                {step === 1 && (
                    <View>
                        <SectionTitle title="Financials & Pricing" icon="💰" />

                        {formData.size ? (
                            <View style={{ backgroundColor: '#F0F9FF', padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#BAE6FD' }}>
                                <Ionicons name="expand-outline" size={16} color="#0369A1" />
                                <Text style={{ fontSize: 14, color: '#0369A1', fontWeight: '700' }}>
                                    Property Size: {formData.size} {formData.sizeUnit || 'Sq.Ft.'}
                                </Text>
                            </View>
                        ) : null}

                        <View style={styles.intentRow}>
                            <TouchableOpacity
                                style={[styles.intentBtn, formData.pricingMode === 'Total' && styles.intentBtnActive]}
                                onPress={() => setFormData({ ...formData, pricingMode: 'Total' })}
                            >
                                <Text style={[styles.intentText, formData.pricingMode === 'Total' && styles.intentTextActive]}>Total Amount</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.intentBtn, formData.pricingMode === 'Rate' && styles.intentBtnActive]}
                                onPress={() => setFormData({ ...formData, pricingMode: 'Rate' })}
                            >
                                <Text style={[styles.intentText, formData.pricingMode === 'Rate' && styles.intentTextActive]}>Per Unit Rate</Text>
                            </TouchableOpacity>
                        </View>

                        <FormLabel label={`Expected Price ${formData.pricingMode === 'Rate' ? '(Rate)' : '(Total)'}`} />
                        <TextInput
                            style={styles.input}
                            value={formData.pricingMode === 'Total' ? formData.price : formData.ratePrice}
                            keyboardType="numeric"
                            onChangeText={t => handlePriceChange(formData.pricingMode === 'Total' ? 'price' : 'ratePrice', t)}
                        />
                        {formData.priceInWords ? <Text style={styles.wordsText}>({formData.priceInWords} Rupees Only)</Text> : null}

                        <FormLabel label={`Quote Price ${formData.pricingMode === 'Rate' ? '(Rate)' : '(Total)'}`} />
                        <TextInput
                            style={styles.input}
                            value={formData.pricingMode === 'Total' ? formData.quotePrice : formData.quoteRatePrice}
                            keyboardType="numeric"
                            onChangeText={t => handlePriceChange(formData.pricingMode === 'Total' ? 'quotePrice' : 'quoteRatePrice', t)}
                        />
                        {formData.quotePriceInWords ? <Text style={styles.wordsText}>({formData.quotePriceInWords} Rupees Only)</Text> : null}

                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleLabel}>Negotiable</Text>
                            <Switch value={formData.pricingNature.negotiable} onValueChange={v => setFormData({ ...formData, pricingNature: { negotiable: v, fixed: !v } })} />
                        </View>
                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleLabel}>Fixed Price</Text>
                            <Switch value={formData.pricingNature.fixed} onValueChange={v => setFormData({ ...formData, pricingNature: { fixed: v, negotiable: !v } })} />
                        </View>

                        {(formData.intent === "Rent" || formData.intent === "Lease") && (
                            <View style={{ marginTop: 20, padding: 16, backgroundColor: '#f0f9ff', borderRadius: 16, borderWidth: 1, borderColor: '#bae6fd' }}>
                                <SectionTitle title={`${formData.intent} Details`} icon="📜" />

                                <FormLabel label={`Expected ${formData.intent}`} />
                                <TextInput
                                    style={styles.input}
                                    value={formData.expectedRent}
                                    keyboardType="numeric"
                                    onChangeText={t => setFormData({ ...formData, expectedRent: t })}
                                    placeholder={`Enter monthly ${formData.intent.toLowerCase()}`}
                                />

                                <FormLabel label="Security Deposit" />
                                <TextInput
                                    style={styles.input}
                                    value={formData.securityDeposit}
                                    keyboardType="numeric"
                                    onChangeText={t => setFormData({ ...formData, securityDeposit: t })}
                                    placeholder="Enter deposit amount"
                                />

                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <FormLabel label="Term (Months)" />
                                        <TextInput
                                            style={styles.input}
                                            value={formData.leaseTermMonths}
                                            keyboardType="numeric"
                                            onChangeText={t => setFormData({ ...formData, leaseTermMonths: t })}
                                            placeholder="Period"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <FormLabel label="Lock-in (Months)" />
                                        <TextInput
                                            style={styles.input}
                                            value={formData.lockInMonths}
                                            keyboardType="numeric"
                                            onChangeText={t => setFormData({ ...formData, lockInMonths: t })}
                                            placeholder="Lock-in"
                                        />
                                    </View>
                                </View>
                            </View>
                        )}

                        <FormLabel label="Deal Probability (%)" />
                        <TextInput style={styles.input} value={String(formData.dealProbability)} keyboardType="numeric" onChangeText={t => setFormData({ ...formData, dealProbability: t })} />
                    </View>
                )}

                {step === 2 && (
                    <View>
                        <SectionTitle title="Deal Details" icon="📊" />

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <FormLabel label="Deal Status" />
                                <SelectButton value={formData.status} placeholder="Status" options={["Open", "Quote", "Negotiation", "Booked", "Won", "Lost"].map(s => ({ label: s, value: s }))} onSelect={v => setFormData({ ...formData, status: v })} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <FormLabel label="Deal Type (Documentation)" />
                                <SelectButton 
                                    value={formData.dealType} 
                                    placeholder="Type" 
                                    options={[
                                        "Registry case", 
                                        "Transfer case", 
                                        "GPA", 
                                        "Society case", 
                                        "Lease/Rent", 
                                        "Other"
                                    ].map(s => ({ label: s, value: s }))} 
                                    onSelect={v => setFormData({ ...formData, dealType: v })} 
                                />
                            </View>
                        </View>

                        <FormLabel label="Transaction Type" />
                        <SelectButton value={formData.transactionType} placeholder="Select" options={["Full White", "Collector Rate", "Flexible"].map(s => ({ label: s, value: s }))} onSelect={v => setFormData({ ...formData, transactionType: v })} />

                        {formData.transactionType === "Flexible" && (
                            <View style={styles.sliderBox}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={styles.sliderLabel}>White Component</Text>
                                    <Text style={styles.sliderValue}>{formData.flexiblePercentage}%</Text>
                                </View>
                                {/* Native ranges map relatively okay to RN Web input type=range if carefully styled, or simple text input */}
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={String(formData.flexiblePercentage)}
                                    onChangeText={t => setFormData({ ...formData, flexiblePercentage: parseInt(t) || 0 })}
                                    placeholder="Enter percentage 0-100"
                                />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                    <Text style={styles.sliderHint}>0% (Full Cash)</Text>
                                    <Text style={styles.sliderHint}>100% (Full White)</Text>
                                </View>
                            </View>
                        )}

                        <FormLabel label="Source" />
                        <SelectButton value={formData.source} placeholder="Select Source" options={["Walk-in", "Newspaper", "99acres", "Social Media", "Cold Calling", "Own Website"].map(s => ({ label: s, value: s }))} onSelect={v => setFormData({ ...formData, source: v })} />
                    </View>
                )}

                {step === 3 && (
                    <View>
                        <SectionTitle title="Marketing Command Center" icon="🚀" />
                        <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 15, paddingHorizontal: 4 }}>Select platforms to automatically publish this deal. Our AI engine will generate platform-specific content.</Text>
                        
                        <SectionTitle title="Publish On" icon="📢" />
                        <View style={styles.gridContainer}>
                            {[
                                { id: 'website', icon: 'globe', label: 'Website', color: '#2563eb' },
                                { id: 'facebook', icon: 'logo-facebook', label: 'Facebook', color: '#1877f2' },
                                { id: 'instagram', icon: 'logo-instagram', label: 'Instagram', color: '#e4405f' },
                                { id: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25d366' },
                                { id: 'linkedin', icon: 'logo-linkedin', label: 'LinkedIn', color: '#0077b5' },
                                { id: 'x', icon: 'logo-twitter', label: 'X', color: '#000000' }
                            ].map(platform => (
                                <TouchableOpacity
                                    key={platform.id}
                                    style={[styles.gridBtn, formData.publishOn[platform.id] && { borderColor: platform.color, backgroundColor: `${platform.color}15` }]}
                                    onPress={() => setFormData({
                                        ...formData,
                                        publishOn: { ...formData.publishOn, [platform.id]: !formData.publishOn[platform.id] }
                                    })}
                                >
                                    <Ionicons name={platform.icon as any} size={16} color={formData.publishOn[platform.id] ? platform.color : '#64748b'} />
                                    <Text style={[styles.gridBtnText, formData.publishOn[platform.id] && { color: platform.color }]}>{platform.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ marginTop: 20 }}>
                            <SectionTitle title="AI Lead Matching & Outreach" icon="🎯" />
                            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 15, paddingHorizontal: 4 }}>Automatically notify matching leads via selected channels upon deal creation.</Text>
                        </View>
                        
                        <SectionTitle title="Send Matched Deal" icon="✉️" />
                        <View style={styles.gridContainer}>
                            {[
                                { id: 'sms', icon: 'chatbubble-ellipses', label: 'SMS', color: '#6366f1' },
                                { id: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25d366' },
                                { id: 'email', icon: 'mail', label: 'Email', color: '#ef4444' },
                                { id: 'rcs', icon: 'chatbubbles', label: 'RCS', color: '#3b82f6' }
                            ].map(option => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.gridBtn, formData.sendMatchedDeal[option.id] && { borderColor: option.color, backgroundColor: `${option.color}10` }]}
                                    onPress={() => setFormData({
                                        ...formData,
                                        sendMatchedDeal: { ...formData.sendMatchedDeal, [option.id]: !formData.sendMatchedDeal[option.id] }
                                    })}
                                >
                                    <Ionicons name={option.icon as any} size={16} color={formData.sendMatchedDeal[option.id] ? option.color : '#64748b'} />
                                    <Text style={[styles.gridBtnText, formData.sendMatchedDeal[option.id] && { color: option.color }]}>{option.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <SectionTitle title="System & Assignment" icon="⚙️" />
                        <FormLabel label="Team(s)" />
                        <TouchableOpacity style={styles.pickerContainer} onPress={() => setActiveDropdown('teams')}>
                            <Text style={[styles.nativeSelect, (formData.teams || []).length === 0 && { color: '#94A3B8' }]}>
                                {formData.teams && formData.teams.length > 0 ? `${formData.teams.length} Team(s) Selected` : "Select Teams"}
                            </Text>
                            <Ionicons name="people-outline" size={18} color="#64748B" style={{ position: 'absolute', right: 12 }} />
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                            {formData.teams?.map((tid: string) => (
                                <View key={tid} style={{ backgroundColor: '#1E3A8A15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 6, marginBottom: 6 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#1E3A8A' }}>{teams.find(t => (t._id || t.id) === tid)?.name || tid}</Text>
                                </View>
                            ))}
                        </View>

                        <FormLabel label="Assigned RM" />
                        <TouchableOpacity style={styles.pickerContainer} onPress={() => setActiveDropdown('agent')}>
                            <Text style={[styles.nativeSelect, !formData.assignedTo && { color: '#94A3B8' }]}>
                                {users.find(u => (u._id || u.id) === formData.assignedTo)?.name || "Select Agent"}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color="#64748B" style={{ position: 'absolute', right: 12 }} />
                        </TouchableOpacity>

                        <FormLabel label="Visibility" />
                        <SelectButton value={formData.visibleTo} placeholder="Visibility" options={["Private", "Team", "Everyone"].map(v => ({ label: v, value: v }))} onSelect={v => setFormData({ ...formData, visibleTo: v })} />

                        <FormLabel label="Remarks / Notes" />
                        <TextInput style={[styles.input, { height: 120 }]} multiline value={formData.remarks} onChangeText={t => setFormData({ ...formData, remarks: t })} />
                    </View>
                )}
            </ScrollView>

            {/* Modals & Dropdowns */}
            <SearchableDropdown
                visible={activeDropdown === 'project'}
                onClose={() => setActiveDropdown(null)}
                options={projects.map(p => ({ label: p.name, value: p.name }))}
                placeholder="Select Project"
                onSelect={handleProjectChange}
            />
            <SearchableDropdown
                visible={activeDropdown === 'block'}
                onClose={() => setActiveDropdown(null)}
                options={projects.find(p => p.name === formData.projectName)?.blocks?.map((b: any) => ({ label: typeof b === 'string' ? b : b.name, value: typeof b === 'string' ? b : b.name })) || []}
                placeholder="Select Block"
                onSelect={val => setFormData({ ...formData, block: val, unitNo: "", propertyType: "", size: "" })}
            />
            <SearchableDropdown
                visible={activeDropdown === 'unit'}
                onClose={() => setActiveDropdown(null)}
                options={units.map(u => ({ label: u.unitNo || u.unitNumber, value: u.unitNo || u.unitNumber }))}
                placeholder="Select Unit"
                onSelect={handleUnitChange}
            />
            <MultiSearchableDropdown
                visible={activeDropdown === 'teams'}
                onClose={() => setActiveDropdown(null)}
                options={teams.map(t => ({ label: t.name, value: t._id || t.id }))}
                selectedValues={formData.teams}
                onToggle={(val: string) => {
                    const current = formData.teams || [];
                    const newList = current.includes(val) ? current.filter((i: string) => i !== val) : [...current, val];
                    setFormData({ ...formData, teams: newList, assignedTo: "" });
                }}
                placeholder="Select Teams"
            />
            <SearchableDropdown
                visible={activeDropdown === 'agent'}
                onClose={() => setActiveDropdown(null)}
                options={users
                    .filter((user: any) => {
                        if (formData.teams?.length === 0) return true;
                        return formData.teams?.some((tid: string) => (user.teams || []).includes(tid) || user.team === tid);
                    })
                    .map((u: any) => ({ label: u.fullName || u.name, value: u._id || u.id }))}
                placeholder="Select Agent"
                onSelect={val => setFormData({ ...formData, assignedTo: val })}
            />

            {/* Footer Navigation */}
            <View style={styles.footer}>
                {step > 0 ? (
                    <TouchableOpacity style={styles.navBtn} onPress={() => setStep(step - 1)}>
                        <Text style={styles.navBtnText}>Previous</Text>
                    </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}

                {step < FORM_STEPS.length - 1 ? (
                    <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={() => setStep(step + 1)}>
                        <Text style={styles.navBtnTextPrimary}>Next Step</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: "#10B981" }]} onPress={handleSave}>
                        <Text style={styles.navBtnTextPrimary}>Finish & Save</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    saveBtn: { fontSize: 16, fontWeight: "700", color: "#1E3A8A" },
    stepsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 16, backgroundColor: "#F8FAFC" },
    stepItem: { alignItems: "center", flex: 1 },
    stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center", marginBottom: 4 },
    stepCircleActive: { backgroundColor: "#1E3A8A" },
    stepNumber: { fontSize: 12, fontWeight: "800", color: "#64748B" },
    stepNumberActive: { color: "#fff" },
    stepLabel: { fontSize: 10, fontWeight: "600", color: "#94A3B8" },
    stepLabelActive: { color: "#1E3A8A", fontWeight: "800" },
    scroll: { padding: 20 },
    labelContainer: { flexDirection: "row", marginBottom: 6, marginTop: 12 },
    label: { fontSize: 13, fontWeight: "700", color: "#475569" },
    required: { color: "#EF4444", marginLeft: 2 },
    input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, fontSize: 15, color: "#1E293B" },
    row: { flexDirection: "row" },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, marginTop: 8 },
    sectionIcon: { fontSize: 20, marginRight: 8 },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: "#1E3A8A", textTransform: "uppercase", letterSpacing: 0.5 },
    toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 12, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12 },
    toggleLabel: { fontSize: 14, fontWeight: "600", color: "#475569" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
    chipActive: { backgroundColor: "#EEF2FF", borderColor: "#6366F1" },
    chipText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
    chipTextActive: { color: "#6366F1" },
    footer: { flexDirection: "row", padding: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9", gap: 12 },
    navBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
    navBtnPrimary: { backgroundColor: "#1E3A8A" },
    navBtnText: { fontSize: 15, fontWeight: "700", color: "#64748B" },
    navBtnTextPrimary: { fontSize: 15, fontWeight: "700", color: "#fff" },
    intentRow: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4, marginBottom: 20 },
    intentBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
    intentBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    intentText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
    intentTextActive: { color: "#1E3A8A", fontWeight: "700" },
    pickerContainer: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, height: 48, justifyContent: 'center' },
    nativeSelect: { paddingHorizontal: 12, fontSize: 15, color: "#1E293B" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: 'flex-end' },
    modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
    modalSearchInput: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 16 },
    modalListItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalListItemText: { fontSize: 16, color: '#1E293B' },
    partyBox: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E2E8F0" },
    partyBoxTitle: { fontSize: 14, fontWeight: "700", color: "#1E3A8A", marginBottom: 12 },
    partyItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    partyAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    partyLabel: { fontSize: 10, fontWeight: "800", color: "#94A3B8", textTransform: 'uppercase', marginBottom: 2 },
    partyText: { fontSize: 15, color: "#1E293B", fontWeight: "700" },
    partySubText: { fontSize: 12, color: "#64748B", marginTop: 2 },
    wordsText: { fontSize: 12, color: "#6366F1", fontStyle: "italic", marginTop: 4 },
    sliderBox: { marginVertical: 12 },
    sliderLabel: { fontSize: 13, fontWeight: "600", color: "#64748B" },
    sliderValue: { fontSize: 16, fontWeight: "800", color: "#1E3A8A" },
    sliderHint: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
    gridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    gridBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
    gridBtnText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
});
