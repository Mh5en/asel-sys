// Sales Invoices Management System

// Storage Keys
const STORAGE_KEYS = {
    INVOICES: 'asel_sales_invoices',
    CUSTOMERS: 'asel_customers',
    PRODUCTS: 'asel_products',
    INVOICE_COUNTER: 'asel_invoice_counter'
};

// Initialize
let invoices = [];
let customers = [];
let products = [];
let invoiceProducts = [];
let currentInvoice = null;
let deliveryNotes = []; // أذون الصرف
let selectedDeliveryNote = null; // إذن الصرف المختار

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredInvoices = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let statusFilter = '';
let sortBy = 'date-desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderCustomers();
    renderProducts();
    applyFilters(); // Use applyFilters instead of renderInvoices
});

// Initialize Event Listeners
async function initializeEventListeners() {
    // New Invoice Button
    document.getElementById('newInvoiceBtn').addEventListener('click', () => {
        openNewInvoice();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('newInvoiceBtn').click();
        });
    }

    // Modal Close
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('invoiceForm').addEventListener('submit', handleFormSubmit);

    // Add Product Button
    document.getElementById('addProductBtn').addEventListener('click', async () => {
        await addProductToInvoice();
    });

    // Customer Selection
    document.getElementById('customerSelect').addEventListener('change', onCustomerChange);

    // Setup Delivery Note Search
    setupDeliveryNoteSearch();

    // Invoice Status Change
    document.getElementById('invoiceStatus').addEventListener('change', onStatusChange);

    // Calculate totals on change
    document.getElementById('taxRate').addEventListener('input', () => calculateTotals());
    document.getElementById('shipping').addEventListener('input', () => calculateTotals());
    document.getElementById('discount').addEventListener('input', () => calculateTotals());
    document.getElementById('paid').addEventListener('input', () => calculateTotals());

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
    
    // Load default tax rate from company settings
    await loadTaxRateFromSettings();
    
    // Search & Filter Event Listeners
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        applyFilters();
    });
    
    document.getElementById('clearSearchBtn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        searchQuery = '';
        currentPage = 1;
        applyFilters();
    });
    
    document.getElementById('dateFrom').addEventListener('change', (e) => {
        dateFrom = e.target.value;
        currentPage = 1;
        applyFilters();
    });
    
    document.getElementById('dateTo').addEventListener('change', (e) => {
        dateTo = e.target.value;
        currentPage = 1;
        applyFilters();
    });
    
    document.getElementById('statusFilter').addEventListener('change', (e) => {
        statusFilter = e.target.value;
        currentPage = 1;
        applyFilters();
    });
    
    document.getElementById('sortBy').addEventListener('change', (e) => {
        sortBy = e.target.value;
        currentPage = 1;
        applyFilters();
    });
    
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('sortBy').value = 'date-desc';
        searchQuery = '';
        dateFrom = '';
        dateTo = '';
        statusFilter = '';
        sortBy = 'date-desc';
        currentPage = 1;
        applyFilters();
    });
    
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
                // Map database fields to expected format
                return {
                    name: companyInfo.name || 'شركة أسيل',
                    address: companyInfo.address || '',
                    taxId: companyInfo.taxId || '',
                    tax: companyInfo.taxId || '', // Alias for compatibility
                    commercialRegister: companyInfo.commercialRegister || '',
                    register: companyInfo.commercialRegister || '', // Alias for compatibility
                    phone: companyInfo.phone || '',
                    mobile: companyInfo.mobile || '',
                    email: companyInfo.email || '',
                    taxRate: companyInfo.taxRate !== null && companyInfo.taxRate !== undefined ? companyInfo.taxRate : null,
                    commitmentText: companyInfo.commitmentText || 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.',
                    salesRepName: companyInfo.salesRepName || '',
                    salesRepPhone: companyInfo.salesRepPhone || '',
                    accountantName: companyInfo.accountantName || '',
                    accountantPhone: companyInfo.accountantPhone || ''
                };
            }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('asel_company_settings');
        return stored ? JSON.parse(stored) : {};
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
            invoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
            customers = await window.electronAPI.dbGetAll('customers', '', []);
            products = await window.electronAPI.dbGetAll('products', '', []);
            deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', 'status = ?', ['issued']);
            
            // Ensure arrays
            invoices = Array.isArray(invoices) ? invoices : [];
            customers = Array.isArray(customers) ? customers : [];
            products = Array.isArray(products) ? products : [];
            deliveryNotes = Array.isArray(deliveryNotes) ? deliveryNotes : [];
            
            // Load invoice items for each invoice
            for (let invoice of invoices) {
                // Ensure status is explicitly set (may be missing from database query)
                if (!invoice.status) {
                    invoice.status = 'pending'; // Default value
                    console.warn('Invoice missing status, setting to pending:', invoice.id);
                }
                
                if (!invoice.products) {
                    const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoice.id]);
                    invoice.products = (invoiceItems || []).map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '',
                        price: item.price || 0,
                        total: item.total || 0
                    }));
                }
            }
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage
    const invoicesData = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const customersData = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const productsData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);

    invoices = invoicesData ? JSON.parse(invoicesData) : [];
    customers = customersData ? JSON.parse(customersData) : [];
    products = productsData ? JSON.parse(productsData) : [];
}

// Save Invoices
async function saveInvoices() {
    // Save to localStorage as backup
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
    
    // Also save to database if available
    if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
        // This function will be called after each invoice is saved individually
        // So we don't need to loop through all invoices here
    }
}

// Generate Invoice Number
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all invoices from database
            const allInvoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
            
            if (allInvoices && allInvoices.length > 0) {
                // Filter invoices with numbers matching current year pattern
                const currentYearNumbers = allInvoices
                    .map(invoice => invoice.invoiceNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from invoice numbers (e.g., "INV-2025-001" -> 1)
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

// Render Customers
function renderCustomers() {
    const select = document.getElementById('customerSelect');
    select.innerHTML = '<option value="">اختر العميل</option>';
    
    const activeCustomers = customers.filter(c => c.status === 'active' || !c.status);
    activeCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${customer.name} - ${customer.code}`;
        select.appendChild(option);
    });
}

// Render Products (for searchable dropdown)
function renderProducts() {
    // Products are stored in global array, filtering will be done in search
    setupProductSearch();
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
                if (priceInput && product.smallestPrice) {
                    priceInput.value = product.smallestPrice;
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

// Setup Product Search for Delivery Note (show only products from selected delivery note)
function setupProductSearchForDeliveryNote() {
    const searchInput = document.getElementById('productSearch');
    const hiddenInput = document.getElementById('productSelect');
    const dropdown = document.getElementById('productDropdown');
    
    if (!searchInput || !selectedDeliveryNote || !selectedDeliveryNote.items) {
        setupProductSearch(); // Fallback to normal search
        return;
    }
    
    let selectedProduct = null;
    
    function filterProducts(searchTerm) {
        // Filter only products from delivery note that have available quantity
        // Show products with availableQuantity > 0 (including products already in current invoice when editing)
        let availableItems = selectedDeliveryNote.items.filter(item => {
            // Show items with available quantity > 0
            // When editing, items already in invoice will have their quantities added back to availableQuantity
            return (item.availableQuantity || 0) > 0;
        });
        
        if (!searchTerm || searchTerm.trim() === '') {
            return availableItems.slice(0, 10);
        }
        
        const term = searchTerm.toLowerCase().trim();
        return availableItems.filter(item => {
            const name = (item.productName || '').toLowerCase();
            const code = (item.productCode || '').toLowerCase();
            return name.includes(term) || code.includes(term);
        }).slice(0, 20);
    }
    
    function renderDropdown(filteredItems) {
        dropdown.innerHTML = '';
        
        if (filteredItems.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item no-results">لا توجد منتجات متاحة في إذن الصرف</div>';
            dropdown.classList.add('active');
            return;
        }
        
        filteredItems.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return;
            
            const availableQty = item.availableQuantity || 0;
            const itemElement = document.createElement('div');
            itemElement.className = 'dropdown-item';
            itemElement.innerHTML = `
                <div class="product-name">${item.productName}</div>
                <div class="product-category">متاح: ${availableQty.toFixed(2)} ${item.unitName || item.unit}</div>
            `;
            itemElement.addEventListener('click', () => {
                selectedProduct = product;
                searchInput.value = `${item.productName} - متاح: ${availableQty.toFixed(2)} ${item.unitName || item.unit}`;
                hiddenInput.value = product.id;
                dropdown.classList.remove('active');
                
                // Store delivery note item info
                hiddenInput.dataset.deliveryNoteItemId = item.productId;
                hiddenInput.dataset.availableQuantity = availableQty;
                hiddenInput.dataset.unit = item.unit;
                
                // Auto-fill price
                const priceInput = document.getElementById('productPrice');
                if (priceInput && product.smallestPrice) {
                    priceInput.value = product.smallestPrice;
                }
                
                // Set unit to match delivery note
                const unitSelect = document.getElementById('productUnit');
                if (unitSelect && item.unit) {
                    unitSelect.value = item.unit;
                }
                
                document.getElementById('productQuantity')?.focus();
            });
            dropdown.appendChild(itemElement);
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
}

// Load Tax Rate from Settings
async function loadTaxRateFromSettings(forceUpdate = false) {
    try {
        const taxRateField = document.getElementById('taxRate');
        if (!taxRateField) return;
        
        const status = document.getElementById('invoiceStatus')?.value;
        
        // For pending invoices, always update from settings (force update)
        // For other cases, only update if field is empty
        if (forceUpdate || status === 'pending' || taxRateField.value === '' || taxRateField.value === null) {
            const companySettings = await getCompanySettings();
            if (companySettings && companySettings.taxRate !== undefined && companySettings.taxRate !== null) {
                taxRateField.value = companySettings.taxRate;
                // Trigger calculation after setting value
                if (invoiceProducts.length > 0) {
                    await calculateTotals();
                }
            }
        }
    } catch (error) {
        console.error('Error loading tax rate from settings:', error);
    }
}

// Open New Invoice
async function openNewInvoice() {
    currentInvoice = null;
    invoiceProducts = [];
    selectedDeliveryNote = null;
    document.getElementById('isEdit').value = 'false';
    document.getElementById('invoiceId').value = '';
    document.getElementById('modalTitle').textContent = 'فاتورة مبيعات جديدة';
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceProductsBody').innerHTML = '';
    document.getElementById('customerInfo').classList.add('hidden');
    document.getElementById('printBtn').style.display = 'none';
    
    // Load delivery notes
    await loadDeliveryNotes();
    renderDeliveryNotes(); // Show all available notes for new invoice
    
    // Re-setup delivery note search for new invoice
    setupDeliveryNoteSearch();
    
    // Enable delivery note search for new invoice
    const deliveryNoteSearch = document.getElementById('deliveryNoteSearch');
    if (deliveryNoteSearch) {
        deliveryNoteSearch.disabled = false;
    }
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    setDueDate();
    document.getElementById('invoiceStatus').value = 'pending';
    document.getElementById('paymentMethod').value = 'cash';
    
    // Load default tax rate from company settings
    await loadTaxRateFromSettings();
    
    // Hide balance rows initially (will show when customer is selected)
    document.getElementById('newBalanceRow').style.display = 'none';
    document.getElementById('finalBalanceRow').style.display = 'none';
    
    await calculateTotals();
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

// Load Delivery Notes
async function loadDeliveryNotes() {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', 'status = ?', ['issued']);
            deliveryNotes = Array.isArray(deliveryNotes) ? deliveryNotes : [];
            
            // Load items for each note
            for (let note of deliveryNotes) {
                if (!note.items) {
                    const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [note.id]);
                    note.items = (noteItems || []).map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: item.productCode || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unitName || item.unit || '',
                        reservedQuantity: item.reservedQuantity || 0,
                        availableQuantity: item.availableQuantity || 0
                    }));
                }
            }
        } catch (error) {
            console.error('Error loading delivery notes:', error);
            deliveryNotes = [];
        }
    }
}

// Setup Delivery Note Search
function setupDeliveryNoteSearch() {
    const searchInput = document.getElementById('deliveryNoteSearch');
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    const dropdown = document.getElementById('deliveryNoteDropdown');
    
    if (!searchInput || !hiddenInput || !dropdown) return;
    
    let selectedNote = null;
    
    function filterNotes(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return deliveryNotes.filter(note => note.status === 'issued');
        }
        
        const term = searchTerm.toLowerCase().trim();
        return deliveryNotes.filter(note => {
            if (note.status !== 'issued') return false;
            const number = (note.deliveryNoteNumber || '').toLowerCase();
            const keeperName = ((note.warehouseKeeperName || note.salesRepName || '')).toLowerCase();
            const date = new Date(note.date).toLocaleDateString('ar-EG');
            return number.includes(term) || keeperName.includes(term) || date.includes(term);
        });
    }
    
    function renderDropdown(filteredNotes) {
        dropdown.innerHTML = '';
        
        if (filteredNotes.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item no-results">لا توجد أذون صرف متاحة</div>';
            dropdown.classList.add('active');
            return;
        }
        
        filteredNotes.slice(0, 10).forEach(note => {
            const keeperName = note.warehouseKeeperName || note.salesRepName || '';
            const date = new Date(note.date).toLocaleDateString('ar-EG');
            const itemElement = document.createElement('div');
            itemElement.className = 'dropdown-item';
            itemElement.innerHTML = `
                <div class="delivery-note-info">
                    <div class="delivery-note-number">${note.deliveryNoteNumber}</div>
                    <div class="delivery-note-details">
                        <span class="keeper-name">${keeperName}</span>
                        <span class="delivery-note-date">${date}</span>
                    </div>
                </div>
            `;
            itemElement.addEventListener('click', () => {
                selectedNote = note;
                searchInput.value = `${note.deliveryNoteNumber} - ${keeperName} - ${date}`;
                hiddenInput.value = note.id;
                dropdown.classList.remove('active');
                onDeliveryNoteChange();
            });
            dropdown.appendChild(itemElement);
        });
        
        dropdown.classList.add('active');
    }
    
    // Handle input
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        const filtered = filterNotes(term);
        renderDropdown(filtered);
    });
    
    // Handle focus
    searchInput.addEventListener('focus', () => {
        const term = searchInput.value;
        const filtered = filterNotes(term);
        renderDropdown(filtered);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

// Render Delivery Notes (for editing mode)
function renderDeliveryNotes(onlyNoteId = null) {
    const searchInput = document.getElementById('deliveryNoteSearch');
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    
    if (!searchInput || !hiddenInput) return;
    
    // If onlyNoteId is provided, show only that note (for editing)
    if (onlyNoteId) {
        const note = deliveryNotes.find(n => n.id === onlyNoteId);
        if (note) {
            const keeperName = note.warehouseKeeperName || note.salesRepName || '';
            const date = new Date(note.date).toLocaleDateString('ar-EG');
            searchInput.value = `${note.deliveryNoteNumber} - ${keeperName} - ${date}`;
            hiddenInput.value = note.id;
            searchInput.disabled = true; // Disable selection when editing
        }
        return;
    }
    
    // Reset for new invoice
    searchInput.value = '';
    hiddenInput.value = '';
    searchInput.disabled = false;
}

// Load Delivery Note for Edit
async function loadDeliveryNoteForEdit(deliveryNoteId) {
    // Load the specific delivery note from database if not in local array
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const note = await window.electronAPI.dbGet('delivery_notes', deliveryNoteId);
            if (note) {
                // Load note items
                const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [deliveryNoteId]);
                note.items = (noteItems || []).map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: item.productCode || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unitName || item.unit || '',
                    reservedQuantity: item.reservedQuantity || 0,
                    availableQuantity: item.availableQuantity || 0
                }));
                
                // Add to local array if not exists
                const existingIndex = deliveryNotes.findIndex(n => n.id === note.id);
                if (existingIndex === -1) {
                    deliveryNotes.push(note);
                } else {
                    deliveryNotes[existingIndex] = note;
                }
                
                // Set as selected delivery note
                selectedDeliveryNote = note;
                
                // Render only this note
                renderDeliveryNotes(deliveryNoteId);
                
                // Setup product search for this delivery note
                setupProductSearchForDeliveryNote();
            }
        } catch (error) {
            console.error('Error loading delivery note for edit:', error);
            // Fallback to showing all notes
            renderDeliveryNotes();
        }
    } else {
        // Fallback to showing all notes
        renderDeliveryNotes();
    }
}

// On Delivery Note Change
async function onDeliveryNoteChange() {
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    const deliveryNoteId = hiddenInput ? hiddenInput.value : null;
    
    if (!deliveryNoteId) {
        selectedDeliveryNote = null;
        // Only clear products if not editing an existing invoice
        if (!currentInvoice) {
            invoiceProducts = [];
            renderInvoiceProducts();
        }
        setupProductSearch(); // Reset to show all products
        return;
    }
    
    // Always reload delivery note from database to get updated availableQuantity
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const note = await window.electronAPI.dbGet('delivery_notes', deliveryNoteId);
            if (note) {
                // Load note items with updated availableQuantity
                const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [deliveryNoteId]);
                
                // If editing an invoice, we need to add back quantities from current invoice products
                // to show the correct available quantities (products already in this invoice should be available for selection)
                let itemsWithCorrectAvailable = (noteItems || []).map(item => {
                    let availableQty = item.availableQuantity || 0;
                    
                    // If editing an invoice, add back quantities from products already in this invoice
                    if (currentInvoice && invoiceProducts && invoiceProducts.length > 0) {
                        const productInInvoice = invoiceProducts.find(
                            p => p.productId === item.productId && p.unit === item.unit
                        );
                        if (productInInvoice) {
                            // Add back the quantity that's already in this invoice
                            availableQty += (productInInvoice.quantity || 0);
                        }
                    }
                    
                    return {
                        productId: item.productId,
                        productName: item.productName,
                        productCode: item.productCode || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unitName || item.unit || '',
                        reservedQuantity: item.reservedQuantity || 0,
                        availableQuantity: availableQty // Show correct available quantity
                    };
                });
                
                selectedDeliveryNote = {
                    ...note,
                    items: itemsWithCorrectAvailable
                };
                
                // Update local array as well
                const localNoteIndex = deliveryNotes.findIndex(n => n.id === deliveryNoteId);
                if (localNoteIndex !== -1) {
                    deliveryNotes[localNoteIndex] = selectedDeliveryNote;
                }
            } else {
                showMessage('إذن الصرف غير موجود', 'error');
                return;
            }
        } catch (error) {
            console.error('Error loading delivery note:', error);
            // Fallback to local array
            selectedDeliveryNote = deliveryNotes.find(n => n.id === deliveryNoteId);
            if (!selectedDeliveryNote) {
                showMessage('إذن الصرف غير موجود', 'error');
                return;
            }
        }
    } else {
        // Fallback to local array if API not available
        selectedDeliveryNote = deliveryNotes.find(n => n.id === deliveryNoteId);
        if (!selectedDeliveryNote) {
            showMessage('إذن الصرف غير موجود', 'error');
            return;
        }
    }
    
    // Update product search to show only products from delivery note
    setupProductSearchForDeliveryNote();
}

// On Customer Change
async function onCustomerChange() {
    const customerId = document.getElementById('customerSelect').value;
    if (!customerId) {
        document.getElementById('customerInfo').classList.add('hidden');
        // Hide balance rows when no customer selected
        document.getElementById('newBalanceRow').style.display = 'none';
        document.getElementById('finalBalanceRow').style.display = 'none';
        await calculateTotals();
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        document.getElementById('oldBalance').textContent = `${(customer.balance || 0).toFixed(2)} ج.م`;
        document.getElementById('customerInfo').classList.remove('hidden');
        await calculateTotals(); // This will show the balance rows
    }
}

// On Status Change
async function onStatusChange() {
    const status = document.getElementById('invoiceStatus').value;
    
    // If status changed to pending, update tax rate from settings
    if (status === 'pending') {
        await loadTaxRateFromSettings();
    }
    
    // If delivery note is selected, refresh it to show updated available quantities
    // This is important when changing status from pending to delivered or vice versa
    if (selectedDeliveryNote && selectedDeliveryNote.id) {
        await onDeliveryNoteChange();
    }
    
    await calculateTotals();
}

// Add Product to Invoice
async function addProductToInvoice() {
    const productSelect = document.getElementById('productSelect');
    const quantityInput = document.getElementById('productQuantity');
    const unitSelect = document.getElementById('productUnit');
    const priceInput = document.getElementById('productPrice');

    if (!productSelect.value || !quantityInput.value || !priceInput.value) {
        showMessage('يرجى ملء جميع الحقول', 'error');
        return;
    }
    
    // Check if delivery note is selected
    if (!selectedDeliveryNote) {
        showMessage('يرجى اختيار إذن الصرف أولاً', 'error');
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
    
    // Always reload delivery note item from database to get updated availableQuantity
    let deliveryNoteItem = null;
    let availableQuantity = 0;
    
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const deliveryNoteId = selectedDeliveryNote.id;
            const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 
                'deliveryNoteId = ? AND productId = ? AND unit = ?', 
                [deliveryNoteId, productData.id, unit]);
            
            if (noteItems && noteItems.length > 0) {
                deliveryNoteItem = noteItems[0];
                availableQuantity = deliveryNoteItem.availableQuantity || 0;
                
                // Update local selectedDeliveryNote with fresh data
                const localItemIndex = selectedDeliveryNote.items.findIndex(item => 
                    item.productId === productData.id && item.unit === unit);
                if (localItemIndex !== -1) {
                    selectedDeliveryNote.items[localItemIndex] = {
                        ...selectedDeliveryNote.items[localItemIndex],
                        availableQuantity: availableQuantity,
                        reservedQuantity: deliveryNoteItem.reservedQuantity || 0
                    };
                }
            } else {
                showMessage('المنتج غير موجود في إذن الصرف المختار', 'error');
                return;
            }
        } catch (error) {
            console.error('Error loading delivery note item from database:', error);
            // Fallback to local data
            deliveryNoteItem = selectedDeliveryNote.items.find(item => item.productId === productData.id && item.unit === unit);
            if (!deliveryNoteItem) {
                showMessage('المنتج غير موجود في إذن الصرف المختار', 'error');
                return;
            }
            availableQuantity = deliveryNoteItem.availableQuantity || 0;
        }
    } else {
        // Fallback to local data if API not available
        deliveryNoteItem = selectedDeliveryNote.items.find(item => item.productId === productData.id && item.unit === unit);
        if (!deliveryNoteItem) {
            showMessage('المنتج غير موجود في إذن الصرف المختار', 'error');
            return;
        }
        availableQuantity = deliveryNoteItem.availableQuantity || 0;
    }
    
    // Calculate quantity already added to current invoice for this product
    const quantityInCurrentInvoice = invoiceProducts
        .filter(p => p.productId === productData.id && p.unit === unit)
        .reduce((sum, p) => sum + (p.quantity || 0), 0);
    
    // Calculate actual available quantity = availableQuantity from DB - quantity in current invoice
    const actualAvailableQuantity = availableQuantity - quantityInCurrentInvoice;
    
    // Check available quantity from delivery note (considering current invoice)
    if (quantity > actualAvailableQuantity) {
        showMessage(`⚠️ الكمية المتاحة في إذن الصرف: ${actualAvailableQuantity.toFixed(2)} ${deliveryNoteItem.unitName || unit}`, 'error');
        return;
    }
    
    // Check if product already added to invoice
    const existingProduct = invoiceProducts.find(p => p.productId === productData.id && p.unit === unit);
    if (existingProduct) {
        const newQuantity = existingProduct.quantity + quantity;
        // Check against actualAvailableQuantity (which already excludes current invoice quantities)
        if (newQuantity > (availableQuantity - quantityInCurrentInvoice + existingProduct.quantity)) {
            const remainingAvailable = actualAvailableQuantity;
            showMessage(`⚠️ الكمية المتاحة في إذن الصرف: ${remainingAvailable.toFixed(2)} ${deliveryNoteItem.unitName || unit}`, 'error');
            return;
        }
        existingProduct.quantity = newQuantity;
        existingProduct.total = newQuantity * existingProduct.price;
        renderInvoiceProducts();
        await calculateTotals();
        
        // Reset inputs
        productSelect.value = '';
        document.getElementById('productSearch').value = '';
        quantityInput.value = '';
        priceInput.value = '';
        unitSelect.value = 'smallest';
        document.getElementById('productDropdown').classList.remove('active');
        return;
    }

    // Get product from products array
    let currentProduct = productData;
    if (window.electronAPI && window.electronAPI.dbGet) {
        try {
            const dbProduct = await window.electronAPI.dbGet('products', productData.id);
            if (dbProduct) {
                currentProduct = dbProduct;
            }
        } catch (error) {
            console.error('Error loading product from database:', error);
        }
    }

    // Calculate quantity in smallest unit
    let quantityInSmallestUnit = quantity;
    if (unit === 'largest') {
        // Convert from largest unit to smallest unit
        const conversionFactor = currentProduct.conversionFactor || 1;
        quantityInSmallestUnit = quantity * conversionFactor;
    }

    const invoiceProduct = {
        productId: currentProduct.id,
        productName: currentProduct.name,
        productCode: currentProduct.code,
        category: currentProduct.category || '', // Store category
        quantity: quantity,
        quantityInSmallestUnit: quantityInSmallestUnit, // Store converted quantity
        unit: unit,
        unitName: unit === 'smallest' ? currentProduct.smallestUnit : currentProduct.largestUnit,
        smallestUnit: currentProduct.smallestUnit || '', // Store smallest unit name
        price: price,
        total: quantity * price
    };

    invoiceProducts.push(invoiceProduct);
    renderInvoiceProducts();
    await calculateTotals();

    // Reset inputs
    productSelect.value = '';
    document.getElementById('productSearch').value = '';
    quantityInput.value = '';
    priceInput.value = '';
    unitSelect.value = 'smallest';
    document.getElementById('productDropdown').classList.remove('active');
}

// Remove Product from Invoice
async function removeProduct(index) {
    const removedProduct = invoiceProducts[index];
    
    // If product is from a delivery note, return it to available quantity
    if (removedProduct && selectedDeliveryNote && removedProduct.productId && removedProduct.unit) {
        const deliveryNoteId = selectedDeliveryNote.id;
        
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                // Find the delivery note item
                const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 
                    'deliveryNoteId = ? AND productId = ? AND unit = ?', 
                    [deliveryNoteId, removedProduct.productId, removedProduct.unit]);
                
                if (noteItems && noteItems.length > 0) {
                    const noteItem = noteItems[0];
                    const currentReserved = noteItem.reservedQuantity || 0;
                    const currentAvailable = noteItem.availableQuantity || 0;
                    const quantityToReturn = removedProduct.quantity || 0;
                    
                    // Return product: subtract from reserved, add to available
                    const newReserved = Math.max(0, currentReserved - quantityToReturn);
                    const newAvailable = currentAvailable + quantityToReturn;
                    
                    // Update delivery note item
                    const updateData = {
                        id: noteItem.id,
                        deliveryNoteId: noteItem.deliveryNoteId,
                        productId: noteItem.productId,
                        productName: noteItem.productName,
                        productCode: noteItem.productCode || '',
                        quantity: noteItem.quantity,
                        unit: noteItem.unit,
                        unitName: noteItem.unitName || '',
                        reservedQuantity: newReserved,
                        availableQuantity: newAvailable
                    };
                    
                    await window.electronAPI.dbUpdate('delivery_note_items', noteItem.id, updateData);
                    
                    // Update local selectedDeliveryNote to reflect the change
                    const itemIndex = selectedDeliveryNote.items.findIndex(
                        item => item.productId === removedProduct.productId && item.unit === removedProduct.unit
                    );
                    if (itemIndex !== -1) {
                        selectedDeliveryNote.items[itemIndex].reservedQuantity = newReserved;
                        selectedDeliveryNote.items[itemIndex].availableQuantity = newAvailable;
                    }
                    
                    // Refresh product search to show updated available quantities
                    setupProductSearchForDeliveryNote();
                }
            } catch (error) {
                console.error('Error returning product to delivery note:', error);
            }
        }
    }
    
    // Remove product from invoice
    invoiceProducts.splice(index, 1);
    renderInvoiceProducts();
    await calculateTotals();
}

// Render Invoice Products
function renderInvoiceProducts() {
    const tbody = document.getElementById('invoiceProductsBody');
    tbody.innerHTML = '';

    invoiceProducts.forEach((product, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.productName}${product.category ? ` - ${product.category}` : ''} (${product.productCode})</td>
            <td>${product.quantity}</td>
            <td>${product.unitName}</td>
            <td>${product.price.toFixed(2)} ج.م</td>
            <td>${product.total.toFixed(2)} ج.م</td>
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
async function calculateTotals() {
    const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    const taxRateField = document.getElementById('taxRate');
    let taxRate = parseFloat(taxRateField.value);
    
    // Use the value from the field, or 0 if empty/invalid
    // Don't auto-fill from settings here - let user control it
    if (isNaN(taxRate) || taxRateField.value === '') {
        taxRate = 0;
    }
    
    const taxAmount = (subtotal * taxRate) / 100;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const total = subtotal + taxAmount + shipping - discount;
    const paid = parseFloat(document.getElementById('paid').value) || 0;
    const remaining = total - paid;

    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} ج.م`;
    document.getElementById('taxAmount').textContent = `${taxAmount.toFixed(2)} ج.م`;
    document.getElementById('total').textContent = `${total.toFixed(2)} ج.م`;
    document.getElementById('remaining').textContent = `${remaining.toFixed(2)} ج.م`;

    // Show balance info if customer selected (for both pending and delivered)
    const customerId = document.getElementById('customerSelect').value;
    
    if (customerId) {
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            const oldBalance = customer.balance || 0;
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

    const customerId = document.getElementById('customerSelect').value;
    const date = document.getElementById('invoiceDate').value;
    const dueDate = document.getElementById('dueDate').value || '';
    const status = document.getElementById('invoiceStatus').value;
    const paymentMethod = document.getElementById('paymentMethod').value || 'cash';
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const paid = parseFloat(document.getElementById('paid').value) || 0;

    if (!customerId) {
        showMessage('يرجى اختيار العميل', 'error');
        return;
    }

    if (invoiceProducts.length === 0) {
        showMessage('يرجى إضافة منتجات للفاتورة', 'error');
        return;
    }

    const subtotal = invoiceProducts.reduce((sum, p) => sum + p.total, 0);
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const total = subtotal + taxAmount + shipping - discount;
    const remaining = total - paid;

    const invoiceId = currentInvoice ? currentInvoice.id : Date.now().toString();
    
    // Check if delivery note is selected (required)
    const hiddenInput = document.getElementById('deliveryNoteSelect');
    const deliveryNoteId = hiddenInput ? hiddenInput.value : null;
    if (!deliveryNoteId) {
        showMessage('يرجى اختيار إذن الصرف (إجباري)', 'error');
        return;
    }
    
    const deliveryNote = deliveryNotes.find(n => n.id === deliveryNoteId);
    if (!deliveryNote) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    // Ensure status is read correctly from the select field
    const statusValue = document.getElementById('invoiceStatus').value;
    
    // Generate invoice number and check for duplicates
    let invoiceNumber = currentInvoice ? currentInvoice.invoiceNumber : await generateInvoiceNumber();
    
    // Check if invoice number already exists (only for new invoices)
    if (!currentInvoice && window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const existingInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'invoiceNumber = ?', [invoiceNumber]);
            if (existingInvoices && existingInvoices.length > 0) {
                // Generate a new number if duplicate found
                console.warn('Invoice number already exists, generating new one:', invoiceNumber);
                invoiceNumber = await generateInvoiceNumber();
                // Check again (should be very rare)
                const checkAgain = await window.electronAPI.dbGetAll('sales_invoices', 'invoiceNumber = ?', [invoiceNumber]);
                if (checkAgain && checkAgain.length > 0) {
                    // Use timestamp-based number as fallback
                    invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;
                }
            }
        } catch (error) {
            console.error('Error checking invoice number:', error);
            // Continue with generated number
        }
    }
    
    const invoiceData = {
        id: invoiceId,
        invoiceNumber: invoiceNumber,
        customerId: customerId,
        date: date,
        dueDate: dueDate,
        status: statusValue || status, // Use statusValue first, fallback to status
        paymentMethod: paymentMethod,
        deliveryNoteId: deliveryNoteId,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
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
            
            // Ensure status is included explicitly from invoiceData
            invoiceDbData.status = invoiceData.status;
            
            // Get old invoice items before deletion (for updating delivery note quantities)
            let oldInvoiceItems = [];
            if (currentInvoice) {
                oldInvoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            }
            
            if (currentInvoice) {
                // Update existing invoice in database
                // dbUpdate expects (table, id, data)
                const updateResult = await window.electronAPI.dbUpdate('sales_invoices', invoiceId, invoiceDbData);
                
                // Check if update was successful
                // updateResult from better-sqlite3 is {changes: number}
                // In case of error, it returns {success: false, error: ...}
                if (updateResult && updateResult.success === false) {
                    const errorMsg = updateResult.error || 'فشل تحديث الفاتورة في قاعدة البيانات';
                    console.error('Failed to update invoice:', updateResult);
                    throw new Error(errorMsg);
                }
                if (!updateResult || (updateResult.changes === undefined)) {
                    console.error('Invalid update result:', updateResult);
                    throw new Error('فشل تحديث الفاتورة في قاعدة البيانات: نتيجة غير صحيحة');
                }
                
                // Revert old quantities from delivery note first
                if (deliveryNoteId && oldInvoiceItems && oldInvoiceItems.length > 0) {
                    for (const oldItem of oldInvoiceItems) {
                        const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ? AND productId = ? AND unit = ?', 
                            [deliveryNoteId, oldItem.productId, oldItem.unit]);
                        
                        if (noteItems && noteItems.length > 0) {
                            const noteItem = noteItems[0];
                            const currentReserved = noteItem.reservedQuantity || 0;
                            const currentAvailable = noteItem.availableQuantity || 0;
                            
                            // Revert: subtract from reserved, add to available
                            const newReserved = Math.max(0, currentReserved - oldItem.quantity);
                            const newAvailable = currentAvailable + oldItem.quantity;
                            
                            // Update delivery note item (exclude updatedAt and other non-existent columns)
                            const revertData = {
                                id: noteItem.id,
                                deliveryNoteId: noteItem.deliveryNoteId,
                                productId: noteItem.productId,
                                productName: noteItem.productName,
                                productCode: noteItem.productCode || '',
                                quantity: noteItem.quantity,
                                unit: noteItem.unit,
                                unitName: noteItem.unitName || '',
                                reservedQuantity: newReserved,
                                availableQuantity: newAvailable
                            };
                            await window.electronAPI.dbUpdate('delivery_note_items', noteItem.id, revertData);
                        }
                    }
                }
                
                // Delete old invoice items
                if (window.electronAPI && window.electronAPI.dbQuery) {
                    await window.electronAPI.dbQuery('DELETE FROM sales_invoice_items WHERE invoiceId = ?', [invoiceId]);
                } else {
                    // Fallback: get all items and delete one by one
                    for (const item of oldInvoiceItems) {
                        await window.electronAPI.dbDelete('sales_invoice_items', item.id);
                    }
                }
            } else {
                // Insert new invoice in database
                const insertResult = await window.electronAPI.dbInsert('sales_invoices', invoiceDbData);
                
                // Check if insert was successful
                // insertResult from better-sqlite3 is {changes: number, lastInsertRowid: number}
                // In case of error, it returns {success: false, error: ...}
                if (insertResult && insertResult.success === false) {
                    const errorMsg = insertResult.error || 'فشل حفظ الفاتورة في قاعدة البيانات';
                    console.error('Failed to insert invoice:', insertResult);
                    throw new Error(errorMsg);
                }
                if (!insertResult || (insertResult.changes === undefined && insertResult.lastInsertRowid === undefined)) {
                    console.error('Invalid insert result:', insertResult);
                    throw new Error('فشل حفظ الفاتورة في قاعدة البيانات: نتيجة غير صحيحة');
                }
            }
            
            // Save invoice items and update delivery note quantities
            for (const product of invoiceProducts) {
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
                const itemInsertResult = await window.electronAPI.dbInsert('sales_invoice_items', itemData);
                // Check if insert was successful
                // itemInsertResult from better-sqlite3 is {changes: number, lastInsertRowid: number}
                // In case of error, it returns {success: false, error: ...}
                if (itemInsertResult && itemInsertResult.success === false) {
                    console.error('Failed to insert invoice item:', itemInsertResult);
                    throw new Error(`فشل حفظ منتج في الفاتورة: ${itemInsertResult.error || 'خطأ غير معروف'}`);
                }
                if (!itemInsertResult || (itemInsertResult.changes === undefined && itemInsertResult.lastInsertRowid === undefined)) {
                    console.error('Invalid item insert result:', itemInsertResult);
                    throw new Error(`فشل حفظ منتج في الفاتورة: نتيجة غير صحيحة`);
                }
                
                // Update delivery note item reserved and available quantities
                if (deliveryNoteId) {
                    // Always reload from database to get latest values
                    const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ? AND productId = ? AND unit = ?', 
                        [deliveryNoteId, product.productId, product.unit]);
                    
                    if (noteItems && noteItems.length > 0) {
                        const noteItem = noteItems[0];
                        const currentReserved = noteItem.reservedQuantity || 0;
                        const currentAvailable = noteItem.availableQuantity || 0;
                        
                        // New invoice or editing: add to reserved, subtract from available
                        // (Old quantities already reverted above for editing)
                        const newReserved = currentReserved + product.quantity;
                        const newAvailable = Math.max(0, currentAvailable - product.quantity);
                        
                        // Update delivery note item (exclude updatedAt and other non-existent columns)
                        const updateData = {
                            id: noteItem.id,
                            deliveryNoteId: noteItem.deliveryNoteId,
                            productId: noteItem.productId,
                            productName: noteItem.productName,
                            productCode: noteItem.productCode || '',
                            quantity: noteItem.quantity,
                            unit: noteItem.unit,
                            unitName: noteItem.unitName || '',
                            reservedQuantity: newReserved,
                            availableQuantity: newAvailable
                        };
                        const updateResult = await window.electronAPI.dbUpdate('delivery_note_items', noteItem.id, updateData);
                        
                        // Verify the update was successful
                        if (updateResult && updateResult.success === false) {
                            console.error('[Sales] Failed to update delivery note item:', updateResult);
                            throw new Error(`فشل تحديث كمية المنتج في إذن الصرف: ${updateResult.error || 'خطأ غير معروف'}`);
                        }
                        
                        // Verify by reloading
                        const verifyItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ? AND productId = ? AND unit = ?', 
                            [deliveryNoteId, product.productId, product.unit]);
                        if (verifyItems && verifyItems.length > 0) {
                            const verifiedItem = verifyItems[0];
                        }
                    } else {
                        console.error('[Sales] Delivery note item not found for update:', {
                            deliveryNoteId: deliveryNoteId,
                            productId: product.productId,
                            unit: product.unit
                        });
                    }
                }
            }
        }
        
        // Wait a moment to ensure database commits
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Update local array
        if (currentInvoice) {
            // Update existing invoice
            const index = invoices.findIndex(inv => inv.id === currentInvoice.id);
            if (index !== -1) {
                invoiceData.products = [...invoiceProducts];
                invoices[index] = invoiceData;
            }
        } else {
            // New invoice
            invoiceData.products = [...invoiceProducts];
            invoices.push(invoiceData);
        }

        // Save to localStorage as backup
        await saveInvoices();
        
        // Reload data from database to ensure fresh data
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const updatedInvoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
                
                if (Array.isArray(updatedInvoices)) {
                    // Load invoice items for each invoice
                    for (let invoice of updatedInvoices) {
                        if (!invoice.status) {
                            invoice.status = 'pending';
                        }
                        
                        if (!invoice.products) {
                            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoice.id]);
                            invoice.products = (invoiceItems || []).map(item => ({
                                productId: item.productId,
                                productName: item.productName,
                                productCode: '',
                                quantity: item.quantity || 0,
                                unit: item.unit || '',
                                unitName: item.unit || '',
                                price: item.price || 0,
                                total: item.total || 0
                            }));
                        }
                    }
                    invoices = updatedInvoices;
                    console.log('[Sales] Invoices array updated, total count:', invoices.length);
                }
            } catch (error) {
                console.error('[Sales] Error reloading invoices after save:', error);
            }
        }
        
        // Reset to first page and clear filters to show new invoice
        currentPage = 1;
        searchQuery = '';
        dateFrom = '';
        dateTo = '';
        statusFilter = '';
        
        // Clear filter inputs
        const searchInput = document.getElementById('searchInput');
        const dateFromInput = document.getElementById('dateFrom');
        const dateToInput = document.getElementById('dateTo');
        const statusFilterInput = document.getElementById('statusFilter');
        
        if (searchInput) searchInput.value = '';
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        if (statusFilterInput) statusFilterInput.value = '';
        
        applyFilters(); // Use applyFilters instead of renderInvoices
        
        // Recalculate customer balance from all delivered invoices
        await recalculateCustomerBalance(customerId);
        
        // Update first transaction date for new invoices
        if (!currentInvoice) {
            await updateCustomerFirstTransactionDate(customerId);
        }
        
        // Update product stock for any invoice (pending or delivered)
        // IMPORTANT: For edits, we need to revert old stock first, then apply new stock
        console.log('[Sales] Invoice status:', status, 'invoiceId:', invoiceId);
        console.log('[Sales] Updating product stock for invoice:', invoiceId);
        console.log('[Sales] Invoice products count:', invoiceProducts.length);
        console.log('[Sales] Is edit mode:', !!currentInvoice);
        
        // Always revert old stock first if editing (before deleting old items from database)
        const isEdit = !!currentInvoice;
        if (isEdit && window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                console.log('[Sales] Reverting old stock changes BEFORE applying new changes');
                // Get old invoice items BEFORE they are deleted
                const oldItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                console.log('[Sales] Found old items to revert:', oldItems.length);
                
                // Revert stock changes for ALL old items
                for (const oldItem of oldItems) {
                    const oldProduct = await window.electronAPI.dbGet('products', oldItem.productId);
                    if (oldProduct) {
                        // Restore old stock (add back what was subtracted)
                        let quantityToAdd = oldItem.quantity || 0;
                        if (oldItem.unit === 'largest') {
                            const conversionFactor = oldProduct.conversionFactor || 1;
                            quantityToAdd = oldItem.quantity * conversionFactor;
                        }
                        
                        const currentStock = parseFloat(oldProduct.stock) || 0;
                        oldProduct.stock = currentStock + quantityToAdd;
                        oldProduct.updatedAt = new Date().toISOString();
                        await window.electronAPI.dbUpdate('products', oldProduct.id, oldProduct);
                    }
                }
            } catch (error) {
                console.error('[Sales] Error reverting old stock:', error);
            }
        }
        
        // Now apply new stock changes
        await updateProductStockFromInvoice(invoiceProducts, invoiceId);
        
        // Wait a small delay to ensure database updates are committed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Dispatch event to notify products screen - send for ALL products to ensure full refresh
        const uniqueProductIds = [...new Set(invoiceProducts.map(p => p.productId))];
        uniqueProductIds.forEach(productId => {
            window.dispatchEvent(new CustomEvent('productStockUpdated', { 
                detail: { productId: productId },
                bubbles: true,
                cancelable: true
            }));
        });
        
        // Also dispatch a global refresh event
        window.dispatchEvent(new CustomEvent('productsNeedRefresh', { bubbles: true }));
        
        // Auto print if status is pending (جاري التسليم)
        if (status === 'pending') {
            closeModal();
            setTimeout(async () => {
                await openPrintWindow(invoiceData);
            }, 500);
            showMessage('تم حفظ الفاتورة وطباعتها بنجاح', 'success');
        } else {
            closeModal();
            showMessage('تم حفظ الفاتورة بنجاح', 'success');
        }
    } catch (error) {
        console.error('Error saving invoice:', error);
        console.error('Error stack:', error.stack);
        console.error('Invoice data:', invoiceData);
        console.error('Invoice products:', invoiceProducts);
        
        // Check for specific error types
        let errorMessage = 'خطأ في حفظ الفاتورة: ' + error.message;
        if (error.message && (error.message.includes('UNIQUE') || error.message.includes('duplicate'))) {
            errorMessage = '⚠️ رقم الفاتورة موجود بالفعل. يرجى المحاولة مرة أخرى.';
        } else if (error.message && error.message.includes('FOREIGN KEY')) {
            errorMessage = '⚠️ خطأ في البيانات المرسلة. يرجى التحقق من العميل والمنتجات.';
        }
        
        showMessage(errorMessage, 'error');
    }
}

// Update Customer First Transaction Date
async function updateCustomerFirstTransactionDate(customerId) {
    if (!window.electronAPI || !window.electronAPI.dbGet || !window.electronAPI.dbUpdate) return;
    
    try {
        const customer = await window.electronAPI.dbGet('customers', customerId);
        if (!customer) return;
        
        // Get all invoices and receipts for this customer
        let customerInvoices = [];
        let customerReceipts = [];
        
        try {
            customerInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'customerId = ?', [customerId]);
            customerReceipts = await window.electronAPI.dbGetAll('receipts', 'customerId = ?', [customerId]);
        } catch (error) {
            console.error('Error loading transactions for customer:', error);
            return;
        }
        
        // Combine all transactions with their dates
        const allTransactions = [];
        customerInvoices.forEach(inv => {
            if (inv.date) allTransactions.push({ date: inv.date, type: 'invoice' });
        });
        customerReceipts.forEach(rec => {
            if (rec.date) allTransactions.push({ date: rec.date, type: 'receipt' });
        });
        
        // Find the earliest transaction date
        if (allTransactions.length > 0) {
            const sortedTransactions = allTransactions.sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            const firstTransactionDate = sortedTransactions[0].date;
            
            // Update firstTransactionDate if it's different or doesn't exist
            if (!customer.firstTransactionDate || customer.firstTransactionDate !== firstTransactionDate) {
                await window.electronAPI.dbUpdate('customers', customerId, {
                    ...customer,
                    firstTransactionDate: firstTransactionDate
                });
                
                // Update local array
                const localCustomer = customers.find(c => c.id === customerId);
                if (localCustomer) {
                    localCustomer.firstTransactionDate = firstTransactionDate;
                }
            }
        }
    } catch (error) {
        console.error('Error updating customer first transaction date:', error);
    }
}

// Recalculate Customer Balance from all invoices
async function recalculateCustomerBalance(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    // Get opening balance (stored when customer was first created)
    const openingBalance = customer.openingBalance || 0;
    
    // Get all delivered invoices for this customer from database
    let customerInvoices = [];
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            customerInvoices = await window.electronAPI.dbGetAll(
                'sales_invoices', 
                'customerId = ? AND status = ?', 
                [customerId, 'delivered']
            );
        } catch (error) {
            console.error('Error loading invoices from database:', error);
            // Fallback to local array
            customerInvoices = invoices.filter(inv => 
                inv.customerId === customerId && inv.status === 'delivered'
            );
        }
    } else {
        // Fallback to local array
        customerInvoices = invoices.filter(inv => 
            inv.customerId === customerId && inv.status === 'delivered'
        );
    }
    
    // Calculate: sum of all remaining amounts from delivered invoices
    let totalRemaining = 0;
    customerInvoices.forEach(invoice => {
        totalRemaining += (invoice.remaining || 0);
    });
    
    // Balance = opening balance + sum of all remaining amounts from delivered invoices
    const balance = openingBalance + totalRemaining;
    
    customer.balance = balance;
    customer.lastTransactionDate = new Date().toISOString();
    
    // Update first transaction date
    await updateCustomerFirstTransactionDate(customerId);
    
    // Save customer to localStorage
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    
    // Update customer in database
    if (window.electronAPI && window.electronAPI.dbUpdate) {
        try {
            customer.balance = balance;
            customer.lastTransactionDate = new Date().toISOString();
            customer.updatedAt = new Date().toISOString();
            await window.electronAPI.dbUpdate('customers', customerId, customer);
        } catch (error) {
            console.error('Error updating customer balance in database:', error);
        }
    }
    
    // Update customer display if modal is open
    if (document.getElementById('customerSelect')) {
        const currentCustomerId = document.getElementById('customerSelect').value;
        if (currentCustomerId === customerId) {
            const oldBalanceEl = document.getElementById('oldBalance');
            if (oldBalanceEl) {
                oldBalanceEl.textContent = `${balance.toFixed(2)} ج.م`;
            }
            calculateTotals();
        }
    }
}

// Update Product Stock from Invoice
async function updateProductStockFromInvoice(invoiceProducts, invoiceId) {
    try {
        // Note: Reverting old stock is now done BEFORE this function is called
        // (in handleFormSubmit before deleting old items from database)
        
        // Now apply new stock changes
        for (const invoiceProduct of invoiceProducts) {
            // Get product from database
            let product = null;
            if (window.electronAPI && window.electronAPI.dbGet) {
                product = await window.electronAPI.dbGet('products', invoiceProduct.productId);
            }
            
            if (!product) {
                console.error('[Sales] Product not found:', invoiceProduct.productId);
                continue;
            }
            
            // Calculate quantity to subtract in smallest unit
            let quantityToSubtract = invoiceProduct.quantityInSmallestUnit || invoiceProduct.quantity;
            
            // If unit is largest, convert to smallest
            if (invoiceProduct.unit === 'largest') {
                const conversionFactor = product.conversionFactor || 1;
                quantityToSubtract = invoiceProduct.quantity * conversionFactor;
            }
            
            // Update stock
            const currentStock = parseFloat(product.stock) || 0;
            const newStock = Math.max(0, currentStock - quantityToSubtract);
            
            product.stock = newStock;
            product.lastSaleDate = new Date().toISOString();
            product.updatedAt = new Date().toISOString();
            
            // Update product in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('products', product.id, product);
            } else {
                console.error('[Sales] electronAPI or dbUpdate not available!');
            }
            
            // Update in local array too
            const localProduct = products.find(p => p.id === product.id);
            if (localProduct) {
                localProduct.stock = newStock;
                localProduct.lastSaleDate = product.lastSaleDate;
            }
        }
    } catch (error) {
        console.error('[Sales] Error updating product stock:', error);
        console.error('[Sales] Error details:', error.message, error.stack);
    }
}

// Update Customer Balance (deprecated - use recalculateCustomerBalance instead)
function updateCustomerBalance(customerId, amount) {
    // This function is kept for backward compatibility but recalculateCustomerBalance should be used
    recalculateCustomerBalance(customerId);
}

// Apply Filters and Search
function applyFilters() {
    // Start with all invoices
    filteredInvoices = [...invoices];
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredInvoices = filteredInvoices.filter(invoice => {
            // Search by invoice number
            const invoiceNumber = (invoice.invoiceNumber || '').toLowerCase();
            if (invoiceNumber.includes(query)) return true;
            
            // Search by customer name
            const customer = customers.find(c => c.id === invoice.customerId);
            if (customer) {
                const customerName = (customer.name || '').toLowerCase();
                if (customerName.includes(query)) return true;
            }
            
            return false;
        });
    }
    
    // Apply date range filter
    if (dateFrom) {
        filteredInvoices = filteredInvoices.filter(invoice => {
            return new Date(invoice.date) >= new Date(dateFrom);
        });
    }
    
    if (dateTo) {
        filteredInvoices = filteredInvoices.filter(invoice => {
            const invoiceDate = new Date(invoice.date);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return invoiceDate <= toDate;
        });
    }
    
    // Apply status filter
    if (statusFilter) {
        filteredInvoices = filteredInvoices.filter(invoice => {
            return invoice.status === statusFilter;
        });
    }
    
    // Apply sorting
    filteredInvoices.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return new Date(b.date) - new Date(a.date);
            case 'date-asc':
                return new Date(a.date) - new Date(b.date);
            case 'total-desc':
                return (b.total || 0) - (a.total || 0);
            case 'total-asc':
                return (a.total || 0) - (b.total || 0);
            case 'number-desc':
                return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
            case 'number-asc':
                return (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
            default:
                return new Date(b.date) - new Date(a.date);
        }
    });
    
    // Render paginated invoices
    renderInvoices();
}

// Render Invoices
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
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteInvoices = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
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

    paginatedInvoices.forEach(invoice => {
        const customer = customers.find(c => c.id === invoice.customerId);
        const row = document.createElement('tr');
        
        // Create cells
        const invoiceNumberCell = document.createElement('td');
        invoiceNumberCell.textContent = invoice.invoiceNumber;
        row.appendChild(invoiceNumberCell);
        
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(invoice.date).toLocaleDateString('ar-EG');
        row.appendChild(dateCell);
        
        // Customer name cell with strong tag
        const customerNameCell = document.createElement('td');
        customerNameCell.className = 'customer-name-cell';
        customerNameCell.innerHTML = `<strong>${customer ? customer.name : 'غير محدد'}</strong>`;
        row.appendChild(customerNameCell);
        
        // Total cell with strong tag
        const totalCell = document.createElement('td');
        totalCell.className = 'invoice-total-cell';
        totalCell.innerHTML = `<strong>${invoice.total.toFixed(2)} ج.م</strong>`;
        row.appendChild(totalCell);
        
        // Paid cell with strong tag
        const paidCell = document.createElement('td');
        paidCell.className = 'invoice-paid-cell';
        paidCell.innerHTML = `<strong>${invoice.paid.toFixed(2)} ج.م</strong>`;
        row.appendChild(paidCell);
        
        // Remaining cell with strong tag
        const remainingCell = document.createElement('td');
        remainingCell.className = 'invoice-remaining-cell';
        remainingCell.innerHTML = `<strong>${invoice.remaining.toFixed(2)} ج.م</strong>`;
        row.appendChild(remainingCell);
        
        // Status badge cell
        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge ${invoice.status}`;
        statusBadge.textContent = invoice.status === 'pending' ? 'جاري التسليم' : 'تم التسليم';
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);
        
        // Actions cell
        const actionsCell = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions-buttons';
        
        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn view';
        viewBtn.textContent = '👁️';
        viewBtn.title = 'عرض';
        viewBtn.addEventListener('click', async () => {
            await viewInvoice(invoice.id);
        });
        actionsDiv.appendChild(viewBtn);
        
        // Edit button (only for pending invoices)
        if (invoice.status === 'pending') {
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn edit';
            editBtn.textContent = '✏️';
            editBtn.title = 'تعديل';
            editBtn.addEventListener('click', () => {
                editInvoice(invoice.id);
            });
            actionsDiv.appendChild(editBtn);
        }
        
        // Print button
        const printBtn = document.createElement('button');
        printBtn.className = 'action-btn print';
        printBtn.textContent = '🖨️';
        printBtn.title = 'طباعة';
        printBtn.addEventListener('click', async () => {
            await printInvoiceById(invoice.id);
        });
        actionsDiv.appendChild(printBtn);
        
        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'action-btn save';
        saveBtn.textContent = '💾';
        saveBtn.title = 'حفظ على القرص';
        saveBtn.addEventListener('click', async () => {
            await saveInvoiceToDisk(invoice.id);
        });
        actionsDiv.appendChild(saveBtn);
        
        // Delete button (only for manager or system_engineer)
        if (canDeleteInvoices) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button'; // Ensure it's a button type
            
            // Explicitly set all properties to ensure button is enabled
            deleteBtn.disabled = false;
            deleteBtn.removeAttribute('disabled');
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-action', 'delete-invoice');
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.pointerEvents = 'auto';
            deleteBtn.style.opacity = '1';
            deleteBtn.style.filter = 'none';
            deleteBtn.style.userSelect = 'none';
            
            // Add click event listener
            const clickHandler = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await deleteInvoice(invoice.id);
            };
            
            deleteBtn.addEventListener('click', clickHandler, { capture: true });
            actionsDiv.appendChild(deleteBtn);
        }
        
        actionsCell.appendChild(actionsDiv);
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    });
}

// View Invoice (view only, no print)
async function viewInvoice(invoiceId) {
    console.log('viewInvoice called with ID:', invoiceId);
    
    // Try to find invoice in local array first
    let invoice = invoices.find(inv => inv && inv.id === invoiceId);
    
    // If not found, load from database
    if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
        try {
            console.log('Loading invoice from database...');
            invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
            
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items from database
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                productCode: '',
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unit || '',
                price: item.price || 0,
                total: item.total || 0
            }));
            
            // Load customer from database if needed
            if (!customers.find(c => c && c.id === invoice.customerId)) {
                const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
                if (customer) {
                    customers.push(customer);
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
                const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                invoice.products = (invoiceItems || []).map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unit || '',
                    price: item.price || 0,
                    total: item.total || 0
                }));
            } catch (error) {
                console.error('Error loading invoice items:', error);
                invoice.products = [];
            }
        } else {
            invoice.products = [];
        }
    }

    // Open in view window (no print)
    await openViewWindow(invoice);
}

// Edit Invoice
async function editInvoice(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showMessage('الفاتورة غير موجودة', 'error');
        return;
    }
    // Allow editing invoices regardless of status (pending or delivered)

    currentInvoice = invoice;
    invoiceProducts = [...invoice.products];
    
    // Load category for each product if not present
    if (window.electronAPI && window.electronAPI.dbGet) {
        for (let product of invoiceProducts) {
            if (product.productId && !product.category) {
                try {
                    const productData = await window.electronAPI.dbGet('products', product.productId);
                    if (productData && productData.category) {
                        product.category = productData.category;
                    }
                } catch (error) {
                    console.error('Error loading product category:', error);
                }
            }
        }
    }
    
    document.getElementById('isEdit').value = 'true';
    document.getElementById('invoiceId').value = invoice.id;
    document.getElementById('modalTitle').textContent = `تعديل فاتورة ${invoice.invoiceNumber}`;
    document.getElementById('customerSelect').value = invoice.customerId;
    document.getElementById('invoiceDate').value = invoice.date;
    document.getElementById('dueDate').value = invoice.dueDate || '';
    document.getElementById('invoiceStatus').value = invoice.status;
    document.getElementById('paymentMethod').value = invoice.paymentMethod || 'cash';
    
    // For pending invoices, always update tax rate from settings
    // For delivered invoices, use invoice taxRate if exists
    const status = invoice.status;
    
    if (status === 'pending') {
        // Always get latest tax rate from settings for pending invoices
        await loadTaxRateFromSettings(true); // Force update
    } else {
        // For delivered invoices, use invoice taxRate if exists
        let taxRate = invoice.taxRate;
        if (taxRate === null || taxRate === undefined) {
            const companySettings = await getCompanySettings();
            if (companySettings && companySettings.taxRate !== undefined && companySettings.taxRate !== null) {
                taxRate = companySettings.taxRate;
            } else {
                taxRate = ''; // Leave empty if no default
            }
        }
        document.getElementById('taxRate').value = taxRate;
    }
    
    document.getElementById('shipping').value = invoice.shipping || 0;
    document.getElementById('discount').value = invoice.discount || 0;
    document.getElementById('paid').value = invoice.paid || 0;
    
    // Set delivery note if exists
    if (invoice.deliveryNoteId) {
        // Load delivery note and render only the linked one
        await loadDeliveryNoteForEdit(invoice.deliveryNoteId);
        // Reload delivery note to get updated availableQuantity after loading invoice products
        // This ensures we show the correct available quantities (excluding products already in this invoice)
        await onDeliveryNoteChange();
    } else {
        // If no delivery note, render all available notes
        renderDeliveryNotes();
        // Enable delivery note search if no delivery note
        const deliveryNoteSearch = document.getElementById('deliveryNoteSearch');
        if (deliveryNoteSearch) {
            deliveryNoteSearch.disabled = false;
        }
    }
    
    await onCustomerChange();
    renderInvoiceProducts();
    await calculateTotals();
    document.getElementById('invoiceModal').classList.add('active');
}

// Print Invoice
async function printInvoiceById(invoiceId) {
    console.log('printInvoiceById called with ID:', invoiceId);
    
    // Try to find invoice in local array first
    let invoice = invoices.find(inv => inv && inv.id === invoiceId);
    
    // If not found, load from database
    if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
        try {
            console.log('Loading invoice from database...');
            invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
            
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items from database
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                productCode: '',
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unit || '',
                price: item.price || 0,
                total: item.total || 0
            }));
            
            // Load customer from database if needed
            if (!customers.find(c => c && c.id === invoice.customerId)) {
                const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
                if (customer) {
                    customers.push(customer);
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
                const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                invoice.products = (invoiceItems || []).map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productCode: '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    unitName: item.unit || '',
                    price: item.price || 0,
                    total: item.total || 0
                }));
            } catch (error) {
                console.error('Error loading invoice items:', error);
                invoice.products = [];
            }
        } else {
            invoice.products = [];
        }
    }

    await openPrintWindow(invoice);
}

// Save Invoice to Disk
async function saveInvoiceToDisk(invoiceId) {
    console.log('saveInvoiceToDisk called with ID:', invoiceId);
    
    try {
        // Try to find invoice in local array first
        let invoice = invoices.find(inv => inv && inv.id === invoiceId);
        console.log('Invoice found in local array:', !!invoice);
        
        // If not found, load from database
        if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
            try {
                console.log('Loading invoice from database...');
                invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
                console.log('Invoice loaded from database:', !!invoice);
            
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items from database
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = (invoiceItems || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                productCode: '',
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unit || '',
                price: item.price || 0,
                total: item.total || 0
            }));
            
            // Load customer from database if needed
            if (!customers.find(c => c && c.id === invoice.customerId)) {
                const customer = await window.electronAPI.dbGet('customers', invoice.customerId);
                if (customer) {
                    customers.push(customer);
                }
            }
            } catch (error) {
                console.error('Error loading invoice from database:', error);
                showMessage('خطأ في تحميل الفاتورة: ' + error.message, 'error');
                return;
            }
        }
        
        if (!invoice) {
            console.error('Invoice not found with ID:', invoiceId);
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                try {
                    const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
                    invoice.products = (invoiceItems || []).map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productCode: '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        unitName: item.unit || '',
                        price: item.price || 0,
                        total: item.total || 0
                    }));
                } catch (error) {
                    console.error('Error loading invoice items:', error);
                    invoice.products = [];
                }
            } else {
                invoice.products = [];
            }
        }
        
        // Get customer
        const customer = customers.find(c => c && c.id === invoice.customerId);
        
        // Generate invoice HTML content
        const invoiceContent = await generatePrintContent(invoice, customer, false);
        
        // Generate default file name
        const defaultFileName = `فاتورة_مبيعات_${invoice.invoiceNumber}_${new Date(invoice.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(invoiceContent, defaultFileName);
                
                if (result.success) {
                    // Show success message immediately
                    showMessage(`تم حفظ الفاتورة بنجاح في: ${result.filePath}`, 'success');
                } else if (result.cancelled) {
                    // User cancelled, do nothing
                } else {
                    console.error('Save failed:', result.error);
                    showMessage('خطأ في حفظ الفاتورة: ' + (result.error || 'خطأ غير معروف'), 'error');
                }
            } catch (error) {
                console.error('Error saving invoice to file:', error);
                showMessage('خطأ في حفظ الفاتورة: ' + error.message, 'error');
            }
        } else {
            console.error('saveInvoiceToFile API not available');
            showMessage('وظيفة حفظ الملف غير متاحة', 'error');
        }
    } catch (error) {
        console.error('Error in saveInvoiceToDisk:', error);
        showMessage('خطأ في حفظ الفاتورة: ' + error.message, 'error');
    }
}

// Print Current Invoice
async function printInvoice() {
    if (!currentInvoice) return;
    await openPrintWindow(currentInvoice);
}

// Open View Window (view only, no print)
async function openViewWindow(invoice) {
    try {
        if (!invoice) {
            console.error('Invoice is null or undefined');
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            console.warn('Invoice products not found, setting empty array');
            invoice.products = [];
        }
        
        const customer = customers.find(c => c && c.id === invoice.customerId);
        if (!customer) {
            console.warn('Customer not found for invoice:', invoice.customerId);
        }
        
        const viewContent = await generatePrintContent(invoice, customer, false);
        
        if (!viewContent) {
            console.error('View content is empty');
            showMessage('خطأ في إنشاء محتوى العرض', 'error');
            return;
        }
        
        // Try to open view window
        try {
            const viewWindow = window.open('', '_blank', 'width=800,height=600');
            if (!viewWindow || viewWindow.closed || typeof viewWindow.closed === 'undefined') {
                console.error('Failed to open view window - may be blocked');
                // Fallback: try to create a blob URL
                const blob = new Blob([viewContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                return;
            }
            
            viewWindow.document.write(viewContent);
            viewWindow.document.close();
        } catch (openError) {
            console.error('Error opening view window:', openError);
            showMessage('خطأ في فتح نافذة العرض: ' + openError.message, 'error');
        }
    } catch (error) {
        console.error('Error in openViewWindow:', error);
        showMessage('خطأ في عرض الفاتورة: ' + error.message, 'error');
    }
}

// Open Print Window
async function openPrintWindow(invoice) {
    try {
        if (!invoice) {
            console.error('Invoice is null or undefined');
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            console.warn('Invoice products not found, setting empty array');
            invoice.products = [];
        }
        
        const customer = customers.find(c => c && c.id === invoice.customerId);
        if (!customer) {
            console.warn('Customer not found for invoice:', invoice.customerId);
        }
        
        const printContent = await generatePrintContent(invoice, customer, true);
        
        if (!printContent) {
            console.error('Print content is empty');
            showMessage('خطأ في إنشاء محتوى الطباعة', 'error');
            return;
        }
        
        // Try to open print window
        try {
            const printWindow = window.open('', '_blank');
            if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
                console.error('Failed to open print window - may be blocked');
                // Fallback: try to create a blob URL
                const blob = new Blob([printContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const newWindow = window.open(url, '_blank');
                if (newWindow) {
                    setTimeout(() => {
                        newWindow.print();
                        URL.revokeObjectURL(url);
                    }, 500);
                } else {
                    showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات منع النوافذ المنبثقة', 'error');
                }
                return;
            }
            
            printWindow.document.write(printContent);
            printWindow.document.close();
            
            setTimeout(() => {
                try {
                    printWindow.focus();
                    printWindow.print();
                } catch (printError) {
                    console.error('Error calling print():', printError);
                    showMessage('تم فتح نافذة الطباعة. يرجى استخدام زر الطباعة في المتصفح', 'info');
                }
            }, 500);
        } catch (openError) {
            console.error('Error opening print window:', openError);
            showMessage('خطأ في فتح نافذة الطباعة: ' + openError.message, 'error');
        }
    } catch (error) {
        console.error('Error in openPrintWindow:', error);
        showMessage('خطأ في طباعة الفاتورة: ' + error.message, 'error');
    }
}

// Generate Print Content
async function generatePrintContent(invoice, customer, isForPrint = true) {
    try {
        // Get logo path
        let logoPath = 'assets/icon-asel.ico'; // Default fallback
        if (window.electronAPI && window.electronAPI.getAssetPath) {
            try {
                const result = await window.electronAPI.getAssetPath('icon-asel.ico');
                if (result && result.success) {
                    logoPath = result.path;
                }
            } catch (error) {
                console.warn('Error getting logo path:', error);
            }
        }
        
        // Ensure invoice has products array
        if (!invoice.products || !Array.isArray(invoice.products)) {
            console.warn('Invoice products not found in generatePrintContent, setting empty array');
            invoice.products = [];
        }
        
        // Calculate product count to determine if we need to split pages
        const productCount = invoice.products.length;
        const shouldSplitPages = productCount > 16;
        
        // Load smallestUnit, category and calculate quantityInSmallestUnit for each product if not already present
        if (window.electronAPI && window.electronAPI.dbGet) {
            for (let product of invoice.products) {
                if (product.productId) {
                    try {
                        const productData = await window.electronAPI.dbGet('products', product.productId);
                        if (productData) {
                            // Set smallestUnit if not present
                            if (!product.smallestUnit && productData.smallestUnit) {
                                product.smallestUnit = productData.smallestUnit;
                            }
                            // Set category if not present
                            if (!product.category && productData.category) {
                                product.category = productData.category;
                            }
                            // Calculate quantityInSmallestUnit if not present
                            if (!product.quantityInSmallestUnit && product.quantity) {
                                if (product.unit === 'largest' || (product.unitName && product.unitName === productData.largestUnit)) {
                                    // Convert from largest unit to smallest unit
                                    const conversionFactor = productData.conversionFactor || 1;
                                    product.quantityInSmallestUnit = product.quantity * conversionFactor;
                                } else {
                                    // Already in smallest unit
                                    product.quantityInSmallestUnit = product.quantity;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error loading product data:', error);
                    }
                }
            }
        }
        
        const companySettings = await getCompanySettings();
        const oldBalance = customer ? (customer.balance || 0) - (invoice.remaining || 0) : 0;
        const newBalance = customer ? (customer.balance || 0) : 0;
        
        // Check if customer's old balance (excluding current invoice) exceeds 10,000
        const shouldShowWarning = customer && oldBalance > 10000;
        
        // Payment method text
        const paymentMethodText = {
            'cash': 'نقدي',
            'bank': 'تحويل بنكي',
            'check': 'شيك',
            'wallet': 'محفظة إلكترونية'
        };
        
        const paymentMethod = paymentMethodText[invoice.paymentMethod] || 'نقدي';
    
    // Convert numbers to Persian/Arabic numerals
    const toPersianNumerals = (str) => {
        const persianDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return str.toString().replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
    };
    
    // Format currency
    const formatCurrency = (amount) => {
        const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return toPersianNumerals(formatted);
    };
    
    // Format quantity
    const formatQuantity = (quantity) => {
        let formatted;
        if (quantity % 1 === 0) {
            // Integer, no decimal places
            formatted = quantity.toString();
        } else {
            // Decimal, show up to 2 decimal places
            formatted = quantity.toFixed(2).replace(/\.?0+$/, '');
        }
        return toPersianNumerals(formatted);
    };
    
    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const formatted = date.toLocaleDateString('ar-EG');
        return toPersianNumerals(formatted);
    };
    
    // Get invoice status text
    const getStatusText = (status) => {
        const statusMap = {
            'pending': 'معلق',
            'delivered': 'مدفوعة',
            'partial': 'جزئي',
            'cancelled': 'ملغاة'
        };
        return statusMap[status] || 'غير محدد';
    };
    
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فاتورة ${invoice.invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
        }
        @media print {
            @page {
                size: A4;
                margin: 3mm;
            }
            body {
            background: white;
            margin: 0;
                padding: 0;
            }
            .page-break {
                height: 0;
                margin: 2mm 0;
                page-break-after: never !important;
                page-break-before: never !important;
                display: block;
        }
            /* Each invoice container should fit in one A4 page */
            .invoices-wrapper {
                display: block !important;
            }
            .invoice-container {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: auto !important;
                break-after: auto !important;
                page-break-before: auto !important;
                break-before: auto !important;
                margin-bottom: 0.5mm !important;
                padding: 1.5mm !important;
                max-height: none !important;
                height: auto !important;
                display: block !important;
            }
            .invoice-container:first-of-type {
                page-break-before: avoid !important;
                break-before: avoid !important;
            }
            /* Only split pages if product count > 16 */
            .invoices-wrapper.split-pages .invoice-container:nth-of-type(2) {
                page-break-before: always !important;
                break-before: page !important;
            }
            .invoices-wrapper.single-page .invoice-container:nth-of-type(2) {
                page-break-before: avoid !important;
                break-before: avoid !important;
            }
            /* Only show cut-line and force page break if product count > 16 */
            .invoices-wrapper.split-pages .cut-line {
                page-break-after: always !important;
                break-after: page !important;
                page-break-before: always !important;
                break-before: page !important;
                display: block !important;
                margin: 0 !important;
                height: 0 !important;
                border: none !important;
            }
            .invoices-wrapper.single-page .cut-line {
                display: none !important;
            }
            /* Prevent page break around thank-you-text and footer */
            .footer {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .thank-you-text {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                page-break-before: avoid !important;
                break-before: avoid !important;
            }
            /* Only back-page-notice should break before */
            .back-page-notice {
                page-break-before: always !important;
                break-before: page !important;
                page-break-after: auto !important;
                page-break-inside: avoid !important;
            }
        }
        .invoices-wrapper {
            display: block;
            width: 100%;
        }
        .invoice-container {
            width: 100%;
            max-width: 200mm;
            min-height: auto;
            height: auto;
            margin: 0 auto 1mm auto;
            background: white;
            padding: 1.5mm;
            position: relative;
            box-sizing: border-box;
        }
        .page-break {
            height: 0;
            border-top: 1px dashed #ccc;
            margin: 2mm 0;
        }
        .invoice-type {
            position: absolute;
            top: 3mm;
            left: 35mm;
            background: rgba(44, 62, 80, 0.5);
            color: white;
            padding: 3px 10px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
            opacity: 0.6;
        }
        .invoice-type.company-copy {
            background: rgba(192, 57, 43, 0.5);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 3px;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 2px;
        }
        .company-logo {
            width: 40px;
            height: 40px;
            margin-left: 8px;
            margin-bottom: 2px;
            object-fit: contain;
        }
        .company-info {
            flex: 1;
        }
        .company-name {
            font-size: 14px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 2px;
        }
        .company-details {
            font-size: 7px;
            color: #666;
            line-height: 1.3;
            font-weight: bold;
        }
        .company-details p {
            margin: 0.5px 0;
        }
        .invoice-title {
            text-align: left;
            color: #2c3e50;
        }
        .invoice-title h1 {
            font-size: 16px;
            margin-bottom: 2px;
        }
        .invoice-number {
            font-size: 9px;
            color: #666;
        }
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            gap: 10px;
        }
        .info-box {
            flex: 1;
            background: #f8f9fa;
            padding: 3px;
            border-radius: 3px;
        }
        .info-box h3 {
            font-size: 9px;
            color: #2c3e50;
            margin-bottom: 3px;
            border-bottom: 1px solid #3498db;
            padding-bottom: 2px;
        }
        .info-box p {
            font-size: 7px;
            color: #555;
            margin: 1px 0;
            font-weight: bold;
            line-height: 1.3;
        }
        .tables-container {
            display: flex;
            gap: 8px;
            margin-bottom: 3px;
            align-items: flex-start;
        }
        .items-table {
            flex: 1;
            border-collapse: collapse;
            font-size: 8px;
            margin-bottom: 0;
        }
        .items-table thead {
            background: #2c3e50;
            color: white;
        }
        .items-table th {
            padding: 3px;
            text-align: center;
            font-size: 8px;
            font-weight: bold;
        }
        .items-table td {
            padding: 3px;
            text-align: center;
            border-bottom: 1px solid #ddd;
            font-size: 7px;
            font-weight: bold;
        }
        /* توضيح بيانات سعر الوحدة والمجموع */
        .items-table td:nth-child(4),
        .items-table td:nth-child(5) {
            font-size: 9px;
            font-weight: bold;
            color: #1a1a1a;
            background-color: #f8f9fa;
            padding: 4px 5px;
        }
        .items-table th:nth-child(4),
        .items-table th:nth-child(5) {
            background-color: #34495e;
            font-size: 9px;
        }
        .items-table tbody tr:hover {
            background: #f8f9fa;
        }
        .items-table tbody tr.empty-row {
            height: 15px;
            border-bottom: 1px dashed #ddd;
        }
        .items-table tbody tr.empty-row td {
            border-bottom: 1px dashed #ddd;
            min-height: 20px;
        }
        .manual-edit-section {
            margin-top: 3px;
            padding: 3px;
            border: 1px dashed #ccc;
            border-radius: 3px;
            background: #fafafa;
            font-size: 7px;
            color: #666;
        }
        .manual-edit-section p {
            margin: 3px 0;
            font-weight: bold;
        }
        .total-section {
            display: flex;
            justify-content: flex-start;
            margin-bottom: 2px;
        }
        .total-box {
            min-width: 200px;
            width: 200px;
            border: 1.5px solid #2c3e50;
            border-radius: 3px;
            overflow: hidden;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 8px;
            font-size: 8px;
        }
        .total-row:not(:last-child) {
            border-bottom: 1px solid #ddd;
        }
        .total-row.grand-total {
            background: #2c3e50;
            color: white;
            font-weight: bold;
            font-size: 9px;
        }
        .total-row.grand-total.highlighted {
            font-weight: 700;
            font-size: 0.85rem;
            color: #1e293b;
            background: transparent;
        }
        .total-row.new-balance {
            font-weight: 700;
            font-size: 0.85rem;
            color: #1e293b;
        }
        .total-row.new-balance span {
            white-space: nowrap;
        }
        .total-row.old-balance {
            font-weight: 700;
            font-size: 0.85rem;
            color: #1e293b;
        }
        .manual-edit-row.remaining-balance {
            font-weight: bold;
        }
        .manual-edit-row.remaining-balance span:first-child {
            font-weight: bold;
            color: #000000;
        }
        .total-row.empty-row {
            height: 18px;
            border-bottom: 1px dashed #ddd;
            padding: 4px 8px;
        }
        .total-row.empty-row span {
            border: none;
            font-size: 9px;
        }
        .manual-edit-section-wrapper {
            background: #fef3c7;
            border: 2px solid #fbbf24;
            border-radius: 4px;
            padding: 4px;
            margin-top: 4px;
        }
        .manual-edit-header {
            font-weight: bold;
        }
        .manual-edit-header::before {
            content: '✏️ ';
            margin-left: 4px;
        }
        .manual-edit-row {
            font-size: 0.7rem;
            color: #1e293b;
            font-weight: bold;
        }
        .signature-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 5px;
            padding-top: 5px;
            border-top: 1px solid #ddd;
            min-height: 45px;
        }
        .company-seal {
            text-align: left;
            flex: 1;
        }
        .company-seal-label {
            font-size: 8px;
            text-align: right;
  width: 100%;

            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 3px;
        }
        .company-seal-space {
            width: 100px;
            height: 35px;
            
            margin-top: 3px;
        }
        .customer-signature {
            text-align: right;
            flex: 1;
        }
        .customer-signature-label {
            font-size: 8px;
              text-align: left;
  width: 100%;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 3px;
        }
        .customer-signature-space {
            
               text-align: left;
  
            height: 35px;
            
            margin-top: 3px;
            margin-left: 0;
        }
        .thank-you-text {
            text-align: center;
            margin-top: 5px;
            font-size: 9px;
            font-weight: bold;
            color: #2c3e50;
            padding: 3px 0;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
        }
        .footer {
            margin-top: 3px;
            padding-top: 2px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            color: #666;
            line-height: 1.3;
        }
        .footer p {
            font-size: 11px;
            font-weight: bold;
            color: #666;
            line-height: 1.3;
        }
        .back-page-notice {
            page-break-before: always;
            width: 100%;
            max-width: 200mm;
            margin: 10mm auto;
            background: white;
            padding: 20mm;
            box-sizing: border-box;
            border: 2px solid #dc2626;
            border-radius: 5px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            min-height: 250mm;
        
        }
        .back-page-notice h3 {
            font-size: 18px;
            color: #dc2626;
            // margin-bottom: 20px;
            font-weight: bold;
            text-align: center;
            margin-top: 100mm;
        }
        .back-page-notice-content {
            font-size: 14px;
            line-height: 2;
            color: #333;
            text-align: right;
            direction: rtl;
            max-width: 160mm;
            width: 100%;
            margin-top: 10mm;
            
        }
        .back-page-notice-content p {
            margin-bottom: 15px;
            text-align: right;
        
        }
        @media print {
            .back-page-notice {
                page-break-before: always !important;
                page-break-inside: avoid;
            }
        }
        .cut-line {
            margin: 0;
            padding: 0;
            text-align: left;
            border-top: 1px dashed #666;
            border-bottom: none;
            position: relative;
            height: 1px;
            overflow: visible;
        }
        .cut-line::before {
            content: '✂️';
            position: absolute;
            left: 0;
            top: -8px;
            background: white;
            padding-right: 5px;
            font-size: 12px;
        }
        .status-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: nowrap;
            flex-shrink: 1;
        }
        .status-checkbox {
            display: flex;
            gap: 6px;
            align-items: center;
            flex-wrap: nowrap;
            flex-shrink: 1;
        }
        .status-item {
            display: flex;
            align-items: center;
            gap: 2px;
            font-size: 9px;
            white-space: nowrap;
            flex-shrink: 1;
        }
        .status-item label {
            font-size: 9px;
        }
        .status-checkbox input[type="checkbox"] {
            width: 11px;
            height: 11px;
            cursor: pointer;
            flex-shrink: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        @media print {
            .status-checkbox input[type="checkbox"] {
                -webkit-appearance: none;
                appearance: none;
                border: 2px solid #2c3e50;
                border-radius: 2px;
                position: relative;
            }
            .status-checkbox input[type="checkbox"]:checked::before {
                content: '✓';
                position: absolute;
                top: -3px;
                left: 0px;
                color: #2c3e50;
                font-weight: bold;
                font-size: 9px;
            }
        }
        .watermark {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            pointer-events: none;
            overflow: visible;
        }
        .watermark-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            font-weight: bold;
            color: rgba(44, 62, 80, 0.1);
            white-space: nowrap;
            text-align: center;
            line-height: 1.4;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .watermark-text::before {
            content: 'شركة أسيل';
            display: block;
        }
    </style>
      </head>
      <body>
      <div class="invoices-wrapper ${shouldSplitPages ? 'split-pages' : 'single-page'}">
      <!-- فاتورة مبيعات الشركة (نسخة) -->
      <div class="invoice-container">
        <div class="watermark">
            <div class="watermark-text"></div>
        </div>
        <div class="invoice-type company-copy">نسخة - COPY</div>
        
            <div class="header">
                <div class="company-info" style="display: flex; align-items: center; gap: 8px;">
                <img src="${logoPath}" alt="Logo" class="company-logo" />
                <div>
                <div class="company-name">${companySettings.name || 'شركة أسيل'}</div>
                <div class="company-details">
                    ${companySettings.address ? `<p><strong>العنوان:</strong> <strong>${companySettings.address}</strong></p>` : ''}
                    <p><strong>${companySettings.phone ? `هاتف: ${companySettings.phone}` : ''}${companySettings.phone && companySettings.mobile ? ' | ' : ''}${companySettings.mobile ? `المحمول: ${companySettings.mobile}` : ''}${(companySettings.phone || companySettings.mobile) && companySettings.email ? ' | ' : ''}${companySettings.email ? `البريد: ${companySettings.email}` : ''}</strong></p>
                    ${companySettings.register || companySettings.tax ? `<p><strong>${companySettings.register ? `السجل التجاري: ${companySettings.register}` : ''}${companySettings.register && companySettings.tax ? ' | ' : ''}${companySettings.tax ? `الرقم الضريبي: ${companySettings.tax}` : ''}</strong></p>` : ''}
                </div>
                </div>
            </div>
            <div class="invoice-title">
                <h1>فاتورة مبيعات</h1>
                <p class="invoice-number">رقم: ${invoice.invoiceNumber}</p>
                <p class="invoice-number" style="font-size: 10px;font-weight: bold;">التاريخ: ${formatDate(invoice.date)}</p>
                ${invoice.deliveryNoteNumber ? `<p class="invoice-number" style="font-size: 10px;font-weight: bold;">رقم إذن الصرف: ${invoice.deliveryNoteNumber}</p>` : ''}
                </div>
                </div>

        <div class="info-section">
            <div class="info-box">
                <h3>بيانات العميل</h3>
                <p><strong> الاسم:</strong> <strong> <span style="font-size: 15px;font-weight: bold;">${customer ? customer.name : 'غير محدد'}</span></strong></p>
                ${customer && customer.phone ? `<p><strong>الهاتف:</strong> <strong>${customer.phone}</strong></p>` : ''}
                ${customer && customer.address ? `<p><strong>العنوان:</strong> <strong>${customer.address}</strong></p>` : ''}
            </div>
            <div class="info-box">
                <h3>تفاصيل الدفع</h3>
                <p class="status-row"><strong>طريقة الدفع:</strong>
                    <span class="status-checkbox">
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>نقدي</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>تحويل بنكي</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>شيك</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>محفظة إلكترونية</label>
                        </span>
                    </span>
                </p>
                ${invoice.dueDate ? `<p><strong>تاريخ الاستحقاق:</strong> ${formatDate(invoice.dueDate)}</p>` : ''}
                ${invoice.deliveryNoteNumber ? `<p><strong>رقم إذن الصرف:</strong> <strong>${invoice.deliveryNoteNumber}</strong></p>` : ''}
                <p class="status-row"><strong>الحالة:</strong>
                    <span class="status-checkbox">
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>اجله</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>مدفوعه</label>
                        </span>
                    </span>
                </p>
            </div>
        </div>

        <div class="tables-container">
        <table class="items-table">
                <thead>
                    <tr>
                    <th>م</th>
                    <th>الصنف</th>
                        <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>المجموع</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.products.map((product, index) => `
                    <tr>
                        <td>${toPersianNumerals(index + 1)}</td>
                    <td>${product.productName}${product.category ? ` - ${product.category}` : ''}${product.productCode ? ` (${product.productCode})` : ''}</td>
                    <td>${formatQuantity(product.quantityInSmallestUnit || product.quantity || 0)} ${product.smallestUnit || product.unitName || ''}</td>
                    <td>${formatCurrency(product.price)} ج.م</td>
                    <td>${formatCurrency(product.total)} ج.م</td>
                </tr>
                `).join('')}
                <!-- سطور فارغة للتعديل اليدوي -->
                ${Array(8).fill(0).map(() => `
                <tr class="empty-row">
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

        <div class="total-section">
            <div class="total-box">
                <div class="total-row">
                    <span>المجموع الفرعي:</span>
                    <span>${formatCurrency(invoice.subtotal)} ج.م</span>
                </div>
                    ${invoice.taxAmount > 0 ? `
                <div class="total-row">
                    <span>ضريبة القيمة المضافة (${toPersianNumerals(invoice.taxRate || 0)}%):</span>
                    <span>${formatCurrency(invoice.taxAmount)} ج.م</span>
                </div>
                    ` : ''}
                    ${invoice.shipping > 0 ? `
                <div class="total-row">
                    <span>الشحن والتوصيل:</span>
                    <span>${formatCurrency(invoice.shipping)} ج.م</span>
                </div>
                    ` : ''}
                    ${invoice.discount > 0 ? `
                <div class="total-row">
                    <span>الخصم:</span>
                    <span>- ${formatCurrency(invoice.discount)} ج.م</span>
                </div>
                    ` : ''}
                <div class="total-row grand-total highlighted">
                    <span>الإجمالي:</span>
                    <span>${formatCurrency(invoice.total)} ج.م</span>
            </div>
                    ${customer ? `
                <div class="total-row old-balance">
                    <span>الرصيد القديم:</span>
                    <span>${formatCurrency(oldBalance)} ج.م</span>
            </div>
                <div class="total-row">
                    <span>الرصيد القديم + الإجمالي:</span>
                    <span>${formatCurrency(oldBalance + invoice.total)} ج.م</span>
            </div>
                <div class="total-row">
                    <span>المدفوع من العميل:</span>
                    <span>${formatCurrency(invoice.total - (invoice.remaining || 0))} ج.م</span>
                </div>
                <div class="total-row new-balance">
                    <span>الرصيد الجديد:</span>
                    <span>${formatCurrency(newBalance)} ج.م</span>
                </div>
                ` : ''}
                <!-- صفوف فارغة للتعديل -->
                <div class="manual-edit-section-wrapper">
                <div class="total-row empty-row">
                    <span class="manual-edit-header">في حالة التعديل في الفاتورة:</span>
                    <span></span>
                </div>
                <div class="total-row empty-row manual-edit-row">
                    <span>إجمالي الفاتورة:</span>
                    <span> ج.م</span>
                </div>
                <div class="total-row empty-row manual-edit-row">
                    <span>الرصيد القديم:</span>
                    <span>${customer ? formatCurrency(oldBalance) + ' ج.م' : ' ج.م'}</span>
                </div>
                <div class="total-row empty-row">
                    <span>مجموع القديم والفاتورة:</span>
                    <span> ج.م</span>
                </div>
                <div class="total-row empty-row">
                    <span>المدفوع من العميل:</span>
                    <span> ج.م</span>
                </div>
                <div class="total-row empty-row manual-edit-row remaining-balance">
                    <span>الرصيد المتبقي الجديد:</span>
                    <span> ج.م</span>
                </div>
                </div>
                <div class="total-row empty-row">
                    <span></span>
                    <span></span>
                </div>
            </div>
            </div>
        </div>
        
        <div class="signature-section">
            <div class="company-seal">
                <div class="company-seal-label">ختم الشركة</div>
                <div class="company-seal-space"></div>
                ${companySettings.salesRepName || companySettings.salesRepPhone ? `
                <div style="margin-top: 5px; font-size: 7px; color: #2c3e50;">
                    <strong>المندوب:</strong> ${companySettings.salesRepName || ''}${companySettings.salesRepName && companySettings.salesRepPhone ? ' - ' : ''}${companySettings.salesRepPhone || ''}
                </div>
                ` : ''}
                ${companySettings.accountantName || companySettings.accountantPhone ? `
                <div style="margin-top: 3px; font-size: 7px; color: #2c3e50;">
                    <strong>المحاسب:</strong> ${companySettings.accountantName || ''}${companySettings.accountantName && companySettings.accountantPhone ? ' - ' : ''}${companySettings.accountantPhone || ''}
                </div>
                ` : ''}
            </div>
            <div class="customer-signature">
                <div class="customer-signature-label">توقيع المستلم</div>
                <div class="customer-signature-space"></div>
            </div>
        </div>
        
        

        <div class="footer">
            ${companySettings.commitmentText ? `<p><strong>${companySettings.commitmentText}</strong></p>` : '<span style="font-size: 10px;font-weight: bold; align-items: center; text-align: center;">أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.</span>'}
                    </div>

            </div>

        <div class="cut-line"></div>

    <!-- فاتورة العميل (الأصل) -->
    <div class="invoice-container">
        <div class="watermark">
            <div class="watermark-text"></div>
        </div>
        <div class="invoice-type">أصل الفاتورة - ORIGINAL</div>
        
            <div class="header">
                <div class="company-info" style="display: flex; align-items: center; gap: 8px;">
                <img src="${logoPath}" alt="Logo" class="company-logo" />
                <div>
                <div class="company-name">${companySettings.name || 'شركة أسيل'}</div>
                <div class="company-details">
                    ${companySettings.address ? `<p><strong>العنوان:</strong> <strong>${companySettings.address}</strong></p>` : ''}
                    <p><strong>${companySettings.phone ? `هاتف: ${companySettings.phone}` : ''}${companySettings.phone && companySettings.mobile ? ' | ' : ''}${companySettings.mobile ? `المحمول: ${companySettings.mobile}` : ''}${(companySettings.phone || companySettings.mobile) && companySettings.email ? ' | ' : ''}${companySettings.email ? `البريد: ${companySettings.email}` : ''}</strong></p>
                    ${companySettings.register || companySettings.tax ? `<p><strong>${companySettings.register ? `السجل التجاري: ${companySettings.register}` : ''}${companySettings.register && companySettings.tax ? ' | ' : ''}${companySettings.tax ? `الرقم الضريبي: ${companySettings.tax}` : ''}</strong></p>` : ''}
                </div>
                </div>
            </div>
            <div class="invoice-title">
                <h1>فاتورة مبيعات</h1>
                <p class="invoice-number">رقم: ${invoice.invoiceNumber}</p>
                <p class="invoice-number" style="font-size: 10px;font-weight: bold;">التاريخ: ${formatDate(invoice.date)}</p>
                ${invoice.deliveryNoteNumber ? `<p class="invoice-number" style="font-size: 10px;font-weight: bold;">رقم إذن الصرف: ${invoice.deliveryNoteNumber}</p>` : ''}
                </div>
                </div>

        <div class="info-section">
            <div class="info-box">
                <h3>بيانات العميل</h3>
                <p><strong>الاسم:</strong> <strong> <span style="font-size: 15px;font-weight: bold;">${customer ? customer.name : 'غير محدد'}</span></strong></p>
                ${customer && customer.phone ? `<p><strong>الهاتف:</strong> <strong>${customer.phone}</strong></p>` : ''}
                ${customer && customer.address ? `<p><strong>العنوان:</strong> <strong>${customer.address}</strong></p>` : ''}
            </div>
            <div class="info-box">
                <h3>تفاصيل الدفع</h3>
                <p class="status-row"><strong>طريقة الدفع:</strong>
                    <span class="status-checkbox">
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>نقدي</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>تحويل بنكي</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>شيك</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>محفظة إلكترونية</label>
                        </span>
                    </span>
                </p>
                ${invoice.dueDate ? `<p><strong>تاريخ الاستحقاق:</strong> ${formatDate(invoice.dueDate)}</p>` : ''}
                ${invoice.deliveryNoteNumber ? `<p><strong>رقم إذن الصرف:</strong> <strong>${invoice.deliveryNoteNumber}</strong></p>` : ''}
                <p class="status-row"><strong>الحالة:</strong>
                    <span class="status-checkbox">
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>اجله</label>
                        </span>
                        <span class="status-item">
                            <input type="checkbox" disabled>
                            <label>مدفوعه</label>
                        </span>
                    </span>
                </p>
            </div>
        </div>

        <div class="tables-container">
        <table class="items-table">
                <thead>
                    <tr>
                    <th>م</th>
                    <th>الصنف</th>
                        <th>الكمية</th>
                        <th>سعر الوحدة</th>
                    <th>المجموع</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.products.map((product, index) => `
                    <tr>
                        <td>${toPersianNumerals(index + 1)}</td>
                    <td>${product.productName}${product.category ? ` - ${product.category}` : ''}${product.productCode ? ` (${product.productCode})` : ''}</td>
                    <td>${formatQuantity(product.quantityInSmallestUnit || product.quantity || 0)} ${product.smallestUnit || product.unitName || ''}</td>
                    <td>${formatCurrency(product.price)} ج.م</td>
                    <td>${formatCurrency(product.total)} ج.م</td>
                </tr>
                `).join('')}
                <!-- سطور فارغة للتعديل اليدوي -->
                ${Array(8).fill(0).map(() => `
                <tr class="empty-row">
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

        <div class="total-section">
            <div class="total-box">
                <div class="total-row">
                    <span>المجموع الفرعي:</span>
                    <span>${formatCurrency(invoice.subtotal)} ج.م</span>
                </div>
                ${invoice.taxAmount > 0 ? `
                <div class="total-row">
                    <span>ضريبة القيمة المضافة (${toPersianNumerals(invoice.taxRate || 0)}%):</span>
                    <span>${formatCurrency(invoice.taxAmount)} ج.م</span>
                </div>
                    ` : ''}
                ${invoice.shipping > 0 ? `
                <div class="total-row">
                    <span>الشحن والتوصيل:</span>
                    <span>${formatCurrency(invoice.shipping)} ج.م</span>
                </div>
                    ` : ''}
                    ${invoice.discount > 0 ? `
                <div class="total-row">
                    <span>الخصم:</span>
                    <span>- ${formatCurrency(invoice.discount)} ج.م</span>
            </div>
                    ` : ''}
                <div class="total-row grand-total highlighted">
                    <span>الإجمالي:</span>
                    <span>${formatCurrency(invoice.total)} ج.م</span>
            </div>
                    ${customer ? `
                <div class="total-row">
                    <span>الرصيد القديم:</span>
                    <span>${formatCurrency(oldBalance)} ج.م</span>
                </div>
                <div class="total-row">
                    <span>الرصيد القديم + الإجمالي:</span>
                    <span>${formatCurrency(oldBalance + invoice.total)} ج.م</span>
                </div>
                <div class="total-row">
                    <span>المدفوع من العميل:</span>
                    <span>${formatCurrency(invoice.total - (invoice.remaining || 0))} ج.م</span>
            </div>
                <div class="total-row new-balance">
                    <span>الرصيد الجديد:</span>
                    <span>${formatCurrency(newBalance)} ج.م</span>
                </div>
                ` : ''}
                <!-- صفوف فارغة للتعديل -->
                <div class="manual-edit-section-wrapper">
                <div class="total-row empty-row">
                    <span class="manual-edit-header">في حالة التعديل في الفاتورة:</span>
                    <span></span>
                </div>
                <div class="total-row empty-row manual-edit-row">
                    <span>إجمالي الفاتورة:</span>
                    <span> ج.م</span>
                </div>
                <div class="total-row empty-row manual-edit-row">
                    <span>الرصيد القديم:</span>
                    <span>${customer ? formatCurrency(oldBalance) + ' ج.م' : ' ج.م'}</span>
                </div>
                <div class="total-row empty-row">
                    <span>مجموع القديم والفاتورة:</span>
                    <span> ج.م</span>
                </div>
                <div class="total-row empty-row">
                    <span>المدفوع من العميل:</span>
                    <span> ج.م</span>
                </div>
                <div class="total-row empty-row manual-edit-row remaining-balance">
                    <span>الرصيد المتبقي الجديد:</span>
                    <span> ج.م</span>
                </div>
                </div>
                  
                    
                    <span style="font-size: 8px;font-weight: bold; align-items: center; text-align: center;">نرجو مراجعة الفاتورة قبل مغادرة المندوب</span>
                
              
                </div>
            </div>
        </div>
        
        <div class="signature-section">
            <div class="company-seal">
                <div class="company-seal-label" >ختم الشركة</div>
                <div class="company-seal-space"></div>
                ${companySettings.salesRepName || companySettings.salesRepPhone ? `
                <div style="margin-top: 5px; font-size: 7px; color: #2c3e50;">
                    <strong>المندوب:</strong> ${companySettings.salesRepName || ''}${companySettings.salesRepName && companySettings.salesRepPhone ? ' - ' : ''}${companySettings.salesRepPhone || ''}
                </div>
                ` : ''}
                ${companySettings.accountantName || companySettings.accountantPhone ? `
                <div style="margin-top: 3px; font-size: 7px; color: #2c3e50;">
                    <strong>المحاسب:</strong> ${companySettings.accountantName || ''}${companySettings.accountantName && companySettings.accountantPhone ? ' - ' : ''}${companySettings.accountantPhone || ''}
                </div>
                ` : ''}
            </div>
            <div class="customer-signature">
                <div class="customer-signature-label">توقيع المستلم</div>
                <div class="customer-signature-space"></div>
            </div>
        </div>
        
        

        <div class="footer">
            ${companySettings.commitmentText ? `<p><strong>${companySettings.commitmentText}</strong></p>` : '<span style="font-size: 10px;font-weight: bold; align-items: center; text-align: center;">أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.</span>'}
                    </div>
                    <div class="thank-you-text">نشكركم على تعاملكم مع شركة أسيل</div>
    </div>
    </div>
    
    ${shouldShowWarning ? `
    <div class="back-page-notice">
        <h3>⚠️ تنويه</h3>
        <div class="back-page-notice-content">
            <p><strong>نُلفت عنايتكم إلى أن الرصيد المستحق (الآجل) — باستثناء الفاتورة الحالية — قد تجاوز الحد الائتماني المسموح به (10,000 ج.م)، ولم يتم السداد حتى تاريخه.</strong></p>
            <p><strong>نرجو من سيادتكم تسوية الفاتورة الحالية بالكامل، والعمل على تنظيم سداد المبالغ المتأخرة حفاظًا على استمرار التعاون وضمان تقديم أفضل الخدمات لكم.</strong></p>
            <p><strong>شاكرين تفهمكم وتعاونكم الدائم.</strong></p>
            <p style="font-size: 11px;font-weight: bold; color: #666; line-height: 1.3;"><strong>ادارة الشركة</strong></p>
        </div>
    </div>
    ` : ''}
</body>
</html>
    `;
        
        return printContent;
    } catch (error) {
        console.error('Error in generatePrintContent:', error);
        return '<html><body><h1>خطأ في إنشاء محتوى الطباعة</h1><p>' + error.message + '</p></body></html>';
    }
}

// Close Modal
function closeModal() {
    document.getElementById('invoiceModal').classList.remove('active');
    currentInvoice = null;
    invoiceProducts = [];
    selectedDeliveryNote = null;
    
    // Reset delivery note search
    const deliveryNoteSearch = document.getElementById('deliveryNoteSearch');
    const deliveryNoteSelect = document.getElementById('deliveryNoteSelect');
    if (deliveryNoteSearch) {
        deliveryNoteSearch.disabled = false;
        deliveryNoteSearch.value = '';
    }
    if (deliveryNoteSelect) {
        deliveryNoteSelect.value = '';
    }
    
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

// Custom Confirmation Dialog (replaces confirm() to avoid Electron focus issues)
function showConfirmDialog(message, onConfirm, onCancel) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '10001';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '450px';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
        <h2 style="margin: 0; font-size: 1.25rem;">تأكيد الحذف</h2>
        <button class="modal-close">&times;</button>
    `;
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.padding = '24px';
    
    const messageP = document.createElement('p');
    messageP.style.margin = '0 0 24px 0';
    messageP.style.fontSize = '1rem';
    messageP.style.color = 'var(--text-primary)';
    messageP.style.lineHeight = '1.6';
    messageP.textContent = message;
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.display = 'flex';
    buttonsDiv.style.gap = '12px';
    buttonsDiv.style.justifyContent = 'flex-end';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.style.minWidth = '100px';
    cancelBtn.textContent = 'إلغاء';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.style.minWidth = '100px';
    confirmBtn.textContent = 'حذف';
    
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(confirmBtn);
    
    modalBody.appendChild(messageP);
    modalBody.appendChild(buttonsDiv);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    
    document.body.appendChild(modal);
    
    // Close button handler
    const closeBtn = modalHeader.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
    
    // Cancel button handler
    cancelBtn.addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
    
    // Confirm button handler
    confirmBtn.addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });
    
    // Focus on confirm button
    setTimeout(() => {
        confirmBtn.focus();
    }, 100);
}

// Delete Invoice
async function deleteInvoice(invoiceId) {
    console.log('🗑️ deleteInvoice called with invoiceId:', invoiceId);
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذه الفاتورة؟\n\nسيتم حذف الفاتورة نهائياً وإعادة المخزون للمنتجات.',
        () => {
            // User confirmed - proceed with deletion
            console.log('✅ User confirmed deletion');
            proceedWithInvoiceDeletion(invoiceId);
        },
        () => {
            // User cancelled - do nothing
            console.log('❌ User cancelled deletion');
        }
    );
}

// Proceed with invoice deletion
async function proceedWithInvoiceDeletion(invoiceId) {
    try {
        // Find invoice
        let invoice = invoices.find(inv => inv.id === invoiceId);
        
        // If not found, load from database
        if (!invoice && window.electronAPI && window.electronAPI.dbGet) {
            invoice = await window.electronAPI.dbGet('sales_invoices', invoiceId);
            if (!invoice) {
                showMessage('الفاتورة غير موجودة', 'error');
                return;
            }
            
            // Load invoice items
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            invoice.products = [];
            for (const item of invoiceItems) {
                // Get product to calculate conversion factor
                const product = await window.electronAPI.dbGet('products', item.productId);
                let quantityInSmallestUnit = item.quantity || 0;
                
                // If unit was largest, convert to smallest
                if (item.unit === 'largest' && product) {
                    const conversionFactor = product.conversionFactor || 1;
                    quantityInSmallestUnit = item.quantity * conversionFactor;
                }
                
                invoice.products.push({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    quantityInSmallestUnit: quantityInSmallestUnit
                });
            }
        }
        
        if (!invoice) {
            showMessage('الفاتورة غير موجودة', 'error');
            return;
        }
        
        console.log('[Sales] Deleting invoice:', invoiceId);
        
        // Restore quantities to delivery note (if invoice is linked to a delivery note)
        if (invoice.deliveryNoteId && invoice.products && invoice.products.length > 0) {
            console.log('[Sales] Restoring quantities to delivery note:', invoice.deliveryNoteId);
            for (const invoiceProduct of invoice.products) {
                // Find the delivery note item
                if (window.electronAPI && window.electronAPI.dbGetAll) {
                    const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 
                        'deliveryNoteId = ? AND productId = ? AND unit = ?', 
                        [invoice.deliveryNoteId, invoiceProduct.productId, invoiceProduct.unit]);
                    
                    if (noteItems && noteItems.length > 0) {
                        const noteItem = noteItems[0];
                        const currentReserved = noteItem.reservedQuantity || 0;
                        const currentAvailable = noteItem.availableQuantity || 0;
                        
                        // Restore: subtract from reserved, add to available
                        const newReserved = Math.max(0, currentReserved - invoiceProduct.quantity);
                        const newAvailable = currentAvailable + invoiceProduct.quantity;
                        
                        // Update delivery note item
                        const updateData = {
                            id: noteItem.id,
                            deliveryNoteId: noteItem.deliveryNoteId,
                            productId: noteItem.productId,
                            productName: noteItem.productName,
                            productCode: noteItem.productCode || '',
                            quantity: noteItem.quantity,
                            unit: noteItem.unit,
                            unitName: noteItem.unitName || '',
                            reservedQuantity: newReserved,
                            availableQuantity: newAvailable
                        };
                        
                        if (window.electronAPI.dbUpdate) {
                            await window.electronAPI.dbUpdate('delivery_note_items', noteItem.id, updateData);
                            console.log(`[Sales] Restored product ${invoiceProduct.productName} to delivery note: reserved ${currentReserved} -> ${newReserved}, available ${currentAvailable} -> ${newAvailable}`);
                        }
                    }
                }
            }
        } else if (invoice.products && invoice.products.length > 0) {
            // If invoice is not linked to a delivery note, restore stock directly
            console.log('[Sales] Invoice not linked to delivery note, restoring stock directly...');
            for (const invoiceProduct of invoice.products) {
                // Get product from database
                let product = null;
                if (window.electronAPI && window.electronAPI.dbGet) {
                    product = await window.electronAPI.dbGet('products', invoiceProduct.productId);
                }
                
                if (product) {
                    // Calculate quantity to add back in smallest unit
                    let quantityToAdd = invoiceProduct.quantityInSmallestUnit || invoiceProduct.quantity;
                    
                    // If unit is largest, convert to smallest
                    if (invoiceProduct.unit === 'largest') {
                        const conversionFactor = product.conversionFactor || 1;
                        quantityToAdd = invoiceProduct.quantity * conversionFactor;
                    }
                    
                    // Restore stock
                    const currentStock = parseFloat(product.stock) || 0;
                    const newStock = currentStock + quantityToAdd;
                    
                    product.stock = newStock;
                    product.updatedAt = new Date().toISOString();
                    
                    // Update product in database
                    if (window.electronAPI && window.electronAPI.dbUpdate) {
                        await window.electronAPI.dbUpdate('products', product.id, product);
                        console.log(`[Sales] Restored product ${product.name} stock: ${currentStock} -> ${newStock} (+${quantityToAdd})`);
                    }
                    
                    // Update in local array too
                    const localProduct = products.find(p => p.id === product.id);
                    if (localProduct) {
                        localProduct.stock = newStock;
                    }
                }
            }
        }
        
        // Recalculate customer balance if invoice was delivered (restore balance to customer)
        if (invoice.status === 'delivered' && invoice.customerId) {
            console.log('[Sales] Recalculating customer balance after invoice deletion...');
            await recalculateCustomerBalance(invoice.customerId);
        }
        
        // Delete invoice items from database first (foreign key constraint)
        if (window.electronAPI && window.electronAPI.dbQuery) {
            await window.electronAPI.dbQuery('DELETE FROM sales_invoice_items WHERE invoiceId = ?', [invoiceId]);
        } else if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
            const invoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', 'invoiceId = ?', [invoiceId]);
            for (const item of invoiceItems) {
                await window.electronAPI.dbDelete('sales_invoice_items', item.id);
            }
        }
        
        // Delete invoice from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('sales_invoices', invoiceId);
        }
        
        // Remove from local array
        invoices = invoices.filter(inv => inv.id !== invoiceId);
        
        // Save to localStorage
        await saveInvoices();
        
        // Re-apply filters and render
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
        console.error('[Sales] Error deleting invoice:', error);
        showMessage('خطأ في حذف الفاتورة: ' + error.message, 'error');
    }
}

// Make functions global
window.removeProduct = removeProduct;
window.viewInvoice = viewInvoice;
window.editInvoice = editInvoice;
window.printInvoiceById = printInvoiceById;
window.deleteInvoice = deleteInvoice;

