document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const views = {
        edit: document.getElementById('edit-view'),
        play: document.getElementById('play-view')
    };

    const inputs = {
        script: document.getElementById('script-input'),
        speed: document.getElementById('speed-slider'),
        size: document.getElementById('size-slider')
    };

    const buttons = {
        startEdit: document.getElementById('start-prompter-btn'),
        clearEdit: document.getElementById('new-prompter-btn-edit'),
        saveBtn: document.getElementById('save-btn'),
        loadBtn: document.getElementById('load-btn'),
        dictateBtn: document.getElementById('dictate-btn'),
        playPause: document.getElementById('play-pause-btn'),
        edit: document.getElementById('edit-btn'),
        mirror: document.getElementById('mirror-btn'),
        voice: document.getElementById('voice-btn')
    };
    
    const fileInput = document.getElementById('load-file-input');

    const display = {
        container: document.getElementById('prompter-display-container'),
        wrapper: document.getElementById('prompter-text-wrapper'),
        text: document.getElementById('prompter-text'),
        iconPlay: document.getElementById('icon-play'),
        iconPause: document.getElementById('icon-pause')
    };

    // State Variables
    let isPlaying = false;
    let isMirrored = false;
    let useVoiceScroll = false;
    let currentWordIndex = 0;
    let targetScrollPosition = 0;
    let uiWords = [];
    let scrollPosition = 0;
    let animationFrameId = null;
    let lastTimestamp = 0;

    // Core parameters
    const BASE_SPEED_MULTIPLIER = 0.5; // pixel per ms base roughly

    // --- Voice Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            if (!useVoiceScroll || !isPlaying) return;

            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                interimTranscript += event.results[i][0].transcript;
            }

            let spokenWords = interimTranscript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
            if (spokenWords.length === 0) return;

            const recentSpoken = spokenWords.slice(-5);
            let bestMatchIndex = -1;
            let maxConsecutiveMatches = 0;
            let matchDistance = 999;

            for (let swIdx = 0; swIdx < recentSpoken.length; swIdx++) {
                for (let i = currentWordIndex; i < Math.min(currentWordIndex + 15, uiWords.length); i++) {
                    let scriptWord = uiWords[i].dataset.clean;
                    if (scriptWord && scriptWord === recentSpoken[swIdx]) {
                        let consecutive = 1;
                        while (
                            swIdx + consecutive < recentSpoken.length &&
                            i + consecutive < uiWords.length &&
                            uiWords[i + consecutive].dataset.clean &&
                            recentSpoken[swIdx + consecutive] === uiWords[i + consecutive].dataset.clean
                        ) {
                            consecutive++;
                        }

                        if (consecutive > maxConsecutiveMatches) {
                            maxConsecutiveMatches = consecutive;
                            bestMatchIndex = i + consecutive - 1;
                            matchDistance = i - currentWordIndex;
                        } else if (consecutive === maxConsecutiveMatches && maxConsecutiveMatches > 0) {
                            if ((i - currentWordIndex) < matchDistance) {
                                bestMatchIndex = i + consecutive - 1;
                                matchDistance = i - currentWordIndex;
                            }
                        }
                    }
                }
            }

            if (bestMatchIndex !== -1) {
                // For single-word matches, require them to be close to avoid jumps to repeated words.
                if (maxConsecutiveMatches > 1 || matchDistance <= 3) {
                    currentWordIndex = bestMatchIndex;
                    const eyeLineOffset = display.container.clientHeight * 0.35;
                    targetScrollPosition = Math.max(0, uiWords[currentWordIndex].offsetTop - eyeLineOffset);

                    // Dim previous words and highlight current
                    uiWords.forEach(w => {
                        w.style.opacity = '1';
                        w.style.color = '';
                    });
                    for (let j = 0; j < currentWordIndex; j++) {
                        uiWords[j].style.opacity = '0.5';
                    }
                    uiWords[currentWordIndex].style.color = 'var(--accent-color)';
                }
            }
        };

        recognition.onend = () => {
            if (useVoiceScroll && isPlaying) {
                try { recognition.start(); } catch (e) { }
            }
        };
    }

    // --- Initialization ---
    // Load saved script if exists
    const savedScript = localStorage.getItem('teleprompter_script');
    if (savedScript) {
        inputs.script.value = savedScript;
    }

    // --- View Switching ---
    function switchView(targetView) {
        Object.values(views).forEach(view => view.classList.remove('active'));
        views[targetView].classList.add('active');
    }

    // --- Dictation Feature Setup ---
    let isDictating = false;
    let dictationRecognition = null;

    if (SpeechRecognition) {
        dictationRecognition = new SpeechRecognition();
        dictationRecognition.continuous = true;
        dictationRecognition.interimResults = true;

        dictationRecognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Append final results to the textarea
            if (finalTranscript) {
                // Determine if we need to add a space before the new text
                const currentVal = inputs.script.value;
                const needsSpace = currentVal.length > 0 && !currentVal.endsWith(' ') && !currentVal.endsWith('\n');
                inputs.script.value += (needsSpace ? ' ' : '') + finalTranscript;
            }
        };

        dictationRecognition.onerror = (event) => {
            console.error('Dictation error:', event.error);
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone permissions to use dictation.');
                stopDictation();
            }
        };

        dictationRecognition.onend = () => {
            if (isDictating) {
                // Auto-restart if it stops unexpectedly while dictating
                try { dictationRecognition.start(); } catch (e) {}
            }
        };
    } else {
        if (buttons.dictateBtn) {
            buttons.dictateBtn.style.display = 'none';
        }
    }

    function toggleDictation() {
        if (!dictationRecognition) return;

        if (isDictating) {
            stopDictation();
        } else {
            startDictation();
        }
    }

    function startDictation() {
        try {
            dictationRecognition.start();
            isDictating = true;
            if (buttons.dictateBtn) {
                buttons.dictateBtn.classList.add('active-toggle');
                buttons.dictateBtn.style.background = 'var(--accent-color)';
                buttons.dictateBtn.style.color = 'white';
                buttons.dictateBtn.style.border = 'none';
                buttons.dictateBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="14" height="14" x="5" y="5" rx="2" ry="2"/>
                    </svg>
                    Stop Dictating
                `;
            }
        } catch (e) {
            console.error('Failed to start dictation:', e);
        }
    }

    function stopDictation() {
        isDictating = false;
        dictationRecognition.stop();
        if (buttons.dictateBtn) {
            buttons.dictateBtn.classList.remove('active-toggle');
            buttons.dictateBtn.style.background = '';
            buttons.dictateBtn.style.color = '';
            buttons.dictateBtn.style.border = '';
            buttons.dictateBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
                Dictate
            `;
        }
    }

    // --- Event Listeners (Edit View) ---
    if (buttons.dictateBtn) {
        buttons.dictateBtn.addEventListener('click', toggleDictation);
    }

    buttons.startEdit.addEventListener('click', () => {
        const scriptContent = inputs.script.value.trim();
        if (!scriptContent) {
            alert('Please enter a script before starting.');
            return;
        }

        // Save to local storage
        localStorage.setItem('teleprompter_script', scriptContent);

        // Setup text with spans for voice tracking
        display.text.innerHTML = '';
        uiWords = [];
        const words = scriptContent.split(/(\s+)/);
        words.forEach((wordStr) => {
            if (wordStr.trim().length === 0) {
                display.text.appendChild(document.createTextNode(wordStr));
            } else {
                const span = document.createElement('span');
                span.textContent = wordStr;
                span.dataset.clean = wordStr.toLowerCase().replace(/[^\w\s]/g, '');
                display.text.appendChild(span);
                uiWords.push(span);
            }
        });

        switchView('play');

        // Wait for DOM layout so offsetTop is accurate
        setTimeout(() => {
            currentWordIndex = 0;
            if (useVoiceScroll && uiWords.length > 0) {
                const eyeLineOffset = display.container.clientHeight * 0.35;
                targetScrollPosition = Math.max(0, uiWords[0].offsetTop - eyeLineOffset);
                scrollPosition = targetScrollPosition;
            } else {
                scrollPosition = 0;
                targetScrollPosition = 0;
            }
            updateScrollTransform();
        }, 50);

        setTimeout(startScrolling, 500); // Small delay to let UI settle before auto-starting
    });

    buttons.clearEdit.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your script?')) {
            inputs.script.value = '';
            localStorage.removeItem('teleprompter_script');
        }
    });

    let scriptsDirectoryHandle = null;

    async function getScriptsDirectory() {
        if (scriptsDirectoryHandle) return scriptsDirectoryHandle;
        try {
            // Ask user to select a directory
            scriptsDirectoryHandle = await window.showDirectoryPicker({
                id: 'teleprompter-scripts',
                mode: 'readwrite'
            });
            return scriptsDirectoryHandle;
        } catch (err) {
            console.error('Error picking directory:', err);
            return null;
        }
    }

    buttons.saveBtn.addEventListener('click', async () => {
        const scriptContent = inputs.script.value.trim();
        if (!scriptContent) {
            alert('Cannot save an empty script.');
            return;
        }

        if (!window.showSaveFilePicker || !window.showDirectoryPicker) {
            alert('Your browser does not support saving to a specific folder natively. We will use the standard download method.');
            // Fallback for unsupported browsers
            let fileName = prompt('Enter a name for your script:', 'my script1');
            if (fileName === null) return;
            fileName = fileName.trim() || 'my script1';
            if (!fileName.endsWith('.txt')) fileName += '.txt';

            const blob = new Blob([scriptContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return;
        }

        try {
            const dirHandle = await getScriptsDirectory();
            if (!dirHandle) return; // User cancelled

            let fileName = prompt('Enter a name for your script:', 'my script1');
            if (fileName === null) return;
            fileName = fileName.trim() || 'my script1';
            if (!fileName.endsWith('.txt')) fileName += '.txt';

            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(scriptContent);
            await writable.close();
            
            alert(`Script saved successfully to ${dirHandle.name}/${fileName}`);
        } catch (err) {
            console.error('Save failed:', err);
            // If they cancel or it fails, silently fail or show generic alert
        }
    });

    buttons.loadBtn.addEventListener('click', async () => {
        if (!window.showOpenFilePicker || !window.showDirectoryPicker) {
            // Fallback to standard file input
            fileInput.click();
            return;
        }

        try {
            const dirHandle = await getScriptsDirectory();
            if (!dirHandle) return; // User cancelled

            const [fileHandle] = await window.showOpenFilePicker({
                startIn: dirHandle,
                types: [{
                    description: 'Text Files',
                    accept: {
                        'text/plain': ['.txt']
                    }
                }]
            });

            const file = await fileHandle.getFile();
            const content = await file.text();
            
            inputs.script.value = content;
            localStorage.setItem('teleprompter_script', content);
        } catch (err) {
            console.error('Load failed:', err);
        }
    });

    // Fallback file input change handler (kept for browsers that don't support showOpenFilePicker)
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            inputs.script.value = event.target.result;
            // Optionally, we could auto-save to local storage here as well
            localStorage.setItem('teleprompter_script', event.target.result);
        };
        reader.readAsText(file);
        
        // Reset the input so the same file can be loaded again if needed
        e.target.value = '';
    });

    // --- Event Listeners (Play View) ---
    buttons.playPause.addEventListener('click', () => {
        if (isPlaying) {
            stopScrolling();
        } else {
            startScrolling();
        }
    });

    buttons.edit.addEventListener('click', () => {
        stopScrolling();
        switchView('edit');
    });

    buttons.mirror.addEventListener('click', () => {
        isMirrored = !isMirrored;
        if (isMirrored) {
            display.text.classList.add('mirrored');
            buttons.mirror.style.background = 'var(--accent-color)';
            buttons.mirror.style.border = 'none';
        } else {
            display.text.classList.remove('mirrored');
            buttons.mirror.style.background = '';
            buttons.mirror.style.border = '';
        }
    });

    if (buttons.voice) {
        if (!SpeechRecognition) {
            buttons.voice.style.display = 'none';
        } else {
            buttons.voice.addEventListener('click', () => {
                useVoiceScroll = !useVoiceScroll;
                if (useVoiceScroll) {
                    buttons.voice.classList.add('active-toggle');
                    inputs.speed.parentElement.style.opacity = '0.3';

                    if (uiWords.length > currentWordIndex) {
                        const eyeLineOffset = display.container.clientHeight * 0.35;
                        targetScrollPosition = Math.max(0, uiWords[currentWordIndex].offsetTop - eyeLineOffset);
                    }

                    if (isPlaying) {
                        try { recognition.start(); } catch (e) { }
                    }
                } else {
                    buttons.voice.classList.remove('active-toggle');
                    inputs.speed.parentElement.style.opacity = '1';
                    if (isPlaying) {
                        recognition.stop();
                    }
                }
            });
        }
    }

    // --- Settings Sliders ---
    inputs.size.addEventListener('input', (e) => {
        display.text.style.fontSize = `${e.target.value}px`;
        // We recalculate layout limits if needed when size changes, but CSS handles it gracefully
    });

    const updatePlayPauseIcons = () => {
        if (isPlaying) {
            display.iconPlay.style.display = 'none';
            display.iconPause.style.display = 'block';
            buttons.playPause.classList.add('playing');
        } else {
            display.iconPlay.style.display = 'block';
            display.iconPause.style.display = 'none';
            buttons.playPause.classList.remove('playing');
        }
    };

    // --- Core Teleprompter Engine ---
    function updateScrollTransform() {
        // translateY negative to go up
        display.wrapper.style.transform = `translateY(-${scrollPosition}px)`;
    }

    function scrollLoop(timestamp) {
        if (!isPlaying) return;

        if (!lastTimestamp) lastTimestamp = timestamp;

        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        if (deltaTime > 0 && deltaTime < 100) { // Safety cap on deltaTime
            if (useVoiceScroll) {
                const diff = targetScrollPosition - scrollPosition;
                if (Math.abs(diff) > 1) { // Lerp towards target
                    scrollPosition += diff * (deltaTime / 200);
                }
                const wrapperHeight = display.wrapper.scrollHeight;
                if (scrollPosition > wrapperHeight) {
                    stopScrolling();
                    return;
                }
                updateScrollTransform();
            } else {
                const speedValue = parseInt(inputs.speed.value, 10);
                const pxPerSecond = (speedValue / 100) * 400 + 10;
                const pxPerFrame = pxPerSecond * (deltaTime / 1000);

                scrollPosition += pxPerFrame;

                const wrapperHeight = display.wrapper.scrollHeight;
                if (scrollPosition > wrapperHeight) {
                    stopScrolling();
                    return;
                }

                updateScrollTransform();
            }
        }

        animationFrameId = requestAnimationFrame(scrollLoop);
    }

    function startScrolling() {
        if (isPlaying) return;
        isPlaying = true;
        lastTimestamp = 0;
        updatePlayPauseIcons();
        animationFrameId = requestAnimationFrame(scrollLoop);

        if (useVoiceScroll && recognition) {
            try { recognition.start(); } catch (e) { }
        }
    }

    function stopScrolling() {
        if (!isPlaying) return;
        isPlaying = false;
        updatePlayPauseIcons();
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (useVoiceScroll && recognition) {
            recognition.stop();
        }
    }

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        // Only active if in play view
        if (views.play.classList.contains('active')) {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent default page scroll
                buttons.playPause.click();
            } else if (e.code === 'Escape') {
                buttons.edit.click();
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                scrollPosition = Math.max(0, scrollPosition - 50);
                updateScrollTransform();
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                const wrapperHeight = display.wrapper.scrollHeight;
                scrollPosition = Math.min(wrapperHeight, scrollPosition + 50);
                updateScrollTransform();
            } else if (e.code === 'ArrowRight') {
                inputs.speed.value = Math.min(100, parseInt(inputs.speed.value) + 5);
            } else if (e.code === 'ArrowLeft') {
                inputs.speed.value = Math.max(1, parseInt(inputs.speed.value) - 5);
            }
        }
    });

    // Initialize with font size from slider
    display.text.style.fontSize = `${inputs.size.value}px`;
});
