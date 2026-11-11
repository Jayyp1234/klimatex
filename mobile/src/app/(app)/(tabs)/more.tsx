import { router, type Href } from "expo-router";
import { Alert, Text, View } from "react-native";
import { Card, IconBadge, ListRow, Screen, type IconName, type as t } from "@/components/ui";
import { signOut } from "@/lib/api";
import { formatPhone } from "@/lib/extras";
import { homeCode, initialsOf } from "@/lib/household";
import { useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

type Item = { icon: IconName; title: string; subtitle?: string; href: Href; badge?: number };

export default function More() {
  const { user, data, alerts } = useHousehold();
  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Your home",
      items: [
        { icon: "bell", title: "Notifications", href: "/notifications", badge: alerts.length },
        { icon: "trending-up", title: "Earn more", subtitle: "What would earn your home more credits", href: "/earn-more" },
        { icon: "file-text", title: "Fuel receipts", subtitle: "From the year before your solar", href: "/receipts" },
        { icon: "award", title: "Certificate", subtitle: "Your A to G home energy grade", href: "/certificate" },
        { icon: "home", title: "Solar loan", subtitle: data?.home.loan ? `Loan ${data.home.loan}` : "Repay it with your carbon", href: "/loan" },
        { icon: "message-square", title: "Monthly message", subtitle: "In your language", href: "/message" },
        { icon: "map-pin", title: "Your street", subtitle: "How your street compares", href: "/street" },
      ],
    },
    {
      title: "Settings",
      items: [
        { icon: "user", title: "Profile", href: "/profile" },
        { icon: "credit-card", title: "Payment details", subtitle: "Where we pay you", href: "/payment-details" },
        { icon: "globe", title: "Language & preferences", href: "/preferences" },
      ],
    },
    {
      title: "Help",
      items: [
        { icon: "help-circle", title: "Help Center", subtitle: "Quick answers", href: "/help" },
        { icon: "hash", title: "How it's calculated", subtitle: "The working behind your credits", href: "/calculation" },
        { icon: "headphones", title: "Contact Support", subtitle: "Reply within one working day", href: "/support" },
      ],
    },
  ];

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You'll need your phone number and PIN to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <Screen>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.lime, fontWeight: "700", fontSize: 18 }}>{initialsOf(user.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={t.h2}>{user.name}</Text>
          <Text style={t.small}>
            {formatPhone(user.phone)}
            {data ? ` · ${homeCode(data.home.siteId)} · ${data.home.area}` : ""}
          </Text>
        </View>
      </Card>
      {groups.map((g) => (
        <View key={g.title} style={{ gap: 8 }}>
          <Text style={[t.label, { marginLeft: 4, marginTop: 4 }]}>{g.title}</Text>
          <Card padded={false}>
            {g.items.map((item, i) => (
              <ListRow
                key={item.title}
                icon={item.icon}
                title={item.title}
                subtitle={item.subtitle}
                onPress={() => router.push(item.href)}
                last={i === g.items.length - 1}
                right={
                  item.badge ? (
                    <View
                      style={{ backgroundColor: colors.lime, borderRadius: 999, minWidth: 22, paddingHorizontal: 6, height: 22, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ color: colors.forest, fontWeight: "700", fontSize: 12 }}>{item.badge}</Text>
                    </View>
                  ) : undefined
                }
              />
            ))}
          </Card>
        </View>
      ))}
      <Card padded={false}>
        <ListRow icon="log-out" iconBg="#fef2f2" iconColor="#b91c1c" title="Sign out" titleStyle={{ color: "#b91c1c" }} onPress={confirmSignOut} last />
      </Card>
      <View style={{ alignItems: "center", gap: 4, marginTop: 6 }}>
        <IconBadge name="shield" size={30} />
        <Text style={[t.small, { textAlign: "center" }]}>KlimateX will never ask for your PIN or BVN.</Text>
      </View>
    </Screen>
  );
}
