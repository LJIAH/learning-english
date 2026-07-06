import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: "*",
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
