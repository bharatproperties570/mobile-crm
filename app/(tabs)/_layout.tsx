import { Tabs } from "expo-router";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useDepartment } from "../context/DepartmentContext";
import { useTheme } from "../context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS_CONFIG = [
    { name: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
    { name: 'leads', label: 'Leads', icon: 'people-outline', iconActive: 'people' },
    { name: 'contacts', label: 'Contacts', icon: 'person-circle-outline', iconActive: 'person-circle' },
    { name: 'deals', label: 'Deals', icon: 'wallet-outline', iconActive: 'wallet' },
    { name: 'activities', label: 'Activities', icon: 'calendar-outline', iconActive: 'calendar' },
    { name: 'companies', label: 'Company', icon: 'business-outline', iconActive: 'business' },
    { name: 'projects', label: 'Project', icon: 'cube-outline', iconActive: 'cube' },
    { name: 'inventory', label: 'Inventory', icon: 'grid-outline', iconActive: 'grid' },
    { name: 'bookings', label: 'Booking', icon: 'newspaper-outline', iconActive: 'newspaper' },
    { name: 'accounts', label: 'Account', icon: 'cash-outline', iconActive: 'cash' },
    { name: 'marketing', label: 'Marketing', icon: 'megaphone-outline', iconActive: 'megaphone' },
];

const AnimatedTabItem = ({ route, isFocused, activeColor, navigation, config }: any) => {
    const { theme } = useTheme();
    const scaleAnim = useRef(new Animated.Value(isFocused ? 1.2 : 1)).current;
    const rotateAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: isFocused ? 1.2 : 1,
                useNativeDriver: true,
                friction: 4,
            }),
            Animated.timing(rotateAnim, {
                toValue: isFocused ? 1 : 0,
                duration: 600,
                useNativeDriver: true,
            })
        ]).start();
    }, [isFocused]);

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const onPress = () => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.tabItem, isFocused && styles.tabItemActive]}
            activeOpacity={0.7}
        >
            <Animated.View style={[
                styles.iconBox,
                isFocused && { backgroundColor: activeColor + '10' },
                { transform: [{ scale: scaleAnim }, { rotate }] }
            ]}>
                <Ionicons
                    name={(isFocused ? config.iconActive : config.icon) as any}
                    size={22}
                    color={isFocused ? activeColor : theme.textLight}
                />
            </Animated.View>
            <Text style={[styles.tabLabel, { color: theme.textLight }, isFocused && { color: activeColor, fontWeight: "800" }]}>
                {config.label}
            </Text>
            {isFocused && (
                <Animated.View
                    style={[
                        styles.activeIndicator,
                        { backgroundColor: activeColor, opacity: scaleAnim.interpolate({ inputRange: [1, 1.2], outputRange: [0, 1] }) }
                    ]}
                />
            )}
        </TouchableOpacity>
    );
};

function CustomTabBar({ state, descriptors, navigation, activeColor }: any) {
    const { theme } = useTheme();
    return (
        <View style={[styles.tabBarContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                decelerationRate="fast"
            >
                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;
                    const config = TABS_CONFIG.find(t => t.name === route.name);

                    if (!config || options.href === null) return null;

                    return (
                        <AnimatedTabItem
                            key={route.key}
                            route={route}
                            isFocused={isFocused}
                            activeColor={activeColor}
                            options={options}
                            navigation={navigation}
                            config={config}
                        />
                    );
                })}
            </ScrollView>
        </View>
    );
}

export default function TabsLayout() {
    const { config } = useDepartment();
    const { theme } = useTheme();

    // In Omni-Nav, all tabs are visible and accessible. 
    // We hta-ing the DepartmentSwitcher and consolidating all icons in one place.

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <Tabs
                tabBar={(props) => <CustomTabBar {...props} activeColor={config.color} />}
                screenOptions={{
                    headerShown: false,
                }}
            >
                {TABS_CONFIG.map(tab => (
                    <Tabs.Screen
                        key={tab.name}
                        name={tab.name}
                        options={{
                            title: tab.label,
                        }}
                    />
                ))}
                <Tabs.Screen
                    name="more"
                    options={{
                        href: null,
                    }}
                />
            </Tabs>
        </View>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        height: 85,
        backgroundColor: "#fff",
        borderRadius: 30,
        elevation: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(226, 232, 240, 0.8)",
        overflow: 'hidden'
    },
    scrollContent: {
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        width: 85,
        height: '100%',
    },
    tabItemActive: {
        // Subtle feedback for active tab if needed
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4
    },
    tabLabel: {
        fontSize: 10,
        color: "#94A3B8",
        fontWeight: "600",
        letterSpacing: 0.2
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 12,
        width: 20,
        height: 3,
        borderRadius: 2,
    }
});
