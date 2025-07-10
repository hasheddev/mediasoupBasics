import * as mediasoup from "mediasoup"

import { config } from "../config"
import { Router, Worker } from "mediasoup/node/lib/types"

const worker: Array<
{
    worker: Worker,
    router: Router
}> = [];

let nextMediaSoupWorkerIndex = 0

const createWorker = async () => {
    const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });
    worker.on("died", () => {
        console.error("mediasoup worker died, exiting in 2 secs ... [pid&d]", worker.pid);
        setTimeout(() => {
            process.exit(1)
        }, 2000);
    });

    const mediaCodecs = config.mediasoup.router.mediaCodes;
    const mediasoupRouer = await worker.createRouter({mediaCodecs})
    return mediasoupRouer
    
}

export {createWorker}