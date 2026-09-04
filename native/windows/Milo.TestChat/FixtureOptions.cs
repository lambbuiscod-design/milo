namespace Milo.TestChat;

public enum FixtureMode
{
    Uia,
    OcrOnly,
}

public enum FixtureLanguage
{
    English,
    Italian,
}

public sealed record FixtureOptions(FixtureMode Mode, FixtureLanguage Language, int? AutoAppendMilliseconds)
{
    public static FixtureOptions Parse(IReadOnlyList<string> args)
    {
        var mode = FixtureMode.Uia;
        var language = FixtureLanguage.English;
        int? autoAppendMilliseconds = null;
        foreach (var argument in args)
        {
            var value = argument.Trim().ToLowerInvariant();
            if (value is "--mode=ocr" or "--mode=ocr-only") mode = FixtureMode.OcrOnly;
            if (value is "--mode=uia" or "--mode=accessible") mode = FixtureMode.Uia;
            if (value is "--language=it" or "--language=italian") language = FixtureLanguage.Italian;
            if (value is "--language=en" or "--language=english") language = FixtureLanguage.English;
            if (value.StartsWith("--auto-append-ms=", StringComparison.Ordinal) &&
                int.TryParse(value["--auto-append-ms=".Length..], out var delay) &&
                delay is >= 1_000 and <= 30_000)
            {
                autoAppendMilliseconds = delay;
            }
        }
        return new FixtureOptions(mode, language, autoAppendMilliseconds);
    }
}
