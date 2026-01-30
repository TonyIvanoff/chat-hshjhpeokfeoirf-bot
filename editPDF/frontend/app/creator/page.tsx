"use client";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Header } from "@/components/Header";
import { CreatorToolbox } from "@/components/Creator/CreatorToolbox";
import { CreatorCanvas } from "@/components/Creator/CreatorCanvas";

export default function CreatorPage() {
    return (
        <DndProvider backend={HTML5Backend}>
            <main className="min-h-screen flex flex-col">
                <Header />
                <div className="flex-1 flex gap-6 p-6 mt-16">
                    {/* Left: Toolbox */}
                    <div className="w-64 flex-shrink-0">
                        <CreatorToolbox />
                    </div>

                    {/* Center: Canvas */}
                    <div className="flex-1 flex justify-center bg-slate-100/50 rounded-2xl border border-slate-200 overflow-auto p-10">
                        <CreatorCanvas />
                    </div>

                    {/* Right: Properties Panel (Future) */}
                    <div className="w-72 glass-panel rounded-2xl p-4 hidden lg:block">
                        <h3 className="font-semibold text-slate-700 mb-4">Properties</h3>
                        <p className="text-sm text-slate-500">Select an element to edit properties.</p>
                    </div>
                </div>
            </main>
        </DndProvider>
    );
}
