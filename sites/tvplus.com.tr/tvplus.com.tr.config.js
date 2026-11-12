const axios = require('axios')
const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(customParseFormat)

const authUrl = 'https://izmaottvsc14.tvplus.com.tr:33207/EPG/JSON/Authenticate'
const authData = {
  terminaltype: 'webtv',
  terminalvendor:
    '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
  osversion: 'Win32',
  userType: '3',
  utcEnable: '1',
  timezone: 'Europe/Istanbul'
}
let authenticationPromise

function authenticate() {
  if (!authenticationPromise) {
    authenticationPromise = axios.post(authUrl, authData, { timeout: 15000 }).then(response => {
      const cookies = response.headers['set-cookie']
      if (!Array.isArray(cookies) || !cookies.length) {
        throw new Error('TV+ authentication response did not include a session cookie.')
      }

      return cookies.join(';')
    })
  }

  return authenticationPromise
}

module.exports = {
  site: 'tvplus.com.tr',
  days: 2,
  url: 'https://izmaottvsc14.tvplus.com.tr:33207/EPG/JSON/PlayBillList',
  request: {
    method: 'POST',
    async headers() {
      return {
        cookie: process.env.TVPLUS_COOKIE || await authenticate()
      }
    },
    data({ channel, date }) {
      return {
        type: '2',
        channelid: channel.site_id,
        begintime: date.format('YYYYMMDDHHmmss'),
        endtime: date.add(1, 'd').format('YYYYMMDDHHmmss'),
        isFillProgram: 1
      }
    },
    cache: {
      ttl: 24 * 60 * 60 * 1000 // 1 day
    }
  },
  parser({ content }) {
    const programs = []

    const items = parseItems(content)

    items.forEach(schedule => {
      programs.push({
        title: schedule.name,
        description: schedule.introduce,
        category: schedule.genres,
        icon: parseIcon(schedule),
        image: parseImage(schedule),
        start: parseTime(schedule.starttime),
        stop: parseTime(schedule.endtime)
      })
    })

    return programs
  }
}

function parseTime(time) {
  return dayjs(time, 'YYYY-MM-DD HH:mm:ss [UTC]Z')
}

function parseImage(schedule) {
  return schedule?.picture?.still || null
}

function parseIcon(schedule) {
  if (typeof schedule?.picture?.icon !== 'string') return null

  return schedule.picture.icon.split(',')[0]
}

function parseItems(content) {
  try {
    const data = JSON.parse(content)
    if (!data || !Array.isArray(data.playbilllist)) return []

    return data.playbilllist
  } catch {
    return []
  }
}
