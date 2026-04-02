/** JSON 格式化输出 */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
