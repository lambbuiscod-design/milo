using System.Runtime.InteropServices;
using System.Globalization;

namespace Milo.Native.Windows;

internal sealed class WindowCatalog
{
    private const int GwlExstyle = -20;
    private const long WsExToolWindow = 0x00000080;
    private const long WsExNoActivate = 0x08000000;

    private readonly object sync = new();
    private readonly HashSet<WindowIdentity> knownWindows = new();

    public IReadOnlyList<WindowCandidate> ListEligible()
    {
        var result = new List<WindowCandidate>(capacity: 32);
        EnumWindows((hwnd, _) =>
        {
            if (result.Count >= 100 || !IsEligible(hwnd)) return true;
            GetWindowThreadProcessId(hwnd, out var pid);
            if (pid == 0 || pid == Environment.ProcessId ||
                !TryGetProcessCreationTime(pid, out var processCreationTime)) return true;
            result.Add(new WindowCandidate(
                hwnd.ToInt64(),
                pid,
                processCreationTime.ToString(CultureInfo.InvariantCulture)));
            return true;
        }, IntPtr.Zero);

        lock (sync)
        {
            knownWindows.Clear();
            foreach (var candidate in result)
            {
                if (long.TryParse(candidate.ProcessCreationTime, NumberStyles.None, CultureInfo.InvariantCulture, out var processCreationTime))
                {
                    knownWindows.Add(new WindowIdentity(candidate.Hwnd, candidate.Pid, processCreationTime));
                }
            }
        }

        return result;
    }

    public bool TryGetKnownEligible(long hwnd, uint pid, long processCreationTime, out IntPtr handle)
    {
        handle = IntPtr.Zero;
        if (hwnd <= 0 || pid == 0 || processCreationTime <= 0) return false;

        lock (sync)
        {
            if (!knownWindows.Contains(new WindowIdentity(hwnd, pid, processCreationTime))) return false;
        }

        var candidate = new IntPtr(hwnd);
        if (!IsEligible(candidate)) return false;
        GetWindowThreadProcessId(candidate, out var currentPid);
        if (currentPid != pid) return false;
        if (!TryGetProcessCreationTime(currentPid, out var currentCreationTime) ||
            currentCreationTime != processCreationTime) return false;
        handle = candidate;
        return true;
    }

    private static bool TryGetProcessCreationTime(uint pid, out long processCreationTime)
    {
        processCreationTime = 0;
        var processHandle = OpenProcess(ProcessQueryLimitedInformation, false, pid);
        if (processHandle == IntPtr.Zero) return false;

        try
        {
            if (!GetProcessTimes(processHandle, out var creation, out _, out _, out _)) return false;
            processCreationTime = ((long)(uint)creation.HighDateTime << 32) | (uint)creation.LowDateTime;
            return processCreationTime > 0;
        }
        finally
        {
            CloseHandle(processHandle);
        }
    }

    private static bool IsEligible(IntPtr hwnd)
    {
        if (!IsWindowVisible(hwnd) || GetWindow(hwnd, 4) != IntPtr.Zero) return false;
        var style = GetWindowLongPtr(hwnd, GwlExstyle).ToInt64();
        return (style & WsExToolWindow) == 0 && (style & WsExNoActivate) == 0;
    }

    [DllImport("user32.dll", SetLastError = true)] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex);
    private const uint ProcessQueryLimitedInformation = 0x1000;
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint processId);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetProcessTimes(IntPtr processHandle, out NativeFileTime creation, out NativeFileTime exit, out NativeFileTime kernel, out NativeFileTime user);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool CloseHandle(IntPtr handle);
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeFileTime
    {
        public int LowDateTime;
        public int HighDateTime;
    }
}

internal sealed record WindowCandidate(long Hwnd, uint Pid, string ProcessCreationTime);
internal readonly record struct WindowIdentity(long Hwnd, uint Pid, long ProcessCreationTime);
