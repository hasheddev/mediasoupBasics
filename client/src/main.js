const mediasoup = require("mediasoup-client")
const {v4: uuidv4} = require("uuid")

let btnSub
let btnCam
let btnScreen
let textPublish
let textWebcam
let textScreen
let textSubscribe
let remoteVideo
let localVideo
let remoteStream
let device
let producer
let consumeTransport
let userId
let isWebcam
let produceCallback, produceErrBack
let consumeCallback, consumerErrBack

const websocketUrl = "ws://localhost:8000/ws"

let socket

document.addEventListener("DOMContentLoaded", function() {
    btnCam = document.getElementById("btn_webcam")
    btnScreen = document.getElementById("btn_screen")
    btnSub = document.getElementById("btn_subscribe")
    textWebcam = document.getElementById("webcam_status")
    textScreen = document.getElementById("screen_status")
    textSubscribe = document.getElementById("subscribe_status")
    localVideo = document.getElementById("localVideo")
    remoteVideo = document.getElementById("remoteVideo")

    
    btnCam.addEventListener('click', publish)
    btnScreen.addEventListener('click', publish)
    btnSub.addEventListener('click', subscribe)
})

const publish = (e) => {
    isWebcam = (e.target.id == "btn_webcam")
    textPublish = isWebcam ? textWebcam : textScreen
    btnScreen.disabled = true
    btnCam.disabled = true
    btnSub.disabled = false
    const message = {
        type: "createProducerTransport",
        forceTcp: false,
        rtpCapabilities: device.rtpCapabilities
    }
    const resp = JSON.stringify(message)
    socket.send(resp)
}

const subscribe = (e) => {
    btnSub.disabled = true
    const msg = {
        type: "createConsumerTransport",
        forceTcp: false
    }
    const message = JSON.stringify(msg)
    socket.send(message)
}


const connect = () => {
    socket = new WebSocket(websocketUrl)
    socket.onopen = () => {
        const msg = {
            type: "getRouterRtpCapabilities"
        }
        const resp = JSON.stringify(msg)
        socket.send(resp)
    }
    socket.onmessage = (event) => {
        const jsonValidation = isJsonString(event.data)
            if (!jsonValidation) {
                return console.error("JSON error")
            }
            const resp = JSON.parse(event.data);
            switch (resp.type) {
                case "routerRtpCapabilities":
                    onRouterRtpCapabilities(resp)
                    break;
                case "producerTransportCreated":
                    onProducerTransportCreated(resp)
                    break;
                case "consumerTransportCreated":
                    onConsumerTransportCreated(resp)
                    break;
                
                case "resumed":
                    console.log(resp.data)
                    break;
                case "subscribed":
                    onSubscribed(resp)
                    break;
                
                default:
                    break;
            }
    }

}

connect()

const isJsonString = (str) =>  {
    try {
        JSON.parse(str)
    } catch {
        return false
    }
    return true
}

const onSubscribed = async (resp) => {
    const {
        producerId,
        id,
        kind,
        rtpParameters
    } = resp.data

    let codecOptions = {}
    const consumer = await consumeTransport.consume({
        producerId,
        id,
        kind,
        rtpParameters,
        codecOptions
    })
    const stream = new MediaStream()
    stream.addTrack(consumer.track)
    remoteStream = stream
}

const onRouterRtpCapabilities = (resp) => {
        loadDevice(resp.data)
        btnCam.disabled = false
        btnScreen.disabled = false
}

const onConsumerTransportCreated = async (resp) => {
    if (resp.error) {
        console.error("Consumer transport create error", resp.error) 
        return 
    }
    const transport = device.createRecvTransport(resp.data)
    consumeTransport = transport
    //
    transport.on("connect", async ({dtlsParameters}, callback, errBack) => {
       const message = {
            type: "connectConsumerTrasport",
            transportId: transport.id,
            dtlsParameters
        }
        const resp = JSON.stringify(message)
        socket.send(resp) 
        socket.addEventListener("message", (event) => {
            const jsonValidation = isJsonString(event.data)
            if (!jsonValidation) {
                return console.error("JSON error")
            }
            const resp = JSON.parse(event.data);
            if(resp.type == "consumerConnected"){
                remoteVideo.srcObject = remoteStream
                const msg = {
                    type: "resume"
                }
                socket.send(JSON.stringify(msg))
                textSubscribe.innerHTML = "connected"
                console.log("consumer connected")
                callback()
            }
        })
    })
    transport.on("connectionStateChange", (state) => {
        switch (state) {
            case "connecting":
                textSubscribe.innerHTML = "subscribing..."
                break;
            case "connected":
                remoteVideo.srcObject = remoteStream
                const msg = {
                    type: "resume"
                }
                socket.send(JSON.stringify(msg))
                textSubscribe.innerHTML = "connected"
                break;
            
            case "failed":
                transport.close()
                textSubscribe.innerHTML = "Failed"
                btnSub.disabled = false
                break;
            
            default:
                break;
        }
    })
    const stream = consume(transport)
}

const consume = async (transport) => {
    const {rtpCapabilities} = device;
    const msg = {
        type: "consume",
        rtpCapabilities
    }
    socket.send(JSON.stringify(msg))
}

const onProducerTransportCreated = async (resp) => {
    if(resp.error) {
        console.error("Producer transport create error", resp.error) 
        return
    }

    const transport = device.createSendTransport(resp.data)
    transport.on("connect", async ({dtlsParameters}, callback, errBack) => {
        const message = {
            type: "connectProducerTrasport",
            dtlsParameters
        }
        const resp = JSON.stringify(message)
        socket.send(resp)
        socket.addEventListener("message", (event) => {
            const jsonValidation = isJsonString(event.data)
            if (!jsonValidation) {
                return console.error("JSON error")
            }
            const resp = JSON.parse(event.data);
            if(resp.type == "producerConnected"){
                console.log("got producer connected")
                localVideo.srcObject = stream
                textPublish.innerHTML = "published"
                callback()
            }
           
        })
    })
    transport.on("produce", async ({kind, rtpParameters}, callback, errBack) => {
        const message = {
            type: "produce",
            transportId: transport.id,
            kind,
            rtpParameters
        }
        const resp = JSON.stringify(message)
        socket.send(resp)
        socket.addEventListener("published", (resp) => {
            callback(resp.data.id)
        })
    })

    transport.on("connectionStateChange", (state) => {
        //Only failed is working
        switch (state) {
            case "connecting":
                textPublish.innerHTML = "publishing..."
                break;
            case "connected":
                localVideo.srcObject = stream
                textPublish.innerHTML = "published"
                break;
                
            case "failed":
                transport.close()
                textPublish.innerHTML = "Failed"
                break;
            
            default:
                break;
        }
    })

    let stream;
    try {
        stream = await getUserMedia(transport, isWebcam)
        const track = stream.getVideoTracks()[0];
        const params = {track}
        producer = await transport.produce(params)
    } catch (error) {
        console.error(error)
        textPublish.innerHTML = "Failed"
    }
}

const loadDevice = async (routerRtpCapabilities) => {
    try {
        device = new mediasoup.Device()
    } catch (error) {
        if (error.name == "UnsupportedError")
            console.log("Browser not suppoted")
        return
    }
    await device.load({routerRtpCapabilities})
}

const getUserMedia = async (transport, isWebcam) => {
    if(!device.canProduce("video")) {
        console.error("Cannot ptoduce video")
        return
    }
    let stream;

    try {
        stream = isWebcam ?
        await navigator.mediaDevices.getUserMedia({
            video: true, audio: true
        }): await navigator.mediaDevices.getDisplayMedia({video: true})

    } catch (error) {
        console.error(error)
        throw error
    }
    return stream
 }
