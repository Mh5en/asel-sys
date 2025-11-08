// Customers Management System

// Storage Keys
const STORAGE_KEYS = {
    CUSTOMERS: 'asel_customers',
    CUSTOMER_COUNTER: 'asel_customer_counter',
    SALES_INVOICES: 'asel_sales_invoices',
    PAYMENT_RECEIPTS: 'asel_payment_receipts'
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

// Format phone number with Arabic numerals
function formatArabicPhone(phone) {
    if (!phone || phone === '-') return phone || '-';
    // Remove any non-digit characters except + and spaces
    const cleaned = phone.replace(/[^\d+\s]/g, '');
    // Convert digits to Arabic numerals
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return cleaned.replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
}

// Initialize
let customers = [];
let invoices = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredCustomers = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    applyFilters();
    await checkInactiveCustomers();
    
    // Check inactive customers every hour
    setInterval(async () => {
        await checkInactiveCustomers();
    }, 3600000); // 1 hour
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Add Customer Button
    document.getElementById('addCustomerBtn').addEventListener('click', async () => {
        await openAddModal();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('addCustomerBtn').click();
        });
    }

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('customerForm').addEventListener('submit', handleFormSubmit);

    // Search and Filters
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('statusFilter').addEventListener('change', () => {
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
        const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });

    // Close modal on backdrop click
    document.getElementById('customerModal').addEventListener('click', (e) => {
        if (e.target.id === 'customerModal') {
            closeModal();
        }
    });

    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') {
            closeDetailsModal();
        }
    });
}

// Load Data from Database
async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            customers = await window.electronAPI.dbGetAll('customers', '', []);
            invoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
            
            // Ensure arrays
            customers = Array.isArray(customers) ? customers : [];
            invoices = Array.isArray(invoices) ? invoices : [];
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage (for migration only)
    const customersData = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const invoicesData = localStorage.getItem(STORAGE_KEYS.SALES_INVOICES);
    
    customers = customersData ? JSON.parse(customersData) : [];
    invoices = invoicesData ? JSON.parse(invoicesData) : [];
}

// Recalculate all customer balances from invoices
async function recalculateAllCustomerBalances() {
    for (const customer of customers) {
        await recalculateCustomerBalanceFromInvoices(customer.id);
    }
    await saveCustomers();
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

// Recalculate customer balance from invoices
async function recalculateCustomerBalanceFromInvoices(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    try {
        // Get all delivered invoices for this customer from database
        let customerInvoices = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            customerInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'customerId = ? AND status = ?', [customerId, 'delivered']);
        } else {
            // Fallback to local array
            customerInvoices = invoices.filter(inv => 
                inv.customerId === customerId && inv.status === 'delivered'
            );
        }
        
        // Calculate: sum of all remaining amounts from delivered invoices
        let totalRemaining = 0;
        customerInvoices.forEach(invoice => {
            totalRemaining += invoice.remaining || 0;
        });
        
        // Balance = opening balance + total remaining from all delivered invoices
        const balance = (customer.openingBalance || 0) + totalRemaining;
        customer.balance = balance;
        
        // Update last transaction date
        if (customerInvoices.length > 0) {
            const latestInvoice = customerInvoices.sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            )[0];
            customer.lastTransactionDate = latestInvoice.date;
        }
        
        // Update first transaction date
        await updateCustomerFirstTransactionDate(customerId);
        
        // Update customer in database
        if (window.electronAPI && window.electronAPI.dbUpdate) {
            await window.electronAPI.dbUpdate('customers', customerId, customer);
        }
    } catch (error) {
        console.error('Error recalculating customer balance:', error);
    }
}

// Save Data to Database
async function saveCustomers() {
    // Save to localStorage as backup only
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    
    // Customers are saved individually in handleFormSubmit
    // This function is kept for backward compatibility
}

// Generate Customer Code
async function generateCustomerCode() {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all customers to find highest counter
            const allCustomers = await window.electronAPI.dbGetAll('customers', '', []);
            const codes = allCustomers.map(c => c.code).filter(code => code && code.startsWith('CUST-'));
            const numbers = codes.map(code => {
                const match = code.match(/CUST-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            });
            const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
            const counter = maxNumber + 1;
            
            // Format: CUST-00001
            return `CUST-${String(counter).padStart(5, '0')}`;
        } catch (error) {
            console.error('Error generating customer code:', error);
        }
    }
    
    // Fallback to localStorage
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.CUSTOMER_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_COUNTER, counter.toString());
    
    // Format: CUST-00001
    return `CUST-${String(counter).padStart(5, '0')}`;
}

// Open Add Modal
async function openAddModal() {
    const modal = document.getElementById('customerModal');
    const form = document.getElementById('customerForm');
    const title = document.getElementById('modalTitle');
    const openingBalanceRow = document.getElementById('openingBalanceRow');

    // Reset form
    form.reset();
    document.getElementById('isEdit').value = 'false';
    document.getElementById('customerId').value = '';
    title.textContent = 'إضافة عميل جديد';
    
    // Generate customer code
    const code = await generateCustomerCode();
    document.getElementById('customerCode').value = code;
    
    // Show opening balance field for new customers
    openingBalanceRow.style.display = 'flex';
    document.getElementById('openingBalance').disabled = false;
    document.getElementById('currentBalance').value = '';
    
    // Set first transaction date to today
    const today = new Date().toISOString().split('T')[0];
    
    // Show modal
    modal.classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        const customerNameInput = document.getElementById('customerName');
        if (customerNameInput) {
            setTimeout(() => {
                customerNameInput.focus();
            }, 50);
        }
    }, 100);
}

// Open Edit Modal
function openEditModal(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const modal = document.getElementById('customerModal');
    const form = document.getElementById('customerForm');
    const title = document.getElementById('modalTitle');
    const openingBalanceRow = document.getElementById('openingBalanceRow');

    // Fill form with customer data
    document.getElementById('customerId').value = customer.id;
    document.getElementById('isEdit').value = 'true';
    document.getElementById('customerCode').value = customer.code;
    document.getElementById('customerName').value = customer.name;
    document.getElementById('phone').value = customer.phone || '';
    document.getElementById('address').value = customer.address || '';
    document.getElementById('currentBalance').value = customer.balance || 0;
    document.getElementById('status').value = customer.status || 'active';
    document.getElementById('notes').value = customer.notes || '';

    // Hide opening balance for existing customers
    openingBalanceRow.style.display = 'none';
    document.getElementById('openingBalance').value = '';
    
    title.textContent = 'تعديل العميل';
    
    // Show modal
    modal.classList.add('active');
}

// Close Modal
function closeModal() {
    document.getElementById('customerModal').classList.remove('active');
    // Ensure focus is restored after closing modal
    setTimeout(() => {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
            activeElement.blur();
        }
        // Force focus on window to restore input capabilities
        window.focus();
    }, 100);
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();

    const isEdit = document.getElementById('isEdit').value === 'true';
    const customerId = document.getElementById('customerId').value;

    const customerData = {
        code: document.getElementById('customerCode').value,
        name: document.getElementById('customerName').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        status: document.getElementById('status').value || 'active',
        notes: document.getElementById('notes').value.trim() || null,
        lastTransactionDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Validate name is not empty
    if (!customerData.name) {
        showMessage('يرجى إدخال اسم العميل', 'error');
        return;
    }

    try {
        // Check for duplicate name (case-insensitive)
        // Check in local array first
        const duplicateCustomer = customers.find(c => 
            c.name.toLowerCase().trim() === customerData.name.toLowerCase().trim() && 
            c.id !== customerId
        );
        
        if (duplicateCustomer) {
            showMessage('يوجد عميل آخر بنفس الاسم. يرجى اختيار اسم مختلف', 'error');
            return;
        }
        
        // Also check in database to ensure no duplicates
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            try {
                const allCustomers = await window.electronAPI.dbGetAll('customers', '', []);
                const dbDuplicate = Array.isArray(allCustomers) ? allCustomers.find(c => 
                    c && c.id !== customerId && 
                    c.name && c.name.toLowerCase().trim() === customerData.name.toLowerCase().trim()
                ) : null;
                if (dbDuplicate) {
                    showMessage('يوجد عميل آخر بنفس الاسم. يرجى اختيار اسم مختلف', 'error');
                    return;
                }
            } catch (dbErr) {
                console.error('Error checking database for duplicate customer:', dbErr);
                // Continue with local check only if database check fails
            }
        }

        if (isEdit) {
            // Edit existing customer
            const existingCustomer = customers.find(c => c.id === customerId);
            if (!existingCustomer) {
                showMessage('العميل غير موجود', 'error');
                return;
            }
            
            customerData.id = existingCustomer.id;
            customerData.openingBalance = existingCustomer.openingBalance || 0;
            customerData.firstTransactionDate = existingCustomer.firstTransactionDate;
            customerData.lastTransactionDate = existingCustomer.lastTransactionDate;
            customerData.createdAt = existingCustomer.createdAt;
            // Keep notes if not provided in form
            if (!customerData.notes) {
                customerData.notes = existingCustomer.notes || null;
            }
            
            // Update in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('customers', customerId, customerData);
            }
            
            // Update local array
            const index = customers.findIndex(c => c.id === customerId);
            if (index !== -1) {
                customers[index] = customerData;
            }
            
            // Recalculate balance from invoices after editing customer
            await recalculateCustomerBalanceFromInvoices(customerId);
        } else {
            // Add new customer - Check if customer with same name already exists
            // Check in local array first
            const duplicateCustomer = customers.find(c => 
                c.name.toLowerCase().trim() === customerData.name.toLowerCase().trim()
            );
            if (duplicateCustomer) {
                showMessage('يوجد عميل آخر بنفس الاسم. يرجى اختيار اسم مختلف', 'error');
                return;
            }
            
            // Also check in database to ensure no duplicates
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                try {
                    const allCustomers = await window.electronAPI.dbGetAll('customers', '', []);
                    const dbDuplicate = Array.isArray(allCustomers) ? allCustomers.find(c => 
                        c && c.name && c.name.toLowerCase().trim() === customerData.name.toLowerCase().trim()
                    ) : null;
                    if (dbDuplicate) {
                        showMessage('يوجد عميل آخر بنفس الاسم. يرجى اختيار اسم مختلف', 'error');
                        return;
                    }
                } catch (dbErr) {
                    console.error('Error checking database for duplicate customer:', dbErr);
                    // Continue with local check only if database check fails
                }
            }
            
            customerData.id = Date.now().toString();
            const openingBalance = parseFloat(document.getElementById('openingBalance').value) || 0;
            customerData.balance = openingBalance;
            customerData.openingBalance = openingBalance; // Store opening balance separately
            customerData.firstTransactionDate = null; // Will be set when first transaction occurs
            
            // Insert in database
            if (window.electronAPI && window.electronAPI.dbInsert) {
                await window.electronAPI.dbInsert('customers', customerData);
            }
            
            // Add to local array
            customers.push(customerData);
        }
        
        // Save to localStorage as backup
        await saveCustomers();
        currentPage = 1;
        applyFilters();
        closeModal();
        
        // Show success message
        showMessage('تم حفظ العميل بنجاح', 'success');
    } catch (error) {
        console.error('Error saving customer:', error);
        showMessage('خطأ في حفظ العميل: ' + error.message, 'error');
    }
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

// Delete Customer
async function deleteCustomer(customerId) {
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذا العميل؟',
        () => {
            // User confirmed - proceed with deletion
            proceedWithDeletion(customerId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with customer deletion
async function proceedWithDeletion(customerId) {

    try {
        // Check if customer has related invoices or receipts
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            // Check for sales invoices
            const invoices = await window.electronAPI.dbGetAll('sales_invoices', 'customerId = ?', [customerId]);
            
            // Check for receipts
            const receipts = await window.electronAPI.dbGetAll('receipts', 'customerId = ?', [customerId]);
            
            // If customer has related records, prevent deletion
            if (invoices.length > 0 || receipts.length > 0) {
                let message = 'لا يمكن حذف هذا العميل لأنه مرتبط بـ \n';
                if (invoices.length > 0) {
                    message += `- ${invoices.length} فاتورة مبيعات\n`;
                }
                if (receipts.length > 0) {
                    message += `- ${receipts.length} سند قبض\n`;
                }
                message += '\nيرجى حذف الفواتير وسندات القبض المرتبطة به أولاً.';
                showMessage(message, 'error');
                return;
            }
        }
        
        // Delete from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('customers', customerId);
        }
        
        // Remove from local array
        customers = customers.filter(c => c.id !== customerId);
        await saveCustomers();
        currentPage = 1;
        applyFilters();
        showMessage('تم حذف العميل بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting customer:', error);
        
        // Check if error is due to foreign key constraint
        if (error.message && (error.message.includes('FOREIGN KEY') || error.message.includes('foreign key'))) {
            showMessage('لا يمكن حذف العميل - يوجد فواتير أو سندات قبض مرتبطة به', 'error');
        } else {
            showMessage('خطأ في حذف العميل: ' + error.message, 'error');
        }
    }
}

// View Customer Details
function viewCustomerDetails(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const detailsHtml = `
        <div class="detail-row">
            <div class="detail-label">كود العميل:</div>
            <div class="detail-value">${customer.code}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">اسم العميل:</div>
            <div class="detail-value">${customer.name}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">رقم التلفون:</div>
            <div class="detail-value detail-value-emphasized">${customer.phone ? formatArabicPhone(customer.phone) : 'غير محدد'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">العنوان:</div>
            <div class="detail-value detail-value-emphasized">${customer.address || 'غير محدد'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">الرصيد الحالي:</div>
            <div class="detail-value ${customer.balance >= 0 ? 'balance-positive' : 'balance-negative'}">
                ${formatArabicCurrency(customer.balance)}
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">تاريخ أول تعامل:</div>
            <div class="detail-value">${customer.firstTransactionDate ? new Date(customer.firstTransactionDate).toLocaleDateString('ar-EG') : 'لم يحدث تعامل بعد'}</div>
        </div>
        ${customer.lastTransactionDate ? `
        <div class="detail-row">
            <div class="detail-label">تاريخ آخر تعامل:</div>
            <div class="detail-value">${new Date(customer.lastTransactionDate).toLocaleDateString('ar-EG')}</div>
        </div>
        ` : ''}
        <div class="detail-row">
            <div class="detail-label">الحالة:</div>
            <div class="detail-value">
                <span class="status-badge ${customer.status}">${customer.status === 'active' ? 'نشط' : 'غير نشط'}</span>
            </div>
        </div>
        ${customer.notes ? `
        <div class="detail-row">
            <div class="detail-label">ملاحظات:</div>
            <div class="detail-value">${customer.notes}</div>
        </div>
        ` : ''}
        <div class="detail-row">
            <div class="detail-label">تاريخ الإنشاء:</div>
            <div class="detail-value">${new Date(customer.createdAt).toLocaleDateString('ar-EG')}</div>
        </div>
    `;

    document.getElementById('customerDetails').innerHTML = detailsHtml;
    document.getElementById('detailsModal').classList.add('active');
}

// Render Customers Table
// Apply Filters
function applyFilters() {
    // Get filters
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    // Filter customers
    filteredCustomers = customers.filter(customer => {
        const matchSearch = !searchTerm || 
            customer.name.toLowerCase().includes(searchTerm) ||
            customer.code.toLowerCase().includes(searchTerm) ||
            (customer.phone && customer.phone.includes(searchTerm));
        
        const matchStatus = !statusFilter || customer.status === statusFilter;

        return matchSearch && matchStatus;
    });

    // Render paginated customers
    renderCustomers();
}

function renderCustomers() {
    const tbody = document.getElementById('customersTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    // Clear table
    tbody.innerHTML = '';

    if (filteredCustomers.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredCustomers.length);
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteCustomers = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredCustomers.length}`;
    
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

    // Render customers
    paginatedCustomers.forEach(customer => {
        const row = document.createElement('tr');
        const balance = parseFloat(customer.balance) || 0;
        
        // Determine balance color class based on amount
        let balanceClass = 'balance-zero';
        if (balance > 10000) {
            balanceClass = 'balance-high';
        } else if (balance > 5000) {
            balanceClass = 'balance-medium';
        } else if (balance > 0) {
            balanceClass = 'balance-low';
        } else if (balance < 0) {
            balanceClass = 'balance-negative';
        }
        
        // Truncate notes if too long
        const notes = customer.notes || '-';
        const notesDisplay = notes.length > 50 ? notes.substring(0, 50) + '...' : notes;
        
        row.innerHTML = `
            <td>${customer.code}</td>
            <td class="customer-name-cell"><strong>${customer.name}</strong></td>
            <td class="phone-cell">${customer.phone ? formatArabicPhone(customer.phone) : '-'}</td>
            <td class="address-cell">${customer.address || '-'}</td>
            <td>${customer.firstTransactionDate ? new Date(customer.firstTransactionDate).toLocaleDateString('ar-EG') : '-'}</td>
            <td><span class="balance-text ${balanceClass}">${formatArabicCurrency(balance)}</span></td>
            <td><span class="status-badge ${customer.status}">${customer.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
            <td class="notes-cell" title="${notes !== '-' ? notes : ''}">${notesDisplay}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-customer-id="${customer.id}" title="عرض التفاصيل">
                        👁️
                    </button>
                    <button class="action-btn edit" data-customer-id="${customer.id}" title="تعديل">
                        ✏️
                    </button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const editBtn = row.querySelector('.action-btn.edit');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewCustomerDetails(customer.id));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => openEditModal(customer.id));
        }
        
        // Add delete button only for manager or system_engineer
        if (canDeleteCustomers) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-customer-id', customer.id);
            deleteBtn.addEventListener('click', () => deleteCustomer(customer.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        
        tbody.appendChild(row);
    });
}

// Check Inactive Customers (based on sales history)
async function checkInactiveCustomers() {
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));

    try {
        // Get sales invoices from database
        let salesInvoices = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            salesInvoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
        } else {
            // Fallback to localStorage
            salesInvoices = JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES_INVOICES) || '[]');
        }

        for (const customer of customers) {
            // Find invoices for this customer (only delivered invoices)
            const customerInvoices = salesInvoices.filter(invoice => 
                invoice.customerId === customer.id && 
                invoice.status === 'delivered'
            );

            if (customerInvoices.length > 0) {
                // Get most recent invoice
                const lastInvoice = customerInvoices.sort((a, b) => 
                    new Date(b.date) - new Date(a.date)
                )[0];
                
                customer.lastTransactionDate = lastInvoice.date;
                
                // Check if last invoice was more than 15 days ago
                const lastInvoiceDate = new Date(lastInvoice.date);
                if (lastInvoiceDate < fifteenDaysAgo) {
                    customer.status = 'inactive';
                } else {
                    customer.status = 'active';
                }
            } else {
                // No invoices for this customer
                // Check if customer was created more than 15 days ago
                const createdDate = new Date(customer.createdAt);
                if (createdDate < fifteenDaysAgo) {
                    customer.status = 'inactive';
                }
            }
            
            // Update customer in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('customers', customer.id, customer);
            }
        }

        await saveCustomers();
        applyFilters();
    } catch (error) {
        console.error('Error checking inactive customers:', error);
    }
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
        const modal = document.querySelector('.modal.active, [class*="modal"].active');
        if (modal) {
            const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
            if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                firstInput.focus();
            }
        }
    }, 50);
}

// Make functions global for onclick handlers
window.openEditModal = openEditModal;
window.deleteCustomer = deleteCustomer;
window.viewCustomerDetails = viewCustomerDetails;

