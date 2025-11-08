// Action Logs Management System - Reports

// Format numbers using Eastern Arabic numerals
function formatArabicNumber(number, decimals = 2) {
    if (number === null || number === undefined || isNaN(number)) {
        number = 0;
    }
    const num = parseFloat(number);
    const formatted = num.toFixed(decimals);
    const parts = formatted.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    let integerWithSeparator = '';
    for (let i = integerPart.length - 1, j = 0; i >= 0; i--, j++) {
        if (j > 0 && j % 3 === 0) {
            integerWithSeparator = '٬' + integerWithSeparator;
        }
        integerWithSeparator = integerPart[i] + integerWithSeparator;
    }
    const result = decimalPart 
        ? integerWithSeparator + '٫' + decimalPart
        : integerWithSeparator;
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return result.replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
}

// Format currency
function formatCurrency(amount) {
    return formatArabicNumber(amount) + ' ج.م';
}

// Generate unique code
function generateUniqueCode(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Get Company Settings
async function getCompanySettings() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            const companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            if (companyInfo) {
                return {
                    name: companyInfo.name || 'شركة أسيل',
                    address: companyInfo.address || '',
                    phone: companyInfo.phone || companyInfo.mobile || '',
                    email: companyInfo.email || '',
                    accountantName: companyInfo.accountantName || ''
                };
            }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('asel_company_settings');
        return stored ? JSON.parse(stored) : {
            name: 'شركة أسيل',
            address: '',
            phone: '',
            email: '',
            accountantName: ''
        };
    } catch (error) {
        console.error('Error getting company settings:', error);
        return {
            name: 'شركة أسيل',
            address: '',
            phone: '',
            email: '',
            accountantName: ''
        };
    }
}

// Global data
let customers = [];
let suppliers = [];
let products = [];
let users = []; // Store users for name lookup
let currentTab = 'customer-statement';
let customerStatementData = null; // Store statement data for PDF/Print
let supplierStatementData = null; // Store statement data for PDF/Print

// Pagination state for each tab
let customerStatementItems = [];
let supplierStatementItems = [];
let inventoryMovementItems = [];
let productMovementItems = [];
let deliveryNotesSettlementsItems = [];
let operatingExpensesItems = [];

// Pagination variables
let currentPage = 1;
const itemsPerPage = 20;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    initializeTabs();
    initializeEventListeners();
    
    // Check for tab parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        // Valid tab IDs
        const validTabs = ['customer-statement', 'supplier-statement', 'inventory-movement', 'product-movement', 'delivery-notes-settlements', 'operating-expenses'];
        if (validTabs.includes(tabParam)) {
            // Switch to the specified tab
            setTimeout(() => {
                switchTab(tabParam);
            }, 100); // Small delay to ensure DOM is ready
        }
    }
});

// Load initial data (customers, suppliers, products, users)
async function loadInitialData() {
    try {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            customers = await window.electronAPI.dbGetAll('customers', '', []) || [];
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []) || [];
            products = await window.electronAPI.dbGetAll('products', '', []) || [];
            users = await window.electronAPI.dbGetAll('users', '', []) || [];
        } else {
            const customersData = localStorage.getItem('asel_customers');
            const suppliersData = localStorage.getItem('asel_suppliers');
            const productsData = localStorage.getItem('asel_products');
            customers = customersData ? JSON.parse(customersData) : [];
            suppliers = suppliersData ? JSON.parse(suppliersData) : [];
            products = productsData ? JSON.parse(productsData) : [];
            users = [];
        }
        
        populateSelects();
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

// Helper function to get user name by ID
function getUserName(userId) {
    if (!userId) {
        return 'نظام';
    }
    
    // Ensure users array is loaded - reload if empty
    if (!users || users.length === 0) {
        // Try to reload users
        loadInitialData().then(() => {
            // Users will be loaded, but we can't return async here
            // So we'll just return 'نظام' for now
        }).catch(() => {
            // Ignore errors
        });
        return 'نظام';
    }
    
    // Try to find user by ID
    let user = users.find(u => u.id === userId || u.id === String(userId));
    
    // If not found, try to find by username (in case userId is actually a username)
    if (!user) {
        user = users.find(u => u.username === userId || u.username === String(userId));
    }
    
    if (user) {
        return user.username || 'نظام';
    } else {
        // If still not found, return the userId itself or 'نظام'
        return 'نظام';
    }
}

// Populate select dropdowns
function populateSelects() {
    // Customers
    const customerSelect = document.getElementById('customerSelect');
    if (customerSelect) {
        customerSelect.innerHTML = '<option value="">اختر العميل</option>';
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name || customer.customerName || 'غير معروف';
            customerSelect.appendChild(option);
        });
    }
    
    // Suppliers
    const supplierSelect = document.getElementById('supplierSelect');
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="">اختر المورد</option>';
        suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.name || supplier.supplierName || 'غير معروف';
            supplierSelect.appendChild(option);
        });
    }
    
    // Products
    const productSelect = document.getElementById('productSelect');
    if (productSelect) {
        productSelect.innerHTML = '<option value="">اختر المنتج</option>';
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name || product.productName || 'غير معروف';
            productSelect.appendChild(option);
        });
    }
}

// Initialize tabs
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

// Switch tab
function switchTab(tabId) {
    currentTab = tabId;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });
    
    // Update tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId + '-tab') {
            content.classList.add('active');
        }
    });
    
    // Reset pagination
    currentPage = 1;
    
    // Show/hide pagination based on current tab data
    updatePaginationDisplay();
}

// Initialize event listeners
function initializeEventListeners() {
    // Customer Statement
    document.getElementById('loadCustomerStatementBtn')?.addEventListener('click', loadCustomerStatement);
    document.getElementById('saveCustomerStatementBtn')?.addEventListener('click', () => saveReport('customer'));
    document.getElementById('saveCustomerStatementPdfBtn')?.addEventListener('click', () => saveReportAsPDF('customer'));
    document.getElementById('printCustomerStatementBtn')?.addEventListener('click', () => printReport('customer'));
    
    // Supplier Statement
    document.getElementById('loadSupplierStatementBtn')?.addEventListener('click', loadSupplierStatement);
    document.getElementById('saveSupplierStatementBtn')?.addEventListener('click', () => saveReport('supplier'));
    document.getElementById('saveSupplierStatementPdfBtn')?.addEventListener('click', () => saveReportAsPDF('supplier'));
    document.getElementById('printSupplierStatementBtn')?.addEventListener('click', () => printReport('supplier'));
    
    // Inventory Movement
    document.getElementById('loadInventoryMovementBtn')?.addEventListener('click', loadInventoryMovement);
    document.getElementById('saveInventoryMovementBtn')?.addEventListener('click', () => saveReport('inventory'));
    document.getElementById('saveInventoryMovementPdfBtn')?.addEventListener('click', () => saveReportAsPDF('inventory'));
    document.getElementById('printInventoryMovementBtn')?.addEventListener('click', () => printReport('inventory'));
    
    // Product Movement
    document.getElementById('loadProductMovementBtn')?.addEventListener('click', loadProductMovement);
    document.getElementById('saveProductMovementBtn')?.addEventListener('click', () => saveReport('product'));
    document.getElementById('saveProductMovementPdfBtn')?.addEventListener('click', () => saveReportAsPDF('product'));
    document.getElementById('printProductMovementBtn')?.addEventListener('click', () => printReport('product'));
    
    // Delivery Notes and Settlements
    document.getElementById('loadDeliveryNotesSettlementsBtn')?.addEventListener('click', loadDeliveryNotesSettlements);
    document.getElementById('saveDeliveryNotesSettlementsBtn')?.addEventListener('click', () => saveReport('delivery-notes-settlements'));
    document.getElementById('printDeliveryNotesSettlementsBtn')?.addEventListener('click', () => printReport('delivery-notes-settlements'));
    
    // Operating Expenses
    document.getElementById('loadOperatingExpensesBtn')?.addEventListener('click', loadOperatingExpenses);
    document.getElementById('saveOperatingExpensesBtn')?.addEventListener('click', () => saveReport('operating-expenses'));
    document.getElementById('printOperatingExpensesBtn')?.addEventListener('click', () => printReport('operating-expenses'));
    
    // Pagination controls
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentTab();
        }
    });
    
    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        const totalPages = getTotalPages();
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentTab();
        }
    });
}

// Load Customer Statement
async function loadCustomerStatement() {
    const customerId = document.getElementById('customerSelect').value;
    const dateFrom = document.getElementById('customerDateFrom').value;
    const dateTo = document.getElementById('customerDateTo').value;
    
    if (!customerId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار العميل', 'error');
        } else {
        alert('⚠️ يرجى اختيار العميل');
        }
        return;
    }
    
    try {
        const tbody = document.getElementById('customerStatementBody');
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">جارٍ التحميل...</td></tr>';
        
        let invoices = [];
        let receipts = [];
        
        // Load invoices
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = 'customerId = ?';
            let params = [customerId];
            
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            invoices = await window.electronAPI.dbGetAll('sales_invoices', query, params) || [];
            receipts = await window.electronAPI.dbGetAll('receipts', query, params) || [];
        } else {
            // Fallback to localStorage
            const invoicesData = localStorage.getItem('asel_sales_invoices');
            const receiptsData = localStorage.getItem('asel_receipt_vouchers');
            invoices = invoicesData ? JSON.parse(invoicesData).filter(inv => inv.customerId === customerId) : [];
            receipts = receiptsData ? JSON.parse(receiptsData).filter(rec => rec.customerId === customerId) : [];
        }
        
        // Combine and sort by date
        const customer = customers.find(c => c.id === customerId);
        const openingBalance = parseFloat(customer?.openingBalance || 0);
        
        const statement = [];
        
        // Add invoices
        invoices.forEach(invoice => {
            if (!dateFrom || invoice.date >= dateFrom) {
                if (!dateTo || invoice.date <= dateTo) {
                    statement.push({
                        code: generateUniqueCode('INV'),
                        refNumber: invoice.invoiceNumber || invoice.id,
                        type: 'فاتورة مبيعات',
                        invoiceAmount: parseFloat(invoice.total || 0),
                        totalMovement: parseFloat(invoice.total || 0), // إجمالي الحركة = قيمة الفاتورة
                        paid: parseFloat(invoice.paid || 0),
                        oldBalance: 0, // Will calculate
                        newBalance: 0, // Will calculate
                        date: invoice.date
                    });
                }
            }
        });
        
        // Add receipts
        receipts.forEach(receipt => {
            if (!dateFrom || receipt.date >= dateFrom) {
                if (!dateTo || receipt.date <= dateTo) {
                    statement.push({
                        code: generateUniqueCode('REC'),
                        refNumber: receipt.receiptNumber || receipt.id,
                        type: 'سند قبض',
                        invoiceAmount: 0,
                        totalMovement: parseFloat(receipt.amount || 0), // إجمالي الحركة = المبلغ المدفوع
                        paid: parseFloat(receipt.amount || 0),
                        oldBalance: 0, // Will calculate
                        newBalance: 0, // Will calculate
                        date: receipt.date
                    });
                }
            }
        });

        // Load returns from customers
        let customerReturns = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = 'returnType = ? AND entityId = ?';
            let params = ['from_customer', customerId];
            
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            customerReturns = await window.electronAPI.dbGetAll('returns', query, params) || [];
        }

        // Add returns from customers
        customerReturns.forEach(ret => {
            const amount = parseFloat(ret.totalAmount || 0);
            statement.push({
                code: generateUniqueCode('RET'),
                refNumber: ret.returnNumber || ret.id,
                type: 'مرتجع من عميل',
                invoiceAmount: 0,
                totalMovement: amount, // إجمالي الحركة = قيمة المرتجع
                paid: amount,
                oldBalance: 0, // Will calculate
                newBalance: 0, // Will calculate
                date: ret.date
            });
        });
        
        // Sort by date
        statement.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate running balance starting from opening balance
        let balance = openingBalance;
        statement.forEach(item => {
            item.oldBalance = balance;
            
            if (item.type === 'فاتورة مبيعات') {
                // فاتورة مبيعات: يزيد الدين (balance يزيد)
                balance += item.invoiceAmount;
                // عند الدفع يقل الدين (balance يقل)
                balance -= item.paid;
            } else if (item.type === 'سند قبض') {
                // سند قبض: يقل الدين (balance يقل)
                balance -= item.paid;
            } else if (item.type === 'مرتجع من عميل') {
                // مرتجع من عميل: نسترد المال، يقل الدين (balance يقل)
                balance -= item.paid;
            }
            
            item.newBalance = balance;
        });
        
        // Calculate summary
        const calculatedOpeningBalance = statement.length > 0 ? statement[0].oldBalance : openingBalance;
        const totalSales = statement.filter(s => s.type === 'فاتورة مبيعات').reduce((sum, s) => sum + s.invoiceAmount, 0);
        const totalReceipts = statement.filter(s => s.type === 'سند قبض').reduce((sum, s) => sum + s.paid, 0);
        const totalReturns = statement.filter(s => s.type === 'مرتجع من عميل').reduce((sum, s) => sum + s.paid, 0);
        const closingBalance = statement.length > 0 ? statement[statement.length - 1].newBalance : calculatedOpeningBalance;
        const firstDate = dateFrom || (statement.length > 0 ? statement[0].date : new Date().toISOString().split('T')[0]);
        const lastDate = dateTo || (statement.length > 0 ? statement[statement.length - 1].date : new Date().toISOString().split('T')[0]);
        
        // Store data for PDF/Print
        customerStatementData = {
            customer: customer,
            statement: statement,
            summary: {
                openingBalance: calculatedOpeningBalance,
                totalSales,
                totalReceipts,
                closingBalance,
                firstDate,
                lastDate
            },
            dateFrom,
            dateTo
        };
        
        // Store items for pagination
        customerStatementItems = statement;
        currentPage = 1;
        
        // Render with pagination
        renderCustomerStatement();
    } catch (error) {
        console.error('Error loading customer statement:', error);
        document.getElementById('customerStatementBody').innerHTML = '<tr><td colspan="8" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Load Supplier Statement
async function loadSupplierStatement() {
    const supplierId = document.getElementById('supplierSelect').value;
    const dateFrom = document.getElementById('supplierDateFrom').value;
    const dateTo = document.getElementById('supplierDateTo').value;
    
    if (!supplierId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار المورد', 'error');
        } else {
        alert('⚠️ يرجى اختيار المورد');
        }
        return;
    }
    
    try {
        const tbody = document.getElementById('supplierStatementBody');
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">جارٍ التحميل...</td></tr>';
        
        let invoices = [];
        let payments = [];
        
        // Load invoices
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = 'supplierId = ?';
            let params = [supplierId];
            
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            invoices = await window.electronAPI.dbGetAll('purchase_invoices', query, params) || [];
            
            // Load payments
            query = 'supplierId = ?';
            params = [supplierId];
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            payments = await window.electronAPI.dbGetAll('payments', query, params) || [];
        } else {
            // Fallback to localStorage
            const invoicesData = localStorage.getItem('asel_purchase_invoices');
            const paymentsData = localStorage.getItem('asel_payments');
            invoices = invoicesData ? JSON.parse(invoicesData).filter(inv => inv.supplierId === supplierId) : [];
            payments = paymentsData ? JSON.parse(paymentsData).filter(pay => pay.supplierId === supplierId) : [];
        }
        
        // Combine and sort by date
        const supplier = suppliers.find(s => s.id === supplierId);
        const openingBalance = parseFloat(supplier?.openingBalance || 0);
        
        const statement = [];
        
        // Add invoices
        invoices.forEach(invoice => {
            if (!dateFrom || invoice.date >= dateFrom) {
                if (!dateTo || invoice.date <= dateTo) {
                    statement.push({
                        code: generateUniqueCode('PINV'),
                        refNumber: invoice.invoiceNumber || invoice.id,
                        type: 'فاتورة مشتريات',
                        invoiceAmount: parseFloat(invoice.total || 0),
                        totalMovement: parseFloat(invoice.total || 0), // إجمالي الحركة = قيمة الفاتورة
                        paid: parseFloat(invoice.paid || 0),
                        oldBalance: 0, // Will calculate
                        newBalance: 0, // Will calculate
                        date: invoice.date
                    });
                }
            }
        });
        
        // Add payments
        payments.forEach(payment => {
            if (!dateFrom || payment.date >= dateFrom) {
                if (!dateTo || payment.date <= dateTo) {
                    statement.push({
                        code: generateUniqueCode('PAY'),
                        refNumber: payment.paymentNumber || payment.id,
                        type: 'سند صرف',
                        invoiceAmount: 0,
                        totalMovement: parseFloat(payment.amount || 0), // إجمالي الحركة = المبلغ المدفوع
                        paid: parseFloat(payment.amount || 0),
                        oldBalance: 0, // Will calculate
                        newBalance: 0, // Will calculate
                        date: payment.date
                    });
                }
            }
        });

        // Load returns to suppliers
        let supplierReturns = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = 'returnType = ? AND entityId = ?';
            let params = ['to_supplier', supplierId];
            
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            supplierReturns = await window.electronAPI.dbGetAll('returns', query, params) || [];
        }

        // Add returns to suppliers
        supplierReturns.forEach(ret => {
            const amount = parseFloat(ret.totalAmount || 0);
            statement.push({
                code: generateUniqueCode('RET'),
                refNumber: ret.returnNumber || ret.id,
                type: 'مرتجع إلى مورد',
                invoiceAmount: 0,
                totalMovement: amount, // إجمالي الحركة = قيمة المرتجع
                paid: amount,
                oldBalance: 0, // Will calculate
                newBalance: 0, // Will calculate
                date: ret.date
            });
        });
        
        // Sort by date
        statement.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate running balance starting from opening balance
        let balance = openingBalance;
        statement.forEach(item => {
            item.oldBalance = balance;
            
            if (item.type === 'فاتورة مشتريات') {
                // فاتورة مشتريات: دين عليك - يزيد الدين (balance يزيد)
                balance += item.invoiceAmount;
                // عند الدفع يقل الدين (balance يقل)
                balance -= item.paid;
            } else if (item.type === 'سند صرف') {
                // سند صرف: سداد - يقل الدين (balance يقل)
                balance -= item.paid;
            } else if (item.type === 'مرتجع إلى مورد') {
                // مرتجع إلى مورد: نسترد المال، يقل الدين (balance يقل)
                balance -= item.paid;
            }
            
            item.newBalance = balance;
        });
        
        // Calculate summary
        const calculatedOpeningBalance = statement.length > 0 ? statement[0].oldBalance : openingBalance;
        const totalPurchases = statement.filter(s => s.type === 'فاتورة مشتريات').reduce((sum, s) => sum + s.invoiceAmount, 0);
        const totalPayments = statement.filter(s => s.type === 'سند صرف').reduce((sum, s) => sum + s.paid, 0);
        const closingBalance = statement.length > 0 ? statement[statement.length - 1].newBalance : calculatedOpeningBalance;
        const firstDate = dateFrom || (statement.length > 0 ? statement[0].date : new Date().toISOString().split('T')[0]);
        const lastDate = dateTo || (statement.length > 0 ? statement[statement.length - 1].date : new Date().toISOString().split('T')[0]);
        
        // Store data for PDF/Print
        supplierStatementData = {
            supplier: supplier,
            statement: statement,
            summary: {
                openingBalance: calculatedOpeningBalance,
                totalPurchases,
                totalPayments,
                closingBalance,
                firstDate,
                lastDate
            },
            dateFrom,
            dateTo
        };
        
        // Store items for pagination
        supplierStatementItems = statement;
        currentPage = 1;
        
        // Render with pagination
        renderSupplierStatement();
    } catch (error) {
        console.error('Error loading supplier statement:', error);
        document.getElementById('supplierStatementBody').innerHTML = '<tr><td colspan="8" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Load Inventory Movement
async function loadInventoryMovement() {
    const dateFrom = document.getElementById('inventoryDateFrom').value;
    const dateTo = document.getElementById('inventoryDateTo').value;
    const movementType = document.getElementById('inventoryMovementType').value;
    
    try {
        // Ensure users are loaded
        if (!users || users.length === 0) {
            await loadInitialData();
        }
        
        const tbody = document.getElementById('inventoryMovementBody');
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">جارٍ التحميل...</td></tr>';
        
        const movements = [];
        
        // Load purchase invoices (increases)
        if ((!movementType || movementType === 'purchase') && window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const purchaseInvoices = await window.electronAPI.dbGetAll('purchase_invoices', query, params) || [];
            
            for (const invoice of purchaseInvoices) {
                const items = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoice.id]) || [];
                for (const item of items) {
                    const product = products.find(p => p.id === item.productId);
                    movements.push({
                        date: invoice.date,
                        type: 'purchase',
                        typeLabel: 'مشتريات',
                        refNumber: invoice.invoiceNumber || invoice.id,
                        productName: item.productName || product?.name || 'غير معروف',
                        unit: item.unit === 'smallest' ? 'صغرى' : 'كبرى',
                        quantity: parseFloat(item.quantity || 0),
                        balanceBefore: 0, // Will calculate
                        balanceAfter: 0, // Will calculate
                        user: getUserName(invoice.userId)
                    });
                }
            }
        }
        
        // Load sales invoices (decreases)
        if ((!movementType || movementType === 'sale') && window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const salesInvoices = await window.electronAPI.dbGetAll('sales_invoices', query, params) || [];
            
            for (const invoice of salesInvoices) {
                const items = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoice.id]) || [];
                for (const item of items) {
                    const product = products.find(p => p.id === item.productId);
                    movements.push({
                        date: invoice.date,
                        type: 'sale',
                        typeLabel: 'مبيعات',
                        refNumber: invoice.invoiceNumber || invoice.id,
                        productName: item.productName || product?.name || 'غير معروف',
                        unit: item.unit === 'smallest' ? 'صغرى' : 'كبرى',
                        quantity: -parseFloat(item.quantity || 0), // Negative for sales
                        balanceBefore: 0, // Will calculate
                        balanceAfter: 0,
                        user: getUserName(invoice.userId)
                    });
                }
            }
        }
        
        // Load inventory adjustments
        if ((!movementType || movementType === 'adjustment') && window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const adjustments = await window.electronAPI.dbGetAll('inventory_adjustments', query, params) || [];
            
            for (const adj of adjustments) {
                const product = products.find(p => p.id === adj.productId);
                let typeLabel = 'جرد';
                let quantity = parseFloat(adj.quantity || 0);
                
                if (adj.type === 'increase') {
                    // Keep positive for increase
                } else if (adj.type === 'decrease') {
                    quantity = -quantity;
                } else if (adj.type === 'set') {
                    // Keep as is for set
                }
                
                movements.push({
                    date: adj.date,
                    type: 'adjustment',
                    typeLabel: 'جرد',
                    refNumber: adj.adjustmentNumber || adj.id,
                    productName: product?.name || 'غير معروف',
                    unit: 'صغرى',
                    quantity: quantity,
                    balanceBefore: 0, // Will calculate
                    balanceAfter: 0,
                    user: getUserName(adj.userId)
                });
            }
        }

        // Load returns (only those that restore to stock)
        if ((!movementType || movementType === 'return') && window.electronAPI && window.electronAPI.dbGetAll) {
            let returnQuery = 'restoredToStock = ?';
            let returnParams = ['true'];
            if (dateFrom) {
                returnQuery += ' AND date >= ?';
                returnParams.push(dateFrom);
            }
            if (dateTo) {
                returnQuery += ' AND date <= ?';
                returnParams.push(dateTo);
            }
            
            const returns = await window.electronAPI.dbGetAll('returns', returnQuery, returnParams) || [];
            
            for (const ret of returns) {
                const product = products.find(p => p.id === ret.productId);
                movements.push({
                    date: ret.date,
                    type: 'return',
                    typeLabel: 'مرتجع',
                    refNumber: ret.returnNumber || ret.id,
                    productName: product?.name || 'غير معروف',
                    unit: 'صغرى',
                    quantity: parseFloat(ret.quantity || 0), // Positive for returns (restored to stock)
                    balanceBefore: 0, // Will calculate
                    balanceAfter: 0,
                    user: getUserName(ret.userId)
                });
            }
        }
        
        // Load delivery notes (إذن صرف) - No stock deduction, just tracking
        if ((!movementType || movementType === 'delivery-note') && window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', query, params) || [];
            
            for (const note of deliveryNotes) {
                const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [note.id]) || [];
                for (const item of noteItems) {
                    const product = products.find(p => p.id === item.productId);
                    let quantity = parseFloat(item.quantity || 0);
                    // Convert to smallest unit if needed
                    if (item.unit === 'largest' && product) {
                        const conversionFactor = product.conversionFactor || 1;
                        quantity = quantity * conversionFactor;
                    }
                    
                    movements.push({
                        date: note.date,
                        type: 'delivery-note',
                        typeLabel: 'إذن صرف',
                        refNumber: note.deliveryNoteNumber || note.id,
                        productName: item.productName || product?.name || 'غير معروف',
                        unit: 'صغرى',
                        quantity: 0, // No stock change - just tracking
                        balanceBefore: 0, // Will calculate
                        balanceAfter: 0,
                        user: note.warehouseKeeperName || note.salesRepName || 'نظام'
                    });
                }
            }
        }
        
        // Load settlements (تسوية) - Stock deduction for sold, addition for returned/rejected
        if ((!movementType || movementType === 'settlement') && window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const settlements = await window.electronAPI.dbGetAll('delivery_settlements', query, params) || [];
            
            for (const settlement of settlements) {
                const settlementItems = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlement.id]) || [];
                for (const item of settlementItems) {
                    const product = products.find(p => p.id === item.productId);
                    
                    // Sold quantity (decreases stock)
                    if (item.soldQuantity > 0) {
                        let soldQty = parseFloat(item.soldQuantity || 0);
                        // Convert to smallest unit if needed
                        if (item.unit === 'largest' && product) {
                            const conversionFactor = product.conversionFactor || 1;
                            soldQty = soldQty * conversionFactor;
                        }
                        
                        movements.push({
                            date: settlement.date,
                            type: 'settlement',
                            typeLabel: 'تسوية - مباع',
                            refNumber: settlement.settlementNumber || settlement.id,
                            productName: item.productName || product?.name || 'غير معروف',
                            unit: 'صغرى',
                            quantity: -soldQty, // Negative for sold (decreases stock)
                            balanceBefore: 0, // Will calculate
                            balanceAfter: 0,
                            user: settlement.salesRepName || 'نظام'
                        });
                    }
                    
                    // Returned quantity (increases stock)
                    if (item.returnedQuantity > 0) {
                        let returnedQty = parseFloat(item.returnedQuantity || 0);
                        // Convert to smallest unit if needed
                        if (item.unit === 'largest' && product) {
                            const conversionFactor = product.conversionFactor || 1;
                            returnedQty = returnedQty * conversionFactor;
                        }
                        
                        movements.push({
                            date: settlement.date,
                            type: 'settlement',
                            typeLabel: 'تسوية - مرتجع',
                            refNumber: settlement.settlementNumber || settlement.id,
                            productName: item.productName || product?.name || 'غير معروف',
                            unit: 'صغرى',
                            quantity: returnedQty, // Positive for returned (increases stock)
                            balanceBefore: 0, // Will calculate
                            balanceAfter: 0,
                            user: settlement.salesRepName || 'نظام'
                        });
                    }
                    
                    // Rejected quantity (increases stock)
                    if (item.rejectedQuantity > 0) {
                        let rejectedQty = parseFloat(item.rejectedQuantity || 0);
                        // Convert to smallest unit if needed
                        if (item.unit === 'largest' && product) {
                            const conversionFactor = product.conversionFactor || 1;
                            rejectedQty = rejectedQty * conversionFactor;
                        }
                        
                        movements.push({
                            date: settlement.date,
                            type: 'settlement',
                            typeLabel: 'تسوية - مرفوض',
                            refNumber: settlement.settlementNumber || settlement.id,
                            productName: item.productName || product?.name || 'غير معروف',
                            unit: 'صغرى',
                            quantity: rejectedQty, // Positive for rejected (increases stock)
                            balanceBefore: 0, // Will calculate
                            balanceAfter: 0,
                            user: settlement.salesRepName || 'نظام'
                        });
                    }
                }
            }
        }
        
        // Sort by date and calculate running balance
        movements.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate running balance per product starting from opening stock
        const productBalances = {};
        const productOpeningStocks = {};
        
        // First, get opening stock for each product
        movements.forEach(movement => {
            if (!productOpeningStocks[movement.productName]) {
                const product = products.find(p => p.name === movement.productName || p.productName === movement.productName);
                // Start from opening stock, not current stock
                productOpeningStocks[movement.productName] = parseFloat(product?.openingStock || 0);
                productBalances[movement.productName] = parseFloat(product?.openingStock || 0);
            }
        });
        
        // Now calculate running balance from opening stock
        movements.forEach(movement => {
            // Store balance before movement
            movement.balanceBefore = productBalances[movement.productName];
            
            if (movement.type === 'set' || movement.type === 'adjustment') {
                // For set operations, check if it's a set type
                const adjustment = movements.find(m => m.refNumber === movement.refNumber && m.type === 'adjustment');
                if (adjustment && adjustment.type === 'set') {
                    productBalances[movement.productName] = Math.abs(movement.quantity);
                } else {
                    productBalances[movement.productName] += movement.quantity;
                }
            } else {
                productBalances[movement.productName] += movement.quantity;
            }
            
            movement.balanceAfter = productBalances[movement.productName];
        });
        
        // Filter by movement type if specified
        let filteredMovements = movements;
        if (movementType === 'purchase') {
            filteredMovements = movements.filter(m => m.type === 'purchase');
        } else if (movementType === 'sale') {
            filteredMovements = movements.filter(m => m.type === 'sale');
        } else if (movementType === 'adjustment') {
            filteredMovements = movements.filter(m => m.type === 'adjustment' || m.type === 'set');
        } else if (movementType === 'return') {
            filteredMovements = movements.filter(m => m.type === 'return');
        } else if (movementType === 'delivery-note') {
            filteredMovements = movements.filter(m => m.type === 'delivery-note');
        } else if (movementType === 'settlement') {
            filteredMovements = movements.filter(m => m.type === 'settlement');
        }
        
        // Store items for pagination
        inventoryMovementItems = filteredMovements;
        currentPage = 1;
        
        // Render with pagination
        renderInventoryMovement();
    } catch (error) {
        console.error('Error loading inventory movement:', error);
        document.getElementById('inventoryMovementBody').innerHTML = '<tr><td colspan="9" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Load Product Movement
async function loadProductMovement() {
    // Ensure users are loaded
    if (!users || users.length === 0) {
        await loadInitialData();
    }
    
    const productId = document.getElementById('productSelect').value;
    const dateFrom = document.getElementById('productDateFrom').value;
    const dateTo = document.getElementById('productDateTo').value;
    
    if (!productId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار المنتج', 'error');
        } else {
        alert('⚠️ يرجى اختيار المنتج');
        }
        return;
    }
    
    try {
        const tbody = document.getElementById('productMovementBody');
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">جارٍ التحميل...</td></tr>';
        
        const product = products.find(p => p.id === productId);
        if (!product) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty-state">المنتج غير موجود</td></tr>';
            return;
        }
        
        const movements = [];
        
        // Load purchase invoices
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const purchaseInvoices = await window.electronAPI.dbGetAll('purchase_invoices', query, params) || [];
            
            for (const invoice of purchaseInvoices) {
                const items = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ? AND productId = ?', [invoice.id, productId]) || [];
                for (const item of items) {
                    movements.push({
                        date: invoice.date,
                        type: 'purchase',
                        typeLabel: 'مشتريات',
                        refNumber: invoice.invoiceNumber || invoice.id,
                        productName: item.productName || product.name,
                        unit: item.unit === 'smallest' ? 'صغرى' : 'كبرى',
                        quantity: parseFloat(item.quantity || 0),
                        price: parseFloat(item.price || 0),
                        total: parseFloat(item.total || 0),
                        balanceBefore: 0, // Will calculate
                        balanceAfter: 0,
                        user: getUserName(invoice.userId)
                    });
                }
            }
            
            // Load sales invoices
            const salesInvoices = await window.electronAPI.dbGetAll('sales_invoices', query, params) || [];
            
            for (const invoice of salesInvoices) {
                const items = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ? AND productId = ?', [invoice.id, productId]) || [];
                for (const item of items) {
                    movements.push({
                        date: invoice.date,
                        type: 'sale',
                        typeLabel: 'مبيعات',
                        refNumber: invoice.invoiceNumber || invoice.id,
                        productName: item.productName || product.name,
                        unit: item.unit === 'smallest' ? 'صغرى' : 'كبرى',
                        quantity: -parseFloat(item.quantity || 0),
                        price: parseFloat(item.price || 0),
                        total: parseFloat(item.total || 0),
                        balanceBefore: 0, // Will calculate
                        balanceAfter: 0,
                        user: getUserName(invoice.userId)
                    });
                }
            }
            
            // Load inventory adjustments
            query = 'productId = ?';
            params = [productId];
            if (dateFrom) {
                query += ' AND date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                query += ' AND date <= ?';
                params.push(dateTo);
            }
            
            const adjustments = await window.electronAPI.dbGetAll('inventory_adjustments', query, params) || [];
            
            for (const adj of adjustments) {
                let quantity = parseFloat(adj.quantity || 0);
                
                if (adj.type === 'increase') {
                    // Keep positive for increase
                } else if (adj.type === 'decrease') {
                    quantity = -quantity;
                } else if (adj.type === 'set') {
                    // Keep as is for set
                }
                
                movements.push({
                    date: adj.date,
                    type: 'adjustment',
                    typeLabel: 'جرد',
                    refNumber: adj.adjustmentNumber || adj.id,
                    productName: product.name,
                    unit: 'صغرى',
                    quantity: quantity,
                    price: 0,
                    total: 0,
                    balanceBefore: 0, // Will calculate
                    balanceAfter: 0,
                    user: getUserName(adj.userId)
                });
            }

            // Load returns for this product (only those that restore to stock)
            let returnQuery = 'productId = ? AND restoredToStock = ?';
            let returnParams = [productId, 'true'];
            if (dateFrom) {
                returnQuery += ' AND date >= ?';
                returnParams.push(dateFrom);
            }
            if (dateTo) {
                returnQuery += ' AND date <= ?';
                returnParams.push(dateTo);
            }
            
            const returns = await window.electronAPI.dbGetAll('returns', returnQuery, returnParams) || [];
            
            for (const ret of returns) {
                movements.push({
                    date: ret.date,
                    type: 'return',
                    typeLabel: 'مرتجع',
                    refNumber: ret.returnNumber || ret.id,
                    productName: product.name,
                    unit: 'صغرى',
                    quantity: parseFloat(ret.quantity || 0), // Positive for returns (restored to stock)
                    price: parseFloat(ret.unitPrice || 0),
                    total: parseFloat(ret.totalAmount || 0),
                    balanceBefore: 0, // Will calculate
                    balanceAfter: 0,
                    user: getUserName(ret.userId)
                });
            }
        }
        
        // Sort by date and calculate running balance
        movements.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Start from opening stock, not current stock
        let currentBalance = parseFloat(product.openingStock || 0);
        movements.forEach(movement => {
            // Store balance before movement
            movement.balanceBefore = currentBalance;
            
            if (movement.type === 'set' || movement.type === 'adjustment') {
                // For set operations, check if it's a set type
                const adjustment = movements.find(m => m.refNumber === movement.refNumber && m.type === 'adjustment');
                if (adjustment && adjustment.type === 'set') {
                    currentBalance = Math.abs(movement.quantity);
                } else {
                    currentBalance += movement.quantity;
                }
            } else {
                currentBalance += movement.quantity;
            }
            movement.balanceAfter = currentBalance;
        });
        
        // Store items for pagination
        productMovementItems = movements;
        currentPage = 1;
        
        // Render with pagination
        renderProductMovement();
    } catch (error) {
        console.error('Error loading product movement:', error);
        document.getElementById('productMovementBody').innerHTML = '<tr><td colspan="11" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Helper functions for pagination
function getCurrentItems() {
    switch (currentTab) {
        case 'customer-statement':
            return customerStatementItems;
        case 'supplier-statement':
            return supplierStatementItems;
        case 'inventory-movement':
            return inventoryMovementItems;
        case 'product-movement':
            return productMovementItems;
        case 'delivery-notes-settlements':
            return deliveryNotesSettlementsItems;
        case 'operating-expenses':
            return operatingExpensesItems;
        default:
            return [];
    }
}

function getTotalPages() {
    const items = getCurrentItems();
    return Math.ceil(items.length / itemsPerPage);
}

function updatePaginationDisplay() {
    const paginationContainer = document.getElementById('paginationContainer');
    const items = getCurrentItems();
    
    if (items.length === 0) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    renderPagination();
}

function renderPagination() {
    const items = getCurrentItems();
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${items.length}`;
    
    // Update pagination buttons
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
    
    // Render page numbers
    const pageNumbersEl = document.getElementById('pageNumbers');
    pageNumbersEl.innerHTML = '';
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderCurrentTab();
        });
        pageNumbersEl.appendChild(pageBtn);
    }
}

function renderCurrentTab() {
    switch (currentTab) {
        case 'customer-statement':
            renderCustomerStatement();
            break;
        case 'supplier-statement':
            renderSupplierStatement();
            break;
        case 'inventory-movement':
            renderInventoryMovement();
            break;
        case 'product-movement':
            renderProductMovement();
            break;
        case 'delivery-notes-settlements':
            renderDeliveryNotesSettlements();
            break;
        case 'operating-expenses':
            renderOperatingExpenses();
            break;
    }
}

// Render Customer Statement with pagination
function renderCustomerStatement() {
    const tbody = document.getElementById('customerStatementBody');
    const items = customerStatementItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد حركات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = paginatedItems.map(item => {
        // Determine type class for badge
        let typeClass = 'invoice';
        if (item.type === 'فاتورة مبيعات') {
            typeClass = 'invoice';
        } else if (item.type === 'سند قبض') {
            typeClass = 'receipt';
        } else if (item.type === 'مرتجع من عميل') {
            typeClass = 'return';
        }
        
        return `
            <tr>
                <td>${item.code}</td>
                <td>${item.refNumber}</td>
                <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                <td><span class="movement-type-badge ${typeClass}">${item.type}</span></td>
                <td>${formatCurrency(item.totalMovement || item.invoiceAmount || 0)}</td>
                <td class="${item.oldBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${formatCurrency(item.oldBalance)}</td>
                <td>${formatCurrency(item.paid)}</td>
                <td class="${item.newBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${formatCurrency(item.newBalance)}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePaginationDisplay();
}

// Render Supplier Statement with pagination
function renderSupplierStatement() {
    const tbody = document.getElementById('supplierStatementBody');
    const items = supplierStatementItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد حركات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = paginatedItems.map(item => {
        // Determine type class for badge
        let typeClass = 'purchase-invoice';
        if (item.type === 'فاتورة مشتريات') {
            typeClass = 'purchase-invoice';
        } else if (item.type === 'سند صرف') {
            typeClass = 'payment';
        } else if (item.type === 'مرتجع إلى مورد') {
            typeClass = 'return';
        }
        
        return `
            <tr>
                <td>${item.code}</td>
                <td>${item.refNumber}</td>
                <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                <td><span class="movement-type-badge ${typeClass}">${item.type}</span></td>
                <td>${formatCurrency(item.totalMovement || item.invoiceAmount || 0)}</td>
                <td class="${item.oldBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${formatCurrency(item.oldBalance)}</td>
                <td>${formatCurrency(item.paid)}</td>
                <td class="${item.newBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${formatCurrency(item.newBalance)}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePaginationDisplay();
}

// Render Inventory Movement with pagination
function renderInventoryMovement() {
    const tbody = document.getElementById('inventoryMovementBody');
    const items = inventoryMovementItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">لا توجد حركات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = paginatedItems.map(movement => {
        const quantityClass = movement.quantity > 0 ? 'quantity-positive' : 
                             movement.quantity < 0 ? 'quantity-negative' : 'quantity-set';
        return `
            <tr>
                <td>${new Date(movement.date).toLocaleDateString('ar-EG')}</td>
                <td><span class="movement-type-badge ${movement.type}">${movement.typeLabel}</span></td>
                <td>${movement.refNumber}</td>
                <td>${movement.productName}</td>
                <td>${movement.unit}</td>
                <td>${formatArabicNumber(movement.balanceBefore, 0)}</td>
                <td class="${quantityClass}">${movement.quantity > 0 ? '+' : ''}${formatArabicNumber(movement.quantity, 0)}</td>
                <td>${formatArabicNumber(movement.balanceAfter, 0)}</td>
                <td>${movement.user}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePaginationDisplay();
}

// Render Product Movement with pagination
function renderProductMovement() {
    const tbody = document.getElementById('productMovementBody');
    const items = productMovementItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">لا توجد حركات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = paginatedItems.map(movement => {
        const quantityClass = movement.quantity > 0 ? 'quantity-positive' : 
                             movement.quantity < 0 ? 'quantity-negative' : 'quantity-set';
        return `
            <tr>
                <td>${new Date(movement.date).toLocaleDateString('ar-EG')}</td>
                <td><span class="movement-type-badge ${movement.type}">${movement.typeLabel}</span></td>
                <td>${movement.refNumber}</td>
                <td>${movement.productName}</td>
                <td>${movement.unit}</td>
                <td>${formatArabicNumber(movement.balanceBefore, 0)}</td>
                <td class="${quantityClass}">${movement.quantity > 0 ? '+' : ''}${formatArabicNumber(movement.quantity, 0)}</td>
                <td>${formatArabicNumber(movement.balanceAfter, 0)}</td>
                <td>${movement.price > 0 ? formatCurrency(movement.price) : '-'}</td>
                <td>${movement.total > 0 ? formatCurrency(movement.total) : '-'}</td>
                <td>${movement.user}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePaginationDisplay();
}

// Load Delivery Notes and Settlements
async function loadDeliveryNotesSettlements() {
    const dateFrom = document.getElementById('dnDateFrom').value;
    const dateTo = document.getElementById('dnDateTo').value;
    const statusFilter = document.getElementById('dnStatusFilter').value;
    
    try {
        const tbody = document.getElementById('deliveryNotesSettlementsBody');
        tbody.innerHTML = '<tr><td colspan="12" class="empty-state">جارٍ التحميل...</td></tr>';
        
        const items = [];
        
        // Load delivery notes
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            
            if (statusFilter) {
                query = 'status = ?';
                params.push(statusFilter);
            }
            
            if (dateFrom) {
                if (query) query += ' AND ';
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            const deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', query, params) || [];
            
            for (const note of deliveryNotes) {
                // Load note items
                const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [note.id]) || [];
                
                // Load settlement for this note
                const settlements = await window.electronAPI.dbGetAll('delivery_settlements', 'deliveryNoteId = ?', [note.id]) || [];
                const settlement = settlements.length > 0 ? settlements[0] : null;
                
                // Load settlement items if settlement exists
                let settlementItems = [];
                if (settlement) {
                    settlementItems = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlement.id]) || [];
                }
                
                // Create items for each note item
                for (const noteItem of noteItems) {
                    const product = products.find(p => p.id === noteItem.productId);
                    const settlementItem = settlementItems.find(si => si.productId === noteItem.productId && si.unit === noteItem.unit);
                    
                    items.push({
                        date: note.date,
                        deliveryNoteNumber: note.deliveryNoteNumber || note.id,
                        warehouseKeeperName: note.warehouseKeeperName || note.salesRepName || '',
                        settlementNumber: settlement ? (settlement.settlementNumber || settlement.id) : '',
                        salesRepName: settlement ? (settlement.salesRepName || '') : '',
                        productName: noteItem.productName || product?.name || 'غير معروف',
                        issuedQuantity: parseFloat(noteItem.quantity || 0),
                        soldQuantity: settlementItem ? parseFloat(settlementItem.soldQuantity || 0) : 0,
                        returnedQuantity: settlementItem ? parseFloat(settlementItem.returnedQuantity || 0) : 0,
                        rejectedQuantity: settlementItem ? parseFloat(settlementItem.rejectedQuantity || 0) : 0,
                        difference: settlementItem ? parseFloat(settlementItem.difference || 0) : 0,
                        unit: noteItem.unitName || noteItem.unit || '',
                        status: note.status === 'issued' ? 'صادر' : note.status === 'settled' ? 'تم التسوية' : note.status
                    });
                }
            }
        }
        
        // Sort by date
        items.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Store items for pagination
        deliveryNotesSettlementsItems = items;
        currentPage = 1;
        
        // Render with pagination
        renderDeliveryNotesSettlements();
    } catch (error) {
        console.error('Error loading delivery notes and settlements:', error);
        document.getElementById('deliveryNotesSettlementsBody').innerHTML = '<tr><td colspan="12" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Render Delivery Notes and Settlements
function renderDeliveryNotesSettlements() {
    const tbody = document.getElementById('deliveryNotesSettlementsBody');
    const items = deliveryNotesSettlementsItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="empty-state">لا توجد بيانات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = paginatedItems.map(item => {
        const statusClass = item.status === 'تم التسوية' ? 'status-settled' : 'status-issued';
        const differenceClass = item.difference > 0 ? 'quantity-positive' : 
                               item.difference < 0 ? 'quantity-negative' : '';
        
        return `
            <tr>
                <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                <td><strong>${item.deliveryNoteNumber}</strong></td>
                <td>${item.warehouseKeeperName}</td>
                <td>${item.settlementNumber || '-'}</td>
                <td>${item.salesRepName || '-'}</td>
                <td>${item.productName}</td>
                <td>${formatArabicNumber(item.issuedQuantity, 0)} ${item.unit}</td>
                <td>${item.soldQuantity > 0 ? formatArabicNumber(item.soldQuantity, 0) : '-'} ${item.soldQuantity > 0 ? item.unit : ''}</td>
                <td>${item.returnedQuantity > 0 ? formatArabicNumber(item.returnedQuantity, 0) : '-'} ${item.returnedQuantity > 0 ? item.unit : ''}</td>
                <td>${item.rejectedQuantity > 0 ? formatArabicNumber(item.rejectedQuantity, 0) : '-'} ${item.rejectedQuantity > 0 ? item.unit : ''}</td>
                <td class="${differenceClass}">${item.settlementNumber ? formatArabicNumber(item.difference, 0) : '-'} ${item.settlementNumber ? item.unit : ''}</td>
                <td><span class="status-badge ${statusClass}">${item.status}</span></td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePaginationDisplay();
}

// Load Operating Expenses
async function loadOperatingExpenses() {
    const dateFrom = document.getElementById('expensesDateFrom').value;
    const dateTo = document.getElementById('expensesDateTo').value;
    const typeFilter = document.getElementById('expensesTypeFilter').value;
    
    try {
        // Ensure users are loaded
        if (!users || users.length === 0) {
            await loadInitialData();
        }
        
        const tbody = document.getElementById('operatingExpensesBody');
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">جارٍ التحميل...</td></tr>';
        
        let expenses = [];
        
        // Load expenses from database
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            let query = '';
            let params = [];
            
            if (dateFrom) {
                query += 'date >= ?';
                params.push(dateFrom);
            }
            if (dateTo) {
                if (query) query += ' AND ';
                query += 'date <= ?';
                params.push(dateTo);
            }
            
            if (typeFilter) {
                if (query) query += ' AND ';
                if (typeFilter === 'salaries') {
                    query += 'category = ?';
                    params.push('salaries');
                } else if (typeFilter === 'operational') {
                    query += 'category != ?';
                    params.push('salaries');
                }
            }
            
            expenses = await window.electronAPI.dbGetAll('operating_expenses', query, params);
            expenses = Array.isArray(expenses) ? expenses : [];
        } else {
            // Fallback to localStorage
            const stored = localStorage.getItem('asel_operating_expenses');
            expenses = stored ? JSON.parse(stored) : [];
        }
        
        // Filter by date if needed (for localStorage fallback)
        if (dateFrom || dateTo) {
            expenses = expenses.filter(expense => {
                const expenseDate = new Date(expense.date);
                if (dateFrom && expenseDate < new Date(dateFrom)) return false;
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (expenseDate > toDate) return false;
                }
                return true;
            });
        }
        
        // Filter by type if needed (for localStorage fallback)
        if (typeFilter) {
            if (typeFilter === 'salaries') {
                expenses = expenses.filter(expense => expense.category === 'salaries');
            } else if (typeFilter === 'operational') {
                expenses = expenses.filter(expense => expense.category !== 'salaries');
            }
        }
        
        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Map expenses to items format
        operatingExpensesItems = expenses.map(expense => {
            // Get category name
            const categoryNames = {
                'salaries': 'مرتبات',
                'car': 'مصاريف تشغيل سيارة',
                'shipping': 'شحن',
                'rent': 'إيجار',
                'electricity': 'كهرباء',
                'internet': 'إنترنت',
                'packaging': 'تغليف',
                'maintenance': 'صيانة',
                'other': 'مصروفات أخرى'
            };
            
            // Get user name
            const userName = getUserName(expense.userId);
            
            return {
                date: expense.date,
                expenseNumber: expense.expenseNumber || '-',
                category: categoryNames[expense.category] || expense.category,
                amount: expense.amount || 0,
                recipientName: expense.recipientName || '-',
                description: expense.description || '-',
                user: userName
            };
        });
        
        // Reset to first page
        currentPage = 1;
        
        // Render expenses
        renderOperatingExpenses();
    } catch (error) {
        console.error('Error loading operating expenses:', error);
        document.getElementById('operatingExpensesBody').innerHTML = '<tr><td colspan="7" class="empty-state">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

// Render Operating Expenses
function renderOperatingExpenses() {
    const tbody = document.getElementById('operatingExpensesBody');
    const items = operatingExpensesItems;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد بيانات في الفترة المحددة</td></tr>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);
    
    // Render items
    tbody.innerHTML = paginatedItems.map(item => {
        return `
            <tr>
                <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                <td><strong>${item.expenseNumber}</strong></td>
                <td>${item.category}</td>
                <td class="balance-positive">${formatCurrency(item.amount)}</td>
                <td>${item.recipientName}</td>
                <td>${item.description}</td>
                <td>${item.user}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePaginationDisplay();
}

// Convert table to CSV
function tableToCSV(table) {
    const rows = table.querySelectorAll('tr');
    const csv = [];
    
    rows.forEach((row, index) => {
        const cols = row.querySelectorAll('th, td');
        const csvRow = [];
        
        cols.forEach(col => {
            let text = col.textContent.trim();
            // Remove badges and formatting
            text = text.replace(/\s+/g, ' ');
            // Escape quotes and wrap in quotes if contains comma
            if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                text = '"' + text.replace(/"/g, '""') + '"';
            }
            csvRow.push(text);
        });
        
        csv.push(csvRow.join(','));
    });
    
    // Add BOM for Excel UTF-8 support
    return '\uFEFF' + csv.join('\n');
}

// Save report as Excel (CSV) - uses all data, not just current page
function saveReport(type) {
    try {
        let items = [];
        let filename = '';
        let headers = [];
        
        if (type === 'customer') {
            items = customerStatementItems;
            const customerName = document.getElementById('customerSelect').selectedOptions[0]?.text || 'عميل';
            filename = `كشف_حساب_${customerName}_${new Date().toISOString().split('T')[0]}.csv`;
            headers = ['كود الحركة', 'رقم المرجع', 'التاريخ', 'نوع الحركة', 'إجمالي الحركة', 'الرصيد قبل الحركة', 'المدفوع أثناء الحركة', 'الرصيد الجديد'];
        } else if (type === 'supplier') {
            items = supplierStatementItems;
            const supplierName = document.getElementById('supplierSelect').selectedOptions[0]?.text || 'مورد';
            filename = `كشف_حساب_${supplierName}_${new Date().toISOString().split('T')[0]}.csv`;
            headers = ['كود الحركة', 'رقم المرجع', 'التاريخ', 'نوع الحركة', 'إجمالي الحركة', 'الرصيد قبل الحركة', 'المدفوع أثناء الحركة', 'الرصيد الجديد'];
        } else if (type === 'inventory') {
            items = inventoryMovementItems;
            filename = `حركة_مخزون_${new Date().toISOString().split('T')[0]}.csv`;
            headers = ['التاريخ', 'نوع الحركة', 'رقم المرجع', 'اسم المنتج', 'الوحدة', 'الكمية قبل الحركة', 'كمية الحركة', 'الكمية بعد الحركة', 'المستخدم'];
        } else if (type === 'product') {
            items = productMovementItems;
            const productName = document.getElementById('productSelect').selectedOptions[0]?.text || 'منتج';
            filename = `حركة_${productName}_${new Date().toISOString().split('T')[0]}.csv`;
            headers = ['التاريخ', 'نوع الحركة', 'رقم المرجع', 'اسم المنتج', 'الوحدة', 'الكمية قبل الحركة', 'كمية الحركة', 'الكمية بعد الحركة', 'السعر', 'إجمالي الحركة', 'المستخدم'];
        }
        
        if (!items || items.length === 0) {
            if (window.showToast) {
                window.showToast('لا يوجد بيانات للتصدير', 'error');
            } else {
            alert('❌ لا يوجد بيانات للتصدير');
            }
            return;
        }
        
        // Create CSV with all data
        const csvRows = [];
        csvRows.push(headers.join(','));
        
        items.forEach(item => {
            const row = [];
            if (type === 'customer' || type === 'supplier') {
                row.push(item.code || '');
                row.push(item.refNumber || '');
                row.push(new Date(item.date).toLocaleDateString('ar-EG'));
                row.push(item.type || '');
                row.push(item.totalMovement || item.invoiceAmount || 0);
                row.push(item.oldBalance || 0);
                row.push(item.paid || 0);
                row.push(item.newBalance || 0);
            } else if (type === 'inventory') {
                row.push(new Date(item.date).toLocaleDateString('ar-EG'));
                row.push(item.typeLabel || '');
                row.push(item.refNumber || '');
                row.push(item.productName || '');
                row.push(item.unit || '');
                row.push(item.balanceBefore || 0);
                row.push(item.quantity || 0);
                row.push(item.balanceAfter || 0);
                row.push(item.user || '');
            } else if (type === 'product') {
                row.push(new Date(item.date).toLocaleDateString('ar-EG'));
                row.push(item.typeLabel || '');
                row.push(item.refNumber || '');
                row.push(item.productName || '');
                row.push(item.unit || '');
                row.push(item.balanceBefore || 0);
                row.push(item.quantity || 0);
                row.push(item.balanceAfter || 0);
                row.push(item.price || 0);
                row.push(item.total || 0);
                row.push(item.user || '');
            }
            csvRows.push(row.join(','));
        });
        
        // Add BOM for Excel UTF-8 support
        const csv = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        if (window.showToast) {
            window.showToast('تم حفظ التقرير بنجاح كملف Excel', 'success');
        } else {
        alert('✅ تم حفظ التقرير بنجاح كملف Excel');
        }
    } catch (error) {
        console.error('Error saving report:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء حفظ التقرير', 'error');
        } else {
        alert('❌ حدث خطأ أثناء حفظ التقرير');
        }
    }
}

// Generate full statement HTML with header and footer
async function generateStatementHTML(type) {
    const companySettings = await getCompanySettings();
    let data = null;
    let title = '';
    let entityName = '';
    let entityCode = '';
    let entityAddress = '';
    let entityPhone = '';
    let isCustomer = false;
    
    if (type === 'customer') {
        data = customerStatementData;
        isCustomer = true;
        if (!data || !data.customer) {
            if (window.showToast) {
                window.showToast('يرجى تحميل كشف الحساب أولاً', 'error');
            } else {
            alert('❌ يرجى تحميل كشف الحساب أولاً');
            }
            return null;
        }
        const customer = data.customer;
        title = 'كشف حساب عميل';
        entityName = customer.name || customer.customerName || 'غير معروف';
        entityCode = customer.code || customer.customerCode || customer.id || '-';
        entityAddress = customer.address || '-';
        entityPhone = customer.phone || customer.mobile || '-';
    } else if (type === 'supplier') {
        data = supplierStatementData;
        if (!data || !data.supplier) {
            if (window.showToast) {
                window.showToast('يرجى تحميل كشف الحساب أولاً', 'error');
            } else {
            alert('❌ يرجى تحميل كشف الحساب أولاً');
            }
            return null;
        }
        const supplier = data.supplier;
        title = 'كشف حساب مورد';
        entityName = supplier.name || supplier.supplierName || 'غير معروف';
        entityCode = supplier.code || supplier.supplierCode || supplier.id || '-';
        entityAddress = supplier.address || '-';
        entityPhone = supplier.phone || supplier.mobile || '-';
        } else {
            // For inventory and product movements, generate HTML from all data
            let items = [];
            let headers = [];
            
            if (type === 'inventory') {
                items = inventoryMovementItems;
                title = 'حركة المخزون';
                headers = ['التاريخ', 'نوع الحركة', 'رقم المرجع', 'اسم المنتج', 'الوحدة', 'الكمية قبل الحركة', 'كمية الحركة', 'الكمية بعد الحركة', 'المستخدم'];
            } else {
                items = productMovementItems;
                const productName = document.getElementById('productSelect').selectedOptions[0]?.text || 'منتج';
                title = `حركة منتج - ${productName}`;
                headers = ['التاريخ', 'نوع الحركة', 'رقم المرجع', 'اسم المنتج', 'الوحدة', 'الكمية قبل الحركة', 'كمية الحركة', 'الكمية بعد الحركة', 'السعر', 'إجمالي الحركة', 'المستخدم'];
            }
            
            if (!items || items.length === 0) {
                if (window.showToast) {
                    window.showToast('لا يوجد بيانات للطباعة', 'error');
                } else {
                alert('❌ لا يوجد بيانات للطباعة');
                }
                return null;
            }
            
            // Generate table rows from all items
            const tableRows = items.map(item => {
                if (type === 'inventory') {
                    const quantityClass = item.quantity > 0 ? 'quantity-positive' : 
                                         item.quantity < 0 ? 'quantity-negative' : 'quantity-set';
                    return `
                        <tr>
                            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                            <td>${item.typeLabel}</td>
                            <td>${item.refNumber}</td>
                            <td>${item.productName}</td>
                            <td>${item.unit}</td>
                            <td>${formatArabicNumber(item.balanceBefore, 0)}</td>
                            <td>${item.quantity > 0 ? '+' : ''}${formatArabicNumber(item.quantity, 0)}</td>
                            <td>${formatArabicNumber(item.balanceAfter, 0)}</td>
                            <td>${item.user}</td>
                        </tr>
                    `;
                } else {
                    const quantityClass = item.quantity > 0 ? 'quantity-positive' : 
                                         item.quantity < 0 ? 'quantity-negative' : 'quantity-set';
                    return `
                        <tr>
                            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                            <td>${item.typeLabel}</td>
                            <td>${item.refNumber}</td>
                            <td>${item.productName}</td>
                            <td>${item.unit}</td>
                            <td>${formatArabicNumber(item.balanceBefore, 0)}</td>
                            <td>${item.quantity > 0 ? '+' : ''}${formatArabicNumber(item.quantity, 0)}</td>
                            <td>${formatArabicNumber(item.balanceAfter, 0)}</td>
                            <td>${item.price > 0 ? formatCurrency(item.price) : '-'}</td>
                            <td>${item.total > 0 ? formatCurrency(item.total) : '-'}</td>
                            <td>${item.user}</td>
                        </tr>
                    `;
                }
            }).join('');
            
            const tableHTML = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr>
                            ${headers.map(h => `<th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;
            
            return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
        h1 { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: right; border: 1px solid #ddd; }
        th { background-color: #f5f5f5; }
        @media print {
            body { padding: 10px; }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${tableHTML}
</body>
</html>`;
        }
    
    const summary = data.summary;
    const table = document.querySelector(`#${type === 'customer' ? 'customer-statement' : 'supplier-statement'}-tab table`);
    if (!table) {
        alert('❌ لا يوجد بيانات للطباعة');
        return null;
    }
    
    // Generate table rows
    const tableRows = data.statement.map(item => `
        <tr>
            <td>${item.code}</td>
            <td>${item.refNumber}</td>
            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
            <td>${item.type}</td>
            <td>${formatCurrency(item.totalMovement || item.invoiceAmount || 0)}</td>
            <td>${formatCurrency(item.oldBalance)}</td>
            <td>${formatCurrency(item.paid)}</td>
            <td>${formatCurrency(item.newBalance)}</td>
        </tr>
    `).join('');
    
    const tableHTML = `
        <table class="statement-table" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
                <tr>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">كود الحركة</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">رقم المرجع</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">التاريخ</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">نوع الحركة</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">إجمالي الحركة</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">الرصيد قبل الحركة</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">المدفوع أثناء الحركة</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: #f5f5f5;">الرصيد الجديد</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
    
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
        .header { margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .company-info { margin-bottom: 20px; }
        .company-info h2 { margin: 0 0 10px 0; font-size: 20px; }
        .entity-info { margin-bottom: 20px; background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
        .entity-info h3 { margin: 0 0 10px 0; font-size: 18px; color: #333; }
        .summary-section { margin: 20px 0; padding: 15px; background-color: #f0f0f0; border-radius: 5px; }
        .summary-section h3 { margin: 0 0 15px 0; font-size: 16px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
        .summary-row:last-child { border-bottom: none; font-weight: bold; font-size: 16px; }
        .summary-label { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 8px; text-align: right; border: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #333; }
        .footer h4 { margin: 15px 0 10px 0; font-size: 16px; }
        .footer p { margin: 8px 0; line-height: 1.6; }
        .signature-section { margin-top: 30px; display: flex; justify-content: space-between; }
        .signature-box { width: 45%; text-align: center; }
        @media print {
            body { padding: 10px; }
            .header, .footer { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h2>${companySettings.name || 'شركة أسيل'}</h2>
            <p><strong>العنوان:</strong> ${companySettings.address || '-'}</p>
            <p><strong>الهاتف:</strong> ${companySettings.phone || '-'}</p>
            <p><strong>البريد الإلكتروني:</strong> ${companySettings.email || '-'}</p>
        </div>
        
        <div class="entity-info">
            <h3>بيانات ${isCustomer ? 'العميل' : 'المورد'}</h3>
            <p><strong>اسم ${isCustomer ? 'العميل' : 'المورد'}:</strong> ${entityName}</p>
            <p><strong>رقم ${isCustomer ? 'العميل' : 'المورد'} / كود:</strong> ${entityCode}</p>
            <p><strong>العنوان:</strong> ${entityAddress}</p>
            <p><strong>هاتف / تواصل:</strong> ${entityPhone}</p>
        </div>
    </div>
    
    <div class="summary-section">
        <h3>ملخص الحساب</h3>
        <div class="summary-row">
            <span class="summary-label">رصيد مفتتح بتاريخ ${new Date(summary.firstDate).toLocaleDateString('ar-EG')}:</span>
            <span>${formatCurrency(summary.openingBalance)}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">${isCustomer ? 'إجمالي المبيعات / المستحقات' : 'إجمالي المشتريات / المستحقات'}:</span>
            <span>${formatCurrency(isCustomer ? summary.totalSales : summary.totalPurchases)}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">${isCustomer ? 'إجمالي التحصيلات / المدفوعات' : 'إجمالي السداد / المدفوعات'}:</span>
            <span>${formatCurrency(isCustomer ? summary.totalReceipts : summary.totalPayments)}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">الرصيد الختامي بتاريخ ${new Date(summary.lastDate).toLocaleDateString('ar-EG')}:</span>
            <span>${formatCurrency(summary.closingBalance)}</span>
        </div>
    </div>
    
    <h3 style="margin-top: 30px;">تفاصيل المعاملات</h3>
    ${tableHTML}
    
    <div class="footer">
        <h4>ملاحظات وشروط:</h4>
        <p>يرجى التواصل خلال 14 يومًا لتسوية الرصيد إن لزم.</p>
        <p>أي اختلافات يُرجى إثباتها بمستندات (فواتير/إيصالات) خلال 7 أيام من استلام كشف الحساب.</p>
        <p>يتحمل ${isCustomer ? 'العميل' : 'المورد'} أية رسوم تأخير أو فوائد متفق عليها بعد المدة المتفق عليها.</p>
        
        <div class="signature-section">
            <div class="signature-box">
                <p><strong>توقيع المحاسب:</strong></p>
                <p style="margin-top: 40px;">____________________</p>
                ${companySettings.accountantName ? `<p>${companySettings.accountantName}</p>` : ''}
            </div>
            <div class="signature-box">
                <p><strong>الختم:</strong></p>
                <p style="margin-top: 40px;">____________________</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    
    return html;
}

// Print report (print only)
async function printReport(type) {
    try {
        let htmlContent = '';
        
        if (type === 'customer' || type === 'supplier') {
            htmlContent = await generateStatementHTML(type);
            if (!htmlContent) return;
        } else {
            // For inventory and product movements, use generateStatementHTML
            htmlContent = await generateStatementHTML(type);
            if (!htmlContent) return;
        }
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Error printing report:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء الطباعة', 'error');
        } else {
        alert('❌ حدث خطأ أثناء الطباعة');
        }
    }
}

// Save report as PDF
async function saveReportAsPDF(type) {
    try {
        let htmlContent = '';
        let filename = '';
        
        if (type === 'customer' || type === 'supplier') {
            htmlContent = await generateStatementHTML(type);
            if (!htmlContent) return;
            
            if (type === 'customer') {
                const customerName = document.getElementById('customerSelect').selectedOptions[0]?.text || 'عميل';
                filename = `كشف_حساب_${customerName}_${new Date().toISOString().split('T')[0]}.pdf`;
            } else {
                const supplierName = document.getElementById('supplierSelect').selectedOptions[0]?.text || 'مورد';
                filename = `كشف_حساب_${supplierName}_${new Date().toISOString().split('T')[0]}.pdf`;
            }
        } else {
            // For inventory and product movements
            if (type === 'inventory') {
                filename = `حركة_مخزون_${new Date().toISOString().split('T')[0]}.pdf`;
            } else {
                const productName = document.getElementById('productSelect').selectedOptions[0]?.text || 'منتج';
                filename = `حركة_${productName}_${new Date().toISOString().split('T')[0]}.pdf`;
            }
            
            htmlContent = await generateStatementHTML(type);
            if (!htmlContent) return;
        }
        
        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            const result = await window.electronAPI.saveInvoiceToFile(htmlContent, filename);
            
            if (result.success) {
                if (window.showToast) {
                    window.showToast('تم حفظ الملف بنجاح', 'success');
                } else {
                alert('✅ تم حفظ الملف بنجاح');
                }
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                if (window.showToast) {
                    window.showToast('فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'), 'error');
            } else {
                alert('❌ فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'));
                }
            }
        } else {
            // Fallback: Use browser print with PDF option
            if (window.showToast) {
                window.showToast('وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"', 'error');
            } else {
            alert('⚠️ وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"');
            }
            printReport(type);
        }
    } catch (error) {
        console.error('Error saving PDF:', error);
        if (window.showToast) {
            window.showToast('حدث خطأ أثناء حفظ PDF: ' + error.message, 'error');
        } else {
        alert('❌ حدث خطأ أثناء حفظ PDF: ' + error.message);
        }
    }
}
