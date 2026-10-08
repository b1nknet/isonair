import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import worker from '../src/index.js'
import { ids } from '../src/ids.js'

const channel = {
  channelName: 'Test channel',
  channelImageUrl: 'https://example.com/channel.png',
  verifiedMark: false
}

afterEach(() => mock.restoreAll())

test('empty live details preserve the offline channel and the other results', async () => {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(url)
    assert.equal(init.headers['User-Agent'], 'Mozilla/5.0')
    if (url.endsWith(`/channels/${ids[2]}/live-detail`)) {
      return Response.json({ code: 200, message: null, content: null })
    }
    if (url.endsWith(`/channels/${ids[2]}`)) {
      return Response.json({ code: 200, content: { ...channel, openLive: false } })
    }
    return Response.json({ content: { status: 'CLOSE', channel, closeDate: '2026-10-08 02:18:20' } })
  })

  const response = await worker.fetch(new Request('https://example.com'))
  const results = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  assert.equal(results.length, ids.length)
  assert.equal(results[0].live.closedAt, '2026-10-08 02:18:20')
  assert.deepEqual(results[2], {
    status: 'CLOSE',
    channel: {
      channelId: ids[2],
      channelName: channel.channelName,
      channelImage: channel.channelImageUrl,
      isVerified: false
    },
    live: { closedAt: null }
  })
  assert.equal(calls.length, ids.length + 1)
})

test('missing channel metadata returns an entry with unknown metadata', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ code: 200, content: null }))

  const results = await (await worker.fetch(new Request('https://example.com'))).json()

  assert.equal(results.length, ids.length)
  assert.deepEqual(results[0], {
    status: 'CLOSE',
    channel: { channelId: ids[0], channelName: null, channelImage: null, isVerified: null },
    live: { closedAt: null }
  })
})

test('live and adult streams retain their existing playback behavior', async () => {
  mock.method(globalThis, 'fetch', async (url) => Response.json({
    content: {
      status: 'OPEN',
      channel,
      adult: url.includes(ids[1]),
      liveTitle: 'Live stream',
      liveCategoryValue: 'Music',
      openDate: '2026-10-08 10:00:00',
      livePlaybackJson: url.includes(ids[1]) ? null : JSON.stringify({ media: [
        { encodingTrack: [{}, {}, {}, { videoFrameRate: 60 }] },
        { path: 'https://example.com/stream.m3u8' }
      ] })
    }
  }))

  const results = await (await worker.fetch(new Request('https://example.com'))).json()

  assert.equal(results[0].status, 'OPEN')
  assert.equal(results[0].live.frameRate, 60)
  assert.equal(results[0].live.m3u8, 'https://example.com/stream.m3u8')
  assert.equal(results[1].live.frameRate, '19.0')
  assert.equal(results[1].live.m3u8, null)
})
