// Delivery Notes Management System (نظام إدارة أذون الصرف)

// Storage Keys
const STORAGE_KEYS = {
    DELIVERY_NOTES: 'asel_delivery_notes',
    PRODUCTS: 'asel_products',
    DELIVERY_NOTE_COUNTER: 'asel_delivery_note_counter'
};

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

// Format currency with Arabic numerals
function formatCurrency(amount, currency = 'ج.م', decimals = 2) {
    return formatArabicNumber(amount, decimals) + ' ' + currency;
}

// Initialize
let deliveryNotes = [];
let products = [];
let noteProducts = [];
let currentNote = null;

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredNotes = [];
let searchQuery = '';
let dateFrom = '';
let dateTo = '';
let statusFilter = '';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderProducts();
    applyFilters();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // New Note Button
    const newNoteBtn = document.getElementById('newNoteBtn');
    if (newNoteBtn) {
        newNoteBtn.addEventListener('click', openNewNote);
    }
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            if (newNoteBtn) {
                newNoteBtn.click();
            }
        });
    }

    // Modal Close
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    if (closeModal) closeModal.addEventListener('click', closeModalHandler);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModalHandler);

    // Close modal on backdrop click
    const noteModal = document.getElementById('noteModal');
    if (noteModal) {
        noteModal.addEventListener('click', (e) => {
            if (e.target.id === 'noteModal') {
                closeModalHandler();
            }
        });
    }

    // Form Submit
    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        noteForm.addEventListener('submit', handleFormSubmit);
    }

    // Add Product Button
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', addProductToNote);
    }

    // Set today's date as default
    const dateInput = document.getElementById('noteDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Pagination Event Listeners
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                applyFilters();
            }
        });
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                applyFilters();
            }
        });
    }

    // Search & Filter Event Listeners
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const statusFilterSelect = document.getElementById('statusFilter');
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

    if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', (e) => {
            statusFilter = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            if (statusFilterSelect) statusFilterSelect.value = '';
            searchQuery = '';
            dateFrom = '';
            dateTo = '';
            statusFilter = '';
            currentPage = 1;
            applyFilters();
        });
    }
}

// Load Data
async function loadData() {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            deliveryNotes = await window.electronAPI.dbGetAll('delivery_notes', '', []);
            products = await window.electronAPI.dbGetAll('products', '', []);
            
            deliveryNotes = Array.isArray(deliveryNotes) ? deliveryNotes : [];
            products = Array.isArray(products) ? products : [];
            
            // Load note items for each note
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
            console.error('Error loading from database:', error);
        }
    }
}

// Generate Delivery Note Number
async function generateDeliveryNoteNumber() {
    const year = new Date().getFullYear();
    const prefix = `DN-${year}-`;
    
    // Try to get counter from database first (more reliable)
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all delivery notes from database
            const allNotes = await window.electronAPI.dbGetAll('delivery_notes', '', []);
            
            if (allNotes && allNotes.length > 0) {
                // Filter notes with numbers matching current year pattern
                const currentYearNumbers = allNotes
                    .map(note => note.deliveryNoteNumber)
                    .filter(number => number && number.startsWith(prefix));
                
                // Extract numbers from note numbers (e.g., "DN-2025-001" -> 1)
                const numbers = currentYearNumbers.map(number => {
                    const match = number.match(new RegExp(`${prefix}(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                });
                
                // Get maximum number
                const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
                const counter = maxNumber + 1;
                
                // Save to localStorage as backup
                localStorage.setItem(STORAGE_KEYS.DELIVERY_NOTE_COUNTER, counter.toString());
                
                return `${prefix}${String(counter).padStart(3, '0')}`;
            }
        } catch (error) {
            console.error('Error generating delivery note number from database:', error);
            // Fallback to localStorage
        }
    }
    
    // Fallback: use localStorage counter
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.DELIVERY_NOTE_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.DELIVERY_NOTE_COUNTER, counter.toString());
    
    return `${prefix}${String(counter).padStart(3, '0')}`;
}

// Render Products (for searchable dropdown)
function renderProducts() {
    setupProductSearch();
}

// Setup Product Search
function setupProductSearch() {
    const searchInput = document.getElementById('productSearch');
    const hiddenInput = document.getElementById('productSelect');
    const dropdown = document.getElementById('productDropdown');
    
    if (!searchInput || !hiddenInput || !dropdown) return;
    
    let selectedProduct = null;
    
    function filterProducts(searchTerm) {
        const activeProducts = products.filter(p => (p.status === 'active' || !p.status) && (p.stock > 0 || !p.stock));
        
        if (!searchTerm || searchTerm.trim() === '') {
            return activeProducts.slice(0, 10);
        }
        
        const term = searchTerm.toLowerCase().trim();
        return activeProducts.filter(product => {
            const name = (product.name || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            const code = (product.code || '').toLowerCase();
            return name.includes(term) || category.includes(term) || code.includes(term);
        }).slice(0, 20);
    }
    
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
            const stock = product.stock || 0;
            item.innerHTML = `
                <div class="product-name">${product.name}</div>
                <div class="product-category">${product.category || 'غير محدد'} - المخزون: ${formatArabicNumber(stock)}</div>
            `;
            item.addEventListener('click', () => {
                selectedProduct = product;
                searchInput.value = `${product.name} - ${product.category || 'غير محدد'}`;
                hiddenInput.value = product.id;
                dropdown.classList.remove('active');
                document.getElementById('productQuantity')?.focus();
            });
            dropdown.appendChild(item);
        });
        
        dropdown.classList.add('active');
    }
    
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
    
    searchInput.addEventListener('focus', () => {
        const term = searchInput.value;
        const filtered = filterProducts(term);
        renderDropdown(filtered);
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.product-search-wrapper')) {
            dropdown.classList.remove('active');
        }
    });
}

// Open New Note
async function openNewNote() {
    currentNote = null;
    noteProducts = [];
    const isEdit = document.getElementById('isEdit');
    const noteId = document.getElementById('noteId');
    const modalTitle = document.getElementById('modalTitle');
    const noteForm = document.getElementById('noteForm');
    
    if (isEdit) isEdit.value = 'false';
    if (noteId) noteId.value = '';
    if (modalTitle) modalTitle.textContent = 'إذن صرف جديد';
    if (noteForm) noteForm.reset();
    
    const noteProductsBody = document.getElementById('noteProductsBody');
    if (noteProductsBody) noteProductsBody.innerHTML = '';
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('noteDate');
    if (dateInput) dateInput.value = today;
    
    // Load warehouse keeper name from company_info as default (can be edited)
    const warehouseKeeperNameInput = document.getElementById('warehouseKeeperName');
    if (warehouseKeeperNameInput) {
        try {
            const companySettings = await getCompanySettings();
            warehouseKeeperNameInput.value = companySettings.warehouseKeeperName || '';
        } catch (error) {
            console.error('Error loading warehouse keeper name:', error);
            warehouseKeeperNameInput.value = '';
        }
    }
    
    const productSearch = document.getElementById('productSearch');
    const productSelect = document.getElementById('productSelect');
    const productDropdown = document.getElementById('productDropdown');
    if (productSearch) productSearch.value = '';
    if (productSelect) productSelect.value = '';
    if (productDropdown) productDropdown.classList.remove('active');
    
    setupProductSearch();
    
    const noteModal = document.getElementById('noteModal');
    if (noteModal) noteModal.classList.add('active');
}

// Add Product to Note
function addProductToNote() {
    const productSelect = document.getElementById('productSelect');
    const quantityInput = document.getElementById('productQuantity');
    const unitSelect = document.getElementById('productUnit');
    
    if (!productSelect || !productSelect.value) {
        showMessage('يرجى اختيار منتج أولاً', 'error');
        return;
    }
    
    if (!quantityInput || !quantityInput.value) {
        showMessage('يرجى إدخال الكمية', 'error');
        return;
    }
    
    const productData = products.find(p => p.id === productSelect.value);
    if (!productData) {
        showMessage('المنتج غير موجود', 'error');
        return;
    }
    
    const quantity = parseFloat(quantityInput.value);
    const unit = unitSelect.value;
    
    // Check stock availability
    let availableStock = productData.stock || 0;
    if (unit === 'largest') {
        const conversionFactor = productData.conversionFactor || 1;
        availableStock = availableStock / conversionFactor;
    }
    
    if (quantity > availableStock) {
        showMessage(`الكمية المتاحة في المخزون: ${formatArabicNumber(availableStock)} ${unit === 'largest' ? productData.largestUnit : productData.smallestUnit}`, 'error');
        return;
    }
    
    // Check if product already exists in note
    const existingProduct = noteProducts.find(p => p.productId === productData.id && p.unit === unit);
    if (existingProduct) {
        const newQuantity = existingProduct.quantity + quantity;
        if (unit === 'largest') {
            const conversionFactor = productData.conversionFactor || 1;
            if (newQuantity > availableStock) {
                showMessage(`الكمية المتاحة في المخزون: ${formatArabicNumber(availableStock)} ${productData.largestUnit}`, 'error');
                return;
            }
        } else {
            if (newQuantity > availableStock) {
                showMessage(`الكمية المتاحة في المخزون: ${formatArabicNumber(availableStock)} ${productData.smallestUnit}`, 'error');
                return;
            }
        }
        existingProduct.quantity = newQuantity;
    } else {
        const noteProduct = {
            productId: productData.id,
            productName: productData.name,
            productCode: productData.code || '',
            quantity: quantity,
            unit: unit,
            unitName: unit === 'smallest' ? productData.smallestUnit : productData.largestUnit,
            reservedQuantity: 0,
            availableQuantity: quantity
        };
        noteProducts.push(noteProduct);
    }
    
    renderNoteProducts();
    
    // Reset inputs
    if (productSelect) productSelect.value = '';
    const productSearch = document.getElementById('productSearch');
    if (productSearch) productSearch.value = '';
    if (quantityInput) quantityInput.value = '';
    if (unitSelect) unitSelect.value = 'smallest';
    const productDropdown = document.getElementById('productDropdown');
    if (productDropdown) productDropdown.classList.remove('active');
}

// Remove Product from Note
function removeProduct(index) {
    noteProducts.splice(index, 1);
    renderNoteProducts();
}

// Render Note Products
function renderNoteProducts() {
    const tbody = document.getElementById('noteProductsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    noteProducts.forEach((product, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.productName} (${product.productCode})</td>
            <td>${formatArabicNumber(product.quantity)}</td>
            <td>${product.unitName}</td>
            <td>
                <button type="button" class="action-btn delete" data-product-index="${index}" title="حذف">🗑️</button>
            </td>
        `;
        
        // Add event listener to delete button
        const deleteBtn = row.querySelector('.action-btn.delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => removeProductFromNote(index));
        }
        
        tbody.appendChild(row);
    });
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const warehouseKeeperName = document.getElementById('warehouseKeeperName').value;
    const date = document.getElementById('noteDate').value;
    
    if (!warehouseKeeperName || !warehouseKeeperName.trim()) {
        showMessage('يرجى إدخال اسم أمين المخزن أو التلاجة', 'error');
        return;
    }
    
    if (!date) {
        showMessage('يرجى إدخال تاريخ إذن الصرف', 'error');
        return;
    }
    
    if (noteProducts.length === 0) {
        showMessage('يرجى إضافة منتجات لإذن الصرف', 'error');
        return;
    }
    
    const noteId = currentNote ? currentNote.id : Date.now().toString();
    
    const noteData = {
        id: noteId,
        deliveryNoteNumber: currentNote ? currentNote.deliveryNoteNumber : await generateDeliveryNoteNumber(),
        date: date,
        warehouseKeeperName: warehouseKeeperName.trim(),
        salesRepName: '', // Will be set during settlement
        status: 'issued',
        totalProducts: noteProducts.length,
        notes: document.getElementById('notes').value || '',
        createdAt: currentNote ? currentNote.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        // Save to database
        if (window.electronAPI && window.electronAPI.dbInsert && window.electronAPI.dbUpdate) {
            const noteDbData = { ...noteData };
            delete noteDbData.items;
            
            if (currentNote) {
                // Update existing note
                await window.electronAPI.dbUpdate('delivery_notes', noteId, noteDbData);
                
                // Delete old items
                if (window.electronAPI.dbQuery) {
                    await window.electronAPI.dbQuery('DELETE FROM delivery_note_items WHERE deliveryNoteId = ?', [noteId]);
                } else {
                    const oldItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [noteId]);
                    for (const item of oldItems) {
                        await window.electronAPI.dbDelete('delivery_note_items', item.id);
                    }
                }
                
                // NO stock reversion needed - stock was never deducted when note was created
            } else {
                // Insert new note
                await window.electronAPI.dbInsert('delivery_notes', noteDbData);
            }
            
            // Save note items (NO stock deduction - stock remains in warehouse until settlement)
            for (const product of noteProducts) {
                const itemData = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                    deliveryNoteId: noteId,
                    productId: product.productId,
                    productName: product.productName,
                    productCode: product.productCode || '',
                    quantity: product.quantity || 0,
                    unit: product.unit || '',
                    unitName: product.unitName || '',
                    reservedQuantity: 0,
                    availableQuantity: product.quantity || 0
                };
                await window.electronAPI.dbInsert('delivery_note_items', itemData);
                
                // NO stock update - stock remains in warehouse until settlement
                // Stock will be deducted when settlement is completed
            }
        }
        
        // Update local array
        if (currentNote) {
            const index = deliveryNotes.findIndex(n => n.id === currentNote.id);
            if (index !== -1) {
                deliveryNotes[index] = { ...noteData, items: noteProducts };
            }
        } else {
            deliveryNotes.push({ ...noteData, items: noteProducts });
        }
        
        // Reload from database
        await loadData();
        
        currentPage = 1;
        applyFilters();
        
        closeModalHandler();
        showMessage('تم حفظ إذن الصرف بنجاح', 'success');
    } catch (error) {
        console.error('Error saving delivery note:', error);
        showMessage('خطأ في حفظ إذن الصرف: ' + error.message, 'error');
    }
}

// Update Product Stock from Note (NOT USED - stock remains in warehouse until settlement)
// This function is kept for compatibility but does nothing
async function updateProductStockFromNote(noteProduct) {
    // NO STOCK DEDUCTION - Stock remains in warehouse until settlement
    // Stock will be deducted when settlement is completed
    console.log('Delivery note created - stock remains in warehouse until settlement');
}

// Revert Product Stock from Note (for editing)
// NOT USED - no stock was deducted, so nothing to revert
async function revertProductStockFromNote(noteItem) {
    // NO STOCK REVERSION - No stock was deducted when note was created
    console.log('Delivery note deleted - no stock reversion needed (stock was never deducted)');
}

// Apply Filters
function applyFilters() {
    // Start with all notes
    filteredNotes = [...deliveryNotes];
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredNotes = filteredNotes.filter(note => {
            // Search by delivery note number
            const noteNumber = (note.deliveryNoteNumber || '').toLowerCase();
            if (noteNumber.includes(query)) return true;
            
            // Search by warehouse keeper name
            const keeperName = (note.warehouseKeeperName || note.salesRepName || '').toLowerCase();
            if (keeperName.includes(query)) return true;
            
            return false;
        });
    }
    
    // Apply date range filter
    if (dateFrom) {
        filteredNotes = filteredNotes.filter(note => {
            return new Date(note.date) >= new Date(dateFrom);
        });
    }
    
    if (dateTo) {
        filteredNotes = filteredNotes.filter(note => {
            const noteDate = new Date(note.date);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            return noteDate <= toDate;
        });
    }
    
    // Apply status filter
    if (statusFilter) {
        filteredNotes = filteredNotes.filter(note => {
            return note.status === statusFilter;
        });
    }
    
    // Sort by date (newest first)
    filteredNotes.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Reset to first page if current page is out of bounds
    const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }

    renderNotes();
}

// Render Notes
function renderNotes() {
    const tbody = document.getElementById('notesTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationContainer) paginationContainer.classList.add('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.remove('hidden');
    
    const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredNotes.length);
    const paginatedNotes = filteredNotes.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteNotes = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `عرض ${startIndex + 1} - ${endIndex} من ${filteredNotes.length}`;
    }
    
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
    
    const pageNumbersEl = document.getElementById('pageNumbers');
    if (pageNumbersEl) {
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
    }
    
    paginatedNotes.forEach(note => {
        const statusText = note.status === 'issued' ? 'صادر' : note.status === 'returned' ? 'راجع' : 'تم التسوية';
        const isSettled = note.status === 'settled';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${note.deliveryNoteNumber}</td>
            <td>${new Date(note.date).toLocaleDateString('ar-EG')}</td>
            <td><strong>${note.warehouseKeeperName || note.salesRepName || ''}</strong></td>
            <td>${note.totalProducts || 0}</td>
            <td><span class="status-badge status-${note.status}">${statusText}</span></td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-note-id="${note.id}" title="عرض">👁️</button>
                    <button class="action-btn print" data-note-id="${note.id}" title="طباعة">🖨️</button>
                    <button class="action-btn save" data-note-id="${note.id}" title="حفظ">💾</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        const viewBtn = row.querySelector('.action-btn.view');
        const printBtn = row.querySelector('.action-btn.print');
        const saveBtn = row.querySelector('.action-btn.save');
        const actionsDiv = row.querySelector('.actions-buttons');
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewNote(note.id));
        }
        if (printBtn) {
            printBtn.addEventListener('click', () => printNoteById(note.id));
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveNoteAsPDF(note.id));
        }
        
        // Add delete button only for manager or system_engineer (works for all notes including settled)
        if (canDeleteNotes) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-note-id', note.id);
            deleteBtn.addEventListener('click', () => deleteNote(note.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        
        tbody.appendChild(row);
    });
}

// View Note
async function viewNote(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (!note) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    try {
        const viewContent = await generatePrintContent(note);
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
        console.error('Error viewing note:', error);
        showMessage('خطأ في عرض إذن الصرف: ' + error.message, 'error');
    }
}

// Edit Note
async function editNote(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (!note) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    // Check if note is settled (closed)
    if (note.status === 'settled') {
        showMessage('لا يمكن تعديل إذن الصرف لأنه تمت تسويته (مقفل)', 'error');
        return;
    }
    
    // Check if note has linked invoices
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        const linkedInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'deliveryNoteId = ?', [noteId]);
        if (linkedInvoices && linkedInvoices.length > 0) {
            showMessage('لا يمكن تعديل إذن الصرف لأنه مرتبط بفاتورة/فواتير', 'error');
            return;
        }
    }
    
    currentNote = note;
    noteProducts = [...(note.items || [])];
    
    const isEdit = document.getElementById('isEdit');
    const noteIdInput = document.getElementById('noteId');
    const modalTitle = document.getElementById('modalTitle');
    
    if (isEdit) isEdit.value = 'true';
    if (noteIdInput) noteIdInput.value = note.id;
    if (modalTitle) modalTitle.textContent = `تعديل إذن صرف ${note.deliveryNoteNumber}`;
    
    const warehouseKeeperName = document.getElementById('warehouseKeeperName');
    const noteDate = document.getElementById('noteDate');
    const notes = document.getElementById('notes');
    
    if (warehouseKeeperName) warehouseKeeperName.value = note.warehouseKeeperName || note.salesRepName || '';
    if (noteDate) noteDate.value = note.date || '';
    if (notes) notes.value = note.notes || '';
    
    renderNoteProducts();
    
    const noteModal = document.getElementById('noteModal');
    if (noteModal) noteModal.classList.add('active');
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

// Delete Note
async function deleteNote(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (!note) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteNotes = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Check if note is settled (closed) - only block if user is not manager or system_engineer
    if (note.status === 'settled' && !canDeleteNotes) {
        showMessage('لا يمكن حذف إذن الصرف لأنه تمت تسويته (مقفل)', 'error');
        return;
    }
    
    // Check if note has linked invoices
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        const linkedInvoices = await window.electronAPI.dbGetAll('sales_invoices', 'deliveryNoteId = ?', [noteId]);
        if (linkedInvoices && linkedInvoices.length > 0) {
            showMessage('لا يمكن حذف إذن الصرف لأنه مرتبط بفاتورة/فواتير', 'error');
            return;
        }
    }
    
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف إذن الصرف؟',
        () => {
            // User confirmed - proceed with deletion
            proceedWithNoteDeletion(noteId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with note deletion
async function proceedWithNoteDeletion(noteId) {
    
    try {
        // NO stock reversion needed - stock was never deducted when note was created
        // Stock remains in warehouse until settlement
        
        console.log(`[Delivery Notes] Starting deletion of note ${noteId}`);
        
        // Restore available quantities to stock before deleting
        // Note: Only restore availableQuantity, not reservedQuantity (reserved quantities are linked to invoices)
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [noteId]);
            if (noteItems && noteItems.length > 0) {
                console.log(`[Delivery Notes] Restoring ${noteItems.length} products to stock...`);
                for (const noteItem of noteItems) {
                    // Only restore available quantity (not reserved quantity)
                    const availableQuantity = noteItem.availableQuantity || 0;
                    if (availableQuantity > 0) {
                        // Get product from database
                        let product = null;
                        if (window.electronAPI && window.electronAPI.dbGet) {
                            product = await window.electronAPI.dbGet('products', noteItem.productId);
                        }
                        
                        if (product) {
                            // Calculate quantity to add back in smallest unit
                            let quantityToAdd = availableQuantity;
                            
                            // If unit is largest, convert to smallest
                            if (noteItem.unit === 'largest') {
                                const conversionFactor = product.conversionFactor || 1;
                                quantityToAdd = availableQuantity * conversionFactor;
                            }
                            
                            // Restore stock
                            const currentStock = parseFloat(product.stock) || 0;
                            const newStock = currentStock + quantityToAdd;
                            
                            product.stock = newStock;
                            product.updatedAt = new Date().toISOString();
                            
                            // Update product in database
                            if (window.electronAPI && window.electronAPI.dbUpdate) {
                                await window.electronAPI.dbUpdate('products', product.id, product);
                                console.log(`[Delivery Notes] Restored product ${product.name} stock: ${currentStock} -> ${newStock} (+${quantityToAdd} from available quantity)`);
                            }
                            
                            // Update in local array too
                            const localProduct = products.find(p => p.id === product.id);
                            if (localProduct) {
                                localProduct.stock = newStock;
                            }
                        }
                    }
                }
                
                // Dispatch events to update other screens
                const uniqueProductIds = [...new Set(noteItems.map(item => item.productId))];
                uniqueProductIds.forEach(productId => {
                    window.dispatchEvent(new CustomEvent('productStockUpdated', { 
                        detail: { productId: productId },
                        bubbles: true,
                        cancelable: true
                    }));
                });
                window.dispatchEvent(new CustomEvent('productsNeedRefresh', { bubbles: true }));
            }
        }
        
        // Check for linked settlements first (must be deleted before delivery note)
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const linkedSettlements = await window.electronAPI.dbGetAll('delivery_settlements', 'deliveryNoteId = ?', [noteId]);
            if (linkedSettlements && linkedSettlements.length > 0) {
                console.log(`[Delivery Notes] Found ${linkedSettlements.length} settlements linked to this note. Deleting settlements first...`);
                
                // Delete settlement items first (foreign key constraint)
                for (const settlement of linkedSettlements) {
                    if (window.electronAPI.dbQuery) {
                        await window.electronAPI.dbQuery('DELETE FROM settlement_items WHERE settlementId = ?', [settlement.id]);
                    } else if (window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
                        const settlementItems = await window.electronAPI.dbGetAll('settlement_items', 'settlementId = ?', [settlement.id]);
                        if (settlementItems && settlementItems.length > 0) {
                            for (const item of settlementItems) {
                                await window.electronAPI.dbDelete('settlement_items', item.id);
                            }
                        }
                    }
                    
                    // Delete settlement
                    if (window.electronAPI.dbDelete) {
                        await window.electronAPI.dbDelete('delivery_settlements', settlement.id);
                        console.log(`[Delivery Notes] Deleted settlement ${settlement.id}`);
                    }
                }
            }
        }
        
        // Delete note items from database (foreign key constraint - has ON DELETE CASCADE but we delete manually to be safe)
        if (window.electronAPI && window.electronAPI.dbQuery) {
            const itemsDeleteResult = await window.electronAPI.dbQuery('DELETE FROM delivery_note_items WHERE deliveryNoteId = ?', [noteId]);
            console.log(`[Delivery Notes] Deleted note items:`, itemsDeleteResult);
        } else if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
            const noteItems = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [noteId]);
            if (noteItems && noteItems.length > 0) {
                console.log(`[Delivery Notes] Found ${noteItems.length} note items to delete`);
                for (const item of noteItems) {
                    const itemDeleteResult = await window.electronAPI.dbDelete('delivery_note_items', item.id);
                    console.log(`[Delivery Notes] Deleted item ${item.id}:`, itemDeleteResult);
                }
            }
        }
        
        // Delete note from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            console.log(`[Delivery Notes] Deleting note ${noteId} from database...`);
            const deleteResult = await window.electronAPI.dbDelete('delivery_notes', noteId);
            console.log(`[Delivery Notes] Delete result:`, deleteResult);
            
            // Check if deletion failed
            if (deleteResult && deleteResult.success === false) {
                throw new Error(deleteResult.error || 'فشل حذف إذن الصرف من قاعدة البيانات');
            }
            // Check if no rows were deleted (note doesn't exist or already deleted)
            if (deleteResult && deleteResult.changes !== undefined && deleteResult.changes === 0) {
                console.warn(`[Delivery Notes] Note ${noteId} was not found in database or already deleted`);
            } else {
                console.log(`[Delivery Notes] Successfully deleted note ${noteId} from database`);
            }
        } else {
            // Fallback to localStorage if database API is not available
            console.log(`[Delivery Notes] Database API not available, using localStorage fallback`);
            deliveryNotes = deliveryNotes.filter(n => n.id !== noteId);
            localStorage.setItem(STORAGE_KEYS.DELIVERY_NOTES, JSON.stringify(deliveryNotes));
        }
        
        // Reload from database (this will update deliveryNotes array)
        console.log(`[Delivery Notes] Reloading data from database...`);
        await loadData();
        console.log(`[Delivery Notes] Data reloaded. Total notes: ${deliveryNotes.length}`);
        
        // Apply filters and re-render the table
        currentPage = 1;
        applyFilters(); // This will call renderNotes() at the end
        
        showMessage('تم حذف إذن الصرف بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting delivery note:', error);
        showMessage('خطأ في حذف إذن الصرف: ' + error.message, 'error');
    }
}

// Print Note
function printNoteById(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (note) {
        openPrintWindow(note);
    }
}

// Save Note as PDF
async function saveNoteAsPDF(noteId) {
    const note = deliveryNotes.find(n => n.id === noteId);
    if (!note) {
        showMessage('إذن الصرف غير موجود', 'error');
        return;
    }
    
    try {
        const printContent = await generatePrintContent(note);
        const fileName = `اذن_صرف_${note.deliveryNoteNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        // Check if Electron API is available
        if (window.electronAPI && window.electronAPI.saveInvoiceToFile) {
            const result = await window.electronAPI.saveInvoiceToFile(printContent, fileName);
            
            if (result.success) {
                showMessage('تم حفظ الملف بنجاح', 'success');
            } else if (result.cancelled) {
                // User cancelled, do nothing
            } else {
                showMessage('فشل حفظ الملف: ' + (result.error || 'خطأ غير معروف'), 'error');
            }
        } else {
            // Fallback: Use browser print with PDF option
            showMessage('وظيفة حفظ PDF غير متاحة في المتصفح. يرجى استخدام المتصفح لإلغاء الإلغاء والضغط على "حفظ كـ PDF"', 'error');
            printNoteById(noteId);
        }
    } catch (error) {
        console.error('Error saving PDF:', error);
        showMessage('خطأ في حفظ PDF: ' + error.message, 'error');
        // Fallback to print
        printNoteById(noteId);
    }
}

// Open Print Window
async function openPrintWindow(note) {
    const printContent = await generatePrintContent(note);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Generate Print Content
async function generatePrintContent(note) {
    const companySettings = await getCompanySettings();
    const companyName = companySettings.name && companySettings.name.trim() ? companySettings.name : 'شركة أسيل';
    const companyAddress = companySettings.address && companySettings.address.trim() ? companySettings.address : '';
    const companyPhone = companySettings.phone && companySettings.phone.trim() ? companySettings.phone : (companySettings.mobile && companySettings.mobile.trim() ? companySettings.mobile : '');
    const defaultSalesRepName = companySettings.salesRepName || '';
    const defaultWarehouseKeeperName = companySettings.warehouseKeeperName || '';
    const defaultWarehouseKeeperPhone = companySettings.warehouseKeeperPhone || '';
    
    const statusText = note.status === 'issued' ? 'صادر' : note.status === 'returned' ? 'راجع' : 'تم التسوية';
    
    // Load note items if not loaded
    let noteItems = note.items || [];
    if (!noteItems || noteItems.length === 0) {
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const items = await window.electronAPI.dbGetAll('delivery_note_items', 'deliveryNoteId = ?', [note.id]);
            noteItems = (items || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                productCode: item.productCode || '',
                quantity: item.quantity || 0,
                unit: item.unit || '',
                unitName: item.unitName || item.unit || ''
            }));
        }
    }
    
    // Load product categories for each item
    if (window.electronAPI && window.electronAPI.dbGet) {
        for (let item of noteItems) {
            if (item.productId && !item.productCategory) {
                try {
                    const product = await window.electronAPI.dbGet('products', item.productId);
                    if (product) {
                        item.productCategory = product.category || 'غير محدد';
                    } else {
                        item.productCategory = 'غير محدد';
                    }
                } catch (error) {
                    console.error('Error loading product category:', error);
                    item.productCategory = 'غير محدد';
                }
            } else if (!item.productCategory) {
                item.productCategory = 'غير محدد';
            }
        }
    }
    
    // Helper function to generate a single copy content
    const generateCopyContent = (copyType, copyTitle) => {
        return `
    <div class="delivery-note-container">
        <div class="copy-label">${copyTitle}</div>
        <div class="header">
            <div class="company-name">${companyName}</div>
            ${companyAddress || companyPhone ? `<div class="company-info">${companyAddress ? companyAddress : ''}${companyAddress && companyPhone ? ' - ' : ''}${companyPhone ? companyPhone : ''}</div>` : ''}
        </div>
        <div class="invoice-title">إذن صرف</div>
        <div class="info-section">
            <div class="info-line">
                <span class="info-label">رقم الإذن:</span>
                <span class="info-value">${note.deliveryNoteNumber}</span>
                <span class="info-separator">|</span>
                <span class="info-label">التاريخ:</span>
                <span class="info-value">${new Date(note.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span class="info-separator">|</span>
                <span class="info-label">الحالة:</span>
                <span class="info-value">${statusText}</span>
                <span class="info-separator">|</span>
                <span class="info-label">عدد المنتجات:</span>
                <span class="info-value">${noteItems.length}</span>
            </div>
            <div class="info-line">
                <span class="info-label">${copyType === 'warehouse' ? 'أمين المخزن / التلاجة:' : 'المندوب:'}</span>
                <span class="info-value">${copyType === 'warehouse' ? (note.warehouseKeeperName || defaultWarehouseKeeperName || '') : (note.salesRepName || defaultSalesRepName || '')}</span>
                ${copyType === 'warehouse' && defaultWarehouseKeeperPhone ? `<span class="info-separator">|</span><span class="info-label">رقم التليفون:</span><span class="info-value">${defaultWarehouseKeeperPhone}</span>` : ''}
            </div>
        </div>
        <div class="products-section">
            <h4>المنتجات المطلوب استخراجها</h4>
            ${(() => {
                const itemsCount = noteItems.length;
                const shouldSplit = itemsCount > 8; // Split if more than 8 items
                const halfCount = Math.ceil(itemsCount / 2);
                
                if (shouldSplit) {
                    const firstHalf = noteItems.slice(0, halfCount);
                    const secondHalf = noteItems.slice(halfCount);
                    
                    const generateTable = (items, startIndex) => `
                        <table class="products-table products-table-split">
                            <thead>
                                <tr>
                                    <th style="width: 25px;">#</th>
                                    <th>اسم المنتج</th>
                                    <th style="width: 60px;">نوع</th>
                                    <th style="width: 60px;">الكود</th>
                                    <th style="width: 50px;">الكمية</th>
                                    <th style="width: 50px;">الوحدة</th>
                                    <th style="width: 55px;">تم الاستخراج</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item, idx) => `
                                <tr>
                                    <td style="text-align: center; font-weight: bold;">${startIndex + idx + 1}</td>
                                    <td><strong>${item.productName}</strong></td>
                                    <td style="text-align: center;">${item.productCategory || 'غير محدد'}</td>
                                    <td style="text-align: center;">${item.productCode || '-'}</td>
                                    <td style="text-align: center; font-weight: bold;">${formatArabicNumber(item.quantity)}</td>
                                    <td style="text-align: center;">${item.unitName || item.unit || ''}</td>
                                    <td style="text-align: center;">
                                        <div style="border: 1px solid #333; height: 16px; width: 100%; margin: 0 auto;"></div>
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                    
                    return `
                        <div class="products-tables-container">
                            ${generateTable(firstHalf, 0)}
                            ${generateTable(secondHalf, halfCount)}
                        </div>
                    `;
                } else {
                    return `
                        <table class="products-table">
                            <thead>
                                <tr>
                                    <th style="width: 30px;">#</th>
                                    <th>اسم المنتج</th>
                                    <th style="width: 80px;">نوع المنتج</th>
                                    <th style="width: 80px;">الكود</th>
                                    <th style="width: 60px;">الكمية</th>
                                    <th style="width: 60px;">الوحدة</th>
                                    <th style="width: 70px;">تم الاستخراج</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${noteItems.map((item, index) => `
                                <tr>
                                    <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                                    <td><strong>${item.productName}</strong></td>
                                    <td style="text-align: center;">${item.productCategory || 'غير محدد'}</td>
                                    <td style="text-align: center;">${item.productCode || '-'}</td>
                                    <td style="text-align: center; font-weight: bold;">${formatArabicNumber(item.quantity)}</td>
                                    <td style="text-align: center;">${item.unitName || item.unit || ''}</td>
                                    <td style="text-align: center;">
                                        <div style="border: 1px solid #333; height: 18px; width: 100%; margin: 0 auto;"></div>
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }
            })()}
        </div>
        ${note.notes && note.notes.trim() ? `
        <div class="notes-section">
            <h4>ملاحظات:</h4>
            <p>${note.notes}</p>
        </div>
        ` : ''}
        ${copyType === 'salesrep' ? `
        <div class="commitment-text">
            <p><strong>أقرّ أنا المندوب المذكور اسمي أعلاه</strong> بأني استلمت من أمين المخزن الأصناف الموضحة في هذا الإذن، سواء كانت مرتبطة بفواتير مبيعات أو عهدة احتياطية، وذلك بحالة سليمة وكاملة حسب البيانات الموضحة.</p>
            <p>وأتعهد بالمحافظة عليها وبالتصرف فيها وفق تعليمات الإدارة، على أن أقدّم ما يثبت تصريفها (فواتير مبيعات أو تسوية عهدة) خلال الفترة المحددة، أو إعادة ما لم يُصرَّف منها إلى المخزن.</p>
            <p>وتُبرّأ ذمة أمين المخزن من هذه الأصناف اعتبارًا من تاريخ هذا الإذن، وتنتقل المسؤولية عنها إلى المندوب حتى إتمام التسوية النهائية.</p>
        </div>
        ` : ''}
        <div class="signature">
            <div class="signature-box">
                <h4>توقيع أمين المخزن / التلاجة</h4>
                <div style="margin-top: 20px; font-size: 10px; color: #666;">
                    الاسم: _________________________
                </div>
            </div>
            <div class="signature-box">
                <h4>توقيع المستلم (المندوب)</h4>
                <div style="margin-top: 20px; font-size: 10px; color: #666;">
                    الاسم: _________________________
                </div>
            </div>
        </div>
        <div class="footer">
            <p>تم إنشاء هذا الإذن بتاريخ: ${new Date(note.createdAt || new Date()).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style="margin-top: 3px;">يرجى التأكد من مطابقة جميع العناصر قبل التوقيع</p>
        </div>
    </div>
        `;
    };

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إذن صرف ${note.deliveryNoteNumber}</title>
    <style>
        @page { 
            size: A4; 
            margin: 8mm;
        }
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        body { 
            font-family: 'Arial', 'Tahoma', sans-serif; 
            direction: rtl; 
            background: white; 
            padding: 0;
            font-size: 12px;
            line-height: 1.4;
        }
        .delivery-notes-wrapper {
            display: block;
            width: 100%;
        }
        .delivery-note-container {
            width: 100%;
            min-height: auto;
            height: auto;
            margin: 0 auto 2mm auto;
            background: white;
            padding: 3mm;
            position: relative;
            box-sizing: border-box;
            border: 1px solid #ddd;
        }
        .copy-label {
            position: absolute;
            top: 3mm;
            left: 3mm;
            background: rgba(139, 69, 19, 0.8);
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
        }
        .cut-line {
            margin: 0;
            padding: 0;
            text-align: center;
            border-top: 2px dashed #666;
            border-bottom: none;
            position: relative;
            height: 2px;
            overflow: visible;
            margin: 1mm 0;
        }
        .cut-line::before {
            content: '✂️ قص هنا';
            position: absolute;
            left: 50%;
            top: -8px;
            transform: translateX(-50%);
            background: white;
            padding: 0 8px;
            font-size: 9px;
            color: #666;
        }
        .header { 
            text-align: center; 
            margin-bottom: 8px; 
            border-bottom: 2px solid #333; 
            padding-bottom: 6px; 
        }
        .company-name { 
            font-size: 16px; 
            font-weight: bold; 
            margin-bottom: 3px; 
            color: #333;
        }
        .company-info { 
            font-size: 9px; 
            color: #666; 
        }
        .invoice-title { 
            font-size: 16px; 
            font-weight: bold; 
            margin: 8px 0; 
            text-align: center; 
            color: #8b4513;
            border: 2px solid #8b4513;
            padding: 5px;
            border-radius: 5px;
        }
        .info-section { 
            margin-bottom: 6px; 
            padding: 4px 0;
        }
        .info-line {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 3px;
            font-size: 8px;
            line-height: 1.4;
        }
        .info-label {
            font-weight: bold;
            color: #8b4513;
        }
        .info-value {
            color: #333;
        }
        .info-separator {
            color: #999;
            margin: 0 2px;
        }
        .products-section {
            margin: 4px 0;
        }
        .products-section h4 {
            font-size: 8px;
            margin-bottom: 2px;
            color: #333;
            text-align: center;
            padding: 1px;
            font-weight: bold;
        }
        .products-tables-container {
            display: flex;
            gap: 4px;
            width: 100%;
        }
        .products-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 3px 0; 
            border: 1px solid #333;
            font-size: 7px;
        }
        .products-table-split {
            width: calc(50% - 2px);
            margin: 0;
            font-size: 6px;
        }
        .products-table th, .products-table td { 
            border: 1px solid #ddd; 
            padding: 2px 1px; 
            text-align: right; 
            line-height: 1.2;
        }
        .products-table-split th, .products-table-split td {
            padding: 1px;
            font-size: 6px;
        }
        .products-table th { 
            background: #8b4513; 
            color: white;
            font-weight: bold; 
            font-size: 8px;
            padding: 3px 1px;
        }
        .products-table-split th {
            font-size: 7px;
            padding: 2px 1px;
        }
        .products-table td {
            font-size: 7px;
        }
        .products-table tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        .notes-section {
            margin: 6px 0;
            padding: 5px;
            background: #fff9e6;
            border: 1px solid #ffd700;
            border-radius: 4px;
            font-size: 8px;
        }
        .notes-section h4 {
            font-size: 9px;
            margin-bottom: 3px;
            color: #856404;
        }
        .commitment-text {
            margin-top: 6px;
            margin-bottom: 6px;
            padding: 6px;
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            text-align: right;
            line-height: 1.4;
            font-size: 8px;
        }
        .commitment-text p {
            margin: 3px 0;
        }
        .signature { 
            margin-top: 8px; 
            display: flex; 
            justify-content: space-between; 
            gap: 8px;
        }
        .signature-box { 
            width: 48%; 
            text-align: center; 
            border-top: 1px solid #333; 
            padding-top: 6px; 
            min-height: 45px;
        }
        .signature-box h4 {
            font-size: 9px;
            margin-bottom: 15px;
            color: #333;
        }
        .signature-box div {
            font-size: 8px;
            margin-top: 10px;
        }
        .footer {
            margin-top: 6px;
            text-align: center;
            font-size: 7px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 4px;
        }
        @media print {
            body {
                padding: 0;
            }
            .delivery-note-container {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .delivery-note-container:first-of-type {
                page-break-after: never;
                break-after: avoid;
            }
            .delivery-note-container:nth-of-type(2) {
                page-break-before: avoid;
                break-before: avoid;
            }
            .cut-line {
                page-break-after: never;
                page-break-before: never;
                break-after: avoid;
                break-before: avoid;
            }
            .header {
                page-break-after: avoid;
            }
            .products-table {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="delivery-notes-wrapper">
        ${generateCopyContent('warehouse', 'نسخة أمين المخزن / التلاجة')}
        <div class="cut-line"></div>
        ${generateCopyContent('salesrep', 'نسخة المندوب')}
    </div>
</body>
</html>
    `;
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
                    phone: companyInfo.phone || '',
                    mobile: companyInfo.mobile || '',
                    salesRepName: companyInfo.salesRepName || '',
                    warehouseKeeperName: companyInfo.warehouseKeeperName || '',
                    warehouseKeeperPhone: companyInfo.warehouseKeeperPhone || ''
                };
            }
        }
        return {};
    } catch (error) {
        console.error('Error getting company settings:', error);
        return {};
    }
}

// Close Modal
function closeModalHandler() {
    const noteModal = document.getElementById('noteModal');
    if (noteModal) noteModal.classList.remove('active');
    currentNote = null;
    noteProducts = [];
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

// Make functions global
window.removeProductFromNote = removeProduct;
window.viewNote = viewNote;
window.editNote = editNote;
window.printNoteById = printNoteById;
window.saveNoteAsPDF = saveNoteAsPDF;
window.deleteNote = deleteNote;

