using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;

namespace Milo.TestChat;

public partial class MainWindow : Window
{
    private readonly FixtureOptions _options;
    private readonly List<SyntheticMessage> _messages;
    private int _appendCount;
    private readonly DispatcherTimer? _autoAppendTimer;

    public MainWindow(FixtureOptions options, int instance = 1)
    {
        InitializeComponent();
        _options = options;
        _messages = SyntheticConversation.Initial(options.Language).ToList();
        InstanceText.Text = $"Window {instance}";
        SubtitleText.Text = $"{ModeLabel(options.Mode)} • {LanguageLabel(options.Language)}";
        RenderConversation();
        if (options.AutoAppendMilliseconds is int delay)
        {
            _autoAppendTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(delay) };
            _autoAppendTimer.Tick += (_, _) =>
            {
                _autoAppendTimer.Stop();
                AppendSyntheticMessage();
            };
            Closed += (_, _) => _autoAppendTimer.Stop();
            _autoAppendTimer.Start();
        }
    }

    private void RenderConversation()
    {
        ConversationHost.Children.Clear();
        if (_options.Mode == FixtureMode.OcrOnly)
        {
            ConversationHost.Children.Add(new OcrOnlyConversationCanvas(_messages));
            return;
        }

        var stack = new StackPanel { Margin = new Thickness(18) };
        foreach (var message in _messages)
        {
            var text = new TextBlock
            {
                Text = $"{message.Speaker}: {message.Text}",
                TextWrapping = TextWrapping.Wrap,
                FontSize = 15,
                Foreground = FindBrush("TextBrush"),
            };
            AutomationProperties.SetName(text, $"{message.Speaker} message: {message.Text}");
            var bubble = new Border
            {
                Background = FindBrush(message.FromSelf ? "SelfBubbleBrush" : "OtherBubbleBrush"),
                CornerRadius = new CornerRadius(14),
                Padding = new Thickness(14, 10, 14, 10),
                Margin = new Thickness(message.FromSelf ? 90 : 0, 0, message.FromSelf ? 0 : 90, 12),
                Child = text,
            };
            stack.Children.Add(bubble);
        }
        ConversationHost.Children.Add(stack);
    }

    private void AppendButton_OnClick(object sender, RoutedEventArgs e)
    {
        AppendSyntheticMessage();
    }

    private void AppendSyntheticMessage()
    {
        _messages.Add(SyntheticConversation.Appended(_options.Language, _appendCount++));
        RenderConversation();
        ConversationScroll.ScrollToEnd();
    }

    private void RecreateButton_OnClick(object sender, RoutedEventArgs e)
    {
        var next = new MainWindow(_options, ParseInstance() + 1);
        Application.Current.MainWindow = next;
        next.Show();
        Close();
    }

    private void CloseButton_OnClick(object sender, RoutedEventArgs e) => Close();

    private int ParseInstance() =>
        int.TryParse(InstanceText.Text.Replace("Window ", string.Empty, StringComparison.Ordinal), out var value) ? value : 1;

    private SolidColorBrush FindBrush(string key) =>
        (TryFindResource(key) as SolidColorBrush) ?? Brushes.Gray;

    private static string ModeLabel(FixtureMode mode) => mode == FixtureMode.Uia ? "UIA accessible" : "OCR-only visual";

    private static string LanguageLabel(FixtureLanguage language) => language == FixtureLanguage.Italian ? "Italian" : "English";
}
