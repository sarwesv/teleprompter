document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const views = {
        edit: document.getElementById('edit-view'),
        play: document.getElementById('play-view')
    };

    const inputs = {
        script: document.getElementById('script-input'),
        speed: document.getElementById('speed-slider'),
        size: document.getElementById('size-slider'),
        scrubber: document.getElementById('script-scrubber'),
        theme: document.getElementById('theme-select'),
        font: document.getElementById('font-select'),
        themePlay: document.getElementById('theme-select-play'),
        fontPlay: document.getElementById('font-select-play')
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
        voice: document.getElementById('voice-btn'),
        toggleSettings: document.getElementById('toggle-settings-btn'),
        toggleSettingsPlay: document.getElementById('toggle-settings-play'),
        library: document.getElementById('library-btn'),
        closeLibrary: document.getElementById('close-library-btn')
    };
    
    const panels = {
        settings: document.getElementById('settings-panel'),
        settingsPlay: document.getElementById('play-settings-panel'),
        library: document.getElementById('library-sidebar'),
        overlay: document.getElementById('sidebar-overlay'),
        libraryList: document.getElementById('library-list')
    };
    
    const fileInput = document.getElementById('load-file-input');

    const display = {
        container: document.getElementById('prompter-display-container'),
        wrapper: document.getElementById('prompter-text-wrapper'),
        text: document.getElementById('prompter-text'),
        iconPlay: document.getElementById('icon-play'),
        iconPause: document.getElementById('icon-pause'),
        stats: {
            wpm: document.getElementById('stat-wpm'),
            total: document.getElementById('stat-total-time'),
            remaining: document.getElementById('stat-remaining-time')
        },
        editorStats: {
            words: document.getElementById('editor-word-count'),
            estimate: document.getElementById('editor-time-estimate')
        },
        eyeLine: document.getElementById('eye-line-marker')
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
    let totalWordCount = 0;
    let eyeLinePercent = parseFloat(localStorage.getItem('teleprompter_eye_line') || '35');
    
    // --- HOTKEYS SYSTEM ---
    let hotkeys = JSON.parse(localStorage.getItem('teleprompter_hotkeys') || JSON.stringify({
        togglePlay: 'Space',
        speedUp: 'ArrowRight',
        speedDown: 'ArrowLeft',
        edit: 'Escape'
    }));
    let recordingAction = null;

    // --- Stats Logic ---
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function updateStats() {
        if (!display.stats.wpm) return;

        const speedValue = parseInt(inputs.speed.value, 10);
        // Base WPM logic: 100 on slider = roughly 250 WPM. 1 on slider = 50 WPM.
        // Formula: WPM = (slider / 100 * 200) + 50
        const targetWPM = Math.floor((speedValue / 100) * 200) + 50;
        
        display.stats.wpm.textContent = targetWPM;

        if (totalWordCount > 0) {
            const totalSeconds = (totalWordCount / targetWPM) * 60;
            
            let remainingSeconds;
            if (useVoiceScroll) {
                // In voice mode, use consumed words for precision
                const remainingWords = Math.max(0, totalWordCount - currentWordIndex);
                remainingSeconds = (remainingWords / targetWPM) * 60;
            } else {
                // In auto-scroll mode, use actual scroll progress for a smooth countdown
                const maxScroll = display.wrapper.scrollHeight - display.container.clientHeight;
                const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollPosition / maxScroll)) : 0;
                remainingSeconds = totalSeconds * (1 - progress);
            }

            display.stats.total.textContent = formatTime(totalSeconds);
            display.stats.remaining.textContent = formatTime(remainingSeconds);
        }
    }

    function updateEditorStats() {
        // Use innerText to count actual words, ignoring HTML tags
        const text = inputs.script.innerText.trim();
        const words = text ? text.split(/\s+/).length : 0;
        
        // Base estimate on a standard reading speed (e.g., 150 WPM)
        const targetWPM = 150; 
        const totalSeconds = (words / targetWPM) * 60;

        if (display.editorStats.words) {
            display.editorStats.words.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
        }
        if (display.editorStats.estimate) {
            display.editorStats.estimate.textContent = `${formatTime(totalSeconds)} est.`;
        }
    }

    // --- LIBRARY SYSTEM ---
    let library = JSON.parse(localStorage.getItem('teleprompter_library') || '[]');

    function saveToLibrary() {
        const text = inputs.script.innerText.trim();
        const html = inputs.script.innerHTML;
        if (!text) return;

        // Extract a title from the first line
        const firstLine = text.split('\n')[0].substring(0, 40).trim() || 'Untitled Script';
        const newScript = {
            id: Date.now(),
            title: firstLine,
            content: html, // Store HTML now
            date: new Date().toLocaleString(),
            words: text.split(/\s+/).length
        };

        // Add to the beginning and keep only the 15 most recent
        library.unshift(newScript);
        library = library.slice(0, 15);
        
        localStorage.setItem('teleprompter_library', JSON.stringify(library));
        renderLibrary();
    }

    function renderLibrary() {
        if (!panels.libraryList) return;
        
        if (library.length === 0) {
            panels.libraryList.innerHTML = '<p class="empty-state">No saved scripts yet.</p>';
            return;
        }

        panels.libraryList.innerHTML = library.map(script => `
            <div class="library-item" data-id="${script.id}">
                <div class="library-item-header">
                    <div class="library-item-title">${script.title}</div>
                    <div class="library-item-meta">${script.date}</div>
                </div>
                <div class="library-item-meta">${script.words} words</div>
                <div class="library-item-actions">
                    <button class="btn primary-btn library-item-btn" onclick="window.loadScript(${script.id})">Load</button>
                    <button class="btn secondary-btn library-item-btn danger-hover" onclick="window.deleteScript(${script.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    window.loadScript = (id) => {
        const script = library.find(s => s.id === id);
        if (script) {
            inputs.script.innerHTML = script.content;
            updateEditorStats();
            toggleLibrary(false);
        }
    };

    window.deleteScript = (id) => {
        library = library.filter(s => s.id !== id);
        localStorage.setItem('teleprompter_library', JSON.stringify(library));
        renderLibrary();
    };

    function toggleLibrary(show) {
        panels.library.classList.toggle('open', show);
        panels.overlay.classList.toggle('visible', show);
    }

    // --- EYE-LINE DRAGGING ---
    function updateEyeLineUI() {
        if (display.eyeLine) {
            display.eyeLine.style.top = `${eyeLinePercent}%`;
            localStorage.setItem('teleprompter_eye_line', eyeLinePercent);
        }
    }

    if (display.eyeLine) {
        let isDragging = false;
        
        display.eyeLine.addEventListener('pointerdown', (e) => {
            isDragging = true;
            display.eyeLine.setPointerCapture(e.pointerId);
            display.eyeLine.classList.add('dragging');
        });

        display.eyeLine.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            
            const containerRect = display.container.getBoundingClientRect();
            const relativeY = e.clientY - containerRect.top;
            let newPercent = (relativeY / containerRect.height) * 100;
            
            // Clamp between 10% and 80% to keep it useful
            newPercent = Math.max(10, Math.min(85, newPercent));
            eyeLinePercent = newPercent;
            updateEyeLineUI();
            
            // If we are playing, we might want to adjust scroll to keep current word on the eye-line
            if (isPlaying && uiWords[currentWordIndex]) {
                const eyeLineOffset = display.container.clientHeight * (eyeLinePercent / 100);
                targetScrollPosition = Math.max(0, uiWords[currentWordIndex].offsetTop - eyeLineOffset);
            }
        });

        display.eyeLine.addEventListener('pointerup', (e) => {
            isDragging = false;
            display.eyeLine.releasePointerCapture(e.pointerId);
            display.eyeLine.classList.remove('dragging');
        });

        // Initialize UI
        updateEyeLineUI();
    }

    // --- HOTKEYS UI ---
    function updateHotkeyUI() {
        document.querySelectorAll('.hotkey-btn').forEach(btn => {
            const action = btn.dataset.action;
            btn.textContent = hotkeys[action] || 'None';
        });
    }

    document.querySelectorAll('.hotkey-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (recordingAction) {
                document.querySelector(`.hotkey-btn[data-action="${recordingAction}"]`)?.classList.remove('recording');
            }
            recordingAction = btn.dataset.action;
            btn.classList.add('recording');
            btn.textContent = 'Press any key...';
        });
    });

    function handleHotkeyRecording(e) {
        if (!recordingAction) return false;
        
        e.preventDefault();
        const key = e.code;
        hotkeys[recordingAction] = key;
        localStorage.setItem('teleprompter_hotkeys', JSON.stringify(hotkeys));
        
        document.querySelector(`.hotkey-btn[data-action="${recordingAction}"]`)?.classList.remove('recording');
        recordingAction = null;
        updateHotkeyUI();
        return true;
    }

    // --- RICH TEXT EDITOR LOGIC ---
    document.querySelectorAll('.tool-btn[data-command]').forEach(btn => {
        btn.addEventListener('click', () => {
            const command = btn.dataset.command;
            document.execCommand(command, false, null);
            inputs.script.focus();
        });
    });

    document.querySelectorAll('.color-btn[data-color]').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            document.execCommand('foreColor', false, color);
            inputs.script.focus();
        });
    });

    // Handle Cmd+B, Cmd+I
    inputs.script.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey) {
            if (e.key === 'b') {
                e.preventDefault();
                document.execCommand('bold', false, null);
            } else if (e.key === 'i') {
                e.preventDefault();
                document.execCommand('italic', false, null);
            }
        }
    });

    // Helper to process nodes for prompter (maintains styles but wraps words in spans)
    function processPrompterNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const fragment = document.createDocumentFragment();
            // Split by words while keeping whitespace
            const parts = node.textContent.split(/(\s+)/);
            
            parts.forEach(part => {
                if (part.trim().length === 0) {
                    fragment.appendChild(document.createTextNode(part));
                } else {
                    const span = document.createElement('span');
                    span.textContent = part;
                    span.dataset.clean = part.toLowerCase().replace(/[^\w\s]/g, '');
                    uiWords.push(span);
                    fragment.appendChild(span);
                }
            });
            return fragment;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const clone = node.cloneNode(false); // Clone without children
            node.childNodes.forEach(child => {
                clone.appendChild(processPrompterNode(child));
            });
            return clone;
        }
        return node.cloneNode(true);
    }

    // Core parameters
    const BASE_SPEED_MULTIPLIER = 0.5; // pixel per ms base roughly

    // --- Voice Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    // Voice scroll state tracking
    let speechResultsProcessedCount = 0;
    let lastHandledTranscriptWordIndex = -1;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            if (!useVoiceScroll || !isPlaying) return;

            // 1. Get the latest transcript (combination of processed and new)
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                fullTranscript += event.results[i][0].transcript;
            }

            let spokenWords = fullTranscript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
            if (spokenWords.length === 0) return;

            // 2. Only look at words we haven't successfully "consumed" yet
            // This prevents the same spoken word from matching multiple times in the script.
            const newWordsToProcess = spokenWords.slice(lastHandledTranscriptWordIndex + 1);
            if (newWordsToProcess.length === 0) return;

            let bestMatchInScript = -1;
            let consumedTranscriptCount = 0;
            let maxConsecutiveMatches = 0;

            // We iterate through the NEW transcript words and try to match them ahead in the script
            for (let swIdx = 0; swIdx < newWordsToProcess.length; swIdx++) {
                // How far ahead to look in the script? (window of 15 words)
                const searchLimit = Math.min(currentWordIndex + 15, uiWords.length);
                
                for (let i = currentWordIndex; i < searchLimit; i++) {
                    let scriptWord = uiWords[i].dataset.clean;
                    
                    if (scriptWord && scriptWord === newWordsToProcess[swIdx]) {
                        // We found a match for a word we haven't used yet!
                        
                        // Check for phrases (consecutive words) for higher confidence
                        let consecutive = 1;
                        while (
                            swIdx + consecutive < newWordsToProcess.length &&
                            i + consecutive < uiWords.length &&
                            uiWords[i + consecutive].dataset.clean &&
                            newWordsToProcess[swIdx + consecutive] === uiWords[i + consecutive].dataset.clean
                        ) {
                            consecutive++;
                        }

                        let matchDistance = i - currentWordIndex;
                        
                        // Selection criteria:
                        // - Phrases (2+ words) are high confidence and can skip ahead.
                        // - Single words are low confidence and only move if they are the NEXT 1-2 words.
                        if (consecutive > 1 || matchDistance <= 2) {
                            // If this matches more words OR is closer, it's better
                            if (consecutive >= maxConsecutiveMatches) {
                                maxConsecutiveMatches = consecutive;
                                bestMatchInScript = i + consecutive - 1;
                                consumedTranscriptCount = swIdx + consecutive;
                            }
                        }
                    }
                }
            }

            // 3. If we found a confident match, move the prompter and "consume" those transcript words
            if (bestMatchInScript !== -1 && bestMatchInScript >= currentWordIndex) {
                const previousIndex = currentWordIndex;
                currentWordIndex = bestMatchInScript;
                
                // Track that we used these words from the transcript
                lastHandledTranscriptWordIndex += consumedTranscriptCount;

                if (currentWordIndex !== previousIndex) {
                    const eyeLineOffset = display.container.clientHeight * (eyeLinePercent / 100);
                    targetScrollPosition = Math.max(0, uiWords[currentWordIndex].offsetTop - eyeLineOffset);

                    // Update Highlighting
                    uiWords.forEach((wordElement, idx) => {
                        if (idx < currentWordIndex) {
                            wordElement.style.opacity = '0.4';
                            wordElement.style.color = '';
                        } else if (idx === currentWordIndex) {
                            wordElement.style.opacity = '1';
                            wordElement.style.color = 'var(--accent-color)';
                        } else {
                            wordElement.style.opacity = '1';
                            wordElement.style.color = '';
                        }
                    });
                }
            }
        };

        recognition.onend = () => {
            // When recognition ends, we reset the transcript index because a new session will start from index 0
            lastHandledTranscriptWordIndex = -1;
            if (useVoiceScroll && isPlaying) {
                try { recognition.start(); } catch (e) { }
            }
        };
    }

    // --- Initialization ---
    // Load saved script if exists
    const savedScriptHTML = localStorage.getItem('teleprompter_script_html');
    const savedScript = localStorage.getItem('teleprompter_script');
    
    if (savedScriptHTML) {
        inputs.script.innerHTML = savedScriptHTML;
    } else if (savedScript) {
        inputs.script.innerText = savedScript;
    }

    // --- Visual Styles Setup ---
    function applyTheme(theme) {
        document.body.classList.remove('theme-midnight', 'theme-paper', 'theme-classic');
        if (theme !== 'midnight') {
            document.body.classList.add(`theme-${theme}`);
        }
        localStorage.setItem('teleprompter_theme', theme);
        if (inputs.theme) inputs.theme.value = theme;
        if (inputs.themePlay) inputs.themePlay.value = theme;
    }

    function applyFont(font) {
        display.text.classList.remove('font-sans', 'font-serif', 'font-mono');
        display.text.classList.add(font);
        localStorage.setItem('teleprompter_font', font);
        if (inputs.font) inputs.font.value = font;
        if (inputs.fontPlay) inputs.fontPlay.value = font;
    }

    // Initial load
    const savedTheme = localStorage.getItem('teleprompter_theme') || 'midnight';
    const savedFont = localStorage.getItem('teleprompter_font') || 'font-sans';
    applyTheme(savedTheme);
    applyFont(savedFont);

    // Listeners
    if (inputs.theme) {
        inputs.theme.addEventListener('change', (e) => applyTheme(e.target.value));
    }
    if (inputs.font) {
        inputs.font.addEventListener('change', (e) => applyFont(e.target.value));
    }
    if (inputs.themePlay) {
        inputs.themePlay.addEventListener('change', (e) => applyTheme(e.target.value));
    }
    if (inputs.fontPlay) {
        inputs.fontPlay.addEventListener('change', (e) => applyFont(e.target.value));
    }

    if (buttons.toggleSettings) {
        buttons.toggleSettings.addEventListener('click', () => {
            const isHidden = panels.settings.style.display === 'none';
            panels.settings.style.display = isHidden ? 'flex' : 'none';
            buttons.toggleSettings.classList.toggle('active-toggle', isHidden);
        });
    }

    if (buttons.toggleSettingsPlay) {
        buttons.toggleSettingsPlay.addEventListener('click', () => {
            const isHidden = panels.settingsPlay.style.display === 'none';
            panels.settingsPlay.style.display = isHidden ? 'flex' : 'none';
            buttons.toggleSettingsPlay.classList.toggle('active-toggle', isHidden);
        });
    }

    if (buttons.library) {
        buttons.library.addEventListener('click', () => toggleLibrary(true));
    }
    if (buttons.closeLibrary) {
        buttons.closeLibrary.addEventListener('click', () => toggleLibrary(false));
    }
    if (panels.overlay) {
        panels.overlay.addEventListener('click', () => toggleLibrary(false));
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
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Append final results to the textarea with basic punctuation
            if (finalTranscript) {
                let currentVal = inputs.script.value;
                
                // Capitalize first letter if script is empty or ends with punctuation
                const isStartOfSentence = currentVal.trim().length === 0 || 
                                          window.lastDictationEndedWithPunctuation;
                
                if (isStartOfSentence) {
                    finalTranscript = finalTranscript.trimStart();
                    if (finalTranscript.length > 0) {
                        finalTranscript = finalTranscript.charAt(0).toUpperCase() + finalTranscript.slice(1);
                    }
                }

                // Add a period if it doesn't end with punctuation already
                const trimmedFinal = finalTranscript.trimEnd();
                if (trimmedFinal.length > 0 && !/[.!?]$/.test(trimmedFinal)) {
                    finalTranscript = trimmedFinal + '. ';
                    window.lastDictationEndedWithPunctuation = true;
                } else if (trimmedFinal.length > 0) {
                    finalTranscript = trimmedFinal + ' ';
                    window.lastDictationEndedWithPunctuation = true;
                } else {
                    window.lastDictationEndedWithPunctuation = false;
                }

                // Determine if we need to add a space before the new text
                const needsSpace = currentVal.length > 0 && !currentVal.endsWith(' ') && !currentVal.endsWith('\n') && !isStartOfSentence;
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
            
            const indicator = document.getElementById('dictation-indicator');
            if (indicator) indicator.style.display = 'flex';

            if (buttons.dictateBtn) {
                buttons.dictateBtn.classList.add('active-toggle');
                buttons.dictateBtn.style.background = '#ef4444'; // Red color to indicate recording
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
        
        const indicator = document.getElementById('dictation-indicator');
        if (indicator) indicator.style.display = 'none';

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

    inputs.script.addEventListener('input', () => {
        updateEditorStats();
        localStorage.setItem('teleprompter_script', inputs.script.value.trim());
    });
    
    // Initial calls
    updateEditorStats();
    renderLibrary();
    updateHotkeyUI();

    buttons.startEdit.addEventListener('click', () => {
        const scriptContent = inputs.script.innerText.trim();
        const scriptHTML = inputs.script.innerHTML;
        if (!scriptContent) {
            alert('Please enter or paste your script first!');
            return;
        }
        
        // Auto-save to library when starting
        saveToLibrary();
        
        // Setup prompter text via node processing to preserve Rich Text
        display.text.innerHTML = '';
        uiWords = [];
        
        // Use a temp div to process the HTML
        const temp = document.createElement('div');
        temp.innerHTML = scriptHTML;
        
        temp.childNodes.forEach(child => {
            display.text.appendChild(processPrompterNode(child));
        });

        totalWordCount = uiWords.length;

        localStorage.setItem('teleprompter_script_html', scriptHTML);
        localStorage.setItem('teleprompter_script', scriptContent);

        switchView('play');

        // Wait for DOM layout so offsetTop is accurate
        setTimeout(() => {
            currentWordIndex = 0;
            if (useVoiceScroll && uiWords.length > 0) {
                const eyeLineOffset = display.container.clientHeight * (eyeLinePercent / 100);
                targetScrollPosition = Math.max(0, uiWords[0].offsetTop - eyeLineOffset);
                scrollPosition = targetScrollPosition;
            } else {
                scrollPosition = 0;
                targetScrollPosition = 0;
            }
            updateScrollTransform();
            updateStats();
        }, 50);

        setTimeout(startScrolling, 500); // Small delay to let UI settle before auto-starting
    });

    buttons.clearEdit.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your script?')) {
            inputs.script.innerHTML = '';
            localStorage.removeItem('teleprompter_script');
            localStorage.removeItem('teleprompter_script_html');
            updateEditorStats();
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
                        const eyeLineOffset = display.container.clientHeight * (eyeLinePercent / 100);
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
    });

    inputs.speed.addEventListener('input', () => {
        updateStats();
    });

    if (inputs.scrubber) {
        inputs.scrubber.addEventListener('input', handleScrub);
    }

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

        if (deltaTime > 0 && deltaTime < 100) {
            if (!useVoiceScroll) {
                // Auto-scroll mode
                const speedValue = parseInt(inputs.speed.value, 10);
                const pxPerSecond = (speedValue / 100) * 400 + 10;
                const pxPerFrame = pxPerSecond * (deltaTime / 1000);
                targetScrollPosition += pxPerFrame;
            }

            // Smooth gliding (Lerp) logic for all modes
            // We smoothly move scrollPosition towards targetScrollPosition
            const diff = targetScrollPosition - scrollPosition;
            const lerpFactor = 1 - Math.exp(-deltaTime / 80); // ~80ms time constant for smooth glide
            
            if (Math.abs(diff) > 0.1) {
                scrollPosition += diff * lerpFactor;
            } else {
                scrollPosition = targetScrollPosition;
            }

            // Boundary checks
            const maxScroll = display.wrapper.scrollHeight - display.container.clientHeight;
            if (targetScrollPosition > maxScroll + 100) { // Buffer for smooth end
                stopScrolling();
                return;
            }

            updateScrollTransform();
            updateStats();
            updateScrubber();
        }

        animationFrameId = requestAnimationFrame(scrollLoop);
    }

    function updateScrubber() {
        if (!inputs.scrubber) return;
        const wrapperHeight = display.wrapper.scrollHeight - display.container.clientHeight;
        if (wrapperHeight > 0) {
            const progress = (scrollPosition / wrapperHeight) * 100;
            inputs.scrubber.value = progress;
        }
    }

    function handleScrub(e) {
        const progress = parseFloat(e.target.value);
        const wrapperHeight = display.wrapper.scrollHeight - display.container.clientHeight;
        targetScrollPosition = (progress / 100) * wrapperHeight;
        // Don't set scrollPosition directly, let the loop glide to it
        
        // Find current word index based on target scroll position
        const eyeLineOffset = display.container.clientHeight * (eyeLinePercent / 100);
        const currentTargetY = scrollPosition + eyeLineOffset;
        
        let bestWordIdx = 0;
        let minDiff = Infinity;
        
        uiWords.forEach((word, idx) => {
            const diff = Math.abs(word.offsetTop - currentTargetY);
            if (diff < minDiff) {
                minDiff = diff;
                bestWordIdx = idx;
            }
        });
        
        currentWordIndex = bestWordIdx;

        // Update Highlighting
        uiWords.forEach((wordElement, idx) => {
            if (idx < currentWordIndex) {
                wordElement.style.opacity = '0.4';
                wordElement.style.color = '';
            } else if (idx === currentWordIndex) {
                wordElement.style.opacity = '1';
                wordElement.style.color = 'var(--accent-color)';
            } else {
                wordElement.style.opacity = '1';
                wordElement.style.color = '';
            }
        });

        updateStats();
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
        // Handle Recording first
        if (handleHotkeyRecording(e)) return;

        // Only active if in play view
        if (views.play.classList.contains('active')) {
            const keyCode = e.code;
            
            // Find action for this key
            const action = Object.keys(hotkeys).find(key => hotkeys[key] === keyCode);
            
            if (action === 'togglePlay') {
                e.preventDefault();
                buttons.playPause.click();
            } else if (action === 'edit') {
                e.preventDefault();
                buttons.edit.click();
            } else if (action === 'speedUp') {
                e.preventDefault();
                inputs.speed.value = Math.min(100, parseInt(inputs.speed.value) + 5);
                updateStats();
            } else if (action === 'speedDown') {
                e.preventDefault();
                inputs.speed.value = Math.max(1, parseInt(inputs.speed.value) - 5);
                updateStats();
            } else if (keyCode === 'ArrowUp') {
                e.preventDefault();
                targetScrollPosition = Math.max(0, targetScrollPosition - 150);
            } else if (keyCode === 'ArrowDown') {
                e.preventDefault();
                targetScrollPosition += 150;
            }
        }
    });

    // Wheel / Trackpad Support
    display.container.addEventListener('wheel', (e) => {
        if (views.play.classList.contains('active')) {
            e.preventDefault();
            targetScrollPosition += e.deltaY;
            targetScrollPosition = Math.max(0, targetScrollPosition);
        }
    }, { passive: false });

    // Initialize with font size from slider
    display.text.style.fontSize = `${inputs.size.value}px`;
});
