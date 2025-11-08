// Receipt Vouchers Management System

const STORAGE_KEYS = {
    RECEIPTS: 'asel_receipt_vouchers',
    CUSTOMERS: 'asel_customers',
    RECEIPT_COUNTER: 'asel_receipt_counter'
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

let receipts = [];
let customers = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredReceipts = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let paymentMethodFilter = '';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderCustomers();
    applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // New Receipt Button
    document.getElementById('newReceiptBtn').addEventListener('click', () => {
        openNewReceipt();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('newReceiptBtn').click();
        });
    }

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('receiptForm').addEventListener('submit', handleFormSubmit);

    // Customer Selection
    document.getElementById('customerSelect').addEventListener('change', onCustomerChange);

    // Amount Input - Calculate balance
    document.getElementById('amount').addEventListener('input', calculateBalance);

    // Close modal on backdrop click
    document.getElementById('receiptModal').addEventListener('click', (e) => {
        if (e.target.id === 'receiptModal') {
            closeModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('receiptDate').value = today;

    // Pagination Event Listeners
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
        }
    });
    
    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });

    // Search & Filter Event Listeners
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const paymentMethodFilterSelect = document.getElementById('paymentMethodFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            currentPage = 1;
            applyFilters();
        });
    }

    if (dateFromInput) {
        dateFromInput.addEventListener('change', (e) => {
            dateFrom = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }

    if (dateToInput) {
        dateToInput.addEventListener('change', (e) => {
            dateTo = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }

    if (paymentMethodFilterSelect) {
        paymentMethodFilterSelect.addEventListener('change', (e) => {
            paymentMethodFilter = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            if (paymentMethodFilterSelect) paymentMethodFilterSelect.value = '';
            searchQuery = '';
            dateFrom = '';
            dateTo = '';
            paymentMethodFilter = '';
            currentPage = 1;
            applyFilters();
        });
    }
}

// Load Data
async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            receipts = await window.electronAPI.dbGetAll('receipts', '', []);
            customers = await window.electronAPI.dbGetAll('customers', '', []);
            
            // Ensure arrays
            receipts = Array.isArray(receipts) ? receipts : [];
            customers = Array.isArray(customers) ? customers : [];
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage (for migration only)
    const receiptsData = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    const customersData = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);

    receipts = receiptsData ? JSON.parse(receiptsData) : [];
    customers = customersData ? JSON.parse(customersData) : [];
}

// Save Receipts
async function saveReceipts() {
    // Save to database if available
    if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
        // This function is called after saving individual receipts
        // The actual save happens in handleFormSubmit
        return;
    }
    
    // Fallback to localStorage
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
}

// Generate Receipt Number
async function generateReceiptNumber() {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;
    
    // Try to get the highest receipt number from database
    let maxCounter = 0;
    
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const allReceipts = await window.electronAPI.dbGetAll('receipts', '', []);
            if (Array.isArray(allReceipts) && allReceipts.length > 0) {
                // Find the highest counter for this year
                const yearReceipts = allReceipts.filter(r => 
                    r.receiptNumber && r.receiptNumber.startsWith(prefix)
                );
                
                if (yearReceipts.length > 0) {
                    yearReceipts.forEach(r => {
                        const match = r.receiptNumber.match(new RegExp(`${prefix}(\\d+)`));
                        if (match && match[1]) {
                            const num = parseInt(match[1]);
                            if (num > maxCounter) {
                                maxCounter = num;
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error getting receipts for number generation:', error);
            // Fallback to localStorage
            maxCounter = parseInt(localStorage.getItem(STORAGE_KEYS.RECEIPT_COUNTER) || '0');
        }
    } else {
        // Fallback to localStorage
        maxCounter = parseInt(localStorage.getItem(STORAGE_KEYS.RECEIPT_COUNTER) || '0');
    }
    
    // Increment counter
    maxCounter++;
    
    // Save to localStorage as backup
    localStorage.setItem(STORAGE_KEYS.RECEIPT_COUNTER, maxCounter.toString());
    
    // Format: REC-2024-001
    return `${prefix}${String(maxCounter).padStart(3, '0')}`;
}

// Render Customers
function renderCustomers() {
    const select = document.getElementById('customerSelect');
    select.innerHTML = '<option value="">اختر العميل</option>';
    
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${customer.name} - ${customer.code}`;
        select.appendChild(option);
    });
}

// Open New Receipt
function openNewReceipt() {
    document.getElementById('isEdit').value = 'false';
    document.getElementById('receiptId').value = '';
    document.getElementById('modalTitle').textContent = 'سند قبض جديد';
    document.getElementById('receiptForm').reset();
    document.getElementById('customerInfo').classList.add('hidden');
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('receiptDate').value = today;
    document.getElementById('paymentMethod').value = 'cash';
    
    document.getElementById('receiptModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#receiptModal input:not([type="hidden"]), #receiptModal select, #receiptModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// On Customer Change
function onCustomerChange() {
    const customerId = document.getElementById('customerSelect').value;
    if (!customerId) {
        document.getElementById('customerInfo').classList.add('hidden');
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        calculateBalance();
        document.getElementById('customerInfo').classList.remove('hidden');
    }
}

// Calculate Balance
function calculateBalance() {
    const customerId = document.getElementById('customerSelect').value;
    const amount = parseFloat(document.getElementById('amount').value) || 0;

    if (!customerId) return;

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        const oldBalance = customer.balance || 0;
        // Receipt reduces customer debt (balance)
        const newBalance = oldBalance - amount;

        document.getElementById('oldBalance').textContent = `${oldBalance.toFixed(2)} ج.م`;
        document.getElementById('newBalance').textContent = `${newBalance.toFixed(2)} ج.م`;
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();

    const customerId = document.getElementById('customerSelect').value;
    const date = document.getElementById('receiptDate').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('notes').value.trim();

    if (!customerId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار العميل', 'error');
        } else {
            alert('⚠️ يرجى اختيار العميل');
        }
        return;
    }

    if (!amount || amount <= 0) {
        if (window.showToast) {
            window.showToast('يرجى إدخال مبلغ صحيح', 'error');
        } else {
            alert('⚠️ يرجى إدخال مبلغ صحيح');
        }
        return;
    }

    const receiptId = document.getElementById('receiptId').value || Date.now().toString();
    const isEdit = document.getElementById('isEdit').value === 'true';
    
    // Generate receipt number (async for new receipts)
    let receiptNumber;
    if (isEdit) {
        receiptNumber = receipts.find(r => r.id === receiptId)?.receiptNumber;
    } else {
        receiptNumber = await generateReceiptNumber();
    }
    
    const receiptData = {
        id: receiptId,
        receiptNumber: receiptNumber,
        customerId: customerId,
        date: date,
        amount: amount,
        paymentMethod: paymentMethod,
        notes: notes || '',
        createdAt: isEdit ? 
            receipts.find(r => r.id === receiptId)?.createdAt : 
            new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            if (isEdit) {
                // Update existing receipt
                const oldReceipt = receipts.find(r => r.id === receiptId);
                if (oldReceipt) {
                    // Revert old amount
                    await updateCustomerBalanceInDB(oldReceipt.customerId, oldReceipt.amount);
                    // Apply new amount
                    await updateCustomerBalanceInDB(customerId, -amount);
                    // Update receipt in database
                    await window.electronAPI.dbUpdate('receipts', receiptId, receiptData);
                }
            } else {
                // New receipt
                await window.electronAPI.dbInsert('receipts', receiptData);
                // Update customer balance (receipt reduces debt)
                await updateCustomerBalanceInDB(customerId, -amount);
                // Update first transaction date
                await updateCustomerFirstTransactionDate(customerId);
            }
            
            // Reload receipts from database to ensure consistency
            try {
                receipts = await window.electronAPI.dbGetAll('receipts', '', []);
                receipts = Array.isArray(receipts) ? receipts : [];
            } catch (reloadError) {
                console.error('Error reloading receipts from database:', reloadError);
                // Fallback: update local array manually
                if (isEdit) {
                    const index = receipts.findIndex(r => r.id === receiptId);
                    if (index !== -1) {
                        receipts[index] = receiptData;
                    }
                } else {
                    receipts.push(receiptData);
                }
            }
        } else {
            // Fallback to localStorage
            if (isEdit) {
                const index = receipts.findIndex(r => r.id === receiptId);
                if (index !== -1) {
                    const oldReceipt = receipts[index];
                    // Revert old amount
                    updateCustomerBalance(oldReceipt.customerId, oldReceipt.amount);
                    // Apply new amount
                    updateCustomerBalance(customerId, -amount);
                    receipts[index] = receiptData;
                }
            } else {
                receipts.push(receiptData);
                // Update customer balance (receipt reduces debt)
                updateCustomerBalance(customerId, -amount);
            }
            saveReceipts();
        }
        
        currentPage = 1;
        applyFilters();
        closeModal();
        if (window.showToast) {
            window.showToast('تم حفظ سند القبض بنجاح', 'success');
        } else {
            alert('✓ تم حفظ سند القبض بنجاح');
        }
    } catch (error) {
        console.error('Error saving receipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ سند القبض: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ سند القبض: ' + error.message);
        }
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

// Update Customer Balance in Database
async function updateCustomerBalanceInDB(customerId, amount) {
    if (window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
        try {
            const customer = await window.electronAPI.dbGet('customers', customerId);
            if (customer) {
                const newBalance = (parseFloat(customer.balance) || 0) + amount;
                await window.electronAPI.dbUpdate('customers', customerId, {
                    ...customer,
                    balance: newBalance,
                    lastTransactionDate: new Date().toISOString()
                });
                
                // Update first transaction date
                await updateCustomerFirstTransactionDate(customerId);
                
                // Update local array
                const localCustomer = customers.find(c => c.id === customerId);
                if (localCustomer) {
                    localCustomer.balance = newBalance;
                    localCustomer.lastTransactionDate = new Date().toISOString();
                }
            }
        } catch (error) {
            console.error('Error updating customer balance in database:', error);
        }
    }
}

// Update Customer Balance (localStorage fallback)
function updateCustomerBalance(customerId, amount) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        customer.balance = (customer.balance || 0) + amount;
        customer.lastTransactionDate = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    }
}

// Render Receipts
// Apply Filters
function applyFilters() {
    // Start with all receipts
    filteredReceipts = [...receipts];
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredReceipts = filteredReceipts.filter(receipt => {
            // Search by receipt number
            const receiptNumber = (receipt.receiptNumber || '').toLowerCase();
            if (receiptNumber.includes(query)) return true;
            
            // Search by customer name
            const customer = customers.find(c => c.id === receipt.customerId);
            if (customer) {
                const customerName = (customer.name || '').toLowerCase();
                if (customerName.includes(query)) return true;
            }
            
            return false;
        });
    }
    
    // Apply date range filter
    if (dateFrom) {
        filteredReceipts = filteredReceipts.filter(receipt => {
            return new Date(receipt.date) >= new Date(dateFrom);
        });
    }
    
    if (dateTo) {
        filteredReceipts = filteredReceipts.filter(receipt => {
            const receiptDate = new Date(receipt.date);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return receiptDate <= toDate;
        });
    }
    
    // Apply payment method filter
    if (paymentMethodFilter) {
        filteredReceipts = filteredReceipts.filter(receipt => {
            return receipt.paymentMethod === paymentMethodFilter;
        });
    }
    
    // Sort by date (newest first)
    filteredReceipts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Reset to first page if current page is out of bounds
    const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    // Render paginated receipts
    renderReceipts();
}

function renderReceipts() {
    const tbody = document.getElementById('receiptsTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    tbody.innerHTML = '';
    
    if (filteredReceipts.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredReceipts.length);
    const paginatedReceipts = filteredReceipts.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteReceipts = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredReceipts.length}`;
    
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
    
    paginatedReceipts.forEach(receipt => {
        const customer = customers.find(c => c.id === receipt.customerId);
        const paymentMethodText = {
            'cash': 'نقدي',
            'bank': 'تحويل بنكي',
            'check': 'شيك',
            'wallet': 'محفظة إلكترونية'
        };
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${receipt.receiptNumber}</td>
            <td>${new Date(receipt.date).toLocaleDateString('ar-EG')}</td>
            <td class="customer-name-cell">${customer ? `<strong>${customer.name}</strong>` : 'غير محدد'}</td>
            <td class="receipt-amount-cell"><strong>${formatArabicCurrency(receipt.amount)}</strong></td>
            <td><span class="payment-method-badge">${paymentMethodText[receipt.paymentMethod] || receipt.paymentMethod}</span></td>
            <td>${receipt.notes || '-'}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-receipt-id="${receipt.id}" title="عرض">👁️</button>
                    <button class="action-btn edit" data-receipt-id="${receipt.id}" title="تعديل">✏️</button>
                    <button class="action-btn save" data-receipt-id="${receipt.id}" title="حفظ">💾</button>
                    <button class="action-btn print" data-receipt-id="${receipt.id}" title="طباعة">🖨️</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const editBtn = row.querySelector('.action-btn.edit');
        const saveBtn = row.querySelector('.action-btn.save');
        const printBtn = row.querySelector('.action-btn.print');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewReceipt(receipt.id));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => editReceipt(receipt.id));
        }
        
        // Add delete button only for manager or system_engineer
        if (canDeleteReceipts) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-receipt-id', receipt.id);
            deleteBtn.addEventListener('click', () => deleteReceipt(receipt.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveReceiptAsPDF(receipt.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printReceipt(receipt.id));
        }
        
        tbody.appendChild(row);
    });
}

// View Receipt
function viewReceipt(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    const customer = customers.find(c => c.id === receipt.customerId);
    const paymentMethodText = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'check': 'شيك',
        'wallet': 'محفظة إلكترونية'
    };

    // Calculate balances
    const currentBalance = customer ? (customer.balance || 0) : 0;
    const oldBalance = currentBalance + receipt.amount; // الرصيد القديم = الرصيد الحالي + المدفوع
    const paidAmount = receipt.amount; // المدفوع
    const newBalance = currentBalance; // الرصيد الجديد = الرصيد الحالي

    const receiptInfo = `سند قبض رقم: ${receipt.receiptNumber}\nالتاريخ: ${new Date(receipt.date).toLocaleDateString('ar-EG')}\nمن: ${customer ? customer.name : 'غير محدد'}\nالمبلغ: ${receipt.amount.toFixed(2)} ج.م\nطريقة الدفع: ${paymentMethodText[receipt.paymentMethod] || receipt.paymentMethod}\n\nالرصيد القديم: ${oldBalance.toFixed(2)} ج.م\nالمدفوع: ${paidAmount.toFixed(2)} ج.م\nالرصيد الجديد: ${newBalance.toFixed(2)} ج.م\n${receipt.notes ? `\nملاحظات: ${receipt.notes}` : ''}`;
    if (window.showToast) {
        window.showToast(receiptInfo, 'info');
    } else {
        alert(receiptInfo);
    }
}

// Edit Receipt
function editReceipt(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    document.getElementById('isEdit').value = 'true';
    document.getElementById('receiptId').value = receipt.id;
    document.getElementById('modalTitle').textContent = `تعديل سند قبض ${receipt.receiptNumber}`;
    document.getElementById('receiptDate').value = receipt.date;
    document.getElementById('customerSelect').value = receipt.customerId;
    document.getElementById('amount').value = receipt.amount;
    document.getElementById('paymentMethod').value = receipt.paymentMethod;
    document.getElementById('notes').value = receipt.notes || '';

    onCustomerChange();
    calculateBalance();
    document.getElementById('receiptModal').classList.add('active');
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

// Delete Receipt
async function deleteReceipt(receiptId) {
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذا السند؟',
        () => {
            // User confirmed - proceed with deletion
            proceedWithReceiptDeletion(receiptId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with receipt deletion
async function proceedWithReceiptDeletion(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    try {
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('receipts', receiptId);
            // Revert customer balance
            await updateCustomerBalanceInDB(receipt.customerId, receipt.amount);
            
            // Reload receipts from database to ensure consistency
            try {
                receipts = await window.electronAPI.dbGetAll('receipts', '', []);
                receipts = Array.isArray(receipts) ? receipts : [];
            } catch (reloadError) {
                console.error('Error reloading receipts from database:', reloadError);
                // Fallback: remove from local array manually
                receipts = receipts.filter(r => r.id !== receiptId);
            }
        } else {
            // Fallback to localStorage
            updateCustomerBalance(receipt.customerId, receipt.amount);
            receipts = receipts.filter(r => r.id !== receiptId);
            saveReceipts();
        }

        currentPage = 1;
        applyFilters();
        if (window.showToast) {
            window.showToast('تم حذف السند بنجاح', 'success');
        }
    } catch (error) {
        console.error('Error deleting receipt:', error);
        if (window.showToast) {
            window.showToast('خطأ في حذف السند: ' + error.message, 'error');
        }
    }
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
                    commitmentText: companyInfo.commitmentText || 'أقر بأنني قد استلمت البضاعة/الخدمة المبينة أعلاه بحالة جيدة وبمواصفات مطابقة، وأتعهد بالسداد وفق الشروط المذكورة.'
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

// Generate Receipt Print Content
async function generateReceiptPrintContent(receipt) {
    const customer = customers.find(c => c.id === receipt.customerId);
    const paymentMethodText = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'check': 'شيك',
        'wallet': 'محفظة إلكترونية'
    };
    const companySettings = await getCompanySettings();

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سند قبض ${receipt.receiptNumber}</title>
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
            padding: 40px;
        }
        .voucher-container {
            border: 2px solid #333;
            padding: 30px;
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .company-name {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .voucher-title {
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            margin: 30px 0;
        }
        .voucher-info {
            margin: 20px 0;
        }
        .voucher-info table {
            width: 100%;
        }
        .voucher-info td {
            padding: 8px 0;
            font-size: 14px;
        }
        .voucher-info td:first-child {
            font-weight: bold;
            width: 150px;
        }
        .amount-section {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .amount-value {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }
        .signature {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
        }
        .signature-box {
            width: 45%;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 10px;
            margin-top: 50px;
        }
        .balance-section {
            margin: 30px 0;
            padding: 20px;
            background: #f0f4f8;
            border-radius: 10px;
            border: 1px solid #ddd;
        }
        .balance-section table {
            width: 100%;
        }
        .balance-section td {
            padding: 10px 0;
            font-size: 16px;
        }
        .balance-section td:first-child {
            font-weight: bold;
            width: 200px;
        }
        .balance-section td:last-child {
            text-align: left;
            font-weight: bold;
            color: #2c3e50;
        }
    </style>
</head>
<body>
    <div class="voucher-container">
        <div class="header">
            <div class="company-name">${companySettings.name || 'شركة أسيل'}</div>
            <div>${companySettings.address || ''}</div>
            <div>${companySettings.phone || ''}</div>
        </div>
        <div class="voucher-title">سند قبض</div>
        <div class="voucher-info">
            <table>
                <tr>
                    <td>رقم السند:</td>
                    <td>${receipt.receiptNumber}</td>
                </tr>
                <tr>
                    <td>التاريخ:</td>
                    <td>${new Date(receipt.date).toLocaleDateString('ar-EG')}</td>
                </tr>
                <tr>
                    <td>من:</td>
                    <td>${customer ? customer.name : 'غير محدد'}</td>
                </tr>
                <tr>
                    <td>المبلغ:</td>
                    <td>${receipt.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>طريقة الدفع:</td>
                    <td>${paymentMethodText[receipt.paymentMethod] || receipt.paymentMethod}</td>
                </tr>
                ${receipt.notes ? `
                <tr>
                    <td>ملاحظات:</td>
                    <td>${receipt.notes}</td>
                </tr>
                ` : ''}
            </table>
        </div>
        <div class="amount-section">
            <div>المبلغ المستلم</div>
            <div class="amount-value">${receipt.amount.toFixed(2)} ج.م</div>
        </div>
        <div class="balance-section">
            <table>
                <tr>
                    <td>الرصيد القديم:</td>
                    <td>${((customer ? (customer.balance || 0) : 0) + receipt.amount).toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>المدفوع:</td>
                    <td>${receipt.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>الرصيد الجديد:</td>
                    <td>${(customer ? (customer.balance || 0) : 0).toFixed(2)} ج.م</td>
                </tr>
            </table>
        </div>
        <div class="signature">
            <div class="signature-box">
                <div>توقيع المستلم</div>
            </div>
            <div class="signature-box">
                <div>توقيع المدير</div>
            </div>
        </div>
    </div>
</body>
    </html>
    `;
}

// Print Receipt
async function printReceipt(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    const printContent = await generateReceiptPrintContent(receipt);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Save Receipt as PDF
async function saveReceiptAsPDF(receiptId) {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) {
        if (window.showToast) {
            window.showToast('السند غير موجود', 'error');
        } else {
            alert('⚠️ السند غير موجود');
        }
        return;
    }

    try {
        // Generate receipt HTML content
        const receiptContent = await generateReceiptPrintContent(receipt);
        
        // Generate default file name
        const defaultFileName = `سند_قبض_${receipt.receiptNumber}_${new Date(receipt.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(receiptContent, defaultFileName);
                if (result.success) {
                    if (window.showToast) {
                        window.showToast(`تم حفظ السند بنجاح في: ${result.filePath}`, 'success');
                    } else {
                        alert(`✅ تم حفظ السند بنجاح في: ${result.filePath}`);
                    }
                } else if (result.cancelled) {
                    // User cancelled, do nothing
                } else {
                    if (window.showToast) {
                        window.showToast('خطأ في حفظ السند: ' + (result.error || 'خطأ غير معروف'), 'error');
                    } else {
                        alert('❌ خطأ في حفظ السند: ' + (result.error || 'خطأ غير معروف'));
                    }
                }
            } catch (error) {
                console.error('Error saving receipt to file:', error);
                if (window.showToast) {
                    window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
                } else {
                    alert('❌ خطأ في حفظ السند: ' + error.message);
                }
            }
        } else {
            if (window.showToast) {
                window.showToast('وظيفة حفظ الملف غير متاحة', 'error');
            } else {
                alert('⚠️ وظيفة حفظ الملف غير متاحة');
            }
        }
    } catch (error) {
        console.error('Error in saveReceiptAsPDF:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
        } else {
            alert('❌ خطأ في حفظ السند: ' + error.message);
        }
    }
}

// Close Modal
function closeModal() {
    document.getElementById('receiptModal').classList.remove('active');
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

// Make functions global
window.viewReceipt = viewReceipt;
window.editReceipt = editReceipt;
window.deleteReceipt = deleteReceipt;
window.saveReceiptAsPDF = saveReceiptAsPDF;
window.printReceipt = printReceipt;

