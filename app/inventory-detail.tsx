import { useEffect, useState } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "./services/api";

function fmt(amount?: any): string {
    const n = Number(amount);
    if (!n) return "—";
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString("en-IN")}`;
}

function lv(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value ?? "—";
        if ("fullName" in field) return (field as any).fullName ?? "—";
        if ("name" in field) return (field as any).name ?? "—";
    }
    return String(field) || "—";
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    if (!value || value === "—") return null;
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={[styles.infoValue, accent && styles.infoValueAccent]}>{value}</Text>
        </View>
    );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Text style={styles.sectionIcon}>{icon}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

const STATUS_COLORS: Record<string, string> = {
    available: "#10B981", sold: "#EF4444", "under offer": "#F59E0B",
    reserved: "#8B5CF6", blocked: "#F97316", rented: "#3B82F6",
};

export default function InventoryDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [inv, setInv] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        api.get(`/inventory/${id}`)
            .then((res) => setInv(res.data?.data ?? res.data))
            .catch(() => Alert.alert("Error", "Could not load inventory"))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>;
    if (!inv) return <View style={styles.center}><Text style={styles.noData}>Not found</Text></View>;

    const statusLabel = lv(inv.status);
    const statusColor = STATUS_COLORS[statusLabel.toLowerCase()] ?? "#6366F1";
    const unitTitle = [inv.unitNumber, inv.block, inv.projectName ?? inv.project].filter(Boolean).join(" · ") || "Inventory Unit";

    return (
        <View style={styles.container}>
            {/* Hero */}
            <View style={styles.heroHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>

                {/* Unit Icon */}
                <View style={styles.unitIconWrap}>
                    <Text style={styles.unitIcon}>🏗️</Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                </View>

                <Text style={styles.heroTitle}>{unitTitle}</Text>
                {inv.projectName ?? inv.project ? (
                    <Text style={styles.heroSub}>🏘️ {inv.projectName ?? inv.project}</Text>
                ) : null}

                {/* Price Row */}
                <View style={styles.priceRow}>
                    <View style={styles.priceCard}>
                        <Text style={styles.priceLbl}>Listed Price</Text>
                        <Text style={styles.priceBig}>{fmt(inv.price)}</Text>
                    </View>
                    {inv.totalCost ? (
                        <View style={[styles.priceCard, { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.2)" }]}>
                            <Text style={styles.priceLbl}>Total Cost</Text>
                            <Text style={styles.priceBig}>{fmt(inv.totalCost)}</Text>
                        </View>
                    ) : null}
                    {inv.size ? (
                        <View style={[styles.priceCard, { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.2)" }]}>
                            <Text style={styles.priceLbl}>Size</Text>
                            <Text style={styles.priceBig}>{inv.size} {inv.sizeUnit ?? ""}</Text>
                        </View>
                    ) : null}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Unit Details */}
                <Section title="Unit Details" icon="🏢">
                    <InfoRow label="Project" value={inv.projectName ?? inv.project ?? "—"} accent />
                    <InfoRow label="Block" value={inv.block ?? "—"} />
                    <InfoRow label="Unit Number" value={inv.unitNumber ?? "—"} accent />
                    <InfoRow label="Floor" value={inv.floor?.toString() ?? "—"} />
                    <InfoRow label="Category" value={lv(inv.category)} />
                    <InfoRow label="Sub Category" value={lv(inv.subCategory)} />
                    <InfoRow label="Unit Type" value={inv.unitType ?? "—"} />
                    <InfoRow label="Facing" value={lv(inv.facing)} />
                    <InfoRow label="Road Width" value={inv.roadWidth ?? "—"} />
                    <InfoRow label="Intent" value={lv(inv.intent)} />
                    <InfoRow label="Status" value={statusLabel} />
                </Section>

                {/* Pricing */}
                <Section title="Pricing" icon="💰">
                    <InfoRow label="Listed Price" value={fmt(inv.price)} accent />
                    <InfoRow label="Total Cost" value={fmt(inv.totalCost)} />
                    <InfoRow label="All-Inclusive Price" value={fmt(inv.allInclusivePrice)} />
                </Section>

                {/* Dimensions */}
                <Section title="Dimensions" icon="📐">
                    <InfoRow label="Size" value={inv.size ? `${inv.size} ${inv.sizeUnit ?? ""}`.trim() : "—"} />
                    <InfoRow label="Built Up Area" value={inv.builtUpArea?.toString() ?? "—"} />
                    <InfoRow label="Carpet Area" value={inv.carpetArea?.toString() ?? "—"} />
                </Section>

                {/* Location */}
                <Section title="Location" icon="📍">
                    <InfoRow label="City" value={inv.city ?? "—"} />
                    <InfoRow label="Sector" value={inv.sector ?? "—"} />
                    {inv.address ? (
                        <InfoRow label="Address" value={typeof inv.address === "string" ? inv.address : JSON.stringify(inv.address)} />
                    ) : null}
                </Section>

                {/* Ownership */}
                {(inv.owners?.length > 0 || inv.associates?.length > 0) ? (
                    <Section title="Ownership" icon="👤">
                        {inv.owners?.map((o: unknown, i: number) => (
                            <InfoRow key={i} label={`Owner ${i + 1}`} value={lv(o)} accent={i === 0} />
                        ))}
                        {inv.associates?.map((a: unknown, i: number) => (
                            <InfoRow key={`a${i}`} label={`Associate ${i + 1}`} value={lv(a)} />
                        ))}
                    </Section>
                ) : null}

                {/* Assignment */}
                <Section title="Assignment" icon="👥">
                    <InfoRow label="Team" value={inv.team ?? "—"} />
                    <InfoRow label="Assigned To" value={inv.assignedTo ?? "—"} />
                    <InfoRow label="Visible To" value={inv.visibleTo ?? "—"} />
                </Section>

                <Section title="Record Info" icon="ℹ️">
                    <InfoRow label="Created" value={inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-IN") : "—"} />
                    <InfoRow label="Updated" value={inv.updatedAt ? new Date(inv.updatedAt).toLocaleDateString("en-IN") : "—"} />
                </Section>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F0F4FF" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    noData: { fontSize: 16, color: "#94A3B8" },
    heroHeader: {
        backgroundColor: "#1E293B", paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20, alignItems: "center",
    },
    backBtn: { position: "absolute", top: 52, left: 16, padding: 8 },
    backIcon: { fontSize: 22, color: "#fff", fontWeight: "700" },
    unitIconWrap: {
        width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.1)",
        justifyContent: "center", alignItems: "center", marginBottom: 12,
        borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
    },
    unitIcon: { fontSize: 32 },
    statusBadge: {
        paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: 10,
    },
    statusBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
    heroTitle: { fontSize: 18, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 4 },
    heroSub: { fontSize: 13, color: "#94A3B8", marginBottom: 16, textAlign: "center" },
    priceRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, width: "100%" },
    priceCard: { flex: 1, alignItems: "center", padding: 12 },
    priceLbl: { fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
    priceBig: { fontSize: 15, fontWeight: "800", color: "#fff" },
    scroll: { padding: 16, paddingBottom: 80 },
    section: {
        backgroundColor: "#fff", borderRadius: 18, marginBottom: 14,
        shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
        overflow: "hidden",
    },
    sectionHead: {
        flexDirection: "row", alignItems: "center", padding: 14,
        borderBottomWidth: 1, borderBottomColor: "#F1F5F9", backgroundColor: "#FAFBFF",
    },
    sectionIcon: { fontSize: 18, marginRight: 8 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: "#1E3A8A", textTransform: "uppercase", letterSpacing: 0.5 },
    sectionBody: { padding: 14 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
    infoLabel: { fontSize: 13, color: "#64748B", fontWeight: "500", flex: 1 },
    infoValue: { fontSize: 13, color: "#1E293B", fontWeight: "600", flex: 2, textAlign: "right" },
    infoValueAccent: { color: "#1E40AF", fontWeight: "700" },
});
