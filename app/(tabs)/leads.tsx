import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Alert, Linking,
    Modal, Animated, Dimensions, Pressable, ScrollView, Vibration
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { getLeads, leadName, updateLead, deleteLead, type Lead } from "@/services/leads.service";
import { getLookups, type Lookup } from "@/services/lookups.service";
import { safeApiCall, lookupVal } from "@/services/api.helpers";
import { getLeadScores } from "@/services/stageEngine.service";
import api from "@/services/api";
import { useCallTracking } from "@/context/CallTrackingContext";
import { getOrCreateCallActivity } from "@/services/activities.service";
import { useTheme } from "@/context/ThemeContext";
import { Colors } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

const STATUS_COLORS_LIGHT: Record<string, string> = {
    active: "#10B981", new: "#64748B", contacted: "#8B5CF6",
    qualified: "#7C3AED", prospect: "#3B82F6", opportunity: "#F59E0B",
    negotiation: "#F97316", booked: "#10B981", won: "#059669", 
    lost: "#EF4444", stalled: "#78716C", dormant: "#94A3B8",
    hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6",
    urgent: "#E11D48"
};

const STATUS_COLORS_DARK: Record<string, string> = {
    active: "#34D399", new: "#94A3B8", contacted: "#A78BFA",
    qualified: "#8B5CF6", prospect: "#60A5FA", opportunity: "#FBBF24",
    negotiation: "#FB923C", booked: "#34D399", won: "#10B981", 
    lost: "#F87171", stalled: "#A8A29E", dormant: "#CBD5E1",
    hot: "#F87171", warm: "#FBBF24", cold: "#60A5FA",
    urgent: "#F43F5E"
};

const STAGE_CONFIG_LIGHT: Record<string, { color: string; icon: any }> = {
    "New": { color: "#94A3B8", icon: "star" },
    "Prospect": { color: "#3B82F6", icon: "person" },
    "Qualified": { color: "#8B5CF6", icon: "checkmark-circle" },
    "Opportunity": { color: "#F59E0B", icon: "flame" },
    "Negotiation": { color: "#F97316", icon: "chatbubbles" },
    "Booked": { color: "#10B981", icon: "calendar" },
    "Closed Won": { color: "#10B981", icon: "trophy" },
    "Closed Lost": { color: "#EF4444", icon: "close-circle" },
    "Stalled": { color: "#64748B", icon: "pause-circle" },
    "Dormant": { color: "#64748B", icon: "moon" },
    "default": { color: "#94A3B8", icon: "help-circle" }
};

const STAGE_CONFIG_DARK: Record<string, { color: string; icon: any }> = {
    "New": { color: "#CBD5E1", icon: "star" },
    "Prospect": { color: "#60A5FA", icon: "person" },
    "Qualified": { color: "#A78BFA", icon: "checkmark-circle" },
    "Opportunity": { color: "#FBBF24", icon: "flame" },
    "Negotiation": { color: "#FB923C", icon: "chatbubbles" },
    "Booked": { color: "#34D399", icon: "calendar" },
    "Closed Won": { color: "#34D399", icon: "trophy" },
    "Closed Lost": { color: "#F87171", icon: "close-circle" },
    "Stalled": { color: "#94A3B8", icon: "pause-circle" },
    "Dormant": { color: "#94A3B8", icon: "moon" },
    "default": { color: "#CBD5E1", icon: "help-circle" }
};

const REQ_CONFIG_LIGHT: Record<string, { icon: any; color: string; label: string }> = {
    buy: { icon: "cart", color: "#6366F1", label: "BUY" },
    rent: { icon: "key", color: "#F59E0B", label: "RENT" },
    lease: { icon: "business", color: "#8B5CF6", label: "LEASE" },
    default: { icon: "home", color: "#94A3B8", label: "REQ" }
};

const REQ_CONFIG_DARK: Record<string, { icon: any; color: string; label: string }> = {
    buy: { icon: "cart", color: "#818CF8", label: "BUY" },
    rent: { icon: "key", color: "#FBBF24", label: "RENT" },
    lease: { icon: "business", color: "#A78BFA", label: "LEASE" },
    default: { icon: "home", color: "#CBD5E1", label: "REQ" }
};

function formatTimeAgo(dateString?: string) {
    if (!dateString) return "—";
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function getLeadScore(lead: Lead, isDark = false) {
    const bgOpacity = isDark ? '25' : '15';
    const colors = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;

    // 1. Prefer Backend Enrichment Score if available (Lead Score 3.0)
    if (lead.intent_index !== undefined && lead.intent_index !== null) {
        const scoreVal = lead.intent_index || 0;
        let color = colors.cold; 
        if (scoreVal >= 81) color = colors.contacted; // Hot purple
        else if (scoreVal >= 61) color = colors.hot; 
        else if (scoreVal >= 31) color = colors.warm; 

        return { val: scoreVal, color, bg: color + bgOpacity };
    }

    // 2. Fallback to heuristic logic if not enriched
    const stage = lookupVal(lead.stage).toLowerCase();
    const stageColor = colors[stage] || colors.cold;

    let val = 30;
    if (stage === "hot") val = 98;
    else if (["new", "contacted"].includes(stage)) val = 65;
    else if (["qualified", "active"].includes(stage)) val = 85;
    else if (["won", "booked"].includes(stage)) val = 100;
    else if (stage === "dormant" || stage === "lost") val = 10;

    return { val, color: stageColor, bg: stageColor + bgOpacity };
}

function ActionSheet({ visible, onClose, lead, onUpdate, statuses, users }: {
    visible: boolean;
    onClose: () => void;
    lead: Lead | null;
    onUpdate: () => void;
    statuses: Lookup[];
    users: any[];
}) {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showTagEditor, setShowTagEditor] = useState(false);
    const [newTag, setNewTag] = useState("");

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 10
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true
            }).start();
        }
    }, [visible]);

    const handleUpdateStatus = async (statusId: string) => {
        if (!lead) return;
        const res = await safeApiCall(() => updateLead(lead._id, { status: statusId }));
        if (!res.error) {
            onUpdate();
            onClose();
        } else {
            Alert.alert("Error", "Failed to update status");
        }
    };

    const handleQuickDormant = async () => {
        if (!lead) return;
        const dormantStatus = statuses.find(s => s.lookup_value.toLowerCase() === "dormant");
        if (!dormantStatus) {
            Alert.alert("Error", "Dormant status lookup not found.");
            return;
        }
        await handleUpdateStatus(dormantStatus._id);
    };

    const handleReassign = async (userId: string) => {
        if (!lead) return;
        const res = await safeApiCall(() => updateLead(lead._id, { owner: userId }));
        if (!res.error) {
            onUpdate();
            onClose();
        } else {
            Alert.alert("Error", "Failed to reassign lead");
        }
    };

    const handleAddTag = async () => {
        if (!lead || !newTag.trim()) return;
        const updatedTags = [...(lead.tags || []), newTag.trim()];
        const res = await safeApiCall(() => updateLead(lead._id, { tags: updatedTags }));
        if (!res.error) {
            setNewTag("");
            onUpdate();
        }
    };

    const handleRemoveTag = async (tag: string) => {
        if (!lead) return;
        const updatedTags = (lead.tags || []).filter((t: string) => t !== tag);
        const res = await safeApiCall(() => updateLead(lead._id, { tags: updatedTags }));
        if (!res.error) {
            onUpdate();
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Lead",
            "Are you sure you want to delete this lead?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!lead) return;
                        const res = await safeApiCall(() => deleteLead(lead._id));
                        if (!res.error) {
                            onUpdate();
                            onClose();
                        }
                    }
                }
            ]
        );
    };

    const handleEmail = () => {
        if (!lead?.email) {
            Alert.alert("Error", "No email address found for this lead.");
            return;
        }
        Linking.openURL(`mailto:${lead.email}`);
    };

    const handleSMS = () => {
        if (!lead?.mobile) return;
        Linking.openURL(`sms:${lead.mobile}`);
    };

    const handleWhatsApp = () => {
        if (!lead?.mobile) return;
        const cleanPhone = (lead.mobile || "").replace(/[^0-9]/g, "");
        Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
    };

    if (!lead) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.sheetContainer,
                        { backgroundColor: isDark ? '#000000' : '#FFFFFF', transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <View style={styles.sheetHandle} />
                    <ScrollView 
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 60 }}
                    >
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: theme.text }]}>{leadName(lead)}</Text>
                            <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>{lead.mobile}</Text>
                        </View>

                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-lead?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(100, 116, 139, 0.1)' : "#F1F5F9" }]}>
                                    <Ionicons name="create" size={24} color={isDark ? theme.textSecondary : "#64748B"} />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/match-lead?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(219, 39, 119, 0.1)' : "#FDF2F8" }]}>
                                    <Ionicons name="git-compare" size={24} color="#DB2777" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Match</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-document?id=${lead._id}&type=Lead`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.1)' : "#F0F9FF" }]}>
                                    <Ionicons name="document-attach" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Doc</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/sequences?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : "#F5F3FF" }]}>
                                    <Ionicons name="repeat" size={24} color="#8B5CF6" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Seq</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-activity?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.1)' : "#FFF7ED" }]}>
                                    <Ionicons name="add-circle" size={24} color="#EA580C" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Activity</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { setShowReassign(!showReassign); setShowStatusPicker(false); setShowTagEditor(false); }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.1)' : "#F5F3FF" }]}>
                                    <Ionicons name="person-add" size={24} color="#7C3AED" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Assign</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={() => { setShowTagEditor(!showTagEditor); setShowStatusPicker(false); setShowReassign(false); }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.1)' : "#EEF2FF" }]}>
                                    <Ionicons name="pricetags" size={24} color="#4F46E5" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Tag</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={handleQuickDormant}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : "#F1F5F9" }]}>
                                    <Ionicons name="moon" size={24} color="#94A3B8" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Dormant</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionItem} onPress={async () => {
                                try {
                                    const act = await getOrCreateCallActivity(lead._id, "Lead", leadName(lead));
                                    if (act?._id) {
                                        router.push(`/outcome?id=${act._id}`);
                                        onClose();
                                    }
                                } catch (e) {
                                    Alert.alert("Error", "Failed to prepare call outcome");
                                }
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : "#ECFDF5" }]}>
                                    <Ionicons name="checkmark-done-circle" size={24} color="#10B981" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Outcome</Text>
                            </TouchableOpacity>
                        </View>

                        {showReassign && (
                            <View style={styles.pickerView}>
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Reassign To</Text>
                                <View style={styles.chipList}>
                                    {users.map((u) => (
                                        <TouchableOpacity
                                            key={u._id}
                                            style={[styles.actionChip, { borderColor: theme.border, backgroundColor: theme.card }]}
                                            onPress={() => handleReassign(u._id)}
                                        >
                                            <Text style={[styles.actionChipText, { color: theme.text }]}>{u.fullName || u.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {showTagEditor && (
                            <View style={styles.pickerView}>
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Manage Tags</Text>
                                <View style={styles.tagInputRow}>
                                    <TextInput
                                        style={[styles.tagInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                                        placeholder="Add new tag..."
                                        placeholderTextColor={theme.textMuted}
                                        value={newTag}
                                        onChangeText={setNewTag}
                                        onSubmitEditing={handleAddTag}
                                    />
                                    <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: theme.primary }]} onPress={handleAddTag}>
                                        <Ionicons name="add" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.chipList}>
                                    {(lead.tags || []).map((t: string, idx: number) => (
                                        <View key={idx} style={[styles.tagChip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                                            <Text style={[styles.tagChipText, { color: theme.primary }]}>{t}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                                                <Ionicons name="close-circle" size={14} color={theme.primary} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View style={styles.dangerZone}>
                            <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : "#FEF2F2" }]} onPress={handleDelete}>
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                <Text style={styles.dangerBtnText}>Delete Lead</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

function FilterModal({ visible, onClose, filters, setFilters, statuses, users, sources }: {
    visible: boolean;
    onClose: () => void;
    filters: any;
    setFilters: (f: any) => void;
    statuses: Lookup[];
    users: any[];
    sources: Lookup[];
}) {
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const toggleFilter = (key: string, val: string) => {
        const current = filters[key] || [];
        const next = current.includes(val) ? current.filter((v: string) => v !== val) : [...current, val];
        setFilters({ ...filters, [key]: next });
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.filterModalContainer}>
                <View style={[styles.filterHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                    <Text style={[styles.filterHeaderTitle, { color: theme.text }]}>Advanced Filters</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={[styles.filterContent, { backgroundColor: theme.background }]}>
                    <Text style={[styles.filterSectionTitle, { color: theme.textMuted }]}>By Stage</Text>
                    <View style={styles.filterChipList}>
                        {statuses.map(s => (
                            <TouchableOpacity
                                key={s._id}
                                style={[
                                    styles.filterChip, 
                                    { borderColor: theme.border, backgroundColor: theme.card },
                                    (filters.stages || []).includes(s._id) && { backgroundColor: theme.primary, borderColor: theme.primary }
                                ]}
                                onPress={() => toggleFilter("stages", s._id)}
                            >
                                <Text style={[
                                    styles.filterChipText, 
                                    { color: theme.textSecondary },
                                    (filters.stages || []).includes(s._id) && { color: "#fff" }
                                ]}>{s.lookup_value}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.filterSectionTitle}>By Source</Text>
                    <View style={styles.filterChipList}>
                        {sources.map(s => (
                            <TouchableOpacity
                                key={s._id}
                                style={[styles.filterChip, (filters.sources || []).includes(s._id) && styles.filterChipActive]}
                                onPress={() => toggleFilter("sources", s._id)}
                            >
                                <Text style={[styles.filterChipText, (filters.sources || []).includes(s._id) && styles.filterChipTextActive]}>{s.lookup_value}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.filterSectionTitle}>By Owner</Text>
                    <View style={styles.filterChipList}>
                        {users.map(u => (
                            <TouchableOpacity
                                key={u._id}
                                style={[styles.filterChip, (filters.owners || []).includes(u._id) && styles.filterChipActive]}
                                onPress={() => toggleFilter("owners", u._id)}
                            >
                                <Text style={[styles.filterChipText, (filters.owners || []).includes(u._id) && styles.filterChipTextActive]}>{u.fullName || u.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <View style={[styles.filterFooter, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                    <TouchableOpacity style={[styles.resetBtn, { backgroundColor: theme.border }]} onPress={() => setFilters({ stages: [], sources: [], owners: [] })}>
                        <Text style={[styles.resetBtnText, { color: theme.textSecondary }]}>Reset All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.applyBtn, { backgroundColor: theme.primary }]} onPress={onClose}>
                        <Text style={styles.applyBtnText}>Apply Filters</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const LeadScoreRing = memo(({ score, isDark, color = "#2563EB", size = 44 }: { score: number; isDark: boolean; color?: string; size?: number }) => {
    const strokeWidth = 3;
    const { theme } = useTheme();
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: score / 100,
            duration: 1000,
            useNativeDriver: true,
        }).start();
    }, [score]);

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(241, 245, 249, 1)',
                position: 'absolute'
            }} />
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: color,
                borderLeftColor: score > 75 ? color : 'transparent',
                borderBottomColor: score > 50 ? color : 'transparent',
                borderRightColor: score > 25 ? color : 'transparent',
                borderTopColor: color,
                transform: [{ rotate: '-45deg' }]
            }}></View>
            <Text style={{ fontSize: 9, fontWeight: '800', color: theme.text, position: 'absolute' }}>{score}</Text>
        </View>
    );
});

const StaggeredLeadItem = memo(({ item, index, renderItem }: any) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            delay: index * 50,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={{
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }}>
            {renderItem({ item, index })}
        </Animated.View>
    );
});

const LeadCard = memo(({ lead, index, onPress, onMore, isSelected, onLongPress, liveScore }: {
    lead: Lead;
    index: number;
    onPress: () => void;
    onMore: () => void;
    isSelected?: boolean;
    onLongPress?: () => void;
    liveScore?: { score: number; color: string; label: string };
}) => {
    const { theme } = useTheme();
    const { trackCall } = useCallTracking();
    const { getLookupValue } = useLookup();
    const name = leadName(lead);
    const isDark = theme.background === '#0F172A';
    const stageCfgMap = (typeof STAGE_CONFIG_DARK !== 'undefined' && typeof STAGE_CONFIG_LIGHT !== 'undefined') 
        ? (isDark ? STAGE_CONFIG_DARK : STAGE_CONFIG_LIGHT) 
        : { default: { color: '#94A3B8', icon: 'ellipse-outline' } };
    const stageLabel = getLookupValue("Stage", lead.stage) || "New";
    const stageCfg = (stageCfgMap as any)[stageLabel] || (stageCfgMap as any).default;
    const score = liveScore ? { val: liveScore.score, color: liveScore.color } : getLeadScore(lead, isDark);

    const scaleValue = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            delay: index * 50,
            useNativeDriver: true,
        }).start();
    }, [index]);

    const onPressIn = () => {
        Animated.spring(scaleValue, { toValue: 0.98, useNativeDriver: true }).start();
    };
    const onPressOut = () => {
        Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }).start();
    };

    const renderRightActions = () => (
        <View style={styles.rightActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.primary }]} onPress={() => trackCall(lead.mobile || "", lead._id, "Lead", name)}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.warning }]} onPress={() => Linking.openURL(`sms:${lead.mobile}`)}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.leftActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.success }]} onPress={() => {
                const cleanPhone = (lead.mobile || "").replace(/[^0-9]/g, "");
                Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
            }}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#818CF8' : "#6366F1" }]} onPress={() => lead.email && Linking.openURL(`mailto:${lead.email}`)}>
                <Ionicons name="mail" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Email</Text>
            </TouchableOpacity>
        </View>
    );

    const intent = getLookupValue("Requirement", lead.requirement).toLowerCase();
    const intentConfig: Record<string, { bg: string; text: string }> = {
        buy: { bg: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7', text: isDark ? '#34D399' : '#15803D' },
        rent: { bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFEDD5', text: isDark ? '#FBBF24' : '#C2410C' },
        lease: { bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#E0F2FE', text: isDark ? '#60A5FA' : '#0369A1' }
    };
    const currentIntent = intentConfig[intent] || null;

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleValue }, { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, position: 'relative' }, isSelected && styles.cardSelected]}
                >
                    {currentIntent ? (
                        <View style={[styles.intentRibbon, { backgroundColor: isDark ? (currentIntent.text + '25') : currentIntent.bg }]}>
                            <Text style={[styles.intentRibbonText, { color: isDark ? currentIntent.text : currentIntent.text }]}>{intent.toUpperCase()}</Text>
                        </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.leftScoreContainer}>
                            <LeadScoreRing score={score.val} isDark={isDark} color={score.color} size={42} />
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={styles.cardHeader}>
                                <View style={styles.leadInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={[styles.leadName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                        <Ionicons name="call-outline" size={12} color={theme.textLight} />
                                        <Text style={{ fontSize: 12, color: theme.textLight, fontWeight: '600', marginLeft: 4 }}>{lead.mobile}</Text>
                                        {lead.email ? (
                                            <>
                                                <Text style={{ fontSize: 12, color: theme.textLight, marginHorizontal: 6 }}>•</Text>
                                                <Ionicons name="mail-outline" size={12} color={theme.textLight} />
                                                <Text style={{ fontSize: 12, color: theme.textLight, fontWeight: '600', marginLeft: 4, flex: 1 }} numberOfLines={1}>{lead.email}</Text>
                                            </>
                                        ) : null}
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={[styles.stageBadge, { backgroundColor: stageCfg.color + '15', borderColor: stageCfg.color + '30' }]}>
                                        <Ionicons name={stageCfg.icon} size={10} color={stageCfg.color} />
                                        <Text style={[styles.stageText, { color: stageCfg.color }]}>{stageLabel.toUpperCase()}</Text>
                                    </View>
                                    <TouchableOpacity onPress={onMore} style={styles.moreBtn}>
                                        <Ionicons name="ellipsis-vertical" size={16} color={theme.textLight} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.cardBody}>
                                {(lead.propertyType || lead.subType || lead.subRequirement) ? (
                                    <View style={styles.reqRow}>
                                        <Ionicons name="business-outline" size={12} color={theme.textLight} />
                                        <Text style={[styles.reqText, { color: theme.textMuted }]}>
                                            {(lead.propertyType && lead.propertyType.length > 0) ? getLookupValue("Category", lead.propertyType) : getLookupValue("Requirement", lead.requirement)}
                                            {(lead.subType && lead.subType.length > 0) 
                                                ? ` • ${getLookupValue("SubCategory", lead.subType)}` 
                                                : (lead.subRequirement ? ` • ${getLookupValue("SubRequirement", lead.subRequirement)}` : '')
                                            }
                                        </Text>
                                    </View>
                                ) : null}
                                <View style={styles.reqRow}>
                                    <Ionicons name="home-outline" size={12} color={theme.textLight} />
                                    <Text style={[styles.reqText, { color: theme.textMuted }]}>{getLookupValue("UnitType", lead.unitType)}</Text>
                                </View>
                                {(lead.locCity || lead.location || lead.locArea) ? (
                                    <View style={styles.locRow}>
                                        <Ionicons name="location-outline" size={12} color={theme.textLight} />
                                        <Text style={[styles.reqText, { color: theme.textMuted }]}>
                                            {[getLookupValue("City", lead.locCity), lead.locArea, getLookupValue("Location", lead.location)].filter(v => v && v !== "—").join(", ") || "No Location"}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <View style={styles.cardFooter}>
                                <View style={styles.tagStrip}>
                                    {lead.tags?.slice(0, 3).map((tag, i) => (
                                        <View key={i} style={[styles.miniTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.border, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border }]}>
                                            <Text style={[styles.miniTagText, { color: isDark ? '#94A3B8' : theme.textMuted }]}>{tag}</Text>
                                        </View>
                                    ))}
                                    {(lead.tags?.length || 0) > 3 && (
                                        <Text style={{ fontSize: 10, color: theme.textLight }}>+{(lead.tags?.length || 0) - 3}</Text>
                                    )}
                                </View>
                                <View style={styles.footerRight}>
                                    {lead.source ? (
                                        <View style={[styles.sourceBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.border, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border }]}>
                                            <Ionicons name="radio-outline" size={10} color={theme.textLight} />
                                            <Text style={[styles.sourceText, { color: theme.textLight }]}>{getLookupValue("Source", lead.source)}</Text>
                                        </View>
                                    ) : null}
                                    <Text style={[styles.timeLabel, { color: theme.textLight }]}>{formatTimeAgo(lead.createdAt)}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        </Swipeable>
    );
});

export default function LeadsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { isAuthenticated } = useAuth();
    const isDark = theme.background === '#0F172A';
    const { getLookupValue, getLookupsByType, refreshLookups } = useLookup();
    const { users, loading: loadingUsers, findUser } = useUsers();
    const { simulateIncomingCall } = useCallTracking();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState("");
    const [leadsStats, setLeadsStats] = useState({ 
        total: 0, 
        today: 0, 
        fresh: 0, 
        hot: 0,
        pipeline: { incoming: 0, prospect: 0, opportunity: 0, negotiation: 0, won: 0, lost: 0 }
    });
    const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>("all");
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState<{ stages: string[], sources: string[], owners: string[] }>({ stages: [], sources: [], owners: [] });
    // const [statuses, setStatuses] = useState<Lookup[]>([]);
    // const [sources, setSources] = useState<Lookup[]>([]);
    // const [users, setUsers] = useState<any[]>([]);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showDormant, setShowDormant] = useState(false);
    const [bulkAssignVisible, setBulkAssignVisible] = useState(false);
    const [liveScores, setLiveScores] = useState<Record<string, { score: number; color: string; label: string }>>({});

    const filterScale = useRef(new Animated.Value(1)).current;
    const searchFocusAnim = useRef(new Animated.Value(0)).current;

    const animateFilter = (toValue: number) => {
        Animated.spring(filterScale, { toValue, useNativeDriver: true, tension: 100, friction: 5 }).start();
    };

    const handleSearchFocus = (focused: boolean) => {
        Animated.timing(searchFocusAnim, {
            toValue: focused ? 1 : 0,
            duration: 200,
            useNativeDriver: false
        }).start();
    };

    const lastFetchTime = useRef<number>(0);

    const fetchLeads = useCallback(async (pageNum = 1, shouldAppend = false, qFilter?: string) => {
        if (!isAuthenticated) return;
        // 1. Instant Cache Load (only on first page, non-append load)
        if (pageNum === 1 && !shouldAppend && leads.length === 0 && !qFilter) {
            try {
                const cached = await AsyncStorage.getItem("@cache_leads_list");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setLeads(parsed);
                        setLoading(false);
                    }
                }
            } catch (e) { console.warn("[Leads] Cache read failed", e); }
        }

        if (leads.length === 0 || !shouldAppend) setLoading(true);
        
        const params: any = { page: String(pageNum), limit: "50" };
        if (qFilter) params.status = qFilter;
        if (showDormant) params.showDormant = "true";

        const result = await safeApiCall<Lead>(() => getLeads(params));

        if (!result.error && result.data) {
            if (result.stats) setLeadsStats(result.stats);
            const recs = result.data;
            
            setLeads(prev => {
                const combined = shouldAppend ? [...prev, ...recs] : recs;
                // Deduplicate
                const seen = new Set();
                const filtered = combined.filter((l: any) => {
                    const id = l?._id || l?.id;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });

                if (pageNum === 1 && !shouldAppend && !qFilter) {
                    AsyncStorage.setItem("@cache_leads_list", JSON.stringify(filtered.slice(0, 50))).catch(() => {});
                    lastFetchTime.current = Date.now();
                }
                
                return filtered;
            });
            
            setHasMore(recs.length === 50);
            setPage(pageNum);
            if (!shouldAppend) {
                getLeadScores().then(scores => setLiveScores(scores)).catch(() => { });
            }
        }
        setLoading(false);
        setRefreshing(false);
    }, [leads.length, showDormant, isAuthenticated]);

    const handleQuickFilter = (type: string) => {
        if (activeQuickFilter === type) {
            setActiveQuickFilter(null);
            setActiveFilter("all");
            fetchLeads(1, false);
            return;
        }

        setActiveQuickFilter(type);
        setActiveFilter(type);
        fetchLeads(1, false, type);
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        refreshLookups();
        fetchLeads(1, false);
    }, [fetchLeads, refreshLookups]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchLeads(page + 1, true);
        }
    }, [loading, hasMore, page, fetchLeads]);

    const toggleSelection = (id: string) => {
        const next = selectedIds.includes(id)
            ? selectedIds.filter(x => x !== id)
            : [...selectedIds, id];
        setSelectedIds(next);
        Vibration.vibrate(10);
    };

    const handleBulkDelete = () => {
        Alert.alert(
            "Bulk Delete",
            `Are you sure you want to delete ${selectedIds.length} leads?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await Promise.all(selectedIds.map(id => deleteLead(id)));
                        setSelectedIds([]);
                        fetchLeads();
                    }
                }
            ]
        );
    };

    const handleBulkAssign = async (userId: string) => {
        try {
            await Promise.all(selectedIds.map(id => updateLead(id, { owner: userId })));
            setSelectedIds([]);
            setBulkAssignVisible(false);
            fetchLeads();
            Vibration.vibrate(20);
        } catch (e) {
            Alert.alert("Error", "Failed to reassign some leads");
        }
    };

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            // Only re-fetch if cache is stale (> 2 mins) or empty
            if (leads.length === 0 || (now - lastFetchTime.current > 120000)) {
                if (isAuthenticated) fetchLeads(1, false);
            }
        }, [fetchLeads, leads.length, isAuthenticated])
    );

    const filtered = useMemo(() => {
        let list = leads;

        // Advanced Filters
        if (filters.stages.length > 0) {
            list = list.filter(l => filters.stages.includes(typeof l.stage === 'string' ? l.stage : (l.stage as any)?._id));
        }
        if (filters.sources.length > 0) {
            list = list.filter(l => filters.sources.includes(typeof l.source === 'string' ? l.source : (l.source as any)?._id));
        }
        if (filters.owners.length > 0) {
            list = list.filter(l => filters.owners.includes(typeof l.owner === 'string' ? l.owner : (l.owner as any)?._id));
        }

        // Quick Stats Filters
        if (activeFilter === "hot") {
            list = list.filter(l => lookupVal(l.stage).toLowerCase() === "hot");
        } else if (activeFilter === "today") {
            list = list.filter(l => {
                if (!l.createdAt) return false;
                return new Date(l.createdAt).toDateString() === new Date().toDateString();
            });
        } else if (activeFilter !== "all" && activeFilter !== "") {
            list = list.filter(l => lookupVal(l.stage).toLowerCase() === activeFilter.toLowerCase());
        }

        const q = search.toLowerCase();
        return list.filter((l) => {
            const name = leadName(l).toLowerCase();
            const mobile = (l.mobile ?? "").toLowerCase();
            const req = lookupVal(l.requirement).toLowerCase();
            const loc = (l.locCity || lookupVal(l.location)).toLowerCase();
            return name.includes(q) || mobile.includes(q) || req.includes(q) || loc.includes(q);
        });
    }, [leads, search, activeFilter, filters]);

    const stats = useMemo(() => {
        return {
            total: leads.length,
            hot: leads.filter(l => lookupVal(l.stage).toLowerCase() === "hot").length,
            today: leads.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
            active: leads.filter(l => ["new", "active", "contacted"].includes(lookupVal(l.stage).toLowerCase())).length
        };
    }, [leads]);

    const fabScale = useRef(new Animated.Value(1)).current;

    const animateFab = (toValue: number) => {
        Animated.spring(fabScale, {
            toValue,
            useNativeDriver: true,
            tension: 100,
            friction: 5
        }).start();
    };

    const renderHeader = () => {
        return (
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.screenTitle}>{selectedIds.length > 0 ? `${selectedIds.length} Selected` : "SALES PIPELINE"}</Text>
                        <View style={{ marginTop: 2 }}>
                            <Text style={styles.screenSub}>{(leadsStats?.total || 0).toLocaleString()} Total Records</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity style={styles.headerAddBtn} onPress={() => router.push("/add-lead")}>
                            <Ionicons name="add-circle" size={28} color={theme.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Professional Arrow Style Sales Pipeline Flow */}
                <View style={styles.modernPipelineRoot}>
                    <View style={styles.pipelineTitleInnerRow}>
                        <Text style={styles.pipelineTitleText}>SALES PIPELINE STAGES</Text>
                        <View style={styles.pipelineActionHint}>
                            <Ionicons name="swap-horizontal" size={10} color="#94A3B8" />
                            <Text style={styles.pipelineActionText}>SWIPE TO EXPLORE</Text>
                        </View>
                    </View>
                    
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        contentContainerStyle={styles.modernPipelineScroll}
                        decelerationRate="fast"
                    >
                        {[
                            { key: "incoming", label: "NEW", color: "#6366F1" },
                            { key: "prospect", label: "PROSPECT", color: "#3B82F6" },
                            { key: "opportunity", label: "OPPORTUNITY", color: "#EC4899" },
                            { key: "negotiation", label: "NEGOTIATION", color: "#F59E0B" },
                            { key: "won", label: "WON", color: "#10B981" }
                        ].map((item, idx) => {
                            const count = (leadsStats.pipeline as any)?.[item.key] || 0;
                            const isActive = activeQuickFilter === item.key;
                            const isFirst = idx === 0;
                            
                            return (
                                <TouchableOpacity 
                                    key={item.key}
                                    style={[
                                        styles.arrowStageSegment,
                                        { 
                                            backgroundColor: isActive ? item.color : `${item.color}15`,
                                            zIndex: 10 - idx,
                                            marginLeft: isFirst ? 0 : -20, // Tighter overlap for sharper arrow flow
                                            borderTopLeftRadius: isFirst ? 12 : 0,
                                            borderBottomLeftRadius: isFirst ? 12 : 0,
                                            width: 145,
                                            // Add subtle shadow for depth on active state
                                            ...(isActive ? { shadowColor: item.color, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 } : {})
                                        }
                                    ]}
                                    onPress={() => handleQuickFilter(item.key)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.arrowContent, { paddingLeft: isFirst ? 20 : 35 }]}>
                                        <Text style={[styles.arrowCountText, { color: isActive ? '#fff' : item.color }]}>{count}</Text>
                                        <Text style={[styles.arrowLabelText, { color: isActive ? 'rgba(255,255,255,0.9)' : '#64748B' }]}>{item.label}</Text>
                                    </View>
                                    
                                    {/* The Chevron Point */}
                                    <View style={[
                                        styles.arrowChevron, 
                                        { 
                                            backgroundColor: isActive ? item.color : (isDark ? theme.card : '#F8FAFC'),
                                            borderColor: isActive ? '#fff' : `${item.color}30`,
                                            borderLeftWidth: 2,
                                            borderTopWidth: 2,
                                            right: -15, // Perfect overlap
                                            borderRadius: 2,
                                            top: 15,
                                            width: 30,
                                            height: 30,
                                            transform: [{ rotate: '45deg' }],
                                            zIndex: 2
                                        }
                                    ]} />
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={styles.commandBar}>
                    <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
                        <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
                        <TextInput
                            style={[styles.searchInput, { color: theme.text }]}
                            placeholder="Search leads..."
                            placeholderTextColor={theme.textMuted}
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch("")} style={styles.clearBtn}>
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity 
                        style={[styles.filterToggleBtn, { marginRight: 8 }, showDormant && { backgroundColor: "#DBEAFE" }]} 
                        onPress={() => {
                            setShowDormant(!showDormant);
                            setLeads([]);
                            setPage(1);
                        }}
                    >
                        <Ionicons 
                            name={showDormant ? "sunny-outline" : "moon-outline"} 
                            size={20} 
                            color={showDormant ? "#2563EB" : "#475569"} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.filterToggleBtn} onPress={() => setShowFilterModal(true)}>
                        <Ionicons name="options-outline" size={22} color={Object.values(filters).flat().length > 0 ? "#2563EB" : "#475569"} />
                        {Object.values(filters).flat().length > 0 && <View style={styles.filterDot} />}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {loading && page === 1 ? (
                <ActivityIndicator color={theme.primary} size="large" style={{ marginTop: 100 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    renderItem={({ item, index }) => (
                        <LeadCard
                            lead={item}
                            index={index}
                            isSelected={selectedIds.includes(item._id)}
                            onLongPress={() => { toggleSelection(item._id); }}
                            liveScore={liveScores[item._id]}
                            onPress={() => {
                                if (selectedIds.length > 0) toggleSelection(item._id);
                                else router.push(`/lead-detail?id=${item._id}`);
                            }}
                            onMore={() => {
                                setSelectedLead(item);
                                setSheetVisible(true);
                            }}
                        />
                    )}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                    ListHeaderComponent={renderHeader()}
                    ListFooterComponent={loading && page > 1 ? <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="clipboard-outline" size={64} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>{search ? "No leads matching your search" : "No leads found."}</Text>
                        </View>
                    }
                />
            )}

            {selectedIds.length > 0 ? (
                <View style={[styles.bulkActionsBar, { backgroundColor: isDark ? theme.card : theme.primary, borderColor: isDark ? theme.border : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
                    <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkDelete}>
                        <Ionicons name="trash-outline" size={20} color="#fff" />
                        <Text style={styles.bulkActionText}>Delete</Text>
                    </TouchableOpacity>
                    <View style={styles.bulkDivider} />
                    <TouchableOpacity style={styles.bulkActionBtn} onPress={() => setBulkAssignVisible(true)}>
                        <Ionicons name="person-add-outline" size={20} color="#fff" />
                        <Text style={styles.bulkActionText}>Assign</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <Animated.View style={{
                    position: "absolute", bottom: 40, right: 24,
                    transform: [{ scale: fabScale }]
                }}>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                        onPressIn={() => { Vibration.vibrate(15); animateFab(0.92); }}
                        onPressOut={() => animateFab(1)}
                        onPress={() => router.push("/add-lead")}
                    >
                        <Ionicons name="add" size={32} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            )}

            <ActionSheet
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                lead={selectedLead}
                onUpdate={fetchLeads}
                statuses={getLookupsByType("Stage")}
                users={users}
            />

            <FilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={filters}
                setFilters={setFilters}
                statuses={getLookupsByType("Stage")}
                users={users}
                sources={getLookupsByType("Source")}
            />

            <Modal visible={bulkAssignVisible} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setBulkAssignVisible(false)}>
                    <View style={[styles.bulkModalContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
                        <Text style={[styles.bulkModalTitle, { color: theme.text }]}>Reassign {selectedIds.length} Leads To</Text>
                        <ScrollView style={{ maxHeight: SCREEN_HEIGHT * 0.4 }}>
                            {users.map(u => (
                                <TouchableOpacity key={u._id} style={[styles.bulkUserItem, { borderBottomColor: theme.border }]} onPress={() => handleBulkAssign(u._id)}>
                                    <View style={[styles.bulkUserAvatar, { backgroundColor: theme.primary + '15' }]}>
                                        <Text style={[styles.bulkUserInitial, { color: theme.primary }]}>{(u.fullName || u.name || "?")[0].toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.bulkUserName, { color: theme.text }]}>{u.fullName || u.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.bulkCancelBtn} onPress={() => setBulkAssignVisible(false)}>
                            <Text style={styles.bulkCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 12, paddingTop: 50, paddingBottom: 10, borderBottomWidth: 1 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    screenTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
    screenSub: { fontSize: 10, fontWeight: "800", marginTop: 2, letterSpacing: 0.5 },
    
    modernPipelineRoot: { marginTop: 12, marginBottom: 16 },
    pipelineTitleInnerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
    pipelineTitleText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
    pipelineActionHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pipelineActionText: { fontSize: 8, fontWeight: '800' },
    modernPipelineScroll: { paddingLeft: 16, paddingRight: 40, paddingBottom: 16 },
    
    arrowStageSegment: { 
        width: 140, 
        height: 60, 
        justifyContent: 'center',
        paddingLeft: 20,
        paddingRight: 10,
        position: 'relative',
        borderRadius: 8
    },
    arrowContent: {
        zIndex: 5,
    },
    arrowCountText: { 
        fontSize: 20, 
        fontWeight: '900', 
        lineHeight: 22 
    },
    arrowLabelText: { 
        fontSize: 9, 
        fontWeight: '800', 
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    arrowChevron: {
        position: 'absolute',
        right: -15,
        top: 15,
        width: 30,
        height: 30,
        transform: [{ rotate: '45deg' }],
        zIndex: 4,
    },

    stageBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    stageText: { fontSize: 10, fontWeight: '900' },
    versionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    versionText: { fontSize: 9, fontWeight: '800' },
    autoPilotBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    autoPilotText: { fontSize: 9, fontWeight: '900' },
    headerCount: { fontSize: 13, fontWeight: "600", marginTop: 2 },
    headerActionBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
    headerAddBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
    commandBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginBottom: 8 },
    searchContainer: { flex: 1, height: 42, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, fontWeight: "600" },
    clearBtn: { padding: 4 },
    quickAddBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
    filterToggleBtn: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", position: "relative" },
    filterDot: { position: "absolute", top: 10, right: 10, width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5 },

    segmentContainer: { marginTop: 4 },
    segmentScroll: { gap: 8 },
    segmentItem: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    segmentItemActive: {  },
    segmentText: { fontSize: 13, fontWeight: "700" },
    segmentTextActive: { color: "#fff" },


    card: { borderRadius: 16, paddingHorizontal: 3, paddingBottom: 3, paddingTop: 8, marginBottom: 6, borderWidth: 1, elevation: 2, shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, overflow: 'hidden' },
    cardSelected: { borderWidth: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    leadInfo: { flex: 1 },
    leadName: { fontSize: 17, fontWeight: "700", marginBottom: 1 },
    mobileRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    leadMobile: { fontSize: 13.5, fontWeight: "500" },
    qualityBox: { marginRight: 0 },
    leftScoreContainer: { width: 48, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    intentRibbon: { position: 'absolute', top: 5, left: -22, width: 80, height: 20, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-45deg' }], zIndex: 10 },
    intentRibbonText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
    moreBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', zIndex: 11 },

    cardBody: { marginBottom: 0, gap: 1.5 },
    reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
    reqText: { fontSize: 12.5, fontWeight: "600" },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
    locText: { fontSize: 11.5, fontWeight: "500" },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 1 },
    footerLeftTicker: { flex: 1, height: 24, marginRight: 8, justifyContent: 'center' },
    footerRight: { alignItems: 'flex-end', gap: 1 },
    badgeGroup: { flexDirection: 'row', gap: 6 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: "800", textTransform: 'uppercase' },
    sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    sourceText: { fontSize: 9, fontWeight: "700", textTransform: 'uppercase' },
    timeLabel: { fontSize: 11, fontWeight: "500" },

    rightActions: { flexDirection: 'row', gap: 8, paddingLeft: 10, marginBottom: 12 },
    leftActions: { flexDirection: 'row', gap: 8, paddingRight: 10, marginBottom: 12 },
    swipeAction: { width: 60, height: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },

    tagStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    miniTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    miniTagText: { fontSize: 10, fontWeight: '700' },

    fab: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    empty: { alignItems: 'center', marginTop: 100, gap: 12 },
    emptyText: { fontSize: 15, fontWeight: "600" },

    bulkActionsBar: { position: 'absolute', bottom: 34, alignSelf: 'center', flexDirection: 'row', borderRadius: 20, paddingHorizontal: 20, height: 56, alignItems: 'center', gap: 16, shadowOpacity: 0.3, shadowRadius: 15 },
    bulkActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bulkActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    bulkDivider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.2)" },

    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end", alignItems: 'center' },
    bulkModalContent: { width: "90%", borderRadius: 24, padding: 24 },
    bulkModalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 20, textAlign: 'center' },
    bulkUserItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    bulkUserAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    bulkUserInitial: { fontSize: 13, fontWeight: "700" },
    bulkUserName: { fontSize: 15, fontWeight: "600" },
    bulkCancelBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
    bulkCancelText: { fontSize: 14, fontWeight: "700", color: "#EF4444" },

    filterModalContainer: { flex: 1 },
    filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1 },
    filterHeaderTitle: { fontSize: 18, fontWeight: "800" },
    filterContent: { flex: 1, padding: 20 },
    filterSectionTitle: { fontSize: 12, fontWeight: "800", textTransform: 'uppercase', marginBottom: 12, marginTop: 16 },
    filterChipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    filterChipActive: { },
    filterChipText: { fontSize: 13, fontWeight: "600" },
    filterChipTextActive: { },
    filterFooter: { padding: 20, paddingBottom: 40, flexDirection: 'row', gap: 12, borderTopWidth: 1 },
    resetBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    resetBtnText: { fontSize: 14, fontWeight: "700" },
    applyBtn: { flex: 2, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    applyBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

    sheetContainer: { 
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        paddingHorizontal: 24, 
        maxHeight: '85%' 
    },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 24 },
    sheetHeader: { marginBottom: 28 },
    sheetTitle: { fontSize: 20, fontWeight: "800" },
    sheetSub: { fontSize: 13, fontWeight: "600", marginTop: 4 },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    actionItem: { width: '22%', alignItems: 'center', gap: 8 },
    actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 11, fontWeight: "700" },
    pickerView: { marginTop: 24, borderRadius: 20 },
    tagInputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    tagInput: { flex: 1, height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, borderWidth: 1 },
    addTagBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    tagChipText: { fontSize: 12, fontWeight: "600" },
    dangerZone: { marginTop: 32, borderTopWidth: 1, paddingTop: 24 },
    dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14 },
    dangerBtnText: { fontSize: 14, fontWeight: "700", color: "#EF4444" },
    sectionTitle: { fontSize: 12, fontWeight: "800", textTransform: 'uppercase', marginBottom: 16 },
    chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    actionChipText: { fontSize: 12, fontWeight: "700" },
});
