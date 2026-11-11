/** Geist has no subscript-two glyph, so render "₂" as a real, tightly set subscript. */
export function Co2Text({ text }: { text: string }) {
  const parts = text.split("₂");
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && <sub className="relative -bottom-[0.12em] align-baseline text-[0.62em]">2</sub>}
          {part}
        </span>
      ))}
    </>
  );
}
