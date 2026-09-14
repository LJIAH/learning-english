import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    // 复用与 HTTP 相同的来源白名单，未配置 CORS_ORIGIN 时默认放行本地开发端口
    origin: (process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
      : ["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173"]),
    credentials: true,
  },
})
export class SocketGateway {
  @WebSocketServer()
  server!: Server;

  // 连接成功之后会自动进入这个钩子,会传入当前链接的client
  handleConnection(socket: Socket) {
    // console.log(socket.id);
    const userId = socket.handshake.query.userId;
    console.log("userId" + userId);

    // 这里要加判断，因为热更新的时候有时候没有ID
    if (userId) {
      socket.join(`user_${userId}`);
    }
  }

  emitPaymentSuccess(userId: string) {
    this.server.to(`user_${userId}`).emit("paymentSuccess", userId);
  }
}
