#!/bin/bash
# ================================================
# Bin Group AI — Android (Termux) Setup Script
# ================================================
# Run this inside Termux on your Android phone
#
# STEP 1: Install Termux from F-Droid (NOT Play Store)
#   → https://f-droid.org/en/packages/com.termux/
#
# STEP 2: Open Termux and paste this entire command:
#   curl -sL https://raw.githubusercontent.com/iambinismail-code/commandcenter-ai/main/setup-termux.sh | bash
#
# OR copy this file to your phone and run: bash setup-termux.sh
# ================================================

echo "========================================="
echo "  🚀 Bin Group AI — Termux Setup"
echo "========================================="
echo ""

# Update packages
echo "📦 Updating Termux packages..."
pkg update -y && pkg upgrade -y

# Install Node.js and Git
echo "📦 Installing Node.js and Git..."
pkg install -y nodejs git

# Clone the repo
echo "📥 Cloning your project..."
cd ~
git clone https://github.com/iambinismail-code/commandcenter-ai.git
cd commandcenter-ai

# Install npm dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file
echo "⚙️ Setting up environment..."
cat > .env << 'ENVFILE'
PORT=3000
API_KEY=dev-key-change-in-production

# Telegram Bot
TELEGRAM_BOT_TOKEN=8853003818:AAG0pJFppBeZcM06Owzbknf7LiFy46sf8Vc
TELEGRAM_OWNER_ID=6623945117

# Google Gemini AI
GEMINI_API_KEY=AIzaSyAIBwT_c8j4LHdlJsgg6RdIhyZk6ocTgMM

# Groq AI
GROQ_API_KEY=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

# Facebook (optional)
FB_APP_ID=
FB_APP_SECRET=
FB_PAGE_ACCESS_TOKEN=
FB_PAGE_ID=
ENVFILE

# Install Termux:Boot for auto-start on phone reboot
echo "⚙️ Setting up auto-start..."
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-bot.sh << 'BOOTSCRIPT'
#!/bin/bash
termux-wake-lock
cd ~/commandcenter-ai
node server/index.js >> ~/bot.log 2>&1 &
BOOTSCRIPT
chmod +x ~/.termux/boot/start-bot.sh

# Prevent Termux from sleeping
echo ""
echo "========================================="
echo "  ✅ Setup Complete!"
echo "========================================="
echo ""
echo "  To START the bot now, run:"
echo "    cd ~/commandcenter-ai && node server/index.js"
echo ""
echo "  To run in BACKGROUND:"
echo "    cd ~/commandcenter-ai && nohup node server/index.js > ~/bot.log 2>&1 &"
echo ""
echo "  To see logs:"
echo "    tail -f ~/bot.log"
echo ""
echo "  To STOP the bot:"
echo "    pkill -f 'node server/index.js'"
echo ""
echo "  ⚡ IMPORTANT: Install 'Termux:Boot' from F-Droid"
echo "     to auto-start the bot when phone reboots."
echo ""
echo "  🔋 Keep the phone plugged in and on WiFi!"
echo "========================================="
