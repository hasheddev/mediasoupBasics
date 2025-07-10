import { Router } from "mediasoup/node/lib/RouterTypes";
import { config } from "../config";

export const createWebRtcTransport = async (medisoupRouter: Router) => {
    const {
        maxIncomeBitrate,
        initialAvailableOutgoingBitrate
    } = config.mediasoup.webRtcTrasnport

    const transport = await medisoupRouter.createWebRtcTransport({
        listenIps: config.mediasoup.webRtcTrasnport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate
    })

    if(maxIncomeBitrate) {
        try {
            await transport.setMaxIncomingBitrate(maxIncomeBitrate)
        } catch (error) {
            console.error(error)
        }
    }

    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
        }
    }
}
