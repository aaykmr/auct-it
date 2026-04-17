import type { FastifyRequest } from "fastify";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { getRedis } from "../redis.js";

export async function registerWsRoutes(app: FastifyInstance) {
  app.get(
    "/v1/ws/auctions/:auctionId",
    { websocket: true },
    (socket: WebSocket, req: FastifyRequest) => {
      const auctionId = (req.params as { auctionId: string }).auctionId;
      const redis = getRedis();
      if (!redis || !auctionId) {
        socket.close();
        return;
      }
      const sub = redis.duplicate({
        // Pub/sub must not retry per command; avoids bad state with SUBSCRIBE.
        maxRetriesPerRequest: null,
      });
      const closeSub = () => {
        void sub
          .unsubscribe(`auction:${auctionId}`)
          .catch(() => {
            /* connection may already be closed */
          })
          .finally(() => {
            try {
              sub.disconnect();
            } catch {
              /* ignore */
            }
          });
      };
      sub.on("error", () => {
        closeSub();
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      });
      void sub.subscribe(`auction:${auctionId}`).catch(() => {
        closeSub();
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      });
      sub.on("message", (_channel: string, message: string) => {
        try {
          socket.send(message);
        } catch {
          closeSub();
        }
      });
      socket.on("close", closeSub);
    },
  );
}
