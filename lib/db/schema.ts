import { pgTable, text, timestamp, uuid, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    unit: text("unit").default("kg"),
    unitPerCardboard: real("unit_per_cardboard"),
    netWeight: real("net_weight"),
    pricePerUnit: real("price_per_unit").notNull(),
    pricePerCardboard: real("price_per_cardboard"),
    currency: text("currency").default("UAH"),
    image: text("image"),
    agregationResult: text("agregation_result"),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const orders = pgTable("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    items: jsonb("items").notNull(), // To store the full items list as JSON
    itemsSummary: text("items_summary"), // For compatibility with existing sheet logic if needed
    totalPrice: real("total_price").notNull(),
    currency: text("currency").notNull(),
    status: text("status").default("processing"),
    orderDate: timestamp("order_date").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
});
