import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use(express.json());

// --- Mock Data & Integrations ---
const MOCK_INVENTORY_PATH = path.join(process.cwd(), "database", "mock_inventory.json");

function getMockInventory() {
    if (!fs.existsSync(MOCK_INVENTORY_PATH)) return { stores: [] };
    return JSON.parse(fs.readFileSync(MOCK_INVENTORY_PATH, "utf-8"));
}

// --- Agent Tools (Function Declarations) ---

const queryInventoryTool: FunctionDeclaration = {
    name: "query_inventory_database",
    description: "Query the store's real-time inventory database to check backroom stock levels for a given SKU",
    parameters: {
        type: Type.OBJECT,
        properties: {
            sku_id: { type: Type.STRING, description: "The SKU ID to check" },
            store_id: { type: Type.STRING, description: "The store ID" },
            location: { type: Type.STRING, enum: ["backroom", "warehouse", "supplier"], description: "The location to check" }
        },
        required: ["sku_id", "store_id", "location"]
    }
};

const generatePickTicketTool: FunctionDeclaration = {
    name: "generate_pick_ticket",
    description: "Create a pick ticket for a store associate to retrieve a product from backroom stock",
    parameters: {
        type: Type.OBJECT,
        properties: {
            sku_id: { type: Type.STRING },
            shelf_level: { type: Type.INTEGER },
            shelf_position_cm: { type: Type.NUMBER },
            quantity_needed: { type: Type.INTEGER },
            priority: { type: Type.STRING, enum: ["urgent", "normal", "low"] }
        },
        required: ["sku_id", "shelf_level", "shelf_position_cm", "quantity_needed", "priority"]
    }
};

const generatePurchaseOrderTool: FunctionDeclaration = {
    name: "generate_purchase_order",
    description: "Create an automatic purchase order to restock a completely depleted SKU from the supplier",
    parameters: {
        type: Type.OBJECT,
        properties: {
            sku_id: { type: Type.STRING },
            quantity: { type: Type.INTEGER },
            supplier_id: { type: Type.STRING },
            urgency: { type: Type.STRING, enum: ["express", "standard"] },
            justification: { type: Type.STRING }
        },
        required: ["sku_id", "quantity", "supplier_id", "urgency", "justification"]
    }
};

const updateComplianceScoreTool: FunctionDeclaration = {
    name: "update_compliance_score",
    description: "Log the compliance event and update the aisle's planogram compliance score",
    parameters: {
        type: Type.OBJECT,
        properties: {
            store_id: { type: Type.STRING },
            aisle_id: { type: Type.STRING },
            gaps_detected: { type: Type.INTEGER },
            total_slots: { type: Type.INTEGER },
            actions_taken: { type: Type.ARRAY, items: { type: Type.STRING } },
            agent_confidence: { type: Type.NUMBER }
        },
        required: ["store_id", "aisle_id", "gaps_detected", "total_slots", "actions_taken", "agent_confidence"]
    }
};

const tools = [
    { functionDeclarations: [queryInventoryTool, generatePickTicketTool, generatePurchaseOrderTool, updateComplianceScoreTool] }
];

// --- Tool Implementations ---

const toolHandlers = {
    query_inventory_database: (args: any) => {
        const inventory = getMockInventory();
        const store = inventory.stores.find((s: any) => s.id === args.store_id);
        if (!store) return { error: "Store not found" };
        const item = store.inventory.find((i: any) => i.sku_id === args.sku_id);
        if (!item) return { error: "SKU not found" };

        let qty = 0;
        if (args.location === 'backroom') qty = item.backroom_stock;
        else if (args.location === 'warehouse') qty = item.warehouse_stock;
        else qty = 1000;

        return {
            sku_id: args.sku_id,
            location: args.location,
            quantity_available: qty,
            days_of_supply: qty / Math.max(1, item.velocity),
            velocity_units_per_day: item.velocity,
            product_name: item.product_name
        };
    },
    generate_pick_ticket: (args: any) => {
        return {
            ticket_id: `PT-${Math.floor(Math.random() * 10000)}`,
            created_at: new Date().toISOString(),
            assigned_to: "Store Associate A1",
            estimated_completion_mins: 15,
            ...args
        };
    },
    generate_purchase_order: (args: any) => {
        return {
            po_id: `PO-${Math.floor(Math.random() * 10000)}`,
            supplier_name: args.supplier_id, // Simplified
            expected_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            total_cost_usd: args.quantity * 25.5,
            ...args
        };
    },
    update_compliance_score: (args: any) => {
        const compliance_pct = ((args.total_slots - args.gaps_detected) / args.total_slots) * 100;
        return {
            compliance_pct,
            previous_compliance_pct: 82.5,
            delta: compliance_pct - 82.5,
            audit_log_id: `AUDIT-${Math.floor(Math.random() * 10000)}`
        };
    }
};

// --- API Routes ---

app.get("/api/inventory", (req, res) => {
    res.json(getMockInventory());
});

app.post("/api/cv-scan", upload.single('image'), (req, res) => {
    // This endpoint now just echoes back the image metadata for the frontend to use
    if (req.file) {
        res.json({
            uploaded: true,
            path: req.file.path,
            filename: req.file.filename,
            mimetype: req.file.mimetype
        });
    } else {
        res.status(400).json({ error: "No image uploaded" });
    }
});

app.post("/api/execute-tool", (req, res) => {
    const { name, args } = req.body;
    const handler = (toolHandlers as any)[name];
    if (handler) {
        try {
            const result = handler(args);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    } else {
        res.status(404).json({ error: "Tool not found" });
    }
});

// --- Server & Vite Setup ---

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`RetailEye Server running on http://localhost:${PORT}`);
    });
}

startServer();
