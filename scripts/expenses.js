// Operating Expenses Management System

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

// Convert number to Arabic words
function numberToArabicWords(number) {
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const thousands = ['', 'ألف', 'ألفان', 'ثلاثة آلاف', 'أربعة آلاف', 'خمسة آلاف', 'ستة آلاف', 'سبعة آلاف', 'ثمانية آلاف', 'تسعة آلاف'];
    
    if (number === 0) return 'صفر';
    if (number < 0) return 'سالب ' + numberToArabicWords(-number);
    
    let result = '';
    const num = Math.floor(number);
    const decimal = Math.round((number - num) * 100);
    
    // Handle thousands
    if (num >= 1000) {
        const thousandsPart = Math.floor(num / 1000);
        if (thousandsPart <= 9) {
            result += thousands[thousandsPart] + ' ';
        } else {
            result += numberToArabicWords(thousandsPart) + ' ألف ';
        }
    }
    
    // Handle hundreds
    const hundredsPart = Math.floor((num % 1000) / 100);
    if (hundredsPart > 0) {
        result += hundreds[hundredsPart] + ' ';
    }
    
    // Handle tens and ones
    const remainder = num % 100;
    if (remainder > 0) {
        if (remainder < 10) {
            result += ones[remainder] + ' ';
        } else if (remainder < 20) {
            if (remainder === 10) {
                result += 'عشرة ';
            } else if (remainder === 11) {
                result += 'أحد عشر ';
            } else if (remainder === 12) {
                result += 'اثنا عشر ';
            } else {
                result += ones[remainder % 10] + ' عشر ';
            }
        } else {
            const onesPart = remainder % 10;
            const tensPart = Math.floor(remainder / 10);
            if (onesPart > 0) {
                result += ones[onesPart] + ' و';
            }
            result += tens[tensPart] + ' ';
        }
    }
    
    // Handle decimal part
    if (decimal > 0) {
        result += 'و ' + numberToArabicWords(decimal) + ' قرش ';
    }
    
    return result.trim() + ' جنيه';
}

let expenses = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredExpenses = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let expenseTypeFilter = '';
let categoryFilter = '';
let sortBy = 'date-desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // New Expense Button (in header)
    const newExpenseBtn = document.getElementById('newExpenseBtn');
    if (newExpenseBtn) {
        newExpenseBtn.addEventListener('click', () => {
            openNewExpense();
        });
    }
    
    // Empty State Add Button
    const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateAddBtn) {
        emptyStateAddBtn.addEventListener('click', () => {
            openNewExpense();
        });
    }

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('expenseForm').addEventListener('submit', handleFormSubmit);

    // Close modal on backdrop click
    document.getElementById('expenseModal').addEventListener('click', (e) => {
        if (e.target.id === 'expenseModal') {
            closeModal();
        }
    });

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;

    // Expense Type Change Handler
    const expenseTypeSelect = document.getElementById('expenseType');
    const operationalCategoryRow = document.getElementById('operationalCategoryRow');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    
    if (expenseTypeSelect && operationalCategoryRow && expenseCategorySelect) {
        expenseTypeSelect.addEventListener('change', (e) => {
            const expenseType = e.target.value;
            if (expenseType === 'operational') {
                operationalCategoryRow.style.display = 'flex';
                expenseCategorySelect.required = true;
            } else {
                operationalCategoryRow.style.display = 'none';
                expenseCategorySelect.required = false;
                expenseCategorySelect.value = '';
            }
        });
    }

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
    
    // Expense Type Filter Change Handler
    const expenseTypeFilterSelect = document.getElementById('expenseTypeFilter');
    const operationalCategoryFilterRow = document.getElementById('operationalCategoryFilterRow');
    const categoryFilterSelect = document.getElementById('categoryFilter');
    
    if (expenseTypeFilterSelect && operationalCategoryFilterRow && categoryFilterSelect) {
        expenseTypeFilterSelect.addEventListener('change', (e) => {
            expenseTypeFilter = e.target.value;
            if (expenseTypeFilter === 'operational') {
                operationalCategoryFilterRow.style.display = 'flex';
            } else {
                operationalCategoryFilterRow.style.display = 'none';
                categoryFilter = '';
                categoryFilterSelect.value = '';
            }
            currentPage = 1;
            applyFilters();
        });
        
        categoryFilterSelect.addEventListener('change', (e) => {
            categoryFilter = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }
    
    document.getElementById('sortBy').addEventListener('change', (e) => {
        sortBy = e.target.value;
        currentPage = 1;
        applyFilters();
    });
    
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('expenseTypeFilter').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('sortBy').value = 'date-desc';
        if (operationalCategoryFilterRow) {
            operationalCategoryFilterRow.style.display = 'none';
        }
        searchQuery = '';
        dateFrom = '';
        dateTo = '';
        expenseTypeFilter = '';
        categoryFilter = '';
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
        const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });
}

// Load Data
async function loadData() {
    try {
        // Ensure columns exist before loading
        await ensureExpenseColumnsExist();
        
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            console.log('Loading expenses from database...');
            expenses = await window.electronAPI.dbGetAll('operating_expenses', '', []);
            console.log('Raw expenses from database:', expenses);
            // Ensure expenses is an array
            expenses = Array.isArray(expenses) ? expenses : [];
            console.log('Expenses array length:', expenses.length);
        } else {
            console.log('electronAPI not available, using localStorage');
            // Fallback to localStorage
            const stored = localStorage.getItem('asel_operating_expenses');
            expenses = stored ? JSON.parse(stored) : [];
        }
        
        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('Expenses sorted, first expense:', expenses[0]);
    } catch (error) {
        console.error('Error loading expenses:', error);
        console.error('Error stack:', error.stack);
        expenses = [];
    }
}

// Open New Expense
function openNewExpense() {
    document.getElementById('isEdit').value = 'false';
    document.getElementById('expenseId').value = '';
    document.getElementById('modalTitle').textContent = 'مصروف جديد';
    document.getElementById('expenseForm').reset();
    
    // Reset expense type and category visibility
    const operationalCategoryRow = document.getElementById('operationalCategoryRow');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    if (operationalCategoryRow) {
        operationalCategoryRow.style.display = 'none';
    }
    if (expenseCategorySelect) {
        expenseCategorySelect.required = false;
    }
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
    
    document.getElementById('expenseModal').classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        // Try to focus on first input field
        const firstInput = document.querySelector('#expenseModal input:not([type="hidden"]), #expenseModal select, #expenseModal textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 50);
        }
    }, 100);
}

// Close Modal
function closeModal() {
    document.getElementById('expenseModal').classList.remove('active');
    document.getElementById('expenseForm').reset();
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

// Ensure Database Columns Exist
async function ensureExpenseColumnsExist() {
    if (!window.electronAPI || !window.electronAPI.dbQuery) {
        console.warn('electronAPI or dbQuery not available');
        return;
    }
    
    try {
        // Try to add expenseNumber column (ignore if already exists)
        try {
            console.log('Attempting to add expenseNumber column...');
            const result = await window.electronAPI.dbQuery('ALTER TABLE operating_expenses ADD COLUMN expenseNumber TEXT', []);
            console.log('expenseNumber column added successfully, result:', result);
        } catch (alterError) {
            // Column might already exist, ignore
            if (alterError.message && (alterError.message.includes('duplicate column') || alterError.message.includes('already exists'))) {
                console.log('expenseNumber column already exists');
            } else {
                console.error('Error adding expenseNumber column:', alterError);
                console.error('Error message:', alterError.message);
            }
        }
        
        // Try to add recipientName column (ignore if already exists)
        try {
            console.log('Attempting to add recipientName column...');
            const result = await window.electronAPI.dbQuery('ALTER TABLE operating_expenses ADD COLUMN recipientName TEXT', []);
            console.log('recipientName column added successfully, result:', result);
        } catch (alterError) {
            // Column might already exist, ignore
            if (alterError.message && (alterError.message.includes('duplicate column') || alterError.message.includes('already exists'))) {
                console.log('recipientName column already exists');
            } else {
                console.error('Error adding recipientName column:', alterError);
                console.error('Error message:', alterError.message);
            }
        }
    } catch (error) {
        console.error('Error ensuring expense columns exist:', error);
        console.error('Error stack:', error.stack);
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();

    // Ensure columns exist before saving
    console.log('Ensuring columns exist before saving...');
    await ensureExpenseColumnsExist();
    console.log('Columns check completed');

    const date = document.getElementById('expenseDate').value;
    const expenseType = document.getElementById('expenseType').value;
    const category = expenseType === 'salaries' ? 'salaries' : document.getElementById('expenseCategory').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const recipientName = document.getElementById('recipientName').value.trim();
    const description = document.getElementById('expenseDescription').value.trim();

    if (!expenseType) {
        if (window.showToast) {
            window.showToast('يرجى اختيار نوع المصروف', 'error');
        } else {
            alert('⚠️ يرجى اختيار نوع المصروف');
        }
        return;
    }

    if (expenseType === 'operational' && !category) {
        if (window.showToast) {
            window.showToast('يرجى اختيار نوع المصروف التشغيلي', 'error');
        } else {
            alert('⚠️ يرجى اختيار نوع المصروف التشغيلي');
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

    if (!recipientName) {
        if (window.showToast) {
            window.showToast('يرجى إدخال اسم المستلم', 'error');
        } else {
            alert('⚠️ يرجى إدخال اسم المستلم');
        }
        return;
    }

    const expenseId = document.getElementById('expenseId').value || `expense_${Date.now()}`;
    const isEdit = document.getElementById('isEdit').value === 'true';

    const expenseData = {
        id: expenseId,
        expenseNumber: isEdit ? 
            (expenses.find(e => e.id === expenseId)?.expenseNumber || await generateExpenseNumber()) : 
            await generateExpenseNumber(),
        date: date,
        category: category,
        amount: amount,
        recipientName: recipientName || null,
        description: description || null,
        updatedAt: new Date().toISOString()
    };

    try {
        // Save to database if available
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            if (isEdit) {
                // Update existing expense
                const updateResult = await window.electronAPI.dbUpdate('operating_expenses', expenseId, expenseData);
                
                // Check if update was successful
                if (updateResult && updateResult.success === false) {
                    throw new Error(updateResult.error || 'فشل تحديث المصروف في قاعدة البيانات');
                }
                
                // Update local array
                const index = expenses.findIndex(e => e.id === expenseId);
                if (index !== -1) {
                    expenses[index] = expenseData;
                }
            } else {
                expenseData.createdAt = new Date().toISOString();
                console.log('Inserting expense:', expenseData);
                const insertResult = await window.electronAPI.dbInsert('operating_expenses', expenseData);
                console.log('Insert result:', insertResult);
                
                // Check if insert was successful
                if (insertResult && insertResult.success === false) {
                    throw new Error(insertResult.error || 'فشل حفظ المصروف في قاعدة البيانات');
                }
                
                // Add to local array
                expenses.push(expenseData);
                console.log('Expense added to local array, total expenses:', expenses.length);
            }
        } else {
            // Fallback to localStorage
            if (isEdit) {
                const index = expenses.findIndex(e => e.id === expenseId);
                if (index !== -1) {
                    expenses[index] = expenseData;
                }
            } else {
                expenseData.createdAt = new Date().toISOString();
                expenses.push(expenseData);
            }
            saveExpenses();
        }

        // Reload data from database to ensure we have the latest data
        console.log('Reloading data from database...');
        await loadData();
        console.log('Loaded expenses count:', expenses.length);
        
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        currentPage = 1;
        console.log('Applying filters...');
        applyFilters();
        console.log('Filters applied, filtered expenses count:', filteredExpenses.length);
        
        // Notify other screens about expense update
        localStorage.setItem('last_expense_update', JSON.stringify({
            timestamp: Date.now(),
            action: isEdit ? 'update' : 'create',
            expenseId: expenseId
        }));
        
        // Broadcast to other windows
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('expense-updates');
                channel.postMessage({
                    type: 'expenseUpdated',
                    action: isEdit ? 'update' : 'create',
                    expenseId: expenseId,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error broadcasting expense update:', error);
            }
        }
        
        closeModal();
        if (window.showToast) {
            window.showToast('تم حفظ المصروف بنجاح', 'success');
        } else {
            alert('✓ تم حفظ المصروف بنجاح');
        }
    } catch (error) {
        console.error('Error saving expense:', error);
        console.error('Error details:', error.message, error.stack);
        console.error('Expense data:', expenseData);
        if (window.showToast) {
            window.showToast('خطأ في حفظ المصروف: ' + error.message, 'error');
        } else {
            alert('✗ خطأ في حفظ المصروف: ' + error.message);
        }
    }
}

// Generate Expense Number
async function generateExpenseNumber() {
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all expenses from database
            const allExpenses = await window.electronAPI.dbGetAll('operating_expenses', '', []);
            
            if (allExpenses && allExpenses.length > 0) {
                // Filter expenses with numbers matching current year pattern
                const currentYearNumbers = allExpenses
                    .map(expense => expense.expenseNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from expense numbers (e.g., "EXP-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem('asel_expense_counter', counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating expense number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem('asel_expense_counter') || '0');
    counter++;
    localStorage.setItem('asel_expense_counter', counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Save Expenses to localStorage
function saveExpenses() {
    localStorage.setItem('asel_operating_expenses', JSON.stringify(expenses));
}

// Render Expenses
// Apply Filters
function applyFilters() {
    // Start with all expenses
    filteredExpenses = [...expenses];
    
    // Apply search filter
    if (searchQuery) {
        const term = searchQuery.toLowerCase().trim();
        filteredExpenses = filteredExpenses.filter(expense => {
            const categoryName = getCategoryName(expense.category);
            const description = (expense.description || '').toLowerCase();
            return categoryName.toLowerCase().includes(term) || description.includes(term);
        });
    }
    
    // Apply date filter
    if (dateFrom) {
        filteredExpenses = filteredExpenses.filter(expense => {
            return new Date(expense.date) >= new Date(dateFrom);
        });
    }
    
    if (dateTo) {
        filteredExpenses = filteredExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // Include the entire day
            return expenseDate <= toDate;
        });
    }
    
    // Apply expense type filter
    if (expenseTypeFilter) {
        if (expenseTypeFilter === 'salaries') {
            filteredExpenses = filteredExpenses.filter(expense => {
                return expense.category === 'salaries';
            });
        } else if (expenseTypeFilter === 'operational') {
            // Filter operational expenses
            filteredExpenses = filteredExpenses.filter(expense => {
                return expense.category !== 'salaries';
            });
            
            // Apply operational category filter if specified
            if (categoryFilter) {
                filteredExpenses = filteredExpenses.filter(expense => {
                    return expense.category === categoryFilter;
                });
            }
        }
    } else if (categoryFilter) {
        // If only category filter is set (for backward compatibility)
        filteredExpenses = filteredExpenses.filter(expense => {
            return expense.category === categoryFilter;
        });
    }
    
    // Apply sorting
    filteredExpenses.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return new Date(b.date) - new Date(a.date);
            case 'date-asc':
                return new Date(a.date) - new Date(b.date);
            case 'amount-desc':
                return (b.amount || 0) - (a.amount || 0);
            case 'amount-asc':
                return (a.amount || 0) - (b.amount || 0);
            default:
                return new Date(b.date) - new Date(a.date);
        }
    });
    
    // Reset to first page if current page is out of bounds
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    // Render paginated expenses
    renderExpenses();
}

// Get Category Name
function getCategoryName(category) {
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
    return categoryNames[category] || category;
}

function renderExpenses() {
    const tbody = document.getElementById('expensesTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');

    tbody.innerHTML = '';

    if (filteredExpenses.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredExpenses.length);
    const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteExpenses = currentUserType === 'manager' || currentUserType === 'system_engineer';
    const canEditExpenses = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredExpenses.length}`;
    
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

    const categoryNames = {
        salaries: 'مرتبات',
        car: 'مصاريف تشغيل سيارة',
        shipping: 'شحن',
        rent: 'إيجار',
        electricity: 'كهرباء',
        internet: 'إنترنت',
        packaging: 'تغليف',
        maintenance: 'صيانة',
        other: 'مصروفات أخرى'
    };

    paginatedExpenses.forEach(expense => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(expense.date).toLocaleDateString('ar-EG')}</td>
            <td><span class="category-badge">${getCategoryName(expense.category)}</span></td>
            <td class="expense-amount-cell"><strong>${formatArabicCurrency(expense.amount)}</strong></td>
            <td>${expense.recipientName || '-'}</td>
            <td>${expense.description || '-'}</td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-expense-id="${expense.id}" title="عرض">👁️</button>
                    <button class="action-btn print" data-expense-id="${expense.id}" title="طباعة">🖨️</button>
                    <button class="action-btn save" data-expense-id="${expense.id}" title="حفظ">💾</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const printBtn = row.querySelector('.action-btn.print');
        const saveBtn = row.querySelector('.action-btn.save');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewExpense(expense.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printExpense(expense.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveExpenseAsPDF(expense.id));
        }
        
        // Add edit button only for manager or system_engineer
        if (canEditExpenses) {
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn edit';
            editBtn.textContent = '✏️';
            editBtn.type = 'button';
            editBtn.title = 'تعديل';
            editBtn.setAttribute('data-expense-id', expense.id);
            editBtn.addEventListener('click', () => editExpense(expense.id));
            if (actionsDiv) {
                actionsDiv.appendChild(editBtn);
            }
        }
        
        // Add delete button only for manager or system_engineer
        if (canDeleteExpenses) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-expense-id', expense.id);
            deleteBtn.addEventListener('click', () => deleteExpense(expense.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        
        tbody.appendChild(row);
    });
}

// Edit Expense
function editExpense(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    document.getElementById('isEdit').value = 'true';
    document.getElementById('expenseId').value = expense.id;
    document.getElementById('modalTitle').textContent = 'تعديل مصروف';
    document.getElementById('expenseDate').value = expense.date.split('T')[0];
    
    // Set expense type and category
    const expenseTypeSelect = document.getElementById('expenseType');
    const operationalCategoryRow = document.getElementById('operationalCategoryRow');
    const expenseCategorySelect = document.getElementById('expenseCategory');
    
    if (expense.category === 'salaries') {
        expenseTypeSelect.value = 'salaries';
        if (operationalCategoryRow) {
            operationalCategoryRow.style.display = 'none';
        }
        if (expenseCategorySelect) {
            expenseCategorySelect.required = false;
            expenseCategorySelect.value = '';
        }
    } else {
        expenseTypeSelect.value = 'operational';
        if (operationalCategoryRow) {
            operationalCategoryRow.style.display = 'flex';
        }
        if (expenseCategorySelect) {
            expenseCategorySelect.required = true;
            expenseCategorySelect.value = expense.category;
        }
    }
    
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('recipientName').value = expense.recipientName || '';
    document.getElementById('expenseDescription').value = expense.description || '';

    document.getElementById('expenseModal').classList.add('active');
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

// Delete Expense
async function deleteExpense(expenseId) {
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذا المصروف؟',
        () => {
            // User confirmed - proceed with deletion
            proceedWithExpenseDeletion(expenseId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with expense deletion
async function proceedWithExpenseDeletion(expenseId) {

    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    try {
        // Delete from database if available
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('operating_expenses', expenseId);
        } else {
            // Fallback to localStorage
            saveExpenses();
        }

        expenses = expenses.filter(e => e.id !== expenseId);
        currentPage = 1;
        applyFilters();
        
        // Notify other screens about expense deletion
        localStorage.setItem('last_expense_update', JSON.stringify({
            timestamp: Date.now(),
            action: 'delete',
            expenseId: expenseId
        }));
        
        // Broadcast to other windows
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('expense-updates');
                channel.postMessage({
                    type: 'expenseUpdated',
                    action: 'delete',
                    expenseId: expenseId,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error broadcasting expense deletion:', error);
            }
        }
        
        if (window.showToast) {
            window.showToast('تم حذف المصروف بنجاح', 'success');
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        if (window.showToast) {
            window.showToast('خطأ في حذف المصروف: ' + error.message, 'error');
        }
    }
}

// Get Company Settings
async function getCompanySettings() {
    try {
        if (window.electronAPI && window.electronAPI.dbGet) {
            const companyInfo = await window.electronAPI.dbGet('company_info', 'company_001');
            return {
                name: companyInfo?.name || 'شركة أسيل',
                address: companyInfo?.address || '',
                phone: companyInfo?.phone || '',
                mobile: companyInfo?.mobile || '',
                email: companyInfo?.email || '',
                taxId: companyInfo?.taxId || '',
                commercialRegister: companyInfo?.commercialRegister || '',
                accountantName: companyInfo?.accountantName || '',
                accountantPhone: companyInfo?.accountantPhone || ''
            };
        }
    } catch (error) {
        console.error('Error loading company settings:', error);
    }
    return {
        name: 'شركة أسيل',
        address: '',
        phone: '',
        mobile: '',
        email: '',
        taxId: '',
        commercialRegister: '',
        accountantName: '',
        accountantPhone: ''
    };
}

// Generate Expense Print Content
async function generateExpensePrintContent(expense) {
    const companySettings = await getCompanySettings();
    const categoryNames = {
        salaries: 'مرتبات',
        car: 'مصاريف تشغيل سيارة',
        shipping: 'شحن',
        rent: 'إيجار',
        electricity: 'كهرباء',
        internet: 'إنترنت',
        packaging: 'تغليف',
        maintenance: 'صيانة',
        other: 'مصروفات أخرى'
    };
    
    const categoryName = categoryNames[expense.category] || expense.category;
    const amountInWords = numberToArabicWords(expense.amount);
    const expenseDate = new Date(expense.date);
    const day = expenseDate.getDate();
    const month = expenseDate.getMonth() + 1;
    const year = expenseDate.getFullYear();
    
    // Get recipient name and purpose from expense data
    const recipientName = expense.recipientName || '';
    const purpose = expense.description || '';
    
    // Generate dynamic text based on category
    let recipientLabel = 'إلى السيد /';
    let recipientRole = '';
    let purposeLabel = 'وذلك مقابل';
    
    switch(expense.category) {
        case 'salaries':
            recipientRole = 'بصفته موظف';
            purposeLabel = 'وذلك مقابل مرتب';
            break;
        case 'car':
            recipientRole = 'بصفته سائق السيارة رقم (.......................)';
            purposeLabel = 'وذلك مقابل مصاريف تشغيل السيارة وتشمل (...............................)';
            break;
        case 'rent':
            recipientRole = 'بصفته مالك العقار';
            purposeLabel = 'وذلك مقابل إيجار';
            break;
        case 'electricity':
            recipientRole = 'بصفته مقدم الخدمة';
            purposeLabel = 'وذلك مقابل فاتورة كهرباء';
            break;
        case 'internet':
            recipientRole = 'بصفته مقدم الخدمة';
            purposeLabel = 'وذلك مقابل فاتورة إنترنت';
            break;
        case 'shipping':
            recipientRole = 'بصفته شركة الشحن';
            purposeLabel = 'وذلك مقابل مصاريف شحن';
            break;
        case 'packaging':
            recipientRole = 'بصفته مقدم الخدمة';
            purposeLabel = 'وذلك مقابل مصاريف تغليف';
            break;
        case 'maintenance':
            recipientRole = 'بصفته مقدم الخدمة';
            purposeLabel = 'وذلك مقابل مصاريف صيانة';
            break;
        default:
            recipientRole = 'بصفته المستلم';
            purposeLabel = 'وذلك مقابل';
    }
    
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سند صرف ${expense.expenseNumber || ''}</title>
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
        .voucher-content {
            margin: 20px 0;
            line-height: 2;
            font-size: 16px;
        }
        .voucher-content p {
            margin: 15px 0;
        }
        .amount-line {
            margin: 20px 0;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
        }
        .signature-box {
            width: 30%;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 10px;
            margin-top: 50px;
        }
        .info-line {
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
        }
        .info-label {
            font-weight: bold;
            width: 150px;
        }
        .info-value {
            flex: 1;
            border-bottom: 1px dotted #333;
            padding-right: 10px;
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
        <div class="voucher-title">سند صرف نقدي – ${categoryName}</div>
        <div class="voucher-content">
            <p>تم صرف مبلغ وقدره: <strong>${formatArabicCurrency(expense.amount)}</strong></p>
            <div class="amount-line">
                <p>فقط وقدره: <strong>${amountInWords}</strong></p>
            </div>
            <p>${recipientLabel} ${recipientName || '____________________'}</p>
            ${recipientRole ? `<p>${recipientRole}</p>` : ''}
            <p>${purposeLabel} ${purpose || '_______________________'}</p>
            ${expense.category !== 'salaries' ? `
            <p>ويتعهد المستلم بتقديم ما يثبت صرف المبلغ في الغرض المخصص له خلال المدة المحددة،</p>
            <p>كما يتعهد برد أي مبالغ متبقية لم تُصرف.</p>
            ` : ''}
            <div class="info-line">
                <span class="info-label">تاريخ الصرف:</span>
                <span class="info-value">${day} / ${month} / ${year}</span>
            </div>
            <div class="info-line">
                <span class="info-label">رقم السند:</span>
                <span class="info-value">${expense.expenseNumber || '____________'}</span>
            </div>
        </div>
        <div class="signature-section">
            <div class="signature-box">
                <div>المستلم: ____________________</div>
                <div>(توقيع المستلم)</div>
            </div>
            <div class="signature-box">
                <div>اسم المحاسب: ${companySettings.accountantName || '____________________'}</div>
            </div>
            <div class="signature-box">
                <div>اعتماد المدير المالي / الإدارة: ____________________</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

// View Expense
async function viewExpense(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) {
        if (window.showToast) {
            window.showToast('المصروف غير موجود', 'error');
        }
        return;
    }

    try {
        const printContent = await generateExpensePrintContent(expense);
        const viewWindow = window.open('', '_blank');
        viewWindow.document.write(printContent);
        viewWindow.document.close();
    } catch (error) {
        console.error('Error viewing expense:', error);
        if (window.showToast) {
            window.showToast('خطأ في عرض المصروف: ' + error.message, 'error');
        }
    }
}

// Print Expense
async function printExpense(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) {
        if (window.showToast) {
            window.showToast('المصروف غير موجود', 'error');
        }
        return;
    }

    try {
        const printContent = await generateExpensePrintContent(expense);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    } catch (error) {
        console.error('Error printing expense:', error);
        if (window.showToast) {
            window.showToast('خطأ في طباعة المصروف: ' + error.message, 'error');
        }
    }
}

// Save Expense as PDF
async function saveExpenseAsPDF(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) {
        if (window.showToast) {
            window.showToast('المصروف غير موجود', 'error');
        }
        return;
    }

    try {
        const expenseContent = await generateExpensePrintContent(expense);
        
        // Generate default file name
        const defaultFileName = `سند_صرف_${expense.expenseNumber || expense.id}_${new Date(expense.date).toISOString().split('T')[0]}.pdf`;
        
        // Save to file
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            try {
                const result = await window.electronAPI.saveInvoiceToFile(expenseContent, defaultFileName);
                if (result.success) {
                    if (window.showToast) {
                        window.showToast('تم حفظ السند بنجاح', 'success');
                    }
                } else {
                    if (window.showToast) {
                        window.showToast('فشل حفظ السند: ' + (result.error || 'خطأ غير معروف'), 'error');
                    }
                }
            } catch (error) {
                console.error('Error saving expense to file:', error);
                if (window.showToast) {
                    window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
                }
            }
        } else {
            if (window.showToast) {
                window.showToast('وظيفة الحفظ غير متاحة', 'error');
            }
        }
    } catch (error) {
        console.error('Error in saveExpenseAsPDF:', error);
        if (window.showToast) {
            window.showToast('خطأ في حفظ السند: ' + error.message, 'error');
        }
    }
}

// Make functions global for onclick handlers
window.viewExpense = viewExpense;
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.printExpense = printExpense;
window.saveExpenseAsPDF = saveExpenseAsPDF;

