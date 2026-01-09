# Ergo Wallet Dashboard 💰

## What is This? (Explain Like I'm 5)

Imagine you have a piggy bank where you keep your money and special coins. This app is like a magic window that lets you see:

- 🏦 **How much money** you have in your piggy bank (your Ergo wallet)
- 📊 **Pretty charts** that show if your money is going up or down
- 🎨 **Cool pictures** of digital art you collected (NFTs)
- 📝 **A list of all the times** you put money in or took money out
- 🌈 **Different types of coins** you own, sorted into neat groups

It's like having a super-powered calculator that knows everything about your digital wallet!

## What Can This App Do?

### 📈 Track Your Wallet
- See how much ERG (Ergo's money) you have
- Watch your total value change over time
- View all your different tokens and coins

### 🎨 See Your Collection
- Look at your NFT art gallery
- Check out CyberVerse collectibles (characters, cars, pets, and more!)
- Filter by different types (pictures, audio, video)

### 📊 Cool Charts & Stats
- Pie charts showing what you own
- Line graphs tracking your balance over time
- Heatmaps showing when you make transactions
- Top holdings ranked by value

### 💸 Transaction History
- See every time money came in or went out
- Filter by date ranges
- Track your spending patterns

### ⚠️ Wallet Maintenance
- Get warnings about boxes that need attention
- Monitor demurrage (special Ergo wallet rules)

## How to Use It

### The Easy Way (Just Want to See It Work)
1. Visit the website (when deployed)
2. Type in an Ergo wallet address
3. Click "Load Wallet"
4. See all your wallet info!

### The Developer Way (Want to Run It Yourself)

**What You Need:**
- A computer
- Node.js installed (it's free software that runs JavaScript)
- A code editor (like VS Code)

**Steps:**

1. **Get the code**
   ```bash
   git clone https://github.com/cannonQ/ergo-wallet-statement.git
   cd ergo-wallet-statement
   ```

2. **Install the tools**
   ```bash
   npm install
   ```
   (This downloads all the helper tools the app needs)

3. **Start the app**
   ```bash
   npm run dev
   ```
   (This starts a mini-website on your computer)

4. **Open in browser**
   - Go to `http://localhost:5173`
   - Type an Ergo address and explore!

## What's Inside? (Tech Stack)

This app is built with:
- **React** - Makes the website interactive
- **TypeScript** - Helps catch mistakes in code
- **Tailwind CSS** - Makes everything look pretty
- **Chart.js** - Draws the cool charts
- **Vite** - Makes the app run fast
- **Ergo Explorer API** - Gets data from the Ergo blockchain

## Want to Help? 🤝

Check out [CONTRIBUTE.md](CONTRIBUTE.md) to learn how you can help make this app even better!

## Questions?

- **What is Ergo?** - It's a cryptocurrency (digital money) like Bitcoin, but with special features
- **Do I need an Ergo wallet?** - You can use any Ergo address to see its data (even someone else's public address)
- **Is this safe?** - Yes! The app only **reads** public data. It can't spend your money or access your private keys
- **Where does the data come from?** - From the Ergo blockchain via the public Explorer API

## License

This is open source! You can use it, modify it, and share it. See the LICENSE file for details.

---

Made with ❤️ for the Ergo community
