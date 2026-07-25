import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  addresses,
  customers,
  orderItems,
  orders,
  payments,
  products as productsTable,
} from "@/db/schema";

export type CustomerOrderItem = {
  id: string;
  productId: string;
  productSlug: string | null;
  model: string;
  title: string;
  quantity: number;
  unitPriceInclGstPaise: number;
  gstRateBasisPoints: number;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string | null;
  createdAt: Date;
  subtotalInclGstPaise: number;
  shippingPaise: number;
  totalInclGstPaise: number;
  includedGstPaise: number;
  installationRequested: boolean;
  invoiceNumber: string | null;
  customer: { name: string; email: string; mobile: string; gstin: string | null; businessName: string | null };
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    instructions: string | null;
  } | null;
  items: CustomerOrderItem[];
};

/**
 * Ownership is expressed as a join condition, not a post-fetch filter: an order
 * that does not belong to `userId` is never loaded in the first place. Every
 * customer-facing order read goes through these two functions.
 */
export async function listOrdersForUser(userId: string): Promise<CustomerOrder[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();

  const rows = await db
    .select({ order: orders, customer: customers, address: addresses, payment: payments })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(addresses, eq(orders.shippingAddressId, addresses.id))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(eq(customers.userId, userId))
    .orderBy(desc(orders.createdAt));

  return hydrate(rows);
}

export async function getOrderForUser(
  userId: string,
  orderNumber: string,
): Promise<CustomerOrder | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();

  const rows = await db
    .select({ order: orders, customer: customers, address: addresses, payment: payments })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(addresses, eq(orders.shippingAddressId, addresses.id))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(and(eq(customers.userId, userId), eq(orders.orderNumber, orderNumber)))
    .limit(1);

  const hydrated = await hydrate(rows);
  return hydrated[0] ?? null;
}

export async function listAddressesForUser(userId: string) {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  return db
    .select({
      id: addresses.id,
      line1: addresses.line1,
      line2: addresses.line2,
      city: addresses.city,
      state: addresses.state,
      pincode: addresses.pincode,
      instructions: addresses.instructions,
      isDefault: addresses.isDefault,
      name: customers.name,
      mobile: customers.mobile,
      createdAt: addresses.createdAt,
    })
    .from(addresses)
    .innerJoin(customers, eq(addresses.customerId, customers.id))
    .where(eq(customers.userId, userId))
    .orderBy(desc(addresses.createdAt));
}

type OrderRow = {
  order: typeof orders.$inferSelect;
  customer: typeof customers.$inferSelect;
  address: typeof addresses.$inferSelect | null;
  payment: typeof payments.$inferSelect | null;
};

async function hydrate(rows: OrderRow[]): Promise<CustomerOrder[]> {
  if (rows.length === 0) return [];
  const db = getDb();

  // A left join on payments can duplicate an order row; keep the first payment
  // record per order and de-duplicate.
  const unique = new Map<string, OrderRow>();
  for (const row of rows) if (!unique.has(row.order.id)) unique.set(row.order.id, row);
  const ordered = [...unique.values()];

  const items = await db
    .select({ item: orderItems, slug: productsTable.slug })
    .from(orderItems)
    .leftJoin(productsTable, eq(orderItems.productId, productsTable.id))
    .where(
      inArray(
        orderItems.orderId,
        ordered.map((row) => row.order.id),
      ),
    );

  return ordered.map(({ order, customer, address, payment }) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: payment?.status ?? null,
    createdAt: order.createdAt,
    subtotalInclGstPaise: order.subtotalInclGstPaise,
    shippingPaise: order.shippingPaise,
    totalInclGstPaise: order.totalInclGstPaise,
    includedGstPaise: order.includedGstPaise,
    installationRequested: order.installationRequested,
    invoiceNumber: order.invoiceNumber,
    customer: {
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile,
      gstin: customer.gstin,
      businessName: customer.businessName,
    },
    address: address
      ? {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          instructions: address.instructions,
        }
      : null,
    items: items
      .filter((row) => row.item.orderId === order.id)
      .map((row) => ({
        id: row.item.id,
        productId: row.item.productId,
        productSlug: row.slug,
        // Snapshots taken at order time — never re-read from the live catalogue.
        model: row.item.model,
        title: row.item.title,
        quantity: row.item.quantity,
        unitPriceInclGstPaise: row.item.unitPriceInclGstPaise,
        gstRateBasisPoints: row.item.gstRateBasisPoints,
      })),
  }));
}
