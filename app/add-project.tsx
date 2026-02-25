import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, Switch, ActivityIndicator, KeyboardAvoidingView,
    Platform, SafeAreaView, Animated, Pressable, Modal, FlatList
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { createProject, type Project, type ProjectBlock } from "./services/projects.service";
import { getLookups, type Lookup } from "./services/lookups.service";
import { getTeams } from "./services/teams.service";
import { getCompanies } from "./services/companies.service";
import api from "./services/api";
import { safeApiCall, lookupVal } from "./services/api.helpers";
import { useTheme, SPACING } from "./context/ThemeContext";

// ─── Reusable Components ──────────────────────────────────────────────────────

function SectionHeader({ title, icon, subtitle }: { title: string; icon: string; subtitle?: string }) {
    const { theme } = useTheme();
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: theme.primary + '10' }]}>
                    <Text style={styles.sectionIconText}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{title}</Text>
                    {subtitle && <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
                </View>
            </View>
            <View style={[styles.sectionSeparator, { backgroundColor: theme.border }]} />
        </View>
    );
}

function Field({ label, required, children, helperText }: { label?: string; required?: boolean; children: React.ReactNode; helperText?: string }) {
    const { theme } = useTheme();
    return (
        <View style={styles.field}>
            {label && (
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    {label}
                    {required && <Text style={{ color: theme.error }}> *</Text>}
                </Text>
            )}
            {children}
            {helperText && <Text style={[styles.helperText, { color: theme.textMuted }]}>{helperText}</Text>}
        </View>
    );
}

function Input({
    value, onChangeText, placeholder, keyboardType, multiline, numberOfLines, editable = true, label, icon
}: {
    value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean; numberOfLines?: number; editable?: boolean; label?: string; icon?: string;
}) {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(labelAnim, {
            toValue: (isFocused || value) ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [isFocused, value]);

    const labelStyle = {
        position: 'absolute' as const,
        left: 16,
        top: labelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [18, -10],
        }),
        fontSize: labelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [15, 12],
        }),
        color: labelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.textMuted, theme.primary],
        }),
        backgroundColor: theme.cardBg,
        paddingHorizontal: 4,
        zIndex: 1,
    };

    return (
        <View style={[
            styles.inputWrapper,
            { backgroundColor: theme.inputBg, borderColor: theme.border },
            isFocused && { borderColor: theme.primary, backgroundColor: theme.cardBg },
            !editable && { opacity: 0.6, backgroundColor: theme.border },
            multiline && { height: 'auto', minHeight: 100 }
        ]}>
            {label && <Animated.Text style={labelStyle}>{label}</Animated.Text>}
            <View style={styles.inputInner}>
                {icon && <Ionicons name={icon as any} size={18} color={isFocused ? theme.primary : theme.textMuted} style={styles.inputIcon} />}
                <TextInput
                    style={[
                        styles.input,
                        { color: theme.textPrimary },
                        multiline && { height: 100, textAlignVertical: 'top', paddingTop: 16 }
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={isFocused ? "" : placeholder}
                    placeholderTextColor={theme.textMuted}
                    keyboardType={keyboardType}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                    editable={editable}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
            </View>
        </View>
    );
}

function PressableChip({
    label, isSelected, onSelect, icon
}: {
    label: string, isSelected: boolean, onSelect: () => void, icon?: string
}) {
    const { theme } = useTheme();
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    return (
        <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={onSelect}
        >
            <Animated.View style={[
                styles.selectableChip,
                { borderColor: theme.border, backgroundColor: theme.cardBg },
                isSelected && { backgroundColor: theme.primary + '08', borderColor: theme.primary },
                { transform: [{ scale }] }
            ]}>
                {icon && <Ionicons name={icon as any} size={16} color={isSelected ? theme.primary : theme.textSecondary} style={{ marginRight: 6 }} />}
                <Text style={[styles.selectableChipText, { color: theme.textSecondary }, isSelected && { color: theme.primary }]}>{label}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={{ marginLeft: 6 }} />}
            </Animated.View>
        </Pressable>
    );
}

function SelectButton({
    value, options, onSelect, multiple = false
}: {
    value: string | string[]; options: { label: string, value: string }[]; onSelect: (v: any) => void; multiple?: boolean;
}) {
    const { theme } = useTheme();
    if (options.length === 0) return <Text style={{ color: theme.textSecondary, fontSize: 13, padding: 8 }}>No options available</Text>;

    const isSelected = (val: string) => {
        if (multiple && Array.isArray(value)) return value.includes(val);
        return value === val;
    };

    const handleSelect = (val: string) => {
        if (multiple && Array.isArray(value)) {
            if (value.includes(val)) onSelect(value.filter(v => v !== val));
            else onSelect([...value, val]);
        } else {
            onSelect(val === value ? "" : val);
        }
    };

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {options.map((opt, idx) => (
                <PressableChip
                    key={`${opt.value || idx}-${idx}`}
                    label={opt.label}
                    isSelected={isSelected(opt.value)}
                    onSelect={() => handleSelect(opt.value)}
                />
            ))}
        </ScrollView>
    );
}

function ModernPicker({
    label, value, options, onSelect, placeholder = "Select..."
}: {
    label: string; value: string; options: { label: string, value: string }[]; onSelect: (v: string) => void; placeholder?: string;
}) {
    const { theme } = useTheme();
    const [visible, setVisible] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <>
            <TouchableOpacity
                style={[styles.pickerTrigger, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                onPress={() => setVisible(true)}
            >
                <Text style={[styles.fieldLabel, { marginBottom: 0, color: theme.textMuted, fontSize: 12 }]}>{label}</Text>
                <View style={styles.pickerValueRow}>
                    <Text style={[styles.pickerValue, { color: value ? theme.textPrimary : theme.textMuted }]}>{selectedLabel}</Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
                </View>
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{label}</Text>
                            <TouchableOpacity onPress={() => setVisible(false)}><Ionicons name="close" size={24} color={theme.textPrimary} /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={options}
                            keyExtractor={item => item.value}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.optionItem, { borderBottomColor: theme.border + '50' }]}
                                    onPress={() => { onSelect(item.value); setVisible(false); }}
                                >
                                    <Text style={[styles.optionLabel, { color: theme.textPrimary }, value === item.value && { color: theme.primary, fontWeight: '700' }]}>{item.label}</Text>
                                    {value === item.value && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </>
    );
}

const STEPS = ["Basic", "Location", "Block", "Amenities", "Assignment"];

export default function AddProjectScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Project>>({
        name: "",
        reraNumber: "",
        developerName: "",
        isJointVenture: false,
        secondaryDeveloper: "",
        category: [],
        subCategory: [],
        status: "",
        landArea: "",
        landAreaUnit: "Acres",
        totalBlocks: "0",
        totalFloors: "0",
        totalUnits: "0",
        parkingType: "",
        launchDate: "",
        expectedCompletionDate: "",
        possessionDate: "",
        description: "",
        address: { city: "", location: "", state: "Punjab", country: "India", street: "", locality: "", area: "", pincode: "" },
        locationSearch: "",
        latitude: "",
        longitude: "",
        amenities: {},
        blocks: [],
        team: [],
        assign: [],
        owner: ""
    });

    // Lookup Data
    const [lookups, setLookups] = useState<Record<string, Lookup[]>>({});
    const [developers, setDevelopers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const loadData = async () => {
            const results: Record<string, Lookup[]> = {};
            const lookupTypes = ["Category", "SubCategory", "ProjectStatus", "ParkingType"];
            for (const type of lookupTypes) {
                const res = await safeApiCall<Lookup>(() => getLookups(type));
                if (!res.error) results[type] = res.data;
            }
            setLookups(results);

            const devsRes = await safeApiCall<any>(() => getCompanies({ limit: "500" }));
            if (!devsRes.error) {
                const records = devsRes.data?.records || devsRes.data?.data || [];
                setDevelopers(records.filter((c: any) => {
                    const typeValue = lookupVal(c.companyType || c.type || c.company_type).toLowerCase();
                    const industryValue = lookupVal(c.industry || c.category).toLowerCase();

                    const typeMatch = [
                        'private ltd', 'pvt ltd', 'private limited',
                        'public ltd', 'public limited'
                    ].includes(typeValue);
                    const industryMatch = industryValue === 'real estate';

                    return typeMatch && industryMatch;
                }).map((c: any) => ({ label: c.name, value: c.name })));
            }

            const teamsRes = await safeApiCall<any>(() => getTeams());
            if (!teamsRes.error) setTeams(teamsRes.data?.map((t: any) => ({ label: t.name, value: t._id })));

            const usersRes = await safeApiCall<any>(() => api.get("/users?limit=1000"));
            if (!usersRes.error) {
                const userList = usersRes.data?.data || [];
                setUsers(userList.map((u: any) => ({ label: u.fullName || u.name, value: u._id, team: u.team?._id || u.team })));
            }
        };
        loadData();
    }, []);

    const filteredUsersByTeam = useMemo(() => {
        if (!formData.team || formData.team.length === 0) return users;
        return users.filter(u => formData.team?.includes(u.team));
    }, [users, formData.team]);

    const getLookupId = (cat: string, val: any) => {
        if (!val) return "";
        const match = lookups[cat]?.find((l: any) => l.lookup_value === val);
        return match ? match._id : val;
    };

    const handleSave = async () => {
        if (!formData.team?.length || !formData.assign?.length || !formData.owner) {
            Alert.alert("Required", "Please complete all Assignment fields (Team, Assign, and Owner).");
            return;
        }

        setLoading(true);

        // Normalize lookup fields before save
        const payload = {
            ...formData,
            category: (formData.category || []).map(c => getLookupId("Category", c)).filter(Boolean),
            subCategory: (formData.subCategory || []).map(s => getLookupId("SubCategory", s)).filter(Boolean),
            status: getLookupId("ProjectStatus", formData.status),
            parkingType: getLookupId("ParkingType", formData.parkingType),
            blocks: (formData.blocks || []).map((b: any) => ({
                ...b,
                status: getLookupId("ProjectStatus", b.status),
                parkingType: getLookupId("ParkingType", b.parkingType)
            }))
        };

        const res = await safeApiCall(() => createProject(payload));
        setLoading(false);
        if (!res.error) {
            Alert.alert("Success", "Project created successfully!");
            router.back();
        } else {
            Alert.alert("Error", res.error);
        }
    };

    const nextStep = () => {
        if (step === 0 && !formData.name?.trim()) return Alert.alert("Required", "Project Name is required.");
        if (step < STEPS.length - 1) setStep(step + 1);
        else handleSave();
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
        else router.back();
    };

    const renderStepContent = () => {
        switch (step) {
            case 0: return <BasicStep data={formData} update={setFormData} lookups={lookups} developers={developers} />;
            case 1: return <LocationStep data={formData} update={setFormData} />;
            case 2: return <BlockStep data={formData} update={setFormData} lookups={lookups} />;
            case 3: return <AmenitiesStep data={formData} update={setFormData} />;
            case 4: return <AssignmentStep data={formData} update={setFormData} teams={teams} users={filteredUsersByTeam} />;
            default: return null;
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <TouchableOpacity onPress={prevStep} style={styles.backBtn}>
                        <Ionicons name={step === 0 ? "close" : "arrow-back"} size={26} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Add Project</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Text>
                    </View>
                    <View style={{ width: 28 }} />
                </View>

                <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}>
                    {STEPS.map((_, i) => (
                        <View key={i} style={[styles.progressBar, i < step && { backgroundColor: theme.primary + '40' }, i === step && { backgroundColor: theme.primary }]} />
                    ))}
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {renderStepContent()}
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
                    <TouchableOpacity style={[styles.footerBtnSecondary, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={prevStep}>
                        <Text style={[styles.footerBtnTextSecondary, { color: theme.textSecondary }]}>{step === 0 ? "Cancel" : "Previous"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.footerBtnPrimary, { backgroundColor: theme.primary, shadowColor: theme.primary }, loading && { opacity: 0.7 }]} onPress={nextStep} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.footerBtnTextPrimary}>{step === STEPS.length - 1 ? "Complete Setup" : "Continue"}</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function BasicStep({ data, update, lookups, developers }: any) {
    const { theme } = useTheme();
    return (
        <View style={styles.stepContainer}>
            <SectionHeader title="Basic Details" icon="🏢" subtitle="Identity and configuration" />
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Field required label="Project Name">
                    <Input placeholder="Acme Heights" value={data.name} onChangeText={t => update({ ...data, name: t })} />
                </Field>
                <Field label="RERA Number">
                    <Input placeholder="PBRERA-..." value={data.reraNumber} onChangeText={t => update({ ...data, reraNumber: t })} icon="document-text-outline" />
                </Field>
                <Field label="Developer Name">
                    <ModernPicker label="Select Developer" value={data.developerName} options={developers} onSelect={v => update({ ...data, developerName: v })} />
                </Field>

                <View style={[styles.row, { marginBottom: 20 }]}>
                    <Text style={[styles.fieldLabel, { flex: 1, marginBottom: 0, color: theme.textSecondary }]}>Joint Venture?</Text>
                    <Switch value={data.isJointVenture} onValueChange={v => update({ ...data, isJointVenture: v })} trackColor={{ true: theme.primary }} />
                </View>

                {data.isJointVenture && (
                    <Field label="Secondary Developer">
                        <ModernPicker label="Select Partner" value={data.secondaryDeveloper} options={developers} onSelect={v => update({ ...data, secondaryDeveloper: v })} />
                    </Field>
                )}

                <Field label="Category">
                    <SelectButton multiple value={data.category} options={lookups["Category"]?.map((l: any) => ({ label: l.lookup_value, value: l.lookup_value })) || []} onSelect={v => update({ ...data, category: v })} />
                </Field>
                <Field label="Sub Category">
                    <SelectButton multiple value={data.subCategory} options={lookups["SubCategory"]?.map((l: any) => ({ label: l.lookup_value, value: l.lookup_value })) || []} onSelect={v => update({ ...data, subCategory: v })} />
                </Field>
                <Field label="Project Status">
                    <SelectButton value={data.status} options={lookups["ProjectStatus"]?.map((l: any) => ({ label: l.lookup_value, value: l.lookup_value })) || []} onSelect={v => update({ ...data, status: v })} />
                </Field>

                <View style={styles.row}>
                    <View style={{ flex: 1 }}><Field label="Land Area"><Input keyboardType="numeric" value={data.landArea} onChangeText={t => update({ ...data, landArea: t })} /></Field></View>
                    <View style={{ flex: 1 }}><Field label="Unit"><SelectButton value={data.landAreaUnit} options={[{ label: "Acres", value: "Acres" }, { label: "Hectares", value: "Hectares" }, { label: "Sq Yards", value: "Sq Yards" }]} onSelect={v => update({ ...data, landAreaUnit: v })} /></Field></View>
                </View>

                <View style={styles.row}>
                    <View style={{ flex: 1 }}><Field label="Blocks"><Input keyboardType="numeric" value={data.totalBlocks} onChangeText={t => update({ ...data, totalBlocks: t })} /></Field></View>
                    <View style={{ flex: 1 }}><Field label="Floors"><Input keyboardType="numeric" value={data.totalFloors} onChangeText={t => update({ ...data, totalFloors: t })} /></Field></View>
                    <View style={{ flex: 1 }}><Field label="Units"><Input keyboardType="numeric" value={data.totalUnits} onChangeText={t => update({ ...data, totalUnits: t })} /></Field></View>
                </View>

                <Field label="Parking Type">
                    <SelectButton value={data.parkingType} options={lookups["ParkingType"]?.map((l: any) => ({ label: l.lookup_value, value: l.lookup_value })) || []} onSelect={v => update({ ...data, parkingType: v })} />
                </Field>
            </View>

            <SectionHeader title="Timeline" icon="📅" />
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Field label="Launch Date"><Input placeholder="YYYY-MM-DD" value={data.launchDate} onChangeText={t => update({ ...data, launchDate: t })} icon="calendar-outline" /></Field>
                <Field label="Completion Date"><Input placeholder="YYYY-MM-DD" value={data.expectedCompletionDate} onChangeText={t => update({ ...data, expectedCompletionDate: t })} icon="calendar-outline" /></Field>
                <Field label="Possession Date"><Input placeholder="YYYY-MM-DD" value={data.possessionDate} onChangeText={t => update({ ...data, possessionDate: t })} icon="calendar-outline" /></Field>
            </View>

            <SectionHeader title="Description" icon="📝" />
            <Field><Input multiline placeholder="Additional project details..." value={data.description} onChangeText={t => update({ ...data, description: t })} /></Field>
        </View>
    );
}

function LocationStep({ data, update }: any) {
    const { theme } = useTheme();
    return (
        <View style={styles.stepContainer}>
            <SectionHeader title="Project Location" icon="📍" subtitle="Site and address details" />
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Field label="Search Location (Google Maps)"><Input icon="search" placeholder="Search..." value={data.locationSearch} onChangeText={t => update({ ...data, locationSearch: t })} /></Field>
                <View style={styles.row}>
                    <View style={{ flex: 1 }}><Field label="City"><Input value={data.address.city} onChangeText={t => update({ ...data, address: { ...data.address, city: t } })} /></Field></View>
                    <View style={{ flex: 1 }}><Field label="State"><Input value={data.address.state} onChangeText={t => update({ ...data, address: { ...data.address, state: t } })} /></Field></View>
                </View>
                <Field label="Location / Sector"><Input value={data.address.location} onChangeText={t => update({ ...data, address: { ...data.address, location: t } })} /></Field>
                <Field label="Area"><Input value={data.address.area} onChangeText={t => update({ ...data, address: { ...data.address, area: t } })} /></Field>
                <Field label="Pincode"><Input keyboardType="numeric" value={data.address.pincode} onChangeText={t => update({ ...data, address: { ...data.address, pincode: t } })} /></Field>
                <View style={styles.row}>
                    <View style={{ flex: 1 }}><Field label="Latitude"><Input value={data.latitude} editable={false} /></Field></View>
                    <View style={{ flex: 1 }}><Field label="Longitude"><Input value={data.longitude} editable={false} /></Field></View>
                </View>
            </View>
        </View>
    );
}

function AmenitiesStep({ data, update }: any) {
    const { theme } = useTheme();
    const CATEGORIES = [
        { title: "Basic", list: ["Power Backup", "Clubhouse", "Lift", "Security", "Parking"] },
        { title: "Featured", list: ["Gym", "Swimming Pool", "Park", "Intercom", "WiFi"] },
        { title: "Nearby", list: ["School", "Hospital", "Mall", "Metro", "Airport"] }
    ];

    const toggle = (name: string) => {
        update({ ...data, amenities: { ...data.amenities, [name]: !data.amenities?.[name] } });
    };

    return (
        <View style={styles.stepContainer}>
            {CATEGORIES.map(cat => (
                <View key={cat.title}>
                    <SectionHeader title={`${cat.title} Amenities`} icon="✨" />
                    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        {cat.list.map(a => (
                            <TouchableOpacity key={a} style={[styles.amenityRow, { borderBottomColor: theme.border + '50' }]} onPress={() => toggle(a)}>
                                <Text style={[styles.amenityLabel, { color: theme.textSecondary }, data.amenities?.[a] && { color: theme.textPrimary, fontWeight: '700' }]}>{a}</Text>
                                <Switch value={!!data.amenities?.[a]} onValueChange={() => toggle(a)} trackColor={{ true: theme.primary }} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}

function BlockStep({ data, update, lookups }: any) {
    const { theme } = useTheme();
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [blockForm, setBlockForm] = useState<any>({
        name: "", floors: "0", units: "0", status: "Upcoming", landArea: "", landAreaUnit: "Acres",
        parkingType: "Open Parking", launchDate: "", expectedCompletionDate: "", possessionDate: ""
    });

    const addBlock = () => {
        if (!blockForm.name) return Alert.alert("Error", "Block name is required");
        if (editingIndex !== null) {
            const newBlocks = [...(data.blocks || [])];
            newBlocks[editingIndex] = blockForm;
            update({ ...data, blocks: newBlocks });
            setEditingIndex(null);
        } else {
            update({ ...data, blocks: [...(data.blocks || []), blockForm] });
        }
        setBlockForm({
            name: "", floors: "0", units: "0", status: "Upcoming", landArea: "", landAreaUnit: "Acres",
            parkingType: "Open Parking", launchDate: "", expectedCompletionDate: "", possessionDate: ""
        });
    };

    const editBlock = (idx: number) => {
        setBlockForm(data.blocks[idx]);
        setEditingIndex(idx);
    };

    return (
        <View style={styles.stepContainer}>
            <SectionHeader title="Project Blocks" icon="🧊" subtitle="Manage individual building blocks" />

            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.primary + '30', borderWidth: 2 }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 12 }]}>{editingIndex !== null ? "Edit Block" : "Add Block"}</Text>

                <Field label="Block Name" required>
                    <Input placeholder="Block A" value={blockForm.name} onChangeText={t => setBlockForm({ ...blockForm, name: t })} />
                </Field>

                <View style={styles.row}>
                    <View style={{ flex: 1 }}><Field label="Floors"><Input keyboardType="numeric" value={blockForm.floors} onChangeText={t => setBlockForm({ ...blockForm, floors: t })} /></Field></View>
                    <View style={{ flex: 1 }}><Field label="Units"><Input keyboardType="numeric" value={blockForm.units} onChangeText={t => setBlockForm({ ...blockForm, units: t })} /></Field></View>
                </View>

                <Field label="Status">
                    <SelectButton value={blockForm.status} options={lookups["ProjectStatus"]?.map((l: any) => ({ label: l.lookup_value, value: l.lookup_value })) || []} onSelect={v => setBlockForm({ ...blockForm, status: v })} />
                </Field>

                <Field label="Parking Type">
                    <SelectButton value={blockForm.parkingType} options={lookups["ParkingType"]?.map((l: any) => ({ label: l.lookup_value, value: l.lookup_value })) || []} onSelect={v => setBlockForm({ ...blockForm, parkingType: v })} />
                </Field>

                <TouchableOpacity style={[styles.addBlockBtn, { backgroundColor: theme.primary }]} onPress={addBlock}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{editingIndex !== null ? "Update Block" : "Add to List"}</Text>
                </TouchableOpacity>
                {editingIndex !== null && (
                    <TouchableOpacity style={{ marginTop: 10, alignSelf: 'center' }} onPress={() => { setEditingIndex(null); setBlockForm({ name: "", floors: "0", units: "0", status: "Upcoming", landArea: "", landAreaUnit: "Acres", parkingType: "Open Parking", launchDate: "", expectedCompletionDate: "", possessionDate: "" }); }}>
                        <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '600' }}>Cancel Editing</Text>
                    </TouchableOpacity>
                )}
            </View>

            {(data.blocks || []).length > 0 && (
                <View style={{ gap: 12, marginBottom: 20 }}>
                    {data.blocks.map((b: any, i: number) => (
                        <View key={i} style={[styles.blockItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.blockName, { color: theme.textPrimary }]}>{b.name}</Text>
                                <Text style={[styles.blockMeta, { color: theme.textSecondary }]}>{b.floors} Floors • {b.units} Units • {b.status}</Text>
                            </View>
                            <View style={styles.blockActions}>
                                <TouchableOpacity onPress={() => editBlock(i)} style={styles.blockActionBtn}>
                                    <Ionicons name="pencil" size={18} color={theme.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => update({ ...data, blocks: data.blocks.filter((_: any, idx: number) => idx !== i) })} style={styles.blockActionBtn}>
                                    <Ionicons name="trash" size={18} color={theme.error} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

function AssignmentStep({ data, update, teams, users }: any) {
    const { theme } = useTheme();
    return (
        <View style={styles.stepContainer}>
            <SectionHeader title="Assignment" icon="👥" subtitle="Team and ownership (Mandatory)" />
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Field required label="Select Team">
                    <SelectButton multiple value={data.team} options={teams} onSelect={v => update({ ...data, team: v })} />
                </Field>
                <Field required label="Assign Users">
                    <SelectButton multiple value={data.assign} options={users} onSelect={v => update({ ...data, assign: v })} />
                </Field>
                <Field required label="Project Owner">
                    <ModernPicker label="Select Owner" value={data.owner} options={users} onSelect={v => update({ ...data, owner: v })} />
                </Field>
            </View>
            <View style={[styles.hintBox, { backgroundColor: theme.primary + '10' }]}>
                <Ionicons name="information-circle" size={20} color={theme.primary} />
                <Text style={[styles.hintText, { color: theme.primary, marginLeft: 10 }]}>Assigning the correct team and owner ensures the project is visible to the right people.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 60 : 20 },
    backBtn: { padding: 4 },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: "800" },
    headerSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
    progressBarContainer: { flexDirection: "row", height: 3 },
    progressBar: { flex: 1, height: '100%' },
    content: { flex: 1 },
    scroll: { padding: SPACING.outer, paddingBottom: 40 },
    stepContainer: { gap: 8 },
    sectionHeader: { marginTop: 8, marginBottom: 16 },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    sectionIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    sectionIconText: { fontSize: 18 },
    sectionTitle: { fontSize: 16, fontWeight: "800" },
    sectionSubtitle: { fontSize: 11, marginTop: 1 },
    sectionSeparator: { height: 1, marginTop: 16, opacity: 0.3 },
    card: { borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    field: { marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
    inputWrapper: { height: 50, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center' },
    inputInner: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 16 },
    inputIcon: { marginRight: 10 },
    input: { fontSize: 15, fontWeight: '600', flex: 1 },
    chipRow: { flexDirection: "row" },
    chipRowContent: { paddingRight: 20 },
    selectableChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, marginRight: 8, flexDirection: 'row', alignItems: 'center' },
    selectableChipText: { fontSize: 13, fontWeight: "600" },
    pickerTrigger: { height: 56, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: 'center' },
    pickerValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
    pickerValue: { fontSize: 15, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    optionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
    optionLabel: { fontSize: 16, fontWeight: '600' },
    amenityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    amenityLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
    footer: { flexDirection: "row", padding: 20, borderTopWidth: 1, gap: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
    footerBtnSecondary: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
    footerBtnPrimary: { flex: 2, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    footerBtnTextSecondary: { fontSize: 14, fontWeight: "700" },
    footerBtnTextPrimary: { fontSize: 14, fontWeight: "800", color: "#fff" },
    hintBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 20 },
    hintText: { flex: 1, fontSize: 12, fontWeight: '600' },
    addBlockBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    blockItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    blockName: { fontSize: 14, fontWeight: '700' },
    blockMeta: { fontSize: 12, marginTop: 4, fontWeight: '500' },
    blockActions: { flexDirection: 'row', gap: 12 },
    blockActionBtn: { padding: 8 },
});
