# Your Sofia API / Твоята София API

[![License: EUPL 1.2](https://img.shields.io/badge/License-EUPL%201.2-blue.svg)](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12)
[![Payload CMS](https://img.shields.io/badge/Payload%20CMS-3.31-000000)](https://payloadcms.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org/)

The backend API for **Your Sofia** mobile application. Built with Payload CMS 3.0, this bilingual (Bulgarian/English) content management system powers city services, news, and civic engagement features for Sofia residents.

[🇧🇬 Прочети на български](README.bg.md) | [🤝 Contributing](CONTRIBUTING.md) | [📋 Issues](https://github.com/yourusername/your-sofia/issues)

---

## 📖 Table of Contents

- [Motivation](#motivation)
- [Features](#features)
- [Technical Overview](#technical-overview)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Motivation

**Your Sofia** is an open-source civic engagement platform created for the citizens of Sofia. Built on the principle of **creating a more liveable city by taking care of its citizens**, this project welcomes contributions from developers, designers, and community members who share the vision of transparent, accessible urban services.

### Core Principles

- **Open Source First**: Every line of code is open for inspection, improvement, and contribution
- **Citizen-Centric**: Designed with real needs of Sofia residents in mind
- **Privacy-Respecting**: Anonymous reporting with device-based identification (no personal data required)
- **Bilingual by Design**: Bulgarian is the default language, with full English support
- **Community-Driven**: Built by the community, for the community

### Main Functionalities

1. **📰 Stay Informed**
   - Receive city news and event notifications
   - Filter by topics (festivals, infrastructure, emergencies, announcements)
   - Location-based news with interactive maps
   - Push notifications for important updates

2. **🗺️ Navigate the City**
   - Explore city objects on interactive maps
   - Find waste containers and recycling points
   - View real-time air quality data
   - Discover public services and facilities

3. **🤝 Participate in City Development**
   - Report infrastructure issues (damaged waste containers, missing lids, overflow)
   - Track your contributions with personal statistics
   - Anonymous, privacy-preserving reporting system
   - Vote on city surveys and initiatives (coming soon)

---

## ✨ Features

### For Citizens

- 🌍 **Bilingual Interface**: Seamless switching between Bulgarian and English
- 📱 **Native Mobile Experience**: Built with React Native for smooth performance
- 🔔 **Push Notifications**: Stay updated on city events and news
- 🗺️ **Interactive Maps**: Explore news locations and city infrastructure
- 📊 **Personal Dashboard**: Track your reported issues and contributions
- 🔒 **Privacy-First**: Anonymous device IDs, no account required
- 📍 **Location Services**: GPS-based reporting and nearby services

### For Administrators

- 🛠️ **Content Management**: Payload CMS admin panel for news and media
- 🌐 **Localization Support**: Create content in both Bulgarian and English
- 📈 **Analytics**: Track citizen engagement and issue resolution
- 🔐 **Access Control**: Role-based permissions for administrators
- 📊 **Database Management**: PostgreSQL with PostGIS for spatial data

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **pnpm** 10.18+ ([Install](https://pnpm.io/installation))
- **Docker** & Docker Compose ([Install](https://docs.docker.com/get-docker/))
- **Expo CLI** (optional, for advanced features)

### Quick Start

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/your-sofia.git
cd your-sofia
```

#### 2️⃣ Backend Setup (Payload CMS)

```bash
cd api

# Start PostgreSQL with PostGIS
docker-compose -f docker-compose.postgres.yml up -d

# Install dependencies
pnpm install

# Generate TypeScript types
pnpm generate:types

# Start the development server
pnpm dev
```

The API will be available at `http://localhost:3000`

**First-time setup**: Navigate to `http://localhost:3000/admin` and create your first admin user.

#### 3️⃣ Frontend Setup (Mobile App)

```bash
cd app

# Install dependencies
pnpm install

# Start the Expo development server
pnpm dev
```

**Open the app**:
- Press `i` for iOS simulator (macOS only)
- Press `a` for Android emulator (requires Android Studio)
- Scan the QR code with Expo Go app on your physical device

---

## 🛠️ Development

---

## 📁 Project Structure

### Mobile App (`app/`)

```
app/
├── app/                      # Expo Router pages
│   ├── (tabs)/              # Tab navigation screens
│   │   ├── index.tsx        # Home (News feed)
│   │   ├── services.tsx     # City services
│   │   ├── payments.tsx     # Payment services
│   │   ├── profile.tsx      # User profile & stats
│   │   └── signals/         # Signal management
│   │       ├── index.tsx    # Signals list
│   │       ├── new.tsx      # Create signal
│   │       └── [id].tsx     # Signal details/edit
│   ├── _layout.tsx          # Root layout
│   └── +not-found.tsx       # 404 page
├── components/              # Reusable components
│   ├── NewsCard.tsx         # News article card
│   ├── NewsMap.tsx          # Interactive map
│   ├── LanguageSwitch.tsx   # Language toggle
│   ├── TopicFilter.tsx      # News topic filter
│   ├── WasteContainerCard.tsx
│   └── WasteContainerMarker.tsx
├── hooks/                   # Custom React hooks
│   ├── useNews.ts           # News data fetching
│   ├── useWasteContainers.ts
│   ├── useNotifications.ts
│   └── useFrameworkReady.ts
├── lib/                     # Utilities
│   ├── payload.ts           # API client
│   └── deviceId.ts          # Device identification
├── translations/            # i18n strings
│   ├── bg.ts                # Bulgarian (default)
│   ├── en.ts                # English
│   ├── services.bg.ts
│   └── services.en.ts
├── types/                   # TypeScript types
│   ├── news.ts
│   ├── signal.ts
│   └── wasteContainer.ts
└── assets/                  # Images and fonts
```

### Backend API (`api/`)

```
api/
├── src/
│   ├── collections/         # Payload collections
│   │   ├── News.ts          # News articles
│   │   ├── Signals.ts       # Citizen reports
│   │   ├── WasteContainers.ts
│   │   ├── Media.ts         # File uploads
│   │   ├── Pages.ts
│   │   └── Users.ts
│   ├── endpoints/           # Custom API endpoints
│   │   ├── subscribe.ts     # Push notification registration
│   │   └── seed-air-quality.ts
│   ├── utilities/           # Helper functions
│   │   └── pushNotifications.ts
│   ├── hooks/               # Payload hooks
│   ├── access/              # Access control functions
│   ├── payload.config.ts    # Payload configuration
│   └── payload-types.ts     # Generated types
├── public/                  # Static files
│   └── media/              # Uploaded media
└── docker-compose.postgres.yml
```

---

## 🛠️ Development

### Available Commands

#### Backend (from `api/`)

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm generate:types   # Generate TypeScript types from collections
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm seed:waste-containers  # Seed database with test data
```

#### Frontend (from `app/`)

```bash
pnpm dev              # Start Expo development server
pnpm typecheck        # Run TypeScript type checking
pnpm lint             # Run Expo linting
pnpm build:web        # Build web version
```

### Content Management

Access the Payload CMS admin panel at `http://localhost:3000/admin` to manage news, media, signals, and city infrastructure.

---

## 🤝 Contributing

We welcome contributions from everyone! Whether you're fixing a bug, adding a feature, improving documentation, or translating content, your help makes **Your Sofia** better for all citizens.

### How to Contribute

1. Read our [Contributing Guide](CONTRIBUTING.md)
2. Check the [Code of Conduct](CONTRIBUTING.md#code-of-conduct)
3. Browse [open issues](https://github.com/yourusername/your-sofia/issues)
4. Submit your contribution via Pull Request

### Quick Contribution Guidelines

- 🐛 **Report bugs**: Open an issue with reproduction steps
- 💡 **Suggest features**: Describe the problem and proposed solution
- 🔧 **Submit code**: Fork, create a branch, make changes, open PR
- 📖 **Improve docs**: Fix typos, add examples, clarify instructions
- 🌍 **Translate**: Help with Bulgarian/English translations

For detailed instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

This project is licensed under the **European Union Public License (EUPL) v1.2**.

### What This Means

- ✅ You can use, modify, and distribute this software
- ✅ You can use it for commercial purposes
- ✅ Compatible with GPL, AGPL, MPL, and other open source licenses
- ❗ If you distribute modified versions, you must share the source code under EUPL
- ❗ You must keep all copyright notices intact
- ❗ No warranty is provided

### Full License

- **English**: [LICENSE](LICENSE) | [Official EUPL Text](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12)
- **Bulgarian**: See [LICENSE](LICENSE) for summary

For questions about licensing, visit the [EUPL FAQ](https://joinup.ec.europa.eu/collection/eupl/how-use-eupl).

---

## 🙏 Acknowledgments

- **Sofia Municipality**: For supporting open civic technology
- **Contributors**: Everyone who has helped improve this project
- **Expo Team**: For the amazing React Native framework
- **Payload CMS**: For the powerful headless CMS
- **Open Source Community**: For the tools and libraries we build upon

---

## 📞 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/your-sofia/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/your-sofia/discussions)
- **Email**: support@your-sofia.bg (if applicable)

---

Made with ❤️ for Sofia | Създадено с ❤️ за София
