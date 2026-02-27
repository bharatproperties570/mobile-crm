import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ParsedDeal } from '../../utils/dealParser';

interface Props {
    item: ParsedDeal;
    onProcess: () => void;
}

export default function IntakeItemCard({ item, onProcess }: Props) {
    const { theme } = useTheme();

    const getIntentInfo = () => {
        switch (item.intent) {
            case 'BUYER': return { color: '#3B82F6', label: 'BUYER', icon: 'person' };
            case 'SELLER': return { color: '#10B981', label: 'SELLER', icon: 'home' };
            case 'LANDLORD': return { color: '#8B5CF6', label: 'LANDLORD', icon: 'key' };
            case 'TENANT': return { color: '#F59E0B', label: 'TENANT', icon: 'business' };
            default: return { color: '#64748B', label: 'UNKNOWN', icon: 'help' };
        }
    };

    const intent = getIntentInfo();

    const getConfidenceColor = (score: number) => {
        if (score >= 70) return '#10B981';
        if (score >= 40) return '#F59E0B';
        return '#EF4444';
    };

    return (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.header}>
                <View style={[styles.intentBadge, { backgroundColor: intent.color + '20' }]}>
                    <Ionicons name={intent.icon as any} size={12} color={intent.color} />
                    <Text style={[styles.intentText, { color: intent.color }]}>{intent.label}</Text>
                </View>

                <View style={styles.confidenceRow}>
                    <View style={[styles.dot, { backgroundColor: getConfidenceColor(item.confidenceScore) }]} />
                    <Text style={[styles.confidenceText, { color: theme.textLight }]}>
                        {item.confidenceScore}% Confidence
                    </Text>
                </View>
            </View>

            <View style={styles.content}>
                <Text style={[styles.location, { color: theme.text }]} numberOfLines={1}>
                    {item.location}
                </Text>

                <View style={styles.specsRow}>
                    <View style={styles.specItem}>
                        <Ionicons name="pricetag-outline" size={12} color={theme.textLight} />
                        <Text style={[styles.specText, { color: theme.textLight }]}>
                            {item.category} • {item.type}
                        </Text>
                    </View>
                    {item.specs.size && (
                        <View style={styles.specItem}>
                            <Ionicons name="expand-outline" size={12} color={theme.textLight} />
                            <Text style={[styles.specText, { color: theme.textLight }]}>{item.specs.size}</Text>
                        </View>
                    )}
                    {item.specs.price && (
                        <View style={styles.specItem}>
                            <Ionicons name="cash-outline" size={12} color={theme.textLight} />
                            <Text style={[styles.specText, { color: theme.text }]}>{item.specs.price}</Text>
                        </View>
                    )}
                </View>

                {item.remarks && (
                    <Text style={[styles.remarks, { color: theme.textLight }]} numberOfLines={2}>
                        "{item.remarks}"
                    </Text>
                )}

                {item.contacts.length > 0 && (
                    <View style={styles.contactRow}>
                        <Ionicons name="call-outline" size={12} color={theme.primary} />
                        <Text style={[styles.contactText, { color: theme.primary }]}>
                            {item.contacts[0].mobile}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <View style={styles.tags}>
                    {item.tags.map((tag, idx) => (
                        <View key={idx} style={[styles.tag, { backgroundColor: theme.primary + '10' }]}>
                            <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.processBtn, { backgroundColor: theme.primary }]}
                    onPress={onProcess}
                >
                    <Text style={styles.processBtnText}>Process</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    intentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    intentText: {
        fontSize: 10,
        fontWeight: '700',
    },
    confidenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    confidenceText: {
        fontSize: 10,
        fontWeight: '700',
    },
    content: {
        marginBottom: 12,
    },
    location: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    specsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 8,
    },
    specItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    specText: {
        fontSize: 12,
        fontWeight: '600',
    },
    remarks: {
        fontSize: 12,
        lineHeight: 18,
        marginTop: 4,
        fontStyle: 'italic',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    contactText: {
        fontSize: 12,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        flex: 1,
    },
    tag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tagText: {
        fontSize: 8,
        fontWeight: '800',
    },
    processBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    processBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
});

