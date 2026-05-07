import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  ScanLine, 
  LayoutDashboard, 
  ShieldCheck, 
  Package, 
  ShoppingCart, 
  History, 
  AlertTriangle,
  ChevronRight,
  Database,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  Terminal,
  CloudUpload,
  X,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// --- Types ---

interface Gap {
  shelf_level: number;
  x_position_cm: number;
  gap_width_cm: number;
  expected_sku: string;
  confidence: number;
}

interface Action {
  tool: string;
  args: any;
  result: any;
}

interface ScanResult {
  cv_results: {
    gaps: Gap[];
    shelf_count: number;
    annotated_frame: string;
  };
  agent_summary: string;
  actions_taken: Action[];
}

// --- Main Component ---

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loadingStep, setLoadingStep] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingMessages = [
    "Uploading High-Res Frame...",
    "Initializing CV Pipeline...",
    "Detecting Shelf Levels...",
    "Perspective Distortion Correction...",
    "Segmenting Regions...",
    "Otsu Gap Detection...",
    "ORB SKU Identification...",
    "Gemini Agent Handoff...",
    "Executing Logic..."
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handleStartScan = async () => {
    if (!selectedImage && !scanResult) {
      fileInputRef.current?.click();
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setLoadingStep(0);

    const SYSTEM_PROMPT = `You are RetailEye, an autonomous planogram compliance and inventory replenishment agent. You receive structured gap reports from a computer vision pipeline and must execute a complete replenishment workflow without human intervention.

Your decision process MUST follow this exact sequence:
1. For each gap in the report, call query_inventory_database with location='backroom' first.
2. IF backroom quantity > 0:
   - Call generate_pick_ticket with priority based on SKU velocity:
     velocity > 10 units/day -> 'urgent'
     velocity 3-10 units/day -> 'normal'
     velocity < 3 units/day  -> 'low'
3. IF backroom quantity == 0:
   - Call query_inventory_database with location='warehouse'
   - IF warehouse quantity > 0:
     Call generate_purchase_order with urgency based on days_of_supply:
     days_of_supply == 0 -> 'express'
     days_of_supply < 2 -> 'express'
     days_of_supply >= 2 -> 'standard'
   - IF warehouse quantity == 0:
     Call generate_purchase_order with urgency='express' and add "CRITICAL STOCKOUT" to justification field
4. After processing ALL gaps, ALWAYS call update_compliance_score with a complete list of all actions taken.
5. Return a detailed summary.`;

    const TOOLS = [
      {
        functionDeclarations: [
          {
            name: "query_inventory_database",
            description: "Query the store's real-time inventory database to check backroom stock levels for a given SKU",
            parameters: {
              type: Type.OBJECT,
              properties: {
                sku_id: { type: Type.STRING },
                store_id: { type: Type.STRING },
                location: { type: Type.STRING, enum: ["backroom", "warehouse", "supplier"] }
              },
              required: ["sku_id", "store_id", "location"]
            }
          },
          {
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
          },
          {
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
          },
          {
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
          }
        ]
      }
    ];

    try {
      // 1. Run CV Scan Simulation (Frontend message loop)
      for (let i = 0; i < 7; i++) {
        setLoadingStep(i);
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      }

      const apiKey = (process.env as any).GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in the environment.");
      }
      const ai = new GoogleGenAI({ apiKey });

      let cv_results;
      if (selectedImage) {
        // Real-time analysis using Gemini Vision
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(selectedImage);
        });
        const base64Data = await base64Promise;

        const visionResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              {
                text: "Act as a Computer Vision pipeline. Analyze this retail shelf image and identify empty slots (gaps) where products are missing. Return ONLY a JSON object with this structure: { \"gaps\": [ { \"shelf_level\": number (1-4), \"x_position_cm\": number (0-100), \"gap_width_cm\": number, \"expected_sku\": \"string\", \"confidence\": number } ], \"shelf_count\": number }"
              },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: selectedImage.type
                }
              }
            ]
          },
          config: {
            responseMimeType: "application/json"
          }
        });

        const visionJson = JSON.parse(visionResponse.text || "{}");
        cv_results = {
          ...visionJson,
          annotated_frame: `data:${selectedImage.type};base64,${base64Data}`
        };
      } else {
        // Fallback for demo
        cv_results = {
          gaps: [
            { shelf_level: 1, x_position_cm: 45.2, gap_width_cm: 12.0, expected_sku: "COKE_330_6P", confidence: 0.92 },
            { shelf_level: 2, x_position_cm: 12.5, gap_width_cm: 15.0, expected_sku: "LAYS_150G", confidence: 0.88 }
          ],
          shelf_count: 4,
          annotated_frame: null
        };
      }

      setLoadingStep(7); // "Executing Logic" stage

      // 2. Initialize Agent with Vision results
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: TOOLS as any,
          toolConfig: { includeServerSideToolInvocations: true }
        }
      });

      const agentPrompt = `Process this shelf gap report for store_id: STORE_001. \nReport: ${JSON.stringify(cv_results.gaps)}`;
      let response = await chat.sendMessage({ message: agentPrompt });
      let actions_taken: any[] = [];

      // 3. Tool Loop
      while (response.functionCalls) {
        setLoadingStep(8); // Executing Logic...
        const toolResults = [];
        for (const call of response.functionCalls) {
          // Execute tool on backend
          const toolResponse = await fetch('/api/execute-tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: call.name, args: call.args })
          });
          const result = await toolResponse.json();
          
          toolResults.push({
            id: call.id,
            name: call.name,
            response: result
          });
          actions_taken.push({ tool: call.name, args: call.args, result });
        }
        
        response = await chat.sendMessage({
          message: toolResults.map(tr => ({
            functionResponse: {
              name: tr.name,
              response: tr.response,
              id: tr.id
            }
          })) as any
        });
      }

      setScanResult({
        cv_results,
        agent_summary: response.text || "No summary provided by agent.",
        actions_taken
      });
      setActiveTab('results');
    } catch (error: any) {
      console.error("Scan failed", error);
      setScanResult({ error: error.message } as any);
      setActiveTab('results');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans technical-grid flex flex-col">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase italic">
              RetailEye <span className="text-[10px] font-bold text-slate-400 not-italic ml-2 tracking-widest bg-slate-100 px-2 py-0.5 rounded">v2.4.0</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              Autonomous Compliance & Replenishment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
            {selectedImage && !isScanning && (
              <div className="flex items-center gap-3 bg-slate-50 pl-2 pr-4 h-12 rounded-xl border border-slate-200">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                  <img 
                    src={URL.createObjectURL(selectedImage)} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{selectedImage.name}</span>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          <div className="hidden lg:flex items-center gap-3 text-[11px] font-bold px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full uppercase tracking-wider">
            Fivetran Sync Active
          </div>
          <div className="hidden md:flex items-center gap-3 text-[11px] font-bold px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-full uppercase tracking-wider">
            Store: #ORD-9921
          </div>
          <Button 
            onClick={handleStartScan} 
            disabled={isScanning}
            className={`h-12 px-8 rounded-lg font-black uppercase tracking-widest text-[11px] border-none shadow-xl transition-all active:scale-95 ${
              selectedImage 
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
            }`}
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : selectedImage ? (
              <>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Process Photo
              </>
            ) : (
              <>
                <ScanLine className="w-4 h-4 mr-2" />
                Run Inspection
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
          <div className="flex items-center justify-between">
            <TabsList className="bg-slate-200/50 border border-slate-200 p-1.5 rounded-2xl h-16 shadow-inner">
              <TabsTrigger value="dashboard" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md px-10 py-3 font-black text-xs uppercase tracking-widest transition-all">
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="results" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md px-10 py-3 font-black text-xs uppercase tracking-widest transition-all" disabled={!scanResult}>
                Vision Results
              </TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md px-10 py-3 font-black text-xs uppercase tracking-widest transition-all">
                Inventory
              </TabsTrigger>
            </TabsList>
            
            <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50/50 font-black px-4 py-1.5 tracking-widest">
              SYSTEM: OPERATIONAL
            </Badge>
          </div>

          <TabsContent value="dashboard" className="space-y-10 focus:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatsCard title="Compliance Score" value="82.5%" trend="+4% vs prev audit" color="text-indigo-600" />
              <StatsCard title="Detection Latency" value="840ms" trend="-12ms optimization" color="text-emerald-600" />
              <StatsCard title="Replenishment Queue" value="12" trend="4 critical stockouts" color="text-amber-600" />
              <StatsCard title="Arize Confidence" value="0.942" trend="+0.02 model drift" color="text-blue-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <Card className="lg:col-span-8 bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden p-0 border-none ring-1 ring-slate-100">
                <CardHeader className="p-8 border-b border-slate-100">
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Compliance Tracking</CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="h-[300px] flex items-end justify-between gap-3">
                    {[65, 80, 45, 90, 75, 85, 95, 70, 60, 82, 78, 92].map((v, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${v}%` }}
                          className={`w-full ${v > 85 ? 'bg-indigo-600' : 'bg-slate-100 group-hover:bg-indigo-100'} rounded-t-lg transition-all cursor-pointer shadow-sm`}
                        />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">A{i+1}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-4 space-y-8">
                <Card className="bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center border-none ring-1 ring-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase mb-8 tracking-widest">Section Compliance</h3>
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="88" cy="88" r="78" fill="transparent" stroke="#f8fafc" strokeWidth="16" />
                      <circle cx="88" cy="88" r="78" fill="transparent" stroke="#4f46e5" strokeWidth="16" strokeDasharray="490" strokeDashoffset="63.7" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-slate-900 tracking-tighter">87%</span>
                      <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">+4% DELTA</span>
                    </div>
                  </div>
                  <p className="mt-8 text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Aisle 07 Section 04<br/><span className="text-slate-400">Beverages / Soft Drinks</span></p>
                </Card>

                <Card className="bg-indigo-600 text-white rounded-2xl p-8 shadow-2xl shadow-indigo-600/30 border-none relative overflow-hidden">
                  <div className="absolute top-[-20%] right-[-20%] w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
                  <h3 className="text-xs font-black text-indigo-100 uppercase mb-8 tracking-widest relative z-10">Queue Manifest</h3>
                  <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-end">
                      <p className="text-xs font-bold uppercase tracking-widest">Processing</p>
                      <p className="text-3xl font-black tracking-tighter">12 Tickets</p>
                    </div>
                    <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden shadow-inner">
                      <div className="bg-white h-full w-2/3 shadow-[0_0_15px_rgba(255,255,255,0.6)]"></div>
                    </div>
                    <p className="text-[10px] text-indigo-100/60 font-bold uppercase tracking-widest">Assignee: Jordan R. (Associate-9)</p>
                  </div>
                  <Button className="w-full mt-10 bg-white text-indigo-600 font-black hover:bg-slate-50 rounded-xl h-14 uppercase tracking-widest text-xs relative z-10 shadow-xl shadow-black/10 active:scale-95 transition-all">Action Center</Button>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="mt-10 focus:outline-none">
            <AnimatePresence mode="wait">
              {isScanning ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="flex flex-col items-center justify-center py-40 bg-white rounded-[3rem] border-2 border-slate-200 border-dashed shadow-2xl shadow-slate-200/50"
                >
                  <div className="relative mb-12">
                    <div className="w-32 h-32 rounded-full border-t-[6px] border-indigo-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ScanLine className="w-14 h-14 text-indigo-600 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">{loadingMessages[loadingStep]}</h3>
                  <div className="flex items-center gap-3 px-6 py-2.5 bg-slate-900 text-slate-400 rounded-full font-mono text-[10px] uppercase tracking-widest border border-white/5">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span> Pipeline Executing Stage #X99
                  </div>
                </motion.div>
              ) : scanResult ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                  {(scanResult as any).error ? (
                    <Card className="lg:col-span-12 p-12 bg-red-50 border-red-200 rounded-3xl flex flex-col items-center justify-center text-center gap-6 shadow-xl">
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                        <AlertTriangle className="w-10 h-10" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Agent Pipeline Execution Failure</h3>
                        <p className="text-slate-500 font-mono text-sm max-w-2xl leading-relaxed">
                          The autonomous agent encountered a critical error during reasoning: <span className="text-red-600 font-bold">{(scanResult as any).error}</span>
                        </p>
                      </div>
                      <Button 
                        onClick={handleStartScan}
                        className="bg-red-600 hover:bg-red-700 text-white border-none rounded-xl px-10 h-14 font-black uppercase tracking-widest shadow-xl shadow-red-600/20"
                      >
                        Retry Inspection
                      </Button>
                    </Card>
                  ) : (
                    <>
                      {/* CV Column */}
                      <div className="lg:col-span-5 flex flex-col gap-8">
                        <Card className="bg-white border-slate-200 shadow-2xl rounded-2xl overflow-hidden p-0 border-none ring-1 ring-slate-100 h-[520px] flex flex-col">
                          <div className="px-6 h-14 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Vision Pipeline Output</span>
                            <Badge className="bg-indigo-600 text-white font-black text-[9px] tracking-widest">HOUGH: OK</Badge>
                          </div>
                          <div className="flex-1 bg-black relative overflow-hidden flex items-center justify-center">
                            <img 
                              src={scanResult.cv_results?.annotated_frame || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1280&h=720"} 
                              alt="Pipeline view" 
                              className="w-full h-full object-cover opacity-50 grayscale contrast-125" 
                            />
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="absolute w-full h-[1px] bg-red-500 top-1/4 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
                              <div className="absolute w-full h-[1px] bg-red-500 top-2/4 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
                              <div className="absolute w-full h-[1px] bg-red-500 top-3/4 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
                            </div>
                            {scanResult.cv_results?.gaps?.map((gap, i) => (
                              <div 
                                key={i}
                                className="absolute border-2 border-red-500 bg-red-500/20 shadow-[0_0_25px_rgba(239,68,68,0.4)] flex flex-col items-center justify-center"
                                style={{
                                  left: `${gap.x_position_cm}%`,
                                  top: `${gap.shelf_level * 25 + 10}%`,
                                  width: '60px',
                                  height: '120px'
                                }}
                              >
                                <span className="absolute -top-7 left-0 bg-red-500 text-[9px] font-black text-white px-2 py-0.5 uppercase tracking-widest">GAP {gap.gap_width_cm}cm</span>
                              </div>
                            ))}
                        <div className="absolute bottom-6 left-6 font-mono text-[9px] text-emerald-400 bg-black/80 p-4 border border-white/10 backdrop-blur-xl rounded-xl uppercase tracking-widest leading-relaxed">
                          Homography Correction: 0.982s<br/>Perspective: D-Skew Complete<br/>ORB Mapping... [OK]
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white border-slate-200 p-8 shadow-xl rounded-2xl flex flex-col border-none ring-1 ring-slate-100">
                      <div className="flex justify-between items-center mb-8">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Arize Monitoring</h4>
                        <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[10px]">STABLE</Badge>
                      </div>
                      <div className="flex justify-between items-end h-20 gap-2">
                        {[30, 45, 35, 60, 55, 80, 95, 85, 75, 94].map((v, i) => (
                          <div key={i} className={`flex-1 rounded-t-md transition-all duration-700 ${i === 9 ? 'bg-indigo-600 shadow-xl shadow-indigo-600/30 h-full' : 'bg-slate-100'} shadow-sm`} style={{ height: i === 9 ? '100%' : `${v}%` }}></div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-8 mt-10">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Confidence</p>
                          <p className="text-2xl font-black text-slate-900 tracking-tighter">0.942</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Drift Delta</p>
                          <p className="text-2xl font-black text-emerald-600 tracking-tighter">+2.1%</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Agent Column */}
                  <div className="lg:col-span-7 flex flex-col gap-8">
                    <Card className="bg-slate-950 rounded-[2rem] flex-1 flex flex-col shadow-2xl border-none ring-1 ring-white/10 overflow-hidden min-h-[720px]">
                      <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
                          <h2 className="text-[11px] font-black text-indigo-100 uppercase tracking-widest">Gemini-1.5-Pro Reasoner</h2>
                        </div>
                        <Badge variant="outline" className="border-white/10 text-slate-500 font-mono text-[9px]">RX-SESSION: 9942</Badge>
                      </div>

                      <div className="flex-1 p-10 font-mono text-xs overflow-hidden text-slate-300 leading-[1.8] tracking-tight custom-scrollbar">
                        <ScrollArea className="h-full">
                          {scanResult.agent_summary?.split('\n').map((line, i) => (
                            <div key={i} className={`mb-4 flex gap-6 ${line.startsWith('>') ? 'text-indigo-400' : ''}`}>
                              {line.startsWith('>') && <span className="text-slate-700 shrink-0">[{new Date().toLocaleTimeString()}]</span>}
                              <p className={line.includes('EXPENDED') || line.includes('STOCKOUT') ? 'text-amber-400 font-bold' : ''}>
                                {line}
                              </p>
                            </div>
                          ))}
                          <div className="mt-12 space-y-4">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest border-b border-white/10 pb-4 mb-6">Action Deployment Manifest</p>
                            {scanResult.actions_taken?.map((action, i) => (
                              <SleekActionItem key={i} action={action} />
                            ))}
                          </div>
                        </ScrollArea>
                      </div>

                      <div className="p-8 bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Compliance Status</span>
                          <span className="text-base font-black text-white italic tracking-tighter">Workflow Optimized +8.7%</span>
                        </div>
                        <Button variant="outline" className="h-12 border-white/10 text-white font-black uppercase tracking-widest px-8 rounded-xl hover:bg-white/5 active:scale-95 transition-all text-[11px]">Audit Manifest</Button>
                      </div>
                    </Card>
                  </div>
                </>
                  )}
                </div>
              ) : null}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="inventory" className="mt-10 focus:outline-none">
            <Card className="bg-white border-slate-200 shadow-2xl rounded-[2rem] overflow-hidden border-none ring-1 ring-slate-100">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-12">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl font-black uppercase tracking-tighter">Inventory Entity Explorer</CardTitle>
                    <CardDescription className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest italic">Global Instance: ORD-9921D-CHICAGO</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <Badge className="bg-emerald-500 text-white font-black px-6 py-2 rounded-full text-xs shadow-lg shadow-emerald-500/20">FIVETRAN LIVE SYNC</Badge>
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">Last Update: 12:44:02 CST</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-200">
                        <th className="px-12 py-8 text-[11px] font-black uppercase tracking-widest text-slate-400">SKU / Entity Mapping</th>
                        <th className="px-12 py-8 text-[11px] font-black uppercase tracking-widest text-indigo-600 text-center">Backroom Stock</th>
                        <th className="px-12 py-8 text-[11px] font-black uppercase tracking-widest text-blue-600 text-center">Whse Stock</th>
                        <th className="px-12 py-8 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Daily Vel.</th>
                        <th className="px-12 py-8 text-[11px] font-black uppercase tracking-widest text-slate-400">Action State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <SleekInvRow name="Coca-Cola 330ml 6P" sku="COKE_330_6P" br={45} wh={200} vel={15.5} status="STABLE" />
                      <SleekInvRow name="Lays Classic 150g" sku="LAYS_150G" br={0} wh={150} vel={22.0} status="RESTOCKING" />
                      <SleekInvRow name="Pepsi 500ml" sku="PEPSI_500" br={12} wh={80} vel={8.2} status="STABLE" />
                      <SleekInvRow name="Doritos Nacho 200g" sku="DOR_200" br={0} wh={0} vel={10.5} status="PO_PENDING" danger />
                      <SleekInvRow name="Dove Beauty Bar 100g" sku="DOVE_100" br={5} wh={30} vel={2.5} status="STABLE" />
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="h-16 bg-white border-t border-slate-200 px-10 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400 mt-auto shrink-0">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <span>RETAILEYE CORE 1.0: ONLINE</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <span>Fivetran: SYNCED</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Arize: 0.942 ACC</span>
        </div>
        <div className="flex items-center gap-10">
          <span>PLATFORM BY GOOGLE CLOUD | HACKATHON EDITION</span>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-slate-300 italic">© 2024</span>
        </div>
      </footer>
    </div>
  );
}

// --- Helper Components Update ---

function StatsCard({ title, value, trend, color }: any) {
  return (
    <Card className="bg-white border-none shadow-xl shadow-slate-200/40 rounded-2xl p-8 ring-1 ring-slate-100 hover:scale-[1.02] transition-all cursor-default">
      <CardHeader className="p-0 mb-4">
        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className={`text-4xl font-black tracking-tighter ${color} mb-2`}>{value}</div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{trend}</div>
      </CardContent>
    </Card>
  );
}

function SleekActionItem({ action }: { action: any; key?: any }) {
  const isPO = action.tool === 'generate_purchase_order';
  return (
    <motion.div 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`p-5 rounded-2xl border-none ring-1 flex items-center justify-between transition-all group hover:ring-2 ${isPO ? 'ring-indigo-500/30 bg-indigo-500/5 hover:ring-indigo-500' : 'ring-white/10 bg-white/5 hover:ring-white/20'}`}
    >
      <div className="flex items-center gap-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs ${isPO ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
          {isPO ? 'PO' : 'PT'}
        </div>
        <div>
          <h4 className="font-bold text-sm tracking-tight text-white mb-1">{isPO ? 'Automatic Purchase Order' : 'Backroom Restock Ticket'}</h4>
          <p className="text-[10px] font-mono text-slate-500">MANIFEST: {action.result.po_id || action.result.ticket_id} | ENTITY: {action.args.sku_id}</p>
        </div>
      </div>
      <Badge className={`text-[9px] font-black border-none px-3 py-1 ${isPO ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
        {isPO ? 'SENT EXEC' : 'ROUTED'}
      </Badge>
    </motion.div>
  );
}

function SleekInvRow({ name, sku, br, wh, vel, status, danger }: any) {
  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-12 py-10">
        <div className={`font-black text-lg tracking-tight ${danger ? 'text-red-500' : 'text-slate-900 group-hover:text-indigo-600'}`}>{name}</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">ID: {sku}</div>
      </td>
      <td className="px-12 py-10 text-center">
        <span className={`text-2xl font-black font-mono tracking-tighter ${br === 0 ? 'text-red-500' : 'text-slate-900'}`}>{br}</span>
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Units Local</div>
      </td>
      <td className="px-12 py-10 text-center">
        <span className="text-2xl font-black font-mono tracking-tighter text-slate-900">{wh}</span>
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Whse Stock</div>
      </td>
      <td className="px-12 py-10 text-center font-black text-slate-600 text-base italic">
        {vel}
      </td>
      <td className="px-12 py-10">
        <Badge variant="outline" className={`text-[10px] font-black py-1.5 px-4 rounded-full border-none ring-1 ${danger ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
          {status}
        </Badge>
      </td>
    </tr>
  );
}

