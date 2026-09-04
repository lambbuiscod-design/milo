using System.Text;
using System.Windows.Automation;

namespace Milo.Native.Windows;

/// <summary>
/// Reads a small, best-effort text snapshot from one already-selected window.
/// The result is returned to the caller and is never written to disk or logged.
/// </summary>
internal static class WindowTextExtractor
{
    private const int MaxElements = 120;
    private const int MaxChars = 12_000;

    private static readonly ControlType[] TextControlTypes =
    [
        ControlType.Text,
        ControlType.Edit,
        ControlType.Document,
        ControlType.ListItem,
        ControlType.TreeItem,
    ];

    public static WindowTextResult Extract(IntPtr hwnd, int requestedMaxChars)
    {
        var maxChars = Math.Clamp(requestedMaxChars, 256, MaxChars);
        AutomationElement root;
        try
        {
            root = AutomationElement.FromHandle(hwnd);
        }
        catch (ElementNotAvailableException)
        {
            return new WindowTextResult(string.Empty, false);
        }
        catch (InvalidOperationException)
        {
            return new WindowTextResult(string.Empty, false);
        }

        var text = new StringBuilder(capacity: Math.Min(maxChars, 4_096));
        var observedValues = new HashSet<string>(StringComparer.Ordinal);
        var queue = new Queue<AutomationElement>();
        queue.Enqueue(root);
        var visited = 0;
        var truncated = false;

        while (queue.Count > 0 && visited < MaxElements && text.Length < maxChars)
        {
            var current = queue.Dequeue();
            visited++;

            try
            {
                if (!current.Current.IsOffscreen && IsTextControl(current.Current.ControlType))
                {
                    AppendValue(text, current.Current.Name, observedValues, maxChars, ref truncated);
                    if (text.Length < maxChars && current.TryGetCurrentPattern(TextPattern.Pattern, out var pattern))
                    {
                        var range = ((TextPattern)pattern).DocumentRange;
                        AppendValue(text, range.GetText(maxChars - text.Length), observedValues, maxChars, ref truncated);
                    }
                }

                var child = TreeWalker.ControlViewWalker.GetFirstChild(current);
                while (child is not null && queue.Count < MaxElements)
                {
                    queue.Enqueue(child);
                    child = TreeWalker.ControlViewWalker.GetNextSibling(child);
                }
            }
            catch (ElementNotAvailableException)
            {
                // The selected window can change while it is being inspected.
                continue;
            }
            catch (InvalidOperationException)
            {
                continue;
            }
        }

        if (text.Length >= maxChars) truncated = true;
        return new WindowTextResult(text.ToString().Trim(), truncated);
    }

    private static bool IsTextControl(ControlType? type) =>
        type is not null && TextControlTypes.Contains(type);

    private static void AppendValue(
        StringBuilder target,
        string? value,
        HashSet<string> observedValues,
        int maxChars,
        ref bool truncated)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        var normalized = Normalize(value);
        if (normalized.Length == 0) return;
        if (!observedValues.Add(normalized)) return;
        if (target.Length > 0) target.Append('\n');

        var remaining = maxChars - target.Length;
        if (remaining <= 0)
        {
            truncated = true;
            return;
        }

        if (normalized.Length > remaining)
        {
            target.Append(normalized.AsSpan(0, remaining));
            truncated = true;
            return;
        }

        target.Append(normalized);
    }

    private static string Normalize(string value)
    {
        var builder = new StringBuilder(value.Length);
        var previousWasWhitespace = false;
        foreach (var character in value)
        {
            if (char.IsControl(character) && character != '\t') continue;
            if (char.IsWhiteSpace(character))
            {
                if (!previousWasWhitespace) builder.Append(' ');
                previousWasWhitespace = true;
                continue;
            }

            builder.Append(character);
            previousWasWhitespace = false;
        }

        return builder.ToString().Trim();
    }
}

internal sealed record WindowTextResult(string Text, bool Truncated);
