jest.mock('axios', () => ({
  get: jest.fn()
}))

const axios = require('axios')
const { parser, url, channels } = require('./turksatkablo.com.tr.config.js')
const fs = require('fs')
const path = require('path')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)
dayjs.extend(utc)

const date = dayjs.utc('2025-05-30', 'YYYY-MM-DD').startOf('d')
const channel = { site_id: '1908' }

it('can generate valid url', () => {
  const result = url({ date })

  expect(result).toBe('https://www.turksatkablo.com.tr/userUpload/EPG/30.json?_=1748563200000')
})

it('uses the Istanbul calendar day when the UTC date has rolled over', () => {
  const date = dayjs.utc('2025-05-29T23:30:00Z')
  const result = url({ date })

  expect(result).toBe('https://www.turksatkablo.com.tr/userUpload/EPG/30.json?_=1748561400000')
})

it('loads channels using the Istanbul calendar day on a UTC runner', async () => {
  const originalTimezone = process.env.TZ
  process.env.TZ = 'UTC'
  jest.useFakeTimers().setSystemTime(new Date('2025-05-29T23:30:00Z'))
  axios.get.mockResolvedValue({
    data: {
      k: [{ i: 1908, n: 'Test Channel' }]
    }
  })

  try {
    await expect(channels()).resolves.toEqual([
      { lang: 'tr', site_id: '1908', name: 'Test Channel' }
    ])
    expect(axios.get).toHaveBeenCalledWith('https://www.turksatkablo.com.tr/userUpload/EPG/30.json')
  } finally {
    jest.useRealTimers()
    if (originalTimezone === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTimezone
    }
    axios.get.mockReset()
  }
})

it('can parse response', () => {
  const content = fs.readFileSync(path.resolve(__dirname, '__data__/content.json'))
  const results = parser({ date, channel: { site_id: '2' }, content }).map(p => {
    p.start = p.start.toJSON()
    p.stop = p.stop.toJSON()
    return p
  })

  expect(results.length).toBe(14)
  expect(results[0]).toMatchObject({
    title: '-',
    start: '2025-05-29T21:00:00.000Z',
    stop: '2025-05-29T22:30:00.000Z'
  })
  expect(results[1]).toMatchObject({
    title: 'Şeytanın Evi',
    start: '2025-05-29T22:30:00.000Z',
    stop: '2025-05-30T00:00:00.000Z'
  })
})

it('parses programme dates using Istanbul time near UTC midnight', () => {
  const date = dayjs.utc('2025-05-29T23:30:00Z')
  const content = JSON.stringify({
    k: [{
      i: 1908,
      p: [{ b: 'Test Programme', c: '00:00', d: '01:00' }]
    }]
  })
  const [programme] = parser({ date, channel, content })

  expect(programme.start.toJSON()).toBe('2025-05-29T21:00:00.000Z')
  expect(programme.stop.toJSON()).toBe('2025-05-29T22:00:00.000Z')
})

it('can parse legacy provider records with x identifiers', () => {
  const content = JSON.stringify({
    k: [{
      x: '1908',
      p: [{ b: 'Legacy Programme', c: '00:00', d: '01:00' }]
    }]
  })
  const [programme] = parser({ date, channel, content })

  expect(programme.title).toBe('Legacy Programme')
})

it('can handle empty guide', () => {
  const content = fs.readFileSync(path.resolve(__dirname, '__data__/no_content.html'))
  const result = parser({
    date,
    channel,
    content
  })
  expect(result).toMatchObject([])
})
