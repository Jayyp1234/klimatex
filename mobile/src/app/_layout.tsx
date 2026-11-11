import { Stack } from "expo-router";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LogoMark } from "@/components/Logo";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";

function RootStack() {
  const { ready, session } = useAuth();
  if (!ready)
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" }}>
        <LogoMark size={88} />
      </View>
    );
  const signedIn = session !== null;
  return (
    <Stack screenOptions={{ headerShown: false, statusBarStyle: "dark", contentStyle: { backgroundColor: colors.page } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ statusBarStyle: "light" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
