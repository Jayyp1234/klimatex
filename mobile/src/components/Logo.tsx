import { SvgXml } from "react-native-svg";
import { logoXml, markXml } from "./logoXml";

/** The KlimateX logo from web/public/logo.svg. `light` swaps the dark wordmark for white, for forest backgrounds. */
export function Logo({ height = 32, light = false }: { height?: number; light?: boolean }) {
  return <SvgXml xml={logoXml(light ? "#FFFFFF" : "#032C15")} height={height} width={(height * 1704) / 424} accessibilityLabel="KlimateX" />;
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return <SvgXml xml={markXml} height={size} width={(size * 404) / 432} accessibilityLabel="KlimateX" />;
}
