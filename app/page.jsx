// app/page.tsx
"use client";

import Link from "next/link";
import { v4 as uuidv4 } from "uuid"; // Ensure this library is installed

export default function Home() {
  const generateCanvasId = () => {
    return `canvas-${uuidv4()}`; // Generate a unique canvas ID
  };

  return (
    <div className="bg-white text-black flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl mb-4">Welcome to the Collaborative Canvas (Only for laptops and PC's) </h1>
      <Link href={`/canvas/${generateCanvasId()}`}>
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Create New Canvas
        </button>
      </Link>
    </div>
  );
}
