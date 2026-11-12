const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)

const tz = 'Europe/Istanbul'

module.exports = {
  site: 'turksatkablo.com.tr',
  days: 2,
  url({ date }) {
    const dayOfMonth = date.tz(tz).format('DD')

    return `https://www.turksatkablo.com.tr/userUpload/EPG/${dayOfMonth}.json?_=${date.valueOf()}`
  },
  request: {
    timeout: 60000,
    cache: {
      ttl: 60 * 60 * 1000 // 1 hour
    }
  },
  parser: function ({ content, channel, date }) {
    let programs = []
    const items = parseItems(content, channel)
    items.forEach(item => {
      const prev = programs[programs.length - 1]
      let start = parseStart(item, date)
      if (prev && start < prev.start) {
        start = start.add(1, 'day')
        date = date.add(1, 'day')
      }
      let stop = parseStop(item, date)
      if (prev && stop < start) {
        stop = stop.add(1, 'day')
        date = date.add(1, 'day')
      }
      programs.push({
        title: item.b,
        start,
        stop
      })
    })

    return programs
  },
  async channels() {
    const axios = require('axios')
    const dayOfMonth = dayjs().tz(tz).format('DD')

    const { data } = await axios.get(`https://www.turksatkablo.com.tr/userUpload/EPG/${dayOfMonth}.json`)

    if (!Array.isArray(data?.k)) {
      throw new Error('Türksat EPG response does not contain a channel list.')
    }

    return data.k.map((item, index) => {
      const siteId = item.i ?? item.x
      if (siteId == null || typeof item.n !== 'string' || !item.n.trim()) {
        throw new Error(`Türksat EPG channel at index ${index} has invalid metadata.`)
      }

      return {
        lang: 'tr',
        site_id: String(siteId),
        name: item.n
      }
    })
  }
}

function parseStart(item, date) {
  const time = `${date.tz(tz).format('YYYY-MM-DD')} ${item.c}`

  return dayjs.tz(time, 'YYYY-MM-DD HH:mm', tz).utc()
}

function parseStop(item, date) {
  const time = `${date.tz(tz).format('YYYY-MM-DD')} ${item.d}`

  return dayjs.tz(time, 'YYYY-MM-DD HH:mm', tz).utc()
}

function parseItems(content, channel) {
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    return []
  }
  if (!parsed || !Array.isArray(parsed.k)) return []
  const data = parsed.k.find(item => {
    const siteId = item.i ?? item.x
    return siteId != null && String(siteId) === String(channel.site_id)
  })

  return Array.isArray(data?.p) ? data.p : []
}
