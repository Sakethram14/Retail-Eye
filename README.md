# RetailEye | AI-Powered Computer Vision Inventory System

RetailEye is a production-grade shelf monitoring application that uses Computer Vision and AI to automate retail inventory management. It transforms raw shelf photos into actionable supply chain data, identifying out-of-stock items and generating restock tickets automatically.

## 🚀 Core Features
*   **Real-time Vision Analytics:** Upload shelf images to trigger a simulated CV pipeline (Shelf Level Detection -> SKU Identification -> Gap Analysis).
*   **Generative AI Reasoning:** Integrated with Gemini 3 (Flash Preview) to analyze shelf state, predict missing SKUs, and justify replenishment actions.
*   **Automated Workflow:** Generates restock tickets (PT-2467) and purchase orders (PO-3420) based on detected inventory deficits.
*   **Live Monitoring Dashboard:** High-contrast UI for warehouse managers featuring confidence scores, drift deltas, and inventory sync status.

## 🛠️ Tech Stack
*   **Frontend:** React 18, Vite, Tailwind CSS, Framer Motion (Animations), Lucide-React (Icons).
*   **Backend:** Node.js, Express, Multer (File Handling).
*   **AI Engine:** Google Gemini Pro Vision / AI Studio SDK.
*   **Visualization:** Recharts for inventory drift and monitoring trends.

## 📦 Project Structure
*   `/src`: Frontend React application logic and UI components.
*   `/server.ts`: Express server handling CV API routes and AI agent handoffs.
*   `/uploads`: Temporary storage for real-time image processing.

## 🔧 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/retaileye.git
    cd retaileye
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file and add your Gemini API Key:
    ```env
    GEMINI_API_KEY=your_api_key_here
    ```

4.  **Run the application:**
    ```bash
    npm run dev
    ```

## 📸 How to Use
1.  Navigate to the **Dashboard**.
2.  Click **"Run Inspection"** to upload a real-time shelf photo.
3.  Wait for the **Vision Pipeline** to process (Initializing -> Detecting -> Matching).
4.  View the detected gaps in the **Vision Results** tab and review the AI-generated restock plan.

## 🛡️ License
Distributed under the MIT License.
