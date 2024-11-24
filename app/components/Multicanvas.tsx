"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import io from "socket.io-client";

let socket: any;

interface MultiCanvasProps {
  canvasRoomId: string;
}

const MultiCanvas = ({ canvasRoomId }: MultiCanvasProps) => {
  const canvasRefs = useRef<{ [id: string]: HTMLCanvasElement | null }>({});
  const [canvases, setCanvases] = useState<{ id: string }[]>([]);
  const [canvasHistory, setCanvasHistory] = useState<{ [id: string]: any[] }>({});
  const [penColor, setPenColor] = useState<string>("#000000");
  const [lineWidth, setLineWidth] = useState<number>(5);
  const [isDrawing, setIsDrawing] = useState<{ [id: string]: boolean }>({});
  const [lastPos, setLastPos] = useState<{ [id: string]: { x: number; y: number } | null }>({});
  const [textAreas, setTextAreas] = useState<{ [id: string]: any[] }>({});
  const [draggingText, setDraggingText] = useState<{
    canvasId: string;
    textId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    socket = io("http://localhost:4000");

    socket.on("connect", () => {
      socket.emit("join-room", canvasRoomId);
    });

    socket.on("load-room-canvases", (canvasData: any) => {
      setCanvases((prevCanvases) => {
        const newCanvases = canvasData.filter(
          (canvas: any) => !prevCanvases.some((c) => c.id === canvas.id)
        );
        return [...prevCanvases, ...newCanvases];
      });

      canvasData.forEach((canvas: any) => {
        setCanvasHistory((prevHistory) => ({
          ...prevHistory,
          [canvas.id]: canvas.drawings || [],
        }));
        setTextAreas((prevAreas) => ({
          ...prevAreas,
          [canvas.id]: canvas.textAreas || [],
        }));
      });
    });

    socket.on("new-canvas", (newCanvas: any) => {
      setCanvases((prevCanvases) => {
        if (!prevCanvases.some((c) => c.id === newCanvas.id)) {
          setCanvasHistory((prevHistory) => ({
            ...prevHistory,
            [newCanvas.id]: [],
          }));
          setTextAreas((prevAreas) => ({
            ...prevAreas,
            [newCanvas.id]: [],
          }));
          return [...prevCanvases, { id: newCanvas.id }];
        }
        return prevCanvases;
      });
    });

    socket.on("draw", (data: any) => {
      const { canvasId, drawing } = data;
      setCanvasHistory((prevHistory) => ({
        ...prevHistory,
        [canvasId]: [...(prevHistory[canvasId] || []), drawing],
      }));
    });

    socket.on("text-update", ({ canvasId, textAreas }: any) => {
      setTextAreas((prevAreas) => ({
        ...prevAreas,
        [canvasId]: textAreas,
      }));
    });

    socket.on("clear-canvas", (data: any) => {
      const { canvasId } = data;
      const canvas = canvasRefs.current[canvasId];
      const context = canvas?.getContext("2d");
      if (context && canvas) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      setCanvasHistory((prevHistory) => ({
        ...prevHistory,
        [canvasId]: [],
      }));
      setTextAreas((prevAreas) => ({
        ...prevAreas,
        [canvasId]: [],
      }));
    });

    socket.on("delete-canvas", (canvasId: string) => {
      setCanvases((prevCanvases) => prevCanvases.filter((canvas) => canvas.id !== canvasId));
      setCanvasHistory((prevHistory) => {
        const updatedHistory = { ...prevHistory };
        delete updatedHistory[canvasId];
        return updatedHistory;
      });
      setTextAreas((prevAreas) => {
        const updatedAreas = { ...prevAreas };
        delete updatedAreas[canvasId];
        return updatedAreas;
      });
    });

    return () => {
      socket?.off("draw");
      socket?.off("text-update");
      socket?.off("new-canvas");
      socket?.off("clear-canvas");
      socket?.off("delete-canvas");
      socket?.off("load-room-canvases");
    };
  }, [canvasRoomId]);

  useEffect(() => {
    Object.keys(canvasHistory).forEach((canvasId) => {
      const context = canvasRefs.current[canvasId]?.getContext("2d");
      const history = canvasHistory[canvasId];

      if (context && history) {
        history.forEach((drawing: any) => {
          context.strokeStyle = drawing.color || "#000";
          context.lineWidth = drawing.lineWidth || 5;
          context.beginPath();
          context.moveTo(drawing.x0, drawing.y0);
          context.lineTo(drawing.x1, drawing.y1);
          context.stroke();
        });
      }
    });
  }, [canvasHistory]);

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

    context.strokeStyle = penColor;
    context.lineWidth = lineWidth;

    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();

    if (emit) {
      socket.emit("draw", {
        canvasId,
        drawing: { x0, y0, x1, y1, color: penColor, lineWidth },
        roomId: canvasRoomId,
      });
    }
  };

  const addTextArea = (canvasId: string) => {
    const newTextArea = {
      id: `text-${Date.now()}`,
      x: 50,
      y: 50,
      width: 150,
      height: 50,
      value: "",
    };

    setTextAreas((prevAreas) => {
      const updatedAreas = {
        ...prevAreas,
        [canvasId]: [...(prevAreas[canvasId] || []), newTextArea],
      };

      socket.emit("text-update", { canvasId, textAreas: updatedAreas[canvasId], roomId: canvasRoomId });
      return updatedAreas;
    });
  };

  const updateTextArea = (canvasId: string, textId: string, property: string, value: any) => {
    setTextAreas((prevAreas) => {
      const updatedAreas = {
        ...prevAreas,
        [canvasId]: prevAreas[canvasId].map((area: any) =>
          area.id === textId ? { ...area, [property]: value } : area
        ),
      };
  
      // Emit updated text areas to other users
      socket.emit("text-update", { canvasId, textAreas: updatedAreas[canvasId], roomId: canvasRoomId });
      return updatedAreas;
    });
  };
  

  const handleTextMouseDown = (
    e: MouseEvent<HTMLTextAreaElement>,
    canvasId: string,
    textId: string
  ) => {
    e.stopPropagation();
    const { clientX, clientY } = e;
    const textArea = textAreas[canvasId].find((area: any) => area.id === textId);
    if (textArea) {
      const offsetX = clientX - textArea.x;
      const offsetY = clientY - textArea.y;
      setDraggingText({ canvasId, textId, offsetX, offsetY });
    }
  };
  
  const handleTextMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!draggingText) return;
  
    const { canvasId, textId, offsetX, offsetY } = draggingText;
    const { clientX, clientY } = e;
  
    setTextAreas((prevAreas) => {
      const updatedAreas = {
        ...prevAreas,
        [canvasId]: prevAreas[canvasId].map((area: any) =>
          area.id === textId ? { ...area, x: clientX - offsetX, y: clientY - offsetY } : area
        ),
      };
  
      // Emit the updated text position to the server
      socket.emit("text-update", { canvasId, textAreas: updatedAreas[canvasId], roomId: canvasRoomId });
      return updatedAreas;
    });
  };
  
  const handleTextMouseUp = () => {
    setDraggingText(null);
  };
  

  const clearCanvas = (canvasId: string) => {
    const canvas = canvasRefs.current[canvasId];
    const context = canvas?.getContext("2d");

    if (context && canvas) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      setCanvasHistory((prevHistory) => ({
        ...prevHistory,
        [canvasId]: [],
      }));
      setTextAreas((prevAreas) => ({
        ...prevAreas,
        [canvasId]: [],
      }));
      socket.emit("clear-canvas", { canvasId, roomId: canvasRoomId });
    }
  };

  const deleteCanvas = (canvasId: string) => {
    setCanvases((prevCanvases) => prevCanvases.filter((canvas) => canvas.id !== canvasId));
    setCanvasHistory((prevHistory) => {
      const updatedHistory = { ...prevHistory };
      delete updatedHistory[canvasId];
      return updatedHistory;
    });
    setTextAreas((prevAreas) => {
      const updatedAreas = { ...prevAreas };
      delete updatedAreas[canvasId];
      return updatedAreas;
    });
    socket.emit("delete-canvas", { canvasId, roomId: canvasRoomId });
  };

  const addNewCanvas = () => {
    const newCanvasId = `canvas-${Date.now()}`;
    socket.emit("new-canvas", { roomId: canvasRoomId, id: newCanvasId });
  };

  return (
    <div
      className="flex flex-col items-center bg-gray-100 min-h-screen py-8"
      onMouseMove={handleTextMouseMove}
      onMouseUp={handleTextMouseUp}
    >
      {/* Control Panel */}
      <div className="fixed top-4 left-4 flex space-x-4 bg-white p-4 rounded-lg shadow-lg">
        <button
          onClick={addNewCanvas}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition"
        >
          Add Canvas
        </button>
        <div className="flex items-center space-x-2">
          <label htmlFor="color-picker" className="text-gray-700 font-semibold">
            Color:
          </label>
          <input
            id="color-picker"
            type="color"
            value={penColor}
            onChange={(e) => setPenColor(e.target.value)}
            className="w-10 h-10 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="line-width" className="text-gray-700 font-semibold">
            Width:
          </label>
          <input
            id="line-width"
            type="number"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value, 10))}
            className="w-16 px-2 py-1 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
  
      {/* Canvases */}
      <div className="mt-16 w-full max-w-5xl space-y-8">
        {canvases.map((canvas) => (
          <div
            key={canvas.id}
            className="p-4 bg-white rounded-lg shadow-lg relative"
          >
            <div className="flex justify-between mb-4">
              <button
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                onClick={() => clearCanvas(canvas.id)}
              >
                Clear
              </button>
              <button
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                onClick={() => deleteCanvas(canvas.id)}
              >
                Delete
              </button>
              <button
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                onClick={() => addTextArea(canvas.id)}
              >
                Add Text
              </button>
            </div>
            <canvas
              ref={(el) => {
                canvasRefs.current[canvas.id] = el;
              }}
              onMouseDown={(e) => handleMouseDown(e, canvas.id)}
              onMouseMove={(e) => handleMouseMove(e, canvas.id)}
              onMouseUp={(e) => handleMouseUp(e, canvas.id)}
              width={800}
              height={600}
              className="border-2 border-gray-300 rounded-lg bg-white shadow-md cursor-crosshair"
            />
            {textAreas[canvas.id]?.map((textArea) => (
              <textarea
              key={textArea.id}
              style={{
                position: "absolute",
                top: textArea.y,
                left: textArea.x,
                width: `${textArea.width}px`,
                height: `${textArea.height}px`,
                resize: "both", // Enable resizing
                zIndex: 10,
                backgroundColor: "#ffffff",
                border: "1px solid #ccc",
                overflow: "auto",
              }}
              className="p-2 rounded-md"
              value={textArea.value}
              onChange={(e) =>
                updateTextArea(canvas.id, textArea.id, "value", e.target.value)
              }
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const isResizeCorner =
                  rect.width - (e.clientX - rect.left) < 10 &&
                  rect.height - (e.clientY - rect.top) < 10;
            
                if (!isResizeCorner) {
                  handleTextMouseDown(e, canvas.id, textArea.id);
                }
              }}
              onBlur={(e) => {
                const element = e.target as HTMLTextAreaElement; // Explicit cast
                updateTextArea(canvas.id, textArea.id, "width", element.offsetWidth);
                updateTextArea(canvas.id, textArea.id, "height", element.offsetHeight);
              }}
            />            
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  
};

export default MultiCanvas;
