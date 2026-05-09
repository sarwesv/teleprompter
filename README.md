# Teleprompter

A modern, lightweight web-based teleprompter application designed for content creators, presenters, and anyone who needs to read scripts smoothly and professionally.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Usage](#usage)
- [Controls and Shortcuts](#controls-and-shortcuts)
- [Customization](#customization)
- [File Support](#file-support)
- [Browser Compatibility](#browser-compatibility)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

Teleprompter is a simple yet powerful tool for anyone who needs to deliver presentations, speeches, or recorded content while reading from a script. It provides an intuitive interface for smooth scrolling text with various customization options to suit your needs.

Whether you're recording videos, giving presentations, or practicing speeches, this application helps you maintain a natural delivery while keeping your script visible.

## ✨ Features

- **Adjustable Scrolling Speed** - Control the speed of text scrolling to match your reading pace
- **Customizable Font Size** - Increase or decrease text size for optimal readability
- **Day/Night Modes** - Switch between light and dark themes to reduce eye strain
- **Flippable Text** - Mirror text horizontally for use with actual teleprompter glass or reflective surfaces
- **Resizable Text Area** - Adjust the text area dimensions to fit your screen layout
- **File Upload** - Import `.txt` files directly into the teleprompter
- **Manual Text Input** - Type or paste scripts directly into the text area
- **Responsive Design** - Works seamlessly on different screen sizes and devices
- **Real-time Preview** - See your formatting changes instantly

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- No installation or dependencies required
- JavaScript enabled in your browser

### Installation

1. Clone the repository to your local machine:
```bash
git clone https://github.com/sarwesv/teleprompter.git
cd teleprompter
```

2. Open the application in your browser:
   - **Option 1**: Double-click `index.html` to open it directly
   - **Option 2**: Serve it locally using a web server:
     ```bash
     # Using Python 3
     python -m http.server 8000
     
     # Using Python 2
     python -m SimpleHTTPServer 8000
     
     # Using Node.js (with http-server)
     npx http-server
     ```
   - Then navigate to `http://localhost:8000` in your browser

## 📖 Usage

### Basic Workflow

1. **Load Your Script**:
   - Type or paste your script directly into the text area, OR
   - Click "Upload" and select a `.txt` file from your device

2. **Configure Settings** (optional):
   - Adjust font size for readability
   - Set scrolling speed to match your delivery pace
   - Toggle Night Mode if preferred
   - Enable text flip if using with reflective surfaces

3. **Start the Teleprompter**:
   - Click the "Start" button to begin scrolling
   - Text will scroll at your configured speed

4. **Control During Use**:
   - Pause/resume scrolling as needed
   - Adjust speed on the fly
   - Use shortcuts for quick adjustments

## 🎮 Controls and Shortcuts

### Button Controls
- **Start** - Begin scrolling the text
- **Pause** - Pause the scrolling (resume with Start)
- **Reset** - Return text to the top
- **Clear** - Clear the text area
- **Upload** - Import a `.txt` file

### Settings
- **Speed Slider** - Adjust scrolling speed (slow to fast)
- **Font Size Slider** - Increase or decrease text size
- **Night Mode Toggle** - Switch between light and dark themes
- **Flip Toggle** - Mirror text horizontally

## ⚙️ Customization

### Adjusting Scrolling Speed
The speed slider controls how fast the text scrolls across the screen. Lower values mean slower scrolling, higher values mean faster scrolling. Find the speed that matches your natural reading pace.

### Font Size
Use the font size control to make text more legible based on:
- Your distance from the screen
- Your eyesight
- The ambient lighting conditions

### Theme Selection
- **Day Mode**: Light background with dark text (ideal for well-lit environments)
- **Night Mode**: Dark background with light text (reduces eye strain in low-light conditions)

### Text Flipping
Enable this option if you're using a physical teleprompter with glass or reflective surfaces. This mirrors the text horizontally so it reads correctly when reflected.

## 📄 File Support

### Supported Formats
- **Text Files** (`.txt`) - Plain text documents

### Uploading Files
1. Click the "Upload" button
2. Select a `.txt` file from your computer
3. The content will be automatically loaded into the text area

### Tips
- Ensure your text file is properly formatted before uploading
- Use clear, legible formatting in your script
- Test your script with the teleprompter before live use

## 🌐 Browser Compatibility

This application works on all modern browsers:
- ✅ Google Chrome (latest)
- ✅ Mozilla Firefox (latest)
- ✅ Safari (latest)
- ✅ Microsoft Edge (latest)
- ✅ Opera (latest)

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Suggestions for Improvements
- Additional themes and color schemes
- Keyboard shortcuts for common controls
- Timer display for timed presentations
- Text formatting options
- Multiple script management
- Export capabilities

## 📝 License

This project is open source and available under the MIT License. See the LICENSE file for more details.

## 💡 Tips for Best Results

1. **Test Before Use**: Always test your script and settings before a live presentation
2. **Proper Spacing**: Leave adequate line breaks in your script for natural pause points
3. **Font Size**: Use a font size that's comfortable for your distance from the screen
4. **Speed Calibration**: Practice with the speed setting to match your delivery pace
5. **Lighting**: Adjust the theme (Day/Night mode) based on your environment
6. **Backup**: Keep a copy of your script saved separately

## 🐛 Troubleshooting

**Text not scrolling?**
- Ensure you've clicked the "Start" button
- Check that text is present in the text area

**File won't upload?**
- Verify the file is in `.txt` format
- Check that the file is readable and not corrupted

**Text appears too small/large?**
- Use the font size slider to adjust
- Try zooming your browser in/out (Ctrl/Cmd + +/-)

---

Made with ❤️ for presenters and content creators everywhere.

Questions or feedback? Open an issue on GitHub!
