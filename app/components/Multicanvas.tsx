"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import io from "socket.io-client";
import { Socket } from "socket.io-client";

interface MultiCanvasProps {
  canvasRoomId: string;
}


interface MultiCanvasProps {
  canvasRoomId: string;
}

const MultiCanvas = ({ canvasRoomId }: MultiCanvasProps) => {
  const socketRef = useRef<typeof Socket | null>(null);
  const canvasRefs = useRef<{ [id: string]: HTMLCanvasElement | null }>({});
  const [canvases, setCanvases] = useState<{ id: string }[]>([]);
  const [canvasHistory, setCanvasHistory] = useState<{ [id: string]: any[] }>({});
  const [penColor, setPenColor] = useState<string>("#000000");
  const [lineWidth, setLineWidth] = useState<number>(5);
  const [eraserSize, setEraserSize] = useState<number>(30);
  const [isDrawing, setIsDrawing] = useState<{ [id: string]: boolean }>({});
  const [lastPos, setLastPos] = useState<{ [id: string]: { x: number; y: number } | null }>({});
  const [textAreas, setTextAreas] = useState<{ [id: string]: any[] }>({});
  const [draggingText, setDraggingText] = useState<{
    canvasId: string;
    textId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [eraserMode, setEraserMode] = useState(false);
  useEffect(() => {
    socketRef.current = io("https://bad-kathy-chekuri-96c250bc.koyeb.app/");

    socketRef.current.on("connect", () => {
      socketRef.current?.emit("join-room", canvasRoomId);
    });

    socketRef.current.on("load-room-canvases", (canvasData: any) => {
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

    socketRef.current.on("new-canvas", (newCanvas: any) => {
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

    socketRef.current.on("draw", (data: any) => {
      const { canvasId, drawing, eraserMode } = data;
    
      if (eraserMode) {
        // Handle erasing in canvas history
        setCanvasHistory((prevHistory) => {
          const updatedHistory = { ...prevHistory };
          updatedHistory[canvasId] = (updatedHistory[canvasId] || []).filter(
            (line: any) =>
              !(
                (line.x1 >= drawing.x0 - drawing.lineWidth &&
                  line.x1 <= drawing.x0 + drawing.lineWidth) &&
                (line.y1 >= drawing.y0 - drawing.lineWidth &&
                  line.y1 <= drawing.y0 + drawing.lineWidth)
              )
          );
          return updatedHistory;
        });
      } else {
        // Add the new drawing to the history
        setCanvasHistory((prevHistory) => ({
          ...prevHistory,
          [canvasId]: [...(prevHistory[canvasId] || []), drawing],
        }));
      }
    });
    

    socketRef.current.on("text-update", ({ canvasId, textAreas }: any) => {
      setTextAreas((prevAreas) => ({
        ...prevAreas,
        [canvasId]: textAreas,
      }));
    });

    socketRef.current.on("clear-canvas", (data: any) => {
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

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from the server");
    });

    socketRef.current.on("room-deleted", (roomId : any) => {
      if (roomId === canvasRoomId) {
        alert("The room has been deleted because all users left.");
        // Optionally, navigate the user to a different page or reset state
      }
    });
    

    socketRef.current.on("delete-canvas", (canvasId: string) => {
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
      socketRef.current?.off("draw");
      socketRef.current?.off("text-update");
      socketRef.current?.off("new-canvas");
      socketRef.current?.off("clear-canvas");
      socketRef.current?.off("delete-canvas");
      socketRef.current?.off("load-room-canvases");
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
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;
  
    // Perform drawing/erasing only if the mouse button is pressed
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
  
    if (eraserMode) {
      // Use white to "erase" and update the canvas history
      context.strokeStyle = "#FFFFFF"; // White background for erasing
      context.lineWidth = eraserSize;
  
      // Update canvas history to reflect the erasing operation
      setCanvasHistory((prevHistory) => {
        const updatedHistory = { ...prevHistory };
        updatedHistory[canvasId] = (updatedHistory[canvasId] || []).filter(
          (drawing: any) => {
            // Erase lines that intersect with the eraser's path
            return !(
              (drawing.x1 >= x0 - eraserSize && drawing.x1 <= x0 + eraserSize) &&
              (drawing.y1 >= y0 - eraserSize && drawing.y1 <= y0 + eraserSize)
            );
          }
        );
        return updatedHistory;
      });
    } else {
      // Regular drawing
      context.strokeStyle = penColor;
      context.lineWidth = lineWidth;
  
      // Add the new drawing path to the canvas history
      setCanvasHistory((prevHistory) => {
        const updatedHistory = { ...prevHistory };
        updatedHistory[canvasId] = [
          ...(updatedHistory[canvasId] || []),
          { x0, y0, x1, y1, color: penColor, lineWidth },
        ];
        return updatedHistory;
      });
    }
  
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
  
    if (emit) {
      socketRef.current?.emit("draw", {
        canvasId,
        drawing: {
          x0,
          y0,
          x1,
          y1,
          color: eraserMode ? "#FFFFFF" : penColor,
          lineWidth: eraserMode ? eraserSize : lineWidth,
          eraserMode, // Include eraser mode for clarity
        },
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

      socketRef.current?.emit("text-update", { canvasId, textAreas: updatedAreas[canvasId], roomId: canvasRoomId });
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
      socketRef.current?.emit("text-update", { canvasId, textAreas: updatedAreas[canvasId], roomId: canvasRoomId });
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
      socketRef.current?.emit("text-update", { canvasId, textAreas: updatedAreas[canvasId], roomId: canvasRoomId });
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
      socketRef.current?.emit("clear-canvas", { canvasId, roomId: canvasRoomId });
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
    socketRef.current?.emit("delete-canvas", { canvasId, roomId: canvasRoomId });
  };

  const addNewCanvas = () => {
    const newCanvasId = `canvas-${Date.now()}`;
    socketRef.current?.emit("new-canvas", { roomId: canvasRoomId, id: newCanvasId });
  };

  const deleteTextArea = (canvasId: string, textId: string) => {
    setTextAreas((prevAreas) => {
      const updatedAreas = {
        ...prevAreas,
        [canvasId]: prevAreas[canvasId].filter((area: any) => area.id !== textId),
      };
  
      // Emit the updated text areas to other users
      socketRef.current?.emit("text-update", { canvasId, textAreas: updatedAreas[canvasId], roomId: canvasRoomId });
      return updatedAreas;
    });
  };
  
  return (
    <div
      className="flex flex-col items-center bg-gray-100 min-h-screen py-8"
      onMouseMove={handleTextMouseMove}
      onMouseUp={handleTextMouseUp}
    >
      {/* Control Panel */}
      <div className="fixed top-4 left-4 flex space-x-4 bg-white p-4 rounded-lg shadow-lg z-10">
        {/* Add Canvas Button */}
        <button
          onClick={addNewCanvas}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition"
        >
        <img
          src="/add.png"
          alt="Add Canvas"
          className="w-6 h-6"
        />
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
            disabled={eraserMode} // Disable color picker in eraser mode
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
            disabled={eraserMode} // Disable width picker in eraser mode
          />
        </div>
        {/* Enable Eraser Button */}
        <button
          onClick={() => setEraserMode((prev) => !prev)}
          className={`${
            eraserMode ? "bg-red-700" : "bg-green-600"
          } text-white font-semibold px-4 py-2 rounded-lg transition`}
        >
          <img
            src={eraserMode ? "/rubber.png" : "/rubber.png"}
            alt={eraserMode ? "Disable Eraser" : "Enable Eraser"}
            className="w-6 h-6"
          />
        </button>
        {!eraserMode && (
          <input
            type="number"
            min="1"
            max="50"
            value={eraserSize}
            onChange={(e) => setEraserSize(parseInt(e.target.value,30))}
            className="w-16 px-2 py-1 border border-gray-300 rounded-lg"
          />
        )}
        {eraserMode && (
          <input
            type="number"
            min="1"
            max="50"
            value={eraserSize}
            onChange={(e) => setEraserSize(parseInt(e.target.value,30))}
            className="w-16 px-2 py-1 border border-gray-300 rounded-lg"
          />
        )}
      </div>
      {/* Canvases */}
      <div className="mt-16 w-full max-w-5xl space-y-8">
        {canvases.map((canvas) => (
          <div
            key={canvas.id}
            className="p-4 bg-white rounded-lg shadow-lg relative"
          >
            <div className="flex justify-between mb-4">
              {/* Clear Canvas Button */}
              <button
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                onClick={() => clearCanvas(canvas.id)}
              >
                <img
                  src="/clear.png"
                  alt="Clear Canvas"
                  className="w-6 h-6"
                />
              </button>
              {/* Delete Canvas Button */}
              <button
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                onClick={() => deleteCanvas(canvas.id)}
              >
                <img
                  src="/delete.png"
                  alt="Delete Canvas"
                  className="w-6 h-6"
                />
              </button>
              {/* Add Text Button */}
              <button
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                onClick={() => addTextArea(canvas.id)}
              >
                <img
                  src="/add _text.png"
                  alt="Add Text"
                  className="w-6 h-6"
                />
              </button>
            </div>
            <canvas
              ref={(el : any) => {
                canvasRefs.current[canvas.id] = el;
              }}
              onMouseDown={(e) => handleMouseDown(e, canvas.id)}
              onMouseMove={(e) => handleMouseMove(e, canvas.id)}
              onMouseUp={(e) => handleMouseUp(e, canvas.id)}
              width={990}
              height={600}
              className="border-2 border-gray-300 rounded-lg bg-white shadow-md"
            />
            { textAreas[canvas.id]?.map((textArea) => (
                <div
                  key={textArea.id}
                  style={{
                    position: "absolute",
                    top: textArea.y,
                    left: textArea.x,
                    width: `${textArea.width}px`,
                    height: `${textArea.height}px`,
                    zIndex: 10,
                  }}
                >
                  <textarea
                    style={{
                      width: "100%",
                      height: "100%",
                      resize: "both",
                      backgroundColor: "#ffffff",
                      border: "1px solid #ccc",
                      overflow: "auto",
                      padding: "8px",
                      borderRadius: "4px",
                    }}
                    className="shadow-md"
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
                  <button
                    style={{
                      position: "absolute",
                      top: -10,
                      right: -10,
                      backgroundColor: "#ff5f5f",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                    onClick={() => deleteTextArea(canvas.id, textArea.id)}
                  >
                    ×
                  </button>
                </div>
              ))}

          </div>
        ))}
      </div>
    </div>
  );
  
};

export default MultiCanvas;
