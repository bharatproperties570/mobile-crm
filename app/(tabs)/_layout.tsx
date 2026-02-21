import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useDepartment } from "../context/DepartmentContext";
import DepartmentSwitcher from "../components/DepartmentSwitcher";

function TabIcon({ icon, label, focused, color }: { icon: string; label: string; focused: boolean; color: string }) {
    return (
        <View style={styles.tabItem}>
            <Text style={[styles.tabIcon, focused && { color }]}>{icon}</Text>
            <Text style={[styles.tabLabel, focused && { color, fontWeight: "700" }]}>{label}</Text>
            {focused && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
        </View>
    );
}

export default function TabsLayout() {
    const { currentDept, config } = useDepartment();

    const isVisible = (name: string) => {
        // Shared Home, Activities
        if (name === 'index' || name === 'activities') return true;

        // Sales Set (No Contacts/Companies)
        if (currentDept === 'Sales') {
            return ['leads', 'deals', 'projects'].includes(name);
        }
        // Inventory Set (No Projects, Added Companies)
        if (currentDept === 'Inventory') {
            return ['inventory', 'companies', 'contacts'].includes(name);
        }
        // Post-Sales Set
        if (currentDept === 'Post-Sales') {
            return ['marketing', 'bookings', 'accounts'].includes(name);
        }
        return false;
    };

    return (
        <View style={{ flex: 1 }}>
            <DepartmentSwitcher />
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: false,
                    tabBarStyle: styles.tabBar,
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="leads"
                    options={{
                        href: isVisible('leads') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="👥" label="Leads" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="contacts"
                    options={{
                        href: isVisible('contacts') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="📋" label="Contacts" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="deals"
                    options={{
                        href: isVisible('deals') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="🤝" label="Deals" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="companies"
                    options={{
                        href: isVisible('companies') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="🏗️" label="Company" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="projects"
                    options={{
                        href: isVisible('projects') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="🏟️" label="Project" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="inventory"
                    options={{
                        href: isVisible('inventory') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="📦" label="Inventory" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="bookings"
                    options={{
                        href: isVisible('bookings') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="📝" label="Booking" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="accounts"
                    options={{
                        href: isVisible('accounts') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="💰" label="Account" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="marketing"
                    options={{
                        href: isVisible('marketing') ? undefined : null,
                        tabBarIcon: ({ focused }) => <TabIcon icon="📢" label="Marketing" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="activities"
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon icon="📅" label="Activities" focused={focused} color={config.color} />,
                    }}
                />
                <Tabs.Screen
                    name="more"
                    options={{
                        href: null, // Hide legacy more tab
                    }}
                />
            </Tabs>
        </View>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        height: 75,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
        paddingBottom: 10,
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 10,
    },
    tabIcon: { fontSize: 20, color: "#94A3B8" },
    tabLabel: { fontSize: 10, color: "#94A3B8", marginTop: 4, fontWeight: "500" },
    activeIndicator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 4,
    }
});
