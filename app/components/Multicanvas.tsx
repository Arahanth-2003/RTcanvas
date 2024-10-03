"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import io from "socket.io-client";

let socket: any;

interface MultiCanvasProps {
  canvasRoomId: string;
}

const MultiCanvas = ({ canvasRoomId }: MultiCanvasProps) => {
    console.log("Canvas Room ID:", canvasRoomId);  
  const canvasRefs = useRef<{ [id: string]: HTMLCanvasElement | null }>({});
  const [isDrawing, setIsDrawing] = useState<{ [id: string]: boolean }>({});
  const [lastPos, setLastPos] = useState<{ [id: string]: { x: number; y: number } | null }>({});
  const [canvases, setCanvases] = useState<{ id: string }[]>([]);
  const [canvasHistory, setCanvasHistory] = useState<{ [id: string]: any[] }>({});

  useEffect(() => {
    // Connect to the server
    socket = io("http://localhost:4000"); // Adjust this to your socket endpoint
    console.log("Socket instance created");
    
    // Join the canvas room based on the URL
    socket.on("connect", () => {
        console.log("Connected to socket server"); // Log for debugging
        socket.emit("join-room", canvasRoomId);
      });

    // Load all canvases and their history for the current room
    socket.on("load-room-canvases", (canvasData: any) => {
      console.log("Received canvas data:", canvasData);
      setCanvases((prevCanvases) => {
        const newCanvases = canvasData.filter((canvas: any) => !prevCanvases.some(c => c.id === canvas.id));
        return [...prevCanvases, ...newCanvases];
      });

      // Initialize canvas history for each canvas
      canvasData.forEach((canvas: any) => {
        setCanvasHistory((prevHistory) => ({
          ...prevHistory,
          [canvas.id]: canvas.drawings || [],
        }));
      });
    });

    // Listen for new canvas creation within the room
    socket.on("new-canvas", (newCanvas: any) => {
        console.log("New canvas created:", newCanvas);
        setCanvases((prevCanvases) => {
          if (!prevCanvases.some(c => c.id === newCanvas.id)) {
            setCanvasHistory((prevHistory) => ({
              ...prevHistory,
              [newCanvas.id]: [], // Initialize empty history
            }));
            return [...prevCanvases, { id: newCanvas.id }];
          }
          return prevCanvases;
        });
    });

    // Listen for drawing events
    socket.on("draw", (data: any) => {
      const { canvasId, drawing } = data;
      // Save the drawing to the local history as well
      setCanvasHistory((prevHistory) => ({
        ...prevHistory,
        [canvasId]: [...(prevHistory[canvasId] || []), drawing],
      }));
    });

    // Listen for clear canvas events
    socket.on("clear-canvas", (data: any) => {
      const { canvasId } = data;
      const canvas = canvasRefs.current[canvasId];
      const context = canvas?.getContext("2d");

      if (context && canvas) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      setCanvasHistory((prevHistory) => ({
        ...prevHistory,
        [canvasId]: [], // Clear the shared history
      }));
    });

    return () => {
      socket?.off("draw");
      socket?.off("new-canvas");
      socket?.off("clear-canvas");
      socket?.off("load-room-canvases");
    };
  }, [canvasRoomId]);

  // Apply the drawing history to each canvas when mounted
  useEffect(() => {
    Object.keys(canvasHistory).forEach((canvasId) => {
      const context = canvasRefs.current[canvasId]?.getContext("2d");
      const history = canvasHistory[canvasId];

      if (context && history) {
        history.forEach((drawing: any) => {
          context.strokeStyle = "#000";
          context.lineWidth = 5;
          context.beginPath();
          context.moveTo(drawing.x0, drawing.y0);
          context.lineTo(drawing.x1, drawing.y1);
          context.stroke();
        });
      }
    });
  }, [canvasHistory]);

  // Handle drawing events
  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>, canvasId: string) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setIsDrawing((prev) => ({ ...prev, [canvasId]: true }));
    setLastPos((prev) => ({ ...prev, [canvasId]: { x: offsetX, y: offsetY } }));
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>, canvasId: string) => {
    if (!isDrawing[canvasId] || !lastPos[canvasId]) return;

    const { offsetX, offsetY } = e.nativeEvent;
    draw(lastPos[canvasId]!.x, lastPos[canvasId]!.y, offsetX, offsetY, canvasId);
    setLastPos((prev) => ({ ...prev, [canvasId]: { x: offsetX, y: offsetY } }));
  };

  const handleMouseUp = (e: MouseEvent<HTMLCanvasElement>, canvasId: string) => {
    setIsDrawing((prev) => ({ ...prev, [canvasId]: false }));
    setLastPos((prev) => ({ ...prev, [canvasId]: null }));
  };

  const draw = (x0: number, y0: number, x1: number, y1: number, canvasId: string, emit = true) => {
    const canvas = canvasRefs.current[canvasId];
    const context = canvas?.getContext("2d");

    if (!context) return;

    context.strokeStyle = "#000";
    context.lineWidth = 5;

    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();

    if (emit) {
      socket.emit("draw", {
        canvasId,
        drawing: { x0, y0, x1, y1, color: "#000", lineWidth: 5 },
        roomId: canvasRoomId,
      });
    }
  };

  const clearCanvas = (canvasId: string) => {
    const canvas = canvasRefs.current[canvasId];
    const context = canvas?.getContext("2d");

    if (context && canvas) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      setCanvasHistory((prevHistory) => ({
        ...prevHistory,
        [canvasId]: [], // Clear the shared history
      }));
      socket.emit("clear-canvas", { canvasId, roomId: canvasRoomId });
    }
  };

  const addNewCanvas = () => {
    const newCanvasId = `canvas-${Date.now()}`;
    socket.emit("new-canvas", { roomId: canvasRoomId, id: newCanvasId });
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