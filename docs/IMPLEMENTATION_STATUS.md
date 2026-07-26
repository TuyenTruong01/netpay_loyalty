# NetPay V1 implementation status

Implemented:

- Retained and reframed the desktop Admin Console.
- Added Store Mobile demo for selected product publishing, product images, SKU/barcode, USDC price, NetPay quantity, visibility, deletion, orders, QR and a read-only store agent.
- Added Customer Mobile QR storefront demo with catalog, cart, cash/bank/USDC choices, APoint redemption preview and order creation.
- Added three newly designed contracts: NetPayStoreRegistry, NetPayPaymentRegistry and APointLedger.
- Added a new Arc deployment script and new environment variable names.
- Added a new Supabase V1 schema for stores, selected products, orders, payments, reviews and agent audit logs.
- Frontend production build passes.
- Solidity contracts compile locally in this workspace.
- Loyalty math is aligned to the V1 rule: 1 USDC paid earns 1 APoint, and 1 APoint redeems 0.01 USDC.

Still required before a full production-grade V1 launch:

- Real wallet login and role enforcement for the new pages.
- Real Supabase reads/writes using the V1 schema.
- V1 contract deployment, ABI generation and frontend calls to NetPayStoreRegistry, NetPayPaymentRegistry and APointLedger.
- Arc Testnet deployment and address configuration for NetPayStoreRegistry, NetPayPaymentRegistry and APointLedger.
- Production-grade agent model/tool execution.
- Broader security review beyond the included local contract checks.

Verification on July 23, 2026:

- `npm run build` passes.
- `npm run compile:contracts` passes.
- `npm run test:netpay:v1` passes.
- Vite reports a large production chunk, so route-level code splitting is recommended after core demo flows are stable.

Arc Testnet deployment on July 23, 2026:

- Deployer: `0x6bCA39aA6754537Cf7711a8d3DD698530F9458C5`
- NetPayStoreRegistry: `0xb1c1A8508A39028330Bc2f204557f89AbEF27eb1`
- APointLedger: `0x3A94d77956b66c4B62FC3D8C9470439D3381CcAe`
- NetPayPaymentRegistry: `0x2ecFAD44469Ebdc90B4939c889e7A9bDc39E8E14`
