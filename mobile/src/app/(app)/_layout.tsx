import { Stack } from "expo-router";
import { HouseholdProvider } from "@/lib/household-context";
import { colors } from "@/theme";

/** Everything behind sign-in. The dashboard loads once here and every screen reads from it. */
export default function AppLayout() {
  return (
    <HouseholdProvider>
      <Stack
        screenOptions={{
          headerTintColor: colors.forest,
          headerTitleStyle: { color: colors.ink, fontWeight: "700" },
          headerStyle: { backgroundColor: colors.page },
          headerShadowVisible: false,
          statusBarStyle: "dark",
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.page },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="readings" options={{ title: "Daily readings" }} />
        <Stack.Screen name="monthly" options={{ title: "Monthly summary" }} />
        <Stack.Screen name="credits" options={{ title: "Credits & serials" }} />
        <Stack.Screen name="loan" options={{ title: "Solar loan" }} />
        <Stack.Screen name="certificate" options={{ title: "Certificate" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="message" options={{ title: "Monthly message" }} />
        <Stack.Screen name="street" options={{ title: "Your street" }} />
        <Stack.Screen name="earn-more" options={{ title: "Earn more" }} />
        <Stack.Screen name="receipts" options={{ title: "Fuel receipts" }} />
        <Stack.Screen name="calculation" options={{ title: "How it's calculated" }} />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen name="payment-details" options={{ title: "Payment details" }} />
        <Stack.Screen name="preferences" options={{ title: "Language & preferences" }} />
        <Stack.Screen name="help" options={{ title: "Help Center" }} />
        <Stack.Screen name="support" options={{ title: "Contact Support" }} />
        <Stack.Screen
          name="payout/[id]"
          options={{ title: "Payout details", headerShown: false, presentation: "formSheet", sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true }}
        />
        <Stack.Screen
          name="held"
          options={{ title: "Why this period is on hold", headerShown: false, presentation: "formSheet", sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }}
        />
      </Stack>
    </HouseholdProvider>
  );
}
