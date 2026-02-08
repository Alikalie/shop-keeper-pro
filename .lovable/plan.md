

# NE-SHOP - Inventory & Sales Management App

A complete PWA shop management system for Sierra Leone retailers with offline support, staff tracking, and receipt printing.

---

## 🎯 Core Concept

A mobile-first Progressive Web App that lets shop owners and staff manage inventory, process sales, track customer credit, and print receipts — all working offline with cloud sync.

---

## 👥 User Roles & Authentication

### Owner (Admin)
- Full system access
- Add/remove staff and other admins
- View all reports and analytics
- Edit shop settings
- Password reset via email

### Sales Person (Staff)
- Sell products & print receipts
- View own sales only
- Select customers for sales
- Limited dashboard view

---

## 📱 App Screens

### 1. Animated Landing Page
- Live chat-style conversation showing sales scenarios
- Animated shop counter with receipt printing effects
- Interactive demo buttons (Cash Sale, Credit Sale, Stock Low, Daily Report)
- Fake POS interaction for trying before signup
- Animated metrics counters (Sales Today, Receipts, etc.)
- "Works Offline" trust section
- Get Started flow → Create Shop → Set PIN

### 2. Authentication
- PIN login for quick access
- Username + Password option
- Forgot password with email reset
- Role-based routing after login

### 3. Dashboard
- Today's sales summary
- Cash vs Credit breakdown
- Low stock alerts
- Recent transactions
- Quick action buttons

### 4. Products Management
- Product list with search & filter
- Add/Edit products (Name, Category, Buying Price, Selling Price, Quantity, Low Stock Level)
- Stock status indicators
- Category management

### 5. Stock In (Goods Bought)
- Record incoming stock
- Supplier tracking (optional)
- Buying price per batch
- Automatic inventory update
- Staff attribution

### 6. POS (Point of Sale)
- Product search/selection
- Quantity input with stock validation
- Cart management
- Customer selection (Existing, Walk-in, or New)
- Payment type (Cash or Credit/Loan)
- Auto-calculate totals
- Receipt generation & print
- Automatic stock deduction

### 7. Customers
- Customer directory with search
- Add/Edit customers (Name, Phone, Address)
- View outstanding balance
- Purchase history
- Quick access to add payment

### 8. Loans / Credit Management
- List of all credit sales
- Filter by status (Unpaid, Part-paid, Paid)
- Add payments to existing loans
- Customer credit summary
- Payment history per loan

### 9. Reports
**Daily Report**
- Total sales, Cash vs Credit breakdown
- Transaction count
- Sales by staff
- Hourly sales breakdown
- Print-ready format with shop letterhead

**Staff Reports**
- Individual staff performance
- Daily/weekly/monthly views
- Sales totals per staff member

**Hourly Sales**
- Visual chart of sales by hour
- Peak hours identification
- Performance tracking

### 10. Shop Settings
- Shop Name, Address, Phone
- Logo upload
- Receipt footer message
- Currency display (Le)
- Staff management (Add/Remove)
- Admin management (Add other admins)

---

## 🧾 Receipt System

### Format
```
SHOP NAME
Shop Address | Phone

Receipt ID: SHOP-20260208-00045
Customer: Abdul Kamara
Sold by: Mariama (Sales)
--------------------------------
Item        Qty   Price   Total
Sugar        2     15      30
--------------------------------
TOTAL: Le 30
Paid: Le 10
Balance: Le 20
Payment: LOAN

Date: 08 Feb 2026 | Time: 14:32

Thank you for your patronage
```

### Features
- PDF generation with share option
- Print to any connected printer
- Unique receipt ID format: SHOP-YYYYMMDD-XXXXX
- Shop letterhead auto-applied

---

## 📊 Daily Report (Printable)

- Shop letterhead
- Date and time printed
- Total sales summary
- Cash vs Credit breakdown
- Transaction count
- Staff breakdown
- Hourly sales summary
- Printed by attribution

---

## 📴 Offline Support

- **IndexedDB** for local data storage
- All sales, stock updates, customer data saved locally
- Receipt generation works offline
- Background sync when internet returns
- Visual indicator for offline mode
- Conflict resolution for synced data

---

## ☁️ Cloud Backend (Supabase)

- User authentication with roles
- Real-time data sync
- Secure data storage
- Password reset functionality
- Multi-device access for owners

---

## 🎨 Design Approach

- Mobile-first responsive design
- Clean, intuitive interface
- Sierra Leone context (Le currency)
- Fast, touch-friendly controls
- Clear visual hierarchy
- Offline mode indicator

---

## 🔧 Technical Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **PWA**: Installable, works offline
- **Backend**: Supabase (Auth, Database, Storage)
- **PDF**: Client-side PDF generation for receipts
- **Offline**: IndexedDB with sync

---

## 📋 Implementation Order

1. **Landing Page** - Animated, interactive demo experience
2. **Authentication** - Login, roles, password reset
3. **Shop Settings** - Configure shop details
4. **Products & Stock** - Full CRUD inventory
5. **Customers** - Customer management
6. **POS System** - Sales with receipt generation
7. **Loans/Credit** - Credit tracking & payments
8. **Reports** - Daily, staff, hourly reports
9. **Offline Mode** - IndexedDB sync
10. **PWA Setup** - Install prompts, service worker

