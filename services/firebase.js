const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
// Use an absolute path for safety in different environments
const DB_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DB_DIR, 'db.json');
// --- SELF-HEALING LOGIC ---
// Ensure 'data' folder exists
if (!fs.existsSync(DB_DIR)) {
    console.log("Creating data directory...");
    fs.mkdirSync(DB_DIR, { recursive: true });
}
// Ensure 'db.json' exists with default structure
if (!fs.existsSync(DB_FILE)) {
    console.log("Creating initial database file...");
    const initialData = {
        lost: [],
        found: [],
        notifications: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}
// Now safe to require (or read)
// Note: require() caches, so for a RW DB, reading file is better than requiring it at top level if we want updates.
// But for simplicity in this mock, we'll read it into memory.
let dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}
const db = {
    collection: (name) => {
        return {
            add: async (item) => {
                // Use global dbData
                let table;
                if (name === 'lost_items') table = 'lost';
                else if (name === 'found_items') table = 'found';
                else table = name; // fallback for 'notifications'
                const newItem = { id: uuidv4(), ...item };
                if (!dbData[table]) dbData[table] = []; // Safety init
                dbData[table].push(newItem);
                saveDb();
                return { id: newItem.id };
            },
            get: async () => {
                // Return data from memory
                let table;
                if (name === 'lost_items') table = 'lost';
                else if (name === 'found_items') table = 'found';
                else table = name;
                const items = (dbData[table] || [])
                    .filter(item => item.status !== 'claimed')
                    .map(item => ({
                        id: item.id,
                        data: () => item
                    }));
                return items; // Standard array
            },
            doc: (docId) => {
                return {
                    delete: async () => {
                        let table;
                        if (name === 'lost_items') table = 'lost';
                        else if (name === 'found_items') table = 'found';
                        else table = name;
                        console.log(`Attempting to delete from table: ${table}, ID: ${docId} `);
                        if (!dbData[table]) {
                            console.error(`Table ${table} does not exist in DB.`);
                            return;
                        }
                        const index = dbData[table].findIndex(i => i.id === docId);
                        if (index !== -1) {
                            console.log(`Item found at index ${index}, deleting...`);
                            dbData[table].splice(index, 1);
                            saveDb();
                            console.log('Item deleted successfully.');
                        } else {
                            console.log(`Item with ID ${docId} NOT found in ${table}.`);
                        }
                    },
                    update: async (fields) => {
                        let table;
                        if (name === 'lost_items') table = 'lost';
                        else if (name === 'found_items') table = 'found';
                        else table = name;
                        if (!dbData[table]) return;
                        const index = dbData[table].findIndex(i => i.id === docId);
                        if (index !== -1) {
                            dbData[table][index] = { ...dbData[table][index], ...fields };
                            saveDb();
                        }
                    }
                };
            },
            orderBy: function () { return this; }
        };
    }
};
module.exports = { db };
