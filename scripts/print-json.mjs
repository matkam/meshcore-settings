/*
 * Deterministic JSON printing, shared by the two build scripts.
 *
 * JSON.stringify's own indenting puts every array element on its own line,
 * which turns a six-town alias list into seven and a list of coordinates into
 * thousands. Arrays whose elements are all primitives go inline instead;
 * everything else is one key per line.
 *
 * The committed JSON files are generated, so their formatting has to be a pure
 * function of their content — a rebuild with no edits must produce no diff.
 */
export function printJson(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);

  if (Array.isArray(value)) {
    if (!value.length) { return "[]"; }
    if (value.every((v) => v === null || typeof v !== "object")) {
      return "[" + value.map((v) => JSON.stringify(v)).join(", ") + "]";
    }
    return "[\n" + value.map((v) => inner + printJson(v, indent + 1)).join(",\n") + "\n" + pad + "]";
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined);
    if (!keys.length) { return "{}"; }
    return "{\n" +
      keys.map((k) => inner + JSON.stringify(k) + ": " + printJson(value[k], indent + 1)).join(",\n") +
      "\n" + pad + "}";
  }

  return JSON.stringify(value);
}
