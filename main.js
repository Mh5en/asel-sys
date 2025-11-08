/*
 * © 2025 All Rights Reserved.
 * Developed by Eng. Mohamed Mohsen
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./database');
const passwordUtils = require('./password-utils');

// Suppress cache-related errors and DevTools errors (these are harmless and don't affect functionality)
if (process.platform === 'win32') {
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    // Filter out cache-related errors that are common on Windows
    if (message.includes('cache_util_win.cc') || 
        message.includes('Unable to move the cache') ||
        message.includes('Unable to create cache') ||
        message.includes('Gpu Cache Creation failed') ||
        message.includes('disk_cache.cc') ||
        // Filter out DevTools fetch errors (harmless DevTools internal errors)
        message.includes('devtools://devtools') ||
        message.includes('devtools/bundled') ||
        (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://')))) {
      return; // Don't log these harmless errors
    }
    originalConsoleError.apply(console, args);
  };
  
  // Also filter stderr output (Electron logs some errors directly to stderr)
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function(chunk, encoding, fd) {
    const message = chunk.toString();
    // Filter DevTools errors - check for various patterns
    // Check for ERROR:CONSOLE pattern with devtools or Failed to fetch
    if ((message.includes('ERROR:CONSOLE') || message.includes('ERROR')) && (
        message.includes('devtools://devtools') ||
        message.includes('devtools/bundled') ||
        message.includes('devtools/bundled/panels') ||
        (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))
    )) {
      return true; // Suppress these harmless errors
    }
    // Also check for direct devtools patterns
    if (message.includes('devtools://devtools') ||
        message.includes('devtools/bundled') ||
        message.includes('devtools/bundled/panels') ||
        (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))) {
      return true; // Suppress these harmless errors
    }
    return originalStderrWrite(chunk, encoding, fd);
  };
  
  // Also filter stdout for DevTools errors (some versions log to stdout)
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = function(chunk, encoding, fd) {
    const message = chunk.toString();
    // Filter DevTools errors
    if ((message.includes('ERROR:CONSOLE') || message.includes('ERROR')) && (
        message.includes('devtools://devtools') ||
        message.includes('devtools/bundled') ||
        message.includes('devtools/bundled/panels') ||
        (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))
    )) {
      return true; // Suppress these harmless errors
    }
    if (message.includes('devtools://devtools') ||
        message.includes('devtools/bundled') ||
        message.includes('devtools/bundled/panels') ||
        (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))) {
      return true; // Suppress these harmless errors
    }
    return originalStdoutWrite(chunk, encoding, fd);
  };
}

let mainWindow;
let loginWindow;
let db;

// Log errors to file
function logErrorToFile(error, context = '') {
  try {
    const userDataPath = app.getPath('userData');
    const logPath = path.join(userDataPath, 'error.log');
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ${context}\n${error.message}\n${error.stack}\n\n`;
    fs.appendFileSync(logPath, errorMessage, 'utf8');
    console.error(`Error logged to: ${logPath}`);
  } catch (logError) {
    console.error('Failed to log error to file:', logError);
  }
}

function createLoginWindow() {
  // Get correct paths for packaged and development modes
  const appPath = app.isPackaged ? app.getAppPath() : __dirname;
  const preloadPath = path.join(appPath, 'preload.js');
  const iconPath = path.join(appPath, 'assets', 'icon-asel.ico');
  
  loginWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    titleBarStyle: 'default',
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      focusable: true,
      partition: 'persist:main',
      devTools: true // Enable DevTools
    },
    icon: iconPath,
    show: false
  });
  
  loginWindow.maximize(); //maximize login screen

  // Filter out DevTools console errors (harmless internal errors)
  loginWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (message && (
      message.includes('devtools://devtools') ||
      message.includes('devtools/bundled') ||
      message.includes('devtools/bundled/panels') ||
      (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))
    )) {
      event.preventDefault(); // Prevent logging
      return; // Don't log these harmless errors
    }
  });
  
  // Filter out DevTools failed load errors
  loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (validatedURL && (
      validatedURL.includes('devtools://devtools') ||
      validatedURL.includes('devtools/bundled') ||
      validatedURL.includes('devtools/bundled/panels')
    )) {
      event.preventDefault(); // Prevent error from being logged
      return;
    }
  });

  // Get the correct path for HTML files
  // In packaged mode, app.getAppPath() returns the path to app.asar
  // We need to use path.join with app.getAppPath() to get the correct path
  const loginPath = path.join(appPath, 'login.html');
  
  // Try multiple path strategies to ensure file loads
  const tryLoadFile = async (filePath, fallbackPath) => {
    try {
      await loginWindow.loadFile(filePath);
      return true;
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
      if (fallbackPath) {
        try {
          await loginWindow.loadFile(fallbackPath);
          return true;
        } catch (fallbackError) {
          console.error(`Fallback also failed for ${fallbackPath}:`, fallbackError.message);
          // Try with just filename
          try {
            await loginWindow.loadFile('login.html');
            return true;
          } catch (finalError) {
            console.error('All load attempts failed:', finalError.message);
            return false;
          }
        }
      }
      return false;
    }
  };
  
  tryLoadFile(loginPath, 'login.html').catch((error) => {
    console.error('Failed to load login page after all attempts:', error);
  });
  
  loginWindow.once('ready-to-show', () => {
    loginWindow.show();
  });

  loginWindow.on('closed', () => {
    loginWindow = null;
  });

  // Handle window errors
  loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && !validatedURL.includes('devtools')) {
      console.error('Failed to load login page:', errorCode, errorDescription, validatedURL);
      // Try to reload the page
      if (loginWindow && !loginWindow.isDestroyed()) {
        try {
          const appPath = app.isPackaged ? app.getAppPath() : __dirname;
          const loginPath = path.join(appPath, 'login.html');
          setTimeout(() => {
            loginWindow.loadFile(loginPath).catch(() => {
              loginWindow.loadFile('login.html').catch(() => {
                console.error('Failed to reload login after error');
              });
            });
          }, 1000);
        } catch (reloadError) {
          console.error('Error reloading login after failed load:', reloadError);
        }
      }
    }
  });
  
  // Handle console errors from renderer
  loginWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level === 3) { // Error level
      console.error('Login renderer error:', message, 'at', sourceId, 'line', line);
    }
  });
}

function createMainWindow() {
  // Get correct paths for packaged and development modes
  const appPath = app.isPackaged ? app.getAppPath() : __dirname;
  const preloadPath = path.join(appPath, 'preload.js');
  const iconPath = path.join(appPath, 'assets', 'icon-asel.ico');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    title: 'نظام إدارة شركة أسيل',
    titleBarStyle: 'default',
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      focusable: true,
      partition: 'persist:main',
      devTools: true // Enable DevTools
    },
    icon: iconPath,
    show: false
  });
  mainWindow.maximize(); //added to maximize screens
  mainWindow.setTitle("نظام إدارة شركة أسيل");

  // Filter out DevTools console errors (harmless internal errors)
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (message && (
      message.includes('devtools://devtools') ||
      message.includes('devtools/bundled') ||
      message.includes('devtools/bundled/panels') ||
      (message.includes('Failed to fetch') && (message.includes('devtools') || message.includes('devtools://') || message.includes('bundled')))
    )) {
      event.preventDefault(); // Prevent logging
      return; // Don't log these harmless errors
    }
  });
  
  // Filter out DevTools failed load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (validatedURL && (
      validatedURL.includes('devtools://devtools') ||
      validatedURL.includes('devtools/bundled') ||
      validatedURL.includes('devtools/bundled/panels')
    )) {
      event.preventDefault(); // Prevent error from being logged
      return;
    }
  });

  // Get the correct path for HTML files
  // In packaged mode, app.getAppPath() returns the path to app.asar
  // We need to use path.join with app.getAppPath() to get the correct path
  const indexPath = path.join(appPath, 'index.html');
  
  // Try multiple path strategies to ensure file loads
  const tryLoadFile = async (filePath, fallbackPath) => {
    try {
      await mainWindow.loadFile(filePath);
      return true;
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
      if (fallbackPath) {
        try {
          await mainWindow.loadFile(fallbackPath);
          return true;
        } catch (fallbackError) {
          console.error(`Fallback also failed for ${fallbackPath}:`, fallbackError.message);
          // Try with just filename
          try {
            await mainWindow.loadFile('index.html');
            return true;
          } catch (finalError) {
            console.error('All load attempts failed:', finalError.message);
            return false;
          }
        }
      }
      return false;
    }
  };
  
  tryLoadFile(indexPath, 'index.html').catch((error) => {
    console.error('Failed to load index page after all attempts:', error);
  });
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (loginWindow) {
      loginWindow.close();
    }
  });

  // Handle renderer process crashes - prevent app from closing
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details);
    // Log to file
    try {
      const error = new Error(`Renderer process crashed: ${JSON.stringify(details)}`);
      logErrorToFile(error, 'Renderer Process Crash');
    } catch (logError) {
      console.error('Failed to log crash:', logError);
    }
    // Try to reload the window instead of closing
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const appPath = app.isPackaged ? app.getAppPath() : __dirname;
        const indexPath = path.join(appPath, 'index.html');
        mainWindow.loadFile(indexPath).catch(() => {
          mainWindow.loadFile('index.html').catch(() => {
            console.error('Failed to reload after crash');
          });
        });
      } catch (reloadError) {
        console.error('Error reloading after crash:', reloadError);
      }
    }
  });

  // Handle unresponsive renderer
  mainWindow.webContents.on('unresponsive', () => {
    console.warn('Renderer process became unresponsive');
  });

  // Handle responsive renderer
  mainWindow.webContents.on('responsive', () => {
    // Renderer process became responsive again
  });

  // Handle window errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && !validatedURL.includes('devtools')) {
      console.error('Failed to load main page:', errorCode, errorDescription, validatedURL);
      // Try to reload the page
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          const appPath = app.isPackaged ? app.getAppPath() : __dirname;
          const indexPath = path.join(appPath, 'index.html');
          setTimeout(() => {
            mainWindow.loadFile(indexPath).catch(() => {
              mainWindow.loadFile('index.html').catch(() => {
                console.error('Failed to reload after error');
              });
            });
          }, 1000);
        } catch (reloadError) {
          console.error('Error reloading after failed load:', reloadError);
        }
      }
    }
  });
  
  // Handle console errors from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level === 3) { // Error level
      console.error('Renderer error:', message, 'at', sourceId, 'line', line);
      // Log to file
      try {
        const error = new Error(message);
        error.stack = `at ${sourceId}:${line}`;
        logErrorToFile(error, 'Renderer Console Error');
      } catch (logError) {
        console.error('Failed to log renderer error:', logError);
      }
    }
  });

  // Ensure focus is maintained after IPC operations
  mainWindow.webContents.on('did-finish-load', () => {
    // Add global error handler to prevent crashes
    mainWindow.webContents.executeJavaScript(`
      (function() {
        // Global error handler to prevent crashes
        window.addEventListener('error', function(event) {
          console.error('Global error:', event.error);
          event.preventDefault();
          return true;
        });
        
        window.addEventListener('unhandledrejection', function(event) {
          console.error('Unhandled promise rejection:', event.reason);
          event.preventDefault();
          return true;
        });
        
        // Fix focus issues after form submissions and modal operations
        document.addEventListener('click', function(e) {
          try {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
              setTimeout(() => {
                if (document.activeElement !== e.target) {
                  e.target.focus();
                }
              }, 10);
            }
          } catch (err) {
            console.error('Error in click handler:', err);
          }
        }, true);
        
        // Fix focus issues when clicking on input fields
        document.addEventListener('mousedown', function(e) {
          try {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
              setTimeout(() => {
                if (document.activeElement !== e.target && !e.target.disabled && !e.target.readOnly) {
                  e.target.focus();
                }
              }, 10);
            }
          } catch (err) {
            console.error('Error in mousedown handler:', err);
          }
        }, true);
        
        // Ensure window has focus after modal operations
        document.addEventListener('DOMContentLoaded', function() {
          try {
            window.focus();
          } catch (err) {
            console.error('Error focusing window:', err);
          }
        });
      })();
    `).catch(err => console.error('Error executing focus handlers:', err));
    
    // Override alert separately
    mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const originalAlert = window.alert;
          window.alert = function(message) {
            try {
              const result = originalAlert.call(window, message);
              setTimeout(() => {
                try {
                  window.focus();
                  const modal = document.querySelector('.modal.active, [class*="modal"].active, #invoiceModal.active, #customerModal.active, #supplierModal.active, #productModal.active, #adjustmentModal.active, #returnModal.active');
                  if (modal) {
                    const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
                    if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                      setTimeout(() => firstInput.focus(), 50);
                    }
                  }
                } catch (err) {
                  console.error('Error in alert focus handler:', err);
                }
              }, 100);
              return result;
            } catch (err) {
              console.error('Error in alert override:', err);
              return originalAlert.call(window, message);
            }
          };
        } catch (err) {
          console.error('Error setting up alert override:', err);
        }
      })();
    `).catch(err => console.error('Error overriding alert:', err));
    
    // Override confirm separately
    mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const originalConfirm = window.confirm;
          window.confirm = function(message) {
            try {
              const result = originalConfirm.call(window, message);
              setTimeout(() => {
                try {
                  window.focus();
                  const modal = document.querySelector('.modal.active, [class*="modal"].active, #invoiceModal.active, #customerModal.active, #supplierModal.active, #productModal.active, #adjustmentModal.active, #returnModal.active');
                  if (modal) {
                    const firstInput = modal.querySelector('input:not([type="hidden"]):not([readonly]), select, textarea');
                    if (firstInput && !firstInput.disabled && !firstInput.readOnly) {
                      setTimeout(() => firstInput.focus(), 50);
                    }
                  }
                } catch (err) {
                  console.error('Error in confirm focus handler:', err);
                }
              }, 100);
              return result;
            } catch (err) {
              console.error('Error in confirm override:', err);
              return originalConfirm.call(window, message);
            }
          };
        } catch (err) {
          console.error('Error setting up confirm override:', err);
        }
      })();
    `).catch(err => console.error('Error overriding confirm:', err));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.on('login-success', (event, userData) => {
  try {
    // Check if main window already exists and is not destroyed
    if (mainWindow && !mainWindow.isDestroyed()) {
      // If main window exists, just reload it to index.html
      const appPath = app.isPackaged ? app.getAppPath() : __dirname;
      const indexPath = path.join(appPath, 'index.html');
      mainWindow.loadFile(indexPath).catch((error) => {
        // Check if mainWindow still exists before fallback
        if (mainWindow && !mainWindow.isDestroyed()) {
          // Fallback to relative path
          mainWindow.loadFile('index.html').catch((fallbackError) => {
            console.error('Both loadFile attempts failed:', error, fallbackError);
          });
        }
      });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
      
      // Close login window if it exists
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }
    } else {
      // If no main window exists, create a new one
      // Always create a new main window with proper frame settings
      // Close login window first
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
        loginWindow = null;
      }
      // Create a new main window with frame: true for window controls
      createMainWindow();
    }
  } catch (error) {
    console.error('Error in login-success handler:', error);
    // Try to create main window as fallback
    try {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
      }
    } catch (createError) {
      console.error('Error creating main window:', createError);
    }
  }
});

ipcMain.on('close-login', () => {
  try {
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close();
    }
  } catch (error) {
    console.error('Error in close-login handler:', error);
  }
});

ipcMain.on('minimize-window', (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
  } catch (error) {
    console.error('Error in minimize-window handler:', error);
  }
});

ipcMain.on('maximize-window', (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  } catch (error) {
    console.error('Error in maximize-window handler:', error);
  }
});

ipcMain.on('close-window', (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  } catch (error) {
    console.error('Error in close-window handler:', error);
  }
});

// Database IPC Handlers
ipcMain.handle('db-insert', async (event, table, data) => {
  try {
    if (!db) {
      // Try to initialize database if not initialized
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-insert:', initError);
        return { success: false, error: `Database not initialized: ${initError.message}` };
      }
    }
    await db.ensureInitialized();
    const result = db.insert(table, data);
    // Check if result has success property (error case)
    if (result && result.success === false) {
      return result;
    }
    return { success: true, ...result };
  } catch (error) {
    console.error('Error in db-insert:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-update', async (event, table, id, data) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-update:', initError);
        return { success: false, error: `Database not initialized: ${initError.message}` };
      }
    }
    await db.ensureInitialized();
    const result = db.update(table, id, data);
    // Check if result has success property (error case)
    if (result && result.success === false) {
      return result;
    }
    return { success: true, ...result };
  } catch (error) {
    console.error('Error in db-update:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-delete', async (event, table, id) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-delete:', initError);
        return { success: false, error: `Database not initialized: ${initError.message}` };
      }
    }
    await db.ensureInitialized();
    return db.delete(table, id);
  } catch (error) {
    console.error('Error in db-delete:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get', async (event, table, id) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-get:', initError);
        return null;
      }
    }
    await db.ensureInitialized();
    return db.getById(table, id);
  } catch (error) {
    console.error('Error in db-get:', error);
    return null;
  }
});

ipcMain.handle('db-get-all', async (event, table, where = '', params = []) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-get-all:', initError);
        return [];
      }
    }
    await db.ensureInitialized();
    const result = db.getAll(table, where, params);
    return result || [];
  } catch (error) {
    console.error(`Error in db-get-all for table ${table}:`, error);
    return [];
  }
});

ipcMain.handle('db-query', async (event, sql, params = []) => {
  try {
    if (!db) {
      try {
        db = new DatabaseManager();
      } catch (initError) {
        console.error('Error initializing database in db-query:', initError);
        return { success: false, error: `Database not initialized: ${initError.message}` };
      }
    }
    await db.ensureInitialized();
    const result = db.query(sql, params);
    // If it's a SELECT query, return the data directly
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return result || [];
    }
    // For other queries, return success status
    return { success: true, result };
  } catch (error) {
    console.error('Error in db-query:', error);
    return { success: false, error: error.message };
  }
});

// Password Hashing IPC Handlers
ipcMain.handle('hash-password', async (event, password) => {
  try {
    const hashedPassword = await passwordUtils.hashPassword(password);
    return { success: true, hashedPassword };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('compare-password', async (event, password, hashedPassword) => {
  try {
    const isMatch = await passwordUtils.comparePassword(password, hashedPassword);
    return { success: true, isMatch };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('db-get-path', () => {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'asel-database.db');
  return dbPath;
});

// Backup IPC Handlers
ipcMain.handle('backup-create', async (event, backupType = 'manual') => {
  try {
    await db.ensureInitialized();
    
    // Ask user to choose backup location
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'اختر مكان حفظ النسخة الاحتياطية',
      defaultPath: `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`,
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      buttonLabel: 'حفظ'
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const backupPath = result.filePath;
    const backupResult = db.createBackup(backupPath);
    
    if (backupResult.success) {
      // Update backup type in history
      const history = db.getBackupHistory(1);
      if (history.length > 0) {
        db.query('UPDATE backup_history SET backupType = ? WHERE id = ?', [backupType, history[0].id]);
      }
      
      return { success: true, backupPath, fileSize: backupResult.fileSize };
    } else {
      return { success: false, error: backupResult.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-restore', async (event) => {
  try {
    await db.ensureInitialized();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر ملف النسخ الاحتياطي',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const backupPath = result.filePaths[0];
    const restoreResult = db.restoreBackup(backupPath);
    
    return restoreResult;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-get-history', async (event, limit = 10) => {
  try {
    await db.ensureInitialized();
    return db.getBackupHistory(limit);
  } catch (error) {
    return [];
  }
});

ipcMain.handle('backup-get-path', () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'backups');
});

ipcMain.handle('backup-set-auto-settings', async (event, settings) => {
  try {
    // Save settings to file
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'auto-backup-settings.json');
    
    // Ensure backup directory exists
    if (settings.path) {
      if (!fs.existsSync(settings.path)) {
        fs.mkdirSync(settings.path, { recursive: true });
      }
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-get-auto-settings', async (event) => {
  try {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'auto-backup-settings.json');
    
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return { success: true, settings };
    } else {
      return { success: true, settings: { enabled: false, path: '', interval: 'daily' } };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-select-path', async (event) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      // If main window is not available, try to get any window
      const allWindows = BrowserWindow.getAllWindows();
      if (allWindows.length > 0) {
        mainWindow = allWindows[0];
      } else {
        return { success: false, error: 'No window available' };
      }
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر مجلد حفظ النسخ الاحتياطية',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    if (result.filePaths && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    } else {
      return { success: false, error: 'No path selected' };
    }
  } catch (error) {
    console.error('Error in backup-select-path:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup-disable-auto', async (event) => {
  try {
    // Disable auto backup
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-open-folder', () => {
  const userDataPath = app.getPath('userData');
  const { shell } = require('electron');
  shell.openPath(userDataPath);
  return userDataPath;
});

// Save Invoice to File (as PDF)
ipcMain.handle('save-invoice-to-file', async (event, invoiceContent, defaultFileName) => {
  let pdfWindow = null;
  
  try {
    // Show save dialog first - make it appear immediately
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ الفاتورة',
      defaultPath: defaultFileName ? defaultFileName.replace('.html', '.pdf') : 'invoice.pdf',
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['showOverwriteConfirmation']
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const filePath = result.filePath;
    
    // Create a hidden window to render the HTML content (A4 size)
    pdfWindow = new BrowserWindow({
      show: false,
      width: 1200,
      height: 1600, // A4 portrait approximate height
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // Load HTML content directly using data URI - much faster
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(invoiceContent)}`;
    
    // Wait for content to load - use dom-ready for faster response
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for page to load'));
      }, 10000);
      
      let resolved = false;
      
      const finish = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        setTimeout(resolve, 1000); // Wait 1 second for rendering to ensure CSS is applied
      };
      
      // Use dom-ready for faster response
      pdfWindow.webContents.once('dom-ready', finish);
      
      pdfWindow.webContents.once('did-finish-load', finish);
      
      pdfWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to load: ${errorDescription}`));
      });
      
      pdfWindow.loadURL(dataUrl);
    });
    
    // Generate PDF
    
    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      margin: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      },
      pageSize: 'A4'
    });
    
    // Write PDF to file
    
    fs.writeFileSync(filePath, pdfData);
    
    
    // Close the hidden window
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.close();
    }
    pdfWindow = null;
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving invoice to PDF:', error);
    
    // Close window if it exists
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.close();
    }
    
    return { success: false, error: error.message };
  }
});

// Get Asset Path
ipcMain.handle('get-asset-path', async (event, assetName) => {
  try {
    // Get correct path for packaged and development modes
    const appPath = app.isPackaged ? app.getAppPath() : __dirname;
    const assetPath = path.join(appPath, 'assets', assetName);
    
    // Check if file exists
    if (!fs.existsSync(assetPath)) {
      console.error(`Asset file not found: ${assetPath}`);
      // Try alternative path
      const altPath = path.join(__dirname, 'assets', assetName);
      if (fs.existsSync(altPath)) {
        const altFileUrl = process.platform === 'win32' 
          ? `file:///${altPath.replace(/\\/g, '/')}`
          : `file://${altPath}`;
        return { success: true, path: altFileUrl };
      }
      return { success: false, error: 'Asset file not found' };
    }
    
    // Convert to file:// URL for use in HTML (Windows needs proper format)
    let fileUrl;
    if (process.platform === 'win32') {
      // Windows: file:///C:/path/to/file
      fileUrl = `file:///${assetPath.replace(/\\/g, '/')}`;
    } else {
      // Unix/Mac: file:///path/to/file
      fileUrl = `file://${assetPath}`;
    }
    return { success: true, path: fileUrl };
  } catch (error) {
    console.error('Error getting asset path:', error);
    return { success: false, error: error.message };
  }
});

// Migration function to move data from localStorage to SQLite
function migrateFromLocalStorage() {
  // This will be called once to migrate existing localStorage data
  // For now, it's a placeholder. The actual migration will be done through the renderer process
  // after checking if data exists in localStorage but not in SQLite
}

// Handle uncaught exceptions - don't crash the app
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  logErrorToFile(error, 'Uncaught Exception');
  // Log error but don't show dialog that might cause issues
  // The app will continue running
  // Try to recover by reloading main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const appPath = app.isPackaged ? app.getAppPath() : __dirname;
      const indexPath = path.join(appPath, 'index.html');
      mainWindow.loadFile(indexPath).catch(() => {
        mainWindow.loadFile('index.html').catch(() => {
          console.error('Failed to reload after uncaught exception');
        });
      });
    } catch (reloadError) {
      console.error('Error reloading after uncaught exception:', reloadError);
    }
  }
});

// Handle unhandled promise rejections - don't crash the app
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log error to file
  try {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logErrorToFile(error, 'Unhandled Rejection');
  } catch (logError) {
    console.error('Failed to log rejection:', logError);
  }
  // Log error but don't show dialog that might cause issues
  // The app will continue running
});

app.whenReady().then(() => {
  try {
    // Set application name for dialogs and popups
    app.setName('نظام إدارة شركة أسيل');
    
    // Suppress cache-related errors (common on Windows)
    // These errors are harmless and don't affect functionality
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    
    // Suppress DevTools errors in console
    app.commandLine.appendSwitch('disable-dev-shm-usage');
    app.commandLine.appendSwitch('disable-web-security');
    
    // Initialize Database with error handling
    try {
      db = new DatabaseManager();
    } catch (dbError) {
      console.error('Error initializing database:', dbError);
      // Try to show user-friendly error
      const userDataPath = app.getPath('userData');
      console.error('UserData path:', userDataPath);
      console.error('Database path:', path.join(userDataPath, 'asel-database.db'));
      // Don't show dialog here - let the app continue and show error when needed
    }

    // Run migration from localStorage to SQLite if needed
    try {
      migrateFromLocalStorage();
    } catch (migrationError) {
      console.error('Error in migration:', migrationError);
      // Continue anyway
    }

    createLoginWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createLoginWindow();
      }
    });
  } catch (error) {
    console.error('Error in app.whenReady:', error);
    console.error('Error stack:', error.stack);
    // Don't show dialog that might cause issues, just log
  }
}).catch((error) => {
  console.error('Error in app.whenReady promise:', error);
  console.error('Error stack:', error.stack);
  // Don't show dialog that might cause issues, just log
});

// Track if backup is in progress
let isBackupInProgress = false;

// Check and create auto backup before quitting
app.on('before-quit', async (event) => {
  // Prevent default quit behavior until backup is complete
  event.preventDefault();
  
  try {
    if (isBackupInProgress) {
      // If backup is already in progress, allow quit
      app.exit(0);
      return;
    }

    if (!db) {
      app.exit(0);
      return;
    }

    await db.ensureInitialized();
    
    // Get auto backup settings
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'auto-backup-settings.json');
    
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }

    // Check if auto backup is enabled
    if (!settings.enabled) {
      app.exit(0);
      return;
    }

    // Create backup directory if it doesn't exist
    const backupDir = settings.path || path.join(userDataPath, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Get backup interval from settings (default: daily)
    const interval = settings.interval || 'daily';

    // Create backup file name with date based on interval
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let backupFileName;
    
    if (interval === 'weekly') {
      // Weekly: use year-week format (YYYY-WW)
      const year = today.getFullYear();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const days = Math.floor((today - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      backupFileName = `backup-${year}-W${weekNumber.toString().padStart(2, '0')}.db`;
    } else if (interval === 'monthly') {
      // Monthly: use year-month format (YYYY-MM)
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      backupFileName = `backup-${year}-${month}.db`;
    } else {
      // Daily: use date format (YYYY-MM-DD)
      const dateStr = today.toISOString().split('T')[0];
      backupFileName = `backup-${dateStr}.db`;
    }
    
    const backupPath = path.join(backupDir, backupFileName);

    // Check if backup file actually exists (not just in database)
    const backupFileExists = fs.existsSync(backupPath) && fs.statSync(backupPath).size > 0;

    // Check last backup date from database
    const lastBackupDate = db.getLastBackupDate();

    // Check if we need to create backup based on interval
    let needsBackup = false;
    if (!backupFileExists) {
      // Backup file doesn't exist, create one
      needsBackup = true;
    } else if (!lastBackupDate) {
      // No backup record in database, but file exists - create new one anyway
      needsBackup = true;
    } else {
      const lastBackup = new Date(lastBackupDate);
      lastBackup.setHours(0, 0, 0, 0);
      
      // Calculate days difference
      const daysDiff = Math.floor((today - lastBackup) / (1000 * 60 * 60 * 24));
      
      // Check based on interval
      if (interval === 'daily') {
        // Daily: create backup if last backup is older than today
        needsBackup = daysDiff >= 1;
      } else if (interval === 'weekly') {
        // Weekly: create backup if last backup is 7 days or older
        needsBackup = daysDiff >= 7;
      } else if (interval === 'monthly') {
        // Monthly: create backup if last backup is 30 days or older
        needsBackup = daysDiff >= 30;
      } else {
        // Default to daily
        needsBackup = daysDiff >= 1;
      }
    }

    if (needsBackup && settings.path) {
      isBackupInProgress = true;
      
      // Create auto backup (synchronous operation)
      const backupResult = db.createAutoBackup(backupPath);
      
      isBackupInProgress = false;
      
      if (!backupResult.success) {
        console.error('❌ Failed to create auto backup:', backupResult.error);
      }
      
      // Close database connection
      if (db) {
        db.close();
      }
      
      // Now allow quit
      app.exit(0);
    } else {
      // No backup needed, close database and quit
      if (db) {
        db.close();
      }
      app.exit(0);
    }
  } catch (error) {
    console.error('❌ Error in auto backup on quit:', error);
    isBackupInProgress = false;
    
    // Close database connection even on error
    if (db) {
      try {
        db.close();
      } catch (closeError) {
        console.error('Error closing database:', closeError);
      }
    }
    
    // Allow quit even on error
    app.exit(0);
  }
});

app.on('window-all-closed', () => {
  // Don't close database here - it will be closed in before-quit handler
  // Don't quit here - let before-quit handle it to ensure backup completes
  if (process.platform !== 'darwin') {
    // Quit will trigger before-quit event which handles backup
    app.quit();
  }
});

