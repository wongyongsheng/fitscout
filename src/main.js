import './style.css'

const fashionSources = [
  'Reddit',
  'Vogue',
  'Vogue Business',
  'Who What Wear',
  'Highsnobiety',
  'Hypebeast',
  'The Cut',
  'Elle',
  'Harper’s Bazaar',
  'Refinery29',
  'Nylon',
  'GQ',
  'WWD',
  'Fashionista',
  'Lyst reports',
  'Edited reports',
  'Depop trend reports',
  'eBay trend reports',
  'Etsy trend reports',
]

const trendSignals = [
  {
    keyword: ['wedding', 'gala', 'formal', 'black tie', 'invite'],
    trends: ['liquid satin', 'tonal tailoring', 'statement rosettes', 'sleek kitten heels'],
  },
  {
    keyword: ['concert', 'club', 'party', 'night', 'date'],
    trends: ['sheer layers', 'metallic accents', 'low-rise proportions', 'leather textures'],
  },
  {
    keyword: ['work', 'conference', 'interview', 'office', 'meeting'],
    trends: ['soft suiting', 'column skirts', 'quiet-luxury knits', 'architectural totes'],
  },
  {
    keyword: ['festival', 'outdoor', 'market', 'day', 'brunch'],
    trends: ['utility pockets', 'crochet textures', 'sporty sunglasses', 'relaxed denim'],
  },
]

const refinements = [
  'make it sexier',
  'more casual',
  'less expensive',
  'more masc',
  'more femme',
  'use items I own',
]

const shoppingSites = [
  ['SSENSE', 'https://www.ssense.com/en-us/search?q='],
  ['Nordstrom', 'https://www.nordstrom.com/sr?origin=keywordsearch&keyword='],
  ['Zara', 'https://www.zara.com/us/en/search?searchTerm='],
  ['Depop', 'https://www.depop.com/search/?q='],
  ['eBay', 'https://www.ebay.com/sch/i.html?_nkw='],
]

const state = {
  prompt: '',
  answers: {},
  trends: [],
  themes: [],
  selectedTheme: null,
  refinement: '',
}

const app = document.querySelector('#app')

function setupApp() {
  app.innerHTML = `
    <main class="shell">
      <section class="hero-panel">
        <p class="eyebrow">FitScout</p>
        <h1>Dress for the invite before the group chat asks.</h1>
        <p class="dek">
          Paste an event link or describe your plans. FitScout asks a few sharp
          questions, reads the fashion mood, and turns it into shoppable outfit routes.
        </p>
        <form class="prompt-card" id="prompt-form">
          <label for="prompt-input">What are you dressing for?</label>
          <div class="prompt-row">
            <input
              id="prompt-input"
              name="prompt"
              type="text"
              autocomplete="off"
              placeholder="Rooftop birthday in Brooklyn, or paste an invite link"
              required
            />
            <button type="submit">Scout</button>
          </div>
        </form>
      </section>

      <section class="workflow" id="workflow" aria-live="polite"></section>
    </main>
  `

  document.querySelector('#prompt-form').addEventListener('submit', (event) => {
    event.preventDefault()
    state.prompt = new FormData(event.currentTarget).get('prompt').trim()
    state.answers = {}
    state.selectedTheme = null
    state.refinement = ''
    renderQuestions()
  })
}

function renderQuestions() {
  const workflow = document.querySelector('#workflow')
  workflow.innerHTML = `
    <div class="section-heading">
      <span>01 Interview</span>
      <h2>Three quick filters.</h2>
    </div>
    <form class="question-grid" id="question-form">
      ${questionField('occasion', 'What is the exact occasion?', 'wedding welcome drinks, art opening, first date')}
      ${questionField('weather', 'What weather or venue should we plan for?', 'humid patio, cold gallery, lots of walking')}
      ${questionField('style', 'What should the outfit communicate?', 'expensive, sexy, masc, effortless, creative')}
      <button class="wide-button" type="submit">Mine trends</button>
    </form>
  `

  document.querySelector('#question-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    state.answers = Object.fromEntries(formData.entries())
    state.trends = getRelevantTrends()
    state.themes = createThemes()
    renderRecommendations()
  })
}

function questionField(name, label, placeholder) {
  return `
    <label class="question-card">
      <span>${label}</span>
      <input name="${name}" type="text" placeholder="${placeholder}" required />
    </label>
  `
}

function getRelevantTrends() {
  const input = `${state.prompt} ${Object.values(state.answers).join(' ')}`.toLowerCase()
  const matched = trendSignals.find(({ keyword }) => keyword.some((word) => input.includes(word)))
  const baseTrends = matched?.trends ?? ['elevated basics', 'textured neutrals', 'vintage denim', 'sculptural accessories']

  return baseTrends.map((trend, index) => ({
    trend,
    source: fashionSources[(index * 4 + input.length) % fashionSources.length],
  }))
}

function createThemes() {
  const answers = state.answers ?? {}
  const useCase = [answers.occasion, answers.weather, answers.style]
    .filter(Boolean)
    .join(', ')
  const refinementCopy = state.refinement ? ` Updated to feel ${state.refinement}.` : ''
  const itemOwnedCopy = state.refinement === 'use items I own' ? ' Anchored around closet staples you can swap in.' : ''

  return [
    {
      name: 'Polished Signal',
      description: `A tailored, camera-ready look for ${useCase}. Think clean lines, one luxe texture, and a confident accessory.${refinementCopy}${itemOwnedCopy}`,
      searchTerms: ['tailored vest', 'wide leg trouser', 'cropped blazer', 'silver sculptural jewelry'],
    },
    {
      name: 'Soft Main Character',
      description: `A romantic but modern route with movement, softer proportions, and one unexpected trend cue from the current fashion read.${refinementCopy}${itemOwnedCopy}`,
      searchTerms: ['draped blouse', 'satin skirt', 'light trench coat', 'rosette choker'],
    },
    {
      name: 'Off-Duty Editorial',
      description: `A relaxed fashion-person uniform: grounded basics, a sharper outer layer, and accessories that make the outfit look intentional.${refinementCopy}${itemOwnedCopy}`,
      searchTerms: ['mesh long sleeve top', 'relaxed denim', 'leather bomber jacket', 'wrap sunglasses'],
    },
  ]
}

function renderRecommendations() {
  const workflow = document.querySelector('#workflow')
  workflow.innerHTML = ''

  workflow.append(
    sectionHeading('02 Search', 'Trend signals mined for your use case.'),
    trendList(),
    sectionHeading('03 Recommend', 'Pick a broad outfit direction.'),
    themeGrid(),
    refinementPanel(),
  )
}

function sectionHeading(step, title) {
  const wrapper = document.createElement('div')
  wrapper.className = 'section-heading'
  const stepLabel = document.createElement('span')
  stepLabel.textContent = step
  const heading = document.createElement('h2')
  heading.textContent = title
  wrapper.append(stepLabel, heading)
  return wrapper
}

function trendList() {
  const list = document.createElement('div')
  list.className = 'trend-list'

  state.trends.forEach(({ trend, source }) => {
    const item = document.createElement('article')
    item.className = 'trend-pill'
    const trendText = document.createElement('strong')
    trendText.textContent = trend
    const sourceText = document.createElement('span')
    sourceText.textContent = source
    item.append(trendText, sourceText)
    list.append(item)
  })

  return list
}

function themeGrid() {
  const grid = document.createElement('div')
  grid.className = 'theme-grid'

  state.themes.forEach((theme, index) => {
    const card = document.createElement('article')
    card.className = 'theme-card'
    const title = document.createElement('h3')
    title.textContent = theme.name
    const description = document.createElement('p')
    description.textContent = theme.description
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = state.selectedTheme === index ? 'Selected' : 'Choose this theme'
    button.addEventListener('click', () => {
      state.selectedTheme = index
      renderOutputLinks()
    })

    card.append(title, description, button)
    grid.append(card)
  })

  return grid
}

function refinementPanel() {
  const panel = document.createElement('div')
  panel.className = 'refinement-panel'
  const label = document.createElement('p')
  label.textContent = 'Or tune the recommendation:'
  const actions = document.createElement('div')
  actions.className = 'refinement-actions'

  refinements.forEach((refinement) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = refinement
    button.addEventListener('click', () => {
      state.refinement = refinement
      state.themes = createThemes()
      state.selectedTheme = null
      renderRecommendations()
    })
    actions.append(button)
  })

  panel.append(label, actions)
  return panel
}

function renderOutputLinks() {
  renderRecommendations()
  const workflow = document.querySelector('#workflow')
  workflow.append(sectionHeading('04 Output links', 'Five searches for each wardrobe piece.'), linkBoard())
  workflow.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

function linkBoard() {
  const selectedTheme = state.themes[state.selectedTheme]
  const categories = [
    ['Top', selectedTheme.searchTerms[0]],
    ['Bottom', selectedTheme.searchTerms[1]],
    ['Outerwear', selectedTheme.searchTerms[2]],
    ['Accessories', selectedTheme.searchTerms[3]],
  ]
  const board = document.createElement('div')
  board.className = 'link-board'

  categories.forEach(([category, term]) => {
    const column = document.createElement('article')
    column.className = 'link-column'
    const heading = document.createElement('h3')
    heading.textContent = category
    const list = document.createElement('ul')

    shoppingSites.forEach(([site, baseUrl]) => {
      const item = document.createElement('li')
      const link = document.createElement('a')
      link.href = `${baseUrl}${encodeURIComponent(`${term} ${state.answers.style}`)}`
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.textContent = `${site}: ${term}`
      item.append(link)
      list.append(item)
    })

    column.append(heading, list)
    board.append(column)
  })

  return board
}

setupApp()
