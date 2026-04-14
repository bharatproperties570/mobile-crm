import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { getDealById } from "@/services/deals.service";

export default function GeographyScreen() {
    const { dealId } = useLocalSearchParams<{ dealId: string }>();
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [deal, setDeal] = useState<any>(null);

    useEffect(() => {
        if (dealId) {
            fetchDeal();
        }
    }, [dealId]);

    const fetchDeal = async () => {
        try {
            const response = await getDealById(dealId!);
            if (response.success) {
                setDeal(response.data);
            } else {
                Alert.alert("Error", response.error || "Failed to load deal details");
            }
        } catch (error) {
            console.error("Error fetching deal for geography:", error);
            Alert.alert("Error", "Network error occurred while fetching deal info.");
        } finally {
            setLoading(false);
        }
    };

    const openInMaps = () => {
        if (!deal) return;

        const projectName = deal.projectName || "Property Location";
        const locationObj = deal.location;
        
        // Handle coordinates if available
        if (locationObj?.coordinates && Array.isArray(locationObj.coordinates) && locationObj.coordinates.length === 2) {
            const [lng, lat] = locationObj.coordinates; // GeoJSON is [lng, lat]
            const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
            const latLng = `${lat},${lng}`;
            const label = projectName;
            const url = Platform.select({
              ios: `${scheme}${label}@${latLng}`,
              android: `${scheme}${latLng}(${label})`
            }) || `https://www.google.com/maps/search/?api=1&query=${latLng}`;

            Linking.openURL(url);
            return;
        }

        // Fallback to address search
        const address = [deal.projectName, deal.inventoryId?.sector, deal.inventoryId?.city]
            .filter(Boolean)
            .join(", ");
        
        if (address) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            Linking.openURL(url);
        } else {
            Alert.alert("No Location", "No coordinates or address available for this deal.");
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }, styles.centered]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const locationName = deal?.location?.lookup_value || deal?.inventoryId?.location || "Location Not Set";
    const projectName = deal?.projectName || deal?.inventoryId?.projectName || "Project Not Set";
    const addressDetails = [deal?.inventoryId?.block, deal?.inventoryId?.sector, deal?.inventoryId?.city].filter(Boolean).join(", ") || "No address details available";

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Property Location</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.card, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#fff" }]}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="location" size={32} color={theme.primary} />
                    </View>
                    
                    <Text style={[styles.projectName, { color: theme.text }]}>{projectName}</Text>
                    <Text style={[styles.locationName, { color: theme.textSecondary }]}>{locationName}</Text>
                    
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    
                    <View style={styles.detailRow}>
                        <Ionicons name="map-outline" size={20} color={theme.textSecondary} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>{addressDetails}</Text>
                    </View>

                    {deal?.inventoryId?.unitNumber && (
                        <View style={styles.detailRow}>
                            <Ionicons name="business-outline" size={20} color={theme.textSecondary} />
                            <Text style={[styles.detailText, { color: theme.textSecondary }]}>Unit: {deal.inventoryId.unitNumber}</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity 
                    style={[styles.mapButton, { backgroundColor: theme.primary }]}
                    onPress={openInMaps}
                >
                    <Ionicons name="navigate" size={20} color="#fff" />
                    <Text style={styles.mapButtonText}>Open in Device Maps</Text>
                </TouchableOpacity>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
                    <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                        Tap the button above to view the exact location and get directions.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
    },
    content: {
        padding: 20,
    },
    card: {
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 24,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    projectName: {
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 4,
    },
    locationName: {
        fontSize: 16,
        textAlign: "center",
        marginBottom: 20,
    },
    divider: {
        width: "100%",
        height: 1,
        marginBottom: 20,
    },
    detailRow: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        marginBottom: 12,
    },
    detailText: {
        fontSize: 15,
        marginLeft: 12,
        flex: 1,
    },
    mapButton: {
        flexDirection: "row",
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    mapButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        marginLeft: 8,
    },
    infoBox: {
        flexDirection: "row",
        marginTop: 24,
        paddingHorizontal: 8,
        alignItems: "center",
    },
    infoText: {
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
        fontStyle: "italic",
    },
});
