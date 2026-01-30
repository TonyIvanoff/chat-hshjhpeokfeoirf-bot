"use client";

import { Header } from "@/components/Header";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { PDFEditor } from "@/components/PDFEditor";

export default function Home() {
  return (
    <DndProvider backend={HTML5Backend}>
      <main className="min-h-screen bg-slate-900 overflow-hidden font-sans">
        <Header />
        <PDFEditor />
      </main>
    </DndProvider>
  );
}
