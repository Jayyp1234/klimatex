import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { Icon, type IconName } from "@/components/ui";
import { useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

const tab = (icon: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={icon} size={22} color={String(color)} />;
  };

export default function TabsLayout() {
  const { alerts } = useHousehold();
  const urgent = alerts.filter((a) => a.severity !== "info").length;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: colors.page },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.ink, fontWeight: "700", fontSize: 17 },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: false, tabBarIcon: tab("home") }} />
      <Tabs.Screen name="energy" options={{ title: "Energy", tabBarIcon: tab("bar-chart-2") }} />
      <Tabs.Screen name="payouts" options={{ title: "Payouts", tabBarIcon: tab("credit-card") }} />
      <Tabs.Screen name="ask" options={{ title: "Ask KlimateX", tabBarLabel: "Ask", tabBarIcon: tab("message-circle") }} />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: tab("menu"),
          tabBarBadge: urgent > 0 ? urgent : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.lime, color: colors.forest, fontWeight: "700" },
        }}
      />
    </Tabs>
  );
}
