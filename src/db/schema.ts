import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const publicationStatus = pgEnum("publication_status", ["draft", "published", "archived"]);
export const stockStatus = pgEnum("stock_status", [
  "in_stock",
  "limited",
  "lead_time",
  "quote_only",
]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "payment_pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);
export const paymentStatus = pgEnum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);
export const userRole = pgEnum("user_role", [
  "customer",
  "catalogue_manager",
  "operations",
  "admin",
]);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    websiteUrl: text("website_url"),
    ...timestamps,
  },
  (table) => [uniqueIndex("brands_slug_idx").on(table.slug)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [uniqueIndex("categories_slug_idx").on(table.slug)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    legacySlugs: text("legacy_slugs").array().default([]).notNull(),
    model: text("model").notNull(),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull(),
    longDescription: text("long_description"),
    brandId: uuid("brand_id")
      .references(() => brands.id)
      .notNull(),
    categoryId: uuid("category_id")
      .references(() => categories.id)
      .notNull(),
    status: publicationStatus("status").default("draft").notNull(),
    stockStatus: stockStatus("stock_status").default("quote_only").notNull(),
    leadTime: text("lead_time"),
    sellingPriceInclGstPaise: integer("selling_price_incl_gst_paise"),
    mrpInclGstPaise: integer("mrp_incl_gst_paise"),
    compareAtPriceInclGstPaise: integer("compare_at_price_incl_gst_paise"),
    compareAtLabel: text("compare_at_label"),
    gstRateBasisPoints: integer("gst_rate_basis_points").default(1800).notNull(),
    gstIncluded: boolean("gst_included").default(true).notNull(),
    priceSourceStatus: text("price_source_status").default("needs-review").notNull(),
    priceVerifiedAt: timestamp("price_verified_at", { withTimezone: true }),
    warrantySummary: text("warranty_summary"),
    officialSourceUrl: text("official_source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_slug_idx").on(table.slug),
    uniqueIndex("products_model_idx").on(table.model),
    index("products_brand_idx").on(table.brandId),
    index("products_category_idx").on(table.categoryId),
  ],
);

export const productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  alt: text("alt").notNull(),
  position: integer("position").default(0).notNull(),
  ...timestamps,
});

export const productDocuments = pgTable("product_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  modelVerified: boolean("model_verified").default(false).notNull(),
  ...timestamps,
});

export const productSpecs = pgTable("product_specs", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  groupName: text("group_name").default("General").notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  position: integer("position").default(0).notNull(),
});

export const productHighlights = pgTable("product_highlights", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  text: text("text").notNull(),
  position: integer("position").default(0).notNull(),
});

export const productCompatibility = pgTable("product_compatibility", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  compatibleProductId: uuid("compatible_product_id").references(() => products.id, {
    onDelete: "cascade",
  }),
  note: text("note"),
});

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    quantityAvailable: integer("quantity_available"),
    reserved: integer("reserved").default(0).notNull(),
    leadTime: text("lead_time"),
    ...timestamps,
  },
  (table) => [uniqueIndex("inventory_product_idx").on(table.productId)],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: userRole("role").default("customer").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [uniqueIndex("sessions_token_idx").on(table.token)],
);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  ...timestamps,
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull(),
  gstin: text("gstin"),
  businessName: text("business_name"),
  ...timestamps,
});

export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  instructions: text("instructions"),
  isDefault: boolean("is_default").default(false).notNull(),
  ...timestamps,
});

export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id),
  sessionKey: text("session_key"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps,
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .references(() => carts.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("cart_product_idx").on(table.cartId, table.productId)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: text("order_number").notNull(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    shippingAddressId: uuid("shipping_address_id")
      .references(() => addresses.id)
      .notNull(),
    status: orderStatus("status").default("pending").notNull(),
    subtotalInclGstPaise: integer("subtotal_incl_gst_paise").notNull(),
    shippingPaise: integer("shipping_paise").default(0).notNull(),
    totalInclGstPaise: integer("total_incl_gst_paise").notNull(),
    includedGstPaise: integer("included_gst_paise").notNull(),
    installationRequested: boolean("installation_requested").default(false).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    invoiceNumber: text("invoice_number"),
    invoiceGeneratedAt: timestamp("invoice_generated_at", { withTimezone: true }),
    emailStatus: text("email_status").default("pending").notNull(),
    whatsappStatus: text("whatsapp_status").default("pending").notNull(),
    notificationUpdatedAt: timestamp("notification_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_number_idx").on(table.orderNumber),
    uniqueIndex("orders_idempotency_idx").on(table.idempotencyKey),
    uniqueIndex("orders_invoice_number_idx").on(table.invoiceNumber),
  ],
);

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),
  model: text("model").notNull(),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceInclGstPaise: integer("unit_price_incl_gst_paise").notNull(),
  gstRateBasisPoints: integer("gst_rate_basis_points").notNull(),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").default("razorpay").notNull(),
    providerOrderId: text("provider_order_id").notNull(),
    providerPaymentId: text("provider_payment_id"),
    status: paymentStatus("status").default("created").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    rawEventId: text("raw_event_id"),
    ...timestamps,
  },
  (table) => [uniqueIndex("payment_provider_order_idx").on(table.providerOrderId)],
);

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceNumber: text("reference_number").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    mobile: text("mobile").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [uniqueIndex("enquiry_reference_idx").on(table.referenceNumber)],
);

export const installationRequests = pgTable("installation_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  enquiryId: uuid("enquiry_id")
    .references(() => enquiries.id, { onDelete: "cascade" })
    .notNull(),
  propertyType: text("property_type"),
  pincode: text("pincode"),
  notes: text("notes"),
  ...timestamps,
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: text("actor_user_id")
    .references(() => users.id)
    .notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
