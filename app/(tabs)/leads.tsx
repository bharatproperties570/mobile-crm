import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Alert, Linking,
    Modal, Animated, Dimensions, Pressable, ScrollView, Vibration
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

function KPIItem({ label, value, color, icon, theme }: any) {
    return (
        <View style={[styles.kpiItem, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={[styles.kpiIcon, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={14} color={color} />
            </View>
            <View>
                <Text style={[styles.kpiValue, { color }]}>{value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>{label}</Text>
            </View>
        </View>
    );
}

const STATUS_COLORS_LIGHT: Record<string, string> = {
    active: "#1DB954", new: "#64748B", contacted: "#8B5CF6",
    qualified: "#7C3AED", prospect: "#3B82F6", opportunity: "#F59E0B",
    negotiation: "#F97316", booked: "#1DB954", won: "#1DB954", 
    lost: "#EF4444", stalled: "#78716C", dormant: "#94A3B8",
    hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6",
    urgent: "#E11D48"
};

const STATUS_COLORS_DARK: Record<string, string> = {
    active: "#1DB954", new: "#B3B3B3", contacted: "#8B5CF6",
    qualified: "#A78BFA", prospect: "#60A5FA", opportunity: "#FBBF24",
    negotiation: "#FB923C", booked: "#1DB954", won: "#1DB954", 
    lost: "#E91429", stalled: "#7A7A7A", dormant: "#535353",
    hot: "#E91429", warm: "#FBBF24", cold: "#60A5FA",
    urgent: "#FF4D4D"
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
    "New": { color: "#B3B3B3", icon: "star" },
    "Prospect": { color: "#60A5FA", icon: "person" },
    "Qualified": { color: "#A78BFA", icon: "checkmark-circle" },
    "Opportunity": { color: "#FBBF24", icon: "flame" },
    "Negotiation": { color: "#FB923C", icon: "chatbubbles" },
    "Booked": { color: "#1DB954", icon: "calendar" },
    "Closed Won": { color: "#1DB954", icon: "trophy" },
    "Closed Lost": { color: "#E91429", icon: "close-circle" },
    "Stalled": { color: "#7A7A7A", icon: "pause-circle" },
    "Dormant": { color: "#535353", icon: "moon" },
    "default": { color: "#B3B3B3", icon: "help-circle" }
};

function resolveName(field: unknown, getLookupValue?: (type: string, val: any) => string, findUser?: (id: string) => any): string {
    if (!field) return "—";
    if (Array.isArray(field)) {
        return field.map(item => resolveName(item, getLookupValue, findUser)).filter(name => name && name !== "—").join(", ") || "—";
    }
    if (typeof field === "object" && field !== null) {
        const obj = field as any;
        if (obj.lookup_value) return obj.lookup_value;
        if (obj.fullName) return obj.fullName;
        if (obj.name) return obj.name;
        if (obj.firstName) return [obj.firstName, obj.lastName].filter(Boolean).join(" ");
    }
    const str = String(field).trim();
    if (/^[a-f0-9]{24}$/i.test(str)) {
        if (getLookupValue) {
            const resolved = getLookupValue("Any", str);
            if (resolved && resolved !== str && resolved !== "—") return resolved;
        }
        if (findUser) {
            const user = findUser(str);
            if (user) return user.fullName || user.name || str;
        }
        return "—";
    }
    return str;
}

function formatAmount(amount?: any): string {
    if (amount === undefined || amount === null) return "—";
    const val = Number(amount);
    if (isNaN(val)) return String(amount);
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)} K`;
    return val.toString();
}

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
    if (lead.intent_index !== undefined && lead.intent_index !== null) {
        const scoreVal = lead.intent_index || 0;
        let color = colors.cold; 
        if (scoreVal >= 81) color = colors.contacted; 
        else if (scoreVal >= 61) color = colors.hot; 
        else if (scoreVal >= 31) color = colors.warm; 
        return { val: scoreVal, color, bg: color + bgOpacity };
    }
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

function ActionSheet({ visible, onClose, lead, onUpdate, statuses, users }: any) {
    const router = useRouter();
    const { theme, isDarkMode } = useTheme();
    const isDark = isDarkMode;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [shouldRender, setShouldRender] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showTagEditor, setShowTagEditor] = useState(false);
    const [newTag, setNewTag] = useState("");

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 200,
                useNativeDriver: true
            }).start(({ finished }) => {
                if (finished) setShouldRender(false);
            });
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
        const dormantStatus = statuses.find((s: any) => s.lookup_value.toLowerCase() === "dormant");
        if (!dormantStatus) return;
        await handleUpdateStatus(dormantStatus._id);
    };

    const handleDelete = () => {
        if (!lead?._id) return;
        Vibration.vibrate([0, 50, 20, 50]); 
        Alert.alert(
            "Delete Lead Permanently?",
            `Are you sure you want to delete ${leadName(lead)}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Now",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteLead(lead._id);
                            Vibration.vibrate(100);
                            onUpdate();
                            onClose();
                            Alert.alert("Deleted", "Lead has been removed.");
                        } catch (err: any) {
                            Alert.alert("Deletion Failed", "Server error occurred.");
                        }
                    }
                }
            ]
        );
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
        if (!res.error) onUpdate();
    };

    if (!lead || (!visible && !shouldRender)) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.sheetContainer,
                        { backgroundColor: theme.card, borderColor: theme.border, transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
                        <View style={styles.sheetHandle} />
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                            <View style={styles.sheetHeader}>
                                <Text style={[styles.sheetTitle, { color: theme.text }]}>{leadName(lead)}</Text>
                                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>{lead.mobile}</Text>
                            </View>
                            <View style={styles.actionGrid}>
                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-lead?id=${lead._id}`); onClose(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDarkMode ? 'rgba(100, 116, 139, 0.15)' : "#F1F5F9" }]}>
                                        <Ionicons name="create" size={24} color={theme.textSecondary} />
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
                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-activity?id=${lead._id}`); onClose(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.1)' : "#FFF7ED" }]}>
                                        <Ionicons name="add-circle" size={24} color="#EA580C" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Activity</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionItem} onPress={() => { setShowReassign(!showReassign); setShowTagEditor(false); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.1)' : "#F5F3FF" }]}>
                                        <Ionicons name="person-add" size={24} color="#7C3AED" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Assign</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionItem} onPress={() => { setShowTagEditor(!showTagEditor); setShowReassign(false); }}>
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
                                <TouchableOpacity style={styles.actionItem} onPress={handleDelete}>
                                    <View style={[styles.actionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                        <Ionicons name="trash" size={24} color="#EF4444" />
                                    </View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                            {showReassign && (
                                <View style={[styles.pickerView, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                    <Text style={styles.sectionTitle}>Assign User</Text>
                                    <View style={styles.chipList}>
                                        {users.map((u: any) => (
                                            <TouchableOpacity
                                                key={u._id}
                                                style={[styles.actionChip, { borderColor: theme.border, backgroundColor: theme.card }]}
                                                onPress={async () => {
                                                    await safeApiCall(() => updateLead(lead._id, { owner: u._id }));
                                                    onUpdate();
                                                    onClose();
                                                }}
                                            >
                                                <Text style={[styles.actionChipText, { color: theme.text }]}>{u.fullName || u.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                            {showTagEditor && (
                                <View style={[styles.pickerView, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
                                    <Text style={styles.sectionTitle}>Tags</Text>
                                    <View style={styles.tagInputRow}>
                                        <TextInput
                                            style={[styles.tagInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                                            placeholder="Add tag..."
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
                                            <View key={idx} style={[styles.tagChip, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '20' }]}>
                                                <Text style={[styles.tagChipText, { color: theme.primary }]}>{t}</Text>
                                                <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                                                    <Ionicons name="close-circle" size={16} color={theme.primary + '80'} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

function FilterModal({ visible, onClose, filters, setFilters, statuses, users, sources }: any) {
    const { theme } = useTheme();
    const toggleFilter = (key: string, val: string) => {
        const current = filters[key] || [];
        const next = current.includes(val) ? current.filter((v: string) => v !== val) : [...current, val];
        setFilters({ ...filters, [key]: next });
    };
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.filterModalContainer}>
                <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border, paddingTop: 60, paddingBottom: 20 }]}>
                    <Text style={[styles.filterHeaderTitle, { color: theme.text }]}>Filters</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>
                <ScrollView style={[styles.filterContent, { backgroundColor: theme.background }]}>
                    <Text style={styles.filterSectionTitle}>By Stage</Text>
                    <View style={styles.filterChipList}>
                        {statuses.map((s: any) => (
                            <TouchableOpacity
                                key={s._id}
                                style={[styles.filterChip, { borderColor: theme.border }, filters.stages.includes(s._id) && styles.filterChipActive]}
                                onPress={() => toggleFilter("stages", s._id)}
                            >
                                <Text style={[styles.filterChipText, { color: theme.textSecondary }, filters.stages.includes(s._id) && { color: "#fff" }]}>{s.lookup_value}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.filterSectionTitle}>By Source</Text>
                    <View style={styles.filterChipList}>
                        {sources.map((s: any) => (
                            <TouchableOpacity
                                key={s._id}
                                style={[styles.filterChip, { borderColor: theme.border }, filters.sources.includes(s._id) && styles.filterChipActive]}
                                onPress={() => toggleFilter("sources", s._id)}
                            >
                                <Text style={[styles.filterChipText, { color: theme.textSecondary }, filters.sources.includes(s._id) && { color: "#fff" }]}>{s.lookup_value}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
                <View style={[styles.filterFooter, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                    <TouchableOpacity style={[styles.resetBtn, { backgroundColor: theme.border }]} onPress={() => setFilters({ stages: [], sources: [], owners: [] })}>
                        <Text style={styles.resetBtnText}>Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.applyBtn, { backgroundColor: theme.primary }]} onPress={onClose}>
                        <Text style={styles.applyBtnText}>Apply</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const LeadScoreRing = memo(({ score, isDark, color = "#2563EB", size = 44 }: any) => {
    const strokeWidth = 3;
    const { theme } = useTheme();
    const animatedValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(animatedValue, { toValue: score / 100, duration: 1000, useNativeDriver: true }).start();
    }, [score]);
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', position: 'absolute' }} />
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: color, borderLeftColor: score > 75 ? color : 'transparent', borderBottomColor: score > 50 ? color : 'transparent', borderRightColor: score > 25 ? color : 'transparent', transform: [{ rotate: '-45deg' }] }} />
            <Text style={{ fontSize: 9, fontWeight: '800', color: theme.text, position: 'absolute' }}>{score}</Text>
        </View>
    );
});

const LeadCard = memo(({ lead, index, onPress, onMore, isSelected, onLongPress, liveScore }: any) => {
    const { theme, isDarkMode } = useTheme();
    const { trackCall } = useCallTracking();
    const { getLookupValue } = useLookup();
    const { findUser } = useUsers();
    const name = leadName(lead);
    const isDark = isDarkMode;
    const stageCfgMap = isDark ? STAGE_CONFIG_DARK : STAGE_CONFIG_LIGHT;
    const stageLabel = getLookupValue("Stage", lead.stage) || "New";
    const stageCfg = (stageCfgMap as any)[stageLabel] || (stageCfgMap as any).default;
    const score = liveScore ? { val: liveScore.score, color: liveScore.color } : getLeadScore(lead, isDark);
    const scaleValue = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, delay: Math.min(index * 20, 300), useNativeDriver: true }).start();
    }, [index]);

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

    const reqParts = [
        getLookupValue("Category", lead.propertyType) || getLookupValue("Requirement", lead.requirement),
        getLookupValue("SubCategory", lead.subType) || getLookupValue("SubRequirement", lead.subRequirement),
        getLookupValue("UnitType", lead.unitType)
    ].filter(v => v && v !== '—');
    const requirementText = reqParts.join(" • ") || "No Requirement";

    const budgetText = (lead.budgetMin || lead.budgetMax) ? `₹${formatAmount(lead.budgetMin || 0)} - ₹${formatAmount(lead.budgetMax || 0)}` : "";
    const sizeText = (lead.areaMin || lead.areaMax) ? `${lead.areaMin || ""}${lead.areaMin && lead.areaMax ? "-" : ""}${lead.areaMax || ""} ${lead.areaMetric || ""}`.trim() : "";
    
    const locParts = [lead.locArea, getLookupValue("Location", lead.location), getLookupValue("City", lead.locCity)].filter(v => v && v !== "—");
    const locationText = locParts.join(", ");

    const projectText = lead.projectName || lead.project?.name;
    const blockText = lead.locBlock;

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleValue }, { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPressIn={() => Animated.spring(scaleValue, { toValue: 0.98, useNativeDriver: true }).start()}
                    onPressOut={() => Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }).start()}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isSelected && styles.cardSelected]}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={{ width: 44, justifyContent: 'center', alignItems: 'center' }}>
                                <LeadScoreRing score={score.val} isDark={isDark} color={score.color} size={44} />
                            </View>
                            <View style={styles.rowContent}>
                                <View style={styles.rowTop}>
                                    <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Ionicons name="call-outline" size={12} color={theme.textMuted} />
                                    <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginLeft: 4 }}>{lead.mobile}</Text>
                                    {lead.email && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: theme.textMuted, marginHorizontal: 6 }}>•</Text>
                                            <Ionicons name="mail-outline" size={12} color={theme.textMuted} />
                                            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginLeft: 4, flex: 1 }} numberOfLines={1}>{lead.email}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.rowSubject, { color: theme.textSecondary, marginBottom: 4 }]} numberOfLines={1}>{requirementText}</Text>
                                {(budgetText || sizeText) && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        {budgetText && (
                                            <View style={[styles.outcomeBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ECFDF5' }]}>
                                                <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '800' }}>{budgetText}</Text>
                                            </View>
                                        )}
                                        {sizeText && (
                                            <View style={[styles.outcomeBadge, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF' }]}>
                                                <Text style={{ fontSize: 10, color: '#6366F1', fontWeight: '800' }}>{sizeText}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                                {(projectText || blockText || locationText) && (
                                    <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="location-outline" size={12} color={theme.textMuted} />
                                        <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '700' }} numberOfLines={1}>
                                            {projectText}{blockText ? ` (${blockText})` : ""}{locationText ? ` • ${locationText}` : ""}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.rowMeta}>
                                    <View style={[styles.outcomeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.border }]}>
                                        <Text style={[styles.outcomeText, { color: theme.textSecondary }]}>{resolveName(lead.assignment?.assignedTo || lead.owner, getLookupValue, findUser)}</Text>
                                    </View>
                                    {(() => {
                                        const team = resolveName(lead.assignment?.team?.[0] || lead.owner?.team, getLookupValue, findUser);
                                        return team && team !== "—" ? (
                                            <View style={[styles.outcomeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.border }]}>
                                                <Text style={[styles.outcomeText, { color: theme.textSecondary }]}>{team}</Text>
                                            </View>
                                        ) : null;
                                    })()}
                                    {lead.isTemporary && lead.expiryDate && (
                                        <View style={[styles.outcomeBadge, { backgroundColor: '#FEF2F2' }]}>
                                            <Text style={[styles.outcomeText, { color: '#EF4444' }]}>EXPIRING</Text>
                                        </View>
                                    )}
                                    {currentIntent && (
                                        <View style={[styles.outcomeBadge, { backgroundColor: currentIntent.bg }]}>
                                            <Text style={[styles.outcomeText, { color: currentIntent.text }]}>{intent.toUpperCase()}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                        <View style={styles.rightContentColumn}>
                            <TouchableOpacity onPress={onMore} style={styles.menuTouch}><Ionicons name="ellipsis-vertical" size={20} color={theme.textMuted} /></TouchableOpacity>
                            <Text style={[styles.rowTime, { color: theme.textMuted, fontSize: 10 }]}>{formatTimeAgo(lead.createdAt)}</Text>
                            <View style={[styles.outcomeBadge, { backgroundColor: stageCfg.color + '15', flexDirection: 'row', alignItems: 'center' }]}>
                                <Ionicons name={stageCfg.icon} size={8} color={stageCfg.color} style={{marginRight: 3}} />
                                <Text style={[styles.outcomeText, { color: stageCfg.color }]}>{stageLabel.toUpperCase()}</Text>
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
    const { theme, isDarkMode } = useTheme();
    const { isAuthenticated } = useAuth();
    const isDark = isDarkMode;
    const { filter: paramFilter } = useLocalSearchParams<{ filter?: string }>();
    const insets = useSafeAreaInsets();
    const { getLookupValue, getLookupsByType, refreshLookups } = useLookup();
    const { users, findUser } = useUsers();
    
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [leadsStats, setLeadsStats] = useState({ 
        total: 0, today: 0, fresh: 0, hot: 0,
        pipeline: { incoming: 0, prospect: 0, opportunity: 0, negotiation: 0, won: 0, lost: 0 }
    });
    const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>("all");
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState<{ stages: string[], sources: string[], owners: string[] }>({ stages: [], sources: [], owners: [] });
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showDormant, setShowDormant] = useState(false);
    const [bulkAssignVisible, setBulkAssignVisible] = useState(false);
    const [liveScores, setLiveScores] = useState<Record<string, { score: number; color: string; label: string }>>({});
    const fabScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (paramFilter) {
            if (paramFilter === 'NFA' || paramFilter === 'revived') {
                setSearch(paramFilter + ":");
                fetchLeads(1, false, paramFilter);
            } else {
                handleQuickFilter(paramFilter);
            }
        }
    }, [paramFilter]);

    const fetchLeads = useCallback(async (pageNum = 1, shouldAppend = false, qFilter?: string) => {
        if (!isAuthenticated) return;
        if (pageNum === 1 && !shouldAppend) setLoading(true);
        const params: any = { page: String(pageNum), limit: "50" };
        const query = qFilter || search;
        if (query) {
            if (query.startsWith("NFA:") || query === "NFA") params.filter = "NFA";
            else if (query.startsWith("Revived:") || query === "revived") params.filter = "revived";
            else if (qFilter) params.status = qFilter;
            else params.q = query;
        }
        if (showDormant) params.showDormant = "true";
        const result = await safeApiCall<Lead>(() => getLeads(params));
        if (!result.error && result.data) {
            if (result.stats) setLeadsStats(result.stats);
            const recs = result.data;
            setLeads(prev => {
                const combined = shouldAppend ? [...prev, ...recs] : recs;
                const seen = new Set();
                return combined.filter((l: any) => {
                    const id = l?._id || l?.id;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
            });
            setHasMore(recs.length === 50);
            setPage(pageNum);
            if (!shouldAppend) getLeadScores().then(scores => setLiveScores(scores)).catch(() => {});
        }
        setLoading(false);
        setRefreshing(false);
    }, [search, showDormant, isAuthenticated]);

    useFocusEffect(useCallback(() => { if (isAuthenticated) fetchLeads(1, false); }, [fetchLeads, isAuthenticated]));

    const handleQuickFilter = (type: string) => {
        const next = activeQuickFilter === type ? null : type;
        setActiveQuickFilter(next);
        setActiveFilter(next || "all");
        fetchLeads(1, false, next || undefined);
    };

    const onRefresh = useCallback(() => { setRefreshing(true); refreshLookups(); fetchLeads(1, false); }, [fetchLeads, refreshLookups]);
    const loadMore = useCallback(() => { if (!loading && hasMore) fetchLeads(page + 1, true); }, [loading, hasMore, page, fetchLeads]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        Vibration.vibrate(10);
    };

    const handleBulkDelete = () => {
        Alert.alert("Bulk Delete", `Delete ${selectedIds.length} leads?`, [
            { text: "Cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                await Promise.all(selectedIds.map(id => deleteLead(id)));
                setSelectedIds([]);
                fetchLeads();
            }}
        ]);
    };

    const handleBulkAssign = async (userId: string) => {
        try {
            await Promise.all(selectedIds.map(id => updateLead(id, { owner: userId })));
            setSelectedIds([]);
            setBulkAssignVisible(false);
            fetchLeads();
        } catch (e) { Alert.alert("Error", "Failed to assign leads"); }
    };

    const { filtered } = useMemo(() => {
        const q = debouncedSearch.toLowerCase();
        const list = leads.filter(l => {
            const sVal = lookupVal(l.stage).toLowerCase();
            if (filters.stages.length > 0 && !filters.stages.includes(typeof l.stage === 'string' ? l.stage : (l.stage as any)?._id)) return false;
            if (filters.sources.length > 0 && !filters.sources.includes(typeof l.source === 'string' ? l.source : (l.source as any)?._id)) return false;
            if (filters.owners.length > 0 && !filters.owners.includes(typeof l.owner === 'string' ? l.owner : (l.owner as any)?._id)) return false;
            if (activeFilter === "hot" && sVal !== "hot") return false;
            if (!q || q === "nfa:" || q === "revived:") return true;
            return leadName(l).toLowerCase().includes(q) || (l.mobile || "").includes(q);
        });
        return { filtered: list };
    }, [leads, debouncedSearch, activeFilter, filters]);

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: Math.max((insets?.top ?? 0) + 20, 55), paddingBottom: 16, backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={styles.headerTop}>
                <View>
                    <Text style={styles.screenTitle}>{selectedIds.length > 0 ? `${selectedIds.length} Selected` : "SALES PIPELINE"}</Text>
                    <Text style={styles.screenSub}>{(leadsStats?.total || 0).toLocaleString()} Total Records</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/add-lead")}><Ionicons name="add-circle" size={28} color={theme.primary} /></TouchableOpacity>
            </View>
            <View style={styles.kpiRow}>
                <KPIItem label="Total" value={leadsStats.total} color={theme.primary} icon="people" theme={theme} />
                <KPIItem label="Hot" value={leadsStats.hot} color="#EF4444" icon="flame" theme={theme} />
                <KPIItem label="Today" value={leadsStats.today} color="#10B981" icon="calendar" theme={theme} />
                <KPIItem label="Fresh" value={leadsStats.fresh} color="#8B5CF6" icon="leaf" theme={theme} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelScroll}>
                {[
                    { key: "all", label: "ALL", icon: "grid-outline", color: theme.primary },
                    { key: "incoming", label: "NEW", icon: "star-outline", color: "#6366F1" },
                    { key: "prospect", label: "PROSPECT", icon: "person-outline", color: "#3B82F6" },
                    { key: "opportunity", label: "OPPORTUNITY", icon: "flashlight-outline", color: "#EC4899" },
                    { key: "negotiation", label: "NEGOTIATION", icon: "chatbubbles-outline", color: "#F59E0B" },
                    { key: "won", label: "WON", icon: "trophy-outline", color: "#10B981" }
                ].map(ch => (
                    <TouchableOpacity 
                        key={ch.key} 
                        onPress={() => handleQuickFilter(ch.key === 'all' ? '' : ch.key)}
                        style={[styles.channelTab, (activeQuickFilter === ch.key || (ch.key === 'all' && !activeQuickFilter)) ? { backgroundColor: ch.color, borderColor: ch.color } : { backgroundColor: theme.background, borderColor: theme.border }]}
                    >
                        <Ionicons name={ch.icon as any} size={16} color={(activeQuickFilter === ch.key || (ch.key === 'all' && !activeQuickFilter)) ? '#fff' : theme.textMuted} />
                        <Text style={[styles.channelText, { color: (activeQuickFilter === ch.key || (ch.key === 'all' && !activeQuickFilter)) ? '#fff' : theme.textSecondary }]}>{ch.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <View style={styles.commandBar}>
                <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
                    <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
                    <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="Search leads..." placeholderTextColor={theme.textMuted} value={search} onChangeText={setSearch} />
                </View>
                <TouchableOpacity style={styles.filterToggleBtn} onPress={() => setShowFilterModal(true)}>
                    <Ionicons name="options-outline" size={22} color={Object.values(filters).flat().length > 0 ? theme.primary : theme.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {loading && page === 1 ? <ActivityIndicator color={theme.primary} size="large" style={{ marginTop: 100 }} /> : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 12 }}
                    renderItem={({ item, index }) => (
                        <LeadCard
                            lead={item} index={index} isSelected={selectedIds.includes(item._id)}
                            onLongPress={() => toggleSelection(item._id)}
                            liveScore={liveScores[item._id]}
                            onPress={() => selectedIds.length > 0 ? toggleSelection(item._id) : router.push(`/lead-detail?id=${item._id}`)}
                            onMore={() => { setSelectedLead(item); setSheetVisible(true); }}
                        />
                    )}
                    onEndReached={loadMore}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                    ListHeaderComponent={renderHeader()}
                    ListEmptyComponent={<View style={styles.empty}><Ionicons name="clipboard-outline" size={64} color={theme.border} /><Text style={[styles.emptyText, { color: theme.textLight }]}>No leads found.</Text></View>}
                />
            )}
            {selectedIds.length > 0 && (
                <View style={[styles.bulkActionsBar, { backgroundColor: isDark ? theme.card : theme.primary }]}>
                    <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkDelete}><Ionicons name="trash-outline" size={20} color="#fff" /><Text style={styles.bulkActionText}>Delete</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.bulkActionBtn} onPress={() => setBulkAssignVisible(true)}><Ionicons name="person-add-outline" size={20} color="#fff" /><Text style={styles.bulkActionText}>Assign</Text></TouchableOpacity>
                </View>
            )}
            <ActionSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} lead={selectedLead} onUpdate={() => fetchLeads(1, false)} statuses={getLookupsByType("Stage")} users={users} />
            <FilterModal visible={showFilterModal} onClose={() => setShowFilterModal(false)} filters={filters} setFilters={setFilters} statuses={getLookupsByType("Stage")} users={users} sources={getLookupsByType("Source")} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 16, borderBottomWidth: 1 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    screenTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
    screenSub: { fontSize: 10, fontWeight: "800", marginTop: 2, letterSpacing: 0.5 },
    commandBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginBottom: 8 },
    searchContainer: { flex: 1, height: 42, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, fontWeight: "600" },
    filterToggleBtn: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    card: { flexDirection: 'row', padding: 15, borderRadius: 20, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
    cardSelected: { borderWidth: 2 },
    rowContent: { flex: 1, marginLeft: 15 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    rowName: { fontSize: 15, fontWeight: '800' },
    rowTime: { fontSize: 11, fontWeight: '600' },
    rowSubject: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
    rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    outcomeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    outcomeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
    rightContentColumn: { alignItems: 'flex-end', justifyContent: 'center', marginLeft: 10, width: 90, gap: 8 },
    menuTouch: { padding: 4, marginRight: -4 },
    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16, paddingHorizontal: 4 },
    kpiItem: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    kpiIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    kpiValue: { fontSize: 16, fontWeight: '800' },
    kpiLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    channelScroll: { gap: 10, paddingBottom: 16, paddingHorizontal: 4 },
    channelTab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
    channelText: { fontSize: 13, fontWeight: '800' },
    rightActions: { flexDirection: 'row', gap: 8, paddingLeft: 10, marginBottom: 12 },
    leftActions: { flexDirection: 'row', gap: 8, paddingRight: 10, marginBottom: 12 },
    swipeAction: { width: 60, height: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },
    empty: { alignItems: 'center', marginTop: 100, gap: 12 },
    emptyText: { fontSize: 15, fontWeight: "600" },
    bulkActionsBar: { position: 'absolute', bottom: 34, alignSelf: 'center', flexDirection: 'row', borderRadius: 20, paddingHorizontal: 20, height: 56, alignItems: 'center', gap: 16, shadowOpacity: 0.3, shadowRadius: 15 },
    bulkActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bulkActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end", alignItems: 'center' },
    filterModalContainer: { flex: 1 },
    filterHeaderTitle: { fontSize: 18, fontWeight: "800" },
    filterContent: { flex: 1, padding: 20 },
    filterSectionTitle: { fontSize: 12, fontWeight: "800", textTransform: 'uppercase', marginBottom: 12, marginTop: 16 },
    filterChipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    filterChipText: { fontSize: 13, fontWeight: "600" },
    filterFooter: { padding: 20, paddingBottom: 40, flexDirection: 'row', gap: 12, borderTopWidth: 1 },
    resetBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    resetBtnText: { fontSize: 14, fontWeight: "700" },
    applyBtn: { flex: 2, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    applyBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    sheetContainer: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, maxHeight: '85%' },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 24 },
    sheetHeader: { marginBottom: 28 },
    sheetTitle: { fontSize: 20, fontWeight: "800" },
    sheetSub: { fontSize: 13, fontWeight: "600", marginTop: 4 },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    actionItem: { width: '22%', alignItems: 'center', gap: 8 },
    actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 11, fontWeight: "700" },
    pickerView: { marginTop: 24, borderRadius: 20 },
    tagInputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    tagInput: { flex: 1, height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, borderWidth: 1 },
    addTagBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    tagChipText: { fontSize: 12, fontWeight: "600" },
    sectionTitle: { fontSize: 12, fontWeight: "800", textTransform: 'uppercase', marginBottom: 16 },
    chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    actionChipText: { fontSize: 12, fontWeight: "700" },
});
