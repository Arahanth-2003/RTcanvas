"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import io from "socket.io-client";

// Initialize the Socket.IO connection
let socket: any;

const MultiCanvas = () => {
  const canvasRefs = useRef<{ [id: string]: HTMLCanvasElement | null }>({});
  const [isDrawing, setIsDrawing] = useState<{ [id: string]: boolean }>({});
  const [lastPos, setLastPos] = useState<{ [id: string]: { x: number; y: number } | null }>({});
  const [canvases, setCanvases] = useState<{ id: string }[]>([]); // To store list of canvases

  useEffect(() => {
    // Connect to the Socket.IO server
    socket = io("http://localhost:4000"); // Adjust this to your socket endpoint
  
    // Load all canvases and their history when a new user joins
    socket.on("load-canvas-history", (canvasData: any) => {
      canvasData.forEach((canvas: any) => {
        setCanvases((prevCanvases) => [...prevCanvases, { id: canvas.id }]);
        canvas.drawings.forEach((drawing: any) => {
          const context = canvasRefs.current[canvas.id]?.getContext("2d");
          if (context) {
            console.log('Drawing:', drawing);
            context.strokeStyle = drawing.color;
            context.lineWidth = drawing.lineWidth;
            context.beginPath();
            context.moveTo(drawing.x0, drawing.y0);
            context.lineTo(drawing.x1, drawing.y1);
            context.stroke();
          }
        });
      });
    });

    // Listen for new canvas creation and add it
    socket.on("new-canvas", (newCanvas: any) => {
      setCanvases((prevCanvases) => {
        // Check if the new canvas already exists
        if (!prevCanvases.some(c => c.id === newCanvas.id)) {
          return [...prevCanvases, { id: newCanvas.id }];
        }
        return prevCanvases;
      });
    });

    // Listen for draw events from other clients
    socket.on("draw", (data: any) => {
      const { canvasId, drawing } = data;
      const canvas = canvasRefs.current[canvasId];
      const context = canvas?.getContext("2d");

      if (!context) return;

      context.strokeStyle = drawing.color;
      context.lineWidth = drawing.lineWidth;
      context.beginPath();
      context.moveTo(drawing.x0, drawing.y0);
      context.lineTo(drawing.x1, drawing.y1);
      context.stroke();
    });

    // Listen for clear canvas events
    socket.on("clear-canvas", (data: any) => {
      const { canvasId } = data;
      const canvas = canvasRefs.current[canvasId];
      const context = canvas?.getContext("2d");

      if (context && canvas) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    return () => {
      socket?.off("draw");
      socket?.off("load-canvas-history");
      socket?.off("new-canvas");
      socket?.off("clear-canvas");
    };
  }, []);

  // Handle mouse down event
  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>, canvasId: string) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setIsDrawing((prev) => ({ ...prev, [canvasId]: true }));
    setLastPos((prev) => ({ ...prev, [canvasId]: { x: offsetX, y: offsetY } }));
  };

  // Handle mouse move event
  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>, canvasId: string) => {
    if (!isDrawing[canvasId] || !lastPos[canvasId]) return;

    const { offsetX, offsetY } = e.nativeEvent;
    draw(lastPos[canvasId]!.x, lastPos[canvasId]!.y, offsetX, offsetY, canvasId);
    setLastPos((prev) => ({ ...prev, [canvasId]: { x: offsetX, y: offsetY } }));
  };

  // Handle mouse up event
  const handleMouseUp = (e: MouseEvent<HTMLCanvasElement>, canvasId: string) => {
    setIsDrawing((prev) => ({ ...prev, [canvasId]: false }));
    setLastPos((prev) => ({ ...prev, [canvasId]: null }));
  };

  // Draw on the canvas and emit the drawing event
  const draw = (x0: number, y0: number, x1: number, y1: number, canvasId: string, emit = true) => {
    const canvas = canvasRefs.current[canvasId];
    const context = canvas?.getContext("2d");

    if (!context) return;

    // Set drawing styles
    context.strokeStyle = "#000"; // Default color
    context.lineWidth = 5; // Default line width

    // Draw on the canvas
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();

    // Emit the drawing event to other clients
    if (emit) {
      socket.emit("draw", {
        canvasId,
        drawing: { x0, y0, x1, y1, color: "#000", lineWidth: 5 },
      });
    }
  };

  // Clear the selected canvas
  const clearCanvas = (canvasId: string) => {
    const canvas = canvasRefs.current[canvasId];

    if (!canvas) return;
    const context = canvas.getContext("2d");

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Emit the clear event to the server
      socket.emit("clear-canvas", { canvasId });
    }
  };

  // Add a new canvas (Emit the request and rely on the server response to add the canvas)
  const addNewCanvas = () => {
    const newCanvasId = `canvas-${Date.now()}`;
    socket.emit("new-canvas", { id: newCanvasId }); // Let the server add the new canvas
  };

  return (
    <div className="flex flex-col items-center">
      <button onClick={addNewCanvas} className="fixed top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded">
        Add New Canvas
      </button>

      <div className="mt-16 space-y-8">
        {canvases.map((canvas) => (
          <div key={canvas.id}>
            <div className="flex justify-center mb-2">
              <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => clearCanvas(canvas.id)}>
                Clear Canvas {canvas.id}
              </button>
            </div>
            <canvas
              ref={(el) => {
                canvasRefs.current[canvas.id] = el;
              }}
              onMouseDown={(e) => handleMouseDown(e, canvas.id)}
              onMouseMove={(e) => handleMouseMove(e, canvas.id)}
              onMouseUp={(e) => handleMouseUp(e, canvas.id)}
              onMouseLeave={(e) => handleMouseUp(e, canvas.id)}
              width={800}
              height={600}
              className="border-2 border-black rounded-lg bg-white shadow-lg cursor-crosshair"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiCanvas;
