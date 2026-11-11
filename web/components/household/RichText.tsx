import { Fragment } from "react";

/**
 * AI replies sometimes arrive with markdown. Families should never see asterisks or hashes:
 * **bold** becomes bold, list markers become bullets, and everything else is plain text.
 * Built from React nodes only, so nothing in a reply is ever treated as HTML.
 */
export function plainText(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|\s)[*_](\S[^*_\n]*?)[*_](?=\s|[.,!?;:]|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/`([^`]+)`/g, "$1");
}

export function RichText({ text }: { text: string }) {
  const lines = text
    .replace(/__(.+?)__/g, "**$1**")
    .replace(/^#{1,6}\s+(.*)$/gm, "**$1**")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/`([^`]+)`/g, "$1")
    .split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            /^\*\*[^*]+\*\*$/.test(part) ? (
              <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
            ) : (
              <Fragment key={j}>{part.replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|[.,!?;:]|$)/g, "$1$2")}</Fragment>
            ),
          )}
          {i < lines.length - 1 && "\n"}
        </Fragment>
      ))}
    </>
  );
}
