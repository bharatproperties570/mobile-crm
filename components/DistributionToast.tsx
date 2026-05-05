import React, { useEffect, useRef } from "react";
import {
    Animated,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Easing,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * DistributionToast — Mobile CRM
 *
 * Enterprise-grade real-time feedback toast displayed after:
 *   - Automatic lead assignment via Distribution Engine
 *   - Manual assignment confirmations
 *
 * Behavior:
 *   - Slides in from top (or bottom on small screens)
 *   - Auto-dismisses after `duration` ms (default 4000ms)
 *   - Green shimmer border for "Auto-Assigned" events
 *   - Orange shimmer for "Manually Assigned"
 *   - Includes: agent name, rule name, dismiss button
 */

export interface DistributionToastProps {
    visible: boolean;
    agentName: string;
    ruleName?: string;
    isAutoAssigned?: boolean;
    onDismiss: () => void;
    duration?: number;
}

export function DistributionToast({
    visible,
    agentName,
    ruleName,
    isAutoAssigned = true,
    onDismiss,
    duration = 4500,
}: DistributionToastProps) {
    const slideAnim = useRef(new Animated.Value(-120)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.92)).current;

    useEffect(() => {
        if (visible) {
            // Animate in
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    damping: 18,
                    stiffness: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    damping: 16,
                    stiffness: 200,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-dismiss after duration
            const timer = setTimeout(() => {
                animateOut();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    const animateOut = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -140,
                duration: 280,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start(() => onDismiss());
    };

    if (!visible) return null;

    const accentColor = isAutoAssigned ? "#10B981" : "#F59E0B";   // Emerald / Amber
    const iconName = isAutoAssigned ? "flash" : "person-add";

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                    opacity: opacityAnim,
                    borderLeftColor: accentColor,
                },
            ]}
        >
            {/* Left Accent Strip */}
            <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />

            {/* Icon Badge */}
            <View style={[styles.iconBadge, { backgroundColor: accentColor + "1A" }]}>
                <Ionicons name={iconName as any} size={22} color={accentColor} />
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.titleText}>
                    {isAutoAssigned ? "⚡ Auto-Assigned" : "✅ Lead Assigned"}
                </Text>
                <Text style={styles.agentText} numberOfLines={1}>
                    → <Text style={[styles.agentName, { color: accentColor }]}>{agentName}</Text>
                </Text>
                {ruleName ? (
                    <View style={styles.ruleTag}>
                        <Ionicons name="git-branch-outline" size={11} color="#94A3B8" />
                        <Text style={styles.ruleText}>{ruleName}</Text>
                    </View>
                ) : null}
            </View>

            {/* Dismiss */}
            <TouchableOpacity
                onPress={animateOut}
                style={styles.dismissBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
                <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: Platform.OS === "ios" ? 54 : 24,
        left: 16,
        right: 16,
        zIndex: 9999,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1E293B",
        borderRadius: 20,
        borderLeftWidth: 4,
        paddingVertical: 14,
        paddingHorizontal: 14,
        paddingRight: 44,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 18,
        gap: 12,
    },
    accentStrip: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    iconBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        flex: 1,
    },
    titleText: {
        fontSize: 12,
        fontWeight: "800",
        color: "#94A3B8",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 3,
    },
    agentText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#E2E8F0",
    },
    agentName: {
        fontWeight: "900",
    },
    ruleTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
    },
    ruleText: {
        fontSize: 11,
        color: "#64748B",
        fontWeight: "600",
        fontStyle: "italic",
    },
    dismissBtn: {
        position: "absolute",
        right: 14,
        top: "50%",
    },
});
