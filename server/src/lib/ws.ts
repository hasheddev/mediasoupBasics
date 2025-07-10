import { Router } from "mediasoup/node/lib/RouterTypes";
import { createWorker } from "./worker";
import WebSocket from "ws";
import { createWebRtcTransport } from "./createWebRtcTransport";
import { Transport } from "mediasoup/node/lib/TransportTypes";
import { Producer } from "mediasoup/node/lib/ProducerTypes";
import { Consumer } from "mediasoup/node/lib/ConsumerTypes";
import { RtpCapabilities } from "mediasoup/node/lib/rtpParametersTypes";

let mediaSoupRouter: Router;
let producerTransport: Transport
let consumerTransport: Transport
let producer: Producer
let consumer: Consumer

const WebSocketConnection = async(websocket: WebSocket.Server) => {
    try {
        mediaSoupRouter = await createWorker()
        
    } catch (error) {
        throw error
    }
    websocket.on("connection", (ws: WebSocket) => {

        ws.on("message", (message: string) => {
            console.log("message: =>", message)
            const jsonValidation = isJsonString(message)
            if (!jsonValidation) {
                return console.error("JSON error")
            }

            // const message = {
        //type: "createProducerTransport",
        //forceTcp: false,
        //rtpCapabilities: device.rtpCapabilities

            const event = JSON.parse(message);
            switch (event.type) {
                case "getRouterRtpCapabilities":
                    onRouterRtpCapabilities(event, ws)
                    
                    break;
                
                case "createProducerTransport":
                    onCreateProducerTransport(event, ws)
                    break;
                
                case "connectProducerTrasport":
                    onConnectProducerTrasport(event, ws)
                    break;
                
                    
                case "createConsumerTransport":
                    onCreateConsumerTransport(event, ws)
                    break;
                
                case "connectConsumerTrasport":
                    onConnectConsumerTrasport(event, ws)
                    break;
                
                case "produce":
                    onProduce(event, ws, websocket)
                    break;
                
                case "resume":
                    onResume(ws)
                    break;
                
                case "consume":
                    onConsume(event, ws)
                    break;
            
                default:
                    break;
            }
        });

    });

    const isJsonString = (str: string): boolean =>  {
        try {
            JSON.parse(str)
        } catch {
            return false
        }
        return true
    }

    function onRouterRtpCapabilities(event: any, ws: WebSocket) {
        send(ws, "routerRtpCapabilities", mediaSoupRouter.rtpCapabilities)
    }

      const onConsume = async(event: any, ws: WebSocket) =>  {
        const res = await createConsumer(producer, event.rtpCapabilities)
        send(ws, "subscribed", res)
    }

    const onResume = async(ws: WebSocket) =>  {
        await consumer.resume()
        send(ws, "resumed", "RESUMED")
    }

    const onProduce = async(event: any, ws: WebSocket, websocket: WebSocket.Server) =>  {
        const {kind, rtpParameters} = event
        producer = await producerTransport.produce({kind, rtpParameters})
        const resp = {
            id: producer.id
        }
        send(ws, "produced", resp)
        broadcast(websocket, "newProducer", "new user")
    }

    const onConnectProducerTrasport = async (event: any, ws: WebSocket) => {
        await producerTransport.connect({dtlsParameters: event.dtlsParameters})
        send(ws, "producerConnected", 'PRODUCER TRASNPORT CONNECTED!')
    }

    const onConnectConsumerTrasport = async (event: any, ws: WebSocket) => {
        await consumerTransport.connect({dtlsParameters: event.dtlsParameters})
        send(ws, "consumerConnected", 'CONSUMER TRASNPORT  CONNECTED!')
    }

    const onCreateConsumerTransport = async (event: any, ws: WebSocket) => {
        try {
            const {transport, params} = await createWebRtcTransport(mediaSoupRouter)
            consumerTransport = transport
            send(ws, "consumerTransportCreated", params)
        } catch (error) {
            console.error(error)
            send(ws, "error", error)
        }

    }

    async function onCreateProducerTransport(event: any, ws: WebSocket) {
        try {
            const {transport, params} = await createWebRtcTransport(mediaSoupRouter)
            producerTransport = transport
            send(ws, "producerTransportCreated", params)
        } catch (error) {
            console.error(error)
            send(ws, "error", error)
        }
    }

    const send = (ws: WebSocket, type: string, data: any) => {
        const message = {
            type,
            data
        }

        const res = JSON.stringify(message)
        ws.send(res)
    }

    const broadcast = (ws: WebSocket.Server,  type: string, data: any) => {
         const message = {
            type,
            data
        }
        const resp = JSON.stringify(message)
        ws.clients.forEach((client) => {
            client.send(resp)
        })
    }

    const createConsumer = async (producer: Producer, rtpCapabilities: RtpCapabilities) => {
        if(!mediaSoupRouter.canConsume({producerId: producer.id,rtpCapabilities})) {
            console.error("cannot consume")
            return
        }

        try {
             consumer = await consumerTransport.consume(
                {
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: producer.kind == "video"
                }
            )
            
        } catch (error) {
            console.error(error)
            return
        }

        return {
            producerId: producer.id,
            id: consumer.id,
            kind: consumer.kind,
            type: consumer.type,
            producerPaused: consumer.producerPaused,
            rtpParameters: consumer.rtpParameters
        } 
    }

}

export {WebSocketConnection}