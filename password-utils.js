const bcrypt = require('bcryptjs');

// Salt rounds for password hashing (10 is recommended)
const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('فشل في تشفير كلمة المرور');
    }
}

/**
 * Hash a password synchronously (for use in synchronous contexts)
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
function hashPasswordSync(password) {
    try {
        const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password synchronously:', error);
        throw new Error('فشل في تشفير كلمة المرور');
    }
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} - True if password matches
 */
async function comparePassword(password, hashedPassword) {
    try {
        // If hashedPassword is not a bcrypt hash (old plain text passwords), compare directly
        // This helps with migration from plain text to hashed passwords
        if (!hashedPassword || hashedPassword.length < 60) {
            // bcrypt hashes are always 60 characters long
            // If shorter, it's likely a plain text password
            return password === hashedPassword;
        }
        
        const isMatch = await bcrypt.compare(password, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error('Error comparing password:', error);
        // Fallback to direct comparison for backward compatibility
        return password === hashedPassword;
    }
}

/**
 * Compare a plain text password with a hashed password synchronously
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {boolean} - True if password matches
 */
function comparePasswordSync(password, hashedPassword) {
    try {
        // If hashedPassword is not a bcrypt hash (old plain text passwords), compare directly
        if (!hashedPassword || hashedPassword.length < 60) {
            return password === hashedPassword;
        }
        
        const isMatch = bcrypt.compareSync(password, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error('Error comparing password synchronously:', error);
        // Fallback to direct comparison for backward compatibility
        return password === hashedPassword;
    }
}

/**
 * Check if a string is a bcrypt hash (for migration purposes)
 * @param {string} password - Password string to check
 * @returns {boolean} - True if it looks like a bcrypt hash
 */
function isHashed(password) {
    // bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters long
    return password && password.length === 60 && password.startsWith('$2');
}

module.exports = {
    hashPassword,
    hashPasswordSync,
    comparePassword,
    comparePasswordSync,
    isHashed,
    SALT_ROUNDS
};

