namespace Milo.TestChat;

public sealed record SyntheticMessage(string Speaker, string Text, bool FromSelf);

internal static class SyntheticConversation
{
    private static readonly IReadOnlyList<SyntheticMessage> English =
    [
        new("Alex", "Hey! Are we still on for coffee after work?", false),
        new("You", "Absolutely. I found a quiet place near the park ☕", true),
        new("Alex", "Perfect — 18:30 works for me. What should we talk about?", false),
        new("You", "Anything that makes us laugh. I have one terrible story ready 😄", true),
    ];

    private static readonly IReadOnlyList<SyntheticMessage> Italian =
    [
        new("Giulia", "Ciao! Confermi il caffè dopo il lavoro?", false),
        new("Tu", "Certo. Ho trovato un posto tranquillo vicino al parco ☕", true),
        new("Giulia", "Perfetto — le 18:30 vanno bene. Di cosa parliamo?", false),
        new("Tu", "Di tutto quello che ci fa ridere. Ho già una storia terribile 😄", true),
    ];

    private static readonly IReadOnlyList<string> EnglishAppend =
    [
        "I will bring the good playlist for the walk 🎵",
        "No pressure, I am looking forward to seeing you.",
        "Message received — see you soon!",
    ];

    private static readonly IReadOnlyList<string> ItalianAppend =
    [
        "Porto io la playlist giusta per la passeggiata 🎵",
        "Nessuna fretta, non vedo l'ora di vederti.",
        "Messaggio ricevuto — a presto!",
    ];

    public static IReadOnlyList<SyntheticMessage> Initial(FixtureLanguage language) =>
        language == FixtureLanguage.Italian ? Italian : English;

    public static SyntheticMessage Appended(FixtureLanguage language, int index)
    {
        var messages = language == FixtureLanguage.Italian ? ItalianAppend : EnglishAppend;
        var text = messages[index % messages.Count];
        var speaker = language == FixtureLanguage.Italian ? "Tu" : "You";
        return new SyntheticMessage(speaker, text, true);
    }
}
