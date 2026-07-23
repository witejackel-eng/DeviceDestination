import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canCancelUnpaid,
  canDeliver,
  canRequestRefund,
  canShip,
  isAllowedTransition,
  isPaidLike,
  labelForStatus,
  InvalidOrderTransitionError,
  type OrderStatus,
} from "@/lib/order-state";

describe("order state machine", () => {
  it("allows pending → payment_pending", () => {
    expect(isAllowedTransition("pending", "payment_pending")).toBe(true);
  });
  it("allows payment_pending → paid", () => {
    expect(isAllowedTransition("payment_pending", "paid")).toBe(true);
  });
  it("allows paid → processing", () => {
    expect(isAllowedTransition("paid", "processing")).toBe(true);
  });
  it("allows processing → shipped", () => {
    expect(isAllowedTransition("processing", "shipped")).toBe(true);
  });
  it("allows shipped → delivered", () => {
    expect(isAllowedTransition("shipped", "delivered")).toBe(true);
  });
  it("allows paid → refund_pending", () => {
    expect(isAllowedTransition("paid", "refund_pending")).toBe(true);
  });
  it("allows refund_pending → refunded", () => {
    expect(isAllowedTransition("refund_pending", "refunded")).toBe(true);
  });
  it("allows refund_pending → paid (refund failed, restore)", () => {
    expect(isAllowedTransition("refund_pending", "paid")).toBe(true);
  });
  it("rejects delivered → processing", () => {
    expect(isAllowedTransition("delivered", "processing")).toBe(false);
  });
  it("rejects refunded → shipped", () => {
    expect(isAllowedTransition("refunded", "shipped")).toBe(false);
  });
  it("rejects cancelled → paid", () => {
    expect(isAllowedTransition("cancelled", "paid")).toBe(false);
  });
  it("rejects shipped without paid-equivalent (shipped requires processing)", () => {
    expect(isAllowedTransition("paid", "shipped")).toBe(false);
  });
  it("rejects same-state transitions", () => {
    expect(isAllowedTransition("paid", "paid")).toBe(false);
  });
  it("assertTransition throws on invalid", () => {
    expect(() => assertTransition("delivered", "processing")).toThrow(InvalidOrderTransitionError);
  });
  it("assertTransition does not throw on valid", () => {
    expect(() => assertTransition("paid", "processing")).not.toThrow();
  });
  it("isPaidLike identifies paid-equivalent states", () => {
    expect(isPaidLike("paid")).toBe(true);
    expect(isPaidLike("processing")).toBe(true);
    expect(isPaidLike("shipped")).toBe(true);
    expect(isPaidLike("delivered")).toBe(true);
    expect(isPaidLike("pending")).toBe(false);
    expect(isPaidLike("cancelled")).toBe(false);
    expect(isPaidLike("refunded")).toBe(false);
  });
  it("canCancelUnpaid only allows pending or payment_pending", () => {
    expect(canCancelUnpaid("pending")).toBe(true);
    expect(canCancelUnpaid("payment_pending")).toBe(true);
    expect(canCancelUnpaid("paid")).toBe(false);
    expect(canCancelUnpaid("shipped")).toBe(false);
  });
  it("canShip only allows processing", () => {
    expect(canShip("processing")).toBe(true);
    expect(canShip("paid")).toBe(false);
    expect(canShip("shipped")).toBe(false);
  });
  it("canDeliver only allows shipped", () => {
    expect(canDeliver("shipped")).toBe(true);
    expect(canDeliver("processing")).toBe(false);
    expect(canDeliver("delivered")).toBe(false);
  });
  it("canRequestRefund allows paid-like and not refund_pending", () => {
    expect(canRequestRefund("paid")).toBe(true);
    expect(canRequestRefund("processing")).toBe(true);
    expect(canRequestRefund("shipped")).toBe(true);
    expect(canRequestRefund("delivered")).toBe(true);
    expect(canRequestRefund("refund_pending")).toBe(false);
    expect(canRequestRefund("cancelled")).toBe(false);
  });
  it("labelForStatus produces human-readable text", () => {
    expect(labelForStatus("payment_pending")).toBe("Payment Pending");
    expect(labelForStatus("refund_pending")).toBe("Refund Pending");
    expect(labelForStatus("paid")).toBe("Paid");
  });
  it("OrderStatus type accepts all enum values", () => {
    const statuses: OrderStatus[] = [
      "pending",
      "payment_pending",
      "paid",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refund_pending",
      "refunded",
    ];
    expect(statuses.length).toBe(9);
  });
});
