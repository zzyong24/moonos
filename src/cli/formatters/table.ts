/** 简易表格输出 */
export function printTable(headers: string[], rows: string[][]): void {
  // 计算每列最大宽度
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );

  // 输出表头
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
  const separator = widths.map((w) => "─".repeat(w)).join("──");

  console.log(headerLine);
  console.log(separator);

  // 输出行
  for (const row of rows) {
    const line = row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("  ");
    console.log(line);
  }
}
