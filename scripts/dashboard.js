// Dashboard Management System

let dashboardChart = null;
let dashboardCurrentChartType = 'bar';
let dashboardSalesInvoices = [];
let dashboardSalesInvoiceItems = [];
let dashboardProducts = [];
let dashboardPurchaseInvoices = [];
let dashboardPurchaseInvoiceItems = [];

// Format numbers using Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩)
function formatArabicNumber(number, decimals = 2) {
    if (number === null || number === undefined || isNaN(number)) {
        number = 0;
    }
    
    const num = parseFloat(number);
    const formatted = num.toFixed(decimals);
    
    // Split into integer and decimal parts
    const parts = formatted.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    
    // Add thousands separator (٬)
    let integerWithSeparator = '';
    for (let i = integerPart.length - 1, j = 0; i >= 0; i--, j++) {
        if (j > 0 && j % 3 === 0) {
            integerWithSeparator = '٬' + integerWithSeparator;
        }
        integerWithSeparator = integerPart[i] + integerWithSeparator;
    }
    
    // Combine with decimal separator (٫)
    const result = decimalPart 
        ? integerWithSeparator + '٫' + decimalPart
        : integerWithSeparator;
    
    // Convert to Eastern Arabic numerals
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return result.replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
}

// Format currency with Arabic numerals
function formatArabicCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicNumber(amount, decimals) + ' ' + currency;
}

// Ensure calculator button is clickable - fix any interference
document.addEventListener('DOMContentLoaded', function() {
    const calculatorBtn = document.querySelector('.calculator-btn');
    if (calculatorBtn) {
        // Ensure the link is clickable
        calculatorBtn.style.pointerEvents = 'auto';
        calculatorBtn.style.cursor = 'pointer';
        
        // Remove any event listeners that might block clicks
        const newBtn = calculatorBtn.cloneNode(true);
        calculatorBtn.parentNode.replaceChild(newBtn, calculatorBtn);
    }
});

async function loadStatistics() {
    try {
        // Always load from SQLite database only (no localStorage fallback)
        let products = [];
        let categories = [];
        let customers = [];
        let suppliers = [];
        let salesInvoices = [];
        let purchaseInvoices = [];

        if (window.electronAPI && window.electronAPI.dbGetAll) {
            // Load from SQLite database only
            try {
                // Load each table separately with error handling
                // Try dbGetAll first, if it fails try dbQuery
                try {
                    const result = await window.electronAPI.dbGetAll('products', '', []);
                    products = result || [];
                    if (products.length === 0) {
                        // Try dbQuery as fallback
                        const queryResult = await window.electronAPI.dbQuery('SELECT * FROM products', []);
                        products = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                    }
                } catch (err) {
                    console.error('Error loading products:', err);
                    try {
                        const queryResult = await window.electronAPI.dbQuery('SELECT * FROM products', []);
                        products = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                    } catch (queryErr) {
                        console.error('Error loading products via dbQuery:', queryErr);
                        products = [];
                    }
                }
                
                try {
                    const result = await window.electronAPI.dbGetAll('categories', '', []);
                    categories = result || [];
                    if (categories.length === 0) {
                        const queryResult = await window.electronAPI.dbQuery('SELECT * FROM categories', []);
                        categories = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                    }
                } catch (err) {
                    console.error('Error loading categories:', err);
                    try {
                        const queryResult = await window.electronAPI.dbQuery('SELECT * FROM categories', []);
                        categories = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                    } catch (queryErr) {
                        console.error('Error loading categories via dbQuery:', queryErr);
                        categories = [];
                    }
                }
                
                try {
                    const result = await window.electronAPI.dbGetAll('customers', '', []);
                    customers = result || [];
                    if (customers.length === 0) {
                        const queryResult = await window.electronAPI.dbQuery('SELECT * FROM customers', []);
                        customers = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                    }
                } catch (err) {
                    console.error('Error loading customers:', err);
                    try {
                        const queryResult = await window.electronAPI.dbQuery('SELECT * FROM customers', []);
                        customers = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                    } catch (queryErr) {
                        console.error('Error loading customers via dbQuery:', queryErr);
                        customers = [];
                    }
                }
                
                try {
                    const result = await window.electronAPI.dbGetAll('suppliers', '', []);
                    suppliers = result || [];
                    if (suppliers.length === 0) {
                        const queryResult = await window.electronAPI.dbQuery('SELECT * FROM suppliers', []);
                        suppliers = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                    }
                } catch (err) {
                    console.error('Error loading suppliers:', err);
                    try {
                        const queryResult = await window.electronAPI.dbQuery('SELECT * FROM suppliers', []);
                        suppliers = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                    } catch (queryErr) {
                        console.error('Error loading suppliers via dbQuery:', queryErr);
                        suppliers = [];
                    }
                }
                
                try {
                    const result = await window.electronAPI.dbGetAll('sales_invoices', '', []);
                    salesInvoices = result || [];
                } catch (err) {
                    console.error('Error loading sales invoices:', err);
                    salesInvoices = [];
                }
                
                try {
                    const result = await window.electronAPI.dbGetAll('purchase_invoices', '', []);
                    purchaseInvoices = result || [];
                } catch (err) {
                    console.error('Error loading purchase invoices:', err);
                    purchaseInvoices = [];
                }
                
                // Ensure arrays
                products = Array.isArray(products) ? products : (products ? [products] : []);
                categories = Array.isArray(categories) ? categories : (categories ? [categories] : []);
                customers = Array.isArray(customers) ? customers : (customers ? [customers] : []);
                suppliers = Array.isArray(suppliers) ? suppliers : (suppliers ? [suppliers] : []);
                salesInvoices = Array.isArray(salesInvoices) ? salesInvoices : (salesInvoices ? [salesInvoices] : []);
                purchaseInvoices = Array.isArray(purchaseInvoices) ? purchaseInvoices : (purchaseInvoices ? [purchaseInvoices] : []);
            } catch (error) {
                console.error('Error loading from database:', error);
                console.error('Error details:', error.message, error.stack);
                // If database error, return empty arrays
                products = [];
                categories = [];
                customers = [];
                suppliers = [];
                salesInvoices = [];
                purchaseInvoices = [];
            }
        } else {
            // If API not available, return empty arrays
            products = [];
            categories = [];
            customers = [];
            suppliers = [];
            salesInvoices = [];
            purchaseInvoices = [];
        }

        // Ensure all are arrays (double check)
        products = Array.isArray(products) ? products : [];
        categories = Array.isArray(categories) ? categories : [];
        customers = Array.isArray(customers) ? customers : [];
        suppliers = Array.isArray(suppliers) ? suppliers : [];
        salesInvoices = Array.isArray(salesInvoices) ? salesInvoices : [];
        purchaseInvoices = Array.isArray(purchaseInvoices) ? purchaseInvoices : [];

        // Calculate statistics - ensure arrays are valid
        // Filter out invalid products (no id, deleted, etc.)
        const validProducts = Array.isArray(products) ? products.filter(p => {
            if (!p || !p.id) return false;
            // Exclude deleted products
            if (p.deleted === true || p.deleted === 1) return false;
            return true;
        }) : [];
        
        const totalProducts = validProducts.length;
        const activeProducts = validProducts.filter(p => {
            if (!p) return false;
            const status = p.status;
            // Consider active if status is 'active', null, undefined, or empty string
            return status === 'active' || status === null || status === undefined || status === '';
        }).length;
        // Filter out invalid categories (no id, deleted, etc.)
        const validCategories = Array.isArray(categories) ? categories.filter(c => {
            if (!c || !c.id) return false;
            // Exclude deleted categories
            if (c.deleted === true || c.deleted === 1) return false;
            return true;
        }) : [];
        
        // Filter out invalid customers (no id, deleted, etc.)
        const validCustomers = Array.isArray(customers) ? customers.filter(c => {
            if (!c || !c.id) return false;
            // Exclude deleted customers
            if (c.deleted === true || c.deleted === 1) return false;
            return true;
        }) : [];
        
        // Filter out invalid suppliers (no id, deleted, etc.)
        const validSuppliers = Array.isArray(suppliers) ? suppliers.filter(s => {
            if (!s || !s.id) return false;
            // Exclude deleted suppliers
            if (s.deleted === true || s.deleted === 1) return false;
            return true;
        }) : [];
        
        const totalCategories = validCategories.length;
        const totalCustomers = validCustomers.length;
        const totalSuppliers = validSuppliers.length;

        // Calculate customers with balance > 10,000 (only from valid customers)
        const customersHighBalance = validCustomers.filter(c => {
            if (!c) return false;
            const balance = parseFloat(c.balance) || 0;
            return balance > 10000;
        }).length;

        // Update UI immediately
        const totalProductsEl = document.getElementById('totalProducts');
        const activeProductsEl = document.getElementById('activeProducts');
        const totalCategoriesEl = document.getElementById('totalCategories');
        const totalCustomersEl = document.getElementById('totalCustomers');
        const totalSuppliersEl = document.getElementById('totalSuppliers');
        const customersHighBalanceEl = document.getElementById('customersHighBalance');
        
        if (totalProductsEl) {
            totalProductsEl.textContent = totalProducts.toLocaleString('ar-EG');
        } else {
            console.error('totalProducts element not found!');
        }
        
        if (activeProductsEl) {
            activeProductsEl.textContent = activeProducts.toLocaleString('ar-EG');
        } else {
            console.error('activeProducts element not found!');
        }
        
        if (totalCategoriesEl) {
            totalCategoriesEl.textContent = totalCategories.toLocaleString('ar-EG');
        } else {
            console.error('totalCategories element not found!');
        }
        
        if (totalCustomersEl) {
            totalCustomersEl.textContent = totalCustomers.toLocaleString('ar-EG');
        } else {
            console.error('totalCustomers element not found!');
        }
        
        if (totalSuppliersEl) {
            totalSuppliersEl.textContent = totalSuppliers.toLocaleString('ar-EG');
        } else {
            console.error('totalSuppliers element not found!');
        }

        if (customersHighBalanceEl) {
            customersHighBalanceEl.textContent = customersHighBalance.toLocaleString('ar-EG');
        } else {
            console.error('customersHighBalance element not found!');
        }

        // Load high balance customers
        loadHighBalanceCustomers(customers);

        // Load recent sales
        loadRecentSales(salesInvoices, customers);

        // Load today's best selling products
        loadTodayBestSellingProducts();
        
        // Load chart data
        await loadDashboardChartData();
        
        // Calculate and display accounts receivable and payable
        await loadAccountsReceivableAndPayable(salesInvoices, purchaseInvoices);
        
        // Update notification badge
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Load Accounts Receivable and Payable
async function loadAccountsReceivableAndPayable(salesInvoices, purchaseInvoices) {
    try {
        // Calculate Accounts Receivable (الحسابات المدينة)
        // Sum of all positive customer balances (customers owe us money)
        let accountsReceivable = 0;
        let customers = [];
        
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                customers = await window.electronAPI.dbGetAll('customers', '', []);
                customers = Array.isArray(customers) ? customers : [];
            } catch (error) {
                console.error('Error loading customers for accounts receivable:', error);
                customers = [];
            }
        }
        
        // Sum all positive balances (customers who owe us money)
        if (customers && customers.length > 0) {
            customers.forEach(customer => {
                if (customer) {
                    const balance = parseFloat(customer.balance) || 0;
                    // Only count positive balances (customer owes us)
                    if (balance > 0) {
                        accountsReceivable += balance;
                    }
                }
            });
        }
        
        // Calculate Accounts Payable (الحسابات الدائنة)
        // Sum of all positive supplier balances (we owe suppliers money)
        let accountsPayable = 0;
        let suppliers = [];
        
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                suppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
                suppliers = Array.isArray(suppliers) ? suppliers : [];
            } catch (error) {
                console.error('Error loading suppliers for accounts payable:', error);
                suppliers = [];
            }
        }
        
        // Sum all positive balances (we owe suppliers money)
        if (suppliers && suppliers.length > 0) {
            suppliers.forEach(supplier => {
                if (supplier) {
                    const balance = parseFloat(supplier.balance) || 0;
                    // Only count positive balances (we owe supplier)
                    if (balance > 0) {
                        accountsPayable += balance;
                    }
                }
            });
        }
        
        // Update UI
        const accountsReceivableEl = document.getElementById('accountsReceivable');
        const accountsPayableEl = document.getElementById('accountsPayable');
        
        if (accountsReceivableEl) {
            accountsReceivableEl.textContent = formatArabicNumber(accountsReceivable);
        }
        
        if (accountsPayableEl) {
            accountsPayableEl.textContent = formatArabicNumber(accountsPayable);
        }
    } catch (error) {
        console.error('Error loading accounts receivable and payable:', error);
    }
}

// Load chart data
async function loadDashboardChartData() {
    try {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            dashboardSalesInvoices = await window.electronAPI.dbGetAll('sales_invoices', '', []) || [];
            dashboardSalesInvoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', '', []) || [];
            dashboardProducts = await window.electronAPI.dbGetAll('products', '', []) || [];
            dashboardPurchaseInvoices = await window.electronAPI.dbGetAll('purchase_invoices', '', []) || [];
            dashboardPurchaseInvoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', '', []) || [];
        }
        
        // Update chart with last 30 days data
        updateDashboardChart();
    } catch (error) {
        console.error('Error loading chart data:', error);
    }
}

// Update Dashboard Chart
function updateDashboardChart() {
    const ctx = document.getElementById('dashboardProfitChart');
    if (!ctx) return;
    
    const period = document.getElementById('dashboardChartPeriod')?.value || 'monthly';
    
    // Filter by last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];
    
    const invoices = dashboardSalesInvoices.filter(inv => {
        const invDate = inv.date.split('T')[0];
        return invDate >= fromDate && invDate <= toDate;
    });
    
    const items = dashboardSalesInvoiceItems.filter(item => {
        const invoice = invoices.find(inv => inv.id === item.invoiceId);
        return invoice !== undefined;
    });
    
    // Group by period
    const dataMap = {};
    
    invoices.forEach(invoice => {
        const date = new Date(invoice.date);
        let key;
        
        if (period === 'daily') {
            key = date.toISOString().split('T')[0];
        } else if (period === 'weekly') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
        } else { // monthly
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        if (!dataMap[key]) {
            dataMap[key] = { sales: 0, cost: 0 };
        }
        
        dataMap[key].sales += (invoice.total || 0);
    });
    
    // Calculate costs
    items.forEach(item => {
        const invoice = invoices.find(inv => inv.id === item.invoiceId);
        if (!invoice) return;
        
        const date = new Date(invoice.date);
        let key;
        
        if (period === 'daily') {
            key = date.toISOString().split('T')[0];
        } else if (period === 'weekly') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
        } else {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        if (!dataMap[key]) {
            dataMap[key] = { sales: 0, cost: 0 };
        }
        
        const product = dashboardProducts.find(p => p.id === item.productId);
        if (!product) return;
        
        const purchaseItems = dashboardPurchaseInvoiceItems.filter(pi => pi.productId === product.id);
        let totalPurchaseCost = 0;
        let totalPurchaseQty = 0;
        
        purchaseItems.forEach(pi => {
            const purchaseInv = dashboardPurchaseInvoices.find(pi2 => pi2.id === pi.invoiceId);
            if (purchaseInv) {
                const invDate = purchaseInv.date.split('T')[0];
                if (invDate >= fromDate && invDate <= toDate) {
                    totalPurchaseCost += (pi.price || 0) * (pi.quantity || 0);
                    totalPurchaseQty += (pi.quantity || 0);
                }
            }
        });
        
        const avgPurchasePrice = totalPurchaseQty > 0 ? totalPurchaseCost / totalPurchaseQty : 0;
        dataMap[key].cost += avgPurchasePrice * (item.quantity || 0);
    });
    
    // Sort keys
    const sortedKeys = Object.keys(dataMap).sort();
    
    // Prepare data
    const labels = sortedKeys.map(key => {
        if (period === 'monthly') {
            const [year, month] = key.split('-');
            const date = new Date(year, parseInt(month) - 1);
            return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
        } else if (period === 'weekly') {
            return new Date(key).toLocaleDateString('ar-EG');
        } else {
            return new Date(key).toLocaleDateString('ar-EG');
        }
    });
    
    const salesData = sortedKeys.map(key => dataMap[key].sales);
    const costData = sortedKeys.map(key => dataMap[key].cost);
    const profitData = sortedKeys.map(key => dataMap[key].sales - dataMap[key].cost);
    
    // Calculate totals for stat cards
    const totalSales = salesData.reduce((sum, val) => sum + val, 0);
    const totalCost = costData.reduce((sum, val) => sum + val, 0);
    const totalProfit = profitData.reduce((sum, val) => sum + val, 0);
    
    // Update stat cards
    updateDashboardChartStats(totalSales, totalCost, totalProfit);
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not available. Charts will be disabled.');
        if (ctx) {
            ctx.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">الرسوم البيانية غير متاحة</p>';
        }
        return;
    }
    
    // Destroy existing chart
    if (dashboardChart) {
        try {
            dashboardChart.destroy();
        } catch (e) {
            console.warn('Error destroying chart:', e);
        }
    }
    
    // Create new chart
    try {
        dashboardChart = new Chart(ctx, {
        type: dashboardCurrentChartType,
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'الربح',
                    data: profitData,
                    backgroundColor: 'rgba(79, 172, 254, 0.7)',
                    borderColor: 'rgba(79, 172, 254, 1)',
                    borderWidth: 2,
                    borderRadius: dashboardCurrentChartType === 'bar' ? 8 : 0,
                    borderSkipped: false,
                    tension: dashboardCurrentChartType === 'line' ? 0.4 : 0
                },
                {
                    label: 'التكلفة',
                    data: costData,
                    backgroundColor: 'rgba(238, 9, 121, 0.7)',
                    borderColor: 'rgba(238, 9, 121, 1)',
                    borderWidth: 2,
                    borderRadius: dashboardCurrentChartType === 'bar' ? 8 : 0,
                    borderSkipped: false,
                    tension: dashboardCurrentChartType === 'line' ? 0.4 : 0
                },
                {
                    label: 'المبيعات',
                    data: salesData,
                    backgroundColor: 'rgba(56, 239, 125, 0.7)',
                    borderColor: 'rgba(56, 239, 125, 1)',
                    borderWidth: 2,
                    borderRadius: dashboardCurrentChartType === 'bar' ? 8 : 0,
                    borderSkipped: false,
                    tension: dashboardCurrentChartType === 'line' ? 0.4 : 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            family: 'IBM Plex Sans Arabic'
                        },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 15,
                    cornerRadius: 10,
                    titleFont: {
                        size: 16
                    },
                    bodyFont: {
                        size: 14
                    },
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatArabicCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        callback: function(value) {
                            return formatArabicNumber(value);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart'
            }
        }
    });
    } catch (e) {
        console.error('Error creating chart:', e);
        if (ctx) {
            ctx.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">خطأ في تحميل الرسم البياني</p>';
        }
    }
}

// Update dashboard chart stat cards
function updateDashboardChartStats(totalSales, totalCost, totalProfit) {
    const salesValueEl = document.getElementById('dashboardSalesValue');
    const costValueEl = document.getElementById('dashboardCostValue');
    const profitValueEl = document.getElementById('dashboardProfitValue');
    
    if (salesValueEl) {
        salesValueEl.textContent = formatArabicNumber(totalSales);
    }
    if (costValueEl) {
        costValueEl.textContent = formatArabicNumber(totalCost);
    }
    if (profitValueEl) {
        profitValueEl.textContent = formatArabicNumber(totalProfit);
    }
}

// Update dashboard chart data
async function updateDashboardChartData() {
    await loadDashboardChartData();
}

// Change dashboard chart type
function changeDashboardChartType() {
    const chartTypes = ['bar', 'line', 'radar'];
    const currentIndex = chartTypes.indexOf(dashboardCurrentChartType);
    dashboardCurrentChartType = chartTypes[(currentIndex + 1) % chartTypes.length];
    
    // Update chart with new type
    updateDashboardChart();
}

function updateStatNumber(id, value) {
    const element = document.getElementById(id);
    if (element) {
        animateNumber(element, 0, value, 1000);
    }
}

function animateNumber(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        element.textContent = current.toLocaleString('ar-EG');
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

async function loadHighBalanceCustomers(customers) {
    const tbody = document.getElementById('highBalanceCustomersTableBody');
    if (!tbody) return;

    // Ensure we have valid array
    if (!Array.isArray(customers)) {
        customers = [];
    }

    // Filter and sort customers with balance > 10,000
    const highBalanceCustomers = customers
        .filter(c => {
            if (!c) return false;
            const balance = parseFloat(c.balance) || 0;
            return balance > 10000;
        })
        .sort((a, b) => {
            const balanceA = parseFloat(a.balance) || 0;
            const balanceB = parseFloat(b.balance) || 0;
            return balanceB - balanceA; // Sort by balance descending
        });

    if (highBalanceCustomers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #999;">
                    لا يوجد عملاء برصيد أكبر من 10,000 ج.م
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = highBalanceCustomers.map(customer => {
        const balance = parseFloat(customer.balance) || 0;
        const phone = customer.phone || 'غير متوفر';
        const lastTransactionDate = customer.lastTransactionDate 
            ? new Date(customer.lastTransactionDate).toLocaleDateString('ar-EG')
            : 'لا توجد معاملات';

        // Format balance with color based on amount
        const balanceClass = balance > 50000 ? 'high-balance' : balance > 20000 ? 'medium-balance' : 'normal-balance';
        const balanceFormatted = balance.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return `
            <tr>
                <td><strong>${customer.name || 'غير معروف'}</strong></td>
                <td>${phone}</td>
                <td><span class="balance-amount ${balanceClass}">${balanceFormatted} ج.م</span></td>
                <td>${lastTransactionDate}</td>
                <td>
                    <a href="customers.html" class="action-link">عرض</a>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadTodayBestSellingProducts() {
    const tbody = document.getElementById('todayBestSellingTableBody');
    if (!tbody) return;

    try {
        // Get today's date in local timezone (not UTC)
        // Dates are stored as YYYY-MM-DD in the database
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStart = `${year}-${month}-${day}`; // YYYY-MM-DD format in local time

        // Query sales invoice items directly from database with JOIN
        // This is more efficient than two separate queries
        let allItems = [];
        if (window.electronAPI && window.electronAPI.dbQuery) {
            try {
                // Get all invoice items for today's invoices using JOIN with products table
                // This brings data from sales_invoices, sales_invoice_items, and products tables
                // to get product category
                const itemsQuery = `
                    SELECT 
                        sii.productId,
                        sii.productName,
                        sii.quantity,
                        sii.total,
                        sii.unit,
                        COALESCE(p.category, 'غير محدد') as category
                    FROM sales_invoice_items sii
                    INNER JOIN sales_invoices si ON sii.invoiceId = si.id
                    LEFT JOIN products p ON sii.productId = p.id
                    WHERE substr(si.date, 1, 10) = ?
                `;
                allItems = await window.electronAPI.dbQuery(itemsQuery, [todayStart]);
                allItems = Array.isArray(allItems) ? allItems : (allItems ? [allItems] : []);
            } catch (err) {
                console.error('Error loading today\'s sales items with JOIN:', err);
                // Fallback method: get invoices first, then items
                try {
                    // Get invoices for today
                    const invoiceQuery = `
                        SELECT id 
                        FROM sales_invoices 
                        WHERE substr(date, 1, 10) = ?
                    `;
                    const todayInvoices = await window.electronAPI.dbQuery(invoiceQuery, [todayStart]);
                    const invoiceIds = Array.isArray(todayInvoices) 
                        ? todayInvoices.map(inv => inv.id)
                        : (todayInvoices ? [todayInvoices.id] : []);

                    if (invoiceIds.length === 0) {
                        allItems = [];
                    } else {
                        // Get items for today's invoices with product category
                        const placeholders = invoiceIds.map(() => '?').join(',');
                        const itemsQuery = `
                            SELECT 
                                sii.productId,
                                sii.productName,
                                sii.quantity,
                                sii.total,
                                sii.unit,
                                COALESCE(p.category, 'غير محدد') as category
                            FROM sales_invoice_items sii
                            LEFT JOIN products p ON sii.productId = p.id
                            WHERE sii.invoiceId IN (${placeholders})
                        `;
                        allItems = await window.electronAPI.dbQuery(itemsQuery, invoiceIds);
                        allItems = Array.isArray(allItems) ? allItems : (allItems ? [allItems] : []);
                    }
                } catch (fallbackErr) {
                    console.error('Error in fallback method:', fallbackErr);
                    // Last resort: get all invoices and filter in JavaScript
                    const allInvoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
                    const todayInvoices = (Array.isArray(allInvoices) ? allInvoices : []).filter(inv => {
                        if (!inv || !inv.date) return false;
                        // Get date in local timezone format (YYYY-MM-DD)
                        const invDate = new Date(inv.date);
                        const invYear = invDate.getFullYear();
                        const invMonth = String(invDate.getMonth() + 1).padStart(2, '0');
                        const invDay = String(invDate.getDate()).padStart(2, '0');
                        const invDateStr = `${invYear}-${invMonth}-${invDay}`;
                        return invDateStr === todayStart;
                    });

                    if (todayInvoices.length > 0) {
                        // Load all products to get categories
                        let productsMap = {};
                        try {
                            const allProducts = await window.electronAPI.dbGetAll('products', '', []);
                            if (Array.isArray(allProducts)) {
                                allProducts.forEach(p => {
                                    if (p && p.id) {
                                        productsMap[p.id] = p.category || 'غير محدد';
                                    }
                                });
                            }
                        } catch (prodErr) {
                            console.error('Error loading products for categories:', prodErr);
                        }

                        const invoiceIds = todayInvoices.map(inv => inv.id);
                        for (const invoiceId of invoiceIds) {
                            try {
                                const items = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                                if (Array.isArray(items)) {
                                    // Add category to each item
                                    const itemsWithCategory = items.map(item => ({
                                        ...item,
                                        category: productsMap[item.productId] || 'غير محدد'
                                    }));
                                    allItems.push(...itemsWithCategory);
                                }
                            } catch (itemErr) {
                                console.error('Error loading items for invoice:', invoiceId, itemErr);
                            }
                        }
                    }
                }
            }
        }

        // Group by product and sum quantities and totals
        // Note: We group by productId to get all sales for each product
        const productStats = {};
        
        allItems.forEach(item => {
            if (!item || !item.productId) return;
            
            const productId = item.productId;
            const productName = item.productName || 'منتج غير معروف';
            const category = item.category || 'غير محدد';
            const quantity = parseFloat(item.quantity) || 0;
            const total = parseFloat(item.total) || 0;

            if (!productStats[productId]) {
                productStats[productId] = {
                    productId: productId,
                    productName: productName,
                    category: category,
                    totalQuantity: 0,
                    totalSales: 0
                };
            }

            productStats[productId].totalQuantity += quantity;
            productStats[productId].totalSales += total;
        });

        // Convert to array and sort by quantity (descending)
        // Show ALL products, not just top 10
        const sortedProducts = Object.values(productStats)
            .sort((a, b) => b.totalQuantity - a.totalQuantity);

        if (sortedProducts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #999;">
                        لا توجد مبيعات اليوم (${todayStart})
                    </td>
                </tr>
            `;
            return;
        }

        // Display in table - show ALL products with name and category
        tbody.innerHTML = sortedProducts.map((product, index) => {
            const rank = index + 1;
            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            const rankClass = rank <= 3 ? 'top-rank' : '';

            return `
                <tr>
                    <td><span class="rank-badge ${rankClass}">${rankEmoji}</span></td>
                    <td><strong>${product.productName}</strong></td>
                    <td><span class="category-badge">${product.category}</span></td>
                    <td><span class="quantity-badge">${product.totalQuantity.toFixed(2)}</span></td>
                    <td><strong class="sales-amount">${product.totalSales.toFixed(2)} ج.م</strong></td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading today\'s best selling products:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">
                    خطأ في تحميل البيانات
                </td>
            </tr>
        `;
    }
}

async function loadRecentSales(salesInvoices, customers) {
    const tbody = document.getElementById('recentSalesTableBody');
    if (!tbody) return;

    // Ensure we have valid arrays
    if (!Array.isArray(salesInvoices)) {
        salesInvoices = [];
    }
    if (!Array.isArray(customers)) {
        customers = [];
    }

    // Sort by date (newest first)
    const sorted = salesInvoices
        .filter(inv => inv && (inv.date || inv.createdAt))
        .sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0);
            const dateB = new Date(b.date || b.createdAt || 0);
            return dateB - dateA;
        })
        .slice(0, 5);

    if (sorted.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                    لا توجد فواتير بعد
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sorted.map(invoice => {
        const customer = customers.find(c => c.id === invoice.customerId);
        const customerName = customer ? customer.name : 'عميل غير معروف';
        const status = invoice.status || 'pending';
        const statusText = status === 'delivered' ? 'تم التسليم' : 'جاري التسليم';
        const statusClass = status === 'delivered' ? 'delivered' : 'pending';
        const total = invoice.total || 0;
        const date = invoice.date || invoice.createdAt;

        return `
            <tr>
                <td>${invoice.invoiceNumber || invoice.id}</td>
                <td>${customerName}</td>
                <td>${new Date(date).toLocaleDateString('ar-EG')}</td>
                <td><strong>${total.toFixed(2)}</strong> ج.م</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <a href="sales.html" class="action-link">عرض</a>
                </td>
            </tr>
        `;
    }).join('');
}

function updateTime() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const dateString = now.toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        timeElement.innerHTML = `<span style="font-size: 20px;">🕐</span> ${timeString}<br><div style="font-size: 1rem; color: black; margin-top: 6px; font-weight: 500;">${dateString}</div>`;
    }
}

// Initialize on page load
// ===================================
// Notifications System
// ===================================

// Toggle notifications popup
function toggleNotificationsPopup() {
    const popup = document.getElementById('notificationsPopup');
    if (popup) {
        popup.classList.toggle('active');
        if (popup.classList.contains('active')) {
            loadNotifications();
        }
    }
}

// Close notifications popup
function closeNotificationsPopup() {
    const popup = document.getElementById('notificationsPopup');
    if (popup) {
        popup.classList.remove('active');
    }
}

// Load notifications (low stock products and high balance customers)
async function loadNotifications() {
    try {
        // Load low stock products
        await loadLowStockNotifications();
        
        // Load high balance customers
        await loadHighBalanceNotifications();
        
        // Update badge
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Load low stock products (stock === 0 or stock < 150) - matching products.js logic
async function loadLowStockNotifications() {
    const container = document.getElementById('lowStockNotifications');
    if (!container) return;
    
    try {
        container.innerHTML = '<div class="notification-item loading">جارٍ التحميل...</div>';
        
        let products = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const result = await window.electronAPI.dbGetAll('products', '', []);
                products = Array.isArray(result) ? result : (result ? [result] : []);
            } catch (err) {
                try {
                    const queryResult = await window.electronAPI.dbQuery('SELECT * FROM products', []);
                    products = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                } catch (queryErr) {
                    console.error('Error loading products for notifications:', queryErr);
                    products = [];
                }
            }
        }
        
        // Filter products with stock === 0 or stock < 150 (matching products.js logic)
        const lowStockProducts = products.filter(p => {
            if (!p || !p.id) return false;
            const stock = parseFloat(p.stock);
            if (isNaN(stock)) return false;
            // Match products.js: stock === 0 (out of stock) or stock < 150 (low stock)
            return stock === 0 || stock < 150;
        }).sort((a, b) => {
            const stockA = parseFloat(a.stock) || 0;
            const stockB = parseFloat(b.stock) || 0;
            return stockA - stockB; // Sort by stock ascending (lowest first)
        });
        
        if (lowStockProducts.length === 0) {
            container.innerHTML = '<div class="notification-item empty">لا توجد منتجات بمخزون منخفض أو نفد المخزون</div>';
            return;
        }
        
        // Display low stock products with icons matching products.js
        container.innerHTML = lowStockProducts.map(product => {
            const stock = parseFloat(product.stock) || 0;
            const unit = product.unit || 'قطعة';
            
            // Determine stock level and icon (matching products.js)
            let stockIcon = '✅';
            let stockStatus = '';
            if (stock === 0) {
                stockIcon = '🔴';
                stockStatus = 'نفد المخزون';
            } else if (stock < 150) {
                stockIcon = '⚠️';
                stockStatus = 'مخزون منخفض';
            }
            
            return `
                <div class="notification-item" onclick="window.location.href='products.html'">
                    <div class="notification-item-title">${stockIcon} ${product.name || 'غير معروف'}</div>
                    <div class="notification-item-details">${stockStatus}: ${stock.toLocaleString('ar-EG')} ${unit}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading low stock notifications:', error);
        container.innerHTML = '<div class="notification-item empty">حدث خطأ أثناء تحميل البيانات</div>';
    }
}

// Load high balance customers (balance > 10,000)
async function loadHighBalanceNotifications() {
    const container = document.getElementById('highBalanceNotifications');
    if (!container) return;
    
    try {
        container.innerHTML = '<div class="notification-item loading">جارٍ التحميل...</div>';
        
        let customers = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const result = await window.electronAPI.dbGetAll('customers', '', []);
                customers = result || [];
            } catch (err) {
                try {
                    const queryResult = await window.electronAPI.dbQuery('SELECT * FROM customers', []);
                    customers = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                } catch (queryErr) {
                    console.error('Error loading customers for notifications:', queryErr);
                    customers = [];
                }
            }
        }
        
        // Filter customers with balance > 10,000
        const highBalanceCustomers = customers.filter(c => {
            if (!c || !c.id) return false;
            const balance = parseFloat(c.balance);
            if (isNaN(balance)) return false;
            return balance > 10000;
        }).sort((a, b) => {
            const balanceA = parseFloat(a.balance) || 0;
            const balanceB = parseFloat(b.balance) || 0;
            return balanceB - balanceA; // Sort by balance descending (highest first)
        });
        
        if (highBalanceCustomers.length === 0) {
            container.innerHTML = '<div class="notification-item empty">لا يوجد عملاء برصيد يتخطى 10,000 ج.م</div>';
            return;
        }
        
        // Display high balance customers
        container.innerHTML = highBalanceCustomers.map(customer => {
            const balance = parseFloat(customer.balance) || 0;
            return `
                <div class="notification-item" onclick="window.location.href='customers.html'">
                    <div class="notification-item-title">${customer.name || 'غير معروف'}</div>
                    <div class="notification-item-details">الرصيد: ${balance.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading high balance notifications:', error);
        container.innerHTML = '<div class="notification-item empty">حدث خطأ أثناء تحميل البيانات</div>';
    }
}

// Update notification badge count
async function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    try {
        let products = [];
        let customers = [];
        
        // Load products
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const result = await window.electronAPI.dbGetAll('products', '', []);
                products = Array.isArray(result) ? result : (result ? [result] : []);
            } catch (err) {
                console.error('Error loading products for badge:', err);
                try {
                    const queryResult = await window.electronAPI.dbQuery('SELECT * FROM products', []);
                    products = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                } catch (queryErr) {
                    console.error('Error querying products for badge:', queryErr);
                    products = [];
                }
            }
        }
        
        // Load customers
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const result = await window.electronAPI.dbGetAll('customers', '', []);
                customers = Array.isArray(result) ? result : (result ? [result] : []);
            } catch (err) {
                console.error('Error loading customers for badge:', err);
                try {
                    const queryResult = await window.electronAPI.dbQuery('SELECT * FROM customers', []);
                    customers = Array.isArray(queryResult) ? queryResult : (queryResult ? [queryResult] : []);
                } catch (queryErr) {
                    console.error('Error querying customers for badge:', queryErr);
                    customers = [];
                }
            }
        }
        
        // Count low stock products (stock === 0 or stock < 150) - matching products.js logic
        const lowStockCount = products.filter(p => {
            if (!p || !p.id) return false;
            const stock = parseFloat(p.stock);
            if (isNaN(stock)) return false;
            // Match products.js: stock === 0 (out of stock) or stock < 150 (low stock)
            return stock === 0 || stock < 150;
        }).length;
        
        // Count high balance customers (balance > 10,000)
        const highBalanceCount = customers.filter(c => {
            if (!c || !c.id) return false;
            const balance = parseFloat(c.balance);
            if (isNaN(balance)) return false;
            return balance > 10000;
        }).length;
        
        const totalCount = lowStockCount + highBalanceCount;
        
        // Update badge
        if (totalCount > 0) {
            badge.textContent = totalCount > 99 ? '99+' : totalCount.toString();
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating notification badge:', error);
        if (badge) {
            badge.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    updateTime();
    setInterval(updateTime, 1000); // Update every second
    
    // Chart Period Select
    const chartPeriodSelect = document.getElementById('dashboardChartPeriod');
    if (chartPeriodSelect) {
        chartPeriodSelect.addEventListener('change', () => {
            updateDashboardChart();
        });
    }
    
    // Notifications button
    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationsPopup();
        });
    }
    
    // Close notifications button
    const closeNotificationsBtn = document.getElementById('closeNotificationsBtn');
    if (closeNotificationsBtn) {
        closeNotificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeNotificationsPopup();
        });
    }
    
    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('notificationsPopup');
        const btn = document.getElementById('notificationsBtn');
        if (popup && btn && !popup.contains(e.target) && !btn.contains(e.target)) {
            closeNotificationsPopup();
        }
    });
    
    // Update notification badge on load
    updateNotificationBadge();
    
    // Update notification badge every 30 seconds
    setInterval(updateNotificationBadge, 30000);
});

// Navigate to report page with permission check
function navigateToReport(url) {
    try {
        // Check if user has permission to access action-logs page
        if (window.PermissionsManager) {
            const hasAccess = window.PermissionsManager.canAccess('action_logs');
            
            if (!hasAccess) {
                alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                return false;
            }
        } else {
            // If PermissionsManager is not available, check localStorage directly
            const isLoggedIn = localStorage.getItem('asel_loggedIn') === 'true';
            if (!isLoggedIn) {
                alert('⚠️ يرجى تسجيل الدخول أولاً');
                window.location.href = 'login.html';
                return false;
            }
            
            const userPermissions = JSON.parse(localStorage.getItem('asel_userPermissions') || '[]');
            const hasAccess = userPermissions.includes('*') || userPermissions.includes('action_logs');
            
            if (!hasAccess) {
                alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                return false;
            }
        }
        
        // If permission is granted, navigate to the URL
        window.location.href = url;
        return true;
    } catch (error) {
        console.error('Error in navigateToReport:', error);
        alert('⚠️ حدث خطأ أثناء محاولة فتح الصفحة');
        return false;
    }
}

// Make function globally available
window.navigateToReport = navigateToReport;

// Open current month report
function openCurrentMonthReport() {
    try {
        // Check if user has permission to access reports page
        if (window.PermissionsManager) {
            const hasAccess = window.PermissionsManager.canAccess('reports');
            
            if (!hasAccess) {
                alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                return false;
            }
        } else {
            // If PermissionsManager is not available, check localStorage directly
            const isLoggedIn = localStorage.getItem('asel_loggedIn') === 'true';
            if (!isLoggedIn) {
                alert('⚠️ يرجى تسجيل الدخول أولاً');
                window.location.href = 'login.html';
                return false;
            }
            
            const userPermissions = JSON.parse(localStorage.getItem('asel_userPermissions') || '[]');
            const hasAccess = userPermissions.includes('*') || userPermissions.includes('reports');
            
            if (!hasAccess) {
                alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
                return false;
            }
        }
        
        // Calculate first and last day of current month
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        
        // First day of current month
        const firstDay = new Date(year, month, 1);
        const fromDate = firstDay.toISOString().split('T')[0];
        
        // Last day of current month
        const lastDay = new Date(year, month + 1, 0);
        const toDate = lastDay.toISOString().split('T')[0];
        
        // Navigate to reports page with date parameters
        window.location.href = `reports.html?fromDate=${fromDate}&toDate=${toDate}`;
        return true;
    } catch (error) {
        console.error('Error in openCurrentMonthReport:', error);
        alert('⚠️ حدث خطأ أثناء محاولة فتح التقرير');
        return false;
    }
}

// Make function globally available
window.openCurrentMonthReport = openCurrentMonthReport;

// Ensure functions are available on page load and setup event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Double-check that functions are available
    if (typeof window.navigateToReport !== 'function') {
        console.error('navigateToReport function not found!');
    }
    if (typeof window.openCurrentMonthReport !== 'function') {
        console.error('openCurrentMonthReport function not found!');
    }
    
    // Add event listeners to report buttons using data attributes
    const reportButtons = document.querySelectorAll('.quick-action-card[data-report-url], .quick-action-card[data-report-type]');
    reportButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            try {
                const reportUrl = button.getAttribute('data-report-url');
                const reportType = button.getAttribute('data-report-type');
                
                if (reportUrl) {
                    // Navigate to report URL
                    if (window.navigateToReport) {
                        window.navigateToReport(reportUrl);
                    } else {
                        // Fallback: navigate directly
                        window.location.href = reportUrl;
                    }
                } else if (reportType === 'current-month') {
                    // Open current month report
                    if (window.openCurrentMonthReport) {
                        window.openCurrentMonthReport();
                    } else {
                        // Fallback: navigate directly
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = today.getMonth();
                        const firstDay = new Date(year, month, 1);
                        const lastDay = new Date(year, month + 1, 0);
                        const fromDate = firstDay.toISOString().split('T')[0];
                        const toDate = lastDay.toISOString().split('T')[0];
                        window.location.href = `reports.html?fromDate=${fromDate}&toDate=${toDate}`;
                    }
                }
            } catch (error) {
                console.error('Error handling report button click:', error);
                alert('⚠️ حدث خطأ أثناء محاولة فتح الصفحة');
            }
        });
    });
});

