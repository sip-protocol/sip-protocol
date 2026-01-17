# Video Script: Stealth Addresses Explainer

**Title**: How Stealth Addresses Work | SIP Protocol
**Duration**: 3-4 minutes
**Style**: Animated explainer with voiceover
**Target Audience**: Developers & crypto-curious users

---

## INTRO (0:00 - 0:20)

**[Visual: Wallet address being shared publicly]**

**VOICEOVER:**
"Every time you share your crypto wallet address, you're giving away your entire financial history. Your balance, your transactions, every token you own—visible to the world."

**[Visual: Multiple eyes watching a wallet]**

"What if there was a way to receive payments without revealing your identity?"

**[Visual: SIP Protocol logo fade in]**

"This is how stealth addresses work."

---

## SECTION 1: The Problem (0:20 - 0:50)

**[Visual: Traditional mailbox analogy]**

**VOICEOVER:**
"Think of a traditional crypto address like having one mailbox for life."

**[Visual: Letters piling up in mailbox, people peeking]**

"Everyone who ever sends you anything can see who else sent you money, where you spent it, and your complete history."

**[Visual: Person checking bank statement]**

"Would you give your bank statement to everyone who pays you?"

**[Visual: Red X over the scenario]**

"Of course not. But that's exactly what happens with public blockchain addresses."

---

## SECTION 2: The Solution (0:50 - 1:30)

**[Visual: Magic mailbox that creates new mailboxes]**

**VOICEOVER:**
"Stealth addresses solve this with a clever trick."

**[Visual: One 'master address' generating many 'child addresses']**

"Instead of sharing your actual address, you share a 'stealth meta-address.' Think of it as a master key."

**[Visual: Sender using meta-address to create unique address]**

"When someone wants to send you crypto, they use your meta-address to generate a unique, one-time address just for that payment."

**[Visual: Only recipient can open the mailbox]**

"You're the only one who can access it. And nobody can tell it's connected to you."

---

## SECTION 3: How It Works (1:30 - 2:30)

**[Visual: Simple diagram with math symbols simplified]**

**VOICEOVER:**
"Here's the elegant cryptography behind it."

**[Visual: Two keys - Spending Key and Viewing Key]**

"Your stealth meta-address contains two public keys: a spending key and a viewing key."

**[Visual: Sender generates random key]**

"When someone sends you crypto, they generate a random 'ephemeral' key."

**[Visual: Keys combining with sparkles]**

"The sender combines their ephemeral key with your public keys using elliptic curve math. The result? A unique stealth address that only you can unlock."

**[Visual: Lock opening with private key]**

"Using your private keys, you can derive the secret key for any stealth address created from your meta-address."

**[Visual: Multiple stealth addresses, all unlinkable]**

"Each payment gets a different address. No one can link them together."

---

## SECTION 4: Finding Your Payments (2:30 - 3:00)

**[Visual: Scanning animation through blockchain]**

**VOICEOVER:**
"But wait—if everyone gets different addresses, how do you find your payments?"

**[Visual: Viewing key as a filter]**

"That's where the viewing key comes in. You scan the blockchain with your viewing key, checking each payment to see if it's yours."

**[Visual: View tags as shortcuts]**

"We use 'view tags'—a single byte that lets you skip 255 out of 256 payments instantly. Scanning is fast."

**[Visual: Match found, green checkmark]**

"When you find a match, you derive the private key and claim your funds."

---

## SECTION 5: Why It Matters (3:00 - 3:30)

**[Visual: Split screen - old way vs new way]**

**VOICEOVER:**
"Traditional addresses: one address, fully traceable."

"Stealth addresses: unlimited addresses, completely unlinkable."

**[Visual: Checkmarks appearing]**

"Any amount. Any token. No waiting for others. No pools to trust."

**[Visual: Viewing key being shared with auditor]**

"And if you need to prove something to an auditor? Share your viewing key. They can see your transactions but can't spend your funds."

---

## OUTRO (3:30 - 3:50)

**[Visual: Code snippet of SDK usage]**

**VOICEOVER:**
"Adding stealth addresses to your app takes just a few lines of code."

**[Visual: npm install command]**

"Install the SIP Protocol SDK, generate a meta-address, and you're ready for private payments."

**[Visual: Website, Discord, GitHub links]**

"Learn more at docs.sip-protocol.org. Join our Discord. And start building privacy into your applications."

**[Visual: SIP Protocol logo + tagline]**

"SIP Protocol. Privacy for Web3."

---

## PRODUCTION NOTES

### Visuals Needed
1. Wallet address sharing animation
2. Mailbox metaphor (physical → digital)
3. Key generation diagram
4. Elliptic curve math visualization (simplified, abstract)
5. Scanning animation
6. View tag filtering visualization
7. Split screen comparison
8. Code snippet overlay
9. Logo animations

### Voiceover Style
- Conversational, not corporate
- Moderate pace (not rushed)
- Technical but accessible
- Confident, trustworthy tone

### Music
- Light electronic/ambient
- Not distracting
- Subtle build toward end

### Text Overlays
- Key terms when introduced: "Stealth Meta-Address", "Ephemeral Key", "View Tag"
- Website/social links at end
- Chapter markers for YouTube

### Call to Action
- Subscribe prompt at 3:40
- Link to docs in description
- Discord invite link

---

## ALTERNATIVE SHORT VERSION (60 seconds)

For social media / TikTok / Shorts:

**0-10s**: "Your crypto wallet is like a glass house. Everyone sees everything."

**10-25s**: "Stealth addresses give you a magic mailbox that creates new addresses for every payment. Only you can open them."

**25-45s**: "Share one meta-address. Receive unlimited private payments. No one can link them together."

**45-60s**: "Privacy for Web3. SIP Protocol. Link in bio."

---

## RELATED CONTENT

After this video, viewers might want:
1. "Pedersen Commitments Explained" (amount privacy)
2. "Viewing Keys for DAOs" (compliance)
3. "SIP SDK Tutorial" (hands-on coding)
