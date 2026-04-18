import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Platform, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/context/ThemeContext";
import { CallerInfo } from "@/services/contacts.service";
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface Props {
    info: CallerInfo | null;
    onClose: () => void;
}

type TabType = 'Lead' | 'Deal' | 'Inventory' | 'Activity';

export default function CallBanner({ info, onClose }: Props) {
    const { theme } = useTheme();
    const router = useRouter();
    const slideAnim = useRef(new Animated.Value(-500)).current;
    const [activeTab, setActiveTab] = useState<TabType>('Lead');

    useEffect(() => {
        if (info) {
            // Priority: Explicit Entity -> Lead -> Deal -> Inventory -> Activity
            if (info.type && ['Lead', 'Deal', 'Inventory', 'Activity'].includes(info.type)) {
                setActiveTab(info.type as TabType);
            } else if (info.contexts) {
                if (info.contexts.Lead) setActiveTab('Lead');
                else if (info.contexts.Deal) setActiveTab('Deal');
                else if (info.contexts.Inventory) setActiveTab('Inventory');
                else if (info.contexts.Activity) setActiveTab('Activity');
            }

            Animated.spring(slideAnim, {
                toValue: 20,
                useNativeDriver: true,
                tension: 40,
                friction: 8
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -500,
                duration: 300,
                useNativeDriver: true
            }).start();
        }
    }, [info]);

    if (!info) return null;

    const changeTab = (tab: TabType) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveTab(tab);
    };

    const currentData = info.contexts?.[activeTab] || (info.type === activeTab ? info : null);

    const getTabConfig = (tab: TabType) => {
        const hasData = !!(info.contexts?.[tab] || (info.type === tab));
        switch (tab) {
            case 'Lead': return { color: '#3B82F6', icon: 'person-add', active: hasData };
            case 'Deal': return { color: '#10B981', icon: 'cash', active: hasData };
            case 'Inventory': return { color: '#8B5CF6', icon: 'business', active: hasData };
            case 'Activity': return { color: '#F59E0B', icon: 'time', active: hasData };
        }
    };

    const config = getTabConfig(activeTab);

    const handlePressProfile = () => {
        if (!currentData) return;
        onClose();
        const route = activeTab.toLowerCase();
        router.push(`/${route === 'activity' ? 'activities' : route}-detail?id=${currentData.entityId}` as any);
    };

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <View style={[styles.banner, { backgroundColor: theme.card, borderColor: theme.border }]}>
                
                {/* 1. Identity Header */}
                <View style={styles.header}>
                    <View style={styles.callerIdentity}>
                        <View style={[styles.avatar, { backgroundColor: config.color }]}>
                            <Text style={styles.avatarText}>{(currentData?.name || info.name).charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{currentData?.name || info.name}</Text>
                            <Text style={[styles.mobile, { color: theme.textLight }]}>{info.mobile}</Text>
                        </View>
                    </View>
                    
                    {/* Tab Selection Row */}
                    <View style={[styles.tabContainer, { backgroundColor: theme.background }]}>
                        {(['Lead', 'Deal', 'Inventory', 'Activity'] as TabType[]).map((tab) => {
                            const tabCfg = getTabConfig(tab);
                            const isActive = activeTab === tab;
                            return (
                                <TouchableOpacity 
                                    key={tab} 
                                    onPress={() => tabCfg.active && changeTab(tab)}
                                    style={[
                                        styles.tabItem, 
                                        isActive && { backgroundColor: theme.card, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
                                        !tabCfg.active && { opacity: 0.2 }
                                    ]}
                                >
                                    <Ionicons name={tabCfg.icon as any} size={15} color={isActive ? tabCfg.color : theme.textLight} />
                                    {tabCfg.active && !isActive && <View style={[styles.dataDot, { backgroundColor: tabCfg.color }]} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 2. Context Display */}
                {currentData ? (
                    <View style={[styles.intelligenceCard, { backgroundColor: theme.background }]}>
                        <View style={styles.contextHeader}>
                            <View style={[styles.typeBadge, { backgroundColor: config.color + '20' }]}>
                                <Text style={[styles.typeText, { color: config.color }]}>{activeTab.toUpperCase()}</Text>
                            </View>
                            {currentData.status && (
                                <View style={[styles.statusBadge, { backgroundColor: theme.border }]}>
                                    <Text style={[styles.statusText, { color: theme.textSecondary }]}>{currentData.status}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.dataGrid}>
                            <View style={styles.dataBlock}>
                                <Text style={[styles.dataLabel, { color: theme.textLight }]}>
                                    {activeTab === 'Activity' ? 'DUE DATE' : 'INTENT / TYPE'}
                                </Text>
                                <Text style={[styles.dataValue, { color: theme.text }]}>
                                    {currentData.intent || 'General Inq'} {currentData.subCategory ? `• ${currentData.subCategory}` : ''}
                                </Text>
                            </View>
                            
                            <View style={[styles.dataBlock, { borderLeftWidth: 1, borderLeftColor: theme.border, paddingLeft: 12 }]}>
                                <Text style={[styles.dataLabel, { color: theme.textLight }]}>
                                    {activeTab === 'Activity' ? 'SUBJECT / NOTES' : 'PROJECT / UNIT'}
                                </Text>
                                <Text style={[styles.dataValue, { color: theme.text }]} numberOfLines={1}>
                                    {currentData.projectName || currentData.unitNumber || 'Global Selection'}
                                </Text>
                            </View>
                        </View>

                        {currentData.budget && activeTab !== 'Activity' && (
                            <View style={[styles.highValueRow, { backgroundColor: theme.primary + '10' }]}>
                                <Ionicons name="wallet-outline" size={14} color={theme.primary} />
                                <Text style={[styles.highValueLabel, { color: theme.textSecondary }]}>VALUATION / BUDGET:</Text>
                                <Text style={[styles.highValueText, { color: theme.primary }]}>{currentData.budget}</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={[styles.emptyState, { backgroundColor: theme.background }]}>
                        <Ionicons name="information-circle-outline" size={24} color={theme.textLight} style={{ marginBottom: 4 }} />
                        <Text style={[styles.emptyText, { color: theme.textLight }]}>No {activeTab} briefing found.</Text>
                    </View>
                )}

                {/* 3. Action Control Hub */}
                <View style={styles.actionHub}>
                    <TouchableOpacity 
                        style={[styles.secondaryBtn, { borderColor: theme.border }]} 
                        onPress={handlePressProfile}
                    >
                        <Ionicons name="open-outline" size={18} color={theme.text} />
                        <Text style={[styles.secondaryBtnText, { color: theme.text }]}>View Full</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                        onPress={() => {
                            onClose();
                            router.push({
                                pathname: "/outcome",
                                params: {
                                    id: 'new',
                                    entityId: currentData?.entityId || info.entityId,
                                    entityType: activeTab === 'Contact' ? 'Lead' : activeTab,
                                    entityName: currentData?.name || info.name,
                                    actType: 'Call',
                                    mobile: info.mobile
                                }
                            });
                        }}
                    >
                        <Ionicons name="checkmark-done" size={20} color="#fff" />
                        <Text style={styles.primaryBtnText}>Log Result</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close-circle" size={28} color={theme.textLight} opacity={0.5} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        paddingHorizontal: 12,
    },
    banner: {
        width: width - 24,
        borderRadius: 30,
        borderWidth: 1,
        padding: 16,
        paddingTop: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 15 },
                shadowOpacity: 0.25,
                shadowRadius: 30,
            },
            android: {
                elevation: 20,
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
        flex: 1,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
    },
    name: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    mobile: {
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.6,
    },
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    tabItem: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    dataDot: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    intelligenceCard: {
        borderRadius: 20,
        padding: 14,
        marginBottom: 16,
    },
    contextHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 9,
        fontWeight: '900',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '800',
    },
    dataGrid: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    dataBlock: {
        flex: 1,
    },
    dataLabel: {
        fontSize: 8,
        fontWeight: '800',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    dataValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    highValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        gap: 8,
    },
    highValueLabel: {
        fontSize: 9,
        fontWeight: '800',
    },
    highValueText: {
        fontSize: 14,
        fontWeight: '900',
        flex: 1,
        textAlign: 'right',
    },
    emptyState: {
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600',
    },
    actionHub: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        gap: 6,
    },
    secondaryBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },
    primaryBtn: {
        flex: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 8,
    },
    primaryBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#fff',
    },
    closeBtn: {
        position: 'absolute',
        top: -10,
        right: -10,
        zIndex: 10,
    },
});
