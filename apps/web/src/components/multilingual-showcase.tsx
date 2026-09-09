import { TiltCard } from "@/components/tilt-card";

const toneExamples = [
  { tone: "Warm",      accentColor: "#26795a", reply: "I had a lovely time too. I'd really like to see you again.",          note: "Open, kind and sincere" },
  { tone: "Confident", accentColor: "#2c3249", reply: "Definitely. I know a place you'll love — free Thursday?",            note: "Clear, assured and specific" },
  { tone: "Playful",   accentColor: "#c86b4e", reply: "Round two? Only if you bring another dangerously good story.",        note: "Light, witty and natural" },
  { tone: "Direct",    accentColor: "#706a60", reply: "Yes, I'd like that. Are you free Thursday evening?",                 note: "Simple, honest and easy to answer" },
];

const scenario = "She said: \"I had such a good time last night. We should do it again!\"";

export function MultilingualShowcase() {
  return (
    <section
      className="border-b border-[var(--line)] bg-[var(--surface-soft)] py-20 lg:py-28"
      aria-labelledby="tone-examples-title"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">

        {/* Section header */}
        <div className="max-w-2xl">
          <span className="editorial-kicker">Same intention, different energy</span>
          <h2
            className="font-display mt-4 text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.75rem]"
            id="tone-examples-title"
          >
            Choose a tone that still sounds like you.
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--muted)] sm:text-lg">
            Milo gives you a starting point — not a personality transplant. Every suggestion stays editable.
          </p>
        </div>

        {/* Conversation context bar */}
        <div
          className="mt-10 rounded-sm border-l-[3px] border-[var(--accent)] bg-[var(--surface)] px-5 py-4"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)] mb-2">
            Conversation context
          </p>
          <p className="font-display italic text-sm leading-6 text-[var(--foreground)]">
            {scenario}
          </p>
        </div>

        {/* Four 3D tilt reply cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {toneExamples.map(({ tone, accentColor, reply, note }) => (
            <TiltCard
              key={tone}
              className="overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--surface)]"
              style={{
                borderTopColor: accentColor,
                borderTopWidth: "3px",
                boxShadow: "var(--shadow-sm)",
              }}
              intensity={14}
            >
              <div className="p-5">
                <span
                  className="text-[10px] font-extrabold uppercase tracking-[0.2em]"
                  style={{ color: accentColor }}
                >
                  {tone}
                </span>
                <p className="font-display mt-3 text-base font-medium leading-[1.55]">
                  &ldquo;{reply}&rdquo;
                </p>
                <p className="mt-3 text-xs text-[var(--muted)]">{note}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
