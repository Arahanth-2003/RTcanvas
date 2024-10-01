import { NextApiRequest } from "next";
import { Server as SocketIOServer } from "socket.io";
import { NextApiResponseServerIO } from "../../../types/next"; // Adjust this path as needed
import { Server as HttpServer } from "http";

let io: SocketIOServer | null = null;

const socketHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
  console.log("API Route Hit"); // Log to check if the route is reached

  if (!io) {
    const server = res.socket.server as HttpServer;
    io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Allow all origins; adjust this in production
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("User connected");

      socket.on("draw", (data) => {
        console.log("Broadcasting draw event:", data);
        socket.broadcast.emit("draw", data);
      });

      socket.on("disconnect", () => {
        console.log("User disconnected");
      });
    });
  }

  res.socket.server.io = io; // Attach the Socket.IO server to the Next.js server
  res.end(); // End the response
};

export default socketHandler;
