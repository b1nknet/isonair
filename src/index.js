import { ids } from './ids.js'

export default {
  async fetch(request, env, ctx) {
    let results = []

    const init = {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
      }
    }

    // CHZZK rejects requests without a browser-like User-Agent, which would
    // otherwise return a non-JSON body and throw (Cloudflare error 1101).
    const chzzkInit = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'content-type': 'application/json;charset=UTF-8'
      }
    }

    for (let id of ids) {
      let response = await fetch(`https://api.chzzk.naver.com/service/v2/channels/${id}/live-detail`, chzzkInit);
      let result = (await response.json()).content;

      // Channels without live details can return HTTP 200 with content: null.
      // Fetch their metadata separately so they still appear in the results.
      if (result === null) {
        const channelResponse = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${id}`, chzzkInit);
        const channel = (await channelResponse.json()).content;
        results.push({
          "status": "CLOSE",
          "channel": {
            "channelId": id,
            "channelName": channel?.channelName ?? null,
            "channelImage": channel?.channelImageUrl ?? null,
            "isVerified": channel?.verifiedMark ?? null
          },
          "live": { "closedAt": null }
        });
        continue;
      }

      if (result.status == "OPEN") {results.push({
        "status": result.status,
        "channel": {
          "channelId": id,
          "channelName": result.channel.channelName,
          "channelImage": result.channel.channelImageUrl,
          "isVerified": result.channel.verifiedMark
        },
        "live": {
          "liveTitle": result.liveTitle,
          "liveCategory": result.liveCategoryValue,
          "frameRate": (result.adult) ? "19.0" : (JSON.parse(result.livePlaybackJson).media[0].encodingTrack[3].videoFrameRate),
          "startedAt": result.openDate,
          "m3u8": (!result.adult) ? (JSON.parse(result.livePlaybackJson).media[1].path) : null
        }
      })} else {results.push({
        "status": result.status,
        "channel": {
          "channelId": id,
          "channelName": result.channel.channelName,
          "channelImage": result.channel.channelImageUrl,
          "isVerified": result.channel.verifiedMark
        },
        "live": {
          "closedAt": result.closeDate
        }
      })

      };
    }

    return new Response(JSON.stringify(results), init)
  }
}
