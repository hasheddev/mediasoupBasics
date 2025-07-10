import express from "express";
import * as http from "http";
import * as WebSocket from "ws";
import { WebSocketConnection } from "./lib/ws";

async function main() {
    const app = express()
    const server = http.createServer(app)
    const websocket = new WebSocket.Server({server, path: '/ws'})
    WebSocketConnection(websocket)
    const port = 8000
    server.listen(port, () => {
        console.log("server started on port", port)
    })
}

export {main}