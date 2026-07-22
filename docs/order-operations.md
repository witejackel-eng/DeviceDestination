# Order operations

## Payment flow

`cart validation → trusted price calculation → Razorpay order → checkout → callback HMAC verification → webhook reconciliation → fulfilment`

Never mark an order paid from the browser callback alone. If callback verification fails after the customer reports payment, ask for the Razorpay payment ID and reconcile in the provider dashboard; do not ask the customer to pay again.

## Fulfilment

- Confirm exact model, quantity and current availability.
- Confirm delivery timing before dispatch.
- Keep installation as a separate quote and service record.
- Put the exact model and GST breakdown on the invoice.
- Record carrier reference and state changes in the audit log.

## Enquiries and quotes

Every server-accepted request has an `ENQ-…` reference. Use it in email, WhatsApp and follow-up records. A quote is not an order and must never create a paid status.
