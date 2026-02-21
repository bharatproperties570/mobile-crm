import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDepartment, Department } from "../context/DepartmentContext";

export default function DepartmentSwitcher() {
    const { currentDept, setDepartment, config } = useDepartment();

    // Departments for the HUD
    const depts: { name: Department; icon: string; label: string; color: string }[] = [
        { name: 'Sales', icon: 'trending-up', label: 'Sales', color: '#3B82F6' },
        { name: 'Inventory', icon: 'business', label: 'Inventory', color: '#F59E0B' },
        { name: 'Post-Sales', icon: 'receipt', label: 'Service', color: '#10B981' },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.hud}>
                {depts.map((dept) => {
                    const isActive = currentDept === dept.name;
                    return (
                        <TouchableOpacity
                            key={dept.name}
                            style={[
                                styles.btn,
                                isActive && { backgroundColor: dept.color + "20", borderColor: dept.color }
                            ]}
                            onPress={() => setDepartment(dept.name)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={dept.icon as any}
                                size={18}
                                color={isActive ? dept.color : "#94A3B8"}
                            />
                            {isActive && <Text style={[styles.label, { color: dept.color }]}>{dept.label}</Text>}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
        backgroundColor: "#fff",
    },
    hud: {
        flexDirection: "row",
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        padding: 4,
        gap: 4,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    btn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        borderRadius: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: "transparent",
    },
    label: {
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
});
