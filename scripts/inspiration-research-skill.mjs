#!/usr/bin/env node

const TOPIC = process.argv.slice(2).join(' ').trim()

if (!TOPIC) {
  console.error('Usage: npm run research -- "topic"')
  process.exit(1)
}

const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025']
const YEAR_REGEX = /(2020|2021|2022|2023|2024|2025)/g

const SOURCES = [
  { name: 'Reddit', domain: 'reddit.com' },
  { name: 'Vogue', domain: 'vogue.com' },
  { name: 'Vogue Business', domain: 'voguebusiness.com' },
  { name: 'Who What Wear', domain: 'whowhatwear.com' },
  { name: 'Highsnobiety', domain: 'highsnobiety.com' },
  { name: 'Hypebeast', domain: 'hypebeast.com' },
  { name: 'The Cut', domain: 'thecut.com' },
  { name: 'Elle', domain: 'elle.com' },
  { name: 'Harper\'s Bazaar', domain: 'harpersbazaar.com' },
  { name: 'Refinery29', domain: 'refinery29.com' },
  { name: 'Nylon', domain: 'nylon.com' },
  { name: 'GQ', domain: 'gq.com' },
  { name: 'WWD', domain: 'wwd.com', optional: true },
  { name: 'Fashionista', domain: 'fashionista.com' },
  { name: 'Lyst Reports', domain: 'lyst.com' },
  { name: 'Depop Trend Reports', domain: 'depop.com' },
  { name: 'eBay Trend Reports', domain: 'ebay.com' },
  { name: 'Etsy Trend Reports', domain: 'etsy.com' },
]

const STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'all',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'best',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'report',
  'reports',
  'style',
  'that',
  'the',
  'their',
  'these',
  'this',
  'to',
  'top',
  'trend',
  'trends',
  'what',
  'with',
  'you',
  'your',
])

const FASHION_TERMS = [
  'quiet luxury',
  'old money',
  'balletcore',
  'barbiecore',
  'gorpcore',
  'mob wife',
  'coastal grandmother',
  'indie sleaze',
  'y2k',
  'sheer',
  'metallic',
  'maxi',
  'cargo',
  'denim',
  'tailoring',
  'satin',
  'mesh',
  'crochet',
  'bomber',
  'vintage',
  'thrift',
  'secondhand',
]

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function collectYears(text) {
  const hits = text.match(YEAR_REGEX) ?? []
  return [...new Set(hits)]
}

function parseTag(block, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const match = block.match(pattern)
  return match ? decodeHtml(match[1]) : ''
}

function buildSourceIdentifiers(source) {
  const domainRoot = source.domain.split('.')[0].toLowerCase()
  const nameParts = source.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((part) => part.length > 2)

  return [...new Set([domainRoot, ...nameParts])]
}

function extractTokens(text) {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
    .split(' ')
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token))
}

function findFashionTerms(text) {
  const normalized = text.toLowerCase()
  return FASHION_TERMS.filter((term) => normalized.includes(term))
}

async function searchSource(source, topic) {
  const query = `site:${source.domain} ${topic} fashion trends after:2020-01-01 before:2026-01-01`
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      return { source, query, ok: false, reason: `HTTP ${response.status}`, results: [] }
    }

    const xml = await response.text()
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    const results = []

    itemBlocks.forEach((item) => {
      if (results.length >= 5) {
        return
      }

      const title = parseTag(item, 'title')
      const link = parseTag(item, 'link')
      const snippet = parseTag(item, 'description')
      const pubDate = parseTag(item, 'pubDate')
      const sourceName = parseTag(item, 'source')
      const yearInDate = (pubDate.match(/(2020|2021|2022|2023|2024|2025)/) || [])[1]
      const years = collectYears(`${title} ${snippet} ${pubDate}`)

      if (yearInDate && !years.includes(yearInDate)) {
        years.push(yearInDate)
      }

      // Keep only items that appear to be from the requested source.
      const sourceMatch = `${title} ${snippet} ${sourceName}`.toLowerCase()
      const identifiers = buildSourceIdentifiers(source)
      if (!identifiers.some((id) => sourceMatch.includes(id))) {
        return
      }

      results.push({ title, snippet, link, years })
    })

    if (results.length === 0) {
      return {
        source,
        query,
        ok: false,
        reason: source.optional ? 'No accessible or indexable result found (optional source).' : 'No result parsed.',
        results: [],
      }
    }

    return { source, query, ok: true, results }
  } catch (error) {
    return { source, query, ok: false, reason: error.message, results: [] }
  }
}

function synthesize(allSearches) {
  const successful = allSearches.filter((entry) => entry.ok)
  const documents = []

  successful.forEach((entry) => {
    entry.results.forEach((result) => {
      documents.push({
        source: entry.source.name,
        title: result.title,
        snippet: result.snippet,
        link: result.link,
        years: result.years,
      })
    })
  })

  const tokenMap = new Map()
  const termMap = new Map()

  documents.forEach((doc) => {
    const merged = `${doc.title} ${doc.snippet}`

    extractTokens(merged).forEach((token) => {
      if (!tokenMap.has(token)) {
        tokenMap.set(token, { count: 0, sources: new Set(), years: new Set() })
      }

      const bucket = tokenMap.get(token)
      bucket.count += 1
      bucket.sources.add(doc.source)
      doc.years.forEach((year) => bucket.years.add(year))
    })

    findFashionTerms(merged).forEach((term) => {
      if (!termMap.has(term)) {
        termMap.set(term, { count: 0, sources: new Set(), years: new Set() })
      }

      const bucket = termMap.get(term)
      bucket.count += 1
      bucket.sources.add(doc.source)
      doc.years.forEach((year) => bucket.years.add(year))
    })
  })

  const dominantTerms = [...termMap.entries()]
    .filter(([, data]) => data.sources.size >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  const fallbackSignals = [...tokenMap.entries()]
    .filter(([, data]) => data.sources.size >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)

  const totalSourceCoverage = new Set(documents.map((doc) => doc.source)).size
  const allYears = [...new Set(documents.flatMap((doc) => doc.years))].sort()

  const insightLines = []

  dominantTerms.forEach(([term, data]) => {
    const years = [...data.years].sort().join(', ') || 'year not explicit'
    insightLines.push(
      `- ${term}: appears across ${data.sources.size} sources with ${data.count} mentions (${years}).`,
    )
  })

  if (insightLines.length < 3) {
    fallbackSignals.slice(0, 3).forEach(([token, data]) => {
      const years = [...data.years].sort().join(', ') || 'year not explicit'
      insightLines.push(
        `- ${token}: repeated across ${data.sources.size} sources with ${data.count} hits (${years}).`,
      )
    })
  }

  return {
    documents,
    totalSourceCoverage,
    allYears,
    insightLines,
  }
}

function toMarkdown(topic, searches, synthesis) {
  const now = new Date().toISOString().slice(0, 10)
  const coverageRows = searches.map((entry) => {
    if (entry.ok) {
      return `| ${entry.source.name} | yes | ${entry.results.length} | - |`
    }

    return `| ${entry.source.name} | no | 0 | ${entry.reason || 'unavailable'} |`
  })

  const highlights = searches
    .filter((entry) => entry.ok)
    .flatMap((entry) =>
      entry.results.slice(0, 1).map((result) => {
        const yearLabel = result.years.length ? result.years.join(', ') : 'n/a'
        return `- [${entry.source.name}] ${result.title} (${yearLabel})\n  ${result.link}`
      }),
    )

  return [
    `# Inspiration Research Skill Report`,
    '',
    `Topic: ${topic}`,
    `Date: ${now}`,
    `Window: 2020-2025`,
    '',
    `## Source Coverage`,
    '',
    `| Source | Accessible | Results | Note |`,
    `| --- | --- | --- | --- |`,
    ...coverageRows,
    '',
    `## Synthesized Signals`,
    '',
    `- Total sources with usable results: ${synthesis.totalSourceCoverage}`,
    `- Years observed in captured snippets: ${synthesis.allYears.join(', ') || 'none explicitly tagged'}`,
    ...(synthesis.insightLines.length ? synthesis.insightLines : ['- No consistent cross-source signals detected yet.']),
    '',
    `## Quick Source Highlights`,
    '',
    ...(highlights.length ? highlights : ['- No highlights available from current search response.']),
  ].join('\n')
}

async function main() {
  const searches = []

  for (const source of SOURCES) {
    process.stdout.write(`Searching ${source.name}...\n`)
    const result = await searchSource(source, TOPIC)
    searches.push(result)
  }

  const synthesis = synthesize(searches)
  const report = toMarkdown(TOPIC, searches, synthesis)
  process.stdout.write('\n')
  process.stdout.write(report)
  process.stdout.write('\n')
}

main().catch((error) => {
  console.error('Skill failed:', error)
  process.exit(1)
})
