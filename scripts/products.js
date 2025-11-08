// Products Management System

// Storage Keys
const STORAGE_KEYS = {
    PRODUCTS: 'asel_products',
    CATEGORIES: 'asel_categories',
    PRODUCT_COUNTER: 'asel_product_counter',
    SALES_HISTORY: 'asel_sales_history'
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

// Format number only (without currency)
function formatArabicNumberOnly(number, decimals = 2) {
    return formatArabicNumber(number, decimals);
}

// Initialize
let products = [];
let categories = [];

// Pagination & Filter State
let currentPage = 1;
const itemsPerPage = 20;
let filteredProducts = [];
let searchQuery = '';
let categoryFilter = '';
let statusFilter = '';
let stockFilter = '';

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeEventListeners();
    renderCategories();
    applyFilters(); // Use applyFilters instead of renderProducts
    
    // Reload products when page becomes visible (e.g., user switches tabs)
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden) {
            // Check if there's a recent update marker
            const updateMarker = localStorage.getItem('last_product_stock_update');
            const forceReload = updateMarker && (Date.now() - JSON.parse(updateMarker).timestamp) < 10000;
            await reloadProductsFromDatabase(forceReload);
        }
    });
    
    // Reload products when window gets focus (e.g., user clicks on window)
    window.addEventListener('focus', async () => {
        // Check if there's a recent update marker
        const updateMarker = localStorage.getItem('last_product_stock_update');
        const forceReload = updateMarker && (Date.now() - JSON.parse(updateMarker).timestamp) < 10000;
        await reloadProductsFromDatabase(forceReload);
    });
    
    // Reload products periodically to reflect stock changes from other screens
    // Only reload if there's a recent update marker, otherwise skip to avoid unnecessary checks
    setInterval(async () => {
        const updateMarker = localStorage.getItem('last_product_stock_update');
        if (updateMarker) {
            try {
                const updateData = JSON.parse(updateMarker);
                const timeSinceUpdate = Date.now() - updateData.timestamp;
                // If update happened in last 10 seconds, force reload
                if (timeSinceUpdate < 10000) {
                    await reloadProductsFromDatabase(true);
                } else {
                    // No recent updates, do normal reload
                    await reloadProductsFromDatabase();
                }
            } catch (error) {
                // If marker exists but invalid, do normal reload
                await reloadProductsFromDatabase();
            }
        } else {
            // No update marker, do normal reload
            await reloadProductsFromDatabase();
        }
    }, 2000); // Reload every 2 seconds (more frequent)
    
    // Listen for BroadcastChannel messages (cross-window communication)
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('product-stock-updates');
            channel.addEventListener('message', async (event) => {
                const { type, productId, newStock, timestamp } = event.data;
                if (type === 'productStockUpdated') {
                    // Wait a bit for database to be updated
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await reloadProductsFromDatabase(true);
                }
            });
        } catch (error) {
            console.error('[Products] Error setting up BroadcastChannel:', error);
        }
    }
    
    // Check for localStorage update markers (fallback mechanism)
    let lastUpdateCheck = localStorage.getItem('last_product_stock_update');
    if (lastUpdateCheck) {
        try {
            const updateData = JSON.parse(lastUpdateCheck);
            const timeSinceUpdate = Date.now() - updateData.timestamp;
            // If update happened recently (within last 10 seconds), reload
            if (timeSinceUpdate < 10000) {
                    await reloadProductsFromDatabase(true);
            }
        } catch (error) {
            console.error('[Products] Error checking localStorage update marker:', error);
        }
    }
    
    // Check localStorage for updates periodically
    let lastReloadTime = 0;
    setInterval(async () => {
        const updateMarker = localStorage.getItem('last_product_stock_update');
        if (updateMarker) {
            try {
                const updateData = JSON.parse(updateMarker);
                const timeSinceUpdate = Date.now() - updateData.timestamp;
                // If update happened in last 10 seconds, reload
                if (timeSinceUpdate < 10000) {
                    const localProduct = products.find(p => p.id === updateData.productId);
                    const currentStock = localProduct ? parseFloat(localProduct.stock || 0) : null;
                    const expectedStock = parseFloat(updateData.newStock || 0);
                    
                    // Only reload if there's a mismatch and we haven't reloaded recently
                    const timeSinceLastReload = Date.now() - lastReloadTime;
                    if (timeSinceLastReload > 1000) { // Don't reload more than once per second
                        if (currentStock === null || Math.abs(currentStock - expectedStock) > 0.01) {
                            lastReloadTime = Date.now();
                            await reloadProductsFromDatabase(true);
                        }
                    }
                }
            } catch (error) {
                console.error('[Products] Error checking localStorage update marker:', error);
            }
        }
    }, 1000); // Check every second
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Add Product Button
    document.getElementById('addProductBtn').addEventListener('click', () => {
        openAddModal();
    });
    
    // Empty state button
    const emptyStateBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => {
            document.getElementById('addProductBtn').click();
        });
    }

    // Manage Categories Button
    document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
        openCategoriesModal();
    });

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);
    document.getElementById('closeCategoriesModal').addEventListener('click', closeCategoriesModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form Submit
    document.getElementById('productForm').addEventListener('submit', handleFormSubmit);

    // Add Category Button
    document.getElementById('addCategoryBtn').addEventListener('click', addCategory);

    // Add Category on Enter
    document.getElementById('newCategoryName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCategory();
        }
    });

    // Search and Filters
    // Filter Event Listeners
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('categoryFilter').addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('statusFilter').addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('stockFilter').addEventListener('change', () => {
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
        const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    });

    // Close modal on backdrop click
    document.getElementById('productModal').addEventListener('click', (e) => {
        if (e.target.id === 'productModal') {
            closeModal();
        }
    });

    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') {
            closeDetailsModal();
        }
    });

    document.getElementById('categoriesModal').addEventListener('click', (e) => {
        if (e.target.id === 'categoriesModal') {
            closeCategoriesModal();
        }
    });

    // Check inactive products on load
    checkInactiveProducts();
    
    // Check inactive products every hour
    setInterval(checkInactiveProducts, 3600000); // 1 hour
    
    // Listen for stock update events from other screens
    window.addEventListener('productStockUpdated', async (event) => {
        const { productId, newStock } = event.detail;
        
        // Add delay to ensure database transaction is committed
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Try multiple times to get the updated data
        let retries = 0;
        const maxRetries = 3;
        let success = false;
        
        while (!success && retries < maxRetries) {
            retries++;
            
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                try {
                    // Reload ALL products from database to ensure we have latest data
                    await reloadProductsFromDatabase(true);
                    
                    // Verify the specific product was updated correctly
                    if (productId) {
                        const updatedProduct = products.find(p => p.id === productId);
                        if (updatedProduct && newStock !== undefined) {
                            const stockDiff = Math.abs(parseFloat(updatedProduct.stock || 0) - parseFloat(newStock));
                            if (stockDiff < 0.01) {
                                console.log('[Products] Verified product stock updated correctly (attempt', retries, '):', updatedProduct.stock);
                                success = true;
                            } else {
                                console.log('[Products] Product stock mismatch (attempt', retries, '). Expected:', newStock, 'Got:', updatedProduct.stock);
                                if (retries < maxRetries) {
                                    await new Promise(resolve => setTimeout(resolve, 300));
                                }
                            }
                        } else {
                            console.warn('[Products] Product not found or newStock undefined (attempt', retries, ')');
                            if (retries < maxRetries) {
                                await new Promise(resolve => setTimeout(resolve, 300));
                            }
                        }
                    } else {
                        success = true; // No specific product to verify
                    }
                    
                    // Silently update if successful
                } catch (error) {
                    console.error('[Products] Error reloading products after stock update (attempt', retries, '):', error);
                    // Fallback: try to reload just the specific product
                    if (window.electronAPI && window.electronAPI.dbGet && productId) {
                        try {
                            const updatedProduct = await window.electronAPI.dbGet('products', productId);
                            if (updatedProduct) {
                                const index = products.findIndex(p => p.id === productId);
                                if (index !== -1) {
                                    products[index] = updatedProduct;
                                    applyFilters();
                                    console.log('[Products] Updated single product:', productId);
                                    success = true;
                                } else {
                                    // Product not found in local array, reload all
                                    if (retries < maxRetries) {
                                        await new Promise(resolve => setTimeout(resolve, 300));
                                    }
                                }
                            }
                        } catch (err) {
                            console.error('[Products] Error reloading single product (attempt', retries, '):', err);
                        }
                    }
                }
            }
        }
        
        if (!success) {
            console.warn('[Products] Could not verify stock update after', maxRetries, 'attempts');
        }
    });
    
    // Listen for global refresh event
    window.addEventListener('productsNeedRefresh', async (event) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        // Force reload when receiving global refresh event
        await reloadProductsFromDatabase(true);
    });
}

// Reload Products from Database (helper function)
async function reloadProductsFromDatabase(force = false) {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            const dbProducts = await window.electronAPI.dbGetAll('products', '', []);
            if (Array.isArray(dbProducts) && dbProducts.length >= 0) {
                // If force is true, always reload and update
                if (force) {
                    products = dbProducts;
                    currentPage = 1;
                    applyFilters();
                    return;
                }
                
                // Check if there's a recent update marker FIRST - if yes, always reload
                const updateMarker = localStorage.getItem('last_product_stock_update');
                let recentUpdate = false;
                let updateData = null;
                
                if (updateMarker) {
                    try {
                        updateData = JSON.parse(updateMarker);
                        const timeSinceUpdate = Date.now() - updateData.timestamp;
                        
                        // If update happened in last 30 seconds, force update
                        if (timeSinceUpdate < 30000) {
                            recentUpdate = true;
                        }
                    } catch (error) {
                        console.error('[Products] Error parsing update marker:', error);
                    }
                }
                
                // If there's a recent update, ALWAYS reload without checking
                if (recentUpdate) {
                    products = dbProducts;
                    applyFilters();
                    
                    // Verify the product was updated correctly (only log errors)
                    if (updateData) {
                        const updatedProduct = products.find(p => p.id === updateData.productId);
                        if (updatedProduct) {
                            const actualStock = parseFloat(updatedProduct.stock || 0);
                            const expectedStock = parseFloat(updateData.newStock || 0);
                            const match = Math.abs(actualStock - expectedStock) < 0.01;
                            
                            if (!match) {
                                console.warn('[Products] WARNING: Product stock mismatch after reload. Expected:', expectedStock, 'Got:', actualStock);
                            }
                        }
                    }
                    return; // Exit early - we've already reloaded
                }
                
                // Otherwise, check if stock values have changed before updating
                let hasChanges = false;
                let changedProducts = [];
                
                if (products.length !== dbProducts.length) {
                    hasChanges = true;
                    console.log('[Products] Product count changed:', products.length, '->', dbProducts.length);
                } else {
                    for (let i = 0; i < dbProducts.length; i++) {
                        const dbProduct = dbProducts[i];
                        const localProduct = products.find(p => p.id === dbProduct.id);
                        const localStock = parseFloat(localProduct?.stock || 0);
                        const dbStock = parseFloat(dbProduct.stock || 0);
                        const diff = Math.abs(localStock - dbStock);
                        
                        if (!localProduct) {
                            hasChanges = true;
                            changedProducts.push({ id: dbProduct.id, name: dbProduct.name, reason: 'new product' });
                            break;
                        } else if (diff > 0.01) {
                            hasChanges = true;
                            changedProducts.push({ 
                                id: dbProduct.id, 
                                name: dbProduct.name, 
                                reason: 'stock changed',
                                old: localStock,
                                new: dbStock,
                                diff: diff
                            });
                            break;
                        }
                    }
                }
                
                if (hasChanges) {
                    products = dbProducts;
                    applyFilters();
                }
            } else {
                console.warn('[Products] dbGetAll returned invalid data:', dbProducts);
            }
        } catch (error) {
            console.error('[Products] Error reloading products:', error);
            console.error('[Products] Error stack:', error.stack);
        }
    } else {
        console.warn('[Products] electronAPI or dbGetAll not available');
    }
}

// Load Data from Database
async function loadData() {
    // Try to load from database first
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            products = await window.electronAPI.dbGetAll('products', '', []);
            categories = await window.electronAPI.dbGetAll('categories', '', []);
            
            // Ensure arrays
            products = Array.isArray(products) ? products : [];
            categories = Array.isArray(categories) ? categories : [];
            
            // Convert categories from database objects to simple array of names
            if (categories.length > 0 && typeof categories[0] === 'object') {
                categories = categories.map(cat => cat.name || cat);
            }
            
            // Initialize default categories if empty
            if (categories.length === 0) {
                const defaultCategories = [];
                for (const catName of defaultCategories) {
                    const categoryData = {
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                        name: catName,
                        createdAt: new Date().toISOString()
                    };
                    await window.electronAPI.dbInsert('categories', categoryData);
                    categories.push(catName);
                }
            }
            
            return;
        } catch (error) {
            console.error('Error loading from database:', error);
        }
    }
    
    // Fallback to localStorage (for migration only)
    const productsData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const categoriesData = localStorage.getItem(STORAGE_KEYS.CATEGORIES);

    products = productsData ? JSON.parse(productsData) : [];
    categories = categoriesData ? JSON.parse(categoriesData) : [];

    // Initialize default categories if empty
    if (categories.length === 0) {
        categories = ['الدار', 'حلواني', 'رودي', 'شيفي', 'أخرى'];
        if (window.electronAPI && window.electronAPI.dbInsert) {
            for (const catName of categories) {
                try {
                    const categoryData = {
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                        name: catName,
                        createdAt: new Date().toISOString()
                    };
                    await window.electronAPI.dbInsert('categories', categoryData);
                } catch (err) {
                    console.error('Error inserting default category:', err);
                }
            }
        }
    }
}

// Save Data to Database
async function saveProducts() {
    // Save to localStorage as backup only
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    
    // Products are saved individually in handleFormSubmit
    // This function is kept for backward compatibility
}

async function saveCategories() {
    // Categories are saved individually in addCategory
    // This function is kept for backward compatibility
}

// Generate Product Code
async function generateProductCode() {
    if (window.electronAPI && window.electronAPI.dbGetAll) {
        try {
            // Get all products to find highest counter
            const allProducts = await window.electronAPI.dbGetAll('products', '', []);
            const codes = allProducts.map(p => p.code).filter(code => code && code.startsWith('PRD-'));
            const numbers = codes.map(code => {
                const match = code.match(/PRD-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            });
            const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
            const counter = maxNumber + 1;
            
            // Format: PRD-00001
            return `PRD-${String(counter).padStart(5, '0')}`;
        } catch (error) {
            console.error('Error generating product code:', error);
        }
    }
    
    // Fallback to localStorage
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.PRODUCT_COUNTER) || '0');
    counter++;
    localStorage.setItem(STORAGE_KEYS.PRODUCT_COUNTER, counter.toString());
    
    // Format: PRD-00001
    return `PRD-${String(counter).padStart(5, '0')}`;
}

// Render Categories
function renderCategories() {
    const categorySelect = document.getElementById('category');
    const categoryFilter = document.getElementById('categoryFilter');

    // Clear existing options (except first)
    categorySelect.innerHTML = '<option value="">اختر الصنف</option>';
    categoryFilter.innerHTML = '<option value="">جميع الأصناف</option>';

    categories.forEach(cat => {
        const option1 = document.createElement('option');
        option1.value = cat;
        option1.textContent = cat;
        categorySelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = cat;
        option2.textContent = cat;
        categoryFilter.appendChild(option2);
    });
}

// Open Add Modal
async function openAddModal() {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('modalTitle');
    const openingStockRow = document.getElementById('openingStockRow');

    // Reset form
    form.reset();
    document.getElementById('isEdit').value = 'false';
    document.getElementById('productId').value = '';
    title.textContent = 'إضافة منتج جديد';
    
    // Generate product code
    const code = await generateProductCode();
    document.getElementById('productCode').value = code;
    
    // Show opening stock field for new products
    openingStockRow.style.display = 'flex';
    document.getElementById('openingStock').disabled = false;
    document.getElementById('currentStock').value = '';
    
    // Show modal
    modal.classList.add('active');
    
    // Ensure focus is restored after opening modal
    setTimeout(() => {
        window.focus();
        const productNameInput = document.getElementById('productName');
        if (productNameInput) {
            setTimeout(() => {
                productNameInput.focus();
            }, 50);
        }
    }, 100);
}

// Open Edit Modal
function openEditModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('modalTitle');
    const openingStockRow = document.getElementById('openingStockRow');

    // Fill form with product data
    document.getElementById('productId').value = product.id;
    document.getElementById('isEdit').value = 'true';
    document.getElementById('productCode').value = product.code;
    document.getElementById('productName').value = product.name;
    document.getElementById('category').value = product.category;
    document.getElementById('smallestUnit').value = product.smallestUnit;
    document.getElementById('largestUnit').value = product.largestUnit;
    document.getElementById('conversionFactor').value = product.conversionFactor !== undefined && product.conversionFactor !== null ? product.conversionFactor : '';
    document.getElementById('currentStock').value = product.stock || 0;
    // Support both old and new field names
    document.getElementById('priceSmallestUnit').value = product.smallestPrice || product.priceSmallestUnit || 0;
    document.getElementById('priceLargestUnit').value = product.largestPrice || product.priceLargestUnit || 0;
    document.getElementById('notes').value = product.notes || '';
    document.getElementById('status').value = product.status || 'active';

    // Hide opening stock for existing products (only shown on first add)
    openingStockRow.style.display = 'none';
    document.getElementById('openingStock').value = '';
    
    title.textContent = 'تعديل المنتج';
    
    // Show modal
    modal.classList.add('active');
}

// Close Modal
function closeModal() {
    document.getElementById('productModal').classList.remove('active');
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
    const productId = document.getElementById('productId').value;

    const productData = {
        code: document.getElementById('productCode').value,
        name: document.getElementById('productName').value.trim(),
        category: document.getElementById('category').value,
        smallestUnit: document.getElementById('smallestUnit').value.trim(),
        largestUnit: document.getElementById('largestUnit').value.trim(),
        conversionFactor: (() => {
            const value = document.getElementById('conversionFactor').value;
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
        })(),
        smallestPrice: parseFloat(document.getElementById('priceSmallestUnit').value) || 0,
        largestPrice: parseFloat(document.getElementById('priceLargestUnit').value) || 0,
        notes: document.getElementById('notes').value.trim(),
        status: document.getElementById('status').value || 'active',
        lastSaleDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Validate that category exists
    if (!categories.includes(productData.category)) {
        showMessage('الصنف المحدد غير موجود. يرجى إضافة الصنف أولاً من إدارة الأصناف', 'error');
        return;
    }

    try {
        if (isEdit) {
            // Edit existing product
            const existingProduct = products.find(p => p.id === productId);
            if (!existingProduct) {
                showMessage('المنتج غير موجود', 'error');
                return;
            }
            
            // Check if name or category changed and if duplicate exists (same name + same category)
            const nameChanged = productData.name.toLowerCase().trim() !== existingProduct.name.toLowerCase().trim();
            const categoryChanged = productData.category !== existingProduct.category;
            
            if (nameChanged || categoryChanged) {
                // Check in local array first - duplicate = same name AND same category
                const duplicateProduct = products.find(p => 
                    p.id !== productId && 
                    p.name.toLowerCase().trim() === productData.name.toLowerCase().trim() &&
                    p.category === productData.category
                );
                if (duplicateProduct) {
                    showMessage('يوجد منتج آخر بنفس الاسم ونفس الصنف. يرجى اختيار اسم أو صنف مختلف', 'error');
                    return;
                }
                
                // Also check in database to ensure no duplicates
                if (window.electronAPI && window.electronAPI.dbGetAll) {
                    try {
                        const allProducts = await window.electronAPI.dbGetAll('products', '', []);
                        const dbDuplicate = Array.isArray(allProducts) ? allProducts.find(p => 
                            p && p.id !== productId && 
                            p.name && p.name.toLowerCase().trim() === productData.name.toLowerCase().trim() &&
                            p.category === productData.category
                        ) : null;
                        if (dbDuplicate) {
                            showMessage('يوجد منتج آخر بنفس الاسم ونفس الصنف. يرجى اختيار اسم أو صنف مختلف', 'error');
                            return;
                        }
                    } catch (dbErr) {
                        console.error('Error checking database for duplicate product:', dbErr);
                        // Continue with local check only if database check fails
                    }
                }
            }
            
            productData.id = existingProduct.id;
            productData.stock = existingProduct.stock || 0;
            productData.openingStock = existingProduct.openingStock || existingProduct.stock || 0;
            productData.lastSaleDate = existingProduct.lastSaleDate;
            productData.createdAt = existingProduct.createdAt;
            
            // Update in database
            if (window.electronAPI && window.electronAPI.dbUpdate) {
                await window.electronAPI.dbUpdate('products', productId, productData);
            }
            
            // Update local array
            const index = products.findIndex(p => p.id === productId);
            if (index !== -1) {
                products[index] = productData;
            }
        } else {
            // Add new product - Check if product with same name AND same category already exists
            // Check in local array first - duplicate = same name AND same category
            const duplicateProduct = products.find(p => 
                p.name.toLowerCase().trim() === productData.name.toLowerCase().trim() &&
                p.category === productData.category
            );
            if (duplicateProduct) {
                showMessage('يوجد منتج آخر بنفس الاسم ونفس الصنف. يرجى اختيار اسم أو صنف مختلف', 'error');
                return;
            }
            
            // Also check in database to ensure no duplicates
            if (window.electronAPI && window.electronAPI.dbGetAll) {
                try {
                    const allProducts = await window.electronAPI.dbGetAll('products', '', []);
                    const dbDuplicate = Array.isArray(allProducts) ? allProducts.find(p => 
                        p && p.name && p.name.toLowerCase().trim() === productData.name.toLowerCase().trim() &&
                        p.category === productData.category
                    ) : null;
                    if (dbDuplicate) {
                        showMessage('يوجد منتج آخر بنفس الاسم ونفس الصنف. يرجى اختيار اسم أو صنف مختلف', 'error');
                        return;
                    }
                } catch (dbErr) {
                    console.error('Error checking database for duplicate product:', dbErr);
                    // Continue with local check only if database check fails
                }
            }
            
            productData.id = Date.now().toString();
            const openingStock = parseFloat(document.getElementById('openingStock').value) || 0;
            productData.stock = openingStock;
            productData.openingStock = openingStock;
            
            // Insert in database
            if (window.electronAPI && window.electronAPI.dbInsert) {
                await window.electronAPI.dbInsert('products', productData);
            }
            
            // Add to local array
            products.push(productData);
        }
        
        // Save to localStorage as backup
        await saveProducts();
        currentPage = 1;
        applyFilters();
        closeModal();
        
        // Show success message
        showMessage('تم حفظ المنتج بنجاح', 'success');
    } catch (error) {
        console.error('Error saving product:', error);
        showMessage('خطأ في حفظ المنتج: ' + error.message, 'error');
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

// Delete Product
async function deleteProduct(productId) {
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        'هل أنت متأكد من حذف هذا المنتج؟',
        () => {
            // User confirmed - proceed with deletion
            proceedWithProductDeletion(productId);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with product deletion
async function proceedWithProductDeletion(productId) {

    try {
        // Delete from database
        if (window.electronAPI && window.electronAPI.dbDelete) {
            await window.electronAPI.dbDelete('products', productId);
        }
        
        // Remove from local array
        products = products.filter(p => p.id !== productId);
        await saveProducts();
        currentPage = 1;
        applyFilters();
        showMessage('تم حذف المنتج بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting product:', error);
        showMessage('خطأ في حذف المنتج: ' + error.message, 'error');
    }
}

// View Product Details
function viewProductDetails(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const detailsHtml = `
        <div class="detail-row">
            <div class="detail-label">كود المنتج:</div>
            <div class="detail-value">${product.code}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">اسم المنتج:</div>
            <div class="detail-value detail-value-emphasized"><strong>${product.name}</strong></div>
        </div>
        <div class="detail-row">
            <div class="detail-label">الصنف:</div>
            <div class="detail-value detail-value-emphasized"><strong>${product.category}</strong></div>
        </div>
        <div class="detail-row">
            <div class="detail-label">أصغر وحدة بيع:</div>
            <div class="detail-value">${product.smallestUnit}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">أكبر وحدة بيع:</div>
            <div class="detail-value">${product.largestUnit}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">معامل التحويل:</div>
            <div class="detail-value">${product.conversionFactor} ${product.smallestUnit} = 1 ${product.largestUnit}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">المخزون الحالي:</div>
            <div class="detail-value detail-value-emphasized">${formatArabicNumberOnly(product.stock || 0)} ${product.smallestUnit}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">سعر أصغر وحدة:</div>
            <div class="detail-value detail-value-emphasized">${formatArabicCurrency(product.priceSmallestUnit)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">سعر أكبر وحدة:</div>
            <div class="detail-value detail-value-emphasized">${formatArabicCurrency(product.priceLargestUnit)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">الحالة:</div>
            <div class="detail-value">
                <span class="status-badge ${product.status}">${product.status === 'active' ? 'نشط' : 'غير نشط'}</span>
            </div>
        </div>
        ${product.notes ? `
        <div class="detail-row">
            <div class="detail-label">الملاحظات:</div>
            <div class="detail-value">${product.notes}</div>
        </div>
        ` : ''}
        <div class="detail-row">
            <div class="detail-label">تاريخ الإنشاء:</div>
            <div class="detail-value">${new Date(product.createdAt).toLocaleDateString('ar-EG')}</div>
        </div>
        ${product.lastSaleDate ? `
        <div class="detail-row">
            <div class="detail-label">تاريخ آخر بيع:</div>
            <div class="detail-value">${new Date(product.lastSaleDate).toLocaleDateString('ar-EG')}</div>
        </div>
        ` : '<div class="detail-row"><div class="detail-label">تاريخ آخر بيع:</div><div class="detail-value">لم يُباع بعد</div></div>'}
    `;

    document.getElementById('productDetails').innerHTML = detailsHtml;
    document.getElementById('detailsModal').classList.add('active');
}

// Apply Filters and Pagination
function applyFilters() {
    // Get filters
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilterValue = document.getElementById('categoryFilter').value;
    const statusFilterValue = document.getElementById('statusFilter').value;
    const stockFilterValue = document.getElementById('stockFilter').value;

    // Filter products
    filteredProducts = products.filter(product => {
        const stock = parseFloat(product.stock || 0);
        
        // Search filter - includes name, code, category, and stock value
        const matchSearch = !searchTerm || 
            product.name.toLowerCase().includes(searchTerm) ||
            product.code.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm) ||
            stock.toString().includes(searchTerm);
        
        // Category filter
        const matchCategory = !categoryFilterValue || product.category === categoryFilterValue;
        
        // Status filter
        const matchStatus = !statusFilterValue || product.status === statusFilterValue;
        
        // Stock filter
        let matchStock = true;
        if (stockFilterValue) {
            if (stockFilterValue === 'zero') {
                matchStock = stock === 0;
            } else if (stockFilterValue === 'low') {
                matchStock = stock > 0 && stock < 150;
            } else if (stockFilterValue === 'medium') {
                matchStock = stock >= 150 && stock < 300;
            } else if (stockFilterValue === 'high') {
                matchStock = stock >= 300;
            }
        }

        return matchSearch && matchCategory && matchStatus && matchStock;
    });

    // Render products with pagination
    renderProducts();
}

// Render Products Table with Pagination
function renderProducts() {
    const tbody = document.getElementById('productsTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    
    // Clear table
    tbody.innerHTML = '';

    if (filteredProducts.length === 0) {
        emptyState.classList.remove('hidden');
        paginationContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    paginationContainer.classList.remove('hidden');

    // Calculate pagination
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredProducts.length);
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    // Get current logged-in user type
    const currentUserType = localStorage.getItem('asel_userType') || '';
    const canDeleteProducts = currentUserType === 'manager' || currentUserType === 'system_engineer';
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `عرض ${startIndex + 1} - ${endIndex} من ${filteredProducts.length}`;
    
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

    // Render products
    paginatedProducts.forEach(product => {
        const stock = parseFloat(product.stock || 0);
        let stockClass = 'stock-high';
        let stockIcon = '✅';
        
        // Determine stock level
        if (stock === 0) {
            stockClass = 'stock-zero';
            stockIcon = '🔴';
        } else if (stock < 150) {
            stockClass = 'stock-low';
            stockIcon = '⚠️';
        } else if (stock < 300) {
            stockClass = 'stock-medium';
            stockIcon = '🔵';
        } else {
            stockClass = 'stock-high';
            stockIcon = '✅';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.code}</td>
            <td class="product-name-cell"><strong>${product.name}</strong></td>
            <td class="product-category-cell"><strong>${product.category}</strong></td>
            <td>${product.smallestUnit}</td>
            <td>${product.largestUnit}</td>
            <td class="stock-cell ${stockClass}">
                <span class="stock-value">${formatArabicNumberOnly(stock)}</span>
                <span class="stock-unit">${product.smallestUnit}</span>
                <span class="stock-indicator">${stockIcon}</span>
            </td>
            <td class="price-cell">${formatArabicCurrency(product.smallestPrice || product.priceSmallestUnit || 0)}</td>
            <td class="price-cell">${formatArabicCurrency(product.largestPrice || product.priceLargestUnit || 0)}</td>
            <td><span class="status-badge ${product.status}">${product.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
            <td>
                <div class="actions-buttons">
                    <button class="action-btn view" data-product-id="${product.id}" title="عرض التفاصيل">
                        👁️
                    </button>
                    <button class="action-btn edit" data-product-id="${product.id}" title="تعديل">
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
            viewBtn.addEventListener('click', () => viewProductDetails(product.id));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => openEditModal(product.id));
        }
        
        // Add delete button only for manager or system_engineer
        if (canDeleteProducts) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.type = 'button';
            deleteBtn.title = 'حذف';
            deleteBtn.setAttribute('data-product-id', product.id);
            deleteBtn.addEventListener('click', () => deleteProduct(product.id));
            if (actionsDiv) {
                actionsDiv.appendChild(deleteBtn);
            }
        }
        
        tbody.appendChild(row);
    });
}

// Check Inactive Products (based on sales history)
async function checkInactiveProducts() {
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));

    try {
        // Get sales invoice items from database to find last sale date for each product
        let salesInvoiceItems = [];
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            salesInvoiceItems = await window.electronAPI.dbGetAll('sales_invoice_items', '', []);
            // Get invoices to get dates
            const salesInvoices = await window.electronAPI.dbGetAll('sales_invoices', '', []);
            
            // Create a map of invoice dates
            const invoiceDates = {};
            salesInvoices.forEach(inv => {
                invoiceDates[inv.id] = inv.date;
            });
            
            // Create a map of last sale date per product
            const productLastSales = {};
            salesInvoiceItems.forEach(item => {
                const invoiceDate = invoiceDates[item.invoiceId];
                if (invoiceDate) {
                    const productId = item.productId;
                    if (!productLastSales[productId] || new Date(invoiceDate) > new Date(productLastSales[productId])) {
                        productLastSales[productId] = invoiceDate;
                    }
                }
            });
            
            // Update products based on last sale date
            for (const product of products) {
                if (productLastSales[product.id]) {
                    product.lastSaleDate = productLastSales[product.id];
                    const lastSaleDate = new Date(productLastSales[product.id]);
                    if (lastSaleDate < fifteenDaysAgo) {
                        product.status = 'inactive';
                    } else {
                        product.status = 'active';
                    }
                    
                    // Update in database
                    if (window.electronAPI && window.electronAPI.dbUpdate) {
                        await window.electronAPI.dbUpdate('products', product.id, product);
                    }
                } else {
                    // No sales for this product
                    // Check if product was created more than 15 days ago
                    const createdDate = new Date(product.createdAt);
                    if (createdDate < fifteenDaysAgo) {
                        product.status = 'inactive';
                        
                        // Update in database
                        if (window.electronAPI && window.electronAPI.dbUpdate) {
                            await window.electronAPI.dbUpdate('products', product.id, product);
                        }
                    }
                }
            }
        } else {
            // Fallback to localStorage (for migration only)
            const salesHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES_HISTORY) || '[]');
            products.forEach(product => {
                const productSales = salesHistory.filter(sale => 
                    sale.items && sale.items.some(item => item.productId === product.id)
                );

                if (productSales.length > 0) {
                    const lastSale = productSales.sort((a, b) => 
                        new Date(b.date) - new Date(a.date)
                    )[0];
                    
                    product.lastSaleDate = lastSale.date;
                    
                    const lastSaleDate = new Date(lastSale.date);
                    if (lastSaleDate < fifteenDaysAgo) {
                        product.status = 'inactive';
                    } else {
                        product.status = 'active';
                    }
                } else {
                    const createdDate = new Date(product.createdAt);
                    if (createdDate < fifteenDaysAgo) {
                        product.status = 'inactive';
                    }
                }
            });
        }

        await saveProducts();
        applyFilters();
    } catch (error) {
        console.error('Error checking inactive products:', error);
    }
}

// Categories Management Functions
function openCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    modal.classList.add('active');
    renderCategoriesList();
    document.getElementById('newCategoryName').focus();
}

function closeCategoriesModal() {
    document.getElementById('categoriesModal').classList.remove('active');
    document.getElementById('newCategoryName').value = '';
}

async function addCategory() {
    const categoryName = document.getElementById('newCategoryName').value.trim();
    
    if (!categoryName) {
        showMessage('يرجى إدخال اسم الصنف', 'error');
        return;
    }

    if (categories.includes(categoryName)) {
        showMessage('هذا الصنف موجود بالفعل', 'error');
        return;
    }

    try {
        // Check if category exists in database
        if (window.electronAPI && window.electronAPI.dbGetAll) {
            const existingCategories = await window.electronAPI.dbGetAll('categories', 'name = ?', [categoryName]);
            if (existingCategories && existingCategories.length > 0) {
                showMessage('هذا الصنف موجود بالفعل', 'error');
                return;
            }
            
            // Insert category in database
            const categoryData = {
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                name: categoryName,
                createdAt: new Date().toISOString()
            };
            await window.electronAPI.dbInsert('categories', categoryData);
        }
        
        // Add to local array
        categories.push(categoryName);
        await saveCategories();
        renderCategories();
        renderCategoriesList();
        
        // Clear input field
        const categoryInput = document.getElementById('newCategoryName');
        categoryInput.value = '';
        
        // Show message
        showMessage('تم إضافة الصنف بنجاح', 'success');
        
        // Fix input field after alert - this is critical for Electron
        // The alert() in Electron can make input fields non-writable even if focused
        // We need to completely reset the input state by recreating it
        setTimeout(() => {
            if (categoryInput && categoryInput.parentNode) {
                // Store the input's attributes and properties
                const placeholder = categoryInput.placeholder || '';
                const maxLength = categoryInput.maxLength || -1;
                const id = categoryInput.id;
                const className = categoryInput.className;
                const style = categoryInput.getAttribute('style') || '';
                
                // Create a new input element
                const newInput = document.createElement('input');
                newInput.type = 'text';
                newInput.id = id;
                newInput.className = className;
                newInput.placeholder = placeholder;
                newInput.value = '';
                if (maxLength > 0) {
                    newInput.maxLength = maxLength;
                }
                if (style) {
                    newInput.setAttribute('style', style);
                }
                
                // Replace the old input with the new one
                const parent = categoryInput.parentNode;
                parent.replaceChild(newInput, categoryInput);
                
                // Re-attach event listeners
                newInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addCategory();
                    }
                });
                
                // Focus the new input and ensure it's writable
                setTimeout(() => {
                    newInput.focus();
                    // Force focus by clicking if needed
                    if (document.activeElement !== newInput) {
                        newInput.click();
                        newInput.focus();
                    }
                }, 50);
            }
        }, 250);
    } catch (error) {
        console.error('Error adding category:', error);
        showMessage('خطأ في إضافة الصنف: ' + error.message, 'error');
    }
}

function renderCategoriesList() {
    const categoriesList = document.getElementById('categoriesList');
    const emptyState = document.getElementById('categoriesEmptyState');
    
    categoriesList.innerHTML = '';
    
    if (categories.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    categories.forEach((category, index) => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.id = `category-${index}`;
        
        // Count products using this category
        const usageCount = products.filter(p => p.category === category).length;
        
        categoryItem.innerHTML = `
            <div class="category-name" id="category-name-${index}">${category}</div>
            <div style="display: flex; align-items: center; gap: 10px;">
                ${usageCount > 0 ? `<span class="category-usage-count">(${usageCount} منتج)</span>` : ''}
                <div class="category-actions">
                    <button class="edit-category-btn" data-category-index="${index}" title="تعديل">✏️</button>
                    <button class="delete-category-btn" data-category-index="${index}" title="حذف" ${usageCount > 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>🗑️</button>
                </div>
            </div>
        `;
        
        // Attach event listeners instead of inline handlers
        const editBtn = categoryItem.querySelector('.edit-category-btn');
        const deleteBtn = categoryItem.querySelector('.delete-category-btn');
        
        editBtn.addEventListener('click', () => editCategory(index));
        if (!deleteBtn.disabled) {
            deleteBtn.addEventListener('click', () => deleteCategory(index));
        }
        
        categoriesList.appendChild(categoryItem);
    });
}

function editCategory(index) {
    const categoryItem = document.getElementById(`category-${index}`);
    const categoryName = categories[index];
    const usageCount = products.filter(p => p.category === categoryName).length;
    
    categoryItem.classList.add('editing');
    categoryItem.innerHTML = `
        <input type="text" id="edit-category-input-${index}" value="${categoryName}" maxlength="50">
        <div class="category-actions">
            <button class="edit-category-btn" data-save-category-index="${index}" title="حفظ">✓</button>
            <button class="delete-category-btn" data-cancel-category-index="${index}" title="إلغاء">✗</button>
        </div>
    `;
    
    const input = document.getElementById(`edit-category-input-${index}`);
    const saveBtn = categoryItem.querySelector('[data-save-category-index]');
    const cancelBtn = categoryItem.querySelector('[data-cancel-category-index]');
    
    // Attach event listeners instead of inline handlers
    saveBtn.addEventListener('click', () => saveCategoryEdit(index));
    cancelBtn.addEventListener('click', () => cancelCategoryEdit(index));
    
    input.focus();
    input.select();
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveCategoryEdit(index);
        } else if (e.key === 'Escape') {
            cancelCategoryEdit(index);
        }
    });
}

async function saveCategoryEdit(index) {
    const input = document.getElementById(`edit-category-input-${index}`);
    const newName = input.value.trim();
    const oldName = categories[index];
    
    if (!newName) {
        showMessage('يرجى إدخال اسم الصنف', 'error');
        input.focus();
        return;
    }
    
    if (newName === oldName) {
        cancelCategoryEdit(index);
        return;
    }
    
    // Check if new name already exists (excluding current index)
    const existingIndex = categories.findIndex((cat, idx) => cat === newName && idx !== index);
    if (existingIndex !== -1) {
        showMessage('هذا الصنف موجود بالفعل', 'error');
        input.focus();
        return;
    }
    
    try {
        // Update category in database
        if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbUpdate) {
            // Find category in database
            const dbCategories = await window.electronAPI.dbGetAll('categories', 'name = ?', [oldName]);
            if (dbCategories && dbCategories.length > 0) {
                const categoryId = dbCategories[0].id;
                await window.electronAPI.dbUpdate('categories', categoryId, {
                    id: categoryId,
                    name: newName,
                    createdAt: dbCategories[0].createdAt
                });
            }
            
            // Update category name in all products in database
            const affectedProducts = await window.electronAPI.dbGetAll('products', 'category = ?', [oldName]);
            for (const product of affectedProducts) {
                product.category = newName;
                await window.electronAPI.dbUpdate('products', product.id, product);
            }
        }
        
        // Update category name in all products locally
        products.forEach(product => {
            if (product.category === oldName) {
                product.category = newName;
            }
        });
        
        categories[index] = newName;
        await saveCategories();
        await saveProducts();
        renderCategories();
        renderCategoriesList();
        applyFilters();
        showMessage('تم تعديل الصنف بنجاح', 'success');
    } catch (error) {
        console.error('Error updating category:', error);
        showMessage('خطأ في تعديل الصنف: ' + error.message, 'error');
    }
}

function cancelCategoryEdit(index) {
    renderCategoriesList();
}

async function deleteCategory(index) {
    const categoryName = categories[index];
    const usageCount = products.filter(p => p.category === categoryName).length;
    
    if (usageCount > 0) {
        showMessage('لا يمكن حذف هذا الصنف لأنه مستخدم في منتجات', 'error');
        return;
    }
    
    // Use custom confirmation dialog instead of confirm()
    showConfirmDialog(
        `هل أنت متأكد من حذف الصنف "${categoryName}"؟`,
        () => {
            // User confirmed - proceed with deletion
            proceedWithCategoryDeletion(index, categoryName);
        },
        () => {
            // User cancelled - do nothing
        }
    );
}

// Proceed with category deletion
async function proceedWithCategoryDeletion(index, categoryName) {
    
    try {
        // Delete from database
        if (window.electronAPI && window.electronAPI.dbGetAll && window.electronAPI.dbDelete) {
            const dbCategories = await window.electronAPI.dbGetAll('categories', 'name = ?', [categoryName]);
            if (dbCategories && dbCategories.length > 0) {
                await window.electronAPI.dbDelete('categories', dbCategories[0].id);
            }
        }
        
        // Remove from local array
        categories.splice(index, 1);
        await saveCategories();
        renderCategories();
        renderCategoriesList();
        showMessage('تم حذف الصنف بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting category:', error);
        showMessage('خطأ في حذف الصنف: ' + error.message, 'error');
    }
}

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
window.deleteProduct = deleteProduct;
window.viewProductDetails = viewProductDetails;
window.editCategory = editCategory;
window.saveCategoryEdit = saveCategoryEdit;
window.cancelCategoryEdit = cancelCategoryEdit;
window.deleteCategory = deleteCategory;

