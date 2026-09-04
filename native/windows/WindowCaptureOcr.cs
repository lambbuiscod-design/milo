using System.Runtime.InteropServices;
using System.Text;
using Windows.Globalization;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;
using Windows.Graphics.DirectX.Direct3D11;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using WinRT;

namespace Milo.Native.Windows;

internal static class WindowCaptureOcr
{
    private const int MaxOcrLines = 200;
    private const int MaxOcrChars = 12_000;
    private const int FrameWaitMilliseconds = 750;
    private static readonly Guid GraphicsCaptureItemIid = new("79c3f95b-31f7-4ec2-a464-632ef5d30760");
    private static readonly Guid DxgiDeviceIid = new("db6f6ddb-ac77-4e88-8253-819df9bbf140");

    public static async Task<WindowTextResult> CaptureAndRecognizeAsync(
        IntPtr hwnd,
        string language,
        CancellationToken cancellationToken)
    {
        if (!GraphicsCaptureSession.IsSupported()) return new WindowTextResult(string.Empty, false);
        if (language is not ("en" or "it")) return new WindowTextResult(string.Empty, false);

        GraphicsCaptureItem? item = null;
        Direct3D11CaptureFramePool? framePool = null;
        GraphicsCaptureSession? session = null;
        IDirect3DDevice? device = null;
        try
        {
            item = CreateItemForWindow(hwnd);
            device = CreateDevice();
            framePool = Direct3D11CaptureFramePool.CreateFreeThreaded(
                device,
                DirectXPixelFormat.B8G8R8A8UIntNormalized,
                1,
                item.Size);
            session = framePool.CreateCaptureSession(item);
            session.IsCursorCaptureEnabled = false;
            session.StartCapture();

            var frame = await WaitForFrameAsync(framePool, cancellationToken);
            if (frame is null) return new WindowTextResult(string.Empty, false);
            try
            {
                var bitmap = await SoftwareBitmap.CreateCopyFromSurfaceAsync(frame.Surface);
                try { return await RecognizeAsync(bitmap, language, cancellationToken); }
                finally { DisposeIfSupported(bitmap); }
            }
            finally { DisposeIfSupported(frame); }
        }
        catch (OperationCanceledException)
        {
            return new WindowTextResult(string.Empty, false);
        }
        catch (COMException)
        {
            return new WindowTextResult(string.Empty, false);
        }
        catch (InvalidOperationException)
        {
            return new WindowTextResult(string.Empty, false);
        }
        finally
        {
            DisposeIfSupported(session);
            DisposeIfSupported(framePool);
            DisposeIfSupported(device);
        }
    }

    private static async Task<Direct3D11CaptureFrame?> WaitForFrameAsync(
        Direct3D11CaptureFramePool framePool,
        CancellationToken cancellationToken)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(FrameWaitMilliseconds);
        while (DateTime.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var frame = framePool.TryGetNextFrame();
            if (frame is not null) return frame;
            await Task.Delay(30, cancellationToken);
        }
        return null;
    }

    private static async Task<WindowTextResult> RecognizeAsync(
        SoftwareBitmap bitmap,
        string language,
        CancellationToken cancellationToken)
    {
        var ocrLanguage = new Language(language == "it" ? "it-IT" : "en-US");
        var engine = OcrEngine.TryCreateFromLanguage(ocrLanguage);
        if (engine is null) return new WindowTextResult(string.Empty, false);

        cancellationToken.ThrowIfCancellationRequested();
        var result = await engine.RecognizeAsync(bitmap);
        var builder = new StringBuilder();
        var truncated = false;
        foreach (var line in result.Lines.Take(MaxOcrLines))
        {
            var value = line.Text?.Trim();
            if (string.IsNullOrWhiteSpace(value)) continue;
            if (builder.Length > 0) builder.Append('\n');
            var remaining = MaxOcrChars - builder.Length;
            if (remaining <= 0) { truncated = true; break; }
            if (value.Length > remaining)
            {
                builder.Append(value.AsSpan(0, remaining));
                truncated = true;
                break;
            }
            builder.Append(value);
        }
        if (result.Lines.Count > MaxOcrLines) truncated = true;
        return new WindowTextResult(builder.ToString(), truncated);
    }

    private static GraphicsCaptureItem CreateItemForWindow(IntPtr hwnd)
    {
        var interop = GraphicsCaptureItem.As<IGraphicsCaptureItemInterop>();
        var itemIid = GraphicsCaptureItemIid;
        var itemPointer = interop.CreateForWindow(hwnd, ref itemIid);
        try
        {
            return MarshalInterface<GraphicsCaptureItem>.FromAbi(itemPointer);
        }
        finally { Marshal.Release(itemPointer); }
    }

    private static IDirect3DDevice CreateDevice()
    {
        var hr = D3D11CreateDevice(
            IntPtr.Zero,
            D3DDriverTypeHardware,
            IntPtr.Zero,
            D3D11CreateDeviceBgraSupport,
            IntPtr.Zero,
            0,
            D3D11SdkVersion,
            out var d3dDevice,
            out _,
            out var context);
        Marshal.ThrowExceptionForHR(hr);
        try
        {
            var dxgiDeviceIid = DxgiDeviceIid;
            hr = Marshal.QueryInterface(d3dDevice, in dxgiDeviceIid, out var dxgiDevice);
            Marshal.ThrowExceptionForHR(hr);
            try
            {
                hr = CreateDirect3D11DeviceFromDXGIDevice(dxgiDevice, out var graphicsDevice);
                Marshal.ThrowExceptionForHR(hr);
                try { return MarshalInterface<IDirect3DDevice>.FromAbi(graphicsDevice); }
                finally { Marshal.Release(graphicsDevice); }
            }
            finally { Marshal.Release(dxgiDevice); }
        }
        finally
        {
            Marshal.Release(context);
            Marshal.Release(d3dDevice);
        }
    }

    private const uint D3D11CreateDeviceBgraSupport = 0x20;
    private const uint D3D11SdkVersion = 7;
    private const uint D3DDriverTypeHardware = 1;

    private static void DisposeIfSupported(object? value)
    {
        if (value is IDisposable disposable) disposable.Dispose();
    }

    [DllImport("d3d11.dll", ExactSpelling = true)]
    private static extern int D3D11CreateDevice(
        IntPtr adapter,
        uint driverType,
        IntPtr software,
        uint flags,
        IntPtr featureLevels,
        uint featureLevelsCount,
        uint sdkVersion,
        out IntPtr device,
        out uint featureLevel,
        out IntPtr immediateContext);

    [DllImport("d3d11.dll", ExactSpelling = true)]
    private static extern int CreateDirect3D11DeviceFromDXGIDevice(IntPtr dxgiDevice, out IntPtr graphicsDevice);

    [ComImport, Guid("3628e81b-3cac-4c60-b7f4-23ce0e0c3356"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown), ComVisible(true)]
    private interface IGraphicsCaptureItemInterop
    {
        IntPtr CreateForWindow(IntPtr window, ref Guid iid);
    }
}
