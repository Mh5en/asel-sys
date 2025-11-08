// Payment Vouchers Management System

const STORAGE_KEYS = {
    PAYMENTS: 'asel_payment_vouchers',
    SUPPLIERS: 'asel_suppliers',
    PAYMENT_COUNTER: 'asel_payment_counter'
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

let payments = [];
let suppliers = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredPayments = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let paymentMethodFilter = '';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderSuppliers();
    applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // New Payment Button
    document.getElementById('newPaymentBtn').addEventListener('click', () => {
        openNewPayment();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('newPaymentBtn').click();
        });
    }

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('paymentForm').addEventListener('submit', handleFormSubmit);

    // Supplier Selection
    document.getElementById('supplierSelect').addEventListener('change', onSupplierChange);

    // Amount Input - Calculate balance
    document.getElementById('amount').addEventListener('input', calculateBalance);

    // Close modal on backdrop click
    document.getElementById('paymentModal').addEventListener('click', (e) => {
        if (e.target.id === 'paymentModal') {
            closeModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paymentDate').value = today;

    // Pagination Event Listeners
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
        }
    });
    
    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
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
            payments = await window.electronAPI.dbGetAll('payments', '', []);
            suppliers = await window.electronAPI.dbGetAll('suppliers', '', []);
            
            // Ensure arrays
            payments = Array.isArray(payments) ? payments : [];
            suppliers = Array.isArray(suppliers) ? suppliers : [];
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage (for migration only)
    const paymentsData = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    const suppliersData = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);

    payments = paymentsData ? JSON.parse(paymentsData) : [];
    suppliers = suppliersData ? JSON.parse(suppliersData) : [];
}

// Save Payments
async function savePayments() {
    // Save to database if available
    if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
        // This function is called after saving individual payments
        // The actual save happens in handleFormSubmit
        return;
    }
    
    // Fallback to localStorage
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
}

// Generate Payment Number
async function generatePaymentNumber() {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all payments from database
            const allPayments = await window.electronAPI.dbGetAll('payments', '', []);
            
            if (allPayments && allPayments.length > 0) {
                // Filter payments with numbers matching current year pattern
                const currentYearNumbers = allPayments
                    .map(payment => payment.paymentNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from payment numbers (e.g., "PAY-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem(STORAGE_KEYS.PAYMENT_COUNTER, counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating payment number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.PAYMENT_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.PAYMENT_COUNTER, counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Render Suppliers
function renderSuppliers() {
    const select = document.getElementById('supplierSelect');
    select.innerHTML = '<option value="">اختر المورد</option>';
    
    suppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = `${supplier.name} - ${supplier.code}`;
        select.appendChild(option);
    });
}

// Open New Payment
function openNewPayment() {
    document.getElementById('isEdit').value = 'false';
    document.getElementById('paymentId').value = '';
    document.getElementById('modalTitle').textContent = 'سند صرف جديد';
    document.getElementById('paymentForm').reset();
    document.getElementById('supplierInfo').classList.add('hidden');
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paymentDate').value = today;
    document.getElementById('paymentMethod').value = 'cash';
    
    document.getElementById('paymentModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#paymentModal input:not([type="hidden"]), #paymentModal select, #paymentModal textarea');
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
        calculateBalance();
        document.getElementById('supplierInfo').classList.remove('hidden');
    }
}

// Calculate Balance
function calculateBalance() {
    const paymentType = document.getElementById('paymentType').value;
    const supplierId = document.getElementById('supplierSelect').value;
    const amount = parseFloat(document.getElementById('amount').value) || 0;

    if (paymentType !== 'supplier' || !supplierId) return;

    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
        const oldBalance = supplier.balance || 0;
        // Payment decreases supplier debt (balance) - when we pay, debt decreases
        const newBalance = oldBalance - amount;

        document.getElementById('oldBalance').textContent = `${oldBalance.toFixed(2)} ج.م`;
        document.getElementById('newBalance').textContent = `${newBalance.toFixed(2)} ج.م`;
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();

    const date = document.getElementById('paymentDate').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('notes').value.trim();
    const supplierId = document.getElementById('supplierSelect').value;

    if (!supplierId) {
        if (window.showToast) {
            window.showToast('يرجى اختيار المورد', 'error');
        } else {
            alert('⚠️ يرجى اختيار المورد');
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

    const paymentId = document.getElementById('paymentId').value || Date.now().toString();
    const isEdit = document.getElementById('isEdit').value === 'true';

    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
        if (window.showToast) {
            window.showToast('المورد غير موجود', 'error');
        } else {
            alert('⚠️ المورد غير موجود');
        }
        return;
    }

    let paymentData = {
        id: paymentId,
        paymentNumber: isEdit ? 
            payments.find(p => p.id === paymentId)?.paymentNumber : 
            await generatePaymentNumber(),
        type: 'supplier',
        date: date,
        amount: amount,
        paymentMethod: paymentMethod,
        notes: notes || '',
        supplierId: supplierId,
        toName: supplier.name,
        createdAt: isEdit ? 
            payments.find(p => p.id === paymentId)?.createdAt : 
            new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            if (isEdit) {
                // Update existing payment
                const oldPayment = payments.find(p => p.id === paymentId);
                if (oldPayment) {
                    // Revert old amount if supplier (add back the old payment)
                    if (oldPayment.type === 'supplier' && oldPayment.supplierId) {
                        await updateSupplierBalanceInDB(oldPayment.supplierId, oldPayment.amount);
                    }
                    // Apply new amount if supplier (subtract the new payment)
                    if (paymentData.type === 'supplier' && paymentData.supplierId) {
                        await updateSupplierBalanceInDB(paymentData.supplierId, -paymentData.amount);
                    }
                    // Update payment in database
                    await window.electronAPI.dbUpdate('payments', paymentId, paymentData);
                    // Update local array
                    const index = payments.findIndex(p => p.id === paymentId);
                    if (index !== -1) {
                        payments[index] = paymentData;
                    }
                }
            } else {
                // New payment
                await window.electronAPI.dbInsert('payments', paymentData);
                payments.push(paymentData);
                // Update supplier balance (subtract payment amount - reduces debt)
                await updateSupplierBalanceInDB(paymentData.supplierId, -paymentData.amount);
                // Update first transaction date
                await updateSupplierFirstTransactionDate(paymentData.supplierId);
            }
        } else {
            // Fallback to localStorage
            if (isEdit) {
                const index = payments.findIndex(p => p.id === paymentId);
                if (index !== -1) {
                    const oldPayment = payments[index];
                    // Revert old amount (add back the old payment)
                    if (oldPayment.supplierId) {
                        updateSupplierBalance(oldPayment.supplierId, oldPayment.amount);
                    }
                    // Apply new amount (subtract the new payment)
                    if (paymentData.supplierId) {
                        updateSupplierBalance(paymentData.supplierId, -paymentData.amount);
                    }
                    payments[index] = paymentData;
                }
            } else {
                payments.push(paymentData);
                // Update supplier balance (subtract payment amount - reduces debt)
                updateSupplierBalance(paymentData.supplierId, -paymentData.amount);
            }
            savePayments();
        }
        
        // Recalculate supplier balance from all invoices and payments
        if (paymentData.type === 'supplier' && paymentData.supplierId) {
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                // Recalculate balance from all invoices and payments
                const supplier = await window.electronAPI.dbGet('suppliers', paymentData.supplierId);
                if (supplier) {
                    // Get all purchase invoices
                    const supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [paymentData.supplierId]);
                    // Get all payments
                    const supplierPayments = await window.electronAPI.dbGetAll('payments', 'supplierId = ? AND type = ?', [paymentData.supplierId, 'supplier']);
                    
                    const openingBalance = supplier.openingBalance || 0;
                    let totalRemaining = 0;
                    supplierInvoices.forEach(invoice => {
                        totalRemaining += invoice.remaining || 0;
                    });
                    let totalPayments = 0;
                    supplierPayments.forEach(payment => {
                        totalPayments += payment.amount || 0;
                    });
                    
                    const newBalance = openingBalance + totalRemaining - totalPayments;
                    
                    await window.electronAPI.dbUpdate('suppliers', paymentData.supplierId, {
                        ...supplier,
                        balance: newBalance,
                        lastTransactionDate: new Date().toISOString()
                    });
                    
                    // Update local array
                    const localSupplier = suppliers.find(s => s.id === paymentData.supplierId);
                    if (localSupplier) {
                        localSupplier.balance = newBalance;
                        localSupplier.lastTransactionDate = new Date().toISOString();
                    }
                    
                    console.log(`[Payments] Recalculated supplier balance: ${newBalance} (opening: ${openingBalance}, invoices: ${totalRemaining}, payments: ${totalPayments})`);
                }
            }
        }
        
        currentPage = 1;
        applyFilters();
        closeModal();
        if (window.showToast) {
            window.showToast('تم حفظ سند الصرف بنجاح', 'success');
        } else {
            alert('✓ تم حفظ سند الصرف بنجاح');
        }
    } catch (error) {
        console.error('Error saving payment:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ سند الصرف: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ سند الصرف: ' + error.message);
        }
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

// Update Supplier Balance in Database
async function updateSupplierBalanceInDB(supplierId, amount) {
    if (window.electronAPI && window.electronAPI.dbGet && window.electronAPI.dbUpdate) {
        try {
            const supplier = await window.electronAPI.dbGet('suppliers', supplierId);
            if (supplier) {
                const newBalance = (parseFloat(supplier.balance) || 0) + amount;
                await window.electronAPI.dbUpdate('suppliers', supplierId, {
                    ...supplier,
                    balance: newBalance,
                    lastTransactionDate: new Date().toISOString()
                });
                
                // Update first transaction date
                await updateSupplierFirstTransactionDate(supplierId);
                
                // Update local array
                const localSupplier = suppliers.find(s => s.id === supplierId);
                if (localSupplier) {
                    localSupplier.balance = newBalance;
                    localSupplier.lastTransactionDate = new Date().toISOString();
                }
            }
        } catch (error) {
            console.error('Error updating supplier balance in database:', error);
        }
    }
}

// Update Supplier Balance (localStorage fallback)
function updateSupplierBalance(supplierId, amount) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
        supplier.balance = (supplier.balance || 0) + amount;
        supplier.lastTransactionDate = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    }
}

// Apply Filters
function applyFilters() {
    // Start with all payments
    filteredPayments = [...payments];
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredPayments = filteredPayments.filter(payment => {
            // Search by payment number
            const paymentNumber = (payment.paymentNumber || '').toLowerCase();
            if (paymentNumber.includes(query)) return true;
            
            // Search by supplier name
            const supplier = suppliers.find(s => s.id === payment.supplierId);
            if (supplier) {
                const supplierName = (supplier.name || '').toLowerCase();
                if (supplierName.includes(query)) return true;
            }
            
            return false;
        });
    }
    
    // Apply date range filter
    if (dateFrom) {
        filteredPayments = filteredPayments.filter(payment => {
            return new Date(payment.date) >= new Date(dateFrom);
        });
    }
    
    if (dateTo) {
        filteredPayments = filteredPayments.filter(payment => {
            const paymentDate = new Date(payment.date);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return paymentDate <= toDate;
        });
    }
    
    // Apply payment method filter
    if (paymentMethodFilter) {
        filteredPayments = filteredPayments.filter(payment => {
            return payment.paymentMethod === paymentMethodFilter;
        });
    }
    
    // Sort by date (newest first)
    filteredPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Reset to first page if current page is out of bounds
    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    // Render paginated payments
    renderPayments();
}

function renderPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    tbody.innerHTML = '';
    
    if (filteredPayments.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredPayments.length);
    const paginatedPayments = filteredPayments.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeletePayments = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredPayments.length}`;
    
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
    
    paginatedPayments.forEach(payment => {
        const paymentMethodText = {
            'cash': 'نقدي',
            'bank': 'تحويل بنكي',
            'check': 'شيك',
            'wallet': 'محفظة إلكترونية'
        };
        
        const supplier = payment.supplierId ? suppliers.find(s => s.id === payment.supplierId) : null;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${payment.paymentNumber}</td>
            <td>${new Date(payment.date).toLocaleDateString('ar-EG')}</td>
            <td class="supplier-name-cell">${supplier ? `<strong>${supplier.name}</strong>` : '-'}</td>
            <td class="payment-amount-cell"><strong>${formatArabicCurrency(payment.amount)}</strong></td>
            <td><span class="payment-method-badge">${paymentMethodText[payment.paymentMethod] || payment.paymentMethod}</span></td>
            <td>${payment.notes || '-'}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-payment-id="${payment.id}" title="عرض">👁️</button>
                    <button class="action-btn edit" data-payment-id="${payment.id}" title="تعديل">✏️</button>
                    <button class="action-btn save" data-payment-id="${payment.id}" title="حفظ">💾</button>
                    <button class="action-btn print" data-payment-id="${payment.id}" title="طباعة">🖨️</button>
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
            viewBtn.addEventListener('click', () => viewPayment(payment.id));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => editPayment(payment.id));
        }
        
        // Add delete button only for manager or system_engineer
        if (canDeletePayments) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-payment-id', payment.id);
            deleteBtn.addEventListener('click', () => deletePayment(payment.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => savePaymentAsPDF(payment.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printPayment(payment.id));
        }
        
        tbody.appendChild(row);
    });
}

// View Payment
function viewPayment(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;
    
    const supplier = payment.supplierId ? suppliers.find(s => s.id === payment.supplierId) : null;
    
    const paymentMethodText = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'check': 'شيك',
        'wallet': 'محفظة إلكترونية'
    };

    // Calculate balances
    const currentBalance = supplier ? (supplier.balance || 0) : 0;
    const oldBalance = currentBalance + payment.amount; // الرصيد القديم = الرصيد الحالي + المدفوع
    const paidAmount = payment.amount; // المدفوع
    const newBalance = currentBalance; // الرصيد الجديد = الرصيد الحالي

    const paymentInfo = `سند صرف رقم: ${payment.paymentNumber}\nالتاريخ: ${new Date(payment.date).toLocaleDateString('ar-EG')}\nالمورد: ${supplier ? supplier.name : '-'}\nالمبلغ: ${formatArabicCurrency(payment.amount)}\nطريقة الدفع: ${paymentMethodText[payment.paymentMethod] || payment.paymentMethod}\n\nالرصيد القديم: ${oldBalance.toFixed(2)} ج.م\nالمدفوع: ${paidAmount.toFixed(2)} ج.م\nالرصيد الجديد: ${newBalance.toFixed(2)} ج.م\n${payment.notes ? `\nملاحظات: ${payment.notes}` : ''}`;
    if (window.showToast) {
        window.showToast(paymentInfo, 'info');
    } else {
        alert(paymentInfo);
    }
}

// Edit Payment
function editPayment(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    document.getElementById('isEdit').value = 'true';
    document.getElementById('paymentId').value = payment.id;
    document.getElementById('modalTitle').textContent = `تعديل سند صرف ${payment.paymentNumber}`;
    document.getElementById('paymentDate').value = payment.date;
    document.getElementById('amount').value = payment.amount;
    document.getElementById('paymentMethod').value = payment.paymentMethod;
    document.getElementById('notes').value = payment.notes || '';
    document.getElementById('supplierSelect').value = payment.supplierId || '';
    
    if (payment.supplierId) {
        onSupplierChange();
    }

    document.getElementById('paymentModal').classList.add('active');
}

// Delete Payment
async function deletePayment(paymentId) {
    if (!confirm('هل أنت متأكد من حذف هذا السند؟')) {
        return;
    }

    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    try {
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('payments', paymentId);
            
            // Recalculate supplier balance from all invoices and payments
            if (payment.type === 'supplier' && payment.supplierId) {
                const supplier = await window.electronAPI.dbGet('suppliers', payment.supplierId);
                if (supplier) {
                    // Get all purchase invoices
                    const supplierInvoices = await window.electronAPI.dbGetAll('purchase_invoices', 'supplierId = ?', [payment.supplierId]);
                    // Get all payments (after deletion, this payment won't be included)
                    const supplierPayments = await window.electronAPI.dbGetAll('payments', 'supplierId = ? AND type = ?', [payment.supplierId, 'supplier']);
                    
                    const openingBalance = supplier.openingBalance || 0;
                    let totalRemaining = 0;
                    supplierInvoices.forEach(invoice => {
                        totalRemaining += invoice.remaining || 0;
                    });
                    let totalPayments = 0;
                    supplierPayments.forEach(p => {
                        totalPayments += p.amount || 0;
                    });
                    
                    const newBalance = openingBalance + totalRemaining - totalPayments;
                    
                    await window.electronAPI.dbUpdate('suppliers', payment.supplierId, {
                        ...supplier,
                        balance: newBalance,
                        lastTransactionDate: new Date().toISOString()
                    });
                    
                    // Update local array
                    const localSupplier = suppliers.find(s => s.id === payment.supplierId);
                    if (localSupplier) {
                        localSupplier.balance = newBalance;
                        localSupplier.lastTransactionDate = new Date().toISOString();
                    }
                    
                    console.log(`[Payments] Recalculated supplier balance after deletion: ${newBalance} (opening: ${openingBalance}, invoices: ${totalRemaining}, payments: ${totalPayments})`);
                }
            }
        } else {
            // Fallback to localStorage
            if (payment.supplierId) {
                updateSupplierBalance(payment.supplierId, payment.amount);
            }
            savePayments();
        }

        payments = payments.filter(p => p.id !== paymentId);
        currentPage = 1;
        applyFilters();
        if (window.showToast) {
            window.showToast('تم حذف السند بنجاح', 'success');
        } else {
            alert('✓ تم حذف السند بنجاح');
        }
    } catch (error) {
        console.error('Error deleting payment:', error);
        if (window.showToast) {
            window.showToast('خطأ في حذف السند: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حذف السند: ' + error.message);
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

// Generate Payment Print Content
async function generatePaymentPrintContent(payment) {
    const supplier = payment.supplierId ? suppliers.find(s => s.id === payment.supplierId) : null;
    
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
    <title>سند صرف ${payment.paymentNumber}</title>
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
        <div class="voucher-title">سند صرف</div>
        <div class="voucher-info">
            <table>
                <tr>
                    <td>رقم السند:</td>
                    <td>${payment.paymentNumber}</td>
                </tr>
                <tr>
                    <td>التاريخ:</td>
                    <td>${new Date(payment.date).toLocaleDateString('ar-EG')}</td>
                </tr>
                <tr>
                    <td>المورد:</td>
                    <td>${supplier ? supplier.name : '-'}</td>
                </tr>
                <tr>
                    <td>المبلغ:</td>
                    <td>${payment.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>طريقة الدفع:</td>
                    <td>${paymentMethodText[payment.paymentMethod] || payment.paymentMethod}</td>
                </tr>
                ${payment.notes ? `
                <tr>
                    <td>ملاحظات:</td>
                    <td>${payment.notes}</td>
                </tr>
                ` : ''}
            </table>
        </div>
        <div class="amount-section">
            <div>المبلغ المدفوع</div>
            <div class="amount-value">${payment.amount.toFixed(2)} ج.م</div>
        </div>
        <div class="balance-section">
            <table>
                <tr>
                    <td>الرصيد القديم:</td>
                    <td>${((supplier ? (supplier.balance || 0) : 0) + payment.amount).toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>المدفوع:</td>
                    <td>${payment.amount.toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>الرصيد الجديد:</td>
                    <td>${(supplier ? (supplier.balance || 0) : 0).toFixed(2)} ج.م</td>
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

// Print Payment
async function printPayment(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    const printContent = await generatePaymentPrintContent(payment);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Save Payment as PDF
async function savePaymentAsPDF(paymentId) {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) {
        if (window.showToast) {
            window.showToast('السند غير موجود', 'error');
        } else {
            alert('⚠️ السند غير موجود');
        }
        return;
    }

    try {
        // Generate payment HTML content
        const paymentContent = await generatePaymentPrintContent(payment);
        
        // Generate default file name
        const defaultFileName = `سند_صرف_${payment.paymentNumber}_${new Date(payment.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(paymentContent, defaultFileName);
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
                console.error('Error saving payment to file:', error);
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
        console.error('Error in savePaymentAsPDF:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
        } else {
            alert('❌ خطأ في حفظ السند: ' + error.message);
        }
    }
}

// Close Modal
function closeModal() {
    document.getElementById('paymentModal').classList.remove('active');
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
window.viewPayment = viewPayment;
window.editPayment = editPayment;
window.deletePayment = deletePayment;
window.savePaymentAsPDF = savePaymentAsPDF;
window.printPayment = printPayment;

