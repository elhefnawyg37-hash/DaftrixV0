"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const uuid_1 = require("uuid");
/**
 * Comprehensive ERP Stress Test - 2 Year Historical Data
 * Generates realistic business data from Jan 1, 2024 to Dec 1, 2025
 *
 * Run with: npx ts-node server/stress-test-seeder.ts
 */
// ==========================================
// TEST DATA CONFIGURATION
// ==========================================
const TEST_CONFIG = {
    branches: 3,
    warehousesPerBranch: 2,
    categories: 5,
    products: 30,
    suppliers: 12,
    customers: 25,
    salesmen: 6,
    vehicles: 4,
    // Date range: Jan 1, 2024 to Dec 1, 2025 (~24 months)
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-01'),
    // Monthly transaction volumes (realistic business pattern)
    avgPurchaseInvoicesPerMonth: 15, // ~360 purchase invoices total
    avgSalesInvoicesPerMonth: 35, // ~840 sales invoices total
    avgVehicleOperationsPerMonth: 20, // ~480 vehicle operations
    priceAdjustmentPercent: 0.30, // 30% markup
};
// ==========================================
// HELPER FUNCTIONS
// ==========================================
function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomDecimal(min, max, decimals = 2) {
    const val = Math.random() * (max - min) + min;
    return parseFloat(val.toFixed(decimals));
}
function getRandomDate(start, end) {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return new Date(startTime + Math.random() * (endTime - startTime));
}
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}
function formatDateTime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}
// Get monthly dates for generating data spread across 2 years
function getMonthlyRanges(start, end) {
    const ranges = [];
    let current = new Date(start);
    while (current < end) {
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        ranges.push({ monthStart, monthEnd: monthEnd > end ? end : monthEnd });
        current.setMonth(current.getMonth() + 1);
    }
    return ranges;
}
const arabicNames = {
    products: [
        'ملاية قطن فاخرة', 'غطاء وسادة حرير', 'بطانية صوف', 'مفرش سرير كينج',
        'ستارة بلاك أوت', 'وسادة طبية', 'فوطة حمام كبيرة', 'شرشف مطاط',
        'غطاء لحاف دانتيل', 'مفرش مجلس عربي', 'كوفرتة فيزون', 'مخدة فايبر',
        'ملاية اطفال', 'طقم سفرة 12 قطعة', 'ستارة شيفون', 'بشكير وجه',
        'مفرش طاولة مطرز', 'غطاء كرسي', 'سجادة صلاة', 'ملاية كتان',
        'طقم ملايات كامل', 'ستارة تعتيم', 'بطانية فندقية', 'طقم فوط حمام',
        'مفرش سفرة دانتيل', 'وسادة ريش', 'غطاء مرتبة', 'ستارة مودرن',
        'بطانية اطفال', 'طقم مناشف ضيوف'
    ],
    suppliers: [
        'مصنع النسيج الذهبي', 'شركة الأقمشة المصرية', 'مؤسسة الحرير العربي',
        'مصانع القطن الفاخر', 'الشركة العالمية للمنسوجات', 'مصنع الصوف الطبيعي',
        'مؤسسة الأقمشة الحديثة', 'شركة النسيج المتحدة', 'مصنع الأنوال الشرقية',
        'مؤسسة الخيوط الذهبية', 'مصنع الملابس الجاهزة', 'شركة المفروشات الفاخرة'
    ],
    customers: [
        'فندق الريتز كارلتون', 'مستشفى دار الفؤاد', 'شركة أوراسكوم', 'فندق ماريوت',
        'الجامعة الأمريكية', 'فندق سميراميس', 'وزارة الصحة', 'سلسلة فنادق هيلتون',
        'مستشفى السلام الدولي', 'شركة طلعت مصطفى', 'فندق فورسيزونز', 'مجموعة العربي',
        'فندق كيمبنسكي', 'شركة سيراميكا كليوباترا', 'مؤسسة أحمد للتجارة',
        'فندق كونراد', 'مستشفى الأندلسية', 'سلسلة محلات رنوش', 'شركة السعد للتجارة',
        'فندق رمسيس هيلتون', 'مستشفى مصر الدولي', 'شركة المقاولون العرب',
        'فندق الميريديان', 'مجموعة الفطيم', 'سلسلة محلات كارفور'
    ],
    salesmen: [
        'أحمد محمد إبراهيم', 'محمود عبد الرحمن', 'علي حسن أحمد',
        'عمر خالد محمود', 'كريم سعيد عبد الله', 'يوسف عادل حسين'
    ],
    regions: ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'الشرقية', 'أسيوط'],
    categories: ['مفروشات سرير', 'ستائر', 'مناشف وفوط', 'مفارش طاولات', 'وسائد وبطانيات']
};
// ==========================================
// MAIN SEEDER FUNCTION
// ==========================================
function runStressTest() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🚀 Starting 2-Year Historical ERP Stress Test...\n');
        console.log('📅 Date Range: Jan 1, 2024 → Dec 1, 2025 (24 months)\n');
        console.log('='.repeat(70));
        const conn = yield (0, db_1.getConnection)();
        const monthlyRanges = getMonthlyRanges(TEST_CONFIG.startDate, TEST_CONFIG.endDate);
        console.log(`📆 Generating data for ${monthlyRanges.length} months\n`);
        try {
            // Disable foreign key checks for bulk inserts
            yield conn.query('SET FOREIGN_KEY_CHECKS = 0');
            // ==========================================
            // PHASE 1: MASTER DATA
            // ==========================================
            console.log('\n📦 PHASE 1: Creating Master Data...\n');
            // 1.1 Branches
            console.log('  Creating Branches...');
            const branches = [];
            const branchNames = ['الفرع الرئيسي - القاهرة', 'فرع الإسكندرية', 'فرع المنصورة'];
            for (let i = 0; i < TEST_CONFIG.branches; i++) {
                const branch = {
                    id: (0, uuid_1.v4)(),
                    name: branchNames[i],
                    location: arabicNames.regions[i],
                    manager: `مدير فرع ${i + 1}`,
                    phone: `0100000000${i}`
                };
                yield conn.query('INSERT INTO branches SET ?', branch);
                branches.push(branch);
            }
            console.log(`    ✓ Created ${branches.length} branches`);
            // 1.2 Warehouses
            console.log('  Creating Warehouses...');
            const warehouses = [];
            for (const branch of branches) {
                for (let i = 0; i < TEST_CONFIG.warehousesPerBranch; i++) {
                    const warehouse = {
                        id: (0, uuid_1.v4)(),
                        name: `مخزن ${i === 0 ? 'رئيسي' : 'فرعي'} - ${branch.name}`,
                        branchId: branch.id,
                        keeper: `أمين مخزن ${warehouses.length + 1}`,
                        phone: `0110000000${warehouses.length}`
                    };
                    yield conn.query('INSERT INTO warehouses SET ?', warehouse);
                    warehouses.push(warehouse);
                }
            }
            console.log(`    ✓ Created ${warehouses.length} warehouses`);
            // 1.3 Categories
            console.log('  Creating Categories...');
            const categories = [];
            for (let i = 0; i < TEST_CONFIG.categories; i++) {
                const category = {
                    id: (0, uuid_1.v4)(),
                    name: arabicNames.categories[i],
                    description: `فئة ${arabicNames.categories[i]} - تشمل جميع المنتجات ذات الصلة`
                };
                yield conn.query('INSERT INTO categories SET ?', category);
                categories.push(category);
            }
            console.log(`    ✓ Created ${categories.length} categories`);
            // 1.4 Salesmen
            console.log('  Creating Salesmen...');
            const salesmen = [];
            for (let i = 0; i < TEST_CONFIG.salesmen; i++) {
                const salesman = {
                    id: (0, uuid_1.v4)(),
                    name: arabicNames.salesmen[i],
                    phone: `0120000000${i}`,
                    target: getRandomNumber(80000, 200000),
                    achieved: 0,
                    commissionRate: getRandomDecimal(2, 5),
                    region: arabicNames.regions[i],
                    type: i < 2 ? 'SALES' : i < 4 ? 'COLLECTION' : 'BOTH'
                };
                yield conn.query('INSERT INTO salesmen SET ?', salesman);
                salesmen.push(salesman);
            }
            console.log(`    ✓ Created ${salesmen.length} salesmen`);
            // 1.5 Products
            console.log('  Creating Products...');
            const products = [];
            for (let i = 0; i < TEST_CONFIG.products; i++) {
                const cost = getRandomDecimal(50, 500);
                const product = {
                    id: (0, uuid_1.v4)(),
                    name: arabicNames.products[i % arabicNames.products.length],
                    sku: `SKU-${String(i + 1).padStart(5, '0')}`,
                    barcode: `7891234567${String(i).padStart(3, '0')}`,
                    categoryId: categories[i % categories.length].id,
                    cost: cost,
                    price: cost * (1 + TEST_CONFIG.priceAdjustmentPercent),
                    stock: 0,
                    minStock: getRandomNumber(10, 30),
                    unit: 'قطعة',
                    type: 'FINISHED',
                    isActive: true
                };
                yield conn.query('INSERT INTO products SET ?', product);
                products.push(product);
            }
            console.log(`    ✓ Created ${products.length} products`);
            // 1.6 Suppliers
            console.log('  Creating Suppliers...');
            const suppliers = [];
            for (let i = 0; i < TEST_CONFIG.suppliers; i++) {
                const supplier = {
                    id: (0, uuid_1.v4)(),
                    name: arabicNames.suppliers[i],
                    type: 'SUPPLIER',
                    isSupplier: true,
                    isCustomer: false,
                    balance: 0,
                    openingBalance: 0,
                    phone: `0150000000${i}`,
                    address: `عنوان المورد ${i + 1} - المنطقة الصناعية`,
                    taxId: `${1000000 + i}`
                };
                yield conn.query('INSERT INTO partners SET ?', supplier);
                suppliers.push(supplier);
            }
            console.log(`    ✓ Created ${suppliers.length} suppliers`);
            // 1.7 Customers
            console.log('  Creating Customers...');
            const customers = [];
            for (let i = 0; i < TEST_CONFIG.customers; i++) {
                const customer = {
                    id: (0, uuid_1.v4)(),
                    name: arabicNames.customers[i],
                    type: 'CUSTOMER',
                    isSupplier: false,
                    isCustomer: true,
                    balance: getRandomNumber(0, 10000),
                    openingBalance: 0,
                    phone: `0160000000${i}`,
                    address: `عنوان العميل ${i + 1}`,
                    salesmanId: salesmen[i % salesmen.length].id,
                    creditLimit: getRandomNumber(20000, 150000),
                    classification: i < 8 ? 'VIP' : i < 16 ? 'WHOLESALE' : 'RETAIL'
                };
                yield conn.query('INSERT INTO partners SET ?', customer);
                customers.push(customer);
            }
            console.log(`    ✓ Created ${customers.length} customers`);
            // ==========================================
            // PHASE 2: VEHICLES (VAN SALES)
            // ==========================================
            console.log('\n🚗 PHASE 2: Creating Van Sales Data...\n');
            console.log('  Creating Vehicles...');
            const vehicles = [];
            const vehiclePlates = ['أ ب ت 1234', 'س ص ع 5678', 'م ن و 9012', 'ك ل ز 3456'];
            for (let i = 0; i < TEST_CONFIG.vehicles; i++) {
                const vehicle = {
                    id: (0, uuid_1.v4)(),
                    plateNumber: vehiclePlates[i],
                    name: `سيارة توصيل ${i + 1}`,
                    type: 'VAN',
                    capacity: getRandomNumber(500, 2000),
                    salesmanId: salesmen[i % salesmen.length].id,
                    warehouseId: warehouses[0].id,
                    status: i === 0 ? 'LOADED' : 'AVAILABLE',
                    notes: `سائق: محمد ${i + 1} - المنطقة: ${arabicNames.regions[i % arabicNames.regions.length]}`
                };
                yield conn.query('INSERT INTO vehicles SET ?', vehicle);
                vehicles.push(vehicle);
            }
            console.log(`    ✓ Created ${vehicles.length} vehicles`);
            // Vehicle Inventory
            console.log('  Creating Vehicle Inventory...');
            const vehicleInventory = [];
            const loadedVehicle = vehicles[0];
            for (let i = 0; i < 10; i++) {
                const product = products[i];
                const item = {
                    id: (0, uuid_1.v4)(),
                    vehicleId: loadedVehicle.id,
                    productId: product.id,
                    quantity: getRandomNumber(20, 80),
                    lastLoadDate: formatDateTime(new Date())
                };
                yield conn.query('INSERT INTO vehicle_inventory SET ?', item);
                vehicleInventory.push(item);
            }
            console.log(`    ✓ Created ${vehicleInventory.length} vehicle inventory items`);
            // ==========================================
            // PHASE 3: PURCHASE INVOICES (2 Years)
            // ==========================================
            console.log('\n🛒 PHASE 3: Creating Purchase Invoices (24 months)...\n');
            let purchaseCount = 0;
            let purchaseInvoiceNum = 1;
            for (const { monthStart, monthEnd } of monthlyRanges) {
                const monthInvoices = getRandomNumber(TEST_CONFIG.avgPurchaseInvoicesPerMonth - 5, TEST_CONFIG.avgPurchaseInvoicesPerMonth + 5);
                for (let i = 0; i < monthInvoices; i++) {
                    const supplier = getRandomElement(suppliers);
                    const warehouse = getRandomElement(warehouses);
                    const invoiceDate = getRandomDate(monthStart, monthEnd);
                    const numLines = getRandomNumber(2, 6);
                    let total = 0;
                    const lines = [];
                    for (let j = 0; j < numLines; j++) {
                        const product = getRandomElement(products);
                        const quantity = getRandomNumber(20, 150);
                        const price = product.cost;
                        const lineTotal = quantity * price;
                        total += lineTotal;
                        lines.push({
                            productId: product.id,
                            productName: product.name,
                            quantity,
                            price,
                            cost: price,
                            discount: 0,
                            total: lineTotal
                        });
                    }
                    const invoice = {
                        id: (0, uuid_1.v4)(),
                        number: `PUR-${String(purchaseInvoiceNum++).padStart(6, '0')}`,
                        date: formatDate(invoiceDate),
                        type: 'INVOICE_PURCHASE',
                        partnerId: supplier.id,
                        partnerName: supplier.name,
                        total: total,
                        status: 'POSTED',
                        paymentMethod: i % 3 === 0 ? 'CASH' : 'CREDIT',
                        posted: true,
                        taxAmount: 0,
                        warehouseId: warehouse.id
                    };
                    yield conn.query('INSERT INTO invoices SET ?', invoice);
                    for (const line of lines) {
                        yield conn.query('INSERT INTO invoice_lines (invoiceId, productId, productName, quantity, price, cost, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [invoice.id, line.productId, line.productName, line.quantity, line.price, line.cost, line.discount, line.total]);
                        // Update product stock
                        yield conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [line.quantity, line.productId]);
                        // Update product_stocks
                        const [existing] = yield conn.query('SELECT id FROM product_stocks WHERE productId = ? AND warehouseId = ?', [line.productId, warehouse.id]);
                        if (existing.length > 0) {
                            yield conn.query('UPDATE product_stocks SET stock = stock + ? WHERE productId = ? AND warehouseId = ?', [line.quantity, line.productId, warehouse.id]);
                        }
                        else {
                            yield conn.query('INSERT INTO product_stocks SET ?', {
                                id: (0, uuid_1.v4)(),
                                productId: line.productId,
                                warehouseId: warehouse.id,
                                stock: line.quantity
                            });
                        }
                    }
                    purchaseCount++;
                }
                // Progress update every 6 months
                if (monthlyRanges.indexOf({ monthStart, monthEnd }) % 6 === 0) {
                    process.stdout.write('.');
                }
            }
            console.log(`\n    ✓ Created ${purchaseCount} purchase invoices`);
            // ==========================================
            // PHASE 4: SALES INVOICES (2 Years)
            // ==========================================
            console.log('\n💰 PHASE 4: Creating Sales Invoices (24 months)...\n');
            let salesCount = 0;
            let salesInvoiceNum = 1;
            for (const { monthStart, monthEnd } of monthlyRanges) {
                // Seasonal variation: more sales in summer (June-Aug) and winter holidays (Nov-Dec)
                const month = monthStart.getMonth();
                let multiplier = 1.0;
                if (month >= 5 && month <= 7)
                    multiplier = 1.3; // Summer
                if (month >= 10)
                    multiplier = 1.4; // Holiday season
                const monthInvoices = Math.round(getRandomNumber(TEST_CONFIG.avgSalesInvoicesPerMonth - 10, TEST_CONFIG.avgSalesInvoicesPerMonth + 10) * multiplier);
                for (let i = 0; i < monthInvoices; i++) {
                    const customer = getRandomElement(customers);
                    const warehouse = getRandomElement(warehouses);
                    const salesman = getRandomElement(salesmen);
                    const invoiceDate = getRandomDate(monthStart, monthEnd);
                    const numLines = getRandomNumber(1, 5);
                    let total = 0;
                    const lines = [];
                    for (let j = 0; j < numLines; j++) {
                        const product = getRandomElement(products);
                        const quantity = getRandomNumber(1, 30);
                        const price = product.price;
                        const lineTotal = quantity * price;
                        total += lineTotal;
                        lines.push({
                            productId: product.id,
                            productName: product.name,
                            quantity,
                            price,
                            cost: product.cost,
                            discount: 0,
                            total: lineTotal
                        });
                    }
                    const globalDiscount = i % 6 === 0 ? getRandomDecimal(50, 300) : 0;
                    const invoice = {
                        id: (0, uuid_1.v4)(),
                        number: `INV-${String(salesInvoiceNum++).padStart(6, '0')}`,
                        date: formatDate(invoiceDate),
                        type: 'INVOICE_SALE',
                        partnerId: customer.id,
                        partnerName: customer.name,
                        total: total - globalDiscount,
                        status: 'POSTED',
                        paymentMethod: i % 3 === 0 ? 'CASH' : i % 3 === 1 ? 'CREDIT' : 'MIXED',
                        posted: true,
                        taxAmount: 0,
                        globalDiscount: globalDiscount,
                        warehouseId: warehouse.id,
                        salesmanId: salesman.id
                    };
                    yield conn.query('INSERT INTO invoices SET ?', invoice);
                    for (const line of lines) {
                        yield conn.query('INSERT INTO invoice_lines (invoiceId, productId, productName, quantity, price, cost, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [invoice.id, line.productId, line.productName, line.quantity, line.price, line.cost, line.discount, line.total]);
                    }
                    // Update customer balance for credit invoices
                    if (invoice.paymentMethod === 'CREDIT') {
                        yield conn.query('UPDATE partners SET balance = balance + ? WHERE id = ?', [invoice.total, customer.id]);
                    }
                    salesCount++;
                }
            }
            console.log(`    ✓ Created ${salesCount} sales invoices`);
            // ==========================================
            // PHASE 5: SALESMAN TARGETS (Quarterly for 2 years)
            // ==========================================
            console.log('\n🎯 PHASE 5: Creating Salesman Targets (8 quarters)...\n');
            // Create table if not exists
            yield conn.query(`
            CREATE TABLE IF NOT EXISTS salesman_targets (
                id VARCHAR(36) PRIMARY KEY,
                salesmanId VARCHAR(36) NOT NULL,
                targetType ENUM('PRODUCT', 'CATEGORY') NOT NULL DEFAULT 'PRODUCT',
                productId VARCHAR(36) NULL,
                categoryId VARCHAR(36) NULL,
                targetQuantity DECIMAL(15,3) NOT NULL DEFAULT 0,
                targetAmount DECIMAL(15,2) NULL,
                achievedQuantity DECIMAL(15,3) DEFAULT 0,
                achievedAmount DECIMAL(15,2) DEFAULT 0,
                periodType ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
                periodStart DATE NOT NULL,
                periodEnd DATE NOT NULL,
                isActive BOOLEAN DEFAULT TRUE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
            let targetCount = 0;
            const quarters = [
                { start: '2024-01-01', end: '2024-03-31' },
                { start: '2024-04-01', end: '2024-06-30' },
                { start: '2024-07-01', end: '2024-09-30' },
                { start: '2024-10-01', end: '2024-12-31' },
                { start: '2025-01-01', end: '2025-03-31' },
                { start: '2025-04-01', end: '2025-06-30' },
                { start: '2025-07-01', end: '2025-09-30' },
                { start: '2025-10-01', end: '2025-12-01' }
            ];
            for (const quarter of quarters) {
                for (const salesman of salesmen) {
                    // Category target for each salesman per quarter
                    const target = {
                        id: (0, uuid_1.v4)(),
                        salesmanId: salesman.id,
                        targetType: 'CATEGORY',
                        categoryId: getRandomElement(categories).id,
                        targetQuantity: getRandomNumber(200, 600),
                        targetAmount: getRandomNumber(30000, 80000),
                        achievedQuantity: getRandomNumber(100, 500),
                        achievedAmount: getRandomNumber(15000, 70000),
                        periodType: 'QUARTERLY',
                        periodStart: quarter.start,
                        periodEnd: quarter.end,
                        isActive: quarter.end >= '2025-10-01'
                    };
                    yield conn.query('INSERT INTO salesman_targets SET ?', target);
                    targetCount++;
                }
            }
            console.log(`    ✓ Created ${targetCount} salesman targets (8 quarters × ${salesmen.length} salesmen)`);
            // ==========================================
            // PHASE 6: PRICE LISTS
            // ==========================================
            console.log('\n💲 PHASE 6: Creating Price Lists...\n');
            const priceListNames = ['قائمة أسعار التجزئة', 'قائمة أسعار الجملة', 'قائمة أسعار VIP'];
            const discounts = [0, 10, 20];
            let priceListCount = 0;
            for (let i = 0; i < 3; i++) {
                const priceList = {
                    id: (0, uuid_1.v4)(),
                    name: priceListNames[i],
                    description: `${priceListNames[i]} - خصم ${discounts[i]}%`,
                    isActive: true
                };
                yield conn.query('INSERT INTO price_lists SET ?', priceList);
                for (const product of products) {
                    const discountedPrice = product.price * (1 - discounts[i] / 100);
                    yield conn.query('INSERT INTO product_prices (productId, priceListId, price) VALUES (?, ?, ?)', [product.id, priceList.id, discountedPrice]);
                }
                priceListCount++;
            }
            console.log(`    ✓ Created ${priceListCount} price lists with ${products.length * 3} product prices`);
            // Re-enable foreign key checks
            yield conn.query('SET FOREIGN_KEY_CHECKS = 1');
            conn.release();
            // ==========================================
            // SUMMARY
            // ==========================================
            console.log('\n' + '='.repeat(70));
            console.log('✅ 2-YEAR STRESS TEST DATA CREATION COMPLETE!\n');
            console.log('📊 Summary:');
            console.log('   ───────────────────────────────────────');
            console.log(`   │ Master Data`);
            console.log(`   │   • Branches: ${branches.length}`);
            console.log(`   │   • Warehouses: ${warehouses.length}`);
            console.log(`   │   • Categories: ${categories.length}`);
            console.log(`   │   • Products: ${products.length}`);
            console.log(`   │   • Suppliers: ${suppliers.length}`);
            console.log(`   │   • Customers: ${customers.length}`);
            console.log(`   │   • Salesmen: ${salesmen.length}`);
            console.log('   ───────────────────────────────────────');
            console.log(`   │ Van Sales`);
            console.log(`   │   • Vehicles: ${vehicles.length}`);
            console.log(`   │   • Vehicle Inventory Items: ${vehicleInventory.length}`);
            console.log('   ───────────────────────────────────────');
            console.log(`   │ Transactions (24 months)`);
            console.log(`   │   • Purchase Invoices: ${purchaseCount}`);
            console.log(`   │   • Sales Invoices: ${salesCount}`);
            console.log(`   │   • Total Invoices: ${purchaseCount + salesCount}`);
            console.log('   ───────────────────────────────────────');
            console.log(`   │ Targets & Pricing`);
            console.log(`   │   • Salesman Targets: ${targetCount}`);
            console.log(`   │   • Price Lists: ${priceListCount}`);
            console.log('   ───────────────────────────────────────');
            console.log('\n📅 Date Range: January 1, 2024 → December 1, 2025');
            console.log('\n🎉 Ready for comprehensive testing!');
            console.log('='.repeat(70));
        }
        catch (error) {
            console.error('❌ Error during stress test:', error);
            yield conn.query('SET FOREIGN_KEY_CHECKS = 1');
            conn.release();
            throw error;
        }
    });
}
// Run the stress test
runStressTest().then(() => {
    console.log('\n👋 Stress test seeder finished. Exiting...');
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
