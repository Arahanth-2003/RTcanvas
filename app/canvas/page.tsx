"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import io, { Socket } from "socket.io-client";

let socket: Socket | undefined;

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Connect to the Socket.IO server
    socket = io("/api/socket"); // Adjust this to your socket endpoint

    // Listen for draw events from other clients
    socket.on("draw", (data) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");

      if (!context) return;

      // Draw using the data received from other users
      context.strokeStyle = data.color;
      context.lineWidth = data.lineWidth;
      context.beginPath();
      context.moveTo(data.x0, data.y0);
      context.lineTo(data.x1, data.y1);
      context.stroke();
    });

    return () => {
      socket?.off("draw"); // Clean up the listener on component unmount
    };
  }, []);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setIsDrawing(true);
    setLastPos({ x: offsetX, y: offsetY });
  };

  const finishDrawing = () => {
    setIsDrawing(false);
    setLastPos(null);
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPos) return;

    const { offsetX, offsetY } = e.nativeEvent;
    draw(lastPos.x, lastPos.y, offsetX, offsetY); // Corrected: Pass all four arguments

    // Update the last position to the new one
    setLastPos({ x: offsetX, y: offsetY });
  };

  const draw = (x0: number, y0: number, x1: number, y1: number, emit = true) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!context) return;

    // Set the drawing style
    context.strokeStyle = "#000"; // Black color for now
    context.lineWidth = 5;

    // Draw on the canvas
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();

    // Emit drawing data to other clients
    if (emit) {
      socket?.emit("draw", { x0, y0, x1, y1, color: "#000", lineWidth: 5 });
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={handleMouseMove}
        onMouseUp={finishDrawing}
        onMouseLeave={finishDrawing} // Stop drawing when the mouse leaves the canvas
        width={800}
        height={600}
        className="border-2 border-black rounded-lg bg-white shadow-lg cursor-crosshair"
      />
    </div>
  );
};

export default Canvas;
