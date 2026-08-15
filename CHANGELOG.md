# Changelog

All notable changes to this project will be documented in this file.

## [1.7.1](../../compare/v1.7.0...v1.7.1) (2026-08-15)

### 🐛 Bug Fixes

- **deps:** resolve 7 dependency vulnerabilities via lockfile (ca65333)

### 🔧 Chores

- **deps-dev:** bump tsx from 4.23.0 to 4.23.9 (#32) (7b73f4b)
- **deps-dev:** bump eslint-config-next from 16.2.10 to 16.3.0 (#33) (10dc0f2)
- **deps:** bump lucide-react from 1.24.0 to 1.29.0 (#35) (4fa1dc4)
- **deps-dev:** bump @playwright/test from 1.61.0 to 1.62.1 (#37) (727719d)
- **deps:** bump react and @types/react (#39) (b20ec63)
- **deps:** bump @stellar/stellar-sdk from 16.0.0 to 16.2.0 (#40) (98d32cc)
- remove agent instruction files from public repo (b017c16)
- **deps:** bump next from 16.2.9 to 16.3.0 (#19) (a12d6b9)
- **deps-dev:** bump tsx from 4.22.4 to 4.23.0 (#17) (a76368f)
- **deps-dev:** bump tailwindcss from 4.3.1 to 4.3.2 (#20) (33ebe84)
- **deps-dev:** bump @tailwindcss/postcss from 4.3.1 to 4.3.2 (#21) (3af6941)
- **deps-dev:** bump eslint-config-next from 16.2.9 to 16.2.10 (#24) (6bc9287)
- **deps:** bump @supabase/supabase-js from 2.108.2 to 2.110.2 (#27) (aa60b04)
- **deps-dev:** bump prettier from 3.8.4 to 3.9.5 (#28) (55c0eb8)
- **deps:** bump lucide-react from 1.20.0 to 1.24.0 (#29) (128dc22)

### 📝 Documentation

- **readme:** link the hook contract ID to stellar.expert (cfc2f08)
- **readme:** point judges at the one-click on-chain verify (d3124a4)

## [1.7.0](../../compare/v1.6.0...v1.7.0) (2026-07-02)

### 🚀 Features

- **zk:** witness the real on-chain proof in-browser (5d4106c)

## [1.6.0](../../compare/v1.5.0...v1.6.0) (2026-07-02)

### 🚀 Features

- **ui:** show app version badge in footer (ed5cfb3)

## [1.5.0](../../compare/v1.4.0...v1.5.0) (2026-07-02)

### 🚀 Features

- **seo:** robots + sitemap, security headers, next/image logo (876f8d4)

## [1.4.0](../../compare/v1.3.0...v1.4.0) (2026-07-01)

### 🚀 Features

- **legal:** Privacy & Terms pages; fix mobile nav overflow (117dabd)

## [1.3.0](../../compare/v1.2.0...v1.3.0) (2026-07-01)

### 🚀 Features

- **ui:** wallet Disconnect button and custom 404 page (c044b78)

## [1.2.0](../../compare/v1.1.2...v1.2.0) (2026-07-01)

### 🚀 Features

- **wallet:** real Freighter connect via official SDK + demo button (4f7d437)

### 💄 Style

- fix prettier formatting (542329c)
- format pitch.html with prettier (336f5e6)

### ✅ Tests

- **core:** verify and complete unit test suites and coverage (11e49b0)

### 📝 Documentation

- **pitch:** replace page 1 emojis with SVG icons (c07e2fe)
- **pitch:** replace emoji with logo icon and update demo video link (f1aeb09)
- **readme:** add walkthrough screenshot gallery to README (3229d63)
- **readme:** link verifier contract to testnet explorer (e0033f3)
- **readme:** update demo video YouTube URL and configuration (30fc1be)
- **readme:** update readme content and references (8bc81c3)
- **readme:** add Demo Materials section and link GitHub & Pitch Deck (e875996)

### 🔧 Chores

- **assets:** update og-image.png (4975023)

## [1.1.2](../../compare/v1.1.1...v1.1.2) (2026-06-28)

### 🐛 Bug Fixes

- **components:** replace inline SVG logo with public icon.svg in header (5597bfe)

## [1.1.1](../../compare/v1.1.0...v1.1.1) (2026-06-28)

### 🐛 Bug Fixes

- **css:** inline design tokens directly into globals.css and delete _tokens.css (1fc0fe2)

## [1.1.0](../../compare/HEAD~50...v1.1.0) (2026-06-28)

### 🚀 Features

- **setup:** initialize project codebase (7c8cbbc)

### 🐛 Bug Fixes

- **css:** move _tokens.css out of gitignored folder, adjust imports, and increase bundle size limits (016ed44)
- **package:** update homepage url to custom domain zebra.edycu.dev (11eacb1)
- **ci:** add package repo metadata, sync lockfile, and upgrade CI to Node 22 (397edf4)

### 🤖 CI/CD

- **deploy:** add Vercel CLI deployment steps to CI workflow (512f9b2)

