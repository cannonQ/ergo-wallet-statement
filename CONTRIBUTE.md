# Contributing to Ergo Wallet Dashboard 🚀

Thank you for wanting to help! This guide will show you how to contribute, whether you're fixing a tiny typo or adding a big new feature.

## Table of Contents
- [I'm New to This! Where Do I Start?](#im-new-to-this-where-do-i-start)
- [Ways You Can Help](#ways-you-can-help)
- [Setting Up Your Computer](#setting-up-your-computer)
- [Making Your First Change](#making-your-first-change)
- [Code Guidelines](#code-guidelines)
- [Submitting Your Work](#submitting-your-work)
- [Questions & Help](#questions--help)

## I'm New to This! Where Do I Start?

**Never contributed to open source before?** No problem! Here's what you need to know:

1. **Git & GitHub** - These are tools that help people work together on code
   - Git tracks changes to files (like "undo" on steroids)
   - GitHub is a website where code lives online
   - [GitHub's Hello World Guide](https://guides.github.com/activities/hello-world/) is a great start

2. **This Project** - Read the [README.md](README.md) to understand what the app does

3. **Start Small** - Look for issues labeled `good-first-issue` or `help-wanted`

## Ways You Can Help

You don't need to be a coding expert! Here are different ways to contribute:

### 🐛 Report Bugs
Found something broken? Tell us!
- Click "Issues" tab on GitHub
- Click "New Issue"
- Describe what went wrong:
  - What did you do?
  - What happened?
  - What should have happened?
  - Screenshots help a lot!

### 💡 Suggest Features
Have an idea? Share it!
- Open an issue
- Describe your idea
- Explain why it would be useful

### 📝 Improve Documentation
- Fix typos
- Make instructions clearer
- Add examples
- Translate to other languages

### 🎨 Design & UI
- Suggest interface improvements
- Create mockups
- Improve accessibility (making it easier for everyone to use)

### 💻 Write Code
- Fix bugs
- Add features
- Improve performance
- Write tests

## Setting Up Your Computer

### Prerequisites
Before you start, install these:
1. **Node.js** (v18 or newer) - [Download here](https://nodejs.org/)
2. **Git** - [Download here](https://git-scm.com/)
3. **Code Editor** - We recommend [VS Code](https://code.visualstudio.com/)

### Getting the Code

1. **Fork the repository**
   - Go to the GitHub page
   - Click "Fork" button (top right)
   - This makes your own copy

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/ergo-wallet-statement.git
   cd ergo-wallet-statement
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:5173`

5. **Create a branch**
   ```bash
   git checkout -b my-awesome-feature
   ```
   (Use a descriptive name like `fix-chart-colors` or `add-dark-mode`)

## Making Your First Change

### The Development Workflow

1. **Make your changes**
   - Edit the files you need
   - Save often
   - The browser will automatically refresh!

2. **Test your changes**
   - Does it work?
   - Did you break anything else?
   - Try different wallet addresses

3. **Check code quality**
   ```bash
   npm run lint
   ```
   This checks for common mistakes

4. **Build the project**
   ```bash
   npm run build
   ```
   Make sure it builds without errors

## Code Guidelines

### File Organization
```
src/
├── components/     # React components (UI pieces)
├── services/       # API calls and data fetching
├── types.ts        # TypeScript type definitions
├── constants.ts    # Fixed values used throughout
└── App.tsx         # Main app component
```

### Code Style

**Keep it simple and readable:**

✅ **Good:**
```typescript
// Clear function name, easy to understand
function calculateTotalValue(holdings: Holding[]): number {
  return holdings.reduce((sum, holding) => sum + holding.valueInErg, 0);
}
```

❌ **Not so good:**
```typescript
// Confusing name, hard to understand
function calc(h: any): number {
  return h.reduce((s, x) => s + x.valueInErg, 0);
}
```

**Use TypeScript types:**
```typescript
// Define types for better safety
interface WalletData {
  address: string;
  balance: number;
}
```

**Comment when needed:**
```typescript
// Calculate age in blocks (1 block ≈ 2 minutes)
const ageInBlocks = currentHeight - boxHeight;
```

### Component Guidelines

**Keep components focused:**
- Each component should do ONE thing well
- Break large components into smaller ones
- Use meaningful names

**Example structure:**
```typescript
import React from 'react';
import type { MyProps } from '../types';

export function MyComponent({ data }: MyProps) {
  // Component logic here

  return (
    <div>
      {/* JSX here */}
    </div>
  );
}
```

### Styling with Tailwind

We use Tailwind CSS for styling:
```typescript
<div className="flex items-center gap-4 p-4 rounded-lg bg-gray-800">
  <span className="text-lg font-bold">Hello!</span>
</div>
```

## Submitting Your Work

### Committing Changes

1. **Stage your changes**
   ```bash
   git add .
   ```

2. **Commit with a clear message**
   ```bash
   git commit -m "Fix: Chart colors now match brand guidelines"
   ```

   **Good commit messages:**
   - `Fix: Transaction dates showing incorrect timezone`
   - `Add: Dark mode toggle button`
   - `Update: Improve NFT loading performance`
   - `Docs: Fix typo in README`

3. **Push to your fork**
   ```bash
   git push origin my-awesome-feature
   ```

### Creating a Pull Request

1. Go to the original repository on GitHub
2. Click "Pull Requests" → "New Pull Request"
3. Click "compare across forks"
4. Select your fork and branch
5. Fill in the template:

   **Title:** Clear, concise description
   ```
   Fix: Transaction dates showing incorrect timezone
   ```

   **Description:** Explain what and why
   ```
   ## What Changed
   - Fixed timezone conversion in TransactionHistory component
   - Added date-fns for better date handling

   ## Why
   Users in different timezones were seeing wrong transaction times

   ## Testing
   - Tested with addresses from different timezones
   - Verified dates match Ergo Explorer
   ```

6. Click "Create Pull Request"

### After Submitting

- Be patient! Maintainers will review when they can
- Respond to feedback kindly
- Make requested changes
- Don't take it personally if changes are requested - it's part of the process!

## Questions & Help

### Common Issues

**"npm install" fails**
- Make sure you have Node.js v18 or newer
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

**"npm run dev" doesn't work**
- Check if another app is using port 5173
- Try `npm run dev -- --port 3000` to use a different port

**Linting errors**
- Run `npm run lint` to see all issues
- Many can be auto-fixed with your code editor

### Getting Help

- 💬 Open an issue with the "question" label
- 📧 Contact maintainers (check package.json)
- 🔍 Search existing issues - someone might have had the same question!

### Code of Conduct

**Be nice!** We want this to be a welcoming community.

- Be respectful and kind
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community
- Show empathy

## Types of Contributions Needed

### 🔴 High Priority
- Bug fixes
- Performance improvements
- Security issues

### 🟡 Medium Priority
- New features
- UI improvements
- Better error handling

### 🟢 Nice to Have
- Code refactoring
- Additional tests
- Documentation improvements

## Recognition

All contributors will be:
- Listed in the contributors section
- Credited in release notes
- Part of the Ergo community!

---

## Thank You! 🎉

Every contribution helps make this project better. Whether you're fixing a typo or adding a major feature, your work is appreciated!

**Ready to start?** Pick an issue labeled `good-first-issue` and dive in!

---

*Questions about this guide? Open an issue - we'd love to make it better!*
