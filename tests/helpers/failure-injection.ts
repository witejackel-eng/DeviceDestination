/**
 * Failure-injection test support.
 *
 * This module provides controlled test-only failure injection for integration
 * tests. It uses dependency injection (passing functions as parameters) rather
 * than global state or production-request parameters.
 *
 * RULES:
 *  - Works only in test environments (NODE_ENV === 'test')
 *  - Never enabled through a public production request parameter
 *  - Never exposes a production backdoor
 *  - Dependency-injected or module-mocked cleanly
 *  - Uses vitest mocks or a global test-only flag that is only set in test scripts
 */

// ─── Safety guard ─────────────────────────────────────────────────────────

function assertTestEnvironment(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Failure injection is ONLY available in test environments. " +
      "This code should never be reachable in production.",
    );
  }
}

// ─── Failure point definitions ────────────────────────────────────────────

/**
 * Each failure point defines:
 *  - A unique name for the injection point
 *  - The step in the business process where it occurs
 *  - A description of what it simulates
 */
export type FailurePoint =
  | "reservation_insertion"      // fail after inventory increment but before reservation row insert
  | "reservation_activation"     // fail after inventory increment but before activation
  | "payment_update"             // fail during payment status update
  | "inventory_consumption"      // fail during inventory consume step
  | "job_enqueue"                // fail during job enqueue step
  | "razorpay_order_creation"    // fail during Razorpay order creation
  | "payment_reconciliation"     // fail during reconciliation request
  ;

/**
 * Configuration for a single failure injection: which point to fail,
 * and optionally a custom error class/message.
 */
export type FailureInjection = {
  point: FailurePoint;
  errorClass?: string;
  errorMessage?: string;
};

// ─── Default error creators ───────────────────────────────────────────────

function createInjectionError(injection: FailureInjection): Error {
  const msg = injection.errorMessage ?? `Injected failure at ${injection.point}`;
  const errorClass = injection.errorClass ?? "InjectedFailureError";

  // Create a meaningful error with a recognizable name
  const error = new Error(msg);
  error.name = errorClass;
  return error;
}

// ─── Dependency-injected failure wrappers ─────────────────────────────────

/**
 * Wrap a function so it throws an injected failure at a specific point.
 *
 * This is the core mechanism: instead of modifying production code, we
 * pass wrapped functions into the business logic. When the wrapped function
 * is called, it checks if its injection point matches the configured failure,
 * and if so, throws instead of executing the real logic.
 *
 * Usage:
 * ```ts
 * const injection = { point: "reservation_insertion" };
 * const wrappedInsert = failReservationInsertion(
 *   injection,
 *   (values) => db.insert(inventoryReservations).values(values).returning(),
 * );
 * // Now call wrappedInsert() — it will throw instead of inserting.
 * ```
 */
export function createFailableFunction<TArgs extends unknown[], TResult>(
  injection: FailureInjection | null,
  point: FailurePoint,
  originalFn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  assertTestEnvironment();

  return async (...args: TArgs): Promise<TResult> => {
    if (injection && injection.point === point) {
      throw createInjectionError(injection);
    }
    return originalFn(...args);
  };
}

// ─── Named convenience wrappers ───────────────────────────────────────────

/**
 * Fail after inventory increment but before reservation row insert.
 *
 * In `reserveInventoryForOrder`, this simulates the case where the
 * atomic UPDATE on `inventory.reserved` succeeds, but the INSERT of
 * the reservation row fails. The compensation logic must decrement
 * the reserved counter back.
 *
 * The wrapped function replaces the reservation row insert step.
 */
export function failReservationInsertion<TValues, TResult>(
  injection: FailureInjection | null,
  originalInsertFn: (values: TValues) => Promise<TResult>,
): (values: TValues) => Promise<TResult> {
  return createFailableFunction(injection, "reservation_insertion", originalInsertFn);
}

/**
 * Fail after inventory increment but before activation.
 *
 * In `reserveInventoryForOrder`, this simulates the case where the
 * reservation row is inserted and `inventory.reserved` is incremented,
 * but the atomic status transition from "pending" to "active" fails.
 * The compensation logic must decrement the reserved counter and mark
 * the reservation as failed.
 *
 * The wrapped function replaces the activation UPDATE step.
 */
export function failReservationActivation<TResult>(
  injection: FailureInjection | null,
  originalActivateFn: (reservationId: string) => Promise<TResult>,
): (reservationId: string) => Promise<TResult> {
  return createFailableFunction(injection, "reservation_activation", originalActivateFn);
}

/**
 * Fail during payment status update.
 *
 * In `processPaymentSteps`, this simulates a failure when writing
 * the payment capture timestamp or updating the payment status to
 * "captured". Subsequent retries must be able to resume from this
 * point idempotently.
 *
 * The wrapped function replaces the payment UPDATE step.
 */
export function failPaymentUpdate<TValues, TResult>(
  injection: FailureInjection | null,
  originalUpdateFn: (paymentId: string, values: TValues) => Promise<TResult>,
): (paymentId: string, values: TValues) => Promise<TResult> {
  return createFailableFunction(injection, "payment_update", originalUpdateFn);
}

/**
 * Fail during inventory consumption step.
 *
 * In `processPaymentSteps`, this simulates a failure when calling
 * `consumeReservationsForOrder`. The reconciliation system must
 * detect the missing step and retry it.
 *
 * The wrapped function replaces the consume step.
 */
export function failInventoryConsumption<TResult>(
  injection: FailureInjection | null,
  originalConsumeFn: (orderId: string) => Promise<TResult>,
): (orderId: string) => Promise<TResult> {
  return createFailableFunction(injection, "inventory_consumption", originalConsumeFn);
}

/**
 * Fail during job enqueue step.
 *
 * In `processPaymentSteps`, this simulates a failure when calling
 * `enqueueDeduplicatedJob`. The reconciliation system must detect
 * missing jobs and re-enqueue them.
 *
 * The wrapped function replaces the job enqueue step.
 */
export function failJobEnqueue<TInput, TResult>(
  injection: FailureInjection | null,
  originalEnqueueFn: (input: TInput) => Promise<TResult>,
): (input: TInput) => Promise<TResult> {
  return createFailableFunction(injection, "job_enqueue", originalEnqueueFn);
}

/**
 * Fail during Razorpay order creation.
 *
 * In `orchestrateCheckout`, this simulates a failure when calling
 * Razorpay's API. The compensation logic must release inventory
 * and cancel the order.
 *
 * The wrapped function replaces the Razorpay API call.
 */
export function failRazorpayOrderCreation<TParams, TResult>(
  injection: FailureInjection | null,
  originalCreateFn: (params: TParams) => Promise<TResult>,
): (params: TParams) => Promise<TResult> {
  return createFailableFunction(injection, "razorpay_order_creation", originalCreateFn);
}

/**
 * Fail during payment reconciliation request.
 *
 * In `reconcileOrderPayment`, this simulates a failure when calling
 * Razorpay's API to fetch payment status. The reconciliation must
 * record a "provider_error" outcome and be retryable later.
 *
 * The wrapped function replaces the Razorpay API call.
 */
export function failPaymentReconciliation<TResult>(
  injection: FailureInjection | null,
  originalReconcileFn: (paymentId: string) => Promise<TResult>,
): (paymentId: string) => Promise<TResult> {
  return createFailableFunction(injection, "payment_reconciliation", originalReconcileFn);
}

// ─── Vitest mock helper ───────────────────────────────────────────────────

/**
 * Create a vitest mock function that either throws (if injection is configured)
 * or calls the original implementation.
 *
 * This is useful for vi.fn() patterns where you want to selectively inject
 * failures in specific test cases.
 */
export function createMockWithInjection<TArgs extends unknown[], TResult>(
  injection: FailureInjection | null,
  point: FailurePoint,
  originalImplementation?: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  assertTestEnvironment();

  return async (...args: TArgs): Promise<TResult> => {
    if (injection && injection.point === point) {
      throw createInjectionError(injection);
    }
    if (originalImplementation) {
      return originalImplementation(...args);
    }
    // Default: return a dummy result. The caller should provide
    // originalImplementation for realistic tests.
    return undefined as unknown as TResult;
  };
}

// ─── Bulk injection config ────────────────────────────────────────────────

/**
 * A null injection means no failures are injected — all functions execute
 * normally. This is the default for non-failure-injection test cases.
 */
export const NO_FAILURE: null = null;

/**
 * Create an injection configuration for a specific failure point.
 */
export function injectFailure(point: FailurePoint, errorMessage?: string): FailureInjection {
  assertTestEnvironment();
  return { point, errorMessage };
}

// ─── Module-level test-only flag ──────────────────────────────────────────

/**
 * A global test-only flag that can be set in test scripts to enable
 * specific failure injection. This flag is ONLY ever set when
 * NODE_ENV === 'test' and is never accessible through any public
 * API route or request parameter.
 *
 * This is used as an alternative to dependency injection when mocking
 * entire modules with vi.mock().
 */
const TEST_ONLY_FAILURE_FLAG: { activePoint: FailurePoint | null; errorMessage: string } = {
  activePoint: null,
  errorMessage: "",
};

export function setTestFailureFlag(point: FailurePoint, errorMessage?: string): void {
  assertTestEnvironment();
  TEST_ONLY_FAILURE_FLAG.activePoint = point;
  TEST_ONLY_FAILURE_FLAG.errorMessage = errorMessage ?? `Injected failure at ${point}`;
}

export function clearTestFailureFlag(): void {
  assertTestEnvironment();
  TEST_ONLY_FAILURE_FLAG.activePoint = null;
  TEST_ONLY_FAILURE_FLAG.errorMessage = "";
}

export function getTestFailureFlag(): { activePoint: FailurePoint | null; errorMessage: string } {
  assertTestEnvironment();
  return { ...TEST_ONLY_FAILURE_FLAG };
}

export function shouldFailAt(point: FailurePoint): boolean {
  assertTestEnvironment();
  return TEST_ONLY_FAILURE_FLAG.activePoint === point;
}

export function throwIfFailingAt(point: FailurePoint): void {
  assertTestEnvironment();
  if (TEST_ONLY_FAILURE_FLAG.activePoint === point) {
    throw new Error(TEST_ONLY_FAILURE_FLAG.errorMessage);
  }
}
