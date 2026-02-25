import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    ScrollView, TextInput, Pressable, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLookup } from '../context/LookupContext';

export interface FilterField {
    key: string;
    label: string;
    type: 'lookup' | 'range' | 'select' | 'tags';
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
    const { getLookupValue, lookups } = useLookup();
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

    const renderLookupField = (field: FilterField) => {
        const options = lookups.filter(l => l.lookup_type.toLowerCase() === field.lookupType?.toLowerCase());
        return (
            <View key={field.key} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{field.label}</Text>
                <View style={styles.chipGrid}>
                    {options.map(opt => (
                        <TouchableOpacity
                            key={opt._id}
                            style={[
                                styles.chip,
                                { borderColor: theme.border, backgroundColor: theme.card },
                                (filters[field.key] || []).includes(opt._id) && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }
                            ]}
                            onPress={() => toggleMultiSelect(field.key, opt._id)}
                        >
                            <Text style={[
                                styles.chipText,
                                { color: theme.textMuted },
                                (filters[field.key] || []).includes(opt._id) && { color: theme.primary, fontWeight: '700' }
                            ]}>{opt.lookup_value}</Text>
                        </TouchableOpacity>
                    ))}
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
                            if (field.type === 'lookup') return renderLookupField(field);
                            if (field.type === 'range') return renderRangeField(field);
                            if (field.type === 'select') return renderSelectField(field);
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
        height: '80%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    closeBtn: {
        padding: 4,
    },
    resetText: {
        fontSize: 15,
        fontWeight: '700',
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
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '600',
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
