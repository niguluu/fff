/**
 * Hierarchical tree list rendering helper.
 */
import { replaceTabs, formatMoreItems } from "./render-utils.js";
import type { Theme } from "./theme.js";
import type { TreeContext } from "./types.js";
import { getTreeBranch, getTreeContinuePrefix } from "./utils.js";

export interface TreeListOptions<T> {
  items: T[];
  expanded?: boolean;
  maxCollapsed?: number;
  maxCollapsedLines?: number;
  itemType?: string;
  renderItem: (item: T, context: TreeContext) => string | string[];
}

export function renderTreeList<T>(options: TreeListOptions<T>, theme: Theme): string[] {
  const { items, expanded = false, maxCollapsed = 8, maxCollapsedLines, itemType = "item", renderItem } = options;
  const maxItems = expanded ? items.length : Math.min(items.length, maxCollapsed);
  const linesBudget = !expanded && maxCollapsedLines !== undefined ? maxCollapsedLines : Infinity;

  const preRendered: string[][] = [];
  for (let i = 0; i < maxItems; i++) {
    const rendered = renderItem(items[i]!, {
      index: i,
      isLast: false,
      depth: 0,
      theme,
      prefix: "",
      continuePrefix: "",
    });
    preRendered.push(Array.isArray(rendered) ? rendered : rendered ? [rendered] : []);
  }

  let fittingCount = maxItems;
  let fittedLineCount = 0;
  if (linesBudget !== Infinity) {
    fittingCount = 0;
    for (let i = 0; i < maxItems; i++) {
      const count = preRendered[i]!.length;
      const remainingAfter = items.length - (i + 1);
      const reservedSummaryLines = remainingAfter > 0 ? 1 : 0;
      if (fittedLineCount + count + reservedSummaryLines > linesBudget) break;
      fittedLineCount += count;
      fittingCount = i + 1;
    }
  }

  const remaining = items.length - fittingCount;
  const hasSummary = !expanded && remaining > 0 && (linesBudget === Infinity || fittedLineCount < linesBudget);

  const lines: string[] = [];
  for (let i = 0; i < fittingCount; i++) {
    const isLast = !hasSummary && i === fittingCount - 1;
    const branch = getTreeBranch(isLast, theme);
    const prefix = `${theme.fg("dim", branch)} `;
    const continuePrefix = `${theme.fg("dim", getTreeContinuePrefix(isLast, theme))}`;
    const itemLines = preRendered[i]!;
    if (itemLines.length === 0) continue;
    lines.push(`${prefix}${replaceTabs(itemLines[0]!)}`);
    for (let j = 1; j < itemLines.length; j++) {
      lines.push(`${continuePrefix}${replaceTabs(itemLines[j]!)}`);
    }
  }

  if (hasSummary) {
    lines.push(`${theme.fg("dim", theme.tree.last)} ${theme.fg("muted", formatMoreItems(remaining, itemType))}`);
  }

  return lines;
}
