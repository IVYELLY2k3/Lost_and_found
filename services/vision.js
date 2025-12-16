const { Vibrant } = require('node-vibrant/node');
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-cpu');
const mobilenet = require('@tensorflow-models/mobilenet');
const jpeg = require('jpeg-js');
// const fs = require('fs'); // FIX 1: Removed fs since we use a buffer
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- GEMINI SETUP ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_KEY");

// --- LOCAL MODEL CACHE ---
let model = null;

const PRIORITY_ITEMS = [
    'ring', 'jewelry', 'necklace', 'bracelet', 'watch', 'clock',
    'phone', 'cellphone', 'mobile', 'electronic',
    'wallet', 'purse', 'bag', 'backpack', 'satchel', 'handbag',
    'bottle', 'cup', 'mug', 'thermos',
    'shoe', 'sneaker', 'sandal', 'boot', 'lofer', 'footwear',
    'shirt', 'jersey', 'sweater', 'jacket', 'coat', 'hoodie', 'top',
    'hat', 'cap', 'beanie',
    'glasses', 'sunglasses', 'spectacles',
    'keys', 'keychain', 'toy', 'car', 'ball', 'book', 'notebook'
];

async function loadModel() {
    if (!model) {
        console.log('Loading MobileNet model...');
        model = await mobilenet.load({ version: 2, alpha: 1.0 });
        console.log('Model loaded.');
    }
    return model;
}

/**
 * Main Analysis Entry Point
 * 1. Tries Gemini (Cloud AI) for best description.
 * 2. If Gemini fails/error, falls back to Local TensorFlow.
 */
// FIX 2: Accepts imageBuffer instead of imagePath
async function analyzeImage(imageBuffer) { 
    // 1. Try Gemini First
    if (process.env.GEMINI_API_KEY) {
        try {
            // FIX 3: Use the passed-in buffer directly
            const base64Image = imageBuffer.toString('base64');
            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType: "image/jpeg" // Assuming all uploads are JPEGs, adjust if necessary
                },
            };

            const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest"];

            for (const modelName of modelsToTry) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    let prompt = "Analyze this image for a Lost and Found system. Provide a concise but detailed description. Start with 'Identified as...'. Do not use markdown.";

                    const result = await model.generateContent([prompt, imagePart]);
                    const response = await result.response;
                    const text = response.text();

                    if (text) {
                        return {
                            labels: ['gemini-ai'],
                            colors: [],
                            text: text.trim()
                        };
                    }
                } catch (e) {
                    // Continue to next model
                }
            }
        } catch (geminiError) {
            console.warn("Gemini Analysis Failed (Switching to Local Fallback):", geminiError.message);
            // Proceed to local fallback below
        }
    }

    // 2. Local Fallback (TensorFlow + Smart Color Logic)
    console.log("Using Local AI Fallback...");
    // FIX 4: Pass buffer to local analysis
    return await analyzeImageLocal(imageBuffer); 
}

// --- LOCAL LOGIC (The robust version) ---
// FIX 5: Accepts imageBuffer instead of imagePath
async function analyzeImageLocal(imageBuffer) { 
    try {
        // FIX 6: Use the passed buffer directly
        const rawImageData = jpeg.decode(imageBuffer, { useTArray: true }); 

        // --- 1. Ensembled Object Detection ---
        let detectedItems = []; 
        let isJewelry = false;

        try {
            const net = await loadModel();

            const numChannels = 3;
            const values = new Int32Array(rawImageData.width * rawImageData.height * numChannels);
            for (let i = 0; i < rawImageData.width * rawImageData.height; i++) {
                values[i * 3] = rawImageData.data[i * 4];
                values[i * 3 + 1] = rawImageData.data[i * 4 + 1];
                values[i * 3 + 2] = rawImageData.data[i * 4 + 2];
            }

            const fullTensor = tf.tensor3d(values, [rawImageData.height, rawImageData.width, numChannels]);

            // Crop 1: Center (Zoomed)
            const cropH = Math.floor(rawImageData.height * 0.5);
            const cropW = Math.floor(rawImageData.width * 0.5);
            const startY = Math.floor((rawImageData.height - cropH) / 2);
            const startX = Math.floor((rawImageData.width - cropW) / 2);
            const centerCrop = fullTensor.slice([startY, startX, 0], [cropH, cropW, 3]);

            // Run Predictions
            const [predsFull, predsCrop] = await Promise.all([
                net.classify(fullTensor, 5),
                net.classify(centerCrop, 5)
            ]);

            fullTensor.dispose();
            centerCrop.dispose();

            // Merge & Unique
            const allRaw = [...predsCrop, ...predsFull];
            const uniqueLabels = new Set();

            const candidates = [];

            // 1. Find priority matches first
            allRaw.forEach(p => {
                const label = cleanLabel(p.className);
                if (PRIORITY_ITEMS.some(pi => label.toLowerCase().includes(pi))) {
                    candidates.push({ label, score: p.probability + 0.5 }); // Boost score
                } else {
                    candidates.push({ label, score: p.probability });
                }
            });

            // Sort by score
            candidates.sort((a, b) => b.score - a.score);

            candidates.forEach(c => {
                if (!uniqueLabels.has(c.label)) {
                    uniqueLabels.add(c.label);
                    detectedItems.push(c.label);
                }
            });

            detectedItems = detectedItems.slice(0, 3); // Keep top 3

            // Heuristic for Jewelry
            if (generatedIsJewelry(detectedItems)) {
                isJewelry = true;
            }

        } catch (tfError) {
            console.error('TensorFlow Analysis Failed:', tfError);
        }

        // --- 2. Color Analysis ---
        const centerColor = getCenterColor(rawImageData);

        // Secondary color from Palette (minus dominant)
        // FIX 7: Pass buffer directly to Vibrant.from
        const palette = await Vibrant.from(imageBuffer).getPalette(); 
        const vibrantColors = Object.values(palette)
            .sort((a, b) => b.population - a.population)
            .map(s => getColorName(s.r, s.g, s.b));

        // Find a secondary color that is DIFFERENT from the center color
        // And not 'colorful'
        let secondaryColor = vibrantColors.find(c => c !== centerColor && c !== 'colorful');

        let finalMainColor = centerColor;

        // Context-aware rename
        if (isJewelry) {
            if (['grey', 'white', 'black'].includes(finalMainColor)) finalMainColor = 'Silver';
            if (['yellow', 'orange', 'brown'].includes(finalMainColor)) finalMainColor = 'Gold';
        }

        // --- 3. Long Description Generation ---
        let text = "";

        const mainItem = detectedItems[0] ? capitalize(detectedItems[0]) : "Item";
        const altItems = detectedItems.slice(1).map(s => capitalize(s));

        // Sentence 1: Identification
        if (detectedItems.length > 0) {
            text += `AI analysis identifies this as a **${mainItem}**`;
            if (altItems.length > 0) {
                text += ` (or similar to a ${altItems.join(' / ')}).`;
            } else {
                text += `.`;
            }
        } else {
            text += `A generic object was detected.`;
        }

        // Sentence 2: Color & Detail
        text += ` The item is primarily **${capitalize(finalMainColor)}**`;

        if (secondaryColor) {
            text += ` with distinct **${capitalize(secondaryColor)}** accents.`;
        } else {
            text += `.`;
        }

        // Sentence 3: Context
        if (isJewelry) {
            text += ` It appears to be a piece of jewelry or personal accessory.`;
        } else if (mainItem.includes('Shoe') || mainItem.includes('Sneaker')) {
            text += ` It appears to be footwear.`;
        } else if (mainItem.includes('Phone') || mainItem.includes('Electronic')) {
            text += ` It is an electronic device.`;
        }

        // Tags
        const finalTags = [...new Set([...detectedItems, finalMainColor, secondaryColor].filter(Boolean))];

        return {
            labels: finalTags, // Use labels for search matching if needed
            colors: [{ name: finalMainColor }],
            text
        };

    } catch (error) {
        console.error('Local Analysis Error:', error);
        return { labels: ['unknown'], colors: [], text: 'Analysis unavailable.' };
    }
}

function generatedIsJewelry(items) {
    const list = ['ring', 'necklace', 'bracelet', 'jewelry', 'band', 'watch'];
    return items.some(i => list.some(l => i.toLowerCase().includes(l)));
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function cleanLabel(raw) {
    const lower = raw.split(',')[0].toLowerCase();

    // Industrial term cleanup
    if (lower === 'hook' || lower === 'buckle' || lower === 'knot' || lower === 'chain') return 'Metal Item';

    const map = {
        'jersey': 'T-Shirt', 'maillot': 'T-Shirt', 'shirt': 'Shirt',
        'sweatshirt': 'Jumper', 'cardigan': 'Jumper',
        'water bottle': 'Bottle', 'bottle': 'Bottle',
        'cellular telephone': 'Phone', 'hand-held computer': 'Phone', 'ipod': 'Phone',
        'reflex camera': 'Camera',
        'running shoe': 'Shoe', 'sandal': 'Shoe', 'clog': 'Shoe', 'loafers': 'Shoe',
        'backpack': 'Backpack', 'bag': 'Bag'
    };

    return map[lower] || lower;
}

function getCenterColor(imgData) {
    let r = 0, g = 0, b = 0, c = 0;
    // Tighter crop (middle 20%) to get center color
    const startX = Math.floor(imgData.width * 0.40);
    const endX = Math.floor(imgData.width * 0.60);
    const startY = Math.floor(imgData.height * 0.40);
    const endY = Math.floor(imgData.height * 0.60);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const i = (y * imgData.width + x) * 4;
            r += imgData.data[i]; g += imgData.data[i + 1]; b += imgData.data[i + 2]; c++;
        }
    }
    return getColorName(Math.round(r / c), Math.round(g / c), Math.round(b / c));
}

function getColorName(r, g, b) {
    if (r > 190 && g > 190 && b > 190) return 'white';
    if (r < 65 && g < 65 && b < 65) return 'black';
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
    if (maxDiff < 25) {
        if (r > 130) return 'white';
        return 'grey';
    }
    if (r > g && r > b) {
        if (g > 140 && b < 100) return 'orange';
        if (r > 150) return 'red';
        return 'brown';
    }
    if (g > r && g > b) return 'green';
    if (b > r && b > g) {
        if (r > 150) return 'purple';
        return 'blue';
    }
    if (r > 180 && g > 180) return 'yellow';
    return 'colorful';
}

module.exports = { analyzeImage };
