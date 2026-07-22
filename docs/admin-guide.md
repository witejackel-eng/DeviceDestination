# Admin guide

1. Configure Neon, Better Auth and a long random `BETTER_AUTH_SECRET`.
2. Add comma-separated administrator emails to `ADMIN_EMAILS`.
3. Seed the public catalogue and create the first verified user account.
4. Use exact model identity as the immutable catalogue anchor. Old slugs remain aliases.
5. Attach a document only when its model text matches the product exactly.
6. Record public price source, date and label. Never place landed cost in a public product field.
7. Archive a product instead of deleting rows referenced by orders.
8. Reconcile Razorpay capture and webhook state before fulfilment.

The current admin UI is deliberately read-only until the production database and roles are active. Database tables and authorization gates are in place for CRUD implementation without exposing an unsecured editor.
