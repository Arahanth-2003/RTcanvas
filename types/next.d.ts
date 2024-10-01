import { NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: {
    server: {
      io?: SocketIOServer; // Optional property for Socket.IO server
    };
  };
}
