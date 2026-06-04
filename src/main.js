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

const discoveryApiConfig = {
  endpoint: import.meta.env.VITE_FASHION_DISCOVERY_ENDPOINT || '/api/v1/fashion-discovery',
  timeoutMs: Number(import.meta.env.VITE_FASHION_DISCOVERY_TIMEOUT_MS || 12000),
  x402Network: import.meta.env.VITE_X402_NETWORK || 'xrpl-testnet',
  x402PaymentAddress: import.meta.env.VITE_X402_PAYMENT_ADDRESS || '',
  x402Token: import.meta.env.VITE_X402_TOKEN || '',
}

const imageShopApiConfig = {
  endpoint: import.meta.env.VITE_IMAGE_TO_SHOP_ENDPOINT || '/api/v1/outfit-to-shop',
  timeoutMs: Number(import.meta.env.VITE_IMAGE_TO_SHOP_TIMEOUT_MS || 30000),
}


const orchestrationSteps = [
  'Parse intent',
  'Warm intake',
  'Styling brain',
  'Retailer discovery',
  'Voice synthesis',
  'Approval gate',
]

const state = {
  prompt: '',
  answers: {},
  trends: [],
  themes: [],
  selectedTheme: null,
  refinement: '',
  orchestration: null,
  approval: {
    status: 'idle',
    selectedPiece: null,
  },
  loadingDiscovery: false,
  discoveryError: '',
  debugDrawerOpen: false,
  debugPayloads: [],
  imageShop: {
    loading: false,
    error: '',
    result: null,
    debug: [],
  },
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
    state.orchestration = null
    state.approval = {
      status: 'idle',
      selectedPiece: null,
    }
    state.loadingDiscovery = false
    state.discoveryError = ''
    state.debugPayloads = []
    state.imageShop = {
      loading: false,
      error: '',
      result: null,
      debug: [],
    }
    renderQuestions()
  })
}

function renderQuestions() {
  const workflow = document.querySelector('#workflow')
  workflow.innerHTML = `
    <div class="section-heading">
      <span>01 Interview</span>
      <h2>Warm intake, not a form.</h2>
    </div>
    <form class="question-grid" id="question-form">
      ${questionField('size', 'What size range should we prioritize?', 'US 6-8, M, EU 38-40')}
      ${questionField('occasion', 'What is the exact occasion?', 'wedding welcome drinks, art opening, first date')}
      ${questionField('weather', 'What weather or venue should we plan for?', 'humid patio, cold gallery, lots of walking')}
      ${questionField('style', 'What should the outfit communicate?', 'expensive, sexy, masc, effortless, creative')}
      ${questionField('avoid', 'Anything you never want to wear?', 'no heels, no bodycon, no wool')}
      ${questionField('x402Budget', 'BUDGET', '0.05', false)}
      ${questionField('x402Token', 'USD or CRYPTO', 'signed-payment-proof', false)}
      <button class="wide-button" type="submit">Run discovery agent</button>
    </form>
  `

  document.querySelector('#question-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    state.answers = Object.fromEntries(formData.entries())
    state.trends = getRelevantTrends()
    state.discoveryError = ''
    state.loadingDiscovery = true
    renderDiscoveryLoading()
    await runOrchestration()
    state.themes = createThemes()
    state.loadingDiscovery = false
    renderRecommendations()
  })
}

function questionField(name, label, placeholder, required = true) {
  return `
    <label class="question-card">
      <span>${label}</span>
      <input name="${name}" type="text" placeholder="${placeholder}" ${required ? 'required' : ''} />
    </label>
  `
}

function renderDiscoveryLoading() {
  const workflow = document.querySelector('#workflow')
  workflow.innerHTML = `
    <div class="section-heading">
      <span>02 Discovery</span>
      <h2>Contacting Fashion Discovery Agent endpoint.</h2>
    </div>
    <article class="loading-card">
      <p>Sending A2A-compatible requests with x402 headers and waiting for live retailer matches.</p>
    </article>
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

function parseIntent() {
  const text = `${state.prompt} ${Object.values(state.answers).join(' ')}`.toLowerCase()
  const moodWords = ['powerful', 'romantic', 'sexy', 'creative', 'relaxed', 'polished']
  const mood = moodWords.find((word) => text.includes(word)) ?? 'confident'
  const formality = /(gala|wedding|formal|black tie)/.test(text)
    ? 'formal'
    : /(office|conference|meeting|interview)/.test(text)
      ? 'smart'
      : 'elevated-casual'

  return {
    occasion: state.answers.occasion,
    mood,
    formality,
    constraints: {
      weather: state.answers.weather,
      avoid: state.answers.avoid,
      size: state.answers.size,
    },
    hasPhoto: false,
  }
}

function runStylingBrain(intent, trends) {
  const trendTerms = trends.map(({ trend }) => trend)
  const silhouette =
    intent.formality === 'formal'
      ? 'elongated and tailored'
      : intent.formality === 'smart'
        ? 'structured-soft'
        : 'easy layered proportions'
  const palette =
    intent.mood === 'romantic'
      ? ['blush', 'bone', 'oxblood']
      : intent.mood === 'creative'
        ? ['charcoal', 'olive', 'cobalt accent']
        : ['espresso', 'stone', 'metallic accent']

  return {
    silhouette,
    palette,
    components: [
      `${silhouette} top`,
      `${silhouette} bottom`,
      'statement outer layer',
      'editorial accessory',
    ],
    trendTerms,
  }
}

function normalizeCategory(component) {
  const text = component.toLowerCase()
  if (text.includes('top') || text.includes('blouse') || text.includes('shirt')) {
    return 'tops'
  }
  if (text.includes('bottom') || text.includes('trouser') || text.includes('skirt') || text.includes('denim')) {
    return 'bottoms'
  }
  if (text.includes('outer') || text.includes('coat') || text.includes('jacket') || text.includes('layer')) {
    return 'outerwear'
  }
  return 'accessories'
}

function buildDiscoveryRequest(component, category, index) {
  const budget = Number(state.answers.x402Budget) || 0.05
  return {
    agent_id: 'fitscout-orchestrator',
    request_id: `req-${Date.now()}-${index}`,
    query: `${component} ${state.answers.style}`,
    filters: {
      max_price: 5000,
      categories: [category],
      quality_tiers: ['luxury', 'premium'],
    },
    x402_budget: budget,
  }
}

function buildX402Headers(request) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Agent-Id': request.agent_id,
    'X402-Budget': String(request.x402_budget),
    'X402-Network': discoveryApiConfig.x402Network,
  }

  const paymentToken = state.answers.x402Token?.trim() || discoveryApiConfig.x402Token
  if (paymentToken) {
    headers['X402-Payment'] = paymentToken
  }

  if (discoveryApiConfig.x402PaymentAddress) {
    headers['X402-Payment-Address'] = discoveryApiConfig.x402PaymentAddress
  }

  return headers
}

async function callDiscoveryEndpoint(request, headers) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), discoveryApiConfig.timeoutMs)
  const startedAt = performance.now()

  try {
    const response = await fetch(discoveryApiConfig.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    const rawBody = await response.text()
    let responseBody = {}
    try {
      responseBody = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      responseBody = { raw: rawBody }
    }
    const latencyMs = Math.round(performance.now() - startedAt)

    state.debugPayloads.unshift({
      timestamp: new Date().toISOString(),
      endpoint: discoveryApiConfig.endpoint,
      status: response.status,
      latencyMs,
      headers,
      request,
      response: responseBody,
    })

    if (!response.ok) {
      throw new Error(responseBody?.message || `Discovery endpoint failed with ${response.status}`)
    }

    return {
      request_id: responseBody.request_id || request.request_id,
      matches: Array.isArray(responseBody.matches) ? responseBody.matches : [],
      total_matches:
        typeof responseBody.total_matches === 'number'
          ? responseBody.total_matches
          : Array.isArray(responseBody.matches)
            ? responseBody.matches.length
            : 0,
      query_cost: Number(responseBody.query_cost || 0),
      source: responseBody.source || 'backend',
    }
  } catch (error) {
    state.debugPayloads.unshift({
      timestamp: new Date().toISOString(),
      endpoint: discoveryApiConfig.endpoint,
      status: 'error',
      latencyMs: Math.round(performance.now() - startedAt),
      headers,
      request,
      response: {
        message: error instanceof Error ? error.message : 'Unknown discovery error',
      },
    })
    throw error
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function callRetailerDiscovery(stylingPlan) {
  const results = await Promise.allSettled(
    stylingPlan.components.map(async (component, index) => {
      const category = normalizeCategory(component)
      const request = buildDiscoveryRequest(component, category, index)
      const headers = buildX402Headers(request)
      const response = await callDiscoveryEndpoint(request, headers)

      return {
        component,
        category,
        request,
        response,
      }
    }),
  )

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }

    const component = stylingPlan.components[index]
    const category = normalizeCategory(component)
    return {
      component,
      category,
      request: buildDiscoveryRequest(component, category, index),
      response: {
        request_id: `failed-${Date.now()}-${index}`,
        matches: [],
        total_matches: 0,
        query_cost: 0,
        source: 'error',
      },
    }
  })
}

function synthesizeHouseVoice(intent, stylingPlan) {
  const avoidNote = intent.constraints.avoid
    ? `We are avoiding ${intent.constraints.avoid} while keeping the line intentional.`
    : 'We keep the line clean and effortless.'
  return `For ${intent.occasion}, we are building a ${intent.mood} silhouette in ${stylingPlan.palette.join(', ')}. ${avoidNote}`
}

function buildImageToShopRequest(theme) {
  return {
    prompt: `${theme.name}. ${theme.description}`,
    outfit_context: {
      event_prompt: state.prompt,
      occasion: state.answers.occasion,
      weather: state.answers.weather,
      size: state.answers.size,
      style: state.answers.style,
      avoid: state.answers.avoid,
      search_terms: theme.searchTerms,
      trends: state.trends.map(({ trend }) => trend),
    },
  }
}

async function callImageToShopEndpoint(request) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), imageShopApiConfig.timeoutMs)
  const startedAt = performance.now()

  try {
    const response = await fetch(imageShopApiConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    const rawBody = await response.text()
    let responseBody = {}
    try {
      responseBody = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      responseBody = { raw: rawBody }
    }

    state.imageShop.debug.unshift({
      timestamp: new Date().toISOString(),
      endpoint: imageShopApiConfig.endpoint,
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
      request,
      response: responseBody,
    })

    if (!response.ok) {
      throw new Error(responseBody?.message || `Image-to-shop endpoint failed with ${response.status}`)
    }

    return responseBody
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function runImageToShop(theme) {
  state.imageShop.loading = true
  state.imageShop.error = ''
  state.imageShop.result = null

  try {
    const request = buildImageToShopRequest(theme)
    const response = await callImageToShopEndpoint(request)
    state.imageShop.result = {
      imageUrl:
        response.generated_image_url ||
        response.image_url ||
        response.output?.image_url ||
        response.outfit_image,
      shoppingResults:
        response.shopping_results ||
        response.matches ||
        response.products ||
        [],
      raw: response,
    }
  } catch (error) {
    state.imageShop.error = error instanceof Error ? error.message : 'Image generation failed.'
  } finally {
    state.imageShop.loading = false
  }
}

async function runOrchestration() {
  const intent = parseIntent()
  const stylingPlan = runStylingBrain(intent, state.trends)
  let discovery = []

  try {
    discovery = await callRetailerDiscovery(stylingPlan)
  } catch (error) {
    state.discoveryError = error instanceof Error ? error.message : 'Discovery request failed.'
  }

  const narration = synthesizeHouseVoice(intent, stylingPlan)

  state.orchestration = {
    intent,
    stylingPlan,
    discovery,
    narration,
    steps: orchestrationSteps,
  }
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
    sectionHeading('02 Orchestrator', 'Agent pipeline now active.'),
    orchestrationBoard(),
    debugDrawer(),
    sectionHeading('03 Search', 'Trend signals mined for your use case.'),
    trendList(),
    sectionHeading('04 Recommend', 'Pick a broad outfit direction from the styling brain.'),
    themeGrid(),
    refinementPanel(),
  )
}

function orchestrationBoard() {
  const board = document.createElement('div')
  board.className = 'orchestration-board'

  state.orchestration.steps.forEach((step, index) => {
    const card = document.createElement('article')
    card.className = 'orchestration-step'
    const badge = document.createElement('span')
    badge.textContent = `0${index + 1}`
    const label = document.createElement('h3')
    label.textContent = step
    const detail = document.createElement('p')
    detail.textContent = orchestrationStepDetail(step)
    card.append(badge, label, detail)
    board.append(card)
  })

  return board
}

function orchestrationStepDetail(step) {
  if (!state.orchestration) {
    return ''
  }
  if (step === 'Parse intent') {
    return `${state.orchestration.intent.formality} brief, mood: ${state.orchestration.intent.mood}`
  }
  if (step === 'Warm intake') {
    return `Size ${state.answers.size}; constraints: ${state.answers.avoid || 'none provided'}`
  }
  if (step === 'Styling brain') {
    return `Silhouette: ${state.orchestration.stylingPlan.silhouette}`
  }
  if (step === 'Retailer discovery') {
    if (state.discoveryError) {
      return `Discovery error: ${state.discoveryError}`
    }

    const totalMatches = state.orchestration.discovery.reduce((sum, entry) => sum + entry.response.total_matches, 0)
    const totalCost = state.orchestration.discovery
      .reduce((sum, entry) => sum + Number(entry.response.query_cost || 0), 0)
      .toFixed(4)
    return `Matched ${totalMatches} routes from backend. Total query cost: ${totalCost} XRP`
  }
  if (step === 'Voice synthesis') {
    return state.orchestration.narration
  }
  return state.approval.status === 'approved'
    ? `Approved: ${state.approval.selectedPiece}`
    : 'Waiting for explicit user approval before purchase handoff'
}

function debugDrawer() {
  const wrapper = document.createElement('section')
  wrapper.className = 'debug-drawer'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'debug-toggle'
  button.textContent = state.debugDrawerOpen
    ? 'Hide debug payload contract'
    : 'Show debug payload contract'
  button.addEventListener('click', () => {
    state.debugDrawerOpen = !state.debugDrawerOpen
    if (state.selectedTheme === null) {
      renderRecommendations()
    } else {
      renderOutputLinks()
    }
  })

  const hint = document.createElement('p')
  hint.className = 'debug-hint'
  hint.textContent = 'Live A2A request/response with x402 headers for judging walkthroughs.'

  wrapper.append(button, hint)

  if (state.debugDrawerOpen) {
    const payload = document.createElement('pre')
    payload.className = 'debug-payload'
    payload.textContent = JSON.stringify(state.debugPayloads, null, 2)
    wrapper.append(payload)
  }

  return wrapper
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
    button.addEventListener('click', async () => {
      state.selectedTheme = index
      state.approval = {
        status: 'idle',
        selectedPiece: null,
      }
      state.imageShop = {
        loading: true,
        error: '',
        result: null,
        debug: [],
      }
      renderOutputLinks()
      await runImageToShop(theme)
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
  workflow.append(
    sectionHeading('05 Output links', 'Five searches for each wardrobe piece.'),
    linkBoard(),
    sectionHeading('06 Image to shop', 'Generate the look and shop directly from the rendered outfit.'),
    imageShopPanel(),
    sectionHeading('07 Approval', 'Human approval gate before any purchase action.'),
    approvalGate(),
  )
  workflow.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

function imageShopPanel() {
  const panel = document.createElement('section')
  panel.className = 'image-shop-panel'

  if (state.imageShop.loading) {
    const loading = document.createElement('p')
    loading.className = 'image-shop-status'
    loading.textContent = 'Generating editorial outfit image and matching shoppable items...'
    panel.append(loading)
    return panel
  }

  if (state.imageShop.error) {
    const error = document.createElement('p')
    error.className = 'image-shop-status image-shop-error'
    error.textContent = state.imageShop.error
    panel.append(error)
    return panel
  }

  if (!state.imageShop.result) {
    const empty = document.createElement('p')
    empty.className = 'image-shop-status'
    empty.textContent = 'Pick a theme to generate a visual route.'
    panel.append(empty)
    return panel
  }

  const grid = document.createElement('div')
  grid.className = 'image-shop-grid'

  const imageCard = document.createElement('article')
  imageCard.className = 'image-preview-card'
  const previewTitle = document.createElement('h3')
  previewTitle.textContent = 'Generated look'
  imageCard.append(previewTitle)

  if (state.imageShop.result.imageUrl) {
    const image = document.createElement('img')
    image.src = state.imageShop.result.imageUrl
    image.alt = 'Generated outfit preview'
    image.loading = 'lazy'
    image.className = 'image-preview'
    imageCard.append(image)
  } else {
    const unavailable = document.createElement('p')
    unavailable.className = 'image-shop-status'
    unavailable.textContent = 'The backend returned shopping data without an image preview.'
    imageCard.append(unavailable)
  }

  const resultsCard = document.createElement('article')
  resultsCard.className = 'image-results-card'
  const resultsTitle = document.createElement('h3')
  resultsTitle.textContent = 'Shop from image'
  resultsCard.append(resultsTitle)

  const resultsList = document.createElement('ul')
  resultsList.className = 'image-results-list'
  const items = Array.isArray(state.imageShop.result.shoppingResults) ? state.imageShop.result.shoppingResults : []

  if (items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'image-shop-status'
    empty.textContent = 'No shopping matches were returned for the generated image.'
    resultsCard.append(empty)
  } else {
    items.forEach((item, index) => {
      const entry = document.createElement('li')
      const link = document.createElement('a')
      link.href = item.link || item.url || '#'
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.textContent = item.title || item.name || item.product_name || `Shopping match ${index + 1}`

      const meta = document.createElement('span')
      meta.textContent = [item.retailer, item.price, item.source].filter(Boolean).join(' • ') || 'Backend image-shopping result'
      entry.append(link, meta)
      resultsList.append(entry)
    })
    resultsCard.append(resultsList)
  }

  const debug = document.createElement('details')
  debug.className = 'image-debug-drawer'
  const summary = document.createElement('summary')
  summary.textContent = `Image-to-shop payloads (${state.imageShop.debug.length})`
  const pre = document.createElement('pre')
  pre.className = 'debug-payload'
  pre.textContent = JSON.stringify(state.imageShop.debug, null, 2)
  debug.append(summary, pre)

  grid.append(imageCard, resultsCard)
  panel.append(grid, debug)
  return panel
}

function linkBoard() {
  const selectedTheme = state.themes[state.selectedTheme]
  const board = document.createElement('div')
  board.className = 'link-board'

  if (state.discoveryError || state.orchestration.discovery.length === 0) {
    const empty = document.createElement('article')
    empty.className = 'link-column'
    const heading = document.createElement('h3')
    heading.textContent = 'Discovery unavailable'
    const detail = document.createElement('p')
    detail.className = 'discovery-meta'
    detail.textContent = state.discoveryError || 'No discovery responses were returned.'
    empty.append(heading, detail)
    board.append(empty)
    return board
  }

  state.orchestration.discovery.forEach((discoveryEntry, index) => {
    const column = document.createElement('article')
    column.className = 'link-column'
    const heading = document.createElement('h3')
    heading.textContent = discoveryEntry.category
    const meta = document.createElement('p')
    meta.className = 'discovery-meta'
    meta.textContent = `${discoveryEntry.response.source} • cost ${discoveryEntry.response.query_cost} XRP`
    const list = document.createElement('ul')

    discoveryEntry.response.matches.forEach((match) => {
      const item = document.createElement('li')
      const link = document.createElement('a')
      link.href = match.link
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.textContent = `${match.retailer_name}: ${selectedTheme.searchTerms[index]}`
      item.append(link)
      list.append(item)
    })

    column.append(heading, meta, list)
    board.append(column)
  })

  return board
}

function approvalGate() {
  const panel = document.createElement('article')
  panel.className = 'approval-gate'
  const message = document.createElement('p')
  message.textContent =
    state.approval.status === 'approved'
      ? `Approved purchase handoff for: ${state.approval.selectedPiece}`
      : 'No auto-buy. Confirm a single piece to hand off to the purchase agent.'

  const actions = document.createElement('div')
  actions.className = 'approval-actions'

  const selectedTheme = state.themes[state.selectedTheme]
  selectedTheme.searchTerms.forEach((term) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = `Approve ${term}`
    button.addEventListener('click', () => {
      state.approval = {
        status: 'approved',
        selectedPiece: term,
      }
      renderOutputLinks()
    })
    actions.append(button)
  })

  panel.append(message, actions)
  return panel
}

setupApp()
