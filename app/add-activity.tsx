import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    Modal,
    FlatList,
    SafeAreaView
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { addActivity } from "./services/activities.service";
import { getLeadById, leadName, getLeads, type Lead } from "./services/leads.service";
import { getDeals, getDealById } from "./services/deals.service";
import { getContacts, getContactById, contactFullName } from "./services/contacts.service";
import { getProjects, type Project } from "./services/projects.service";
import { safeApiCall, safeApiCallSingle, extractList } from "./services/api.helpers";

const TYPES = ["Call", "Meeting", "Site Visit", "Task", "Email"];
const PRIORITIES = ["Low", "Normal", "High"];
const STATUSES = ["Pending", "In Progress", "Completed", "Deferred"];
const CALL_OUTCOMES = ["Connected", "No Answer", "Busy", "Wrong Number", "Switch Off"];
const MEETING_TYPES = ["Office", "On-Site", "Virtual", "Developer Office"];
const VISIT_TYPES = ["Initial Visit", "Second Visit", "Follow-up", "Booking Visit"];

interface RelatedItem {
    id: string;
    name: string;
    type: "Lead" | "Deal" | "Contact";
}

export default function AddActivityScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        id?: string;
        type?: string;
        subject?: string;
        actType?: string;
    }>();

    console.log("[AddActivity] Rendered with params:", params);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Core Form State
    const [formData, setFormData] = useState({
        type: (params.actType || "Call") as any,
        subject: params.subject || "",
        dueDate: new Date().toISOString().split("T")[0],
        dueTime: new Date().toTimeString().slice(0, 5),
        priority: "Normal" as any,
        status: "Pending" as any,
        description: "",
        details: {
            purpose: "",
            duration: "15",
            callOutcome: "",
            meetingType: "Office",
            meetingLocation: "",
            direction: "Outgoing",
            completionResult: "",
            visitedProperties: [] as any[],
            tasks: [{ subject: '', reminder: false, reminderTime: '10:00' }] as any[],
        }
    });

    const [activeTaskPicker, setActiveTaskPicker] = useState<number | null>(null);

    // Related Entity State
    const [selectedEntity, setSelectedEntity] = useState<RelatedItem | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchResults, setSearchResults] = useState<RelatedItem[]>([]);

    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<any[]>([]);
    const [isProjectModalVisible, setIsProjectModalVisible] = useState(false);
    const [isBlockModalVisible, setIsBlockModalVisible] = useState(false);
    const [isUnitModalVisible, setIsUnitModalVisible] = useState(false);
    const [tempProject, setTempProject] = useState<Project | null>(null);
    const [tempBlock, setTempBlock] = useState<string>("");
    const [unitNumbers, setUnitNumbers] = useState<string[]>([]);
    const [fetchingUnits, setFetchingUnits] = useState(false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());

    useEffect(() => {
        init();
    }, []);

    const autoGenerateSubject = useCallback(() => {
        if (!selectedEntity) return;

        let subject = "";
        const formattedDate = new Date(formData.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        switch (formData.type) {
            case "Call":
                subject = `Call with ${selectedEntity.name} on ${formattedDate} @ ${formData.dueTime}`;
                break;
            case "Meeting":
                subject = `${formData.details.meetingType} Meeting with ${selectedEntity.name} (${formattedDate})`;
                break;
            case "Site Visit":
                const propCount = selectedProjects.length;
                const propText = propCount > 0
                    ? `to ${selectedProjects[0].project}${propCount > 1 ? ` & ${propCount - 1} more` : ""}`
                    : "";
                subject = `${formData.details.purpose || "Site Visit"} ${propText} with ${selectedEntity.name}`;
                break;
            default:
                subject = `${formData.type} with ${selectedEntity.name}`;
        }

        setFormData(prev => ({ ...prev, subject }));
    }, [formData.type, formData.dueDate, formData.dueTime, formData.details.purpose, formData.details.meetingType, selectedEntity, selectedProjects]);

    // Update subject when relevant fields change
    useEffect(() => {
        autoGenerateSubject();
    }, [formData.type, formData.dueDate, formData.dueTime, formData.details.purpose, formData.details.meetingType, selectedEntity, selectedProjects]);

    const init = async () => {
        setLoading(true);
        // 1. Fetch Projects if Site Visit might be used
        const projRes = await safeApiCall(() => getProjects());
        if (!projRes.error) {
            setProjects(extractList(projRes.data));
        }

        // 2. Resolve initial entity if passed
        if (params.id && params.type) {
            let name = "Loading...";
            if (params.type === "Lead") {
                const leadRes = await safeApiCallSingle<Lead>(() => getLeadById(params.id!));
                if (!leadRes.error && leadRes.data) name = leadName(leadRes.data);
            } else if (params.type === "Deal") {
                const dealRes = await getDealById(params.id);
                const d = dealRes?.data ?? dealRes;
                if (d) name = d.dealId || [d.projectName, d.unitNo].filter(Boolean).join(" - ") || "Deal";
            } else if (params.type === "Contact") {
                const conRes = await getContactById(params.id);
                if (!conRes.error && conRes.data) name = contactFullName(conRes.data);
            }
            setSelectedEntity({ id: params.id, type: params.type as any, name });
            if (!params.subject) {
                setFormData(prev => ({ ...prev, subject: `${params.actType || "Follow up"} with ${name}` }));
            }
        }
        setLoading(false);
    };

    const handleSearch = async (text: string) => {
        setSearchText(text);
        if (text.length < 2) {
            setSearchResults([]);
            return;
        }

        // Parallel search across entities
        const [l, d, c] = await Promise.all([
            getLeads({ q: text, limit: "5" }),
            getDeals({ q: text, limit: "5" }),
            getContacts({ q: text, limit: "5" })
        ]);

        const results: RelatedItem[] = [
            ...extractList(l).map((i: any) => ({ id: i._id, name: i.firstName + " " + (i.lastName || ""), type: "Lead" as const })),
            ...extractList(d).map((i: any) => ({ id: i._id, name: i.title || i.dealId || "Deal", type: "Deal" as const })),
            ...extractList(c).map((i: any) => ({ id: i._id, name: i.fullName || i.name || "Contact", type: "Contact" as const }))
        ];

        setSearchResults(results);
    };

    const handleSave = async () => {
        console.log("[AddActivity] handleSave pressed. selectedEntity:", selectedEntity, "subject:", formData.subject);
        if (!formData.subject) return Alert.alert("Error", "Please enter a subject");
        if (!selectedEntity) return Alert.alert("Error", "Please select a related entity");

        setSaving(true);
        const payload = {
            ...formData,
            entityId: selectedEntity.id,
            entityType: selectedEntity.type,
            details: {
                ...formData.details,
                visitedProperties: selectedProjects,
                tasks: formData.type === "Task" ? formData.details.tasks : []
            }
        };

        const res = await safeApiCall(() => addActivity(payload));
        setSaving(false);

        if (!res.error) {
            Alert.alert("Success", "Activity logged successfully", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } else {
            Alert.alert("Error", res.error || "Failed to save activity");
        }
    };

    const addTask = () => {
        setFormData((p: any) => ({
            ...p,
            details: {
                ...p.details,
                tasks: [...p.details.tasks, { subject: '', reminder: false, reminderTime: '10:00' }]
            }
        }));
    };

    const removeTask = (index: number) => {
        if (formData.details.tasks.length <= 1) return;
        setFormData((p: any) => ({
            ...p,
            details: {
                ...p.details,
                tasks: p.details.tasks.filter((_: any, i: number) => i !== index)
            }
        }));
    };

    const updateTask = (index: number, field: string, value: any) => {
        const newTasks = [...formData.details.tasks];
        newTasks[index] = { ...newTasks[index], [field]: value };
        setFormData((p: any) => ({
            ...p,
            details: { ...p.details, tasks: newTasks }
        }));
    };



    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Initializing Mission Form...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        console.log("[AddActivity] Back pressed");
                        router.back();
                    }}
                    style={styles.iconBtn}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Ionicons name="chevron-back" size={24} color="#334155" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ultimate Activity Hub</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    {saving ? <ActivityIndicator size="small" color="#2563EB" /> : <Text style={styles.saveBtn}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 1. Entity Connection */}
                <Section title="Related To">
                    <TouchableOpacity style={styles.entitySelector} onPress={() => setIsSearching(true)}>
                        <View style={styles.entityInfo}>
                            <View style={[styles.entityIcon, { backgroundColor: selectedEntity ? "#E0F2FE" : "#F1F5F9" }]}>
                                <Ionicons
                                    name={selectedEntity?.type === "Lead" ? "people" : selectedEntity?.type === "Deal" ? "briefcase" : "person"}
                                    size={20}
                                    color={selectedEntity ? "#0EA5E9" : "#64748B"}
                                />
                            </View>
                            <Text style={[styles.entityText, !selectedEntity && { color: "#94A3B8" }]}>
                                {selectedEntity ? `${selectedEntity.name} (${selectedEntity.type})` : "Select Lead, Deal or Contact"}
                            </Text>
                        </View>
                        <Ionicons name="search" size={20} color="#64748B" />
                    </TouchableOpacity>
                </Section>

                {/* 2. Basic Configuration */}
                <Section title="Task Details">
                    <Text style={styles.label}>Activity Type</Text>
                    <View style={styles.chipGrid}>
                        {TYPES.map(t => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.chip, formData.type === t && styles.activeChip]}
                                onPress={() => setFormData(prev => ({ ...prev, type: t as any }))}
                            >
                                <Text style={[styles.chipText, formData.type === t && styles.activeChipText]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={[styles.label, { marginTop: 16 }]}>Subject</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.subject}
                        onChangeText={t => setFormData(p => ({ ...p, subject: t }))}
                        placeholder="e.g. Schedule Site Visit"
                    />

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.label}>Due Date</Text>
                            <TouchableOpacity style={styles.input} onPress={() => {
                                setPickerDate(new Date(formData.dueDate));
                                setShowDatePicker(true);
                            }}>
                                <Text style={styles.inputText}>{new Date(formData.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.label}>Due Time</Text>
                            <TouchableOpacity style={styles.input} onPress={() => {
                                const [hours, minutes] = formData.dueTime.split(':');
                                const d = new Date();
                                d.setHours(parseInt(hours), parseInt(minutes));
                                setPickerDate(d);
                                setShowTimePicker(true);
                            }}>
                                <Text style={styles.inputText}>{formData.dueTime}</Text>
                                <Ionicons name="time-outline" size={18} color="#2563EB" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </Section>

                {/* 3. Dynamic Type-Specific Section */}
                {formData.type === "Call" && (
                    <Section title="Call Logistics">
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.label}>Direction</Text>
                                <View style={styles.toggleRow}>
                                    {["Outgoing", "Incoming"].map(d => (
                                        <TouchableOpacity
                                            key={d}
                                            style={[styles.toggleBtn, formData.details.direction === d && styles.activeToggle]}
                                            onPress={() => setFormData(p => ({ ...p, details: { ...p.details, direction: d } }))}
                                        >
                                            <Text style={[styles.toggleText, formData.details.direction === d && styles.activeToggleText]}>{d}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.label}>Priority</Text>
                                <View style={styles.toggleRow}>
                                    {PRIORITIES.map(pr => (
                                        <TouchableOpacity
                                            key={pr}
                                            style={[styles.toggleBtn, formData.priority === pr && styles.activeToggle]}
                                            onPress={() => setFormData(p => ({ ...p, priority: pr as any }))}
                                        >
                                            <Text style={[styles.toggleText, formData.priority === pr && styles.activeToggleText]}>{pr[0]}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </Section>
                )}

                {formData.type === "Meeting" && (
                    <Section title="Meeting Workspace">
                        <Text style={styles.label}>Meeting Type</Text>
                        <View style={styles.chipGrid}>
                            {MEETING_TYPES.map(mt => (
                                <TouchableOpacity
                                    key={mt}
                                    style={[styles.chip, formData.details.meetingType === mt && styles.activeChip]}
                                    onPress={() => setFormData(prev => ({ ...prev, details: { ...prev.details, meetingType: mt } }))}
                                >
                                    <Text style={[styles.chipText, formData.details.meetingType === mt && styles.activeChipText]}>{mt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={[styles.label, { marginTop: 16 }]}>
                            {formData.details.meetingType === "Virtual" ? "Meeting Link" : "Location"}
                        </Text>
                        <TextInput
                            style={styles.input}
                            value={formData.details.meetingLocation}
                            onChangeText={t => setFormData(p => ({ ...p, details: { ...p.details, meetingLocation: t } }))}
                            placeholder={formData.details.meetingType === "Virtual" ? "Zoom/Meet Link" : "Office Address"}
                        />
                    </Section>
                )}

                {formData.type === "Site Visit" && (
                    <Section title="Properties to Visit">
                        <Text style={styles.label}>Project Selections</Text>
                        <View style={styles.projectGrid}>
                            {selectedProjects.map((sp, idx) => (
                                <View key={idx} style={styles.selectedProjectBadge}>
                                    <View>
                                        <Text style={styles.badgeLabel}>{sp.project}</Text>
                                        <Text style={styles.badgeSubLabel}>{sp.block || "General"} - {sp.unitNo || "No Unit"}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedProjects(p => p.filter((_, i) => i !== idx))}>
                                        <Ionicons name="close-circle" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addProjectBtn} onPress={() => setIsProjectModalVisible(true)}>
                                <Ionicons name="add" size={20} color="#2563EB" />
                                <Text style={styles.addProjectText}>Add Property</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { marginTop: 16 }]}>Visit Type</Text>
                        <View style={styles.chipGrid}>
                            {VISIT_TYPES.map(vt => (
                                <TouchableOpacity
                                    key={vt}
                                    style={[styles.chip, formData.details.purpose === vt && styles.activeChip]}
                                    onPress={() => setFormData(prev => ({ ...prev, details: { ...prev.details, purpose: vt } }))}
                                >
                                    <Text style={[styles.chipText, formData.details.purpose === vt && styles.activeChipText]}>{vt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Section>
                )}

                {formData.type === "Task" && (
                    <Section title="Task Details & Reminders">
                        {formData.details.tasks.map((task: any, index: number) => (
                            <View key={index} style={[styles.taskItem, index > 0 && styles.taskItemDivider]}>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Specific Work / Task Item {index + 1}</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity onPress={addTask} style={styles.taskActionBtn}>
                                            <Ionicons name="add" size={18} color="#2563EB" />
                                        </TouchableOpacity>
                                        {formData.details.tasks.length > 1 && (
                                            <TouchableOpacity onPress={() => removeTask(index)} style={[styles.taskActionBtn, { backgroundColor: '#FEE2E2' }]}>
                                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={task.subject}
                                    onChangeText={t => updateTask(index, 'subject', t)}
                                    placeholder="Describe the specific work to be done..."
                                />

                                <View style={[styles.row, { marginTop: 12, justifyContent: 'flex-start', gap: 16 }]}>
                                    <TouchableOpacity
                                        style={styles.reminderToggle}
                                        onPress={() => updateTask(index, 'reminder', !task.reminder)}
                                    >
                                        <View style={[styles.checkbox, task.reminder && styles.checkboxActive]}>
                                            {task.reminder && <Ionicons name="checkmark" size={12} color="#FFF" />}
                                        </View>
                                        <Text style={styles.reminderText}>Enable Reminder</Text>
                                    </TouchableOpacity>

                                    {task.reminder && (
                                        <TouchableOpacity
                                            style={styles.timePickerBtn}
                                            onPress={() => {
                                                const [h, m] = task.reminderTime.split(':');
                                                const d = new Date();
                                                d.setHours(parseInt(h), parseInt(m));
                                                setPickerDate(d);
                                                setActiveTaskPicker(index);
                                                setShowTimePicker(true);
                                            }}
                                        >
                                            <Text style={styles.timePickerText}>at {task.reminderTime}</Text>
                                            <Ionicons name="time-outline" size={14} color="#7C3AED" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                    </Section>
                )}

                {/* 4. Completion & Execution */}
                <Section title="Progress Control">
                    <Text style={styles.label}>Status</Text>
                    <View style={styles.row}>
                        {STATUSES.map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[styles.statusBtn, formData.status === s && { backgroundColor: "#2563EB", borderColor: "#2563EB" }]}
                                onPress={() => setFormData(p => ({ ...p, status: s }))}
                            >
                                <Text style={[styles.statusBtnText, formData.status === s && { color: "#fff" }]}>{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {formData.status === "Completed" && (
                        <View style={{ marginTop: 16 }}>
                            {formData.type === "Call" && (
                                <>
                                    <Text style={styles.label}>Call Outcome</Text>
                                    <View style={styles.chipGrid}>
                                        {CALL_OUTCOMES.map(co => (
                                            <TouchableOpacity
                                                key={co}
                                                style={[styles.smallChip, formData.details.callOutcome === co && styles.activeChip]}
                                                onPress={() => setFormData(p => ({ ...p, details: { ...p.details, callOutcome: co } }))}
                                            >
                                                <Text style={[styles.smallChipText, formData.details.callOutcome === co && styles.activeChipText]}>{co}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                            <Text style={[styles.label, { marginTop: 12 }]}>Final Result / Remarks</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                                multiline
                                value={formData.details.completionResult}
                                onChangeText={t => setFormData(p => ({ ...p, details: { ...p.details, completionResult: t } }))}
                                placeholder="What was the result of this mission?"
                            />
                        </View>
                    )}
                </Section>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Entity Search Modal */}
            <Modal visible={isSearching} animationType="slide">
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={20} color="#64748B" />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search Leads, Deals, Contacts..."
                                value={searchText}
                                onChangeText={handleSearch}
                                autoFocus
                            />
                            {searchText.length > 0 && (
                                <TouchableOpacity onPress={() => handleSearch("")}>
                                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => setIsSearching(false)}>
                            <Text style={styles.cancelBtn}>Cancel</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={searchResults}
                        keyExtractor={item => `${item.type}-${item.id}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.resultRow}
                                onPress={() => {
                                    setSelectedEntity(item);
                                    setIsSearching(false);
                                    setFormData(p => ({ ...p, subject: `${p.type || "Activity"} with ${item.name}` }));
                                }}
                            >
                                <View style={[styles.resultIcon, { backgroundColor: item.type === "Lead" ? "#DBEAFE" : item.type === "Deal" ? "#FCE7F3" : "#ECFDF5" }]}>
                                    <Ionicons
                                        name={item.type === "Lead" ? "people" : item.type === "Deal" ? "briefcase" : "person"}
                                        size={18}
                                        color={item.type === "Lead" ? "#2563EB" : item.type === "Deal" ? "#DB2777" : "#059669"}
                                    />
                                </View>
                                <View>
                                    <Text style={styles.resultName}>{item.name}</Text>
                                    <Text style={styles.resultType}>{item.type}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyResults}>
                                <Text style={styles.emptyResultsText}>
                                    {searchText.length < 2 ? "Type at least 2 characters..." : "No matches found."}
                                </Text>
                            </View>
                        )}
                    />
                </View>
            </Modal>

            {/* Project Selection Modal */}
            <Modal visible={isProjectModalVisible} animationType="fade" transparent>
                <View style={styles.centeredModal}>
                    <View style={styles.pickerCard}>
                        <Text style={styles.pickerTitle}>Select Project</Text>
                        <FlatList
                            data={projects}
                            keyExtractor={i => i._id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.pickerRow}
                                    onPress={() => {
                                        setTempProject(item);
                                        setIsProjectModalVisible(false);
                                        setIsBlockModalVisible(true);
                                    }}
                                >
                                    <Text style={styles.pickerText}>{item.name}</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.pickerClose} onPress={() => setIsProjectModalVisible(false)}>
                            <Text style={styles.pickerCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Block Selection Modal */}
            <Modal visible={isBlockModalVisible} animationType="fade" transparent>
                <View style={styles.centeredModal}>
                    <View style={styles.pickerCard}>
                        <Text style={styles.pickerTitle}>Select Block in {tempProject?.name}</Text>
                        <FlatList
                            data={tempProject?.blocks || []}
                            keyExtractor={(i, index) => index.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.pickerRow}
                                    onPress={async () => {
                                        setTempBlock(item.name);
                                        setIsBlockModalVisible(false);

                                        // Fetch Units from Deals
                                        setFetchingUnits(true);
                                        setIsUnitModalVisible(true);
                                        const dealRes = await safeApiCall(() => getDeals({ projectName: tempProject?.name || "", block: item.name }));
                                        const deals = extractList(dealRes.data);
                                        // Filter units that actually exist in deals
                                        const units = Array.from(new Set(deals.map((d: any) => d.unitNo).filter(Boolean))) as string[];
                                        setUnitNumbers(units);
                                        setFetchingUnits(false);
                                    }}
                                >
                                    <Text style={styles.pickerText}>{item.name}</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={() => (
                                <TouchableOpacity
                                    style={styles.pickerRow}
                                    onPress={async () => {
                                        setTempBlock("General");
                                        setIsBlockModalVisible(false);

                                        setFetchingUnits(true);
                                        setIsUnitModalVisible(true);
                                        const dealRes = await safeApiCall(() => getDeals({ projectName: tempProject?.name || "", block: "General" }));
                                        const deals = extractList(dealRes.data);
                                        const units = Array.from(new Set(deals.map((d: any) => d.unitNo).filter(Boolean))) as string[];
                                        setUnitNumbers(units);
                                        setFetchingUnits(false);
                                    }}
                                >
                                    <Text style={styles.pickerText}>General / No Block</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.pickerClose} onPress={() => setIsBlockModalVisible(false)}>
                            <Text style={styles.pickerCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Unit Selection Modal */}
            <Modal visible={isUnitModalVisible} animationType="fade" transparent>
                <View style={styles.centeredModal}>
                    <View style={styles.pickerCard}>
                        <Text style={styles.pickerTitle}>Select Unit in {tempBlock}</Text>
                        {fetchingUnits ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color="#2563EB" />
                                <Text style={{ marginTop: 10, color: '#64748B', fontWeight: '600' }}>Checking Available Deals...</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={unitNumbers}
                                keyExtractor={(i, index) => index.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.pickerRow}
                                        onPress={() => {
                                            setSelectedProjects(p => [...p, { project: tempProject?.name, block: tempBlock, unitNo: item }]);
                                            setIsUnitModalVisible(false);
                                        }}
                                    >
                                        <Text style={styles.pickerText}>Unit {item}</Text>
                                        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={() => (
                                    <View style={{ padding: 20, alignItems: 'center' }}>
                                        <Text style={{ color: '#94A3B8', fontWeight: '700', textAlign: 'center', marginBottom: 20 }}>
                                            No active deals found for Units in this block.
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.statusBtn, { width: '100%', backgroundColor: '#F1F5F9' }]}
                                            onPress={() => {
                                                setSelectedProjects(p => [...p, { project: tempProject?.name, block: tempBlock, unitNo: "Custom" }]);
                                                setIsUnitModalVisible(false);
                                            }}
                                        >
                                            <Text style={styles.statusBtnText}>+ Add Custom Unit</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        )}
                        <TouchableOpacity style={styles.pickerClose} onPress={() => setIsUnitModalVisible(false)}>
                            <Text style={styles.pickerCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {showDatePicker && (
                <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (event.type === 'set' && date) {
                            const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            setFormData(p => ({ ...p, dueDate: localDate }));
                        }
                    }}
                />
            )}

            {showTimePicker && (
                <DateTimePicker
                    value={pickerDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowTimePicker(false);
                        if (event.type === 'set' && date) {
                            const localTime = date.toTimeString().slice(0, 5);
                            if (activeTaskPicker !== null) {
                                updateTask(activeTaskPicker, 'reminderTime', localTime);
                                setActiveTaskPicker(null);
                            } else {
                                setFormData(p => ({ ...p, dueTime: localTime }));
                            }
                        } else {
                            setActiveTaskPicker(null);
                        }
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <View style={styles.sectionCard}>{children}</View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
    loadingText: { marginTop: 12, color: "#64748B", fontWeight: "600" },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
        backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9"
    },
    iconBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", letterSpacing: -0.5 },
    saveBtn: { color: "#2563EB", fontWeight: "800", fontSize: 16 },
    taskItem: {
        marginBottom: 16,
    },
    taskItemDivider: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 16,
    },
    taskActionBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reminderToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        backgroundColor: '#7C3AED',
    },
    reminderText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4C1D95',
    },
    timePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    timePickerText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#7C3AED',
    },
    content: { flex: 1, padding: 16 },
    section: { marginBottom: 20 },
    sectionLabel: { fontSize: 11, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, paddingLeft: 4 },
    sectionCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#F1F5F9" },
    label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
    input: {
        backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
        borderRadius: 16, padding: 14, fontSize: 15, color: "#1E293B",
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12
    },
    inputText: { fontSize: 15, color: "#1E293B", fontWeight: "600" },
    row: { flexDirection: "row", gap: 10 },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
        backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0"
    },
    activeChip: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    chipText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
    activeChipText: { color: "#fff" },
    entitySelector: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#F8FAFC", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0"
    },
    entityInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    entityIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    entityText: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
    toggleRow: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4, gap: 4 },
    toggleBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
    activeToggle: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2 },
    toggleText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
    activeToggleText: { color: "#1E293B" },
    statusBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
    statusBtnText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
    smallChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" },
    smallChipText: { fontSize: 11, fontWeight: "600", color: "#64748B" },
    modalContainer: { flex: 1, backgroundColor: "#fff" },
    modalHeader: {
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9"
    },
    searchBar: {
        flex: 1, flexDirection: "row", alignItems: "center",
        backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 12, gap: 8
    },
    modalSearchInput: { flex: 1, height: 44, fontSize: 15, color: "#1E293B" },
    cancelBtn: { color: "#64748B", fontWeight: "700" },
    resultRow: {
        flexDirection: "row", alignItems: "center", gap: 14,
        padding: 16, borderBottomWidth: 1, borderBottomColor: "#F8FAFC"
    },
    resultIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    resultName: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
    resultType: { fontSize: 12, color: "#64748B", fontWeight: "600" },
    emptyResults: { padding: 40, alignItems: "center" },
    emptyResultsText: { color: "#94A3B8", fontWeight: "600" },
    projectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
    selectedProjectBadge: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: "#FECACA"
    },
    badgeLabel: { fontSize: 12, fontWeight: "700", color: "#B91C1C" },
    addProjectBtn: {
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderStyle: "dashed", borderWidth: 1, borderColor: "#2563EB"
    },
    addProjectText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
    centeredModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 20 },
    pickerCard: { backgroundColor: "#fff", borderRadius: 24, width: "100%", maxHeight: "60%", padding: 24 },
    pickerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", marginBottom: 16 },
    pickerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    pickerText: { fontSize: 15, fontWeight: "600", color: "#334155" },
    pickerClose: { marginTop: 16, alignItems: "center", padding: 12 },
    pickerCloseText: { color: "#2563EB", fontWeight: "700" },
    badgeSubLabel: { fontSize: 10, color: "#EF4444", fontWeight: "600" }
});
