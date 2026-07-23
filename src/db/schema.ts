import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  "refund_pending",
  "refunded",
  "inventory_exception",
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

export const reservationStatus = pgEnum("reservation_status", [
  "pending",
  "active",
  "consumed",
  "released",
  "expired",
  "cancelled",
  "consuming",
  "releasing",
  "failed",
]);

export const webhookEventProcessingStatus = pgEnum("webhook_event_processing_status", [
  "received",
  "processing",
  "completed",
  "failed",
  "ignored",
]);

export const checkoutAttemptStatus = pgEnum("checkout_attempt_status", [
  "initialized",
  "local_order_created",
  "inventory_reserved",
  "provider_order_creating",
  "provider_order_created",
  "payment_recorded",
  "ready_for_checkout",
  "failed",
  "cancelled",
]);

export const inventoryAdjustmentType = pgEnum("inventory_adjustment_type", [
  "receipt",
  "correction",
  "damage",
  "return",
  "reservation_correction",
  "release",
]);

export const priceSourceStatus = pgEnum("price_source_status", [
  "verified",
  "request_price",
  "needs_review",
]);

export const refundStatus = pgEnum("refund_status", [
  "pending",
  "processing",
  "processed",
  "failed",
  "cancelled",
]);

export const jobStatus = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
]);

export const enquiryStatus = pgEnum("enquiry_status", [
  "new",
  "contacted",
  "qualified",
  "quoted",
  "won",
  "lost",
  "closed",
]);

export const shippingServiceability = pgEnum("shipping_serviceability", [
  "serviceable",
  "manual_confirmation",
  "unserviceable",
]);

export const reconciliationOutcome = pgEnum("reconciliation_outcome", [
  "match",
  "local_paid_provider_pending",
  "local_pending_provider_captured",
  "amount_mismatch",
  "duplicate_event",
  "provider_error",
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
    priceSourceStatus: priceSourceStatus("price_source_status").default("needs_review").notNull(),
    priceVerifiedAt: timestamp("price_verified_at", { withTimezone: true }),
    publicSourceLabel: text("public_source_label"),
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
    index("products_status_idx").on(table.status),
    index("products_stock_status_idx").on(table.stockStatus),
    index("products_price_source_idx").on(table.priceSourceStatus),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (table) => [index("product_images_product_idx").on(table.productId)],
);

export const productDocuments = pgTable(
  "product_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    modelVerified: boolean("model_verified").default(false).notNull(),
    ...timestamps,
  },
  (table) => [index("product_documents_product_idx").on(table.productId)],
);

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

export const productPriceHistory = pgTable(
  "product_price_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    previousPricePaise: integer("previous_price_paise"),
    newPricePaise: integer("new_price_paise"),
    gstRateBasisPoints: integer("gst_rate_basis_points").notNull(),
    previousSourceStatus: priceSourceStatus("previous_source_status"),
    newSourceStatus: priceSourceStatus("new_source_status"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    changedBy: text("changed_by").notNull(),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("product_price_history_product_idx").on(table.productId, table.createdAt),
    index("product_price_history_changed_by_idx").on(table.changedBy),
  ],
);

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
  (table) => [
    uniqueIndex("inventory_product_idx").on(table.productId),
  ],
);

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    quantity: integer("quantity").notNull(),
    status: reservationStatus("status").default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releaseReason: text("release_reason"),
    ...timestamps,
  },
  (table) => [
    index("inventory_reservations_order_idx").on(table.orderId),
    index("inventory_reservations_product_idx").on(table.productId),
    index("inventory_reservations_status_idx").on(table.status, table.expiresAt),
  ],
);

export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    type: inventoryAdjustmentType("type").notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    internalNote: text("internal_note"),
    actorUserId: text("actor_user_id"),
    actorEmail: text("actor_email"),
    quantityBefore: integer("quantity_before"),
    quantityAfter: integer("quantity_after"),
    reservedBefore: integer("reserved_before"),
    reservedAfter: integer("reserved_after"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inventory_adjustments_product_idx").on(table.productId, table.createdAt),
    index("inventory_adjustments_actor_idx").on(table.actorUserId),
  ],
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
    mobile: text("mobile"),
    accountDeletionRequestedAt: timestamp("account_deletion_requested_at", {
      withTimezone: true,
    }),
    dataExportRequestedAt: timestamp("data_export_requested_at", { withTimezone: true }),
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

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    mobile: text("mobile").notNull(),
    gstin: text("gstin"),
    businessName: text("business_name"),
    ...timestamps,
  },
  (table) => [
    index("customers_user_idx").on(table.userId),
    index("customers_email_idx").on(table.email),
  ],
);

export const addresses = pgTable(
  "addresses",
  {
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
  },
  (table) => [index("addresses_customer_idx").on(table.customerId)],
);

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
    serviceabilityResult: jsonb("serviceability_result").$type<Record<string, unknown>>(),
    courierName: text("courier_name"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true }),
    fulfilmentNotes: text("fulfilment_notes"),
    internalNotes: text("internal_notes"),
    refundTotalPaise: integer("refund_total_paise").default(0).notNull(),
    lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
    fulfilmentHoldReason: text("fulfilment_hold_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_number_idx").on(table.orderNumber),
    uniqueIndex("orders_idempotency_idx").on(table.idempotencyKey),
    uniqueIndex("orders_invoice_number_idx").on(table.invoiceNumber),
    index("orders_status_idx").on(table.status, table.createdAt),
    index("orders_customer_idx").on(table.customerId),
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

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    actorUserId: text("actor_user_id"),
    actorEmail: text("actor_email"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("order_status_events_order_idx").on(table.orderId, table.createdAt)],
);

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
    captureRecordedAt: timestamp("capture_recorded_at", { withTimezone: true }),
    orderPaidMarkedAt: timestamp("order_paid_marked_at", { withTimezone: true }),
    inventoryConsumedAt: timestamp("inventory_consumed_at", { withTimezone: true }),
    invoiceJobQueuedAt: timestamp("invoice_job_queued_at", { withTimezone: true }),
    emailJobQueuedAt: timestamp("email_job_queued_at", { withTimezone: true }),
    whatsappJobQueuedAt: timestamp("whatsapp_job_queued_at", { withTimezone: true }),
    processingCompletedAt: timestamp("processing_completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_provider_order_idx").on(table.providerOrderId),
    index("payment_status_idx").on(table.status),
    index("payment_provider_payment_idx").on(table.providerPaymentId),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "restrict" })
      .notNull(),
    paymentId: uuid("payment_id")
      .references(() => payments.id, { onDelete: "restrict" })
      .notNull(),
    providerRefundId: text("provider_refund_id"),
    amountPaise: integer("amount_paise").notNull(),
    reason: text("reason").notNull(),
    status: refundStatus("status").default("pending").notNull(),
    requestedBy: text("requested_by").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    providerResponse: jsonb("provider_response").$type<Record<string, unknown>>(),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("refunds_idempotency_idx").on(table.idempotencyKey),
    index("refunds_order_idx").on(table.orderId),
    index("refunds_payment_idx").on(table.paymentId),
    index("refunds_status_idx").on(table.status),
  ],
);

export const paymentReconciliationResults = pgTable(
  "payment_reconciliation_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    paymentId: uuid("payment_id").references(() => payments.id),
    outcome: reconciliationOutcome("outcome").notNull(),
    localStatus: text("local_status"),
    providerStatus: text("provider_status"),
    localAmountPaise: integer("local_amount_paise"),
    providerAmountPaise: integer("provider_amount_paise"),
    notes: text("notes"),
    actorUserId: text("actor_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("reconciliation_order_idx").on(table.orderId, table.createdAt)],
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
    status: enquiryStatus("status").default("new").notNull(),
    assignedTo: text("assigned_to"),
    internalNotes: text("internal_notes"),
    followUpAt: timestamp("follow_up_at", { withTimezone: true }),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    linkedQuoteId: uuid("linked_quote_id"),
    linkedOrderId: uuid("linked_order_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("enquiry_reference_idx").on(table.referenceNumber),
    index("enquiries_status_idx").on(table.status, table.createdAt),
    index("enquiries_assigned_to_idx").on(table.assignedTo),
  ],
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

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteNumber: text("quote_number").notNull(),
    enquiryId: uuid("enquiry_id").references(() => enquiries.id),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerMobile: text("customer_mobile").notNull(),
    customerBusinessName: text("customer_business_name"),
    customerGstin: text("customer_gstin"),
    expiryAt: timestamp("expiry_at", { withTimezone: true }),
    status: quoteStatus("status").default("draft").notNull(),
    subtotalInclGstPaise: integer("subtotal_incl_gst_paise").default(0).notNull(),
    includedGstPaise: integer("included_gst_paise").default(0).notNull(),
    shippingPaise: integer("shipping_paise").default(0).notNull(),
    installationPaise: integer("installation_paise").default(0).notNull(),
    totalInclGstPaise: integer("total_incl_gst_paise").default(0).notNull(),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    approvedBy: text("approved_by"),
    convertedOrderId: uuid("converted_order_id").references(() => orders.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("quotes_number_idx").on(table.quoteNumber),
    index("quotes_status_idx").on(table.status, table.expiryAt),
    index("quotes_enquiry_idx").on(table.enquiryId),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id")
      .references(() => quotes.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id").references(() => products.id),
    model: text("model").notNull(),
    title: text("title").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceInclGstPaise: integer("unit_price_incl_gst_paise").notNull(),
    gstRateBasisPoints: integer("gst_rate_basis_points").notNull(),
  },
  (table) => [index("quote_items_quote_idx").on(table.quoteId)],
);

export const quoteStatusHistory = pgTable(
  "quote_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id")
      .references(() => quotes.id, { onDelete: "cascade" })
      .notNull(),
    fromStatus: quoteStatus("from_status"),
    toStatus: quoteStatus("to_status").notNull(),
    actorUserId: text("actor_user_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("quote_status_history_quote_idx").on(table.quoteId, table.createdAt)],
);

export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    deliveryFeePaise: integer("delivery_fee_paise").default(0).notNull(),
    freeShippingThresholdPaise: integer("free_shipping_threshold_paise"),
    estimatedDaysMin: integer("estimated_days_min"),
    estimatedDaysMax: integer("estimated_days_max"),
    codAvailable: boolean("cod_available").default(false).notNull(),
    remoteAreaSurchargePaise: integer("remote_area_surcharge_paise").default(0).notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [uniqueIndex("shipping_zones_slug_idx").on(table.slug)],
);

export const shippingPincodeRules = pgTable(
  "shipping_pincode_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    zoneId: uuid("zone_id")
      .references(() => shippingZones.id, { onDelete: "cascade" })
      .notNull(),
    pincodePrefix: text("pincode_prefix").notNull(),
    serviceability: shippingServiceability("serviceability").default("manual_confirmation").notNull(),
    overrideFeePaise: integer("override_fee_paise"),
    overrideEstimatedDaysMin: integer("override_estimated_days_min"),
    overrideEstimatedDaysMax: integer("override_estimated_days_max"),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("shipping_pincode_rules_prefix_idx").on(table.pincodePrefix),
    index("shipping_pincode_rules_zone_idx").on(table.zoneId),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: jobStatus("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    runAfter: timestamp("run_after", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    dedupeKey: text("dedupe_key"),
    ...timestamps,
  },
  (table) => [
    index("jobs_status_run_after_idx").on(table.status, table.runAfter),
    index("jobs_type_idx").on(table.type),
    index("jobs_locked_by_idx").on(table.lockedBy),
    uniqueIndex("jobs_dedupe_key_active_idx").on(table.dedupeKey).where(sql`${table.status} IN ('pending', 'processing', 'completed')`),
  ],
);

export const settings = pgTable(
  "settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    description: text("description"),
    updatedBy: text("updated_by"),
    ...timestamps,
  },
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id")
      .references(() => users.id)
      .notNull(),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("admin_audit_logs_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    index("admin_audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
    index("admin_audit_logs_action_idx").on(table.action, table.createdAt),
  ],
);

// Re-export for callers that want arbitrary-precision arithmetic on prices.

// ─── New reliability tables ───────────────────────────────────────────

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").default("razorpay").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    providerOrderId: text("provider_order_id").notNull(),
    providerPaymentId: text("provider_payment_id"),
    amountPaise: integer("amount_paise"),
    processingStatus: webhookEventProcessingStatus("processing_status").default("received").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payment_webhook_events_provider_event_id_idx").on(table.providerEventId),
    index("payment_webhook_events_provider_order_id_idx").on(table.providerOrderId),
    index("payment_webhook_events_provider_payment_id_idx").on(table.providerPaymentId),
    index("payment_webhook_events_processing_status_idx").on(table.processingStatus),
    index("payment_webhook_events_received_at_idx").on(table.receivedAt),
  ],
);

export const checkoutAttempts = pgTable(
  "checkout_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    status: checkoutAttemptStatus("status").default("initialized").notNull(),
    providerOrderId: text("provider_order_id"),
    lastCompletedStep: text("last_completed_step"),
    lastError: text("last_error"),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("checkout_attempts_idempotency_key_idx").on(table.idempotencyKey),
    index("checkout_attempts_order_id_idx").on(table.orderId),
    index("checkout_attempts_provider_order_id_idx").on(table.providerOrderId),
  ],
);

export const systemRuns = pgTable(
  "system_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    triggerSource: text("trigger_source").notNull(),
    jobsClaimed: integer("jobs_claimed").default(0),
    jobsCompleted: integer("jobs_completed").default(0),
    jobsFailed: integer("jobs_failed").default(0),
    reservationsExpired: integer("reservations_expired").default(0),
    paymentsReconciled: integer("payments_reconciled").default(0),
    durationMs: integer("duration_ms"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
);
