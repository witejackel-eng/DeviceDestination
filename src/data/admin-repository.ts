import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  addresses,
  brands as brandsTable,
  categories as categoriesTable,
  customers,
  enquiries,
  inventory,
  orderItems,
  orders,
  payments,
  productDocuments,
  productHighlights,
  productImages,
  products as productsTable,
  productSpecs,
  users,
} from "@/db/schema";

/**
 * Every read here is real. When the database is not configured the functions
 * return `null`/empty rather than sample numbers, and the admin UI renders an
 * explicit "not connected" state — an operations dashboard that invents figures
 * is worse than one that admits it has none.
 */

export type OverviewMetrics = {
  ordersToday: number;
  revenueTodayPaise: number;
  paidOrders: number;
  awaitingDispatch: number;
  failedPayments: number;
  lowStockCount: number;
  recentOrders: Array<{
    orderNumber: string;
    customerName: string;
    createdAt: Date;
    totalInclGstPaise: number;
    status: string;
  }>;
  recentCustomers: Array<{ id: string; name: string; email: string; createdAt: Date }>;
};

const LOW_STOCK_THRESHOLD = 5;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getOverviewMetrics(): Promise<OverviewMetrics | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const since = startOfToday();

  const [todayRows, paidRows, dispatchRows, failedRows, lowStockRows, recentOrderRows, recentCustomerRows] =
    await Promise.all([
      db
        .select({
          orders: count(),
          revenue: sql<number>`coalesce(sum(${orders.totalInclGstPaise}), 0)`,
        })
        .from(orders)
        .where(and(gte(orders.createdAt, since), eq(orders.status, "paid"))),
      db.select({ value: count() }).from(orders).where(eq(orders.status, "paid")),
      db
        .select({ value: count() })
        .from(orders)
        .where(inArray(orders.status, ["paid", "processing"])),
      db.select({ value: count() }).from(payments).where(eq(payments.status, "failed")),
      db
        .select({ value: count() })
        .from(inventory)
        .where(lte(inventory.quantityAvailable, LOW_STOCK_THRESHOLD)),
      db
        .select({
          orderNumber: orders.orderNumber,
          customerName: customers.name,
          createdAt: orders.createdAt,
          totalInclGstPaise: orders.totalInclGstPaise,
          status: orders.status,
        })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .orderBy(desc(orders.createdAt))
        .limit(8),
      db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          createdAt: customers.createdAt,
        })
        .from(customers)
        .orderBy(desc(customers.createdAt))
        .limit(6),
    ]);

  return {
    ordersToday: Number(todayRows[0]?.orders ?? 0),
    revenueTodayPaise: Number(todayRows[0]?.revenue ?? 0),
    paidOrders: Number(paidRows[0]?.value ?? 0),
    awaitingDispatch: Number(dispatchRows[0]?.value ?? 0),
    failedPayments: Number(failedRows[0]?.value ?? 0),
    lowStockCount: Number(lowStockRows[0]?.value ?? 0),
    recentOrders: recentOrderRows,
    recentCustomers: recentCustomerRows,
  };
}

export type AdminProductRow = {
  id: string;
  slug: string;
  title: string;
  model: string;
  brand: string;
  category: string;
  status: string;
  stockStatus: string;
  sellingPriceInclGstPaise: number | null;
  quantityAvailable: number | null;
  image: string | null;
  updatedAt: Date;
};

export async function listAdminProducts(): Promise<AdminProductRow[] | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();

  const rows = await db
    .select({
      id: productsTable.id,
      slug: productsTable.slug,
      title: productsTable.title,
      model: productsTable.model,
      brand: brandsTable.name,
      category: categoriesTable.name,
      status: productsTable.status,
      stockStatus: productsTable.stockStatus,
      sellingPriceInclGstPaise: productsTable.sellingPriceInclGstPaise,
      quantityAvailable: inventory.quantityAvailable,
      updatedAt: productsTable.updatedAt,
    })
    .from(productsTable)
    .innerJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(inventory, eq(inventory.productId, productsTable.id))
    .orderBy(desc(productsTable.updatedAt));

  if (rows.length === 0) return [];
  const images = await db
    .select()
    .from(productImages)
    .where(
      inArray(
        productImages.productId,
        rows.map((row) => row.id),
      ),
    );

  return rows.map((row) => ({
    ...row,
    image:
      images
        .filter((image) => image.productId === row.id)
        .sort((a, b) => a.position - b.position)[0]?.url ?? null,
  }));
}

export type AdminProductDetail = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

export async function getAdminProduct(id: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();

  const rows = await db
    .select({ product: productsTable, brand: brandsTable, category: categoriesTable })
    .from(productsTable)
    .innerJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [images, documents, specs, highlights, stock] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, id)),
    db.select().from(productDocuments).where(eq(productDocuments.productId, id)),
    db.select().from(productSpecs).where(eq(productSpecs.productId, id)),
    db.select().from(productHighlights).where(eq(productHighlights.productId, id)),
    db.select().from(inventory).where(eq(inventory.productId, id)).limit(1),
  ]);

  return {
    ...row.product,
    brandName: row.brand.name,
    categoryName: row.category.name,
    images: images.sort((a, b) => a.position - b.position),
    documents,
    specs: specs.sort((a, b) => a.position - b.position),
    highlights: highlights.sort((a, b) => a.position - b.position),
    inventory: stock[0] ?? null,
  };
}

export async function listBrandsAndCategories() {
  if (!isDatabaseConfigured()) return { brands: [], categories: [] };
  const db = getDb();
  const [brandRows, categoryRows] = await Promise.all([
    db.select({ id: brandsTable.id, name: brandsTable.name }).from(brandsTable),
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable),
  ]);
  return { brands: brandRows, categories: categoryRows };
}

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  createdAt: Date;
  totalInclGstPaise: number;
  status: string;
  paymentStatus: string | null;
};

export async function listAdminOrders(): Promise<AdminOrderRow[] | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: customers.name,
      customerEmail: customers.email,
      createdAt: orders.createdAt,
      totalInclGstPaise: orders.totalInclGstPaise,
      status: orders.status,
      paymentStatus: payments.status,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .orderBy(desc(orders.createdAt));

  const unique = new Map<string, AdminOrderRow>();
  for (const row of rows) if (!unique.has(row.id)) unique.set(row.id, row);
  return [...unique.values()];
}

export async function getAdminOrder(orderNumber: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({ order: orders, customer: customers, address: addresses, payment: payments })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(addresses, eq(orders.shippingAddressId, addresses.id))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, row.order.id));
  return { ...row, items };
}

export async function listAdminCustomers() {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  return db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      mobile: customers.mobile,
      businessName: customers.businessName,
      gstin: customers.gstin,
      userId: customers.userId,
      createdAt: customers.createdAt,
      orderCount: sql<number>`count(${orders.id})`,
      totalSpendPaise: sql<number>`coalesce(sum(case when ${orders.status} = 'paid' then ${orders.totalInclGstPaise} else 0 end), 0)`,
      lastOrderAt: sql<Date | null>`max(${orders.createdAt})`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt));
}

export async function listAdminEnquiries() {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  return db.select().from(enquiries).orderBy(desc(enquiries.createdAt)).limit(200);
}

export async function listStaff() {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(or(isNull(users.role), sql`${users.role} <> 'customer'`))
    .orderBy(users.email);
}
