# FitScout

FitScout is a fashionable event-outfit recommender prototype. It accepts a free-text event prompt or invite link, asks three quick follow-up questions, surfaces relevant fashion trend signals, recommends three outfit themes, and generates shopping search links for tops, bottoms, outerwear, and accessories.

## Development

```bash
npm install
npm run dev
```

### Discovery Backend Configuration

The web app now calls a live Fashion Discovery backend endpoint instead of simulated discovery.

Create a `.env` file in the project root with:

```bash
VITE_FASHION_DISCOVERY_ENDPOINT=https://your-discovery-service.example/api/v1/fashion-discovery
VITE_FASHION_DISCOVERY_TIMEOUT_MS=12000
VITE_X402_NETWORK=xrpl-testnet
VITE_X402_PAYMENT_ADDRESS=your-x402-payment-address
VITE_X402_TOKEN=your-signed-x402-token
```

Expected backend response shape:

```json
{
	"request_id": "req-456",
	"matches": [
		{
			"retailer_name": "House of Nova",
			"agent_endpoint": "https://houseofnova.xyz/api/agent",
			"category": "outerwear",
			"confidence_score": 0.95,
			"x402_endpoint": "https://houseofnova.xyz/payments",
			"link": "https://houseofnova.xyz/search?q=..."
		}
	],
	"total_matches": 1,
	"query_cost": 0.002,
	"source": "registry"
}
```

### Image Generation To Shop Configuration

The website can also call an image-generation-to-shop backend that renders an outfit and returns shopping results from the generated image.

Add these variables to `.env`:

```bash
VITE_IMAGE_TO_SHOP_ENDPOINT=https://your-image-agent.example/api/v1/outfit-to-shop
VITE_IMAGE_TO_SHOP_TIMEOUT_MS=30000
```

Typical backend response shape:

```json
{
	"generated_image_url": "https://cdn.example.com/generated-look.jpg",
	"shopping_results": [
		{
			"title": "Tailored Vest",
			"retailer": "House of Nova",
			"price": "$420",
			"link": "https://houseofnova.xyz/products/tailored-vest"
		}
	]
}
```

## Build

```bash
npm run build
```

## Inspiration Research Skill (2020-2025)

This repository includes a CLI skill that performs web search across a curated source list and synthesizes inspiration signals from 2020-2025.

Run:

```bash
npm run research -- "your topic"
```

Example:

```bash
npm run research -- "fall gallery opening outfit"
```

Covered sources:

- Reddit
- Vogue / Vogue Business
- Who What Wear
- Highsnobiety
- Hypebeast
- The Cut
- Elle
- Harper's Bazaar
- Refinery29
- Nylon
- GQ
- WWD (when accessible/indexable)
- Fashionista
- Lyst reports
- Depop / eBay / Etsy trend-report surfaces
