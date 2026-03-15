/**
 * LLM-powered card generation supporting:
 * - GitHub Copilot (via VS Code Language Model API)
 * - Anthropic Claude (via REST API)
 * - OpenAI GPT (via REST API)
 */
import * as vscode from "vscode";
import * as https from "https";

const SYSTEM_PROMPT = `You are an expert Adaptive Card v1.6 architect. You generate valid, production-ready Adaptive Card JSON.

## Rules
1. The root object MUST have "type": "AdaptiveCard" and "version": "1.6".
2. Use proper element types: TextBlock, Image, Container, ColumnSet, Column, FactSet, Table, TableRow, TableCell, ActionSet, ImageSet, Carousel, CarouselPage.
3. Use proper action types: Action.Execute (preferred over Action.Submit), Action.OpenUrl, Action.ShowCard, Action.ToggleVisibility.
4. ALWAYS set "wrap": true on TextBlock elements.
5. ALWAYS include "altText" on Image elements.
6. ALWAYS include "label" and "id" on Input.* elements.
7. Use "style": "heading" on title TextBlocks with "size": "medium" and "weight": "bolder".
8. Use "style": "emphasis" on header Containers for visual separation.
9. Use ColumnSet for side-by-side layouts, Table for tabular data, FactSet for key-value pairs.
10. For data tables: use Table with firstRowAsHeader:true, showGridLines:true, gridStyle:"accent".
11. For forms: use Input.Text, Input.ChoiceSet, Input.Date, Input.Toggle with labels.
12. For approvals: include Action.Execute with "style":"positive" for approve and "style":"destructive" for reject.
13. For dashboards: use ColumnSet with metric columns showing large numbers.
14. Include a "speak" property on the root card for accessibility.
15. Keep cards practical and realistic — use concrete placeholder data, not "Lorem ipsum".

## Output Format
Return ONLY the Adaptive Card JSON object. No markdown code fences, no explanation, no comments. Pure JSON only.`;

function buildUserMessage(description: string, host: string, intent?: string): string {
  let msg = description;
  if (host && host !== "generic") {
    msg += `\n\nTarget host: ${host}. Generate a card compatible with ${host}.`;
  }
  if (intent) {
    msg += `\nCard intent: ${intent}.`;
  }
  msg += "\n\nGenerate the Adaptive Card JSON now.";
  return msg;
}

/**
 * Generate using the configured AI provider.
 * Returns null if provider is unavailable or fails.
 */
export async function generateWithAI(
  description: string,
  host: string,
  intent?: string
): Promise<{ card: Record<string, unknown>; provider: string } | null> {
  const config = vscode.workspace.getConfiguration("adaptiveCards");
  const provider = config.get<string>("aiProvider", "none");

  if (provider === "none") {
    return null;
  }

  const userMessage = buildUserMessage(description, host, intent);

  switch (provider) {
    case "copilot":
      return generateWithCopilot(userMessage);
    case "anthropic":
      return generateWithAnthropic(userMessage, config.get<string>("anthropicApiKey", ""));
    case "openai":
      return generateWithOpenAI(userMessage, config.get<string>("openaiApiKey", ""));
    default:
      return null;
  }
}

// ─── Copilot ────────────────────────────────────────────────────────────────

async function generateWithCopilot(
  userMessage: string
): Promise<{ card: Record<string, unknown>; provider: string } | null> {
  try {
    const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
    if (models.length === 0) {
      vscode.window.showWarningMessage(
        "GitHub Copilot not available. Install Copilot extension or switch to another AI provider in settings."
      );
      return null;
    }

    const messages = [
      vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT),
      vscode.LanguageModelChatMessage.User(userMessage),
    ];

    const response = await models[0].sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token
    );

    let fullText = "";
    for await (const chunk of response.text) {
      fullText += chunk;
    }

    const card = extractCardJson(fullText);
    return card ? { card, provider: "Copilot" } : null;
  } catch (e) {
    console.error("Copilot error:", e);
    return null;
  }
}

// ─── Anthropic Claude ───────────────────────────────────────────────────────

async function generateWithAnthropic(
  userMessage: string,
  apiKey: string
): Promise<{ card: Record<string, unknown>; provider: string } | null> {
  if (!apiKey) {
    vscode.window.showWarningMessage(
      "Set adaptiveCards.anthropicApiKey in settings, or switch AI provider."
    );
    return null;
  }

  try {
    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const responseText = await httpPost(
      "api.anthropic.com",
      "/v1/messages",
      {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body
    );

    const response = JSON.parse(responseText);
    const content = response.content?.[0]?.text || "";
    const card = extractCardJson(content);
    return card ? { card, provider: "Claude" } : null;
  } catch (e) {
    console.error("Anthropic error:", e);
    vscode.window.showWarningMessage("Claude API error: " + (e instanceof Error ? e.message : e));
    return null;
  }
}

// ─── OpenAI GPT ─────────────────────────────────────────────────────────────

async function generateWithOpenAI(
  userMessage: string,
  apiKey: string
): Promise<{ card: Record<string, unknown>; provider: string } | null> {
  if (!apiKey) {
    vscode.window.showWarningMessage(
      "Set adaptiveCards.openaiApiKey in settings, or switch AI provider."
    );
    return null;
  }

  try {
    const body = JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });

    const responseText = await httpPost(
      "api.openai.com",
      "/v1/chat/completions",
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body
    );

    const response = JSON.parse(responseText);
    const content = response.choices?.[0]?.message?.content || "";
    const card = extractCardJson(content);
    return card ? { card, provider: "GPT-4o" } : null;
  } catch (e) {
    console.error("OpenAI error:", e);
    vscode.window.showWarningMessage("OpenAI API error: " + (e instanceof Error ? e.message : e));
    return null;
  }
}

// ─── HTTP Helper ────────────────────────────────────────────────────────────

function httpPost(
  hostname: string,
  path: string,
  headers: Record<string, string>,
  body: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── JSON Extraction ────────────────────────────────────────────────────────

function extractCardJson(text: string): Record<string, unknown> | null {
  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed?.type === "AdaptiveCard") return parsed;
  } catch { /* not direct JSON */ }

  // Find JSON object in text
  const jsonMatch = text.match(/\{[\s\S]*"type"\s*:\s*"AdaptiveCard"[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* try cleanup */ }
    try {
      const cleaned = jsonMatch[0].replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      return JSON.parse(cleaned);
    } catch { /* give up */ }
  }

  return null;
}
