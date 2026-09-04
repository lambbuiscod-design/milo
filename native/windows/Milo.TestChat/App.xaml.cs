using System.Windows;

namespace Milo.TestChat;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        var options = FixtureOptions.Parse(e.Args);
        MainWindow = new MainWindow(options);
        MainWindow.Show();
    }
}
