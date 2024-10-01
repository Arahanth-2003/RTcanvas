"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import { Socket } from "socket.io-client";
import io from "socket.io-client";

let socket: any;

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState("#000"); // Default color
  const [lineWidth, setLineWidth] = useState(5); // Default line width

  useEffect(() => {
    // Connect to the Socket.IO server
    socket = io("http://localhost:4000"); // Adjust this to your socket endpoint

    // Listen for draw events from other clients
    socket.on("draw", (data:any) => {
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

    // Load the entire drawing history for a new user
    socket.on('load-drawing-history', (history:any) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");

      if (!context) return;

      // Render each drawing from history
      history.forEach((data:any) => {
        context.strokeStyle = data.color;
        context.lineWidth = data.lineWidth;
        context.beginPath();
        context.moveTo(data.x0, data.y0);
        context.lineTo(data.x1, data.y1);
        context.stroke();
      });
    });

    // Listen for the clear canvas event
    socket.on("clear-canvas", () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");

      if (context && canvas) {
        context.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
      }
    });

    return () => {
      socket?.off("draw");
      socket?.off("load-drawing-history");
      socket?.off("clear-canvas"); // Clean up the clear canvas listener
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
    draw(lastPos.x, lastPos.y, offsetX, offsetY);

    // Update the last position to the new one
    setLastPos({ x: offsetX, y: offsetY });
  };

  const draw = (x0: number, y0: number, x1: number, y1: number, emit = true) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!context) return;

    // Set the drawing style
    context.strokeStyle = color; // Use selected color
    context.lineWidth = lineWidth; // Use selected line width

    // Draw on the canvas
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();

    // Emit drawing data to other clients
    if (emit) {
      socket?.emit("draw", { x0, y0, x1, y1, color, lineWidth });
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Emit the clear event to the server
    socket?.emit("clear");
  };

  // Change color handler
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
  };

  // Change line width handler
  const handleLineWidthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLineWidth(Number(e.target.value));
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-100">
      <div className="flex space-x-4 mb-4">
        <input type="color" value={color} onChange={handleColorChange} />
        <select value={lineWidth} onChange={handleLineWidthChange}>
          <option value={5}>5px</option>
          <option value={10}>10px</option>
          <option value={15}>15px</option>
          <option value={20}>20px</option>
        </select>
        <button className="bg-slate-500" onClick={clearCanvas}>Clear Canvas</button>
      </div>
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
