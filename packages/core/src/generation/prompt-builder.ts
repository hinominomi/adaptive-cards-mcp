/**
 * Prompt Builder — Construct LLM prompts with expert AC knowledge and few-shot examples
 *
 * Instead of dumping the raw 3297-line schema into prompts, this module builds
 * a concise but comprehensive Adaptive Cards authoring guide that is far more
 * useful and token-efficient for LLM generation.
 */

import { selectExamples } from "./example-selector.js";
import type { HostApp, CardIntent } from "../types/index.js";

// ─── Host Compatibility Constraints ──────────────────────────────────────────

const HOST_CONSTRAINTS: Record<Exclude<HostApp, "generic">, string> = {
  teams:
    "Microsoft Teams — AC v1.6. Max 6 actions at card level. All elements supported except Media. " +
    "Prefer Action.Execute with verb for bot interactions. Charts supported (Chart.BarChart, " +
    "Chart.LineChart, Chart.PieChart, Chart.DonutChart, Chart.HorizontalBar, Chart.HorizontalBarStacked, " +
    "Chart.VerticalBarStacked, Chart.Gauge). Carousel supported. CodeBlock supported. " +
    "Rating, RatingInput, and ProgressBar supported.",
  outlook:
    "Microsoft Outlook — AC v1.4 ONLY. NO Table, Carousel, Charts, CodeBlock, Rating, ProgressBar. " +
    "Max 4 actions at card level. Use ColumnSet with Columns instead of Table for tabular layouts. " +
    "Action.Execute requires Universal Action Model (UAM) — ensure your bot is registered. " +
    "Actionable messages require originator registration.",
  webchat:
    "Bot Framework WebChat — AC v1.6. Full element support including Table, Carousel, Charts. " +
    "Max 10 actions at card level. Action.Execute supported with bot framework integration.",
  windows:
    "Windows Notifications — AC v1.6. No Carousel, no Charts. Max 5 actions at card level. " +
    "Cards render in Windows notification center and widgets. Keep cards compact.",
  "viva-connections":
    "Viva Connections — AC v1.4 ONLY. Similar constraints to Outlook: NO Table, Carousel, Charts, " +
    "CodeBlock, Rating, ProgressBar. Max 4 actions. Runs within SPFx ACE (Adaptive Card Extension) " +
    "framework. Card and Quick View modes. Keep Quick View cards focused and concise.",
  webex:
    "Cisco Webex — AC v1.3 ONLY. NO Table, Carousel, Action.Execute, Charts, CodeBlock, Rating, " +
    "ProgressBar, RichTextBlock. Use Action.Submit instead of Action.Execute. Max 5 actions. " +
    "Limited styling support — avoid advanced container styles.",
};

// ─── Expert System Prompt ────────────────────────────────────────────────────

function buildHostSection(host?: HostApp): string {
  if (!host || host === "generic") {
    return (
      "Target: Generic / unknown host. Use AC v1.6 features freely but prefer widely-supported " +
      "elements for maximum compatibility. Avoid host-specific features like Charts unless requested."
    );
  }
  return `Target: ${HOST_CONSTRAINTS[host]}`;
}

/**
 * Build the system prompt for card generation
 */
export function buildSystemPrompt(host?: HostApp): string {
  return `You are an expert Adaptive Card v1.6 architect. You generate valid, production-ready Adaptive Card JSON that is accessible, well-structured, and visually polished.

## Element Reference (when to use what)

### Display Elements
- **TextBlock**: Text content. Key props: text (required), size (small/default/medium/large/extraLarge), weight (lighter/default/bolder), color (default/dark/light/accent/good/attention/warning), wrap (ALWAYS true), style ("heading" for titles), isSubtle, horizontalAlignment, maxLines, fontType (default/monospace).
- **Image**: Images. Key props: url (required), altText (ALWAYS include), size (auto/stretch/small/medium/large), style (default/person for circular avatars), horizontalAlignment, width, height, selectAction, backgroundColor.
- **RichTextBlock**: Formatted text with inline formatting. Contains inlines[] of TextRun objects. TextRun props: text, weight, italic, strikethrough, highlight, color, size, fontType, selectAction. Use when you need mixed formatting within a single paragraph.
- **Media**: Video/audio playback. Props: sources[{mimeType, url}], poster (thumbnail URL), altText. Limited host support.
- **CodeBlock** (v1.6): Syntax-highlighted code. Props: codeSnippet (required), language (e.g. "javascript", "python", "json"), startLineNumber.
- **Rating** (v1.6): Display star rating. Props: value (0-5), max, size, color, count (text showing vote count).
- **ProgressBar** (v1.6): Progress indicator. Props: value (0-1), label, color.

### Container Elements
- **Container**: Groups elements vertically. Props: items[] (required), style (default/emphasis/good/attention/warning/accent), bleed, minHeight, selectAction, verticalContentAlignment, backgroundImage, rtl, separator, spacing.
- **ColumnSet**: Side-by-side columns. Contains columns[] of Column objects. Each Column has: width (auto/stretch/"1"/"2" weighted numbers or "50px" fixed), items[], style, verticalContentAlignment, selectAction, minHeight, bleed.
- **FactSet**: Key-value pairs displayed as label-value rows. Contains facts[{title, value}]. Best for metadata, status fields, contact details, properties. Compact and readable.
- **Table** (v1.5+): Tabular data with rows and cells. Props: columns[{width}], rows[{type:"TableRow", cells[{type:"TableCell", items[]}]}], firstRowAsHeader (true for header row), showGridLines, gridStyle (default/accent), horizontalCellContentAlignment, verticalCellContentAlignment.
- **ImageSet**: Grid of multiple images. Props: images[] (Image objects), imageSize (auto/stretch/small/medium/large).
- **ActionSet**: Inline action buttons within the body (not at card level). Props: actions[].
- **Carousel** (v1.6): Swipeable pages. Props: pages[{type:"CarouselPage", items[]}], timer (auto-advance ms), heightInPixels, initialPage.

### Input Elements (ALWAYS include "id" and "label")
- **Input.Text**: Text input. Props: id (required), label (required), placeholder, isMultiline, style (text/tel/url/email/password), maxLength, value, isRequired, errorMessage, regex.
- **Input.Number**: Numeric input. Props: id (required), label (required), min, max, value, placeholder, isRequired, errorMessage.
- **Input.Date**: Date picker. Props: id (required), label (required), min, max, value, placeholder, isRequired, errorMessage.
- **Input.Time**: Time picker. Props: id (required), label (required), min, max, value, placeholder, isRequired, errorMessage.
- **Input.Toggle**: Boolean switch. Props: id (required), label (required), title (display text), value, valueOn ("true"), valueOff ("false"), isRequired.
- **Input.ChoiceSet**: Dropdown/radio/checkbox. Props: id (required), label (required), choices[{title, value}] (required), style (compact=dropdown/expanded=radio/filtered=searchable dropdown), isMultiSelect, value (default), placeholder, isRequired, errorMessage.
- **RatingInput** (v1.6): Star rating input. Props: id (required), label (required), max, value, size, color.

### Action Types
- **Action.Execute** (PREFERRED): Universal action for bot/backend interaction. Props: title (required), verb (action identifier), data (payload object), style (default/positive/destructive), associatedInputs (auto/none), tooltip, iconUrl, isEnabled.
- **Action.OpenUrl**: Open a URL in browser. Props: title (required), url (required), tooltip, iconUrl.
- **Action.ShowCard**: Expand a nested inline card. Props: title (required), card (full AdaptiveCard object without version). Good for progressive disclosure.
- **Action.ToggleVisibility**: Show/hide elements by ID. Props: title (required), targetElements[] (string IDs or {elementId, isVisible} objects). Elements must have "id" set.
- **Action.Submit** (DEPRECATED — use Action.Execute): Legacy action. Props: title, data. Only use for Webex or legacy bots that don't support Action.Execute.

## Host Compatibility
${buildHostSection(host)}

## Accessibility Rules (MANDATORY)
1. EVERY TextBlock MUST have "wrap": true — without it text is clipped and unreadable.
2. EVERY Image MUST have "altText" with a meaningful description (not "image" or "icon").
3. EVERY Input element MUST have both "id" and "label" properties.
4. EVERY Action MUST have a "title" property with clear, actionable text.
5. The card SHOULD have a "$schema" property: "http://adaptivecards.io/schemas/adaptive-card.json".
6. The first heading TextBlock should use style: "heading" for semantic structure.
7. Use "isSubtle": true for secondary/supporting text to create visual hierarchy.
8. Use "separator": true or "spacing" to create clear visual grouping.
9. Color alone must not convey meaning — pair color with text or icons.

## Design Patterns
- **Approval cards**: Container(style:"emphasis") with header → ColumnSet(Image style:"person" + Column with name/role) → FactSet(request details, dates, amounts) → ActionSet or card-level actions with Action.Execute(verb:"approve", style:"positive") and Action.Execute(verb:"reject", style:"destructive").
- **Data tables**: TextBlock(style:"heading") → Table(firstRowAsHeader:true, showGridLines:true, gridStyle:"accent") with typed columns. For hosts without Table support, use ColumnSet with bold header row.
- **Forms**: TextBlock(style:"heading") → Input fields each with label and placeholder → Action.Execute(verb:"submit", style:"positive", associatedInputs:"auto"). Group related inputs in Containers.
- **Notifications/Alerts**: Container(style:"attention"/"good"/"warning", bleed:true) → TextBlock(style:"heading", color matching severity) → TextBlock(body, wrap:true) → Action.OpenUrl or Action.Execute.
- **Dashboards/KPIs**: TextBlock(style:"heading") → ColumnSet with metric columns, each containing: TextBlock(isSubtle:true, size:"small" for label) + TextBlock(size:"extraLarge", weight:"bolder", color:"accent" for value). Use good/attention/warning colors for status indicators.
- **Profile/Contact cards**: ColumnSet(Column(width:"auto", Image style:"person" size:"large") + Column(width:"stretch", TextBlock name + TextBlock role isSubtle)) → FactSet(email, phone, location, department) → Action.OpenUrl(email/LinkedIn/Teams chat).
- **List/Feed cards**: TextBlock(style:"heading") → repeating Container items each with: ColumnSet(icon/avatar + content column with title + subtitle) and optional selectAction. Use separator:true between items.
- **Gallery/Media cards**: TextBlock(style:"heading") → ImageSet(imageSize:"medium") or ColumnSet grid of Image cards. Include altText on every image.

## Anti-patterns (NEVER do these)
- NEVER omit "wrap": true on TextBlock — text will be silently clipped on every host.
- NEVER use Action.Submit in new cards — always use Action.Execute (except Webex v1.3).
- NEVER nest containers more than 4 levels deep — cards become unreadable and may fail to render.
- NEVER exceed the host's action limit (6 for Teams, 4 for Outlook, 5 for Windows/Webex, 10 for WebChat).
- NEVER use images without altText — this fails accessibility requirements.
- NEVER use inputs without both id and label properties.
- NEVER return markdown code fences, explanations, or commentary — pure JSON only.
- NEVER use "version" other than what the target host supports.
- NEVER create empty containers, columns with no items, or actions with no title.
- NEVER use pixel-based sizing when percentage/stretch/auto would be more responsive.

## Output Format
Return ONLY valid JSON. The root object must be:
{"type": "AdaptiveCard", "$schema": "http://adaptivecards.io/schemas/adaptive-card.json", "version": "${host && HOST_CONSTRAINTS[host as Exclude<HostApp, "generic">] ? (host === "outlook" || host === "viva-connections" ? "1.4" : host === "webex" ? "1.3" : "1.6") : "1.6"}", "body": [...], "actions": [...]}
No markdown code fences. No explanation. No commentary. Pure JSON only.`;
}

// ─── User Prompt Builder ─────────────────────────────────────────────────────

/**
 * Build the user prompt for card generation
 */
export function buildUserPrompt(options: {
  content: string;
  data?: unknown;
  intent?: CardIntent;
  host?: HostApp;
}): string {
  const parts: string[] = [];

  // Add relevant examples (3 examples, truncated to 3000 chars each)
  const examples = selectExamples(options.content, 3);
  if (examples.length > 0) {
    parts.push("## Reference Examples");
    parts.push("Use these as style and structure references:\n");
    for (const ex of examples) {
      const exJson = JSON.stringify(ex.content, null, 2).slice(0, 3000);
      parts.push(`### ${ex.name}\n\`\`\`json\n${exJson}\n\`\`\`\n`);
    }
  }

  // Add host constraints reminder inline
  if (options.host && options.host !== "generic") {
    parts.push(
      `## Host Constraints Reminder\nTarget host: **${options.host}**. ${HOST_CONSTRAINTS[options.host]} Ensure all elements and actions are compatible.\n`
    );
  }

  // Add the request
  parts.push("## Request");
  parts.push(options.content);

  if (options.intent) {
    parts.push(`\nIntent: ${options.intent}`);
  }

  if (options.data) {
    const dataStr =
      typeof options.data === "string"
        ? options.data
        : JSON.stringify(options.data, null, 2);
    parts.push(
      `\n## Data to incorporate\n\`\`\`json\n${dataStr.slice(0, 3000)}\n\`\`\``
    );
  }

  // Accessibility and quality reminders
  parts.push(
    "\n## Reminders\n" +
      "- Ensure ALL accessibility rules are followed (wrap:true, altText, labels, action titles).\n" +
      "- Use the most appropriate design pattern for the intent.\n" +
      "- Return ONLY valid Adaptive Card JSON. No explanation or code fences."
  );

  parts.push("\nGenerate the Adaptive Card JSON now.");

  return parts.join("\n");
}

// ─── Data-to-Card Prompt ─────────────────────────────────────────────────────

/**
 * Build a prompt specifically for data-to-card conversion
 */
export function buildDataToCardPrompt(options: {
  data: unknown;
  title?: string;
  presentation?: string;
}): string {
  const dataStr =
    typeof options.data === "string"
      ? options.data
      : JSON.stringify(options.data, null, 2);

  const presentationGuidance =
    options.presentation && options.presentation !== "auto"
      ? `Use **${options.presentation}** presentation style.`
      : `Choose the best presentation automatically:
  - **Table** (firstRowAsHeader, showGridLines) for tabular/multi-row data
  - **FactSet** for key-value pairs, metadata, or single-record properties
  - **Chart** (Chart.BarChart, Chart.LineChart, Chart.PieChart) for numeric series or comparisons
  - **ColumnSet with metrics** for KPI/dashboard numbers (extraLarge + subtle label)
  - **List with Containers** for arrays of items with titles and descriptions`;

  return `Convert the following data into a well-structured Adaptive Card.${options.title ? ` Card title: "${options.title}".` : ""}

## Presentation
${presentationGuidance}

## Data
\`\`\`json
${dataStr.slice(0, 4000)}
\`\`\`

## Requirements
- Follow ALL accessibility rules: wrap:true on TextBlocks, altText on Images, label+id on Inputs, title on Actions.
- Use style:"heading" on the title TextBlock.
- Add visual hierarchy with isSubtle, separator, spacing, and container styles.
- If the data has status/state fields, use appropriate colors (good/attention/warning).
- Return ONLY valid Adaptive Card JSON. No explanation or code fences.

Generate the Adaptive Card JSON now.`;
}
