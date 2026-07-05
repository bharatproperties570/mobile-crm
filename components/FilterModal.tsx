import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    ScrollView, TextInput, Pressable, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";

export interface FilterField {
    key: string;
    label: string;
    type: 'lookup' | 'range' | 'select' | 'tags' | 'header' | 'date';
    lookupType?: string;
    options?: { label: string; value: string }[];
}

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: any) => void;
    initialFilters: any;
    fields: FilterField[];
    users?: any[];
    teams?: any[];
}

export default function FilterModal({
    visible, onClose, onApply, initialFilters, fields, users = [], teams = []
}: FilterModalProps) {
    const { theme } = useTheme();
    const { getLookupValue, getLookupsByType } = useLookup();
    const [filters, setFilters] = useState<any>(initialFilters || {});

    useEffect(() => {
        if (visible) {
            setFilters(initialFilters || {});
        }
    }, [visible, initialFilters]);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({});
    };

    const toggleMultiSelect = (key: string, value: string) => {
        const current = filters[key] || [];
        const next = current.includes(value)
            ? current.filter((v: string) => v !== value)
            : [...current, value];
        setFilters({ ...filters, [key]: next });
    };

    const getDependentOptions = (field: FilterField) => {
        const type = field.lookupType || "";
        
        let parentKey = "";
        if (type === "ProfessionalSubCategory") parentKey = "professionCategory";
        if (type === "ProfessionalDesignation") parentKey = "professionSubCategory";
        if (type === "State") parentKey = "personalAddress.country";
        if (type === "City") parentKey = "personalAddress.state";
        if (type === "Location" || type === "Tehsil" || type === "PostOffice") parentKey = "personalAddress.city";
        if (type === "Pincode") {
            parentKey = (filters["personalAddress.postOffice"]?.length > 0) ? "personalAddress.postOffice" : "personalAddress.city";
        }

        if (parentKey) {
            const parentValues = filters[parentKey] || [];
            if (parentValues.length === 0) return [];
            return parentValues.flatMap((pVal: string) => getLookupsByType(type, pVal));
        }

        return getLookupsByType(type);
    };

    const renderLookupField = (field: FilterField) => {
        let options = getDependentOptions(field);
        
        // Hide dependent fields if parent is not selected
        if (options.length === 0) return null;
        
        // Enterprise UI Enhancement: Better layout and mapping for missing names
        return (
            <View key={field.key} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{field.label}</Text>
                <View style={styles.chipGrid}>
                    {options.map(opt => {
                        const isSelected = (filters[field.key] || []).includes(opt._id);
                        let displayName = opt.lookup_value || getLookupValue(field.lookupType || "", opt._id);
                        
                        // Fallback for legacy DB where status names might be missing
                        if (!displayName && field.lookupType === 'Status') {
                            displayName = ['64df1', 'available'].some(s => opt._id.toLowerCase().includes(s)) ? 'Available' :
                                          ['64df2', 'sold'].some(s => opt._id.toLowerCase().includes(s)) ? 'Sold' : opt._id;
                        }

                        return (
                            <TouchableOpacity
                                key={opt._id}
                                style={[
                                    styles.chip,
                                    { borderColor: theme.border, backgroundColor: theme.card, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
                                    isSelected && { 
                                        borderColor: theme.primary, 
                                        backgroundColor: theme.primary + '15',
                                        shadowOpacity: 0.1,
                                        elevation: 2
                                    }
                                ]}
                                onPress={() => toggleMultiSelect(field.key, opt._id)}
                            >
                                <Text style={[
                                    styles.chipText,
                                    { color: theme.textMuted },
                                    isSelected && { color: theme.primary, fontWeight: '700' }
                                ]}>
                                    {displayName || opt._id}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderRangeField = (field: FilterField) => {
        return (
            <View key={field.key} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{field.label}</Text>
                <View style={styles.rangeRow}>
                    <TextInput
                        style={[styles.rangeInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                        placeholder="Min"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="numeric"
                        value={filters[`${field.key}Min`] || ''}
                        onChangeText={(v) => setFilters({ ...filters, [`${field.key}Min`]: v })}
                    />
                    <Text style={{ color: theme.textMuted }}>to</Text>
                    <TextInput
                        style={[styles.rangeInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                        placeholder="Max"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="numeric"
                        value={filters[`${field.key}Max`] || ''}
                        onChangeText={(v) => setFilters({ ...filters, [`${field.key}Max`]: v })}
                    />
                </View>
            </View>
        );
    };

    const renderSelectField = (field: FilterField) => {
        const options = field.options || [];
        return (
            <View key={field.key} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{field.label}</Text>
                <View style={styles.chipGrid}>
                    {options.map(opt => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[
                                styles.chip,
                                { borderColor: theme.border, backgroundColor: theme.card },
                                (filters[field.key] || []).includes(opt.value) && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }
                            ]}
                            onPress={() => toggleMultiSelect(field.key, opt.value)}
                        >
                            <Text style={[
                                styles.chipText,
                                { color: theme.textMuted },
                                (filters[field.key] || []).includes(opt.value) && { color: theme.primary, fontWeight: '700' }
                            ]}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    const renderHeader = (field: FilterField) => (
        <View key={field.key} style={{ marginTop: 20, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 1.2 }}>{field.label}</Text>
        </View>
    );

    const renderDateField = (field: FilterField) => (
        <View key={field.key} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{field.label}</Text>
            <View style={styles.rangeRow}>
                <TextInput
                    style={[styles.rangeInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.textMuted}
                    value={filters[field.key] || ''}
                    onChangeText={(v) => setFilters({ ...filters, [field.key]: v })}
                />
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.background }]}>
                    <View style={[styles.header, { borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Filters</Text>
                        <TouchableOpacity onPress={handleReset}>
                            <Text style={[styles.resetText, { color: theme.primary }]}>Reset</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                        {fields.map(field => {
                            if (field.type === 'header') return renderHeader(field);
                            if (field.type === 'lookup') return renderLookupField(field);
                            if (field.type === 'range') return renderRangeField(field);
                            if (field.type === 'select') return renderSelectField(field);
                            if (field.type === 'date') return renderDateField(field);
                            return null;
                        })}
                    </ScrollView>

                    <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
                        <TouchableOpacity style={[styles.applyBtn, { backgroundColor: theme.primary }]} onPress={handleApply}>
                            <Text style={styles.applyBtnText}>Apply Filters</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        width: '100%',
        height: '90%',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    closeBtn: {
        padding: 8,
        marginLeft: -8,
        backgroundColor: 'rgba(128,128,128,0.1)',
        borderRadius: 20
    },
    resetText: {
        fontSize: 15,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 100,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.3
    },
    rangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rangeInput: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        borderTopWidth: 1,
    },
    applyBtn: {
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    applyBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
});
