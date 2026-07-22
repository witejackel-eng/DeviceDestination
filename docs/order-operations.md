# Order operations

## Payment flow

`cart validation → purchase eligibility → trusted database price calculation → idempotent Razorpay order → callback HMAC + provider amount verification → captured webhook reconciliation → invoice → notifications → fulfilment`

Never mark an order paid from the browser callback alone. If callback verification fails after the customer reports payment, ask for the Razorpay payment ID and reconcile in the provider dashboard; do not ask the customer to pay again.

The signed capture webhook is idempotent. It validates the captured amount against the stored payment before changing status. Invoice generation, email and WhatsApp have separate status fields and may be retried without changing a paid order.

## Fulfilment

- Confirm exact model, quantity and current availability.
- Confirm delivery timing before dispatch.
- Keep installation as a separate quote and service record.
- Put the exact model and GST breakdown on the invoice.
- Record carrier reference and state changes in the audit log.

## Enquiries and quotes

Every server-accepted request has an `ENQ-…` reference. Use it in email, WhatsApp and follow-up records. A quote is not an order and must never create a paid status.
