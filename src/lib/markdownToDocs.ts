import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type {
  Root,
  Content,
  Parent,
  PhrasingContent,
  ListItem,
  Table,
  TableRow,
  TableCell,
  FootnoteDefinition,
} from "mdast";

type NamedStyleType =
  | "NORMAL_TEXT"
  | "TITLE"
  | "SUBTITLE"
  | "HEADING_1"
  | "HEADING_2"
  | "HEADING_3"
  | "HEADING_4"
  | "HEADING_5"
  | "HEADING_6";

type MarkState = {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
  superscript?: boolean;
};

type InlineSegment =
  | {
      type: "text";
      text: string;
      marks: MarkState;
    }
  | {
      type: "image";
      url: string;
      alt?: string;
      title?: string | null;
    };

export type GoogleDocsRequest = Record<string, unknown>;

export type ConversionResult = {
  plainText: string;
  requests: GoogleDocsRequest[];
};

type FootnoteContext = {
  definitions: Map<string, Content[]>;
  order: string[];
  indexByIdentifier: Map<string, number>;
};

const HEADING_BY_DEPTH: Record<number, NamedStyleType> = {
  1: "HEADING_1",
  2: "HEADING_2",
  3: "HEADING_3",
  4: "HEADING_4",
  5: "HEADING_5",
  6: "HEADING_6",
};

class DocsRequestBuilder {
  private requests: GoogleDocsRequest[] = [];
  private cursor = 1;
  private plain = "";

  getResult(): ConversionResult {
    return { plainText: this.plain.trimEnd(), requests: this.requests };
  }

  appendNewline() {
    this.insertText("\n");
  }

  appendParagraphFromInline(segments: InlineSegment[]) {
    this.insertInlineSegments(segments);
    this.insertText("\n");
  }

  appendNamedStyleParagraph(
    segments: InlineSegment[],
    namedStyleType: NamedStyleType
  ) {
    const start = this.cursor;
    this.insertInlineSegments(segments);
    this.insertText("\n");
    const end = this.cursor;
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType },
        fields: "namedStyleType",
      },
    });
  }

  appendHorizontalRule() {
    const start = this.cursor;
    this.insertText("──────────────\n");
    const end = this.cursor;
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          borderBottom: {
            color: { color: { rgbColor: { red: 0.7, green: 0.7, blue: 0.7 } } },
            width: { magnitude: 1, unit: "PT" },
            padding: { magnitude: 1, unit: "PT" },
            dashStyle: "SOLID",
          },
          spaceBelow: { magnitude: 10, unit: "PT" },
          spaceAbove: { magnitude: 10, unit: "PT" },
        },
        fields:
          "borderBottom.color,borderBottom.width,borderBottom.padding,borderBottom.dashStyle,spaceBelow,spaceAbove",
      },
    });
  }

  appendBlockquote(segments: InlineSegment[]) {
    const start = this.cursor;
    this.insertText("> ");
    this.insertInlineSegments(segments);
    this.insertText("\n");
    const end = this.cursor;
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          indentStart: { magnitude: 18, unit: "PT" },
          borderLeft: {
            color: { color: { rgbColor: { red: 0.7, green: 0.7, blue: 0.7 } } },
            width: { magnitude: 2, unit: "PT" },
            padding: { magnitude: 4, unit: "PT" },
            dashStyle: "SOLID",
          },
        },
        fields:
          "indentStart,borderLeft.color,borderLeft.width,borderLeft.padding,borderLeft.dashStyle",
      },
    });
  }

  appendCodeBlock(code: string, language?: string) {
    const lines = code.replace(/\n$/, "").split("\n");
    const title = language ? `\`\`\`${language}\n` : "```\n";
    const body = lines.join("\n");
    const endFence = "\n```\n";
    const full = title + body + endFence;
    const start = this.cursor;
    this.insertText(full);
    const end = this.cursor;

    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          namedStyleType: "NORMAL_TEXT",
          indentStart: { magnitude: 18, unit: "PT" },
          spaceAbove: { magnitude: 8, unit: "PT" },
          spaceBelow: { magnitude: 8, unit: "PT" },
        },
        fields: "namedStyleType,indentStart,spaceAbove,spaceBelow",
      },
    });
    this.requests.push({
      updateTextStyle: {
        range: { startIndex: start, endIndex: end - 1 },
        textStyle: {
          weightedFontFamily: { fontFamily: "Courier New" },
          backgroundColor: {
            color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } },
          },
        },
        fields: "weightedFontFamily,backgroundColor",
      },
    });
  }

  appendListItem(
    segments: InlineSegment[],
    depth: number,
    ordered: boolean,
    itemNumber: number
  ) {
    const indent = "  ".repeat(Math.max(depth - 1, 0));
    const marker = ordered ? `${itemNumber}. ` : "- ";
    const start = this.cursor;
    this.insertText(indent + marker);
    this.insertInlineSegments(segments);
    this.insertText("\n");
    const end = this.cursor;
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          indentStart: { magnitude: depth * 18, unit: "PT" },
        },
        fields: "indentStart",
      },
    });
  }

  appendTable(
    rows: InlineSegment[][][],
    alignments: Array<"left" | "right" | "center" | null> = []
  ) {
    if (rows.length === 0) {
      return;
    }

    const columnCount = Math.max(...rows.map((row) => row.length));
    const widths = new Array<number>(columnCount).fill(3);

    for (const row of rows) {
      for (let i = 0; i < columnCount; i += 1) {
        const cell = row[i] ?? [];
        const len = this.segmentTextLength(cell);
        widths[i] = Math.max(widths[i], len);
      }
    }

    const start = this.cursor;
    rows.forEach((row, rowIndex) => {
      this.insertText("|");
      for (let i = 0; i < columnCount; i += 1) {
        const cellSegments = row[i] ?? [];
        const cellLength = this.segmentTextLength(cellSegments);
        const alignment = alignments[i] ?? "left";
        const totalPadding = Math.max(widths[i] - cellLength, 0);
        const leftPadding =
          alignment === "right"
            ? totalPadding
            : alignment === "center"
            ? Math.floor(totalPadding / 2)
            : 0;
        const rightPadding = totalPadding - leftPadding;

        this.insertText(" ");
        this.insertText(" ".repeat(leftPadding));
        this.insertInlineSegments(cellSegments);
        this.insertText(" ".repeat(rightPadding));
        this.insertText(" |");
      }
      this.insertText("\n");

      if (rowIndex === 0) {
        this.insertText("|");
        for (let i = 0; i < columnCount; i += 1) {
          const alignment = alignments[i] ?? "left";
          const width = widths[i];
          let marker = "-".repeat(width);
          if (alignment === "center" && width >= 2) {
            marker = `:${"-".repeat(Math.max(width - 2, 1))}:`;
          } else if (alignment === "right" && width >= 1) {
            marker = `${"-".repeat(Math.max(width - 1, 1))}:`;
          } else if (alignment === "left" && width >= 1) {
            marker = `:${"-".repeat(Math.max(width - 1, 1))}`;
          }
          this.insertText(` ${marker} |`);
        }
        this.insertText("\n");
      }
    });

    const end = this.cursor;
    this.requests.push({
      updateTextStyle: {
        range: { startIndex: start, endIndex: end - 1 },
        textStyle: {
          weightedFontFamily: { fontFamily: "Courier New" },
        },
        fields: "weightedFontFamily",
      },
    });
  }

  private insertInlineSegments(segments: InlineSegment[]) {
    for (const segment of segments) {
      if (segment.type === "image") {
        const label = segment.alt?.trim()
          ? `[Image: ${segment.alt.trim()}]`
          : "[Image]";
        if (isAbsoluteHttpUrl(segment.url)) {
          this.requests.push({
            insertInlineImage: {
              location: { index: this.cursor },
              uri: segment.url,
            },
          });
          this.cursor += 1;
          this.plain += label;
        } else {
          this.insertText(
            `![${segment.alt ?? ""}](${segment.url})${
              segment.title ? ` "${segment.title}"` : ""
            }`
          );
        }
        continue;
      }

      if (!segment.text) {
        continue;
      }
      const start = this.cursor;
      this.insertText(segment.text);
      const end = this.cursor;
      const fields: string[] = [];
      const textStyle: Record<string, unknown> = {};
      if (segment.marks.bold) {
        textStyle.bold = true;
        fields.push("bold");
      }
      if (segment.marks.italic) {
        textStyle.italic = true;
        fields.push("italic");
      }
      if (segment.marks.code) {
        textStyle.weightedFontFamily = { fontFamily: "Courier New" };
        textStyle.backgroundColor = {
          color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } },
        };
        fields.push("weightedFontFamily", "backgroundColor");
      }
      if (segment.marks.link) {
        textStyle.link = { url: segment.marks.link };
        fields.push("link");
        if (!segment.marks.code) {
          textStyle.foregroundColor = {
            color: { rgbColor: { red: 0.06, green: 0.33, blue: 0.8 } },
          };
          textStyle.underline = true;
          fields.push("foregroundColor", "underline");
        }
      }
      if (segment.marks.superscript) {
        textStyle.baselineOffset = "SUPERSCRIPT";
        fields.push("baselineOffset");
      }
      if (fields.length > 0) {
        this.requests.push({
          updateTextStyle: {
            range: { startIndex: start, endIndex: end },
            textStyle,
            fields: fields.join(","),
          },
        });
      }
    }
  }

  private segmentTextLength(segments: InlineSegment[]): number {
    return segments.reduce((total, segment) => {
      if (segment.type === "image") {
        const label = segment.alt?.trim()
          ? `[Image: ${segment.alt.trim()}]`
          : "[Image]";
        return total + label.length;
      }
      return total + segment.text.length;
    }, 0);
  }

  private insertText(text: string) {
    this.requests.push({
      insertText: {
        location: { index: this.cursor },
        text,
      },
    });
    this.cursor += text.length;
    this.plain += text;
  }
}

function getChildren(node: Content | Parent): Content[] {
  return "children" in node && Array.isArray(node.children) ? node.children : [];
}

function flattenInlineNodes(
  nodes: PhrasingContent[],
  footnotes: FootnoteContext,
  inheritedMarks: MarkState = {}
): InlineSegment[] {
  const output: InlineSegment[] = [];

  const pushText = (text: string, marks: MarkState) => {
    if (!text) {
      return;
    }
    output.push({ type: "text", text, marks: { ...marks } });
  };

  const walk = (node: PhrasingContent, marks: MarkState) => {
    switch (node.type) {
      case "text":
        pushText(node.value, marks);
        break;
      case "strong":
        for (const child of node.children) {
          walk(child, { ...marks, bold: true });
        }
        break;
      case "emphasis":
        for (const child of node.children) {
          walk(child, { ...marks, italic: true });
        }
        break;
      case "inlineCode":
        pushText(node.value, { ...marks, code: true });
        break;
      case "link":
        for (const child of node.children) {
          walk(child, { ...marks, link: node.url });
        }
        break;
      case "image":
        output.push({
          type: "image",
          url: node.url,
          alt: node.alt ?? undefined,
          title: node.title,
        });
        break;
      case "footnoteReference": {
        const number = registerFootnoteReference(footnotes, node.identifier);
        pushText(`[^${number}]`, { ...marks, superscript: true });
        break;
      }
      case "delete":
        for (const child of node.children) {
          walk(child, marks);
        }
        break;
      case "break":
        pushText("\n", marks);
        break;
      default:
        if ("children" in node && Array.isArray(node.children)) {
          for (const child of node.children) {
            walk(child as PhrasingContent, marks);
          }
        }
        break;
    }
  };

  for (const node of nodes) {
    walk(node, inheritedMarks);
  }
  return output;
}

function extractListItemInlineSegments(
  item: ListItem,
  footnotes: FootnoteContext
): InlineSegment[] {
  const segments: InlineSegment[] = [];
  for (const child of item.children) {
    if (child.type === "paragraph") {
      segments.push(...flattenInlineNodes(child.children, footnotes));
    }
  }
  return segments;
}

function buildFromBlockNodes(
  nodes: Content[],
  builder: DocsRequestBuilder,
  footnotes: FootnoteContext,
  listDepth = 1
) {
  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        const segments = flattenInlineNodes(node.children, footnotes);
        builder.appendNamedStyleParagraph(
          segments,
          HEADING_BY_DEPTH[node.depth] ?? "HEADING_6"
        );
        builder.appendNewline();
        break;
      }
      case "paragraph": {
        const segments = flattenInlineNodes(node.children, footnotes);
        builder.appendParagraphFromInline(segments);
        builder.appendNewline();
        break;
      }
      case "blockquote": {
        for (const child of node.children) {
          if (child.type === "paragraph") {
            builder.appendBlockquote(flattenInlineNodes(child.children, footnotes));
          } else {
            buildFromBlockNodes([child], builder, footnotes, listDepth);
          }
        }
        builder.appendNewline();
        break;
      }
      case "list": {
        let counter = node.start ?? 1;
        for (const item of node.children) {
          const segments = extractListItemInlineSegments(item, footnotes);
          builder.appendListItem(
            segments,
            listDepth,
            Boolean(node.ordered),
            counter
          );
          counter += 1;
          for (const nested of item.children) {
            if (nested.type === "list") {
              buildFromBlockNodes([nested], builder, footnotes, listDepth + 1);
            }
          }
        }
        builder.appendNewline();
        break;
      }
      case "code": {
        builder.appendCodeBlock(node.value, node.lang ?? undefined);
        builder.appendNewline();
        break;
      }
      case "thematicBreak": {
        builder.appendHorizontalRule();
        builder.appendNewline();
        break;
      }
      case "table": {
        const tableRows = tableToInlineGrid(node, footnotes);
        const alignments =
          node.align?.map((alignment) =>
            alignment === "left" || alignment === "right" || alignment === "center"
              ? alignment
              : null
          ) ?? [];
        builder.appendTable(tableRows, alignments);
        builder.appendNewline();
        break;
      }
      default: {
        const children = getChildren(node as Content | Parent);
        if (children.length > 0) {
          buildFromBlockNodes(children, builder, footnotes, listDepth);
          builder.appendNewline();
        }
        break;
      }
    }
  }
}

function tableToInlineGrid(
  table: Table,
  footnotes: FootnoteContext
): InlineSegment[][][] {
  return table.children.map((row: TableRow) =>
    row.children.map((cell: TableCell) =>
      flattenInlineNodes(cell.children as PhrasingContent[], footnotes)
    )
  );
}

function collectFootnoteDefinitions(nodes: Content[]): FootnoteContext {
  const definitions = new Map<string, Content[]>();
  for (const node of nodes) {
    if (node.type === "footnoteDefinition") {
      const def = node as FootnoteDefinition;
      definitions.set(def.identifier, def.children);
    }
  }
  return {
    definitions,
    order: [],
    indexByIdentifier: new Map<string, number>(),
  };
}

function registerFootnoteReference(
  footnotes: FootnoteContext,
  identifier: string
): number {
  const existing = footnotes.indexByIdentifier.get(identifier);
  if (existing) {
    return existing;
  }
  const next = footnotes.order.length + 1;
  footnotes.indexByIdentifier.set(identifier, next);
  footnotes.order.push(identifier);
  return next;
}

function appendFootnotesSection(
  builder: DocsRequestBuilder,
  footnotes: FootnoteContext
) {
  if (footnotes.order.length === 0) {
    return;
  }

  builder.appendNamedStyleParagraph(
    [{ type: "text", text: "Footnotes", marks: {} }],
    "HEADING_2"
  );
  builder.appendNewline();

  for (const identifier of footnotes.order) {
    const number = footnotes.indexByIdentifier.get(identifier);
    if (!number) {
      continue;
    }
    const definitionNodes = footnotes.definitions.get(identifier);
    if (!definitionNodes || definitionNodes.length === 0) {
      builder.appendParagraphFromInline([
        {
          type: "text",
          text: `[${number}] Missing footnote definition for "${identifier}".`,
          marks: {},
        },
      ]);
      continue;
    }

    let prefixed = false;
    for (const definitionNode of definitionNodes) {
      if (definitionNode.type === "paragraph") {
        const segments = flattenInlineNodes(definitionNode.children, footnotes);
        const withPrefix: InlineSegment[] = prefixed
          ? segments
          : [{ type: "text", text: `[${number}] `, marks: {} }, ...segments];
        builder.appendParagraphFromInline(withPrefix);
        prefixed = true;
        continue;
      }

      if (!prefixed) {
        builder.appendParagraphFromInline([
          { type: "text", text: `[${number}]`, marks: {} },
        ]);
        prefixed = true;
      }
      buildFromBlockNodes([definitionNode], builder, footnotes);
    }
  }
}

function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function convertMarkdownToDocsRequests(
  markdown: string
): Promise<ConversionResult> {
  const tree = remark().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
  const builder = new DocsRequestBuilder();
  const footnotes = collectFootnoteDefinitions(tree.children);
  const contentNodes = tree.children.filter(
    (node): node is Content => node.type !== "footnoteDefinition"
  );
  buildFromBlockNodes(contentNodes, builder, footnotes);
  appendFootnotesSection(builder, footnotes);
  return builder.getResult();
}
