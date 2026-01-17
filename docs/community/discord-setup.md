# Discord Community Server Setup

Setup guide for the SIP Protocol Discord community.

## Server Name
**SIP Protocol**

## Server Icon
Use SIP Protocol logo (dark variant for Discord's interface)

## Channel Structure

### Category: WELCOME
| Channel | Type | Purpose |
|---------|------|---------|
| #welcome | Text | Server rules, how to get started |
| #announcements | Text | Official announcements (admin only) |
| #introductions | Text | New members introduce themselves |
| #roles | Text | Self-assign roles |

### Category: COMMUNITY
| Channel | Type | Purpose |
|---------|------|---------|
| #general | Text | General discussion |
| #off-topic | Text | Non-crypto conversation |
| #memes | Text | Privacy memes, fun content |
| #show-and-tell | Text | Share projects using SIP |

### Category: DEVELOPMENT
| Channel | Type | Purpose |
|---------|------|---------|
| #dev-support | Text | Developer Q&A |
| #sdk-help | Text | SDK-specific questions |
| #integrations | Text | Integration discussions |
| #bug-reports | Text | Report issues |
| #feature-requests | Text | Suggest features |

### Category: ECOSYSTEM
| Channel | Type | Purpose |
|---------|------|---------|
| #solana | Text | Solana-specific discussion |
| #ethereum | Text | Ethereum/EVM discussion |
| #near | Text | NEAR-specific discussion |
| #partners | Text | Partner project discussions |

### Category: RESOURCES
| Channel | Type | Purpose |
|---------|------|---------|
| #docs | Text | Documentation links, updates |
| #tutorials | Text | Guides and tutorials |
| #research | Text | Privacy research, papers |

### Category: VOICE
| Channel | Type | Purpose |
|---------|------|---------|
| #voice-chat | Voice | General voice |
| #dev-call | Voice | Developer discussions |

## Roles

### Staff Roles
| Role | Color | Permissions |
|------|-------|-------------|
| @Core Team | Purple (#9B59B6) | Admin |
| @Moderator | Blue (#3498DB) | Manage messages, kick |
| @Community Manager | Green (#2ECC71) | Manage channels |

### Community Roles
| Role | Color | How to Get |
|------|-------|------------|
| @Developer | Orange (#E67E22) | Verified dev in #roles |
| @Contributor | Yellow (#F1C40F) | PR merged to repo |
| @Partner | Gold (#FFD700) | Partner project rep |
| @Early Supporter | Silver (#BDC3C7) | Joined before 1000 members |

### Chain Roles (Self-Assign)
| Role | Color |
|------|-------|
| @Solana | Purple |
| @Ethereum | Blue |
| @NEAR | Green |
| @Multi-chain | Rainbow |

## Welcome Message

```markdown
# Welcome to SIP Protocol! 🔐

**SIP Protocol** is the privacy layer for Web3. We provide stealth addresses,
Pedersen commitments, and viewing keys for compliant privacy on any chain.

## Quick Links
📚 Documentation: https://docs.sip-protocol.org
💻 GitHub: https://github.com/sip-protocol
🐦 Twitter: https://twitter.com/SIPProtocol
🌐 Website: https://sip-protocol.org

## Getting Started
1. Read the rules in #rules
2. Introduce yourself in #introductions
3. Choose your roles in #roles
4. Ask questions in #dev-support

## Rules
1. Be respectful and inclusive
2. No spam or self-promotion without permission
3. No financial advice or shilling
4. Keep discussions on-topic in appropriate channels
5. No sharing of malicious code or links
6. English is the primary language

Welcome to the community! 🎉
```

## Bot Setup

### Required Bots

1. **Carl-bot** (Moderation)
   - Auto-mod (spam, links, caps)
   - Reaction roles
   - Logging
   - Warns/kicks/bans

2. **MEE6** or **Dyno** (Backup)
   - Welcome messages
   - Level system
   - Custom commands

3. **GitHub Bot**
   - PR/issue notifications in #dev-support
   - Connect to sip-protocol org

4. **Collab.Land** (Optional)
   - Token-gated access
   - Verify NFT/token holders

### Carl-bot Reaction Roles Setup

In #roles channel, post:
```
**Choose Your Chain(s)**
🟣 Solana
🔵 Ethereum
🟢 NEAR
🌈 Multi-chain

**Your Role**
👨‍💻 Developer
🏗️ Builder
🔬 Researcher
👀 Observer
```

Configure Carl-bot to assign roles based on reactions.

## Auto-Mod Rules

### Banned Words/Patterns
- Scam links (airdrop.xyz, etc.)
- Phishing patterns
- Racial slurs
- Spam patterns

### Rate Limits
- Max 5 messages per 5 seconds
- Max 3 mentions per message
- Max 10 emojis per message

### New Member Restrictions
- Cannot post links for first 10 minutes
- Cannot post images for first 30 minutes

## Verification

### Basic Verification
- React to message in #welcome
- Grants access to community channels

### Developer Verification (Optional)
- Link GitHub account
- Show contribution to repo
- Grants @Developer role

## Invite Links

### Public Invite
- URL: `discord.gg/sip-protocol`
- Never expires
- No use limit
- Tracks joins for analytics

### Partner Invite
- Separate tracking link
- For partner announcements

## Launch Checklist

- [ ] Create server with channel structure
- [ ] Set up roles and permissions
- [ ] Configure Carl-bot
- [ ] Add GitHub bot
- [ ] Create welcome message
- [ ] Set up reaction roles
- [ ] Configure auto-mod
- [ ] Test all channels
- [ ] Invite initial community (team, early supporters)
- [ ] Announce on Twitter
- [ ] Update website with Discord link

## Moderation Guidelines

### Warning System
1. First offense: Verbal warning
2. Second offense: Written warning (logged)
3. Third offense: 24-hour mute
4. Fourth offense: 7-day ban
5. Fifth offense: Permanent ban

### Immediate Ban Offenses
- Scam links
- Harassment
- Doxxing
- Illegal content

## Metrics to Track

- Total members
- Daily active users
- Messages per day
- New members per week
- #dev-support questions answered
- Retention rate

## Growth Targets

| Milestone | Target | Timeline |
|-----------|--------|----------|
| Launch | 50 members | Week 1 |
| Early | 200 members | Month 1 |
| Growth | 500 members | Month 2 |
| Established | 1000 members | Month 3 |
