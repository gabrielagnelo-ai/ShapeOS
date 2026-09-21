export function buildShoppingListText(title: string, items: string[]) {
  return [title, "", ...items.map((item) => `☐ ${item}`)].join("\n");
}
