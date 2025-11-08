// Purchase Invoices Management System

// Storage Keys
const STORAGE_KEYS = {
    INVOICES: 'asel_purchase_invoices',
    SUPPLIERS: 'asel_suppliers',
    PRODUCTS: 'asel_products',
    INVOICE_COUNTER: 'asel_purchase_invoice_counter'
};

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

// Alias for formatCurrency (for compatibility)
function formatCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicCurrency(amount, currency, decimals);
}

// Initialize
let invoices = [];
let suppliers = [];
let products = [];
let invoiceProducts = [];
let currentInvoice = null;

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredInvoices = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderSuppliers();
    renderProducts();
    applyFilters();
    
    // Retry event listeners if button wasn't found initially
    setTimeout(() => {
        const newInvoiceBtn = document.getElementById('newInvoiceBtn');
        if (newInvoiceBtn && !newInvoiceBtn.hasAttribute('data-listener-attached')) {
            newInvoiceBtn.setAttribute('data-listener-attached', 'true');
            newInvoiceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    openNewInvoice();
                } catch (error) {
                    console.error('Error opening new invoice modal:', error);
                    alert('حدث خطأ أثناء فتح النافذة. يرجى المحاولة مرة أخرى.');
                }
            });
        }
    }, 500);
});

// Reload data when page becomes visible again (user returns to page)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        await loadData();
        renderSuppliers();
        renderProducts();
        applyFilters();
    }
});

// Also reload when page is shown (for browser back/forward navigation)
window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
        await loadData();
        renderSuppliers();
        renderProducts();
        applyFilters();
    }
});

// Reload when window gets focus (user switches back to app)
window.addEventListener('focus', async () => {
    await loadData();
    renderSuppliers();
    renderProducts();
    applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // New Invoice Button
    const newInvoiceBtn = document.getElementById('newInvoiceBtn');
    if (newInvoiceBtn) {
        newInvoiceBtn.setAttribute('data-listener-attached', 'true');
        newInvoiceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                openNewInvoice();
            } catch (error) {
                console.error('Error opening new invoice modal:', error);
                alert('حدث خطأ أثناء فتح النافذة. يرجى المحاولة مرة أخرى.');
            }
        });
    } else {
        console.error('newInvoiceBtn not found!');
    }
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            if (newInvoiceBtn) {
                newInvoiceBtn.click();
            }
        });
    }

    // Modal Close
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('invoiceForm').addEventListener('submit', handleFormSubmit);

    // Add Product Button
    document.getElementById('addProductBtn').addEventListener('click', addProductToInvoice);

    // Supplier Selection
    document.getElementById('supplierSelect').addEventListener('change', onSupplierChange);

    // Calculate totals on change (tax rate is disabled, so no listener needed)
    // document.getElementById('taxRate').addEventListener('input', calculateTotals);
    document.getElementById('shipping').addEventListener('input', calculateTotals);
    document.getElementById('discount').addEventListener('input', calculateTotals);
    document.getElementById('paid').addEventListener('input', calculateTotals);

    // Set due date based on invoice date
    document.getElementById('invoiceDate').addEventListener('change', setDueDate);

    // Print Button
    document.getElementById('printBtn').addEventListener('click', printInvoice);

    // Close modal on backdrop click
    document.getElementById('invoiceModal').addEventListener('click', (e) => {
        if (e.target.id === 'invoiceModal') {
            closeModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    setDueDate();

    // Pagination Event Listeners
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
        }
    });
    
    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });
    
    // Set tax rate to 0 for purchase invoices (no VAT)
    document.getElementById('taxRate').value = 0;
}

// Set Due Date
function setDueDate() {
    const invoiceDate = document.getElementById('invoiceDate').value;
    if (!invoiceDate) return;
    
    const invoiceSettings = getInvoiceSettings();
    const paymentDays = invoiceSettings.paymentDays || 30;
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + paymentDays);
    document.getElementById('dueDate').value = date.toISOString().split('T')[0];
}

// Get Invoice Settings
function getInvoiceSettings() {
    return JSON.parse(localStorage.getItem('asel_invoice_settings') || '{}');
}

// Get Company Settings
async function getCompanySettings() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            const companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            
            if (companyInfo) {
                // Map database fields to expected format - handle null/undefined values
                const settings = {
                    name: companyInfo.name || 'شركة أسيل',
                    address: companyInfo.address || '',
                    taxId: companyInfo.taxId || '',
                    tax: companyInfo.taxId || '', // Alias for compatibility
                    commercialRegister: companyInfo.commercialRegister || '',
                    register: companyInfo.commercialRegister || '', // Alias for compatibility
                    phone: companyInfo.phone || '',
                    mobile: companyInfo.mobile || '',
                    email: companyInfo.email || '',
                    commitmentText: companyInfo.commitmentText || 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.'
                };
                
                return settings;
            } else {
                console.warn('No company info found in database');
            }
        } else {
            console.warn('Database API not available');
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('asel_company_settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed;
        }
        
        console.warn('No company settings found, returning empty object');
        return {};
    } catch (error) {
        console.error('Error getting company settings:', error);
        return {};
    }
}

// Load Data
async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            invoices = await window.electronAPI.dbGetAll('purchase_invoices', '', []);
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
            products = await window.electronAPI.dbGetAll('products', '', []);
            
            // Ensure arrays
            invoices = Array.isArray(invoices) ? invoices : [];
            suppliers = Array.isArray(suppliers) ? suppliers : [];
            products = Array.isArray(products) ? products : [];
            
            // Load invoice items for each invoice (always load from database to ensure fresh data)
            for (let invoice of invoices) {
                try {
                    const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoice.id]);
                    if (invoiceItems && Array.isArray(invoiceItems) && invoiceItems.length > 0) {
                        invoice.products = invoiceItems.map(item => {
                            // Get product code from item or from products array
                            let productCode = item.productCode || '';
                            if (!productCode && item.productId) {
                                const productData = products.find(p => p.id === item.productId);
                                if (productData) {
                                    productCode = productData.code || '';
                                }
                            }
                            return {
                                productId: item.productId,
                                productName: item.productName,
                                productCode: productCode,
                                quantity: item.quantity || 0,
                                unit: item.unit || '',
                                unitName: item.unitName || item.unit || '',
                                price: item.price || 0,
                                total: item.total || 0
                            };
                        });
                    } else {
                        invoice.products = [];
                    }
                } catch (error) {
                    console.error(`Error loading items for invoice ${invoice.id}:`, error);
                    invoice.products = invoice.products || [];
                }
            }
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
            console.error('Error details:', error.message, error.stack);
        }
    } else {
        console.warn('Database API not available, using localStorage fallback');
    }
    
    // Fallback to localStorage (for migration only)
    const invoicesData = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const suppliersData = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    const productsData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);

    invoices = invoicesData ? JSON.parse(invoicesData) : [];
    suppliers = suppliersData ? JSON.parse(suppliersData) : [];
    products = productsData ? JSON.parse(productsData) : [];
}

// Save Invoices
function saveInvoices() {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
}

// Generate Invoice Number
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `PUR-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all invoices from database
            const allInvoices = await window.electronAPI.dbGetAll('purchase_invoices', '', []);
            
            if (allInvoices && allInvoices.length > 0) {
                // Filter invoices with numbers matching current year pattern
                const currentYearNumbers = allInvoices
                    .map(invoice => invoice.invoiceNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from invoice numbers (e.g., "PUR-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating invoice number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.INVOICE_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Render Suppliers
function renderSuppliers() {
    const select = document.getElementById('supplierSelect');
    select.innerHTML = '<option value="">اختر المورد</option>';
    
    const activeSuppliers = suppliers.filter(s => s.status === 'active' || !s.status);
    activeSuppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = `${supplier.name} - ${supplier.code}`;
        select.appendChild(option);
    });
}

// Render Products (for searchable dropdown)
function renderProducts() {
    // Products are stored in global array, filtering will be done in search
    // Setup product search after products are loaded
    if (products && products.length > 0) {
        setupProductSearch();
    } else {
        // If products not loaded yet, try again after a short delay
        setTimeout(() => {
            if (products && products.length > 0) {
                setupProductSearch();
            }
        }, 100);
    }
}

// Setup Product Search
function setupProductSearch() {
    const searchInput = document.getElementById('productSearch');
    const hiddenInput = document.getElementById('productSelect');
    const dropdown = document.getElementById('productDropdown');
    let selectedProduct = null;
    
    if (!searchInput) return;
    
    // Filter products based on search
    function filterProducts(searchTerm) {
        const activeProducts = products.filter(p => p.status === 'active' || !p.status);
        
        if (!searchTerm || searchTerm.trim() === '') {
            return activeProducts.slice(0, 10); // Show first 10 if no search
        }
        
        const term = searchTerm.toLowerCase().trim();
        return activeProducts.filter(product => {
            const name = (product.name || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            const code = (product.code || '').toLowerCase();
            return name.includes(term) || category.includes(term) || code.includes(term);
        }).slice(0, 20); // Limit to 20 results
    }
    
    // Render dropdown
    function renderDropdown(filteredProducts) {
        dropdown.innerHTML = '';
        
        if (filteredProducts.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item no-results">لا توجد نتائج</div>';
            dropdown.classList.add('active');
            return;
        }
        
        filteredProducts.forEach(product => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `
                <div class="product-name">${product.name}</div>
                <div class="product-category">${product.category || 'غير محدد'}</div>
            `;
            item.addEventListener('click', () => {
                selectedProduct = product;
                searchInput.value = `${product.name} - ${product.category || 'غير محدد'}`;
                hiddenInput.value = product.id;
                dropdown.classList.remove('active');
                // Auto-fill price
                const priceInput = document.getElementById('productPrice');
                if (priceInput && (product.priceSmallestUnit || product.smallestPrice)) {
                    priceInput.value = product.priceSmallestUnit || product.smallestPrice;
                }
                // Trigger quantity focus
                document.getElementById('productQuantity')?.focus();
            });
            dropdown.appendChild(item);
        });
        
        dropdown.classList.add('active');
    }
    
    // Handle input
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        if (term) {
            const filtered = filterProducts(term);
            renderDropdown(filtered);
        } else {
            dropdown.classList.remove('active');
            hiddenInput.value = '';
            selectedProduct = null;
        }
    });
    
    // Handle focus
    searchInput.addEventListener('focus', () => {
        const term = searchInput.value;
        const filtered = filterProducts(term);
        renderDropdown(filtered);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.product-search-wrapper')) {
            dropdown.classList.remove('active');
        }
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.dropdown-item:not(.no-results)');
        let currentIndex = -1;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentIndex = Array.from(items).findIndex(item => item.classList.contains('highlighted'));
            if (currentIndex < items.length - 1) {
                items.forEach(item => item.classList.remove('highlighted'));
                items[currentIndex + 1].classList.add('highlighted');
                items[currentIndex + 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentIndex = Array.from(items).findIndex(item => item.classList.contains('highlighted'));
            if (currentIndex > 0) {
                items.forEach(item => item.classList.remove('highlighted'));
                items[currentIndex - 1].classList.add('highlighted');
                items[currentIndex - 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const highlighted = dropdown.querySelector('.dropdown-item.highlighted:not(.no-results)');
            if (highlighted) {
                highlighted.click();
            }
        }
    });
}

// Open New Invoice
function openNewInvoice() {
    currentInvoice = null;
    invoiceProducts = [];
    document.getElementById('isEdit').value = 'false';
    document.getElementById('invoiceId').value = '';
    document.getElementById('modalTitle').textContent = 'فاتورة مشتريات جديدة';
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceProductsBody').innerHTML = '';
    document.getElementById('supplierInfo').classList.add('hidden');
    document.getElementById('printBtn').style.display = 'none';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    setDueDate();
    document.getElementById('paymentMethod').value = 'cash';
    
    // Set tax rate to 0 for purchase invoices (no VAT)
    document.getElementById('taxRate').value = 0;
    
    // Reset product search
    const productSearch = document.getElementById('productSearch');
    const productSelect = document.getElementById('productSelect');
    const productDropdown = document.getElementById('productDropdown');
    if (productSearch) productSearch.value = '';
    if (productSelect) productSelect.value = '';
    if (productDropdown) productDropdown.classList.remove('active');
    
    // Setup product search when modal opens
    setupProductSearch();
    
    calculateTotals();
    document.getElementById('invoiceModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#invoiceModal input:not([type="hidden"]), #invoiceModal select, #invoiceModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// On Supplier Change
function onSupplierChange() {
    const supplierId = document.getElementById('supplierSelect').value;
    if (!supplierId) {
        document.getElementById('supplierInfo').classList.add('hidden');
        return;
    }

    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
        document.getElementById('oldBalance').textContent = formatCurrency(supplier.balance || 0);
        document.getElementById('supplierInfo').classList.remove('hidden');
        calculateTotals();
    }
}

// Add Product to Invoice
function addProductToInvoice() {
    const productSelect = document.getElementById('productSelect');
    const quantityInput = document.getElementById('productQuantity');
    const unitSelect = document.getElementById('productUnit');
    const priceInput = document.getElementById('productPrice');

    if (!productSelect || !productSelect.value) {
        showMessage('يرجى اختيار منتج أولاً', 'error');
        return;
    }

    if (!quantityInput || !quantityInput.value) {
        showMessage('يرجى إدخال الكمية', 'error');
        return;
    }

    if (!priceInput || !priceInput.value) {
        showMessage('يرجى إدخال السعر', 'error');
        return;
    }

    // Get product from products array
    const productData = products.find(p => p.id === productSelect.value);
    if (!productData) {
        showMessage('المنتج غير موجود', 'error');
        return;
    }
    const quantity = parseFloat(quantityInput.value);
    const unit = unitSelect.value;
    const price = parseFloat(priceInput.value);

    const invoiceProduct = {
        productId: productData.id,
        productName: productData.name,
        productCode: productData.code,
        quantity: quantity,
        unit: unit,
        unitName: unit === 'smallest' ? productData.smallestUnit : productData.largestUnit,
        price: price,
        total: quantity * price
    };

    invoiceProducts.push(invoiceProduct);
    renderInvoiceProducts();
    calculateTotals();

    // Reset inputs
    productSelect.value = '';
    document.getElementById('productSearch').value = '';
    quantityInput.value = '';
    priceInput.value = '';
    unitSelect.value = 'smallest';
    document.getElementById('productDropdown').classList.remove('active');
}

// Remove Product from Invoice
function removeProduct(index) {
    invoiceProducts.splice(index, 1);
    renderInvoiceProducts();
    calculateTotals();
}

// Render Invoice Products
function renderInvoiceProducts() {
    const tbody = document.getElementById('invoiceProductsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (invoiceProducts.length === 0) {
        // Show empty state message in table
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">
                لا توجد منتجات مضافة
            </td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }

    invoiceProducts.forEach((product, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.productName} (${product.productCode})</td>
            <td>${product.quantity}</td>
            <td>${product.unitName}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${formatCurrency(product.total)}</td>
            <td>
                <button type="button" class="action-btn delete" data-product-index="${index}" title="حذف">🗑️</button>
            </td>
        `;
        
        // Add event listener to delete button
        const deleteBtn = row.querySelector('.action-btn.delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => removeProduct(index));
        }
        
        tbody.appendChild(row);
    });
}

// Calculate Totals
function calculateTotals() {
    const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    // Tax is always 0 for purchase invoices (no VAT)
    const taxRate = 0;
    const taxAmount = 0;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const total = subtotal + taxAmount + shipping - discount;
    const paid = parseFloat(document.getElementById('paid').value) || 0;
    const remaining = total - paid;

    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} ج.م`;
    document.getElementById('taxAmount').textContent = `${taxAmount.toFixed(2)} ج.م`;
    document.getElementById('total').textContent = `${total.toFixed(2)} ج.م`;
    document.getElementById('remaining').textContent = `${remaining.toFixed(2)} ج.م`;

    // Show balance info if supplier selected
    const supplierId = document.getElementById('supplierSelect').value;
    
    if (supplierId) {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            const oldBalance = supplier.balance || 0;
            const newBalance = oldBalance + remaining;
            
            document.getElementById('oldBalanceDisplay').textContent = `${oldBalance.toFixed(2)} ج.م`;
            document.getElementById('newBalanceDisplay').textContent = `${newBalance.toFixed(2)} ج.م`;
            document.getElementById('newBalanceRow').style.display = 'flex';
            document.getElementById('finalBalanceRow').style.display = 'flex';
        }
    } else {
        document.getElementById('newBalanceRow').style.display = 'none';
        document.getElementById('finalBalanceRow').style.display = 'none';
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();

    const supplierId = document.getElementById('supplierSelect').value;
    const date = document.getElementById('invoiceDate').value;
    const dueDate = document.getElementById('dueDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    // Tax is always 0 for purchase invoices (no VAT)
    const taxRate = 0;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const paid = parseFloat(document.getElementById('paid').value) || 0;

    if (!supplierId) {
        showMessage('يرجى اختيار المورد', 'error');
        return;
    }

    if (invoiceProducts.length === 0) {
        showMessage('يرجى إضافة منتجات للفاتورة', 'error');
        return;
    }

    const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    const taxAmount = 0;
    const total = subtotal + taxAmount + shipping - discount;
    const remaining = total - paid;

    const invoiceId = currentInvoice ? currentInvoice.id : Date.now().toString();

    const invoiceData = {
        id: invoiceId,
        invoiceNumber: currentInvoice ? currentInvoice.invoiceNumber : await generateInvoiceNumber(),
        supplierId: supplierId,
        date: date,
        dueDate: dueDate,
        paymentMethod: paymentMethod,
        products: [...invoiceProducts],
        subtotal: subtotal,
        taxRate: taxRate,
        taxAmount: taxAmount,
        shipping: shipping,
        discount: discount,
        total: total,
        paid: paid,
        remaining: remaining,
        createdAt: currentInvoice ? currentInvoice.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Save to database first
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            // Prepare invoice data for database (without products array)
            const invoiceDbData = { ...invoiceData };
            delete invoiceDbData.products;
            
            if (currentInvoice) {
                // Update existing invoice in database
                await window.electronAPI.dbUpdate('purchase_invoices', invoiceId, invoiceDbData);
                
                // Delete old invoice items
                if (window.electronAPI && window.electronAPI.dbQuery) {
                    await window.electronAPI.dbQuery('DELETE FROM purchase_invoice_items WHERE invoiceId = ?', [invoiceId]);
                } else {
                    // Fallback: get all items and delete one by one
                    const oldItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
                    for (const item of oldItems) {
                        await window.electronAPI.dbDelete('purchase_invoice_items', item.id);
                    }
                }
                
                // Revert stock changes from old invoice items
                if (currentInvoice.products) {
                    for (const invProduct of currentInvoice.products) {
                        await revertProductStockFromPurchase(invProduct);
                    }
                }
            } else {
                // Insert new invoice in database
                await window.electronAPI.dbInsert('purchase_invoices', invoiceDbData);
            }
            
            // Save invoice items
            for (const product of invoiceProducts) {
                // Get product code from product data
                let productCode = product.productCode || '';
                if (!productCode && product.productId) {
                    const productData = products.find(p => p.id === product.productId);
                    if (productData) {
                        productCode = productData.code || '';
                    }
                }
                
                const itemData = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                    invoiceId: invoiceId,
                    productId: product.productId,
                    productName: product.productName || product.name || '',
                    quantity: product.quantity || 0,
                    unit: product.unit || product.unitName || '',
                    price: product.price || 0,
                    total: product.total || 0
                };
                try {
                    const insertResult = await window.electronAPI.dbInsert('purchase_invoice_items', itemData);
                    if (insertResult && insertResult.success === false) {
                        console.error(`Failed to insert invoice item:`, insertResult);
                        throw new Error(`فشل حفظ منتج في الفاتورة: ${insertResult.error || 'خطأ غير معروف'}`);
                    }
                } catch (error) {
                    console.error(`❌ Error saving invoice item:`, error);
                    throw error; // Re-throw to stop the process
                }
            }
        } else {
            console.warn('Database API not available, saving to localStorage only');
        }

        // Update local array
        if (currentInvoice) {
            const index = invoices.findIndex(inv => inv.id === currentInvoice.id);
            if (index !== -1) {
                invoices[index] = invoiceData;
            }
        } else {
            invoices.push(invoiceData);
        }

        // Update product stock in database (always update on purchase invoices)
        await updateProductStockFromPurchase(invoiceProducts, invoiceId);
        
        // Dispatch event to notify products screen
        invoiceProducts.forEach(product => {
            window.dispatchEvent(new CustomEvent('productStockUpdated', { detail: { productId: product.productId } }));
        });

        // Save products to localStorage as backup
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
        
        // Reload invoices from database to ensure sync
        await loadData();
        
        // Ensure products are loaded for the saved invoice
        const savedInvoice = invoices.find(inv => inv.id === invoiceId);
        if (savedInvoice && (!savedInvoice.products || savedInvoice.products.length === 0)) {
            try {
                const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
                if (invoiceItems && invoiceItems.length > 0) {
                    savedInvoice.products = invoiceItems.map(item => {
                        // Get product code from products array (not stored in database)
                        let productCode = '';
                        if (item.productId) {
                            const productData = products.find(p => p.id === item.productId);
                            if (productData) {
                                productCode = productData.code || '';
                            }
                        }
                        return {
                            productId: item.productId,
                            productName: item.productName,
                            productCode: productCode,
                            quantity: item.quantity || 0,
                            unit: item.unit || '',
                            unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                            price: item.price || 0,
                            total: item.total || 0
                        };
                    });
                }
            } catch (error) {
                console.error('Error loading invoice items after save:', error);
            }
        }
        
        // Save to localStorage as backup
        await saveInvoices();
        
        currentPage = 1;
        applyFilters();
        
        // Recalculate supplier balance from all invoices
        await recalculateSupplierBalance(supplierId);
        
        // Update first transaction date for new invoices
        if (!currentInvoice) {
            await updateSupplierFirstTransactionDate(supplierId);
        }
        
        // Auto print after saving
        closeModal();
        setTimeout(() => {
            openPrintWindow(invoiceData);
        }, 500);
        showMessage('تم حفظ الفاتورة وطباعتها بنجاح', 'success');
    } catch (error) {
        console.error('Error saving purchase invoice:', error);
        showMessage('خطأ في حفظ الفاتورة: ' + error.message, 'error');
    }
}

// Update Product Stock from Purchase Invoice
async function updateProductStockFromPurchase(invoiceProducts, invoiceId) {
    try {
        for (const invoiceProduct of invoiceProducts) {
            // Get product from database
            let product = null;
            if (window.electronAPI && window.electronAPI.dbGet) {
                product = await window.electronAPI.dbGet('products', invoiceProduct.productId);
            }
            
            if (!product) {
                console.error('Product not found:', invoiceProduct.productId);
                continue;
            }
            
            // Calculate quantity to add in smallest unit
            let quantityToAdd = invoiceProduct.quantity || 0;
            
            // If unit is largest, convert to smallest
            if (invoiceProduct.unit === 'largest') {
                const conversionFactor = product.conversionFactor || 1;
                quantityToAdd = invoiceProduct.quantity * conversionFactor;
            }
            
            // Update stock
            const currentStock = parseFloat(product.stock) || 0;
            const newStock = currentStock + quantityToAdd;
            
            product.stock = newStock;
            
            // Update product in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('products', product.id, product);
            }
            
            // Update in local array too
            const localProduct = products.find(p => p.id === product.id);
            if (localProduct) {
                localProduct.stock = newStock;
            }
        }
    } catch (error) {
        console.error('Error updating product stock:', error);
    }
}

// Revert Product Stock from Purchase Invoice (for editing)
async function revertProductStockFromPurchase(invProduct) {
    try {
        let product = null;
        if (window.electronAPI && window.electronAPI.dbGet) {
            product = await window.electronAPI.dbGet('products', invProduct.productId);
        }
        
        if (!product) {
            return;
        }
        
        // Calculate quantity to revert in smallest unit
        let quantityToRevert = invProduct.quantity || 0;
        
        // If unit is largest, convert to smallest
        if (invProduct.unit === 'largest') {
            const conversionFactor = product.conversionFactor || 1;
            quantityToRevert = invProduct.quantity * conversionFactor;
        }
        
        // Revert stock (decrease - was added on purchase)
        const currentStock = parseFloat(product.stock) || 0;
        const newStock = Math.max(0, currentStock - quantityToRevert);
        
        product.stock = newStock;
        
        // Update product in database
        if (window.electronAPI && window.electronAPI.dbUpdate) {
            await window.electronAPI.dbUpdate('products', product.id, product);
        }
        
        // Update in local array too
        const localProduct = products.find(p => p.id === product.id);
        if (localProduct) {
            localProduct.stock = newStock;
        }
    } catch (error) {
        console.error('Error reverting product stock:', error);
    }
}

// Update Supplier First Transaction Date
async function updateSupplierFirstTransactionDate(supplierId) {
    if (!window.electronAPI || !window.electronAPI.dbGet || !window.electronAPI.dbUpdate) return;
    
    try {
        const supplier = await window.electronAPI.dbGet('suppliers', supplierId);
        if (!supplier) return;
        
        // Get all invoices and payments for this supplier
        let supplierInvoices = [];
        let supplierPayments = [];
        
        try {
            supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [supplierId]);
            supplierPayments = await window.electronAPI.dbGetAll('payments', 'supplierId = ?', [supplierId]);
        } catch (error) {
            console.error('Error loading transactions for supplier:', error);
            return;
        }
        
        // Combine all transactions with their dates
        const allTransactions = [];
        supplierInvoices.forEach(inv => {
            if (inv.date) allTransactions.push({ date: inv.date, type: 'invoice' });
        });
        supplierPayments.forEach(pay => {
            if (pay.date && pay.type === 'supplier') allTransactions.push({ date: pay.date, type: 'payment' });
        });
        
        // Find the earliest transaction date
        if (allTransactions.length > 0) {
            const sortedTransactions = allTransactions.sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            const firstTransactionDate = sortedTransactions[0].date;
            
            // Update firstTransactionDate if it's different or doesn't exist
            if (!supplier.firstTransactionDate || supplier.firstTransactionDate !== firstTransactionDate) {
                await window.electronAPI.dbUpdate('suppliers', supplierId, {
                    ...supplier,
                    firstTransactionDate: firstTransactionDate
                });
                
                // Update local array
                const localSupplier = suppliers.find(s => s.id === supplierId);
                if (localSupplier) {
                    localSupplier.firstTransactionDate = firstTransactionDate;
                }
            }
        }
    } catch (error) {
        console.error('Error updating supplier first transaction date:', error);
    }
}

// Recalculate Supplier Balance from all invoices
async function recalculateSupplierBalance(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    // Get opening balance (stored when supplier was first created)
    const openingBalance = supplier.openingBalance || 0;
    
    // Get all invoices for this supplier from database
    let supplierInvoices = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [supplierId]);
        } catch (error) {
            console.error('Error loading invoices from database:', error);
            // Fallback to local array
            supplierInvoices = invoices.filter(inv => inv.supplierId === supplierId);
        }
    } else {
        // Fallback to local array
        supplierInvoices = invoices.filter(inv => inv.supplierId === supplierId);
    }
    
    // Calculate: sum of all remaining amounts from delivered invoices
    let totalRemaining = 0;
    supplierInvoices.forEach(invoice => {
        totalRemaining += invoice.remaining || 0;
    });
    
    // Balance = opening balance + sum of all remaining amounts from delivered invoices
    const balance = openingBalance + totalRemaining;
    
    supplier.balance = balance;
    supplier.lastTransactionDate = new Date().toISOString();
    
    // Update first transaction date
    await updateSupplierFirstTransactionDate(supplierId);
    
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    
    // Update supplier in database
    if (window.electronAPI && window.electronAPI.dbUpdate) {
        try {
            await window.electronAPI.dbUpdate('suppliers', supplierId, {
                ...supplier,
                balance: balance,
                lastTransactionDate: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating supplier balance in database:', error);
        }
    }
    
    // Update supplier display if modal is open
    if (document.getElementById('supplierSelect')) {
        const currentSupplierId = document.getElementById('supplierSelect').value;
        if (currentSupplierId === supplierId) {
            document.getElementById('oldBalance').textContent = `${balance.toFixed(2)} ج.م`;
            calculateTotals();
        }
    }
}

// Render Invoices
// Apply Filters
function applyFilters() {
    // Sort by date (newest first)
    const sortedInvoices = [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
    filteredInvoices = sortedInvoices;
    
    // Render paginated invoices
    renderInvoices();
}

function renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    tbody.innerHTML = '';

    if (filteredInvoices.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredInvoices.length);
    const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredInvoices.length}`;
    
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
            applyFilters();
        });
        pageNumbersEl.appendChild(pageBtn);
    }

    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteInvoices = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    paginatedInvoices.forEach(invoice => {
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${invoice.invoiceNumber}</td>
            <td>${new Date(invoice.date).toLocaleDateString('ar-EG')}</td>
            <td class="supplier-name-cell"><strong>${supplier ? supplier.name : 'غير محدد'}</strong></td>
            <td class="invoice-total-cell"><strong>${formatCurrency(invoice.total)}</strong></td>
            <td class="invoice-paid-cell"><strong>${formatCurrency(invoice.paid)}</strong></td>
            <td class="invoice-remaining-cell"><strong>${formatCurrency(invoice.remaining)}</strong></td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-invoice-id="${invoice.id}" title="عرض">👁️</button>
                    <button class="action-btn edit" data-invoice-id="${invoice.id}" title="تعديل">✏️</button>
                    <button class="action-btn print" data-invoice-id="${invoice.id}" title="طباعة">🖨️</button>
                    <button class="action-btn save" data-invoice-id="${invoice.id}" title="حفظ على القرص">💾</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const editBtn = row.querySelector('.action-btn.edit');
        const printBtn = row.querySelector('.action-btn.print');
        const saveBtn = row.querySelector('.action-btn.save');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewInvoice(invoice.id));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => editInvoice(invoice.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printInvoiceById(invoice.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveInvoiceToDisk(invoice.id));
        }
        
        // Add delete button only for manager or system_engineer
        if (canDeleteInvoices) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-invoice-id', invoice.id);
            deleteBtn.addEventListener('click', () => deleteInvoice(invoice.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        
        tbody.appendChild(row);
    });
}

// View Invoice
async function viewInvoice(invoiceId) {
    let invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    // Always load invoice items from database to ensure fresh data
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            if (invoiceItems && Array.isArray(invoiceItems) && invoiceItems.length > 0) {
                invoice.products = invoiceItems.map(item => {
                    // Get product code from products array (not stored in database)
                    let productCode = '';
                    if (item.productId) {
                        const productData = products.find(p => p.id === item.productId);
                        if (productData) {
                            productCode = productData.code || '';
                        }
                    }
                    return {
                        productId: item.productId,
                        productName: item.productName,
                        productCode: productCode,
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                        price: item.price || 0,
                        total: item.total || 0
                    };
                });
            } else {
                invoice.products = [];
            }
        } catch (error) {
            console.error('Error loading invoice items:', error);
            invoice.products = invoice.products || [];
        }
    } else {
        invoice.products = invoice.products || [];
    }

    // Open in view window (no print)
    try {
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        const viewContent = await generatePrintContent(invoice, supplier);
        const viewWindow = window.open('', '_blank', 'width=800,height=600');
        if (!viewWindow || viewWindow.closed || typeof viewWindow.closed === 'undefined') {
            console.error('Failed to open view window - may be blocked');
            const blob = new Blob([viewContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            return;
        }
        
        viewWindow.document.write(viewContent);
        viewWindow.document.close();
    } catch (error) {
        console.error('Error viewing invoice:', error);
        showMessage('خطأ في عرض الفاتورة: ' + error.message, 'error');
    }
}

// Edit Invoice
async function editInvoice(invoiceId) {
    let invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showMessage('الفاتورة غير موجودة', 'error');
        return;
    }

    // Always load invoice items from database to ensure fresh data
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            if (invoiceItems && Array.isArray(invoiceItems) && invoiceItems.length > 0) {
                invoice.products = invoiceItems.map(item => {
                    // Get product code from products array (not stored in database)
                    let productCode = '';
                    if (item.productId) {
                        const productData = products.find(p => p.id === item.productId);
                        if (productData) {
                            productCode = productData.code || '';
                        }
                    }
                    return {
                        productId: item.productId,
                        productName: item.productName,
                        productCode: productCode,
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                        price: item.price || 0,
                        total: item.total || 0
                    };
                });
            } else {
                invoice.products = [];
            }
        } catch (error) {
            console.error('Error loading invoice items:', error);
            invoice.products = invoice.products || [];
        }
    } else {
        invoice.products = invoice.products || [];
    }

    currentInvoice = invoice;
    // Load products from invoice
    invoiceProducts = invoice.products ? [...invoice.products] : [];
    
    document.getElementById('isEdit').value = 'true';
    document.getElementById('invoiceId').value = invoice.id;
    document.getElementById('modalTitle').textContent = `تعديل فاتورة ${invoice.invoiceNumber}`;
    document.getElementById('supplierSelect').value = invoice.supplierId;
    document.getElementById('invoiceDate').value = invoice.date;
    document.getElementById('dueDate').value = invoice.dueDate || '';
    document.getElementById('paymentMethod').value = invoice.paymentMethod || 'cash';
    // Tax is always 0 for purchase invoices (no VAT)
    document.getElementById('taxRate').value = 0;
    document.getElementById('shipping').value = invoice.shipping || 0;
    document.getElementById('discount').value = invoice.discount || 0;
    document.getElementById('paid').value = invoice.paid || 0;
    
    onSupplierChange();
    renderInvoiceProducts();
    calculateTotals();
    document.getElementById('invoiceModal').classList.add('active');
}

// Print Invoice
function printInvoiceById(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
        openPrintWindow(invoice);
    }
}

// Save Invoice to Disk
async function saveInvoiceToDisk(invoiceId) {
    // Try to find invoice in local array first
    let invoice = invoices.find(inv => inv && inv.id === invoiceId);
    
    // If not found, load from database
    if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
        try {
            invoice = await window.electronAPI.dbGet('purchase_invoices', invoiceId);
            
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items from database
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => {
                // Get product code from products array (not stored in database)
                let productCode = '';
                if (item.productId) {
                    const productData = products.find(p => p.id === item.productId);
                    if (productData) {
                        productCode = productData.code || '';
                    }
                }
                return {
                    productId: item.productId,
                    productName: item.productName,
                    productCode: productCode,
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                    price: item.price || 0,
                    total: item.total || 0
                };
            });
            
            // Load supplier from database if needed
            if (!suppliers.find(s => s && s.id === invoice.supplierId)) {
                const supplier = await window.electronAPI.dbGet('suppliers', invoice.supplierId);
                if (supplier) {
                    suppliers.push(supplier);
                }
            }
        } catch (error) {
            console.error('Error loading invoice from database:', error);
            showMessage('خطأ في تحميل الفاتورة: ' + error.message, 'error');
            return;
        }
    }
    
    if (!invoice) {
        showMessage('الفاتورة غير موجودة', 'error');
        return;
    }
    
    // Ensure invoice has products array
    if (!invoice.products || !Array.isArray(invoice.products)) {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
                invoice.products = (invoiceItems || []).map(item => {
                    // Get product code from products array (not stored in database)
                    let productCode = '';
                    if (item.productId) {
                        const productData = products.find(p => p.id === item.productId);
                        if (productData) {
                            productCode = productData.code || '';
                        }
                    }
                    return {
                        productId: item.productId,
                        productName: item.productName,
                        productCode: productCode,
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '', // Use unit as unitName since unitName is not stored
                        price: item.price || 0,
                        total: item.total || 0
                    };
                });
            } catch (error) {
                console.error('Error loading invoice items:', error);
                invoice.products = [];
            }
        } else {
            invoice.products = [];
        }
    }
    
    // Get supplier
    const supplier = suppliers.find(s => s && s.id === invoice.supplierId);
    
    // Generate invoice HTML content
    const invoiceContent = await generatePrintContent(invoice, supplier);
    
    // Generate default file name
    const defaultFileName = `فاتورة_مشتريات_${invoice.invoiceNumber}_${new Date(invoice.date).toISOString().split('T')[0]}.pdf`;
    
    // Save to file
    if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
        try {
            const result = await window.electronAPI.saveInvoiceToFile(invoiceContent, defaultFileName);
            if (result.success) {
                showMessage(`تم حفظ الفاتورة بنجاح في: ${result.filePath}`, 'success');
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                showMessage('خطأ في حفظ الفاتورة: ' + (result.error || 'خطأ غير معروف'), 'error');
            }
        } catch (error) {
            console.error('Error saving invoice to file:', error);
            showMessage('خطأ في حفظ الفاتورة: ' + error.message, 'error');
        }
    } else {
        showMessage('وظيفة حفظ الملف غير متاحة', 'error');
    }
}

// Delete Invoice
async function deleteInvoice(invoiceId) {
    try {
        // Check if current user is BashMohndes (only BashMohndes can delete)
        const currentUsername = localStorage.getItem('asel_user') || '';
        if (currentUsername !== 'BashMohndes') {
            showMessage('لا يمكن حذف الفاتورة. فقط المستخدم الافتراضي (BashMohndes) يمكنه حذف الفواتير.', 'error');
            return;
        }
        
        // Find invoice
        let invoice = invoices.find(inv => inv.id === invoiceId);
        
        // If not found, load from database
        if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
            invoice = await window.electronAPI.dbGet('purchase_invoices', invoiceId);
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unit || '' // Use unit as unitName since unitName is not stored
            }));
        }
        
        if (!invoice) {
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Check if supplier has other invoices or balance > 0
        if (invoice.supplierId && window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbGet) {
            // Get supplier
            const supplier = await window.electronAPI.dbGet('suppliers', invoice.supplierId);
            
            if (supplier) {
                // Check supplier balance
                const supplierBalance = parseFloat(supplier.balance) || 0;
                
                // Get all supplier invoices
                const supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [invoice.supplierId]);
                
                // Check if supplier has other invoices (excluding current one)
                const otherInvoices = supplierInvoices.filter(inv => inv.id !== invoiceId);
                
                if (supplierBalance > 0 || otherInvoices.length > 0) {
                    showMessage('لا يمكن حذف هذه الفاتورة. هذه الفاتورة مرتبطة بمورد.', 'error');
                    return;
                }
            }
        }
        
        // Confirm deletion
        if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إرجاع المخزون للمنتجات وإعادة حساب رصيد المورد.')) {
            return;
        }
        
        // Revert product stock (purchase invoices add to stock, so deletion should subtract)
        if (invoice.products && invoice.products.length > 0) {
            for (const invProduct of invoice.products) {
                // Get product from database
                let product = null;
                if (window.electronAPI && window.electronAPI.dbGet) {
                    product = await window.electronAPI.dbGet('products', invProduct.productId);
                }
                
                if (product) {
                    // Calculate quantity to revert in smallest unit
                    let quantityToRevert = invProduct.quantity || 0;
                    
                    // If unit is largest, convert to smallest
                    if (invProduct.unit === 'largest') {
                        const conversionFactor = product.conversionFactor || 1;
                        quantityToRevert = invProduct.quantity * conversionFactor;
                    }
                    
                    // Revert stock (decrease - was added on purchase)
                    const currentStock = parseFloat(product.stock) || 0;
                    const newStock = Math.max(0, currentStock - quantityToRevert);
                    
                    product.stock = newStock;
                    
                    // Update product in database
                    if (window.electronAPI && window.electronAPI.dbUpdate) {
                        await window.electronAPI.dbUpdate('products', product.id, product);
                    }
                    
                    // Update in local array too
                    const localProduct = products.find(p => p.id === product.id);
                    if (localProduct) {
                        localProduct.stock = newStock;
                    }
                }
            }
        }
        
        // Recalculate supplier balance
        if (invoice.supplierId) {
            await recalculateSupplierBalance(invoice.supplierId);
        }
        
        // Delete invoice items from database first (foreign key constraint)
        if (window.electronAPI && window.electronAPI.dbQuery) {
            await window.electronAPI.dbQuery('DELETE FROM purchase_invoice_items WHERE invoiceId = ?', [invoiceId]);
        } else if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
            const invoiceItems = await window.electronAPI.dbGetAll('purchase_invoice_items', 'invoiceId = ?', [invoiceId]);
            for (const item of invoiceItems) {
                await window.electronAPI.dbDelete('purchase_invoice_items', item.id);
            }
        }
        
        // Delete invoice from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('purchase_invoices', invoiceId);
        }
        
        // Remove from local array
        invoices = invoices.filter(inv => inv.id !== invoiceId);
        
        // Save to localStorage
        await saveInvoices();
        
        // Reload invoices from database
        await loadData();
        
        // Render invoices
        currentPage = 1;
        applyFilters();
        
        // Dispatch events to update other screens
        if (invoice.products && invoice.products.length > 0) {
            const uniqueProductIds = [...new Set(invoice.products.map(p => p.productId))];
            uniqueProductIds.forEach(productId => {
                window.dispatchEvent(new CustomEvent('productStockUpdated', { 
                    detail: { productId: productId },
                    bubbles: true,
                    cancelable: true
                }));
            });
        }
        window.dispatchEvent(new CustomEvent('productsNeedRefresh', { bubbles: true }));
        
        showMessage('تم حذف الفاتورة بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting purchase invoice:', error);
        showMessage('خطأ في حذف الفاتورة: ' + error.message, 'error');
    }
}

// Print Current Invoice
function printInvoice() {
    if (!currentInvoice) return;
    openPrintWindow(currentInvoice);
}

// Open Print Window
async function openPrintWindow(invoice) {
    const supplier = suppliers.find(s => s.id === invoice.supplierId);
    const printContent = await generatePrintContent(invoice, supplier);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Generate Print Content
async function generatePrintContent(invoice, supplier) {
    const companySettings = await getCompanySettings();
    
    // Ensure we have valid values (not null, undefined, or empty string)
    const companyName = companySettings.name && companySettings.name.trim() ? companySettings.name : 'شركة أسيل';
    const companyAddress = companySettings.address && companySettings.address.trim() ? companySettings.address : '';
    const companyPhone = companySettings.phone && companySettings.phone.trim() ? companySettings.phone : (companySettings.mobile && companySettings.mobile.trim() ? companySettings.mobile : '');
    
    const oldBalance = supplier ? (supplier.balance || 0) - invoice.remaining : 0;
    const newBalance = supplier ? (supplier.balance || 0) : 0;
    const balancePlusInvoice = oldBalance + invoice.total;
    
    const printContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>فاتورة مشتريات ${invoice.invoiceNumber}</title>
    <style>
        @page {
            size: A4;
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            direction: rtl;
            background: white;
            padding: 20px;
        }
        .invoice-container {
            position: relative;
            page-break-after: always;
        }
        .invoice-container:last-child {
            page-break-after: auto;
        }
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 180px;
            color: rgba(102, 126, 234, 0.2);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .watermark-2 {
            position: absolute;
            top: 25%;
            left: 25%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            color: rgba(102, 126, 234, 0.15);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .watermark-3 {
            position: absolute;
            top: 75%;
            left: 75%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            color: rgba(102, 126, 234, 0.15);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .watermark-4 {
            position: absolute;
            top: 25%;
            left: 75%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            color: rgba(102, 126, 234, 0.15);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .watermark-5 {
            position: absolute;
            top: 75%;
            left: 25%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            color: rgba(102, 126, 234, 0.15);
            font-weight: bold;
            z-index: 0;
            pointer-events: none;
            white-space: nowrap;
        }
        .invoice-content {
            position: relative;
            z-index: 1;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .company-name {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .company-info {
            font-size: 14px;
            line-height: 1.8;
        }
        .invoice-title {
            font-size: 24px;
            font-weight: bold;
            margin: 30px 0;
            text-align: center;
        }
        .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .invoice-details {
            width: 48%;
        }
        .invoice-details table {
            width: 100%;
        }
        .invoice-details td {
            padding: 5px 0;
            font-size: 14px;
        }
        .invoice-details td:first-child {
            font-weight: bold;
            width: 120px;
        }
        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .products-table th,
        .products-table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: right;
        }
        .products-table th {
            background: #f5f5f5;
            font-weight: bold;
        }
        .totals-section {
            margin-top: 20px;
            text-align: left;
        }
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }
        .totals-table td {
            padding: 8px;
            font-size: 14px;
        }
        .totals-table td:first-child {
            font-weight: bold;
            width: 200px;
        }
        .totals-table tr.highlight {
            background: #f0f0f0;
            font-weight: bold;
            font-size: 16px;
        }
        .notes {
            margin-top: 30px;
            padding: 15px;
            border: 1px solid #ddd;
            font-size: 13px;
        }
        .signature {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
            padding: 20px 0;
        }
        .signature-box {
            width: 45%;
            text-align: center;
            border-top: 2px solid #333;
            padding-top: 15px;
            margin-top: 20px;
        }
        .signature-box h4 {
            margin: 0 0 40px 0;
            font-size: 16px;
            font-weight: bold;
        }
        .signature-line {
            margin-top: 50px;
            border-top: 1px solid #333;
            padding-top: 5px;
            font-size: 14px;
        }
    </style>
</head>
    <body>
    <div class="invoice-container">
        <div class="watermark">${companyName || 'أسيل'}</div>
        <div class="watermark-2">${companyName || 'أسيل'}</div>
        <div class="watermark-3">${companyName || 'أسيل'}</div>
        <div class="watermark-4">${companyName || 'أسيل'}</div>
        <div class="watermark-5">${companyName || 'أسيل'}</div>
        <div class="invoice-content">
            <div class="invoice-title" style="font-size: 32px; margin: 30px 0; text-align: center; font-weight: bold; border-bottom: 3px solid #333; padding-bottom: 15px;">
                فاتورة مشتريات
            </div>
            <div class="invoice-info" style="margin: 30px 0;">
                <div class="invoice-details" style="width: 48%; border: 1px solid #ddd; padding: 15px; background: #f9f9f9;">
                    <h3 style="margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px;">بيانات الشركة</h3>
                    <table>
                        <tr>
                            <td>اسم الشركة:</td>
                            <td><strong>${companyName}</strong></td>
                        </tr>
                        <tr>
                            <td>عنوان الشركة:</td>
                            <td>${companyAddress || 'غير محدد'}</td>
                        </tr>
                        <tr>
                            <td>هاتف الشركة:</td>
                            <td>${companyPhone || 'غير محدد'}</td>
                        </tr>
                        ${companySettings.mobile && companySettings.mobile.trim() && companySettings.mobile !== companyPhone ? `
                        <tr>
                            <td>موبايل الشركة:</td>
                            <td>${companySettings.mobile}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                <div class="invoice-details" style="width: 48%; border: 1px solid #ddd; padding: 15px; background: #f9f9f9;">
                    <h3 style="margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px;">بيانات المورد</h3>
                    <table>
                        <tr>
                            <td>اسم المورد:</td>
                            <td><strong>${supplier ? supplier.name : '[اسم المورد]'}</strong></td>
                        </tr>
                        <tr>
                            <td>عنوان المورد:</td>
                            <td>${supplier && supplier.address ? supplier.address : '[عنوان المورد]'}</td>
                        </tr>
                        <tr>
                            <td>هاتف المورد:</td>
                            <td>${supplier && supplier.phone ? supplier.phone : '[هاتف المورد]'}</td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="invoice-info" style="margin: 20px 0; display: flex; justify-content: space-between;">
                <div style="width: 48%; border: 1px solid #ddd; padding: 15px; background: #f0f8ff;">
                    <table>
                        <tr>
                            <td style="font-weight: bold; width: 140px;">رقم الفاتورة:</td>
                            <td><strong>${invoice.invoiceNumber}</strong></td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">تاريخ الفاتورة:</td>
                            <td><strong>${new Date(invoice.date).toLocaleDateString('ar-EG')}</strong></td>
                        </tr>
                    </table>
                </div>
            </div>
            <h4 style="margin: 30px 0 15px 0; font-weight: bold; font-size: 20px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">جدول الأصناف</h4>
            <table class="products-table" style="margin: 20px 0;">
                <thead>
                    <tr>
                        <th style="width: 50px;">#</th>
                        <th>اسم المنتج</th>
                        <th>الصنف (الكود)</th>
                        <th>الكمية</th>
                        <th>الوحدة / المقاس</th>
                        <th>السعر (ج.م)</th>
                        <th>الإجمالي (ج.م)</th>
                    </tr>
                </thead>
                <tbody>
                    ${(invoice.products && Array.isArray(invoice.products) ? invoice.products : []).map((product, index) => `
                    <tr>
                        <td style="text-align: center;">${index + 1}</td>
                        <td><strong>${product.productName || '[اسم المنتج]'}</strong></td>
                        <td>${product.productCode || '[كود المنتج]'}</td>
                        <td style="text-align: center;">${(product.quantity || 0).toFixed(2)}</td>
                        <td style="text-align: center;">${product.unitName || product.unit || '[الوحدة]'}</td>
                        <td style="text-align: left;">${(product.price || 0).toFixed(2)}</td>
                        <td style="text-align: left; font-weight: bold;">${(product.total || 0).toFixed(2)}</td>
                    </tr>
                    `).join('')}
                    ${(!invoice.products || !Array.isArray(invoice.products) || invoice.products.length === 0) ? '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">لا توجد منتجات</td></tr>' : ''}
                </tbody>
            </table>
            <div class="totals-section" style="margin-top: 30px; border: 2px solid #333; padding: 20px; background: #f9f9f9;">
                <h3 style="margin: 0 0 20px 0; font-size: 18px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">ملخص الحسابات</h3>
                <table class="totals-table" style="width: 100%;">
                    <tr>
                        <td style="font-weight: bold; font-size: 16px; padding: 10px;">الإجمالي الفرعي:</td>
                        <td style="text-align: left; font-size: 16px; padding: 10px;"><strong>${invoice.subtotal.toFixed(2)} ج.م</strong></td>
                    </tr>
                    ${invoice.shipping > 0 ? `
                    <tr>
                        <td style="padding: 8px;">الشحن والتوصيل:</td>
                        <td style="text-align: left; padding: 8px;">${invoice.shipping.toFixed(2)} ج.م</td>
                    </tr>
                    ` : ''}
                    ${invoice.discount > 0 ? `
                    <tr>
                        <td style="padding: 8px;">الخصم:</td>
                        <td style="text-align: left; padding: 8px;">- ${invoice.discount.toFixed(2)} ج.م</td>
                    </tr>
                    ` : ''}
                    <tr style="background: #e8f4f8; border-top: 2px solid #333; border-bottom: 2px solid #333;">
                        <td style="font-weight: bold; font-size: 18px; padding: 12px;">إجمالي الفاتورة الحالية:</td>
                        <td style="text-align: left; font-weight: bold; font-size: 18px; padding: 12px;">${invoice.total.toFixed(2)} ج.م</td>
                    </tr>
                    ${supplier ? `
                    <tr>
                        <td style="padding: 10px; font-weight: bold;">الرصيد القديم للمورد:</td>
                        <td style="text-align: left; padding: 10px; font-weight: bold;">${oldBalance.toFixed(2)} ج.م</td>
                    </tr>
                    <tr style="background: #fff3cd;">
                        <td style="padding: 10px; font-weight: bold;">الرصيد القديم + الفاتورة الحالية:</td>
                        <td style="text-align: left; padding: 10px; font-weight: bold;">${balancePlusInvoice.toFixed(2)} ج.م</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; font-weight: bold;">المبلغ المدفوع من الشركة للمورد:</td>
                        <td style="text-align: left; padding: 10px; font-weight: bold;">${invoice.paid.toFixed(2)} ج.م</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; font-weight: bold;">المتبقي:</td>
                        <td style="text-align: left; padding: 10px; font-weight: bold;">${invoice.remaining.toFixed(2)} ج.م</td>
                    </tr>
                    <tr style="background: #d4edda; border-top: 3px solid #28a745; border-bottom: 3px solid #28a745;">
                        <td style="font-weight: bold; font-size: 18px; padding: 12px;">الرصيد الجديد للمورد عند الشركة:</td>
                        <td style="text-align: left; font-weight: bold; font-size: 18px; padding: 12px; color: #155724;">${newBalance.toFixed(2)} ج.م</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
            
            <!-- Signature Section -->
            <div class="signature">
                <div class="signature-box">
                    <h4>توقيع الشركة المشترية</h4>
                    <div class="signature-line">
                        <div style="margin-bottom: 10px;">________________________</div>
                        <div style="margin-top: 5px; font-weight: bold;">${companyName || 'اسم الشركة'}</div>
                        <div style="margin-top: 5px; font-size: 12px;">ختم الشركة</div>
                    </div>
                </div>
                <div class="signature-box">
                    <h4>توقيع المورد المستلم منه</h4>
                    <div class="signature-line">
                        <div style="margin-bottom: 10px;">________________________</div>
                        <div style="margin-top: 5px; font-weight: bold;">${supplier ? supplier.name : 'اسم المورد'}</div>
                        <div style="margin-top: 5px; font-size: 12px;">توقيع وختم المورد</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    return printContent;
}

// Close Modal
function closeModal() {
    document.getElementById('invoiceModal').classList.remove('active');
    currentInvoice = null;
    invoiceProducts = [];
    // Ensure focus is restored after closing modal
    setTimeout(() => {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            activeElement.blur();
        }
        // Force focus on window to restore input capabilities
        window.focus();
    }, 100);
}

// Show Message
// Show Toast Notification (replaces alert() to avoid Electron focus issues)
function showMessage(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Set icon based on type
    const icon = type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ️';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    // Add toast to container
    toastContainer.appendChild(toast);

    // Show toast with animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto-remove toast after 3 seconds (5 seconds for errors)
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, duration);

    // Focus on input field if modal is open (no need to wait for alert to close)
    setTimeout(() => {
        const modal = document.querySelector('.modal.active, [class*="modal"].active, #invoiceModal.active');
        if (modal) {
            const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
            if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                firstInput.focus();
            }
        }
    }, 50);
}

// Make functions global
window.removeProduct = removeProduct;
window.viewInvoice = viewInvoice;
window.editInvoice = editInvoice;
window.printInvoiceById = printInvoiceById;
window.saveInvoiceToDisk = saveInvoiceToDisk;
window.deleteInvoice = deleteInvoice;

