"use client";

const collaborateWords = [
  "collaborate",
  "collaborer",
  "zusammenarbeiten",
  "colaborar",
  "collaborare",
  "samenwerken",
  "сотрудничать",
  "współpracować",
  "colaborar",
];

const localiseWords = [
  "localise",
  "localiser",
  "lokalisieren",
  "localizar",
  "localizzare",
  "lokaliseren",
  "локализовать",
  "lokalizować",
  "localizar",
];

function TickerRow({
  words,
  direction = "forward",
}: {
  words: string[];
  direction?: "forward" | "reverse";
}) {
  const repeated = [...words, ...words];
  return (
    <div className="flex overflow-hidden whitespace-nowrap">
      <div
        className={
          direction === "forward" ? "animate-marquee" : "animate-marquee-reverse"
        }
        style={{ display: "flex", gap: 0 }}
      >
        {repeated.map((word, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 px-3 text-sm text-muted-foreground"
          >
            <span className="inline-block h-1 w-1 rounded-full bg-border shrink-0" />
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LanguageTicker() {
  return (
    <div className="relative overflow-hidden">
      <div className="space-y-2 py-4">
        <TickerRow words={collaborateWords} direction="forward" />
        <TickerRow words={localiseWords} direction="reverse" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
