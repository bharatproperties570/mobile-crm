import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/context/ThemeContext";
import { CallerInfo } from "@/services/contacts.service";
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface Props {
    info: CallerInfo | null;
    onClose: () => void;
}

export default function CallBanner({ info, onClose }: Props) {
    const { theme } = useTheme();
    const router = useRouter();
    const slideAnim = useRef(new Animated.Value(-300)).current;

    useEffect(() => {
        if (info) {
            Animated.spring(slideAnim, {
                toValue: 20,
                useNativeDriver: true,
                tension: 50,
                friction: 10
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -300,
                duration: 300,
                useNativeDriver: true
            }).start();
        }
    }, [info]);

    if (!info) return null;

    const getTypeConfig = () => {
        switch (info.type) {
            case 'Lead': return { color: '#3B82F6', icon: 'person-add' };
            case 'Deal': return { color: '#10B981', icon: 'cash' };
            case 'Inventory': return { color: '#8B5CF6', icon: 'business' };
            default: return { color: '#64748B', icon: 'call' };
        }
    };

    const config = getTypeConfig();

    const handlePress = () => {
        onClose();
        const route = info.type.toLowerCase();
        router.push(`/${route}-detail?id=${info.entityId}` as any);
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] }
            ]}
        >
            <View style={[styles.banner, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {/* Header: Meta info */}
                <View style={styles.header}>
                    <View style={styles.callerIdentity}>
                        <View style={[styles.avatar, { backgroundColor: config.color }]}>
                            <Text style={styles.avatarText}>{info.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View>
                            <Text style={[styles.name, { color: theme.text }]}>{info.name}</Text>
                            <Text style={[styles.mobile, { color: theme.textLight }]}>{info.mobile || info.type}</Text>
                        </View>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: config.color + '15' }]}>
                        <Ionicons name={config.icon as any} size={10} color={config.color} />
                        <Text style={[styles.typeText, { color: config.color }]}>{info.type.toUpperCase()}</Text>
                    </View>
                </View>

                {/* Middle: Professional Context Grid */}
                <View style={styles.contextGrid}>
                    <View style={styles.contextItem}>
                        <View style={[styles.intentBadge, { backgroundColor: info.intent === 'Rent' ? '#F59E0B' : '#2563EB' }]}>
                            <Text style={styles.intentText}>{info.intent || 'Potential'}</Text>
                        </View>
                        <Text style={[styles.subCategoryText, { color: theme.text }]}>{info.subCategory || 'General Inquiry'}</Text>
                    </View>

                    <View style={styles.verticalDivider} />

                    <View style={styles.contextItem}>
                        <Text style={[styles.projectLabel, { color: theme.textLight }]}>PROJECT / UNIT</Text>
                        <Text style={[styles.projectName, { color: theme.text }]} numberOfLines={1}>
                            {info.projectName || info.unitNumber || 'Global Selection'}
                        </Text>
                    </View>
                </View>

                {/* Bottom: Budget Highlight */}
                {info.budget && (
                    <View style={[styles.budgetRow, { backgroundColor: theme.primary + '08' }]}>
                        <Text style={[styles.budgetLabel, { color: theme.textLight }]}>Max Budget</Text>
                        <Text style={[styles.budgetValue, { color: theme.primary }]}>{info.budget}</Text>
                    </View>
                )}

                {/* Footer: Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.border, flex: 1 }]}
                        onPress={handlePress}
                    >
                        <Ionicons name="eye-outline" size={16} color={theme.text} />
                        <Text style={[styles.actionBtnText, { color: theme.text }]}>Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.primary, flex: 2 }]}
                        onPress={() => {
                            onClose();
                            router.push({
                                pathname: "/outcome",
                                params: {
                                    id: 'new',
                                    entityId: info.entityId,
                                    entityType: info.type,
                                    entityName: info.name,
                                    actType: 'Call',
                                    status: 'Completed',
                                    mobile: info.mobile || ''
                                }
                            });
                        }}
                    >
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Log Result</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={onClose} style={styles.absCloseBtn}>
                    <Ionicons name="close-circle" size={24} color={theme.textLight} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        paddingHorizontal: 12,
    },
    banner: {
        width: width - 24,
        borderRadius: 24,
        borderWidth: 1,
        padding: 20,
        paddingTop: 24,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.2,
                shadowRadius: 24,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    callerIdentity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
    },
    name: {
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    mobile: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 10,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '900',
    },
    contextGrid: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        alignItems: 'center',
    },
    contextItem: {
        flex: 1,
        justifyContent: 'center',
    },
    verticalDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 16,
    },
    intentBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 4,
    },
    intentText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#fff',
        textTransform: 'uppercase',
    },
    subCategoryText: {
        fontSize: 14,
        fontWeight: '700',
    },
    projectLabel: {
        fontSize: 9,
        fontWeight: '800',
        marginBottom: 2,
        letterSpacing: 0.5,
    },
    projectName: {
        fontSize: 14,
        fontWeight: '800',
    },
    budgetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        marginBottom: 16,
    },
    budgetLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    budgetValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
    },
    actionBtnText: {
        fontSize: 15,
        fontWeight: '800',
    },
    absCloseBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 4,
    },
});
