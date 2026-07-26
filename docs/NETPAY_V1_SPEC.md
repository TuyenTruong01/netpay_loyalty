# NETPAY V1 SPEC

## 1. Project Overview

**Project name:** NetPay Loyalty  
**Track:** DeFi — Payments and Fintech Infrastructure  
**Target network:** Arc  
**Primary settlement asset:** USDC  
**Loyalty system:** APoint on-chain  
**Primary users:** System Admin, Store Owner, Customer

NetPay Loyalty is a mobile-first stablecoin commerce network for real-world merchants.

A merchant does not need to upload their entire physical inventory. For example, a store may have 1,000 products in its existing inventory system but publish only 100 selected products to NetPay.

Customers access a store through a QR code or direct link, browse the selected products, place an order, and choose a payment method.

Only USDC payments on Arc are eligible to earn and redeem APoint.

---

## 2. Product Positioning

### English

> NetPay Loyalty is a mobile-first stablecoin commerce network for real-world merchants. Stores publish only the products they want to sell through a QR storefront, receive direct USDC payments on Arc, and reward customers with universal on-chain APoint.

### Vietnamese

> NetPay Loyalty giúp cửa hàng thực tế lựa chọn một phần hàng hóa để đưa lên cửa hàng QR trên điện thoại, nhận thanh toán USDC trực tiếp trên Arc và thưởng APoint on-chain dùng chung trong toàn hệ sinh thái.

---

## 3. Why NetPay Fits the DeFi Track

NetPay belongs to:

- Stablecoin payments
- Merchant settlement
- Fintech infrastructure
- Programmable loyalty
- On-chain payment verification

NetPay is not positioned as a full POS, ERP, accounting, or warehouse-management platform.

Arc is used because the project depends on:

- USDC-denominated fees
- Fast settlement
- Direct merchant payment
- Circle and USDC integrations
- On-chain transaction verification
- Programmable loyalty settlement

---

## 4. Core V1 Flow

```text
Admin approves a store
→ Store connects its registered wallet
→ Store publishes selected products from a phone
→ Store shares its QR code or storefront link
→ Customer scans the QR code
→ Customer browses products
→ Customer adds products to cart
→ Customer chooses a payment method
→ Customer pays USDC on Arc
→ USDC goes directly to the store wallet
→ Payment is verified
→ Order is marked paid
→ APoint is credited on-chain
→ Customer can redeem APoint on a future USDC order
```

---

## 5. User Roles

### 5.1 System Admin

The System Admin uses the existing desktop web administration interface.

Authentication:

- Admin connects an authorized management wallet.
- Only approved admin wallets may access the Admin Console.

Responsibilities:

- Approve or reject store registrations
- Activate, suspend, or disable stores
- Link store wallets to stores
- Monitor USDC payments
- Monitor APoint issuance and redemption
- Review flagged ratings and reviews
- Review agent activity logs
- Inspect smart contract status
- View network-level reports
- Manage system configuration
- Manage authorized operator roles

The Admin must not hold or intercept merchant sales revenue.

### 5.2 Store Owner

The store interface is mobile-first.

Authentication:

- One registered store wallet corresponds to one store in V1.
- The store connects its wallet to access its dashboard.
- The connected wallet must match the store wallet registered by the system.

The store may:

- Edit store information
- Upload logo and cover image
- Set opening status
- Generate or view the store QR code
- Add selected products
- Upload product images
- Enter product name
- Enter product code or SKU
- Enter barcode when applicable
- Choose product category
- Enter selling price
- Enter available quantity for NetPay
- Edit product information
- Increase or decrease available quantity
- Hide or unhide a product
- Mark a product out of stock
- Remove a product from NetPay
- View incoming orders
- Update order status
- View USDC payments
- View cash orders
- View bank-transfer orders
- View daily sales reports
- View APoint earned and redeemed through the store
- Use the Store Management Agent

The store does not need a separate desktop application.

### 5.3 Customer

The customer accesses a store through:

- Store QR code
- Direct storefront link

The customer may:

- Browse the selected store catalog
- Search products
- Filter by category
- View prices
- View availability
- Add products to cart
- Ask the Shopping Assistant Agent for help
- Select a payment method
- Connect a wallet for USDC payment
- View APoint balance
- Redeem APoint on eligible orders
- View order history
- Rate and review a store after a completed order

---

## 6. Store Inventory Scope

NetPay does not manage the store’s entire real-world inventory.

Example:

```text
Physical store inventory: 1,000 products
Products published on NetPay: 100 products
```

The quantity stored in NetPay represents:

> The number of units the store makes available for sale through NetPay.

Example:

```text
Physical stock: 200 Coca-Cola cans
NetPay available quantity: 40 Coca-Cola cans
```

Only the quantity published to NetPay is decreased by NetPay orders.

### Included inventory features

- Available quantity
- Low-stock warning
- Out-of-stock status
- Hide/unhide product
- Manual quantity adjustment
- Automatic deduction after completed order

### Excluded inventory features

- Supplier management
- Purchase orders
- Cost accounting
- Multi-warehouse management
- Batch inventory
- Warehouse transfer
- Supplier debt
- Full stocktaking workflow
- Full accounting integration

---

## 7. Product Data

Each product should support:

- Product ID
- Store ID
- Name
- Product code or SKU
- Barcode
- Category
- Description
- Selling price
- Currency display
- NetPay available quantity
- Image path or storage URL
- Active status
- Hidden status
- Out-of-stock status
- Featured status
- Created timestamp
- Updated timestamp

Product images should be stored in Supabase Storage or another approved object-storage layer.

Do not store image blobs directly in normal database rows.

---

## 8. Payment Methods

### 8.1 Cash

- Customer creates an order
- Store confirms payment manually
- No APoint is earned
- APoint cannot be redeemed

### 8.2 Bank Transfer

- Customer sees the store’s bank-transfer details or bank QR
- Store confirms receipt manually
- No APoint is earned
- APoint cannot be redeemed

### 8.3 USDC on Arc

- Customer connects a wallet
- Customer pays USDC directly to the store wallet
- Payment is verified on-chain
- Order is marked paid after verification
- APoint may be earned
- APoint may be redeemed
- Transaction hash is saved
- Payment proof is linked to the order

Core rule:

```text
Only USDC payments on Arc can earn or redeem APoint.
```

---

## 9. Direct Merchant Settlement

Merchant revenue must flow directly:

```text
Customer wallet → Store wallet
```

NetPay must not route normal sales revenue through:

- Admin wallet
- NetPay treasury wallet
- Agent wallet
- Platform intermediary wallet

NetPay acts as the commerce, verification, loyalty, and coordination layer.

---

## 10. APoint Rules

APoint is an on-chain loyalty balance.

### 10.1 Earning rate

```text
1 USDC spent = 1 APoint
```

Fractional points are rounded down.

Examples:

```text
15.5 USDC → 15 APoint
100 USDC → 100 APoint
```

### 10.2 Redemption value

```text
1 APoint = 0.01 USDC discount value
100 APoint = 1 USDC discount value
```

### 10.3 Additional rules

- APoint does not expire
- APoint is universal across the NetPay ecosystem
- APoint is linked to the customer wallet
- APoint is non-transferable in V1
- Customers cannot mint APoint
- Stores cannot arbitrarily mint APoint
- APoint cannot be earned from cash payments
- APoint cannot be earned from bank transfers
- APoint cannot be redeemed on cash payments
- APoint cannot be redeemed on bank transfers
- The same payment cannot issue points twice
- The same order cannot redeem points twice

The nominal loyalty return is approximately 1%.

---

## 11. APoint Redemption Example

Order total:

```text
15 USDC
```

Customer redeems:

```text
200 APoint = 2 USDC discount
```

Remaining payment:

```text
13 USDC
```

The order record must preserve:

- Original order value
- APoint redeemed
- APoint discount value
- Remaining USDC amount
- USDC transaction hash
- Final payment status

---

## 12. Smart Contracts

All smart contracts must be newly designed and newly deployed.

Do not reuse the previous APoint or payment-proof contract addresses.

### 12.1 NetPayStoreRegistry

Purpose:

- Register stores
- Link store wallets to stores
- Activate stores
- Suspend stores
- Verify whether a wallet belongs to a valid store
- Prevent duplicate store-wallet registration

Suggested roles:

- DEFAULT_ADMIN_ROLE
- STORE_REGISTRAR_ROLE
- PAUSER_ROLE

### 12.2 NetPayPaymentRegistry

Purpose:

- Record verified USDC payments
- Link payments to orders and stores
- Prevent duplicate payment recording
- Preserve payment references
- Emit verifiable payment events

Suggested recorded fields:

- Order ID or order reference
- Store ID
- Customer wallet
- Store wallet
- Gross order amount
- USDC paid
- APoint redeemed
- Discount value
- Transaction reference
- Timestamp
- Status

The contract should not custody normal merchant sales funds.

Suggested roles:

- DEFAULT_ADMIN_ROLE
- PAYMENT_RECORDER_ROLE
- PAUSER_ROLE

### 12.3 APointLedger

Purpose:

- Maintain on-chain APoint balances
- Credit APoint after verified USDC payment
- Debit APoint when redeemed
- Prevent duplicate rewards
- Prevent duplicate redemption
- Emit credit and redemption events

APoint should be non-transferable in V1.

Suggested roles:

- DEFAULT_ADMIN_ROLE
- POINT_OPERATOR_ROLE
- PAUSER_ROLE

### 12.4 Smart Contract Security Requirements

- Role-based access control
- Duplicate-payment protection
- Duplicate-reward protection
- Duplicate-redemption protection
- Pausable emergency controls
- Clear custom errors
- Event emission for critical state changes
- No arbitrary customer balance modification
- No unauthorized store registration
- No point transfer between customers
- Test coverage for success and rejection paths
- Deploy and verify on Arc Testnet
- New ABI and addresses
- New deployment scripts
- New environment variables

---

## 13. Supabase Responsibilities

Suggested tables:

- admins
- stores
- store_wallets
- store_settings
- categories
- products
- product_images
- orders
- order_items
- payments
- payment_verifications
- reviews
- review_reports
- agent_actions
- agent_conversations
- audit_logs
- contract_settings

Supabase should not be the source of truth for APoint balance.

The on-chain APoint ledger is the source of truth for points.

Supabase may cache APoint values for faster display, but cached values must be reconcilable with the blockchain.

---

## 14. Admin Web Interface

The current Admin Console layout may be retained and restyled.

Core sections:

- Dashboard
- Stores
- Store wallets
- Products overview
- Orders overview
- USDC payments
- APoint issuance
- APoint redemption
- Reviews and reports
- Agent activity
- Smart contracts
- Network status
- System settings

Suggested dashboard metrics:

- Total stores
- Active stores
- Suspended stores
- Total listed products
- Total orders
- Total USDC settled
- Total APoint issued
- Total APoint redeemed
- Failed payment verifications
- Flagged reviews
- Recent agent actions
- Contract status

---

## 15. Store Mobile Interface

Minimum screens:

1. Wallet Login
2. Store Overview
3. Products
4. Add Product
5. Edit Product
6. Orders
7. Order Detail
8. Daily Sales
9. Payment Summary
10. APoint Summary
11. Store QR
12. Store Profile
13. Store Agent

The interface should prioritize:

- Large touch targets
- Simple forms
- Camera image upload
- Fast quantity editing
- Mobile wallet support
- Clear order alerts

---

## 16. Customer Mobile Interface

Minimum screens:

1. Storefront
2. Product Categories
3. Product Detail
4. Cart
5. Checkout
6. Payment Method
7. USDC Payment
8. Payment Result
9. APoint Balance
10. Order History
11. Store Review
12. Shopping Assistant Agent

The customer should not need to enter the Admin Console or Store Dashboard.

---

## 17. Agents

Agents are supporting features, not the primary DeFi track claim.

### 17.1 Store Management Agent

Capabilities:

- Create product draft
- Update product draft
- Adjust available quantity
- Hide product
- Unhide product
- List low-stock products
- List pending orders
- Summarize daily sales
- Summarize payment methods
- Summarize APoint activity

Risk controls:

- Read-only actions may run immediately
- Product changes require preview
- Deletion requires explicit confirmation
- Wallet changes require explicit confirmation
- Agents cannot sign merchant transactions
- Agents cannot transfer merchant funds

### 17.2 Shopping Assistant Agent

Capabilities:

- Search products
- Filter by price
- Filter by category
- Check availability
- Recommend products
- Build a suggested cart
- Estimate APoint reward
- Explain payment options
- Check APoint balance

Risk controls:

- Cannot complete payment automatically
- Cannot sign wallet transactions
- Cannot redeem points without customer confirmation
- Cannot add unavailable products
- Must show cart changes before final confirmation

### 17.3 Network Operations Agent

Capabilities:

- Summarize store activity
- Identify inactive stores
- Detect abnormal payment patterns
- Review APoint issuance
- Review APoint redemption
- Review flagged reviews
- Summarize network performance
- Review agent action logs

Risk controls:

- Cannot suspend a store without Admin confirmation
- Cannot change contract roles without Admin confirmation
- Cannot move funds
- Cannot modify APoint balances directly outside approved contract tools

---

## 18. Store Reviews

Only customers with completed orders may submit a store review.

Supported fields:

- Star rating
- Written review
- Product quality
- Service quality
- Preparation speed

Rules:

- One review per completed order
- Reviews must link to an eligible order
- Admin may moderate abuse
- Admin should not arbitrarily change valid ratings
- Flagged reviews should have a review workflow

---

## 19. Why Stores Join NetPay

Stores benefit from:

- Presence in the NetPay merchant ecosystem
- A QR storefront without building a full website
- Direct USDC settlement
- Shared on-chain loyalty infrastructure
- Customer discovery and promotion
- Multi-payment checkout
- Mobile product publishing
- Store ratings and reputation
- Agent-assisted product and order management
- Daily sales reporting
- Verifiable payment history

---

## 20. Why Customers Use NetPay

Customers benefit from:

- Seeing prices before ordering
- Browsing products on their phone
- Easy QR access
- Multiple payment methods
- Direct USDC payment
- Universal APoint rewards
- Non-expiring points
- On-chain point visibility
- Store ratings
- Shopping assistance
- Transparent order and payment history

---

## 21. V1 Non-Goals

- Full desktop POS for stores
- Full ERP
- Full accounting
- Supplier management
- Multi-warehouse inventory
- Cross-chain bridge
- Token swap
- Lending
- Borrowing
- Yield
- Merchant custody by NetPay
- Agent autonomous treasury
- Agent-held merchant funds
- Multi-branch ownership model
- Fiat conversion
- Automated bank-transfer verification
- Complex refund arbitration
- Transferable APoint token
- Public APoint trading

---

## 22. Demo Success Criteria

```text
1. Admin connects the authorized admin wallet.
2. Admin approves a store.
3. The store wallet connects on mobile.
4. The store creates a product.
5. The product appears in the store QR storefront.
6. A customer scans the store QR.
7. The customer adds the product to cart.
8. The customer selects USDC payment.
9. USDC is sent directly to the store wallet on Arc.
10. The transaction is verified.
11. The order becomes paid.
12. APoint is credited on-chain.
13. The customer opens a second order.
14. The customer redeems APoint.
15. The remaining USDC amount is paid.
16. APoint is debited on-chain.
17. Admin and store reports show the completed activity.
```

---

## 23. Required Blockchain Evidence

- Arc Testnet contract addresses
- Verified contract source
- Deployment transaction hashes
- Store registration transaction
- Payment recording transaction
- APoint credit transaction
- APoint redemption transaction
- Relevant emitted events
- Duplicate-payment rejection
- Unauthorized-role rejection
- Non-transferable APoint rejection
- Contract test results

---

## 24. Code Migration Strategy

### Keep

- Existing Admin Console layout where useful
- Wallet connection components where compatible
- Arc network utilities where correct
- Reusable UI components
- Reusable formatting utilities

### Modify

- Branding
- Routing
- Admin data model
- Wallet-role detection
- Network configuration
- Payment flow
- Product model
- Order model
- Reporting
- Supabase client and queries

### Remove

- Desktop store POS workflows not needed in V1
- Old loyalty logic
- Old contract addresses
- Old payment-proof logic
- Old seeded store assumptions
- Old Supabase schema assumptions
- Unused inventory and accounting complexity

### Build New

- Store mobile interface
- Customer mobile storefront
- New Supabase schema
- New smart contracts
- New deploy scripts
- New ABI integration
- New APoint flow
- New USDC verification flow
- New agent tools
- New audit logs

---

## 25. Official Reference Sources

The architecture and integrations should follow official references where applicable:

- Circle Developer Documentation
- Circle Agent Stack Starter Kits
- Arc Sample Applications
- Arc App Kit
- Arc Documentation

Agent features should reuse approved starter-kit patterns when they fit NetPay’s needs, and custom tools should be written only where required.

---

## 26. Current Project Path

```text
D:\Tuyen_Lam viec\02 Web Hackathon\08 Arc Encode\NetPay Loyalty
```

Target specification file:

```text
docs/NETPAY_V1_SPEC.md
```

---

## 27. Current Status

- Track selected: DeFi
- Core product direction approved
- Admin web retained
- Store interface mobile-first
- Customer interface mobile-first
- APoint on-chain
- Smart contracts will be newly deployed
- Existing smart contracts will not be reused
- No coding or deployment should begin until architecture review is complete
