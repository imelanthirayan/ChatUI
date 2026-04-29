import { NextResponse } from "next/server";
import { APP_CONFIG } from "../../chat.config";

// ============================================================================
// LLM PROXY ROUTE — Routes to different backends per chatOption (streaming)
// Supports: azure-openai, openai, ollama, custom
// ============================================================================

interface EndpointConfig {
  url: string;
  type: string;
  model?: string;
  stream?: boolean;
}

function resolveEndpointConfig(chatOption: string): EndpointConfig {
  const ep = APP_CONFIG.endpoints;
  const raw = ep[chatOption] ?? ep["*"] ?? process.env.LLM_BACKEND_URL ?? "http://localhost:8000/chat";

  if (typeof raw === "string") {
    // Auto-detect type from URL
    let type = "openai";
    if (raw.includes("openai.azure.com") || raw.includes("cognitiveservices.azure.com")) {
      type = "azure-openai";
    } else if (raw.includes("11434") || raw.includes("/api/chat") || raw.includes("/api/generate")) {
      type = "ollama";
    }
    return { url: raw, type };
  }

  return {
    url: raw.url,
    type: raw.type ?? "openai",
    model: raw.model,
    stream: raw.stream,
  };
}

function resolveApiKey(chatOption: string): string | undefined {
  const keys = APP_CONFIG.apiKeys ?? {};
  return (
    keys[chatOption] ??
    keys["*"] ??
    process.env.LLM_API_KEY ??
    undefined
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const chatOption = body.chatOption ?? "";
  const endpointConfig = resolveEndpointConfig(chatOption);
  const { url: backendUrl, type: providerType, model, stream: shouldStream = true } = endpointConfig;
  const apiKey = resolveApiKey(chatOption);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Only add auth headers for providers that need them
    if (apiKey && (providerType === "azure-openai" || providerType === "openai")) {
      if (providerType === "azure-openai") {
        headers["api-key"] = apiKey;
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];

    // Add system prompt from chatOption config if available
    const chatOptionConfig = APP_CONFIG.chatOptions.find((o: { value: string }) => o.value === chatOption);
    const systemPrompt = body.systemPrompt || (chatOptionConfig as { systemPrompt?: string })?.systemPrompt;
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    if (Array.isArray(body.history)) {
      for (const msg of body.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: "user", content: body.message });

    // Build request body based on provider type
    let reqBody: Record<string, unknown>;

    if (providerType === "ollama") {
      // Ollama uses its own format: { model, messages, stream }
      reqBody = {
        model: model ?? "llama3",
        messages,
        stream: shouldStream,
      };
    } else {
      // OpenAI / Azure OpenAI compatible
      reqBody = {
        messages,
        stream: shouldStream,
        ...(model ? { model } : {}),
      };
    }

    const backendRes = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text();
      console.error(`[/api/llm] Backend returned ${backendRes.status}:`, errText);
      return NextResponse.json(
        { response: `Backend error (${backendRes.status}): ${errText}` },
        { status: 502 }
      );
    }

    // Non-streaming response
    if (!shouldStream) {
      const data = await backendRes.json();
      let content = "";
      if (providerType === "ollama") {
        content = data.message?.content ?? "";
      } else {
        content = data.choices?.[0]?.message?.content ?? "";
      }
      // Return as a single SSE event for the client
      const ssePayload = `data: ${JSON.stringify({ content })}\n\ndata: [DONE]\n\n`;
      return new Response(ssePayload, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    // Streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            if (providerType === "ollama") {
              // Ollama streams newline-delimited JSON
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                  const parsed = JSON.parse(trimmed);
                  const content = parsed.message?.content ?? "";
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                  if (parsed.done) {
                    controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                  }
                } catch {
                  // skip malformed
                }
              }
            } else {
              // OpenAI / Azure OpenAI SSE format
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const data = trimmed.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                  continue;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content ?? "";
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[/api/llm] Backend unreachable (${backendUrl}):`, msg);

    return NextResponse.json({
      response:
        `⚠️ Could not reach backend at \`${backendUrl}\`\n` +
        `(chatOption: **${chatOption}**, type: **${providerType}**)\n\n` +
        `Configure endpoints in \`app/chat.config.ts → endpoints\`\n\n` +
        `Error: ${msg}`,
    });
  }
}
