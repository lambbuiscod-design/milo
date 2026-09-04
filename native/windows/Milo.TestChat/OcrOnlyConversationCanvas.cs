using System.Globalization;
using System.Windows;
using System.Windows.Media;

namespace Milo.TestChat;

/// <summary>
/// Owner-drawn conversation text deliberately has no TextBlock children or
/// custom AutomationPeer. It is visible for selected-window capture/OCR but
/// is not exposed as a readable UI Automation text tree.
/// </summary>
internal sealed class OcrOnlyConversationCanvas : FrameworkElement
{
    private readonly IReadOnlyList<SyntheticMessage> _messages;
    private readonly Typeface _typeface = new("Segoe UI");

    public OcrOnlyConversationCanvas(IReadOnlyList<SyntheticMessage> messages)
    {
        _messages = messages;
        SnapsToDevicePixels = true;
    }

    protected override Size MeasureOverride(Size availableSize)
    {
        var width = double.IsInfinity(availableSize.Width) ? 640 : Math.Max(320, availableSize.Width);
        return new Size(width, MeasureHeight(width));
    }

    protected override void OnRender(DrawingContext drawingContext)
    {
        base.OnRender(drawingContext);
        drawingContext.DrawRectangle(FindBrush("PanelBrush"), null, new Rect(RenderSize));
        var y = 18d;
        var maxBubbleWidth = Math.Max(220, Math.Min(560, RenderSize.Width * 0.78));
        var dip = VisualTreeHelper.GetDpi(this).PixelsPerDip;
        foreach (var message in _messages)
        {
            var formatted = new FormattedText(
                $"{message.Speaker}: {message.Text}",
                CultureInfo.CurrentCulture,
                FlowDirection.LeftToRight,
                _typeface,
                15,
                FindBrush("TextBrush"),
                dip)
            {
                MaxTextWidth = maxBubbleWidth - 28,
                Trimming = TextTrimming.CharacterEllipsis,
            };
            var bubbleWidth = Math.Min(maxBubbleWidth, Math.Max(170, formatted.Width + 28));
            var bubbleHeight = Math.Max(44, formatted.Height + 22);
            var x = message.FromSelf ? Math.Max(12, RenderSize.Width - bubbleWidth - 18) : 18;
            var bubbleBrush = FindBrush(message.FromSelf ? "SelfBubbleBrush" : "OtherBubbleBrush");
            drawingContext.DrawRoundedRectangle(bubbleBrush, null, new Rect(x, y, bubbleWidth, bubbleHeight), 14, 14);
            drawingContext.DrawText(formatted, new Point(x + 14, y + 11));
            y += bubbleHeight + 12;
        }
    }

    private double MeasureHeight(double width)
    {
        var maxBubbleWidth = Math.Max(220, Math.Min(560, width * 0.78));
        var dip = VisualTreeHelper.GetDpi(this).PixelsPerDip;
        var height = 18d;
        foreach (var message in _messages)
        {
            var formatted = new FormattedText(
                $"{message.Speaker}: {message.Text}",
                CultureInfo.CurrentCulture,
                FlowDirection.LeftToRight,
                _typeface,
                15,
                Brushes.White,
                dip)
            {
                MaxTextWidth = maxBubbleWidth - 28,
            };
            height += Math.Max(44, formatted.Height + 22) + 12;
        }
        return height + 18;
    }

    private Brush FindBrush(string key) =>
        (TryFindResource(key) as Brush) ?? Brushes.Gray;
}
