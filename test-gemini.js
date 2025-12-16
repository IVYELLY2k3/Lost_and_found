require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    console.log("Testing Gemini API...");
    console.log("Key present:", !!process.env.GEMINI_API_KEY);

    if (!process.env.GEMINI_API_KEY) {
        console.error("No API Key found!");
        return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Explicitly using gemini-1.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        // List models
        // Note: SDK doesn't always expose listModels directly on genAI instance in all versions? 
        // Checking documentation memory: genAI does not have listModels. It's usually a separate call in REST or older libraries.
        // Actually, the new SDK might not expose it easily.
        // Let's try to just hit the 'gemini-pro' model instead, which is older and might be there.

        console.log("Trying gemini-pro...");
        const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
        const resultPro = await modelPro.generateContent("Hello?");
        console.log("Success with gemini-pro!", resultPro.response.text());

        console.log("Trying gemini-1.0-pro...");
        const model10 = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
        const result10 = await model10.generateContent("Hello?");
        console.log("Success with gemini-1.0-pro!", result10.response.text());

    } catch (error) {
        console.error("Error during probe:", error.message);
    }
}

test();
