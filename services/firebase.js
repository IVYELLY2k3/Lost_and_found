const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '../data/db.json');

// Initialize DB if not exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ lost: [], found: [], notifications: [] }, null, 2));
}

function readDb() {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Ensure notifications array exists for existing DB files
    if (!data.notifications) data.notifications = [];
    return data;
}

function writeDb(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const db = {
    collection: (name) => {
        return {
            add: async (item) => {
                const data = readDb();
                let table;
                if (name === 'lost_items') table = 'lost';
                else if (name === 'found_items') table = 'found';
                else table = name; // fallback for 'notifications'

                const newItem = { id: uuidv4(), ...item };
                data[table].push(newItem);
                writeDb(data);
                return { id: newItem.id };
            },
            get: async () => {
                const data = readDb();
                let table;
                if (name === 'lost_items') table = 'lost';
                else if (name === 'found_items') table = 'found';
                else table = name;

                const items = (data[table] || [])
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
                        const data = readDb();
                        let table;
                        if (name === 'lost_items') table = 'lost';
                        else if (name === 'found_items') table = 'found';
                        else table = name;

                        console.log(`Attempting to delete from table: ${table}, ID: ${docId}`);

                        if (!data[table]) {
                            console.error(`Table ${table} does not exist in DB.`);
                            return;
                        }

                        const index = data[table].findIndex(i => i.id === docId);
                        if (index !== -1) {
                            console.log(`Item found at index ${index}, deleting...`);
                            data[table].splice(index, 1);
                            writeDb(data);
                            console.log('Item deleted successfully.');
                        } else {
                            console.log(`Item with ID ${docId} NOT found in ${table}.`);
                        }
                    },
                    update: async (fields) => {
                        const data = readDb();
                        let table;
                        if (name === 'lost_items') table = 'lost';
                        else if (name === 'found_items') table = 'found';
                        else table = name;

                        if (!data[table]) return;

                        const index = data[table].findIndex(i => i.id === docId);
                        if (index !== -1) {
                            data[table][index] = { ...data[table][index], ...fields };
                            writeDb(data);
                        }
                    }
                };
            },
            orderBy: function () { return this; }
        };
    }
};

module.exports = { db };
