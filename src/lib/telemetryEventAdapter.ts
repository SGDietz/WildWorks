export type ProductSchema = "wildworks" | "isolve";

export function detectProductSchema(row: Record<string, unknown>): ProductSchema {
  if ("event_type" in row || "payload" in row) return "wildworks";
  return "isolve";
}

export function adaptAppEvent(row: Record<string, unknown>): {
  product: ProductSchema;
  name: string;
  body: Record<string, unknown>;
  nameField: "event_type" | "event";
  bodyField: "payload" | "context";
} {
  const product = detectProductSchema(row);
  if (product === "wildworks") {
    return {
      product,
      name: String(row.event_type ?? ""),
      body: (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, unknown>,
      nameField: "event_type",
      bodyField: "payload",
    };
  }
  return {
    product,
    name: String(row.event ?? ""),
    body: (row.context && typeof row.context === "object" ? row.context : {}) as Record<string, unknown>,
    nameField: "event",
    bodyField: "context",
  };
}

export function mapWwEventShape(eventType: string, payload: Record<string, unknown>): {
  event_type: string;
  payload: Record<string, unknown>;
} {
  return { event_type: eventType, payload };
}
