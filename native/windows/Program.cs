using System.IO;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Milo.Native.Windows;

internal static class Program
{
    public static async Task Main()
    {
        await Protocol.RunAsync(Console.OpenStandardInput(), Console.OpenStandardOutput());
    }
}

internal static class Protocol
{
    private const int MaxLineBytes = 16 * 1024;
    private const int DefaultMaxTextChars = 6_000;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };

    public static async Task RunAsync(Stream input, Stream output)
    {
        using var reader = new StreamReader(input, leaveOpen: true);
        await using var writer = new StreamWriter(output, leaveOpen: true) { AutoFlush = true };
        var catalog = new WindowCatalog();
        BoundedLine line;
        while ((line = await ReadLineBoundedAsync(reader)).EndOfStream is false)
        {
            if (line.TooLarge)
            {
                await WriteAsync(writer, new Response(null, null, "invalid_request", "Request is too large."));
                continue;
            }

            Response response;
            try
            {
                var request = JsonSerializer.Deserialize<Request>(line.Value, JsonOptions);
                if (request is null || !IsValidRequestId(request.Id))
                {
                    response = new Response(null, null, "invalid_request", "Request format is invalid.");
                }
                else
                {
                    response = request.Type switch
                    {
                        "list_windows" => new Response(request.Id, catalog.ListEligible(), null, null),
                        "extract_text" => ExtractText(catalog, request),
                        _ => new Response(request.Id, null, "unsupported_request", "That operation is not available.")
                    };
                    if (request.Type == "capture_text")
                    {
                        response = await CaptureTextAsync(catalog, request);
                    }
                }
            }
            catch (JsonException)
            {
                response = new Response(null, null, "invalid_request", "Request format is invalid.");
            }
            catch
            {
                response = new Response(null, null, "native_failure", "Windows inspection is temporarily unavailable.");
            }

            await WriteAsync(writer, response);
        }
    }

    private static Response ExtractText(WindowCatalog catalog, Request request)
    {
        if (request.Hwnd is not > 0 || request.Pid is not > 0 ||
            !long.TryParse(request.ProcessCreationTime, NumberStyles.None, CultureInfo.InvariantCulture, out var processCreationTime) ||
            processCreationTime <= 0 ||
            request.MaxChars is < 256 or > 12_000)
        {
            return new Response(request.Id, null, "invalid_request", "A valid selected window is required.");
        }

        if (!catalog.TryGetKnownEligible(request.Hwnd.Value, request.Pid.Value, processCreationTime, out var handle))
        {
            return new Response(request.Id, null, "stale_window", "The selected window is no longer available.");
        }

        var extracted = WindowTextExtractor.Extract(handle, request.MaxChars ?? DefaultMaxTextChars);
        return new Response(request.Id, new WindowTextData(extracted.Text, extracted.Truncated), null, null);
    }

    private static async Task<Response> CaptureTextAsync(WindowCatalog catalog, Request request)
    {
        if (request.Hwnd is not > 0 || request.Pid is not > 0 ||
            !long.TryParse(request.ProcessCreationTime, NumberStyles.None, CultureInfo.InvariantCulture, out var processCreationTime) ||
            processCreationTime <= 0 || request.Language is not ("en" or "it") ||
            request.MaxChars is < 256 or > 12_000)
        {
            return new Response(request.Id, null, "invalid_request", "A valid selected window is required.");
        }

        if (!catalog.TryGetKnownEligible(request.Hwnd.Value, request.Pid.Value, processCreationTime, out var handle))
        {
            return new Response(request.Id, null, "stale_window", "The selected window is no longer available.");
        }

        var captured = await WindowCaptureOcr.CaptureAndRecognizeAsync(
            handle,
            request.Language,
            CancellationToken.None);
        return new Response(request.Id, new WindowTextData(captured.Text, captured.Truncated), null, null);
    }

    private static bool IsValidRequestId(string? value) =>
        value is not null && value.Length == 32 && value.All(static character =>
            character is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static Task WriteAsync(StreamWriter writer, Response response) =>
        writer.WriteLineAsync(JsonSerializer.Serialize(response, JsonOptions));

    private sealed record Request(string? Id, string? Type, long? Hwnd = null, uint? Pid = null, string? ProcessCreationTime = null, int? MaxChars = null, string? Language = null);
    private sealed record Response(string? Id, object? Data, string? ErrorCode, string? Error);
    private sealed record WindowTextData(string Text, bool Truncated);

    private readonly record struct BoundedLine(string Value, bool TooLarge, bool EndOfStream);

    private static async Task<BoundedLine> ReadLineBoundedAsync(StreamReader reader)
    {
        // StreamReader already buffers the underlying pipe. Consume one UTF-16
        // code unit at a time so a newline never discards the next request from
        // the same pipe write, and short requests do not wait for a full block.
        var buffer = new char[1];
        var value = new StringBuilder(capacity: 1_024);
        var tooLarge = false;
        var utf8ByteCount = 0;
        char? pendingHighSurrogate = null;

        void AppendScalar(int byteCount, string scalar)
        {
            if (tooLarge) return;
            if (utf8ByteCount + byteCount > MaxLineBytes)
            {
                tooLarge = true;
                return;
            }

            value.Append(scalar);
            utf8ByteCount += byteCount;
        }

        void FlushPendingHighSurrogate()
        {
            if (pendingHighSurrogate.HasValue)
            {
                AppendScalar(3, "\uFFFD");
                pendingHighSurrogate = null;
            }
        }

        void ProcessCharacter(char character)
        {
            if (pendingHighSurrogate is char high)
            {
                if (char.IsLowSurrogate(character))
                {
                    AppendScalar(4, new string(new[] { high, character }));
                    pendingHighSurrogate = null;
                    return;
                }

                FlushPendingHighSurrogate();
            }

            if (char.IsHighSurrogate(character))
            {
                pendingHighSurrogate = character;
                return;
            }

            if (char.IsLowSurrogate(character))
            {
                AppendScalar(3, "\uFFFD");
                return;
            }

            AppendScalar(Utf8ByteCountForBmpChar(character), character.ToString());
        }

        while (true)
        {
            var read = await reader.ReadAsync(buffer.AsMemory());
            if (read == 0)
            {
                FlushPendingHighSurrogate();
                return value.Length == 0
                    ? new BoundedLine(string.Empty, tooLarge, true)
                    : new BoundedLine(value.ToString(), tooLarge, false);
            }

            for (var index = 0; index < read; index++)
            {
                var character = buffer[index];
                if (character == '\n')
                {
                    FlushPendingHighSurrogate();
                    return new BoundedLine(value.ToString(), tooLarge, false);
                }

                if (character == '\r') continue;
                ProcessCharacter(character);
            }
        }
    }

    private static int Utf8ByteCountForBmpChar(char character) => character switch
    {
        <= '\u007f' => 1,
        <= '\u07ff' => 2,
        _ => 3,
    };
}
