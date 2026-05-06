import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Alert, Linking,
    Modal, Animated, Dimensions, Pressable, ScrollView, Vibration, Platform, SectionList, Share
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { getLeads, leadName, updateLead, deleteLead } from "@/services/leads.service";
import { getLeadScores } from "@/services/stageEngine.service";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import { useProjects } from "@/context/ProjectContext";
import { useCallTracking } from "@/context/CallTrackingContext";
import { extractList, extractTotal, safeApiCall } from "@/services/api.helpers";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const STAGE_CONFIG: Record<string, { color: string; icon: any }> = {
    "Incoming": { color: "#6366f1", icon: "flash" },
    "Prospect": { color: "#8b5cf6", icon: "people" },
    "Opportunity": { color: "#f59e0b", icon: "trending-up" },
    "Negotiation": { color: "#f97316", icon: "chatbubbles" },
    "Closed": { color: "#10b981", icon: "checkmark-done-circle" },
    "default": { color: "#94A3B8", icon: "help-circle" }
};

const DEFAULT_TABS = [
    { id: 'all', label: 'All', icon: 'list' },
    { id: 'incoming', label: 'Incoming', icon: 'star' },
    { id: 'prospect', label: 'Prospect', icon: 'people' },
    { id: 'opportunity', label: 'Opportunity', icon: 'trending-up' },
    { id: 'negotiation', label: 'Negotiation', icon: 'chatbubbles' },
    { id: 'closed', label: 'Closed', icon: 'checkmark-circle' },
];

const TERMINAL_STAGES = ['won', 'lost', 'unqualified', 'dormant', 'stalled', 'closed won', 'closed lost', 'not interested'];

const formatAmount = (amount?: any) => {
    if (amount == null) return "-";
    const val = Number(amount);
    if (isNaN(val)) return String(amount);
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)} K`;
    return String(val);
};

const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return "-";
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
};

function resolveName(field: any, getLookupValue: any, findUser: any) {
    if (!field) return "-";
    if (typeof field === 'string' && /^[a-f0-9]{24}$/i.test(field)) {
        const user = findUser(field);
        if (user) return String(user.fullName || user.name);
        const lVal = getLookupValue("Any", field);
        return lVal && lVal !== field ? String(lVal) : "-";
    }
    if (typeof field === 'object') return String(field.fullName || field.name || field.lookup_value || "-");
    return String(field);
}

const KPIItem = memo(({ label, value, color, icon, theme }: any) => (
<View style={[styles.kpiItem, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={[styles.kpiIcon, { backgroundColor: color + '15' }]}><Ionicons name={icon} size={14} color={color} /></View><View><Text style={[styles.kpiValue, { color }]}>{String(value || 0)}</Text><Text style={[styles.kpiLabel, { color: theme.textMuted }]}>{String(label)}</Text></View></View>
));

const LeadScoreRing = memo(({ score, color, size = 44 }: any) => {
    const { theme } = useTheme();
    const s = Number(score) || 0;
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: theme.border, position: 'absolute' }} />
            <View style={{ 
                width: size, height: size, borderRadius: size / 2, borderWidth: 3, 
                borderColor: color, 
                borderLeftColor: s > 75 ? color : 'transparent',
                borderBottomColor: s > 50 ? color : 'transparent',
                borderRightColor: s > 25 ? color : 'transparent',
                transform: [{ rotate: '-45deg' }],
                position: 'absolute'
            }} />
            <View style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, backgroundColor: color + '10', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: theme.text }}>{String(Math.round(s))}</Text>
            </View>
        </View>
    );
});

const AdvancedFilterModal = memo(({ visible, onClose, filters, setFilters, users, projects }: any) => {
    const { theme } = useTheme();
    const { getLookupsByType } = useLookup();
    const insets = useSafeAreaInsets();
    
    const sources = getLookupsByType("Source");
    const stages = getLookupsByType("Stage");
    const intents = getLookupsByType("Requirement");
    const categories = getLookupsByType("Category");
    const facings = getLookupsByType("Facing");
    const directions = getLookupsByType("Direction");
    const roadWidths = getLookupsByType("RoadWidth");

    const toggleArrayFilter = (key: string, val: string) => {
        const current = filters[key] || [];
        if (current.includes(val)) {
            setFilters({ ...filters, [key]: current.filter((item: string) => item !== val) });
        } else {
            setFilters({ ...filters, [key]: [...current, val] });
        }
    };

    const isSelected = (key: string, val: string) => (filters[key] || []).includes(val);

    const FilterSection = ({ title, children }: any) => (
        <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.textMuted }]}>{title}</Text>
            {children}
        </View>
    );

    const SelectChips = ({ data, filterKey, labelKey = "lookup_value", idKey = "_id" }: any) => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
            {data.map((item: any) => {
                const id = item[idKey];
                const label = item[labelKey];
                const active = isSelected(filterKey, id);
                return (
                    <TouchableOpacity 
                        key={id} 
                        onPress={() => toggleArrayFilter(filterKey, id)} 
                        style={[styles.filterChip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    >
                        <Text style={{ color: active ? "#fff" : theme.textSecondary, fontSize: 12, fontWeight: '700' }}>{String(label)}</Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: theme.background }}>
                <View style={[styles.sheetHeader, { borderBottomWidth: 1, borderColor: theme.border }]}>
                    <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
                    <Text style={[styles.sheetTitle, { color: theme.text }]}>ADVANCED FILTERS</Text>
                    <TouchableOpacity onPress={() => { setFilters({}); onClose(); }}><Text style={{ color: theme.primary, fontWeight: '700' }}>Reset</Text></TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                    <FilterSection title="REQUIREMENT INTENT">
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {intents.map((it: any) => (
                                <TouchableOpacity 
                                    key={it._id} 
                                    onPress={() => setFilters({ ...filters, requirement: filters.requirement === it._id ? "" : it._id })}
                                    style={[styles.filterChip, { flex: 1, alignItems: 'center' }, filters.requirement === it._id && { backgroundColor: theme.primary }]}
                                >
                                    <Text style={{ color: filters.requirement === it._id ? "#fff" : theme.textSecondary, fontWeight: '700' }}>{String(it.lookup_value)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </FilterSection>

                    <FilterSection title="LEAD STAGE"><SelectChips data={stages} filterKey="stage" /></FilterSection>
                    <FilterSection title="LEAD SOURCE"><SelectChips data={sources} filterKey="source" /></FilterSection>
                    <FilterSection title="OWNER / ASSIGNED TO"><SelectChips data={users} filterKey="userId" labelKey="fullName" /></FilterSection>
                    <FilterSection title="PROPERTY TYPE"><SelectChips data={categories} filterKey="propertyType" /></FilterSection>

                    <FilterSection title="BUDGET RANGE (₹)">
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TextInput placeholder="Min Budget" style={[styles.filterInput, { flex: 1, backgroundColor: theme.card, color: theme.text }]} keyboardType="numeric" value={filters.budgetMin} onChangeText={(t) => setFilters({ ...filters, budgetMin: t })} placeholderTextColor={theme.textMuted} />
                            <TextInput placeholder="Max Budget" style={[styles.filterInput, { flex: 1, backgroundColor: theme.card, color: theme.text }]} keyboardType="numeric" value={filters.budgetMax} onChangeText={(t) => setFilters({ ...filters, budgetMax: t })} placeholderTextColor={theme.textMuted} />
                        </View>
                    </FilterSection>

                    <FilterSection title="LOCATION & PROJECT">
                        <TextInput placeholder="Search Area..." style={[styles.filterInput, { backgroundColor: theme.card, color: theme.text, marginBottom: 10 }]} value={filters.location} onChangeText={(t) => setFilters({ ...filters, location: t })} placeholderTextColor={theme.textMuted} />
                        <View style={{ height: 120, borderWidth: 1, borderColor: theme.border, borderRadius: 12, overflow: 'hidden' }}>
                            <ScrollView nestedScrollEnabled>
                                {projects.map((p: any) => (
                                    <TouchableOpacity key={p._id} onPress={() => setFilters({ ...filters, project: filters.project === p._id ? "" : p._id })} style={{ padding: 12, borderBottomWidth: 1, borderColor: theme.border, backgroundColor: filters.project === p._id ? theme.primary + '10' : 'transparent' }}>
                                        <Text style={{ color: filters.project === p._id ? theme.primary : theme.text, fontSize: 13, fontWeight: filters.project === p._id ? '700' : '400' }}>{p.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </FilterSection>

                    <FilterSection title="ORIENTATION">
                        <Text style={[styles.fieldLabel, { marginTop: 10, marginBottom: 5 }]}>Facing</Text><SelectChips data={facings} filterKey="facing" />
                        <Text style={[styles.fieldLabel, { marginTop: 10, marginBottom: 5 }]}>Direction</Text><SelectChips data={directions} filterKey="direction" />
                        <Text style={[styles.fieldLabel, { marginTop: 10, marginBottom: 5 }]}>Road Width</Text><SelectChips data={roadWidths} filterKey="roadWidth" />
                    </FilterSection>
                </ScrollView>

                <View style={[styles.filterFooter, { paddingBottom: Math.max(insets.bottom, 20), borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.card }]}>
                    <TouchableOpacity style={[styles.applyBtn, { backgroundColor: theme.primary, width: '100%' }]} onPress={onClose}>
                        <Text style={styles.applyBtnText}>Apply Filters</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});

const ActionSheet = memo(({ visible, onClose, lead, onUpdate, users }: any) => {
    const router = useRouter();
    const { theme, isDarkMode } = useTheme();
    const { getLookupsByType } = useLookup();
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [newTag, setNewTag] = useState("");
    const [updating, setUpdating] = useState(false);

    const sequences = getLookupsByType("MarketingSequence");

    if (!lead || !visible) return null;

    const handleAction = async (updateData: any) => {
        setUpdating(true);
        const payload = { ...updateData };
        if (updateData.assignedTo) {
            payload.assignment = {
                assignedTo: updateData.assignedTo,
                visibleTo: lead.assignment?.visibleTo || "Everyone",
                team: lead.assignment?.team || []
            };
            payload.owner = updateData.assignedTo;
            delete payload.assignedTo;
        }

        const res = await safeApiCall(() => updateLead(lead._id, payload));
        setUpdating(false);
        if (!res.error) {
            Vibration.vibrate(20);
            onUpdate();
            onClose();
        } else {
            Alert.alert("Error", "Failed to update lead: " + (res.error || "Unknown error"));
        }
    };

    const handleAddTag = async () => {
        if (!newTag.trim()) return;
        const currentTags = lead.tags || [];
        if (currentTags.includes(newTag.trim())) return;
        handleAction({ tags: [...currentTags, newTag.trim()] });
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <View style={[styles.sheetContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.sheetHandle} />
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={[styles.sheetTitle, { color: theme.text, textAlign: 'center', marginBottom: 20 }]}>{String(leadName(lead))}</Text>
                        
                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-lead?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: theme.primary + '15' }]}><Ionicons name="create" size={24} color={theme.primary} /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/match-lead?id=${lead._id}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#DB277715' }]}><Ionicons name="git-compare" size={24} color="#DB2777" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Match</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => setActiveSection(activeSection === 'assign' ? null : 'assign')}>
                                <View style={[styles.actionIcon, { backgroundColor: '#7C3AED15' }]}><Ionicons name="person-add" size={24} color="#7C3AED" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Assign</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => setActiveSection(activeSection === 'tag' ? null : 'tag')}>
                                <View style={[styles.actionIcon, { backgroundColor: '#4F46E515' }]}><Ionicons name="pricetags" size={24} color="#4F46E5" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Tag</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/add-activity?id=${lead._id}&type=Lead`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#10B98115' }]}><Ionicons name="calendar" size={24} color="#10B981" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Activity</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/outcome?id=new&entityId=${lead._id}&entityType=Lead&entityName=${encodeURIComponent(leadName(lead))}&mobile=${lead.mobile}`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#F9731615' }]}><Ionicons name="checkmark-done-circle" size={24} color="#F97316" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Outcome</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                const phone = lead.mobile;
                                const name = leadName(lead);
                                const text = `Lead Details:\nName: ${name}\nPhone: ${phone}\nRequirement: ${lead.requirement?.lookup_value || lead.requirement || 'N/A'}`;
                                Share.share({ message: text }).catch(() => Alert.alert("Error", "Could not share lead details"));
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#F0F9FF' }]}>
                                    <Ionicons name="share-social-outline" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Share</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                if (lead._id) {
                                    onClose();
                                    router.push({ pathname: "/documents", params: { id: lead._id, type: "Lead" } });
                                }
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#F0F9FF' }]}>
                                    <Ionicons name="document-attach-outline" size={24} color="#0EA5E9" />
                                </View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Docs</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => setActiveSection(activeSection === 'sequence' ? null : 'sequence')}>
                                <View style={[styles.actionIcon, { backgroundColor: '#8B5CF615' }]}><Ionicons name="list" size={24} color="#8B5CF6" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Sequence</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                Alert.alert("Delete Lead", "Are you sure you want to permanently remove this lead?", [
                                    { text: "Cancel", style: "cancel" },
                                    { 
                                        text: "Delete", 
                                        style: "destructive", 
                                        onPress: async () => {
                                            if (!lead?._id) return Alert.alert("Error", "Lead ID missing");
                                            try {
                                                console.log("[LeadsList] Attempting to delete lead:", lead._id);
                                                const res = await deleteLead(lead._id);
                                                
                                                Vibration.vibrate(50);
                                                Alert.alert("Success", "Lead removed successfully.");
                                                onUpdate(); 
                                                onClose();
                                            } catch (err: any) {
                                                console.error("Delete Lead Error:", err);
                                                const errorMsg = err.response?.data?.message || err.message || "Unknown error occurred";
                                                Alert.alert("Failed to Delete", errorMsg);
                                            }
                                        } 
                                    }
                                ]);
                            }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#EF444415' }]}><Ionicons name="trash" size={24} color="#EF4444" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>

                        {activeSection === 'assign' && (
                            <View style={[styles.subSection, { backgroundColor: isDarkMode ? 'rgba(124, 58, 237, 0.05)' : '#F5F3FF' }]}>
                                <Text style={[styles.sectionTitle, { color: '#7C3AED' }]}>Assign to Team Member</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
                                    {users.map((u: any) => (
                                        <TouchableOpacity 
                                            key={u._id} 
                                            style={[styles.userChip, { borderColor: lead.owner === u._id || lead.assignment?.assignedTo === u._id ? '#7C3AED' : theme.border }]} 
                                            onPress={() => handleAction({ assignedTo: u._id, owner: u._id })}
                                        >
                                            <View style={[styles.userAvatar, { backgroundColor: theme.primary + '15' }]}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>{String((u.fullName || u.name || "?")[0])}</Text></View>
                                            <Text style={[styles.userChipText, { color: theme.textSecondary }]}>{String(u.fullName || u.name)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {activeSection === 'tag' && (
                            <View style={[styles.subSection, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }]}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Manage Tags</Text>
                                <View style={styles.tagInputRow}>
                                    <TextInput style={[styles.tagInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]} placeholder="New tag..." placeholderTextColor={theme.textMuted} value={newTag} onChangeText={setNewTag} />
                                    <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: theme.primary }]} onPress={handleAddTag} disabled={updating}>
                                        {updating ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="add" size={24} color="#fff" />}
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.tagList}>
                                    {(lead.tags || []).map((t: string, i: number) => (
                                        <View key={i} style={[styles.tagBadge, { backgroundColor: theme.primary + '10' }]}>
                                            <Text style={[styles.tagText, { color: theme.primary }]}>{String(t)}</Text>
                                            <TouchableOpacity onPress={() => handleAction({ tags: (lead.tags || []).filter((tag: string) => tag !== t) })}><Ionicons name="close-circle" size={14} color={theme.primary} /></TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {activeSection === 'sequence' && (
                            <View style={[styles.subSection, { backgroundColor: isDarkMode ? 'rgba(139,92,246,0.05)' : '#F5F3FF' }]}>
                                <Text style={[styles.sectionTitle, { color: '#7C3AED' }]}>Enroll in Marketing Sequence</Text>
                                <View style={{ gap: 8 }}>
                                    {sequences.map((s: any) => {
                                        const isCurrent = lead.sequence === s._id || lead.sequence?._id === s._id;
                                        return (
                                            <TouchableOpacity 
                                                key={s._id} 
                                                style={[styles.dropdownItem, { backgroundColor: theme.card, borderColor: isCurrent ? '#7C3AED' : theme.border, borderWidth: 1 }]} 
                                                onPress={() => handleAction({ sequence: s._id })}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: isCurrent ? '#7C3AED' : theme.text }}>{String(s.lookup_value)}</Text>
                                                {isCurrent && <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </Pressable>
        </Modal>
    );
});

const LeadCard = memo(({ lead, index, onPress, onMore, liveScore }: any) => {
    const { theme } = useTheme();
    const { getLookupValue } = useLookup();
    const { findUser } = useUsers();
    const { trackCall } = useCallTracking();

    const handleWhatsApp = (phone: string) => {
        if (!phone) return Alert.alert("No Number", "No mobile number available.");
        const url = `whatsapp://send?phone=91${phone.replace(/\D/g, '')}`;
        Linking.openURL(url).catch(() => Linking.openURL(`https://wa.me/91${phone.replace(/\D/g, '')}`));
    };

    const handleSMS = (phone: string) => {
        if (!phone) return Alert.alert("No Number", "No mobile number available.");
        Linking.openURL(`sms:${phone}`);
    };

    const handleEmail = (email: string) => {
        if (!email) return Alert.alert("No Email", "No email address available.");
        Linking.openURL(`mailto:${email}`);
    };

    const name = String(leadName(lead) || "Unnamed");
    const scoreVal = liveScore?.score || lead.intent_index || 30;
    const scoreColor = liveScore?.color || (scoreVal > 70 ? "#10B981" : scoreVal > 40 ? "#F59E0B" : "#3B82F6");

    const stageLabel = String(getLookupValue("Stage", lead.stage) || "Incoming");
    const stageCfg = STAGE_CONFIG[stageLabel] || STAGE_CONFIG.default;

    const selectLocation = getLookupValue("Location", lead.location);
    const searchLocation = lead.locArea || lead.searchLocation || "";
    const cityVal = getLookupValue("City", lead.locCity);
    
    const projects = Array.isArray(lead.projectName) && lead.projectName.length > 0 
        ? lead.projectName.join(", ") 
        : (typeof lead.project === 'object' ? lead.project?.name : getLookupValue("Project", lead.project));

    let primaryLocation = "";
    if (projects && projects !== "-" && projects !== "—") {
        primaryLocation = projects;
    } else if (selectLocation && selectLocation !== "-" && selectLocation !== "—") {
        primaryLocation = selectLocation;
    } else if (searchLocation && searchLocation !== "-" && searchLocation !== "—") {
        primaryLocation = searchLocation;
    }

    let combinedLocation = primaryLocation;
    if (cityVal && cityVal !== "-" && cityVal !== "—") {
        if (combinedLocation && !combinedLocation.toLowerCase().includes(cityVal.toLowerCase())) {
            combinedLocation = `${combinedLocation}, ${cityVal}`;
        } else if (!combinedLocation) {
            combinedLocation = cityVal;
        }
    }
    
    if (!combinedLocation) combinedLocation = "Location Unspecified";

    const budgetText = lead.budgetMax ? `₹${formatAmount(lead.budgetMax)}` : (lead.budgetMin ? `₹${formatAmount(lead.budgetMin)}` : null);
    
    const resolveLookupArr = (type: string, val: any) => {
        if (!val) return "";
        if (Array.isArray(val)) return val.map(v => getLookupValue(type, v)).filter(Boolean).join(", ");
        return String(getLookupValue(type, val) || "");
    };

    const sizeTypeText = resolveLookupArr("UnitType", lead.unitType);
    const categoryText = [
        resolveLookupArr("Category", lead.propertyType),
        resolveLookupArr("SubCategory", lead.subType)
    ].filter(v => v && v !== "" && v !== "-" && v !== "—").join(" • ");

    const renderRightActions = () => (
        <View style={styles.swipeActions}>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: theme.primary }]} onPress={() => trackCall(lead.mobile || "", lead._id, "Lead", name)}><View style={{ alignItems: 'center' }}><Ionicons name="call" size={20} color="#fff" /><Text style={styles.swipeLabel}>Call</Text></View></TouchableOpacity>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: '#25D366' }]} onPress={() => handleWhatsApp(lead.mobile || "")}><View style={{ alignItems: 'center' }}><Ionicons name="logo-whatsapp" size={20} color="#fff" /><Text style={styles.swipeLabel}>Chat</Text></View></TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.swipeActions}>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: '#3B82F6' }]} onPress={() => handleSMS(lead.mobile || "")}><View style={{ alignItems: 'center' }}><Ionicons name="chatbubble-ellipses" size={20} color="#fff" /><Text style={styles.swipeLabel}>SMS</Text></View></TouchableOpacity>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: '#F59E0B' }]} onPress={() => handleEmail(lead.email || "")}><View style={{ alignItems: 'center' }}><Ionicons name="mail" size={20} color="#fff" /><Text style={styles.swipeLabel}>Email</Text></View></TouchableOpacity>
        </View>
    );

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <TouchableOpacity onPress={onPress}>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
<View style={styles.cardInner}>
                        <View style={{ alignItems: 'center', width: 55, gap: 6 }}>
                            <LeadScoreRing score={scoreVal} color={scoreColor} />
                            <View style={[styles.ownerBadge, { backgroundColor: stageCfg.color + '15' }]}><Text style={[styles.ownerText, { color: stageCfg.color, fontSize: 8, fontWeight: '900' }]}>{stageLabel.toUpperCase()}</Text></View>
                        </View>
<View style={styles.cardContent}><View style={styles.cardHeader}><Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{name}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{!!lead.source && <View style={styles.sourceBadge}><Text style={styles.sourceText}>{String(getLookupValue("Source", lead.source)).toUpperCase()}</Text></View>}<TouchableOpacity onPress={onMore} style={styles.moreBtn}><Ionicons name="ellipsis-vertical" size={18} color={theme.textMuted} /></TouchableOpacity></View></View><View style={styles.metaRow}><Ionicons name="call-outline" size={12} color={theme.textMuted} /><Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginLeft: 4 }}>{String(lead.mobile)}</Text>{!!budgetText && <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: theme.textMuted, marginHorizontal: 6 }}>|</Text><Ionicons name="pricetag-outline" size={12} color="#10B981" /><Text style={{ fontSize: 12, color: '#10B981', fontWeight: '800', marginLeft: 4 }}>{budgetText}</Text></View>}</View><View style={styles.requirementRow}>{!!sizeTypeText && <View style={[styles.sizeBadge, { backgroundColor: theme.primary + '10' }]}><Text style={[styles.sizeText, { color: theme.primary }]}>{sizeTypeText}</Text></View>}<Text style={{ fontSize: 11, color: theme.textMuted, marginLeft: sizeTypeText ? 8 : 0 }} numberOfLines={1}>{categoryText}</Text></View><View style={styles.footerRow}><View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}><Ionicons name="location-outline" size={10} color={theme.textMuted} /><Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '700', marginLeft: 4, flex: 1 }} numberOfLines={1}>{combinedLocation}</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}><Text style={[styles.ownerText, { color: theme.primary, fontWeight: '700', marginRight: 8 }]}>{resolveName(lead.owner, getLookupValue, findUser)}</Text><Text style={styles.timeText}>{formatTimeAgo(lead.createdAt)}</Text></View></View></View>
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
});

export default function LeadsScreen() {
    const router = useRouter();
    const { theme, isDarkMode } = useTheme();
    const isDark = isDarkMode;
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();
    const { getLookupValue, getLookupsByType } = useLookup();
    const { findUser, users } = useUsers();
    const { projects } = useProjects();

    const dynamicTabs = useMemo(() => {
        const statuses = getLookupsByType('Lead Status');
        if (!statuses || statuses.length === 0) return DEFAULT_TABS;
        
        const activeTabs = [{ id: 'all', label: 'All' }];
        statuses.forEach(l => {
            activeTabs.push({ id: l._id, label: l.lookup_value });
        });

        return activeTabs;
    }, [getLookupsByType]);

    const terminalIds = useMemo(() => {
        const statuses = getLookupsByType('Lead Status');
        return statuses
            .filter(l => TERMINAL_STAGES.includes(l.lookup_value.toLowerCase()))
            .map(l => l._id);
    }, [getLookupsByType]);

    const [closedSheetVisible, setClosedSheetVisible] = useState(false);
    const [terminalOptions, setTerminalOptions] = useState<any[]>([]);

    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [activeTab, setActiveTab] = useState("all");
    const [stats, setStats] = useState({ total: 0, hot: 0, today: 0, fresh: 0 });
    const [selectedLead, setSelectedLead] = useState<any | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [sortVisible, setSortVisible] = useState(false);
    const [sortConfig, setSortConfig] = useState({ label: 'Newest First', by: 'createdAt', order: -1 });
    const [advFilters, setAdvFilters] = useState<any>({});
    const [liveScores, setLiveScores] = useState<any>({});

    const fetchLeads = async (pageNum = 1, shouldAppend = false, isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else if (!shouldAppend) setLoading(true);
        try {
            const limit = 20;
            const params: any = { page: String(pageNum), limit: String(limit), sortBy: sortConfig.by, sortOrder: String(sortConfig.order), ...advFilters };
            if (search) params.search = search;
            
            // Sync with Web CRM logic: activeTab is the Status ID or Value
            if (activeTab !== "all") {
                if (/^[0-9a-fA-F]{24}$/.test(activeTab)) {
                    // It's an ObjectId — pipeline stages in backend are primarily queried via 'stage' field
                    params.stage = activeTab;
                } else {
                    // It's a keyword (e.g. 'incoming', 'prospect') — backend maps these via 'status' param
                    params.status = activeTab;
                }
            } else if (advFilters.status) {
                params.status = advFilters.status;
            }
            
            if (advFilters.stage) params.stage = advFilters.stage;

            const res = await getLeads(params);
            const newLeads = extractList(res);
            
            if (pageNum === 1 && res?.stats) setStats(res.stats);
            
            setLeads(prev => shouldAppend ? [...prev, ...newLeads] : newLeads);
            setHasMore(newLeads.length > 0 && newLeads.length === limit);
            setPage(pageNum);
            
            if (newLeads.length > 0) {
                const ids = newLeads.map((l: any) => l._id);
                getLeadScores(ids).then(scores => { if (scores) setLiveScores((prev: any) => ({ ...prev, ...scores })); }).catch(() => {});
            }
        } catch (err) { 
            console.error("FetchLeads Error:", err); 
        } finally { 
            setLoading(false); 
            setRefreshing(false); 
        }
    };

    useEffect(() => { fetchLeads(1, false); }, [search, activeTab, sortConfig, advFilters]);

    const onRefresh = () => fetchLeads(1, false, true);

    // Global Sync Listener
    useEffect(() => {
        const { DeviceEventEmitter } = require('react-native');
        const { SyncEvents } = require("@/utils/sync-events");
        
        const handleSync = (detail: any) => {
            console.log("[LeadsList] Sync event received, refreshing list:", detail);
            fetchLeads(1, false); 
        };

        const subs = [
            DeviceEventEmitter.addListener(SyncEvents.LEAD_UPDATED, handleSync),
            DeviceEventEmitter.addListener(SyncEvents.ACTIVITY_COMPLETED, handleSync)
        ];

        return () => {
            subs.forEach(s => s.remove());
        };
    }, []);

    const loadMore = () => { if (!loading && hasMore) fetchLeads(page + 1, true); };

    const getStageIcon = (label: string) => {
        const l = label.toLowerCase();
        if (l.includes('incoming')) return 'mail-unread';
        if (l.includes('prospect')) return 'search';
        if (l.includes('opportunity')) return 'bulb';
        if (l.includes('negotiation')) return 'handshake';
        if (l.includes('all')) return 'apps';
        return 'archive';
    };

    const renderTabs = () => (
        <View style={[styles.aeroContainer, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 14 }}>
                <View style={[styles.aeroRow, { paddingHorizontal: 16 }]}>
                    {dynamicTabs.map((tab, idx) => {
                        const isActive = activeTab === tab.id;
                        const isFirst = idx === 0;
                        const isLast = idx === dynamicTabs.length - 1;
                        
                        return (
                            <View key={tab.id} style={[styles.arrowWrapper, !isFirst && { marginLeft: -10 }]}>
                                <TouchableOpacity 
                                    style={[
                                        styles.arrowBody, 
                                        { backgroundColor: isActive ? theme.primary : (isDark ? '#1A1A1A' : '#F8FAFC'), borderColor: theme.border },
                                        isFirst && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }
                                    ]}
                                    onPress={() => {
                                        Vibration.vibrate(10);
                                        setActiveTab(tab.id);
                                        setPage(1);
                                    }}
                                >
                                    <Text style={[styles.aeroText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                                        {tab.label.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                                
                                {!isLast && (
                                    <View style={styles.arrowHeadContainer}>
                                        <View style={[styles.triangle, { borderLeftColor: theme.border }]} />
                                        <View style={[styles.triangleInner, { borderLeftColor: isActive ? theme.primary : (isDark ? '#1A1A1A' : '#F8FAFC') }]} />
                                    </View>
                                )}
                                
                                {isLast && (
                                    <View style={[styles.arrowEnd, { backgroundColor: isActive ? theme.primary : (isDark ? '#1A1A1A' : '#F8FAFC'), borderColor: theme.border }]} />
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );

const renderHeader = () => (<View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: theme.card }]}><View style={styles.headerTop}><View><Text style={[styles.headerTitle, { color: theme.text }]}>SALES PIPELINE</Text><Text style={[styles.headerSub, { color: theme.textMuted }]}>{stats.total} Total Records</Text></View><TouchableOpacity onPress={() => router.push("/add-lead")}><Ionicons name="add-circle" size={32} color={theme.primary} /></TouchableOpacity></View><View style={styles.kpiRow}><KPIItem label="Hot" value={stats.hot} color="#EF4444" icon="flame" theme={theme} /><KPIItem label="Today" value={stats.today} color="#10B981" icon="calendar" theme={theme} /><KPIItem label="Fresh" value={stats.fresh} color="#8B5CF6" icon="leaf" theme={theme} /></View><View style={styles.searchBarRow}><View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}><Ionicons name="search" size={18} color={theme.textMuted} /><TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="Search leads..." placeholderTextColor={theme.textMuted} value={search} onChangeText={setSearch} /><TouchableOpacity onPress={() => setSortVisible(true)} style={[styles.filterBtn, { marginRight: 8 }]}><Ionicons name="swap-vertical" size={18} color={theme.primary} /></TouchableOpacity><TouchableOpacity onPress={() => setFilterVisible(true)} style={[styles.filterBtn, Object.keys(advFilters).length > 0 && { backgroundColor: theme.primary }]}><Ionicons name="options" size={18} color={Object.keys(advFilters).length > 0 ? "#fff" : theme.textMuted} /></TouchableOpacity></View></View>{renderTabs()}</View>);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <FlatList data={leads} renderItem={({ item, index }) => (<LeadCard lead={item} index={index} liveScore={liveScores[item._id]} onPress={() => router.push(`/lead-detail?id=${item._id}`)} onMore={() => { setSelectedLead(item); setSheetVisible(true); }} />)} keyExtractor={(item) => item._id} ListHeaderComponent={renderHeader} onEndReached={loadMore} onEndReachedThreshold={0.5} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} contentContainerStyle={{ paddingBottom: 100 }} ListEmptyComponent={!!(!loading) ? <View style={styles.empty}><Ionicons name="person-outline" size={64} color="#CBD5E1" /><Text style={styles.emptyText}>No leads found matching criteria.</Text></View> : null} />
            {!!loading && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}><ActivityIndicator size="large" color={theme.primary} /></View>}
            <ActionSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} lead={selectedLead} onUpdate={() => fetchLeads(1, false)} users={users} />
            <AdvancedFilterModal visible={filterVisible} onClose={() => setFilterVisible(false)} filters={advFilters} setFilters={setAdvFilters} users={users} projects={projects} />
            <Modal visible={closedSheetVisible} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setClosedSheetVisible(false)}>
                    <View style={[styles.sheetContainer, { backgroundColor: theme.card }]}>
                        <View style={styles.sheetHandle} />
                        <Text style={[styles.sectionTitle, { color: theme.text, textAlign: 'center' }]}>Closed / Terminal Stages</Text>
                        <View style={{ gap: 8, marginTop: 20 }}>
                            {terminalOptions.map(opt => (
                                <TouchableOpacity 
                                    key={opt.id} 
                                    style={[styles.dropdownItem, { backgroundColor: activeTab === opt.id ? theme.primary + '15' : theme.background }]}
                                    onPress={() => {
                                        setActiveTab(opt.id);
                                        setPage(1);
                                        setClosedSheetVisible(false);
                                    }}
                                >
                                    <Text style={{ color: activeTab === opt.id ? theme.primary : theme.text, fontWeight: '700' }}>{opt.label}</Text>
                                    {activeTab === opt.id && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Pressable>
            </Modal>
            <Modal visible={sortVisible} transparent animationType="fade"><Pressable style={styles.modalOverlay} onPress={() => setSortVisible(false)}><View style={[styles.sheetContainer, { backgroundColor: theme.card }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: theme.text, textAlign: 'center', flex: 1 }]}>SORT LEADS</Text></View><View style={{ padding: 20, gap: 10 }}>{[ { label: 'Newest First', by: 'createdAt', order: -1, icon: 'time-outline' }, { label: 'Oldest First', by: 'createdAt', order: 1, icon: 'hourglass-outline' }, { label: 'Alphabetical', by: 'firstName', order: 1, icon: 'text-outline' }, { label: 'Last Activity', by: 'updatedAt', order: -1, icon: 'flash-outline' }, { label: 'High Intent Score', by: 'intent_index', order: -1, icon: 'trending-up-outline' } ].map((opt: any) => (<TouchableOpacity key={opt.label} onPress={() => { setSortConfig(opt); setSortVisible(false); }} style={[styles.sortItem, sortConfig.label === opt.label && { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}><Ionicons name={opt.icon as any} size={20} color={sortConfig.label === opt.label ? theme.primary : theme.textMuted} /><Text style={{ flex: 1, color: sortConfig.label === opt.label ? theme.primary : theme.text, fontWeight: '700' }}>{opt.label}</Text>{sortConfig.label === opt.label && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}</TouchableOpacity>))}</View></View></Pressable></Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingBottom: 0 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, marginBottom: 20 },
    headerTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
    headerSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },
    kpiRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 12, marginBottom: 20 },
    kpiItem: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    kpiIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    kpiValue: { fontSize: 16, fontWeight: '900' },
    kpiLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    searchBarRow: { paddingHorizontal: 12, marginBottom: 15 },
    searchBar: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
    filterBtn: { padding: 8, borderRadius: 8, marginLeft: 8 },
    tabBar: { borderBottomWidth: 1, height: 48, justifyContent: 'center' },
    aeroContainer: { borderBottomWidth: 1, backgroundColor: 'rgba(255,255,255,0.9)' },
    aeroRow: { flexDirection: 'row', alignItems: 'center' },
    arrowWrapper: { flexDirection: 'row', alignItems: 'center' },
    arrowBody: { height: 32, paddingLeft: 20, paddingRight: 10, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, flexDirection: 'row' },
    arrowHeadContainer: { width: 12, height: 32, justifyContent: 'center' },
    triangle: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderTopWidth: 16, borderBottomWidth: 16, borderLeftWidth: 12, borderTopColor: 'transparent', borderBottomColor: 'transparent', position: 'absolute', left: 0 },
    triangleInner: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderTopWidth: 15, borderBottomWidth: 15, borderLeftWidth: 11, borderTopColor: 'transparent', borderBottomColor: 'transparent', position: 'absolute', left: 0, zIndex: 1 },
    arrowEnd: { width: 10, height: 32, borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 1, borderTopRightRadius: 6, borderBottomRightRadius: 6 },
    aeroText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    tabItem: { paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', marginRight: 10 },
    tabText: { fontSize: 11, fontWeight: '800' },
    card: { padding: 14, borderRadius: 20, borderWidth: 1, marginBottom: 10, elevation: 3, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, overflow: 'hidden', marginHorizontal: 10 },
    cardInner: { flexDirection: 'row', alignItems: 'center' },
    cardContent: { flex: 1, marginLeft: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    cardName: { fontSize: 16, fontWeight: '800', flex: 1 },
    moreBtn: { padding: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    requirementRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    sizeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    sizeText: { fontSize: 10, fontWeight: '800' },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.03)' },
    ownerText: { fontSize: 10 },
    timeText: { fontSize: 9, fontWeight: '700', color: '#94A3B8' },
    ownerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
    sourceBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    sourceText: { fontSize: 8, fontWeight: '900', color: '#64748B' },
    swipeActions: { flexDirection: 'row', width: 140, height: '100%', marginBottom: 10 },
    swipeBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 12, fontSize: 15, fontWeight: '600', color: '#94A3B8' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheetContainer: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '85%' },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    sheetTitle: { fontSize: 18, fontWeight: '900' },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
    actionItem: { width: '22%', alignItems: 'center', marginBottom: 16 },
    actionIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    actionLabel: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
    subSection: { padding: 20, borderRadius: 20, marginTop: 10 },
    sectionTitle: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
    userChip: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, gap: 10 },
    userAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    userChipText: { fontSize: 13, fontWeight: '700' },
    tagInputRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    tagInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, fontWeight: '700' },
    addTagBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    tagText: { fontSize: 12, fontWeight: '700' },
    dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 8 },
    filterSection: { marginBottom: 25 },
    filterSectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    filterInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 14, fontWeight: '700' },
    filterFooter: { padding: 20 },
    applyBtn: { height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    fieldLabel: { fontSize: 12, fontWeight: '700' },
    sortItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
});
