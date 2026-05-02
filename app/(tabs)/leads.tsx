import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Alert, Linking,
    Modal, Animated, Dimensions, Pressable, ScrollView, Vibration, Platform, SectionList
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { getLeads, leadName, updateLead, deleteLead, type Lead } from "@/services/leads.service";
import { safeApiCall } from "@/services/api.helpers";
import { getLeadScores } from "@/services/stageEngine.service";
import { useCallTracking } from "@/context/CallTrackingContext";
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import { useProjects } from "@/context/ProjectContext";
import { useAuth } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- ENTERPRISE STAGE ALIGNMENT (WEB CRM PARITY) ---
const STAGE_CONFIG: Record<string, { color: string; icon: any }> = {
    "Incoming": { color: "#6366f1", icon: "flash" },
    "Prospect": { color: "#8b5cf6", icon: "people" },
    "Opportunity": { color: "#f59e0b", icon: "trending-up" },
    "Negotiation": { color: "#f97316", icon: "chatbubbles" },
    "Closed": { color: "#10b981", icon: "checkmark-done-circle" },
    "default": { color: "#94A3B8", icon: "help-circle" }
};

const STAGE_ORDER = ["Incoming", "Prospect", "Opportunity", "Negotiation", "Closed"];
const CLOSED_SUB_STAGES = ["Won", "Lost", "Stalled", "Dormant"];

// Map UI labels to actual DB lookup values for precise filtering
const STAGE_VALUE_MAP: Record<string, string> = {
    "Won": "Closed Won",
    "Lost": "Closed Lost",
    "Stalled": "Stalled",
    "Dormant": "Dormant"
};

// --- UTILS ---
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

// --- COMPONENTS ---
const KPIItem = memo(({ label, value, color, icon, theme }: any) => (
    <View style={[styles.kpiItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.kpiIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={14} color={color} />
        </View>
        <View>
            <Text style={[styles.kpiValue, { color }]}>{String(value || 0)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>{String(label)}</Text>
        </View>
    </View>
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

const ActionSheet = memo(({ visible, onClose, lead, onUpdate, statuses, users }: any) => {
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
        const res = await safeApiCall(() => updateLead(lead._id, updateData));
        setUpdating(false);
        if (!res.error) {
            Vibration.vibrate(20);
            onUpdate();
            onClose();
        } else {
            Alert.alert("Error", "Failed to update lead");
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
                            <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/documents?id=${lead._id}&type=Lead`); onClose(); }}>
                                <View style={[styles.actionIcon, { backgroundColor: '#3B82F615' }]}><Ionicons name="document-attach" size={24} color="#3B82F6" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Docs</Text>
                            </TouchableOpacity>
                            {(String(lead.stage?.lookup_value || lead.stage).includes("Dormant") || 
                              String(lead.stage?.lookup_value || lead.stage).includes("Stalled") || 
                              String(lead.stage?.lookup_value || lead.stage).includes("Closed")) && (
                                <TouchableOpacity style={styles.actionItem} onPress={() => { router.push(`/revive-lead?id=${lead._id}`); onClose(); }}>
                                    <View style={[styles.actionIcon, { backgroundColor: '#0EA5E915' }]}><Ionicons name="flash" size={24} color="#0EA5E9" /></View>
                                    <Text style={[styles.actionLabel, { color: theme.textSecondary, fontWeight: '900' }]}>Revive</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.actionItem} onPress={() => setActiveSection(activeSection === 'sequence' ? null : 'sequence')}>
                                <View style={[styles.actionIcon, { backgroundColor: '#8B5CF615' }]}><Ionicons name="list" size={24} color="#8B5CF6" /></View>
                                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Sequence</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => {
                                Alert.alert("Delete?", "Remove lead permanently?", [
                                    { text: "Cancel" },
                                    { text: "Delete", style: "destructive", onPress: async () => { await deleteLead(lead._id); onUpdate(); onClose(); } }
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
                                            {(lead.owner === u._id || lead.assignment?.assignedTo === u._id) && (
                                                <View style={{ position: 'absolute', top: -5, right: -5 }}>
                                                    <Ionicons name="checkmark-circle" size={16} color="#7C3AED" />
                                                </View>
                                            )}
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
                                                style={[
                                                    styles.dropdownItem, 
                                                    { backgroundColor: theme.card, borderColor: isCurrent ? '#7C3AED' : theme.border, borderWidth: 1 }
                                                ]} 
                                                onPress={() => handleAction({ sequence: s._id })}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <Ionicons name="mail-open-outline" size={18} color={isCurrent ? '#7C3AED' : theme.textMuted} />
                                                    <Text style={{ fontSize: 13, fontWeight: '700', color: isCurrent ? '#7C3AED' : theme.text }}>{String(s.lookup_value)}</Text>
                                                </View>
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

const LeadCard = memo(({ lead, index, onPress, onMore, liveScore, onDeleteSuccess }: any) => {
    const { theme, isDarkMode } = useTheme();
    const { getLookupValue } = useLookup();
    const { findUser } = useUsers();
    const { trackCall } = useCallTracking();
    const router = useRouter();

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
    
    // 🚀 [STRATEGIC FIX] Priority: Shortlisted Projects > Select Location > Search Location
    // User wants project names to dominate if they exist.
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
        if (combinedLocation) {
            if (!combinedLocation.toLowerCase().includes(cityVal.toLowerCase())) {
                combinedLocation = `${combinedLocation}, ${cityVal}`;
            }
        } else {
            combinedLocation = cityVal;
        }
    }
    
    if (!combinedLocation) combinedLocation = "Location Unspecified";

    const budgetText = lead.budgetMax ? `₹${formatAmount(lead.budgetMax)}` : (lead.budgetMin ? `₹${formatAmount(lead.budgetMin)}` : null);
    
    // Support both single ID and array of IDs for lookups (Lead model uses arrays for these)
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
            <TouchableOpacity 
                style={[styles.swipeBtn, { backgroundColor: theme.primary }]} 
                onPress={() => trackCall(lead.mobile || "", lead._id, "Lead", name)}
            >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.swipeBtn, { backgroundColor: '#25D366' }]} 
                onPress={() => handleWhatsApp(lead.mobile || "")}
            >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Chat</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.swipeActions}>
            <TouchableOpacity 
                style={[styles.swipeBtn, { backgroundColor: '#3B82F6' }]} 
                onPress={() => handleSMS(lead.mobile || "")}
            >
                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.swipeBtn, { backgroundColor: '#F59E0B' }]} 
                onPress={() => handleEmail(lead.email || "")}
            >
                <Ionicons name="mail" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Email</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.cardInner}>
                    <View style={{ alignItems: 'center', width: 55, gap: 6 }}>
                        <LeadScoreRing score={scoreVal} color={scoreColor} />
                        <View style={[styles.ownerBadge, { backgroundColor: stageCfg.color + '15', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, width: '100%', justifyContent: 'center' }]}>
                            <Text style={[styles.ownerText, { color: stageCfg.color, fontSize: 8, fontWeight: '900' }]}>{stageLabel.toUpperCase()}</Text>
                        </View>
                    </View>
                    <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {lead.source && (
                                    <View style={{ 
                                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9', 
                                        paddingHorizontal: 6, 
                                        paddingVertical: 2, 
                                        borderRadius: 4, 
                                        borderWidth: 1, 
                                        borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#e2e8f0' 
                                    }}>
                                        <Text style={{ fontSize: 9, color: isDarkMode ? '#cbd5e1' : '#64748b', fontWeight: '900' }}>{String(getLookupValue("Source", lead.source)).toUpperCase()}</Text>
                                    </View>
                                )}
                                <TouchableOpacity onPress={onMore} style={styles.moreBtn}><Ionicons name="ellipsis-vertical" size={18} color={theme.textMuted} /></TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.metaRow}>
                            <Ionicons name="call-outline" size={12} color={theme.textMuted} />
                            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginLeft: 4 }}>{String(lead.mobile)}</Text>
                            {budgetText && (
                                <>
                                    <Text style={{ color: theme.textMuted, marginHorizontal: 6 }}>|</Text>
                                    <Ionicons name="pricetag-outline" size={12} color="#10B981" />
                                    <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '800', marginLeft: 4 }}>{budgetText}</Text>
                                </>
                            )}
                        </View>
                        <View style={styles.requirementRow}>
                            {sizeTypeText ? (
                                <View style={[styles.sizeBadge, { backgroundColor: theme.primary + '10' }]}>
                                    <Text style={[styles.sizeText, { color: theme.primary }]}>{sizeTypeText}</Text>
                                </View>
                            ) : null}
                            <Text style={{ fontSize: 11, color: theme.textMuted, marginLeft: sizeTypeText ? 8 : 0 }} numberOfLines={1}>{categoryText}</Text>
                        </View>
                        <View style={styles.footerRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <Ionicons name="location-outline" size={10} color={theme.textMuted} />
                                <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '700', marginLeft: 4, flex: 1 }} numberOfLines={1}>{combinedLocation}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <Text style={[styles.ownerText, { color: theme.primary, fontWeight: '700', marginRight: 8 }]}>{resolveName(lead.owner, getLookupValue, findUser)}</Text>
                                <Text style={[styles.timeText, { color: '#64748B', fontSize: 10, fontWeight: '600' }]}>{formatTimeAgo(lead.createdAt)}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
});

export default function LeadsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();
    const { getLookupsByType } = useLookup();
    const { users } = useUsers();
    const { projects } = useProjects();
    
    const allStagesFromDB = useMemo(() => getLookupsByType("Stage"), [getLookupsByType]);

    const stages = useMemo(() => {
        // Map STAGE_ORDER labels to their actual DB IDs for fast backend lookups
        return STAGE_ORDER.map(label => {
            const match = allStagesFromDB.find(s => String(s.lookup_value).toLowerCase() === label.toLowerCase());
            return {
                id: match?._id || label.toLowerCase(),
                label: label,
                isFolder: label === 'Closed'
            };
        });
    }, [allStagesFromDB]);

    const [isClosedDropdownOpen, setIsClosedDropdownOpen] = useState(false);
    const [dropdownAnchor, setDropdownAnchor] = useState({ x: 0, y: 0 });
    
    const [leads, setLeads] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({ total: 0, hot: 0, today: 0, fresh: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [liveScores, setLiveScores] = useState<any>({});
    const [selectedLead, setSelectedLead] = useState<any | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [advFilters, setAdvFilters] = useState<any>({});
    const [sortVisible, setSortVisible] = useState(false);
    const [sortConfig, setSortConfig] = useState({ by: 'createdAt', order: -1, label: 'Newest First' });
    const sectionListRef = useRef<any>(null);

    const fetchLeads = useCallback(async (pageNum = 1, shouldAppend = false, isRefresh = false) => {
        if (!isAuthenticated) return;
        if (!shouldAppend && !isRefresh) setLoading(true);
        if (isRefresh) setRefreshing(true);
        const limit = 50;
        const params: any = { 
            page: String(pageNum), 
            limit: String(limit), 
            sortBy: sortConfig.by,
            sortOrder: String(sortConfig.order),
            ...advFilters 
        };
        if (search) params.search = search;
        if (activeTab !== "all") params.stage = activeTab;

        const result = await safeApiCall<any>(() => getLeads(params));
        
        if (!result.error && result.data) {
            const newRecords = result.data;
            setLeads(prev => shouldAppend ? [...prev, ...newRecords] : newRecords);
            setHasMore(newRecords.length >= limit);
            setPage(pageNum);
            if (result.stats) setStats(result.stats);
        } else if (result.error) {
            console.warn(`[LeadsView] Fetch failed:`, result.error);
            if (!shouldAppend) {
                Alert.alert("Network Error", result.error);
            }
        }
        setLoading(false);
        setRefreshing(false);
    }, [isAuthenticated, activeTab, search, advFilters]);

    useEffect(() => {
        const timer = setTimeout(() => fetchLeads(1, false), 300);
        return () => clearTimeout(timer);
    }, [search, activeTab, advFilters, sortConfig]);

    const loadMore = () => { if (!loading && hasMore) fetchLeads(page + 1, true); };

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: theme.card }]}>
            <View style={styles.headerTop}>
                <View><Text style={[styles.headerTitle, { color: theme.text }]}>SALES PIPELINE</Text><Text style={[styles.headerSub, { color: theme.textMuted }]}>{stats.total} Total Records</Text></View>
                <TouchableOpacity onPress={() => router.push("/add-lead")}><Ionicons name="add-circle" size={32} color={theme.primary} /></TouchableOpacity>
            </View>
            <View style={styles.kpiRow}>
                <KPIItem label="Hot" value={stats.hot} color="#EF4444" icon="flame" theme={theme} />
                <KPIItem label="Today" value={stats.today} color="#10B981" icon="calendar" theme={theme} />
                <KPIItem label="Fresh" value={stats.fresh} color="#8B5CF6" icon="leaf" theme={theme} />
            </View>
            <View style={styles.searchBarRow}>
                <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Ionicons name="search" size={18} color={theme.textMuted} />
                    <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="Search leads..." placeholderTextColor={theme.textMuted} value={search} onChangeText={setSearch} />
                    
                    <TouchableOpacity onPress={() => setSortVisible(true)} style={[styles.filterBtn, { marginRight: 8 }]}>
                        <Ionicons name="swap-vertical" size={18} color={theme.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setFilterVisible(true)} style={[styles.filterBtn, Object.keys(advFilters).length > 0 && { backgroundColor: theme.primary }]}>
                        <Ionicons name="options" size={18} color={Object.keys(advFilters).length > 0 ? "#fff" : theme.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                <TouchableOpacity 
                    onPress={() => setActiveTab("all")} 
                    style={[
                        styles.arrowTab, 
                        { backgroundColor: activeTab === "all" ? theme.primary : theme.card, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, paddingLeft: 16 },
                        activeTab === "all" && styles.activeArrowTab
                    ]}
                >
                    <Text style={[styles.tabText, { color: activeTab === "all" ? "#fff" : theme.textSecondary }]}>ALL</Text>
                    <View style={[styles.arrowRight, { borderLeftColor: activeTab === "all" ? theme.primary : theme.card }]} />
                </TouchableOpacity>

                {stages.map((s, idx) => {
                    const isActive = activeTab === s.id;
                    const isLast = idx === stages.length - 1;
                    const cfg = STAGE_CONFIG[s.label] || STAGE_CONFIG.default;
                    
                    return (
                        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity 
                                onPress={(e) => {
                                    if (s.isFolder) {
                                        // Capture position for dropdown
                                        setIsClosedDropdownOpen(!isClosedDropdownOpen);
                                    } else {
                                        setActiveTab(s.id);
                                        setIsClosedDropdownOpen(false);
                                    }
                                }} 
                                style={[
                                    styles.arrowTab, 
                                    { backgroundColor: isActive ? cfg.color : theme.card, paddingLeft: 20 },
                                    isActive && styles.activeArrowTab,
                                    isLast && { borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingRight: 16 }
                                ]}
                            >
                                <View style={[styles.arrowLeft, { borderLeftColor: theme.background }]} />
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={[styles.tabText, { color: isActive ? "#fff" : theme.textSecondary }]}>{s.label.toUpperCase()}</Text>
                                    {s.isFolder && <Ionicons name={isClosedDropdownOpen ? "chevron-up" : "chevron-down"} size={10} color={isActive ? "#fff" : theme.textMuted} />}
                                </View>
                                {!isLast && <View style={[styles.arrowRight, { borderLeftColor: isActive ? cfg.color : theme.card }]} />}
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </ScrollView>

            {/* ROBUST MODAL DROPDOWN FOR CLOSED STAGES */}
            <Modal visible={isClosedDropdownOpen} transparent animationType="fade" onRequestClose={() => setIsClosedDropdownOpen(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setIsClosedDropdownOpen(false)}>
                    <View style={[styles.closedDropdownModal, { backgroundColor: theme.card, borderColor: theme.border, top: insets.top + 160 }]}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: theme.textMuted, marginBottom: 12, paddingHorizontal: 12 }}>SELECT OUTCOME</Text>
                        {CLOSED_SUB_STAGES.map(sub => {
                            const dbLabel = STAGE_VALUE_MAP[sub] || sub;
                            const dbMatch = allStagesFromDB.find(s => String(s.lookup_value).toLowerCase() === dbLabel.toLowerCase());
                            const subId = dbMatch?._id || sub.toLowerCase();
                            const isCurrent = activeTab === subId;
                            
                            return (
                                <TouchableOpacity 
                                    key={sub} 
                                    style={[styles.dropdownItem, isCurrent && { backgroundColor: theme.primary + '10' }]}
                                    onPress={() => {
                                        setActiveTab(subId);
                                        setIsClosedDropdownOpen(false);
                                    }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: isCurrent ? theme.primary : theme.textSecondary }}>{sub.toUpperCase()}</Text>
                                    {isCurrent && <Ionicons name="checkmark" size={14} color={theme.primary} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Pressable>
            </Modal>
            <Modal visible={sortVisible} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setSortVisible(false)}>
                    <View style={[styles.sheetContainer, { backgroundColor: theme.card }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: theme.text, textAlign: 'center', flex: 1 }]}>SORT LEADS</Text>
                        </View>
                        <View style={{ padding: 20, gap: 10 }}>
                            {[
                                { label: 'Newest First', by: 'createdAt', order: -1, icon: 'time-outline' },
                                { label: 'Oldest First', by: 'createdAt', order: 1, icon: 'hourglass-outline' },
                                { label: 'Alphabetical', by: 'firstName', order: 1, icon: 'text-outline' },
                                { label: 'Last Activity', by: 'updatedAt', order: -1, icon: 'flash-outline' },
                                { label: 'High Intent Score', by: 'intent_index', order: -1, icon: 'trending-up-outline' },
                            ].map((opt: any) => (
                                <TouchableOpacity 
                                    key={opt.label}
                                    onPress={() => {
                                        setSortConfig(opt);
                                        setSortVisible(false);
                                    }}
                                    style={[
                                        styles.sortItem, 
                                        sortConfig.label === opt.label && { backgroundColor: theme.primary + '15', borderColor: theme.primary }
                                    ]}
                                >
                                    <Ionicons name={opt.icon as any} size={20} color={sortConfig.label === opt.label ? theme.primary : theme.textMuted} />
                                    <Text style={{ flex: 1, color: sortConfig.label === opt.label ? theme.primary : theme.text, fontWeight: '700' }}>{opt.label}</Text>
                                    {sortConfig.label === opt.label && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );

    const sections = useMemo(() => {
        const q = search.toLowerCase();
        let filtered = leads.filter((item) => {
            const name = leadName(item).toLowerCase();
            const phone = String(item.mobile || "").toLowerCase();
            const matchesSearch = name.includes(q) || phone.includes(q);
            return matchesSearch;
        });

        // Group by first letter for Alphabetical sort or "All" tab
        const groups: Record<string, any[]> = {};
        filtered.forEach(item => {
            const name = leadName(item);
            let firstChar = name.charAt(0).toUpperCase();
            if (!/[A-Z]/.test(firstChar)) firstChar = "#";
            if (!groups[firstChar]) groups[firstChar] = [];
            groups[firstChar].push(item);
        });

        return Object.keys(groups)
            .sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
            .map(letter => ({
                title: letter,
                data: groups[letter]
            }));
    }, [leads, search]);

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

    const scrollToIndex = (letter: string) => {
        const index = sections.findIndex(s => s.title === letter);
        if (index !== -1) {
            sectionListRef.current?.scrollToLocation({
                sectionIndex: index,
                itemIndex: 0,
                animated: true
            });
            Vibration.vibrate(10);
        }
    };

    const renderAlphabetIndex = () => (
        <View style={styles.alphabetIndex}>
            {alphabet.map((letter) => {
                const hasData = sections.some(s => s.title === letter);
                return (
                    <TouchableOpacity
                        key={letter}
                        onPress={() => scrollToIndex(letter)}
                        style={styles.alphabetLetter}
                        disabled={!hasData}
                    >
                        <Text style={[styles.alphabetText, { color: hasData ? theme.primary : theme.textMuted, opacity: hasData ? 1 : 0.3 }]}>{letter}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <SectionList
                ref={sectionListRef}
                sections={sections}
                keyExtractor={(item) => String(item._id)}
                ListHeaderComponent={renderHeader()}
                renderItem={({ item, index }) => (
                    <View style={{ paddingHorizontal: 16, marginTop: 2 }}>
                        <LeadCard 
                            lead={item} 
                            index={index} 
                            liveScore={liveScores[item._id]} 
                            onPress={() => router.push(`/lead-detail?id=${item._id}`)} 
                            onMore={() => { setSelectedLead(item); setSheetVisible(true); }} 
                            onDeleteSuccess={() => fetchLeads(1, false)} 
                        />
                    </View>
                )}
                renderSectionHeader={({ section: { title } }) => (
                    <View style={[styles.sectionHeader, { backgroundColor: theme.card, borderBottomColor: theme.border, paddingHorizontal: 16, paddingVertical: 4, borderBottomWidth: 1 }]}>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: theme.primary }}>{title}</Text>
                    </View>
                )}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={10}
                removeClippedSubviews={Platform.OS === 'android'}
                ListFooterComponent={hasMore && leads.length > 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={theme.primary} />
                        <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 8 }}>LOADING MORE RECORDS...</Text>
                    </View>
                ) : null}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLeads(1, false, true)} tintColor={theme.primary} />}
                onScrollToIndexFailed={(info) => {
                    console.warn("[Leads] Scroll to index failed, retrying...", info);
                    sectionListRef.current?.scrollToLocation({
                        sectionIndex: info.index,
                        itemIndex: 0,
                        animated: false
                    });
                }}
                ListEmptyComponent={!loading ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Ionicons name="filter-outline" size={48} color={theme.textMuted} />
                        <Text style={{ color: theme.textMuted, marginTop: 12, fontWeight: '600' }}>No leads found for this stage</Text>
                    </View>
                ) : null}
            />
            {renderAlphabetIndex()}
            {loading && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            )}
            <ActionSheet visible={sheetVisible} onClose={() => { setSheetVisible(false); setSelectedLead(null); }} lead={selectedLead} onUpdate={() => fetchLeads(1, false)} statuses={stages} users={users} />
            <AdvancedFilterModal visible={filterVisible} onClose={() => setFilterVisible(false)} filters={advFilters} setFilters={setAdvFilters} users={users} projects={projects} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 16, borderBottomWidth: 1, paddingBottom: 12 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    headerSub: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    kpiItem: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    kpiIcon: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    kpiValue: { fontSize: 16, fontWeight: '800' },
    kpiLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
    searchBarRow: { marginBottom: 12 },
    searchBar: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
    filterBtn: { padding: 8, borderRadius: 8, marginLeft: 8 },
    sortItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', gap: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    tabsScroll: { gap: 8, paddingHorizontal: 2 },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    arrowTab: {
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4,
        position: 'relative',
    },
    activeArrowTab: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    arrowRight: {
        position: 'absolute',
        right: -10,
        top: 0,
        width: 0,
        height: 0,
        borderTopWidth: 18,
        borderBottomWidth: 18,
        borderLeftWidth: 10,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        zIndex: 10,
    },
    arrowLeft: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        borderTopWidth: 18,
        borderBottomWidth: 18,
        borderLeftWidth: 10,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        zIndex: 1,
    },
    closedDropdownModal: {
        position: 'absolute',
        right: 16,
        width: 160,
        borderRadius: 16,
        borderWidth: 1,
        padding: 8,
        zIndex: 1000,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    tabText: { fontSize: 11, fontWeight: '800' },
    card: { padding: 10, borderRadius: 16, borderWidth: 1, marginBottom: 2 },
    cardInner: { flexDirection: 'row', alignItems: 'center' },
    cardContent: { flex: 1, marginLeft: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '800', flex: 1 },
    moreBtn: { padding: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    requirementRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    sizeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    sizeText: { fontSize: 11, fontWeight: '800' },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    ownerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    ownerText: { fontSize: 10, fontWeight: '700' },
    timeText: { fontSize: 10, fontWeight: '600' },
    swipeActions: { flexDirection: 'row', paddingHorizontal: 12 },
    swipeBtn: { width: 60, height: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheetContainer: { padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40, maxHeight: '85%' },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20 },
    sheetTitle: { fontSize: 18, fontWeight: '800' },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 24 },
    actionItem: { width: '21%', alignItems: 'center', gap: 8 },
    actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 11, fontWeight: '700' },
    subSection: { padding: 16, borderRadius: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12 },
    stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stageChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    stageChipText: { fontSize: 10, fontWeight: '800' },
    userChip: { alignItems: 'center', gap: 6, width: 70 },
    userAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    userChipText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
    tagInputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    tagInput: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, fontSize: 14 },
    addTagBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    tagText: { fontSize: 12, fontWeight: '700' },
    filterSection: { marginBottom: 24 },
    filterSectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    filterInput: { height: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: '#e2e8f0' },
    filterFooter: { padding: 20, paddingTop: 10 },
    fieldLabel: { fontSize: 13, fontWeight: '700' },
    applyBtn: { height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    alphabetIndex: {
        position: 'absolute',
        right: 4,
        top: 200,
        bottom: 100,
        justifyContent: 'center',
        alignItems: 'center',
        width: 20,
        zIndex: 100
    },
    alphabetLetter: {
        paddingVertical: 1,
    },
    alphabetText: {
        fontSize: 10,
        fontWeight: '900',
    }
});
