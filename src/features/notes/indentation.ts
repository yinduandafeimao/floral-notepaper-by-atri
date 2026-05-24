const DEFAULT_INDENT = "  ";

interface TabIndentationOptions {
  indent?: string;
  shiftKey?: boolean;
}

interface TabIndentationResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  changed: boolean;
}

function getLineStart(value: string, index: number): number {
  return value.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
}

function getLineEnd(value: string, index: number): number {
  const lineEnd = value.indexOf("\n", index);
  return lineEnd === -1 ? value.length : lineEnd;
}

function getTouchedLineCount(value: string, start: number, end: number): number {
  return value.slice(start, end).split("\n").length;
}

function getOutdentLength(line: string, indent: string): number {
  if (line.startsWith(indent)) return indent.length;
  if (line.startsWith("\t")) return 1;

  const leadingSpaces = line.match(/^ +/)?.[0].length ?? 0;
  return Math.min(leadingSpaces, indent.length);
}

export function applyTabIndentation(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  { indent = DEFAULT_INDENT, shiftKey = false }: TabIndentationOptions = {},
): TabIndentationResult {
  const lineStart = getLineStart(value, selectionStart);
  // 如果选区正好结束在换行符上，就不要把下一行也算进本次缩进范围
  const effectiveSelectionEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;

  if (selectionStart === selectionEnd) {
    if (!shiftKey) {
      const nextValue = value.slice(0, selectionStart) + indent + value.slice(selectionStart);
      const nextCursor = selectionStart + indent.length;

      return {
        value: nextValue,
        selectionStart: nextCursor,
        selectionEnd: nextCursor,
        changed: true,
      };
    }

    const lineEnd = getLineEnd(value, selectionStart);
    const currentLine = value.slice(lineStart, lineEnd);
    const outdentLength = getOutdentLength(currentLine, indent);

    if (outdentLength === 0) {
      return {
        value,
        selectionStart,
        selectionEnd,
        changed: false,
      };
    }

    const nextValue = value.slice(0, lineStart) + value.slice(lineStart + outdentLength);
    const nextCursor = Math.max(lineStart, selectionStart - outdentLength);

    return {
      value: nextValue,
      selectionStart: nextCursor,
      selectionEnd: nextCursor,
      changed: true,
    };
  }

  const lineEnd = getLineEnd(value, effectiveSelectionEnd);
  const selectedBlock = value.slice(lineStart, lineEnd);
  const lines = selectedBlock.split("\n");
  const touchedLineCount = getTouchedLineCount(value, lineStart, effectiveSelectionEnd);

  if (!shiftKey) {
    // 多行缩进时，需要把命中的每一行都补上缩进，并同步扩展选区范围
    const nextBlock = lines.map((line) => `${indent}${line}`).join("\n");
    const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);

    return {
      value: nextValue,
      selectionStart: selectionStart + indent.length,
      selectionEnd: selectionEnd + indent.length * touchedLineCount,
      changed: true,
    };
  }

  const removedByLine = lines.map((line) => getOutdentLength(line, indent));
  const totalRemoved = removedByLine.reduce((sum, count) => sum + count, 0);

  if (totalRemoved === 0) {
    return {
      value,
      selectionStart,
      selectionEnd,
      changed: false,
    };
  }

  const nextBlock = lines.map((line, index) => line.slice(removedByLine[index])).join("\n");
  const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
  // 反缩进后，选区两端都要按各自之前实际移除的缩进量回退
  const removedBeforeEnd = removedByLine
    .slice(0, touchedLineCount)
    .reduce((sum, count) => sum + count, 0);

  return {
    value: nextValue,
    selectionStart: Math.max(lineStart, selectionStart - removedByLine[0]),
    selectionEnd: Math.max(lineStart, selectionEnd - removedBeforeEnd),
    changed: true,
  };
}

interface NativeTabEvent {
  code?: string;
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
  stopPropagation?: () => void;
  stopImmediatePropagation?: () => void;
  cancelBubble?: boolean;
  returnValue?: boolean;
}

interface TextareaValueTarget {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  focus: () => void;
  setSelectionRange: (start: number, end: number) => void;
}

export function applyTabIndentationToTextareaDom(
  textarea: TextareaValueTarget,
  event: NativeTabEvent,
  indent = DEFAULT_INDENT,
): TabIndentationResult | null {
  if (event.key !== "Tab" && event.code !== "Tab") return null;

  event.preventDefault();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
  event.cancelBubble = true;
  event.returnValue = false;

  const result = applyTabIndentation(
    textarea.value,
    textarea.selectionStart,
    textarea.selectionEnd,
    {
      indent,
      shiftKey: event.shiftKey,
    },
  );

  return result;
}