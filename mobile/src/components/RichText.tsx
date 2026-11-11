import { Text, type StyleProp, type TextStyle } from "react-native";

/**
 * AI answers can come back with light markdown: **bold**, "- " bullets and "#" headings.
 * A phone can't show raw asterisks, so this draws bold as bold, bullets as "•" and headings as bold lines.
 * Anything else is shown as written.
 */

type Line = { text: string; heading: boolean };

function toLines(source: string): Line[] {
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw) => {
      const heading = /^\s{0,3}#{1,6}\s+/.test(raw);
      const text = raw
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^(\s*)[-*]\s+/, "$1• ")
        .replace(/`([^`]+)`/g, "$1");
      return { text, heading };
    });
}

/** Splits one line into plain and bold runs on **…** (or __…__). A lone marker is dropped, not shown. */
function runs(line: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  for (let m = pattern.exec(line); m !== null; m = pattern.exec(line)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false });
    out.push({ text: m[1] ?? m[2], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false });
  return out.map((r) => ({ ...r, text: r.text.replace(/\*\*|__/g, "") }));
}

export function RichText({ children, style, selectable = false }: { children: string; style?: StyleProp<TextStyle>; selectable?: boolean }) {
  const lines = toLines(children);
  return (
    <Text style={style} selectable={selectable}>
      {lines.map((line, i) => (
        <Text key={i}>
          {runs(line.text).map((r, j) => (
            <Text key={j} style={r.bold || line.heading ? { fontWeight: "700" } : undefined}>
              {r.text}
            </Text>
          ))}
          {i < lines.length - 1 ? "\n" : ""}
        </Text>
      ))}
    </Text>
  );
}

/** The same text with the markdown marks and emoji removed, for reading aloud. */
export function plainText(source: string): string {
  return toLines(source)
    .map((l) => l.text.replace(/\*\*|__/g, "").replace(/^(\s*)• /, "$1"))
    .join("\n")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
