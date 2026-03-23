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
    const slideAnim = useRef(new Animated.Value(-200)).current;

    useEffect(() => {
        if (info) {
            Animated.spring(slideAnim, {
                toValue: 20,
                useNativeDriver: true,
                tension: 50,
                friction: 8
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -200,
                duration: 300,
                useNativeDriver: true
            }).start();
        }
    }, [info]);

    if (!info) return null;

    const getTypeColor = () => {
        switch (info.type) {
            case 'Lead': return '#3B82F6';
            case 'Deal': return '#10B981';
            case 'Inventory': return '#8B5CF6';
            default: return '#64748B';
        }
    };

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
                <View style={styles.header}>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor() + '20' }]}>
                        <Text style={[styles.typeText, { color: getTypeColor() }]}>{info.type.toUpperCase()}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={18} color={theme.textLight} />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Text style={[styles.name, { color: theme.text }]}>{info.name}</Text>

                    {(info.projectName || info.unitNumber) && (
                        <View style={styles.detailsRow}>
                            {info.projectName && (
                                <View style={styles.detailItem}>
                                    <Ionicons name="business-outline" size={14} color={theme.textLight} />
                                    <Text style={[styles.detailText, { color: theme.textLight }]} numberOfLines={1}>
                                        {info.projectName}
                                    </Text>
                                </View>
                            )}
                            {info.unitNumber && (
                                <View style={styles.detailItem}>
                                    <Ionicons name="home-outline" size={14} color={theme.textLight} />
                                    <Text style={[styles.detailText, { color: theme.textLight }]}>
                                        Unit: {info.unitNumber}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {info.activity && (
                        <View style={[styles.activityRow, { backgroundColor: theme.primary + '08' }]}>
                            <Ionicons name="calendar-outline" size={14} color={theme.primary} />
                            <Text style={[styles.activityText, { color: theme.primary }]}>
                                {info.activity}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.primary + '15', flex: 1 }]}
                        onPress={handlePress}
                    >
                        <Text style={[styles.actionBtnText, { color: theme.primary }]}>Profile</Text>
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
                        <Text style={styles.actionBtnText}>Log Outcome</Text>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        paddingHorizontal: 16,
    },
    banner: {
        width: width - 32,
        borderRadius: 24,
        borderWidth: 1,
        padding: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    typeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        marginBottom: 16,
    },
    name: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 8,
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 8,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 14,
        fontWeight: '600',
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 12,
        marginTop: 4,
    },
    activityText: {
        fontSize: 13,
        fontWeight: '700',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 8,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});
